"use client";

// Notifikasi realtime (frontend-guide §13.2). SATU channel per tab (INSERT notifications milik user):
// badge + suara + notifikasi browser (tab tidak fokus) / toast (tab fokus) + event untuk halaman yang
// sedang terbuka. Tab kembali fokus / online → refresh() sekali untuk menutup celah event terlewat.

import { createContext, useCallback, useContext, useEffect, useEffectEvent, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useApp, type BadgeCounts } from "@/components/providers/app-context";
import { markAllNotificationsReadAction, markNotificationsAction, refreshBadgesAction } from "@/lib/actions/notifications";
import { APP_ID } from "@/lib/app-config";
import { registerServiceWorker, showBrowserNotification } from "@/lib/notifications/browser";
import { useNotificationSettings } from "@/lib/notifications/settings";
import { playNotificationSound } from "@/lib/notifications/sound";
import { NOTIFICATION_EVENT } from "@/lib/notifications/types";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

type Latest = { id: string; title: string; body: string | null; href: string | null; category: string; createdAt: string };

type NotificationContextValue = {
  unreadCount: number;
  latest: Latest | null;
  markRead: (ids: string[], read?: boolean) => Promise<number>;
  markAllRead: () => Promise<number>;
  refresh: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { access, badges, setBadge } = useApp();
  const userId = access.userId;
  const router = useRouter();
  const pathname = usePathname();
  const { settings } = useNotificationSettings();
  const [latest, setLatest] = useState<Latest | null>(null);
  const lastRefresh = useRef(0);

  const applyBadges = useCallback(
    (b: BadgeCounts | null) => {
      if (!b) return;
      (Object.keys(b) as (keyof BadgeCounts)[]).forEach((k) => setBadge(k, b[k]));
    },
    [setBadge],
  );

  const refresh = useCallback(async () => {
    lastRefresh.current = Date.now();
    applyBadges(await refreshBadgesAction().catch(() => null));
  }, [applyBadges]);

  const onInsert = useEffectEvent((row: Record<string, unknown>) => {
    const n: Latest = {
      id: String(row.id),
      title: String(row.title ?? "Notifikasi baru"),
      body: (row.body as string | null) ?? null,
      href: (row.href as string | null) ?? null,
      category: String(row.category ?? "umum"),
      createdAt: String(row.created_at ?? new Date().toISOString()),
    };
    setLatest(n);
    setBadge("notifications", (v) => v + 1);
    void refresh(); // approval/bantuan ikut berubah
    if (settings.sound) playNotificationSound(settings.tone, settings.volume);
    const focused = document.visibilityState === "visible" && document.hasFocus();
    if (!focused && settings.browser) {
      void showBrowserNotification({ title: n.title, body: n.body, url: n.href, tag: `notif-${n.id}` });
    } else if (focused) {
      toast.info(`Notifikasi baru: ${n.title}`, {
        description: n.body ?? undefined,
        action: n.href ? { label: "Lihat", onClick: () => router.push(n.href!) } : undefined,
      });
    }
    window.dispatchEvent(new CustomEvent(NOTIFICATION_EVENT, { detail: n }));
    // halaman yang sedang menampilkan dokumen terkait ikut diperbarui
    const target = n.href?.split("?")[0];
    if (target && (target === pathname || pathname === "/tugas")) router.refresh();
  });

  // channel realtime tunggal
  useEffect(() => {
    const supabase = createClient();
    let channel: RealtimeChannel | null = null;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      if (cancelled) return;
      channel = supabase
        .channel(`notifications:${userId}`)
        .on("postgres_changes", { event: "INSERT", schema: APP_ID, table: "notifications", filter: `user_id=eq.${userId}` }, (payload) =>
          onInsert(payload.new as Record<string, unknown>),
        )
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [userId]);

  // SW untuk notifikasi browser & push; refresh saat kembali fokus/online (maks. sekali per 10 detik)
  useEffect(() => {
    void registerServiceWorker();
    const onBack = () => {
      if (document.visibilityState !== "visible" || Date.now() - lastRefresh.current < 10_000) return;
      void refresh();
    };
    document.addEventListener("visibilitychange", onBack);
    window.addEventListener("online", onBack);
    window.addEventListener("focus", onBack);
    return () => {
      document.removeEventListener("visibilitychange", onBack);
      window.removeEventListener("online", onBack);
      window.removeEventListener("focus", onBack);
    };
  }, [refresh]);

  const markRead = useCallback(
    async (ids: string[], read = true) => {
      const res = await markNotificationsAction(ids, read);
      const changed = Number(res.data?.changed ?? 0);
      if (changed) setBadge("notifications", (v) => v + (read ? -changed : changed));
      return changed;
    },
    [setBadge],
  );

  const markAllRead = useCallback(async () => {
    const res = await markAllNotificationsReadAction();
    setBadge("notifications", 0);
    return Number(res.data?.changed ?? 0);
  }, [setBadge]);

  const value = useMemo(
    () => ({ unreadCount: badges.notifications, latest, markRead, markAllRead, refresh }),
    [badges.notifications, latest, markRead, markAllRead, refresh],
  );
  return <NotificationContext value={value}>{children}</NotificationContext>;
}

export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotification harus dipakai di dalam NotificationProvider");
  return ctx;
}
