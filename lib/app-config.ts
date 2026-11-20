// Identitas app. Nilai "safehub" / "Safe Hub" adalah PENANDA boilerplate:
// scripts/create-app.sh menggantinya; kalau masih terlihat di app nyata, berarti belum diganti.
// Satu-satunya tempat nilai ini ditulis di kode TypeScript (db/ memakai __APP__/__HOST__).

/** app_id = nama schema Postgres & id di public.apps */
export const APP_ID = "safehub";
/** Subdomain: https://<APP_HOST>.lourdes.cloud, juga prefix bucket storage */
export const APP_HOST = "safehub";
export const APP_NAME = "Safe Hub";
export const APP_SHORT_NAME = "SAFE HUB";
export const APP_DESCRIPTION = "Safe Hub, app Lourdes.";
export const APP_URL = `https://${APP_HOST}.lourdes.cloud`;

/** Bucket storage (backend-guide §13) */
export const BUCKET_LAMPIRAN = `${APP_HOST}-lampiran`;
export const BUCKET_MEDIA = `${APP_HOST}-media`;
export const BUCKET_AVATARS = "avatars";

export const PLATFORM_CONSOLE_URL = "https://monitoring.lourdes.cloud";
