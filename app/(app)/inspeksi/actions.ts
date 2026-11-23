"use server";

// Server Action Inspeksi: validasi zod → RPC (security definer, cek fungsi K3 + visibilitas di DB) → push.
import { revalidatePath } from "next/cache";
import { fail, invalid, NOT_ALLOWED, ok, type FormState } from "@/lib/action-state";
import { actionAccess } from "@/lib/auth";
import { answersSchema, scheduleSchema, submitFindingsSchema, templateSchema } from "@/lib/inspeksi-rules";
import { k3DbError } from "@/lib/k3-actions";
import { notificationIds, sendPushForNotifications } from "@/lib/push";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";

const refresh = (id?: string) => {
  revalidatePath("/inspeksi");
  if (id) revalidatePath(`/inspeksi/${id}`);
  revalidatePath("/tugas");
};

export async function scheduleInspectionAction(values: unknown): Promise<FormState> {
  if (!(await actionAccess("viewer"))) return NOT_ALLOWED;
  const parsed = scheduleSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("inspection_schedule", {
    p: { ...v, planned_at: new Date(v.planned_at).toISOString() },
  });
  if (error) return k3DbError(error);
  await sendPushForNotifications(notificationIds(data));
  const r = data as { id: string; code: string };
  refresh();
  return ok(`Jadwal ${r.code} disimpan. Pemeriksa sudah diberi tahu.`, { id: r.id, code: r.code });
}

export async function startInspectionAction(id: string): Promise<FormState> {
  if (!isUuid(id) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const supabase = await createClient();
  const { error } = await supabase.rpc("inspection_start", { p_id: id });
  if (error) return k3DbError(error);
  refresh(id);
  return ok("Inspeksi dimulai.");
}

/** Simpan jawaban (draf di server). Dipanggil otomatis saat mengisi checklist. */
export async function saveAnswersAction(id: string, answers: unknown): Promise<FormState> {
  if (!isUuid(id) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const parsed = answersSchema.safeParse(answers);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("inspection_save_answers", { p_id: id, p: parsed.data });
  if (error) return k3DbError(error);
  return ok("Draf tersimpan.");
}

/** Kirim inspeksi (jawaban disimpan lebih dulu agar konsisten). Hasil: ringkasan + kode temuan. */
export async function submitInspectionAction(id: string, answers: unknown, findings: unknown): Promise<FormState> {
  if (!isUuid(id) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const a = answersSchema.safeParse(answers);
  if (!a.success) return invalid(a.error);
  const f = submitFindingsSchema.safeParse(findings);
  if (!f.success) return invalid(f.error);
  const supabase = await createClient();
  const saved = await supabase.rpc("inspection_save_answers", { p_id: id, p: a.data });
  if (saved.error) return k3DbError(saved.error);
  const { data, error } = await supabase.rpc("inspection_submit", { p_id: id, p_findings: f.data });
  if (error) return k3DbError(error);
  await sendPushForNotifications(notificationIds(data));
  const r = data as { summary: { compliant: number; noncompliant: number; na: number; findings: number }; finding_codes: string[] };
  refresh(id);
  revalidatePath("/temuan");
  return ok("Inspeksi berhasil dikirim.", { summary: r.summary, findingCodes: r.finding_codes });
}

export async function verifyInspectionAction(id: string, note: string): Promise<FormState> {
  if (!isUuid(id) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("inspection_verify", { p_id: id, p_note: note.trim().slice(0, 2000) || undefined });
  if (error) return k3DbError(error);
  await sendPushForNotifications(notificationIds(data));
  refresh(id);
  return ok("Inspeksi diverifikasi.");
}

export async function cancelInspectionAction(id: string, reason: string): Promise<FormState> {
  if (!isUuid(id) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const trimmed = reason.trim().slice(0, 1000);
  if (!trimmed) return fail("Alasan pembatalan wajib diisi.", { reason: ["Wajib diisi"] });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("inspection_cancel", { p_id: id, p_reason: trimmed });
  if (error) return k3DbError(error);
  await sendPushForNotifications(notificationIds(data));
  refresh(id);
  return ok("Inspeksi dibatalkan.");
}

export async function saveTemplateAction(id: string | null, values: unknown): Promise<FormState> {
  if (!(await actionAccess("viewer"))) return NOT_ALLOWED;
  if (id && !isUuid(id)) return fail("Template tidak valid.");
  const parsed = templateSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error);
  const items = parsed.data.items.filter((t) => t.trim().length > 0);
  if (items.length === 0) return fail("Tambahkan minimal satu butir checklist.", { items: ["Minimal 1 butir"] });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("inspection_template_save", { p_id: id as string, p: { ...parsed.data, items } });
  if (error) return k3DbError(error);
  revalidatePath("/inspeksi/template");
  return ok(id ? "Template diperbarui." : "Template dibuat.", { id: (data as { id: string }).id });
}
