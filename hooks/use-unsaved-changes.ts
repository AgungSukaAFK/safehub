"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * "Ada perubahan belum disimpan" = nilai sekarang ≠ snapshot (port ga-web). Snapshot diambil 400 ms
 * setelah `ready` supaya kalkulasi awal (total dsb) tidak terhitung perubahan. `resetBaseline()`
 * setelah tersimpan. Plus peringatan browser saat meninggalkan halaman ketika dirty.
 */
export function useUnsavedChanges(value: unknown, ready = true, { warnOnLeave = true } = {}) {
  const [epoch, setEpoch] = useState(0);
  const [baseline, setBaseline] = useState<{ epoch: number; json: string } | null>(null);
  const latest = useRef(value);

  useEffect(() => {
    latest.current = value;
  });

  useEffect(() => {
    if (!ready) return;
    const t = window.setTimeout(() => setBaseline({ epoch, json: JSON.stringify(latest.current) }), 400);
    return () => window.clearTimeout(t);
  }, [ready, epoch]);

  const dirty = !!baseline && baseline.epoch === epoch && JSON.stringify(value) !== baseline.json;

  useEffect(() => {
    if (!dirty || !warnOnLeave) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, warnOnLeave]);

  const resetBaseline = useCallback(() => setEpoch((e) => e + 1), []);
  return { dirty, resetBaseline };
}
