"use client";

// Data Inbox top bar (frontend-guide §13.4): dimuat saat popover dibuka (Server Action), dimuat
// ulang kalau notifikasi baru masuk selagi terbuka. Bukan fetch data awal halaman.
import { useCallback, useEffect, useState } from "react";
import { loadInboxAction } from "@/lib/actions/notifications";
import { NOTIFICATION_EVENT, type NotificationItem } from "@/lib/notifications/types";

export function useInbox(open: boolean) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems((await loadInboxAction()).items);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(load, 0);
    window.addEventListener(NOTIFICATION_EVENT, load);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener(NOTIFICATION_EVENT, load);
    };
  }, [open, load]);

  const markLocal = (ids: string[], read: boolean) =>
    setItems((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, readAt: read ? new Date().toISOString() : null } : n)));

  return { items, loading: loading && !loaded, markLocal };
}
