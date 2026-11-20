export { cn } from "cn";

/**
 * UUID v4 yang tetap jalan di luar secure context (HTTP / IP LAN), tempat crypto.randomUUID tidak
 * ada. WAJIB dipakai alih-alih crypto.randomUUID() (frontend-guide §23.2).
 */
export function randomUUID(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) {
    try {
      return c.randomUUID();
    } catch {
      /* lanjut ke fallback */
    }
  }
  const bytes = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Escape karakter wildcard LIKE (`%`, `_`, `\`) dari input user. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/**
 * Filter PostgREST `.or()` untuk beberapa kolom ilike. Koma, kurung, dan titik dua punya arti
 * khusus di filter string, jadi nilai dibungkus kutip ganda. Contoh:
 * `.or(orIlikeFilter(["code", "title"], q))`.
 */
export function orIlikeFilter(columns: string[], q: string): string {
  const pattern = `%${escapeLike(q)}%`.replace(/"/g, '\\"');
  return columns.map((c) => `${c}.ilike."${pattern}"`).join(",");
}

/** Pecah kata kunci menjadi kata unik (semua kata harus ada, urutan bebas). */
export function searchTerms(q: string, max = 5): string[] {
  return Array.from(new Set(q.toLowerCase().split(/\s+/).filter(Boolean))).slice(0, max);
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  // hanya kata yang diawali huruf/angka: "Budi Santoso (GMI)" → "BS"
  const parts = name.trim().split(/\s+/).filter((w) => /^[\p{L}\p{N}]/u.test(w));
  if (parts.length === 0) return "?";
  return ((parts[0][0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function isUuid(value: string | null | undefined): value is string {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
