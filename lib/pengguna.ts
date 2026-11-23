// Loader Pengguna & Akses (frontend-guide §15.2, backend-guide §11.5). SATU sumber untuk tabel dan
// ekspor Excel. Data dari public.app_access (app ini) + public.profiles; RLS app_access hanya
// mengizinkan admin app membaca baris orang lain.
import "server-only";
import type { FilterChip } from "@/components/list/filter-panel";
import { APP_ID } from "@/lib/app-config";
import type { ExcelColumn } from "@/lib/excel";
import { FUNCTION_LABELS, FUNCTIONS, normalizeFunctions, type Fn } from "@/lib/functions";
import { ACTIVE_STATUSES, PENGGUNA_SORTS } from "@/lib/pengguna-rules";
import { labelsOf, type Option } from "@/lib/masters";
import { getPeople, type Person } from "@/lib/people";
import { isRole, ROLE_LABELS, ROLES, type Role } from "@/lib/roles";
import { listParam, pageParam, pageSizeParam, sortParam, textParam, type SearchParams } from "@/lib/search-params";
import type { ServerClient } from "@/lib/supabase/server";

export { getDirectoryMasters } from "@/lib/masters";
import { orIlikeFilter, searchTerms } from "@/lib/utils";

export const MAX_EXPORT_ROWS = 20_000;
const BATCH = 1000;

// ---------------------------------------------------------------- filter

export type PenggunaFilters = {
  q: string;
  roles: Role[];
  functions: Fn[];
  companies: string[];
  departments: string[];
  locations: string[];
  status: (typeof ACTIVE_STATUSES)[number][];
  sort: ReturnType<typeof sortParam<(typeof PENGGUNA_SORTS)[number]>>;
  page: number;
  size: number;
};

export function parsePenggunaParams(
  sp: SearchParams,
  allowed: { companies: string[]; departments: string[]; locations: string[] },
): PenggunaFilters {
  return {
    q: textParam(sp, "q"),
    roles: listParam(sp, "role", ROLES),
    functions: listParam(sp, "fungsi", FUNCTIONS),
    companies: listParam(sp, "perusahaan", allowed.companies),
    departments: listParam(sp, "departemen", allowed.departments),
    locations: listParam(sp, "lokasi", allowed.locations),
    status: listParam(sp, "status", ACTIVE_STATUSES),
    sort: sortParam(sp, PENGGUNA_SORTS, { key: "nama", dir: "asc" }),
    page: pageParam(sp),
    size: pageSizeParam(sp),
  };
}

export function penggunaChips(f: PenggunaFilters, masters: { departments: Option[]; locations: Option[] }): FilterChip[] {
  const chips: FilterChip[] = [];
  if (f.roles.length) chips.push({ key: "role", label: "Role", value: f.roles.map((r) => ROLE_LABELS[r]).join(", "), params: ["role"] });
  if (f.functions.length)
    chips.push({ key: "fungsi", label: "Fungsi K3", value: f.functions.map((x) => FUNCTION_LABELS[x]).join(", "), params: ["fungsi"] });
  if (f.companies.length) chips.push({ key: "perusahaan", label: "Perusahaan", value: f.companies.join(", "), params: ["perusahaan"] });
  if (f.departments.length)
    chips.push({ key: "departemen", label: "Departemen", value: labelsOf(f.departments, masters.departments), params: ["departemen"] });
  if (f.locations.length) chips.push({ key: "lokasi", label: "Lokasi", value: labelsOf(f.locations, masters.locations), params: ["lokasi"] });
  if (f.status.length)
    chips.push({ key: "status", label: "Status", value: f.status.map((s) => (s === "aktif" ? "Aktif" : "Nonaktif")).join(", "), params: ["status"] });
  return chips;
}

export function penggunaFilterText(f: PenggunaFilters, masters: { departments: Option[]; locations: Option[] }): string {
  const parts = penggunaChips(f, masters).map((c) => `${c.label}: ${c.value}`);
  if (f.q) parts.unshift(`Kata kunci: "${f.q}"`);
  return parts.join("; ") || "Tanpa filter";
}

// ---------------------------------------------------------------- list

export type PenggunaRow = {
  userId: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  company: string | null;
  department: string | null;
  jobTitle: string | null;
  location: string | null;
  isActive: boolean;
  role: Role;
  functions: Fn[];
  grantedAt: string;
  grantedBy: Pick<Person, "id" | "name" | "avatarUrl"> | null;
};

// `profile` = alias embed profiles lewat FK user_id (app_access punya 2 FK ke profiles).
// !inner: filter di profile ikut menyaring baris app_access.
const SELECT =
  "user_id, role, granted_at, granted_by, profile:profiles!app_access_user_id_fkey!inner(id, full_name, email, avatar_url, company, is_active, departments(name), job_titles(name), locations(name))";

const SORT_COLUMN: Record<(typeof PENGGUNA_SORTS)[number], string> = {
  nama: "profile(full_name)",
  role: "role",
  diberikan: "granted_at",
};

