// Inspeksi & Observasi + jam kerja (rancangan §4.3, spesifikasi docs/spec/fase-2-inspeksi-dashboard.md).
// Aman client + server: label status, zod, fungsi murni. Nilai DB = kode Inggris.
import { z } from "zod";
import type { FieldLabel } from "@/lib/person-types";
import type { StatusDef } from "@/lib/status";

// ---------------------------------------------------------------- status inspeksi
export const INSPECTION_STATUSES = ["scheduled", "in_progress", "submitted", "verified", "cancelled"] as const;
export type InspectionStatus = (typeof INSPECTION_STATUSES)[number];

export const INSPECTION_STATUS: Record<string, StatusDef> = {
  scheduled: { label: "Terjadwal", color: "blue" },
  in_progress: { label: "In Progress", color: "amber" },
  submitted: { label: "Menunggu Verifikasi", color: "violet" },
  verified: { label: "Terverifikasi", color: "green" },
  cancelled: { label: "Dibatalkan", color: "gray" },
  /** turunan (rancangan §2.4): terjadwal/berjalan yang tanggal rencananya sudah lewat */
  late: { label: "Terlambat", color: "red" },
};

export const INSPECTION_STATUS_OPTIONS = INSPECTION_STATUSES.map((s) => ({ value: s, label: INSPECTION_STATUS[s].label }));

/** Status tampil: terlambat dihitung dari tanggal rencana (WIB), tidak disimpan. `today` = YYYY-MM-DD WIB. */
export function inspectionDisplayStatus(status: string, plannedDate: string, today: string): string {
  return (status === "scheduled" || status === "in_progress") && plannedDate < today ? "late" : status;
}

export const ANSWERS = [
  { value: "compliant", label: "Sesuai" },
  { value: "noncompliant", label: "Tidak Sesuai" },
  { value: "na", label: "N/A" },
] as const;
export type Answer = (typeof ANSWERS)[number]["value"];
export const ANSWER_LABEL: Record<string, string> = Object.fromEntries(ANSWERS.map((a) => [a.value, a.label]));

export const INSPECTION_VIEWS = ["kalender", "daftar"] as const;
export type InspectionView = (typeof INSPECTION_VIEWS)[number];
export const INSPECTION_SORTS = ["tanggal", "jenis", "status"] as const;

// ---------------------------------------------------------------- observasi
export const OBS_KINDS = [
  { value: "kta", label: "KTA", full: "Kondisi Tidak Aman" },
  { value: "tta", label: "TTA", full: "Tindakan Tidak Aman" },
] as const;
export const OBS_KIND_LABEL: Record<string, string> = Object.fromEntries(OBS_KINDS.map((k) => [k.value, `${k.label} · ${k.full}`]));

