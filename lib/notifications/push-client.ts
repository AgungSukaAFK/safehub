"use client";

// Langganan Web Push perangkat ini (frontend-guide §13.6). Simpan lewat Server Action → RPC
// push_subscribe; hapus lewat /api/push/unsubscribe (juga dipanggil saat Keluar).
import { VAPID_PUBLIC_KEY } from "@/lib/env";
import { pushSubscribeAction } from "@/lib/actions/notifications";
import { registerServiceWorker } from "@/lib/notifications/browser";

export const pushConfigured = () => !!VAPID_PUBLIC_KEY;
export const pushSupported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function currentPushSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/** Minta izin + daftarkan perangkat. Mengembalikan pesan error (Indonesia) atau null kalau sukses. */
export async function enablePush(): Promise<string | null> {
  if (!pushConfigured()) return "Web Push belum dikonfigurasi di server (VAPID key kosong).";
  if (!pushSupported()) return "Browser ini tidak mendukung notifikasi push. Di iPhone, pasang app ke Layar Utama dulu.";
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return "Izin notifikasi ditolak. Aktifkan dari pengaturan situs di browser.";
  const reg = (await registerServiceWorker()) ?? (await navigator.serviceWorker.ready);
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) }));
  const json = sub.toJSON();
  const res = await pushSubscribeAction({ endpoint: sub.endpoint, p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "", userAgent: navigator.userAgent });
  return res.status === "ok" ? null : (res.message ?? "Gagal mengaktifkan notifikasi HP.");
}

export async function disablePush() {
  const sub = await currentPushSubscription();
  if (!sub) return;
  await fetch("/api/push/unsubscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}
