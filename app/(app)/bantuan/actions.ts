"use server";

// Bantuan Admin: semua tulis lewat RPC support_* (DB yang menjaga peserta & status), lalu Web Push
// best-effort untuk notifikasi yang dibuat RPC.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbError, fail, invalid, NOT_ALLOWED, ok, type FormState } from "@/lib/action-state";
import { actionAccess } from "@/lib/auth";
import { notificationIds, sendPushForNotifications } from "@/lib/push";
import { SUPPORT_CATEGORY_VALUES } from "@/lib/support-types";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import { isUuid } from "@/lib/utils";

const pathOk = (p: string | null | undefined, uid: string, threadId?: string) =>
  !p || (p.length <= 300 && !p.includes("..") && (p.startsWith(`support/new-${uid}/`) || (!!threadId && p.startsWith(`support/${threadId}/`))));

const openSchema = z.object({
  category: z.enum(SUPPORT_CATEGORY_VALUES as unknown as [string, ...string[]], { errorMap: () => ({ message: "Pilih kategori" }) }),
  subject: z.string().trim().min(3, "Subjek minimal 3 karakter").max(200, "Maksimal 200 karakter"),
  body: z.string().trim().max(4000, "Maksimal 4000 karakter"),
  attachmentPath: z.string().nullable(),
  context: z.record(z.unknown()).nullable(),
});

function revalidate() {
  revalidatePath("/bantuan");
  revalidatePath("/bantuan/kelola");
}

export async function openThreadAction(input: z.input<typeof openSchema>): Promise<FormState> {
  const me = await actionAccess("viewer");
  if (!me) return NOT_ALLOWED;
  const parsed = openSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  if (!d.body && !d.attachmentPath) return fail("Tulis pesan atau lampirkan file.", { body: ["Tulis pesan"] });
  if (!pathOk(d.attachmentPath, me.userId)) return fail("Lampiran tidak valid.");
  const context = d.context && JSON.stringify(d.context).length < 3000 ? (d.context as Json) : undefined;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("support_open", {
    p_category: d.category,
    p_subject: d.subject,
    p_body: d.body,
    p_context: context,
    p_attachment_path: d.attachmentPath ?? undefined,
  });
  if (error) return dbError(error);
  await sendPushForNotifications(notificationIds(data));
  revalidate();
  return ok("Pesan terkirim ke admin app. Balasan akan muncul di sini dan di notifikasi.", { id: (data as { thread_id: string }).thread_id });
}

export async function sendMessageAction(threadId: string, body: string, attachmentPath: string | null): Promise<FormState> {
  const me = await actionAccess("viewer");
  if (!me || !isUuid(threadId)) return NOT_ALLOWED;
  const text = body.trim();
  if (text.length > 4000) return fail("Pesan maksimal 4000 karakter.");
  if (!text && !attachmentPath) return fail("Tulis pesan atau lampirkan file.");
  if (!pathOk(attachmentPath, me.userId, threadId)) return fail("Lampiran tidak valid.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("support_send", { p_thread_id: threadId, p_body: text, p_attachment_path: attachmentPath ?? undefined });
  if (error) return dbError(error);
  await sendPushForNotifications(notificationIds(data));
  revalidate();
  return ok("Terkirim.", { id: (data as { message_id: string }).message_id });
}

export async function setThreadStatusAction(threadId: string, status: "menunggu" | "dibalas" | "selesai"): Promise<FormState> {
  if (!isUuid(threadId) || !["menunggu", "dibalas", "selesai"].includes(status) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("support_set_status", { p_thread_id: threadId, p_status: status });
  if (error) return dbError(error);
  await sendPushForNotifications(notificationIds(data));
  revalidate();
  return ok(status === "selesai" ? "Percakapan ditandai selesai." : "Percakapan dibuka kembali.");
}

/** Ambil (adminId = diri sendiri), alihkan ke admin lain, atau lepas (null). */
export async function assignThreadAction(threadId: string, adminId: string | null): Promise<FormState> {
  const me = await actionAccess("admin");
  if (!me || !isUuid(threadId) || (adminId !== null && !isUuid(adminId))) return NOT_ALLOWED;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("support_assign", { p_thread_id: threadId, p_admin_id: adminId as string });
  if (error) return dbError(error);
  if (adminId !== me.userId) await sendPushForNotifications(notificationIds(data));
  revalidate();
  return ok(adminId === null ? "Percakapan dilepas." : adminId === me.userId ? "Percakapan Anda ambil." : "Percakapan dialihkan.");
}

export async function deleteThreadAction(threadId: string): Promise<FormState> {
  if (!isUuid(threadId) || !(await actionAccess("admin"))) return NOT_ALLOWED;
  const supabase = await createClient();
  const { data, error } = await supabase.from("support_threads").delete().eq("id", threadId).select("id");
  if (error) return dbError(error);
  if (!data?.length) return fail("Percakapan tidak ditemukan.");
  revalidate();
  return ok("Percakapan dihapus.");
}

/** Tandai pesan lawan bicara sudah dibaca. Mengembalikan jumlah yang berubah. */
export async function markThreadReadAction(threadId: string): Promise<number> {
  if (!isUuid(threadId) || !(await actionAccess("viewer"))) return 0;
  const supabase = await createClient();
  const { data } = await supabase.rpc("support_mark_read", { p_thread_id: threadId });
  return data ?? 0;
}

/** Rincian badge untuk dropdown Bantuan di top bar (dimuat saat dibuka). */
export async function supportBadgeAction(): Promise<{ mineUnread: number; adminWaiting: number; adminMine: number }> {
  const empty = { mineUnread: 0, adminWaiting: 0, adminMine: 0 };
  if (!(await actionAccess("viewer"))) return empty;
  const { data } = await (await createClient()).rpc("support_badge");
  const b = (data ?? {}) as { mine_unread?: number; admin_waiting?: number; admin_mine?: number };
  return { mineUnread: b.mine_unread ?? 0, adminWaiting: b.admin_waiting ?? 0, adminMine: b.admin_mine ?? 0 };
}
