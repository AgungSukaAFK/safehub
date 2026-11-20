// Gerbang semua halaman app (frontend-guide §6.1): login + role (standar) → AppShell.
import { Suspense } from "react";
import { cookies } from "next/headers";
import { FlashToast } from "@/components/flash-toast";
import { AppProvider, type MyApp } from "@/components/providers/app-context";
import { NotificationProvider } from "@/components/providers/notification-provider";
import { OfflineBanner } from "@/components/pwa/offline-banner";
import { OfflineLinkGuard } from "@/components/pwa/link-handlers";
import { PwaUser } from "@/components/pwa/pwa-support";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { NavigationProgress } from "@/components/shell/navigation-progress";
import { Topbar } from "@/components/topbar/topbar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { requireAccess } from "@/lib/auth";
import { getInitialBadges } from "@/lib/badges";
import { getCompanies } from "@/lib/companies";
import { createClient } from "@/lib/supabase/server";
import { CompanyAccent } from "@/lib/theme";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await requireAccess();
  const supabase = await createClient();
  const [companies, appsRes, badges, cookieStore] = await Promise.all([
    getCompanies(),
    supabase.schema("public").rpc("my_apps"),
    getInitialBadges(supabase, access.userId),
    cookies(),
  ]);
  const myApps = (appsRes.data ?? []) as MyApp[];
  const sidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";
  const companyAccent =
    companies.find((c) => c.code === access.profile.company)?.accent ?? null;

  return (
    <AppProvider
      access={access}
      companies={companies}
      myApps={myApps}
      initialBadges={badges}
    >
      {/* Waktu render untuk banner offline ("menampilkan data per 14.32 WIB", F11) */}
      <meta name="x-rendered-at" content={new Date().toISOString()} />
      <CompanyAccent accent={companyAccent} />
      <PwaUser userId={access.userId} />
      <OfflineLinkGuard />
      <Suspense>
        <NavigationProgress />
        <FlashToast />
      </Suspense>
      <NotificationProvider>
        <SidebarProvider defaultOpen={sidebarOpen}>
          <AppSidebar className="no-print shadow-lg" />
          {/* min-w-0: konten lebar (tabel, grid) bergulir di wadahnya sendiri, bukan melebarkan halaman */}
          <SidebarInset className="min-w-0">
            <Topbar />
            <OfflineBanner />
            {/* JANGAN pasang overflow-* di antara <main> dan tabel: header tabel sticky berhenti menempel */}
            <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 pt-0 break-words">
              <div className="grid grid-cols-12 items-start gap-4 md:gap-6 [&>*]:min-w-0">
                {children}
              </div>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </NotificationProvider>
    </AppProvider>
  );
}
