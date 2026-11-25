// Web Push setelah aksi yang membuat notifikasi (backend-guide §8, frontend-guide §11.2).
// Alur: RPC mengembalikan notification_ids → push_targets (hanya notifikasi buatan pemanggil, 2 menit
// terakhir) → web-push → push_prune untuk endpoint mati. Best-effort di after(): gagal kirim tidak
// pernah menggagalkan aksi. Tanpa VAPID env = dilewati diam-diam.
import "server-only";
import { after } from "next/server";
import * as webpush from "web-push"; // CJS: default import undefined di runtime
import { VAPID_PUBLIC_KEY } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";
const SUBJECT = process.env.VAPID_SUBJECT || "mailto:it@garudamart.com";
const enabled = !!(VAPID_PUBLIC_KEY && PRIVATE_KEY);
if (enabled) webpush.setVapidDetails(SUBJECT, VAPID_PUBLIC_KEY, PRIVATE_KEY);

/** Ambil `notification_ids` dari hasil RPC engine (jsonb). */
export function notificationIds(result: unknown): string[] {
  const ids = (result as { notification_ids?: unknown } | null)?.notification_ids;
  return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string") : [];
}

export async function sendPushForNotifications(ids: string[]) {
  if (!enabled || ids.length === 0) return;
  const supabase = await createClient(); // dibuat sebelum after(): masih membawa sesi user
  after(async () => {
    try {
      const { data, error } = await supabase.rpc("push_targets", { p_notification_ids: ids });
      if (error) throw error;
      const dead: string[] = [];
      await Promise.all(
        (data ?? []).map(async (t) => {
          try {
            await webpush.sendNotification(
              { endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } },
              JSON.stringify({ title: t.title, body: t.body, url: t.href, tag: t.tag }),
              { TTL: 86_400, urgency: "high", timeout: 5000 },
            );
          } catch (e) {
            const code = (e as { statusCode?: number }).statusCode;
            if (code === 404 || code === 410) dead.push(t.endpoint);
          }
        }),
      );
      if (dead.length) await supabase.rpc("push_prune", { p_endpoints: dead });
    } catch (e) {
      console.error("[push]", e instanceof Error ? e.message : e);
    }
  });
}
