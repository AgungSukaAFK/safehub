"use client";

import { removeStorageByPrefix } from "@/lib/storage";

/**
 * Keluar dari perangkat ini: bersihkan data per user di perangkat (draft, cache halaman offline,
 * langganan push), lalu POST /auth/signout (CCTV auth.logout + signOut) dan muat ulang penuh.
 */
export async function signOutEverywhereLocal(userId?: string) {
  try {
    if (userId) removeStorageByPrefix(`draft:${userId}:`);
    // Cache halaman offline milik user (sw.js, F11)
    navigator.serviceWorker?.controller?.postMessage({ type: "clear-user-cache" });
    // Langganan Web Push perangkat ini dihapus supaya notifikasi user lain tidak masuk (F6)
    const reg = await navigator.serviceWorker?.getRegistration?.();
    const sub = await reg?.pushManager?.getSubscription();
    if (sub) {
      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(() => {});
      await sub.unsubscribe().catch(() => {});
    }
  } catch {
    /* pembersihan best-effort; keluar tetap jalan */
  }
  const res = await fetch("/auth/signout", { method: "POST", redirect: "manual" }).catch(() => null);
  void res;
  // Muat ulang PENUH (bukan router.push): buang semua state client & cache RSC user sebelumnya
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign("/auth/login");
}
