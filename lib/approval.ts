// Loader halaman approval (server): antrian Approval Saya, riwayat keputusan, template, kepala
// departemen. Ringkasan dokumen per jenis lewat DOC_SUMMARY (tambah baris untuk dokumen baru).
import "server-only";
import { getPeople } from "@/lib/people";
import type { ServerClient } from "@/lib/supabase/server";

export type DocSummary = { code: string | null; title: string; amount: number | null; companyCode: string; requester: { id: string; name: string; avatarUrl: string | null } | null };

/** Ringkasan dokumen per doc_type (kode, judul, nominal, pemohon). Dokumen baru: tambah di sini. */
const DOC_SUMMARY: Record<string, (s: ServerClient, ids: string[]) => Promise<{ id: string; code: string | null; title: string; amount: number | null; companyCode: string; requesterId: string | null }[]>> = {
  // CONTOH boilerplate (hapus bersama /pengajuan)
  pengajuan: async (s, ids) => {
    const { data } = await s.from("pengajuan").select("id, code, title, total_amount, company_code, created_by").in("id", ids);
    return (data ?? []).map((d) => ({ id: d.id, code: d.code, title: d.title, amount: Number(d.total_amount), companyCode: d.company_code, requesterId: d.created_by }));
  },
};

async function summaries(supabase: ServerClient, refs: { docType: string; recordId: string }[]) {
  const byType = new Map<string, string[]>();
  refs.forEach((r) => byType.set(r.docType, [...(byType.get(r.docType) ?? []), r.recordId]));
  const raw = (await Promise.all([...byType].map(async ([t, ids]) => ((await DOC_SUMMARY[t]?.(supabase, [...new Set(ids)])) ?? []).map((d) => ({ ...d, docType: t }))))).flat();
  const people = await getPeople(supabase, raw.map((d) => d.requesterId));
  const map = new Map<string, DocSummary>();
  raw.forEach((d) => {
    const p = d.requesterId ? people.get(d.requesterId) : null;
    map.set(`${d.docType}:${d.id}`, { code: d.code, title: d.title, amount: d.amount, companyCode: d.companyCode, requester: p ? { id: p.id, name: p.name, avatarUrl: p.avatarUrl } : null });
  });
  return map;
}

export type QueueItem = {
  approvalId: string;
  docType: string;
  docLabel: string;
  recordId: string;
  stepNo: number;
  approvalType: string;
  waitingSince: string;
  dueAt: string | null;
  href: string;
  followupCount: number;
  lastFollowupAt: string | null;
  doc: DocSummary | null;
};

/** Antrian dari pending_for_me() (urut follow-up terbanyak lalu terlama). */
export async function getMyQueue(supabase: ServerClient): Promise<QueueItem[]> {
  const { data, error } = await supabase.rpc("pending_for_me", { p_limit: 200 });
  if (error) throw error;
  const rows = data ?? [];
  const docs = await summaries(supabase, rows.map((r) => ({ docType: r.doc_type, recordId: r.record_id })));
  return rows.map((r) => ({
    approvalId: r.approval_id,
    docType: r.doc_type,
    docLabel: r.doc_label,
    recordId: r.record_id,
    stepNo: r.step_no,
    approvalType: r.approval_type,
    waitingSince: r.waiting_since,
    dueAt: r.due_at,
    href: r.href,
    followupCount: r.followup_count,
    lastFollowupAt: r.last_followup_at,
    doc: docs.get(`${r.doc_type}:${r.record_id}`) ?? null,
  }));
}

export type DecisionItem = { id: string; docType: string; recordId: string; status: string; note: string | null; decidedAt: string | null; approvalType: string; round: number; href: string; doc: DocSummary | null };

/** 20 keputusan terakhir user ini. */
export async function getMyDecisions(supabase: ServerClient, userId: string): Promise<DecisionItem[]> {
  const [{ data }, { data: types }] = await Promise.all([
    supabase.from("approvals").select("id, doc_type, record_id, status, note, decided_at, approval_type, round").eq("approver_id", userId).in("status", ["approved", "rejected"]).order("decided_at", { ascending: false }).limit(20),
    supabase.from("approval_doc_types").select("code, href_prefix"),
  ]);
  const prefix = new Map((types ?? []).map((t) => [t.code, t.href_prefix]));
  const docs = await summaries(supabase, (data ?? []).map((r) => ({ docType: r.doc_type, recordId: r.record_id })));
  return (data ?? []).map((r) => ({
    id: r.id,
    docType: r.doc_type,
    recordId: r.record_id,
    status: r.status,
    note: r.note,
    decidedAt: r.decided_at,
    approvalType: r.approval_type,
    round: r.round,
    href: `${prefix.get(r.doc_type) ?? "/"}${r.record_id}`,
    doc: docs.get(`${r.doc_type}:${r.record_id}`) ?? null,
  }));
}

// ---------------------------------------------------------------- template & kepala departemen

export type TemplateStep = { approval_type: string; approver_kind: "user" | "department_head"; approver_id: string | null; approver_name: string | null; due_hours: number | null };
export type ApprovalTemplate = {
  id: string;
  doc_type: string;
  name: string;
  description: string | null;
  company_code: string | null;
  department_id: string | null;
  min_amount: number | null;
  max_amount: number | null;
  priority: number;
  is_active: boolean;
  created_at: string;
  steps: TemplateStep[];
};

export async function getTemplates(supabase: ServerClient): Promise<ApprovalTemplate[]> {
  const { data, error } = await supabase
    .from("approval_templates")
    .select("id, doc_type, name, description, company_code, department_id, min_amount, max_amount, priority, is_active, created_at, approval_template_steps(step_no, approval_type, approver_kind, approver_id, due_hours)")
    .order("doc_type")
    .order("priority", { ascending: false })
    .order("created_at");
  if (error) throw error;
  const rows = data ?? [];
  const people = await getPeople(supabase, rows.flatMap((t) => t.approval_template_steps.map((s) => s.approver_id)));
  return rows.map((t) => ({
    id: t.id,
    doc_type: t.doc_type,
    name: t.name,
    description: t.description,
    company_code: t.company_code,
    department_id: t.department_id,
    min_amount: t.min_amount === null ? null : Number(t.min_amount),
    max_amount: t.max_amount === null ? null : Number(t.max_amount),
    priority: t.priority,
    is_active: t.is_active,
    created_at: t.created_at,
    steps: [...t.approval_template_steps]
      .sort((a, b) => a.step_no - b.step_no)
      .map((s) => ({
        approval_type: s.approval_type,
        approver_kind: s.approver_kind as TemplateStep["approver_kind"],
        approver_id: s.approver_id,
        approver_name: s.approver_id ? (people.get(s.approver_id)?.name ?? "(pengguna dihapus)") : null,
        due_hours: s.due_hours,
      })),
  }));
}

export async function getDocTypes(supabase: ServerClient) {
  const { data } = await supabase.from("approval_doc_types").select("code, label").eq("is_active", true).order("label");
  return (data ?? []).map((d) => ({ value: d.code, label: d.label }));
}

export type DepartmentHead = { departmentId: string; companyCode: string; userId: string; name: string };

export async function getDepartmentHeads(supabase: ServerClient): Promise<DepartmentHead[]> {
  const { data } = await supabase.from("department_heads").select("department_id, company_code, user_id");
  const people = await getPeople(supabase, (data ?? []).map((h) => h.user_id));
  return (data ?? []).map((h) => ({ departmentId: h.department_id, companyCode: h.company_code, userId: h.user_id, name: people.get(h.user_id)?.name ?? "(pengguna dihapus)" }));
}
