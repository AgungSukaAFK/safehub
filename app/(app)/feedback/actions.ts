"use server";

// Feedback: kirim lewat RPC feedback_submit (notify admin), ubah status lewat feedback_set_status
// (notify pelapor). Isi rich text disanitasi di server sebelum disimpan.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbError, fail, invalid, NOT_ALLOWED, ok, type FormState } from "@/lib/action-state";
import { actionAccess } from "@/lib/auth";
import { getFeedbackDetail, type FeedbackDetail } from "@/lib/feedback";
import { FEEDBACK_CATEGORY_VALUES, FEEDBACK_STATUSES, MAX_FEEDBACK_FILES } from "@/lib/feedback-rules";
import { notificationIds, sendPushForNotifications } from "@/lib/push";
import { docToText, sanitizeDoc } from "@/lib/rich-text";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";
import type { Json } from "@/types/database";

const submitSchema = z.object({
  category: z.enum(FEEDBACK_CATEGORY_VALUES as unknown as [string, ...string[]], { errorMap: () => ({ message: "Pilih kategori" }) }),
  categoryOther: z.string().trim().max(100, "Maksimal 100 karakter").optional().default(""),
  content: z.unknown(),
  attachments: z.array(z.string().max(300)).max(MAX_FEEDBACK_FILES, `Maksimal ${MAX_FEEDBACK_FILES} lampiran`).default([]),
  context: z.record(z.string().max(300).nullable()).nullable().default(null),
});

export async function submitFeedbackAction(input: z.input<typeof submitSchema>): Promise<FormState> {
  const me = await actionAccess("viewer");
  if (!me) return NOT_ALLOWED;
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  if (d.category === "lainnya" && !d.categoryOther) return fail("Tulis jenis feedback-nya.", { categoryOther: ["Wajib diisi untuk kategori Lainnya"] });
  const doc = sanitizeDoc(d.content);
  const text = docToText(doc);
  if (!doc || !text) return fail("Isi feedback wajib diisi.", { content: ["Tulis isi feedback"] });
  if (text.length > 10000) return fail("Isi feedback maksimal 10.000 karakter.", { content: ["Terlalu panjang"] });
  if (d.attachments.some((p) => !p.startsWith(`feedback/${me.userId}/`) || p.includes(".."))) return fail("Lampiran tidak valid.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("feedback_submit", {
    p_category: d.category,
    p_category_other: d.category === "lainnya" ? d.categoryOther : "",
    p_content: doc as unknown as Json,
    p_content_text: text,
    p_attachments: d.attachments,
    p_context: (d.context ?? undefined) as Json | undefined,
  });
  if (error) return dbError(error);
  await sendPushForNotifications(notificationIds(data));
  revalidatePath("/feedback");
  revalidatePath("/feedback/kelola");
  return ok("Terima kasih! Feedback Anda sudah kami terima.");
}

export async function getFeedbackDetailAction(id: string): Promise<FeedbackDetail | null> {
  if (!isUuid(id) || !(await actionAccess("admin"))) return null;
  return getFeedbackDetail(await createClient(), id);
}

export async function setFeedbackStatusAction(id: string, status: string, adminNote: string): Promise<FormState> {
  if (!isUuid(id) || !(FEEDBACK_STATUSES as readonly string[]).includes(status) || !(await actionAccess("admin"))) return NOT_ALLOWED;
  if (adminNote.length > 2000) return fail("Catatan maksimal 2000 karakter.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("feedback_set_status", { p_id: id, p_status: status, p_admin_note: adminNote });
  if (error) return dbError(error);
  const ids = notificationIds(data);
  await sendPushForNotifications(ids);
  revalidatePath("/feedback/kelola");
  return ok(ids.length ? "Status disimpan. Pelapor sudah diberi tahu." : "Disimpan.");
}

export async function deleteFeedbackAction(id: string): Promise<FormState> {
  if (!isUuid(id) || !(await actionAccess("admin"))) return NOT_ALLOWED;
  const supabase = await createClient();
  const { data, error } = await supabase.from("feedback").delete().eq("id", id).select("id");
  if (error) return dbError(error);
  if (!data?.length) return fail("Feedback tidak ditemukan.");
  revalidatePath("/feedback/kelola");
  return ok("Feedback dihapus.");
}
