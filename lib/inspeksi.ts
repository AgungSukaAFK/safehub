// Inspeksi & Observasi: loader satu sumber untuk kalender/daftar, rencana vs aktual, detail, template,
// dan observasi. Hak baca dijaga RLS (non-staf K3 hanya miliknya); filter di sini hanya penyaring.
import "server-only";
import { BUCKET_LAMPIRAN } from "@/lib/app-config";
import { getAreas, getK3Masters, labelOf, todayWibIso, type AreaOption, type K3Masters, type MasterOption } from "@/lib/k3";
import {
  INSPECTION_VIEWS,
  inspectionDisplayStatus,
  monthKey,
  parseMonth,
  type InspectionView,
} from "@/lib/inspeksi-rules";
import { getPeople } from "@/lib/people";
import type { Person } from "@/lib/person-types";
import { enumParam, listParam, textParam, type SearchParams } from "@/lib/search-params";
import type { SiteChoice } from "@/lib/site-types";
import type { ServerClient } from "@/lib/supabase/server";

type PersonBrief = Pick<Person, "id" | "name" | "avatarUrl" | "jobTitle">;
const brief = (p: Person | undefined): PersonBrief | null => (p ? { id: p.id, name: p.name, avatarUrl: p.avatarUrl, jobTitle: p.jobTitle } : null);

/** `timestamptz` ISO → {date: YYYY-MM-DD, time: HH:mm} dalam WIB. */
export function wibParts(iso: string) {
  const s = new Date(Date.parse(iso) + 7 * 3_600_000).toISOString();
  return { date: s.slice(0, 10), time: s.slice(11, 16) };
}

// ---------------------------------------------------------------- params
export type InspeksiParams = {
  /** YYYY-MM (WIB) */
  bulan: string;
  tampilan: InspectionView;
  types: string[];
  q: string;
  site: SiteChoice;
};

export function parseInspeksiParams(sp: SearchParams, site: SiteChoice): InspeksiParams {
  const nowKey = todayWibIso().slice(0, 7);
  const raw = typeof sp.bulan === "string" ? sp.bulan : "";
  return {
    bulan: parseMonth(raw) ? raw : nowKey,
    tampilan: enumParam(sp, "tampilan", INSPECTION_VIEWS, "kalender"),
    types: listParam(sp, "jenis")
      .filter((c) => /^[a-z][a-z0-9_]{1,40}$/.test(c))
      .slice(0, 20),
    q: textParam(sp, "q"),
    site,
  };
}

// ---------------------------------------------------------------- kalender / daftar
export type InspectionRow = {
  id: string;
  code: string;
  title: string;
  typeCode: string;
  typeLabel: string;
  typeColor: string | null;
  areaName: string;
  objectText: string | null;
  plannedAt: string;
  plannedDate: string;
  plannedTime: string;
  inspector: PersonBrief | null;
  status: string;
  displayStatus: string;
  summary: { compliant: number; noncompliant: number; na: number; findings: number } | null;
};

const LIST_COLUMNS = "id, code, title, type_code, area_id, object_text, planned_at, inspector_id, status, summary";

type Raw = {
  id: string;
  code: string;
  title: string;
  type_code: string;
  area_id: string;
  object_text: string | null;
  planned_at: string;
  inspector_id: string;
  status: string;
  summary: unknown;
};

async function hydrate(supabase: ServerClient, raw: Raw[], masters: K3Masters, areas: AreaOption[]): Promise<InspectionRow[]> {
  const people = await getPeople(
    supabase,
    raw.map((r) => r.inspector_id),
  );
  const today = todayWibIso();
  return raw.map((r) => {
    const { date, time } = wibParts(r.planned_at);
    const type = masters.inspectionTypes.find((t) => t.value === r.type_code);
    return {
      id: r.id,
      code: r.code,
      title: r.title,
      typeCode: r.type_code,
      typeLabel: type?.label ?? r.type_code,
      typeColor: type?.color ?? null,
      areaName: areas.find((a) => a.value === r.area_id)?.label ?? "-",
      objectText: r.object_text,
      plannedAt: r.planned_at,
      plannedDate: date,
      plannedTime: time,
      inspector: brief(people.get(r.inspector_id)),
      status: r.status,
      displayStatus: inspectionDisplayStatus(r.status, date, today),
      summary: (r.summary as InspectionRow["summary"]) ?? null,
    };
  });
}

