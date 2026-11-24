// Dokumen terkendali, Evaluasi Peraturan, Register KO (rancangan §4.8, spesifikasi fase 4 bagian D).
// Aman client + server: label, status, zod.
import { z } from "zod";
import type { FieldLabel } from "@/lib/person-types";
import type { StatusDef } from "@/lib/status";

export const DOC_KINDS = [
  { value: "sop", label: "SOP" },
  { value: "ik", label: "Instruksi Kerja (IK)" },
  { value: "form", label: "Form" },
] as const;
export const DOC_KIND_FILTERS = ["semua", "sop", "ik", "form"] as const;
export const docKindLabel = (k: string) => DOC_KINDS.find((x) => x.value === k)?.label ?? k;

/** Status revisi. Status dokumen di register = turunan (terbit / ada revisi berjalan / ditarik). */
export const REVISION_STATUS: Record<string, StatusDef> = {
  draft: { label: "Draf", color: "gray" },
  pending_approval: { label: "Menunggu Persetujuan", color: "amber" },
  rejected: { label: "Dikembalikan", color: "red" },
  approved: { label: "Berlaku", color: "green" },
  obsolete: { label: "Usang", color: "gray" },
};
export const DOCUMENT_STATE: Record<string, StatusDef> = {
  published: { label: "Berlaku", color: "green" },
  unpublished: { label: "Belum Terbit", color: "gray" },
  withdrawn: { label: "Ditarik", color: "gray" },
};

export const REGULATION_COMPLIANCE: Record<string, StatusDef> = {
  compliant: { label: "Sesuai", color: "green" },
  partial: { label: "Sebagian", color: "amber" },
  non_compliant: { label: "Tidak Sesuai", color: "red" },
  na: { label: "Tidak Berlaku", color: "gray" },
};
export const COMPLIANCE_OPTIONS = Object.entries(REGULATION_COMPLIANCE).map(([value, d]) => ({ value, label: d.label }));

export const KO_KINDS = [
  { value: "izin_operasi", label: "Izin Operasi" },
  { value: "sertifikasi_alat", label: "Sertifikasi Alat" },
  { value: "sarana_prasarana", label: "Sarana & Prasarana" },
  { value: "dokumen_teknis", label: "Dokumen Teknis" },
] as const;
export const koKindLabel = (k: string) => KO_KINDS.find((x) => x.value === k)?.label ?? k;
export const KO_FILTERS = ["semua", "expiring", "expired"] as const;

export const DOKUMEN_FIELD_LABELS: Record<string, FieldLabel> = {
  code: { label: "Kode" },
  title: { label: "Judul" },
  kind: { label: "Jenis" },
  owner_id: { label: "Pemilik", format: "person" },
  review_months: { label: "Interval review (bulan)", format: "number" },
  distribute_titles: { label: "Distribusi jabatan", format: "list" },
  is_active: { label: "Aktif", format: "boolean" },
  withdraw_reason: { label: "Alasan penarikan" },
  rev_no: { label: "Revisi", format: "number" },
  change_summary: { label: "Ringkasan perubahan" },
  status: { label: "Status", format: "status", statuses: REVISION_STATUS },
  effective_on: { label: "Berlaku sejak", format: "date" },
  review_due_on: { label: "Jadwal review", format: "date" },
  evidence_count: { label: "Jumlah file", format: "number" },
  issuer: { label: "Penerbit" },
  issued_on: { label: "Tanggal terbit", format: "date" },
  clause: { label: "Pasal" },
  requirement: { label: "Persyaratan" },
  compliance: { label: "Kesesuaian", format: "status", statuses: REGULATION_COMPLIANCE },
  evaluated_on: { label: "Tanggal evaluasi", format: "date" },
  follow_up: { label: "Tindak lanjut" },
  next_review_on: { label: "Evaluasi berikutnya", format: "date" },
  number: { label: "Nomor" },
  valid_until: { label: "Berlaku sampai", format: "date" },
  notes: { label: "Catatan" },
};

const uuid = z.string().uuid();
const reqDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal wajib diisi");
const optDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid").or(z.literal("")).optional().nullable();

export const documentSchema = z.object({
  company_code: z.string().max(16).optional().nullable(),
  code: z.string().trim().min(3, "Kode minimal 3 karakter").max(40),
  title: z.string().trim().min(3, "Judul wajib diisi").max(200),
  kind: z.enum(["sop", "ik", "form"], { message: "Pilih jenis" }),
  owner_id: uuid.or(z.literal("")).optional().nullable(),
  review_months: z.coerce.number().int().min(1, "1 sampai 60").max(60, "1 sampai 60"),
  distribute_titles: z.array(z.string().trim().min(1).max(80)).max(50),
  change_summary: z.string().trim().max(2000).optional().nullable(),
});

export const regulationSchema = z.object({
  company_code: z.string().max(16).optional().nullable(),
  code: z.string().trim().min(3, "Nomor minimal 3 karakter").max(80),
  title: z.string().trim().min(3, "Judul wajib diisi").max(300),
  issuer: z.string().trim().max(120).optional().nullable(),
  issued_on: optDate,
  is_active: z.boolean().optional(),
});

export const evaluationSchema = z
  .object({
    regulation_id: uuid,
    location_id: uuid,
    clause: z.string().trim().min(1, "Pasal wajib diisi").max(120),
    requirement: z.string().trim().min(3, "Persyaratan wajib diisi").max(2000),
    compliance: z.enum(["compliant", "partial", "non_compliant", "na"], { message: "Pilih kesesuaian" }),
    evaluated_on: reqDate,
    follow_up: z.string().trim().max(2000).optional().nullable(),
    next_review_on: optDate,
  })
  .refine((v) => !["partial", "non_compliant"].includes(v.compliance) || (v.follow_up ?? "").trim().length >= 5, { path: ["follow_up"], message: "Wajib diisi untuk Sebagian / Tidak Sesuai" });

export const makeFindingSchema = z.object({
  area_id: uuid.or(z.literal("")).refine((v) => !!v, "Pilih area"),
  pic_id: uuid.or(z.literal("")).refine((v) => !!v, "Pilih PIC"),
  due_date: reqDate,
  risk_level: z.string().min(1, "Pilih risiko").max(40),
});

export const koSchema = z.object({
  company_code: z.string().max(16).optional().nullable(),
  location_id: uuid,
  title: z.string().trim().min(3, "Judul wajib diisi").max(200),
  kind: z.enum(["izin_operasi", "sertifikasi_alat", "sarana_prasarana", "dokumen_teknis"], { message: "Pilih jenis" }),
  number: z.string().trim().max(80).optional().nullable(),
  owner_id: uuid.or(z.literal("")).optional().nullable(),
  valid_until: reqDate,
  is_active: z.boolean().optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
});
