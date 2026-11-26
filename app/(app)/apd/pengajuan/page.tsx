import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { StatusBadge } from "@/components/detail/status-badge";
import { Content } from "@/components/list/content";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { listRequests, parseRequestParams } from "@/lib/apd";
import { FULFILLMENT, REASON_LABELS, REQUEST_FILTER_LABELS, REQUEST_STATUS, REQUEST_STATUS_FILTERS, type Reason } from "@/lib/apd-rules";
import { requireAccess } from "@/lib/auth";
import { formatDate, formatNumber } from "@/lib/format";
import { hrefWith } from "@/lib/search-params";
import { parseSiteParam } from "@/lib/sites";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Pengajuan APD" };

// Daftar Pengajuan APD (pengganti sheet MTR MR): status approval + pemenuhan (OS, lead time). RLS: staf melihat site dalam scope,
// karyawan hanya miliknya.
export default async function ApdRequestsPage({ searchParams }: PageProps<"/apd/pengajuan">) {
  const access = await requireAccess("viewer");
  const sp = await searchParams;
  const { siteId, label } = await parseSiteParam(sp, access);
  const p = parseRequestParams(sp);
  const supabase = await createClient();
  const rows = await listRequests(supabase, p, siteId);
  const isStaff = access.role === "admin" || access.platformAdmin || access.functions.some((f) => f !== "karyawan");
  const canCreate = !access.functions.includes("auditor");
  const href = (c: Record<string, string | null>) => hrefWith("/apd/pengajuan", sp, c);
  const open = rows.filter((r) => r.status === "approved" && r.outstanding > 0).length;

  return (
    <>
      <PageHeader
        title="Pengajuan APD"
        description={`Permintaan APD baru, berkala, rusak, dan hilang · ${label}`}
        actions={
          <>
            <Link href={isStaff ? "/apd" : "/apd/saya"} className="text-sm underline underline-offset-2">{isStaff ? "Monitoring APD" : "APD Saya"}</Link>
            {canCreate && <Link href="/apd/pengajuan/baru" className={buttonVariants()}><Plus /> Ajukan APD</Link>}
          </>
        }
      />
      <div className="col-span-12 flex flex-wrap items-center gap-1.5">
        {REQUEST_STATUS_FILTERS.map((s) => (
          <Link key={s} href={href({ status: s === "semua" ? null : s })} aria-pressed={p.status === s} className={cn("rounded-full border px-2.5 py-0.5 text-xs", p.status === s ? "border-primary bg-primary/5 font-medium text-primary" : "hover:bg-accent")}>
            {REQUEST_FILTER_LABELS[s]}
          </Link>
        ))}
        <form method="get" className="ml-auto flex gap-2">
          {p.status !== "semua" && <input type="hidden" name="status" value={p.status} />}
          <input name="q" defaultValue={p.q} placeholder="Cari nomor / nama / no MR" aria-label="Cari pengajuan" className="h-8 w-56 rounded-md border bg-background px-2 text-sm" />
        </form>
      </div>
      <Content title="Daftar Pengajuan" description={`${rows.length} pengajuan · ${open} belum terpenuhi`}>
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Belum ada pengajuan untuk filter ini.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>{["Nomor", "Karyawan", "Site", "Alasan", "Tanggal", "Status", "Pemenuhan", "OS", "Lead time"].map((h) => <th key={h} scope="col" className={cn("px-3 py-2 font-medium", ["OS", "Lead time"].includes(h) ? "text-right" : "text-left")}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-accent/30">
                    <td className="px-3 py-2 whitespace-nowrap"><Link href={`/apd/pengajuan/${r.id}`} className="font-medium tabular-nums underline underline-offset-2">{r.code}</Link>{r.mrNo && <small className="block text-xs text-muted-foreground">{r.mrNo}</small>}</td>
                    <td className="px-3 py-2">{r.recipient}<small className="block text-xs text-muted-foreground">{r.jobTitle ?? (r.source === "import" ? "Data lama Excel" : "-")} · {r.lines} jenis</small></td>
                    <td className="px-3 py-2">{r.site}</td>
                    <td className="px-3 py-2">{REASON_LABELS[r.reason as Reason] ?? r.reason}</td>
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums">{r.requestedOn ? formatDate(r.requestedOn) : <span className="text-muted-foreground">{r.source === "import" ? "Tidak tercatat" : `Draf ${formatDate(r.createdAt)}`}</span>}</td>
                    <td className="px-3 py-2"><StatusBadge value={r.status} map={REQUEST_STATUS} /></td>
                    <td className="px-3 py-2">{r.status === "approved" ? <StatusBadge value={r.fulfillment} map={FULFILLMENT} /> : <span className="text-muted-foreground">-</span>}</td>
                    <td className={cn("px-3 py-2 text-right tabular-nums", r.status === "approved" && r.outstanding > 0 && "font-semibold text-amber-700 dark:text-amber-400")}>{r.status === "approved" ? `${formatNumber(r.outstanding)}/${formatNumber(r.qtyTotal)}` : "-"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.leadDays !== null ? `${r.leadDays} hari` : "-"}</td>
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
