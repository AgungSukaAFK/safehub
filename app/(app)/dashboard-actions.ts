"use server";

// Server Action Beranda: drill-down stat card (loader list Pengajuan dengan filter yang sama dengan
// link "Buka di daftar") dan "Muat lebih banyak" feed aktivitas.
import { actionAccess } from "@/lib/auth";
import { getCompanies } from "@/lib/companies";
import { getActivityFeed, type FeedItem } from "@/lib/dashboard";
import { STAT_STATUS, type StatKey } from "@/lib/dashboard-types";
import { listPengajuan, parsePengajuanParams, type PengajuanRow } from "@/lib/pengajuan";
import { createClient } from "@/lib/supabase/server";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function drillDownAction(
  key: StatKey,
  period: { from: string; to: string; company: string | null },
  page: number,
): Promise<{ rows: PengajuanRow[]; total: number } | { error: string }> {
  if (!(await actionAccess("viewer"))) return { error: "Sesi berakhir. Muat ulang halaman." };
  if (!(key in STAT_STATUS) || !DATE.test(period.from) || !DATE.test(period.to)) return { error: "Permintaan tidak valid." };
  const status = STAT_STATUS[key];
  const companies = (await getCompanies()).map((c) => c.code);
  const f = parsePengajuanParams(
    {
      dari: period.from,
      sampai: period.to,
      perusahaan: period.company ?? undefined,
      status: status ?? undefined,
      urut: key === "amount_approved" ? "total.desc" : "tanggal.desc",
      hal: String(Math.max(1, Math.min(page, 1000))),
      baris: "10",
    },
    companies,
  );
  try {
    return await listPengajuan(await createClient(), f);
  } catch (e) {
    console.error("[drillDown]", e);
    return { error: "Data gagal dimuat. Coba lagi." };
  }
}

export async function loadFeedAction(before: string): Promise<FeedItem[]> {
  if (!(await actionAccess("viewer")) || Number.isNaN(Date.parse(before))) return [];
  try {
    return await getActivityFeed(await createClient(), 15, before);
  } catch {
    return [];
  }
}
