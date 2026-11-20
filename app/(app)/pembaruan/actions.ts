"use server";

// Pembaruan / Update Web (frontend-guide §20.1). Tulis langsung ke tabel dengan sesi user (RLS: post
// hanya admin; reaction/komentar/seen milik sendiri). Versi naik dijaga trigger updates_version_guard.
import { revalidatePath } from "next/cache";
import { dbError, fail, invalid, NOT_ALLOWED, ok, type FormState } from "@/lib/action-state";
import { BUCKET_MEDIA } from "@/lib/app-config";
import { actionAccess } from "@/lib/auth";
import { cctv } from "@/lib/cctv";
import { docImagePaths, docToText, sanitizeDoc, type RichNode } from "@/lib/rich-text";
import { REACTION_EMOJIS, updateSchema, type UpdateComment } from "@/lib/update-types";
import { getUpdateContent, listComments } from "@/lib/updates";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import { isUuid } from "@/lib/utils";

const MEDIA_PREFIX = "updates/";
const okPath = (p: string | null) => !p || (p.startsWith(MEDIA_PREFIX) && !p.includes("..") && p.length <= 300);

function revalidate() {
  revalidatePath("/pembaruan");
  revalidatePath("/", "layout"); // badge sidebar & banner beranda
}

export async function saveUpdateAction(input: unknown): Promise<FormState> {
  const me = await actionAccess("admin");
  if (!me) return NOT_ALLOWED;
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  if (!okPath(d.thumbnailPath)) return fail("Thumbnail tidak valid.");
  const doc = sanitizeDoc(d.content, { imagePrefix: MEDIA_PREFIX });
  if (!doc) return fail("Isi tidak terbaca. Muat ulang halaman.");
  if (!docToText(doc) && !docImagePaths(doc).length && !d.highlights.length)
    return fail("Isi atau poin penting wajib diisi.", { content: ["Tulis isi pembaruan atau minimal satu poin penting"] });

  const row = {
    version_major: d.major,
    version_minor: d.minor,
    version_patch: d.patch,
    title: d.title,
    highlights: d.highlights,
    thumbnail_path: d.thumbnailPath,
    content: doc as unknown as NonNullable<Json>,
  };
  const supabase = await createClient();
  const version = `${d.major}.${d.minor}.${d.patch}`;
  let id = d.id;
  if (id) {
    const { data, error } = await supabase.from("updates").update(row).eq("id", id).select("id");
    if (error) return error.code === "23505" ? fail(`Versi ${version} sudah dipakai.`, { major: ["Versi sudah ada"] }) : dbError(error);
    if (!data?.length) return fail("Post tidak ditemukan.");
  } else {
    const { data, error } = await supabase.from("updates").insert(row).select("id").single();
    if (error) return error.code === "23505" ? fail(`Versi ${version} sudah dipakai.`, { major: ["Versi sudah ada"] }) : dbError(error);
    id = data.id;
    await cctv({ category: "config", action: "update.publish", severity: "notice", summary: `Menerbitkan Pembaruan versi ${version}: ${d.title}`, entity: "updates", recordId: String(id), recordLabel: version, url: "/pembaruan" });
  }
  revalidate();
  return ok(d.id ? "Pembaruan disimpan." : `Versi ${version} diterbitkan.`, { id });
}

export async function deleteUpdateAction(id: number): Promise<FormState> {
  if (!Number.isInteger(id) || !(await actionAccess("admin"))) return NOT_ALLOWED;
  const supabase = await createClient();
  const { data, error } = await supabase.from("updates").delete().eq("id", id).select("version, thumbnail_path, content");
  if (error) return dbError(error);
  if (!data?.length) return fail("Post tidak ditemukan.");
  const files = [data[0].thumbnail_path, ...docImagePaths(data[0].content as RichNode)].filter((p): p is string => !!p);
  if (files.length) await supabase.storage.from(BUCKET_MEDIA).remove(files);
  revalidate();
  return ok(`Pembaruan ${data[0].version} dihapus.`);
}

/** Klik emoji: sama dengan yang aktif = hapus, lain = ganti (satu emoji per user per post). */
export async function reactAction(updateId: number, emoji: string): Promise<FormState> {
  const me = await actionAccess("viewer");
  if (!me || !Number.isInteger(updateId) || !(REACTION_EMOJIS as readonly string[]).includes(emoji)) return NOT_ALLOWED;
  const supabase = await createClient();
  const { data: cur } = await supabase.from("update_reactions").select("emoji").eq("update_id", updateId).eq("user_id", me.userId).maybeSingle();
  const { error } =
    cur?.emoji === emoji
      ? await supabase.from("update_reactions").delete().eq("update_id", updateId).eq("user_id", me.userId)
      : await supabase.from("update_reactions").upsert({ update_id: updateId, user_id: me.userId, emoji }, { onConflict: "update_id,user_id" });
  if (error) return dbError(error);
  revalidatePath("/pembaruan");
  return ok(cur?.emoji === emoji ? "Reaction dihapus." : "Reaction disimpan.", { active: cur?.emoji !== emoji });
}

/** Tandai post sampai `id` sudah dilihat (per akun, tidak pernah mundur). */
export async function markUpdatesSeenAction(id: number): Promise<void> {
  const me = await actionAccess("viewer");
  if (!me || !Number.isInteger(id) || id <= 0) return;
  const supabase = await createClient();
  const { data } = await supabase.from("update_seen").select("last_seen_id").eq("user_id", me.userId).maybeSingle();
  if ((data?.last_seen_id ?? 0) >= id) return;
  await supabase.from("update_seen").upsert({ user_id: me.userId, last_seen_id: id, seen_at: new Date().toISOString() }, { onConflict: "user_id" });
  revalidatePath("/", "layout");
}

export async function loadUpdateDetailAction(id: number): Promise<{ content: RichNode | null; comments: UpdateComment[] } | null> {
  const me = await actionAccess("viewer");
  if (!me || !Number.isInteger(id)) return null;
  const supabase = await createClient();
  const [content, comments] = await Promise.all([getUpdateContent(supabase, id), listComments(supabase, id, me.userId)]);
  return { content, comments };
}

export async function addCommentAction(updateId: number, body: string): Promise<FormState> {
  const me = await actionAccess("viewer");
  if (!me || !Number.isInteger(updateId)) return NOT_ALLOWED;
  const text = body.trim();
  if (!text) return fail("Tulis komentar dulu.");
  if (text.length > 2000) return fail("Komentar maksimal 2000 karakter.");
  const supabase = await createClient();
  const { error } = await supabase.from("update_comments").insert({ update_id: updateId, user_id: me.userId, body: text });
  if (error) return dbError(error);
  revalidatePath("/pembaruan");
  return ok("Komentar terkirim.");
}

export async function deleteCommentAction(id: string): Promise<FormState> {
  if (!isUuid(id) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const supabase = await createClient();
  const { data, error } = await supabase.from("update_comments").delete().eq("id", id).select("id");
  if (error) return dbError(error);
  if (!data?.length) return fail("Komentar tidak ditemukan atau bukan milik Anda.");
  revalidatePath("/pembaruan");
  return ok("Komentar dihapus.");
}

/** Signed URL untuk gambar yang baru diunggah di editor (admin). */
export async function signMediaAction(path: string): Promise<string | null> {
  if (!okPath(path) || !(await actionAccess("admin"))) return null;
  const { data } = await (await createClient()).storage.from(BUCKET_MEDIA).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
