"use server";

// Server Action Pengaturan Pengingat: validasi zod → RPC reminder_rule_save (admin dicek di DB).
import { revalidatePath } from "next/cache";
import { invalid, NOT_ALLOWED, ok, type FormState } from "@/lib/action-state";
import { actionAccess } from "@/lib/auth";
import { k3DbError } from "@/lib/k3-actions";
import { reminderRuleSchema } from "@/lib/pengingat-rules";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";

export async function saveReminderRuleAction(id: string, values: unknown): Promise<FormState> {
  if (!isUuid(id) || !(await actionAccess("admin"))) return NOT_ALLOWED;
  const parsed = reminderRuleSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("reminder_rule_save", { p_id: id, p: parsed.data });
  if (error) return k3DbError(error);
  revalidatePath("/pengingat");
  return ok("Aturan pengingat disimpan.");
}
