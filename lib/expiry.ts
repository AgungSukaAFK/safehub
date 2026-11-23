// Status masa berlaku turunan (rancangan §2.4): Berlaku / Akan Kedaluwarsa / Kedaluwarsa / Belum Ada.
// Fungsi murni (aman client + server). Hitung di loader (server) lalu kirim hasilnya ke komponen;
// jangan memanggil Date.now() saat render client component.

/** Ambang default "Akan Kedaluwarsa". Nanti dibaca dari Pengaturan Pengingat (rancangan §4.12). */
export const DEFAULT_EXPIRY_WARN_DAYS = 30;

export type ExpiryState = "valid" | "expiring" | "expired" | "none";
export type Expiry = { state: ExpiryState; validUntil: string | null; daysLeft: number | null };

const DAY = 86_400_000;

/** Selisih hari kalender antara dua tanggal `YYYY-MM-DD` (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);
}

/**
 * @param validUntil tanggal terakhir berlaku `YYYY-MM-DD` (masih berlaku pada hari itu), null = belum ada
 * @param today hari ini WIB `YYYY-MM-DD` (todayWib() di server)
 */
export function expiryOf(validUntil: string | null | undefined, today: string, warnDays = DEFAULT_EXPIRY_WARN_DAYS): Expiry {
  if (!validUntil) return { state: "none", validUntil: null, daysLeft: null };
  const day = validUntil.slice(0, 10);
  const daysLeft = daysBetween(today, day);
  const state: ExpiryState = daysLeft < 0 ? "expired" : daysLeft <= warnDays ? "expiring" : "valid";
  return { state, validUntil: day, daysLeft };
}
