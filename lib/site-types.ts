// Pemilih site (rancangan §2.2, D2/D13). Site = public.locations dalam my_location_scope().
// Aman dipakai client + server. Server: lib/sites.ts (parseSiteParam). Client: SitePicker.
import { APP_ID } from "@/lib/app-config";

export type Site = { id: string; name: string };

/** Param URL loader: `site=<uuid>` atau `site=semua`. */
export const SITE_PARAM = "site";
export const SITE_ALL = "semua";
/** Key preferensi per perangkat (lib/storage.ts) */
export const SITE_STORAGE_KEY = "site";
/**
 * Cermin pilihan site di cookie supaya Server Component membaca pilihan perangkat tanpa
 * navigasi ulang saat URL belum punya `site` (penyimpangan kecil dari §2.2, dicatat di CLAUDE.md).
 */
export const SITE_COOKIE = `${APP_ID}-site`;

/** Nilai pilihan site: id site, atau null = semua site dalam scope. */
export type SiteChoice = string | null;

/**
 * Tentukan site terpilih: nilai mentah (URL lalu cookie) kalau sah, selain itu default =
 * site profil user, atau site pertama. "Semua" hanya sah kalau user boleh melihat > 1 site.
 */
export function resolveSite(raw: string | null | undefined, sites: Site[], profileLocationId: string | null): SiteChoice {
  if (!sites.length) return null;
  if (raw === SITE_ALL && sites.length > 1) return null;
  if (raw && sites.some((s) => s.id === raw)) return raw;
  if (profileLocationId && sites.some((s) => s.id === profileLocationId)) return profileLocationId;
  return sites[0].id;
}

export function siteLabel(choice: SiteChoice, sites: Site[]): string {
  if (choice === null) return "Semua site";
  return sites.find((s) => s.id === choice)?.name ?? "Site";
}
