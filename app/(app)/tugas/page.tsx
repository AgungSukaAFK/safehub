import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { getMyDecisions } from "@/lib/approval";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMyTasks, TASK_GROUP_LABELS } from "@/lib/tasks";
import { ApprovalQueue, DecisionHistory } from "./approval-queue";
import { TaskList, TasksBadgeSync, TasksEmpty } from "./tasks-view";

export const metadata: Metadata = { title: "Tugas Saya" };

// Tugas Saya (rancangan §4.11): satu sumber my_tasks(), dikelompokkan Perlu Tindakan → Menunggu
// Verifikasi → Approval → Terjadwal. Menggantikan "Approval Saya" (/approval → redirect ke sini).
// Notifikasi baru di halaman ini memicu router.refresh() (NotificationProvider).
export default async function TugasPage() {
  const access = await requireAccess("viewer");
  const supabase = await createClient();
  const [tasks, decisions] = await Promise.all([getMyTasks(supabase), getMyDecisions(supabase, access.userId)]);
  const L = TASK_GROUP_LABELS;

  return (
    <>
      <TasksBadgeSync total={tasks.total} />
      <PageHeader title="Tugas Saya" description="Yang perlu tindakan, verifikasi, dan keputusan Anda. Buka item untuk memprosesnya." />
      {tasks.total === 0 && <TasksEmpty />}
      <TaskList title={L.action.title} description={L.action.description} items={tasks.others.action} />
      <TaskList title={L.verification.title} description={L.verification.description} items={tasks.others.verification} />
      <ApprovalQueue items={tasks.approvals} />
      <TaskList title={L.scheduled.title} description={L.scheduled.description} items={tasks.others.scheduled} />
      <DecisionHistory items={decisions} />
    </>
  );
}
