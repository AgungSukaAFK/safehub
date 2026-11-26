// Kejadian & Investigasi: loader SATU sumber untuk tabel, ekspor Excel, dan detail. Hak baca dijaga
// RLS (Karyawan = miliknya; data cedera & biaya di tabel terbatas); filter di sini hanya penyaring.
import "server-only";
import type { FilterChip } from "@/components/list/filter-panel";
import { BUCKET_LAMPIRAN } from "@/lib/app-config";
import type { ExcelColumn } from "@/lib/excel";
import { formatRange } from "@/lib/format";
import { getK3Masters, labelOf, type AreaOption, type K3Masters } from "@/lib/k3";
import {
  CAUSE_GROUPS,
  INCIDENT_SORTS,
  INCIDENT_STATUS,
  INCIDENT_STATUSES,
  INCIDENT_VIEW_STATUSES,
  INCIDENT_VIEWS,
  INJURY_CLASS_LABEL,
  incidentAgeDays,
  type CauseKey,
  type IncidentStatus,
  type IncidentView,
} from "@/lib/kejadian-rules";
import { labelsOf, type Option } from "@/lib/masters";
import { actionProgress, listActions, type PicaAction } from "@/lib/pica";
import { getPeople } from "@/lib/people";
import type { Person } from "@/lib/person-types";
import { dateParam, enumParam, listParam, pageParam, pageSizeParam, sortParam, textParam, wibDayEnd, wibDayStart, type SearchParams } from "@/lib/search-params";
import type { SiteChoice } from "@/lib/site-types";
import type { ServerClient } from "@/lib/supabase/server";
import { escapeLike, isUuid, searchTerms } from "@/lib/utils";

export const MAX_EXPORT_ROWS = 50_000;
const BATCH = 1000;

// ---------------------------------------------------------------- list
export type KejadianFilters = {
  q: string;
  view: IncidentView;
  status: IncidentStatus[];
  categories: string[];
  areas: string[];
  reporters: string[];
  dari: string | null;
  sampai: string | null;
  site: SiteChoice;
  sort: ReturnType<typeof sortParam<(typeof INCIDENT_SORTS)[number]>>;
  page: number;
  size: number;
};

export function parseKejadianParams(sp: SearchParams, site: SiteChoice): KejadianFilters {
  return {
    q: textParam(sp, "q"),
    view: enumParam(sp, "tampilan", INCIDENT_VIEWS, "semua"),
    status: listParam(sp, "status", INCIDENT_STATUSES),
    categories: listParam(sp, "kategori").filter((c) => /^[a-z][a-z0-9_]{1,40}$/.test(c)).slice(0, 30),
    areas: listParam(sp, "area").filter(isUuid).slice(0, 50),
    reporters: listParam(sp, "pelapor").filter(isUuid).slice(0, 50),
    dari: dateParam(sp, "dari"),
    sampai: dateParam(sp, "sampai"),
    site,
    sort: sortParam(sp, INCIDENT_SORTS, { key: "lapor", dir: "desc" }),
    page: pageParam(sp),
    size: pageSizeParam(sp),
  };
}

export function kejadianChips(f: KejadianFilters, opts: { categories: Option[]; areas: Option[]; people: Option[] }): FilterChip[] {
  const chips: FilterChip[] = [];
  if (f.status.length) chips.push({ key: "status", label: "Status", value: f.status.map((s) => INCIDENT_STATUS[s].label).join(", "), params: ["status"] });
  if (f.categories.length) chips.push({ key: "kategori", label: "Kategori", value: labelsOf(f.categories, opts.categories), params: ["kategori"] });
  if (f.areas.length) chips.push({ key: "area", label: "Lokasi", value: labelsOf(f.areas, opts.areas), params: ["area"] });
  if (f.reporters.length) chips.push({ key: "pelapor", label: "Pelapor", value: labelsOf(f.reporters, opts.people), params: ["pelapor"] });
  if (f.dari || f.sampai) chips.push({ key: "tanggal", label: "Tanggal kejadian", value: formatRange(f.dari, f.sampai), params: ["dari", "sampai"] });
  return chips;
}

