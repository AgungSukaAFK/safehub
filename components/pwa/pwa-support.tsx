"use client";

// Registrasi service worker untuk SEMUA pengunjung (frontend-guide §22.1) + pemilik cache halaman.
// <PwaSupport /> di root layout; <PwaUser userId /> di layout (app) memberi tahu SW siapa pemilik
// cache (user berganti → cache lama dihapus SW).
import { useEffect } from "react";
import { registerServiceWorker } from "@/lib/notifications/browser";
import { listenInstallPrompt } from "@/lib/pwa/use-install-prompt";

export function PwaSupport() {
  useEffect(() => {
    listenInstallPrompt();
    void registerServiceWorker();
  }, []);
  return null;
}

export function PwaUser({ userId }: { userId: string }) {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const send = () => navigator.serviceWorker.controller?.postMessage({ type: "set-user", userId });
    send();
    void navigator.serviceWorker.ready.then((reg) => {
      reg.active?.postMessage({ type: "set-user", userId });
      // aset halaman ini yang termuat sebelum SW aktif → minta SW menyimpannya (offline kunjungan pertama)
      const urls = performance.getEntriesByType("resource").map((e) => e.name);
      reg.active?.postMessage({ type: "warm", urls });
    });
    navigator.serviceWorker.addEventListener("controllerchange", send);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", send);
  }, [userId]);
  return null;
}

/** Tandai halaman supaya TIDAK disimpan untuk offline (data sensitif). sw.js mencari meta ini. */
export function NoOffline() {
  return <meta name="x-no-offline" content="1" />;
}
