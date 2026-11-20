// [starter-standar] direkonstruksi; selaraskan dengan lourdes-db/templates/next-app
// Env publik dibaca eksplisit (Next hanya meng-inline akses literal process.env.NEXT_PUBLIC_*).
export { APP_ID, APP_HOST, APP_NAME } from "@/lib/app-config";

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Env ${name} belum diisi. Lihat .env.example.`);
  return value;
}

export const SUPABASE_URL = required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
export const SUPABASE_PUBLISHABLE_KEY = required(
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);
/** Kosong = Web Push tidak aktif (kartu "Notifikasi HP" menampilkan alasannya). */
export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
