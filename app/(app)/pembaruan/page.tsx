import type { Metadata } from "next";
import Link from "next/link";
import { PenSquare } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { listUpdates } from "@/lib/updates";
import { UpdatesList } from "./updates-list";

export const metadata: Metadata = { title: "Pembaruan" };

// Pembaruan / Update Web (frontend-guide §20.1): changelog & pengumuman app. Hanya admin yang menulis.
export default async function PembaruanPage({ searchParams }: PageProps<"/pembaruan">) {
  const access = await requireAccess("viewer");
  const sp = await searchParams;
  const supabase = await createClient();
  const { posts } = await listUpdates(supabase, access.userId);
  const isAdmin = access.role === "admin";
  const openId = Number(typeof sp.id === "string" ? sp.id : NaN);

  return (
    <>
      <PageHeader
        title="Pembaruan"
        description="Apa yang baru di app ini: fitur, perbaikan, dan pengumuman."
        actions={
          isAdmin && (
            <Link href="/pembaruan/baru" className={buttonVariants()}>
              <PenSquare /> Tulis Pembaruan
            </Link>
          )
        }
      />
      <UpdatesList posts={posts} isAdmin={isAdmin} openId={Number.isInteger(openId) ? openId : null} />
    </>
  );
}
