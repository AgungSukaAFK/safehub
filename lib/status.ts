// SATU-SATUNYA map warna status (frontend-guide §5.7). Halaman tidak boleh membuat map sendiri.
// Label status per domain ada di lib/<domain>-rules.ts; nilai DB tetap kode Inggris.

export type StatusColor = "gray" | "blue" | "sky" | "amber" | "orange" | "green" | "emerald" | "red" | "violet";
export type StatusTone = "solid" | "soft";

/** soft: kolom tabel, chip, riwayat. solid: status dokumen di header detail. */
export const STATUS_CLASSES: Record<StatusColor, Record<StatusTone, string>> = {
  gray: {
    soft: "bg-muted text-muted-foreground border-border",
    solid: "bg-zinc-600 text-white border-transparent dark:bg-zinc-500",
  },
  blue: {
    soft: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900",
    solid: "bg-blue-600 text-white border-transparent dark:bg-blue-500",
  },
  sky: {
    soft: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-900",
    solid: "bg-sky-600 text-white border-transparent dark:bg-sky-500",
  },
  amber: {
    soft: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900",
    solid: "bg-amber-500 text-amber-950 border-transparent",
  },
  orange: {
    soft: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-900",
    solid: "bg-orange-600 text-white border-transparent dark:bg-orange-500",
  },
  green: {
    soft: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-300 dark:border-green-900",
    solid: "bg-green-600 text-white border-transparent dark:bg-green-600",
  },
  emerald: {
    soft: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900",
    solid: "bg-emerald-600 text-white border-transparent dark:bg-emerald-600",
  },
  red: {
    soft: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900",
    solid: "bg-red-600 text-white border-transparent dark:bg-red-600",
  },
  violet: {
    soft: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-900",
    solid: "bg-violet-600 text-white border-transparent dark:bg-violet-500",
  },
};

export type StatusDef = { label: string; color: StatusColor };

/** Status dokumen standar approval engine (backend-guide §3.1). */
export const DOCUMENT_STATUS: Record<string, StatusDef> = {
  draft: { label: "Draft", color: "gray" },
  pending_approval: { label: "Menunggu Approval", color: "amber" },
  approved: { label: "Disetujui", color: "green" },
  rejected: { label: "Ditolak", color: "red" },
  cancelled: { label: "Dibatalkan", color: "gray" },
  completed: { label: "Selesai", color: "emerald" },
};

/** Status langkah approval */
export const APPROVAL_STEP_STATUS: Record<string, StatusDef> = {
  pending: { label: "Menunggu", color: "amber" },
  approved: { label: "Disetujui", color: "green" },
  rejected: { label: "Ditolak", color: "red" },
  skipped: { label: "Dilewati", color: "gray" },
};

export const APPROVAL_TYPE_LABELS: Record<string, string> = {
  mengetahui: "Mengetahui",
  memeriksa: "Memeriksa",
  menyetujui: "Menyetujui",
};

/** Label aksi log (Riwayat Aktivitas) — pasangan action_label() di DB */
export const ACTION_LABELS: Record<string, string> = {
  create: "Dibuat",
  update: "Diubah",
  delete: "Dihapus",
  submit: "Diajukan",
  approve: "Disetujui",
  reject: "Ditolak",
  cancel: "Ditarik",
  followup: "Follow-up",
  override: "Approval Diubah Admin",
  admin_edit: "Diedit Admin",
};

export const ACTION_COLORS: Record<string, StatusColor> = {
  create: "blue",
  update: "sky",
  delete: "red",
  submit: "amber",
  approve: "green",
  reject: "red",
  cancel: "gray",
  followup: "orange",
  override: "violet",
  admin_edit: "violet",
};

export function resolveStatus(map: Record<string, StatusDef>, value: string | null | undefined): StatusDef {
  if (!value) return { label: "-", color: "gray" };
  return map[value] ?? { label: value, color: "gray" };
}
