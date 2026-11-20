import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { getMyDecisions, getMyQueue } from "@/lib/approval";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ApprovalQueue, DecisionHistory } from "./approval-queue";

export const metadata: Metadata = { title: "Approval Saya" };

// Antrian approval user (frontend-guide §10.4): dikelompokkan per jenis dokumen, urut follow-up
// terbanyak lalu terlama. Notifikasi baru di halaman ini memicu router.refresh() (NotificationProvider).
export default async function ApprovalPage() {
  const access = await requireAccess("viewer");
  const supabase = await createClient();
  const [queue, decisions] = await Promise.all([getMyQueue(supabase), getMyDecisions(supabase, access.userId)]);

  return (
    <>
      <PageHeader title="Approval Saya" description="Dokumen yang menunggu keputusan Anda. Buka dokumen untuk menyetujui atau menolak." />
      <ApprovalQueue items={queue} />
      <DecisionHistory items={decisions} />
    </>
  );
}
