// Audit Trail (rancangan §4.13). Aman client + server: label entitas, tautan ke record, ringkasan perubahan.
export const AUDIT_ENTITIES: Record<string, { label: string; href?: (id: string) => string }> = {
  incidents: { label: "Kejadian", href: (id) => `/kejadian/${id}` },
  findings: { label: "Temuan", href: (id) => `/temuan/${id}` },
  pica_actions: { label: "Tindakan PICA" },
  inspections: { label: "Inspeksi", href: (id) => `/inspeksi/${id}` },
  observations: { label: "Observasi", href: (id) => `/observasi/${id}` },
  inspection_templates: { label: "Template inspeksi", href: (id) => `/inspeksi/template/${id}` },
  work_hours: { label: "Jam kerja", href: () => "/kpi/jam-kerja" },
  kpi_definitions: { label: "Kamus KPI" },
  tsp_programs: { label: "Program TSP", href: () => "/tsp" },
  tsp_realizations: { label: "Realisasi TSP", href: () => "/tsp" },
  safety_activities: { label: "Aktivitas K3", href: () => "/tsp" },
  tsp_evaluations: { label: "Evaluasi TSP", href: () => "/tsp" },
  employees: { label: "Karyawan", href: (id) => `/manpower/${id}` },
  competencies: { label: "Kompetensi", href: () => "/kompetensi" },
  certificates: { label: "Sertifikat", href: () => "/kompetensi" },
  mcu_records: { label: "MCU", href: () => "/mcu" },
  site_permits: { label: "Permit site", href: () => "/manpower" },
  position_requirements: { label: "Kebutuhan manpower", href: () => "/manpower" },
  reports: { label: "Laporan Periode", href: (id) => `/laporan/${id}` },
  reminder_rules: { label: "Aturan pengingat", href: () => "/pengingat" },
  members: { label: "Pengguna", href: (id) => `/pengguna/${id}` },
  areas: { label: "Area", href: () => "/master" },
  master_items: { label: "Master data", href: () => "/master" },
  contractors: { label: "Mitra", href: () => "/master" },
  approval_templates: { label: "Template approval", href: () => "/approval/template" },
  department_heads: { label: "Kepala departemen", href: () => "/approval/kepala-departemen" },
  pengajuan: { label: "Pengajuan (contoh)", href: (id) => `/pengajuan/${id}` },
};
export const AUDIT_ENTITY_OPTIONS = Object.entries(AUDIT_ENTITIES).map(([value, v]) => ({ value, label: v.label }));

export const AUDIT_PAGE_SIZE = 50;

/** Ringkasan kolom yang berubah: {kolom: {old,new}} → "kolom, kolom"; salinan/dokumen lain = jumlah kolom. */
export function summarizeChanges(changes: unknown): string {
  if (!changes || typeof changes !== "object") return "";
  const keys = Object.keys(changes as Record<string, unknown>).filter((k) => k !== "id");
  if (keys.length === 0) return "";
  const shown = keys.slice(0, 4).map((k) => k.replace(/_/g, " "));
  return shown.join(", ") + (keys.length > 4 ? ` +${keys.length - 4}` : "");
}
