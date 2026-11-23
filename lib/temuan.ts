// Temuan & PICA: loader SATU sumber untuk tabel, kanban, ekspor, ringkasan, dan detail. Hak baca RLS.
import "server-only";
import type { FilterChip } from "@/components/list/filter-panel";
import { BUCKET_LAMPIRAN } from "@/lib/app-config";
import type { ExcelColumn } from "@/lib/excel";
import { formatRange } from "@/lib/format";
import { getK3Masters, labelOf, todayWibIso, type AreaOption, type K3Masters } from "@/lib/k3";
import type { StoredFile } from "@/lib/kejadian";
import { labelsOf, type Option } from "@/lib/masters";
import { actionProgress, listActions, type PicaAction } from "@/lib/pica";
import { getPeople } from "@/lib/people";
import type { Person } from "@/lib/person-types";
import { dateParam, enumParam, listParam, pageParam, pageSizeParam, sortParam, textParam, wibDayEnd, wibDayStart, type SearchParams } from "@/lib/search-params";
import type { SiteChoice } from "@/lib/site-types";
import type { ServerClient } from "@/lib/supabase/server";
import { FINDING_SORTS, FINDING_STATUS, FINDING_STATUSES, FINDING_VIEWS, SOURCE_KIND_LABEL, SOURCE_KINDS, type FindingStatus, type FindingView } from "@/lib/temuan-rules";
import { escapeLike, isUuid, searchTerms } from "@/lib/utils";

export const MAX_EXPORT_ROWS = 50_000;
const BATCH = 1000;
const SOURCE_VALUES = SOURCE_KINDS.map((s) => s.value);

export type TemuanFilters = {
  q: string;
  view: FindingView;
  mode: "tabel" | "kanban";
  status: FindingStatus[];
  sources: string[];
  categories: string[];
  risks: string[];
  pics: string[];
  areas: string[];
  dari: string | null;
  sampai: string | null;
  dueDari: string | null;
  dueSampai: string | null;
  site: SiteChoice;
  sort: ReturnType<typeof sortParam<(typeof FINDING_SORTS)[number]>>;
  page: number;
  size: number;
};

const codeList = (sp: SearchParams, key: string) =>
  listParam(sp, key)
    .filter((c) => /^[a-z][a-z0-9_]{1,40}$/.test(c))
    .slice(0, 30);

export function parseTemuanParams(sp: SearchParams, site: SiteChoice): TemuanFilters {
  return {
    q: textParam(sp, "q"),
    view: enumParam(sp, "tampilan", FINDING_VIEWS, "semua"),
    mode: sp.mode === "kanban" ? "kanban" : "tabel",
    status: listParam(sp, "status", FINDING_STATUSES),
    sources: listParam(sp, "sumber", SOURCE_VALUES),
    categories: codeList(sp, "kategori"),
    risks: codeList(sp, "prioritas"),
    pics: listParam(sp, "pic").filter(isUuid).slice(0, 50),
    areas: listParam(sp, "area").filter(isUuid).slice(0, 50),
    dari: dateParam(sp, "dari"),
    sampai: dateParam(sp, "sampai"),
    dueDari: dateParam(sp, "due_dari"),
    dueSampai: dateParam(sp, "due_sampai"),
    site,
    sort: sortParam(sp, FINDING_SORTS, { key: "ditemukan", dir: "desc" }),
    page: pageParam(sp),
    size: pageSizeParam(sp),
  };
}

type ChipOpts = { categories: Option[]; risks: Option[]; areas: Option[]; people: Option[] };

