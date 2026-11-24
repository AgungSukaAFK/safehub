import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { StatusBadge } from "@/components/detail/status-badge";
import { ExpiryChip } from "@/components/expiry-chip";
import { KpiHelp, KpiStatusBadge, type KpiDefinition } from "@/components/kpi-help";
import { Content } from "@/components/list/content";
import { PageHeader } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { requireAccess } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { getContractorOptions } from "@/lib/k3";
import { getKpi } from "@/lib/kpi";
import { getManpowerSummary, listEmployees, parseManpowerParams } from "@/lib/manpower";
import { EMPLOYEE_STATUS, MCU_RESULT } from "@/lib/people-rules";
import { hrefWith } from "@/lib/search-params";
import { parseSiteParam } from "@/lib/sites";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { EmployeeSheet, RequirementSheet } from "./people-sheets";

export const metadata: Metadata = { title: "Manpower" };

// Manpower (rancangan §4.6): kebutuhan vs tersedia per jabatan + daftar karyawan dengan status MCU, kompetensi, permit.
export default async function ManpowerPage({ searchParams }: PageProps<"/manpower">) {
  const access = await requireAccess("viewer");
  const isAdmin = access.role === "admin" || access.platformAdmin;
  if (!isAdmin && !access.functions.some((f) => f !== "karyawan")) redirect("/");
  const sp = await searchParams;
  const { siteId, label, sites } = await parseSiteParam(sp, access);
  const p = parseManpowerParams(sp, siteId);
  const supabase = await createClient();
  const [rows, summary, contractors, kpi] = await Promise.all([listEmployees(supabase, p), getManpowerSummary(supabase, siteId), getContractorOptions(supabase), getKpi(supabase, "manpower_fulfillment")]);
  const canManage = isAdmin || (!access.functions.includes("auditor") && (access.functions.includes("hr") || access.functions.includes("hse")));
  const formSite = siteId ?? (access.profile.locationId && sites.some((s) => s.id === access.profile.locationId) ? access.profile.locationId : sites[0]?.id);
  const href = (c: Record<string, string | null>) => hrefWith("/manpower", sp, c);
  const jobTitles = summary.rows.map((r) => r.jobTitle);
  const help: KpiDefinition | null = kpi ? { code: kpi.code, name: kpi.name, definition: kpi.definition, formula: kpi.formula, source: kpi.source, owner: kpi.owner, unit: kpi.unit, status: kpi.status, version: `v${kpi.version}` } : null;
  const maxBar = Math.max(1, ...summary.rows.flatMap((r) => [r.required, r.available]));

  return (
    <>
      <PageHeader
        title="Manpower"
        description={`Data tenaga kerja aktif dan kebutuhan personel · ${label}`}
        actions={
          canManage && formSite ? (
            <EmployeeSheet
              trigger={<Button><Plus /> Tambah Karyawan</Button>}
              siteId={formSite}
              contractors={contractors}
              jobTitles={jobTitles}
            />
          ) : null
        }
      />
      <section className="col-span-12 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Ringkasan manpower">
        <Kpi label="Total aktif" value={`${summary.activeTotal}`} unit="orang" hint={`${summary.activeTotal - summary.contractorTotal} karyawan · ${summary.contractorTotal} mitra`} />
        <Kpi label="Kebutuhan" value={`${summary.required}`} unit="orang" hint="Rencana manpower" />
        <div className="rounded-xl border bg-card p-4">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">Pemenuhan {help && <KpiHelp kpi={help} />}</span>
          <strong className="text-3xl tabular-nums">{summary.fulfillment === null ? "-" : `${summary.fulfillment}%`}</strong>
          {kpi && <KpiStatusBadge status={kpi.status} className="mt-1 block" />}
        </div>
        <Kpi label="Permit akan kedaluwarsa" value={`${summary.permitExpiring}`} unit="" hint="≤ 30 hari" warn={summary.permitExpiring > 0} />
      </section>

      <Content
        title="Kebutuhan vs Tersedia per Jabatan"
        description="Karyawan dan tenaga mitra aktif"
        cardAction={canManage && formSite ? <RequirementSheet trigger={<Button variant="outline" size="sm"><Plus /> Kebutuhan</Button>} siteId={formSite} /> : undefined}
      >
        {summary.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada kebutuhan atau karyawan.</p>
        ) : (
          <ul className="space-y-2.5">
            {summary.rows.map((r) => {
              const gap = r.required - r.available;
              return (
                <li key={r.jobTitle} className="grid grid-cols-[minmax(7rem,12rem)_1fr_auto] items-center gap-3 text-sm">
                  <Link href={href({ jabatan: p.jabatan === r.jobTitle ? null : r.jobTitle })} className="truncate hover:underline">{r.jobTitle}</Link>
                  <div className="space-y-1" role="img" aria-label={`${r.jobTitle}: kebutuhan ${r.required}, tersedia ${r.available}`}>
                    <span className="block h-2 rounded-full bg-viz-1" style={{ width: `${(r.required / maxBar) * 100}%` }} />
                    <span className="block h-2 rounded-full bg-viz-2" style={{ width: `${(r.available / maxBar) * 100}%` }} />
                  </div>
                  <span className="flex items-center gap-2">
                    <strong className={cn("tabular-nums", gap > 0 && "text-red-600 dark:text-red-400")}>{r.available}/{r.required}</strong>
                    <small className="w-12 text-xs text-muted-foreground">{r.required === 0 ? "—" : gap > 0 ? `−${gap}` : "Penuh"}</small>
                    {canManage && formSite && (
                      <RequirementSheet trigger={<Button variant="ghost" size="icon-sm" aria-label={`Ubah kebutuhan ${r.jobTitle}`}><Pencil /></Button>} siteId={formSite} jobTitle={r.jobTitle} required={r.required} />
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 flex gap-4 text-xs text-muted-foreground" aria-hidden>
          <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-viz-1" /> Kebutuhan</span>
          <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-viz-2" /> Tersedia</span>
        </p>
      </Content>

      <Content
        title="Daftar Manpower"
        description={`${rows.length} orang${p.jabatan ? ` · jabatan ${p.jabatan}` : ""}`}
        cardAction={
          <div className="flex items-center gap-2">
            <form method="get" className="flex gap-2">
              {Object.entries(sp).filter(([k, v]) => k !== "q" && typeof v === "string").map(([k, v]) => <input key={k} type="hidden" name={k} value={v as string} />)}
              <input name="q" defaultValue={p.q} placeholder="Cari NIK / nama / jabatan" aria-label="Cari" className="h-8 w-48 rounded-md border bg-background px-2 text-sm" />
            </form>
            <Link href={href({ nonaktif: p.nonaktif ? null : "1" })} aria-pressed={p.nonaktif} className={buttonVariants({ variant: p.nonaktif ? "default" : "outline", size: "sm" })}>
              Tampilkan nonaktif
            </Link>
            {p.jabatan && <Link href={href({ jabatan: null })} className={buttonVariants({ variant: "ghost", size: "sm" })}>Hapus filter jabatan</Link>}
          </div>
        }
      >
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Tidak ada karyawan untuk filter ini.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  {["NIK", "Nama", "Jabatan", "Section", "Hubungan Kerja", "Mulai", "Status", "MCU", "Kompetensi", "Permit Site"].map((h) => (
                    <th key={h} scope="col" className="px-3 py-2 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-accent/30">
                    <td className="px-3 py-2 tabular-nums">{r.code}</td>
                    <td className="px-3 py-2 font-medium"><Link href={`/manpower/${r.id}`} className="underline underline-offset-2">{r.name}</Link>{r.contractorName && <small className="block text-xs font-normal text-muted-foreground">{r.contractorName}</small>}</td>
                    <td className="px-3 py-2">{r.jobTitle}</td>
                    <td className="px-3 py-2">{r.department ?? "-"}</td>
                    <td className="px-3 py-2">{r.employment}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.joinDate ? formatDate(r.joinDate) : "-"}</td>
                    <td className="px-3 py-2"><StatusBadge value={r.status} map={EMPLOYEE_STATUS} /></td>
                    <td className="px-3 py-2">
                      <ExpiryChip expiry={r.mcu} showDate={false} />
                      {r.mcuResult && r.mcuResult !== "fit" && <small className="mt-0.5 block text-xs text-muted-foreground">{MCU_RESULT[r.mcuResult]?.label}</small>}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {r.compRequired === 0 ? <span className="text-muted-foreground">—</span> : <span className={cn("tabular-nums", r.compOk < r.compRequired && "font-medium text-amber-700 dark:text-amber-400")}>{r.compOk}/{r.compRequired} terpenuhi</span>}
                    </td>
                    <td className="px-3 py-2"><ExpiryChip expiry={r.permit} showDate={false} /></td>
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

function Kpi({ label, value, unit, hint, warn }: { label: string; value: string; unit: string; hint: string; warn?: boolean }) {
  return (
    <div className={cn("rounded-xl border bg-card p-4", warn && "border-amber-300 dark:border-amber-900")}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <strong className="block text-3xl tabular-nums">{value} {unit && <small className="text-sm font-normal text-muted-foreground">{unit}</small>}</strong>
      <small className="text-xs text-muted-foreground">{hint}</small>
    </div>
  );
}
