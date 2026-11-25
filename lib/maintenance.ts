// Maintenance (fase 5, HANYA BACA): loader untuk /maintenance dan blok Beranda. Angka dashboard = RPC mnt_dashboard (SATU sumber).
// Data cermin diisi lewat Impor Data; tidak ada tulis di sini.
import "server-only";
import { daysBetween } from "@/lib/expiry";
import { todayWibIso } from "@/lib/k3";
import { libState, MNT_TABS, type LibState, type MntTab } from "@/lib/maintenance-rules";
import { enumParam, textParam, type SearchParams } from "@/lib/search-params";
import type { SiteChoice } from "@/lib/site-types";
import type { ServerClient } from "@/lib/supabase/server";

/** URL dasar sistem maintenance (opsional, env MAINTENANCE_SYSTEM_URL). Hanya https; tidak ada URL per record yang diketahui (D12). */
export const MAINTENANCE_SYSTEM_URL = (() => {
  const v = (process.env.MAINTENANCE_SYSTEM_URL ?? "").trim();
  return /^https:\/\/\S+$/.test(v) ? v : "";
})();

export type MntParams = { site: SiteChoice; bulan: string; from: string; to: string; tab: MntTab; q: string };

/** `bulan` = YYYY-MM (bawaan bulan ini WIB). Bulan berjalan dihitung sampai hari ini, bulan lalu penuh. */
export function parseMntParams(sp: SearchParams, site: SiteChoice): MntParams {
  const today = todayWibIso();
  const raw = textParam(sp, "bulan");
  const bulan = /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) && raw <= today.slice(0, 7) ? raw : today.slice(0, 7);
  const [y, m] = bulan.split("-").map(Number);
  const from = `${bulan}-01`;
  const eom = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { site, bulan, from, to: eom > today ? today : eom, tab: enumParam(sp, "tab", MNT_TABS.map((t) => t.key), "ringkasan"), q: textParam(sp, "q") };
}

