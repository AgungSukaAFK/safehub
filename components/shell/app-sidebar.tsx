"use client";

// Sidebar app (frontend-guide §6.3, port ga-web/components/app-sidebar.tsx). Menu dari lib/nav.ts
// (sama dengan global search), aktif = longest match, badge dari AppProvider.

import { useMemo, type ComponentProps } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { ChevronsUpDown, SearchX } from "lucide-react";
import { useApp } from "@/components/providers/app-context";
import { AppSwitcher } from "@/components/shell/app-switcher";
import { NavMain, type NavItemView } from "@/components/shell/nav-main";
import { SidebarSearch } from "@/components/shell/sidebar-search";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { AccountMenu } from "@/components/user/account-menu";
import { UserAvatar } from "@/components/user/user-avatar";
import { activeHref, buildNavGroups } from "@/lib/nav";
import { normalizeSearch, scoreMenuItem, searchMenuItems } from "@/lib/sidebar/menu-search";
import { setPendingNavUrl } from "@/lib/sidebar/nav-pending";
import { useStoredState } from "@/lib/storage";

/** Tombol akun di footer sidebar: avatar, nama, email → menu akun. */
function NavUserButton() {
  const { access, avatarUrl } = useApp();
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <AccountMenu
          side="right"
          align="end"
          trigger={
            <SidebarMenuButton
              size="lg"
              tooltip={access.profile.fullName}
              className="data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
            >
              <UserAvatar name={access.profile.fullName} src={avatarUrl} shape="rounded" className="size-8" />
              <span className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{access.profile.fullName}</span>
                <span className="truncate text-xs text-muted-foreground">{access.email}</span>
              </span>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          }
        />
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
export function AppSidebar(props: ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const router = useRouter();
  const { access, badges } = useApp();
  const [query, setQuery] = useStoredState("sidebar-search", "");
  const [hiddenMap, setHiddenMap] = useStoredState<Record<string, string[]>>("sidebar-hidden", {});

  const groups = useMemo(() => buildNavGroups(access), [access]);
  const allItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const active = activeHref(pathname, allItems);

  const viewGroups = useMemo(
    () =>
      groups.map((g) => ({
        ...g,
        items: g.items.map(
          (i): NavItemView => ({ ...i, active: i.href === active, count: i.badge ? badges[i.badge] : undefined }),
        ),
      })),
    [groups, active, badges],
  );

  const searching = normalizeSearch(query) !== "";
  const shown = searching
    ? viewGroups.map((g) => ({ ...g, items: searchMenuItems(g.items, query, g.label) })).filter((g) => g.items.length > 0)
    : viewGroups;

  const openTopResult = () => {
    if (!searching) return;
    let best: { href: string; score: number } | null = null;
    for (const g of viewGroups) {
      for (const item of g.items) {
        const score = scoreMenuItem(query, item, g.label);
        if (score > 0 && (!best || score > best.score)) best = { href: item.href, score };
      }
    }
    if (!best) return;
    if (best.href !== pathname) setPendingNavUrl(best.href);
    router.push(best.href);
  };

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div className="px-1 pt-1 group-data-[collapsible=icon]:hidden">
          <Image
            src="/lourdes-logo.webp"
            alt="Lourdes Auto Parts"
            width={1024}
            height={392}
            priority
            className="h-auto w-full"
          />
        </div>
        <AppSwitcher />
      </SidebarHeader>

      <SidebarSearch query={query} onQueryChange={setQuery} onSubmit={openTopResult} />

      <SidebarContent>
        {shown.map((g) => (
          <NavMain
            key={g.id}
            label={g.label}
            items={g.items}
            hideable={g.id !== "bantuan"}
            searching={searching}
            hidden={hiddenMap[g.id] ?? []}
            onToggleHidden={(href, hide) =>
              setHiddenMap((prev) => {
                const cur = prev[g.id] ?? [];
                return { ...prev, [g.id]: hide ? Array.from(new Set([...cur, href])) : cur.filter((h) => h !== href) };
              })
            }
          />
        ))}
        {searching && shown.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted-foreground group-data-[collapsible=icon]:hidden">
            <SearchX className="size-6 opacity-60" />
            <p>
              Tidak ada menu untuk &ldquo;<span className="font-medium text-foreground">{query}</span>&rdquo;
            </p>
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-xs font-medium text-primary underline-offset-4 hover:underline"
            >
              Hapus pencarian
            </button>
          </div>
        )}
      </SidebarContent>

      <SidebarFooter>
        <NavUserButton />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
