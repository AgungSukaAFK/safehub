import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/auth";
import { getK3Masters, getK3People, masterStatusMap, labelOf } from "@/lib/k3";
import { getTemuanDetail } from "@/lib/temuan";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";
import { TemuanDetailView } from "./temuan-detail";

export async function generateMetadata({ params }: PageProps<"/temuan/[id]">): Promise<Metadata> {
  const { id } = await params;
  if (!isUuid(id)) return { title: "Temuan" };
  const supabase = await createClient();
  const { data } = await supabase.from("findings").select("code, title").eq("id", id).maybeSingle();
  return { title: data ? data.code : "Temuan" };
}

// Detail temuan: RLS memastikan hanya temuan dalam scope (company + site; Karyawan = PIC/pembuat).
export default async function TemuanDetailPage({ params, searchParams }: PageProps<"/temuan/[id]">) {
  const access = await requireAccess("viewer");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const doc = await getTemuanDetail(supabase, id);
  if (!doc) notFound();
  const [masters, people] = await Promise.all([getK3Masters(supabase), getK3People(supabase)]);
  const sp = await searchParams;
  const isHse = access.functions.includes("hse");
  const isPjo = access.functions.includes("pjo");
  const isAuditor = access.functions.includes("auditor");
  const isOwner = doc.createdById === access.userId;
  const writer = !isAuditor;

  return (
    <TemuanDetailView
      doc={doc}
      riskMap={masterStatusMap(masters.riskLevels)}
      categoryLabel={labelOf(masters.findingCategories, doc.category) ?? doc.category}
      people={people.map((p) => ({ value: p.value, label: p.label, description: p.description }))}
      tab={sp.tab === "lampiran" || sp.tab === "riwayat" ? sp.tab : "detail"}
      focusCode={typeof sp.tindakan === "string" ? sp.tindakan : null}
      viewer={{
        userId: access.userId,
        canAdd: writer && (isOwner || isHse || isPjo),
        canManage: writer && (isHse || isOwner || isPjo),
        isHse: writer && isHse,
      }}
      canEdit={writer && (isOwner || isHse) && doc.status !== "closed"}
      canClose={writer && isHse && doc.status !== "closed"}
      canUpload={writer && (isOwner || isHse || doc.pic?.id === access.userId) && doc.status !== "closed"}
    />
  );
}
