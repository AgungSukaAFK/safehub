// Blok Beranda "Pencapaian TSP per elemen" (rancangan §4.4). Server Component. Angka = loader TSP yang SAMA
// dengan halaman /tsp (getTspMatrix + programProgress), jadi total di sini = total di daftar program.
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Content } from "@/components/list/content";
import { KpiHelp, KpiStatusBadge, type KpiDefinition } from "@/components/kpi-help";
import type { KpiDef } from "@/lib/kpi";
import type { SiteChoice } from "@/lib/site-types";
import type { ServerClient } from "@/lib/supabase/server";
import { getTspMatrix } from "@/lib/tsp";
import { MONTHS_LONG, programProgress } from "@/lib/tsp-rules";
import { cn } from "@/lib/utils";

export async function TspBlock({ supabase, bulan, site, kpi }: { supabase: ServerClient; bulan: string; site: SiteChoice; kpi: KpiDef | null }) {
  const year = Number(bulan.slice(0, 4));
  const month = Number(bulan.slice(5, 7));
  const rows = (await getTspMatrix(supabase, { tahun: year, bulan: month, site })).filter((r) => r.isActive);
  const help: KpiDefinition | null = kpi ? { code: kpi.code, name: kpi.name, definition: kpi.definition, formula: kpi.formula, source: kpi.source, owner: kpi.owner, unit: kpi.unit, status: kpi.status, version: `v${kpi.version}` } : null;

  const byElement = [...new Set(rows.map((r) => r.element))].map((element) => {
    let plan = 0;
    let done = 0;
    let lagging = 0;
    for (const r of rows.filter((x) => x.element === element)) {
      const p = programProgress(r.plan, r.actual, month);
      plan += p.planTd;
      done += p.doneTd;
      if (p.lagging) lagging++;
    }
    return { element, plan, done, lagging, pct: plan > 0 ? Math.round((done * 100) / plan) : null };
  });
  const totalPlan = byElement.reduce((s, e) => s + e.plan, 0);
  const totalDone = byElement.reduce((s, e) => s + e.done, 0);
  const overall = totalPlan > 0 ? Math.round((totalDone * 100) / totalPlan) : null;

  return (
    <Content
      className="col-span-12 min-w-0"
      title={
        <span className="flex items-center gap-2">
          Pencapaian TSP per Elemen {help && <KpiHelp kpi={help} />}
          {kpi && <KpiStatusBadge status={kpi.status} />}
        </span>
      }
      description={`s.d. ${MONTHS_LONG[month - 1]} ${year}${overall === null ? "" : ` · keseluruhan ${overall}%`}`}
      cardAction={
        <Link href={`/tsp?tahun=${year}&bulan=${month}`} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          TSP & Aktivitas <ArrowRight className="size-4" />
        </Link>
      }
    >
      {byElement.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">Belum ada program TSP untuk periode ini.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {byElement.map((e) => (
            <li key={e.element} className="space-y-1.5 rounded-lg border p-3">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate font-medium">{e.element}</span>
                <strong className={cn("tabular-nums", e.pct !== null && e.pct < 80 && "text-red-600 dark:text-red-400")}>{e.pct === null ? "-" : `${e.pct}%`}</strong>
              </div>
              <span className="block h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={e.pct ?? 0} aria-valuemax={100} aria-label={`${e.element}: ${e.pct ?? 0}%`}>
                <span className={cn("block h-full rounded-full", (e.pct ?? 0) < 80 ? "bg-red-500" : "bg-green-600")} style={{ width: `${e.pct ?? 0}%` }} />
              </span>
              <small className="block text-xs text-muted-foreground">
                {e.done}/{e.plan} terealisasi{e.lagging > 0 ? ` · ${e.lagging} program tertinggal` : " · sesuai rencana"}
              </small>
            </li>
          ))}
        </ul>
      )}
    </Content>
  );
}
