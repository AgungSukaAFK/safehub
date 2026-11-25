import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, ExternalLink, Upload } from "lucide-react";
import { StatusBadge } from "@/components/detail/status-badge";
import { KpiHelp, KpiStatusBadge, type KpiDefinition } from "@/components/kpi-help";
import { Content } from "@/components/list/content";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireAccess } from "@/lib/auth";
import { LibTab, MrTab, ScrapTab } from "./extra-tabs";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { getKpi, type KpiDef } from "@/lib/kpi";
import { getMntDashboard, getMntExtra, listMntBacklog, listMntDowntime, listMntPs, listMntUnits, MAINTENANCE_SYSTEM_URL, parseMntParams, shiftMonth } from "@/lib/maintenance";
import { MNT_BACKLOG_STATUS, MNT_DOWNTIME_KIND, MNT_KPI_CODES, MNT_NON_MOVING_DAYS, MNT_PRIORITY, MNT_SOURCE, MNT_TABS, MNT_UNIT_STATUS } from "@/lib/maintenance-rules";
import { MONTHS_LONG } from "@/lib/tsp-rules";
import { hrefWith } from "@/lib/search-params";
import { parseSiteParam } from "@/lib/sites";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Maintenance" };

const PS_STATE = { on_time: "Tepat waktu", late: "Terlambat", overdue: "Belum dikerjakan (lewat)", upcoming: "Belum jatuh tempo" } as const;
const PS_COLOR = { on_time: "text-green-700 dark:text-green-400", late: "text-amber-700 dark:text-amber-400", overdue: "text-red-700 dark:text-red-400", upcoming: "text-muted-foreground" } as const;
const num = (v: number | null, unit = "") => (v === null ? "Belum tersedia" : `${formatNumber(v)}${unit}`);

