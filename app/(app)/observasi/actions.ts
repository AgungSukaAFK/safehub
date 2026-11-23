"use server";

// Server Action Observasi KTA/TTA: lapor cepat (HP). Tindak lanjut = temuan yang dibuat RPC (bukan hak
// fungsi pelapor: Karyawan pun boleh meminta tindak lanjut). Foto diunggah browser setelah tersimpan.
import { revalidatePath } from "next/cache";
import { fail, invalid, NOT_ALLOWED, ok, type FormState } from "@/lib/action-state";
import { actionAccess } from "@/lib/auth";
import { observationSchema } from "@/lib/inspeksi-rules";
import { k3DbError, readPayload } from "@/lib/k3-actions";
import { notificationIds, sendPushForNotifications } from "@/lib/push";
import { createClient } from "@/lib/supabase/server";

/** FormData: payload (JSON). Hasil: {id, code, findingCode}. */
export async function submitObservationAction(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await actionAccess("viewer"))) return NOT_ALLOWED;
  const raw = readPayload(fd);
  if (raw === null) return fail("Isian form tidak terbaca. Muat ulang halaman.");
  const parsed = observationSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("observation_submit", { p: parsed.data });
  if (error) return k3DbError(error);
  await sendPushForNotifications(notificationIds(data));
  const r = data as { id: string; code: string; finding_code: string | null };
  revalidatePath("/observasi");
  revalidatePath("/inspeksi");
  if (r.finding_code) revalidatePath("/temuan");
  return ok(`Observasi ${r.code} terkirim.`, { id: r.id, code: r.code, findingCode: r.finding_code });
}
