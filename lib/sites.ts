// Site untuk loader server (rancangan §2.2). Opsi = my_sites() (site aktif dalam scope user).
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import type { AppAccess } from "@/lib/access-types";
import { type SearchParams } from "@/lib/search-params";
import { resolveSite, SITE_COOKIE, SITE_PARAM, siteLabel, type Site, type SiteChoice } from "@/lib/site-types";
import { createClient } from "@/lib/supabase/server";

/** Site yang boleh dilihat user (sekali per request). */
export const getMySites = cache(async (): Promise<Site[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_sites");
  if (error) throw error;
  return (data ?? []).map((s) => ({ id: s.id, name: s.name }));
});

/**
 * Site terpilih untuk loader: param URL `site` → cookie pilihan perangkat → site profil → site
 * pertama. `siteId` null = semua site dalam scope (RLS tetap membatasi).
 */
export async function parseSiteParam(sp: SearchParams, access: AppAccess): Promise<{ siteId: SiteChoice; label: string; sites: Site[] }> {
  const sites = await getMySites();
  const fromUrl = typeof sp[SITE_PARAM] === "string" ? (sp[SITE_PARAM] as string) : null;
  const fromCookie = (await cookies()).get(SITE_COOKIE)?.value ?? null;
  const siteId = resolveSite(fromUrl ?? fromCookie, sites, access.profile.locationId);
  return { siteId, label: siteLabel(siteId, sites), sites };
}
