"use client";

import { Suspense } from "react";
import { Breadcrumbs } from "@/components/shell/breadcrumbs";
import { SitePicker } from "@/components/topbar/site-picker";
import { TopbarActions } from "@/components/topbar/topbar-actions";
import { TopbarSearch } from "@/components/topbar/topbar-search";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

/**
 * Top bar sticky (frontend-guide §6.5): ☰ │ breadcrumb · site · global search (lg+) · Buat, Inbox,
 * Bantuan, Tampilan │ Profil (Safe Hub: + pemilih site & tombol Buat, rancangan §2.2/§2.13).
 * Blur kuat baru mulai md (repaint tiap scroll berat di HP murah). Tanpa shadow: pemisah = border + garis gradien aksen tipis.
 */
export function Topbar() {
  return (
    <header
      data-app-topbar
      className="no-print sticky top-0 z-40 mb-4 flex shrink-0 flex-col border-b border-border/60 bg-background/90 backdrop-blur-md after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-gradient-to-r after:from-transparent after:via-primary/30 after:to-transparent supports-[backdrop-filter]:bg-background/75 md:backdrop-blur-xl md:backdrop-saturate-150 md:supports-[backdrop-filter]:bg-background/60"
    >
      <div className="flex h-14 items-center gap-2 transition-[height] ease-linear md:h-16 md:group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
        <div className="flex min-w-0 items-center gap-2 pl-3 md:pl-4">
          <SidebarTrigger className="-ml-1 shrink-0" />
          <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4 md:mr-2" />
          <Breadcrumbs />
          <Suspense>
            <SitePicker />
          </Suspense>
        </div>
        {/* < lg: min-width auto (= ikon Cari) supaya grup kiri (pemilih site) yang menyusut, bukan ikon yang meluber */}
        <div className="-mr-1 flex flex-1 justify-end lg:mr-0 lg:min-w-0 lg:justify-center lg:px-2">
          <TopbarSearch />
        </div>
        <div className="shrink-0 pr-2 md:pr-3">
          <TopbarActions />
        </div>
      </div>
    </header>
  );
}
