// Kontraktor & PJO/PJA: loader SATU sumber untuk daftar, profil, dan register. Baca = RLS (staf K3);
// nilai kontrak hanya dimuat bila user berhak (commercial_viewer di DB tetap penjaga terakhir).
import "server-only";
import { expiryOf, type Expiry } from "@/lib/expiry";
import { todayWibIso } from "@/lib/k3";
import { LEGAL_FILTERS } from "@/lib/kontraktor-rules";
import { enumParam, textParam, type SearchParams } from "@/lib/search-params";
import type { ServerClient } from "@/lib/supabase/server";

export type ContractorParams = { q: string; legal: (typeof LEGAL_FILTERS)[number]; nonaktif: boolean };
export function parseContractorParams(sp: SearchParams): ContractorParams {
  return { q: textParam(sp, "q"), legal: enumParam(sp, "legal", LEGAL_FILTERS, "semua"), nonaktif: sp.nonaktif === "1" };
}

export type ContractorRow = {
  id: string;
  name: string;
  kind: string;
  companyCode: string;
  isActive: boolean;
  picName: string | null;
  legalState: string;
  nearest: Expiry;
  permitCount: number;
  docsOk: number;
  docsTotal: number;
  csmsResult: string | null;
  csmsUntil: Expiry;
  activeContracts: number;
  personnel: number;
};

export async function listContractors(supabase: ServerClient, p: ContractorParams): Promise<ContractorRow[]> {
  const today = todayWibIso();
  const [{ data, error }, ov] = await Promise.all([
    supabase.from("contractors").select("id, name, kind, company_code, is_active, pic_name").order("name").limit(500),
    supabase.rpc("contractor_overview"),
  ]);
  if (error) throw error;
  const over = new Map((ov.data ?? []).map((o) => [o.contractor_id, o]));
  const needle = p.q.toLowerCase();
  return (data ?? [])
    .filter((c) => (p.nonaktif || c.is_active) && (!needle || `${c.name} ${c.pic_name ?? ""}`.toLowerCase().includes(needle)))
    .map((c) => {
      const o = over.get(c.id);
      return {
        id: c.id,
        name: c.name,
        kind: c.kind,
        companyCode: c.company_code,
        isActive: c.is_active,
        picName: c.pic_name,
        legalState: o?.legal_state ?? "none",
        nearest: expiryOf(o?.permit_nearest ?? null, today),
        permitCount: o?.permit_count ?? 0,
        docsOk: o?.docs_ok ?? 0,
        docsTotal: o?.docs_total ?? 0,
        csmsResult: o?.csms_result ?? null,
        csmsUntil: expiryOf(o?.csms_until ?? null, today),
        activeContracts: o?.active_contracts ?? 0,
        personnel: o?.personnel ?? 0,
      };
    })
    .filter((r) => p.legal === "semua" || r.legalState === p.legal);
}

export type ContractorDetail = {
  id: string;
  name: string;
  kind: string;
  companyCode: string;
  isActive: boolean;
  picName: string | null;
  picContact: string | null;
  notes: string | null;
  overview: ContractorRow;
  permits: { id: string; name: string; number: string | null; issuer: string | null; validUntil: string; expiry: Expiry; evidence: number; superseded: boolean }[];
  contracts: { id: string; number: string; title: string; startsOn: string; endsOn: string; expiry: Expiry; amount: number | null }[];
  /** user berhak melihat nilai kontrak (data komersial) */
  canSeeCommercial: boolean;
  csms: { id: string; assessedOn: string; score: number; result: string; validUntil: string; expiry: Expiry; note: string | null }[];
  documents: { typeId: string; typeName: string; id: string | null; status: string; validUntil: string | null; expiry: Expiry; note: string | null; evidence: number }[];
  personnel: { id: string; code: string; name: string; jobTitle: string; status: string }[];
};

