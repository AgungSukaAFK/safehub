// People & Compliance: loader SATU sumber untuk daftar manpower, matriks kompetensi, MCU, dan profil karyawan.
// Status masa berlaku dihitung di sini (expiryOf, WIB) atau oleh fungsi DB turunan; tidak disimpan.
import "server-only";
import { expiryOf, type Expiry } from "@/lib/expiry";
import { todayWibIso } from "@/lib/k3";
import { enumParam, textParam, type SearchParams } from "@/lib/search-params";
import type { SiteChoice } from "@/lib/site-types";
import type { ServerClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------- params
export type ManpowerParams = { q: string; nonaktif: boolean; jabatan: string; site: SiteChoice };
export function parseManpowerParams(sp: SearchParams, site: SiteChoice): ManpowerParams {
  return { q: textParam(sp, "q"), nonaktif: sp.nonaktif === "1", jabatan: textParam(sp, "jabatan"), site };
}

// ---------------------------------------------------------------- daftar manpower
export type EmployeeRow = {
  id: string;
  code: string;
  name: string;
  jobTitle: string;
  department: string | null;
  employment: string;
  joinDate: string | null;
  status: string;
  contractorName: string | null;
  siteId: string;
  mcu: Expiry;
  mcuResult: string | null;
  compRequired: number;
  compOk: number;
  permit: Expiry;
};

export async function listEmployees(supabase: ServerClient, p: ManpowerParams): Promise<EmployeeRow[]> {
  const today = todayWibIso();
  let q = supabase.from("employees").select("id, code, name, job_title, department, employment, join_date, status, contractor_id, location_id");
  if (p.site) q = q.eq("location_id", p.site);
  if (!p.nonaktif) q = q.eq("status", "active");
  if (p.jabatan) q = q.eq("job_title", p.jabatan);
  if (p.q) q = q.ilike("search_text", `%${p.q.toLowerCase().replace(/[%_]/g, "")}%`);
  const [{ data, error }, ov, contractors] = await Promise.all([
    q.order("name").limit(500),
    supabase.rpc("employee_overview", { p_location: p.site ?? undefined }),
    supabase.from("contractors").select("id, name"),
  ]);
  if (error) throw error;
  const over = new Map((ov.data ?? []).map((o) => [o.employee_id, o]));
  const cn = new Map((contractors.data ?? []).map((c) => [c.id, c.name]));
  return (data ?? []).map((e) => {
    const o = over.get(e.id);
    return {
      id: e.id,
      code: e.code,
      name: e.name,
      jobTitle: e.job_title,
      department: e.department,
      employment: e.employment,
      joinDate: e.join_date,
      status: e.status,
      contractorName: e.contractor_id ? (cn.get(e.contractor_id) ?? null) : null,
      siteId: e.location_id,
      mcu: expiryOf(o?.mcu_until ?? null, today),
      mcuResult: o?.mcu_result ?? null,
      compRequired: o?.comp_required ?? 0,
      compOk: o?.comp_ok ?? 0,
      permit: expiryOf(o?.permit_until ?? null, today),
    };
  });
}

export type ManpowerSummary = {
  rows: { jobTitle: string; required: number; available: number }[];
  required: number;
  available: number;
  /** Σ min(tersedia, kebutuhan) ÷ Σ kebutuhan (%), null bila tanpa kebutuhan */
  fulfillment: number | null;
  activeTotal: number;
  contractorTotal: number;
  permitExpiring: number;
};

export async function getManpowerSummary(supabase: ServerClient, site: SiteChoice): Promise<ManpowerSummary> {
  const today = todayWibIso();
  const [{ data, error }, ov, emps] = await Promise.all([
    supabase.rpc("manpower_summary", { p_location: site ?? undefined }),
    supabase.rpc("employee_overview", { p_location: site ?? undefined }),
    supabase.from("employees").select("id, status, contractor_id").eq("status", "active"),
  ]);
  if (error) throw error;
  const rows = (data ?? []).map((r) => ({ jobTitle: r.job_title, required: r.required, available: r.available }));
  const need = rows.filter((r) => r.required > 0);
  const required = need.reduce((s, r) => s + r.required, 0);
  const covered = need.reduce((s, r) => s + Math.min(r.available, r.required), 0);
  const active = emps.data ?? [];
  const activeIds = new Set(active.map((e) => e.id));
  return {
    rows,
    required,
    available: rows.reduce((s, r) => s + r.available, 0),
    fulfillment: required > 0 ? Math.round((covered * 100) / required) : null,
    activeTotal: active.length,
    contractorTotal: active.filter((e) => e.contractor_id).length,
    permitExpiring: (ov.data ?? []).filter((o) => activeIds.has(o.employee_id) && expiryOf(o.permit_until, today).state === "expiring").length,
  };
}

// ---------------------------------------------------------------- kompetensi
export type CompetencyRow = { id: string; code: string; name: string; jobTitles: string[]; isActive: boolean };
export async function listCompetencies(supabase: ServerClient): Promise<CompetencyRow[]> {
  const { data, error } = await supabase.from("competencies").select("id, code, name, job_titles, is_active").order("sort_order").order("name");
  if (error) throw error;
  return (data ?? []).map((c) => ({ id: c.id, code: c.code, name: c.name, jobTitles: c.job_titles, isActive: c.is_active }));
}

export type MatrixRow = { employeeId: string; code: string; name: string; jobTitle: string; cells: Record<string, { state: string; validUntil: string | null }> };
export const MATRIX_STATE_FILTERS = ["semua", "expired", "expiring", "missing"] as const;

export async function getCompetencyMatrix(supabase: ServerClient, p: { site: SiteChoice; stateFilter: (typeof MATRIX_STATE_FILTERS)[number]; jabatan: string; q: string }) {
  const [{ data: cells, error }, { data: emps }, comps] = await Promise.all([
    supabase.rpc("competency_matrix", { p_location: p.site ?? undefined }),
    supabase.from("employees").select("id, code, name, job_title, search_text").eq("status", "active").order("name").limit(500),
    listCompetencies(supabase),
  ]);
  if (error) throw error;
  const byEmp = new Map<string, MatrixRow["cells"]>();
  for (const c of cells ?? []) {
    const m = byEmp.get(c.employee_id) ?? {};
    m[c.competency_id] = { state: c.state, validUntil: c.valid_until };
    byEmp.set(c.employee_id, m);
  }
  const needle = p.q.toLowerCase();
  let rows: MatrixRow[] = (emps ?? [])
    .filter((e) => byEmp.has(e.id) && (!p.jabatan || e.job_title === p.jabatan) && (!needle || (e.search_text ?? "").includes(needle)))
    .map((e) => ({ employeeId: e.id, code: e.code, name: e.name, jobTitle: e.job_title, cells: byEmp.get(e.id)! }));
  if (p.stateFilter !== "semua") rows = rows.filter((r) => Object.values(r.cells).some((c) => c.state === p.stateFilter));
  return { rows, competencies: comps.filter((c) => c.isActive) };
}

export function parseMatrixParams(sp: SearchParams, site: SiteChoice) {
  return { site, stateFilter: enumParam(sp, "status", MATRIX_STATE_FILTERS, "semua"), jabatan: textParam(sp, "jabatan"), q: textParam(sp, "q") };
}

// ---------------------------------------------------------------- MCU
export type McuRow = {
  id: string;
  employeeId: string;
  code: string;
  name: string;
  jobTitle: string;
  checkedOn: string;
  validUntil: Expiry;
  result: string;
  evidence: number;
};

/** MCU TERBARU per karyawan aktif (ringkasan aman; diagnosis tidak dimuat di daftar). */
export async function listMcu(supabase: ServerClient, p: { site: SiteChoice; q: string; filter: "semua" | "expiring" | "expired" }): Promise<McuRow[]> {
  const today = todayWibIso();
  const [{ data: rec, error }, { data: emps }] = await Promise.all([
    supabase.from("mcu_records").select("id, employee_id, checked_on, valid_until, result, evidence_count").order("valid_until", { ascending: false }).limit(2000),
    (() => {
      let q = supabase.from("employees").select("id, code, name, job_title, search_text").eq("status", "active");
      if (p.site) q = q.eq("location_id", p.site);
      return q.order("name").limit(500);
    })(),
  ]);
  if (error) throw error;
  const latest = new Map<string, NonNullable<typeof rec>[number]>();
  for (const r of rec ?? []) if (!latest.has(r.employee_id)) latest.set(r.employee_id, r);
  const needle = p.q.toLowerCase();
  return (emps ?? [])
    .filter((e) => !needle || (e.search_text ?? "").includes(needle))
    .map((e) => {
      const m = latest.get(e.id);
      return {
        id: m?.id ?? "",
        employeeId: e.id,
        code: e.code,
        name: e.name,
        jobTitle: e.job_title,
        checkedOn: m?.checked_on ?? "",
        validUntil: expiryOf(m?.valid_until ?? null, today),
        result: m?.result ?? "",
        evidence: m?.evidence_count ?? 0,
      };
    })
    .filter((r) => p.filter === "semua" || r.validUntil.state === p.filter || (p.filter === "expired" && r.validUntil.state === "none"));
}

// ---------------------------------------------------------------- profil karyawan
export type EmployeeDetail = {
  id: string;
  code: string;
  name: string;
  jobTitle: string;
  department: string | null;
  employment: string;
  joinDate: string | null;
  status: string;
  companyCode: string;
  siteId: string;
  contractorId: string | null;
  contractorName: string | null;
  profileId: string | null;
  certificates: { id: string; competencyId: string; competencyName: string; number: string | null; issuer: string | null; issuedOn: string | null; validUntil: string | null; expiry: Expiry; evidence: number }[];
  mcu: { id: string; checkedOn: string; validUntil: string; expiry: Expiry; result: string; evidence: number; diagnosis: string | null; note: string | null }[];
  /** true = user tidak berhak membaca diagnosis (tabel mcu_restricted kosong baginya) */
  mcuRestricted: boolean;
  permits: { id: string; name: string; number: string | null; validUntil: string; expiry: Expiry }[];
  required: { competencyId: string; name: string; state: string; validUntil: string | null }[];
};

export async function getEmployeeDetail(supabase: ServerClient, id: string, canSeeMedical: boolean): Promise<EmployeeDetail | null> {
  const today = todayWibIso();
  const { data: e } = await supabase
    .from("employees")
    .select("id, code, name, job_title, department, employment, join_date, status, company_code, location_id, contractor_id, profile_id")
    .eq("id", id)
    .maybeSingle();
  if (!e) return null;
  const [certs, mcus, restricted, permits, comps, matrix, contractor] = await Promise.all([
    supabase.from("certificates").select("id, competency_id, number, issuer, issued_on, valid_until, evidence_count").eq("employee_id", id).order("valid_until", { ascending: true, nullsFirst: false }),
    supabase.from("mcu_records").select("id, checked_on, valid_until, result, evidence_count").eq("employee_id", id).order("valid_until", { ascending: false }),
    canSeeMedical ? supabase.from("mcu_restricted").select("mcu_id, diagnosis, note") : Promise.resolve({ data: [] as { mcu_id: string; diagnosis: string | null; note: string | null }[] }),
    supabase.from("site_permits").select("id, name, number, valid_until").eq("employee_id", id).order("valid_until", { ascending: false }),
    listCompetencies(supabase),
    supabase.rpc("competency_matrix", { p_location: e.location_id }),
    e.contractor_id ? supabase.from("contractors").select("name").eq("id", e.contractor_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const restr = new Map((restricted.data ?? []).map((r) => [r.mcu_id, r]));
  const compName = new Map(comps.map((c) => [c.id, c.name]));
  return {
    id: e.id,
    code: e.code,
    name: e.name,
    jobTitle: e.job_title,
    department: e.department,
    employment: e.employment,
    joinDate: e.join_date,
    status: e.status,
    companyCode: e.company_code,
    siteId: e.location_id,
    contractorId: e.contractor_id,
    contractorName: contractor.data?.name ?? null,
    profileId: e.profile_id,
    certificates: (certs.data ?? []).map((c) => ({
      id: c.id,
      competencyId: c.competency_id,
      competencyName: compName.get(c.competency_id) ?? "-",
      number: c.number,
      issuer: c.issuer,
      issuedOn: c.issued_on,
      validUntil: c.valid_until,
      expiry: c.valid_until ? expiryOf(c.valid_until, today) : { state: "valid", validUntil: null, daysLeft: null },
      evidence: c.evidence_count,
    })),
    mcu: (mcus.data ?? []).map((m) => ({
      id: m.id,
      checkedOn: m.checked_on,
      validUntil: m.valid_until,
      expiry: expiryOf(m.valid_until, today),
      result: m.result,
      evidence: m.evidence_count,
      diagnosis: restr.get(m.id)?.diagnosis ?? null,
      note: restr.get(m.id)?.note ?? null,
    })),
    mcuRestricted: !canSeeMedical,
    permits: (permits.data ?? []).map((x) => ({ id: x.id, name: x.name, number: x.number, validUntil: x.valid_until, expiry: expiryOf(x.valid_until, today) })),
    required: (matrix.data ?? []).filter((m) => m.employee_id === id && m.state !== "na").map((m) => ({ competencyId: m.competency_id, name: compName.get(m.competency_id) ?? "-", state: m.state, validUntil: m.valid_until })),
  };
}
