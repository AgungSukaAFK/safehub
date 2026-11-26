"use server";

// Server Action Kejadian: validasi zod → RPC (security definer, cek fungsi K3 + visibilitas di DB) →
// push notifikasi best-effort. Status hanya berubah lewat RPC incident_*.
import { revalidatePath } from "next/cache";
import { fail, invalid, NOT_ALLOWED, ok, type FormState } from "@/lib/action-state";
import { actionAccess } from "@/lib/auth";
import { cctv } from "@/lib/cctv";
import { k3DbError, readPayload } from "@/lib/k3-actions";
import { countKejadian } from "@/lib/kejadian";
import { classifySchema, investigationSchema, reportSchema, teamSchema } from "@/lib/kejadian-rules";
import { notificationIds, sendPushForNotifications } from "@/lib/push";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";

const done = async (data: unknown, id: string, message: string, extra?: Record<string, unknown>) => {
  await sendPushForNotifications(notificationIds(data));
  revalidatePath("/kejadian");
  revalidatePath(`/kejadian/${id}`);
  return ok(message, { id, ...extra });
};

/** Lapor kejadian (wizard). FormData: payload (JSON). Hasil: {id, code}. */
export async function reportIncidentAction(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await actionAccess("viewer"))) return NOT_ALLOWED;
  const raw = readPayload(fd);
  if (raw === null) return fail("Isian form tidak terbaca. Muat ulang halaman.");
  const parsed = reportSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("incident_report", { p: parsed.data });
  if (error) return k3DbError(error);
  const r = data as { id: string; code: string };
  return done(data, r.id, `Laporan ${r.code} terkirim.`, { code: r.code });
}

export async function classifyIncidentAction(id: string, values: unknown): Promise<FormState> {
  if (!isUuid(id) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const parsed = classifySchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("incident_classify", { p_id: id, p: parsed.data });
  if (error) return k3DbError(error);
  return done(data, id, "Klasifikasi & dampak disimpan.");
}

export async function setTeamAction(id: string, values: unknown): Promise<FormState> {
  if (!isUuid(id) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const parsed = teamSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("incident_set_team", {
    p_id: id,
    p_lead: parsed.data.lead_id,
    p_members: parsed.data.member_ids.filter((m) => m !== parsed.data.lead_id),
  });
  if (error) return k3DbError(error);
  return done(data, id, "Tim investigasi disimpan.");
}

export async function saveInvestigationAction(id: string, values: unknown): Promise<FormState> {
  if (!isUuid(id) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const parsed = investigationSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("incident_save_investigation", { p_id: id, p: parsed.data });
  if (error) return k3DbError(error);
  return done(data, id, "Investigasi disimpan.");
}

export async function submitReviewAction(id: string, note: string): Promise<FormState> {
  if (!isUuid(id) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("incident_submit_review", { p_id: id, p_note: note.trim().slice(0, 2000) || undefined });
  if (error) return k3DbError(error);
  return done(data, id, "Investigasi dikirim ke Review EHS.");
}

export async function reviewIncidentAction(id: string, decision: "approve" | "return", note: string): Promise<FormState> {
  if (!isUuid(id) || !["approve", "return"].includes(decision) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const trimmed = note.trim().slice(0, 2000);
  if (decision === "return" && !trimmed) return fail("Catatan wajib diisi saat mengembalikan.", { note: ["Wajib diisi"] });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("incident_review", { p_id: id, p_decision: decision, p_note: trimmed || undefined });
  if (error) return k3DbError(error);
  return done(data, id, decision === "approve" ? "Review disetujui." : "Investigasi dikembalikan dengan catatan.");
}

export async function closeExceptionAction(id: string, note: string): Promise<FormState> {
  if (!isUuid(id) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const trimmed = note.trim().slice(0, 2000);
  if (trimmed.length < 10) return fail("Alasan penutupan wajib diisi (minimal 10 karakter).", { note: ["Minimal 10 karakter"] });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("incident_close_exception", { p_id: id, p_note: trimmed });
  if (error) return k3DbError(error);
  return done(data, id, "Kejadian ditutup dengan pengecualian.");
}

/** Jumlah semua kejadian dalam scope (menu Excel "Semua data"). */
export async function countKejadianAction(): Promise<number> {
  if (!(await actionAccess("viewer"))) return 0;
  return countKejadian(await createClient());
}

/** CCTV cetak (gagal = cetak tetap jalan). */
export async function logPrintIncidentAction(id: string, code: string): Promise<void> {
  if (!isUuid(id) || !(await actionAccess("viewer"))) return;
  await cctv({ category: "export", action: "export.print", summary: `Mencetak kejadian ${code}`, entity: "incidents", recordId: id, recordLabel: code });
}

/** Dipanggil sebelum mencetak Laporan Investigasi (CCTV). Gagal = cetak tetap jalan. */
export async function logIncidentPrintAction(id: string, code: string, mode: "digital" | "basah"): Promise<void> {
  if (!isUuid(id) || !(await actionAccess("viewer"))) return;
  await cctv({
    category: "export",
    action: "export.print",
    summary: `Mencetak Laporan Investigasi ${code} (${mode === "digital" ? "tanda tangan digital" : "tanda tangan basah"})`,
    entity: "incidents",
    recordId: id,
    recordLabel: code,
    url: `/kejadian/${id}`,
    metadata: { mode, form: "GMI.MR.F.013-001" },
  });
}