/** Semua inspeksi satu bulan (WIB), maks. 500 baris. Dibatalkan ikut tampil (tercoret di kalender). */
export async function listInspectionsMonth(supabase: ServerClient, p: InspeksiParams, areas: AreaOption[]) {
  const masters = await getK3Masters(supabase);
  const m = parseMonth(p.bulan)!;
  const from = `${monthKey(m.year, m.month)}-01T00:00:00+07:00`;
  const nextKey = m.month === 12 ? monthKey(m.year + 1, 1) : monthKey(m.year, m.month + 1);
  const to = `${nextKey}-01T00:00:00+07:00`;
  let q = supabase.from("inspections").select(LIST_COLUMNS).gte("planned_at", from).lt("planned_at", to);
  if (p.site) q = q.eq("location_id", p.site);
  if (p.types.length) q = q.in("type_code", p.types);
  const { data, error } = await q.order("planned_at").order("id").limit(500);
  if (error) throw error;
  return hydrate(supabase, (data ?? []) as Raw[], masters, areas);
}

export type PlanActualRow = { typeCode: string; label: string; color: string | null; plan: number; actual: number };

/** Rencana vs aktual per jenis (RPC inspection_plan_actual, ikut RLS) + total. */
export async function getPlanActual(supabase: ServerClient, bulan: string, site: SiteChoice, types: MasterOption[]) {
  const m = parseMonth(bulan)!;
  const { data, error } = await supabase.rpc("inspection_plan_actual", { p_year: m.year, p_month: m.month, p_location: site ?? undefined });
  if (error) throw error;
  const rows: PlanActualRow[] = (data ?? []).map((r) => {
    const t = types.find((x) => x.value === r.type_code);
    return { typeCode: r.type_code, label: t?.label ?? r.type_code, color: t?.color ?? null, plan: r.plan, actual: r.actual };
  });
  rows.sort((a, b) => types.findIndex((t) => t.value === a.typeCode) - types.findIndex((t) => t.value === b.typeCode));
  const plan = rows.reduce((s, r) => s + r.plan, 0);
  const actual = rows.reduce((s, r) => s + r.actual, 0);
  return { rows, plan, actual };
}

// ---------------------------------------------------------------- detail
export type InspectionAnswer = {
  lineNo: number;
  itemText: string;
  answer: "compliant" | "noncompliant" | "na" | null;
  comment: string | null;
  photos: string[];
  finding: { id: string; code: string; status: string } | null;
};

export type StoredFile = { path: string; name: string };

export type InspectionDetail = {
  id: string;
  code: string;
  companyCode: string;
  siteId: string;
  siteName: string;
  areaId: string;
  areaName: string;
  title: string;
  typeCode: string;
  typeLabel: string;
  typeColor: string | null;
  objectText: string | null;
  objectLabel: string | null;
  plannedAt: string;
  status: string;
  displayStatus: string;
  startedAt: string | null;
  submittedAt: string | null;
  verifiedAt: string | null;
  verifyNote: string | null;
  cancelReason: string | null;
  summary: InspectionRow["summary"];
  inspector: PersonBrief | null;
  verifier: PersonBrief | null;
  creator: PersonBrief | null;
  updatedAt: string;
  answers: InspectionAnswer[];
  /** template punya butir (inspeksi bisa dimulai) */
  templateItems: number;
  findingCategory: string;
};

