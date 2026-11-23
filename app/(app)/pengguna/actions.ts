"use server";

// Pengguna & Akses (frontend-guide §15, backend-guide §11.5). App HANYA mengatur public.app_access
// untuk app ini dan data __APP__.members. Membuat/menghapus akun, reset password, dan profil dasar
// orang lain dikelola konsol platform. Guard admin terakhir dicek di sini sebelum menulis.
import { revalidatePath } from "next/cache";
import { dbError, fail, invalid, NOT_ALLOWED, ok, type FormState } from "@/lib/action-state";
import { APP_ID } from "@/lib/app-config";
import { actionAccess } from "@/lib/auth";
import { cctv } from "@/lib/cctv";
import { FUNCTION_LABELS, normalizeFunctions, type Fn } from "@/lib/functions";
import { countOtherActiveAdmins, countPengguna } from "@/lib/pengguna";
import { k3RolesSchema, memberSchema } from "@/lib/pengguna-rules";
import { isRole, ROLE_LABELS, type Role } from "@/lib/roles";
import { createClient, type ServerClient } from "@/lib/supabase/server";
import { escapeLike, isUuid } from "@/lib/utils";

const LAST_ADMIN = "Tidak bisa: dia admin aktif terakhir app ini. Jadikan orang lain admin dulu.";

async function profileName(supabase: ServerClient, userId: string) {
  const { data } = await supabase.schema("public").from("profiles").select("full_name, is_active, company").eq("id", userId).maybeSingle();
  return data;
}

async function currentRole(supabase: ServerClient, userId: string): Promise<Role | null> {
  const { data } = await supabase.schema("public").from("app_access").select("role").eq("app_id", APP_ID).eq("user_id", userId).maybeSingle();
  return isRole(data?.role) ? data.role : null;
}

function revalidate(userId: string) {
  revalidatePath("/pengguna");
  revalidatePath(`/pengguna/${userId}`);
}

/** Cari orang di direktori (profil aktif) yang BELUM punya akses ke app ini. */
export async function searchDirectoryAction(q: string) {
  if (!(await actionAccess("admin"))) return [];
  const supabase = await createClient();
  const pub = supabase.schema("public");
  const term = q.trim().slice(0, 50);
  let query = pub
    .from("profiles")
    .select("id, full_name, email, company, departments(name)")
    .eq("is_active", true)
    .order("full_name")
    .limit(30);
  if (term) {
    const p = `%${escapeLike(term)}%`.replace(/"/g, '\\"');
    query = query.or(["full_name", "email", "nrp_gmi", "nrp_gis"].map((c) => `${c}.ilike."${p}"`).join(","));
  }
  const { data } = await query;
  const people = data ?? [];
  if (!people.length) return [];
  const { data: existing } = await pub.from("app_access").select("user_id").eq("app_id", APP_ID).in("user_id", people.map((p) => p.id));
  const has = new Set((existing ?? []).map((e) => e.user_id));
  return people
    .filter((p) => !has.has(p.id))
    .slice(0, 15)
    .map((p) => {
      const dept = Array.isArray(p.departments) ? p.departments[0] : p.departments;
      return { value: p.id, label: p.full_name, description: [p.company, dept?.name, p.email].filter(Boolean).join(" · ") || undefined };
    });
}

export async function grantAccessAction(userId: string, role: string): Promise<FormState> {
  const me = await actionAccess("admin");
  if (!me || !isUuid(userId)) return NOT_ALLOWED;
  if (!isRole(role)) return fail("Pilih role.", { role: ["Pilih role"] });
  const supabase = await createClient();
  const person = await profileName(supabase, userId);
  if (!person) return fail("Orang ini tidak ada di direktori.");
  if (!person.is_active) return fail("Akun orang ini nonaktif. Aktifkan dulu lewat tim IT.");

  const { error } = await supabase.schema("public").from("app_access").insert({ user_id: userId, app_id: APP_ID, role, granted_by: me.userId });
  if (error) return error.code === "23505" ? fail(`${person.full_name} sudah punya akses ke app ini.`) : dbError(error);

  await cctv({
    category: "access",
    action: "access.grant",
    severity: "notice",
    summary: `Memberi akses ${ROLE_LABELS[role]} kepada ${person.full_name}`,
    entity: "app_access",
    recordId: userId,
    recordLabel: person.full_name,
    companyCode: person.company ?? undefined,
    url: `/pengguna/${userId}`,
    metadata: { role },
  });
  revalidate(userId);
  return ok(`${person.full_name} sekarang bisa membuka app ini sebagai ${ROLE_LABELS[role]}.`);
}

export async function changeRoleAction(userId: string, role: string): Promise<FormState> {
  const me = await actionAccess("admin");
  if (!me || !isUuid(userId)) return NOT_ALLOWED;
  if (!isRole(role)) return fail("Pilih role.");
  const supabase = await createClient();
  const [person, before] = await Promise.all([profileName(supabase, userId), currentRole(supabase, userId)]);
  if (!person || !before) return fail("Orang ini tidak punya akses ke app ini. Muat ulang halaman.");
  if (before === role) return ok("Role tidak berubah.");
  if (before === "admin" && (await countOtherActiveAdmins(supabase, userId)) === 0) return fail(LAST_ADMIN);

  const { data, error } = await supabase.schema("public").from("app_access").update({ role }).eq("app_id", APP_ID).eq("user_id", userId).select("user_id");
  if (error) return dbError(error);
  if (!data?.length) return fail("Perubahan tidak tersimpan. Muat ulang halaman lalu coba lagi.");

  await cctv({
    category: "access",
    action: "access.change_role",
    severity: "notice",
    summary: `Mengubah role ${person.full_name}: ${ROLE_LABELS[before]} → ${ROLE_LABELS[role]}`,
    entity: "app_access",
    recordId: userId,
    recordLabel: person.full_name,
    companyCode: person.company ?? undefined,
    url: `/pengguna/${userId}`,
    metadata: { dari: before, ke: role },
  });
  revalidate(userId);
  return ok(`Role ${person.full_name} diubah menjadi ${ROLE_LABELS[role]}.`, { self: userId === me.userId });
}

export async function revokeAccessAction(userId: string): Promise<FormState> {
  const me = await actionAccess("admin");
  if (!me || !isUuid(userId)) return NOT_ALLOWED;
  const supabase = await createClient();
  const [person, before] = await Promise.all([profileName(supabase, userId), currentRole(supabase, userId)]);
  if (!person || !before) return fail("Orang ini sudah tidak punya akses. Muat ulang halaman.");
  if (before === "admin" && (await countOtherActiveAdmins(supabase, userId)) === 0) return fail(LAST_ADMIN);

  const { data, error } = await supabase.schema("public").from("app_access").delete().eq("app_id", APP_ID).eq("user_id", userId).select("user_id");
  if (error) return dbError(error);
  if (!data?.length) return fail("Akses tidak terhapus. Muat ulang halaman lalu coba lagi.");

  await cctv({
    category: "access",
    action: "access.revoke",
    severity: "notice",
    summary: `Mencabut akses ${ROLE_LABELS[before]} ${person.full_name}`,
    entity: "app_access",
    recordId: userId,
    recordLabel: person.full_name,
    companyCode: person.company ?? undefined,
    url: `/pengguna/${userId}`,
    metadata: { role: before },
  });
  revalidate(userId);
  return ok(`Akses ${person.full_name} dicabut.`, { self: userId === me.userId });
}

export async function countPenggunaAction(): Promise<number> {
  if (!(await actionAccess("admin"))) return 0;
  return countPengguna(await createClient());
}

/** Simpan data khusus app (members) milik satu orang. Log + CCTV ditulis trigger members_log. */
export async function saveMemberAction(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await actionAccess("admin"))) return NOT_ALLOWED;
  const userId = String(fd.get("user_id") ?? "");
  if (!isUuid(userId)) return NOT_ALLOWED;
  const limitRaw = String(fd.get("approval_limit") ?? "").trim();
  const parsed = memberSchema.safeParse({
    team: String(fd.get("team") ?? ""),
    approval_limit: limitRaw === "" ? null : Number(limitRaw),
    admin_note: String(fd.get("admin_note") ?? ""),
  });
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.from("members").upsert({ user_id: userId, ...parsed.data }, { onConflict: "user_id" });
  if (error) return dbError(error);
  revalidatePath(`/pengguna/${userId}`);
  return ok("Data anggota disimpan.");
}

