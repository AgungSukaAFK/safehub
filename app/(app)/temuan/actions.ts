"use server";

// Server Action Temuan + Tindakan PICA (dipakai juga tab Tindakan kejadian). Status hanya lewat RPC.
import { revalidatePath } from "next/cache";
import { fail, invalid, NOT_ALLOWED, ok, type FormState } from "@/lib/action-state";
import { actionAccess } from "@/lib/auth";
import { k3DbError, readPayload } from "@/lib/k3-actions";
import { actionSchema } from "@/lib/pica-rules";
import { notificationIds, sendPushForNotifications } from "@/lib/push";
import { createClient } from "@/lib/supabase/server";
import { countTemuan } from "@/lib/temuan";
import { findingSchema } from "@/lib/temuan-rules";
import { isUuid } from "@/lib/utils";

async function finish(data: unknown, paths: string[], message: string, extra?: Record<string, unknown>) {
  await sendPushForNotifications(notificationIds(data));
  for (const p of paths) revalidatePath(p);
  return ok(message, extra);
}

// ---------------------------------------------------------------- temuan
/** Simpan temuan (baru bila tanpa id). FormData: id?, payload (JSON). */
export async function saveFindingAction(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await actionAccess("viewer"))) return NOT_ALLOWED;
  const id = String(fd.get("id") ?? "") || null;
  if (id && !isUuid(id)) return fail("Temuan tidak valid.");
  const raw = readPayload(fd);
  if (raw === null) return fail("Isian form tidak terbaca. Muat ulang halaman.");
  const parsed = findingSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("finding_save", { p_id: id as string, p: parsed.data });
  if (error) return k3DbError(error);
  const r = data as { id: string; code: string };
  return finish(data, ["/temuan", `/temuan/${r.id}`], id ? "Perubahan temuan disimpan." : `Temuan ${r.code} dibuat.`, { id: r.id, code: r.code });
}

export async function closeFindingAction(id: string, note: string): Promise<FormState> {
  if (!isUuid(id) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const trimmed = note.trim().slice(0, 2000);
  if (!trimmed) return fail("Alasan penutupan wajib diisi.", { note: ["Wajib diisi"] });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("finding_close", { p_id: id, p_note: trimmed });
  if (error) return k3DbError(error);
  return finish(data, ["/temuan", `/temuan/${id}`], "Temuan ditutup.");
}

// ---------------------------------------------------------------- tindakan PICA
const parentPaths = (v: { finding_id?: string | null; incident_id?: string | null }) =>
  v.finding_id ? ["/temuan", `/temuan/${v.finding_id}`] : ["/kejadian", `/kejadian/${v.incident_id}`];

export async function createActionAction(values: unknown): Promise<FormState> {
  if (!(await actionAccess("viewer"))) return NOT_ALLOWED;
  const parsed = actionSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pica_create", { p: parsed.data });
  if (error) return k3DbError(error);
  const r = data as { id: string; code: string };
  return finish(data, parentPaths(parsed.data), `Tindakan ${r.code} ditambahkan. PIC sudah diberi tahu.`, { id: r.id, code: r.code });
}

export async function startActionAction(id: string): Promise<FormState> {
  if (!isUuid(id) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pica_start", { p_id: id });
  if (error) return k3DbError(error);
  return finish(data, ["/temuan", "/kejadian", "/tugas"], "Tindakan ditandai sedang dikerjakan.");
}

/** files = path storage `pica/<id>/r<putaran>/…` yang sudah diunggah browser. */
export async function submitEvidenceAction(id: string, note: string, files: string[]): Promise<FormState> {
  if (!isUuid(id) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const clean = files.filter((f) => typeof f === "string" && f.startsWith(`pica/${id}/`)).slice(0, 20);
  if (!clean.length) return fail("Unggah minimal satu file bukti.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pica_submit_evidence", { p_id: id, p_note: note.trim().slice(0, 2000), p_files: clean });
  if (error) return k3DbError(error);
  return finish(data, ["/temuan", "/kejadian", "/tugas"], "Bukti terkirim. Verifikator sudah diberi tahu.");
}

export async function verifyActionAction(id: string, decision: "accept" | "return", note: string): Promise<FormState> {
  if (!isUuid(id) || !["accept", "return"].includes(decision) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const trimmed = note.trim().slice(0, 2000);
  if (!trimmed) return fail("Komentar verifikator wajib diisi.", { note: ["Wajib diisi"] });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pica_verify", { p_id: id, p_decision: decision, p_note: trimmed });
  if (error) return k3DbError(error);
  return finish(data, ["/temuan", "/kejadian", "/tugas"], decision === "accept" ? "Bukti diterima. Tindakan Closed." : "Tindakan dikembalikan ke PIC.");
}

export async function changeDueAction(id: string, due: string, reason: string): Promise<FormState> {
  if (!isUuid(id) || !/^\d{4}-\d{2}-\d{2}$/.test(due) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const trimmed = reason.trim().slice(0, 1000);
  if (!trimmed) return fail("Alasan perubahan wajib diisi.", { reason: ["Wajib diisi"] });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pica_change_due", { p_id: id, p_due: due, p_reason: trimmed });
  if (error) return k3DbError(error);
  return finish(data, ["/temuan", "/kejadian"], "Due date diubah. PIC sudah diberi tahu.");
}

export async function setEffectivenessAction(id: string, date: string, note: string): Promise<FormState> {
  if (!isUuid(id) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pica_set_effectiveness", { p_id: id, p_date: date, p_note: note.trim().slice(0, 1000) });
  if (error) return k3DbError(error);
  return finish(data, ["/temuan", "/kejadian"], "Verifikasi efektivitas dicatat.");
}

export async function countTemuanAction(): Promise<number> {
  if (!(await actionAccess("viewer"))) return 0;
  return countTemuan(await createClient());
}