// ---------------------------------------------------------------- zod
const uuid = z.string().uuid();
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Maksimal ${max} karakter`)
    .optional()
    .nullable()
    .transform((v) => v || null);

export const scheduleSchema = z.object({
  template_id: uuid.or(z.literal("")).refine((v) => !!v, "Pilih jenis inspeksi"),
  location_id: uuid,
  area_id: uuid.or(z.literal("")).refine((v) => !!v, "Lokasi wajib dipilih"),
  planned_at: z.string().min(1, "Tanggal & waktu wajib diisi").refine((v) => !Number.isNaN(Date.parse(v)), "Tanggal tidak valid"),
  inspector_id: uuid.or(z.literal("")).refine((v) => !!v, "Pemeriksa wajib dipilih"),
  object_text: optText(120),
  company_code: z.string().max(16).optional().nullable(),
});
export type ScheduleInput = z.input<typeof scheduleSchema>;

export const answerSchema = z.object({
  line_no: z.number().int().min(1).max(100),
  answer: z.enum(["", "compliant", "noncompliant", "na"]),
  comment: z.string().trim().max(1000).default(""),
  photos: z.array(z.string().max(300)).max(5).default([]),
});
export const answersSchema = z.array(answerSchema).max(100);
export type AnswerInput = z.input<typeof answerSchema>;

export const submitFindingSchema = z.object({
  line_no: z.number().int().min(1).max(100),
  description: z.string().trim().max(4000).optional().nullable(),
  risk_level: z.string().min(1, "Prioritas wajib dipilih"),
  pic_id: uuid,
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Due date wajib diisi"),
});
export const submitFindingsSchema = z.array(submitFindingSchema).max(100);
export type SubmitFindingInput = z.input<typeof submitFindingSchema>;

export const templateSchema = z.object({
  type_code: z.string().min(1, "Pilih jenis inspeksi"),
  name: z.string().trim().min(3, "Nama minimal 3 karakter").max(120),
  object_label: optText(60),
  finding_category: z.string().min(1, "Pilih kategori temuan"),
  is_active: z.boolean().default(true),
  items: z.array(z.string().trim().max(500)).max(100),
});
export type TemplateInput = z.input<typeof templateSchema>;

export const observationSchema = z
  .object({
    company_code: z.string().max(16).optional().nullable(),
    location_id: uuid,
    area_id: uuid.or(z.literal("")).refine((v) => !!v, "Lokasi wajib dipilih"),
    kind: z.enum(["kta", "tta"], { errorMap: () => ({ message: "Pilih KTA atau TTA" }) }),
    description: z.string().trim().min(1, "Uraian wajib diisi").max(1000, "Maksimal 1000 karakter"),
    immediate_action: optText(1000),
    followup: z.boolean().default(false),
    risk_level: z.string().optional().nullable(),
    pic_id: uuid.optional().nullable(),
  })
  .refine((v) => !v.followup || !!v.risk_level, { message: "Prioritas wajib dipilih", path: ["risk_level"] })
  .refine((v) => !v.followup || !!v.pic_id, { message: "PIC wajib dipilih", path: ["pic_id"] });
export type ObservationInput = z.input<typeof observationSchema>;

export const workHoursSchema = z.object({
  location_id: uuid,
  month: z.string().regex(/^\d{4}-\d{2}$/, "Bulan tidak valid"),
  hours: z.number({ invalid_type_error: "Isi jam kerja" }).min(0, "Tidak boleh negatif").max(100_000_000),
  note: optText(500),
});

// ---------------------------------------------------------------- fungsi murni
/** `YYYY-MM` → {year, month}; null bila tidak valid. */
export function parseMonth(v: string | null | undefined): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(v ?? "");
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  return month >= 1 && month <= 12 && year >= 2000 && year <= 2100 ? { year, month } : null;
}
export const monthKey = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;
export function shiftMonthKey(key: string, delta: number): string {
  const p = parseMonth(key) ?? { year: 2026, month: 1 };
  const d = new Date(Date.UTC(p.year, p.month - 1 + delta, 1));
  return monthKey(d.getUTCFullYear(), d.getUTCMonth() + 1);
}

export const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
export const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
export const monthLabel = (key: string) => {
  const p = parseMonth(key);
  return p ? `${MONTH_NAMES[p.month - 1]} ${p.year}` : key;
};

/** Persentase pencapaian (bulat); null bila tanpa rencana. */
export const achievementPct = (actual: number, plan: number) => (plan > 0 ? Math.round((actual / plan) * 100) : null);

export const INSPECTION_FIELD_LABELS: Record<string, FieldLabel> = {
  status: { label: "Status", format: "status", statuses: INSPECTION_STATUS },
  planned_at: { label: "Rencana", format: "datetime" },
  inspector_id: { label: "Pemeriksa", format: "person" },
  object_text: { label: "Objek" },
  title: { label: "Jenis" },
  area_id: { label: "Lokasi" },
  started_at: { label: "Mulai", format: "datetime" },
  submitted_at: { label: "Dikirim", format: "datetime" },
  verified_at: { label: "Diverifikasi", format: "datetime" },
  verify_note: { label: "Catatan verifikasi" },
  cancel_reason: { label: "Alasan pembatalan" },
  hasil: { label: "Hasil" },
};
