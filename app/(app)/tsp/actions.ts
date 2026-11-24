"use server";

// Server Action TSP & Aktivitas: validasi zod → RPC (security definer; fungsi K3 + scope dicek di DB) → push.
import { revalidatePath } from "next/cache";
import { fail, invalid, NOT_ALLOWED, ok, type FormState } from "@/lib/action-state";
import { actionAccess } from "@/lib/auth";
import { k3DbError } from "@/lib/k3-actions";
import { notificationIds, sendPushForNotifications } from "@/lib/push";
import { createClient } from "@/lib/supabase/server";
import { activitySchema, programSchema, realizationSchema } from "@/lib/tsp-rules";
import { isUuid } from "@/lib/utils";

const refresh = () => {
  revalidatePath("/tsp");
  revalidatePath("/tugas");
  revalidatePath("/");
};

export async function saveProgramAction(id: string | null, values: unknown): Promise<FormState> {
  if ((id !== null && !isUuid(id)) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const parsed = programSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("tsp_program_save", { p_id: id as string, p: parsed.data });
  if (error) return k3DbError(error);
  refresh();
  return ok(id ? "Program diperbarui." : "Program ditambahkan.", { id: (data as { id: string }).id });
}

export async function copyProgramsAction(fromYear: number, toYear: number, siteId: string): Promise<FormState> {
  if (!Number.isInteger(fromYear) || !Number.isInteger(toYear) || !isUuid(siteId) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("tsp_programs_copy", { p_from_year: fromYear, p_to_year: toYear, p_location: siteId });
  if (error) return k3DbError(error);
  refresh();
  return ok(`${(data as { copied: number }).copied} program disalin ke ${toYear}.`);
}

/** Catat realisasi program x bulan. Bukti sudah diunggah browser ke tsp/<program>/<YYYY-MM>/ sebelum action ini. */
export async function saveRealizationAction(values: unknown): Promise<FormState> {
  if (!(await actionAccess("viewer"))) return NOT_ALLOWED;
  const parsed = realizationSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("tsp_realization_save", { p_program: v.program_id, p_month: v.month, p_actual: v.actual, p_note: v.note ?? undefined });
  if (error) return k3DbError(error);
  refresh();
  return ok("Realisasi tersimpan.");
}

export async function saveActivityAction(values: unknown): Promise<FormState> {
  if (!(await actionAccess("viewer"))) return NOT_ALLOWED;
  const parsed = activitySchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("safety_activity_save", { p: { ...parsed.data, program_id: parsed.data.program_id || null } });
  if (error) return k3DbError(error);
  refresh();
  const r = data as { id: string; code: string };
  return ok(`Aktivitas ${r.code} dicatat.`, { id: r.id, code: r.code });
}

/** Dipanggil setelah bukti aktivitas diunggah (hitung ulang jumlah file dari Storage). */
export async function syncActivityEvidenceAction(id: string): Promise<FormState> {
  if (!isUuid(id) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const supabase = await createClient();
  const { error } = await supabase.rpc("safety_activity_sync_evidence", { p_id: id });
  if (error) return k3DbError(error);
  refresh();
  return ok("Bukti diperbarui.");
}

export async function submitEvaluationAction(year: number, month: number, siteId: string): Promise<FormState> {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !isUuid(siteId) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("tsp_evaluation_submit", { p_year: year, p_month: month, p_location: siteId });
  if (error) return k3DbError(error);
  await sendPushForNotifications(notificationIds(data));
  refresh();
  return ok("Evaluasi diajukan ke PJO.");
}

export async function decideEvaluationAction(id: string, approve: boolean, note: string): Promise<FormState> {
  if (!isUuid(id) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const trimmed = note.trim().slice(0, 2000);
  if (!approve && !trimmed) return fail("Alasan pengembalian wajib diisi.", { note: ["Wajib diisi"] });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("tsp_evaluation_decide", { p_id: id, p_approve: approve, p_note: trimmed || undefined });
  if (error) return k3DbError(error);
  await sendPushForNotifications(notificationIds(data));
  refresh();
  return ok(approve ? "Evaluasi disetujui." : "Evaluasi dikembalikan.");
}
