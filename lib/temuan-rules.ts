// Temuan & PICA (rancangan §4.2). Aman client + server.
import { z } from "zod";
import type { FieldLabel } from "@/lib/person-types";
import type { StatusDef } from "@/lib/status";

export const FINDING_STATUSES = ["open", "in_progress", "waiting_verification", "closed"] as const;
export type FindingStatus = (typeof FINDING_STATUSES)[number];

export const FINDING_STATUS: Record<string, StatusDef> = {
  open: { label: "Open", color: "blue" },
  in_progress: { label: "In Progress", color: "amber" },
  waiting_verification: { label: "Menunggu Verifikasi", color: "violet" },
  closed: { label: "Closed", color: "green" },
  overdue: { label: "Overdue", color: "red" },
};
export const FINDING_STATUS_OPTIONS = FINDING_STATUSES.map((s) => ({ value: s, label: FINDING_STATUS[s].label }));

export const SOURCE_KINDS = [
  { value: "inspection", label: "Inspeksi" },
  { value: "observation", label: "Observasi KTA/TTA" },
  { value: "audit", label: "Audit" },
  { value: "incident", label: "Investigasi Kejadian" },
  { value: "meeting", label: "Rapat/MOM" },
  { value: "other", label: "Lainnya" },
] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number]["value"];
export const SOURCE_KIND_LABEL: Record<string, string> = Object.fromEntries(SOURCE_KINDS.map((s) => [s.value, s.label]));

export const ROOT_FACTORS = [
  { value: "man", label: "Manusia" },
  { value: "method", label: "Metode" },
  { value: "machine", label: "Mesin/Peralatan" },
  { value: "material", label: "Material" },
  { value: "environment", label: "Lingkungan" },
  { value: "management", label: "Manajemen" },
] as const;
export const ROOT_FACTOR_LABEL: Record<string, string> = Object.fromEntries(ROOT_FACTORS.map((f) => [f.value, f.label]));

export const LIKELIHOOD = ["Hampir tidak mungkin", "Jarang", "Mungkin terjadi", "Sering", "Hampir pasti"];
export const CONSEQUENCE = ["Tidak signifikan", "Ringan", "Sedang", "Cedera berat", "Fatal"];

/** Saved views (param URL `tampilan`). */
export const FINDING_VIEWS = ["semua", "saya", "overdue", "verifikasi", "closed"] as const;
export type FindingView = (typeof FINDING_VIEWS)[number];
export const FINDING_VIEW_LABELS: Record<FindingView, string> = {
  semua: "Semua",
  saya: "Ditugaskan ke Saya",
  overdue: "Overdue",
  verifikasi: "Menunggu Verifikasi",
  closed: "Closed",
};
export const FINDING_SORTS = ["nomor", "ditemukan", "due", "prioritas", "status"] as const;

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Maksimal ${max} karakter`)
    .optional()
    .nullable()
    .transform((v) => v || null);

export const findingSchema = z
  .object({
    company_code: z.string().max(16).optional().nullable(),
    location_id: z.string().uuid({ message: "Pilih site" }),
    area_id: z.string().uuid({ message: "Lokasi temuan wajib dipilih" }),
    location_detail: optText(200),
    found_at: z
      .string()
      .min(1, "Waktu ditemukan wajib diisi")
      .refine((v) => !Number.isNaN(Date.parse(v)), "Waktu tidak valid")
      .refine((v) => Date.parse(v) <= Date.now() + 5 * 60_000, "Waktu ditemukan tidak boleh di masa depan"),
    title: z.string().trim().min(3, "Judul minimal 3 karakter").max(200),
    description: z.string().trim().min(1, "Uraian wajib diisi").max(4000),
    source_kind: z.enum(["inspection", "observation", "audit", "incident", "meeting", "other"], {
      errorMap: () => ({ message: "Sumber temuan wajib dipilih" }),
    }),
    source_ref: optText(60),
    source_id: z.string().uuid().optional().nullable(),
    category: z.string().min(1, "Kategori wajib dipilih"),
    risk_level: z.string().min(1, "Prioritas wajib dipilih"),
    likelihood: z.number().int().min(1).max(5).nullable().optional(),
    consequence: z.number().int().min(1).max(5).nullable().optional(),
    root_causes: z
      .array(z.object({ factor: z.enum(["man", "method", "machine", "material", "environment", "management"]), text: z.string().trim().max(1000) }))
      .max(30)
      .default([]),
    pic_id: z.string().uuid({ message: "PIC temuan wajib dipilih" }),
    due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Due date wajib diisi"),
    change_reason: optText(500),
  })
  .refine((v) => v.source_kind !== "incident" || !!v.source_id, { message: "Pilih kejadian sumber", path: ["source_id"] });

export type FindingValues = {
  company_code: string | null;
  location_id: string;
  area_id: string;
  location_detail: string;
  found_at: string;
  title: string;
  description: string;
  source_kind: SourceKind | "";
  source_ref: string;
  source_id: string | null;
  category: string;
  risk_level: string;
  likelihood: number | null;
  consequence: number | null;
  root_causes: { key: string; factor: (typeof ROOT_FACTORS)[number]["value"]; text: string }[];
  pic_id: string | null;
  due_date: string | null;
  change_reason: string;
};

export const newFindingValues = (init: Partial<FindingValues>): FindingValues => ({
  company_code: null,
  location_id: "",
  area_id: "",
  location_detail: "",
  found_at: "",
  title: "",
  description: "",
  source_kind: "",
  source_ref: "",
  source_id: null,
  category: "",
  risk_level: "",
  likelihood: null,
  consequence: null,
  root_causes: [],
  pic_id: null,
  due_date: null,
  change_reason: "",
  ...init,
});

/** Status tampil temuan (overdue turunan). */
export function findingDisplayStatus(f: { status: string; dueDate: string }, today: string): string {
  return f.status !== "closed" && f.dueDate < today ? "overdue" : f.status;
}

export const FINDING_FIELD_LABELS: Record<string, FieldLabel> = {
  status: { label: "Status", format: "status", statuses: FINDING_STATUS },
  title: { label: "Judul" },
  description: { label: "Uraian" },
  source_kind: { label: "Sumber" },
  source_ref: { label: "Referensi sumber" },
  category: { label: "Kategori" },
  risk_level: { label: "Prioritas" },
  likelihood: { label: "Kemungkinan", format: "number" },
  consequence: { label: "Konsekuensi", format: "number" },
  pic_id: { label: "PIC", format: "person" },
  due_date: { label: "Due date", format: "date" },
  found_at: { label: "Ditemukan", format: "datetime" },
  area_id: { label: "Lokasi" },
  location_detail: { label: "Detail lokasi" },
  root_causes: { label: "Akar penyebab" },
  closed_at: { label: "Ditutup", format: "datetime" },
  close_note: { label: "Alasan penutupan" },
};
