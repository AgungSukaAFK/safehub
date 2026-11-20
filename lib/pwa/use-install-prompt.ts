"use client";

// Pasang app (PWA). Chrome/Edge/Android memicu `beforeinstallprompt` sekali saat halaman dimuat, jadi
// event ditangkap sedini mungkin (PwaSupport di root layout) dan disimpan di store modul ini.
// iOS tidak punya prompt: tampilkan petunjuk "Bagikan → Tambah ke Layar Utama".
import { useSyncExternalStore } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferred: InstallEvent | null = null;
let installed = false;
let listening = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function listenInstallPrompt() {
  if (listening || typeof window === "undefined") return;
  listening = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    emit();
  });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const mq = window.matchMedia("(display-mode: standalone)");
  mq.addEventListener("change", cb);
  return () => {
    listeners.delete(cb);
    mq.removeEventListener("change", cb);
  };
}

type State = "installed" | "available" | "ios" | "unsupported";
let last: State = "unsupported";

function snapshot(): State {
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
  const next: State = standalone || installed ? "installed" : deferred ? "available" : /iPhone|iPad|iPod/.test(navigator.userAgent) ? "ios" : "unsupported";
  last = next;
  return last;
}

/** installed = sudah terpasang / dibuka sebagai app; available = bisa dipasang lewat tombol; ios = petunjuk manual. */
export function useInstallPrompt() {
  const state = useSyncExternalStore(subscribe, snapshot, () => "unsupported" as State);
  const install = async () => {
    if (!deferred) return false;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null;
    emit();
    return outcome === "accepted";
  };
  return { state, install };
}
