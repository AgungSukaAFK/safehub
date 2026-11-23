// Kamus KPI (rancangan §2.8, §4.13). Aman client + server.
import { z } from "zod";
import type { FieldLabel } from "@/lib/person-types";
import type { StatusDef } from "@/lib/status";

export const KPI_DIRECTIONS = [
  { value: "lower_better", label: "Makin rendah makin baik" },
  { value: "higher_better", label: "Makin tinggi makin baik" },
  { value: "neutral", label: "Netral (informasi)" },
] as const;
export const KPI_DIRECTION_LABEL: Record<string, string> = Object.fromEntries(KPI_DIRECTIONS.map((d) => [d.value, d.label]));

/** Status KPI: label "Rumus belum disahkan" datang dari data (kpi_definitions.status), bukan hardcode kartu. */
export const KPI_STATUS_MAP: Record<string, StatusDef> = {
  draft: { label: "Rumus belum disahkan", color: "gray" },
  approved: { label: "Disahkan", color: "green" },
};

export const kpiSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi").max(120),
  definition: z.string().trim().min(1, "Definisi wajib diisi").max(1000),
  formula: z.string().trim().min(1, "Rumus wajib diisi").max(500),
  rule_text: z.string().trim().max(2000).optional().nullable(),
  example: z.string().trim().max(1000).optional().nullable(),
  source: z.string().trim().max(300).optional().nullable(),
  owner: z.string().trim().max(120).optional().nullable(),
  unit: z.string().trim().max(40).optional().nullable(),
  direction: z.enum(["lower_better", "higher_better", "neutral"]),
  warn_gte: z.number().nullable().optional(),
  danger_gte: z.number().nullable().optional(),
});
export type KpiInput = z.input<typeof kpiSchema>;

export type KpiThresholds = { warn_gte?: number | null; danger_gte?: number | null };

/** Nada kartu KPI dari ambang (null = netral). Arah "lebih baik" dipakai untuk label, bukan warna. */
export function kpiTone(value: number | null | undefined, t: KpiThresholds | null | undefined): "danger" | "warning" | "ok" | "neutral" {
  if (value === null || value === undefined || !t) return "neutral";
  if (t.danger_gte !== null && t.danger_gte !== undefined && value >= t.danger_gte) return "danger";
  if (t.warn_gte !== null && t.warn_gte !== undefined && value >= t.warn_gte) return "warning";
  return t.warn_gte !== undefined || t.danger_gte !== undefined ? "ok" : "neutral";
}

export const KPI_FIELD_LABELS: Record<string, FieldLabel> = {
  name: { label: "Nama" },
  definition: { label: "Definisi" },
  formula: { label: "Rumus" },
  rule_text: { label: "Aturan perhitungan" },
  example: { label: "Contoh" },
  source: { label: "Sumber" },
  owner: { label: "Pemilik" },
  unit: { label: "Satuan" },
  direction: { label: "Arah" },
  thresholds: { label: "Ambang" },
  status: { label: "Status", format: "status", statuses: KPI_STATUS_MAP },
  version: { label: "Versi", format: "number" },
  approval_note: { label: "Catatan pengesahan" },
  approved_at: { label: "Disahkan", format: "datetime" },
};
