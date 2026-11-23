// Master Data (rancangan §4.13): SATU konfigurasi per jenis master → halaman /master generik.
// Aman client + server (data murni + zod). Jenis yang dikelola sistem asal (site, jabatan, unit)
// hanya ditampilkan (editable: false).
import { z } from "zod";
import type { StatusColor } from "@/lib/status";

export const MASTER_KINDS = ["area", "kategori-kejadian", "kategori-temuan", "tingkat-risiko", "mitra", "site", "jabatan"] as const;
export type MasterKind = (typeof MASTER_KINDS)[number];
export type EditableKind = Exclude<MasterKind, "site" | "jabatan">;

export function isMasterKind(v: unknown): v is MasterKind {
  return typeof v === "string" && (MASTER_KINDS as readonly string[]).includes(v);
}
export function isEditableKind(v: unknown): v is EditableKind {
  return isMasterKind(v) && v !== "site" && v !== "jabatan";
}

export type MasterFieldType = "text" | "textarea" | "number" | "select" | "code";
export type MasterField = {
  name: string;
  label: string;
  type: MasterFieldType;
  required?: boolean;
  hint?: string;
  /** opsi statis; opsi dinamis (site, perusahaan) dikirim server lewat `optionsFrom` */
  options?: { value: string; label: string }[];
  optionsFrom?: "sites" | "companies";
  /** hanya bisa diisi saat membuat (kode dipakai logika, rancangan §2.8) */
  createOnly?: boolean;
  maxLength?: number;
};

export type MasterKindConfig = {
  label: string;
  description: string;
  editable: boolean;
  /** catatan sumber untuk master read-only */
  sourceNote?: string;
  /** label kolom tampilan (selain Nama & Status) */
  columns: { key: string; label: string; optionsFrom?: "sites" | "companies"; options?: { value: string; label: string }[] }[];
  fields: MasterField[];
};

export const RISK_COLORS: { value: StatusColor; label: string }[] = [
  { value: "green", label: "Hijau" },
  { value: "amber", label: "Kuning" },
  { value: "orange", label: "Oranye" },
  { value: "red", label: "Merah" },
  { value: "blue", label: "Biru" },
  { value: "gray", label: "Abu-abu" },
];

export const CONTRACTOR_KINDS = [
  { value: "subkontraktor", label: "Subkontraktor" },
  { value: "vendor", label: "Vendor" },
];

const SORT_FIELD: MasterField = { name: "sort_order", label: "Urutan", type: "number", hint: "Angka kecil tampil lebih dulu." };
const CODE_FIELD: MasterField = {
  name: "code",
  label: "Kode",
  type: "code",
  required: true,
  createOnly: true,
  maxLength: 41,
  hint: "Huruf kecil, angka, garis bawah. Tidak bisa diubah setelah disimpan.",
};

export const MASTER_CONFIG: Record<MasterKind, MasterKindConfig> = {
  area: {
    label: "Area",
    description: "Area di dalam site (Workshop, Pit, Hauling Road). Dipakai sebagai lokasi kejadian, temuan, dan inspeksi.",
    editable: true,
    columns: [
      { key: "location_id", label: "Site", optionsFrom: "sites" },
      { key: "sort_order", label: "Urutan" },
    ],
    fields: [
      { name: "location_id", label: "Site", type: "select", required: true, optionsFrom: "sites" },
      { name: "name", label: "Nama area", type: "text", required: true, maxLength: 100 },
      SORT_FIELD,
    ],
  },
  "kategori-kejadian": {
    label: "Kategori Kejadian",
    description: "Pilihan kategori di form Lapor Kejadian. Kode dipakai perhitungan KPI, jadi tidak bisa diubah.",
    editable: true,
    columns: [
      { key: "code", label: "Kode" },
      { key: "sort_order", label: "Urutan" },
    ],
    fields: [
      CODE_FIELD,
      { name: "name", label: "Nama", type: "text", required: true, maxLength: 100 },
      { name: "description", label: "Keterangan", type: "textarea", maxLength: 500 },
      SORT_FIELD,
    ],
  },
  "kategori-temuan": {
    label: "Kategori Temuan",
    description: "Pilihan kategori di form Temuan. Kode dipakai laporan, jadi tidak bisa diubah.",
    editable: true,
    columns: [
      { key: "code", label: "Kode" },
      { key: "sort_order", label: "Urutan" },
    ],
    fields: [
      CODE_FIELD,
      { name: "name", label: "Nama", type: "text", required: true, maxLength: 100 },
      { name: "description", label: "Keterangan", type: "textarea", maxLength: 500 },
      SORT_FIELD,
    ],
  },
  "tingkat-risiko": {
    label: "Tingkat Risiko",
    description: "Tingkat risiko temuan dan kejadian, dengan warna badge.",
    editable: true,
    columns: [
      { key: "code", label: "Kode" },
      { key: "color", label: "Warna", options: RISK_COLORS },
      { key: "sort_order", label: "Urutan" },
    ],
    fields: [
      CODE_FIELD,
      { name: "name", label: "Nama", type: "text", required: true, maxLength: 100 },
      { name: "color", label: "Warna badge", type: "select", required: true, options: RISK_COLORS },
      { name: "description", label: "Keterangan", type: "textarea", maxLength: 500 },
      SORT_FIELD,
    ],
  },
  mitra: {
    label: "Perusahaan Mitra",
    description: "Subkontraktor dan vendor. Legalitas, izin, dan CSMS dikelola di modul Kontraktor.",
    editable: true,
    columns: [
      { key: "company_code", label: "Perusahaan", optionsFrom: "companies" },
      { key: "kind", label: "Jenis", options: CONTRACTOR_KINDS },
    ],
    fields: [
      { name: "company_code", label: "Mitra dari perusahaan", type: "select", required: true, optionsFrom: "companies" },
      { name: "name", label: "Nama mitra", type: "text", required: true, maxLength: 200 },
      { name: "kind", label: "Jenis", type: "select", required: true, options: CONTRACTOR_KINDS },
    ],
  },
  site: {
    label: "Site",
    description: "Site operasional. Daftar ini milik master DB Lourdes (public.locations).",
    editable: false,
    sourceNote: "Penambahan atau perubahan site dilakukan tim IT di konsol platform.",
    columns: [],
    fields: [],
  },
  jabatan: {
    label: "Jabatan",
    description: "Jabatan karyawan dari direktori platform (public.job_titles).",
    editable: false,
    sourceNote: "Jabatan dikelola tim IT di konsol platform.",
    columns: [],
    fields: [],
  },
};

