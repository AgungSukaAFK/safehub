"use client";

// Urutan kolom tabel yang diatur user dengan menggeser header (port ga-web). Disimpan per tabel per
// perangkat. Isi storage dicocokkan ulang dengan kolom di kode (id hilang dibuang, kolom baru
// disisipkan di posisi bawaannya); kalau kembali sama dengan bawaan, storage dikosongkan.

import { useCallback, useMemo } from "react";
import { useStoredState } from "@/lib/storage";

function reconcile(stored: string[], defaults: readonly string[]): string[] {
  const known = new Set(defaults);
  const result = [...new Set(stored)].filter((id) => known.has(id));
  defaults.forEach((id, i) => {
    if (!result.includes(id)) result.splice(Math.min(i, result.length), 0, id);
  });
  return result;
}

const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((id, i) => id === b[i]);

export function useColumnOrder<C extends { id: string }>(tableKey: string, columns: readonly C[]) {
  const defaults = useMemo(() => columns.map((c) => c.id), [columns]);
  const [stored, setStored] = useStoredState<string[] | null>(`column-order:${tableKey}`, null);
  const order = useMemo(() => (stored ? reconcile(stored, defaults) : defaults), [stored, defaults]);

  /** Pindahkan `from` ke posisi `to` (digeser ke kanan → setelah `to`, ke kiri → sebelum). */
  const moveColumn = useCallback(
    (from: string, to: string) => {
      const fi = order.indexOf(from);
      const ti = order.indexOf(to);
      if (fi < 0 || ti < 0 || fi === ti) return;
      const next = [...order];
      next.splice(fi, 1);
      next.splice(ti, 0, from);
      setStored(same(next, defaults) ? null : next);
    },
    [order, defaults, setStored],
  );

  const resetOrder = useCallback(() => setStored(null), [setStored]);

  const ordered = useMemo(() => {
    const byId = new Map(columns.map((c) => [c.id, c]));
    return order.map((id) => byId.get(id)!).filter(Boolean);
  }, [columns, order]);

  return { order, ordered, moveColumn, resetOrder, isCustomOrder: !same(order, defaults) };
}
