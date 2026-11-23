import type { Metadata } from "next";
import Link from "next/link";
import { NoOffline } from "@/components/pwa/pwa-support";
import { PageHeader } from "@/components/page-header";
import { requireAccess } from "@/lib/auth";
import { countMasters, getMasterOptions, listMaster } from "@/lib/master";
import { isMasterKind, MASTER_CONFIG, MASTER_KINDS, type MasterKind } from "@/lib/master-rules";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { MasterView } from "./master-view";

export const metadata: Metadata = { title: "Master Data" };

// Master Data (rancangan §4.13): satu halaman dengan pemilih jenis (param URL `jenis`). Master milik
// app bisa ditambah/diubah admin; site & jabatan hanya ditampilkan (dikelola di platform). Unit
// dibaca dari sistem maintenance (fase 5).
export default async function MasterPage({ searchParams }: PageProps<"/master">) {
  await requireAccess("admin");
  const sp = await searchParams;
  const kind: MasterKind = isMasterKind(sp.jenis) ? sp.jenis : "area";
  const supabase = await createClient();
  const [rows, options, counts] = await Promise.all([listMaster(supabase, kind), getMasterOptions(supabase), countMasters(supabase)]);

  return (
    <>
      <NoOffline />
      <PageHeader title="Master Data" description="Data acuan yang dipakai form dan laporan di semua modul." />
      <nav aria-label="Jenis master" className="col-span-12 -mt-2 flex gap-1 overflow-x-auto pb-1">
        {MASTER_KINDS.map((k) => (
          <Link
            key={k}
            href={`/master?jenis=${k}`}
            aria-current={k === kind ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors hover:bg-accent",
              k === kind && "border-primary bg-primary/10 font-medium text-primary hover:bg-primary/10",
            )}
          >
            {MASTER_CONFIG[k].label}
            <span className="rounded-full bg-muted px-1.5 text-[11px] text-muted-foreground tabular-nums">{counts[k]}</span>
          </Link>
        ))}
      </nav>
      <MasterView key={kind} kind={kind} rows={rows} options={options} />
      <p className="col-span-12 text-xs text-muted-foreground">
        Unit (kode unit &amp; model) dibaca dari sistem maintenance yang sudah ada, tidak dikelola di app ini.
      </p>
    </>
  );
}
