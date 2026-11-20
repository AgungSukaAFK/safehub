// Tipe & definisi Beranda yang aman dipakai client + server.
import type { Person } from "@/lib/person-types";

export type DashboardPeriod = {
  /** YYYY-MM */
  month: string;
  /** 1–5, null = sebulan penuh */
  week: number | null;
  /** jumlah minggu di bulan itu (4 atau 5) */
  weeks: number;
  company: string | null;
  /** YYYY-MM-DD (WIB, inklusif) */
  from: string;
  to: string;
  isCurrentMonth: boolean;
};

export type StatKey = "total" | "pending" | "approved" | "rejected" | "amount_approved";

export type Summary = {
  cur: Record<StatKey, number>;
  /** periode sebelumnya dengan panjang sama (tren ▲▼) */
  prev: Record<StatKey, number>;
  draft: number;
  allPending: number;
};

/** Stat card → status list Pengajuan (drill-down & "Buka di daftar"). null = semua status. */
export const STAT_STATUS: Record<StatKey, string | null> = {
  total: null,
  pending: "pending_approval",
  approved: "approved",
  rejected: "rejected",
  amount_approved: "approved",
};

export type FeedItem = {
  id: number;
  entity: string;
  at: string;
  action: string;
  note: string | null;
  label: string;
  href: string;
  actor: Pick<Person, "id" | "name" | "avatarUrl"> | null;
};

/** Link list Pengajuan dengan filter yang SAMA dengan angka dashboard (tanggal dibuat + perusahaan). */
export function pengajuanListHref(p: Pick<DashboardPeriod, "from" | "to" | "company">, extra: Record<string, string> = {}) {
  const q = new URLSearchParams({ dari: p.from, sampai: p.to, ...(p.company ? { perusahaan: p.company } : {}), ...extra });
  return `/pengajuan?${q}`;
}