export function shiftMonth(bulan: string, delta: number): string {
  const [y, m] = bulan.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

export type MntDashboard = {
  period: { from: string; to: string; days: number };
  units: { total: number; operating: number; byStatus: Record<string, number> };
  pa: number | null;
  mtbfHours: number | null;
  mttrHours: number | null;
  breakdownCount: number;
  breakdownHours: number;
  plannedHours: number;
  ps: { planned: number; onTime: number; overdue: number; accuracy: number | null };
  backlog: { total: number; high: number; medium: number; low: number; avgAgeDays: number; oldestDays: number };
  topBreakdown: { unitId: string; code: string; model: string | null; hours: number; count: number }[];
  sync: Record<string, { syncedAt: string; rows: number; filename: string | null }>;
  /** waktu sinkron terbaru dari semua jenis data (null = belum pernah diimpor) */
  lastSync: string | null;
};

type Raw = {
  period: { from: string; to: string; days: number };
  units: { total: number; operating: number; by_status: Record<string, number> };
  pa: number | null;
  mtbf_hours: number | null;
  mttr_hours: number | null;
  breakdown_count: number;
  breakdown_hours: number;
  planned_hours: number;
  ps: { planned: number; on_time: number; overdue: number; accuracy: number | null };
  backlog: { total: number; high: number; medium: number; low: number; avg_age_days: number; oldest_days: number };
  top_breakdown: { unit_id: string; code: string; model: string | null; hours: number; count: number }[];
  sync: Record<string, { synced_at: string; rows: number; filename: string | null }>;
};

export async function getMntDashboard(supabase: ServerClient, p: Pick<MntParams, "site" | "from" | "to">): Promise<MntDashboard> {
  const { data, error } = await supabase.rpc("mnt_dashboard", { p_location: (p.site ?? null) as string, p_from: p.from, p_to: p.to });
  if (error) throw error;
  const r = data as unknown as Raw;
  const sync = Object.fromEntries(Object.entries(r.sync ?? {}).map(([k, v]) => [k, { syncedAt: v.synced_at, rows: v.rows, filename: v.filename }]));
  const times = Object.values(sync).map((s) => s.syncedAt).sort();
  return {
    period: r.period,
    units: { total: r.units.total, operating: r.units.operating, byStatus: r.units.by_status },
    pa: r.pa === null ? null : Number(r.pa),
    mtbfHours: r.mtbf_hours === null ? null : Number(r.mtbf_hours),
    mttrHours: r.mttr_hours === null ? null : Number(r.mttr_hours),
    breakdownCount: r.breakdown_count,
    breakdownHours: Number(r.breakdown_hours),
    plannedHours: Number(r.planned_hours),
    ps: { planned: r.ps.planned, onTime: r.ps.on_time, overdue: r.ps.overdue, accuracy: r.ps.accuracy === null ? null : Number(r.ps.accuracy) },
    backlog: { total: r.backlog.total, high: r.backlog.high, medium: r.backlog.medium, low: r.backlog.low, avgAgeDays: Number(r.backlog.avg_age_days), oldestDays: r.backlog.oldest_days },
    topBreakdown: (r.top_breakdown ?? []).map((t) => ({ unitId: t.unit_id, code: t.code, model: t.model, hours: Number(t.hours), count: t.count })),
    sync,
    lastSync: times.at(-1) ?? null,
  };
}

// ---------------------------------------------------------------- LIB + Scrap (RPC mnt_extra, SATU sumber dengan Laporan Periode)
export type MntExtra = {
  lib: {
    total: number;
    withMin: number;
    ready: number;
    belowMin: number;
    nonMoving: number;
    nonMovingDays: number;
    readinessPct: number | null;
    topNonMoving: { code: string; name: string; qty: number; uom: string | null; lastMovedOn: string | null; days: number | null }[];
    syncedAt: string | null;
  };
  scrap: { actualKg: number | null; forecastKg: number | null; nextForecastKg: number | null; achievementPct: number | null; byMetal: { metal: string; actualKg: number | null; forecastKg: number | null }[]; syncedAt: string | null };
};
type RawExtra = {
  lib: {
    total: number; with_min: number; ready: number; below_min: number; non_moving: number; non_moving_days: number; readiness_pct: number | null; synced_at: string | null;
    top_non_moving: { code: string; name: string; qty: number; uom: string | null; last_moved_on: string | null; days: number | null }[];
  };
  scrap: { actual_kg: number | null; forecast_kg: number | null; next_forecast_kg: number | null; achievement_pct: number | null; by_metal: { metal: string; actual_kg: number | null; forecast_kg: number | null }[]; synced_at: string | null };
};
const numOrNull = (v: number | string | null | undefined) => (v === null || v === undefined ? null : Number(v));

export async function getMntExtra(supabase: ServerClient, p: Pick<MntParams, "site" | "from" | "to">): Promise<MntExtra> {
  const { data, error } = await supabase.rpc("mnt_extra", { p_location: (p.site ?? null) as string, p_from: p.from, p_to: p.to, p_company: null as unknown as string });
  if (error) throw error;
  const r = data as unknown as RawExtra;
  return {
    lib: {
      total: r.lib.total, withMin: r.lib.with_min, ready: r.lib.ready, belowMin: r.lib.below_min, nonMoving: r.lib.non_moving, nonMovingDays: r.lib.non_moving_days,
      readinessPct: numOrNull(r.lib.readiness_pct), syncedAt: r.lib.synced_at,
      topNonMoving: (r.lib.top_non_moving ?? []).map((t) => ({ code: t.code, name: t.name, qty: Number(t.qty), uom: t.uom, lastMovedOn: t.last_moved_on, days: t.days })),
    },
    scrap: {
      actualKg: numOrNull(r.scrap.actual_kg), forecastKg: numOrNull(r.scrap.forecast_kg), nextForecastKg: numOrNull(r.scrap.next_forecast_kg), achievementPct: numOrNull(r.scrap.achievement_pct),
      byMetal: (r.scrap.by_metal ?? []).map((m) => ({ metal: m.metal, actualKg: numOrNull(m.actual_kg), forecastKg: numOrNull(m.forecast_kg) })), syncedAt: r.scrap.synced_at,
    },
  };
}

export type MntLibRow = { id: string; code: string; name: string; uom: string | null; qty: number; minQty: number; lastMovedOn: string | null; idleDays: number | null; state: LibState };
export async function listMntLib(supabase: ServerClient, p: Pick<MntParams, "site" | "q">): Promise<MntLibRow[]> {
  const today = todayWibIso();
  let q = supabase.from("mnt_lib").select("id, part_code, name, uom, qty, min_qty, last_moved_on").order("part_code").limit(2000);
  if (p.site) q = q.eq("location_id", p.site);
  const { data, error } = await q;
  if (error) throw error;
  const needle = p.q.toLowerCase();
  const rank: Record<LibState, number> = { non_moving: 0, below_min: 1, ok: 2 };
  return (data ?? [])
    .map((r) => {
      const row = { qty: Number(r.qty), minQty: Number(r.min_qty), lastMovedOn: r.last_moved_on };
      return { id: r.id, code: r.part_code, name: r.name, uom: r.uom, ...row, idleDays: r.last_moved_on ? daysBetween(r.last_moved_on, today) : null, state: libState(row, today) };
    })
    .filter((r) => !needle || `${r.code} ${r.name}`.toLowerCase().includes(needle))
    .sort((a, b) => rank[a.state] - rank[b.state] || (b.idleDays ?? 99999) - (a.idleDays ?? 99999));
}

export type MntScrapRow = { id: string; month: string; metal: string; actualKg: number | null; forecastKg: number | null };
export async function listMntScrap(supabase: ServerClient, p: Pick<MntParams, "site" | "q"> & { year: number }): Promise<MntScrapRow[]> {
  let q = supabase.from("mnt_scrap").select("id, month, metal, actual_kg, forecast_kg").gte("month", `${p.year}-01-01`).lte("month", `${p.year}-12-01`).order("month", { ascending: false }).order("metal").limit(1000);
  if (p.site) q = q.eq("location_id", p.site);
  const { data, error } = await q;
  if (error) throw error;
  const needle = p.q.toLowerCase();
  return (data ?? []).map((r) => ({ id: r.id, month: r.month, metal: r.metal, actualKg: numOrNull(r.actual_kg), forecastKg: numOrNull(r.forecast_kg) })).filter((r) => !needle || r.metal.toLowerCase().includes(needle));
}

// ---------------------------------------------------------------- tabel (baca saja)
export type MntUnitRow = { id: string; code: string; model: string | null; status: string; siteId: string; breakdownHours: number; openBacklog: number };

export async function listMntUnits(supabase: ServerClient, p: Pick<MntParams, "site" | "from" | "to" | "q">): Promise<MntUnitRow[]> {
  let q = supabase.from("mnt_units").select("id, code, model, status, location_id").order("code");
  if (p.site) q = q.eq("location_id", p.site);
  const [{ data, error }, dt, bl] = await Promise.all([
    q.limit(1000),
    supabase.from("mnt_downtime").select("unit_id, hours").eq("kind", "breakdown").gte("event_date", p.from).lte("event_date", p.to).limit(20000),
    supabase.from("mnt_backlog").select("unit_id").eq("status", "open").limit(20000),
  ]);
  if (error) throw error;
  const hours = new Map<string, number>();
  for (const d of dt.data ?? []) hours.set(d.unit_id, (hours.get(d.unit_id) ?? 0) + Number(d.hours));
  const open = new Map<string, number>();
  for (const b of bl.data ?? []) open.set(b.unit_id, (open.get(b.unit_id) ?? 0) + 1);
  const needle = p.q.toLowerCase();
  return (data ?? [])
    .filter((u) => !needle || `${u.code} ${u.model ?? ""}`.toLowerCase().includes(needle))
    .map((u) => ({ id: u.id, code: u.code, model: u.model, status: u.status, siteId: u.location_id, breakdownHours: hours.get(u.id) ?? 0, openBacklog: open.get(u.id) ?? 0 }));
}

async function unitIndex(supabase: ServerClient, site: SiteChoice) {
  let q = supabase.from("mnt_units").select("id, code, model");
  if (site) q = q.eq("location_id", site);
  const { data } = await q.limit(1000);
  return new Map((data ?? []).map((u) => [u.id, u]));
}

export type MntDowntimeRow = { id: string; unit: string; model: string | null; date: string; hours: number; kind: string; note: string | null };
export async function listMntDowntime(supabase: ServerClient, p: Pick<MntParams, "site" | "from" | "to" | "q">): Promise<MntDowntimeRow[]> {
  const units = await unitIndex(supabase, p.site);
  const { data, error } = await supabase.from("mnt_downtime").select("id, unit_id, event_date, hours, kind, note").gte("event_date", p.from).lte("event_date", p.to).order("event_date", { ascending: false }).limit(1000);
  if (error) throw error;
  const needle = p.q.toLowerCase();
  return (data ?? [])
    .filter((d) => units.has(d.unit_id))
    .map((d) => ({ id: d.id, unit: units.get(d.unit_id)!.code, model: units.get(d.unit_id)!.model, date: d.event_date, hours: Number(d.hours), kind: d.kind, note: d.note }))
    .filter((d) => !needle || `${d.unit} ${d.model ?? ""} ${d.note ?? ""}`.toLowerCase().includes(needle));
}

export type MntPsRow = { id: string; unit: string; model: string | null; name: string; plannedOn: string; doneOn: string | null; state: "on_time" | "late" | "overdue" | "upcoming" };
export async function listMntPs(supabase: ServerClient, p: Pick<MntParams, "site" | "from" | "to" | "q">): Promise<MntPsRow[]> {
  const today = todayWibIso();
  const units = await unitIndex(supabase, p.site);
  const { data, error } = await supabase.from("mnt_ps").select("id, unit_id, name, planned_on, done_on").gte("planned_on", p.from).lte("planned_on", p.to).order("planned_on", { ascending: false }).limit(1000);
  if (error) throw error;
  const needle = p.q.toLowerCase();
  return (data ?? [])
    .filter((s) => units.has(s.unit_id))
    .map((s) => ({
      id: s.id,
      unit: units.get(s.unit_id)!.code,
      model: units.get(s.unit_id)!.model,
      name: s.name,
      plannedOn: s.planned_on,
      doneOn: s.done_on,
      // toleransi 2 hari (cermin mnt_dashboard)
      state: (s.done_on ? (daysBetween(s.planned_on, s.done_on) <= 2 ? "on_time" : "late") : s.planned_on < today ? "overdue" : "upcoming") as MntPsRow["state"],
    }))
    .filter((s) => !needle || `${s.unit} ${s.name}`.toLowerCase().includes(needle));
}

export type MntBacklogRow = { id: string; unit: string; model: string | null; title: string; priority: string; status: string; openedOn: string; closedOn: string | null; ageDays: number | null };
export async function listMntBacklog(supabase: ServerClient, p: Pick<MntParams, "site" | "q"> & { onlyOpen: boolean }): Promise<MntBacklogRow[]> {
  const today = todayWibIso();
  const units = await unitIndex(supabase, p.site);
  let q = supabase.from("mnt_backlog").select("id, unit_id, title, priority, status, opened_on, closed_on").order("opened_on").limit(1000);
  if (p.onlyOpen) q = q.eq("status", "open");
  const { data, error } = await q;
  if (error) throw error;
  const needle = p.q.toLowerCase();
  const order = { high: 0, medium: 1, low: 2 } as Record<string, number>;
  return (data ?? [])
    .filter((b) => units.has(b.unit_id))
    .map((b) => ({ id: b.id, unit: units.get(b.unit_id)!.code, model: units.get(b.unit_id)!.model, title: b.title, priority: b.priority, status: b.status, openedOn: b.opened_on, closedOn: b.closed_on, ageDays: b.status === "open" ? daysBetween(b.opened_on, today) : null }))
    .filter((b) => !needle || `${b.unit} ${b.title}`.toLowerCase().includes(needle))
    .sort((a, b) => (a.status === b.status ? order[a.priority] - order[b.priority] || (b.ageDays ?? 0) - (a.ageDays ?? 0) : a.status === "open" ? -1 : 1));
}

/** Unit untuk saran kode di form (datalist): kode + model, site tertentu bila ada. */
export async function listUnitSuggestions(supabase: ServerClient, site: string | null): Promise<{ code: string; label: string }[]> {
  let q = supabase.from("mnt_units").select("code, model").neq("status", "retired").order("code");
  if (site) q = q.eq("location_id", site);
  const { data } = await q.limit(500);
  return (data ?? []).map((u) => ({ code: u.code, label: u.model ?? "" }));
}
