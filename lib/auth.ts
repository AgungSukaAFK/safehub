// [starter-standar] direkonstruksi; selaraskan dengan lourdes-db/templates/next-app
import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { APP_ID } from "@/lib/app-config";
import type { AppAccess } from "@/lib/access-types";
import { cctv } from "@/lib/cctv";
import { isRole, roleAtLeast, type Role } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export type { AppAccess } from "@/lib/access-types";

type AccessResult =
  | { status: "guest" }
  | { status: "inactive" } // profil tidak ada / nonaktif
  | { status: "no-access" } // login, tapi tidak punya role di app ini
  | { status: "ok"; access: AppAccess };

/**
 * Baca akses user SEKALI per request (React cache). Sumber: auth (JWT tervalidasi),
 * public.profiles, public.app_access (role app ini + admin platform).
 */
export const getAccessResult = cache(async (): Promise<AccessResult> => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return { status: "guest" };

  const pub = supabase.schema("public");
  const [profileRes, accessRes] = await Promise.all([
    pub
      .from("profiles")
      .select(
        "id, email, full_name, avatar_url, company, phone, is_active, department_id, departments(name), job_titles(name), locations(name)",
      )
      .eq("id", userId)
      .maybeSingle(),
    pub.from("app_access").select("app_id, role").eq("user_id", userId).in("app_id", [APP_ID, "platform"]),
  ]);

  const p = profileRes.data;
  if (!p || !p.is_active) return { status: "inactive" };

  const rows = (accessRes.data ?? []) as { app_id: string; role: string }[];
  const platformAdmin = rows.some((r) => r.app_id === "platform" && r.role === "admin");
  const appRole = rows.find((r) => r.app_id === APP_ID)?.role;
  const role: Role | null = platformAdmin ? "admin" : isRole(appRole) ? appRole : null;
  if (!role) return { status: "no-access" };

  const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

  return {
    status: "ok",
    access: {
      userId,
      email: p.email ?? (claimsData?.claims?.email as string | undefined) ?? "",
      role,
      platformAdmin,
      profile: {
        fullName: p.full_name ?? p.email ?? "Tanpa nama",
        avatarUrl: p.avatar_url ?? null,
        company: p.company ?? null,
        departmentId: p.department_id ?? null,
        departmentName: one<{ name: string }>(p.departments)?.name ?? null,
        jobTitleName: one<{ name: string }>(p.job_titles)?.name ?? null,
        locationName: one<{ name: string }>(p.locations)?.name ?? null,
        phone: p.phone ?? null,
      },
    },
  };
});

/** Akses user saat ini, atau null (tamu / tanpa akses). Tidak redirect. */
export async function getAccess(): Promise<AppAccess | null> {
  const r = await getAccessResult();
  return r.status === "ok" ? r.access : null;
}

/**
 * Gerbang halaman (Server Component). Tamu → login; tanpa akses/nonaktif → /no-access;
 * role kurang → beranda dengan pesan + CCTV access.denied_page.
 */
export async function requireAccess(min: Role = "viewer"): Promise<AppAccess> {
  const r = await getAccessResult();
  if (r.status === "guest") redirect("/auth/login");
  if (r.status !== "ok") redirect("/no-access");
  if (!roleAtLeast(r.access.role, min)) {
    const path = (await headers()).get("x-pathname") ?? "";
    await cctv({
      category: "access",
      action: "access.denied_page",
      severity: "warning",
      summary: `Akses halaman ditolak (butuh role ${min}, punya ${r.access.role})`,
      metadata: { butuh: min, punya: r.access.role, path },
    });
    redirect("/?pesan=akses-ditolak");
  }
  return r.access;
}

/** Gerbang Server Action / route handler: null kalau tidak boleh (pakai NOT_ALLOWED). */
export async function actionAccess(min: Role = "viewer"): Promise<AppAccess | null> {
  const access = await getAccess();
  return access && roleAtLeast(access.role, min) ? access : null;
}