export async function getContractorDetail(supabase: ServerClient, id: string, canSeeCommercial: boolean): Promise<ContractorDetail | null> {
  const today = todayWibIso();
  const { data: c } = await supabase.from("contractors").select("id, name, kind, company_code, is_active, pic_name, pic_contact, notes").eq("id", id).maybeSingle();
  if (!c) return null;
  const [permits, contracts, values, csms, types, docs, emps, ov] = await Promise.all([
    supabase.from("contractor_permits").select("id, name, number, issuer, valid_until, evidence_count").eq("contractor_id", id).order("valid_until", { ascending: false }),
    supabase.from("contractor_contracts").select("id, number, title, starts_on, ends_on").eq("contractor_id", id).order("ends_on", { ascending: false }),
    canSeeCommercial ? supabase.from("contractor_contract_values").select("contract_id, amount") : Promise.resolve({ data: [] as { contract_id: string; amount: number }[] }),
    supabase.from("csms_assessments").select("id, assessed_on, score, result, valid_until, note").eq("contractor_id", id).order("assessed_on", { ascending: false }),
    supabase.from("contractor_doc_types").select("id, name").eq("is_active", true).order("sort_order"),
    supabase.from("contractor_documents").select("id, type_id, status, valid_until, note, evidence_count").eq("contractor_id", id),
    supabase.from("employees").select("id, code, name, job_title, status").eq("contractor_id", id).order("name").limit(300),
    listContractors(supabase, { q: "", legal: "semua", nonaktif: true }),
  ]);
  const overview = ov.find((r) => r.id === id);
  if (!overview) return null;
  const amount = new Map((values.data ?? []).map((v) => [v.contract_id, Number(v.amount)]));
  const seen = new Set<string>();
  const docBy = new Map((docs.data ?? []).map((d) => [d.type_id, d]));
  return {
    id: c.id,
    name: c.name,
    kind: c.kind,
    companyCode: c.company_code,
    isActive: c.is_active,
    picName: c.pic_name,
    picContact: c.pic_contact,
    notes: c.notes,
    overview,
    // diurutkan valid_until menurun: izin pertama per nama = yang terbaru; sisanya riwayat (superseded)
    permits: (permits.data ?? []).map((p) => {
      const superseded = seen.has(p.name);
      seen.add(p.name);
      return { id: p.id, name: p.name, number: p.number, issuer: p.issuer, validUntil: p.valid_until, expiry: expiryOf(p.valid_until, today), evidence: p.evidence_count, superseded };
    }),
    contracts: (contracts.data ?? []).map((k) => ({ id: k.id, number: k.number, title: k.title, startsOn: k.starts_on, endsOn: k.ends_on, expiry: expiryOf(k.ends_on, today), amount: amount.get(k.id) ?? null })),
    canSeeCommercial,
    csms: (csms.data ?? []).map((a) => ({ id: a.id, assessedOn: a.assessed_on, score: a.score, result: a.result, validUntil: a.valid_until, expiry: expiryOf(a.valid_until, today), note: a.note })),
    documents: (types.data ?? []).map((t) => {
      const d = docBy.get(t.id);
      return { typeId: t.id, typeName: t.name, id: d?.id ?? null, status: d?.status ?? "pending", validUntil: d?.valid_until ?? null, expiry: expiryOf(d?.valid_until ?? null, today), note: d?.note ?? null, evidence: d?.evidence_count ?? 0 };
    }),
    personnel: (emps.data ?? []).map((e) => ({ id: e.id, code: e.code, name: e.name, jobTitle: e.job_title, status: e.status })),
  };
}

export type AppointmentRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  role: string;
  scope: string;
  skNumber: string;
  startsOn: string;
  validUntil: string;
  expiry: Expiry;
  evidence: number;
  siteId: string;
  companyCode: string;
  /** belum berlaku (mulai di masa depan) */
  upcoming: boolean;
};

export async function listAppointments(supabase: ServerClient, site: string | null, p: { role: string; q: string }): Promise<AppointmentRow[]> {
  const today = todayWibIso();
  let q = supabase.from("pjo_pja_appointments").select("id, employee_id, role, scope, sk_number, starts_on, valid_until, evidence_count, location_id, company_code").order("valid_until", { ascending: false });
  if (site) q = q.eq("location_id", site);
  if (p.role === "pjo" || p.role === "pja") q = q.eq("role", p.role);
  const { data, error } = await q.limit(500);
  if (error) throw error;
  const ids = [...new Set((data ?? []).map((a) => a.employee_id))];
  const { data: emps } = ids.length ? await supabase.from("employees").select("id, code, name").in("id", ids) : { data: [] };
  const em = new Map((emps ?? []).map((e) => [e.id, e]));
  const needle = p.q.toLowerCase();
  return (data ?? [])
    .map((a) => ({
      id: a.id,
      employeeId: a.employee_id,
      employeeName: em.get(a.employee_id)?.name ?? "-",
      employeeCode: em.get(a.employee_id)?.code ?? "-",
      role: a.role,
      scope: a.scope,
      skNumber: a.sk_number,
      startsOn: a.starts_on,
      validUntil: a.valid_until,
      expiry: expiryOf(a.valid_until, today),
      evidence: a.evidence_count,
      siteId: a.location_id,
      companyCode: a.company_code,
      upcoming: a.starts_on > today,
    }))
    .filter((a) => !needle || `${a.employeeName} ${a.scope} ${a.skNumber}`.toLowerCase().includes(needle));
}
