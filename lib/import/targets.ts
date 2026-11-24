// Kit Impor Data (rancangan §2.12): definisi per target = kolom, aturan validasi (zod), kunci unik, contoh.
// Aman client + server (wizard memvalidasi di browser; Server Action memvalidasi ULANG sebelum commit).
import { z } from "zod";

export type ImportColumn = {
  key: string;
  label: string;
  required?: boolean;
  /** nama kolom lain yang dikenali saat pemetaan otomatis (huruf kecil) */
  aliases: string[];
  example: string;
  hint?: string;
};

export type ImportTargetId = "employees" | "certificates" | "mcu" | "site_permits" | "mnt_units" | "mnt_downtime" | "mnt_ps" | "mnt_backlog";
/** people = HR/HSE/admin; maintenance = Service/Maintenance/HSE/admin (cermin data sistem maintenance, fase 5) */
export type ImportGroup = "people" | "maintenance";
export type ImportMode = "insert" | "upsert";

export type ImportTarget = {
  id: ImportTargetId;
  group: ImportGroup;
  label: string;
  description: string;
  /** butuh pilihan site tujuan (target lain memakai site karyawan) */
  needsSite: boolean;
  columns: ImportColumn[];
  /** kunci unik baris di dalam file (deteksi duplikat) */
  keyOf: (d: Record<string, string>) => string;
  keyLabel: string;
  schema: z.ZodType<Record<string, string>, z.ZodTypeDef, Record<string, string>>;
};

// ---------------------------------------------------------------- normalisasi nilai sel
const clean = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();

