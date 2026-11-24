import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, Download, MapPin, Users } from "lucide-react";
import { StatusBadge } from "@/components/detail/status-badge";
import { KpiHelp, KpiStatusBadge, type KpiDefinition } from "@/components/kpi-help";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireAccess } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { hasAnyFunction } from "@/lib/functions";
import { getAreas, getK3People, getWritableCompanies, todayWibIso } from "@/lib/k3";
import { getKpi } from "@/lib/kpi";
import { hrefWith } from "@/lib/search-params";
import { parseSiteParam } from "@/lib/sites";
import { createClient } from "@/lib/supabase/server";
import { filterTspRows, getEvaluation, getTspMatrix, getTspSummary, listActivities, parseTspParams, TSP_STATUS_FILTERS } from "@/lib/tsp";
import { ACTIVITY_EVIDENCE, ACTIVITY_TYPE_LABEL, MONTHS_LONG } from "@/lib/tsp-rules";
import { cn } from "@/lib/utils";
import { ActivitySheet } from "./activity-sheet";
import { EvaluationPanel } from "./evaluation-panel";
import { CopyProgramsButton } from "./copy-button";
import { ProgramSheet } from "./program-sheet";
import { TspMatrix } from "./tsp-matrix";

export const metadata: Metadata = { title: "TSP & Aktivitas" };

const STATUS_LABEL: Record<(typeof TSP_STATUS_FILTERS)[number], string> = { semua: "Semua status", tercapai: "Tercapai", tertinggal: "Tertinggal" };

