// Laporan Periode (rancangan §4.10, spesifikasi docs/spec/fase-3-tsp-laporan.md bagian 4).
// Aman client + server: status, bentuk data laporan (hasil RPC report_data/snapshot), zod, fungsi murni.
import { z } from "zod";
import type { FieldLabel } from "@/lib/person-types";
import type { StatusDef } from "@/lib/status";
import type { TspSummary } from "@/lib/tsp-rules";

export const REPORT_STATUS: Record<string, StatusDef> = {
  draft: { label: "Draft", color: "gray" },
  pending_approval: { label: "Menunggu Persetujuan", color: "violet" },
  rejected: { label: "Dikembalikan", color: "amber" },
  published: { label: "Terbit", color: "gray" },
};
export const REPORT_STATUS_ORDER = ["draft", "pending_approval", "rejected", "published"] as const;

export type ReportSource = "narrative" | "kpi" | "incidents" | "findings" | "inspections" | "tsp" | "unavailable";
export type ReportSection = { key: string; title: string; source: ReportSource; narrative: string | null };

export type ReportData = {
  report: { id: string; code: string; period: string; template: string; template_name: string; revision: string };
  sections: ReportSection[];
  kpi: { fatality: number; lti: number; near_miss: number; property_damage: number; lost_days: number; hours: number | null; hours_months: number | null; ltifr: number | null; ltisr: number | null };
  incidents: { total: number; unclassified: number; rows: { id: string; code: string; date: string; category: string | null; status: string }[] };
  findings: { opened: number; closed: number; open_end: number; overdue_now: number; actions_closed: number; actions_waiting: number };
  inspections: { type_code: string; plan: number; actual: number }[];
  tsp: TspSummary;
};

export type Completeness = { key: string; label: string; ok: boolean; required: boolean; detail: string | null; href: string | null };

/** Kelengkapan: persen item yang terpenuhi + kekurangan wajib. */
export function completenessSummary(items: Completeness[]) {
  const ok = items.filter((i) => i.ok).length;
  return { pct: items.length ? Math.round((ok * 100) / items.length) : 0, missingRequired: items.filter((i) => i.required && !i.ok), missing: items.filter((i) => !i.ok) };
}

export const REPORT_FIELD_LABELS: Record<string, FieldLabel> = {
  status: { label: "Status", format: "status", statuses: REPORT_STATUS },
  narratives: { label: "Narasi" },
  submit_note: { label: "Alasan mengajukan dengan kekurangan" },
  current_version: { label: "Versi terbit" },
  correction_reason: { label: "Alasan koreksi" },
  period: { label: "Periode", format: "date" },
};

const uuid = z.string().uuid();
export const createReportSchema = z.object({
  template_id: uuid.or(z.literal("")).refine((v) => !!v, "Pilih template"),
  location_id: uuid,
  company_code: z.string().max(16).optional().nullable(),
  period: z.string().regex(/^\d{4}-\d{2}$/, "Periode wajib diisi"),
});
export const narrativesSchema = z.record(z.string().regex(/^[a-z][a-z0-9_]{1,30}$/), z.string().max(4000, "Maksimal 4000 karakter"));