export async function getInspectionDetail(supabase: ServerClient, id: string): Promise<InspectionDetail | null> {
  const { data: d } = await supabase
    .from("inspections")
    .select(
      "id, code, company_code, location_id, area_id, template_id, type_code, title, object_text, planned_at, inspector_id, status, started_at, submitted_at, verified_at, verified_by, verify_note, cancel_reason, summary, created_by, updated_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!d) return null;
  const masters = await getK3Masters(supabase);
  const [answers, site, area, tpl, tplItems] = await Promise.all([
    supabase.from("inspection_answers").select("line_no, item_text, answer, comment, photos, finding_id").eq("inspection_id", id).order("line_no"),
    supabase.schema("public").from("locations").select("name").eq("id", d.location_id).maybeSingle(),
    supabase.from("areas").select("name").eq("id", d.area_id).maybeSingle(),
    d.template_id ? supabase.from("inspection_templates").select("object_label, finding_category").eq("id", d.template_id).maybeSingle() : Promise.resolve({ data: null }),
    d.template_id ? supabase.from("inspection_template_items").select("id", { count: "exact", head: true }).eq("template_id", d.template_id) : Promise.resolve({ count: 0 }),
  ]);
  const findingIds = (answers.data ?? []).map((a) => a.finding_id).filter((x): x is string => !!x);
  const findings = findingIds.length ? ((await supabase.from("findings").select("id, code, status").in("id", findingIds)).data ?? []) : [];
  const people = await getPeople(supabase, [d.inspector_id, d.verified_by, d.created_by]);
  const type = masters.inspectionTypes.find((t) => t.value === d.type_code);
  const { date } = wibParts(d.planned_at);
  return {
    id: d.id,
    code: d.code,
    companyCode: d.company_code,
    siteId: d.location_id,
    siteName: site.data?.name ?? "-",
    areaId: d.area_id,
    areaName: area.data?.name ?? "-",
    title: d.title,
    typeCode: d.type_code,
    typeLabel: type?.label ?? d.type_code,
    typeColor: type?.color ?? null,
    objectText: d.object_text,
    objectLabel: tpl.data?.object_label ?? null,
    plannedAt: d.planned_at,
    status: d.status,
    displayStatus: inspectionDisplayStatus(d.status, date, todayWibIso()),
    startedAt: d.started_at,
    submittedAt: d.submitted_at,
    verifiedAt: d.verified_at,
    verifyNote: d.verify_note,
    cancelReason: d.cancel_reason,
    summary: (d.summary as InspectionRow["summary"]) ?? null,
    inspector: brief(people.get(d.inspector_id)),
    verifier: brief(d.verified_by ? people.get(d.verified_by) : undefined),
    creator: brief(d.created_by ? people.get(d.created_by) : undefined),
    updatedAt: d.updated_at,
    answers: (answers.data ?? []).map((a) => ({
      lineNo: a.line_no,
      itemText: a.item_text,
      answer: a.answer as InspectionAnswer["answer"],
      comment: a.comment,
      photos: a.photos ?? [],
      finding: a.finding_id ? (findings.find((f) => f.id === a.finding_id) ?? null) : null,
    })),
    templateItems: tplItems.count ?? 0,
    findingCategory: tpl.data?.finding_category ?? "operational_safety",
  };
}

// ---------------------------------------------------------------- template
export type TemplateRow = {
  id: string;
  name: string;
  typeCode: string;
  typeLabel: string;
  typeColor: string | null;
  objectLabel: string | null;
  findingCategory: string;
  isActive: boolean;
  itemCount: number;
};

export async function listTemplates(supabase: ServerClient): Promise<TemplateRow[]> {
  const masters = await getK3Masters(supabase);
  const [{ data: t, error }, { data: items }] = await Promise.all([
    supabase.from("inspection_templates").select("id, name, type_code, object_label, finding_category, is_active").order("name"),
    supabase.from("inspection_template_items").select("template_id"),
  ]);
  if (error) throw error;
  const count = new Map<string, number>();
  for (const i of items ?? []) count.set(i.template_id, (count.get(i.template_id) ?? 0) + 1);
  return (t ?? []).map((r) => {
    const type = masters.inspectionTypes.find((x) => x.value === r.type_code);
    return {
      id: r.id,
      name: r.name,
      typeCode: r.type_code,
      typeLabel: type?.label ?? r.type_code,
      typeColor: type?.color ?? null,
      objectLabel: r.object_label,
      findingCategory: r.finding_category,
      isActive: r.is_active,
      itemCount: count.get(r.id) ?? 0,
    };
  });
}

export async function getTemplate(supabase: ServerClient, id: string) {
  const [{ data: t }, { data: items }] = await Promise.all([
    supabase.from("inspection_templates").select("id, name, type_code, object_label, finding_category, is_active").eq("id", id).maybeSingle(),
    supabase.from("inspection_template_items").select("text").eq("template_id", id).order("line_no"),
  ]);
  if (!t) return null;
  return {
    id: t.id,
    name: t.name,
    typeCode: t.type_code,
    objectLabel: t.object_label ?? "",
    findingCategory: t.finding_category,
    isActive: t.is_active,
    items: (items ?? []).map((i) => i.text),
  };
}

/** Template aktif untuk pilihan jadwal. */
export async function getActiveTemplates(supabase: ServerClient) {
  const { data } = await supabase.from("inspection_templates").select("id, name, type_code, object_label").eq("is_active", true).order("name");
  return (data ?? []).map((t) => ({ id: t.id, name: t.name, typeCode: t.type_code, objectLabel: t.object_label }));
}

// ---------------------------------------------------------------- observasi
export type ObservationRow = {
  id: string;
  code: string;
  kind: string;
  description: string;
  areaName: string;
  observedAt: string;
  needsFollowup: boolean;
  finding: { id: string; code: string; status: string } | null;
  reporter: PersonBrief | null;
};

export async function listObservations(supabase: ServerClient, site: SiteChoice, areas: AreaOption[], limit = 100): Promise<ObservationRow[]> {
  let q = supabase.from("observations").select("id, code, kind, description, area_id, observed_at, needs_followup, finding_id, created_by");
  if (site) q = q.eq("location_id", site);
  const { data, error } = await q.order("observed_at", { ascending: false }).order("id").limit(limit);
  if (error) throw error;
  const rows = data ?? [];
  const people = await getPeople(
    supabase,
    rows.map((r) => r.created_by),
  );
  const fIds = rows.map((r) => r.finding_id).filter((x): x is string => !!x);
  const findings = fIds.length ? ((await supabase.from("findings").select("id, code, status").in("id", fIds)).data ?? []) : [];
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    kind: r.kind,
    description: r.description,
    areaName: areas.find((a) => a.value === r.area_id)?.label ?? "-",
    observedAt: r.observed_at,
    needsFollowup: r.needs_followup,
    finding: r.finding_id ? (findings.find((f) => f.id === r.finding_id) ?? null) : null,
    reporter: brief(r.created_by ? people.get(r.created_by) : undefined),
  }));
}

