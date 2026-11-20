"use server";

// Profil sendiri (frontend-guide §15.3–15.4). Sesuai profiles_guard platform, user hanya boleh
// mengubah No HP dan foto miliknya. File foto diunggah browser langsung ke bucket `avatars`
// (`<uid>/avatar-<ts>.webp`); action ini hanya memasang URL-nya lalu menghapus file lama.
import { revalidatePath } from "next/cache";
import { dbError, fail, NOT_ALLOWED, ok, type FormState } from "@/lib/action-state";
import { BUCKET_AVATARS } from "@/lib/app-config";
import { actionAccess } from "@/lib/auth";
import { phoneSchema } from "@/lib/pengguna-rules";
import { createClient, type ServerClient } from "@/lib/supabase/server";

export async function updatePhoneAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await actionAccess("viewer");
  if (!me) return NOT_ALLOWED;
  const parsed = phoneSchema.safeParse(String(fd.get("phone") ?? ""));
  if (!parsed.success) return fail(parsed.error.issues[0].message, { phone: [parsed.error.issues[0].message] });
  const supabase = await createClient();
  const { data, error } = await supabase.schema("public").from("profiles").update({ phone: parsed.data }).eq("id", me.userId).select("id");
  if (error) return dbError(error);
  if (!data?.length) return fail("No HP tidak tersimpan. Muat ulang halaman lalu coba lagi.");
  revalidatePath("/", "layout");
  return ok(parsed.data ? "No HP disimpan." : "No HP dihapus.", { phone: parsed.data });
}

/** Path file di bucket avatars dari URL publik, hanya kalau milik `uid`. */
function ownAvatarPath(url: string | null, uid: string): string | null {
  if (!url) return null;
  const marker = `/object/public/${BUCKET_AVATARS}/`;
  const i = url.indexOf(marker);
  if (i < 0) return null;
  const path = decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
  return path.startsWith(`${uid}/`) ? path : null;
}

async function removeOwnFile(supabase: ServerClient, path: string | null) {
  if (!path) return;
  const { error } = await supabase.storage.from(BUCKET_AVATARS).remove([path]);
  if (error) console.error("[avatar] hapus file lama", error.message);
}

/**
 * Pasang foto profil baru (`path` = file yang baru diunggah) atau hapus foto (`null`).
 * Hasil `data.url` dipakai client untuk event avatar-updated.
 */
export async function setAvatarAction(path: string | null): Promise<FormState> {
  const me = await actionAccess("viewer");
  if (!me) return NOT_ALLOWED;
  const pattern = new RegExp(`^${me.userId}/avatar-\d{10,16}\.(webp|jpg)$`);
  if (path !== null && !pattern.test(path)) return fail("File foto tidak valid.");

  const supabase = await createClient();
  const pub = supabase.schema("public");
  const { data: before } = await pub.from("profiles").select("avatar_url").eq("id", me.userId).maybeSingle();
  const url = path ? supabase.storage.from(BUCKET_AVATARS).getPublicUrl(path).data.publicUrl : null;

  const { data, error } = await pub.from("profiles").update({ avatar_url: url }).eq("id", me.userId).select("id");
  if (error || !data?.length) {
    await removeOwnFile(supabase, path); // jangan tinggalkan file yatim
    return error ? dbError(error) : fail("Foto tidak tersimpan. Muat ulang halaman lalu coba lagi.");
  }
  // file lama dihapus best-effort; gagal tidak membatalkan perubahan
  const oldPath = ownAvatarPath(before?.avatar_url ?? null, me.userId);
  if (oldPath && oldPath !== path) await removeOwnFile(supabase, oldPath);

  revalidatePath("/", "layout");
  return ok(url ? "Foto profil diperbarui." : "Foto profil dihapus.", { url });
}

/** Buang file yang sudah terunggah tapi gagal dipasang (dipanggil client saat setAvatarAction gagal di jaringan). */
export async function discardAvatarUploadAction(path: string): Promise<void> {
  const me = await actionAccess("viewer");
  if (!me || !path.startsWith(`${me.userId}/avatar-`)) return;
  await removeOwnFile(await createClient(), path);
}
