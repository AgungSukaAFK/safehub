// Loader notifikasi (server). RLS: user hanya membaca miliknya.
import "server-only";
import { getPeople } from "@/lib/people";
import type { NotificationItem } from "@/lib/notifications/types";
import type { ServerClient } from "@/lib/supabase/server";
import { orIlikeFilter, searchTerms } from "@/lib/utils";

export const NOTIF_PAGE = 30;

export type NotificationFilters = { status: "semua" | "belum"; kategori: string | null; q: string };
/** Kursor "muat lebih banyak": created_at + id baris terakhir */
export type NotificationCursor = { at: string; id: string } | null;

export async function listNotifications(
  supabase: ServerClient,
  userId: string,
  f: NotificationFilters,
  opts: { cursor?: NotificationCursor; limit?: number; sinceDays?: number } = {},
): Promise<{ items: NotificationItem[]; hasMore: boolean }> {
  const limit = opts.limit ?? NOTIF_PAGE;
  let q = supabase
    .from("notifications")
    .select("id, type, category, title, body, href, read_at, created_at, actor_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);
  if (f.status === "belum") q = q.is("read_at", null);
  if (f.kategori) q = q.eq("category", f.kategori);
  for (const w of searchTerms(f.q)) q = q.or(orIlikeFilter(["title", "body"], w));
  if (opts.sinceDays) q = q.gte("created_at", new Date(Date.now() - opts.sinceDays * 86_400_000).toISOString());
  if (opts.cursor) q = q.or(`created_at.lt."${opts.cursor.at}",and(created_at.eq."${opts.cursor.at}",id.lt.${opts.cursor.id})`);
  const { data, error } = await q;
  if (error) throw error;
  const rows = data ?? [];
  const people = await getPeople(supabase, rows.map((r) => r.actor_id));
  return {
    hasMore: rows.length > limit,
    items: rows.slice(0, limit).map((r) => {
      const a = r.actor_id ? people.get(r.actor_id) : null;
      return {
        id: r.id,
        type: r.type,
        category: r.category,
        title: r.title,
        body: r.body,
        href: r.href,
        readAt: r.read_at,
        createdAt: r.created_at,
        actor: a ? { id: a.id, name: a.name, avatarUrl: a.avatarUrl } : null,
      };
    }),
  };
}
