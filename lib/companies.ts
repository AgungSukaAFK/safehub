import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { companyScope, type Company } from "@/lib/company-types";

export { companyScope, type Company } from "@/lib/company-types";

/** Semua company aktif (public.companies), dibaca sekali per request lalu dioper ke client. */
export const getCompanies = cache(async (): Promise<Company[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("public")
    .from("companies")
    .select("code, name, short_name, address, phone, email, logo_url, logo_landscape_url, accent, is_group")
    .eq("is_active", true)
    .order("sort_order");
  if (error) {
    console.error("[companies]", error.message);
    return [];
  }
  return (data ?? []).map((c) => ({
    code: c.code,
    name: c.name,
    shortName: c.short_name,
    address: c.address,
    phone: c.phone,
    email: c.email,
    logoUrl: c.logo_url ?? "/lourdes-logo.webp",
    logoLandscapeUrl: c.logo_landscape_url ?? c.logo_url ?? "/lourdes-logo.webp",
    accent: c.accent,
    isGroup: c.is_group,
  }));
});

/** Scope perusahaan user sekarang (untuk filter loader, Excel, global search). */
export async function getCompanyScope(user: { company: string | null; platformAdmin: boolean }) {
  return companyScope(user, await getCompanies());
}
