import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/auth";
import { getAreas, getK3Masters, getK3People, getWritableCompanies } from "@/lib/k3";
import { parseSiteParam } from "@/lib/sites";
import { createClient } from "@/lib/supabase/server";
import { ObservasiForm } from "./observasi-form";

export const metadata: Metadata = { title: "Observasi KTA/TTA" };

// Lapor cepat KTA/TTA. Cermin observation_submit: semua fungsi kecuali auditor.
export default async function ObservasiBaruPage({ searchParams }: PageProps<"/observasi/baru">) {
  const access = await requireAccess("viewer");
  if (access.functions.includes("auditor")) redirect("/observasi");
  const sp = await searchParams;
  const { siteId, sites } = await parseSiteParam(sp, access);
  const site = siteId ?? (access.profile.locationId && sites.some((s) => s.id === access.profile.locationId) ? access.profile.locationId : sites[0]?.id);
  if (!site) redirect("/observasi");
  const supabase = await createClient();
  const [areas, masters, people, companies] = await Promise.all([getAreas(supabase), getK3Masters(supabase), getK3People(supabase), getWritableCompanies(access)]);
  return (
    <ObservasiForm
      siteId={site}
      siteName={sites.find((s) => s.id === site)?.name ?? "Site"}
      areas={areas.filter((a) => a.siteId === site && a.isActive).map((a) => ({ value: a.value, label: a.label }))}
      risks={masters.riskLevels.filter((r) => r.isActive).map((r) => ({ value: r.value, label: r.label }))}
      people={people.map((p) => ({ value: p.value, label: p.label, description: p.description }))}
      companyCode={companies.length === 1 ? companies[0].value : (access.profile.company ?? null)}
    />
  );
}
