import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/auth";
import { getCompanies } from "@/lib/companies";
import { getPengajuanDetail } from "@/lib/pengajuan";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";
import { PengajuanDetailView } from "./pengajuan-detail";

export async function generateMetadata({ params }: PageProps<"/pengajuan/[id]">): Promise<Metadata> {
  const { id } = await params;
  if (!isUuid(id)) return { title: "Pengajuan" };
  const supabase = await createClient();
  const { data } = await supabase.from("pengajuan").select("code, title").eq("id", id).maybeSingle();
  return { title: data ? (data.code ?? `Draft: ${data.title}`) : "Pengajuan" };
}

// CONTOH boilerplate: halaman detail dokumen dengan approval. RLS memastikan user hanya melihat
// dokumen dalam scope company-nya (dokumen di luar scope = 404, bukan "akses ditolak").
export default async function PengajuanDetailPage({ params, searchParams }: PageProps<"/pengajuan/[id]">) {
  const access = await requireAccess("viewer");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const doc = await getPengajuanDetail(supabase, id, access.userId);
  if (!doc) notFound();
  const company = (await getCompanies()).find((c) => c.code === doc.companyCode) ?? null;
  const cetak = (await searchParams).cetak;

  return (
    <PengajuanDetailView
      doc={doc}
      company={company}
      userId={access.userId}
      role={access.role}
      printedBy={access.profile.fullName}
      autoPrint={cetak === "qr" || cetak === "basah" ? cetak : null}
    />
  );
}
