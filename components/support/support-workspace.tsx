"use client";

// Ruang kerja Bantuan Admin (frontend-guide §14): dua panel dalam satu Content (daftar | thread).
// Dipakai /bantuan (user) dan /bantuan/kelola (admin, asAdmin). Thread terpilih di `?t=<id>`.
// Di HP hanya satu panel. Notifikasi kategori bantuan (channel global) → daftar disegarkan.
import { TimeAgo } from "@/components/time-ago";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Headset, Plus } from "lucide-react";
import { StatusBadge } from "@/components/detail/status-badge";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user/user-avatar";
import type { NotificationItem } from "@/lib/notifications/types";
import { NOTIFICATION_EVENT } from "@/lib/notifications/types";

import { SUPPORT_STATUS, supportCategoryLabel, type SupportThread, type SupportThreadDetail } from "@/lib/support-types";
import { cn } from "@/lib/utils";
import { NewThreadDialog } from "./new-thread-dialog";
import { SupportThread as ThreadView } from "./support-thread";

export type AdminTab = { key: string; label: string; count?: number; href: string; active: boolean };

export function SupportWorkspace({
  asAdmin,
  basePath,
  threads,
  selected,
  tabs,
  admins = [],
  fromPage,
  query,
}: {
  asAdmin: boolean;
  basePath: string;
  threads: SupportThread[];
  selected: SupportThreadDetail | null;
  tabs?: AdminTab[];
  admins?: { id: string; name: string }[];
  fromPage: string | null;
  /** query string selain t (filter tab), dipertahankan saat memilih thread */
  query: string;
}) {
  const router = useRouter();
  const [newOpen, setNewOpen] = useState(false);

  useEffect(() => {
    const onNotif = (e: Event) => {
      if ((e as CustomEvent<NotificationItem>).detail?.category === "bantuan") router.refresh();
    };
    window.addEventListener(NOTIFICATION_EVENT, onNotif);
    return () => window.removeEventListener(NOTIFICATION_EVENT, onNotif);
  }, [router]);

  const hrefFor = (id: string) => `${basePath}?${new URLSearchParams([...new URLSearchParams(query).entries(), ["t", id]])}`;

  return (
    <section className="col-span-12 grid h-[calc(100svh-15rem)] min-h-[480px] overflow-hidden rounded-xl border bg-card shadow-sm md:grid-cols-[minmax(260px,340px)_1fr]">
      {/* daftar */}
      <div className={cn("flex min-h-0 flex-col border-r", selected && "hidden md:flex")}>
        <div className="space-y-2 border-b p-3">
          {!asAdmin && (
            <Button className="w-full" onClick={() => setNewOpen(true)}>
              <Plus /> Percakapan Baru
            </Button>
          )}
          {tabs && (
            <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5" role="tablist" aria-label="Filter percakapan">
              {tabs.map((t) => (
                <Link
                  key={t.key}
                  href={t.href}
                  role="tab"
                  aria-selected={t.active}
                  className={cn(
                    "inline-flex h-7 shrink-0 items-center gap-1 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap",
                    t.active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                  )}
                >
                  {t.label}
                  {!!t.count && <span className={cn("rounded-full px-1.5 text-[10px]", t.active ? "bg-primary-foreground/20" : "bg-muted")}>{t.count}</span>}
                </Link>
              ))}
            </div>
          )}
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {threads.length === 0 ? (
            <li className="p-6 text-center text-sm text-muted-foreground">{asAdmin ? "Tidak ada percakapan di filter ini." : "Belum ada percakapan."}</li>
          ) : (
            threads.map((t) => (
              <li key={t.id}>
                <Link
                  href={hrefFor(t.id)}
                  scroll={false}
                  className={cn("flex gap-3 border-b px-3 py-3 transition-colors hover:bg-muted/50", selected?.id === t.id && "bg-primary/5")}
                  aria-current={selected?.id === t.id ? "true" : undefined}
                >
                  {asAdmin && <UserAvatar name={t.user?.name} src={t.user?.avatarUrl} className="size-8 text-[11px]" />}
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="flex items-center gap-2">
                      <span className={cn("truncate text-sm", t.unread ? "font-semibold" : "font-medium")}>{t.subject}</span>
                      {t.unread && <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Ada pesan baru" />}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {asAdmin && t.user ? `${t.user.name} · ` : ""}
                      {supportCategoryLabel(t.category)}
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <StatusBadge value={t.status} map={SUPPORT_STATUS} />
                      <TimeAgo at={t.lastMessageAt} className="text-[11px] text-muted-foreground" />
                    </span>
                  </span>
                </Link>
              </li>
            ))
          )}
        </ul>
      </div>

      {/* thread */}
      <div className={cn("min-h-0", !selected && "hidden md:block")}>
        {selected ? (
          <ThreadView key={selected.id} thread={selected} asAdmin={asAdmin} basePath={`${basePath}${query ? `?${query}` : ""}`} admins={admins} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Headset className="size-6" />
            </span>
            <p className="font-medium">{asAdmin ? "Pilih percakapan di kiri" : "Pilih percakapan, atau mulai yang baru"}</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              {asAdmin ? "Balas, ambil, atau alihkan ke admin lain. Pengguna mendapat notifikasi setiap Anda membalas." : "Admin app ini akan membalas di sini. Anda juga mendapat notifikasi saat ada balasan."}
            </p>
          </div>
        )}
      </div>

      {!asAdmin && <NewThreadDialog open={newOpen} onOpenChange={setNewOpen} fromPage={fromPage} basePath={basePath} />}
    </section>
  );
}
