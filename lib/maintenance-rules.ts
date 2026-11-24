// Maintenance (fase 5, HANYA BACA): label & status untuk data cermin dari sistem maintenance. Aman client + server.
import type { StatusDef } from "@/lib/status";

export const MNT_SOURCE = "Sistem maintenance (impor Excel)";

export const MNT_UNIT_STATUS: Record<string, StatusDef> = {
  active: { label: "Aktif", color: "green" },
  standby: { label: "Standby", color: "sky" },
  breakdown: { label: "Breakdown", color: "red" },
  retired: { label: "Dihentikan", color: "gray" },
};
export const MNT_PRIORITY: Record<string, StatusDef> = {
  high: { label: "Tinggi", color: "red" },
  medium: { label: "Sedang", color: "amber" },
  low: { label: "Rendah", color: "gray" },
};
export const MNT_BACKLOG_STATUS: Record<string, StatusDef> = {
  open: { label: "Open", color: "amber" },
  done: { label: "Selesai", color: "green" },
};
export const MNT_DOWNTIME_KIND: Record<string, StatusDef> = {
  breakdown: { label: "Breakdown", color: "red" },
  planned: { label: "Terencana", color: "blue" },
};

export const MNT_TABS = [
  { key: "ringkasan", label: "Ringkasan" },
  { key: "unit", label: "Unit" },
  { key: "downtime", label: "Downtime" },
  { key: "ps", label: "PS" },
  { key: "backlog", label: "Backlog" },
] as const;
export type MntTab = (typeof MNT_TABS)[number]["key"];

/** Kode KPI di Kamus KPI (draf, rumus belum disahkan). */
export const MNT_KPI_CODES = ["mnt_pa", "mnt_mtbf", "mnt_mttr", "mnt_ps_accuracy", "mnt_backlog_open"] as const;

export const MNT_TARGET_LABEL: Record<string, string> = { mnt_units: "Unit", mnt_downtime: "Downtime", mnt_ps: "PS", mnt_backlog: "Backlog" };