export function temuanChips(f: TemuanFilters, o: ChipOpts): FilterChip[] {
  const chips: FilterChip[] = [];
  if (f.status.length) chips.push({ key: "status", label: "Status", value: f.status.map((s) => FINDING_STATUS[s].label).join(", "), params: ["status"] });
  if (f.sources.length) chips.push({ key: "sumber", label: "Sumber", value: f.sources.map((s) => SOURCE_KIND_LABEL[s]).join(", "), params: ["sumber"] });
  if (f.categories.length) chips.push({ key: "kategori", label: "Kategori", value: labelsOf(f.categories, o.categories), params: ["kategori"] });
  if (f.risks.length) chips.push({ key: "prioritas", label: "Prioritas", value: labelsOf(f.risks, o.risks), params: ["prioritas"] });
  if (f.pics.length) chips.push({ key: "pic", label: "PIC", value: labelsOf(f.pics, o.people), params: ["pic"] });
  if (f.areas.length) chips.push({ key: "area", label: "Lokasi", value: labelsOf(f.areas, o.areas), params: ["area"] });
  if (f.dari || f.sampai) chips.push({ key: "tanggal", label: "Ditemukan", value: formatRange(f.dari, f.sampai), params: ["dari", "sampai"] });
  if (f.dueDari || f.dueSampai) chips.push({ key: "due", label: "Due date", value: formatRange(f.dueDari, f.dueSampai), params: ["due_dari", "due_sampai"] });
  return chips;
}

export function temuanFilterText(f: TemuanFilters, o: ChipOpts, siteLabel: string): string {
  const parts = temuanChips(f, o).map((c) => `${c.label}: ${c.value}`);
  parts.unshift(`Site: ${siteLabel}`);
  if (f.view !== "semua") parts.unshift(`Tampilan: ${f.view}`);
  if (f.q) parts.unshift(`Kata kunci: "${f.q}"`);
  return parts.join("; ");
}

export type TemuanRow = {
  id: string;
  code: string;
  title: string;
  companyCode: string;
  sourceKind: string;
  sourceRef: string | null;
  sourceHref: string | null;
  areaName: string;
  category: string;
  categoryLabel: string;
  riskLevel: string;
  riskLabel: string;
  foundAt: string;
  dueDate: string;
  closedAt: string | null;
  status: string;
  overdue: boolean;
  /** hari terlambat (0 bila belum lewat / closed), dihitung server (WIB) */
  lateDays: number;
  /** umur sejak ditemukan, berhenti saat ditutup */
  ageDays: number;
  actions: { closed: number; total: number };
  pic: Pick<Person, "id" | "name" | "avatarUrl"> | null;
};

const SORT_COLUMN: Record<(typeof FINDING_SORTS)[number], string> = {
  nomor: "code",
  ditemukan: "found_at",
  due: "due_date",
  prioritas: "risk_level",
  status: "status",
};
const LIST_COLUMNS = "id, code, title, company_code, location_id, area_id, source_kind, source_ref, source_id, category, risk_level, found_at, due_date, closed_at, status, pic_id";

type RawRow = {
  id: string;
  code: string;
  title: string;
  company_code: string;
  location_id: string;
  area_id: string;
  source_kind: string;
  source_ref: string | null;
  source_id: string | null;
  category: string;
  risk_level: string;
  found_at: string;
  due_date: string;
  closed_at: string | null;
  status: string;
  pic_id: string;
};

// Builder Supabase generik (metode filter bersama); tipe Function di sini sengaja longgar
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
function applyFilters<Q extends { ilike: Function; in: Function; eq: Function; gte: Function; lte: Function; lt: Function; neq: Function }>(
  q: Q,
  f: TemuanFilters,
  userId: string,
  { ignoreView = false, ignoreStatus = false } = {},
): Q {
  let x = q;
  for (const w of searchTerms(f.q)) x = x.ilike("search_text", `%${escapeLike(w)}%`);
  if (f.site) x = x.eq("location_id", f.site);
  if (!ignoreView) {
    const today = todayWibIso();
    if (f.view === "saya") x = x.eq("pic_id", userId);
    if (f.view === "overdue") x = x.neq("status", "closed").lt("due_date", today);
    if (f.view === "verifikasi") x = x.eq("status", "waiting_verification");
    if (f.view === "closed") x = x.eq("status", "closed");
  }
  if (!ignoreStatus && f.status.length) x = x.in("status", f.status);
  if (f.sources.length) x = x.in("source_kind", f.sources);
  if (f.categories.length) x = x.in("category", f.categories);
  if (f.risks.length) x = x.in("risk_level", f.risks);
  if (f.pics.length) x = x.in("pic_id", f.pics);
  if (f.areas.length) x = x.in("area_id", f.areas);
  if (f.dari) x = x.gte("found_at", wibDayStart(f.dari));
  if (f.sampai) x = x.lte("found_at", wibDayEnd(f.sampai));
  if (f.dueDari) x = x.gte("due_date", f.dueDari);
  if (f.dueSampai) x = x.lte("due_date", f.dueSampai);
  return x;
}

