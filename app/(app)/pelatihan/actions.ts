"use server";

// Server Action Pelatihan. zod → RPC (hak dicek di DB). Notifikasi peserta dikirim sebagai push setelah RPC.
import { revalidatePath } from "next/cache";
import { fail, invalid, NOT_ALLOWED, ok, type FormState } from "@/lib/action-state";
import { actionAccess } from "@/lib/auth";
import { k3DbError } from "@/lib/k3-actions";
import { trainingSchema } from "@/lib/pelatihan-rules";
import { notificationIds, sendPushForNotifications } from "@/lib/push";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";

const refresh = (id?: string) => {
  revalidatePath("/pelatihan");
  revalidatePath("/kompetensi");
  if (id) revalidatePath(`/pelatihan/${id}`);
};

export async function saveTrainingAction(id: string | null, values: unknown): Promise<FormState> {
  if ((id !== null && !isUuid(id)) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const parsed = trainingSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("training_save", { p_id: (id ?? null) as string, p: parsed.data });
  if (error) return k3DbError(error);
  const r = data as { id: string; code: string };
  refresh(r.id);
  return ok(id ? "Pelatihan diperbarui." : `Pelatihan ${r.code} direncanakan.`, { id: r.id, code: r.code });
}

export async function setParticipantsAction(id: string, employeeIds: string[]): Promise<FormState> {
  if (!isUuid(id) || !Array.isArray(employeeIds) || !employeeIds.every(isUuid) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("training_participants_set", { p_id: id, p_employee_ids: employeeIds });
  if (error) return k3DbError(error);
  await sendPushForNotifications(notificationIds(data));
  refresh(id);
  return ok(`${employeeIds.length} peserta tersimpan.`);
}

export async function setAttendanceAction(id: string, employeeId: string, attendance: string): Promise<FormState> {
  if (!isUuid(id) || !isUuid(employeeId) || !["registered", "present", "absent"].includes(attendance) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const supabase = await createClient();
  const { error } = await supabase.rpc("training_attendance_set", { p_id: id, p_employee: employeeId, p_attendance: attendance });
  if (error) return k3DbError(error);
  refresh(id);
  return ok("Kehadiran dicatat.");
}

export async function setTrainingStatusAction(id: string, status: "done" | "cancelled", note: string): Promise<FormState> {
  if (!isUuid(id) || !["done", "cancelled"].includes(status) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const trimmed = note.trim().slice(0, 2000);
  if (status === "cancelled" && trimmed.length < 10) return fail("Alasan pembatalan minimal 10 karakter.", { note: ["Minimal 10 karakter"] });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("training_set_status", { p_id: id, p_status: status, p_note: trimmed || undefined });
  if (error) return k3DbError(error);
  await sendPushForNotifications(notificationIds(data));
  refresh(id);
  return ok(status === "done" ? "Pelatihan diselesaikan." : "Pelatihan dibatalkan.");
}

/** Setelah bukti diunggah ke pelatihan/<id>/: hitung ulang jumlah file. */
export async function syncTrainingEvidenceAction(id: string): Promise<FormState> {
  if (!isUuid(id) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const supabase = await createClient();
  const { error } = await supabase.rpc("training_sync_evidence", { p_id: id });
  if (error) return k3DbError(error);
  refresh(id);
  return ok("Bukti diperbarui.");
}
