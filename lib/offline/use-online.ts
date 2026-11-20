"use client";

// Status jaringan (frontend-guide §22.1). Event offline → langsung offline. Event online (atau saat
// ragu) → dipastikan dulu dengan ping /api/health; selama gagal, dicoba lagi tiap 10 detik. Satu
// store untuk seluruh tab (semua komponen berbagi status & ping yang sama).
import { useSyncExternalStore } from "react";

let online = typeof navigator === "undefined" ? true : navigator.onLine;
const listeners = new Set<() => void>();
let retry: ReturnType<typeof setTimeout> | undefined;
let pinging = false;

const changeListeners = new Set<(online: boolean) => void>();

function set(v: boolean) {
  if (v === online) return;
  online = v;
  listeners.forEach((l) => l());
  changeListeners.forEach((l) => l(v));
}

/** Dipanggil setiap status berubah (offline → online & sebaliknya). Mengembalikan fungsi lepas. */
export function onOnlineChange(cb: (online: boolean) => void) {
  changeListeners.add(cb);
  return () => void changeListeners.delete(cb);
}

/** Pastikan benar-benar terhubung ke server app. */
export async function checkOnline(): Promise<boolean> {
  if (pinging) return online;
  pinging = true;
  clearTimeout(retry);
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch("/api/health", { cache: "no-store", signal: ctrl.signal });
    clearTimeout(t);
    set(res.ok);
  } catch {
    set(false);
  } finally {
    pinging = false;
  }
  if (!online) retry = setTimeout(() => void checkOnline(), 10_000);
  return online;
}

const onOffline = () => {
  clearTimeout(retry);
  set(false);
  retry = setTimeout(() => void checkOnline(), 10_000);
};
const onOnline = () => void checkOnline();

function subscribe(cb: () => void) {
  if (!listeners.size) {
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    online = navigator.onLine;
    if (!online) retry = setTimeout(() => void checkOnline(), 10_000);
  }
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
    if (!listeners.size) {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearTimeout(retry);
    }
  };
}

/** true = online. Server & hydration: true (tombol tidak berkedip nonaktif). */
export function useOnline() {
  return useSyncExternalStore(
    subscribe,
    () => online,
    () => true,
  );
}

export const OFFLINE_REASON = "Butuh koneksi internet";