export function kejadianFilterText(f: KejadianFilters, opts: Parameters<typeof kejadianChips>[1], siteLabel: string): string {
  const parts = kejadianChips(f, opts).map((c) => `${c.label}: ${c.value}`);
  parts.unshift(`Site: ${siteLabel}`);
  if (f.view !== "semua") parts.unshift(`Tampilan: ${f.view}`);
  if (f.q) parts.unshift(`Kata kunci: "${f.q}"`);
  return parts.join("; ");
}

export type KejadianRow = {
  id: string;
  code: string;
  description: string;
  companyCode: string;
  /** kategori final (HSE) bila ada, selain itu kategori pelapor */
  category: string | null;
  categoryLabel: string;
  classified: boolean;
  injuryClass: string | null;
  occurredAt: string;
  reportedAt: string;
  closedAt: string | null;
  areaName: string;
  unit: string | null;
  status: string;
  isEmergency: boolean;
  returned: boolean;
  /** umur sejak dilaporkan (hari), berhenti saat closed */
  ageDays: number;
  actions: { closed: number; total: number };
  reporter: Pick<Person, "id" | "name" | "avatarUrl"> | null;
};

const SORT_COLUMN: Record<(typeof INCIDENT_SORTS)[number], string> = {
  nomor: "code",
  kejadian: "occurred_at",
  lapor: "reported_at",
  status: "status",
};

const LIST_COLUMNS =
  "id, code, description, company_code, location_id, area_id, category, reported_category, injury_class, occurred_at, reported_at, closed_at, unit_code, unit_label, status, is_emergency, return_note, created_by";

type RawRow = {
  id: string;
  code: string;
  description: string;
  company_code: string;
  location_id: string;
  area_id: string;
  category: string | null;
  reported_category: string;
  injury_class: string | null;
  occurred_at: string;
  reported_at: string;
  closed_at: string | null;
  unit_code: string | null;
  unit_label: string | null;
  status: string;
  is_emergency: boolean;
  return_note: string | null;
  created_by: string | null;
};

/** Filter bersama (tanpa status/tampilan bila `ignoreStatus`, untuk hitungan tab). */
// Builder Supabase generik (metode filter bersama); tipe Function di sini sengaja longgar
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
function applyFilters<Q extends { ilike: Function; in: Function; eq: Function; gte: Function; lte: Function }>(
  q: Q,
  f: KejadianFilters,
  { ignoreStatus = false } = {},
): Q {
  let x = q;
  for (const w of searchTerms(f.q)) x = x.ilike("search_text", `%${escapeLike(w)}%`);
  if (f.site) x = x.eq("location_id", f.site);
  if (!ignoreStatus) {
    const viewStatuses = INCIDENT_VIEW_STATUSES[f.view];
    if (viewStatuses) x = x.in("status", viewStatuses);
    if (f.status.length) x = x.in("status", f.status);
  }
  if (f.categories.length) x = x.in("reported_category", f.categories);
  if (f.areas.length) x = x.in("area_id", f.areas);
  if (f.reporters.length) x = x.in("created_by", f.reporters);
  if (f.dari) x = x.gte("occurred_at", wibDayStart(f.dari));
  if (f.sampai) x = x.lte("occurred_at", wibDayEnd(f.sampai));
  return x;
}

function baseQuery(supabase: ServerClient, f: KejadianFilters, count: boolean) {
  const q = applyFilters(supabase.from("incidents").select(LIST_COLUMNS, count ? { count: "exact" } : undefined), f);
  return q.order(SORT_COLUMN[f.sort.key], { ascending: f.sort.dir === "asc", nullsFirst: false }).order("id", { ascending: true });
}

