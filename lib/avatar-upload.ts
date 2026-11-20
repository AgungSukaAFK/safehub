"use client";

// Unggah foto profil langsung dari browser ke bucket `avatars` (frontend-guide §15.4):
// `<uid>/avatar-<timestamp>.webp`. Policy storage hanya mengizinkan folder milik sendiri.
import { BUCKET_AVATARS } from "@/lib/app-config";
import { createClient } from "@/lib/supabase/client";

export async function uploadAvatarFile(userId: string, blob: Blob): Promise<string> {
  const ext = blob.type === "image/webp" ? "webp" : "jpg";
  const path = `${userId}/avatar-${Date.now()}.${ext}`;
  const { error } = await createClient()
    .storage.from(BUCKET_AVATARS)
    .upload(path, blob, { contentType: blob.type, cacheControl: "31536000", upsert: false });
  if (error) throw new Error(error.message.includes("exceeded") ? "Ukuran foto melebihi batas 2 MB." : "Unggah foto gagal. Periksa koneksi lalu coba lagi.");
  return path;
}
