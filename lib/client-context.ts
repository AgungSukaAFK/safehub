"use client";

// Konteks otomatis untuk Bantuan Admin & Feedback (frontend-guide §14, §20.4): halaman asal, browser,
// layar, mode tema, versi app. Supaya admin tidak perlu bertanya "pakai apa?". Tanpa data pribadi.

export type ClientContext = {
  halaman: string | null;
  browser: string;
  perangkat: string;
  layar: string;
  tema: string;
  versi?: string | null;
};

function browserName(ua: string) {
  const m =
    ua.match(/(Edg|OPR|SamsungBrowser|Firefox|FxiOS|CriOS|Chrome|Version)\/(\d+)/) ?? ([] as string[]);
  const names: Record<string, string> = { Edg: "Edge", OPR: "Opera", SamsungBrowser: "Samsung Internet", FxiOS: "Firefox", CriOS: "Chrome", Version: "Safari" };
  return m[1] ? `${names[m[1]] ?? m[1]} ${m[2]}` : "Tidak dikenal";
}

function deviceName(ua: string) {
  if (/iPhone|iPad/.test(ua)) return "iOS";
  if (/Android/.test(ua)) return "Android";
  if (/Windows/.test(ua)) return "Windows";
  if (/Mac OS X/.test(ua)) return "macOS";
  if (/Linux/.test(ua)) return "Linux";
  return "Lainnya";
}

// Riwayat path di tab ini (diisi NavigationProgress). Halaman Bantuan/Feedback sendiri diabaikan.
let current: string | null = null;
let previous: string | null = null;
export function rememberPath(path: string) {
  if (path === current) return;
  previous = current;
  current = path;
}
const SELF = /^\/(bantuan|feedback)(\/|$)/;

const MODES = ["soft-dark", "soft-light", "dark", "light"];

/** `page` = halaman asal (mis. dari `?dari=` atau URL saat ini). */
export function collectClientContext(page: string | null, versi?: string | null): ClientContext {
  const ua = navigator.userAgent;
  const cls = document.documentElement.classList;
  const mode = MODES.find((m) => cls.contains(m)) ?? "light";
  const accent = [...cls].find((c) => c.startsWith("theme-"))?.slice(6);
  const fallback = previous && !SELF.test(previous) ? previous : null;
  return {
    halaman: page ?? fallback,
    browser: browserName(ua),
    perangkat: `${deviceName(ua)}${window.matchMedia("(display-mode: standalone)").matches ? " (app terpasang)" : ""}`,
    layar: `${window.innerWidth}×${window.innerHeight} @${Math.round(window.devicePixelRatio * 100) / 100}x`,
    tema: accent ? `${mode} · ${accent}` : mode,
    ...(versi !== undefined ? { versi } : {}),
  };
}

export const CONTEXT_LABELS: Record<keyof ClientContext, string> = {
  halaman: "Halaman",
  browser: "Browser",
  perangkat: "Perangkat",
  layar: "Layar",
  tema: "Tema",
  versi: "Versi app",
};