// ---------------------------------------------------------------- validasi simpan

const name = (max: number) => z.string().trim().min(2, "Minimal 2 karakter").max(max, `Maksimal ${max} karakter`);
const sortOrder = z.coerce.number({ invalid_type_error: "Isi angka" }).int("Bilangan bulat").min(-9999).max(9999).default(0);
const description = z
  .string()
  .trim()
  .max(500, "Maksimal 500 karakter")
  .optional()
  .nullable()
  .transform((v) => v || null);
const code = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9_]{1,40}$/, "Huruf kecil/angka/garis bawah, diawali huruf, 2-41 karakter");
const isActive = z.boolean().default(true);

export const MASTER_SCHEMAS = {
  area: z.object({ location_id: z.string().uuid("Pilih site"), name: name(100), sort_order: sortOrder, is_active: isActive }),
  "kategori-kejadian": z.object({ code, name: z.string().trim().min(1, "Wajib diisi").max(100), description, sort_order: sortOrder, is_active: isActive }),
  "kategori-temuan": z.object({ code, name: z.string().trim().min(1, "Wajib diisi").max(100), description, sort_order: sortOrder, is_active: isActive }),
  "tingkat-risiko": z.object({
    code,
    name: z.string().trim().min(1, "Wajib diisi").max(100),
    color: z.enum(["green", "amber", "orange", "red", "blue", "gray"], { errorMap: () => ({ message: "Pilih warna" }) }),
    description,
    sort_order: sortOrder,
    is_active: isActive,
  }),
  mitra: z.object({
    company_code: z.string().regex(/^[A-Z][A-Z0-9_]{1,15}$/, "Pilih perusahaan"),
    name: name(200),
    kind: z.enum(["subkontraktor", "vendor"], { errorMap: () => ({ message: "Pilih jenis" }) }),
    is_active: isActive,
  }),
} satisfies Record<EditableKind, z.ZodTypeAny>;

/** Tabel + nilai kind master_items per jenis. */
export const MASTER_TABLES: Record<EditableKind, { table: "areas" | "master_items" | "contractors"; itemKind?: "incident_category" | "finding_category" | "risk_level" }> = {
  area: { table: "areas" },
  "kategori-kejadian": { table: "master_items", itemKind: "incident_category" },
  "kategori-temuan": { table: "master_items", itemKind: "finding_category" },
  "tingkat-risiko": { table: "master_items", itemKind: "risk_level" },
  mitra: { table: "contractors" },
};

/** Label kolom di Riwayat Aktivitas master. */
export const MASTER_FIELD_LABELS = {
  name: { label: "Nama" },
  code: { label: "Kode" },
  description: { label: "Keterangan" },
  color: { label: "Warna" },
  sort_order: { label: "Urutan", format: "number" },
  is_active: { label: "Aktif", format: "boolean" },
  location_id: { label: "Site" },
  company_code: { label: "Perusahaan" },
  kind: { label: "Jenis" },
} as const;
