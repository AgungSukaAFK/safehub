// Aturan Feedback (aman client + server): kategori, status, kolom list.
import type { StatusDef } from "@/lib/status";

export const FEEDBACK_CATEGORIES = [
  { value: "bug", label: "Laporan Bug" },
  { value: "fitur", label: "Saran Fitur" },
  { value: "tampilan", label: "Masalah Tampilan" },
  { value: "performa", label: "Performa Lambat" },
  { value: "pertanyaan", label: "Pertanyaan Umum" },
  { value: "lainnya", label: "Lainnya" },
] as const;
export const FEEDBACK_CATEGORY_VALUES = FEEDBACK_CATEGORIES.map((c) => c.value);
export const feedbackCategoryLabel = (v: string, other?: string | null) =>
  v === "lainnya" && other ? `Lainnya: ${other}` : (FEEDBACK_CATEGORIES.find((c) => c.value === v)?.label ?? v);

export const FEEDBACK_STATUSES = ["baru", "diproses", "selesai"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];
export const FEEDBACK_STATUS: Record<string, StatusDef> = {
  baru: { label: "Baru", color: "blue" },
  diproses: { label: "Diproses", color: "amber" },
  selesai: { label: "Selesai", color: "emerald" },
};

export const FEEDBACK_SORTS = ["tanggal", "status"] as const;
export const MAX_FEEDBACK_FILES = 5;
