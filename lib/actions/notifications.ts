"use server";

// Server Action notifikasi, badge, dan langganan Web Push.
import { z } from "zod";
import type { BadgeCounts } from "@/components/providers/app-context";
import { dbError, NOT_ALLOWED, ok, type FormState } from "@/lib/action-state";
import { actionAccess } from "@/lib/auth";
import { getInitialBadges } from "@/lib/badges";
import { listNotifications, type NotificationCursor, type NotificationFilters } from "@/lib/notifications/server";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";

/** Hitungan badge terbaru (dipanggil saat notifikasi baru masuk / tab kembali fokus). */
export async function refreshBadgesAction(): Promise<BadgeCounts | null> {
  const access = await actionAccess("viewer");
  if (!access) return null;
  return getInitialBadges(await createClient(), access.userId);
}

export async function loadNotificationsAction(f: NotificationFilters, cursor: NotificationCursor) {
  const access = await actionAccess("viewer");
  if (!access) return { items: [], hasMore: false };
  const filters: NotificationFilters = {
    status: f.status === "belum" ? "belum" : "semua",
    kategori: f.kategori && /^[a-z_]{1,30}$/.test(f.kategori) ? f.kategori : null,
    q: String(f.q ?? "").slice(0, 100),
  };
  const safeCursor = cursor && isUuid(cursor.id) && !Number.isNaN(Date.parse(cursor.at)) ? cursor : null;
  return listNotifications(await createClient(), access.userId, filters, { cursor: safeCursor });
}

/** Inbox top bar: 7 hari terakhir, maks. 20 item. */
export async function loadInboxAction() {
  const access = await actionAccess("viewer");
  if (!access) return { items: [], hasMore: false };
  return listNotifications(await createClient(), access.userId, { status: "semua", kategori: null, q: "" }, { limit: 20, sinceDays: 7 });
}

/** Tandai dibaca/belum. Hanya baris yang statusnya berubah yang di-update (satu query). */
export async function markNotificationsAction(ids: string[], read: boolean): Promise<FormState> {
  const access = await actionAccess("viewer");
  const valid = ids.filter(isUuid).slice(0, 500);
  if (!access || !valid.length) return NOT_ALLOWED;
  const supabase = await createClient();
  let q = supabase.from("notifications").update({ read_at: read ? new Date().toISOString() : null }).in("id", valid);
  q = read ? q.is("read_at", null) : q.not("read_at", "is", null);
  const { data, error } = await q.select("id");
  if (error) return dbError(error);
  const n = data?.length ?? 0;
  return ok(`${n} notifikasi ditandai ${read ? "sudah" : "belum"} dibaca`, { changed: n });
}

export async function markAllNotificationsReadAction(): Promise<FormState> {
  const access = await actionAccess("viewer");
  if (!access) return NOT_ALLOWED;
  const supabase = await createClient();
  const { data, error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", access.userId).is("read_at", null).select("id");
  if (error) return dbError(error);
  return ok(data?.length ? `${data.length} notifikasi ditandai sudah dibaca` : "Tidak ada notifikasi baru.", { changed: data?.length ?? 0 });
}

const subSchema = z.object({
  endpoint: z.string().url().startsWith("https://").max(1000),
  p256dh: z.string().min(1).max(200),
  auth: z.string().min(1).max(100),
  userAgent: z.string().max(300).optional(),
});

export async function pushSubscribeAction(input: z.infer<typeof subSchema>): Promise<FormState> {
  if (!(await actionAccess("viewer"))) return NOT_ALLOWED;
  const parsed = subSchema.safeParse(input);
  if (!parsed.success) return { ...NOT_ALLOWED, message: "Data langganan push tidak valid." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("push_subscribe", {
    p_endpoint: parsed.data.endpoint,
    p_p256dh: parsed.data.p256dh,
    p_auth: parsed.data.auth,
    p_user_agent: parsed.data.userAgent,
  });
  if (error) return dbError(error);
  return ok("Notifikasi HP aktif di perangkat ini.");
}
