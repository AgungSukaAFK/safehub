"use server";

// Server Action Monitoring APD. zod → RPC / approval engine (hak dicek di DB) → push untuk notifikasi yang dibuat RPC.
import { revalidatePath } from "next/cache";
import { fail, invalid, NOT_ALLOWED, ok, type FormState } from "@/lib/action-state";
import { APD_IMPORT_MAX_BYTES, parseApdWorkbook, type ApdImportSummary } from "@/lib/apd-excel";
import { itemSchema, moveSchema, requestSchema, typeSchema } from "@/lib/apd-rules";
import { actionAccess } from "@/lib/auth";
import { cctv } from "@/lib/cctv";
import { k3DbError } from "@/lib/k3-actions";
import { notificationIds, sendPushForNotifications } from "@/lib/push";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";

const DOC = "apd_request";
const refresh = (requestId?: string) => {
  revalidatePath("/apd");
  revalidatePath("/apd/pengajuan");
  revalidatePath("/apd/saya");
  revalidatePath("/tugas");
  if (requestId) revalidatePath(`/apd/pengajuan/${requestId}`);
};
const nullId = (id: string | null) => (id ?? null) as string;
const blank = <T,>(v: T): Exclude<T, "" | undefined> | null => (v === "" || v === undefined ? null : (v as Exclude<T, "" | undefined>));

// ---------------------------------------------------------------- master
export async function saveApdTypeAction(id: string | null, values: unknown): Promise<FormState> {
  if ((id !== null && !isUuid(id)) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const parsed = typeSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const v = parsed.data;
  const { error } = await supabase.rpc("apd_type_save", { p_id: nullId(id), p: { ...v, interval_days: blank(v.interval_days) } });
  if (error) return k3DbError(error);
  refresh();
  return ok(id ? "Jenis APD diperbarui." : "Jenis APD ditambahkan.");
}

export async function saveApdItemAction(id: string | null, values: unknown): Promise<FormState> {
  if ((id !== null && !isUuid(id)) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const parsed = itemSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const v = parsed.data;
  const { error } = await supabase.rpc("apd_item_save", { p_id: nullId(id), p: { ...v, min_stock: blank(v.min_stock) } });
  if (error) return k3DbError(error);
  refresh();
  return ok(id ? "Barang diperbarui." : `Barang ${v.code} ditambahkan.`);
}

// ---------------------------------------------------------------- stok
export async function saveMoveAction(values: unknown): Promise<FormState> {
  if (!(await actionAccess("viewer"))) return NOT_ALLOWED;
  const parsed = moveSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const v = parsed.data;
  const p = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, blank(x) ?? null])) as Record<string, string | number | null>;
  const { data, error } = await supabase.rpc("apd_move_save", { p });
  if (error) return k3DbError(error);
  await sendPushForNotifications(notificationIds(data));
  const r = data as { id: string; stock: number };
  let requestId: string | undefined;
  if (v.request_line_id) {
    const { data: l } = await supabase.from("apd_request_lines").select("request_id").eq("id", v.request_line_id).maybeSingle();
    requestId = l?.request_id;
  }
  refresh(requestId);
  return ok(`Mutasi dicatat. Stok sekarang ${r.stock}.`, { id: r.id, stock: r.stock });
}

