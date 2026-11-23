import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Content } from "@/components/list/content";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireAccess } from "@/lib/auth";
import { getAreas, getK3Masters, getK3People } from "@/lib/k3";
import { countKejadianViews, kejadianChips, listKejadian, parseKejadianParams } from "@/lib/kejadian";
import { parseSiteParam } from "@/lib/sites";
import { createClient } from "@/lib/supabase/server";
import { KejadianTable } from "./kejadian-table";

export const metadata: Metadata = { title: "Kejadian & Investigasi" };

// Daftar kejadian (rancangan §4.1): saved views + filter + ekspor. Karyawan hanya melihat laporannya
// sendiri (RLS). Angka tab = loader yang sama dengan tabel (filter site/pencarian ikut).
export default async function KejadianPage({ searchParams }: PageProps<"/kejadian">) {
  const access = await requireAccess("viewer");
  const sp = await searchParams;
  const { siteId, label: siteLabel } = await parseSiteParam(sp, access);
  const f = parseKejadianParams(sp, siteId);
  const supabase = await createClient();
  const [areas, masters, people] = await Promise.all([getAreas(supabase), getK3Masters(supabase), getK3People(supabase)]);
  const [{ rows, total }, counts] = await Promise.all([listKejadian(supabase, f, areas), countKejadianViews(supabase, f)]);

  const areaOptions = areas.filter((a) => !siteId || a.siteId === siteId).map((a) => ({ value: a.value, label: a.label }));
  const categoryOptions = masters.incidentCategories.map((c) => ({ value: c.value, label: c.label }));
  const peopleOptions = people.map((p) => ({ value: p.value, label: p.label }));
  const chips = kejadianChips(f, { categories: categoryOptions, areas: areaOptions, people: peopleOptions });
  const canReport = !access.functions.includes("auditor");
  const mineOnly = !access.platformAdmin && access.role !== "admin" && access.functions.every((fn) => fn === "karyawan");

  return (
    <>
      <PageHeader
        title="Kejadian & Investigasi"
        description={`${mineOnly ? "Laporan Anda" : "Kelola laporan kejadian dari klasifikasi hingga penutupan"} · ${siteLabel}`}
        actions={
          canReport && (
            <Link href="/kejadian/lapor" className={buttonVariants()}>
              <Plus /> Lapor Kejadian
            </Link>
          )
        }
      />
      <Content>
        <KejadianTable
          rows={rows}
          total={total}
          page={f.page}
          size={f.size}
          view={f.view}
          counts={counts}
          chips={chips}
          filtered={!!(f.q || chips.length || f.view !== "semua")}
          options={{ categories: categoryOptions, areas: areaOptions, people: peopleOptions }}
          canReport={canReport}
          mineOnly={mineOnly}
        />
      </Content>
    </>
  );
}
