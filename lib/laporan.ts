// Laporan Periode: loader SATU sumber untuk daftar dan detail (draf = angka live, terbit = snapshot terkunci).
import "server-only";
import type { ApprovalStepView } from "@/lib/approval-types";
import { REPORT_STATUS_ORDER, type Completeness, type ReportData } from "@/lib/laporan-rules";
import { getPeople } from "@/lib/people";
import { enumParam, textParam, type SearchParams } from "@/lib/search-params";
import type { SiteChoice } from "@/lib/site-types";
import type { ServerClient } from "@/lib/supabase/server";

export type LaporanParams = { tahun: number; status: string; template: string; site: SiteChoice };

export function parseLaporanParams(sp: SearchParams, site: SiteChoice, nowYear: number): LaporanParams {
  const raw = Number(typeof sp.tahun === "string" ? sp.tahun : nowYear);
  return {
    tahun: Number.isInteger(raw) && raw >= 2020 && raw <= nowYear + 1 ? raw : nowYear,
    status: enumParam(sp, "status", REPORT_STATUS_ORDER) ?? "",
    template: textParam(sp, "template", 40),
    site,
  };
}

export type TemplateOption = { id: string; code: string; name: string; revision: string; prefix: string };
export async function getReportTemplates(supabase: ServerClient): Promise<TemplateOption[]> {
  const { data, error } = await supabase.from("report_templates").select("id, code, name, revision, prefix").eq("is_active", true).order("code");
  if (error) throw error;
  return data ?? [];
}

export type ReportRow = {
  id: string;
  code: string;
  period: string;
  templateId: string;
  templateName: string;
  templateCode: string;
  revision: string;
  status: string;
  version: string | null;
  authorName: string | null;
  updatedAt: string;
  siteId: string;
};

export async function listReports(supabase: ServerClient, p: LaporanParams, templates: TemplateOption[]): Promise<ReportRow[]> {
  let q = supabase
    .from("reports")
    .select("id, code, period, template_id, status, current_version, created_by, updated_at, location_id")
    .gte("period", `${p.tahun}-01-01`)
    .lte("period", `${p.tahun}-12-01`);
  if (p.site) q = q.eq("location_id", p.site);
  if (p.status) q = q.eq("status", p.status);
  if (p.template) q = q.eq("template_id", p.template);
  const { data, error } = await q.order("period", { ascending: false }).order("code").limit(300);
  if (error) throw error;
  const people = await getPeople(
    supabase,
    (data ?? []).map((r) => r.created_by),
  );
  return (data ?? []).map((r) => {
    const t = templates.find((x) => x.id === r.template_id);
    return {
      id: r.id,
      code: r.code,
      period: r.period.slice(0, 7),
      templateId: r.template_id,
      templateName: t?.name ?? "-",
      templateCode: t?.code ?? "",
      revision: t?.revision ?? "",
      status: r.status,
      version: r.current_version,
      authorName: r.created_by ? (people.get(r.created_by)?.name ?? null) : null,
      updatedAt: r.updated_at,
      siteId: r.location_id,
    };
  });
}

export type ReportVersion = { version: string; publishedAt: string; reason: string | null };
export type ReportDetail = {
  id: string;
  code: string;
  siteId: string;
  companyCode: string;
  period: string;
  status: string;
  version: string | null;
  templateName: string;
  templateCode: string;
  revision: string;
  narratives: Record<string, string>;
  submitNote: string | null;
  correctionReason: string | null;
  createdBy: string | null;
  authorName: string | null;
  /** data yang ditampilkan: snapshot versi terpilih (terbit) atau angka live (draf) */
  data: ReportData;
  /** true = data dari snapshot terkunci, bukan hitungan ulang */
  fromSnapshot: boolean;
  shownVersion: string | null;
  versions: ReportVersion[];
  completeness: Completeness[];
  steps: ApprovalStepView[];
  previousRounds: ApprovalStepView[][];
};

export async function getReportDetail(supabase: ServerClient, id: string, userId: string, versi: string | null): Promise<ReportDetail | null> {
  const { data: r } = await supabase
    .from("reports")
    .select("id, code, company_code, location_id, template_id, period, status, narratives, submit_note, current_version, correction_reason, created_by")
    .eq("id", id)
    .maybeSingle();
  if (!r) return null;
  const [tpl, versions, approvals, live, comp] = await Promise.all([
    supabase.from("report_templates").select("code, name, revision").eq("id", r.template_id).maybeSingle(),
    supabase.from("report_versions").select("version, published_at, reason, snapshot").eq("report_id", id).order("published_at", { ascending: false }),
    supabase
      .from("approvals")
      .select("id, round, step_no, approval_type, approver_id, status, note, decided_at, due_at, followups(requested_by, requested_at)")
      .eq("doc_type", "laporan")
      .eq("record_id", id)
      .order("round", { ascending: false })
      .order("step_no"),
    supabase.rpc("report_data", { p_id: id }),
    supabase.rpc("report_completeness", { p_id: id }),
  ]);
  const vs = versions.data ?? [];
  // terbit & tidak sedang dikoreksi → snapshot (versi terpilih atau terbaru); selain itu angka live
  const wanted = vs.find((v) => v.version === versi) ?? (r.status === "published" ? vs[0] : null);
  const data = (wanted ? wanted.snapshot : live.data) as unknown as ReportData | null;
  if (!data) return null;

  const rows = approvals.data ?? [];
  const people = await getPeople(supabase, [r.created_by, ...rows.map((a) => a.approver_id)]);
  const steps: ApprovalStepView[] = rows.map((a) => {
    const fu = (a.followups ?? []) as { requested_by: string; requested_at: string }[];
    const p = people.get(a.approver_id);
    const mine = fu.filter((x) => x.requested_by === userId).map((x) => x.requested_at).sort();
    return {
      id: a.id,
      round: a.round,
      stepNo: a.step_no,
      type: a.approval_type,
      status: a.status as ApprovalStepView["status"],
      approver: { id: a.approver_id, name: p?.name ?? "(pengguna dihapus)", avatarUrl: p?.avatarUrl ?? null, department: p?.department ?? null },
      decidedAt: a.decided_at,
      note: a.note,
      dueAt: a.due_at,
      followupCount: fu.length,
      myLastFollowupAt: mine.at(-1) ?? null,
    };
  });
  const rounds = [...new Set(steps.map((s) => s.round))].sort((a, b) => b - a);
  return {
    id: r.id,
    code: r.code,
    siteId: r.location_id,
    companyCode: r.company_code,
    period: r.period.slice(0, 7),
    status: r.status,
    version: r.current_version,
    templateName: tpl.data?.name ?? "-",
    templateCode: tpl.data?.code ?? "",
    revision: tpl.data?.revision ?? "",
    narratives: (r.narratives ?? {}) as Record<string, string>,
    submitNote: r.submit_note,
    correctionReason: r.correction_reason,
    createdBy: r.created_by,
    authorName: r.created_by ? (people.get(r.created_by)?.name ?? null) : null,
    data,
    fromSnapshot: !!wanted,
    shownVersion: wanted?.version ?? null,
    versions: vs.map((v) => ({ version: v.version, publishedAt: v.published_at, reason: v.reason })),
    completeness: (comp.data ?? []) as unknown as Completeness[],
    steps: steps.filter((s) => s.round === rounds[0]),
    previousRounds: rounds.slice(1).map((x) => steps.filter((s) => s.round === x)),
  };
}
