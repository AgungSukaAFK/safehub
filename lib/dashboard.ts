// Data Beranda (frontend-guide §17). Periode & perusahaan dari URL (`bulan=2026-11&minggu=2&perusahaan=GMI`).
// Angka ringkasan dari SATU RPC dashboard_summary; tren, distribusi, dan feed masing-masing RPC sendiri
// supaya tiap blok bisa di-stream di <Suspense>. Semua security invoker → RLS + scope company berlaku.
// Drill-down stat card memakai loader list Pengajuan (filter sama dengan link "Buka di daftar").
import "server-only";
import type { ServerClient } from "@/lib/supabase/server";
import { getPeople } from "@/lib/people";
import type { SearchParams } from "@/lib/search-params";
import { todayWib } from "@/lib/format";
import type { DashboardPeriod, FeedItem, StatKey, Summary } from "@/lib/dashboard-types";

export { pengajuanListHref, type DashboardPeriod, type FeedItem, type StatKey, type Summary } from "@/lib/dashboard-types";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const pad = (n: number) => String(n).padStart(2, "0");
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/**
 * Periode dashboard. `companies` = perusahaan yang boleh dipilih (kosong = user hanya melihat satu
 * perusahaan, pemilih disembunyikan).
 */
export function parseDashboardParams(sp: SearchParams, companies: string[]): DashboardPeriod {
  const today = todayWib();
  const [ty, tm] = today.split("-").map(Number);
  const raw = first(sp.bulan);
  let y = ty;
  let m = tm;
  if (raw && /^\d{4}-\d{2}$/.test(raw)) {
    const [ry, rm] = raw.split("-").map(Number);
    if (ry >= 2000 && ry <= 2100 && rm >= 1 && rm <= 12) [y, m] = [ry, rm];
  }
  const days = lastDay(y, m);
  const weeks = Math.ceil(days / 7);
  const w = Number(first(sp.minggu));
  const week = Number.isInteger(w) && w >= 1 && w <= weeks ? w : null;
  const fromDay = week ? (week - 1) * 7 + 1 : 1;
  const toDay = week ? Math.min(week * 7, days) : days;
  const pc = first(sp.perusahaan);
  return {
    month: `${y}-${pad(m)}`,
    week,
    weeks,
    company: pc && companies.includes(pc) ? pc : null,
    from: `${y}-${pad(m)}-${pad(fromDay)}`,
    to: `${y}-${pad(m)}-${pad(toDay)}`,
    isCurrentMonth: y === ty && m === tm,
  };
}

export async function getSummary(supabase: ServerClient, p: DashboardPeriod): Promise<Summary> {
  const { data, error } = await supabase.rpc("dashboard_summary", { p_from: p.from, p_to: p.to, p_company: p.company ?? undefined });
  if (error) throw error;
  const d = (data ?? {}) as Record<string, number> & { prev?: Record<string, number> };
  const num = (v: unknown) => Number(v ?? 0);
  const cur: Record<StatKey, number> = {
    total: num(d.total),
    pending: num(d.pending),
    approved: num(d.approved),
    rejected: num(d.rejected),
    amount_approved: num(d.amount_approved),
  };
  const prev: Record<StatKey, number> = {
    total: num(d.prev?.total),
    pending: num(d.prev?.pending),
    approved: num(d.prev?.approved),
    rejected: num(d.prev?.rejected),
    amount_approved: num(d.prev?.amount_approved),
  };
  return { cur, prev, draft: num(d.draft), allPending: num(d.all_pending) };
}

export type DailyPoint = { day: string; created: number; approved: number };

export async function getDaily(supabase: ServerClient, p: DashboardPeriod): Promise<DailyPoint[]> {
  const { data, error } = await supabase.rpc("dashboard_daily", { p_from: p.from, p_to: p.to, p_company: p.company ?? undefined });
  if (error) throw error;
  return (data ?? []).map((r) => ({ day: r.day, created: r.created, approved: r.approved }));
}

export type DepartmentPoint = { id: string | null; name: string; total: number; amount: number };

export async function getByDepartment(supabase: ServerClient, p: DashboardPeriod): Promise<DepartmentPoint[]> {
  const { data, error } = await supabase.rpc("dashboard_by_department", { p_from: p.from, p_to: p.to, p_company: p.company ?? undefined });
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.department_id, name: r.department, total: r.total, amount: Number(r.amount) }));
}

/** Feed aktivitas (gabungan <entitas>_logs lewat RPC activity_feed). `before` = kursor muat lebih banyak. */
export async function getActivityFeed(supabase: ServerClient, limit = 15, before?: string): Promise<FeedItem[]> {
  const { data, error } = await supabase.rpc("activity_feed", { p_limit: limit, p_before: before });
  if (error) throw error;
  const rows = data ?? [];
  const people = await getPeople(supabase, rows.map((r) => r.actor_id));
  return rows.map((r) => {
    const a = r.actor_id ? people.get(r.actor_id) : null;
    return {
      id: r.id,
      entity: r.entity,
      at: r.at,
      action: r.action,
      note: r.note,
      label: r.label,
      href: r.href,
      actor: a ? { id: a.id, name: a.name, avatarUrl: a.avatarUrl } : null,
    };
  });
}

/** Post Pembaruan ≤ 7 hari yang belum dilihat user (banner Beranda), atau null. */
export async function getUnseenUpdate(supabase: ServerClient, userId: string) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [latest, seen] = await Promise.all([
    supabase.from("updates").select("id, version, title").gte("created_at", sevenDaysAgo).order("id", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("update_seen").select("last_seen_id").eq("user_id", userId).maybeSingle(),
  ]);
  const u = latest.data;
  return u && u.id > (seen.data?.last_seen_id ?? 0) ? u : null;
}