async function hydrate(supabase: ServerClient, raw: RawRow[], masters: K3Masters, areas: AreaOption[]): Promise<KejadianRow[]> {
  const [people, progress] = await Promise.all([
    getPeople(
      supabase,
      raw.map((r) => r.created_by),
    ),
    actionProgress(
      supabase,
      "incident_id",
      raw.map((r) => r.id),
    ),
  ]);
  return raw.map((r) => {
    const p = r.created_by ? people.get(r.created_by) : null;
    const cat = r.category ?? r.reported_category;
    const catLabel = labelOf(masters.incidentCategories, cat) ?? cat;
    return {
      id: r.id,
      code: r.code,
      description: r.description,
      companyCode: r.company_code,
      category: cat,
      categoryLabel: r.injury_class && r.injury_class !== "none" ? `${catLabel} · ${INJURY_CLASS_LABEL[r.injury_class]}` : catLabel,
      classified: !!r.category,
      injuryClass: r.injury_class,
      occurredAt: r.occurred_at,
      reportedAt: r.reported_at,
      closedAt: r.closed_at,
      areaName: areas.find((a) => a.value === r.area_id)?.label ?? "-",
      unit: [r.unit_code, r.unit_label].filter(Boolean).join(" · ") || null,
      status: r.status,
      isEmergency: r.is_emergency,
      returned: !!r.return_note && r.status === "investigating",
      ageDays: incidentAgeDays(r.reported_at, r.closed_at, new Date()),
      actions: progress.get(r.id) ?? { closed: 0, total: 0 },
      reporter: p ? { id: p.id, name: p.name, avatarUrl: p.avatarUrl } : null,
    };
  });
}

export class TooManyRowsError extends Error {}

export async function listKejadian(supabase: ServerClient, f: KejadianFilters, areas: AreaOption[], opts: { all?: boolean } = {}) {
  const masters = await getK3Masters(supabase);
  if (opts.all) {
    const raw: RawRow[] = [];
    for (let from = 0; ; from += BATCH) {
      const { data, error } = await baseQuery(supabase, f, false).range(from, from + BATCH - 1);
      if (error) throw error;
      raw.push(...((data ?? []) as RawRow[]));
      if (raw.length > MAX_EXPORT_ROWS) throw new TooManyRowsError("Terlalu banyak data, persempit filter dulu.");
      if (!data || data.length < BATCH) break;
    }
    return { rows: await hydrate(supabase, raw, masters, areas), total: raw.length };
  }
  const from = (f.page - 1) * f.size;
  const { data, error, count } = await baseQuery(supabase, f, true).range(from, from + f.size - 1);
  if (error) throw error;
  return { rows: await hydrate(supabase, (data ?? []) as RawRow[], masters, areas), total: count ?? 0 };
}

/** Hitungan per saved view dengan filter yang sama (tab daftar). */
export async function countKejadianViews(supabase: ServerClient, f: KejadianFilters): Promise<Record<IncidentView, number>> {
  const views = INCIDENT_VIEWS.filter((v) => v !== "semua");
  const res = await Promise.all(
    views.map((v) => {
      const q = applyFilters(supabase.from("incidents").select("id", { count: "exact", head: true }), f, { ignoreStatus: true });
      return q.in("status", INCIDENT_VIEW_STATUSES[v]!);
    }),
  );
  const all = await applyFilters(supabase.from("incidents").select("id", { count: "exact", head: true }), f, { ignoreStatus: true });
  return {
    semua: all.count ?? 0,
    ...Object.fromEntries(views.map((v, i) => [v, res[i].count ?? 0])),
  } as Record<IncidentView, number>;
}

export async function countKejadian(supabase: ServerClient) {
  const { count } = await supabase.from("incidents").select("id", { count: "exact", head: true });
  return count ?? 0;
}

export const KEJADIAN_EXPORT_COLUMNS: ExcelColumn<KejadianRow>[] = [
  { header: "Nomor", value: (r) => r.code },
  { header: "Uraian", value: (r) => r.description },
  { header: "Kategori", value: (r) => r.categoryLabel },
  { header: "Diklasifikasi HSE", value: (r) => (r.classified ? "Ya" : "Belum") },
  { header: "Tanggal Kejadian", type: "datetime", value: (r) => r.occurredAt },
  { header: "Tanggal Lapor", type: "datetime", value: (r) => r.reportedAt },
  { header: "Lokasi", value: (r) => r.areaName },
  { header: "Unit", value: (r) => r.unit },
  { header: "Pelapor", value: (r) => r.reporter?.name ?? null },
  { header: "Status", value: (r) => INCIDENT_STATUS[r.status]?.label ?? r.status },
  { header: "Umur (hari)", type: "number", value: (r) => r.ageDays },
  { header: "Tindakan Closed", type: "number", value: (r) => r.actions.closed },
  { header: "Tindakan Total", type: "number", value: (r) => r.actions.total },
  { header: "Darurat", value: (r) => (r.isEmergency ? "Ya" : "Tidak") },
  { header: "Perusahaan", value: (r) => r.companyCode },
];

