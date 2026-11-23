// Helper Server Action modul K3 (bukan "use server": diimpor actions.ts per modul).
import "server-only";
import { dbError, fail, type FormState } from "@/lib/action-state";

type DbErrorLike = { code?: string; message: string; details?: string | null; hint?: string | null };

/**
 * Seperti dbError, tetapi 42501 dari RPC K3 (pesan Bahasa Indonesia, mis. "Hanya HSE yang ...")
 * ditampilkan apa adanya. Pesan RLS mentah PostgREST tetap diganti pesan umum (dbError → CCTV).
 */
export function k3DbError(e: DbErrorLike): FormState {
  if (e.code === "42501" && !/row-level security|permission denied/i.test(e.message)) {
    void dbError(e); // tetap tercatat CCTV security.rls_denied
    return fail(e.message);
  }
  return dbError(e);
}

/** JSON payload FormData → unknown (null = tidak terbaca). */
export function readPayload(fd: FormData, key = "payload"): unknown {
  try {
    return JSON.parse(String(fd.get(key) ?? "{}"));
  } catch {
    return null;
  }
}
