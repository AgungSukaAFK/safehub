"use client";

// Inbox top bar (frontend-guide §13.4): satu daftar cepat dari semua sumber. 7 hari terakhir, maks.
// 20 item. Klik → tandai dibaca + tutup + pindah ke href.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellRing, CheckCheck, Headset, Inbox, Loader2, Megaphone, MessageSquare } from "lucide-react";
import { useApp } from "@/components/providers/app-context";
import { useNotification } from "@/components/providers/notification-provider";
import { TopbarIconButton } from "@/components/topbar/topbar-icon-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { UserAvatar } from "@/components/user/user-avatar";
import { useInbox } from "@/hooks/use-inbox";
import { useNow } from "@/hooks/use-now";
import { timeAgo } from "@/lib/format";
import type { NotificationItem } from "@/lib/notifications/types";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type Source = "notifikasi" | "bantuan" | "pembaruan";
type Row = {
  key: string;
  source: Source;
  followup?: boolean;
  title: string;
  body: string | null;
  href: string | null;
  unread: boolean;
  at: string | null;
  actor: NotificationItem["actor"];
  notifId?: string;
};

const SOURCE: Record<Source, { label: string; icon: typeof Inbox; color: string }> = {
  notifikasi: { label: "Notifikasi", icon: MessageSquare, color: "bg-primary" },
  bantuan: { label: "Bantuan", icon: Headset, color: "bg-sky-600" },
  pembaruan: { label: "Pembaruan", icon: Megaphone, color: "bg-amber-600" },
};
const FOLLOWUP = { label: "Follow-up", icon: BellRing, color: "bg-red-600" };

export function TopbarInbox() {
  const router = useRouter();
  const now = useNow();
  const { badges } = useApp();
  const { markRead, markAllRead } = useNotification();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"semua" | Source>("semua");
  const { items, loading, markLocal } = useInbox(open);

  const rows: Row[] = [
    ...(badges.updates > 0
      ? [{ key: "updates", source: "pembaruan" as const, title: "Ada pembaruan aplikasi", body: "Lihat apa yang baru di app ini.", href: "/pembaruan", unread: true, at: null, actor: null }]
      : []),
    ...items.map(
      (n): Row => ({
        key: n.id,
        notifId: n.id,
        source: n.category === "bantuan" ? "bantuan" : "notifikasi",
        followup: n.type === "approval.followup",
        title: n.title,
        body: n.body,
        href: n.href,
        unread: !n.readAt,
        at: n.createdAt,
        actor: n.actor,
      }),
    ),
  ];
  const unreadBy = (s: Source) => rows.filter((r) => r.source === s && r.unread).length;
  const shown = filter === "semua" ? rows : rows.filter((r) => r.source === filter);
  const total = badges.notifications + badges.updates;

  const openRow = (r: Row) => {
    if (r.notifId && r.unread) {
      markLocal([r.notifId], true);
      void markRead([r.notifId]);
    }
    setOpen(false);
    if (r.href) router.push(r.href);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<TopbarIconButton label="Inbox" badge={total} />}>
        <Inbox />
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[min(24rem,calc(100vw-1rem))] gap-0 p-0">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <p className="font-semibold">Inbox</p>
            {total > 0 && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{total} baru</span>}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            disabled={badges.notifications === 0}
            onClick={async () => {
              const n = await markAllRead();
              markLocal(
                items.map((i) => i.id),
                true,
              );
              if (n) toast.success(`${n} notifikasi ditandai sudah dibaca`);
            }}
          >
            <CheckCheck /> Tandai semua dibaca
          </Button>
        </div>
        <div className="flex gap-1 overflow-x-auto border-b px-3 py-2">
          {(["semua", "notifikasi", "bantuan", "pembaruan"] as const).map((f) => {
            const n = f === "semua" ? rows.filter((r) => r.unread).length : unreadBy(f);
            return (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                  filter === f ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
                )}
              >
                {f === "semua" ? "Semua" : SOURCE[f].label}
                {n > 0 && <span className="ml-1 opacity-80">{n}</span>}
              </button>
            );
          })}
        </div>
        <div className="max-h-[min(60vh,28rem)] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Memuat...
            </div>
          ) : shown.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground">
              <Inbox className="size-6 opacity-60" /> Inbox kosong
            </div>
          ) : (
            <ul>
              {shown.map((r) => {
                const S = r.followup ? FOLLOWUP : SOURCE[r.source];
                return (
                  <li key={r.key}>
                    <button
                      type="button"
                      onClick={() => openRow(r)}
                      className={cn(
                        "relative flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-accent",
                        r.unread && "bg-primary/[0.06] before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-primary",
                      )}
                    >
                      <span className="relative shrink-0">
                        {r.actor ? (
                          <UserAvatar name={r.actor.name} src={r.actor.avatarUrl} className="size-9" />
                        ) : (
                          <span className={cn("flex size-9 items-center justify-center rounded-full text-white", S.color)}>
                            <S.icon className="size-4" />
                          </span>
                        )}
                        {r.actor && (
                          <span className={cn("absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full text-white ring-2 ring-popover", S.color)}>
                            <S.icon className="size-2.5" />
                          </span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-sm leading-snug", r.unread ? "font-semibold" : "font-medium")}>{r.title}</span>
                        {r.body && <span className="line-clamp-2 text-xs text-muted-foreground">{r.body}</span>}
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">
                          {S.label}
                          {r.at && now ? ` · ${timeAgo(r.at, new Date(now))}` : ""}
                        </span>
                      </span>
                      {r.unread && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Belum dibaca" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-between border-t px-4 py-2">
          <span className="text-[11px] text-muted-foreground">7 hari terakhir · maks. 20</span>
          <Link href="/notifikasi" onClick={() => setOpen(false)} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-7 text-xs")}>
            Semua notifikasi
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
