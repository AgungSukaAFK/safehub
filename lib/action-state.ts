// [starter-standar] direkonstruksi; selaraskan dengan lourdes-db/templates/next-app
import "server-only";
import type { ZodError } from "zod";
import { cctv } from "@/lib/cctv";
import type { FormState } from "@/lib/form-state";

export type { FormState } from "@/lib/form-state";

// Hasil standar Server Action. Client component cukup `import type { FormState }`.

export function ok(message: string, data?: Record<string, unknown>): FormState {
  return { status: "ok", message, data, ts: Date.now() };
}

export function fail(message: string, fieldErrors?: Record<string, string[]>): FormState {
  return { status: "error", message, fieldErrors, ts: Date.now() };
}

/** Error zod → pesan per field + ringkasan. */
export function invalid(error: ZodError): FormState {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  const n = Object.keys(fieldErrors).length;
  return fail(n === 1 ? "Ada 1 isian yang perlu diperbaiki." : `Ada ${n} isian yang perlu diperbaiki.`, fieldErrors);
}

export const NOT_ALLOWED: FormState = {
  status: "error",
  message: "Anda tidak punya izin untuk aksi ini.",
  ts: 0,
};

type DbErrorLike = { code?: string; message: string; details?: string | null; hint?: string | null };

/**
 * Error Postgres/PostgREST → pesan untuk user (backend-guide §3.3).
 * - P0001: pesan bisnis dari RPC, sudah Bahasa Indonesia → tampil apa adanya.
 * - 42501: akses ditolak → pesan umum + CCTV security.rls_denied.
 * - constraint: pesan umum. Detail teknis hanya ke log server.
 */
export function dbError(e: DbErrorLike): FormState {
  switch (e.code) {
    case "P0001":
      return fail(e.message);
    case "42501":
      void cctv({
        category: "security",
        action: "security.rls_denied",
        severity: "warning",
        summary: "Aksi ditolak oleh aturan akses database",
        metadata: { pesan: e.message.slice(0, 200) },
      });
      return { ...NOT_ALLOWED, ts: Date.now() };
    case "23505":
      return fail("Data yang sama sudah ada. Periksa kembali isian Anda.");
    case "23503":
      return fail("Data ini masih dipakai atau rujukannya tidak ditemukan.");
    case "23514":
    case "23502":
    case "22001":
      return fail("Ada isian yang tidak sesuai aturan. Periksa kembali lalu coba lagi.");
    case "PGRST116":
      return fail("Data tidak ditemukan atau Anda tidak punya akses. Muat ulang halaman.");
    default:
      console.error("[dbError]", e.code, e.message, e.details);
      return fail("Terjadi kesalahan di server. Coba lagi, atau laporkan lewat Bantuan Admin.");
  }
}
