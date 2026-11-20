"use client";

// Satu grup menu sidebar (port ga-web/components/nav-main.tsx). Klik → item langsung aktif + ikon
// berputar (aria-busy). "Atur" = sembunyikan menu per perangkat (grup Bantuan tidak bisa).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import type { NavItem } from "@/lib/nav";
import { isPlainLeftClick, setPendingNavUrl, usePendingNavUrl } from "@/lib/sidebar/nav-pending";
import { cn } from "@/lib/utils";

export type NavItemView = NavItem & { active: boolean; count?: number };

export function CountBadge({ count, className }: { count?: number; className?: string }) {
  if (!count || count <= 0) return null;
  return (
    <span
      className={cn(
        "flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] leading-none font-bold text-white",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function NavMain({
  label,
  items,
  hideable,
  searching,
  hidden,
  onToggleHidden,
}: {
  label: string;
  items: NavItemView[];
  hideable: boolean;
  /** Mode cari: item sudah disaring & diurutkan, tampil semua (termasuk yang disembunyikan) */
  searching: boolean;
  hidden: string[];
  onToggleHidden: (href: string, hide: boolean) => void;
}) {
  const pathname = usePathname();
  const pendingUrl = usePendingNavUrl();
  const { isMobile, setOpenMobile } = useSidebar();
  const showAtur = hideable && !searching && items.length > 0;
  const visible = showAtur ? items.filter((i) => !hidden.includes(i.href)) : items;

  return (
    <SidebarGroup>
      <div className="flex items-center justify-between">
        <SidebarGroupLabel>{label}</SidebarGroupLabel>
        {showAtur && (
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="xs"
                  className="mr-1 h-6 shrink-0 px-2 text-[11px] font-medium text-sidebar-foreground/60 shadow-none group-data-[collapsible=icon]:hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                >
                  Atur
                </Button>
              }
            />
            <PopoverContent align="end" className="w-64 p-3">
              <div className="space-y-1">
                <p className="text-sm leading-none font-medium">Atur menu {label}</p>
                <p className="text-xs text-muted-foreground">
                  Pilih menu yang ditampilkan. Hanya tersimpan di perangkat ini; menu tersembunyi tetap bisa dicari.
                </p>
              </div>
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {items.map((item) => {
                  const isHidden = hidden.includes(item.href);
                  return (
                    <label key={item.href} className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox checked={!isHidden} onCheckedChange={(checked) => onToggleHidden(item.href, !checked)} />
                      <item.icon className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="grow truncate">{item.label}</span>
                    </label>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
      <SidebarMenu>
        {visible.map((item) => {
          const isPending = pendingUrl === item.href;
          // Selama navigasi berjalan, highlight pindah ke menu yang diklik (terasa instan)
          const isActive = pendingUrl ? isPending : item.active;
          return (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                tooltip={item.count ? `${item.label} (${item.count})` : item.label}
                isActive={isActive}
                className={cn(
                  "h-9 gap-3 px-3 transition-[background-color,transform] active:scale-[0.98] data-active:bg-primary/5 data-active:text-foreground motion-reduce:active:scale-100",
                  isPending && "bg-primary/10 data-active:bg-primary/10",
                )}
                render={
                  <Link
                    href={item.href}
                    aria-busy={isPending || undefined}
                    aria-current={item.active ? "page" : undefined}
                    onClick={(e) => {
                      if (!isPlainLeftClick(e)) return;
                      if (isMobile) setOpenMobile(false);
                      if (item.href !== pathname) setPendingNavUrl(item.href);
                    }}
                  />
                }
              >
                <span className="relative flex size-4 shrink-0 items-center justify-center">
                  {isPending ? <Loader2 className="animate-spin text-primary" /> : <item.icon />}
                  {/* Saat sidebar diciutkan, badge pindah ke pojok ikon */}
                  <CountBadge
                    count={item.count}
                    className="absolute -top-2 -right-2.5 hidden h-4 min-w-4 text-[9px] group-data-[collapsible=icon]:flex"
                  />
                </span>
                <span className="grow truncate">{item.label}</span>
                <CountBadge count={item.count} className="ml-auto group-data-[collapsible=icon]:hidden" />
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
