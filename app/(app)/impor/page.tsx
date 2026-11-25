import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Content } from "@/components/list/content";
import { PageHeader } from "@/components/page-header";
import { requireAccess } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { IMPORT_TARGETS, type ImportGroup, type ImportTargetId } from "@/lib/import/targets";
import { parseSiteParam } from "@/lib/sites";
import { createClient } from "@/lib/supabase/server";
import { ImportWizard } from "./import-wizard";

export const metadata: Metadata = { title: "Impor Data" };

// Impor Data (rancangan §2.12): data awal dari Excel. Hanya HR, HSE, admin (sama dengan hak mengelola data people).
export default async function ImporPage({ searchParams }: PageProps<"/impor">) {
  const access = await requireAccess("viewer");
  const isAdmin = access.role === "admin" || access.platformAdmin;
  const writer = isAdmin || !access.functions.includes("auditor");
  const groups: ImportGroup[] = [];
  if (isAdmin || (writer && (access.functions.includes("hr") || access.functions.includes("hse")))) groups.push("people");
  if (isAdmin || (writer && (access.functions.includes("maintenance") || access.functions.includes("hse")))) groups.push("maintenance");
  if (isAdmin || (writer && (access.functions.includes("hse") || access.functions.includes("pengawas") || access.functions.includes("pjo")))) groups.push("tsp");
  if (groups.length === 0) redirect("/");
  const sp = await searchParams;
  const { siteId, sites } = await parseSiteParam(sp, access);
  const supabase = await createClient();
  const { data: jobs } = await supabase.from("import_jobs").select("id, target, mode, filename, total, ok_count, failed_count, created_at").order("created_at", { ascending: false }).limit(10);
  const defaultSite = siteId ?? (access.profile.locationId && sites.some((s) => s.id === access.profile.locationId) ? access.profile.locationId : (sites[0]?.id ?? null));

  return (
    <>
      <PageHeader title="Impor Data" description="Masukkan data awal manpower dan data dari sistem maintenance lewat Excel: unggah, cocokkan kolom, periksa, lalu impor" />
      <div className="col-span-12 flex flex-col gap-4">
        <ImportWizard sites={sites.map((s) => ({ id: s.id, name: s.name }))} defaultSite={defaultSite} groups={groups} />
        <Content title="Riwayat Impor" description="10 impor terakhir Anda">
          {(jobs ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada impor.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground"><tr>{["Waktu", "Data", "File", "Mode", "Total", "Berhasil", "Gagal"].map((h) => <th key={h} scope="col" className="px-3 py-2 text-left font-medium">{h}</th>)}</tr></thead>
                <tbody>
                  {(jobs ?? []).map((j) => (
                    <tr key={j.id} className="border-t">
                      <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(j.created_at)}</td>
                      <td className="px-3 py-2">{IMPORT_TARGETS[j.target as ImportTargetId]?.label ?? j.target}</td>
                      <td className="px-3 py-2">{j.filename ?? "-"}</td>
                      <td className="px-3 py-2">{j.mode === "insert" ? "Tambah baru" : "Perbarui"}</td>
                      <td className="px-3 py-2 tabular-nums">{j.total}</td>
                      <td className="px-3 py-2 tabular-nums">{j.ok_count}</td>
                      <td className="px-3 py-2 tabular-nums">{j.failed_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Content>
      </div>
    </>
  );
}
