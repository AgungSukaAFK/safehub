"use server";

// Server Action Impor Data (rancangan §2.12): parsing file di server, commit lewat satu RPC batch.
// Validasi bentuk diulang di sini (jangan percaya klien); aturan bisnis diperiksa RPC simpan di DB per baris.
import { revalidatePath } from "next/cache";
import { fail, NOT_ALLOWED, ok, type FormState } from "@/lib/action-state";
import { actionAccess } from "@/lib/auth";
import { cctv } from "@/lib/cctv";
import { IMPORT_TARGETS, MAX_IMPORT_ROWS, validateRows, type ImportTargetId } from "@/lib/import/targets";
import { MAX_IMPORT_BYTES, parseXlsx, type ParsedSheet } from "@/lib/import/parse";
import { k3DbError } from "@/lib/k3-actions";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";

export type ParseResult = { status: "ok"; sheet: ParsedSheet; filename: string } | { status: "error"; message: string };

/** Langkah 1: baca file .xlsx → header + baris (tanpa menyimpan file). */
export async function parseImportFileAction(formData: FormData): Promise<ParseResult> {
  if (!(await actionAccess("viewer"))) return { status: "error", message: NOT_ALLOWED.message ?? "Tidak diizinkan." };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { status: "error", message: "Pilih file Excel (.xlsx)." };
  if (!/\.xlsx$/i.test(file.name)) return { status: "error", message: "Format harus .xlsx. Simpan file Excel Anda sebagai .xlsx." };
  if (file.size > MAX_IMPORT_BYTES) return { status: "error", message: `File terlalu besar (maks. ${MAX_IMPORT_BYTES / 1024 / 1024} MB).` };
  try {
    const sheet = await parseXlsx(await file.arrayBuffer());
    if (sheet.rows.length === 0) return { status: "error", message: "File hanya berisi header; tidak ada baris data." };
    return { status: "ok", sheet, filename: file.name.slice(0, 200) };
  } catch (e) {
    console.error("[impor parse]", e);
    return { status: "error", message: "File tidak bisa dibaca. Pastikan ini file Excel .xlsx yang valid dan tidak diberi kata sandi." };
  }
}

export type CommitResult = { total: number; ok: number; failed: number; errors: { row: number; message: string }[]; jobId: string };

/** Langkah 4: commit. `table` + `mapping` dikirim ulang dan divalidasi lagi di sini. */
export async function commitImportAction(
  targetId: string,
  mode: string,
  filename: string,
  siteId: string | null,
  table: string[][],
  mapping: Record<string, number | null>,
): Promise<FormState & { result?: CommitResult }> {
  if (!(await actionAccess("viewer"))) return NOT_ALLOWED;
  const target = IMPORT_TARGETS[targetId as ImportTargetId];
  if (!target || !["insert", "upsert"].includes(mode)) return fail("Target atau mode impor tidak valid.");
  if (!Array.isArray(table) || table.length === 0 || table.length > MAX_IMPORT_ROWS) return fail(`Impor memuat 1 sampai ${MAX_IMPORT_ROWS} baris.`);
  if (target.needsSite && !(siteId && isUuid(siteId))) return fail("Pilih site tujuan.");
  const checked = validateRows(target, table, mapping);
  const valid = checked.filter((r) => r.d);
  const invalid = checked.length - valid.length;
  if (valid.length === 0) return fail("Tidak ada baris valid untuk diimpor.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_commit", {
    p_target: target.id,
    p_mode: mode,
    p_filename: filename.slice(0, 200),
    p_location: (target.needsSite ? siteId : null) as string,
    p_company: null as unknown as string,
    p_rows: valid.map((r) => ({ n: r.n, d: r.d })),
  });
  if (error) return k3DbError(error);
  const r = data as { job_id: string; total: number; ok: number; failed: number; errors: { row: number; message: string }[] };
  await cctv({ category: "config", action: "import.commit", summary: `Impor ${target.label}: ${r.ok} berhasil, ${r.failed + invalid} gagal/dilewati (${filename})`, entity: "import_jobs", recordId: r.job_id, recordLabel: filename });
  for (const p of ["/manpower", "/kompetensi", "/mcu", "/impor", "/maintenance", "/"]) revalidatePath(p);
  return {
    ...ok(`${r.ok} baris berhasil diimpor.`),
    result: { total: checked.length, ok: r.ok, failed: r.failed + invalid, errors: r.errors, jobId: r.job_id },
  };
}
