// Pelatihan: loader SATU sumber untuk daftar, detail, dan riwayat per karyawan. Baca = RLS (staf K3, company + site).
import "server-only";
import { todayWibIso } from "@/lib/k3";
import { TRAINING_STATUS_FILTERS } from "@/lib/pelatihan-rules";
import { enumParam, textParam, type SearchParams } from "@/lib/search-params";
import type { SiteChoice } from "@/lib/site-types";
import type { ServerClient } from "@/lib/supabase/server";

export type TrainingParams = { site: SiteChoice; status: (typeof TRAINING_STATUS_FILTERS)[number]; q: string };
export function parseTrainingParams(sp: SearchParams, site: SiteChoice): TrainingParams {
  return { site, status: enumParam(sp, "status", TRAINING_STATUS_FILTERS, "semua"), q: textParam(sp, "q") };
}

export type TrainingRow = {
  id: string;
  code: string;
  title: string;
  competencyName: string | null;
  provider: string | null;
  venue: string | null;
  startsOn: string;
  endsOn: string;
  capacity: number | null;
  status: string;
  participants: number;
  present: number;
  evidence: number;
};

export async function listTrainings(supabase: ServerClient, p: TrainingParams): Promise<TrainingRow[]> {
  let q = supabase.from("trainings").select("id, code, title, competency_id, provider, venue, starts_on, ends_on, capacity, status, evidence_count");
  if (p.site) q = q.eq("location_id", p.site);
  if (p.status !== "semua") q = q.eq("status", p.status);
  if (p.q) q = q.ilike("title", `%${p.q.replace(/[%_]/g, "")}%`);
  const [{ data, error }, parts, comps] = await Promise.all([
    q.order("starts_on", { ascending: false }).limit(300),
    supabase.from("training_participants").select("training_id, attendance"),
    supabase.from("competencies").select("id, name"),
  ]);
  if (error) throw error;
  const cn = new Map((comps.data ?? []).map((c) => [c.id, c.name]));
  const count = new Map<string, { n: number; present: number }>();
  for (const x of parts.data ?? []) {
    const c = count.get(x.training_id) ?? { n: 0, present: 0 };
    c.n += 1;
    if (x.attendance === "present") c.present += 1;
    count.set(x.training_id, c);
  }
  return (data ?? []).map((t) => ({
    id: t.id,
    code: t.code,
    title: t.title,
    competencyName: t.competency_id ? (cn.get(t.competency_id) ?? null) : null,
    provider: t.provider,
    venue: t.venue,
    startsOn: t.starts_on,
    endsOn: t.ends_on,
    capacity: t.capacity,
    status: t.status,
    participants: count.get(t.id)?.n ?? 0,
    present: count.get(t.id)?.present ?? 0,
    evidence: t.evidence_count,
  }));
}

export type TrainingDetail = TrainingRow & {
  companyCode: string;
  siteId: string;
  competencyId: string | null;
  notes: string | null;
  /** tanggal mulai sudah tiba (kehadiran boleh dicatat) */
  started: boolean;
  attendees: { employeeId: string; code: string; name: string; jobTitle: string; attendance: string; note: string | null }[];
};

export async function getTrainingDetail(supabase: ServerClient, id: string): Promise<TrainingDetail | null> {
  const { data: t } = await supabase.from("trainings").select("*").eq("id", id).maybeSingle();
  if (!t) return null;
  const [parts, comp] = await Promise.all([
    supabase.from("training_participants").select("employee_id, attendance, note").eq("training_id", id),
    t.competency_id ? supabase.from("competencies").select("name").eq("id", t.competency_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const ids = (parts.data ?? []).map((x) => x.employee_id);
  const { data: emps } = ids.length ? await supabase.from("employees").select("id, code, name, job_title").in("id", ids) : { data: [] };
  const em = new Map((emps ?? []).map((e) => [e.id, e]));
  const attendees = (parts.data ?? [])
    .map((x) => ({
      employeeId: x.employee_id,
      code: em.get(x.employee_id)?.code ?? "-",
      name: em.get(x.employee_id)?.name ?? "-",
      jobTitle: em.get(x.employee_id)?.job_title ?? "-",
      attendance: x.attendance,
      note: x.note,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "id"));
  return {
    id: t.id,
    code: t.code,
    title: t.title,
    competencyName: comp.data?.name ?? null,
    competencyId: t.competency_id,
    provider: t.provider,
    venue: t.venue,
    startsOn: t.starts_on,
    endsOn: t.ends_on,
    capacity: t.capacity,
    status: t.status,
    participants: attendees.length,
    present: attendees.filter((a) => a.attendance === "present").length,
    evidence: t.evidence_count,
    companyCode: t.company_code,
    siteId: t.location_id,
    notes: t.notes,
    started: t.starts_on <= todayWibIso(),
    attendees,
  };
}

/** Karyawan aktif di site pelatihan (untuk memilih peserta). */
export async function listTrainingCandidates(supabase: ServerClient, siteId: string) {
  const { data } = await supabase.from("employees").select("id, code, name, job_title").eq("status", "active").eq("location_id", siteId).order("name").limit(500);
  return (data ?? []).map((e) => ({ id: e.id, code: e.code, name: e.name, jobTitle: e.job_title }));
}

export async function getEmployeeTrainings(supabase: ServerClient, employeeId: string) {
  const { data, error } = await supabase.rpc("employee_trainings", { p_employee: employeeId });
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.training_id, code: r.code, title: r.title, startsOn: r.starts_on, endsOn: r.ends_on, status: r.status, attendance: r.attendance }));
}
