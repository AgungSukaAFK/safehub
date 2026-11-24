"use server";

// Server Action People & Compliance (Manpower, Kompetensi, MCU, Permit). zod → RPC (hak dicek di DB).
// Bukti sertifikat/MCU: browser mengunggah ke Storage lebih dulu, lalu RPC simpan menghitung ulang jumlah file.
import { revalidatePath } from "next/cache";
import { invalid, NOT_ALLOWED, ok, type FormState } from "@/lib/action-state";
import { actionAccess } from "@/lib/auth";
import { k3DbError } from "@/lib/k3-actions";
import { certificateSchema, competencySchema, employeeSchema, mcuSchema, permitSchema, requirementSchema } from "@/lib/people-rules";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";

const refresh = (id?: string) => {
  revalidatePath("/manpower");
  revalidatePath("/kompetensi");
  revalidatePath("/mcu");
  revalidatePath("/");
  if (id) revalidatePath(`/manpower/${id}`);
};
const nullId = (id: string | null) => (id ?? null) as string;

export async function saveEmployeeAction(id: string | null, values: unknown): Promise<FormState> {
  if ((id !== null && !isUuid(id)) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const parsed = employeeSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("employee_save", { p_id: nullId(id), p: parsed.data });
  if (error) return k3DbError(error);
  const newId = (data as { id: string }).id;
  refresh(newId);
  return ok(id ? "Data karyawan diperbarui." : "Karyawan ditambahkan.", { id: newId });
}

export async function saveRequirementAction(values: unknown): Promise<FormState> {
  if (!(await actionAccess("viewer"))) return NOT_ALLOWED;
  const parsed = requirementSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("position_requirement_save", { p: parsed.data });
  if (error) return k3DbError(error);
  refresh();
  return ok("Kebutuhan manpower disimpan.");
}

export async function saveCompetencyAction(id: string | null, values: unknown): Promise<FormState> {
  if ((id !== null && !isUuid(id)) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const parsed = competencySchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("competency_save", { p_id: nullId(id), p: parsed.data });
  if (error) return k3DbError(error);
  refresh();
  return ok(id ? "Kompetensi diperbarui." : "Kompetensi ditambahkan.");
}

export async function saveCertificateAction(id: string | null, employeeId: string, values: unknown): Promise<FormState> {
  if ((id !== null && !isUuid(id)) || !isUuid(employeeId) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const parsed = certificateSchema.safeParse({ ...(values as object), employee_id: employeeId });
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("certificate_save", { p_id: nullId(id), p: parsed.data });
  if (error) return k3DbError(error);
  refresh(employeeId);
  return ok(id ? "Sertifikat diperbarui." : "Sertifikat ditambahkan.", { id: (data as { id: string }).id });
}

export async function saveMcuAction(id: string | null, employeeId: string, values: unknown): Promise<FormState> {
  if ((id !== null && !isUuid(id)) || !isUuid(employeeId) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const parsed = mcuSchema.safeParse({ ...(values as object), employee_id: employeeId });
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mcu_save", { p_id: nullId(id), p: parsed.data });
  if (error) return k3DbError(error);
  refresh(employeeId);
  return ok(id ? "MCU diperbarui." : "MCU dicatat.", { id: (data as { id: string }).id });
}

export async function savePermitAction(id: string | null, employeeId: string, values: unknown): Promise<FormState> {
  if ((id !== null && !isUuid(id)) || !isUuid(employeeId) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const parsed = permitSchema.safeParse({ ...(values as object), employee_id: employeeId });
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("site_permit_save", { p_id: nullId(id), p: parsed.data });
  if (error) return k3DbError(error);
  refresh(employeeId);
  return ok(id ? "Permit diperbarui." : "Permit ditambahkan.");
}

/** Setelah bukti diunggah ke sertifikat/<id>/ atau mcu/<id>/: hitung ulang jumlah file. */
export async function syncEvidenceAction(kind: "sertifikat" | "mcu", id: string, employeeId: string): Promise<FormState> {
  if (!["sertifikat", "mcu"].includes(kind) || !isUuid(id) || !isUuid(employeeId) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const supabase = await createClient();
  const { error } = await supabase.rpc("people_sync_evidence", { p_kind: kind, p_id: id });
  if (error) return k3DbError(error);
  refresh(employeeId);
  return ok("Bukti diperbarui.");
}
