"use server";

// Server Action Dokumen terkendali (+ Evaluasi Peraturan, Register KO). zod → RPC / approval engine (hak dicek di DB) → push.
// Pengakuan baca dibuat DB saat revisi disetujui (notifikasi in-app; tab terbuka menerima lewat realtime).
import { revalidatePath } from "next/cache";
import { fail, invalid, NOT_ALLOWED, ok, type FormState } from "@/lib/action-state";
import { actionAccess } from "@/lib/auth";
import { documentSchema, evaluationSchema, koSchema, makeFindingSchema, regulationSchema } from "@/lib/dokumen-rules";
import { k3DbError } from "@/lib/k3-actions";
import { notificationIds, sendPushForNotifications } from "@/lib/push";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";

const DOC = "document_revision";
const refresh = (id?: string) => {
  revalidatePath("/dokumen");
  revalidatePath("/peraturan");
  revalidatePath("/ko");
  revalidatePath("/tugas");
  if (id) revalidatePath(`/dokumen/${id}`);
};
const nullId = (id: string | null) => (id ?? null) as string;

export async function saveDocumentAction(id: string | null, values: unknown): Promise<FormState> {
  if ((id !== null && !isUuid(id)) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const parsed = documentSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("document_save", { p_id: nullId(id), p: parsed.data });
  if (error) return k3DbError(error);
  const r = data as { id: string };
  refresh(r.id);
  return ok(id ? "Dokumen diperbarui." : "Dokumen dibuat. Unggah file revisi 1 lalu ajukan.", { id: r.id });
}

export async function startRevisionAction(docId: string, summary: string): Promise<FormState> {
  if (!isUuid(docId) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  if (summary.trim().length < 5) return fail("Ringkasan perubahan minimal 5 karakter.", { summary: ["Minimal 5 karakter"] });
  const supabase = await createClient();
  const { error } = await supabase.rpc("document_revision_start", { p_doc: docId, p_summary: summary.trim().slice(0, 2000) });
  if (error) return k3DbError(error);
  refresh(docId);
  return ok("Revisi baru dibuat sebagai draf.");
}

export async function saveRevisionAction(docId: string, revisionId: string, summary: string): Promise<FormState> {
  if (!isUuid(docId) || !isUuid(revisionId) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  if (summary.trim().length < 5) return fail("Ringkasan perubahan minimal 5 karakter.", { summary: ["Minimal 5 karakter"] });
  const supabase = await createClient();
  const { error } = await supabase.rpc("document_revision_save", { p_id: revisionId, p_summary: summary.trim().slice(0, 2000) });
  if (error) return k3DbError(error);
  refresh(docId);
  return ok("Revisi disimpan.");
}

/** Setelah file revisi diunggah ke dokumen/<revisi>/ atau KO ke ko/<id>/: hitung ulang jumlah file. */
export async function syncFilesAction(kind: "dokumen" | "ko", id: string, docId?: string): Promise<FormState> {
  if (!["dokumen", "ko"].includes(kind) || !isUuid(id) || (docId && !isUuid(docId)) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const supabase = await createClient();
  const { error } = await supabase.rpc("dokumen_sync_evidence", { p_kind: kind, p_id: id });
  if (error) return k3DbError(error);
  refresh(docId);
  return ok("File diperbarui.");
}

export async function submitRevisionAction(docId: string, revisionId: string, summary: string): Promise<FormState> {
  const saved = await saveRevisionAction(docId, revisionId, summary);
  if (saved.status !== "ok") return saved;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("approval_start", { p_doc_type: DOC, p_record_id: revisionId });
  if (error) return k3DbError(error);
  await sendPushForNotifications(notificationIds(data));
  refresh(docId);
  return ok("Revisi diajukan. Approver pertama sudah diberi tahu.");
}

export async function decideRevisionAction(approvalId: string, decision: "approved" | "rejected", note: string, docId: string): Promise<FormState> {
  if (!isUuid(approvalId) || !isUuid(docId) || !["approved", "rejected"].includes(decision) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const trimmed = note.trim().slice(0, 1000);
  if (decision === "rejected" && trimmed.length < 5) return fail("Alasan pengembalian wajib diisi (minimal 5 karakter).", { note: ["Minimal 5 karakter"] });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("approval_decide", { p_approval_id: approvalId, p_decision: decision, p_note: trimmed || undefined });
  if (error) return k3DbError(error);
  await sendPushForNotifications(notificationIds(data));
  refresh(docId);
  return ok(decision === "approved" ? "Persetujuan dicatat." : "Revisi dikembalikan ke penyusun.");
}

export async function cancelRevisionAction(docId: string, revisionId: string, note: string): Promise<FormState> {
  if (!isUuid(docId) || !isUuid(revisionId) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("approval_cancel", { p_doc_type: DOC, p_record_id: revisionId, p_note: note.trim().slice(0, 500) || undefined });
  if (error) return k3DbError(error);
  await sendPushForNotifications(notificationIds(data));
  refresh(docId);
  return ok("Pengajuan ditarik dan kembali menjadi draf.");
}

export async function withdrawDocumentAction(docId: string, reason: string): Promise<FormState> {
  if (!isUuid(docId) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  if (reason.trim().length < 10) return fail("Alasan penarikan minimal 10 karakter.", { reason: ["Minimal 10 karakter"] });
  const supabase = await createClient();
  const { error } = await supabase.rpc("document_withdraw", { p_doc: docId, p_reason: reason.trim().slice(0, 1000) });
  if (error) return k3DbError(error);
  refresh(docId);
  return ok("Dokumen ditarik.");
}

export async function acknowledgeDocumentAction(docId: string, revisionId: string): Promise<FormState> {
  if (!isUuid(docId) || !isUuid(revisionId) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const supabase = await createClient();
  const { error } = await supabase.rpc("document_acknowledge", { p_revision: revisionId });
  if (error) return k3DbError(error);
  refresh(docId);
  return ok("Terima kasih, pengakuan tercatat.");
}

// ---------------------------------------------------------------- peraturan
export async function saveRegulationAction(id: string | null, values: unknown): Promise<FormState> {
  if ((id !== null && !isUuid(id)) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const parsed = regulationSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("regulation_save", { p_id: nullId(id), p: parsed.data });
  if (error) return k3DbError(error);
  refresh();
  return ok(id ? "Peraturan diperbarui." : "Peraturan ditambahkan.");
}

export async function saveEvaluationAction(id: string | null, regulationId: string, values: unknown): Promise<FormState> {
  if ((id !== null && !isUuid(id)) || !isUuid(regulationId) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const parsed = evaluationSchema.safeParse({ ...(values as object), regulation_id: regulationId });
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("regulation_evaluation_save", { p_id: nullId(id), p: parsed.data });
  if (error) return k3DbError(error);
  refresh();
  return ok(id ? "Evaluasi diperbarui." : "Evaluasi dicatat.");
}

export async function makeFindingAction(evaluationId: string, values: unknown): Promise<FormState> {
  if (!isUuid(evaluationId) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const parsed = makeFindingSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("regulation_make_finding", { p_eval: evaluationId, p: parsed.data });
  if (error) return k3DbError(error);
  const r = data as { finding_id: string; code: string };
  refresh();
  revalidatePath("/temuan");
  return ok(`Temuan ${r.code} dibuat.`, { id: r.finding_id });
}

// ---------------------------------------------------------------- register KO
export async function saveKoAction(id: string | null, values: unknown): Promise<FormState> {
  if ((id !== null && !isUuid(id)) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const parsed = koSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("ko_save", { p_id: nullId(id), p: parsed.data });
  if (error) return k3DbError(error);
  refresh();
  return ok(id ? "Item KO diperbarui." : "Item KO ditambahkan.");
}
