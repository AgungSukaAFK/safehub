"use client";

// Kanan top bar, berurutan: Inbox → Bantuan Admin → Tampilan │ Profil (frontend-guide §6.5).

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Headset, Palette } from "lucide-react";
import { AppearanceTabs } from "@/components/appearance/appearance-panels";
import { CreateMenu } from "@/components/topbar/create-menu";
import { useApp } from "@/components/providers/app-context";
import { TopbarIconButton } from "@/components/topbar/topbar-icon-button";
import { TopbarInbox } from "@/components/topbar/topbar-inbox";
import { buttonVariants } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AccountMenu } from "@/components/user/account-menu";
import { supportBadgeAction } from "@/app/(app)/bantuan/actions";
import { UserAvatar } from "@/components/user/user-avatar";
import { roleAtLeast } from "@/lib/roles";
import { cn } from "@/lib/utils";

const POPOVER = "w-[min(24rem,calc(100vw-1rem))] p-0 gap-0";

function Pill({ n }: { n: number }) {
  return n > 0 ? <span className="rounded-full bg-primary-foreground/20 px-1.5 text-[11px] tabular-nums">{n}</span> : null;
}

/** Dropdown Bantuan (frontend-guide §14): tidak langsung pindah halaman supaya isian form tidak hilang. */
function TopbarHelp() {
  const { access, badges } = useApp();
  const pathname = usePathname();
  const isAdmin = roleAtLeast(access.role, "admin");
  const [detail, setDetail] = useState<{ mineUnread: number; adminWaiting: number; adminMine: number } | null>(null);
  const dari = pathname.startsWith("/bantuan") ? "" : `?dari=${encodeURIComponent(pathname)}`;
  return (
    <Popover onOpenChange={(o) => o && void supportBadgeAction().then(setDetail)}>
      <PopoverTrigger render={<TopbarIconButton label="Bantuan Admin" badge={badges.support} />}>
        <Headset />
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} collisionPadding={8} className={cn(POPOVER, "gap-3 p-4")}>
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Headset className="size-4" />
          </span>
          <div className="space-y-1">
            <p className="font-semibold">Bantuan Admin</p>
            <p className="text-sm text-muted-foreground">
              {isAdmin
                ? "Percakapan bantuan dari pengguna app ini."
                : detail?.mineUnread
                  ? `Ada ${detail.mineUnread} balasan baru dari admin.`
                  : "Ada kendala atau pertanyaan? Tanyakan langsung ke admin app ini."}
            </p>
          </div>
        </div>
        <div className="grid gap-2">
          {isAdmin && (
            <>
              <Link href="/bantuan/kelola?status=menunggu" className={buttonVariants({ size: "sm" })}>
                Inbox Bantuan <Pill n={detail?.adminWaiting ?? 0} />
              </Link>
              <Link href="/bantuan/kelola?status=saya" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Percakapan Saya
                {!!detail?.adminMine && <span className="rounded-full bg-primary/10 px-1.5 text-[11px] text-primary tabular-nums">{detail.adminMine}</span>}
              </Link>
            </>
          )}
          <Link href={`/bantuan${dari}`} className={buttonVariants({ variant: isAdmin ? "ghost" : "default", size: "sm" })}>
            {isAdmin ? "Minta bantuan admin lain" : detail?.mineUnread ? "Lihat Balasan" : "Buka Bantuan Admin"}
            {!isAdmin && <Pill n={detail?.mineUnread ?? 0} />}
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TopbarAppearance() {
  return (
    <Popover>
      <PopoverTrigger render={<TopbarIconButton label="Tampilan" />}>
        <Palette />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={8}
        className="max-h-[calc(100dvh-6rem)] w-[min(20rem,calc(100vw-1rem))] gap-0 overflow-y-auto p-0"
      >
        <AppearanceTabs />
      </PopoverContent>
    </Popover>
  );
}

function TopbarProfile() {
  const { access, avatarUrl, badges } = useApp();
  return (
    <AccountMenu
      trigger={
        <button
          type="button"
          aria-label="Menu profil"
          className="relative flex items-center gap-2 rounded-full p-0.5 transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring data-popup-open:bg-accent lg:pr-2.5"
        >
          <UserAvatar name={access.profile.fullName} src={avatarUrl} className="size-8 sm:size-9" />
          <span className="hidden max-w-32 truncate text-sm font-medium lg:block">{access.profile.fullName}</span>
          {/* < sm: badge Bantuan ikut pindah ke avatar (tombol Bantuan ada di menu profil) */}
          {badges.support > 0 && (
            <span className="pointer-events-none absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-red-600 ring-2 ring-background sm:hidden" aria-hidden />
          )}
        </button>
      }
    />
  );
}

export function TopbarActions() {
  return (
    <div className="flex items-center gap-1 sm:gap-0.5">
      <div className="mr-1 sm:mr-1.5">
        <CreateMenu />
      </div>
      <TopbarInbox />
      {/* < sm: Bantuan & Tampilan pindah ke menu profil supaya nama site di top bar terbaca */}
      <div className="hidden sm:contents">
        <TopbarHelp />
        <TopbarAppearance />
      </div>
      <div className="mx-1 h-5 w-px bg-border sm:mx-1.5" aria-hidden />
      <TopbarProfile />
    </div>
  );
}
