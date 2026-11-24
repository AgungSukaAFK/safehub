// Pengaturan Pengingat (rancangan §4.12). Aman client + server: label jenis, contoh teks, zod.
import { z } from "zod";
import { FUNCTIONS } from "@/lib/functions";
import type { FieldLabel } from "@/lib/person-types";

export type ReminderKind = "pica_due" | "inspection_due" | "tsp_evaluation" | "mcu_expiry" | "certificate_expiry" | "permit_expiry" | "contractor_permit_expiry" | "document_review" | "ko_expiry";

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
  mcu_expiry: {
    label: "MCU akan berakhir",
    offsetLabel: "Hari sebelum MCU berakhir (0 = hari H)",
    assigneeLabel: "Karyawan yang bersangkutan (bila berakun)",
    preview: (d) => ({ title: `MCU Rudi Hartono ${expiryWhen(d)}`, body: "Jadwalkan MCU ulang sebelum berakhir." }),
  },
  certificate_expiry: {
    label: "Sertifikat kompetensi",
    offsetLabel: "Hari sebelum sertifikat berakhir (0 = hari H)",
    assigneeLabel: "Karyawan yang bersangkutan (bila berakun)",
    preview: (d) => ({ title: `Sertifikat BMC (Rudi Hartono) ${expiryWhen(d)}`, body: "Siapkan pelatihan atau perpanjangan sertifikat." }),
  },
  permit_expiry: {
    label: "Permit site",
    offsetLabel: "Hari sebelum permit berakhir (0 = hari H)",
    assigneeLabel: "Karyawan yang bersangkutan (bila berakun)",
    preview: (d) => ({ title: `Izin Masuk Site Rudi Hartono ${expiryWhen(d)}`, body: "Perpanjang permit site." }),
  },
  contractor_permit_expiry: {
    label: "Izin kontraktor",
    offsetLabel: "Hari sebelum izin berakhir (0 = hari H)",
    assigneeLabel: "Tidak ada penerima tunggal; pilih fungsi (bawaan: Pengelola Kontraktor)",
    preview: (d) => ({ title: `Izin SBU PT Sinar Teknik Mandiri ${expiryWhen(d)}`, body: "Minta mitra memperpanjang izin dan unggah buktinya." }),
  },
  document_review: {
    label: "Review dokumen",
    offsetLabel: "Hari sebelum jadwal review (0 = hari H)",
    assigneeLabel: "Pemilik dokumen",
    preview: (d) => ({ title: `Review dokumen SOP-HSE-001 jatuh tempo ${d === 0 ? "hari ini" : d === 1 ? "besok" : `${d} hari lagi`}`, body: "Pelaporan dan Investigasi Kejadian" }),
  },
  ko_expiry: {
    label: "Register KO",
    offsetLabel: "Hari sebelum item berakhir (0 = hari H)",
    assigneeLabel: "Penanggung jawab item KO",
    preview: (d) => ({ title: `KO-2026-0002 ${expiryWhen(d)}`, body: "Sertifikasi Layak Operasi Crane Workshop" }),
  },
};

function expiryWhen(d: number) {
  return d === 0 ? "berakhir hari ini" : d === 1 ? "berakhir besok" : `berakhir ${d} hari lagi`;
}

/** Jenis yang menyusul bersama modulnya; ditampilkan sebagai keterangan, belum bisa diatur. */
export const PLANNED_REMINDER_KINDS = ["Laporan periode belum diajukan"] as const;

export const REMINDER_ORDER: ReminderKind[] = ["pica_due", "inspection_due", "tsp_evaluation", "mcu_expiry", "certificate_expiry", "permit_expiry", "contractor_permit_expiry", "document_review", "ko_expiry"];

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
