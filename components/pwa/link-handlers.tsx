"use client";

// Penanganan klik link global (frontend-guide §22.1):
// - OfflineLinkGuard: saat offline, link internal = navigasi PENUH, supaya service worker bisa
//   melayani salinan halaman (navigasi client Next memakai RSC fetch yang tidak di-cache SW).
// - StandaloneLinkHandler: di app terpasang (standalone), link `_blank` internal tetap di dalam app,
//   kecuali ditandai `data-pwa-new-window` (mis. WhatsApp, file lampiran).
// - ThemeColorSync: <meta name="theme-color"> ikut warna latar tema aktif (status bar HP).
import { useEffect } from "react";
import { useOnline } from "@/lib/offline/use-online";

function internalAnchor(e: MouseEvent): HTMLAnchorElement | null {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
  const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!a || a.hasAttribute("download")) return null;
  const url = new URL(a.href, location.href);
  return url.origin === location.origin ? a : null;
}

export function OfflineLinkGuard() {
  const online = useOnline();
  useEffect(() => {
    if (online) return;
    const onClick = (e: MouseEvent) => {
      const a = internalAnchor(e);
      if (!a || (a.target && a.target !== "_self")) return;
      const url = new URL(a.href, location.href);
      if (url.pathname === location.pathname && url.search === location.search && url.hash) return; // lompat di halaman yang sama
      e.preventDefault();
      location.assign(url.href);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [online]);
  return null;
}

export function StandaloneLinkHandler() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!window.matchMedia("(display-mode: standalone)").matches) return;
      const a = internalAnchor(e);
      if (!a || a.target !== "_blank" || a.hasAttribute("data-pwa-new-window")) return;
      e.preventDefault();
      location.assign(new URL(a.href, location.href).href);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}

export function ThemeColorSync() {
  useEffect(() => {
    const apply = () => {
      const bg = getComputedStyle(document.body).backgroundColor;
      if (!bg) return;
      // HANYA ubah atribut meta bawaan (milik React/Next, dari viewport.themeColor). Jangan hapus/tambah
      // elemen di <head>: React akan crash saat mencoba melepas elemen yang sudah tidak ada.
      document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
        if (m.content !== bg) m.content = bg;
      });
    };
    apply();
    const mo = new MutationObserver(() => requestAnimationFrame(apply));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });
    return () => mo.disconnect();
  }, []);
  return null;
}
