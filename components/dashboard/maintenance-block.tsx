// Blok Beranda "Maintenance" (rancangan §4.9, hanya baca). Angka = RPC mnt_dashboard yang SAMA dengan halaman /maintenance.
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Content } from "@/components/list/content";
import { KpiHelp, KpiStatusBadge, type KpiDefinition } from "@/components/kpi-help";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { KpiDef } from "@/lib/kpi";
import { todayWibIso } from "@/lib/k3";
import { getMntDashboard, getMntExtra } from "@/lib/maintenance";
import { MNT_SOURCE } from "@/lib/maintenance-rules";
import { MONTHS_LONG } from "@/lib/tsp-rules";
import type { SiteChoice } from "@/lib/site-types";
import type { ServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export async function MaintenanceBlock({ supabase, bulan, site, kpis }: { supabase: ServerClient; bulan: string; site: SiteChoice; kpis: (KpiDef | null)[] }) {
  const [y, m] = bulan.split("-").map(Number);
  const today = todayWibIso();
  if (`${bulan}-01` > today) return null; // periode belum berjalan
  const eom = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const range = { site, from: `${bulan}-01`, to: eom > today ? today : eom };
  const [d, x] = await Promise.all([getMntDashboard(supabase, range), getMntExtra(supabase, range)]);
  const help = (code: string): KpiDefinition | null => {
    const k = kpis.find((x) => x?.code === code);
    return k ? { code: k.code, name: k.name, definition: k.definition, formula: k.formula, source: k.source, owner: k.owner, unit: k.unit, status: k.status, version: `v${k.version}` } : null;
  };
  const cells = [
    { code: "mnt_pa", label: "PA", value: d.pa === null ? null : `${d.pa}%`, warn: d.pa !== null && d.pa < 85 },
    { code: "mnt_ps_accuracy", label: "PS Accuracy", value: d.ps.accuracy === null ? null : `${d.ps.accuracy}%`, warn: d.ps.overdue > 0 },
    { code: "mnt_mttr", label: "MTTR", value: d.mttrHours === null ? null : `${formatNumber(d.mttrHours)} jam`, warn: false },
    { code: "mnt_backlog_open", label: "Backlog Open", value: String(d.backlog.total), warn: d.backlog.high > 0 },
  ];
  return (
    <Content
      className="col-span-12 min-w-0"
      title="Maintenance"
      description={`${MONTHS_LONG[m - 1]} ${y} · Sumber: ${MNT_SOURCE}${d.lastSync ? ` · diperbarui ${formatDateTime(d.lastSync)}` : ""}`}
      cardAction={<Link href={`/maintenance?bulan=${bulan}`} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">Dashboard Maintenance <ArrowRight className="size-4" /></Link>}
    >
      {d.units.total === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">Belum ada data maintenance diimpor.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {cells.map((c) => {
            const h = help(c.code);
            const k = kpis.find((x) => x?.code === c.code);
            return (
              <li key={c.code} className={cn("rounded-lg border p-3", c.warn && "border-amber-300 dark:border-amber-900")}>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">{c.label} {h && <KpiHelp kpi={h} />}</span>
                <strong className={cn("block text-xl tabular-nums", c.value === null && "text-sm font-medium text-muted-foreground")}>{c.value ?? "Belum tersedia"}</strong>
                {k && <KpiStatusBadge status={k.status} className="mt-1 block" />}
              </li>
            );
          })}
        </ul>
      )}
      {d.units.total > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Readiness LIB {x.lib.readinessPct === null ? "belum tersedia" : `${x.lib.readinessPct}%`} · {x.lib.nonMoving} part non-moving · Scrap {x.scrap.actualKg === null ? "belum tersedia" : `${formatNumber(x.scrap.actualKg)} kg`}
          {x.scrap.forecastKg !== null ? ` dari forecast ${formatNumber(x.scrap.forecastKg)} kg` : ""}
        </p>
      )}
    </Content>
  );
}