/** userIds: hasil pra-filter fungsi K3 (members ada di schema app, tidak bisa di-embed dari public). */
function baseQuery(supabase: ServerClient, f: PenggunaFilters, count: boolean, userIds: string[] | null) {
  let q = supabase
    .schema("public")
    .from("app_access")
    .select(SELECT, count ? { count: "exact" } : undefined)
    .eq("app_id", APP_ID);
  const terms = searchTerms(f.q);
  if (terms.length) {
    // semua kata harus cocok di salah satu kolom: and(or(...), or(...))
    const groups = terms.map((t) => `or(${orIlikeFilter(["full_name", "email", "nrp_gmi", "nrp_gis"], t)})`).join(",");
    q = q.or(`and(${groups})`, { referencedTable: "profile" });
  }
  if (f.roles.length) q = q.in("role", f.roles);
  if (userIds) q = q.in("user_id", userIds);
  if (f.companies.length) q = q.in("profile.company", f.companies);
  if (f.departments.length) q = q.in("profile.department_id", f.departments);
  if (f.locations.length) q = q.in("profile.location_id", f.locations);
  if (f.status.length === 1) q = q.eq("profile.is_active", f.status[0] === "aktif");
  return q
    .order(SORT_COLUMN[f.sort.key], { ascending: f.sort.dir === "asc", nullsFirst: false })
    .order("user_id", { ascending: true });
}

type RawRow = {
  user_id: string;
  role: string;
  granted_at: string;
  granted_by: string | null;
  profile: {
    id: string;
    full_name: string;
    email: string | null;
    avatar_url: string | null;
    company: string | null;
    is_active: boolean;
    departments: { name: string } | { name: string }[] | null;
    job_titles: { name: string } | { name: string }[] | null;
    locations: { name: string } | { name: string }[] | null;
  };
};

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

/** Pra-filter fungsi K3: user yang punya salah satu fungsi terpilih (null = tanpa filter). */
async function usersWithFunctions(supabase: ServerClient, fns: Fn[]): Promise<string[] | null> {
  if (!fns.length) return null;
  const { data, error } = await supabase.from("members").select("user_id").overlaps("functions", fns);
  if (error) throw error;
  return (data ?? []).map((m) => m.user_id);
}

async function functionsOf(supabase: ServerClient, userIds: string[]): Promise<Map<string, Fn[]>> {
  const map = new Map<string, Fn[]>();
  for (let i = 0; i < userIds.length; i += BATCH) {
    const { data, error } = await supabase.from("members").select("user_id, functions").in("user_id", userIds.slice(i, i + BATCH));
    if (error) throw error;
    (data ?? []).forEach((m) => map.set(m.user_id, normalizeFunctions(m.functions ?? [])));
  }
  return map;
}

async function hydrate(supabase: ServerClient, raw: RawRow[]): Promise<PenggunaRow[]> {
  const [people, fns] = await Promise.all([getPeople(supabase, raw.map((r) => r.granted_by)), functionsOf(supabase, raw.map((r) => r.user_id))]);
  return raw.map((r) => {
    const g = r.granted_by ? people.get(r.granted_by) : null;
    return {
      userId: r.user_id,
      name: r.profile.full_name,
      email: r.profile.email,
      avatarUrl: r.profile.avatar_url,
      company: r.profile.company,
      department: one(r.profile.departments)?.name ?? null,
      jobTitle: one(r.profile.job_titles)?.name ?? null,
      location: one(r.profile.locations)?.name ?? null,
      isActive: r.profile.is_active,
      role: isRole(r.role) ? r.role : "viewer",
      functions: fns.get(r.user_id) ?? [],
      grantedAt: r.granted_at,
      grantedBy: g ? { id: g.id, name: g.name, avatarUrl: g.avatarUrl } : null,
    };
  });
}

export class TooManyRowsError extends Error {}

/** Satu halaman (tabel) atau semua baris (`all: true`, ekspor) dengan filter yang sama. */
export async function listPengguna(supabase: ServerClient, f: PenggunaFilters, opts: { all?: boolean } = {}) {
  const userIds = await usersWithFunctions(supabase, f.functions);
  if (userIds && !userIds.length) return { rows: [] as PenggunaRow[], total: 0 };
  if (opts.all) {
    const raw: RawRow[] = [];
    for (let from = 0; ; from += BATCH) {
      const { data, error } = await baseQuery(supabase, f, false, userIds).range(from, from + BATCH - 1);
      if (error) throw error;
      raw.push(...((data ?? []) as unknown as RawRow[]));
      if (raw.length > MAX_EXPORT_ROWS) throw new TooManyRowsError("Terlalu banyak data, persempit filter dulu.");
      if (!data || data.length < BATCH) break;
    }
    return { rows: await hydrate(supabase, raw), total: raw.length };
  }
  const from = (f.page - 1) * f.size;
  const { data, error, count } = await baseQuery(supabase, f, true, userIds).range(from, from + f.size - 1);
  if (error) throw error;
  return { rows: await hydrate(supabase, (data ?? []) as unknown as RawRow[]), total: count ?? 0 };
}

