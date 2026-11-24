// Pengaturan Pengingat (rancangan §4.12). Aman client + server: label jenis, contoh teks, zod.
import { z } from "zod";
import { FUNCTIONS } from "@/lib/functions";
import type { FieldLabel } from "@/lib/person-types";

export type ReminderKind = "pica_due" | "inspection_due" | "tsp_evaluation";

export const REMINDER_KINDS: Record<ReminderKind, { label: string; offsetLabel: string; assigneeLabel: string; preview: (days: number) => { title: string; body: string } }> = {
  pica_due: {
    label: "Tindakan PICA",
    offsetLabel: "Hari sebelum jatuh tempo (0 = hari H)",
    assigneeLabel: "PIC tindakan",
    preview: (d) => ({
      title: `Tindakan PCA-2026-0012 ${d === 0 ? "jatuh tempo hari ini" : d === 1 ? "jatuh tempo besok" : `jatuh tempo ${d} hari lagi`}`,
      body: "Perbaiki sambungan kabel panel workshop",
    }),
  },
  inspection_due: {
    label: "Inspeksi terjadwal",
    offsetLabel: "Hari sebelum jadwal (0 = hari H)",
    assigneeLabel: "Pemeriksa",
    preview: (d) => ({
      title: `Inspeksi INS-2026-0231 ${d === 0 ? "dijadwalkan hari ini" : d === 1 ? "dijadwalkan besok" : `dijadwalkan ${d} hari lagi`}`,
      body: "Inspeksi Kotak P3K & APAR · APAR #07",
    }),
  },
  tsp_evaluation: {
    label: "Evaluasi TSP bulanan",
    offsetLabel: "Hari setelah akhir bulan",
    assigneeLabel: "Penyusun (tidak ada penerima tunggal; pilih fungsi)",
    preview: () => ({ title: "Evaluasi TSP 10/2026 belum diajukan", body: "Susun dan ajukan evaluasi bulanan ke PJO." }),
  },
};

/** Jenis yang menyusul bersama modulnya (fase 4-5); ditampilkan sebagai keterangan, belum bisa diatur. */
export const PLANNED_REMINDER_KINDS = ["MCU", "Sertifikat kompetensi", "Izin kontraktor", "Review dokumen", "Laporan periode"] as const;

export const REMINDER_FIELD_LABELS: Record<string, FieldLabel> = {
  offsets: { label: "Hari", format: "list" },
  notify_assignee: { label: "Kirim ke penanggung jawab", format: "boolean" },
  notify_functions: { label: "Fungsi penerima", format: "list" },
  is_active: { label: "Aktif", format: "boolean" },
};

export const reminderRuleSchema = z.object({
  offsets: z.array(z.coerce.number().int().min(0, "0 sampai 60").max(60, "0 sampai 60")).min(1, "Isi minimal satu angka").max(8, "Maksimal 8 angka"),
  notify_assignee: z.boolean(),
  notify_functions: z.array(z.enum(FUNCTIONS)).max(12),
  is_active: z.boolean(),
});
export type ReminderRuleInput = z.input<typeof reminderRuleSchema>;

/** "7, 3, 1, 0" → [7,3,1,0]; null bila ada token bukan angka. */
export function parseOffsets(text: string): number[] | null {
  const parts = text.split(/[,\s]+/).filter(Boolean);
  if (parts.length === 0) return [];
  const nums = parts.map((p) => (/^\d{1,2}$/.test(p) ? Number(p) : NaN));
  return nums.some(Number.isNaN) ? null : nums;
}
