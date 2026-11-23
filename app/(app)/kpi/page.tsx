import type { Metadata } from "next";
import Link from "next/link";
import { Clock } from "lucide-react";
import { StatusBadge } from "@/components/detail/status-badge";
import { Content } from "@/components/list/content";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireAccess } from "@/lib/auth";
import { listKpis } from "@/lib/kpi";
import { KPI_DIRECTION_LABEL, KPI_STATUS_MAP } from "@/lib/kpi-rules";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Kamus KPI" };

// Kamus KPI (rancangan §2.8): definisi, rumus, sumber, pemilik. KPI draf selalu berbadge "Rumus belum disahkan".
export default async function KpiPage() {
  const access = await requireAccess("viewer");
  const kpis = await listKpis(await createClient());
  const canHours = access.role === "admin" || access.platformAdmin || (access.functions.includes("hse") && !access.functions.includes("auditor"));
  return (
    <>
      <PageHeader
        title="Kamus KPI"
        description="Definisi, rumus, sumber data, dan pemilik setiap indikator di Beranda dan Laporan."
        actions={
          canHours && (
            <Link href="/kpi/jam-kerja" className={buttonVariants({ variant: "outline" })}>
              <Clock /> Jam Kerja
            </Link>
          )
        }
      />
      <Content>
        <ul className="divide-y rounded-lg border">
          {kpis.map((k) => (
            <li key={k.code}>
              <Link href={`/kpi/${k.code}`} className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-accent/50 md:flex-row md:items-center md:gap-4">
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <strong>{k.name}</strong>
                    <StatusBadge value={k.status} map={KPI_STATUS_MAP} />
                    <span className="text-xs text-muted-foreground">v{k.version}</span>
                  </span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{k.definition}</span>
                  <code className="mt-1 block text-xs">{k.formula}</code>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground md:w-52 md:text-right">
                  Pemilik: {k.owner ?? "-"}
                  <span className="block">{k.unit ?? ""} · {KPI_DIRECTION_LABEL[k.direction]}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Content>
    </>
  );
}
