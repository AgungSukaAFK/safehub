// Monitoring APD (spesifikasi docs/spec/fase-6-apd.md). Aman client + server: label, status, zod.
import { z } from "zod";
import type { FieldLabel } from "@/lib/person-types";
import type { StatusDef } from "@/lib/status";

export const APD_TABS = ["ringkasan", "pengajuan", "stok", "mutasi", "karyawan", "periodik", "barang"] as const;
export type ApdTab = (typeof APD_TABS)[number];
export const APD_TAB_LABELS: Record<ApdTab, string> = {
  ringkasan: "Ringkasan",
  pengajuan: "Pengajuan",
  stok: "Stok",
  mutasi: "Mutasi",
  karyawan: "Jatuh Tempo Karyawan",
  periodik: "Masa Periodik",
  barang: "Barang",
};

// ---------------------------------------------------------------- pengajuan (jenis A)
export const REQUEST_STATUS: Record<string, StatusDef> = {
  draft: { label: "Draf", color: "gray" },
  pending_approval: { label: "Menunggu Approval", color: "amber" },
  rejected: { label: "Dikembalikan", color: "red" },
  approved: { label: "Disetujui", color: "green" },
  cancelled: { label: "Dibatalkan", color: "gray" },
};
export const REQUEST_STATUS_FILTERS = ["semua", "draft", "pending_approval", "rejected", "approved", "terbuka", "cancelled"] as const;
export const REQUEST_FILTER_LABELS: Record<(typeof REQUEST_STATUS_FILTERS)[number], string> = {
  semua: "Semua",
  draft: "Draf",
  pending_approval: "Menunggu Approval",
  rejected: "Dikembalikan",
  approved: "Disetujui",
  terbuka: "Belum Terpenuhi",
  cancelled: "Dibatalkan",
};

export const REASONS = ["new_hire", "periodic", "damaged", "lost"] as const;
export type Reason = (typeof REASONS)[number];
export const REASON_LABELS: Record<Reason, string> = {
  new_hire: "Karyawan baru",
  periodic: "Penggantian berkala",
  damaged: "Rusak",
  lost: "Hilang",
};
export const REASON_HINTS: Record<Reason, string> = {
  new_hire: "Set APD awal untuk karyawan baru (Form Request APD).",
  periodic: "APD sudah mencapai masa periodik penggantian.",
  damaged: "APD rusak sebelum masa periodiknya. Wajib foto bukti.",
  lost: "APD hilang. Penggantian dipotong gaji sesuai Matrix APD.",
};

/** Pemenuhan (turunan dari OUT tertaut, P6). Bermakna hanya untuk pengajuan disetujui. */
export const FULFILLMENT: Record<string, StatusDef> = {
  none: { label: "Belum dikirim", color: "amber" },
  partial: { label: "Sebagian", color: "sky" },
  full: { label: "Terpenuhi", color: "green" },
};

/** Ringkas: rusak karena kelalaian / hilang → wajib pernyataan potong gaji (P4). */
export const needsDeduction = (reason: string, negligence: boolean) => reason === "lost" || (reason === "damaged" && negligence);

// ---------------------------------------------------------------- stok
export const MOVE_KINDS = ["opening", "in", "out", "return", "adjust"] as const;
export type MoveKind = (typeof MOVE_KINDS)[number];
export const MOVE_KIND: Record<MoveKind, StatusDef & { hint: string }> = {
  opening: { label: "Stok awal", color: "gray", hint: "Hasil stock opname pertama per barang di gudang ini (sekali)." },
  in: { label: "Masuk", color: "green", hint: "Barang diterima gudang (isi no PR/MR)." },
  out: { label: "Keluar", color: "blue", hint: "APD diserahkan ke karyawan / site (isi no BAST)." },
  return: { label: "Kembali", color: "violet", hint: "APD dikembalikan ke gudang dalam kondisi layak." },
  adjust: { label: "Penyesuaian", color: "orange", hint: "Selisih stock opname (+/-). Wajib alasan." },
};
export const MOVE_FILTERS = ["semua", ...MOVE_KINDS] as const;