// Dashboard Maintenance (rancangan §4.9): HANYA BACA. Data cermin dari sistem maintenance (impor Excel); satu sumber kebenaran = sistem itu.
export default async function MaintenancePage({ searchParams }: PageProps<"/maintenance">) {
  const access = await requireAccess("viewer");
  const isAdmin = access.role === "admin" || access.platformAdmin;
  if (!isAdmin && !access.functions.some((f) => f !== "karyawan")) redirect("/");
  const sp = await searchParams;
  const { siteId, label } = await parseSiteParam(sp, access);
  const p = parseMntParams(sp, siteId);
  const supabase = await createClient();
  const canImport = isAdmin || (!access.functions.includes("auditor") && (access.functions.includes("maintenance") || access.functions.includes("hse")));
  const [dash, kpis, extra] = await Promise.all([getMntDashboard(supabase, p), Promise.all(MNT_KPI_CODES.map((c) => getKpi(supabase, c))), getMntExtra(supabase, p)]);
  const kpi = (code: string) => kpis.find((k) => k?.code === code) ?? null;
  const [y, m] = p.bulan.split("-").map(Number);
  const href = (c: Record<string, string | null>) => hrefWith("/maintenance", sp, c);
  const currentBulan = parseMntParams({}, siteId).bulan;
  const prev = shiftMonth(p.bulan, -1);
  const next = shiftMonth(p.bulan, 1);

  return (
    <>
      <PageHeader
        title="Maintenance"
        description={`Ketersediaan unit, PS, dan backlog · ${label}`}
        actions={
          <>
            {MAINTENANCE_SYSTEM_URL && (
              <a href={MAINTENANCE_SYSTEM_URL} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline" })}>
                <ExternalLink /> Buka sistem maintenance
              </a>
            )}
            {canImport && <Link href="/impor" className={buttonVariants({ variant: "outline" })}><Upload /> Impor Data Maintenance</Link>}
          </>
        }
      />
      <div className="col-span-12 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground" role="note">
          Sumber: <strong>{MNT_SOURCE}</strong> · {dash.lastSync ? `diperbarui ${formatDateTime(dash.lastSync)}` : "belum ada data diimpor"}. Hanya baca; ubah data di sistem maintenance lalu impor ulang.
        </p>
        <nav className="flex items-center gap-1" aria-label="Periode">
          <Link href={href({ bulan: prev })} aria-label="Bulan sebelumnya" className={buttonVariants({ variant: "outline", size: "icon-sm" })}><ChevronLeft /></Link>
          <span className="min-w-36 text-center text-sm font-medium">{MONTHS_LONG[m - 1]} {y}{p.bulan === currentBulan ? " (s.d. hari ini)" : ""}</span>
          <Link href={href({ bulan: next })} aria-label="Bulan berikutnya" aria-disabled={p.bulan >= currentBulan} className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }), p.bulan >= currentBulan && "pointer-events-none opacity-40")}><ChevronRight /></Link>
        </nav>
      </div>
      <nav className="col-span-12 flex flex-wrap gap-1 border-b" aria-label="Tab maintenance">
        {MNT_TABS.map((t) => (
          <Link key={t.key} href={href({ tab: t.key === "ringkasan" ? null : t.key })} aria-current={p.tab === t.key ? "page" : undefined} className={cn("-mb-px border-b-2 px-3 py-2 text-sm", p.tab === t.key ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}
          </Link>
        ))}
      </nav>

      {dash.units.total === 0 && !["lib", "scrap", "mr"].includes(p.tab) && (
        <p role="status" className="col-span-12 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Belum ada data unit untuk site ini. {canImport ? <>Impor <Link href="/impor" className="font-medium underline underline-offset-2">Unit</Link> lebih dulu, lalu Downtime, PS, dan Backlog.</> : "Minta Service/Maintenance atau HSE mengimpor data dari sistem maintenance."}
        </p>
      )}

      {p.tab === "ringkasan" && dash.units.total > 0 && (
        <>
          <section className="col-span-12 grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="KPI maintenance">
            <Kpi title="Physical Availability" value={num(dash.pa, "%")} kpi={kpi("mnt_pa")} hint={`${dash.units.operating} unit operasi`} />
            <Kpi title="MTBF" value={num(dash.mtbfHours, " jam")} kpi={kpi("mnt_mtbf")} hint={`${dash.breakdownCount} breakdown`} />
            <Kpi title="MTTR" value={num(dash.mttrHours, " jam")} kpi={kpi("mnt_mttr")} hint={`${formatNumber(dash.breakdownHours)} jam breakdown`} />
            <Kpi title="PS Accuracy" value={num(dash.ps.accuracy, "%")} kpi={kpi("mnt_ps_accuracy")} hint={`${dash.ps.onTime}/${dash.ps.planned} tepat${dash.ps.overdue ? ` · ${dash.ps.overdue} belum dikerjakan` : ""}`} warn={dash.ps.overdue > 0} />
            <Kpi title="Backlog Open" value={String(dash.backlog.total)} kpi={kpi("mnt_backlog_open")} hint={`${dash.backlog.high} prioritas tinggi · tertua ${dash.backlog.oldestDays} hari`} warn={dash.backlog.high > 0} />
          </section>
          <section className="col-span-12 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="LIB dan scrap">
            <Kpi title="Readiness LIB" value={num(extra.lib.readinessPct, "%")} kpi={null} hint={extra.lib.withMin > 0 ? `${extra.lib.ready}/${extra.lib.withMin} part ber-minimum siap` : "Belum ada part ber-minimum"} warn={extra.lib.belowMin > 0} />
            <Kpi title="Part Non-moving" value={String(extra.lib.nonMoving)} kpi={null} hint={`stok > 0, tidak bergerak > ${MNT_NON_MOVING_DAYS} hari`} warn={extra.lib.nonMoving > 0} />
            <Kpi title="Scrap Aktual" value={extra.scrap.actualKg === null ? "Belum tersedia" : `${formatNumber(extra.scrap.actualKg)} kg`} kpi={null} hint={extra.scrap.achievementPct === null ? "Belum ada forecast bulan ini" : `${extra.scrap.achievementPct}% dari forecast ${formatNumber(extra.scrap.forecastKg)} kg`} />
            <Kpi title="Forecast Scrap Bulan Depan" value={extra.scrap.nextForecastKg === null ? "Belum tersedia" : `${formatNumber(extra.scrap.nextForecastKg)} kg`} kpi={null} hint="Dari impor Metal Scrap" />
          </section>
          <Content title="Breakdown Terbanyak" description="Jam breakdown per unit pada periode (maks. 5 unit)" size="md">
            {dash.topBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tidak ada breakdown pada periode ini.</p>
            ) : (
              <ul className="space-y-2">
                {dash.topBreakdown.map((t) => (
                  <li key={t.unitId} className="grid grid-cols-[minmax(6rem,10rem)_1fr_auto] items-center gap-3 text-sm">
                    <span className="truncate"><strong className="font-medium">{t.code}</strong>{t.model && <small className="block truncate text-xs text-muted-foreground">{t.model}</small>}</span>
                    <span className="block h-2 rounded-full bg-viz-1" style={{ width: `${(t.hours / dash.topBreakdown[0].hours) * 100}%` }} role="img" aria-label={`${t.code}: ${t.hours} jam`} />
                    <span className="tabular-nums">{formatNumber(t.hours)} jam · {t.count}×</span>
                  </li>
                ))}
              </ul>
            )}
          </Content>
          <Content title="Status Unit" description={`${dash.units.total} unit terdaftar`} size="md">
            <ul className="space-y-2 text-sm">
              {Object.entries(MNT_UNIT_STATUS).map(([k]) => (
                <li key={k} className="flex items-center justify-between gap-2"><StatusBadge value={k} map={MNT_UNIT_STATUS} /><strong className="tabular-nums">{dash.units.byStatus[k] ?? 0}</strong></li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">Unit Dihentikan tidak dihitung di PA, MTBF, dan MTTR. Downtime terencana ({formatNumber(dash.plannedHours)} jam) tidak mengurangi PA.</p>
          </Content>
        </>
      )}

      {p.tab === "unit" && <UnitsTab supabase={supabase} p={p} />}
      {p.tab === "downtime" && <DowntimeTab supabase={supabase} p={p} />}
      {p.tab === "ps" && <PsTab supabase={supabase} p={p} />}
      {p.tab === "backlog" && <BacklogTab supabase={supabase} p={p} />}
      {p.tab === "lib" && <LibTab supabase={supabase} p={p} syncedAt={extra.lib.syncedAt} search={searchForm(p, "Cari kode / nama part")} />}
      {p.tab === "scrap" && <ScrapTab supabase={supabase} p={p} syncedAt={extra.scrap.syncedAt} search={searchForm(p, "Cari jenis logam")} />}
      {p.tab === "mr" && <MrTab />}
    </>
  );
}

function Kpi({ title, value, hint, kpi, warn }: { title: string; value: string; hint: string; kpi: KpiDef | null; warn?: boolean }) {
  const help: KpiDefinition | null = kpi ? { code: kpi.code, name: kpi.name, definition: kpi.definition, formula: kpi.formula, source: kpi.source, owner: kpi.owner, unit: kpi.unit, status: kpi.status, version: `v${kpi.version}` } : null;
  return (
    <div className={cn("rounded-xl border bg-card p-4", warn && "border-amber-300 dark:border-amber-900")}>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">{title} {help && <KpiHelp kpi={help} />}</span>
      <strong className={cn("block text-2xl tabular-nums", value === "Belum tersedia" && "text-base font-medium text-muted-foreground")}>{value}</strong>
      <small className="text-xs text-muted-foreground">{hint}</small>
      {kpi && <KpiStatusBadge status={kpi.status} className="mt-1 block" />}
    </div>
  );
}

type TabProps = { supabase: Awaited<ReturnType<typeof createClient>>; p: ReturnType<typeof parseMntParams> };
const searchForm = (p: TabProps["p"], placeholder: string) => (
  <form method="get" className="flex gap-2">
    <input type="hidden" name="tab" value={p.tab} />
    <input type="hidden" name="bulan" value={p.bulan} />
    <input name="q" defaultValue={p.q} placeholder={placeholder} aria-label="Cari" className="h-8 w-48 rounded-md border bg-background px-2 text-sm" />
  </form>
);
const Empty = ({ children }: { children: string }) => <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{children}</p>;
const Th = ({ children }: { children: string }) => <th scope="col" className="px-3 py-2 text-left font-medium">{children}</th>;

async function UnitsTab({ supabase, p }: TabProps) {
  const rows = await listMntUnits(supabase, p);
  return (
    <Content title="Unit" description={`${rows.length} unit · jam breakdown pada periode terpilih`} cardAction={searchForm(p, "Cari kode / model")}>
      {rows.length === 0 ? <Empty>Tidak ada unit.</Empty> : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground"><tr>{["Kode", "Model", "Status", "Jam breakdown", "Backlog open"].map((h) => <Th key={h}>{h}</Th>)}</tr></thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="px-3 py-2 font-medium tabular-nums">{u.code}</td>
                  <td className="px-3 py-2">{u.model ?? "-"}</td>
                  <td className="px-3 py-2"><StatusBadge value={u.status} map={MNT_UNIT_STATUS} /></td>
                  <td className="px-3 py-2 tabular-nums">{formatNumber(u.breakdownHours)}</td>
                  <td className="px-3 py-2 tabular-nums">{u.openBacklog}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Content>
  );
}

async function DowntimeTab({ supabase, p }: TabProps) {
  const rows = await listMntDowntime(supabase, p);
  return (
    <Content title="Downtime" description={`${rows.length} catatan pada periode`} cardAction={searchForm(p, "Cari unit / keterangan")}>
      {rows.length === 0 ? <Empty>Tidak ada downtime pada periode ini.</Empty> : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground"><tr>{["Tanggal", "Unit", "Jenis", "Jam", "Keterangan"].map((h) => <Th key={h}>{h}</Th>)}</tr></thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} className="border-t">
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(d.date)}</td>
                  <td className="px-3 py-2 font-medium">{d.unit}{d.model && <small className="block text-xs font-normal text-muted-foreground">{d.model}</small>}</td>
                  <td className="px-3 py-2"><StatusBadge value={d.kind} map={MNT_DOWNTIME_KIND} /></td>
                  <td className="px-3 py-2 tabular-nums">{formatNumber(d.hours)}</td>
                  <td className="px-3 py-2">{d.note ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Content>
  );
}

async function PsTab({ supabase, p }: TabProps) {
  const rows = await listMntPs(supabase, p);
  return (
    <Content title="Planned Service (PS)" description={`${rows.length} PS direncanakan pada periode · toleransi 2 hari`} cardAction={searchForm(p, "Cari unit / jenis PS")}>
      {rows.length === 0 ? <Empty>Tidak ada PS pada periode ini.</Empty> : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground"><tr>{["Unit", "PS", "Rencana", "Aktual", "Hasil"].map((h) => <Th key={h}>{h}</Th>)}</tr></thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{s.unit}{s.model && <small className="block text-xs font-normal text-muted-foreground">{s.model}</small>}</td>
                  <td className="px-3 py-2">{s.name}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(s.plannedOn)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{s.doneOn ? formatDate(s.doneOn) : "-"}</td>
                  <td className={cn("px-3 py-2 font-medium", PS_COLOR[s.state])}>{PS_STATE[s.state]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Content>
  );
}

async function BacklogTab({ supabase, p }: TabProps) {
  const rows = await listMntBacklog(supabase, { site: p.site, q: p.q, onlyOpen: false });
  const open = rows.filter((b) => b.status === "open").length;
  return (
    <Content title="Backlog" description={`${open} open dari ${rows.length} · umur dihitung sampai hari ini`} cardAction={searchForm(p, "Cari unit / judul")}>
      {rows.length === 0 ? <Empty>Tidak ada backlog.</Empty> : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground"><tr>{["Unit", "Backlog", "Prioritas", "Status", "Dibuka", "Umur / ditutup"].map((h) => <Th key={h}>{h}</Th>)}</tr></thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{b.unit}{b.model && <small className="block text-xs font-normal text-muted-foreground">{b.model}</small>}</td>
                  <td className="px-3 py-2">{b.title}</td>
                  <td className="px-3 py-2"><StatusBadge value={b.priority} map={MNT_PRIORITY} /></td>
                  <td className="px-3 py-2"><StatusBadge value={b.status} map={MNT_BACKLOG_STATUS} /></td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(b.openedOn)}</td>
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">{b.ageDays !== null ? `${b.ageDays} hari` : b.closedOn ? formatDate(b.closedOn) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Content>
  );
}
