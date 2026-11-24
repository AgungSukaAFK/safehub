import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { StatusBadge } from "@/components/detail/status-badge";
import { ExpiryChip } from "@/components/expiry-chip";
import { Content } from "@/components/list/content";
import { PageHeader } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { requireAccess } from "@/lib/auth";
import { listContractors, parseContractorParams } from "@/lib/kontraktor";
import { CONTRACTOR_KINDS, CSMS_RESULT, LEGAL_FILTERS, LEGAL_STATE } from "@/lib/kontraktor-rules";
import { hrefWith } from "@/lib/search-params";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { ContractorSheet } from "./kontraktor-sheets";

export const metadata: Metadata = { title: "Kontraktor" };

const FILTER_LABEL: Record<(typeof LEGAL_FILTERS)[number], string> = { semua: "Semua", expiring: "Izin Akan Kedaluwarsa", expired: "Izin Kedaluwarsa", none: "Belum Ada Izin" };
const kindLabel = (k: string) => CONTRACTOR_KINDS.find((x) => x.value === k)?.label ?? k;

// Daftar kontraktor (rancangan §4.7): status legalitas (turunan izin), izin terdekat, kelengkapan dokumen, CSMS terakhir.
export default async function KontraktorPage({ searchParams }: PageProps<"/kontraktor">) {
  const access = await requireAccess("viewer");
  const isAdmin = access.role === "admin" || access.platformAdmin;
  if (!isAdmin && !access.functions.some((f) => f !== "karyawan")) redirect("/");
  const sp = await searchParams;
  const p = parseContractorParams(sp);
  const supabase = await createClient();
  const rows = await listContractors(supabase, p);
  const canManage = isAdmin || (!access.functions.includes("auditor") && (access.functions.includes("kontraktor_admin") || access.functions.includes("hse")));
  const href = (c: Record<string, string | null>) => hrefWith("/kontraktor", sp, c);
  const warn = rows.filter((r) => r.isActive && (r.legalState === "expired" || r.legalState === "expiring")).length;

  return (
    <>
      <PageHeader
        title="Kontraktor"
        description="Mitra subkontraktor dan vendor: legalitas, izin, kontrak, CSMS, dan personel"
        actions={
          <>
            <Link href="/pjo-pja" className="text-sm underline underline-offset-2">Register PJO/PJA</Link>
            {canManage && <ContractorSheet trigger={<Button><Plus /> Tambah Kontraktor</Button>} />}
          </>
        }
      />
      <section className="col-span-12 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Ringkasan kontraktor">
        <Stat label="Kontraktor aktif" value={rows.filter((r) => r.isActive).length} />
        <Stat label="Perlu perhatian izin" value={warn} warn={warn > 0} hint="kedaluwarsa atau ≤ 30 hari" />
        <Stat label="CSMS lulus" value={rows.filter((r) => r.csmsResult === "pass").length} />
        <Stat label="Kontrak berjalan" value={rows.reduce((s, r) => s + r.activeContracts, 0)} />
      </section>
      <div className="col-span-12 flex flex-wrap items-center gap-1.5">
        {LEGAL_FILTERS.map((f) => (
          <Link key={f} href={href({ legal: f === "semua" ? null : f })} aria-pressed={p.legal === f} className={cn("rounded-full border px-2.5 py-0.5 text-xs", p.legal === f ? "border-primary bg-primary/5 font-medium text-primary" : "hover:bg-accent")}>
            {FILTER_LABEL[f]}
          </Link>
        ))}
        <Link href={href({ nonaktif: p.nonaktif ? null : "1" })} aria-pressed={p.nonaktif} className={buttonVariants({ variant: p.nonaktif ? "default" : "outline", size: "sm" })}>Tampilkan nonaktif</Link>
        <form method="get" className="ml-auto flex gap-2">
          {p.legal !== "semua" && <input type="hidden" name="legal" value={p.legal} />}
          <input name="q" defaultValue={p.q} placeholder="Cari nama / PIC" aria-label="Cari" className="h-8 w-48 rounded-md border bg-background px-2 text-sm" />
        </form>
      </div>
      <Content title="Daftar Kontraktor" description={`${rows.length} kontraktor`}>
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Tidak ada kontraktor untuk filter ini.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[940px] text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>{["Nama", "Jenis", "Legalitas", "Izin Terdekat", "Dokumen", "CSMS", "Kontrak", "Personel"].map((h) => <th key={h} scope="col" className="px-3 py-2 text-left font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-accent/30">
                    <td className="px-3 py-2 font-medium">
                      <Link href={`/kontraktor/${r.id}`} className="underline underline-offset-2">{r.name}</Link>
                      {!r.isActive && <small className="ml-2 text-xs font-normal text-muted-foreground">(nonaktif)</small>}
                      {r.picName && <small className="block text-xs font-normal text-muted-foreground">PIC: {r.picName}</small>}
                    </td>
                    <td className="px-3 py-2">{kindLabel(r.kind)}</td>
                    <td className="px-3 py-2"><StatusBadge value={r.legalState} map={LEGAL_STATE} /></td>
                    <td className="px-3 py-2">{r.permitCount === 0 ? <span className="text-muted-foreground">-</span> : <ExpiryChip expiry={r.nearest} />}</td>
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums">{r.docsOk}/{r.docsTotal} lengkap</td>
                    <td className="px-3 py-2">{r.csmsResult ? <span className="flex flex-col gap-0.5"><StatusBadge value={r.csmsResult} map={CSMS_RESULT} />{r.csmsUntil.state === "expired" && <small className="text-xs text-red-600 dark:text-red-400">masa berlaku habis</small>}</span> : <span className="text-muted-foreground">Belum dinilai</span>}</td>
                    <td className="px-3 py-2 tabular-nums">{r.activeContracts}</td>
                    <td className="px-3 py-2 tabular-nums">{r.personnel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Content>
    </>
  );
}

function Stat({ label, value, hint, warn }: { label: string; value: number; hint?: string; warn?: boolean }) {
  return (
    <div className={cn("rounded-xl border bg-card p-4", warn && "border-amber-300 dark:border-amber-900")}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <strong className="block text-3xl tabular-nums">{value}</strong>
      {hint && <small className="text-xs text-muted-foreground">{hint}</small>}
    </div>
  );
}
