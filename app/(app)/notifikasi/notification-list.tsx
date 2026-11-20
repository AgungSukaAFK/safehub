"use client";

// Halaman /notifikasi (frontend-guide §13.3): filter di URL (dijalankan di query), grup per tanggal,
// "Muat lebih banyak" (30), toggle dibaca per item, pilih banyak.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff, Check, Loader2, MailOpen, Settings, X } from "lucide-react";
import { Content } from "@/components/list/content";
import { FilterSelect } from "@/components/list/filter-panel";
import { ListPendingBar, ListProvider, useList } from "@/components/list/list-context";
import { ListSearchInput } from "@/components/list/list-search-input";
import { NotificationSettings } from "@/components/notifications/notification-settings";
import { useNotification } from "@/components/providers/notification-provider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { UserAvatar } from "@/components/user/user-avatar";
import { useNow } from "@/hooks/use-now";
import { loadNotificationsAction } from "@/lib/actions/notifications";
import { formatDateLong, formatTime, timeAgo } from "@/lib/format";
import type { NotificationFilters } from "@/lib/notifications/server";
import { categoryLabel, NOTIFICATION_CATEGORIES, NOTIFICATION_EVENT, type NotificationItem } from "@/lib/notifications/types";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const wibDay = (iso: string | number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date(iso));

export function NotificationSettingsButton() {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Settings /> Pengaturan
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Pengaturan notifikasi</DialogTitle>
          <DialogDescription>Berlaku untuk perangkat ini saja.</DialogDescription>
        </DialogHeader>
        <NotificationSettings />
      </DialogContent>
    </Dialog>
  );
}

