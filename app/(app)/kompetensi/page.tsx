import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, CalendarCheck, CalendarX, CircleDashed, Minus, Pencil, Plus } from "lucide-react";
import { Content } from "@/components/list/content";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireAccess } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { getCompetencyMatrix, MATRIX_STATE_FILTERS, parseMatrixParams } from "@/lib/manpower";
import { getManpowerSummary } from "@/lib/manpower";
import { COMPETENCY_STATE } from "@/lib/people-rules";
import { hrefWith } from "@/lib/search-params";
import { parseSiteParam } from "@/lib/sites";
import { STATUS_CLASSES } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { CompetencySheet } from "../manpower/people-sheets";

export const metadata: Metadata = { title: "Kompetensi" };

const ICON = { valid: CalendarCheck, expiring: AlertTriangle, expired: CalendarX, missing: CircleDashed, na: Minus } as const;
const FILTER_LABEL: Record<(typeof MATRIX_STATE_FILTERS)[number], string> = { semua: "Semua", expired: "Kedaluwarsa", expiring: "Akan Kedaluwarsa", missing: "Belum Ada" };

// Matriks kompetensi (rancangan §4.6): karyawan x kompetensi. Setiap sel = ikon + teks status (bukan warna saja).
export default async function KompetensiPage({ searchParams }: PageProps<"/kompetensi">) {
  const access = await requireAccess("viewer");
  const isAdmin = access.role === "admin" || access.platformAdmin;
  if (!isAdmin && !access.functions.some((f) => f !== "karyawan")) redirect("/");
  const sp = await searchParams;
  const { siteId, label } = await parseSiteParam(sp, access);
  const p = parseMatrixParams(sp, siteId);
  const supabase = await createClient();
  const [{ rows, competencies }, summary] = await Promise.all([getCompetencyMatrix(supabase, p), getManpowerSummary(supabase, siteId)]);
  const canManage = isAdmin || (!access.functions.includes("auditor") && (access.functions.includes("hr") || access.functions.includes("hse")));
  const href = (c: Record<string, string | null>) => hrefWith("/kompetensi", sp, c);
  const jobTitles = summary.rows.map((r) => r.jobTitle);

  return (
    <>
      <PageHeader
        title="Kompetensi & Sertifikat"
        description={`Matriks kompetensi karyawan aktif · ${label}`}
        actions={
          <>
            <Link href="/pelatihan" className="text-sm underline underline-offset-2">Rencana Pelatihan</Link>
            {canManage && <CompetencySheet trigger={<Button variant="outline"><Plus /> Tambah Kompetensi</Button>} jobTitles={jobTitles} />}
          </>
        }
      />
      <div className="col-span-12 flex flex-wrap items-center gap-1.5" aria-label="Filter">
        {MATRIX_STATE_FILTERS.map((s) => (
          <Link key={s} href={href({ status: s === "semua" ? null : s })} aria-pressed={p.stateFilter === s} className={cn("rounded-full border px-2.5 py-0.5 text-xs", p.stateFilter === s ? "border-primary bg-primary/5 font-medium text-primary" : "hover:bg-accent")}>
            {FILTER_LABEL[s]}
          </Link>
        ))}
        <span className="mx-1 text-muted-foreground" aria-hidden>|</span>
        {jobTitles.map((j) => (
          <Link key={j} href={href({ jabatan: p.jabatan === j ? null : j })} aria-pressed={p.jabatan === j} className={cn("rounded-full border px-2.5 py-0.5 text-xs", p.jabatan === j ? "border-primary bg-primary/5 font-medium text-primary" : "hover:bg-accent")}>
            {j}
          </Link>
        ))}
      </div>
      <Content title="Matriks Kompetensi" description={`${rows.length} karyawan · ${competencies.length} kompetensi`}>
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Tidak ada data untuk filter ini.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm" style={{ minWidth: 320 + competencies.length * 150 }}>
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="sticky left-0 z-10 min-w-52 bg-muted/40 px-3 py-2 text-left font-medium">Karyawan</th>
                  {competencies.map((c) => (
                    <th key={c.id} scope="col" className="px-2 py-2 text-left font-medium">
                      <span className="flex items-center gap-1">
                        {c.name}
                        {canManage && <CompetencySheet trigger={<button type="button" aria-label={`Ubah kompetensi ${c.name}`} className="rounded p-0.5 hover:bg-accent"><Pencil className="size-3" /></button>} competency={c} jobTitles={jobTitles} />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.employeeId} className="border-t">
                    <th scope="row" className="sticky left-0 z-10 bg-background px-3 py-2 text-left font-normal">
                      <Link href={`/manpower/${r.employeeId}?tab=kompetensi`} className="font-medium underline underline-offset-2">{r.name}</Link>
                      <small className="block text-xs text-muted-foreground">{r.jobTitle}</small>
                    </th>
                    {competencies.map((c) => {
                      const cell = r.cells[c.id];
                      const state = cell?.state ?? "na";
                      const def = COMPETENCY_STATE[state];
                      const Icon = ICON[state as keyof typeof ICON] ?? Minus;
                      return (
                        <td key={c.id} className="px-1.5 py-1.5">
                          <span className={cn("inline-flex w-full items-center gap-1 rounded-md border px-2 py-1 text-xs", STATUS_CLASSES[def.color].soft, (state === "missing" || state === "na") && "border-dashed")} title={cell?.validUntil ? `Berlaku sampai ${formatDate(cell.validUntil)}` : undefined}>
                            <Icon className="size-3.5 shrink-0" aria-hidden />
                            <span className="truncate">{def.label}{state === "expiring" && cell?.validUntil ? ` · ${formatDate(cell.validUntil)}` : ""}</span>
                          </span>
                        </td>
                      );
                    })}
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
