// Loader Pembaruan / Update Web (frontend-guide §20.1, backend-guide §11.3). Media (thumbnail &
// gambar isi) di bucket private <host>-media → signed URL 1 jam saat render.
import "server-only";
import { BUCKET_MEDIA } from "@/lib/app-config";
import { getPeople } from "@/lib/people";
import { docImagePaths, withImageUrls, type RichNode } from "@/lib/rich-text";
import type { ServerClient } from "@/lib/supabase/server";
import type { ReactionGroup, UpdateComment, UpdatePost } from "@/lib/update-types";
import { REACTION_EMOJIS } from "@/lib/update-types";

export type { UpdatePost, UpdateComment } from "@/lib/update-types";

const NEW_DAYS = 7;

export async function signMedia(supabase: ServerClient, paths: (string | null | undefined)[]) {
  const list = [...new Set(paths.filter((p): p is string => !!p))];
  if (!list.length) return {} as Record<string, string>;
  const { data } = await supabase.storage.from(BUCKET_MEDIA).createSignedUrls(list, 3600);
  return Object.fromEntries((data ?? []).flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl]] : []))) as Record<string, string>;
}

export async function lastSeenId(supabase: ServerClient, userId: string) {
  const { data } = await supabase.from("update_seen").select("last_seen_id").eq("user_id", userId).maybeSingle();
  return data?.last_seen_id ?? 0;
}

export async function listUpdates(supabase: ServerClient, me: string, limit = 30): Promise<{ posts: UpdatePost[]; seenId: number }> {
  const [{ data, error }, seenId] = await Promise.all([
    supabase.from("updates").select("id, version, title, highlights, thumbnail_path, created_by, created_at, updated_at").order("id", { ascending: false }).limit(limit),
    lastSeenId(supabase, me),
  ]);
  if (error) throw error;
  const rows = data ?? [];
  const ids = rows.map((r) => r.id);
  const [reactions, comments, urls] = await Promise.all([
    ids.length ? supabase.from("update_reactions").select("update_id, user_id, emoji").in("update_id", ids) : Promise.resolve({ data: [] as { update_id: number; user_id: string; emoji: string }[] }),
    ids.length ? supabase.from("update_comments").select("update_id").in("update_id", ids) : Promise.resolve({ data: [] as { update_id: number }[] }),
    signMedia(supabase, rows.map((r) => r.thumbnail_path)),
  ]);
  const people = await getPeople(supabase, [...rows.map((r) => r.created_by), ...(reactions.data ?? []).map((r) => r.user_id)]);
  const cutoff = Date.now() - NEW_DAYS * 86_400_000;

  const posts = rows.map((r): UpdatePost => {
    const mine = (reactions.data ?? []).filter((x) => x.update_id === r.id);
    const groups: ReactionGroup[] = REACTION_EMOJIS.map((emoji) => {
      const who = mine.filter((x) => x.emoji === emoji);
      return { emoji, count: who.length, names: who.map((w) => people.get(w.user_id)?.name ?? "Pengguna"), mine: who.some((w) => w.user_id === me) };
    }).filter((g) => g.count > 0);
    const author = r.created_by ? people.get(r.created_by) : null;
    return {
      id: r.id,
      version: r.version ?? "",
      title: r.title,
      highlights: r.highlights,
      thumbnailUrl: r.thumbnail_path ? (urls[r.thumbnail_path] ?? null) : null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      author: author ? { id: author.id, name: author.name, avatarUrl: author.avatarUrl } : null,
      reactions: groups,
      myReaction: mine.find((x) => x.user_id === me)?.emoji ?? null,
      comments: (comments.data ?? []).filter((c) => c.update_id === r.id).length,
      isNew: r.id > seenId && Date.parse(r.created_at) >= cutoff,
    };
  });
  return { posts, seenId };
}

/** Isi lengkap satu post (gambar di isi → signed URL). */
export async function getUpdateContent(supabase: ServerClient, id: number): Promise<RichNode | null> {
  const { data } = await supabase.from("updates").select("content").eq("id", id).maybeSingle();
  if (!data) return null;
  const doc = data.content as RichNode;
  return withImageUrls(doc, await signMedia(supabase, docImagePaths(doc)));
}

/** Data form ubah. */
export async function getUpdateForEdit(supabase: ServerClient, id: number) {
  const { data } = await supabase.from("updates").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  const doc = data.content as RichNode;
  const urls = await signMedia(supabase, [...docImagePaths(doc), data.thumbnail_path]);
  return {
    id: data.id,
    major: data.version_major,
    minor: data.version_minor,
    patch: data.version_patch,
    title: data.title,
    highlights: data.highlights,
    thumbnailPath: data.thumbnail_path,
    thumbnailUrl: data.thumbnail_path ? (urls[data.thumbnail_path] ?? null) : null,
    content: withImageUrls(doc, urls),
    updatedAt: data.updated_at,
  };
}

/** Versi terbesar yang sudah ada (selain `exceptId`), untuk petunjuk & validasi form. */
export async function latestVersion(supabase: ServerClient, exceptId?: number) {
  let q = supabase.from("updates").select("version_major, version_minor, version_patch").order("version_major", { ascending: false }).order("version_minor", { ascending: false }).order("version_patch", { ascending: false }).limit(1);
  if (exceptId) q = q.neq("id", exceptId);
  const { data } = await q.maybeSingle();
  return data ? ([data.version_major, data.version_minor, data.version_patch] as [number, number, number]) : null;
}

export async function listComments(supabase: ServerClient, updateId: number, me: string): Promise<UpdateComment[]> {
  const { data } = await supabase.from("update_comments").select("id, user_id, body, created_at").eq("update_id", updateId).order("created_at").limit(200);
  const people = await getPeople(supabase, (data ?? []).map((c) => c.user_id));
  return (data ?? []).map((c) => {
    const p = people.get(c.user_id);
    return { id: c.id, body: c.body, createdAt: c.created_at, mine: c.user_id === me, user: p ? { id: p.id, name: p.name, avatarUrl: p.avatarUrl } : null };
  });
}

export type Release = { id: number; version: string; title: string; highlights: string[]; createdAt: string };

/** Riwayat rilis ringkas (Tentang App). Versi app = post terbaru, tidak pernah di-hardcode. */
export async function listReleases(supabase: ServerClient, limit = 5): Promise<Release[]> {
  const { data } = await supabase.from("updates").select("id, version, title, highlights, created_at").order("id", { ascending: false }).limit(limit);
  return (data ?? []).map((r) => ({ id: r.id, version: r.version ?? "", title: r.title, highlights: r.highlights, createdAt: r.created_at }));
}
