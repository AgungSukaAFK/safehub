import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Content } from "@/components/list/content";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireAccess } from "@/lib/auth";
import { getAreas, listObservations } from "@/lib/inspeksi";
import { parseSiteParam } from "@/lib/sites";
import { createClient } from "@/lib/supabase/server";
import { ObservasiTable } from "./observasi-table";

export const metadata: Metadata = { title: "Observasi KTA/TTA" };

export default async function ObservasiPage({ searchParams }: PageProps<"/observasi">) {
  const access = await requireAccess("viewer");
  const sp = await searchParams;
  const { siteId, label } = await parseSiteParam(sp, access);
  const supabase = await createClient();
  const areas = await getAreas(supabase);
  const rows = await listObservations(supabase, siteId, areas);
  const canReport = !access.functions.includes("auditor");
  return (
    <>
      <PageHeader
        title="Observasi KTA/TTA"
        description={`Kondisi dan tindakan tidak aman yang diamati di lapangan · ${label}`}
        actions={
          canReport && (
            <Link href="/observasi/baru" className={buttonVariants()}>
              <Plus /> Lapor Observasi
            </Link>
          )
        }
      />
      <Content>
        <ObservasiTable rows={rows} canReport={canReport} />
      </Content>
    </>
  );
}
