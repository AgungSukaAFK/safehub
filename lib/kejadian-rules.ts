// Kejadian & Investigasi (rancangan §4.1, spesifikasi docs/spec/fase-1-kejadian-pica.md). Aman
// client + server: label status/enum, zod form, fungsi murni. Nilai DB = kode Inggris.
import { z } from "zod";
import type { FieldLabel } from "@/lib/person-types";
import type { StatusDef } from "@/lib/status";

// ---------------------------------------------------------------- status & tahap (jenis B)
export const INCIDENT_STATUSES = ["reported", "classified", "investigating", "review_ehs", "review_mgmt", "actions", "closed"] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const INCIDENT_STATUS: Record<string, StatusDef> = {
  reported: { label: "Dilaporkan", color: "blue" },
  classified: { label: "Diklasifikasi", color: "sky" },
  investigating: { label: "Investigasi", color: "amber" },
  review_ehs: { label: "Review EHS", color: "violet" },
  review_mgmt: { label: "Review Manajemen", color: "violet" },
  actions: { label: "Tindakan & Verifikasi", color: "orange" },
  closed: { label: "Closed", color: "green" },
};

/** Label tahap di stepper (urutan = urutan status). */
export const INCIDENT_STAGE_LABELS: Record<IncidentStatus, string> = {
  reported: "Dilaporkan",
  classified: "Klasifikasi HSE",
  investigating: "Investigasi",
  review_ehs: "Review EHS",
  review_mgmt: "Review Manajemen",
  actions: "Tindakan & Verifikasi",
  closed: "Closed",
};

export const STATUS_OPTIONS = INCIDENT_STATUSES.map((s) => ({ value: s, label: INCIDENT_STATUS[s].label }));

/** Saved views daftar (param URL `tampilan`). */
export const INCIDENT_VIEWS = ["semua", "klasifikasi", "investigasi", "review", "closed"] as const;
export type IncidentView = (typeof INCIDENT_VIEWS)[number];
export const INCIDENT_VIEW_LABELS: Record<IncidentView, string> = {
  semua: "Semua",
  klasifikasi: "Perlu Klasifikasi",
  investigasi: "Investigasi",
  review: "Menunggu Review",
  closed: "Closed",
};
export const INCIDENT_VIEW_STATUSES: Record<IncidentView, IncidentStatus[] | null> = {
  semua: null,
  klasifikasi: ["reported"],
  investigasi: ["classified", "investigating"],
  review: ["review_ehs", "review_mgmt"],
  closed: ["closed"],
};

export const INCIDENT_SORTS = ["nomor", "kejadian", "lapor", "status"] as const;

// ---------------------------------------------------------------- enum form
export const INJURY_CLASSES = [
  { value: "none", label: "Tanpa cedera" },
  { value: "first_aid", label: "First Aid" },
  { value: "medical_treatment", label: "Medical Treatment" },
  { value: "restricted_work", label: "Restricted Work" },
  { value: "lost_time", label: "Lost Time Injury (LTI)" },
  { value: "fatality", label: "Fatality" },
] as const;
export const INJURY_CLASS_LABEL: Record<string, string> = Object.fromEntries(INJURY_CLASSES.map((c) => [c.value, c.label]));

export const PPE_ITEMS = [
  { value: "helmet", label: "Helm" },
  { value: "glasses", label: "Kacamata" },
  { value: "gloves", label: "Sarung tangan" },
  { value: "safety_shoes", label: "Sepatu safety" },
  { value: "ear_plug", label: "Ear plug" },
  { value: "vest", label: "Rompi reflektif" },
] as const;

export const TREATMENTS = [
  { value: "none", label: "Tidak perlu perawatan" },
  { value: "first_aid", label: "P3K" },
  { value: "clinic", label: "Klinik" },
  { value: "hospital", label: "Rumah sakit" },
  { value: "other", label: "Lainnya" },
] as const;
export const TREATMENT_LABEL: Record<string, string> = Object.fromEntries(TREATMENTS.map((t) => [t.value, t.label]));

/** Pengganti diagram tubuh (rancangan §4.1 catatan): pilihan bagian tubuh. */
export const BODY_PARTS = [
  "Kepala",
  "Mata",
  "Wajah",
  "Leher",
  "Bahu kanan",
  "Bahu kiri",
  "Lengan kanan",
  "Lengan kiri",
  "Tangan kanan",
  "Tangan kiri",
  "Jari tangan kanan",
  "Jari tangan kiri",
  "Dada",
  "Punggung",
  "Perut",
  "Pinggul",
  "Kaki kanan",
  "Kaki kiri",
  "Lutut kanan",
  "Lutut kiri",
  "Telapak kaki kanan",
  "Telapak kaki kiri",
] as const;

