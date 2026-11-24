"use server";

// Server Action Laporan Periode: zod → RPC / approval engine (hak dicek di DB) → push.
import { revalidatePath } from "next/cache";
import { fail, invalid, NOT_ALLOWED, ok, type FormState } from "@/lib/action-state";
import { actionAccess } from "@/lib/auth";
import { k3DbError } from "@/lib/k3-actions";
import { createReportSchema, narrativesSchema } from "@/lib/laporan-rules";
import { notificationIds, sendPushForNotifications } from "@/lib/push";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";

const DOC = "laporan";
const refresh = (id?: string) => {
  revalidatePath("/laporan");
  if (id) revalidatePath(`/laporan/${id}`);
  revalidatePath("/tugas");
};

export async function createReportAction(values: unknown): Promise<FormState> {
  if (!(await actionAccess("viewer"))) return NOT_ALLOWED;
  const parsed = createReportSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("report_create", { p: parsed.data });
  if (error) return k3DbError(error);
  refresh();
  const r = data as { id: string; code: string };
  return ok(`Laporan ${r.code} dibuat.`, { id: r.id, code: r.code });
}

export async function saveNarrativesAction(id: string, narratives: unknown, submitNote: string): Promise<FormState> {
  if (!isUuid(id) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const parsed = narrativesSchema.safeParse(narratives);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("report_save_narratives", { p_id: id, p: parsed.data, p_submit_note: submitNote.trim().slice(0, 1000) || undefined });
  if (error) return k3DbError(error);
  refresh(id);
  return ok("Perubahan disimpan.");
}

/** Simpan lalu ajukan (jalur approval dari template). Kekurangan wajib butuh alasan di submitNote. */
export async function submitReportAction(id: string, narratives: unknown, submitNote: string): Promise<FormState> {
  const saved = await saveNarrativesAction(id, narratives, submitNote);
  if (saved.status !== "ok") return saved;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("approval_start", { p_doc_type: DOC, p_record_id: id });
  if (error) return k3DbError(error);
  await sendPushForNotifications(notificationIds(data));
  refresh(id);
  return ok("Laporan diajukan. Approver pertama sudah diberi tahu.");
}

export async function decideReportAction(approvalId: string, decision: "approved" | "rejected", note: string, reportId: string): Promise<FormState> {
  if (!isUuid(approvalId) || !isUuid(reportId) || !["approved", "rejected"].includes(decision) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const trimmed = note.trim().slice(0, 1000);
  if (decision === "rejected" && trimmed.length < 5) return fail("Alasan pengembalian wajib diisi (minimal 5 karakter).", { note: ["Minimal 5 karakter"] });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("approval_decide", { p_approval_id: approvalId, p_decision: decision, p_note: trimmed || undefined });
  if (error) return k3DbError(error);
  await sendPushForNotifications(notificationIds(data));
  refresh(reportId);
  return ok(decision === "approved" ? "Persetujuan dicatat." : "Laporan dikembalikan ke penyusun.");
}

export async function cancelReportAction(id: string, note: string): Promise<FormState> {
  if (!isUuid(id) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("approval_cancel", { p_doc_type: DOC, p_record_id: id, p_note: note.trim().slice(0, 500) || undefined });
  if (error) return k3DbError(error);
  await sendPushForNotifications(notificationIds(data));
  refresh(id);
  return ok("Pengajuan ditarik dan kembali menjadi draf.");
}

export async function startCorrectionAction(id: string, reason: string): Promise<FormState> {
  if (!isUuid(id) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const trimmed = reason.trim().slice(0, 1000);
  if (trimmed.length < 10) return fail("Alasan koreksi wajib (minimal 10 karakter).", { reason: ["Minimal 10 karakter"] });
  const supabase = await createClient();
  const { error } = await supabase.rpc("report_start_correction", { p_id: id, p_reason: trimmed });
  if (error) return k3DbError(error);
  refresh(id);
  return ok("Koreksi dimulai. Perbarui laporan lalu ajukan kembali.");
}