// ---------------------------------------------------------------- detail
export type StoredFile = { path: string; name: string; size: number | null; type: string | null; createdAt: string | null };

export type IncidentPersonView = {
  id: string;
  role: "involved" | "witness";
  name: string;
  companyKind: string;
  contractorName: string | null;
  employment: string | null;
  position: string | null;
  contact: string | null;
};

export type CloseCheck = { key: string; label: string; ok: boolean };

export type ReviewEntry = {
  stage: "investigation" | "ehs" | "mgmt";
  decision: "submit" | "approve" | "return";
  note: string | null;
  at: string;
  actor: Pick<Person, "id" | "name" | "avatarUrl" | "jobTitle"> | null;
};

export type KejadianDetail = {
  id: string;
  code: string;
  companyCode: string;
  siteId: string;
  siteName: string;
  areaId: string;
  areaName: string;
  locationDetail: string | null;
  occurredAt: string;
  reportedAt: string;
  reportedCategory: string;
  category: string | null;
  injuryClass: string | null;
  severity: string | null;
  potentialSeverity: string | null;
  unitCode: string | null;
  unitLabel: string | null;
  description: string;
  isEmergency: boolean;
  ppe: Record<string, boolean>;
  damageDescription: string | null;
  /** kolom formulir Laporan Investigasi (26) */
  shift: string | null;
  overtime: boolean | null;
  activity: string | null;
  occupational: string | null;
  /** korban tertaut Manpower (No. karyawan, jabatan, tgl masuk) */
  victim: { id: string; code: string; name: string; jobTitle: string; department: string | null; joinDate: string | null } | null;
  status: IncidentStatus;
  returnNote: string | null;
  returnedAt: string | null;
  classifiedAt: string | null;
  closedAt: string | null;
  closeNote: string | null;
  closedException: boolean;
  updatedAt: string;
  reporter: Person | null;
  supervisor: Person | null;
  classifiedBy: Person | null;
  persons: IncidentPersonView[];
  /** null = user tidak berhak (RestrictedData) */
  restricted: {
    injuryType: string | null;
    bodyParts: string[];
    treatment: string | null;
    facility: string | null;
    lostDays: number | null;
    restrictedDays: number | null;
    illnesses: string[];
    injuries: string[];
    treatmentItems: string[];
    /** data pribadi opsional (kosong = diisi tangan setelah dicetak) */
    victimAddress: string | null;
    victimPhone: string | null;
    victimBirthDate: string | null;
  } | null;
  canSeeRestricted: boolean;
  /** null = tidak berhak / belum diisi (lihat canSeeCost) */
  estimatedCost: number | null;
  canSeeCost: boolean;
  team: { user: Pick<Person, "id" | "name" | "avatarUrl" | "jobTitle">; role: "lead" | "member" }[];
  investigation: {
    timeline: { time: string; event: string }[];
    reconstruction: string | null;
    causes: Record<CauseKey, { text: string; note: string }[]>;
    recommendations: { text: string }[];
    facts: string | null;
    basicCauseSummary: string | null;
    updatedAt: string | null;
    updatedBy: string | null;
  };
  reviews: ReviewEntry[];
  actions: PicaAction[];
  files: StoredFile[];
  closeCheck: CloseCheck[];
  relatedFindings: { id: string; code: string; title: string; status: string }[];
  /** waktu masuk tiap tahap dari log (untuk meta stepper) */
  stageLog: { action: string; at: string; actorName: string | null }[];
};

const EMPTY_CAUSES = Object.fromEntries(CAUSE_GROUPS.map((g) => [g.key, []])) as unknown as Record<CauseKey, { text: string; note: string }[]>;