export async function voidMoveAction(id: string, reason: string): Promise<FormState> {
  if (!isUuid(id) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const trimmed = reason.trim().slice(0, 1000);
  if (trimmed.length < 10) return fail("Alasan pembatalan minimal 10 karakter.", { reason: ["Minimal 10 karakter"] });
  const supabase = await createClient();
  const { error } = await supabase.rpc("apd_move_void", { p_id: id, p_reason: trimmed });
  if (error) return k3DbError(error);
  refresh();
  return ok("Mutasi dibatalkan; stok dihitung ulang.");
}

// ---------------------------------------------------------------- pengajuan
export async function saveRequestAction(id: string | null, values: unknown): Promise<FormState> {
  if ((id !== null && !isUuid(id)) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const parsed = requestSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("apd_request_save", {
    p_id: nullId(id),
    p: {
      ...v,
      incident_on: blank(v.incident_on),
      last_received_on: blank(v.last_received_on),
      lines: v.lines.map((l) => ({ ...l, item_id: blank(l.item_id) })),
    },
  });
  if (error) return k3DbError(error);
  const r = data as { id: string; code: string };
  refresh(r.id);
  return ok(id ? "Pengajuan diperbarui." : `Pengajuan ${r.code} disimpan sebagai draf.`, { id: r.id, code: r.code });
}

/** Setelah foto diunggah ke apd/<id>/: hitung ulang jumlah file. */
export async function syncRequestEvidenceAction(id: string): Promise<FormState> {
  if (!isUuid(id) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const supabase = await createClient();
  const { error } = await supabase.rpc("apd_request_sync_evidence", { p_id: id });
  if (error) return k3DbError(error);
  refresh(id);
  return ok("Foto bukti diperbarui.");
}

export async function submitRequestAction(id: string): Promise<FormState> {
  if (!isUuid(id) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const supabase = await createClient();
  await supabase.rpc("apd_request_sync_evidence", { p_id: id });
  const { data, error } = await supabase.rpc("approval_start", { p_doc_type: DOC, p_record_id: id });
  if (error) return k3DbError(error);
  await sendPushForNotifications(notificationIds(data));
  refresh(id);
  return ok("Pengajuan diajukan. Approver pertama sudah diberi tahu.");
}

export async function decideRequestAction(approvalId: string, decision: "approved" | "rejected", note: string, requestId: string): Promise<FormState> {
  if (!isUuid(approvalId) || !isUuid(requestId) || !["approved", "rejected"].includes(decision) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const trimmed = note.trim().slice(0, 1000);
  if (decision === "rejected" && trimmed.length < 5) return fail("Alasan pengembalian wajib diisi (minimal 5 karakter).", { note: ["Minimal 5 karakter"] });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("approval_decide", { p_approval_id: approvalId, p_decision: decision, p_note: trimmed || undefined });
  if (error) return k3DbError(error);
  await sendPushForNotifications(notificationIds(data));
  refresh(requestId);
  return ok(decision === "approved" ? "Persetujuan dicatat." : "Pengajuan dikembalikan ke pemohon.");
}

/** Tarik pengajuan yang sedang menunggu approval → kembali draf. */
export async function withdrawRequestAction(id: string, note: string): Promise<FormState> {
  if (!isUuid(id) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("approval_cancel", { p_doc_type: DOC, p_record_id: id, p_note: note.trim().slice(0, 500) || undefined });
  if (error) return k3DbError(error);
  await sendPushForNotifications(notificationIds(data));
  refresh(id);
  return ok("Pengajuan ditarik dan kembali menjadi draf.");
}

export async function cancelRequestAction(id: string, note: string): Promise<FormState> {
  if (!isUuid(id) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const trimmed = note.trim().slice(0, 1000);
  if (trimmed.length < 10) return fail("Alasan pembatalan minimal 10 karakter.", { note: ["Minimal 10 karakter"] });
  const supabase = await createClient();
  const { error } = await supabase.rpc("apd_request_cancel", { p_id: id, p_note: trimmed });
  if (error) return k3DbError(error);
  refresh(id);
  return ok("Pengajuan dibatalkan.");
}

/** Dipanggil sebelum printWithFileName (CCTV). Gagal = cetak tetap jalan. */
export async function logApdPrintAction(id: string, code: string, mode: "qr" | "basah" | "preview"): Promise<void> {
  if (!isUuid(id) || !(await actionAccess("viewer"))) return;
  await cctv({
    category: "export",
    action: "export.print",
    summary: `Mencetak Berita Acara APD ${code} (${mode === "qr" ? "dengan QR" : mode === "basah" ? "tanda tangan basah" : "pratinjau"})`,
    entity: "apd_requests",
    recordId: id,
    recordLabel: code,
    metadata: { mode },
  });
}

// ---------------------------------------------------------------- impor data lama (workbook Monitoring APD → apd_import_legacy)
async function readWorkbook(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Pilih file Excel Monitoring APD (.xlsx).");
  if (file.size > APD_IMPORT_MAX_BYTES) throw new Error(`File terlalu besar (maks. ${APD_IMPORT_MAX_BYTES / 1024 / 1024} MB).`);
  return { name: file.name, ...(await parseApdWorkbook(await file.arrayBuffer())) };
}

export type ApdImportPreview = { status: "ok"; summary: ApdImportSummary } | { status: "error"; message: string };

/** Langkah 1: baca workbook, kembalikan ringkasan + kode site (data belum ditulis). */
export async function previewApdImportAction(formData: FormData): Promise<ApdImportPreview> {
  if (!(await actionAccess("viewer"))) return { status: "error", message: NOT_ALLOWED.message ?? "Tidak diizinkan." };
  try {
    const { summary } = await readWorkbook(formData);
    return { status: "ok", summary };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "File tidak bisa dibaca." };
  }
}

/** Langkah 2: baca ulang file yang sama (bukan data dari browser) + pemetaan site → RPC (sekali saja). */
export async function commitApdImportAction(formData: FormData): Promise<FormState> {
  if (!(await actionAccess("viewer"))) return NOT_ALLOWED;
  let sites: Record<string, string>;
  try {
    sites = JSON.parse(String(formData.get("sites") ?? "{}"));
  } catch {
    return fail("Pemetaan site tidak valid.");
  }
  if (typeof sites !== "object" || !Object.values(sites).every((v) => typeof v === "string" && isUuid(v))) return fail("Pilih lokasi untuk setiap site.");
  const company = String(formData.get("company") ?? "GMI");
  let wb: Awaited<ReturnType<typeof readWorkbook>>;
  try {
    wb = await readWorkbook(formData);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "File tidak bisa dibaca.");
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("apd_import_legacy", { p_company: company, p_sites: sites, p: wb.payload });
  if (error) return k3DbError(error);
  const r = data as Record<string, number>;
  await cctv({
    category: "config",
    action: "import.commit",
    summary: `Impor data lama Monitoring APD dari ${wb.name}: ${r.items} barang baru, ${r.opening} stok awal, ${r.in} masuk, ${r.out} keluar, ${r.requests} pengajuan`,
    entity: "apd_stock_moves",
    metadata: { filename: wb.name, ...r },
  });
  refresh();
  return ok(`Impor selesai: ${r.items} barang baru, ${r.opening} stok awal, ${r.in} masuk, ${r.out} keluar, ${r.requests} pengajuan data lama.`, r);
}
