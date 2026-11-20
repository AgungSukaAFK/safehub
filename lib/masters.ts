// Master direktori platform (departemen & lokasi aktif) untuk opsi filter list.
import "server-only";
import type { ServerClient } from "@/lib/supabase/server";

export type Option = { value: string; label: string };

export async function getDirectoryMasters(supabase: ServerClient) {
  const pub = supabase.schema("public");
  const [d, l] = await Promise.all([
    pub.from("departments").select("id, name").eq("is_active", true).order("name"),
    pub.from("locations").select("id, name").eq("is_active", true).order("name"),
  ]);
  return {
    departments: (d.data ?? []).map((x) => ({ value: x.id, label: x.name })) as Option[],
    locations: (l.data ?? []).map((x) => ({ value: x.id, label: x.name })) as Option[],
  };
}

/** "id1,id2" → "Nama 1, Nama 2" (untuk chip filter & sheet Keterangan). */
export const labelsOf = (ids: string[], opts: Option[]) => ids.map((id) => opts.find((o) => o.value === id)?.label ?? id).join(", ");
