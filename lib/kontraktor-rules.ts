// Kontraktor & PJO/PJA (rancangan §4.7, spesifikasi fase 4 bagian C). Aman client + server: label, status, zod.
import { z } from "zod";
import type { FieldLabel } from "@/lib/person-types";
import type { StatusDef } from "@/lib/status";

export const CONTRACTOR_KINDS = [
  { value: "subkontraktor", label: "Subkontraktor" },
  { value: "vendor", label: "Vendor" },
] as const;

/** Status legalitas = turunan dari izin TERBARU per nama izin (fungsi DB contractor_overview). */
export const LEGAL_STATE: Record<string, StatusDef> = {
  none: { label: "Belum Ada Izin", color: "gray" },
  valid: { label: "Berlaku", color: "green" },
  expiring: { label: "Akan Kedaluwarsa", color: "amber" },
  expired: { label: "Kedaluwarsa", color: "red" },
};
export const LEGAL_FILTERS = ["semua", "expiring", "expired", "none"] as const;

export const CSMS_RESULT: Record<string, StatusDef> = {
  pass: { label: "Lulus", color: "green" },
  conditional: { label: "Bersyarat", color: "amber" },
  fail: { label: "Gagal", color: "red" },
};
/** Ambang hasil CSMS (cermin csms_save): >= 80 lulus, 60-79 bersyarat, < 60 gagal. */
export const csmsResultOf = (score: number) => (score >= 80 ? "pass" : score >= 60 ? "conditional" : "fail");

export const DOC_STATUS: Record<string, StatusDef> = {
  pending: { label: "Belum Diterima", color: "gray" },
  received: { label: "Diterima", color: "green" },
  rejected: { label: "Ditolak", color: "red" },
};
export const DOC_STATUS_OPTIONS = Object.entries(DOC_STATUS).map(([value, d]) => ({ value, label: d.label }));

export const APPOINTMENT_ROLE = [
  { value: "pjo", label: "PJO" },
  { value: "pja", label: "PJA" },
] as const;
export const APPOINTMENT_ROLE_LABEL: Record<string, string> = { pjo: "PJO (Penanggung Jawab Operasional)", pja: "PJA (Penanggung Jawab Area)" };

export const KONTRAKTOR_FIELD_LABELS: Record<string, FieldLabel> = {
  name: { label: "Nama" },
  kind: { label: "Jenis" },
  pic_name: { label: "PIC" },
  pic_contact: { label: "Kontak PIC" },
  notes: { label: "Catatan" },
  is_active: { label: "Aktif", format: "boolean" },
  number: { label: "Nomor" },
  issuer: { label: "Penerbit" },
  valid_until: { label: "Berlaku sampai", format: "date" },
  title: { label: "Judul" },
  starts_on: { label: "Mulai", format: "date" },
  ends_on: { label: "Berakhir", format: "date" },
  assessed_on: { label: "Tanggal penilaian", format: "date" },
  score: { label: "Skor", format: "number" },
  result: { label: "Hasil", format: "status", statuses: CSMS_RESULT },
  status: { label: "Status", format: "status", statuses: DOC_STATUS },
  role: { label: "Peran" },
  scope: { label: "Lingkup" },
  sk_number: { label: "Nomor SK" },
  employee_id: { label: "Karyawan" },
  note: { label: "Catatan" },
  evidence_count: { label: "Jumlah bukti", format: "number" },
};

const uuid = z.string().uuid();
const reqDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal wajib diisi");
const optDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid").or(z.literal("")).optional().nullable();

export const contractorSchema = z.object({
  company_code: z.string().max(16).optional().nullable(),
  name: z.string().trim().min(2, "Nama wajib diisi").max(200),
  kind: z.enum(["subkontraktor", "vendor"], { message: "Pilih jenis" }),
  pic_name: z.string().trim().max(120).optional().nullable(),
  pic_contact: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  is_active: z.boolean().optional(),
});

export const contractorPermitSchema = z.object({
  contractor_id: uuid,
  name: z.string().trim().min(2, "Nama izin wajib diisi").max(120),
  number: z.string().trim().max(80).optional().nullable(),
  issuer: z.string().trim().max(120).optional().nullable(),
  valid_until: reqDate,
});

export const contractSchema = z
  .object({
    contractor_id: uuid,
    number: z.string().trim().min(2, "Nomor wajib diisi").max(80),
    title: z.string().trim().min(3, "Judul wajib diisi").max(200),
    starts_on: reqDate,
    ends_on: reqDate,
    amount: z.string().trim().regex(/^\d{0,16}(\.\d{1,2})?$/, "Angka saja, tanpa titik ribuan").optional().nullable(),
  })
  .refine((v) => v.ends_on >= v.starts_on, { path: ["ends_on"], message: "Tidak boleh sebelum tanggal mulai" });

export const csmsSchema = z.object({
  contractor_id: uuid,
  assessed_on: reqDate,
  score: z.coerce.number().int().min(0, "0 sampai 100").max(100, "0 sampai 100"),
  valid_until: optDate,
  note: z.string().trim().max(2000).optional().nullable(),
});

export const contractorDocumentSchema = z.object({
  contractor_id: uuid,
  type_id: uuid,
  status: z.enum(["pending", "received", "rejected"]),
  valid_until: optDate,
  note: z.string().trim().max(500).optional().nullable(),
});

export const appointmentSchema = z
  .object({
    employee_id: uuid.or(z.literal("")).refine((v) => !!v, "Pilih karyawan"),
    role: z.enum(["pjo", "pja"], { message: "Pilih peran" }),
    scope: z.string().trim().min(2, "Lingkup wajib diisi").max(200),
    sk_number: z.string().trim().min(2, "Nomor SK wajib diisi").max(80),
    starts_on: reqDate,
    valid_until: reqDate,
  })
  .refine((v) => v.valid_until >= v.starts_on, { path: ["valid_until"], message: "Tidak boleh sebelum tanggal mulai" });