/**
 * Simpan fungsi K3 + batas site satu orang (rancangan §2.1, §2.2). Hanya admin app; members_guard
 * menolak perubahan oleh non-admin. Log ditulis trigger members_log; CCTV access.change_function.
 */
export async function saveK3RolesAction(userId: string, input: { functions: string[]; location_ids: string[] | null }): Promise<FormState> {
  const me = await actionAccess("admin");
  if (!me || !isUuid(userId)) return NOT_ALLOWED;
  const parsed = k3RolesSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const functions = normalizeFunctions(parsed.data.functions);
  const locationIds = parsed.data.location_ids ? [...new Set(parsed.data.location_ids)] : null;

  const supabase = await createClient();
  const [person, before, sites] = await Promise.all([
    profileName(supabase, userId),
    supabase.from("members").select("functions, location_ids").eq("user_id", userId).maybeSingle(),
    locationIds ? supabase.schema("public").from("locations").select("id").in("id", locationIds) : Promise.resolve({ data: [] as { id: string }[] }),
  ]);
  if (!person) return fail("Orang ini tidak ada di direktori.");
  if (locationIds && (sites.data ?? []).length !== locationIds.length) return fail("Ada site yang tidak dikenal. Muat ulang halaman.");

  const prevFns = normalizeFunctions(before.data?.functions ?? []);
  const prevSites = before.data?.location_ids ?? null;
  const sameFns = prevFns.join() === functions.join();
  const sameSites = JSON.stringify(prevSites ? [...prevSites].sort() : null) === JSON.stringify(locationIds ? [...locationIds].sort() : null);
  if (sameFns && sameSites) return ok("Tidak ada perubahan.");

  const { error } = await supabase.from("members").upsert({ user_id: userId, functions, location_ids: locationIds }, { onConflict: "user_id" });
  if (error) return dbError(error);

  const label = (fns: Fn[]) => (fns.length ? fns.map((f) => FUNCTION_LABELS[f]).join(", ") : "tanpa fungsi");
  await cctv({
    category: "access",
    action: "access.change_function",
    severity: "notice",
    summary: `Mengubah peran K3 ${person.full_name}: ${label(prevFns)} → ${label(functions)}${sameSites ? "" : " (batas site diubah)"}`,
    entity: "members",
    recordId: userId,
    recordLabel: person.full_name,
    companyCode: person.company ?? undefined,
    url: `/pengguna/${userId}`,
    metadata: { dari: prevFns, ke: functions, site_dari: prevSites, site_ke: locationIds },
  });
  revalidate(userId);
  return ok(`Peran K3 ${person.full_name} disimpan.`, { self: userId === me.userId });
}
