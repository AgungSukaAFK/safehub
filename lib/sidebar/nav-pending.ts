"use client";

// URL menu yang baru diklik & sedang dimuat (port ga-web): highlight + spinner di item dan progress
// bar di atas layar selama Next menyiapkan halaman. Fase dikelola di store ini (bukan state React
// di effect): loading → finishing (bar penuh + fade 350 ms) → idle. Batal otomatis setelah 20 dtk.

import { useSyncExternalStore } from "react";

type Phase = "idle" | "loading" | "finishing";
type State = { url: string | null; phase: Phase };

let state: State = { url: null, phase: "idle" };
const listeners = new Set<() => void>();
let finishTimer: ReturnType<typeof setTimeout> | undefined;
let abortTimer: ReturnType<typeof setTimeout> | undefined;

function emit(next: State) {
  state = next;
  listeners.forEach((l) => l());
}

export function setPendingNavUrl(url: string | null) {
  if (state.url === url) return;
  clearTimeout(finishTimer);
  clearTimeout(abortTimer);
  if (url) {
    emit({ url, phase: "loading" });
    abortTimer = setTimeout(() => setPendingNavUrl(null), 20_000);
  } else if (state.phase === "loading") {
    emit({ url: null, phase: "finishing" });
    finishTimer = setTimeout(() => emit({ url: null, phase: "idle" }), 350);
  } else {
    emit({ url: null, phase: state.phase });
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePendingNavUrl() {
  return useSyncExternalStore(
    subscribe,
    () => state.url,
    () => null,
  );
}

export function useNavPhase(): Phase {
  return useSyncExternalStore(
    subscribe,
    () => state.phase,
    () => "idle" as const,
  );
}

/** true kalau klik ini akan bernavigasi di tab ini (bukan tab baru / klik tengah). */
export function isPlainLeftClick(e: { defaultPrevented: boolean; button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }) {
  return !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}
