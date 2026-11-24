// TSP & Aktivitas K3 (rancangan §4.5, spesifikasi docs/spec/fase-3-tsp-laporan.md).
// Aman client + server: label, zod, fungsi murni. Nilai DB = kode Inggris.
import { z } from "zod";
import type { FieldLabel } from "@/lib/person-types";
import type { StatusDef } from "@/lib/status";

export const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"] as const;
export const MONTHS_LONG = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"] as const;

// ---------------------------------------------------------------- status sel matriks (turunan, tidak disimpan)
export const CELL_STATES = ["future", "empty", "met", "partial", "missed"] as const;
export type CellState = (typeof CELL_STATES)[number];

/** Keadaan satu sel program x bulan. `future` = bulan belum berjalan (tidak bisa dicatat). */
export function cellState(plan: number, actual: number, future: boolean): CellState {
  if (future) return "future";
  if (plan === 0 && actual === 0) return "empty";
  if (actual > 0 && actual >= plan) return "met";
  if (actual > 0) return "partial";
  return "missed";
}
export const CELL_STATE_LABEL: Record<CellState, string> = {
  future: "Belum berjalan",
  empty: "Tanpa rencana",
  met: "Tercapai",
  partial: "Sebagian",
  missed: "Tidak tercapai",
};

/** Ringkasan satu program s.d. bulan `upTo` (1..12): rencana kumulatif, aktual terhitung (dibatasi rencana per bulan), total tahun. */
export function programProgress(plan: number[], actual: number[], upTo: number) {
  let planTd = 0;
  let doneTd = 0;
  let totalActual = 0;
  for (let m = 0; m < 12; m++) {
    totalActual += actual[m] ?? 0;
    if (m < upTo) {
      planTd += plan[m] ?? 0;
      doneTd += Math.min(actual[m] ?? 0, plan[m] ?? 0);
    }
  }
  const pct = planTd > 0 ? Math.round((doneTd * 100) / planTd) : null;
  return { planTd, doneTd, totalActual, pct, met: planTd > 0 && doneTd >= planTd, lagging: planTd > 0 && doneTd < planTd };
}

// ---------------------------------------------------------------- aktivitas K3
export const ACTIVITY_TYPES = [
  { value: "safety_talk", label: "Safety Talk" },
  { value: "sosialisasi_jsa", label: "Sosialisasi JSA" },
  { value: "sosialisasi_ik", label: "Sosialisasi IK" },
  { value: "sosialisasi_sop", label: "Sosialisasi SOP" },
  { value: "kampanye_k3", label: "Kampanye K3" },
  { value: "inspeksi_bersama", label: "Inspeksi Bersama" },
  { value: "lainnya", label: "Lainnya" },
] as const;
export const ACTIVITY_TYPE_LABEL: Record<string, string> = Object.fromEntries(ACTIVITY_TYPES.map((t) => [t.value, t.label]));

/** Kelengkapan bukti aktivitas (turunan dari evidence_count). */
export const ACTIVITY_EVIDENCE: Record<string, StatusDef> = {
  complete: { label: "Bukti Lengkap", color: "green" },
  missing: { label: "Kurang Bukti", color: "amber" },
};

// ---------------------------------------------------------------- evaluasi bulanan
export const EVALUATION_STATUS: Record<string, StatusDef> = {
  draft: { label: "Draft", color: "gray" },
  submitted: { label: "Menunggu Persetujuan PJO", color: "violet" },
  approved: { label: "Disetujui", color: "green" },
  returned: { label: "Dikembalikan", color: "amber" },
};

export type TspSummary = {
  year: number;
  month: number;
  achievement: number | null;
  programs_total: number;
  programs_met: number;
  evidence_pct: number | null;
  evidence_missing: number;
  lagging: { program_id: string; no: string; name: string; plan: number; actual: number; reason: string | null }[];
};

export const TSP_FIELD_LABELS: Record<string, FieldLabel> = {
  no: { label: "No" },
  element: { label: "Elemen" },
  name: { label: "Program" },
  owner_label: { label: "Penanggung jawab" },
  indicator: { label: "Indikator" },
  evidence_required: { label: "Bukti wajib" },
  annual_target: { label: "Target tahunan" },
  plan: { label: "Rencana per bulan" },
  is_active: { label: "Aktif", format: "boolean" },
  actual: { label: "Aktual" },
  note: { label: "Catatan" },
  evidence_count: { label: "Jumlah bukti" },
  status: { label: "Status", format: "status", statuses: EVALUATION_STATUS },
  decision_note: { label: "Catatan keputusan" },
};

// ---------------------------------------------------------------- zod
const uuid = z.string().uuid();

export const programSchema = z.object({
  location_id: uuid,
  company_code: z.string().max(16).optional().nullable(),
  year: z.coerce.number().int().min(2020).max(2100),
  no: z.string().trim().min(1, "Nomor wajib diisi").max(12, "Maksimal 12 karakter"),
  element: z.string().trim().min(1, "Elemen wajib diisi").max(80),
  name: z.string().trim().min(3, "Minimal 3 karakter").max(160),
  owner_label: z.string().trim().min(1, "Penanggung jawab wajib diisi").max(60),
  indicator: z.string().trim().min(1, "Indikator wajib diisi").max(300),
  evidence_required: z.string().trim().max(300).default(""),
  annual_target: z.coerce.number().int().min(1, "Minimal 1").max(366),
  plan: z.array(z.coerce.number().int().min(0).max(366)).length(12),
  is_active: z.boolean().default(true),
  sort_order: z.coerce.number().int().min(0).max(100000).default(0),
});
export type ProgramInput = z.input<typeof programSchema>;

export const realizationSchema = z.object({
  program_id: uuid,
  month: z.coerce.number().int().min(1).max(12),
  actual: z.coerce.number().int().min(0, "Tidak boleh negatif").max(366),
  note: z.string().trim().max(1000).optional().nullable(),
});

export const activitySchema = z.object({
  location_id: uuid,
  company_code: z.string().max(16).optional().nullable(),
  area_id: uuid.or(z.literal("")).refine((v) => !!v, "Lokasi wajib dipilih"),
  type_code: z.enum(ACTIVITY_TYPES.map((t) => t.value) as [string, ...string[]], { message: "Jenis wajib dipilih" }),
  activity_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal wajib diisi"),
  leader_id: uuid.or(z.literal("")).refine((v) => !!v, "Pelaksana wajib dipilih"),
  participant_count: z.coerce.number().int().min(0).max(100000).default(0),
  program_id: uuid.or(z.literal("")).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});
export type ActivityInput = z.input<typeof activitySchema>;
