"use client";

// Tab bawah HP (< md): Beranda · Tugas · Lapor · Notifikasi · Profil (rancangan §2.13, keputusan D4,
// penyimpangan dari standar §8, dicatat di CLAUDE.md). Tab "Lapor" hanya muncul kalau menu dengan
// createHref `/kejadian/lapor` ada dan boleh dilihat user (modul Kejadian, fase 1).

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardCheck, Inbox, LayoutDashboard, Plus, SquareUserRound, type LucideIcon } from "lucide-react";
import { CountBadge } from "@/components/shell/nav-main";
import { useApp, type BadgeCounts } from "@/components/providers/app-context";
import { buildCreateItems } from "@/lib/nav";
import { cn } from "@/lib/utils";

export const REPORT_HREF = "/kejadian/lapor";

type Tab = { href: string; label: string; icon: LucideIcon; badge?: keyof BadgeCounts; primary?: boolean };

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileTabs() {
  const { access, badges } = useApp();
  const pathname = usePathname();
  const canReport = useMemo(() => buildCreateItems(access).some((i) => i.createHref === REPORT_HREF), [access]);

  const tabs: Tab[] = [
    { href: "/", label: "Beranda", icon: LayoutDashboard },
    { href: "/tugas", label: "Tugas", icon: ClipboardCheck, badge: "tasks" },
    ...(canReport ? [{ href: REPORT_HREF, label: "Lapor", icon: Plus, primary: true }] : []),
    { href: "/notifikasi", label: "Notifikasi", icon: Inbox, badge: "notifications" },
    { href: "/profil", label: "Profil", icon: SquareUserRound },
  ];

  return (
    <nav
      aria-label="Navigasi utama"
      className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {tabs.map((t) => {
          const active = isActive(pathname, t.href);
          const count = t.badge ? badges[t.badge] : 0;
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground transition-colors",
                  active && "text-primary",
                )}
              >
                {t.primary ? (
                  <span className="-mt-5 flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-4 ring-background">
                    <t.icon className="size-5" />
                  </span>
                ) : (
                  <span className="relative">
                    <t.icon className="size-5" />
                    <CountBadge count={count} className="absolute -top-1.5 -right-2.5 h-4 min-w-4 text-[9px]" />
                  </span>
                )}
                <span>{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
