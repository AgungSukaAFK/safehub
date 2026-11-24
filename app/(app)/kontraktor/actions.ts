"use server";

// Server Action Kontraktor & PJO/PJA. zod → RPC (hak dicek di DB). Bukti: browser unggah ke Storage lebih dulu,
// lalu RPC menghitung ulang jumlah file.
import { revalidatePath } from "next/cache";
import { invalid, NOT_ALLOWED, ok, type FormState } from "@/lib/action-state";
import { actionAccess } from "@/lib/auth";
import { k3DbError } from "@/lib/k3-actions";
import { appointmentSchema, contractSchema, contractorDocumentSchema, contractorPermitSchema, contractorSchema, csmsSchema } from "@/lib/kontraktor-rules";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";

const refresh = (contractorId?: string) => {
  revalidatePath("/kontraktor");
  revalidatePath("/pjo-pja");
  if (contractorId) revalidatePath(`/kontraktor/${contractorId}`);
};
const nullId = (id: string | null) => (id ?? null) as string;

export async function saveContractorAction(id: string | null, values: unknown): Promise<FormState> {
  if ((id !== null && !isUuid(id)) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const parsed = contractorSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("contractor_save", { p_id: nullId(id), p: parsed.data });
  if (error) return k3DbError(error);
  const newId = (data as { id: string }).id;
  refresh(newId);
  return ok(id ? "Data kontraktor diperbarui." : "Kontraktor ditambahkan.", { id: newId });
}

export async function savePermitAction(id: string | null, contractorId: string, values: unknown): Promise<FormState> {
  if ((id !== null && !isUuid(id)) || !isUuid(contractorId) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const parsed = contractorPermitSchema.safeParse({ ...(values as object), contractor_id: contractorId });
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("contractor_permit_save", { p_id: nullId(id), p: parsed.data });
  if (error) return k3DbError(error);
  refresh(contractorId);
  return ok(id ? "Izin diperbarui." : "Izin ditambahkan.");
}

export async function saveContractAction(id: string | null, contractorId: string, values: unknown): Promise<FormState> {
  if ((id !== null && !isUuid(id)) || !isUuid(contractorId) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const parsed = contractSchema.safeParse({ ...(values as object), contractor_id: contractorId });
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("contractor_contract_save", { p_id: nullId(id), p: parsed.data });
  if (error) return k3DbError(error);
  refresh(contractorId);
  return ok(id ? "Kontrak diperbarui." : "Kontrak ditambahkan.");
}

export async function saveCsmsAction(id: string | null, contractorId: string, values: unknown): Promise<FormState> {
  if ((id !== null && !isUuid(id)) || !isUuid(contractorId) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const parsed = csmsSchema.safeParse({ ...(values as object), contractor_id: contractorId });
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("csms_save", { p_id: nullId(id), p: parsed.data });
  if (error) return k3DbError(error);
  refresh(contractorId);
  return ok(id ? "Penilaian CSMS diperbarui." : "Penilaian CSMS dicatat.");
}

export async function saveDocumentAction(contractorId: string, typeId: string, values: unknown): Promise<FormState> {
  if (!isUuid(contractorId) || !isUuid(typeId) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const parsed = contractorDocumentSchema.safeParse({ ...(values as object), contractor_id: contractorId, type_id: typeId });
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("contractor_document_set", { p: parsed.data });
  if (error) return k3DbError(error);
  refresh(contractorId);
  return ok("Checklist dokumen diperbarui.");
}

export async function saveAppointmentAction(id: string | null, values: unknown): Promise<FormState> {
  if ((id !== null && !isUuid(id)) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const parsed = appointmentSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("pjo_pja_save", { p_id: nullId(id), p: parsed.data });
  if (error) return k3DbError(error);
  refresh();
  return ok(id ? "Penunjukan diperbarui." : "Penunjukan dicatat.");
}

/** Setelah bukti diunggah ke izin/<id>/, kdok/<id>/ atau pjo/<id>/: hitung ulang jumlah file. */
export async function syncKontraktorEvidenceAction(kind: "izin" | "kdok" | "pjo", id: string, contractorId?: string): Promise<FormState> {
  if (!["izin", "kdok", "pjo"].includes(kind) || !isUuid(id) || (contractorId && !isUuid(contractorId)) || !(await actionAccess("viewer"))) return NOT_ALLOWED;
  const supabase = await createClient();
  const { error } = await supabase.rpc("kontraktor_sync_evidence", { p_kind: kind, p_id: id });
  if (error) return k3DbError(error);
  refresh(contractorId);
  return ok("Bukti diperbarui.");
}
