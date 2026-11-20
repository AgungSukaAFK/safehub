import { Suspense } from "react";
import type { Metadata } from "next";
import { ActionNeeded, BlockSkeleton, CardsSkeleton, ChartsBlock, FeedBlock, InsightBlock, SummaryBlock, UpdateBanner } from "@/components/dashboard/blocks";
import { DashboardGreeting } from "@/components/dashboard/greeting";
import { NotificationCta } from "@/components/dashboard/notification-cta";
import { dashboardHref, PeriodFilter, shiftMonth } from "@/components/dashboard/period-filter";
import { requireAccess } from "@/lib/auth";
import { getCompanies, getCompanyScope } from "@/lib/companies";
import { parseDashboardParams } from "@/lib/dashboard";
import { formatDateLong, formatTime, greeting } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Beranda" };

// Beranda (frontend-guide §17). Urutan WAJIB: sapaan → banner Pembaruan → Follow-up → Perlu Aksi →
// filter periode → stat card → grafik & insight → terbaru + feed. Yang butuh aksi selalu di atas angka.
// Tiap blok data di <Suspense> sendiri (streaming).
// CONTOH: angka/grafik/insight memakai Pengajuan; ganti dengan dokumen asli app.
export default async function DashboardPage({ searchParams }: PageProps<"/">) {
  const access = await requireAccess();
  const sp = await searchParams;
  const [companies, scope, supabase] = await Promise.all([
    getCompanies(),
    getCompanyScope({ company: access.profile.company, platformAdmin: access.platformAdmin }),
    createClient(),
  ]);
  // pemilih perusahaan hanya untuk user yang melihat > 1 perusahaan (non-grup)
  const choosable = companies.filter((c) => !c.isGroup && (scope === "ALL" || scope.includes(c.code)));
  const period = parseDashboardParams(
    sp,
    choosable.length > 1 ? choosable.map((c) => c.code) : [],
  );
  const prevHref = dashboardHref(period, { month: shiftMonth(period.month, -1), week: null });
  const now = new Date();
  const periodKey = `${period.from}:${period.to}:${period.company ?? ""}`;

  return (
    <>
      <DashboardGreeting initialGreeting={greeting(now)} initialDate={`${formatDateLong(now)} · ${formatTime(now)} WIB`} />
      <Suspense fallback={null}>
        <UpdateBanner supabase={supabase} userId={access.userId} />
      </Suspense>
      <Suspense fallback={<BlockSkeleton size="lg" height="h-24" />}>
        <ActionNeeded supabase={supabase} userId={access.userId} />
      </Suspense>

      <PeriodFilter period={period} companies={choosable.length > 1 ? choosable.map((c) => ({ code: c.code, label: c.shortName })) : []} />
      <Suspense key={`s-${periodKey}`} fallback={<CardsSkeleton />}>
        <SummaryBlock supabase={supabase} period={period} />
      </Suspense>
      <Suspense
        key={`c-${periodKey}`}
        fallback={
          <>
            <BlockSkeleton />
            <BlockSkeleton />
          </>
        }
      >
        <ChartsBlock supabase={supabase} period={period} prevHref={prevHref} />
      </Suspense>
      <Suspense
        key={`i-${periodKey}`}
        fallback={
          <>
            <BlockSkeleton height="h-48" />
            <BlockSkeleton height="h-48" />
          </>
        }
      >
        <InsightBlock supabase={supabase} period={period} companies={companies.map((c) => c.code)} />
      </Suspense>
      <Suspense fallback={<BlockSkeleton size="lg" height="h-72" />}>
        <FeedBlock supabase={supabase} />
      </Suspense>
      {/* paling bawah: muncul setelah cek kemampuan browser, jadi tidak boleh menggeser konten (CLS) */}
      <NotificationCta />
    </>
  );
}
