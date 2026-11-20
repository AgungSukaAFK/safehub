"use server";

// CONTOH boilerplate. Server Action Pengajuan: validasi zod → RPC dengan sesi user (RLS + guard DB
// tetap penjaga terakhir) → push notifikasi best-effort. Status hanya berubah lewat RPC engine.
import { revalidatePath } from "next/cache";
import { dbError, fail, invalid, NOT_ALLOWED, ok, type FormState } from "@/lib/action-state";
import { BUCKET_LAMPIRAN } from "@/lib/app-config";
import { actionAccess } from "@/lib/auth";
import { cctv } from "@/lib/cctv";
import { countPengajuan } from "@/lib/pengajuan";
import { pengajuanSchema } from "@/lib/pengajuan-rules";
import { notificationIds, sendPushForNotifications } from "@/lib/push";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";

const DOC = "pengajuan";

export async function savePengajuanAction(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await actionAccess("editor"))) return NOT_ALLOWED;
  const id = String(fd.get("id") ?? "") || null;
  if (id && !isUuid(id)) return fail("Dokumen tidak valid.");
  let raw: unknown;
  try {
    raw = JSON.parse(String(fd.get("payload") ?? "{}"));
  } catch {
    return fail("Isian form tidak terbaca. Muat ulang halaman.");
  }
  const parsed = pengajuanSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  // p_id null = buat baru (argumen tetap wajib dikirim)
  const { data: savedId, error } = await supabase.rpc("pengajuan_save", { p_id: id as string, p: parsed.data });
  if (error || !savedId) return error ? dbError(error) : fail("Gagal menyimpan.");

  if (fd.get("intent") === "ajukan") {
    const { data, error: e2 } = await supabase.rpc("approval_start", { p_doc_type: DOC, p_record_id: savedId });
    if (e2) return { ...dbError(e2), data: { id: savedId, saved: true } };
    await sendPushForNotifications(notificationIds(data));
    revalidatePath("/pengajuan");
    return ok("Pengajuan disimpan dan diajukan.", { id: savedId });
  }
  revalidatePath("/pengajuan");
  return ok(id ? "Perubahan disimpan." : "Draft pengajuan disimpan.", { id: savedId });
}

export async function submitPengajuanAction(id: string): Promise<FormState> {
  if (!isUuid(id) || !(await actionAccess("editor"))) return NOT_ALLOWED;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("approval_start", { p_doc_type: DOC, p_record_id: id });
  if (error) return dbError(error);
  await sendPushForNotifications(notificationIds(data));
  revalidatePath(`/pengajuan/${id}`);
  return ok("Pengajuan diajukan. Approver pertama sudah diberi tahu.");
}

export async function decidePengajuanAction(approvalId: string, decision: "approved" | "rejected", note: string): Promise<FormState> {
  if (!isUuid(approvalId) || !["approved", "rejected"].includes(decision) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const trimmed = note.trim().slice(0, 1000);
  if (decision === "rejected" && trimmed.length < 5) return fail("Alasan penolakan wajib diisi (minimal 5 karakter).", { note: ["Minimal 5 karakter"] });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("approval_decide", { p_approval_id: approvalId, p_decision: decision, p_note: trimmed || undefined });
  if (error) return dbError(error);
  await sendPushForNotifications(notificationIds(data));
  revalidatePath("/pengajuan");
  return ok(decision === "approved" ? "Pengajuan disetujui." : "Pengajuan ditolak. Pemohon sudah diberi tahu.");
}

export async function cancelPengajuanAction(id: string, note: string): Promise<FormState> {
  if (!isUuid(id) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("approval_cancel", { p_doc_type: DOC, p_record_id: id, p_note: note.trim().slice(0, 500) || undefined });
  if (error) return dbError(error);
  await sendPushForNotifications(notificationIds(data));
  revalidatePath(`/pengajuan/${id}`);
  return ok("Pengajuan ditarik dan kembali menjadi draft.");
}

export async function followupPengajuanAction(approvalId: string): Promise<FormState> {
  if (!isUuid(approvalId) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_followup", { p_approval_id: approvalId });
  if (error) return dbError(error);
  await sendPushForNotifications(notificationIds(data));
  const name = (data as { approver_name?: string } | null)?.approver_name;
  return ok(`Follow-up terkirim${name ? ` ke ${name}` : ""}.`);
}

export async function deletePengajuanAction(id: string): Promise<FormState> {
  if (!isUuid(id) || !(await actionAccess("editor"))) return NOT_ALLOWED;
  const supabase = await createClient();
  const { data, error } = await supabase.from("pengajuan").delete().eq("id", id).select("id");
  if (error) return dbError(error);
  if (!data?.length) return fail("Pengajuan tidak bisa dihapus (hanya draft milik Anda, atau admin).");
  // lampiran ikut dibersihkan (best-effort; RLS storage: pemilik file / admin)
  const { data: files } = await supabase.storage.from(BUCKET_LAMPIRAN).list(id, { limit: 100 });
  if (files?.length) await supabase.storage.from(BUCKET_LAMPIRAN).remove(files.map((f) => `${id}/${f.name}`));
  revalidatePath("/pengajuan");
  return ok("Draft pengajuan dihapus.");
}

/** Jumlah semua data untuk menu Excel ("Semua data"). */
export async function countPengajuanAction(): Promise<number> {
  if (!(await actionAccess("viewer"))) return 0;
  return countPengajuan(await createClient());
}

/** Dipanggil sebelum printWithFileName (CCTV). Gagal = cetak tetap jalan. */
export async function logPrintAction(id: string, code: string, mode: "qr" | "basah" | "preview"): Promise<void> {
  if (!isUuid(id) || !(await actionAccess("viewer"))) return;
  await cctv({
    category: "export",
    action: "export.print",
    summary: `Mencetak pengajuan ${code} (${mode === "qr" ? "dengan QR" : mode === "basah" ? "tanda tangan basah" : "pratinjau"})`,
    entity: DOC,
    recordId: id,
    recordLabel: code,
    metadata: { mode },
  });
}
