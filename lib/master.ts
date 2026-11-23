// Loader Master Data (rancangan §4.13). Satu bentuk baris untuk semua jenis supaya halaman /master
// generik. Jenis read-only (site, jabatan) dibaca dari master platform.
import "server-only";
import { getCompanies } from "@/lib/companies";
import { MASTER_TABLES, type MasterKind } from "@/lib/master-rules";
import type { ServerClient } from "@/lib/supabase/server";

export type MasterValue = string | number | boolean | null;
export type MasterRow = { id: string; name: string; isActive: boolean; values: Record<string, MasterValue> };
export type MasterOptions = { sites: { value: string; label: string }[]; companies: { value: string; label: string }[] };

export async function getMasterOptions(supabase: ServerClient): Promise<MasterOptions> {
  const [sites, companies] = await Promise.all([
    supabase.schema("public").from("locations").select("id, name").order("name"),
    getCompanies(),
  ]);
  return {
    sites: (sites.data ?? []).map((s) => ({ value: s.id, label: s.name })),
    companies: companies.filter((c) => !c.isGroup).map((c) => ({ value: c.code, label: c.shortName })),
  };
}

export async function listMaster(supabase: ServerClient, kind: MasterKind): Promise<MasterRow[]> {
  if (kind === "site") {
    const { data, error } = await supabase.schema("public").from("locations").select("id, name, is_active").order("name");
    if (error) throw error;
    return (data ?? []).map((r) => ({ id: r.id, name: r.name, isActive: r.is_active, values: {} }));
  }
  if (kind === "jabatan") {
    const { data, error } = await supabase.schema("public").from("job_titles").select("id, name, is_active").order("name");
    if (error) throw error;
    return (data ?? []).map((r) => ({ id: r.id, name: r.name, isActive: r.is_active, values: {} }));
  }
  const t = MASTER_TABLES[kind];
  if (t.table === "areas") {
    const { data, error } = await supabase.from("areas").select("id, name, location_id, sort_order, is_active").order("sort_order").order("name");
    if (error) throw error;
    return (data ?? []).map((r) => ({ id: r.id, name: r.name, isActive: r.is_active, values: { location_id: r.location_id, name: r.name, sort_order: r.sort_order } }));
  }
  if (t.table === "contractors") {
    const { data, error } = await supabase.from("contractors").select("id, name, company_code, kind, is_active").order("name");
    if (error) throw error;
    return (data ?? []).map((r) => ({ id: r.id, name: r.name, isActive: r.is_active, values: { company_code: r.company_code, name: r.name, kind: r.kind } }));
  }
  const { data, error } = await supabase
    .from("master_items")
    .select("id, code, name, description, color, sort_order, is_active")
    .eq("kind", t.itemKind!)
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    isActive: r.is_active,
    values: { code: r.code, name: r.name, description: r.description, color: r.color, sort_order: r.sort_order },
  }));
}

/** Jumlah baris per jenis (untuk tab). */
export async function countMasters(supabase: ServerClient): Promise<Record<MasterKind, number>> {
  const head = { count: "exact" as const, head: true };
  const [area, cat, risk, mitra, site, jabatan] = await Promise.all([
    supabase.from("areas").select("id", head),
    supabase.from("master_items").select("id", head).eq("kind", "incident_category"),
    supabase.from("master_items").select("id", head).eq("kind", "risk_level"),
    supabase.from("contractors").select("id", head),
    supabase.schema("public").from("locations").select("id", head),
    supabase.schema("public").from("job_titles").select("id", head),
  ]);
  return {
    area: area.count ?? 0,
    "kategori-kejadian": cat.count ?? 0,
    "tingkat-risiko": risk.count ?? 0,
    mitra: mitra.count ?? 0,
    site: site.count ?? 0,
    jabatan: jabatan.count ?? 0,
  };
}
