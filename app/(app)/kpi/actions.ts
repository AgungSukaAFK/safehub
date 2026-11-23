"use server";

// Server Action Kamus KPI & Jam Kerja. Kamus: admin menulis langsung ke tabel (RLS admin; trigger guard
// membuat versi baru + kembali draft). Pengesahan = RPC kpi_approve. Jam kerja = RPC work_hours_save.
import { revalidatePath } from "next/cache";
import { dbError, fail, invalid, NOT_ALLOWED, ok, type FormState } from "@/lib/action-state";
import { actionAccess } from "@/lib/auth";
import { workHoursSchema } from "@/lib/inspeksi-rules";
import { k3DbError } from "@/lib/k3-actions";
import { kpiSchema } from "@/lib/kpi-rules";
import { createClient } from "@/lib/supabase/server";

export async function saveKpiAction(code: string, values: unknown): Promise<FormState> {
  if (!/^[a-z][a-z0-9_]{1,40}$/.test(code) || !(await actionAccess("admin"))) return NOT_ALLOWED;
  const parsed = kpiSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error);
  const { warn_gte, danger_gte, ...rest } = parsed.data;
  const thresholds: Record<string, number> = {};
  if (typeof warn_gte === "number") thresholds.warn_gte = warn_gte;
  if (typeof danger_gte === "number") thresholds.danger_gte = danger_gte;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kpi_definitions")
    .update({
      ...rest,
      rule_text: rest.rule_text || null,
      example: rest.example || null,
      source: rest.source || null,
      owner: rest.owner || null,
      unit: rest.unit || null,
      thresholds: Object.keys(thresholds).length ? thresholds : null,
    })
    .eq("code", code)
    .select("version, status");
  if (error) return dbError(error);
  if (!data?.length) return fail("KPI tidak ditemukan atau Anda tidak punya akses.");
  revalidatePath("/kpi");
  revalidatePath(`/kpi/${code}`);
  revalidatePath("/");
  const v = data[0];
  return ok(v.status === "draft" ? `Disimpan sebagai versi ${v.version} (draf). Sahkan agar badge "Rumus belum disahkan" hilang.` : "Tersimpan.");
}

export async function approveKpiAction(code: string, note: string): Promise<FormState> {
  if (!/^[a-z][a-z0-9_]{1,40}$/.test(code) || !(await actionAccess("admin"))) return NOT_ALLOWED;
  const trimmed = note.trim().slice(0, 1000);
  if (trimmed.length < 5) return fail("Catatan pengesahan wajib diisi (minimal 5 karakter).", { note: ["Minimal 5 karakter"] });
  const supabase = await createClient();
  const { error } = await supabase.rpc("kpi_approve", { p_code: code, p_note: trimmed });
  if (error) return k3DbError(error);
  revalidatePath("/kpi");
  revalidatePath(`/kpi/${code}`);
  revalidatePath("/");
  return ok("Rumus disahkan.");
}

export async function saveWorkHoursAction(values: unknown): Promise<FormState> {
  if (!(await actionAccess("viewer"))) return NOT_ALLOWED;
  const parsed = workHoursSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("work_hours_save", { p_location: v.location_id, p_month: `${v.month}-01`, p_hours: v.hours, p_note: v.note ?? undefined });
  if (error) return k3DbError(error);
  revalidatePath("/kpi/jam-kerja");
  revalidatePath("/");
  return ok("Jam kerja disimpan.");
}