function baseQuery(supabase: ServerClient, f: TemuanFilters, userId: string, count: boolean) {
  const q = applyFilters(supabase.from("findings").select(LIST_COLUMNS, count ? { count: "exact" } : undefined), f, userId);
  return q.order(SORT_COLUMN[f.sort.key], { ascending: f.sort.dir === "asc", nullsFirst: false }).order("id", { ascending: true });
}

async function hydrate(supabase: ServerClient, raw: RawRow[], masters: K3Masters, areas: AreaOption[]): Promise<TemuanRow[]> {
  const today = todayWibIso();
  const [people, progress, sources] = await Promise.all([
    getPeople(
      supabase,
      raw.map((r) => r.pic_id),
    ),
    actionProgress(
      supabase,
      "finding_id",
      raw.map((r) => r.id),
    ),
    (async () => {
      const ids = [...new Set(raw.map((r) => r.source_id).filter((x): x is string => !!x))];
      if (!ids.length) return new Map<string, string>();
      const { data } = await supabase.from("incidents").select("id, code").in("id", ids);
      return new Map((data ?? []).map((i) => [i.id, i.code]));
    })(),
  ]);
  return raw.map((r) => {
    const p = people.get(r.pic_id);
    return {
      id: r.id,
      code: r.code,
      title: r.title,
      companyCode: r.company_code,
      sourceKind: r.source_kind,
      sourceRef: r.source_id ? (sources.get(r.source_id) ?? r.source_ref) : r.source_ref,
      sourceHref: r.source_id && sources.has(r.source_id) ? `/kejadian/${r.source_id}` : null,
      areaName: areas.find((a) => a.value === r.area_id)?.label ?? "-",
      category: r.category,
      categoryLabel: labelOf(masters.findingCategories, r.category) ?? r.category,
      riskLevel: r.risk_level,
      riskLabel: labelOf(masters.riskLevels, r.risk_level) ?? r.risk_level,
      foundAt: r.found_at,
      dueDate: r.due_date,
      closedAt: r.closed_at,
      status: r.status,
      overdue: r.status !== "closed" && r.due_date < today,
      lateDays: r.status !== "closed" && r.due_date < today ? Math.round((Date.parse(today) - Date.parse(r.due_date)) / 86_400_000) : 0,
      ageDays: Math.max(0, Math.floor(((r.closed_at ? Date.parse(r.closed_at) : Date.now()) - Date.parse(r.found_at)) / 86_400_000)),
      actions: progress.get(r.id) ?? { closed: 0, total: 0 },
      pic: p ? { id: p.id, name: p.name, avatarUrl: p.avatarUrl } : null,
    };
  });
}

export class TooManyRowsError extends Error {}