export async function countPengguna(supabase: ServerClient) {
  const { count } = await supabase.schema("public").from("app_access").select("user_id", { count: "exact", head: true }).eq("app_id", APP_ID);
  return count ?? 0;
}

export const PENGGUNA_EXPORT_COLUMNS: ExcelColumn<PenggunaRow>[] = [
  { header: "Nama", value: (r) => r.name },
  { header: "Email", value: (r) => r.email },
  { header: "Perusahaan", value: (r) => r.company },
  { header: "Departemen", value: (r) => r.department },
  { header: "Jabatan", value: (r) => r.jobTitle },
  { header: "Lokasi", value: (r) => r.location },
  { header: "Role", value: (r) => ROLE_LABELS[r.role] },
  { header: "Fungsi K3", value: (r) => r.functions.map((x) => FUNCTION_LABELS[x]).join(", ") || null },
  { header: "Status Akun", value: (r) => (r.isActive ? "Aktif" : "Nonaktif") },
  { header: "Diberikan Oleh", value: (r) => r.grantedBy?.name ?? null },
  { header: "Tanggal Diberikan", type: "datetime", value: (r) => r.grantedAt },
];

// ---------------------------------------------------------------- admin terakhir

/**
 * Jumlah admin app yang AKTIF selain `exceptUserId`. Dipakai guard sebelum menurunkan/mencabut
 * admin (backend-guide §11.5): app tidak boleh kehilangan admin terakhirnya. Admin platform tidak
 * dihitung karena aksesnya berasal dari platform, bukan dari app ini.
 */
export async function countOtherActiveAdmins(supabase: ServerClient, exceptUserId: string) {
  const { count, error } = await supabase
    .schema("public")
    .from("app_access")
    .select("user_id, profile:profiles!app_access_user_id_fkey!inner(is_active)", { count: "exact", head: true })
    .eq("app_id", APP_ID)
    .eq("role", "admin")
    .eq("profile.is_active", true)
    .neq("user_id", exceptUserId);
  if (error) throw error;
  return count ?? 0;
}

// ---------------------------------------------------------------- detail

export type PenggunaDetail = {
  person: Person & { isActive: boolean; nrp: string | null };
  access: { role: Role; grantedAt: string; grantedBy: Pick<Person, "id" | "name" | "avatarUrl"> | null } | null;
  member: {
    id: string;
    team: string | null;
    approvalLimit: number | null;
    adminNote: string | null;
    functions: Fn[];
    locationIds: string[] | null;
    updatedAt: string;
  } | null;
};

export async function getPenggunaDetail(supabase: ServerClient, userId: string): Promise<PenggunaDetail | null> {
  const pub = supabase.schema("public");
  const [p, a, m] = await Promise.all([
    pub
      .from("profiles")
      .select("id, full_name, email, avatar_url, company, phone, is_active, nrp_gmi, nrp_gis, departments(name), job_titles(name), locations(name)")
      .eq("id", userId)
      .maybeSingle(),
    pub.from("app_access").select("role, granted_at, granted_by").eq("app_id", APP_ID).eq("user_id", userId).maybeSingle(),
    supabase.from("members").select("id, team, approval_limit, admin_note, functions, location_ids, updated_at").eq("user_id", userId).maybeSingle(),
  ]);
  if (!p.data) return null;
  const granter = a.data?.granted_by ? (await getPeople(supabase, [a.data.granted_by])).get(a.data.granted_by) : null;
  const d = p.data;
  return {
    person: {
      id: d.id,
      name: d.full_name,
      email: d.email,
      avatarUrl: d.avatar_url,
      company: d.company,
      phone: d.phone,
      department: one<{ name: string }>(d.departments)?.name ?? null,
      jobTitle: one<{ name: string }>(d.job_titles)?.name ?? null,
      location: one<{ name: string }>(d.locations)?.name ?? null,
      isActive: d.is_active,
      nrp: d.nrp_gmi ?? d.nrp_gis ?? null,
    },
    access: a.data
      ? {
          role: isRole(a.data.role) ? a.data.role : "viewer",
          grantedAt: a.data.granted_at,
          grantedBy: granter ? { id: granter.id, name: granter.name, avatarUrl: granter.avatarUrl } : null,
        }
      : null,
    member: m.data
      ? {
          id: m.data.id,
          team: m.data.team,
          approvalLimit: m.data.approval_limit === null ? null : Number(m.data.approval_limit),
          adminNote: m.data.admin_note,
          functions: normalizeFunctions(m.data.functions ?? []),
          locationIds: m.data.location_ids ?? null,
          updatedAt: m.data.updated_at,
        }
      : null,
  };
}