export async function getKejadianDetail(supabase: ServerClient, id: string, opts: { canSeeRestricted: boolean; canSeeCost: boolean }): Promise<KejadianDetail | null> {
  const { data: d } = await supabase
    .from("incidents")
    .select(
      "id, code, company_code, location_id, area_id, location_detail, occurred_at, reported_at, reported_category, category, injury_class, severity, potential_severity, unit_code, unit_label, description, is_emergency, supervisor_id, ppe, damage_description, shift, overtime, activity, occupational, victim_employee_id, status, return_note, returned_at, lead_investigator_id, classified_at, classified_by, closed_at, close_note, closed_exception, created_by, updated_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!d) return null;

  const [persons, restricted, cost, team, inv, reviews, actions, files, check, related, site, area, logs] = await Promise.all([
    supabase.from("incident_persons").select("id, role, line_no, name, company_kind, contractor_id, employment, position, contact").eq("incident_id", id).order("role").order("line_no"),
    opts.canSeeRestricted
      ? supabase.from("incident_restricted").select("injury_type, body_parts, treatment, facility, lost_days, restricted_days, illnesses, injuries, treatment_items, victim_address, victim_phone, victim_birth_date").eq("incident_id", id).maybeSingle()
      : Promise.resolve({ data: null }),
    opts.canSeeCost ? supabase.from("incident_costs").select("estimated_cost").eq("incident_id", id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("incident_team").select("user_id, role").eq("incident_id", id),
    supabase.from("incident_investigations").select("timeline, reconstruction, causes, recommendations, facts, basic_cause_summary, updated_at, updated_by").eq("incident_id", id).maybeSingle(),
    supabase.from("incident_reviews").select("stage, decision, note, actor_id, at").eq("incident_id", id).order("at"),
    listActions(supabase, { incidentId: id }),
    supabase.storage.from(BUCKET_LAMPIRAN).list(`kejadian/${id}`, { limit: 100, sortBy: { column: "created_at", order: "asc" } }),
    supabase.rpc("incident_close_check", { p_id: id }),
    supabase.from("findings").select("id, code, title, status").eq("source_id", id).order("created_at"),
    supabase.schema("public").from("locations").select("name").eq("id", d.location_id).maybeSingle(),
    supabase.from("areas").select("name").eq("id", d.area_id).maybeSingle(),
    supabase.from("incidents_logs").select("action, at, actor_id").eq("record_id", id).order("at"),
  ]);

  const victimRow = d.victim_employee_id
    ? (await supabase.from("employees").select("id, code, name, job_title, department, join_date").eq("id", d.victim_employee_id).maybeSingle()).data
    : null;
  const contractorIds = [...new Set((persons.data ?? []).map((p) => p.contractor_id).filter((x): x is string => !!x))];
  const contractors = contractorIds.length ? ((await supabase.from("contractors").select("id, name").in("id", contractorIds)).data ?? []) : [];
  const people = await getPeople(supabase, [
    d.created_by,
    d.supervisor_id,
    d.classified_by,
    ...(team.data ?? []).map((t) => t.user_id),
    ...(reviews.data ?? []).map((r) => r.actor_id),
    ...(logs.data ?? []).map((l) => l.actor_id),
  ]);
  const pick = (uid: string | null) => {
    const p = uid ? people.get(uid) : undefined;
    return p ? { id: p.id, name: p.name, avatarUrl: p.avatarUrl, jobTitle: p.jobTitle } : null;
  };
  const invData = inv.data as { timeline: unknown; reconstruction: string | null; causes: unknown; recommendations: unknown; facts: string | null; basic_cause_summary: string | null; updated_at: string; updated_by: string | null } | null;
  const causes = { ...EMPTY_CAUSES, ...((invData?.causes as Record<CauseKey, { text: string; note: string }[]>) ?? {}) };

  return {
    id: d.id,
    code: d.code,
    companyCode: d.company_code,
    siteId: d.location_id,
    siteName: site.data?.name ?? "-",
    areaId: d.area_id,
    areaName: area.data?.name ?? "-",
    locationDetail: d.location_detail,
    occurredAt: d.occurred_at,
    reportedAt: d.reported_at,
    reportedCategory: d.reported_category,
    category: d.category,
    injuryClass: d.injury_class,
    severity: d.severity,
    potentialSeverity: d.potential_severity,
    unitCode: d.unit_code,
    unitLabel: d.unit_label,
    description: d.description,
    isEmergency: d.is_emergency,
    ppe: (d.ppe as Record<string, boolean>) ?? {},
    damageDescription: d.damage_description,
    shift: d.shift,
    overtime: d.overtime,
    activity: d.activity,
    occupational: d.occupational,
    victim: victimRow ? { id: victimRow.id, code: victimRow.code, name: victimRow.name, jobTitle: victimRow.job_title, department: victimRow.department, joinDate: victimRow.join_date } : null,
    status: d.status as IncidentStatus,
    returnNote: d.return_note,
    returnedAt: d.returned_at,
    classifiedAt: d.classified_at,
    closedAt: d.closed_at,
    closeNote: d.close_note,
    closedException: d.closed_exception,
    updatedAt: d.updated_at,
    reporter: d.created_by ? (people.get(d.created_by) ?? null) : null,
    supervisor: d.supervisor_id ? (people.get(d.supervisor_id) ?? null) : null,
    classifiedBy: d.classified_by ? (people.get(d.classified_by) ?? null) : null,
    persons: (persons.data ?? []).map((p) => ({
      id: p.id,
      role: p.role as "involved" | "witness",
      name: p.name,
      companyKind: p.company_kind,
      contractorName: contractors.find((c) => c.id === p.contractor_id)?.name ?? null,
      employment: p.employment,
      position: p.position,
      contact: p.contact,
    })),
    restricted: restricted.data
      ? {
          injuryType: restricted.data.injury_type,
          bodyParts: restricted.data.body_parts ?? [],
          treatment: restricted.data.treatment,
          facility: restricted.data.facility,
          lostDays: restricted.data.lost_days,
          restrictedDays: restricted.data.restricted_days,
          illnesses: restricted.data.illnesses ?? [],
          injuries: restricted.data.injuries ?? [],
          treatmentItems: restricted.data.treatment_items ?? [],
          victimAddress: restricted.data.victim_address,
          victimPhone: restricted.data.victim_phone,
          victimBirthDate: restricted.data.victim_birth_date,
        }
      : null,
    canSeeRestricted: opts.canSeeRestricted,
    estimatedCost: cost.data?.estimated_cost != null ? Number(cost.data.estimated_cost) : null,
    canSeeCost: opts.canSeeCost,
    team: (team.data ?? [])
      .map((t) => ({ user: pick(t.user_id)!, role: t.role as "lead" | "member" }))
      .filter((t) => t.user)
      .sort((a, b) => (a.role === b.role ? a.user.name.localeCompare(b.user.name) : a.role === "lead" ? -1 : 1)),
    investigation: {
      timeline: (invData?.timeline as { time: string; event: string }[]) ?? [],
      reconstruction: invData?.reconstruction ?? null,
      causes,
      recommendations: (invData?.recommendations as { text: string }[]) ?? [],
      facts: invData?.facts ?? null,
      basicCauseSummary: invData?.basic_cause_summary ?? null,
      updatedAt: invData?.updated_at ?? null,
      updatedBy: invData?.updated_by ? (people.get(invData.updated_by)?.name ?? null) : null,
    },
    reviews: (reviews.data ?? []).map((r) => ({
      stage: r.stage as ReviewEntry["stage"],
      decision: r.decision as ReviewEntry["decision"],
      note: r.note,
      at: r.at,
      actor: pick(r.actor_id),
    })),
    actions,
    files: (files.data ?? [])
      .filter((f) => f.id)
      .map((f) => ({
        path: `kejadian/${id}/${f.name}`,
        name: f.name.replace(/^\d{10,}-/, ""),
        size: (f.metadata?.size as number | undefined) ?? null,
        type: (f.metadata?.mimetype as string | undefined) ?? null,
        createdAt: f.created_at ?? null,
      })),
    closeCheck: (check.data as CloseCheck[] | null) ?? [],
    relatedFindings: related.data ?? [],
    stageLog: (logs.data ?? []).map((l) => ({ action: l.action, at: l.at, actorName: l.actor_id ? (people.get(l.actor_id)?.name ?? null) : null })),
  };
}

/** Kejadian terbaru dalam scope (pilihan sumber temuan). */
export async function getIncidentOptions(supabase: ServerClient) {
  const { data } = await supabase.from("incidents").select("id, code, description").order("reported_at", { ascending: false }).limit(200);
  return (data ?? []).map((i) => ({ value: i.id, label: i.code, description: i.description.slice(0, 80) }));
}
