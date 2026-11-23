import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Eye, ListChecks } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireAccess } from "@/lib/auth";
import { hasAnyFunction } from "@/lib/functions";
import { getInspeksiPeopleForPage } from "./data";
import { getActiveTemplates, getPlanActual, listInspectionsMonth, parseInspeksiParams } from "@/lib/inspeksi";
import { monthLabel, shiftMonthKey } from "@/lib/inspeksi-rules";
import { getAreas, getK3Masters, getWritableCompanies, todayWibIso } from "@/lib/k3";
import { hrefWith } from "@/lib/search-params";
import { parseSiteParam } from "@/lib/sites";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { InspeksiCalendar, typeChipClass } from "./inspeksi-calendar";
import { InspeksiList } from "./inspeksi-list";
import { PlanActualPanel } from "./plan-actual";
import { ScheduleSheet } from "./schedule-sheet";

export const metadata: Metadata = { title: "Inspeksi & Observasi" };

// Jadwal inspeksi (rancangan §4.3): kalender/daftar bulanan + rencana vs aktual + dialog jadwal.
export default async function InspeksiPage({ searchParams }: PageProps<"/inspeksi">) {
  const access = await requireAccess("viewer");
  const sp = await searchParams;
  const { siteId, label: siteLabel, sites } = await parseSiteParam(sp, access);
  const p = parseInspeksiParams(sp, siteId);
  const supabase = await createClient();
  const [areas, masters, templates, people, companies] = await Promise.all([
    getAreas(supabase),
    getK3Masters(supabase),
    getActiveTemplates(supabase),
    getInspeksiPeopleForPage(supabase),
    getWritableCompanies(access),
  ]);
  const [rows, plan] = await Promise.all([listInspectionsMonth(supabase, p, areas), getPlanActual(supabase, p.bulan, siteId, masters.inspectionTypes)]);

  const today = todayWibIso();
  const canSchedule = !access.functions.includes("auditor") && hasAnyFunction(access, ["hse", "pengawas", "pjo"]);
  const canTemplates = access.role === "admin" || access.platformAdmin || access.functions.includes("hse");
  // dialog jadwal butuh satu site: "Semua site" → site profil, selain itu site pertama
  const scheduleSite = siteId ?? (access.profile.locationId && sites.some((s) => s.id === access.profile.locationId) ? access.profile.locationId : sites[0]?.id);
  const nowKey = today.slice(0, 7);
  const href = (changes: Record<string, string | null>) => hrefWith("/inspeksi", sp, changes);
  const defaultDate = p.bulan === nowKey ? today : `${p.bulan}-01`;

  return (
    <>
      <PageHeader
        title="Inspeksi & Observasi"
        description={`Rencanakan dan pantau pelaksanaan inspeksi · ${siteLabel}`}
        actions={
          <>
            <Link href="/observasi" className={buttonVariants({ variant: "outline" })}>
              <Eye /> Observasi KTA/TTA
            </Link>
            {canTemplates && (
              <Link href="/inspeksi/template" className={buttonVariants({ variant: "outline" })}>
                <ListChecks /> Template
              </Link>
            )}
            {canSchedule && scheduleSite && (
              <ScheduleSheet
                siteId={scheduleSite}
                siteName={sites.find((s) => s.id === scheduleSite)?.name ?? "Site"}
                templates={templates}
                areas={areas.filter((a) => a.siteId === scheduleSite && a.isActive).map((a) => ({ value: a.value, label: a.label }))}
                people={people}
                companies={companies}
                defaultCompany={companies.length === 1 ? companies[0].value : (access.profile.company ?? null)}
                defaultInspectorId={access.userId}
                defaultDate={defaultDate}
              />
            )}
          </>
        }
      />

      <div className="col-span-12 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Link href={href({ bulan: shiftMonthKey(p.bulan, -1) })} aria-label="Bulan sebelumnya" className={buttonVariants({ variant: "outline", size: "icon-sm" })}>
            <ChevronLeft />
          </Link>
          <strong className="min-w-36 text-center text-sm">{monthLabel(p.bulan)}</strong>
          <Link href={href({ bulan: shiftMonthKey(p.bulan, 1) })} aria-label="Bulan berikutnya" className={buttonVariants({ variant: "outline", size: "icon-sm" })}>
            <ChevronRight />
          </Link>
          {p.bulan !== nowKey && (
            <Link href={href({ bulan: null })} className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Hari ini
            </Link>
          )}
        </div>
        <div className="ml-auto flex rounded-md border p-0.5" role="group" aria-label="Mode tampilan">
          {(["kalender", "daftar"] as const).map((m) => (
            <Link
              key={m}
              href={href({ tampilan: m === "kalender" ? null : m })}
              aria-current={p.tampilan === m ? "true" : undefined}
              className={cn("flex items-center gap-1.5 rounded px-2.5 py-1 text-sm", p.tampilan === m ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:text-foreground")}
            >
              {m === "kalender" ? <CalendarDays className="size-4" /> : <ClipboardList className="size-4" />}
              {m === "kalender" ? "Kalender" : "Daftar"}
            </Link>
          ))}
        </div>
      </div>

      <div className="col-span-12 -mt-2 flex flex-wrap gap-1.5" aria-label="Filter jenis inspeksi">
        <Link href={href({ jenis: null })} className={cn("rounded-full border px-2.5 py-0.5 text-xs", p.types.length === 0 ? "border-primary bg-primary/5 font-medium text-primary" : "hover:bg-accent")}>
          Semua jenis
        </Link>
        {masters.inspectionTypes
          .filter((t) => t.isActive)
          .map((t) => {
            const on = p.types.includes(t.value);
            return (
              <Link key={t.value} href={href({ jenis: on ? null : t.value })} aria-pressed={on} className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs", on ? "border-primary bg-primary/5 font-medium" : "hover:bg-accent")}>
                <i className={cn("size-2.5 rounded-full border", typeChipClass(t.color))} aria-hidden />
                {t.label}
              </Link>
            );
          })}
      </div>

      <div className="col-span-12 grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-6 [&>*]:min-w-0">
        <main>
          {p.tampilan === "kalender" ? <InspeksiCalendar bulan={p.bulan} rows={rows} today={today} /> : <InspeksiList rows={rows} />}
          {rows.length >= 500 && <p className="mt-2 text-xs text-muted-foreground">Hanya 500 inspeksi pertama bulan ini yang ditampilkan. Persempit dengan filter jenis.</p>}
        </main>
        <PlanActualPanel bulan={p.bulan} rows={plan.rows} plan={plan.plan} actual={plan.actual} />
      </div>
    </>
  );
}

