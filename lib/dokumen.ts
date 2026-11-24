// Dokumen terkendali, Peraturan, Register KO: loader SATU sumber. Baca = RLS (Karyawan hanya melihat dokumen terbit).
import "server-only";
import type { ApprovalStepView } from "@/lib/approval-types";
import { BUCKET_LAMPIRAN } from "@/lib/app-config";
import { DOC_KIND_FILTERS, KO_FILTERS } from "@/lib/dokumen-rules";
import { expiryOf, type Expiry } from "@/lib/expiry";
import { todayWibIso } from "@/lib/k3";
import { getPeople } from "@/lib/people";
import { enumParam, textParam, type SearchParams } from "@/lib/search-params";
import type { SiteChoice } from "@/lib/site-types";
import type { ServerClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------- daftar dokumen
export type DocParams = { kind: (typeof DOC_KIND_FILTERS)[number]; q: string; unread: boolean; withdrawn: boolean };
export function parseDocParams(sp: SearchParams): DocParams {
  return { kind: enumParam(sp, "jenis", DOC_KIND_FILTERS, "semua"), q: textParam(sp, "q"), unread: sp.baca === "1", withdrawn: sp.ditarik === "1" };
}

export type DocRow = {
  id: string;
  code: string;
  title: string;
  kind: string;
  isActive: boolean;
  ownerName: string | null;
  currentRev: number | null;
  currentRevisionId: string | null;
  effectiveOn: string | null;
  review: Expiry;
  openRev: number | null;
  openStatus: string | null;
  ackTotal: number;
  ackDone: number;
  myAckPending: boolean;
};

export async function listDocuments(supabase: ServerClient, p: DocParams): Promise<DocRow[]> {
  const today = todayWibIso();
  const [{ data, error }, ov] = await Promise.all([
    supabase.from("controlled_documents").select("id, code, title, kind, is_active, owner_id").order("code").limit(500),
    supabase.rpc("document_overview"),
  ]);
  if (error) throw error;
  const over = new Map((ov.data ?? []).map((o) => [o.document_id, o]));
  const owners = await getPeople(supabase, (data ?? []).map((d) => d.owner_id));
  const needle = p.q.toLowerCase();
  return (data ?? [])
    .filter((d) => (p.withdrawn || d.is_active) && (p.kind === "semua" || d.kind === p.kind) && (!needle || `${d.code} ${d.title}`.toLowerCase().includes(needle)))
    .map((d) => {
      const o = over.get(d.id);
      return {
        id: d.id,
        code: d.code,
        title: d.title,
        kind: d.kind,
        isActive: d.is_active,
        ownerName: d.owner_id ? (owners.get(d.owner_id)?.name ?? null) : null,
        currentRev: o?.current_rev ?? null,
        currentRevisionId: o?.current_id ?? null,
        effectiveOn: o?.effective_on ?? null,
        review: expiryOf(o?.review_due_on ?? null, today),
        openRev: o?.open_rev ?? null,
        openStatus: o?.open_status ?? null,
        ackTotal: o?.ack_total ?? 0,
        ackDone: o?.ack_done ?? 0,
        myAckPending: o?.my_ack_pending ?? false,
      };
    })
    .filter((r) => !p.unread || r.myAckPending);
}

// ---------------------------------------------------------------- detail dokumen
export type RevisionView = {
  id: string;
  revNo: number;
  summary: string;
  status: string;
  effectiveOn: string | null;
  reviewDueOn: string | null;
  files: { path: string; name: string }[];
  createdBy: string | null;
};

export type DocDetail = {
  id: string;
  code: string;
  title: string;
  kind: string;
  companyCode: string;
  isActive: boolean;
  withdrawReason: string | null;
  ownerId: string | null;
  ownerName: string | null;
  reviewMonths: number;
  distributeTitles: string[];
  distributeEmployees: number;
  review: Expiry;
  revisions: RevisionView[];
  /** revisi terbit, revisi terbuka (draf / menunggu / dikembalikan) */
  currentId: string | null;
  openId: string | null;
  steps: ApprovalStepView[];
  previousRounds: ApprovalStepView[][];
  acks: { userId: string; name: string; acknowledgedAt: string | null }[];
  myAck: { revisionId: string; acknowledgedAt: string | null } | null;
};

async function listFiles(supabase: ServerClient, revisionId: string): Promise<{ path: string; name: string }[]> {
  const { data } = await supabase.storage.from(BUCKET_LAMPIRAN).list(`dokumen/${revisionId}`, { limit: 50 });
  return (data ?? []).filter((f) => f.name && !f.name.startsWith(".")).map((f) => ({ path: `dokumen/${revisionId}/${f.name}`, name: f.name.replace(/^\d+-/, "") }));
}

export async function getDocumentDetail(supabase: ServerClient, id: string, userId: string, canSeeProgress: boolean): Promise<DocDetail | null> {
  const today = todayWibIso();
  const { data: d } = await supabase.from("controlled_documents").select("*").eq("id", id).maybeSingle();
  if (!d) return null;
  const { data: revs } = await supabase.from("document_revisions").select("id, rev_no, change_summary, status, effective_on, review_due_on, created_by").eq("document_id", id).order("rev_no", { ascending: false });
  const revisions = revs ?? [];
  const current = revisions.find((r) => r.status === "approved") ?? null;
  const open = revisions.find((r) => ["draft", "pending_approval", "rejected"].includes(r.status)) ?? null;
  const [files, approvals, acksRes] = await Promise.all([
    Promise.all(revisions.slice(0, 6).map(async (r) => [r.id, await listFiles(supabase, r.id)] as const)),
    open
      ? supabase.from("approvals").select("id, round, step_no, approval_type, approver_id, status, note, decided_at, due_at, followups(requested_by, requested_at)").eq("doc_type", "document_revision").eq("record_id", open.id).order("round", { ascending: false }).order("step_no")
      : Promise.resolve({ data: [] }),
    current ? supabase.from("document_acknowledgements").select("user_id, acknowledged_at").eq("revision_id", current.id) : Promise.resolve({ data: [] as { user_id: string; acknowledged_at: string | null }[] }),
  ]);
  const fileBy = new Map(files);
  const rows = approvals.data ?? [];
  const acks = acksRes.data ?? [];
  const people = await getPeople(supabase, [d.owner_id, ...rows.map((a) => a.approver_id), ...(canSeeProgress ? acks.map((a) => a.user_id) : [])]);
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
  const mine = acks.find((a) => a.user_id === userId);
  return {
    id: d.id,
    code: d.code,
    title: d.title,
    kind: d.kind,
    companyCode: d.company_code,
    isActive: d.is_active,
    withdrawReason: d.withdraw_reason,
    ownerId: d.owner_id,
    ownerName: d.owner_id ? (people.get(d.owner_id)?.name ?? null) : null,
    reviewMonths: d.review_months,
    distributeTitles: d.distribute_titles,
    distributeEmployees: d.distribute_employees.length,
    review: expiryOf(current?.review_due_on ?? null, today),
    revisions: revisions.map((r) => ({ id: r.id, revNo: r.rev_no, summary: r.change_summary, status: r.status, effectiveOn: r.effective_on, reviewDueOn: r.review_due_on, files: fileBy.get(r.id) ?? [], createdBy: r.created_by })),
    currentId: current?.id ?? null,
    openId: open?.id ?? null,
    steps: steps.filter((s) => s.round === rounds[0]),
    previousRounds: rounds.slice(1).map((x) => steps.filter((s) => s.round === x)),
    acks: canSeeProgress ? acks.map((a) => ({ userId: a.user_id, name: people.get(a.user_id)?.name ?? "-", acknowledgedAt: a.acknowledged_at })).sort((a, b) => a.name.localeCompare(b.name, "id")) : [],
    myAck: current && mine ? { revisionId: current.id, acknowledgedAt: mine.acknowledged_at } : null,
  };
}

/** Id dokumen dari id revisi (tautan approval /dokumen/revisi/<id>). */
export async function documentIdOfRevision(supabase: ServerClient, revisionId: string): Promise<string | null> {
  const { data } = await supabase.from("document_revisions").select("document_id").eq("id", revisionId).maybeSingle();
  return data?.document_id ?? null;
}

// ---------------------------------------------------------------- peraturan
export type RegulationRow = {
  id: string;
  code: string;
  title: string;
  issuer: string | null;
  issuedOn: string | null;
  isActive: boolean;
  evaluations: { id: string; clause: string; requirement: string; compliance: string; evaluatedOn: string; followUp: string | null; nextReview: Expiry; siteId: string; findingId: string | null; findingCode: string | null }[];
};

export async function listRegulations(supabase: ServerClient, p: { q: string; site: SiteChoice; compliance: string }): Promise<RegulationRow[]> {
  const today = todayWibIso();
  const [{ data: regs, error }, { data: evs }] = await Promise.all([
    supabase.from("regulations").select("id, code, title, issuer, issued_on, is_active").order("code").limit(300),
    supabase.from("regulation_evaluations").select("id, regulation_id, location_id, clause, requirement, compliance, evaluated_on, follow_up, next_review_on, finding_id").order("evaluated_on", { ascending: false }).limit(2000),
  ]);
  if (error) throw error;
  const fids = [...new Set((evs ?? []).map((e) => e.finding_id).filter((x): x is string => !!x))];
  const { data: fs } = fids.length ? await supabase.from("findings").select("id, code").in("id", fids) : { data: [] };
  const fcode = new Map((fs ?? []).map((f) => [f.id, f.code]));
  const needle = p.q.toLowerCase();
  return (regs ?? [])
    .map((r) => ({
      id: r.id,
      code: r.code,
      title: r.title,
      issuer: r.issuer,
      issuedOn: r.issued_on,
      isActive: r.is_active,
      evaluations: (evs ?? [])
        .filter((e) => e.regulation_id === r.id && (!p.site || e.location_id === p.site) && (!p.compliance || p.compliance === "semua" || e.compliance === p.compliance))
        .map((e) => ({ id: e.id, clause: e.clause, requirement: e.requirement, compliance: e.compliance, evaluatedOn: e.evaluated_on, followUp: e.follow_up, nextReview: expiryOf(e.next_review_on, today), siteId: e.location_id, findingId: e.finding_id, findingCode: e.finding_id ? (fcode.get(e.finding_id) ?? null) : null })),
    }))
    .filter((r) => !needle || `${r.code} ${r.title}`.toLowerCase().includes(needle))
    .filter((r) => !p.compliance || p.compliance === "semua" || r.evaluations.length > 0);
}

// ---------------------------------------------------------------- register KO
export type KoParams = { site: SiteChoice; filter: (typeof KO_FILTERS)[number]; q: string };
export function parseKoParams(sp: SearchParams, site: SiteChoice): KoParams {
  return { site, filter: enumParam(sp, "status", KO_FILTERS, "semua"), q: textParam(sp, "q") };
}
export type KoRow = { id: string; code: string; title: string; kind: string; number: string | null; ownerId: string | null; ownerName: string | null; validUntil: string; expiry: Expiry; isActive: boolean; notes: string | null; evidence: number; siteId: string; companyCode: string };

export async function listKo(supabase: ServerClient, p: KoParams): Promise<KoRow[]> {
  const today = todayWibIso();
  let q = supabase.from("ko_register").select("id, code, title, kind, number, owner_id, valid_until, is_active, notes, evidence_count, location_id, company_code").order("valid_until");
  if (p.site) q = q.eq("location_id", p.site);
  const { data, error } = await q.limit(500);
  if (error) throw error;
  const owners = await getPeople(supabase, (data ?? []).map((k) => k.owner_id));
  const needle = p.q.toLowerCase();
  return (data ?? [])
    .map((k) => ({ id: k.id, code: k.code, title: k.title, kind: k.kind, number: k.number, ownerId: k.owner_id, ownerName: k.owner_id ? (owners.get(k.owner_id)?.name ?? null) : null, validUntil: k.valid_until, expiry: expiryOf(k.valid_until, today), isActive: k.is_active, notes: k.notes, evidence: k.evidence_count, siteId: k.location_id, companyCode: k.company_code }))
    .filter((k) => k.isActive && (!needle || `${k.code} ${k.title} ${k.number ?? ""}`.toLowerCase().includes(needle)))
    .filter((k) => p.filter === "semua" || k.expiry.state === p.filter);
}
