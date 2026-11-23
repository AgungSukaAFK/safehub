import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/auth";
import { FUNCTION_LABELS } from "@/lib/functions";
import { getAreas, getContractorOptions, getK3Masters, getK3People, getWritableCompanies } from "@/lib/k3";
import { nowWibLocal, type ReportValues } from "@/lib/kejadian-rules";
import { parseSiteParam } from "@/lib/sites";
import { createClient } from "@/lib/supabase/server";
import { LaporWizard } from "./lapor-wizard";

export const metadata: Metadata = { title: "Lapor Kejadian" };

// Lapor kejadian (HP-first). Cermin aturan RPC incident_report: semua fungsi kecuali auditor.
export default async function LaporKejadianPage({ searchParams }: PageProps<"/kejadian/lapor">) {
  const access = await requireAccess("viewer");
  if (access.functions.includes("auditor")) redirect("/kejadian");
  const sp = await searchParams;
  const { siteId, sites } = await parseSiteParam(sp, access);
  // "Semua site" tidak bisa dipakai melapor: pakai site profil, selain itu site pertama dalam scope
  const site = siteId ?? (access.profile.locationId && sites.some((s) => s.id === access.profile.locationId) ? access.profile.locationId : sites[0]?.id);
  if (!site) redirect("/kejadian");
  const supabase = await createClient();
  const [areas, masters, people, contractors, companies] = await Promise.all([
    getAreas(supabase),
    getK3Masters(supabase),
    getK3People(supabase),
    getContractorOptions(supabase),
    getWritableCompanies(access),
  ]);
  const initial: ReportValues = {
    company_code: companies.length === 1 ? companies[0].value : (access.profile.company ?? null),
    location_id: site,
    area_id: "",
    location_detail: "",
    occurred_at: nowWibLocal(),
    category: "",
    unit_code: "",
    unit_label: "",
    description: "",
    is_emergency: false,
    supervisor_id: null,
    workers: [],
    witnesses: [],
    declared: false,
  };
  const subtitle = [access.profile.jobTitleName, access.profile.departmentName, access.functions.map((f) => FUNCTION_LABELS[f]).join(", ")].filter(Boolean).join(" · ");

  return (
    <LaporWizard
      initial={initial}
      companies={companies}
      siteId={site}
      siteName={sites.find((s) => s.id === site)?.name ?? "Site"}
      areas={areas.filter((a) => a.siteId === site && a.isActive).map((a) => ({ value: a.value, label: a.label }))}
      categories={masters.incidentCategories.filter((c) => c.isActive).map((c) => ({ value: c.value, label: c.label }))}
      people={people.filter((p) => p.value !== access.userId).map((p) => ({ value: p.value, label: p.label, description: p.description }))}
      contractors={contractors}
      reporter={{ name: access.profile.fullName, subtitle }}
      userId={access.userId}
    />
  );
}
