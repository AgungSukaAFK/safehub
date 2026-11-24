// Pelatihan (rancangan §4.6, spesifikasi fase 4 bagian B). Aman client + server: label, status, zod.
import { z } from "zod";
import type { FieldLabel } from "@/lib/person-types";
import type { StatusDef } from "@/lib/status";

export const TRAINING_STATUS: Record<string, StatusDef> = {
  planned: { label: "Direncanakan", color: "blue" },
  done: { label: "Selesai", color: "green" },
  cancelled: { label: "Dibatalkan", color: "gray" },
};
export const TRAINING_STATUS_FILTERS = ["semua", "planned", "done", "cancelled"] as const;

export const ATTENDANCE: Record<string, StatusDef> = {
  registered: { label: "Terdaftar", color: "gray" },
  present: { label: "Hadir", color: "green" },
  absent: { label: "Tidak Hadir", color: "red" },
};

export const TRAINING_FIELD_LABELS: Record<string, FieldLabel> = {
  code: { label: "Nomor" },
  title: { label: "Judul" },
  competency_id: { label: "Kompetensi" },
  provider: { label: "Penyelenggara" },
  venue: { label: "Tempat" },
  starts_on: { label: "Mulai", format: "date" },
  ends_on: { label: "Selesai", format: "date" },
  capacity: { label: "Kapasitas", format: "number" },
  status: { label: "Status", format: "status", statuses: TRAINING_STATUS },
  notes: { label: "Catatan" },
  evidence_count: { label: "Jumlah bukti", format: "number" },
};

const uuid = z.string().uuid();
const reqDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal wajib diisi");

export const trainingSchema = z
  .object({
    location_id: uuid,
    company_code: z.string().max(16).optional().nullable(),
    title: z.string().trim().min(3, "Judul wajib diisi").max(160),
    competency_id: uuid.or(z.literal("")).optional().nullable(),
    provider: z.string().trim().max(120).optional().nullable(),
    venue: z.string().trim().max(120).optional().nullable(),
    starts_on: reqDate,
    ends_on: reqDate,
    capacity: z.union([z.literal(""), z.coerce.number().int().min(1, "Minimal 1").max(1000)]).optional().nullable(),
    notes: z.string().trim().max(2000).optional().nullable(),
  })
  .refine((v) => v.ends_on >= v.starts_on, { path: ["ends_on"], message: "Tidak boleh sebelum tanggal mulai" });
