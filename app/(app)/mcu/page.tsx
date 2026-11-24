import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { StatusBadge } from "@/components/detail/status-badge";
import { ExpiryChip } from "@/components/expiry-chip";
import { Content } from "@/components/list/content";
import { PageHeader } from "@/components/page-header";
import { RestrictedData } from "@/components/restricted-data";
import { requireAccess } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { listMcu } from "@/lib/manpower";
import { MCU_RESULT } from "@/lib/people-rules";
import { enumParam, hrefWith, textParam } from "@/lib/search-params";
import { parseSiteParam } from "@/lib/sites";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "MCU" };

const FILTERS = ["semua", "expiring", "expired"] as const;
const FILTER_LABEL = { semua: "Semua", expiring: "Akan Kedaluwarsa", expired: "Kedaluwarsa / Belum Ada" } as const;

// Daftar MCU terbaru per karyawan aktif (rancangan §4.6). Diagnosis TIDAK dimuat di daftar; hanya di profil, untuk HR/HSE.
export default async function McuPage({ searchParams }: PageProps<"/mcu">) {
  const access = await requireAccess("viewer");
  const isAdmin = access.role === "admin" || access.platformAdmin;
  if (!isAdmin && !access.functions.some((f) => f !== "karyawan")) redirect("/");
  const sp = await searchParams;
  const { siteId, label } = await parseSiteParam(sp, access);
  const filter = enumParam(sp, "status", FILTERS, "semua");
  const q = textParam(sp, "q");
  const supabase = await createClient();
  const rows = await listMcu(supabase, { site: siteId, q, filter });
  const canMedical = access.functions.includes("hr") || access.functions.includes("hse");
  const href = (c: Record<string, string | null>) => hrefWith("/mcu", sp, c);

  return (
    <>
      <PageHeader title="MCU" description={`Medical Check Up terbaru per karyawan aktif · ${label}`} />
      <div className="col-span-12 flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => (
          <Link key={f} href={href({ status: f === "semua" ? null : f })} aria-pressed={filter === f} className={cn("rounded-full border px-2.5 py-0.5 text-xs", filter === f ? "border-primary bg-primary/5 font-medium text-primary" : "hover:bg-accent")}>
            {FILTER_LABEL[f]}
          </Link>
        ))}
        <form method="get" className="ml-auto flex gap-2">
          {filter !== "semua" && <input type="hidden" name="status" value={filter} />}
          <input name="q" defaultValue={q} placeholder="Cari NIK / nama / jabatan" aria-label="Cari" className="h-8 w-52 rounded-md border bg-background px-2 text-sm" />
        </form>
      </div>
      {!canMedical && <RestrictedData className="col-span-12" functions={["hr", "hse"]} restricted title="Diagnosis dan catatan medis" />}
      <Content title="Daftar MCU" description={`${rows.length} karyawan`}>
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Tidak ada data untuk filter ini.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>{["NIK", "Nama", "Jabatan", "Tanggal MCU", "Berlaku sampai", "Status Masa Berlaku", "Hasil"].map((h) => <th key={h} scope="col" className="px-3 py-2 text-left font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.employeeId} className="border-t hover:bg-accent/30">
                    <td className="px-3 py-2 tabular-nums">{r.code}</td>
                    <td className="px-3 py-2 font-medium"><Link href={`/manpower/${r.employeeId}?tab=mcu`} className="underline underline-offset-2">{r.name}</Link></td>
                    <td className="px-3 py-2">{r.jobTitle}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.checkedOn ? formatDate(r.checkedOn) : "-"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.validUntil.validUntil ? formatDate(r.validUntil.validUntil) : "-"}</td>
                    <td className="px-3 py-2"><ExpiryChip expiry={r.validUntil} showDate={false} /></td>
                    <td className="px-3 py-2">{r.result ? <StatusBadge value={r.result} map={MCU_RESULT} /> : <span className="text-muted-foreground">-</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Content>
    </>
  );
}
