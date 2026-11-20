"use server";

// Server Action modul approval (admin): template & kepala departemen. Semua lewat RPC/tabel dengan
// sesi user; DB mengecek admin sendiri.
import { revalidatePath } from "next/cache";
import { dbError, fail, invalid, NOT_ALLOWED, ok, type FormState } from "@/lib/action-state";
import { APP_ID } from "@/lib/app-config";
import { actionAccess } from "@/lib/auth";
import { templateSchema } from "@/lib/approval-template-rules";
import { createClient } from "@/lib/supabase/server";
import { escapeLike, isUuid } from "@/lib/utils";

export async function saveTemplateAction(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await actionAccess("admin"))) return NOT_ALLOWED;
  let raw: unknown;
  try {
    raw = JSON.parse(String(fd.get("payload") ?? "{}"));
  } catch {
    return fail("Isian form tidak terbaca. Muat ulang halaman.");
  }
  const parsed = templateSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("approval_template_save", { p: parsed.data });
  if (error) return dbError(error);
  revalidatePath("/approval/template");
  return ok(parsed.data.id ? "Template disimpan." : "Template dibuat.", { id: data });
}

export async function deleteTemplateAction(id: string): Promise<FormState> {
  if (!isUuid(id) || !(await actionAccess("admin"))) return NOT_ALLOWED;
  const supabase = await createClient();
  const { error } = await supabase.rpc("approval_template_delete", { p_id: id });
  if (error) return dbError(error);
  revalidatePath("/approval/template");
  return ok("Template dihapus.");
}

/** Set (userId) / kosongkan (null) kepala departemen untuk satu departemen × company. */
export async function setDepartmentHeadAction(departmentId: string, companyCode: string, userId: string | null): Promise<FormState> {
  if (!isUuid(departmentId) || !/^[A-Z0-9_]{1,20}$/.test(companyCode) || (userId !== null && !isUuid(userId))) return NOT_ALLOWED;
  if (!(await actionAccess("admin"))) return NOT_ALLOWED;
  const supabase = await createClient();
  const { error } = userId
    ? await supabase.from("department_heads").upsert({ department_id: departmentId, company_code: companyCode, user_id: userId }, { onConflict: "department_id,company_code" })
    : await supabase.from("department_heads").delete().eq("department_id", departmentId).eq("company_code", companyCode);
  if (error) return dbError(error);
  revalidatePath("/approval/kepala-departemen");
  return ok(userId ? "Kepala departemen disimpan." : "Kepala departemen dikosongkan.");
}

/** Cari orang yang punya akses ke app ini (calon approver). Hanya admin (app_access terbaca admin). */
export async function searchAppPeopleAction(q: string) {
  if (!(await actionAccess("admin"))) return [];
  const supabase = await createClient();
  const { data: acc } = await supabase.schema("public").from("app_access").select("user_id, app_id, role").in("app_id", [APP_ID, "platform"]);
  const ids = [...new Set((acc ?? []).filter((a) => a.app_id === APP_ID || a.role === "admin").map((a) => a.user_id))];
  if (!ids.length) return [];
  let query = supabase.schema("public").from("profiles").select("id, full_name, email, departments(name)").in("id", ids).eq("is_active", true).order("full_name").limit(15);
  const term = q.trim().slice(0, 50);
  if (term) query = query.ilike("full_name", `%${escapeLike(term)}%`);
  const { data } = await query;
  return (data ?? []).map((p) => {
    const dept = Array.isArray(p.departments) ? p.departments[0] : p.departments;
    return { value: p.id, label: p.full_name, description: [dept?.name, p.email].filter(Boolean).join(" · ") || undefined };
  });
}
