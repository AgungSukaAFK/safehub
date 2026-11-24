import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { StatusBadge } from "@/components/detail/status-badge";
import { Content } from "@/components/list/content";
import { PageHeader } from "@/components/page-header";
import { requireAccess } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { getWritableCompanies, todayWibIso } from "@/lib/k3";
import { listReports, getReportTemplates, parseLaporanParams } from "@/lib/laporan";
import { REPORT_STATUS, REPORT_STATUS_ORDER } from "@/lib/laporan-rules";
import { monthLabel } from "@/lib/inspeksi-rules";
import { hrefWith } from "@/lib/search-params";
import { parseSiteParam } from "@/lib/sites";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { CreateReportSheet } from "./create-sheet";

export const metadata: Metadata = { title: "Laporan Periode" };

// Daftar Laporan Periode (rancangan §4.10): ringkasan status, filter, dan pembuatan laporan.
export default async function LaporanPage({ searchParams }: PageProps<"/laporan">) {
  const access = await requireAccess("viewer");
  if (!access.functions.some((f) => f !== "karyawan") && access.role !== "admin" && !access.platformAdmin) redirect("/");
  const sp = await searchParams;
  const { siteId, label, sites } = await parseSiteParam(sp, access);
  const today = todayWibIso();
  const p = parseLaporanParams(sp, siteId, Number(today.slice(0, 4)));
  const supabase = await createClient();
  const templates = await getReportTemplates(supabase);
  const [rows, all, companies] = await Promise.all([
    listReports(supabase, p, templates),
    listReports(supabase, { ...p, status: "", template: "" }, templates),
    getWritableCompanies(access),
  ]);
  const canCreate = access.role === "admin" || access.platformAdmin || (access.functions.includes("hse") && !access.functions.includes("auditor"));
  const formSite = siteId ?? (access.profile.locationId && sites.some((s) => s.id === access.profile.locationId) ? access.profile.locationId : sites[0]?.id);
  const href = (c: Record<string, string | null>) => hrefWith("/laporan", sp, c);
  const now = today.slice(0, 7);
  const prev = (() => {
    const d = new Date(Date.UTC(Number(now.slice(0, 4)), Number(now.slice(5, 7)) - 2, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  })();
  const count = (s: string) => all.filter((r) => r.status === s).length;

  return (
    <>
      <PageHeader
        title="Laporan Periode"
        description={`Susun, review, setujui, dan terbitkan laporan berkala · ${label}`}
        actions={
          canCreate && formSite ? (
            <CreateReportSheet
              siteId={formSite}
              siteName={sites.find((s) => s.id === formSite)?.name ?? "Site"}
              templates={templates.map((t) => ({ value: t.id, label: `${t.name} (${t.code} ${t.revision})` }))}
              companies={companies}
              defaultCompany={companies.length === 1 ? companies[0].value : (access.profile.company ?? null)}
              defaultPeriod={prev}
              maxPeriod={now}
            />
          ) : null
        }
      />
      <section className="col-span-12 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Ringkasan status">
        {REPORT_STATUS_ORDER.map((s) => (
          <Link key={s} href={href({ status: p.status === s ? null : s })} aria-pressed={p.status === s} className={cn("rounded-xl border bg-card p-4 hover:bg-accent/40", p.status === s && "border-primary")}>
            <span className="text-xs text-muted-foreground">{s === "published" ? `Terbit ${p.tahun}` : REPORT_STATUS[s].label}</span>
            <strong className="block text-2xl tabular-nums">{count(s)}</strong>
          </Link>
        ))}
      </section>
      <Content title="Daftar Laporan" description={`${label} · Tahun ${p.tahun}`}>
        <div className="mb-3 flex flex-wrap gap-1.5" aria-label="Filter template">
          <Link href={href({ template: null })} className={cn("rounded-full border px-2.5 py-0.5 text-xs", !p.template ? "border-primary bg-primary/5 font-medium text-primary" : "hover:bg-accent")}>
            Semua template
          </Link>
          {templates.map((t) => (
            <Link key={t.id} href={href({ template: p.template === t.id ? null : t.id })} className={cn("rounded-full border px-2.5 py-0.5 text-xs", p.template === t.id ? "border-primary bg-primary/5 font-medium text-primary" : "hover:bg-accent")}>
              {t.name}
            </Link>
          ))}
          <span className="ml-auto flex gap-1">
            <Link href={href({ tahun: String(p.tahun - 1) })} className="rounded border px-2 py-0.5 text-xs hover:bg-accent">{p.tahun - 1}</Link>
            {p.tahun < Number(today.slice(0, 4)) + 1 && <Link href={href({ tahun: String(p.tahun + 1) })} className="rounded border px-2 py-0.5 text-xs hover:bg-accent">{p.tahun + 1}</Link>}
          </span>
        </div>
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Belum ada laporan untuk filter ini.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-medium">ID</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Nama Laporan</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Periode</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Template & Versi</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Status</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Penyusun</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Diperbarui</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Versi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-accent/30">
                    <td className="px-3 py-2 font-medium"><Link href={`/laporan/${r.id}`} className="underline underline-offset-2">{r.code}</Link></td>
                    <td className="px-3 py-2">{r.templateName}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{monthLabel(r.period)}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{r.templateCode} {r.revision}</td>
                    <td className="px-3 py-2"><StatusBadge value={r.status} map={REPORT_STATUS} />{r.status === "published" && <span className="sr-only"> (terkunci)</span>}</td>
                    <td className="px-3 py-2">{r.authorName ?? "-"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(r.updatedAt)}</td>
                    <td className="px-3 py-2 tabular-nums">{r.version ? `v${r.version}` : "—"}</td>
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
