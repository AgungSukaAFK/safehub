// Aturan template approval (aman client & server): validasi zod + pemilihan template yang SAMA
// dengan approval_start() di DB (dipakai pratinjau builder).
import { z } from "zod";
import type { ApprovalTemplate } from "@/lib/approval";

const optMoney = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : Number(v)), z.number().min(0, "Tidak boleh negatif").nullable());

export const templateStepSchema = z
  .object({
    approval_type: z.enum(["mengetahui", "memeriksa", "menyetujui"]),
    approver_kind: z.enum(["user", "department_head"]),
    approver_id: z.string().uuid().nullable(),
    due_hours: z.preprocess((v) => (v === "" || v === null || v === undefined ? null : Number(v)), z.number().int("Bilangan bulat").min(1, "Minimal 1 jam").max(720, "Maksimal 720 jam").nullable()),
  })
  .refine((s) => s.approver_kind !== "user" || !!s.approver_id, { message: "Pilih approver", path: ["approver_id"] });

export const templateSchema = z
  .object({
    id: z.string().uuid().nullable(),
    doc_type: z.string().min(1, "Pilih jenis dokumen"),
    name: z.string().trim().min(3, "Nama minimal 3 karakter").max(120, "Maksimal 120 karakter"),
    description: z.string().trim().max(500, "Maksimal 500 karakter").default(""),
    company_code: z.string().nullable(),
    department_id: z.string().uuid().nullable(),
    min_amount: optMoney,
    max_amount: optMoney,
    priority: z.coerce.number().int().min(-100).max(100).default(0),
    is_active: z.boolean(),
    steps: z.array(templateStepSchema).min(1, "Minimal 1 langkah").max(20, "Maksimal 20 langkah"),
  })
  .refine((t) => t.min_amount === null || t.max_amount === null || t.min_amount <= t.max_amount, { message: "Nominal minimum harus ≤ maksimum", path: ["max_amount"] });

export type TemplateInput = z.infer<typeof templateSchema>;

export type TemplateScope = Pick<ApprovalTemplate, "id" | "doc_type" | "company_code" | "department_id" | "min_amount" | "max_amount" | "priority" | "is_active" | "created_at"> & { stepCount: number };

/** Template yang akan dipakai dokumen (company, departemen, nominal). Cermin approval_start(). */
export function pickTemplate<T extends TemplateScope>(templates: T[], doc: { docType: string; companyCode: string | null; departmentId: string | null; amount: number }): T | null {
  const match = templates.filter(
    (t) =>
      t.doc_type === doc.docType &&
      t.is_active &&
      t.stepCount > 0 &&
      (t.company_code === null || t.company_code === doc.companyCode) &&
      (t.department_id === null || t.department_id === doc.departmentId) &&
      (t.min_amount === null || doc.amount >= t.min_amount) &&
      (t.max_amount === null || doc.amount <= t.max_amount),
  );
  match.sort(
    (a, b) =>
      b.priority - a.priority ||
      Number(b.company_code !== null) - Number(a.company_code !== null) ||
      Number(b.department_id !== null) - Number(a.department_id !== null) ||
      a.created_at.localeCompare(b.created_at),
  );
  return match[0] ?? null;
}
