// Kamus KPI, jam kerja, dan angka Beranda K3. Hak baca dijaga RLS; kpi_safety hanya untuk staf K3.
import "server-only";
import { cache } from "react";
import { getPeople } from "@/lib/people";
import type { KpiThresholds } from "@/lib/kpi-rules";
import type { SiteChoice } from "@/lib/site-types";
import type { ServerClient } from "@/lib/supabase/server";

export type KpiDef = {
  id: string;
  code: string;
  name: string;
  definition: string;
  formula: string;
  ruleText: string | null;
  example: string | null;
  source: string | null;
  owner: string | null;
  unit: string | null;
  direction: "lower_better" | "higher_better" | "neutral";
  thresholds: KpiThresholds | null;
  status: "draft" | "approved";
  version: number;
  approvedAt: string | null;
  approvedByName: string | null;
  approvalNote: string | null;
  updatedAt: string;
};

const COLUMNS =
  "id, code, name, definition, formula, rule_text, example, source, owner, unit, direction, thresholds, status, version, approved_by, approved_at, approval_note, updated_at";

type Raw = {
  id: string;
  code: string;
  name: string;
  definition: string;
  formula: string;
  rule_text: string | null;
  example: string | null;
  source: string | null;
  owner: string | null;
  unit: string | null;
  direction: string;
  thresholds: unknown;
  status: string;
  version: number;
  approved_by: string | null;
  approved_at: string | null;
  approval_note: string | null;
  updated_at: string;
};

async function toDefs(supabase: ServerClient, raw: Raw[]): Promise<KpiDef[]> {
  const people = await getPeople(
    supabase,
    raw.map((r) => r.approved_by),
  );
  return raw.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    definition: r.definition,
    formula: r.formula,
    ruleText: r.rule_text,
    example: r.example,
    source: r.source,
    owner: r.owner,
    unit: r.unit,
    direction: r.direction as KpiDef["direction"],
    thresholds: (r.thresholds as KpiThresholds | null) ?? null,
    status: r.status as KpiDef["status"],
    version: r.version,
    approvedAt: r.approved_at,
    approvedByName: r.approved_by ? (people.get(r.approved_by)?.name ?? null) : null,
    approvalNote: r.approval_note,
    updatedAt: r.updated_at,
  }));
}

/** Semua KPI aktif, urut sort_order (dibaca sekali per request). */
export const listKpis = cache(async (supabase: ServerClient): Promise<KpiDef[]> => {
  const { data, error } = await supabase.from("kpi_definitions").select(COLUMNS).eq("is_active", true).order("sort_order").order("name");
  if (error) throw error;
  return toDefs(supabase, (data ?? []) as Raw[]);
});

export async function getKpi(supabase: ServerClient, code: string): Promise<KpiDef | null> {
  const { data } = await supabase.from("kpi_definitions").select(COLUMNS).eq("code", code).maybeSingle();
  if (!data) return null;
  return (await toDefs(supabase, [data as Raw]))[0];
}

// ---------------------------------------------------------------- jam kerja
export type WorkHoursRow = { locationId: string; month: string; hours: number; note: string | null };

export async function listWorkHours(supabase: ServerClient, year: number): Promise<WorkHoursRow[]> {
  const { data, error } = await supabase.from("work_hours").select("location_id, month, hours, note").gte("month", `${year}-01-01`).lte("month", `${year}-12-01`).order("month");
  if (error) throw error;
  return (data ?? []).map((r) => ({ locationId: r.location_id, month: r.month.slice(0, 7), hours: Number(r.hours), note: r.note }));
}

// ---------------------------------------------------------------- Beranda K3
export type SafetyKpi = {
  fatality: number;
  lti: number;
  near_miss: number;
  property_damage: number;
  lost_days: number;
  hours: number | null;
  hours_months: number;
  ltifr: number | null;
  ltisr: number | null;
};

export type DashboardK3 = {
  month: SafetyKpi | null;
  ytd: SafetyKpi | null;
  hours_series: { month: string; hours: number }[];
  findings: { open: number; overdue: number; age: { d0_7: number; d8_14: number; d15_30: number; d31p: number } };
  pica: { open: number; in_progress: number; waiting_verification: number; overdue: number; closed: number };
  leading: { month: string; plan: number; actual: number; observations: number }[];
  incidents_open: number;
  incidents_to_classify: number;
  inspections_late: number;
};

/** SATU RPC untuk semua angka Beranda K3 (rancangan §4.4); ikut RLS + scope site. */
export async function getDashboardK3(supabase: ServerClient, year: number, month: number, site: SiteChoice): Promise<DashboardK3> {
  const { data, error } = await supabase.rpc("dashboard_k3", { p_year: year, p_month: month, p_location: site ?? undefined });
  if (error) throw error;
  return data as unknown as DashboardK3;
}
