import "server-only";
import type { BadgeCounts } from "@/components/providers/app-context";
import type { ServerClient } from "@/lib/supabase/server";

/** Hitungan badge awal (dibaca sekali di layout; realtime notifikasi memperbaruinya, F6). */
export async function getInitialBadges(supabase: ServerClient, userId: string): Promise<BadgeCounts> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [unread, pending, support, latest, seen] = await Promise.all([
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null),
    supabase.rpc("my_tasks", { p_limit: 500 }),
    supabase.rpc("support_badge"),
    supabase.from("updates").select("id").gte("created_at", sevenDaysAgo).order("id", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("update_seen").select("last_seen_id").eq("user_id", userId).maybeSingle(),
  ]);
  const sb = (support.data ?? {}) as { mine_unread?: number; admin_waiting?: number };
  const latestId = latest.data?.id ?? 0;
  const seenId = seen.data?.last_seen_id ?? 0;
  return {
    notifications: unread.count ?? 0,
    tasks: pending.data?.length ?? 0,
    support: (sb.mine_unread ?? 0) + (sb.admin_waiting ?? 0),
    updates: latestId > seenId ? 1 : 0,
  };
}
