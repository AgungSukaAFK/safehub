// Maintenance (fase 5, HANYA BACA): loader untuk /maintenance dan blok Beranda. Angka dashboard = RPC mnt_dashboard (SATU sumber).
// Data cermin diisi lewat Impor Data; tidak ada tulis di sini.
import "server-only";
import { daysBetween } from "@/lib/expiry";
import { todayWibIso } from "@/lib/k3";
import { MNT_TABS, type MntTab } from "@/lib/maintenance-rules";
import { enumParam, textParam, type SearchParams } from "@/lib/search-params";
import type { SiteChoice } from "@/lib/site-types";
import type { ServerClient } from "@/lib/supabase/server";

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
