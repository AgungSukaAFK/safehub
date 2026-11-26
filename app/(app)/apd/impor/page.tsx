import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Content } from "@/components/list/content";
import { PageHeader } from "@/components/page-header";
import { getLocationNames } from "@/lib/apd";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ApdImportWizard } from "./import-wizard";

export const metadata: Metadata = { title: "Impor Data Lama APD" };

// Impor sekali workbook "Monitoring APD GMI 2026.xlsx" (U4 lewat app): server membaca file, admin memetakan kode site → lokasi,
// RPC apd_import_legacy menulis semuanya dalam satu transaksi. Hanya pengelola APD (hse/hse_senior/scm/admin).
export default async function ApdImportPage() {
  const access = await requireAccess("viewer");
  const isAdmin = access.role === "admin" || access.platformAdmin;
  const canManage = isAdmin || (!access.functions.includes("auditor") && access.functions.some((f) => f === "hse" || f === "hse_senior" || f === "scm"));
  if (!canManage) redirect("/apd");
  const supabase = await createClient();
  const [names, { count }] = await Promise.all([
    getLocationNames(supabase),
    supabase.from("apd_stock_moves").select("id", { count: "exact", head: true }).eq("source", "import"),
  ]);
  const locations = [...names.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "id"));
  const done = (count ?? 0) > 0;

  return (
    <>
      <PageHeader title="Impor Data Lama APD" description="Sekali saja: master barang, stok awal, barang masuk, pengiriman, dan permintaan (MTR MR) dari Excel Monitoring APD." />
      {done ? (
        <Content title="Sudah diimpor">
          <p className="text-sm">Data lama Monitoring APD sudah pernah diimpor. Lihat hasilnya di <Link href="/apd?tab=stok" className="underline underline-offset-2">Stok</Link> dan{" "}
            <Link href="/apd/pengajuan" className="underline underline-offset-2">Pengajuan APD</Link>. Transaksi berikutnya dicatat langsung di aplikasi.</p>
        </Content>
      ) : (
        <ApdImportWizard locations={locations} />
      )}
    </>
  );
}
