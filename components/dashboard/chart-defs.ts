// Definisi grafik Beranda tanpa Recharts (aman diimpor tanpa menarik bundle grafik).
export type TrendPoint = { day: string; created: number; approved: number };
export type DeptPoint = { key: string; name: string; total: number; amount: number; clickable: boolean };

export const TREND_SERIES = [
  { key: "created", label: "Dibuat", color: "var(--color-viz-1)" },
  { key: "approved", label: "Disetujui", color: "var(--color-viz-2)" },
] as const;
