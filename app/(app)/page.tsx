import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Eye, Siren } from "lucide-react";
import { BlockSkeleton, CardsSkeleton, FeedBlock, UpdateBanner } from "@/components/dashboard/blocks";
import { DashboardGreeting } from "@/components/dashboard/greeting";
import { K3ActionNeeded, LeadingBlock, MyReports, PicaBlock, SafetyStrip, SummaryCards, UpdatedAt } from "@/components/dashboard/k3-blocks";
import { NotificationCta } from "@/components/dashboard/notification-cta";
import { buttonVariants } from "@/components/ui/button";
import { requireAccess } from "@/lib/auth";
import { formatDateLong, formatTime, greeting } from "@/lib/format";
import { monthLabel, parseMonth, shiftMonthKey } from "@/lib/inspeksi-rules";
import { todayWibIso } from "@/lib/k3";
import { getDashboardK3, listKpis } from "@/lib/kpi";
import { hrefWith } from "@/lib/search-params";
import { parseSiteParam } from "@/lib/sites";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Beranda" };

// Beranda K3 (rancangan §4.4). Urutan: sapaan → banner Pembaruan → Perlu Aksi → periode → Kinerja
// Keselamatan → kartu ringkasan → leading indicator + PICA → terbaru. Yang butuh aksi selalu di atas angka.
// Angka = SATU RPC dashboard_k3 (site dari top bar); tiap blok di <Suspense> sendiri. Karyawan: varian ringkas.
export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  const access = await requireAccess();
  const sp = await searchParams;
  const supabase = await createClient();
  const { siteId, label: siteLabel } = await parseSiteParam(sp, access);
  const now = new Date();
  const nowKey = todayWibIso().slice(0, 7);
  const bulan = typeof sp.bulan === "string" && parseMonth(sp.bulan) ? sp.bulan : nowKey;
  const rentang = sp.rentang === "ytd" ? "ytd" : "bulan";
  const m = parseMonth(bulan)!;
  const isStaff = access.role === "admin" || access.platformAdmin || access.functions.some((f) => f !== "karyawan");
  const canReport = !access.functions.includes("auditor");
  const canEditHours = access.role === "admin" || access.platformAdmin || access.functions.includes("hse");
  const href = (changes: Record<string, string | null>) => hrefWith("/", sp, changes);

  const data = isStaff ? getDashboardK3(supabase, m.year, m.month, siteId) : null;
  const kpis = isStaff ? await listKpis(supabase) : [];

  return (
    <>
      <DashboardGreeting initialGreeting={greeting(now)} initialDate={`${formatDateLong(now)} · ${formatTime(now)} WIB`} />
      <Suspense fallback={null}>
        <UpdateBanner supabase={supabase} userId={access.userId} />
      </Suspense>

      {!isStaff && canReport && (
        <div className="col-span-12 grid gap-3 sm:grid-cols-2">
          <Link href="/kejadian/lapor" className={cn(buttonVariants({ size: "lg" }), "h-16 justify-start gap-3 text-base")}>
            <Siren className="size-6" /> Lapor Kejadian
          </Link>
          <Link href="/observasi/baru" className={cn(buttonVariants({ size: "lg", variant: "outline" }), "h-16 justify-start gap-3 text-base")}>
            <Eye className="size-6" /> Observasi KTA/TTA
          </Link>
        </div>
      )}

      <Suspense fallback={<BlockSkeleton size="lg" height="h-24" />}>
        <K3ActionNeeded supabase={supabase} />
      </Suspense>

      {!isStaff && (
        <Suspense fallback={<BlockSkeleton size="lg" height="h-48" />}>
          <MyReports supabase={supabase} userId={access.userId} />
        </Suspense>
      )}

      {isStaff && data && (
        <>
          <div className="col-span-12 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <Link href={href({ bulan: shiftMonthKey(bulan, -1) })} aria-label="Bulan sebelumnya" className={buttonVariants({ variant: "outline", size: "icon-sm" })}>
                <ChevronLeft />
              </Link>
              <strong className="min-w-36 text-center text-sm">{monthLabel(bulan)}</strong>
              <Link href={href({ bulan: shiftMonthKey(bulan, 1) })} aria-label="Bulan berikutnya" className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }), bulan >= nowKey && "pointer-events-none opacity-40")} aria-disabled={bulan >= nowKey}>
                <ChevronRight />
              </Link>
              {bulan !== nowKey && (
                <Link href={href({ bulan: null })} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                  Bulan ini
                </Link>
              )}
            </div>
            <span className="text-sm text-muted-foreground">{siteLabel}</span>
          </div>

          <Suspense key={`k-${bulan}-${rentang}-${siteId}`} fallback={<CardsSkeleton count={6} />}>
            <SafetyStrip data={data} kpis={kpis} bulan={bulan} rentang={rentang} hrefFor={(r) => href({ rentang: r === "ytd" ? "ytd" : null })} canEditHours={canEditHours} />
          </Suspense>
          <Suspense key={`s-${bulan}-${siteId}`} fallback={<CardsSkeleton count={4} />}>
            <SummaryCards data={data} bulan={bulan} />
          </Suspense>
          <Suspense
            key={`g-${bulan}-${siteId}`}
            fallback={
              <>
                <BlockSkeleton />
                <BlockSkeleton />
              </>
            }
          >
            <LeadingBlock data={data} bulan={bulan} />
            <PicaBlock data={data} />
          </Suspense>
          <UpdatedAt at={now} />
        </>
      )}

      <Suspense fallback={<BlockSkeleton size="lg" height="h-72" />}>
        <FeedBlock supabase={supabase} />
      </Suspense>
      {/* paling bawah: muncul setelah cek kemampuan browser, jadi tidak boleh menggeser konten (CLS) */}
      <NotificationCta />
    </>
  );
}
