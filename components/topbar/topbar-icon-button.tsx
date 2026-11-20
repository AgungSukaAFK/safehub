"use client";

import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Tombol ikon bulat di top bar + badge opsional (frontend-guide §6.5). Visual 32px di HP tapi area
 * tap diperluas (after:) jadi 36px. Badge red-600 (putih di atasnya lolos AA, menonjol di gelap).
 * Tetap tersorot selama popover/menu-nya terbuka (data-popup-open).
 */
export function TopbarIconButton({
  badge,
  label,
  className,
  children,
  ...props
}: ComponentProps<typeof Button> & { badge?: number; label: string }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={badge ? `${label} (${badge} baru)` : label}
      title={label}
      className={cn(
        "relative size-8 rounded-full text-muted-foreground shadow-none after:absolute after:-inset-0.5 after:rounded-full hover:text-foreground data-popup-open:bg-accent data-popup-open:text-foreground sm:size-9 sm:after:hidden",
        className,
      )}
      {...props}
    >
      {children}
      {!!badge && badge > 0 && (
        <span className="pointer-events-none absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] leading-none font-semibold text-white ring-2 ring-background">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Button>
  );
}
