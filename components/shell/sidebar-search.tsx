"use client";

import { useRef } from "react";
import { Search, X } from "lucide-react";
import { SidebarGroup, SidebarInput, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";

/**
 * Cari menu (port ga-web). Enter buka hasil teratas, Esc mengosongkan. Saat sidebar diciutkan
 * tampil sebagai tombol ikon yang membuka sidebar & fokus ke input.
 */
export function SidebarSearch({
  query,
  onQueryChange,
  onSubmit,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { setOpen } = useSidebar();

  return (
    <SidebarGroup className="py-0">
      <div className="relative group-data-[collapsible=icon]:hidden">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <SidebarInput
          ref={inputRef}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onSubmit();
            } else if (e.key === "Escape" && query) {
              e.preventDefault();
              onQueryChange("");
            }
          }}
          placeholder="Cari menu..."
          aria-label="Cari menu"
          className="h-8 pr-8 pl-8 text-base md:text-sm"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              onQueryChange("");
              inputRef.current?.focus();
            }}
            className="absolute top-1/2 right-1.5 flex size-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            aria-label="Hapus pencarian"
            title="Hapus pencarian"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      <SidebarMenu className="hidden group-data-[collapsible=icon]:flex">
        <SidebarMenuItem>
          <SidebarMenuButton
            tooltip={query ? `Cari menu: "${query}"` : "Cari menu"}
            isActive={!!query}
            onClick={() => {
              setOpen(true);
              window.setTimeout(() => inputRef.current?.focus(), 220); // tunggu animasi buka
            }}
          >
            <Search />
            <span>Cari menu</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
}
