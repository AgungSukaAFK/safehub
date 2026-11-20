// [starter-standar] direkonstruksi + tambahan boilerplate (frontend-guide §26). Waktu selalu WIB.

const TZ = "Asia/Jakarta";
const LOCALE = "id-ID";

type DateInput = string | number | Date | null | undefined;

function toDate(v: DateInput): Date | null {
  if (v === null || v === undefined || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

const rupiahFmt = new Intl.NumberFormat(LOCALE, { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const numberFmt = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 });
const dateFmt = new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, day: "2-digit", month: "short", year: "numeric" });
const dateLongFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const timeFmt = new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
const monthFmt = new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, month: "long", year: "numeric" });

/** Rp 1.500.000 (non-breaking space diganti spasi biasa) */
export function formatRupiah(v: number | string | null | undefined): string {
  const n = typeof v === "string" ? Number(v) : v;
  if (n === null || n === undefined || !Number.isFinite(n)) return "-";
  return rupiahFmt.format(n).replace(/ /g, " ");
}

/** 1.250,5 */
export function formatNumber(v: number | string | null | undefined): string {
  const n = typeof v === "string" ? Number(v) : v;
  if (n === null || n === undefined || !Number.isFinite(n)) return "-";
  return numberFmt.format(n);
}

/** 18 Nov 2026 */
export function formatDate(v: DateInput): string {
  const d = toDate(v);
  return d ? dateFmt.format(d).replace(/\./g, "") : "-";
}

/** Rabu, 18 November 2026 */
export function formatDateLong(v: DateInput): string {
  const d = toDate(v);
  return d ? dateLongFmt.format(d) : "-";
}

/** 14.30 */
export function formatTime(v: DateInput): string {
  const d = toDate(v);
  return d ? timeFmt.format(d).replace(":", ".") : "-";
}

/** 18 Nov 2026 14.30 WIB */
export function formatDateTime(v: DateInput): string {
  const d = toDate(v);
  return d ? `${formatDate(d)} ${formatTime(d)} WIB` : "-";
}

/** November 2026 */
export function formatMonth(v: DateInput): string {
  const d = toDate(v);
  return d ? monthFmt.format(d) : "-";
}

/** 5 menit lalu / baru saja / 3 hari lalu / (lebih dari 30 hari) tanggal */
export function timeAgo(v: DateInput, now: Date = new Date()): string {
  const d = toDate(v);
  if (!d) return "-";
  const s = Math.round((now.getTime() - d.getTime()) / 1000);
  if (s < 45) return "baru saja";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} menit lalu`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const day = Math.round(h / 24);
  if (day < 30) return `${day} hari lalu`;
  return formatDate(d);
}

/** Umur dokumen: "3 Hari 4 Jam", "2 Jam 5 Menit", "10 Menit" */
export function formatAge(from: DateInput, to: DateInput = new Date()): string {
  const a = toDate(from);
  const b = toDate(to);
  if (!a || !b) return "-";
  let mins = Math.max(0, Math.floor((b.getTime() - a.getTime()) / 60000));
  const days = Math.floor(mins / 1440);
  mins -= days * 1440;
  const hours = Math.floor(mins / 60);
  mins -= hours * 60;
  if (days > 0) return hours > 0 ? `${days} Hari ${hours} Jam` : `${days} Hari`;
  if (hours > 0) return mins > 0 ? `${hours} Jam ${mins} Menit` : `${hours} Jam`;
  return `${mins} Menit`;
}

/** Durasi dalam jam → "5 jam" / "2 hari 3 jam" (batas waktu approval) */
export function formatHours(hours: number): string {
  const h = Math.round(Math.abs(hours));
  if (h < 24) return `${h} jam`;
  const d = Math.floor(h / 24);
  const r = h % 24;
  return r ? `${d} hari ${r} jam` : `${d} hari`;
}

/** Chip filter: "01 Nov – 18 Nov 2026" (tahun sekali kalau sama) */
export function formatRange(from: DateInput, to: DateInput): string {
  const a = toDate(from);
  const b = toDate(to);
  if (a && b) {
    const sameYear = formatDate(a).slice(-4) === formatDate(b).slice(-4);
    return `${sameYear ? formatDate(a).slice(0, -5) : formatDate(a)} – ${formatDate(b)}`;
  }
  if (a) return `Sejak ${formatDate(a)}`;
  if (b) return `Sampai ${formatDate(b)}`;
  return "-";
}

/** Tanggal hari ini WIB dalam `YYYY-MM-DD` */
export function todayWib(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

/** Sapaan sesuai jam WIB */
export function greeting(now: Date = new Date()): string {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).format(now));
  if (h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 18) return "Selamat sore";
  return "Selamat malam";
}

/** Ukuran file: 1,2 MB */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${formatNumber(Number((bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)))} ${units[i]}`;
}