export async function listTemuan(supabase: ServerClient, f: TemuanFilters, userId: string, areas: AreaOption[], opts: { all?: boolean } = {}) {
  const masters = await getK3Masters(supabase);
  if (opts.all) {
    const raw: RawRow[] = [];
    for (let from = 0; ; from += BATCH) {
      const { data, error } = await baseQuery(supabase, f, userId, false).range(from, from + BATCH - 1);
      if (error) throw error;
      raw.push(...((data ?? []) as RawRow[]));
      if (raw.length > MAX_EXPORT_ROWS) throw new TooManyRowsError("Terlalu banyak data, persempit filter dulu.");
      if (!data || data.length < BATCH) break;
    }
    return { rows: await hydrate(supabase, raw, masters, areas), total: raw.length };
  }
  const from = (f.page - 1) * f.size;
  const { data, error, count } = await baseQuery(supabase, f, userId, true).range(from, from + f.size - 1);
  if (error) throw error;
  return { rows: await hydrate(supabase, (data ?? []) as RawRow[], masters, areas), total: count ?? 0 };
}

/** Kanban: maks. 30 kartu terbaru per kolom status, filter sama dengan tabel. */
export async function listTemuanKanban(supabase: ServerClient, f: TemuanFilters, userId: string, areas: AreaOption[]) {
  const masters = await getK3Masters(supabase);
  const cols = await Promise.all(
    FINDING_STATUSES.map(async (s) => {
      const q = applyFilters(supabase.from("findings").select(LIST_COLUMNS, { count: "exact" }), f, userId, { ignoreStatus: true }).eq("status", s);
      const { data, count, error } = await q.order("due_date").order("id").limit(30);
      if (error) throw error;
      return { status: s, total: count ?? 0, rows: await hydrate(supabase, (data ?? []) as RawRow[], masters, areas) };
    }),
  );
  return cols;
}

export async function countTemuanViews(supabase: ServerClient, f: TemuanFilters, userId: string): Promise<Record<FindingView, number>> {
  const counts = await Promise.all(
    FINDING_VIEWS.map((v) => applyFilters(supabase.from("findings").select("id", { count: "exact", head: true }), { ...f, view: v }, userId, { ignoreStatus: false })),
  );
  return Object.fromEntries(FINDING_VIEWS.map((v, i) => [v, counts[i].count ?? 0])) as Record<FindingView, number>;
}

export async function countTemuan(supabase: ServerClient) {
  const { count } = await supabase.from("findings").select("id", { count: "exact", head: true });
  return count ?? 0;
}

export type TemuanStats = {
  open: number;
  in_progress: number;
  waiting_verification: number;
  overdue: number;
  closed_this_month: number;
  avg_age_days: number | null;
  by_source: Record<string, number>;
  overdue_by_pic: { pic_id: string; name: string; n: number }[];
  trend: { month: string; opened: number; closed: number }[];
};

/** Strip angka + widget /temuan (site + company sama dengan list, ikut RLS). */
export async function getTemuanStats(supabase: ServerClient, site: SiteChoice): Promise<TemuanStats> {
  const { data, error } = await supabase.rpc("finding_stats", { p_location: site ?? undefined });
  if (error) throw error;
  return data as unknown as TemuanStats;
}

export const TEMUAN_EXPORT_COLUMNS: ExcelColumn<TemuanRow>[] = [
  { header: "Nomor", value: (r) => r.code },
  { header: "Temuan", value: (r) => r.title },
  { header: "Sumber", value: (r) => SOURCE_KIND_LABEL[r.sourceKind] ?? r.sourceKind },
  { header: "Referensi", value: (r) => r.sourceRef },
  { header: "Lokasi", value: (r) => r.areaName },
  { header: "Kategori", value: (r) => r.categoryLabel },
  { header: "Prioritas", value: (r) => r.riskLabel },
  { header: "PIC", value: (r) => r.pic?.name ?? null },
  { header: "Ditemukan", type: "datetime", value: (r) => r.foundAt },
  { header: "Due Date", type: "date", value: (r) => r.dueDate },
  { header: "Status", value: (r) => FINDING_STATUS[r.overdue ? "overdue" : r.status]?.label ?? r.status },
  { header: "Tindakan Closed", type: "number", value: (r) => r.actions.closed },
  { header: "Tindakan Total", type: "number", value: (r) => r.actions.total },
  { header: "Perusahaan", value: (r) => r.companyCode },
];