function StatusTabs() {
  const { get, setParams } = useList();
  const status = get("status") || "semua";
  return (
    <div className="inline-flex h-9 shrink-0 rounded-md border p-0.5" role="tablist">
      {[
        ["semua", "Semua"],
        ["belum", "Belum dibaca"],
      ].map(([v, l]) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={status === v}
          onClick={() => setParams({ status: v === "semua" ? null : v })}
          className={cn("rounded px-3 text-sm font-medium transition-colors", status === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export function NotificationList({ initial, initialHasMore, filters }: { initial: NotificationItem[]; initialHasMore: boolean; filters: NotificationFilters }) {
  const router = useRouter();
  const now = useNow();
  const { markRead } = useNotification();
  const [items, setItems] = useState(initial);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // data server baru (router.refresh) → ganti daftar (derived state saat render)
  const [prevInitial, setPrevInitial] = useState(initial);
  if (prevInitial !== initial) {
    setPrevInitial(initial);
    setItems(initial);
    setHasMore(initialHasMore);
  }

  useEffect(() => {
    const onNew = () => router.refresh();
    window.addEventListener(NOTIFICATION_EVENT, onNew);
    return () => window.removeEventListener(NOTIFICATION_EVENT, onNew);
  }, [router]);

  const setRead = async (ids: string[], read: boolean) => {
    const targets = items.filter((n) => ids.includes(n.id) && !!n.readAt !== read).map((n) => n.id);
    if (!targets.length) return 0;
    setItems((prev) => prev.map((n) => (targets.includes(n.id) ? { ...n, readAt: read ? new Date().toISOString() : null } : n)));
    return markRead(targets, read);
  };

  const loadMore = async () => {
    const last = items.at(-1);
    if (!last) return;
    setLoadingMore(true);
    try {
      const res = await loadNotificationsAction(filters, { at: last.createdAt, id: last.id });
      setItems((prev) => [...prev, ...res.items.filter((n) => !prev.some((p) => p.id === n.id))]);
      setHasMore(res.hasMore);
    } finally {
      setLoadingMore(false);
    }
  };

  // grup per tanggal WIB
  const today = now ? wibDay(now) : null;
  const yesterday = now ? wibDay(now - 86_400_000) : null;
  const groups: { key: string; label: string; items: NotificationItem[] }[] = [];
  for (const n of items) {
    const key = wibDay(n.createdAt);
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = { key, label: key === today ? "Hari ini" : key === yesterday ? "Kemarin" : formatDateLong(n.createdAt), items: [] };
      groups.push(g);
    }
    g.items.push(n);
  }
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allSelected = items.length > 0 && items.every((n) => selected.has(n.id));
  const filtered = filters.status !== "semua" || !!filters.kategori || !!filters.q;

  return (
    <ListProvider>
      <Content>
        <div className="space-y-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <ListSearchInput placeholder="Cari judul atau isi notifikasi..." searchableFields={["Judul", "Isi"]} />
            <div className="flex gap-2">
              <StatusTabs />
              <div className="w-44">
                <FilterSelect param="kategori" label="Kategori" allLabel="Semua kategori" options={Object.entries(NOTIFICATION_CATEGORIES).map(([value, c]) => ({ value, label: c.label }))} />
              </div>
            </div>
          </div>
          <ListPendingBar />

          {selected.size > 0 ? (
            <div className="sticky top-[calc(var(--topbar-h,4rem)+0.5rem)] z-20 flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2 pl-3 text-sm shadow-sm">
              <span className="font-medium">{selected.size} dipilih</span>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const n = await setRead([...selected], true);
                  toast.success(`${n} notifikasi ditandai sudah dibaca`);
                  setSelected(new Set());
                }}
              >
                <MailOpen /> Tandai dibaca
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const n = await setRead([...selected], false);
                  toast.success(`${n} notifikasi ditandai belum dibaca`);
                  setSelected(new Set());
                }}
              >
                <BellOff /> Tandai belum dibaca
              </Button>
              <Button size="icon-sm" variant="ghost" className="ml-auto" aria-label="Batal pilih" onClick={() => setSelected(new Set())}>
                <X />
              </Button>
            </div>
          ) : (
            items.length > 0 && (
              <label className="flex w-fit items-center gap-2 px-1 text-xs text-muted-foreground">
                <Checkbox checked={allSelected} onCheckedChange={(v) => setSelected(v ? new Set(items.map((n) => n.id)) : new Set())} />
                Pilih semua yang tampil
              </label>
            )
          )}

          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground">
              <Bell className="size-8 opacity-50" />
              {filtered ? "Tidak ada notifikasi yang cocok dengan filter." : "Belum ada notifikasi."}
            </div>
          ) : (
            groups.map((g) => (
              <section key={g.key} className="space-y-1">
                <h2 className="px-1 pt-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{g.label}</h2>
                <ul className="divide-y rounded-lg border">
                  {g.items.map((n) => {
                    const unread = !n.readAt;
                    const Icon = NOTIFICATION_CATEGORIES[n.category]?.icon ?? Bell;
                    return (
                      <li key={n.id} className={cn("group relative flex items-start gap-3 p-3", unread && "bg-primary/[0.06]")}>
                        <Checkbox className="mt-2.5" checked={selected.has(n.id)} onCheckedChange={() => toggle(n.id)} aria-label={`Pilih ${n.title}`} />
                        {n.actor ? <UserAvatar name={n.actor.name} src={n.actor.avatarUrl} className="size-9 shrink-0" /> : <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><Icon className="size-4" /></span>}
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => {
                            if (unread) void setRead([n.id], true);
                            if (n.href) router.push(n.href);
                          }}
                        >
                          <span className={cn("block text-sm", unread ? "font-semibold" : "font-medium")}>{n.title}</span>
                          {n.body && <span className="line-clamp-2 text-sm text-muted-foreground">{n.body}</span>}
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {categoryLabel(n.category)} · {formatTime(n.createdAt)}
                            {now ? ` · ${timeAgo(n.createdAt, new Date(now))}` : ""}
                          </span>
                        </button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="shrink-0 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:focus-visible:opacity-100"
                          aria-label={unread ? "Tandai sudah dibaca" : "Tandai belum dibaca"}
                          title={unread ? "Tandai sudah dibaca" : "Tandai belum dibaca"}
                          onClick={() => void setRead([n.id], unread)}
                        >
                          {unread ? <Check /> : <BellOff />}
                        </Button>
                        {unread && <span className="absolute top-3 right-3 size-2 rounded-full bg-primary pointer-fine:group-hover:hidden" aria-hidden />}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}

          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore && <Loader2 className="animate-spin" />} Muat lebih banyak
              </Button>
            </div>
          )}
        </div>
      </Content>
    </ListProvider>
  );
}