// ---------------------------------------------------------------- jatuh tempo (P9)
export const HOLDING_STATE: Record<string, StatusDef> = {
  expired: { label: "Lewat Jatuh Tempo", color: "red" },
  due_soon: { label: "Segera Ganti", color: "amber" },
  ok: { label: "Aman", color: "green" },
};
export const HOLDING_FILTERS = ["semua", "expired", "due_soon", "ok"] as const;

export const SIZE_KINDS = ["none", "clothing", "shoe", "waist", "color"] as const;
export const SIZE_KIND_LABELS: Record<(typeof SIZE_KINDS)[number], string> = {
  none: "Tanpa ukuran",
  clothing: "Ukuran baju (S-5XL)",
  shoe: "Nomor sepatu",
  waist: "Ukuran pinggang",
  color: "Warna",
};

/** "365 hari" → "1 tahun", dst. untuk tampilan masa periodik. */
export function intervalText(days: number | null): string {
  if (days == null) return "Tanpa periodik";
  if (days % 365 === 0) return `${days / 365} tahun`;
  if (days >= 28 && days % 30 <= 2) return `${Math.round(days / 30)} bulan`;
  if (days % 7 === 0) return `${days / 7} minggu`;
  return `${days} hari`;
}

// ---------------------------------------------------------------- riwayat (ActivityLogDialog)
export const APD_REQUEST_FIELD_LABELS: Record<string, FieldLabel> = {
  code: { label: "Nomor" },
  recipient_name: { label: "Karyawan" },
  job_title: { label: "Jabatan" },
  reason: { label: "Alasan", format: "status", statuses: Object.fromEntries(REASONS.map((r) => [r, { label: REASON_LABELS[r], color: "gray" }])) },
  negligence: { label: "Karena kelalaian", format: "boolean" },
  incident_on: { label: "Tanggal kejadian", format: "date" },
  last_received_on: { label: "Terakhir dapat APD", format: "date" },
  explanation: { label: "Penjelasan" },
  deduction_ack: { label: "Pernyataan potong gaji", format: "boolean" },
  mr_no: { label: "No MR" },
  requested_on: { label: "Diajukan", format: "date" },
  approved_on: { label: "Disetujui", format: "date" },
  status: { label: "Status", format: "status", statuses: REQUEST_STATUS },
  evidence_count: { label: "Foto bukti", format: "number" },
  cancel_note: { label: "Alasan batal" },
  apd: { label: "APD diminta", format: "list" },
};
export const APD_MOVE_FIELD_LABELS: Record<string, FieldLabel> = {
  kind: { label: "Jenis", format: "status", statuses: MOVE_KIND },
  qty: { label: "Jumlah", format: "number" },
  moved_on: { label: "Tanggal", format: "date" },
  ref_no: { label: "No referensi" },
  pic: { label: "PIC" },
  recipient_name: { label: "Penerima" },
  note: { label: "Catatan" },
  voided_at: { label: "Dibatalkan", format: "datetime" },
  void_reason: { label: "Alasan batal" },
};

// ---------------------------------------------------------------- zod
const uuid = z.string().uuid();
const optUuid = uuid.or(z.literal("")).optional().nullable();
const reqDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal wajib diisi");
const optDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).optional().nullable();
const optText = (max: number) => z.string().trim().max(max).optional().nullable();

export const moveSchema = z
  .object({
    warehouse_id: z.string().uuid("Pilih gudang"),
    kind: z.enum(MOVE_KINDS),
    item_id: uuid,
    qty: z.coerce.number().int().refine((n) => n !== 0, "Tidak boleh 0").refine((n) => Math.abs(n) <= 100000, "Terlalu besar"),
    moved_on: reqDate,
    ref_no: optText(60),
    pic: optText(120),
    dest_location_id: optUuid,
    employee_id: optUuid,
    recipient_name: optText(120),
    request_line_id: optUuid,
    note: optText(500),
  })
  .refine((v) => v.kind === "adjust" || v.qty > 0, { path: ["qty"], message: "Jumlah harus lebih dari 0" })
  .refine((v) => v.kind !== "adjust" || (v.note ?? "").trim().length >= 10, { path: ["note"], message: "Alasan minimal 10 karakter" })
  .refine((v) => v.kind !== "out" || v.request_line_id || v.employee_id || (v.recipient_name ?? "").trim().length >= 2, {
    path: ["recipient_name"],
    message: "Pilih karyawan atau isi nama penerima",
  })
  .refine((v) => v.kind !== "out" || v.request_line_id || v.employee_id || v.dest_location_id, { path: ["dest_location_id"], message: "Pilih site tujuan" });
