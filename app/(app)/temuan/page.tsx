import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Content } from "@/components/list/content";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireAccess } from "@/lib/auth";
import { hasAnyFunction } from "@/lib/functions";
import { getAreas, getK3Masters, getK3People, masterStatusMap } from "@/lib/k3";
import { parseSiteParam } from "@/lib/sites";
import { createClient } from "@/lib/supabase/server";
import { countTemuanViews, getTemuanStats, listTemuan, listTemuanKanban, parseTemuanParams, temuanChips } from "@/lib/temuan";
import { TemuanList } from "./temuan-list";
import { TemuanStatsView } from "./temuan-stats";

export const metadata: Metadata = { title: "Temuan & PICA" };

// Daftar temuan (rancangan §4.2): strip angka + widget, saved views, Tabel/Kanban, filter, ekspor.
// Semua angka dari loader/RPC dengan filter site yang sama dengan list (satu sumber angka).
export default async function TemuanPage({ searchParams }: PageProps<"/temuan">) {
  const access = await requireAccess("viewer");
  const sp = await searchParams;
  const { siteId, label: siteLabel } = await parseSiteParam(sp, access);
  const f = parseTemuanParams(sp, siteId);
  const supabase = await createClient();
  const [areas, masters, people] = await Promise.all([getAreas(supabase), getK3Masters(supabase), getK3People(supabase)]);
  const [list, kanban, counts, stats] = await Promise.all([
    f.mode === "tabel" ? listTemuan(supabase, f, access.userId, areas) : Promise.resolve(null),
    f.mode === "kanban" ? listTemuanKanban(supabase, f, access.userId, areas) : Promise.resolve(null),
    countTemuanViews(supabase, f, access.userId),
    getTemuanStats(supabase, siteId),
  ]);
  const areaOptions = areas.filter((a) => !siteId || a.siteId === siteId).map((a) => ({ value: a.value, label: a.label }));
  const categoryOptions = masters.findingCategories.map((c) => ({ value: c.value, label: c.label }));
  const riskOptions = masters.riskLevels.map((c) => ({ value: c.value, label: c.label }));
  const peopleOptions = people.map((p) => ({ value: p.value, label: p.label }));
  const chips = temuanChips(f, { categories: categoryOptions, risks: riskOptions, areas: areaOptions, people: peopleOptions });
  const canCreate = !access.functions.includes("auditor") && hasAnyFunction(access, ["hse", "pengawas", "pjo"]);

  return (
    <>
      <PageHeader
        title="Temuan & PICA"
        description={`Pantau temuan, tindakan perbaikan, dan proses verifikasi · ${siteLabel}`}
        actions={
          canCreate && (
            <Link href="/temuan/baru" className={buttonVariants()}>
              <Plus /> Temuan Baru
            </Link>
          )
        }
      />
      <TemuanStatsView stats={stats} />
      <Content>
        <TemuanList
          mode={f.mode}
          view={f.view}
          counts={counts}
          rows={list?.rows ?? []}
          total={list?.total ?? 0}
          kanban={kanban ?? []}
          page={f.page}
          size={f.size}
          chips={chips}
          filtered={!!(f.q || chips.length)}
          riskMap={masterStatusMap(masters.riskLevels)}
          options={{ categories: categoryOptions, risks: riskOptions, areas: areaOptions, people: peopleOptions }}
          canCreate={canCreate}
        />
      </Content>
    </>
  );
}
