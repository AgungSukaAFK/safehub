// Data acuan bersama modul K3 (kejadian, temuan, PICA): master berkode, area per site, pilihan orang,
// mitra. Server-only; dipanggil sekali per halaman lalu dioper ke client sebagai data biasa.
import "server-only";
import { cache } from "react";
import type { SelectOption } from "@/components/form/searchable-select";
import type { AppAccess } from "@/lib/access-types";
import { getCompanies } from "@/lib/companies";
import { FUNCTION_LABELS, isFn, type Fn } from "@/lib/functions";
import type { StatusColor, StatusDef } from "@/lib/status";
import type { ServerClient } from "@/lib/supabase/server";

export type MasterOption = { value: string; label: string; color: StatusColor | null; isActive: boolean };
export type K3Masters = {
  incidentCategories: MasterOption[];
  findingCategories: MasterOption[];
  riskLevels: MasterOption[];
};

/** Master berkode (termasuk yang nonaktif, untuk label data lama; form memfilter isActive). */
export const getK3Masters = cache(async (supabase: ServerClient): Promise<K3Masters> => {
  const { data, error } = await supabase
    .from("master_items")
    .select("kind, code, name, color, is_active")
    .in("kind", ["incident_category", "finding_category", "risk_level"])
    .order("sort_order")
    .order("name");
  if (error) throw error;
  const by = (k: string) =>
    (data ?? []).filter((r) => r.kind === k).map((r) => ({ value: r.code, label: r.name, color: (r.color as StatusColor | null) ?? null, isActive: r.is_active }));
  return { incidentCategories: by("incident_category"), findingCategories: by("finding_category"), riskLevels: by("risk_level") };
});

/** Peta status untuk StatusBadge dari master berwarna (tingkat risiko). */
export function masterStatusMap(opts: MasterOption[]): Record<string, StatusDef> {
  return Object.fromEntries(opts.map((o) => [o.value, { label: o.label, color: o.color ?? "gray" }]));
}

export const labelOf = (opts: { value: string; label: string }[], v: string | null | undefined) =>
  v ? (opts.find((o) => o.value === v)?.label ?? v) : null;

export type AreaOption = { value: string; label: string; siteId: string; isActive: boolean };

/** Area dalam scope site user (RLS), semua site. */
export const getAreas = cache(async (supabase: ServerClient): Promise<AreaOption[]> => {
  const { data, error } = await supabase.from("areas").select("id, name, location_id, is_active").order("sort_order").order("name");
  if (error) throw error;
  return (data ?? []).map((a) => ({ value: a.id, label: a.name, siteId: a.location_id, isActive: a.is_active }));
});

export type PersonOption = SelectOption & { functions: Fn[] };

/** Pilihan orang (PIC, verifikator, atasan, tim): user aktif app dalam scope company. */
export const getK3People = cache(async (supabase: ServerClient): Promise<PersonOption[]> => {
  const { data, error } = await supabase.rpc("k3_user_options", {});
  if (error) throw error;
  return (data ?? []).map((u) => {
    const fns = (u.functions ?? []).filter(isFn);
    const fnText = fns.map((f) => FUNCTION_LABELS[f]).join(", ");
    return {
      value: u.id,
      label: u.name,
      description: [u.job_title, fnText || u.department].filter(Boolean).join(" · ") || undefined,
      functions: fns,
    };
  });
});

/** Mitra aktif (pihak terkait dari kontraktor). */
export const getContractorOptions = cache(async (supabase: ServerClient): Promise<SelectOption[]> => {
  const { data } = await supabase.from("contractors").select("id, name, company_code").eq("is_active", true).order("name");
  return (data ?? []).map((c) => ({ value: c.id, label: c.name, description: c.company_code }));
});

/** Perusahaan tempat user boleh mencatat (bukan grup). User ber-company tunggal: hanya company-nya. */
export async function getWritableCompanies(access: AppAccess): Promise<SelectOption[]> {
  const all = (await getCompanies()).filter((c) => !c.isGroup).map((c) => ({ value: c.code, label: c.shortName }));
  const mine = access.profile.company;
  if (mine && all.some((c) => c.value === mine) && !access.platformAdmin) return all.filter((c) => c.value === mine);
  return all;
}

/** Hari ini (WIB) sebagai YYYY-MM-DD untuk overdue/umur di loader. */
export function todayWibIso(now: Date = new Date()): string {
  return new Date(now.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
}
