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
  { key: "lib", label: "Readiness LIB" },
  { key: "scrap", label: "Metal Scrap" },
  { key: "mr", label: "Material Request" },
] as const;
export type MntTab = (typeof MNT_TABS)[number]["key"];

/** Kode KPI di Kamus KPI (draf, rumus belum disahkan). */
export const MNT_KPI_CODES = ["mnt_pa", "mnt_mtbf", "mnt_mttr", "mnt_ps_accuracy", "mnt_backlog_open"] as const;

export const MNT_TARGET_LABEL: Record<string, string> = { mnt_units: "Unit", mnt_downtime: "Downtime", mnt_ps: "PS", mnt_backlog: "Backlog", mnt_lib: "Readiness LIB", mnt_scrap: "Metal Scrap" };

/** Part non-moving = stok > 0 dan tidak bergerak lebih dari N hari (cermin mnt_extra di DB). */
export const MNT_NON_MOVING_DAYS = 180;
/** Status baris LIB (turunan, tidak disimpan): cermin aturan di mnt_extra. */
export type LibState = "non_moving" | "below_min" | "ok";
export function libState(r: { qty: number; minQty: number; lastMovedOn: string | null }, today: string): LibState {
  if (r.qty > 0) {
    const idle = r.lastMovedOn === null ? Infinity : (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${r.lastMovedOn}T00:00:00Z`)) / 86_400_000;
    if (idle > MNT_NON_MOVING_DAYS) return "non_moving";
  }
  return r.minQty > 0 && r.qty < r.minQty ? "below_min" : "ok";
}
export const LIB_STATE: Record<LibState, StatusDef> = {
  non_moving: { label: "Non-moving", color: "amber" },
  below_min: { label: "Di bawah minimum", color: "red" },
  ok: { label: "Siap", color: "green" },
};
