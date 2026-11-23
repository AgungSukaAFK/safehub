// Tindakan PICA (rancangan §4.2). Dipakai Temuan DAN Kejadian. Aman client + server.
import { z } from "zod";
import type { FieldLabel } from "@/lib/person-types";
import type { StatusDef } from "@/lib/status";

export const ACTION_STATUSES = ["open", "in_progress", "waiting_verification", "closed"] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export const ACTION_STATUS: Record<string, StatusDef> = {
  open: { label: "Open", color: "blue" },
  in_progress: { label: "In Progress", color: "amber" },
  waiting_verification: { label: "Menunggu Verifikasi", color: "violet" },
  closed: { label: "Closed", color: "green" },
  /** turunan: in_progress setelah dikembalikan verifikator */
  returned: { label: "Dikembalikan", color: "amber" },
  overdue: { label: "Overdue", color: "red" },
};

export const ACTION_KINDS = [
  { value: "corrective", label: "Korektif" },
  { value: "preventive", label: "Preventif" },
] as const;
export const ACTION_KIND_LABEL: Record<string, string> = { corrective: "Korektif", preventive: "Preventif" };
export const ACTION_GROUP_LABEL: Record<string, string> = { corrective: "Tindakan Koreksi", preventive: "Tindakan Pencegahan" };

export const actionSchema = z
  .object({
    finding_id: z.string().uuid().optional().nullable(),
    incident_id: z.string().uuid().optional().nullable(),
    title: z.string().trim().min(3, "Deskripsi tindakan wajib diisi (min. 3 karakter)").max(500),
    kind: z.enum(["corrective", "preventive"], { errorMap: () => ({ message: "Pilih jenis tindakan" }) }),
    pic_id: z.string().uuid({ message: "PIC wajib dipilih" }),
    verifier_id: z.string().uuid({ message: "Verifikator wajib dipilih" }),
    due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Due date wajib diisi"),
    required_evidence: z
      .string()
      .trim()
      .max(500)
      .optional()
      .nullable()
      .transform((v) => v || null),
    cause_ref: z
      .string()
      .trim()
      .max(500)
      .optional()
      .nullable()
      .transform((v) => v || null),
  })
  .refine((v) => !!v.finding_id !== !!v.incident_id, { message: "Tindakan harus milik temuan atau kejadian", path: ["title"] })
  .refine((v) => v.pic_id !== v.verifier_id, { message: "Verifikator tidak boleh sama dengan PIC", path: ["verifier_id"] });
export type ActionInput = z.input<typeof actionSchema>;

/** Status tampil: overdue & dikembalikan adalah turunan (rancangan §2.4). */
export function actionDisplayStatus(a: { status: string; returned: boolean; dueDate: string }, today: string): string {
  if (a.status !== "closed" && a.status !== "waiting_verification" && a.dueDate < today) return "overdue";
  if (a.status === "in_progress" && a.returned) return "returned";
  return a.status;
}

/** Hari keterlambatan (positif = lewat jatuh tempo). */
export function daysLate(due: string, today: string): number {
  return Math.round((Date.parse(today) - Date.parse(due)) / 86_400_000);
}

/** Nama file dari path storage (buang prefix timestamp safeStorageName). */
export function fileNameOf(path: string): string {
  return (path.split("/").pop() ?? path).replace(/^\d{10,}-/, "");
}

export const ACCEPT_EVIDENCE = "image/jpeg,image/png,image/webp,application/pdf,video/mp4,.jpg,.jpeg,.png,.webp,.pdf,.mp4";
export const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;

export const ACTION_FIELD_LABELS: Record<string, FieldLabel> = {
  status: { label: "Status", format: "status", statuses: ACTION_STATUS },
  title: { label: "Deskripsi" },
  kind: { label: "Jenis" },
  pic_id: { label: "PIC", format: "person" },
  verifier_id: { label: "Verifikator", format: "person" },
  due_date: { label: "Due date", format: "date" },
  round: { label: "Putaran", format: "number" },
  returned: { label: "Dikembalikan", format: "boolean" },
  closed_at: { label: "Closed", format: "datetime" },
  effectiveness_date: { label: "Verifikasi efektivitas", format: "date" },
  effectiveness_note: { label: "Catatan efektivitas" },
  bukti: { label: "Bukti" },
};
