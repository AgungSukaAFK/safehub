import "server-only";
import { after } from "next/server";
import { headers } from "next/headers";
import { APP_ID, APP_URL } from "@/lib/app-config";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

// CCTV dari server app (backend-guide §9.2). Best-effort setelah respons (after()); kegagalan hanya
// dicatat di log server, tidak pernah menggagalkan aksi. Event dari DB (approval, data) ditulis
// otomatis oleh trigger/engine, jangan diulang di sini.

export type CctvEvent = {
  category: "auth" | "access" | "export" | "security" | "config";
  /** pola ^[a-z][a-z0-9_.]{1,80}$, mis. "export.excel" */
  action: string;
  /** satu kalimat Indonesia, tanpa data sensitif (password, token, NRP, No HP) */
  summary: string;
  severity?: "info" | "notice" | "warning" | "critical";
  entity?: string;
  recordId?: string;
  recordLabel?: string;
  companyCode?: string;
  /** path app ("/pengguna/…") atau URL https penuh */
  url?: string;
  metadata?: Record<string, unknown>;
};

/**
 * `immediate: true` = kirim sekarang (ditunggu), bukan di after(). Wajib saat sesi akan hilang di
 * request yang sama (mis. logout: after() berjalan setelah signOut menghapus cookie).
 */
export async function cctv(e: CctvEvent, opts: { immediate?: boolean } = {}) {
  try {
    const h = await headers();
    const supabase = await createClient(); // dibuat sebelum after(): masih membawa sesi user
    let path: string | null = null;
    try {
      const ref = h.get("referer");
      path = ref ? new URL(ref).pathname : null;
    } catch {
      path = null;
    }
    const client = {
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip"),
      user_agent: h.get("user-agent"),
      path,
    };
    const send = async () => {
      const { error } = await supabase.schema("public").rpc("cctv_log", {
        p_app: APP_ID,
        p_category: e.category,
        p_action: e.action,
        p_summary: e.summary,
        p_severity: e.severity ?? "info",
        p_entity: e.entity,
        p_record_id: e.recordId,
        p_record_label: e.recordLabel,
        p_company_code: e.companyCode,
        // konsol monitoring butuh link absolut (constraint url ~ '^https://'); path app → APP_URL + path
        p_url: e.url?.startsWith("/") ? `${APP_URL}${e.url}` : e.url,
        p_metadata: e.metadata as Json | undefined,
        p_client: client as Json,
      });
      if (error) console.error("[cctv]", error.code, error.message);
    };
    if (opts.immediate) await send();
    else after(send);
  } catch (err) {
    console.error("[cctv]", err);
  }
}
