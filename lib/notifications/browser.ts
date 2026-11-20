"use client";

// Notifikasi browser (frontend-guide §13.2): lewat service worker (klik ditangani sw.js), jatuh ke
// `new Notification()` hanya kalau SW tidak ada.
import { APP_NAME } from "@/lib/app-config";

export const notificationSupported = () => typeof window !== "undefined" && "Notification" in window;

export function notificationPermission(): NotificationPermission | "unsupported" {
  return notificationSupported() ? Notification.permission : "unsupported";
}

export async function requestNotificationPermission() {
  if (!notificationSupported()) return "unsupported" as const;
  return Notification.requestPermission();
}

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    return null;
  }
}

export async function showBrowserNotification(n: { title: string; body?: string | null; url?: string | null; tag?: string }) {
  if (notificationPermission() !== "granted") return;
  const options: NotificationOptions = { body: n.body ?? undefined, tag: n.tag, icon: "/icon.svg", badge: "/icon.svg", data: { url: n.url ?? "/" } };
  const reg = await navigator.serviceWorker?.getRegistration?.().catch(() => undefined);
  if (reg) return reg.showNotification(n.title || APP_NAME, options);
  const notif = new Notification(n.title || APP_NAME, options);
  notif.onclick = () => {
    window.focus();
    if (n.url) window.location.assign(n.url);
  };
}
