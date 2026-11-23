import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/auth";
import { getInspectionDetail } from "@/lib/inspeksi";
import { getK3Masters, getK3People, todayWibIso } from "@/lib/k3";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";
import { InspeksiDetailView, type InspectionPerms } from "./inspeksi-detail";

export async function generateMetadata({ params }: PageProps<"/inspeksi/[id]">): Promise<Metadata> {
  const { id } = await params;
  if (!isUuid(id)) return { title: "Inspeksi" };
  const supabase = await createClient();
  const { data } = await supabase.from("inspections").select("code").eq("id", id).maybeSingle();
  return { title: data?.code ?? "Inspeksi" };
}

export default async function InspeksiDetailPage({ params }: PageProps<"/inspeksi/[id]">) {
  const access = await requireAccess("viewer");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const doc = await getInspectionDetail(supabase, id);
  if (!doc) notFound();
  const [masters, people] = await Promise.all([getK3Masters(supabase), getK3People(supabase)]);

  // izin per peran: cermin pemeriksaan RPC (DB tetap penjaga terakhir)
  const writer = !access.functions.includes("auditor");
  const isInspector = doc.inspector?.id === access.userId;
  const isHse = access.functions.includes("hse");
  const perms: InspectionPerms = {
    userId: access.userId,
    isInspector,
    canStart: writer && isInspector && doc.status === "scheduled",
    canFill: writer && isInspector && doc.status === "in_progress",
    canVerify: writer && isHse && !isInspector && doc.status === "submitted",
    canCancel: writer && (isHse || doc.creator?.id === access.userId) && (doc.status === "scheduled" || doc.status === "in_progress"),
    // temuan dari inspeksi dibuat oleh pemeriksa: wajib salah satu fungsi ini (RPC inspection_submit)
    canCreateFindings: writer && (isHse || access.functions.includes("pengawas") || access.functions.includes("pjo")),
  };

  return (
    <InspeksiDetailView
      doc={doc}
      perms={perms}
      riskOptions={masters.riskLevels.filter((r) => r.isActive).map((r) => ({ value: r.value, label: r.label }))}
      people={people.map((p) => ({ value: p.value, label: p.label, description: p.description }))}
      today={todayWibIso()}
    />
  );
}
