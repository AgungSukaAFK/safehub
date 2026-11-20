"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { APP_ID } from "@/lib/app-config";

// Preferensi per perangkat (frontend-guide §25). WAJIB lewat file ini: key otomatis ber-prefix
// `<app_id>:` supaya app Lourdes lain di *.lourdes.cloud tidak saling menimpa. Semua akses
// dibungkus try/catch (private mode, storage penuh, diblokir). Data bisnis JANGAN disimpan di sini.

const SAME_TAB_EVENT = "app-storage";

export const storageKey = (key: string) => `${APP_ID}:${key}`;

export function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(storageKey(key));
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeStorage<T>(key: string, value: T) {
  try {
    window.localStorage.setItem(storageKey(key), JSON.stringify(value));
    window.dispatchEvent(new CustomEvent(SAME_TAB_EVENT, { detail: storageKey(key) }));
  } catch {
    /* abaikan: preferensi bukan data penting */
  }
}

export function removeStorage(key: string) {
  try {
    window.localStorage.removeItem(storageKey(key));
    window.dispatchEvent(new CustomEvent(SAME_TAB_EVENT, { detail: storageKey(key) }));
  } catch {
    /* abaikan */
  }
}

/** Hapus semua key ber-prefix yang cocok (mis. draft milik user saat Keluar). */
export function removeStorageByPrefix(prefix: string) {
  try {
    const full = storageKey(prefix);
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(full)) window.localStorage.removeItem(k);
    }
  } catch {
    /* abaikan */
  }
}

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(storageKey(key));
  } catch {
    return null;
  }
}

/**
 * State yang tersimpan per perangkat. Saat render server & hydration nilainya `initial` (aman),
 * lalu mengikuti localStorage; sinkron antar tab (event `storage`) dan antar komponen di tab yang
 * sama. `ready` = sudah membaca storage (pakai untuk menghindari kedipan UI default).
 */
export function useStoredState<T>(key: string, initial: T) {
  const subscribe = useCallback(
    (cb: () => void) => {
      const full = storageKey(key);
      const onStorage = (e: StorageEvent) => e.key === full && cb();
      const onSameTab = (e: Event) => (e as CustomEvent<string>).detail === full && cb();
      window.addEventListener("storage", onStorage);
      window.addEventListener(SAME_TAB_EVENT, onSameTab);
      return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener(SAME_TAB_EVENT, onSameTab);
      };
    },
    [key],
  );
  // Snapshot = string mentah (stabil untuk perbandingan), di-parse lewat memo.
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(key),
    () => SERVER_SNAPSHOT,
  );
  const ready = raw !== SERVER_SNAPSHOT;

  // Nilai awal dibekukan sekali (biasanya literal baru tiap render)
  const [fallback] = useState(initial);
  const value = useMemo<T>(() => {
    if (raw === SERVER_SNAPSHOT || raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }, [raw, fallback]);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolved = typeof next === "function" ? (next as (p: T) => T)(readStorage(key, fallback)) : next;
      writeStorage(key, resolved);
    },
    [key, fallback],
  );

  return [value, update, ready] as const;
}

/** Penanda snapshot server (bukan nilai storage yang mungkin). */
const SERVER_SNAPSHOT = "\u0000server";