// ---------------------------------------------------------------- detail
export type TemuanDetail = {
  id: string;
  code: string;
  companyCode: string;
  siteId: string;
  siteName: string;
  areaId: string;
  areaName: string;
  locationDetail: string | null;
  foundAt: string;
  title: string;
  description: string;
  sourceKind: string;
  sourceRef: string | null;
  sourceId: string | null;
  sourceHref: string | null;
  category: string;
  riskLevel: string;
  likelihood: number | null;
  consequence: number | null;
  rootCauses: { factor: string; text: string }[];
  dueDate: string;
  status: string;
  /** hari terlambat (0 bila belum lewat / closed) */
  lateDays: number;
  closedAt: string | null;
  closeNote: string | null;
  closedBy: Person | null;
  createdAt: string;
  updatedAt: string;
  createdById: string | null;
  reporter: Person | null;
  pic: Person | null;
  actions: PicaAction[];
  files: StoredFile[];
};

export async function getTemuanDetail(supabase: ServerClient, id: string): Promise<TemuanDetail | null> {
  const { data: d } = await supabase
    .from("findings")
    .select(
      "id, code, company_code, location_id, area_id, location_detail, found_at, title, description, source_kind, source_ref, source_id, category, risk_level, likelihood, consequence, root_causes, pic_id, due_date, status, closed_at, closed_by, close_note, created_by, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!d) return null;
  const [actions, files, site, area, src] = await Promise.all([
    listActions(supabase, { findingId: id }),
    supabase.storage.from(BUCKET_LAMPIRAN).list(`temuan/${id}`, { limit: 100, sortBy: { column: "created_at", order: "asc" } }),
    supabase.schema("public").from("locations").select("name").eq("id", d.location_id).maybeSingle(),
    supabase.from("areas").select("name").eq("id", d.area_id).maybeSingle(),
    d.source_id ? supabase.from("incidents").select("id, code").eq("id", d.source_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const people = await getPeople(supabase, [d.created_by, d.pic_id, d.closed_by]);
  return {
    id: d.id,
    code: d.code,
    companyCode: d.company_code,
    siteId: d.location_id,
    siteName: site.data?.name ?? "-",
    areaId: d.area_id,
    areaName: area.data?.name ?? "-",
    locationDetail: d.location_detail,
    foundAt: d.found_at,
    title: d.title,
    description: d.description,
    sourceKind: d.source_kind,
    sourceRef: src.data?.code ?? d.source_ref,
    sourceId: d.source_id,
    sourceHref: src.data ? `/kejadian/${src.data.id}` : null,
    category: d.category,
    riskLevel: d.risk_level,
    likelihood: d.likelihood,
    consequence: d.consequence,
    rootCauses: (d.root_causes as { factor: string; text: string }[]) ?? [],
    dueDate: d.due_date,
    status: d.status,
    lateDays: d.status !== "closed" && d.due_date < todayWibIso() ? Math.round((Date.parse(todayWibIso()) - Date.parse(d.due_date)) / 86_400_000) : 0,
    closedAt: d.closed_at,
    closeNote: d.close_note,
    closedBy: d.closed_by ? (people.get(d.closed_by) ?? null) : null,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
    createdById: d.created_by,
    reporter: d.created_by ? (people.get(d.created_by) ?? null) : null,
    pic: people.get(d.pic_id) ?? null,
    actions,
    files: (files.data ?? [])
      .filter((f) => f.id)
      .map((f) => ({
        path: `temuan/${id}/${f.name}`,
        name: f.name.replace(/^\d{10,}-/, ""),
        size: (f.metadata?.size as number | undefined) ?? null,
        type: (f.metadata?.mimetype as string | undefined) ?? null,
        createdAt: f.created_at ?? null,
      })),
  };
}
