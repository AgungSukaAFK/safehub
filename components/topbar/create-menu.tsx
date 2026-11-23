"use client";

// Tombol "Buat ▾" di top bar (rancangan §2.13): isi = NAV_ITEMS yang punya createHref dan boleh
// dilihat user (role + fungsi K3). Tidak tampil kalau kosong.

import { useMemo } from "react";
import Link from "next/link";
import { ChevronDown, Plus } from "lucide-react";
import { useApp } from "@/components/providers/app-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buildCreateItems } from "@/lib/nav";

export function CreateMenu() {
  const { access } = useApp();
  const items = useMemo(() => buildCreateItems(access), [access]);
  if (!items.length) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button size="sm" aria-label="Buat baru" className="h-8 gap-1 rounded-full px-2.5 sm:px-3" />}>
        <Plus />
        <span className="hidden sm:inline">Buat</span>
        <ChevronDown className="hidden size-3.5 opacity-70 sm:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Buat baru</DropdownMenuLabel>
          {items.map((i) => (
            <DropdownMenuItem key={i.href} render={<Link href={i.createHref!} />}>
              <i.icon />
              <span className="grow truncate">{i.createLabel ?? i.label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
