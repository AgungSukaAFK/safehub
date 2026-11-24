import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/auth";
import { getK3Masters } from "@/lib/k3";
import { getReportDetail } from "@/lib/laporan";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";
import { LaporanView } from "./laporan-view";

export async function generateMetadata({ params }: PageProps<"/laporan/[id]">): Promise<Metadata> {
  const { id } = await params;
  if (!isUuid(id)) return { title: "Laporan" };
  const supabase = await createClient();
  const { data } = await supabase.from("reports").select("code").eq("id", id).maybeSingle();
  return { title: data?.code ?? "Laporan" };
}

// Detail Laporan Periode: workspace (draf/review) atau tampilan snapshot terkunci (terbit). RLS: di luar scope = 404.
export default async function LaporanDetailPage({ params, searchParams }: PageProps<"/laporan/[id]">) {
  const access = await requireAccess("viewer");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const sp = await searchParams;
  const versi = typeof sp.versi === "string" && /^\d+\.\d+$/.test(sp.versi) ? sp.versi : null;
  const supabase = await createClient();
  const [doc, masters] = await Promise.all([getReportDetail(supabase, id, access.userId, versi), getK3Masters(supabase)]);
  if (!doc) notFound();
  const staffEditor = access.role === "admin" || access.platformAdmin || (access.functions.includes("hse") && !access.functions.includes("auditor"));
  return (
    <LaporanView
      doc={doc}
      userId={access.userId}
      canEdit={staffEditor}
      incidentCategories={Object.fromEntries(masters.incidentCategories.map((c) => [c.value, c.label]))}
      inspectionTypes={Object.fromEntries(masters.inspectionTypes.map((c) => [c.value, c.label]))}
    />
  );
}
