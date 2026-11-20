// [starter-standar] direkonstruksi; selaraskan dengan lourdes-db/templates/next-app
import { createBrowserClient } from "@supabase/ssr";
import { APP_ID } from "@/lib/app-config";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";
import type { Database } from "@/types/database";

let client: ReturnType<typeof make> | undefined;

function make() {
  return createBrowserClient<Database, typeof APP_ID>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    db: { schema: APP_ID },
  });
}

/**
 * Client browser. HANYA untuk: auth, realtime, upload langsung ke Storage, dan pencarian
 * interaktif yang dipicu ketikan (frontend-guide §7.3). Jangan fetch data awal halaman.
 */
export function createClient() {
  client ??= make();
  return client;
}
