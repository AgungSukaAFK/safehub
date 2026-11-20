"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import {
  ACCENT_STORAGE_KEY,
  DEFAULT_ACCENT,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  FONT_FAMILY_STORAGE_KEY,
  FONT_SIZE_STORAGE_KEY,
  THEME_STORAGE_KEY,
  accentThemes,
  fontFamilies,
  fontSizes,
  isAccent,
  type AccentTheme,
  type FontFamily,
  type FontSize,
  type ThemeMode,
} from "@/lib/font-options";
import { runViewTransition } from "@/lib/view-transition";

// Provider tampilan (frontend-guide §5): 4 mode (next-themes) + aksen + font + ukuran font.
// Semua perubahan lewat runViewTransition. Disimpan per perangkat dengan key ber-prefix app.

type AppearanceContextValue = {
  accent: AccentTheme;
  /** true = user sudah pernah memilih aksen sendiri (aksen prediktif tidak dipakai) */
  accentChosen: boolean;
  setAccent: (accent: AccentTheme) => void;
  /** Aksen prediktif dari company user. Diabaikan kalau user sudah memilih. */
  applyCompanyAccent: (accent: string | null | undefined) => void;
  fontFamily: FontFamily;
  setFontFamily: (font: FontFamily) => void;
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* abaikan */
  }
}

function applyAccentClass(accent: AccentTheme) {
  const root = document.documentElement;
  accentThemes.forEach((t) => root.classList.remove(`theme-${t.name}`));
  if (accent !== DEFAULT_ACCENT) root.classList.add(`theme-${accent}`);
}

function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [accent, setAccentState] = useState<AccentTheme>(DEFAULT_ACCENT);
  const [accentChosen, setAccentChosen] = useState(false);
  const [fontFamily, setFontFamilyState] = useState<FontFamily>(DEFAULT_FONT_FAMILY);
  const [fontSize, setFontSizeState] = useState<FontSize>(DEFAULT_FONT_SIZE);

  // Baca setelah mount (script anti-flash sudah memasang class/atribut, jadi tidak ada kedipan).
  useEffect(() => {
    const load = () => {
      const a = readJson(ACCENT_STORAGE_KEY);
      if (isAccent(a)) {
        setAccentState(a);
        setAccentChosen(true);
      }
      const f = readJson(FONT_FAMILY_STORAGE_KEY);
      setFontFamilyState(fontFamilies.find((x) => x.name === f)?.name ?? DEFAULT_FONT_FAMILY);
      const s = readJson(FONT_SIZE_STORAGE_KEY);
      setFontSizeState(fontSizes.find((x) => x.name === s)?.name ?? DEFAULT_FONT_SIZE);
    };
    load();
    // Sinkron antar tab
    const onStorage = (e: StorageEvent) => {
      if ([ACCENT_STORAGE_KEY, FONT_FAMILY_STORAGE_KEY, FONT_SIZE_STORAGE_KEY].includes(e.key ?? "")) load();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => applyAccentClass(accent), [accent]);

  useEffect(() => {
    const root = document.documentElement;
    if (fontFamily === DEFAULT_FONT_FAMILY) delete root.dataset.font;
    else root.dataset.font = fontFamily;
  }, [fontFamily]);

  useEffect(() => {
    const root = document.documentElement;
    if (fontSize === DEFAULT_FONT_SIZE) delete root.dataset.fontSize;
    else root.dataset.fontSize = fontSize;
  }, [fontSize]);

  const setAccent = useCallback((next: AccentTheme) => {
    writeJson(ACCENT_STORAGE_KEY, next);
    runViewTransition(() => {
      setAccentState(next);
      setAccentChosen(true);
    });
  }, []);

  const applyCompanyAccent = useCallback(
    (companyAccent: string | null | undefined) => {
      if (accentChosen || readJson(ACCENT_STORAGE_KEY) !== null) return;
      setAccentState(isAccent(companyAccent) ? companyAccent : DEFAULT_ACCENT);
    },
    [accentChosen],
  );

  const setFontFamily = useCallback((next: FontFamily) => {
    writeJson(FONT_FAMILY_STORAGE_KEY, next);
    runViewTransition(() => setFontFamilyState(next));
  }, []);

  // Ukuran font sengaja tanpa animasi (slider, berubah beruntun saat digeser)
  const setFontSize = useCallback((next: FontSize) => {
    writeJson(FONT_SIZE_STORAGE_KEY, next);
    setFontSizeState(next);
  }, []);

  const value = useMemo(
    () => ({ accent, accentChosen, setAccent, applyCompanyAccent, fontFamily, setFontFamily, fontSize, setFontSize }),
    [accent, accentChosen, setAccent, applyCompanyAccent, fontFamily, setFontFamily, fontSize, setFontSize],
  );

  return <AppearanceContext value={value}>{children}</AppearanceContext>;
}

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      themes={["light", "dark", "soft-light", "soft-dark"]}
      storageKey={THEME_STORAGE_KEY}
      disableTransitionOnChange
    >
      <AppearanceProvider>{children}</AppearanceProvider>
    </NextThemesProvider>
  );
}

export function useAppearance() {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error("useAppearance harus dipakai di dalam AppThemeProvider");
  return ctx;
}

/**
 * Mode tema. WAJIB pakai setMode dari sini (sudah lewat runViewTransition, dengan origin untuk
 * efek melingkar), bukan setTheme next-themes langsung.
 */
export function useThemeMode() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const setMode = useCallback(
    (mode: ThemeMode, origin?: { x: number; y: number }) => runViewTransition(() => setTheme(mode), { origin }),
    [setTheme],
  );
  const isDark = resolvedTheme === "dark" || resolvedTheme === "soft-dark";
  return { mode: (theme ?? "system") as ThemeMode, resolvedTheme, isDark, setMode };
}

/** Pasang aksen prediktif dari company user (dipakai di layout (app)). */
export function CompanyAccent({ accent }: { accent: string | null }) {
  const { applyCompanyAccent } = useAppearance();
  useEffect(() => applyCompanyAccent(accent), [accent, applyCompanyAccent]);
  return null;
}
