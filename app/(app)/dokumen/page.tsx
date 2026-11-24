import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { StatusBadge } from "@/components/detail/status-badge";
import { ExpiryChip } from "@/components/expiry-chip";
import { Content } from "@/components/list/content";
import { PageHeader } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { requireAccess } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { listDocuments, parseDocParams } from "@/lib/dokumen";
import { DOC_KIND_FILTERS, DOCUMENT_STATE, REVISION_STATUS, docKindLabel } from "@/lib/dokumen-rules";
import { getK3People } from "@/lib/k3";
import { hrefWith } from "@/lib/search-params";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { DocumentSheet } from "./dokumen-sheets";

export const metadata: Metadata = { title: "Prosedur & Dokumen" };

const KIND_LABEL: Record<(typeof DOC_KIND_FILTERS)[number], string> = { semua: "Semua", sop: "SOP", ik: "IK", form: "Form" };

// Register dokumen terkendali (rancangan §4.8). Karyawan melihat dokumen yang terbit dan pengakuan baca miliknya;
// staf K3 juga melihat revisi berjalan dan progres pengakuan.
export default async function DokumenPage({ searchParams }: PageProps<"/dokumen">) {
  const access = await requireAccess("viewer");
  const isAdmin = access.role === "admin" || access.platformAdmin;
  const staff = isAdmin || access.functions.some((f) => f !== "karyawan");
  const canManage = isAdmin || (!access.functions.includes("auditor") && (access.functions.includes("hse") || access.functions.includes("hse_senior")));
  const sp = await searchParams;
  const p = parseDocParams(sp);
  const supabase = await createClient();
  const [rows, people, titles] = await Promise.all([
    listDocuments(supabase, p),
    canManage ? getK3People(supabase) : Promise.resolve([]),
    canManage ? supabase.from("employees").select("job_title").eq("status", "active") : Promise.resolve({ data: [] as { job_title: string }[] }),
  ]);
  const href = (c: Record<string, string | null>) => hrefWith("/dokumen", sp, c);
  const pending = rows.filter((r) => r.myAckPending).length;
  const jobTitles = [...new Set((titles.data ?? []).map((t) => t.job_title))].sort();

  return (
    <>
      <PageHeader
        title="Prosedur & Dokumen"
        description="SOP, instruksi kerja, dan form terkendali beserta revisi berlakunya"
        actions={
          <>
            <Link href="/peraturan" className="text-sm underline underline-offset-2">Evaluasi Peraturan</Link>
            {staff && <Link href="/ko" className="text-sm underline underline-offset-2">Register KO</Link>}
            {canManage && <DocumentSheet trigger={<Button><Plus /> Dokumen Baru</Button>} people={people} titles={jobTitles} />}
          </>
        }
      />
      {pending > 0 && (
        <p role="status" className="col-span-12 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {pending} dokumen menunggu pengakuan baca Anda.{" "}
          <Link href={href({ baca: p.unread ? null : "1" })} className="font-medium underline underline-offset-2">{p.unread ? "Tampilkan semua" : "Tampilkan yang perlu dibaca"}</Link>
        </p>
      )}
      <div className="col-span-12 flex flex-wrap items-center gap-1.5">
        {DOC_KIND_FILTERS.map((k) => (
          <Link key={k} href={href({ jenis: k === "semua" ? null : k })} aria-pressed={p.kind === k} className={cn("rounded-full border px-2.5 py-0.5 text-xs", p.kind === k ? "border-primary bg-primary/5 font-medium text-primary" : "hover:bg-accent")}>
            {KIND_LABEL[k]}
          </Link>
        ))}
        {staff && <Link href={href({ ditarik: p.withdrawn ? null : "1" })} aria-pressed={p.withdrawn} className={buttonVariants({ variant: p.withdrawn ? "default" : "outline", size: "sm" })}>Tampilkan yang ditarik</Link>}
        <form method="get" className="ml-auto flex gap-2">
          {p.kind !== "semua" && <input type="hidden" name="jenis" value={p.kind} />}
          <input name="q" defaultValue={p.q} placeholder="Cari kode / judul" aria-label="Cari" className="h-8 w-48 rounded-md border bg-background px-2 text-sm" />
        </form>
      </div>
      <Content title="Register Dokumen" description={`${rows.length} dokumen`}>
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Belum ada dokumen untuk filter ini.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>{["Kode", "Judul", "Jenis", "Revisi Berlaku", "Berlaku Sejak", "Jadwal Review", "Pengakuan", "Status"].map((h) => <th key={h} scope="col" className="px-3 py-2 text-left font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-accent/30">
                    <td className="px-3 py-2 tabular-nums whitespace-nowrap">{r.code}</td>
                    <td className="px-3 py-2 font-medium">
                      <Link href={`/dokumen/${r.id}`} className="underline underline-offset-2">{r.title}</Link>
                      {r.ownerName && <small className="block text-xs font-normal text-muted-foreground">Pemilik: {r.ownerName}</small>}
                    </td>
                    <td className="px-3 py-2">{docKindLabel(r.kind)}</td>
                    <td className="px-3 py-2 tabular-nums">{r.currentRev ? `Rev ${r.currentRev}` : "-"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.effectiveOn ? formatDate(r.effectiveOn) : "-"}</td>
                    <td className="px-3 py-2">{r.currentRev && r.isActive ? <ExpiryChip expiry={r.review} /> : <span className="text-muted-foreground">-</span>}</td>
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                      {r.myAckPending ? <span className="font-medium text-amber-700 dark:text-amber-400">Perlu Anda baca</span> : staff && r.ackTotal > 0 ? `${r.ackDone}/${r.ackTotal} membaca` : "-"}
                    </td>
                    <td className="px-3 py-2">
                      <span className="flex flex-col gap-1">
                        <StatusBadge value={!r.isActive ? "withdrawn" : r.currentRev ? "published" : "unpublished"} map={DOCUMENT_STATE} />
                        {staff && r.openStatus && <span className="text-xs text-muted-foreground">Rev {r.openRev}: {REVISION_STATUS[r.openStatus]?.label}</span>}
                      </span>
                    </td>
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