export type ObservationDetail = ObservationRow & { immediateAction: string | null; siteName: string; files: StoredFile[] };

export async function getObservationDetail(supabase: ServerClient, id: string, areas: AreaOption[]): Promise<ObservationDetail | null> {
  const { data: d } = await supabase
    .from("observations")
    .select("id, code, kind, description, immediate_action, area_id, location_id, observed_at, needs_followup, finding_id, created_by")
    .eq("id", id)
    .maybeSingle();
  if (!d) return null;
  const [people, finding, site, files] = await Promise.all([
    getPeople(supabase, [d.created_by]),
    d.finding_id ? supabase.from("findings").select("id, code, status").eq("id", d.finding_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.schema("public").from("locations").select("name").eq("id", d.location_id).maybeSingle(),
    supabase.storage.from(BUCKET_LAMPIRAN).list(`observasi/${id}`, { limit: 50, sortBy: { column: "created_at", order: "asc" } }),
  ]);
  return {
    id: d.id,
    code: d.code,
    kind: d.kind,
    description: d.description,
    immediateAction: d.immediate_action,
    areaName: areas.find((a) => a.value === d.area_id)?.label ?? "-",
    siteName: site.data?.name ?? "-",
    observedAt: d.observed_at,
    needsFollowup: d.needs_followup,
    finding: finding.data ?? null,
    reporter: brief(d.created_by ? people.get(d.created_by) : undefined),
    files: (files.data ?? []).filter((f) => f.id).map((f) => ({ path: `observasi/${id}/${f.name}`, name: f.name.replace(/^\d{10,}-/, "") })),
  };
}

export { getAreas, labelOf };
