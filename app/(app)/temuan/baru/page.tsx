import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/auth";
import { hasAnyFunction } from "@/lib/functions";
import { getAreas, getK3Masters, getK3People, getWritableCompanies } from "@/lib/k3";
import { getIncidentOptions } from "@/lib/kejadian";
import { nowWibLocal } from "@/lib/kejadian-rules";
import { parseSiteParam } from "@/lib/sites";
import { createClient } from "@/lib/supabase/server";
import { newFindingValues } from "@/lib/temuan-rules";
import { TemuanForm } from "../temuan-form";

export const metadata: Metadata = { title: "Temuan Baru" };

export default async function TemuanBaruPage({ searchParams }: PageProps<"/temuan/baru">) {
  const access = await requireAccess("viewer");
  // cermin aturan RPC finding_save: hse / pengawas / pjo (bukan auditor)
  if (access.functions.includes("auditor") || !(hasAnyFunction(access, ["hse", "pengawas", "pjo"]) || access.role === "admin")) redirect("/temuan");
  const sp = await searchParams;
  const { siteId, sites } = await parseSiteParam(sp, access);
  const site = siteId ?? sites[0]?.id ?? "";
  const supabase = await createClient();
  const [areas, masters, people, incidents, companies] = await Promise.all([
    getAreas(supabase),
    getK3Masters(supabase),
    getK3People(supabase),
    getIncidentOptions(supabase),
    getWritableCompanies(access),
  ]);
  const siteName = sites.find((s) => s.id === site)?.name ?? "Site";
  const kind = typeof sp.sumber === "string" ? sp.sumber : "";
  const sourceId = typeof sp.kejadian === "string" ? sp.kejadian : null;

  return (
    <TemuanForm
      id={null}
      initial={newFindingValues({
        location_id: site,
        company_code: companies.length === 1 ? companies[0].value : (access.profile.company ?? null),
        found_at: nowWibLocal(),
        source_kind: sourceId ? "incident" : kind === "inspection" || kind === "observation" || kind === "audit" || kind === "meeting" ? kind : "",
        source_id: sourceId,
      })}
      companies={companies}
      areas={areas.filter((a) => a.siteId === site && a.isActive).map((a) => ({ value: a.value, label: a.label }))}
      categories={masters.findingCategories.filter((c) => c.isActive).map((c) => ({ value: c.value, label: c.label }))}
      risks={masters.riskLevels.filter((c) => c.isActive).map((c) => ({ value: c.value, label: c.label }))}
      people={people.map((p) => ({ value: p.value, label: p.label, description: p.description }))}
      incidents={incidents}
      userId={access.userId}
      siteName={siteName}
    />
  );
}