export const COMPANY_KINDS = [
  { value: "internal", label: "Karyawan perusahaan" },
  { value: "contractor", label: "Kontraktor" },
  { value: "visitor", label: "Visitor" },
] as const;
export const COMPANY_KIND_LABEL: Record<string, string> = Object.fromEntries(COMPANY_KINDS.map((c) => [c.value, c.label]));

export const EMPLOYMENTS = [
  { value: "permanent", label: "Karyawan Tetap" },
  { value: "contract", label: "Kontrak" },
  { value: "daily", label: "Harian" },
  { value: "visitor", label: "Visitor" },
] as const;
export const EMPLOYMENT_LABEL: Record<string, string> = Object.fromEntries(EMPLOYMENTS.map((e) => [e.value, e.label]));

export const CAUSE_GROUPS = [
  { key: "unsafe_act", label: "Tindakan Tidak Aman", level: "direct" },
  { key: "unsafe_condition", label: "Kondisi Tidak Aman", level: "direct" },
  { key: "job_factor", label: "Faktor Pekerjaan", level: "basic" },
  { key: "personal_factor", label: "Faktor Personal", level: "basic" },
] as const;
export type CauseKey = (typeof CAUSE_GROUPS)[number]["key"];
export const CAUSE_LEVEL_LABEL = { direct: "Penyebab Langsung", basic: "Penyebab Dasar" } as const;

/** Tab detail (param URL `tab`). */
export const INCIDENT_TABS = ["ringkasan", "klasifikasi", "investigasi", "penyebab", "tindakan", "review", "lampiran", "riwayat"] as const;
export type IncidentTab = (typeof INCIDENT_TABS)[number];

