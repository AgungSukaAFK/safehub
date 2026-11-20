"use client";

// Draft form di perangkat (frontend-guide §22.4). Key `<app>:draft:<userId>:<key>`, debounce 800 ms,
// hanya nilai field (file tidak; nama file dicatat supaya user diberi tahu), kedaluwarsa 14 hari.
// Draft yang ada saat form dibuka TIDAK dipulihkan diam-diam: tampilkan <DraftBanner>.
// Form ubah: kirim `version` (mis. updated_at dokumen) → draft versi lama ditandai `stale`.

import { useCallback, useEffect, useRef, useState } from "react";
import { readStorage, removeStorage, writeStorage } from "@/lib/storage";

const TTL_MS = 14 * 86_400_000;

type Stored<T> = { savedAt: number; version: string | null; values: T; fileNames?: string[] };
export type PendingDraft<T> = Stored<T> & { stale: boolean };

export function useFormDraft<T>({
  key,
  userId,
  values,
  enabled = true,
  version = null,
  isEmpty,
  fileNames,
}: {
  key: string;
  userId: string;
  values: T;
  enabled?: boolean;
  version?: string | null;
  /** true = tidak perlu disimpan (form masih kosong / sama dengan awal) */
  isEmpty?: (v: T) => boolean;
  fileNames?: string[];
}) {
  const storageKey = `draft:${userId}:${key}`;
  const [pending, setPending] = useState<PendingDraft<T> | null>(null);
  const [checked, setChecked] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const emptyRef = useRef(isEmpty);
  useEffect(() => {
    emptyRef.current = isEmpty;
  });

  // Cek draft lama sekali setelah mount
  useEffect(() => {
    if (!enabled) return;
    const f = requestAnimationFrame(() => {
      const d = readStorage<Stored<T> | null>(storageKey, null);
      if (d && Date.now() - d.savedAt < TTL_MS) setPending({ ...d, stale: !!version && d.version !== version });
      else if (d) removeStorage(storageKey);
      setChecked(true);
    });
    return () => cancelAnimationFrame(f);
  }, [enabled, storageKey, version]);

  // Simpan (debounce) — tidak menimpa draft lama sebelum user memilih Pulihkan/Buang
  const json = JSON.stringify(values);
  useEffect(() => {
    if (!enabled || !checked || pending) return;
    const t = window.setTimeout(() => {
      const v = JSON.parse(json) as T;
      if (emptyRef.current?.(v)) {
        removeStorage(storageKey);
        setSavedAt(null);
        return;
      }
      const now = Date.now();
      writeStorage<Stored<T>>(storageKey, { savedAt: now, version, values: v, fileNames });
      setSavedAt(now);
    }, 800);
    return () => window.clearTimeout(t);
  }, [json, enabled, checked, pending, storageKey, version, fileNames]);

  /** Ambil nilai draft untuk diisikan ke form, lalu lanjut menyimpan seperti biasa. */
  const restore = useCallback((): PendingDraft<T> | null => {
    const d = pending;
    setPending(null);
    return d;
  }, [pending]);

  const discard = useCallback(() => {
    removeStorage(storageKey);
    setPending(null);
  }, [storageKey]);

  /** Panggil setelah submit sukses */
  const clear = useCallback(() => {
    removeStorage(storageKey);
    setSavedAt(null);
  }, [storageKey]);

  return { pending, restore, discard, clear, savedAt };
}
