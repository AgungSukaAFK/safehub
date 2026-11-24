// People & Compliance (rancangan §4.6): Manpower, Kompetensi/Sertifikat, MCU, Permit Site.
// Aman client + server: label, status, zod. Status masa berlaku = turunan (lib/expiry.ts), tidak disimpan.
import { z } from "zod";
import type { FieldLabel } from "@/lib/person-types";
import type { StatusDef } from "@/lib/status";

export const EMPLOYMENTS = ["PKWTT", "PKWT", "Harian", "Magang", "Mitra"] as const;
export const EMPLOYEE_STATUS: Record<string, StatusDef> = {
  active: { label: "Aktif", color: "green" },
  inactive: { label: "Nonaktif", color: "gray" },
};

export const MCU_RESULT: Record<string, StatusDef> = {
  fit: { label: "Fit", color: "green" },
  fit_note: { label: "Fit dengan Catatan", color: "amber" },
  unfit: { label: "Tidak Fit", color: "red" },
};
export const MCU_RESULT_OPTIONS = Object.entries(MCU_RESULT).map(([value, d]) => ({ value, label: d.label }));

/** Status sel matriks kompetensi (turunan dari competency_matrix). */
export const COMPETENCY_STATE: Record<string, StatusDef> = {
  valid: { label: "Berlaku", color: "green" },
  expiring: { label: "Akan Kedaluwarsa", color: "amber" },
  expired: { label: "Kedaluwarsa", color: "red" },
  missing: { label: "Belum Ada", color: "gray" },
  na: { label: "Tidak wajib", color: "gray" },
};

export const PEOPLE_FIELD_LABELS: Record<string, FieldLabel> = {
  code: { label: "NIK" },
  name: { label: "Nama" },
  job_title: { label: "Jabatan" },
  department: { label: "Section" },
  employment: { label: "Hubungan kerja" },
  join_date: { label: "Tanggal mulai", format: "date" },
  status: { label: "Status", format: "status", statuses: EMPLOYEE_STATUS },
  contractor_id: { label: "Mitra" },
  profile_id: { label: "Akun", format: "person" },
  number: { label: "Nomor" },
  issuer: { label: "Penerbit" },
  issued_on: { label: "Terbit", format: "date" },
  valid_until: { label: "Berlaku sampai", format: "date" },
  checked_on: { label: "Tanggal MCU", format: "date" },
  result: { label: "Hasil", format: "status", statuses: MCU_RESULT },
  required: { label: "Kebutuhan", format: "number" },
  job_titles: { label: "Wajib untuk jabatan", format: "list" },
  is_active: { label: "Aktif", format: "boolean" },
};

const uuid = z.string().uuid();
const optUuid = uuid.or(z.literal("")).optional().nullable();
const optDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid").or(z.literal("")).optional().nullable();
const reqDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal wajib diisi");

export const employeeSchema = z.object({
  location_id: uuid,
  company_code: z.string().max(16).optional().nullable(),
  code: z.string().trim().min(2, "NIK wajib diisi").max(30),
  name: z.string().trim().min(2, "Nama wajib diisi").max(120),
  job_title: z.string().trim().min(2, "Jabatan wajib diisi").max(80),
  department: z.string().trim().max(80).optional().nullable(),
  employment: z.enum(EMPLOYMENTS),
  join_date: optDate,
  status: z.enum(["active", "inactive"]).default("active"),
  contractor_id: optUuid,
  profile_id: optUuid,
});

export const requirementSchema = z.object({
  location_id: uuid,
  company_code: z.string().max(16).optional().nullable(),
  job_title: z.string().trim().min(2, "Jabatan wajib diisi").max(80),
  required: z.coerce.number().int().min(0, "0 sampai 1000").max(1000, "0 sampai 1000"),
});

export const competencySchema = z.object({
  code: z.string().regex(/^[a-z][a-z0-9_]{1,40}$/, "Huruf kecil, angka, garis bawah (mis. k3_umum)"),
  name: z.string().trim().min(2, "Nama wajib diisi").max(120),
  job_titles: z.array(z.string().trim().min(1).max(80)).max(50),
  is_active: z.boolean().default(true),
});

export const certificateSchema = z.object({
  employee_id: uuid,
  competency_id: uuid.or(z.literal("")).refine((v) => !!v, "Pilih kompetensi"),
  number: z.string().trim().max(80).optional().nullable(),
  issuer: z.string().trim().max(120).optional().nullable(),
  issued_on: optDate,
  valid_until: optDate,
});

export const mcuSchema = z.object({
  employee_id: uuid,
  checked_on: reqDate,
  valid_until: reqDate,
  result: z.enum(["fit", "fit_note", "unfit"], { message: "Hasil wajib dipilih" }),
  diagnosis: z.string().trim().max(2000).optional().nullable(),
  note: z.string().trim().max(2000).optional().nullable(),
});

export const permitSchema = z.object({
  employee_id: uuid,
  name: z.string().trim().min(2, "Nama permit wajib diisi").max(120),
  number: z.string().trim().max(80).optional().nullable(),
  valid_until: reqDate,
});