// ---------------------------------------------------------------- zod
const uuid = z.string().uuid();
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Maksimal ${max} karakter`)
    .optional()
    .nullable()
    .transform((v) => v || null);

export const personSchema = z.object({
  role: z.enum(["involved", "witness"]),
  name: z.string().trim().max(120, "Maksimal 120 karakter"),
  company_kind: z.enum(["internal", "contractor", "visitor"]).default("internal"),
  contractor_id: uuid.optional().nullable(),
  employment: z.enum(["permanent", "contract", "daily", "visitor"]).optional().nullable(),
  position: optText(100),
  contact: optText(40),
});
export type PersonValues = z.input<typeof personSchema> & { key: string };

export const reportSchema = z.object({
  company_code: z.string().max(16).optional().nullable(),
  location_id: uuid.or(z.literal("")).refine((v) => !!v, "Pilih site"),
  area_id: uuid.or(z.literal("")).refine((v) => !!v, "Lokasi kejadian wajib dipilih"),
  location_detail: optText(200),
  occurred_at: z
    .string()
    .min(1, "Tanggal kejadian wajib diisi")
    .refine((v) => !Number.isNaN(Date.parse(v)), "Tanggal kejadian tidak valid")
    .refine((v) => Date.parse(v) <= Date.now() + 5 * 60_000, "Tanggal kejadian tidak boleh melebihi waktu laporan"),
  category: z.string().min(1, "Kategori kejadian wajib dipilih"),
  unit_code: optText(40),
  unit_label: optText(120),
  description: z.string().trim().min(1, "Uraian kejadian wajib diisi").max(1000, "Maksimal 1000 karakter"),
  is_emergency: z.boolean().default(false),
  supervisor_id: uuid.optional().nullable(),
  persons: z.array(personSchema).max(60).default([]),
});
export type ReportValues = {
  company_code: string | null;
  location_id: string;
  area_id: string;
  location_detail: string;
  /** datetime-local (YYYY-MM-DDTHH:mm, WIB) */
  occurred_at: string;
  category: string;
  unit_code: string;
  unit_label: string;
  description: string;
  is_emergency: boolean;
  supervisor_id: string | null;
  workers: PersonValues[];
  witnesses: PersonValues[];
  declared: boolean;
};

export const classifySchema = z.object({
  category: z.string().min(1, "Kategori final wajib dipilih"),
  injury_class: z.enum(["none", "first_aid", "medical_treatment", "restricted_work", "lost_time", "fatality"], {
    errorMap: () => ({ message: "Kelas cedera wajib dipilih" }),
  }),
  severity: z.string().min(1, "Keparahan aktual wajib dipilih"),
  potential_severity: z.string().min(1, "Potensi keparahan wajib dipilih"),
  ppe: z.record(z.boolean()).default({}),
  damage_description: optText(1000),
  estimated_cost: z.number().min(0).max(1e15).nullable().optional(),
  restricted: z
    .object({
      injury_type: optText(200),
      body_parts: z.array(z.string().max(60)).max(30).default([]),
      treatment: z.enum(["none", "first_aid", "clinic", "hospital", "other"]).nullable().optional(),
      facility: optText(200),
      lost_days: z.number().int().min(0).max(3650).nullable().optional(),
      restricted_days: z.number().int().min(0).max(3650).nullable().optional(),
    })
    .optional(),
});
export type ClassifyValues = z.input<typeof classifySchema>;

export const teamSchema = z.object({
  lead_id: uuid.or(z.literal("")).refine((v) => !!v, "Ketua investigasi wajib dipilih"),
  member_ids: z.array(uuid).max(20).default([]),
});

const causeItem = z.object({ text: z.string().trim().max(300), note: z.string().trim().max(1000).default("") });
export const investigationSchema = z.object({
  timeline: z.array(z.object({ time: z.string().trim().max(20).default(""), event: z.string().trim().max(1000) })).max(100),
  reconstruction: optText(4000),
  causes: z.object({
    unsafe_act: z.array(causeItem).max(30).default([]),
    unsafe_condition: z.array(causeItem).max(30).default([]),
    job_factor: z.array(causeItem).max(30).default([]),
    personal_factor: z.array(causeItem).max(30).default([]),
  }),
  recommendations: z.array(z.object({ text: z.string().trim().max(500) })).max(50),
});
export type InvestigationValues = z.input<typeof investigationSchema>;

// ---------------------------------------------------------------- fungsi murni
/** Umur kejadian dalam hari (berhenti saat ditutup). */
export function incidentAgeDays(reportedAt: string, closedAt: string | null, now: Date): number {
  const end = closedAt ? new Date(closedAt) : now;
  return Math.max(0, Math.floor((end.getTime() - new Date(reportedAt).getTime()) / 86_400_000));
}

/** Nilai `datetime-local` (WIB) → ISO dengan offset +07:00. */
export function wibLocalToIso(v: string): string {
  return v ? `${v.length === 16 ? `${v}:00` : v}+07:00` : "";
}

/** Waktu sekarang dalam format `datetime-local` WIB (YYYY-MM-DDTHH:mm). */
export function nowWibLocal(now: Date = new Date()): string {
  const wib = new Date(now.getTime() + 7 * 3_600_000);
  return wib.toISOString().slice(0, 16);
}

export const newPerson = (role: "involved" | "witness"): PersonValues => ({
  key: crypto.randomUUID(),
  role,
  name: "",
  company_kind: "internal",
  contractor_id: null,
  employment: role === "involved" ? "permanent" : null,
  position: "",
  contact: "",
});

/** Label kolom Riwayat Aktivitas kejadian. */
export const INCIDENT_FIELD_LABELS: Record<string, FieldLabel> = {
  status: { label: "Status", format: "status", statuses: INCIDENT_STATUS },
  code: { label: "Nomor" },
  category: { label: "Kategori final" },
  reported_category: { label: "Kategori pelapor" },
  injury_class: { label: "Kelas cedera" },
  severity: { label: "Keparahan aktual" },
  potential_severity: { label: "Potensi keparahan" },
  description: { label: "Uraian" },
  occurred_at: { label: "Waktu kejadian", format: "datetime" },
  area_id: { label: "Lokasi" },
  location_detail: { label: "Detail lokasi" },
  unit_code: { label: "Kode unit" },
  unit_label: { label: "Unit" },
  is_emergency: { label: "Darurat", format: "boolean" },
  supervisor_id: { label: "Atasan langsung", format: "person" },
  lead_investigator_id: { label: "Ketua investigasi", format: "person" },
  damage_description: { label: "Deskripsi kerusakan" },
  return_note: { label: "Catatan dikembalikan" },
  closed_at: { label: "Ditutup", format: "datetime" },
  close_note: { label: "Alasan penutupan" },
  closed_exception: { label: "Pengecualian", format: "boolean" },
  classified_by: { label: "Diklasifikasi oleh", format: "person" },
  classified_at: { label: "Waktu klasifikasi", format: "datetime" },
  tim: { label: "Tim investigasi" },
  investigasi: { label: "Investigasi" },
  data_terbatas: { label: "Data cedera" },
  ppe: { label: "APD" },
};
