// TSP & Aktivitas K3: loader SATU sumber untuk matriks, ringkasan, aktivitas, evaluasi, dan ekspor.
// Angka berasal dari RPC tsp_matrix / tsp_summary (ikut RLS). Filter di sini hanya penyaring tampilan.
import "server-only";
import { getPeople } from "@/lib/people";
import { getK3People, todayWibIso, type AreaOption } from "@/lib/k3";
import { programProgress, type TspSummary } from "@/lib/tsp-rules";
import { enumParam, textParam, type SearchParams } from "@/lib/search-params";
import type { SiteChoice } from "@/lib/site-types";
import type { ServerClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------- params
export const TSP_STATUS_FILTERS = ["semua", "tercapai", "tertinggal"] as const;
export type TspStatusFilter = (typeof TSP_STATUS_FILTERS)[number];

export type TspParams = {
  tahun: number;
  /** bulan acuan ringkasan/evaluasi (1-12) */
  bulan: number;
  elemen: string;
  pj: string;
  status: TspStatusFilter;
  site: SiteChoice;
};

export function parseTspParams(sp: SearchParams, site: SiteChoice): TspParams {
  const today = todayWibIso();
  const nowYear = Number(today.slice(0, 4));
  const nowMonth = Number(today.slice(5, 7));
  const rawYear = Number(typeof sp.tahun === "string" ? sp.tahun : nowYear);
  const tahun = Number.isInteger(rawYear) && rawYear >= 2020 && rawYear <= nowYear + 1 ? rawYear : nowYear;
  const defaultMonth = tahun < nowYear ? 12 : tahun > nowYear ? 1 : nowMonth;
  const rawMonth = Number(typeof sp.bulan === "string" ? sp.bulan : defaultMonth);
  let bulan = Number.isInteger(rawMonth) && rawMonth >= 1 && rawMonth <= 12 ? rawMonth : defaultMonth;
  if (tahun === nowYear && bulan > nowMonth) bulan = nowMonth; // bulan depan belum bisa dievaluasi
  return {
    tahun,
    bulan,
    elemen: textParam(sp, "elemen"),
    pj: textParam(sp, "pj"),
    status: enumParam(sp, "status", TSP_STATUS_FILTERS, "semua"),
    site,
  };
}

// ---------------------------------------------------------------- matriks
export type TspRow = {
  id: string;
  siteId: string;
  no: string;
  element: string;
  name: string;
  owner: string;
  indicator: string;
  evidenceRequired: string;
  target: number;
  plan: number[];
  actual: number[];
  evidence: number[];
  notes: string[];
  isActive: boolean;
  sortOrder: number;
  totalActual: number;
  /** capaian s.d. bulan acuan (%), null bila tanpa rencana */
  pct: number | null;
  lagging: boolean;
  met: boolean;
};

/** Seluruh program satu tahun (tanpa filter tampilan) + capaian s.d. `bulan`. Dipakai tabel dan ekspor. */
export async function getTspMatrix(supabase: ServerClient, p: Pick<TspParams, "tahun" | "bulan" | "site">): Promise<TspRow[]> {
  const { data, error } = await supabase.rpc("tsp_matrix", { p_year: p.tahun, p_location: p.site ?? undefined });
  if (error) throw error;
  return (data ?? []).map((r) => {
    const pr = programProgress(r.plan, r.actual, p.bulan);
    return {
      id: r.id,
      siteId: r.location_id,
      no: r.no,
      element: r.element,
      name: r.name,
      owner: r.owner_label,
      indicator: r.indicator,
      evidenceRequired: r.evidence_required,
      target: r.annual_target,
      plan: r.plan,
      actual: r.actual,
      evidence: r.evidence,
      notes: r.notes,
      isActive: r.is_active,
      sortOrder: r.sort_order,
      totalActual: pr.totalActual,
      pct: pr.pct,
      lagging: pr.lagging,
      met: pr.met,
    };
  });
}

/** Penyaring tampilan (elemen, penanggung jawab, status) di atas hasil getTspMatrix. */
export function filterTspRows(rows: TspRow[], p: Pick<TspParams, "elemen" | "pj" | "status">): TspRow[] {
  return rows.filter(
    (r) => (!p.elemen || r.element === p.elemen) && (!p.pj || r.owner === p.pj) && (p.status === "semua" || (p.status === "tercapai" ? r.met : r.lagging)),
  );
}

export async function getTspSummary(supabase: ServerClient, p: Pick<TspParams, "tahun" | "bulan" | "site">): Promise<TspSummary> {
  const { data, error } = await supabase.rpc("tsp_summary", { p_year: p.tahun, p_month: p.bulan, p_location: p.site ?? undefined });
  if (error) throw error;
  return data as unknown as TspSummary;
}

// ---------------------------------------------------------------- aktivitas
export type ActivityRow = {
  id: string;
  code: string;
  typeCode: string;
  date: string;
  areaName: string;
  leaderName: string | null;
  participants: number;
  programId: string | null;
  programLabel: string | null;
  evidenceCount: number;
  notes: string | null;
};

export async function listActivities(supabase: ServerClient, p: Pick<TspParams, "tahun" | "site">, areas: AreaOption[], rows: TspRow[], limit = 30): Promise<ActivityRow[]> {
  let q = supabase
    .from("safety_activities")
    .select("id, code, type_code, activity_date, area_id, leader_id, participant_count, program_id, evidence_count, notes")
    .gte("activity_date", `${p.tahun}-01-01`)
    .lte("activity_date", `${p.tahun}-12-31`);
  if (p.site) q = q.eq("location_id", p.site);
  const { data, error } = await q.order("activity_date", { ascending: false }).order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  const people = await getPeople(
    supabase,
    (data ?? []).map((a) => a.leader_id),
  );
  return (data ?? []).map((a) => {
    const prog = a.program_id ? rows.find((r) => r.id === a.program_id) : null;
    return {
      id: a.id,
      code: a.code,
      typeCode: a.type_code,
      date: a.activity_date,
      areaName: areas.find((x) => x.value === a.area_id)?.label ?? "-",
      leaderName: people.get(a.leader_id)?.name ?? null,
      participants: a.participant_count,
      programId: a.program_id,
      programLabel: prog ? `${prog.no} · ${prog.name}` : null,
      evidenceCount: a.evidence_count,
      notes: a.notes,
    };
  });
}

// ---------------------------------------------------------------- evaluasi
export type EvaluationView = {
  id: string;
  status: string;
  summary: TspSummary | null;
  preparedBy: string | null;
  submittedAt: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
};

/** Evaluasi satu bulan (satu site). Bila "semua site", tidak ada evaluasi tunggal → null. */
export async function getEvaluation(supabase: ServerClient, p: Pick<TspParams, "tahun" | "bulan" | "site">): Promise<EvaluationView | null> {
  if (!p.site) return null;
  const { data, error } = await supabase
    .from("tsp_evaluations")
    .select("id, status, summary, prepared_by, submitted_at, decided_by, decided_at, decision_note")
    .eq("location_id", p.site)
    .eq("year", p.tahun)
    .eq("month", p.bulan)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const people = await getPeople(supabase, [data.prepared_by, data.decided_by].filter((x): x is string => !!x));
  return {
    id: data.id,
    status: data.status,
    summary: (data.summary as unknown as TspSummary) ?? null,
    preparedBy: data.prepared_by ? (people.get(data.prepared_by)?.name ?? null) : null,
    submittedAt: data.submitted_at,
    decidedBy: data.decided_by ? (people.get(data.decided_by)?.name ?? null) : null,
    decidedAt: data.decided_at,
    decisionNote: data.decision_note,
  };
}

export { getK3People };
