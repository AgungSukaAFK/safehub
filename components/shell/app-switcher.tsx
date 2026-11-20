"use client";

// Pindah antar app Lourdes dengan satu akun (frontend-guide §6.3). Sumber: public.my_apps().
import { Check, ChevronsUpDown, ExternalLink, LayoutGrid } from "lucide-react";
import { useApp } from "@/components/providers/app-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { APP_ID, APP_NAME } from "@/lib/app-config";
import { isRole, ROLE_LABELS } from "@/lib/roles";

export function AppSwitcher() {
  const { myApps, access } = useApp();
  const { isMobile } = useSidebar();
  const others = myApps.filter((a) => a.id !== APP_ID && a.id !== "platform" && a.url);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                tooltip={APP_NAME}
                className="border bg-background/60 data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
              />
            }
          >
            <span className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <LayoutGrid className="size-4" />
            </span>
            <span className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">{APP_NAME}</span>
              <span className="truncate text-xs text-muted-foreground">Role: {ROLE_LABELS[access.role]}</span>
            </span>
            <ChevronsUpDown className="ml-auto" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--anchor-width) min-w-60 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground">App Lourdes Anda</DropdownMenuLabel>
              <DropdownMenuItem className="gap-2 p-2">
                <span className="flex size-6 items-center justify-center rounded-md border bg-primary text-primary-foreground">
                  <LayoutGrid className="size-3.5" />
                </span>
                <span className="flex-1 truncate font-medium">{APP_NAME}</span>
                <Check className="size-4" />
              </DropdownMenuItem>
              {others.map((app) => (
                <DropdownMenuItem
                  key={app.id}
                  className="gap-2 p-2"
                  render={<a href={app.url!} rel="noopener" data-pwa-new-window />}
                >
                  <span className="flex size-6 items-center justify-center rounded-md border">
                    <LayoutGrid className="size-3.5" />
                  </span>
                  <span className="grid flex-1 leading-tight">
                    <span className="truncate">{app.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {isRole(app.role) ? ROLE_LABELS[app.role] : app.role}
                    </span>
                  </span>
                  <ExternalLink className="size-3.5 text-muted-foreground" />
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            {others.length === 0 && (
              <>
                <DropdownMenuSeparator />
                <p className="px-2 py-1.5 text-xs text-muted-foreground">Belum ada app Lourdes lain untuk akun ini.</p>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
