"use client";

// Data global search (port ga-web use-global-search.ts) sebagai store eksternal (tanpa setState di
// effect): 1 RPC global_search per query, debounce 250 ms, minimal 3 huruf, cache 60 detik per akun,
// request basi dibatalkan, hasil query sebelumnya tetap tampil selama mencari (tidak berkedip).

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";
import { useStoredState } from "@/lib/storage";

export const SEARCH_MIN_CHARS = 3;
export const SEARCH_PER_GROUP = 5;
const DEBOUNCE_MS = 250;
const TTL_MS = 60_000;
const CACHE_MAX = 40;

export type SearchRow = {
  kind: string;
  id: string;
  title: string;
  subtitle: string | null;
  status: string | null;
  amount: number | null;
  href: string;
  is_exact: boolean;
};

export type PendingRow = {
  approval_id: string;
  doc_type: string;
  doc_label: string;
  record_id: string;
  step_no: number;
  waiting_since: string;
  due_at: string | null;
  href: string;
  followup_count: number;
};

export type SearchStatus = "idle" | "loading" | "done" | "error";

export function normalizeQuery(q: string) {
  return q.trim().replace(/\s+/g, " ");
}

// ---------------------------------------------------------------- store
type Entry<T> = { at: number; rows: T; error?: boolean };
const cache = new Map<string, Entry<SearchRow[]>>();
const pendingCache = new Map<string, Entry<PendingRow[]>>();
let lastShown: SearchRow[] = [];
let version = 0;
const listeners = new Set<() => void>();
const emit = () => {
  version++;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
let inflight: { key: string; controller: AbortController; promise: Promise<SearchRow[]> } | null = null;

function fresh<T>(map: Map<string, Entry<T>>, key: string): Entry<T> | null {
  const hit = map.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    map.delete(key);
    return null;
  }
  return hit;
}

function fetchSearch(key: string, q: string): Promise<SearchRow[]> {
  const hit = fresh(cache, key);
  if (hit && !hit.error) return Promise.resolve(hit.rows);
  if (inflight?.key === key) return inflight.promise;
  inflight?.controller.abort();
  const controller = new AbortController();
  const promise = (async () => {
    const { data, error } = await createClient()
      .rpc("global_search", { p_q: q, p_limit: SEARCH_PER_GROUP })
      .abortSignal(controller.signal);
    if (controller.signal.aborted) throw new Error("aborted");
    if (error) {
      cache.set(key, { at: Date.now(), rows: [], error: true });
      emit();
      throw error;
    }
    const rows = (data ?? []) as SearchRow[];
    cache.delete(key);
    cache.set(key, { at: Date.now(), rows });
    while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
    lastShown = rows;
    emit();
    return rows;
  })().finally(() => {
    if (inflight?.key === key) inflight = null;
  });
  inflight = { key, controller, promise };
  return promise;
}

/** Hasil global_search untuk `query`. `flush()` = cari sekarang (Enter) tanpa menunggu debounce. */
export function useGlobalSearch(query: string, userId: string) {
  const q = normalizeQuery(query);
  const enabled = q.length >= SEARCH_MIN_CHARS;
  const key = `${userId}:${q.toLowerCase()}`;
  useSyncExternalStore(subscribe, () => version, () => 0);

  useEffect(() => {
    if (!enabled) {
      lastShown = []; // query baru mulai dari nol, jangan tampilkan sisa hasil query lama
      return;
    }
    if (fresh(cache, key)) return;
    const t = window.setTimeout(() => void fetchSearch(key, q).catch(() => {}), DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [enabled, key, q]);

  const flush = useCallback(() => {
    if (!enabled) return Promise.resolve([] as SearchRow[]);
    const hit = fresh(cache, key);
    if (hit?.error) cache.delete(key);
    return fetchSearch(key, q);
  }, [enabled, key, q]);

  if (!enabled) return { rows: [] as SearchRow[], status: "idle" as SearchStatus, flush };
  const hit = fresh(cache, key);
  if (hit) return { rows: hit.rows, status: (hit.error ? "error" : "done") as SearchStatus, flush };
  return { rows: lastShown, status: "loading" as SearchStatus, flush };
}

/** Antrian approval user (pending_for_me), diambil saat search dibuka, maks. 1x per menit. */
export function usePendingApprovals(userId: string, active: boolean): PendingRow[] {
  useSyncExternalStore(subscribe, () => version, () => 0);
  useEffect(() => {
    if (!active || fresh(pendingCache, userId)) return;
    let cancelled = false;
    createClient()
      .rpc("pending_for_me", { p_limit: 5 })
      .then(({ data, error }) => {
        if (cancelled || error) return;
        pendingCache.set(userId, { at: Date.now(), rows: (data ?? []) as PendingRow[] });
        emit();
      });
    return () => {
      cancelled = true;
    };
  }, [userId, active]);
  return pendingCache.get(userId)?.rows ?? [];
}

// ---------------------------------------------------------------- riwayat (per akun, per perangkat)
export type RecentDoc = { kind: string; id: string; title: string; subtitle: string | null; href: string };
export type SearchHistory = { docs: RecentDoc[]; queries: string[] };
const EMPTY: SearchHistory = { docs: [], queries: [] };

export function useSearchHistory(userId: string) {
  const [history, setHistory] = useStoredState<SearchHistory>(`search-history:${userId}`, EMPTY);
  const addDoc = useCallback(
    (doc: RecentDoc) =>
      setHistory((prev) => ({
        ...prev,
        docs: [doc, ...prev.docs.filter((d) => !(d.kind === doc.kind && d.id === doc.id))].slice(0, 5),
      })),
    [setHistory],
  );
  const addQuery = useCallback(
    (query: string) => {
      const q = normalizeQuery(query);
      if (q.length < 2) return;
      setHistory((prev) => ({
        ...prev,
        queries: [q, ...prev.queries.filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, 4),
      }));
    },
    [setHistory],
  );
  const clear = useCallback(() => setHistory(EMPTY), [setHistory]);
  return { history, addDoc, addQuery, clear };
}
