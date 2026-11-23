import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Content } from "@/components/list/content";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireAccess } from "@/lib/auth";
import { todayWibIso } from "@/lib/k3";
import { listWorkHours } from "@/lib/kpi";
import { getMySites } from "@/lib/sites";
import { createClient } from "@/lib/supabase/server";
import { WorkHoursGrid } from "./work-hours-grid";

export const metadata: Metadata = { title: "Jam Kerja" };

// Jam kerja bulanan per site = penyebut LTIFR/LTISR (rancangan D6, default). Diisi HSE/admin.
export default async function JamKerjaPage({ searchParams }: PageProps<"/kpi/jam-kerja">) {
  const access = await requireAccess("viewer");
  const canEdit = access.role === "admin" || access.platformAdmin || (access.functions.includes("hse") && !access.functions.includes("auditor"));
  if (!canEdit && !access.functions.some((f) => f !== "karyawan")) redirect("/kpi");
  const sp = await searchParams;
  const nowYear = Number(todayWibIso().slice(0, 4));
  const raw = Number(typeof sp.tahun === "string" ? sp.tahun : nowYear);
  const year = Number.isInteger(raw) && raw >= 2020 && raw <= nowYear + 1 ? raw : nowYear;
  const supabase = await createClient();
  const [sites, rows] = await Promise.all([getMySites(), listWorkHours(supabase, year)]);

  return (
    <>
      <PageHeader
        title="Jam Kerja"
        description={`Jam kerja bulanan per site, dipakai sebagai penyebut LTIFR dan LTISR · ${year}`}
        actions={
          <>
            <Link href={`/kpi/jam-kerja?tahun=${year - 1}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              {year - 1}
            </Link>
            {year < nowYear && (
              <Link href={`/kpi/jam-kerja?tahun=${year + 1}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                {year + 1}
              </Link>
            )}
            <Link href="/kpi" className={buttonVariants({ variant: "outline", size: "sm" })}>
              <ArrowLeft /> Kamus KPI
            </Link>
          </>
        }
      />
      <Content>
        <WorkHoursGrid year={year} sites={sites} rows={rows} canEdit={canEdit} currentMonth={todayWibIso().slice(0, 7)} />
        <p className="mt-3 text-xs text-muted-foreground">
          Tanpa jam kerja, LTIFR dan LTISR tidak dihitung (ditampilkan &quot;Belum tersedia&quot;, bukan 0). Lintas site: pembilang dan penyebut dijumlahkan.
        </p>
      </Content>
    </>
  );
}
