// [starter-standar] direkonstruksi + kartu profil. Direktori orang dari public.profiles.
import "server-only";
import type { ServerClient } from "@/lib/supabase/server";
import type { Person } from "@/lib/person-types";

export type { Person } from "@/lib/person-types";

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

/** Ambil profil banyak orang sekaligus (satu query). Id tidak dikenal diabaikan. */
export async function getPeople(supabase: ServerClient, ids: (string | null | undefined)[]): Promise<Map<string, Person>> {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  const map = new Map<string, Person>();
  if (!unique.length) return map;
  const { data } = await supabase
    .schema("public")
    .from("profiles")
    .select("id, full_name, email, avatar_url, company, phone, departments(name), job_titles(name), locations(name)")
    .in("id", unique.slice(0, 500));
  for (const p of data ?? []) {
    map.set(p.id, {
      id: p.id,
      name: p.full_name,
      email: p.email,
      avatarUrl: p.avatar_url,
      company: p.company,
      phone: p.phone,
      department: one<{ name: string }>(p.departments)?.name ?? null,
      jobTitle: one<{ name: string }>(p.job_titles)?.name ?? null,
      location: one<{ name: string }>(p.locations)?.name ?? null,
    });
  }
  return map;
}
