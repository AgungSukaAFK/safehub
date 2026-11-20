"use client";

// Satu context per halaman list (frontend-guide §7.1): semua kontrol (cari, filter, sort, halaman,
// baris) mengubah URL lewat setParams() di dalam startTransition. Selama transisi UI lama tetap tampil;
// isPending dipakai body tabel (opacity-60), bar tipis di atas tabel, dan ikon cari (spinner).

import { createContext, useCallback, useContext, useMemo, useTransition, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { hrefWith } from "@/lib/search-params";

type Changes = Record<string, string | number | string[] | null | undefined>;

type ListContextValue = {
  isPending: boolean;
  searchParams: URLSearchParams;
  pathname: string;
  /** Ubah param URL. Mengubah apa pun selain `hal` mereset ke halaman 1. */
  setParams: (changes: Changes, opts?: { push?: boolean }) => void;
  /** Hapus semua filter (kecuali yang disebut di `keep`, default baris & urut). */
  resetFilters: (keep?: string[]) => void;
  get: (key: string) => string;
};

const ListContext = createContext<ListContextValue | null>(null);

export function ListProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const setParams = useCallback<ListContextValue["setParams"]>(
    (changes, opts) => {
      const href = hrefWith(pathname, new URLSearchParams(sp.toString()), changes);
      startTransition(() => {
        if (opts?.push) router.push(href, { scroll: false });
        else router.replace(href, { scroll: false });
      });
    },
    [pathname, router, sp],
  );

  const resetFilters = useCallback<ListContextValue["resetFilters"]>(
    (keep = ["baris", "urut"]) => {
      const next = new URLSearchParams();
      keep.forEach((k) => {
        const v = sp.get(k);
        if (v) next.set(k, v);
      });
      const qs = next.toString();
      startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    },
    [pathname, router, sp],
  );

  const value = useMemo(
    () => ({
      isPending,
      searchParams: sp as unknown as URLSearchParams,
      pathname,
      setParams,
      resetFilters,
      get: (key: string) => sp.get(key) ?? "",
    }),
    [isPending, sp, pathname, setParams, resetFilters],
  );

  return <ListContext value={value}>{children}</ListContext>;
}

export function useList() {
  const ctx = useContext(ListContext);
  if (!ctx) throw new Error("Komponen list harus di dalam <ListProvider>");
  return ctx;
}

/** Bar tipis di atas tabel selama data baru dimuat. */
export function ListPendingBar() {
  const { isPending } = useList();
  return (
    <div aria-hidden className="relative h-0.5 overflow-hidden rounded-full">
      {isPending && <div className="absolute inset-y-0 w-1/3 animate-[list-pending_1s_ease-in-out_infinite] rounded-full bg-primary/70" />}
    </div>
  );
}