/** Tanggal: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, atau nomor seri Excel. "" bila kosong; null bila tidak dikenali. */
export function normalizeDate(raw: string): string | null {
  const v = clean(raw);
  if (!v) return "";
  let m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/.exec(v);
  if (!m) {
    const d = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(v);
    if (d) m = [d[0], d[3], d[2].padStart(2, "0"), d[1].padStart(2, "0")] as unknown as RegExpExecArray;
  }
  if (!m && /^\d{5}$/.test(v)) {
    const ms = Date.UTC(1899, 11, 30) + Number(v) * 86_400_000;
    return new Date(ms).toISOString().slice(0, 10);
  }
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}`;
  const t = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(t.getTime()) || t.toISOString().slice(0, 10) !== iso ? null : iso;
}

const text = (min: number, max: number, label: string) =>
  z.string().transform(clean).pipe(z.string().min(min, `${label} wajib diisi`).max(max, `${label} terlalu panjang (maks. ${max})`));
const optText = (max: number, label: string) => z.string().transform(clean).pipe(z.string().max(max, `${label} terlalu panjang (maks. ${max})`));
const reqDate = (label: string) =>
  z.string().transform((v, ctx) => {
    const n = normalizeDate(v);
    if (n === null || n === "") {
      ctx.addIssue({ code: "custom", message: n === "" ? `${label} wajib diisi` : `${label} bukan tanggal yang valid (pakai 31/12/2026 atau 2026-12-31)` });
      return z.NEVER;
    }
    return n;
  });
const optDate = (label: string) =>
  z.string().transform((v, ctx) => {
    const n = normalizeDate(v);
    if (n === null) {
      ctx.addIssue({ code: "custom", message: `${label} bukan tanggal yang valid (pakai 31/12/2026 atau 2026-12-31)` });
      return z.NEVER;
    }
    return n;
  });
const oneOf = (label: string, map: Record<string, string>, fallback: string | null) =>
  z.string().transform((v, ctx) => {
    const k = clean(v).toLowerCase();
    if (!k) {
      if (fallback === null) {
        ctx.addIssue({ code: "custom", message: `${label} wajib diisi` });
        return z.NEVER;
      }
      return fallback;
    }
    const hit = map[k];
    if (!hit) {
      ctx.addIssue({ code: "custom", message: `${label} "${clean(v)}" tidak dikenal. Pilihan: ${[...new Set(Object.values(map))].join(", ")}` });
      return z.NEVER;
    }
    return hit;
  });

const EMPLOYMENT = Object.fromEntries(["PKWTT", "PKWT", "Harian", "Magang", "Mitra"].map((x) => [x.toLowerCase(), x]));
const EMP_STATUS = { aktif: "active", active: "active", nonaktif: "inactive", "non-aktif": "inactive", inactive: "inactive" };
const MCU_RESULT = { fit: "fit", "fit dengan catatan": "fit_note", "fit dgn catatan": "fit_note", "fit with note": "fit_note", fit_note: "fit_note", "tidak fit": "unfit", unfit: "unfit" };

/** Angka desimal: koma atau titik, 0..max. */
const hoursNum = (label: string, max: number) =>
  z.string().transform((v, ctx) => {
    const t = clean(v).replace(",", ".");
    if (!/^\d+(\.\d+)?$/.test(t) || Number(t) > max) {
      ctx.addIssue({ code: "custom", message: `${label} harus angka 0 sampai ${max}` });
      return z.NEVER;
    }
    return String(Number(t));
  });
const UNIT_STATUS = { aktif: "active", active: "active", standby: "standby", breakdown: "breakdown", rusak: "breakdown", dihentikan: "retired", retired: "retired", afkir: "retired", "": "active" };
const DT_KIND = { breakdown: "breakdown", rusak: "breakdown", planned: "planned", terencana: "planned", terjadwal: "planned" };
const PRIORITY = { high: "high", tinggi: "high", medium: "medium", sedang: "medium", low: "low", rendah: "low" };
const BL_STATUS = { open: "open", terbuka: "open", baru: "open", done: "done", selesai: "done", closed: "done", ditutup: "done" };

const strRecord = <T extends z.ZodRawShape>(shape: T) => z.object(shape) as unknown as z.ZodType<Record<string, string>, z.ZodTypeDef, Record<string, string>>;

export const IMPORT_TARGETS: Record<ImportTargetId, ImportTarget> = {
  employees: {
    id: "employees",
    group: "people",
    label: "Manpower (karyawan & tenaga mitra)",
    description: "Data karyawan per site. Mode Perbarui mencocokkan NIK; kolom kosong tidak menimpa data yang sudah ada.",
    needsSite: true,
    keyLabel: "NIK",
    keyOf: (d) => d.nik,
    columns: [
      { key: "nik", label: "NIK", required: true, aliases: ["nik", "nip", "no karyawan", "kode"], example: "GMI-0100" },
      { key: "nama", label: "Nama", required: true, aliases: ["nama", "nama karyawan", "name"], example: "Budi Santoso" },
      { key: "jabatan", label: "Jabatan", required: true, aliases: ["jabatan", "posisi", "position", "job title"], example: "Mekanik" },
      { key: "section", label: "Section", aliases: ["section", "seksi", "departemen", "bagian"], example: "Workshop" },
      { key: "hubungan_kerja", label: "Hubungan kerja", aliases: ["hubungan kerja", "status kerja", "employment", "tipe"], example: "PKWT", hint: "PKWTT, PKWT, Harian, Magang, Mitra" },
      { key: "tanggal_mulai", label: "Tanggal mulai", aliases: ["tanggal mulai", "tgl masuk", "tanggal masuk", "join date"], example: "05/01/2026" },
      { key: "status", label: "Status", aliases: ["status", "aktif"], example: "Aktif", hint: "Aktif atau Nonaktif (kosong = Aktif)" },
      { key: "mitra", label: "Mitra", aliases: ["mitra", "perusahaan mitra", "kontraktor", "vendor"], example: "", hint: "Nama persis di daftar Kontraktor; kosong bila karyawan sendiri" },
    ],
    schema: strRecord({
      nik: text(2, 30, "NIK"),
      nama: text(2, 120, "Nama"),
      jabatan: text(2, 80, "Jabatan"),
      section: optText(80, "Section"),
      hubungan_kerja: oneOf("Hubungan kerja", EMPLOYMENT, ""),
      tanggal_mulai: optDate("Tanggal mulai"),
      status: oneOf("Status", EMP_STATUS, ""),
      mitra: optText(200, "Mitra"),
    }),
  },
  certificates: {
    id: "certificates",
    group: "people",
    label: "Sertifikat kompetensi",
    description: "Sertifikat per karyawan. Kompetensi ditulis dengan kode atau nama yang ada di Matriks Kompetensi. Berlaku sampai kosong = seumur hidup.",
    needsSite: false,
    keyLabel: "NIK + kompetensi + nomor",
    keyOf: (d) => `${d.nik}|${d.kompetensi.toLowerCase()}|${d.nomor}`,
    columns: [
      { key: "nik", label: "NIK", required: true, aliases: ["nik", "nip"], example: "GMI-0017" },
      { key: "kompetensi", label: "Kompetensi", required: true, aliases: ["kompetensi", "sertifikat", "jenis sertifikat", "competency"], example: "K3 Umum" },
      { key: "nomor", label: "Nomor sertifikat", aliases: ["nomor", "no sertifikat", "nomor sertifikat", "number"], example: "K3U/2024/0912" },
      { key: "penerbit", label: "Penerbit", aliases: ["penerbit", "lembaga", "issuer"], example: "Kemnaker RI" },
      { key: "tanggal_terbit", label: "Tanggal terbit", aliases: ["tanggal terbit", "terbit", "issued"], example: "20/04/2024" },
      { key: "berlaku_sampai", label: "Berlaku sampai", aliases: ["berlaku sampai", "masa berlaku", "kedaluwarsa", "expired", "valid until"], example: "20/04/2027" },
    ],
    schema: strRecord({
      nik: text(2, 30, "NIK"),
      kompetensi: text(2, 120, "Kompetensi"),
      nomor: optText(80, "Nomor"),
      penerbit: optText(120, "Penerbit"),
      tanggal_terbit: optDate("Tanggal terbit"),
      berlaku_sampai: optDate("Berlaku sampai"),
    }),
  },
  mcu: {
    id: "mcu",
    group: "people",
    label: "MCU (Medical Check Up)",
    description: "Hasil dan masa berlaku MCU. Diagnosis dan catatan medis tidak diimpor; diagnosis yang sudah ada tidak berubah. Hanya HR dan HSE.",
    needsSite: false,
    keyLabel: "NIK + tanggal MCU",
    keyOf: (d) => `${d.nik}|${d.tanggal}`,
    columns: [
      { key: "nik", label: "NIK", required: true, aliases: ["nik", "nip"], example: "GMI-0017" },
      { key: "tanggal", label: "Tanggal MCU", required: true, aliases: ["tanggal", "tanggal mcu", "tgl mcu", "tanggal pemeriksaan"], example: "10/06/2026" },
      { key: "berlaku_sampai", label: "Berlaku sampai", required: true, aliases: ["berlaku sampai", "masa berlaku", "valid until", "expired"], example: "10/06/2027" },
      { key: "hasil", label: "Hasil", required: true, aliases: ["hasil", "kesimpulan", "result"], example: "Fit", hint: "Fit, Fit dengan Catatan, Tidak Fit" },
    ],
    schema: strRecord({
      nik: text(2, 30, "NIK"),
      tanggal: reqDate("Tanggal MCU"),
      berlaku_sampai: reqDate("Berlaku sampai"),
      hasil: oneOf("Hasil", MCU_RESULT, null),
    }),
  },
  site_permits: {
    id: "site_permits",
    group: "people",
    label: "Permit site",
    description: "Permit per karyawan (Izin Masuk Site, SIMPER, dan sejenisnya).",
    needsSite: false,
    keyLabel: "NIK + permit + nomor",
    keyOf: (d) => `${d.nik}|${d.permit.toLowerCase()}|${d.nomor}`,
    columns: [
      { key: "nik", label: "NIK", required: true, aliases: ["nik", "nip"], example: "GMI-0017" },
      { key: "permit", label: "Nama permit", required: true, aliases: ["permit", "nama permit", "izin", "jenis"], example: "Izin Masuk Site" },
      { key: "nomor", label: "Nomor", aliases: ["nomor", "no permit", "number"], example: "IMS/GMI-0017" },
      { key: "berlaku_sampai", label: "Berlaku sampai", required: true, aliases: ["berlaku sampai", "masa berlaku", "expired", "valid until"], example: "31/12/2026" },
    ],
    schema: strRecord({
      nik: text(2, 30, "NIK"),
      permit: text(2, 120, "Nama permit"),
      nomor: optText(80, "Nomor"),
      berlaku_sampai: reqDate("Berlaku sampai"),
    }),
  },
  mnt_units: {
    id: "mnt_units",
    group: "maintenance",
    label: "Maintenance: Unit",
    description: "Master unit dari sistem maintenance (kode, model, site, status). Impor ini dulu sebelum downtime, PS, dan backlog.",
    needsSite: false,
    keyLabel: "Kode unit",
    keyOf: (d) => d.kode,
    columns: [
      { key: "kode", label: "Kode unit", required: true, aliases: ["kode", "kode unit", "unit", "unit code", "no unit"], example: "EX-201" },
      { key: "model", label: "Model", aliases: ["model", "tipe", "jenis unit", "nama unit"], example: "Excavator PC400" },
      { key: "site", label: "Site", required: true, aliases: ["site", "lokasi", "location"], example: "Site MIFA", hint: "Nama site persis seperti di Safe Hub" },
      { key: "status", label: "Status", aliases: ["status"], example: "Aktif", hint: "Aktif, Standby, Breakdown, Dihentikan (kosong = Aktif)" },
    ],
    schema: strRecord({
      kode: text(1, 40, "Kode unit"),
      model: optText(120, "Model"),
      site: text(2, 120, "Site"),
      status: oneOf("Status", UNIT_STATUS, "active"),
    }),
  },
  mnt_downtime: {
    id: "mnt_downtime",
    group: "maintenance",
    label: "Maintenance: Downtime",
    description: "Downtime per unit (breakdown atau terencana) untuk PA, MTBF, dan MTTR. ID sumber membuat impor ulang memperbarui, bukan menggandakan.",
    needsSite: false,
    keyLabel: "ID sumber, atau unit + tanggal + jenis + keterangan",
    keyOf: (d) => d.id_sumber || `${d.unit}|${d.tanggal}|${d.jenis}|${d.keterangan}`,
    columns: [
      { key: "unit", label: "Kode unit", required: true, aliases: ["unit", "kode unit", "kode"], example: "EX-201" },
      { key: "tanggal", label: "Tanggal", required: true, aliases: ["tanggal", "tgl", "date", "tanggal breakdown"], example: "05/10/2026" },
      { key: "jam", label: "Jam downtime", required: true, aliases: ["jam", "jam downtime", "durasi", "downtime", "hours"], example: "40", hint: "Angka 0 sampai 744" },
      { key: "jenis", label: "Jenis", required: true, aliases: ["jenis", "tipe", "kind", "kategori"], example: "breakdown", hint: "breakdown atau planned (terencana)" },
      { key: "keterangan", label: "Keterangan", aliases: ["keterangan", "catatan", "penyebab", "note"], example: "Hydraulic pump bocor" },
      { key: "id_sumber", label: "ID sumber", aliases: ["id sumber", "id", "no wo", "work order", "source id"], example: "WO-10231", hint: "Opsional, tapi disarankan" },
    ],
    schema: strRecord({
      unit: text(1, 40, "Kode unit"),
      tanggal: reqDate("Tanggal"),
      jam: hoursNum("Jam downtime", 744),
      jenis: oneOf("Jenis", DT_KIND, null),
      keterangan: optText(500, "Keterangan"),
      id_sumber: optText(80, "ID sumber"),
    }),
  },
  mnt_ps: {
    id: "mnt_ps",
    group: "maintenance",
    label: "Maintenance: PS (Planned Service)",
    description: "Rencana dan aktual Planned Service per unit untuk PS Accuracy. Aktual kosong = belum dikerjakan.",
    needsSite: false,
    keyLabel: "ID sumber, atau unit + jenis PS + tanggal rencana",
    keyOf: (d) => d.id_sumber || `${d.unit}|${d.jenis_ps.toLowerCase()}|${d.rencana}`,
    columns: [
      { key: "unit", label: "Kode unit", required: true, aliases: ["unit", "kode unit", "kode"], example: "EX-201" },
      { key: "jenis_ps", label: "Jenis PS", required: true, aliases: ["jenis ps", "ps", "jenis", "pekerjaan"], example: "PS 500 jam" },
      { key: "rencana", label: "Tanggal rencana", required: true, aliases: ["rencana", "tanggal rencana", "plan", "planned"], example: "03/10/2026" },
      { key: "aktual", label: "Tanggal aktual", aliases: ["aktual", "tanggal aktual", "actual", "selesai"], example: "03/10/2026" },
      { key: "id_sumber", label: "ID sumber", aliases: ["id sumber", "id", "no wo", "source id"], example: "PS-5521" },
    ],
    schema: strRecord({
      unit: text(1, 40, "Kode unit"),
      jenis_ps: text(1, 160, "Jenis PS"),
      rencana: reqDate("Tanggal rencana"),
      aktual: optDate("Tanggal aktual"),
      id_sumber: optText(80, "ID sumber"),
    }),
  },
  mnt_backlog: {
    id: "mnt_backlog",
    group: "maintenance",
    label: "Maintenance: Backlog",
    description: "Backlog pekerjaan per unit (prioritas, status, tanggal dibuka dan ditutup). Status Selesai wajib tanggal ditutup; Open tidak boleh.",
    needsSite: false,
    keyLabel: "ID sumber, atau unit + judul + tanggal dibuka",
    keyOf: (d) => d.id_sumber || `${d.unit}|${d.judul.toLowerCase()}|${d.dibuka}`,
    columns: [
      { key: "unit", label: "Kode unit", required: true, aliases: ["unit", "kode unit", "kode"], example: "DZ-101" },
      { key: "judul", label: "Judul backlog", required: true, aliases: ["judul", "backlog", "pekerjaan", "deskripsi", "uraian"], example: "Ganti final drive" },
      { key: "prioritas", label: "Prioritas", required: true, aliases: ["prioritas", "priority"], example: "Tinggi", hint: "Tinggi, Sedang, Rendah" },
      { key: "status", label: "Status", required: true, aliases: ["status"], example: "Open", hint: "Open atau Selesai" },
      { key: "dibuka", label: "Tanggal dibuka", required: true, aliases: ["dibuka", "tanggal dibuka", "opened", "tanggal temuan"], example: "10/09/2026" },
      { key: "ditutup", label: "Tanggal ditutup", aliases: ["ditutup", "tanggal ditutup", "closed", "selesai"], example: "" },
      { key: "id_sumber", label: "ID sumber", aliases: ["id sumber", "id", "no backlog", "source id"], example: "BL-0412" },
    ],
    schema: strRecord({
      unit: text(1, 40, "Kode unit"),
      judul: text(1, 200, "Judul backlog"),
      prioritas: oneOf("Prioritas", PRIORITY, null),
      status: oneOf("Status", BL_STATUS, null),
      dibuka: reqDate("Tanggal dibuka"),
      ditutup: optDate("Tanggal ditutup"),
      id_sumber: optText(80, "ID sumber"),
    }),
  },
};

export const IMPORT_TARGET_LIST = Object.values(IMPORT_TARGETS);
export const MAX_IMPORT_ROWS = 1000;

/** Aturan antar-kolom (cermin RPC; DB tetap memeriksa lagi). */
function crossCheck(id: ImportTargetId, d: Record<string, string>): string | null {
  if (id === "mnt_backlog") {
    if (d.status === "done" && !d.ditutup) return "Backlog Selesai wajib punya tanggal ditutup";
    if (d.status === "open" && d.ditutup) return "Backlog Open tidak boleh punya tanggal ditutup";
    if (d.ditutup && d.ditutup < d.dibuka) return "Tanggal ditutup tidak boleh sebelum tanggal dibuka";
  }
  if (id === "mcu" && d.berlaku_sampai < d.tanggal) return "Berlaku sampai tidak boleh sebelum tanggal MCU";
  return null;
}

/** Tebak pemetaan kolom file → kolom target dari nama header. */
export function autoMap(target: ImportTarget, headers: string[]): Record<string, number | null> {
  const norm = headers.map((h) => clean(h).toLowerCase());
  const used = new Set<number>();
  const out: Record<string, number | null> = {};
  for (const c of target.columns) {
    const names = [c.label.toLowerCase(), c.key.replace(/_/g, " "), ...c.aliases];
    const idx = norm.findIndex((h, i) => !used.has(i) && names.includes(h));
    out[c.key] = idx >= 0 ? idx : null;
    if (idx >= 0) used.add(idx);
  }
  return out;
}

export type RowResult = { n: number; d: Record<string, string> | null; errors: string[] };

/**
 * Terapkan pemetaan lalu validasi tiap baris. `n` = nomor baris di file (baris 1 = header).
 * Duplikat kunci di dalam file ditandai pada kemunculan KEDUA dan seterusnya.
 */
export function validateRows(target: ImportTarget, table: string[][], mapping: Record<string, number | null>): RowResult[] {
  const seen = new Map<string, number>();
  return table.map((cells, i) => {
    const n = i + 2;
    const raw: Record<string, string> = {};
    for (const c of target.columns) {
      const idx = mapping[c.key];
      raw[c.key] = idx === null || idx === undefined ? "" : clean(cells[idx]);
    }
    const parsed = target.schema.safeParse(raw);
    if (!parsed.success) return { n, d: null, errors: parsed.error.issues.map((x) => x.message) };
    const cross = crossCheck(target.id, parsed.data);
    if (cross) return { n, d: null, errors: [cross] };
    const key = target.keyOf(parsed.data).toLowerCase();
    const first = seen.get(key);
    if (first !== undefined) return { n, d: null, errors: [`Duplikat di file: ${target.keyLabel} sama dengan baris ${first}`] };
    seen.set(key, n);
    return { n, d: parsed.data, errors: [] };
  });
}
