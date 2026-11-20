// Loader Bantuan Admin (frontend-guide §14, backend-guide §11.1). Dipakai /bantuan (user) dan
// /bantuan/kelola (admin, `asAdmin`). RLS: pemilik atau admin app. Tulis selalu lewat RPC support_*.
import "server-only";
import { APP_ID, BUCKET_LAMPIRAN } from "@/lib/app-config";
import { getPeople } from "@/lib/people";
import type { ServerClient } from "@/lib/supabase/server";
import type { SupportMessage, SupportThread, SupportThreadDetail } from "@/lib/support-types";

export type { SupportMessage, SupportThread, SupportThreadDetail } from "@/lib/support-types";

export type ThreadFilter = "semua" | "menunggu" | "dibalas" | "selesai" | "saya";

const THREAD_COLS = "id, user_id, category, subject, status, assigned_to, context, last_message_at, created_at";

type RawThread = {
  id: string;
  user_id: string;
  category: string;
  subject: string;
  status: string;
  assigned_to: string | null;
  context: Record<string, unknown> | null;
  last_message_at: string;
  created_at: string;
};

async function hydrate(supabase: ServerClient, rows: RawThread[], me: string): Promise<SupportThread[]> {
  if (!rows.length) return [];
  const [people, unread] = await Promise.all([
    getPeople(supabase, rows.flatMap((r) => [r.user_id, r.assigned_to])),
    supabase
      .from("support_messages")
      .select("thread_id")
      .in("thread_id", rows.map((r) => r.id))
      .is("read_at", null)
      .neq("sender_id", me),
  ]);
  const unreadSet = new Set((unread.data ?? []).map((u) => u.thread_id));
  const brief = (id: string | null) => {
    const p = id ? people.get(id) : null;
    return p ? { id: p.id, name: p.name, avatarUrl: p.avatarUrl } : null;
  };
  return rows.map((r) => ({
    id: r.id,
    category: r.category,
    subject: r.subject,
    status: r.status,
    context: r.context,
    lastMessageAt: r.last_message_at,
    createdAt: r.created_at,
    user: brief(r.user_id),
    assignedTo: brief(r.assigned_to),
    unread: unreadSet.has(r.id),
  }));
}

/** Daftar percakapan. User: miliknya sendiri. Admin (`asAdmin`): semua, dengan filter status / "saya". */
export async function listThreads(supabase: ServerClient, opts: { me: string; asAdmin: boolean; filter?: ThreadFilter; q?: string }) {
  let q = supabase.from("support_threads").select(THREAD_COLS).order("last_message_at", { ascending: false }).limit(100);
  if (!opts.asAdmin) q = q.eq("user_id", opts.me);
  else if (opts.filter === "saya") q = q.eq("assigned_to", opts.me).neq("status", "selesai");
  else if (opts.filter && opts.filter !== "semua") q = q.eq("status", opts.filter);
  if (opts.q) q = q.ilike("subject", `%${opts.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`);
  const { data, error } = await q;
  if (error) throw error;
  return hydrate(supabase, (data ?? []) as RawThread[], opts.me);
}

/** Hitungan per status untuk tab admin. */
export async function countThreads(supabase: ServerClient, me: string) {
  const head = { count: "exact" as const, head: true };
  const [menunggu, dibalas, saya] = await Promise.all([
    supabase.from("support_threads").select("id", head).eq("status", "menunggu"),
    supabase.from("support_threads").select("id", head).eq("status", "dibalas"),
    supabase.from("support_threads").select("id", head).eq("assigned_to", me).neq("status", "selesai"),
  ]);
  return { menunggu: menunggu.count ?? 0, dibalas: dibalas.count ?? 0, saya: saya.count ?? 0 };
}

/** Satu percakapan + semua pesannya (lampiran → signed URL 1 jam). null = tidak ada / bukan haknya. */
export async function getThread(supabase: ServerClient, id: string, me: string): Promise<SupportThreadDetail | null> {
  const { data } = await supabase.from("support_threads").select(THREAD_COLS).eq("id", id).maybeSingle();
  if (!data) return null;
  const [thread] = await hydrate(supabase, [data as RawThread], me);
  const { data: msgs } = await supabase
    .from("support_messages")
    .select("id, sender_id, body, attachment_path, read_at, created_at")
    .eq("thread_id", id)
    .order("created_at")
    .limit(500);
  const rows = msgs ?? [];
  const people = await getPeople(supabase, rows.map((m) => m.sender_id));
  const paths = rows.map((m) => m.attachment_path).filter((p): p is string => !!p);
  const signed = paths.length ? ((await supabase.storage.from(BUCKET_LAMPIRAN).createSignedUrls(paths, 3600)).data ?? []) : [];
  const urlOf = new Map(signed.map((s) => [s.path, s.signedUrl]));
  const messages: SupportMessage[] = rows.map((m) => {
    const p = m.sender_id ? people.get(m.sender_id) : null;
    return {
      id: m.id,
      body: m.body,
      createdAt: m.created_at,
      readAt: m.read_at,
      mine: m.sender_id === me,
      sender: p ? { id: p.id, name: p.name, avatarUrl: p.avatarUrl } : null,
      attachment: m.attachment_path ? { path: m.attachment_path, name: m.attachment_path.split("/").pop()!.replace(/^\d+-/, ""), url: urlOf.get(m.attachment_path) ?? null } : null,
    };
  });
  return { ...thread, messages };
}

/** Admin app aktif (pilihan "Alihkan ke"). Hanya terbaca admin (RLS app_access). */
export async function listAppAdmins(supabase: ServerClient) {
  const { data } = await supabase
    .schema("public")
    .from("app_access")
    .select("user_id, profile:profiles!app_access_user_id_fkey!inner(full_name, is_active)")
    .eq("app_id", APP_ID)
    .eq("role", "admin")
    .eq("profile.is_active", true);
  return ((data ?? []) as unknown as { user_id: string; profile: { full_name: string } }[])
    .map((a) => ({ id: a.user_id, name: a.profile.full_name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
