import type { Metadata } from "next";
import { NoOffline } from "@/components/pwa/pwa-support";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/auth";
import { listPengajuanByUser } from "@/lib/pengajuan";
import { getDirectoryMasters, getPenggunaDetail } from "@/lib/pengguna";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";
import { PenggunaDetailView } from "./pengguna-detail";

export async function generateMetadata({ params }: PageProps<"/pengguna/[id]">): Promise<Metadata> {
  const { id } = await params;
  if (!isUuid(id)) return { title: "Pengguna" };
  const supabase = await createClient();
  const { data } = await supabase.schema("public").from("profiles").select("full_name").eq("id", id).maybeSingle();
  return { title: data?.full_name ?? "Pengguna" };
}

// Detail satu orang (frontend-guide §15.2): profil dasar (read-only, dari platform), role app,
// data members yang bisa diubah admin, dan dokumen miliknya di app ini.
export default async function PenggunaDetailPage({ params }: PageProps<"/pengguna/[id]">) {
  const access = await requireAccess("admin");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const [detail, docs, masters] = await Promise.all([getPenggunaDetail(supabase, id), listPengajuanByUser(supabase, id), getDirectoryMasters(supabase)]);
  if (!detail) notFound();

  return (
    <>
      <NoOffline />
      <PenggunaDetailView detail={detail} docs={docs} sites={masters.locations} currentUserId={access.userId} />
    </>
  );
}
