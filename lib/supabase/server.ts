// [starter-standar] direkonstruksi; selaraskan dengan lourdes-db/templates/next-app
import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { APP_ID } from "@/lib/app-config";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Client Supabase server dengan SESI USER (RLS berlaku). Schema default = schema app, jadi
 * `.from("pengajuan")` / `.rpc("approval_decide")` langsung ke schema app. Untuk platform pakai
 * `.schema("public")`. Tidak ada secret key di app (standar).
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database, typeof APP_ID>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    db: { schema: APP_ID },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Dipanggil dari Server Component: cookie tidak bisa ditulis di sini; proxy.ts yang
          // memperbarui sesi.
        }
      },
    },
  });
}

export type ServerClient = Awaited<ReturnType<typeof createClient>>;