export type MoveInput = z.infer<typeof moveSchema>;

export const itemSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9-]{1,29}$/, "Huruf besar, angka, minus (mis. SS-01-40)"),
  name: z.string().trim().min(2, "Nama wajib diisi").max(120),
  type_id: uuid,
  brand: optText(60),
  size: optText(20),
  uom: z.string().trim().min(1).max(20).default("Pcs"),
  min_stock: z.union([z.literal(""), z.coerce.number().int().min(0).max(100000)]).optional().nullable(),
  is_active: z.union([z.boolean(), z.enum(["true", "false"]).transform((v) => v === "true")]).optional(),
});

export const typeSchema = z
  .object({
    code: z.string().trim().regex(/^[a-z][a-z0-9_]{1,40}$/, "Huruf kecil, angka, garis bawah").optional(),
    name: z.string().trim().min(2, "Nama wajib diisi").max(80),
    spec: optText(200),
    interval_days: z.union([z.literal(""), z.coerce.number().int().min(1).max(3650)]).optional().nullable(),
    interval_label: optText(60),
    warn_days: z.coerce.number().int().min(0, "Minimal 0").max(365),
    tracked: z.union([z.boolean(), z.enum(["true", "false"]).transform((v) => v === "true")]),
    size_kind: z.enum(SIZE_KINDS),
    note: optText(500),
    is_active: z.union([z.boolean(), z.enum(["true", "false"]).transform((v) => v === "true")]).optional(),
  })
  .refine((v) => !v.tracked || (v.interval_days !== "" && v.interval_days != null), { path: ["interval_days"], message: "Wajib untuk jenis yang dilacak" });

export const requestLineSchema = z.object({
  type_id: uuid,
  item_id: optUuid,
  size: optText(20),
  qty: z.coerce.number().int().min(1, "Minimal 1").max(500),
  note: optText(500),
});
export const requestSchema = z
  .object({
    employee_id: uuid,
    reason: z.enum(REASONS),
    negligence: z.boolean().default(false),
    incident_on: optDate,
    last_received_on: optDate,
    explanation: optText(2000),
    deduction_ack: z.boolean().default(false),
    mr_no: optText(60),
    lines: z.array(requestLineSchema).min(1, "Tambahkan minimal satu APD").max(30),
  })
  .refine((v) => !["damaged", "lost"].includes(v.reason) || !!v.incident_on, { path: ["incident_on"], message: "Tanggal kerusakan/kehilangan wajib diisi" });
export type RequestInput = z.infer<typeof requestSchema>;

/** IN (terima MR) / OUT (kirim) banyak baris satu pengajuan sekaligus (28). Baris qty 0 dilewati. */
export const requestMovesSchema = z.object({
  request_id: uuid,
  warehouse_id: z.string().uuid("Pilih gudang"),
  moved_on: reqDate,
  ref_no: optText(60),
  pic: optText(120),
  note: optText(500),
  lines: z
    .array(z.object({ line_id: uuid, item_id: z.string().uuid("Pilih barang"), qty: z.coerce.number().int().min(0).max(500) }))
    .max(50)
    .refine((ls) => ls.some((l) => l.qty > 0), "Isi jumlah minimal satu barang"),
});
export type RequestMovesInput = z.input<typeof requestMovesSchema>;

/** Status MR pengajuan (P23): tanpa MR / menunggu barang / sebagian / lengkap. */
export const MR_STATE: Record<string, StatusDef> = {
  none: { label: "Belum ada MR", color: "gray" },
  waiting: { label: "MR: menunggu barang", color: "amber" },
  partial: { label: "MR: diterima sebagian", color: "sky" },
  full: { label: "MR: diterima lengkap", color: "green" },
};
export function mrState(mrNo: string | null, received: number, qty: number): keyof typeof MR_STATE {
  if (!mrNo) return "none";
  return received <= 0 ? "waiting" : received < qty ? "partial" : "full";
}