// Monitoring TSP (rancangan §4.5): matriks program x bulan, aktivitas K3, evaluasi bulanan.
export default async function TspPage({ searchParams }: PageProps<"/tsp">) {
  const access = await requireAccess("viewer");
  if (!access.functions.some((f) => f !== "karyawan") && access.role !== "admin" && !access.platformAdmin) redirect("/");
  const sp = await searchParams;
  const { siteId, label: siteLabel, sites } = await parseSiteParam(sp, access);
  const p = parseTspParams(sp, siteId);
  const supabase = await createClient();
  const today = todayWibIso();
  const nowYear = Number(today.slice(0, 4));
  const nowMonth = Number(today.slice(5, 7));
  const currentMonth = p.tahun < nowYear ? 12 : p.tahun > nowYear ? 0 : nowMonth;

  const [all, summary, areas, people, companies, evaluation, kpi] = await Promise.all([
    getTspMatrix(supabase, p),
    getTspSummary(supabase, p),
    getAreas(supabase),
    getK3People(supabase),
    getWritableCompanies(access),
    getEvaluation(supabase, p),
    getKpi(supabase, "tsp_achievement"),
  ]);
  const rows = filterTspRows(all, p);
  const activities = await listActivities(supabase, p, areas, all);

  const isAdmin = access.role === "admin" || access.platformAdmin;
  const isHse = access.functions.includes("hse") && !access.functions.includes("auditor");
  const canManage = isAdmin || isHse;
  const canRecord = !access.functions.includes("auditor") && (isAdmin || hasAnyFunction(access, ["hse", "pengawas", "pjo"]));
  const canDecide = access.functions.includes("pjo") && !access.functions.includes("auditor");
  const formSite = siteId ?? (access.profile.locationId && sites.some((s) => s.id === access.profile.locationId) ? access.profile.locationId : sites[0]?.id);
  const href = (changes: Record<string, string | null>) => hrefWith("/tsp", sp, changes);
  const elements = [...new Set(all.map((r) => r.element))];
  const owners = [...new Set(all.map((r) => r.owner))];
  const kpiHelp: KpiDefinition | null = kpi ? { code: kpi.code, name: kpi.name, definition: kpi.definition, formula: kpi.formula, source: kpi.source, owner: kpi.owner, unit: kpi.unit, status: kpi.status, version: `v${kpi.version}` } : null;
  const years = [p.tahun - 1, p.tahun, ...(p.tahun < nowYear + 1 ? [p.tahun + 1] : [])];

  return (
    <>
      <PageHeader
        title="TSP & Aktivitas"
        description={`Monitoring Tujuan dan Sasaran Program · ${siteLabel}`}
        actions={
          <>
            <a href={`/tsp/ekspor?${new URLSearchParams({ tahun: String(p.tahun), bulan: String(p.bulan), ...(siteId ? { site: siteId } : {}) })}`} className={buttonVariants({ variant: "outline" })}>
              <Download /> Ekspor
            </a>
            {canManage && siteId && rows.length === 0 && all.length === 0 && <CopyProgramsButton fromYear={p.tahun - 1} toYear={p.tahun} siteId={siteId} />}
            {canManage && formSite && <ProgramSheet year={p.tahun} sites={sites.filter((s) => !siteId || s.id === siteId)} />}
            {canRecord && formSite && (
              <ActivitySheet
                siteId={formSite}
                siteName={sites.find((s) => s.id === formSite)?.name ?? "Site"}
                year={p.tahun}
                today={today}
                areas={areas.filter((a) => a.siteId === formSite && a.isActive).map((a) => ({ value: a.value, label: a.label }))}
                people={people.map((x) => ({ value: x.value, label: x.label, description: x.description }))}
                programs={all.filter((r) => r.siteId === formSite && r.isActive).map((r) => ({ value: r.id, label: `${r.no} · ${r.name}` }))}
                companies={companies}
                defaultCompany={companies.length === 1 ? companies[0].value : (access.profile.company ?? null)}
                defaultLeaderId={access.userId}
              />
            )}
          </>
        }
      />

      <section className="col-span-12 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border bg-card p-4" aria-label="Capaian keseluruhan">
        <div>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Capaian keseluruhan s.d. {MONTHS_LONG[p.bulan - 1]} {p.tahun} {kpiHelp && <KpiHelp kpi={kpiHelp} />}
          </span>
          <strong className="text-4xl tabular-nums">{summary.achievement === null ? "-" : `${summary.achievement}%`}</strong>
        </div>
        <div className="text-sm text-muted-foreground">
          {summary.programs_met} dari {summary.programs_total} program sesuai rencana · {summary.evidence_missing} bulan belum berbukti
        </div>
        {kpi && <KpiStatusBadge status={kpi.status} />}
      </section>

      <div className="col-span-12 flex flex-wrap items-center gap-2" aria-label="Filter">
        <div className="flex rounded-md border p-0.5" role="group" aria-label="Tahun">
          {years.map((y) => (
            <Link key={y} href={href({ tahun: y === nowYear ? null : String(y), bulan: null })} aria-current={y === p.tahun ? "true" : undefined} className={cn("rounded px-2.5 py-1 text-sm", y === p.tahun ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:text-foreground")}>
              {y}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Bulan acuan">
          {MONTHS_LONG.map((m, i) => {
            const future = p.tahun === nowYear ? i + 1 > nowMonth : p.tahun > nowYear;
            return future ? (
              <span key={m} className="rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground/50">{m.slice(0, 3)}</span>
            ) : (
              <Link key={m} href={href({ bulan: String(i + 1) })} aria-current={i + 1 === p.bulan ? "true" : undefined} className={cn("rounded-full border px-2 py-0.5 text-xs", i + 1 === p.bulan ? "border-primary bg-primary/5 font-medium text-primary" : "hover:bg-accent")}>
                {m.slice(0, 3)}
              </Link>
            );
          })}
        </div>
      </div>
      <div className="col-span-12 -mt-2 flex flex-wrap gap-1.5" aria-label="Filter program">
        <Chip active={!p.elemen} href={href({ elemen: null })}>Semua elemen</Chip>
        {elements.map((e) => (
          <Chip key={e} active={p.elemen === e} href={href({ elemen: p.elemen === e ? null : e })}>{e}</Chip>
        ))}
        <span className="mx-1 self-center text-muted-foreground" aria-hidden>|</span>
        <Chip active={!p.pj} href={href({ pj: null })}>Semua PJ</Chip>
        {owners.map((o) => (
          <Chip key={o} active={p.pj === o} href={href({ pj: p.pj === o ? null : o })}>{o}</Chip>
        ))}
        <span className="mx-1 self-center text-muted-foreground" aria-hidden>|</span>
        {TSP_STATUS_FILTERS.map((s) => (
          <Chip key={s} active={p.status === s} href={href({ status: s === "semua" ? null : s })}>{STATUS_LABEL[s]}</Chip>
        ))}
      </div>

      <section className="col-span-12" aria-label="Matriks monitoring TSP">
        <h2 className="mb-2 text-base font-semibold">Monitoring Matrix TSP <span className="text-sm font-normal text-muted-foreground">· aktual / rencana · {p.tahun}</span></h2>
        <TspMatrix rows={rows} year={p.tahun} currentMonth={currentMonth} limitMonth={p.bulan} canRecord={canRecord} canManage={canManage} sites={sites.filter((s) => !siteId || s.id === siteId)} />
      </section>

      <section className="col-span-12" aria-label="Aktivitas K3">
        <h2 className="mb-2 text-base font-semibold">Aktivitas K3 <span className="text-sm font-normal text-muted-foreground">· {activities.length} terbaru {p.tahun}</span></h2>
        {activities.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Belum ada aktivitas tercatat.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {activities.map((a) => (
              <li key={a.id} className="space-y-1.5 rounded-xl border bg-card p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <strong>{ACTIVITY_TYPE_LABEL[a.typeCode] ?? a.typeCode}</strong>
                  <StatusBadge value={a.evidenceCount > 0 ? "complete" : "missing"} map={ACTIVITY_EVIDENCE} />
                </div>
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" aria-hidden />{formatDate(a.date)}</span>
                  <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" aria-hidden />{a.areaName}</span>
                  <span className="inline-flex items-center gap-1"><Users className="size-3.5" aria-hidden />{a.participants} peserta</span>
                </p>
                <p className="text-xs text-muted-foreground">{a.code}{a.leaderName ? ` · ${a.leaderName}` : ""}</p>
                {a.notes && <p className="line-clamp-2 text-xs">{a.notes}</p>}
                {a.programLabel && <span className="inline-block rounded-full border px-2 py-0.5 text-xs">{a.programLabel}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="col-span-12">
        <EvaluationPanel year={p.tahun} month={p.bulan} siteId={siteId} live={summary} evaluation={evaluation} canSubmit={isHse && !canDecide} canDecide={canDecide} />
      </div>
    </>
  );
}

function Chip({ active, href, children }: { active: boolean; href: string; children: React.ReactNode }) {
  return (
    <Link href={href} aria-pressed={active} className={cn("rounded-full border px-2.5 py-0.5 text-xs", active ? "border-primary bg-primary/5 font-medium text-primary" : "hover:bg-accent")}>
      {children}
    </Link>
  );
}
