// Opsi tampilan (frontend-guide §5). Dipisah dari provider (client) supaya bisa dipakai server
// component (script anti-flash di app/layout.tsx).
import { APP_ID } from "@/lib/app-config";

export const fontFamilies = [
  { name: "geist", label: "Geist (Default)", preview: "var(--font-geist-sans)" },
  { name: "inter", label: "Inter", preview: "var(--font-inter)" },
  { name: "jakarta", label: "Plus Jakarta Sans", preview: "var(--font-jakarta)" },
  { name: "poppins", label: "Poppins", preview: "var(--font-poppins)" },
  { name: "nunito", label: "Nunito", preview: "var(--font-nunito)" },
  { name: "roboto", label: "Roboto", preview: "var(--font-roboto)" },
  { name: "atkinson", label: "Atkinson Hyperlegible", preview: "var(--font-atkinson)" },
  { name: "system", label: "Font Sistem", preview: "system-ui, sans-serif" },
] as const;

/** Dipasang sebagai font-size <html>: semua ukuran rem ikut berubah. */
export const fontSizes = [
  { name: "sm", label: "Kecil", scale: "87.5%" },
  { name: "md", label: "Menengah", scale: "100%" },
  { name: "lg", label: "Besar", scale: "112.5%" },
  { name: "xl", label: "Sangat Besar", scale: "125%" },
] as const;

export type FontFamily = (typeof fontFamilies)[number]["name"];
export type FontSize = (typeof fontSizes)[number]["name"];

export const DEFAULT_FONT_FAMILY: FontFamily = "geist";
export const DEFAULT_FONT_SIZE: FontSize = "md";

// Key lengkap (sudah ber-prefix) karena juga dibaca script inline sebelum React jalan.
// Nilai disimpan sebagai JSON, sama dengan lib/storage.ts.
export const THEME_STORAGE_KEY = `${APP_ID}:theme`;
export const ACCENT_STORAGE_KEY = `${APP_ID}:accent`;
export const FONT_FAMILY_STORAGE_KEY = `${APP_ID}:font-family`;
export const FONT_SIZE_STORAGE_KEY = `${APP_ID}:font-size`;

/**
 * Aksen yang tersedia (sesuai .theme-<name> di globals.css). `color` = primary mode terang untuk
 * swatch. Company baru dengan aksen baru: tambahkan class di globals.css + baris di sini.
 */
export const accentThemes = [
  { name: "gmi", label: "GMI", color: "#242365", group: "company" },
  { name: "gis", label: "GIS", color: "rgb(23 88 49)", group: "company" },
  { name: "zinc", label: "Zinc (Default)", color: "hsl(240 5.9% 10%)", group: "general" },
  { name: "blue", label: "Biru", color: "hsl(217.2 91.2% 59.8%)", group: "general" },
  { name: "sky", label: "Langit", color: "hsl(200.4 98% 39.4%)", group: "general" },
  { name: "cyan", label: "Sian", color: "hsl(191.6 91.4% 36.5%)", group: "general" },
  { name: "teal", label: "Teal", color: "hsl(174.7 83.9% 31.6%)", group: "general" },
  { name: "emerald", label: "Zamrud", color: "hsl(161.4 93.5% 30.4%)", group: "general" },
  { name: "green", label: "Hijau", color: "hsl(142.1 76.2% 36.3%)", group: "general" },
  { name: "amber", label: "Amber", color: "hsl(37.7 92.1% 50.2%)", group: "general" },
  { name: "orange", label: "Oranye", color: "hsl(20.5 90.2% 48.2%)", group: "general" },
  { name: "red", label: "Merah", color: "hsl(0 72.2% 50.6%)", group: "general" },
  { name: "rose", label: "Mawar", color: "hsl(346.8 77.2% 49.8%)", group: "general" },
  { name: "pink", label: "Merah Muda", color: "hsl(333.3 71.4% 50.6%)", group: "general" },
  { name: "fuchsia", label: "Fuchsia", color: "hsl(292.2 84.1% 60.6%)", group: "general" },
  { name: "purple", label: "Ungu", color: "hsl(271.5 81.3% 55.9%)", group: "general" },
  { name: "violet", label: "Violet", color: "hsl(262.1 83.3% 57.8%)", group: "general" },
  { name: "indigo", label: "Indigo", color: "hsl(243.4 75.4% 58.6%)", group: "general" },
] as const;

export type AccentTheme = (typeof accentThemes)[number]["name"];
export const DEFAULT_ACCENT: AccentTheme = "zinc";

export const themeModes = [
  { name: "light", label: "Terang" },
  { name: "soft-light", label: "Terang Lembut" },
  { name: "dark", label: "Gelap" },
  { name: "soft-dark", label: "Gelap Lembut" },
  { name: "system", label: "Ikuti Sistem" },
] as const;
export type ThemeMode = (typeof themeModes)[number]["name"];

export function isAccent(v: unknown): v is AccentTheme {
  return accentThemes.some((t) => t.name === v);
}

const j = JSON.stringify;

/** Script inline di <head>: pasang font, ukuran, dan aksen sebelum render (anti-flash). */
export const appearanceInitScript =
  "(function(){try{var d=document.documentElement,l=localStorage;" +
  "function g(k){var v=l.getItem(k);if(v===null)return null;try{return JSON.parse(v)}catch(e){return v}}" +
  `var f=g(${j(FONT_FAMILY_STORAGE_KEY)}),s=g(${j(FONT_SIZE_STORAGE_KEY)}),a=g(${j(ACCENT_STORAGE_KEY)});` +
  `if(f&&f!=="geist"&&${j(fontFamilies.map((x) => x.name))}.indexOf(f)>-1)d.dataset.font=f;` +
  `if(s&&s!=="md"&&${j(fontSizes.map((x) => x.name))}.indexOf(s)>-1)d.dataset.fontSize=s;` +
  `if(a&&a!=="zinc"&&${j(accentThemes.map((x) => x.name))}.indexOf(a)>-1)d.classList.add("theme-"+a);` +
  "}catch(e){}})();";
