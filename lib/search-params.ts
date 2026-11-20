// [starter-standar] direkonstruksi; selaraskan dengan lourdes-db/templates/next-app
// Param URL standar list (frontend-guide §8.2). Nilai asing selalu kembali ke default.

export type SearchParams = Record<string, string | string[] | undefined>;

export const PAGE_SIZES = [10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Teks bebas, di-trim, maksimal `max` karakter. */
export function textParam(sp: SearchParams, key: string, max = 100): string {
  return (first(sp[key]) ?? "").trim().slice(0, max);
}

export function enumParam<T extends string>(sp: SearchParams, key: string, allowed: readonly T[], fallback: T): T;
export function enumParam<T extends string>(sp: SearchParams, key: string, allowed: readonly T[]): T | null;
export function enumParam<T extends string>(
  sp: SearchParams,
  key: string,
  allowed: readonly T[],
  fallback: T | null = null,
): T | null {
  const v = first(sp[key]);
  return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

/** Multi pilih: `?perusahaan=GMI,GIS` atau `?perusahaan=GMI&perusahaan=GIS`. */
export function listParam<T extends string>(sp: SearchParams, key: string, allowed?: readonly T[]): T[] {
  const raw = sp[key];
  const values = (Array.isArray(raw) ? raw : raw ? [raw] : []).flatMap((v) => v.split(",")).map((v) => v.trim());
  const filtered = allowed ? values.filter((v) => (allowed as readonly string[]).includes(v)) : values.filter(Boolean);
  return Array.from(new Set(filtered)) as T[];
}

export function pageParam(sp: SearchParams): number {
  const n = Number.parseInt(first(sp.hal) ?? "1", 10);
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 10_000) : 1;
}

export function pageSizeParam(sp: SearchParams): number {
  const n = Number.parseInt(first(sp.baris) ?? "", 10);
  return (PAGE_SIZES as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE;
}

/** Tanggal `YYYY-MM-DD` yang valid, atau null. */
export function dateParam(sp: SearchParams, key: string): string | null {
  const v = first(sp[key]);
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00+07:00`);
  return Number.isNaN(d.getTime()) ? null : v;
}

export function numberParam(sp: SearchParams, key: string): number | null {
  const v = first(sp[key]);
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** `urut=<kunci>.<asc|desc>` dengan kunci dari whitelist. */
export function sortParam<K extends string>(
  sp: SearchParams,
  allowed: readonly K[],
  fallback: { key: K; dir: "asc" | "desc" },
): { key: K; dir: "asc" | "desc"; isDefault: boolean } {
  const v = first(sp.urut);
  if (v) {
    const [key, dir] = v.split(".");
    if ((allowed as readonly string[]).includes(key) && (dir === "asc" || dir === "desc")) {
      return { key: key as K, dir, isDefault: key === fallback.key && dir === fallback.dir };
    }
  }
  return { ...fallback, isDefault: true };
}

/** Batas awal/akhir hari WIB untuk filter timestamptz. */
export function wibDayStart(date: string) {
  return `${date}T00:00:00+07:00`;
}
export function wibDayEnd(date: string) {
  return `${date}T23:59:59.999+07:00`;
}

/**
 * Susun href dari param sekarang + perubahan. Nilai kosong/null dibuang. Mengubah filter apa pun
 * (kecuali `hal`) mereset `hal` ke 1.
 */
export function hrefWith(
  pathname: string,
  current: URLSearchParams | SearchParams,
  changes: Record<string, string | number | string[] | null | undefined>,
): string {
  const params = new URLSearchParams();
  if (current instanceof URLSearchParams) {
    current.forEach((v, k) => params.append(k, v));
  } else {
    for (const [k, v] of Object.entries(current)) {
      if (Array.isArray(v)) v.forEach((x) => params.append(k, x));
      else if (v !== undefined) params.set(k, v);
    }
  }
  const touchesFilter = Object.keys(changes).some((k) => k !== "hal");
  for (const [k, v] of Object.entries(changes)) {
    params.delete(k);
    if (v === null || v === undefined || v === "") continue;
    if (Array.isArray(v)) {
      if (v.length) params.set(k, v.join(","));
    } else params.set(k, String(v));
  }
  if (touchesFilter && !("hal" in changes)) params.delete("hal");
  for (const [k, v] of Array.from(params.entries())) if (v === "") params.delete(k);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
