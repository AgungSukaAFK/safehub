// Tugas Saya (rancangan §2.11, §4.11). SATU sumber: RPC my_tasks() (approval engine + tugas workflow
// tiap modul). Baris approval diperkaya ringkasan dokumen dari DOC_SUMMARY (lib/approval.ts).
import "server-only";
import { getDocSummaries, type QueueItem } from "@/lib/approval";
import type { ServerClient } from "@/lib/supabase/server";

export const TASK_GROUPS = ["action", "verification", "approval", "scheduled"] as const;
export type TaskGroup = (typeof TASK_GROUPS)[number];

export const TASK_GROUP_LABELS: Record<TaskGroup, { title: string; description: string }> = {
  action: { title: "Perlu Tindakan", description: "Pekerjaan yang ditugaskan kepada Anda." },
  verification: { title: "Menunggu Verifikasi", description: "Bukti atau hasil yang perlu Anda periksa." },
  approval: { title: "Approval", description: "Dokumen yang menunggu keputusan Anda." },
  scheduled: { title: "Terjadwal", description: "Kegiatan terjadwal yang menjadi tanggung jawab Anda." },
};

/** Tugas workflow (bukan approval). Approval memakai QueueItem supaya tampilannya sama. */
export type TaskItem = {
  kind: string;
  group: TaskGroup;
  refType: string;
  refId: string;
  code: string | null;
  title: string;
  status: string;
  dueAt: string | null;
  waitingSince: string | null;
  href: string;
};

export type MyTasks = {
  total: number;
  approvals: QueueItem[];
  /** others.approval = persetujuan workflow modul (mis. review kejadian), bukan approval engine */
  others: Record<TaskGroup, TaskItem[]>;
};

type Meta = { approval_id?: string; step_no?: number; followup_count?: number; last_followup_at?: string | null };

export async function getMyTasks(supabase: ServerClient): Promise<MyTasks> {
  const { data, error } = await supabase.rpc("my_tasks", { p_limit: 500 });
  if (error) throw error;
  const rows = data ?? [];

  const approvalRows = rows.filter((r) => r.kind === "approval");
  const docs = await getDocSummaries(supabase, approvalRows.map((r) => ({ docType: r.ref_type, recordId: r.ref_id })));
  const approvals: QueueItem[] = approvalRows
    .map((r) => {
      const m = (r.meta ?? {}) as Meta;
      return {
        approvalId: m.approval_id ?? r.ref_id,
        docType: r.ref_type,
        docLabel: r.title,
        recordId: r.ref_id,
        stepNo: m.step_no ?? 1,
        approvalType: r.status,
        waitingSince: r.waiting_since,
        dueAt: r.due_at ?? null,
        href: r.href,
        followupCount: m.followup_count ?? 0,
        lastFollowupAt: m.last_followup_at ?? null,
        doc: docs.get(`${r.ref_type}:${r.ref_id}`) ?? null,
      };
    })
    // urutan antrian approval: follow-up terbanyak, lalu paling lama menunggu
    .sort((a, b) => b.followupCount - a.followupCount || a.waitingSince.localeCompare(b.waitingSince));

  const others: MyTasks["others"] = { action: [], verification: [], approval: [], scheduled: [] };
  for (const r of rows) {
    if (r.kind === "approval") continue;
    const group = r.task_group as TaskGroup;
    if (!(group in others)) continue;
    others[group].push({
      kind: r.kind,
      group,
      refType: r.ref_type,
      refId: r.ref_id,
      code: r.code ?? null,
      title: r.title,
      status: r.status,
      dueAt: r.due_at ?? null,
      waitingSince: r.waiting_since ?? null,
      href: r.href,
    });
  }

  return { total: rows.length, approvals, others };
}
