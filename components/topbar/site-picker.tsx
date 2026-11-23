"use client";

// Pemilih site di top bar (rancangan §2.2). Opsi = site dalam scope user (+ "Semua site" bila > 1).
// Pilihan disimpan per perangkat (lib/storage.ts) dan dicerminkan ke cookie supaya loader server
// membacanya; halaman yang sudah memakai param `site` di URL ikut diganti param-nya.

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Check, ChevronDown, Loader2, MapPin } from "lucide-react";
import { useApp } from "@/components/providers/app-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { hrefWith } from "@/lib/search-params";
import { resolveSite, SITE_ALL, SITE_COOKIE, SITE_PARAM, SITE_STORAGE_KEY, siteLabel, type SiteChoice } from "@/lib/site-types";
import { writeStorage } from "@/lib/storage";

function writeSiteCookie(value: string) {
  // 1 tahun; Lax cukup (hanya preferensi tampilan)
  document.cookie = `${SITE_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
}

export function SitePicker() {
  const { access, sites, initialSite } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  if (!sites.length) return null;
  const fromUrl = searchParams.get(SITE_PARAM);
  const current: SiteChoice = fromUrl ? resolveSite(fromUrl, sites, access.profile.locationId) : initialSite;
  const label = siteLabel(current, sites);

  const choose = (value: string) => {
    writeStorage(SITE_STORAGE_KEY, value);
    writeSiteCookie(value);
    startTransition(() => {
      if (searchParams.has(SITE_PARAM)) router.replace(hrefWith(pathname, searchParams, { [SITE_PARAM]: value }), { scroll: false });
      else router.refresh();
    });
  };

  // Satu site saja: tampilkan sebagai label, bukan menu
  if (sites.length === 1) {
    return (
      <span className="hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground sm:inline-flex" title="Site">
        <MapPin className="size-3.5" /> {label}
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            aria-label={`Site: ${label}. Ganti site`}
            className="h-8 max-w-36 gap-1.5 rounded-full px-2.5 text-xs shadow-none sm:max-w-48"
          />
        }
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <MapPin className="size-3.5" />}
        <span className="truncate">{label}</span>
        <ChevronDown className="size-3.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Tampilkan data site</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => choose(SITE_ALL)}>
            <span className="grow">Semua site</span>
            {current === null && <Check className="size-4" />}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {sites.map((s) => (
            <DropdownMenuItem key={s.id} onClick={() => choose(s.id)}>
              <span className="grow truncate">{s.name}</span>
              {current === s.id && <Check className="size-4" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
