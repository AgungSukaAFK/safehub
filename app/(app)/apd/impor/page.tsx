import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Content } from "@/components/list/content";
import { PageHeader } from "@/components/page-header";
import { getLocationNames, listEmployeesBySite, listUnlinked } from "@/lib/apd";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ApdImportWizard } from "./import-wizard";
import { UnlinkedList } from "./link-list";
import { ApdPopulationWizard } from "./population-wizard";

export const metadata: Metadata = { title: "Impor Data APD" };

// Pindahan dari Excel "Monitoring APD": (1) stok & transaksi lama (sekali, RPC apd_import_legacy), (2) karyawan + ukuran + riwayat
// dari sheet Populasi Manpower (boleh diulang, apd_import_population), (3) tautan manual nama data lama → karyawan.
export default async function ApdImportPage() {
  const access = await requireAccess("viewer");
  const isAdmin = access.role === "admin" || access.platformAdmin;
  const writer = isAdmin || !access.functions.includes("auditor");
  const canStock = isAdmin || (writer && access.functions.some((f) => f === "hse" || f === "hse_senior" || f === "scm"));
  const canPeople = isAdmin || (writer && access.functions.some((f) => f === "hr" || f === "hse"));
  if (!canStock && !canPeople) redirect("/apd");
  const supabase = await createClient();
  const [names, { count }, unlinked] = await Promise.all([
    getLocationNames(supabase),
    supabase.from("apd_stock_moves").select("id", { count: "exact", head: true }).eq("source", "import"),
    listUnlinked(supabase),
  ]);
  const locations = [...names.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "id"));
  const employees = await listEmployeesBySite(supabase, [...new Set(unlinked.map((u) => u.locationId))]);
  const done = (count ?? 0) > 0;

  return (
    <>
      <PageHeader title="Impor Data APD" description="Pindahkan isi Excel Monitoring APD ke aplikasi: stok & transaksi lama, data karyawan (Populasi Manpower), lalu tautkan riwayat ke karyawan." />
      {canStock &&
        (done ? (
          <Content title="1. Stok & Transaksi Lama" description="Sudah diimpor (sekali saja).">
            <p className="text-sm">Lihat hasilnya di <Link href="/apd?tab=stok" className="underline underline-offset-2">Stok</Link> dan <Link href="/apd/pengajuan" className="underline underline-offset-2">Pengajuan APD</Link>. Transaksi berikutnya dicatat langsung di aplikasi.</p>
          </Content>
        ) : (
          <ApdImportWizard locations={locations} />
        ))}
      {canPeople ? (
        <ApdPopulationWizard locations={locations} />
      ) : (
        <Content title="Data Karyawan APD"><p className="text-sm text-muted-foreground">Impor karyawan dilakukan HR atau HSE.</p></Content>
      )}
      <Content
        title="Tautkan Riwayat Lama ke Karyawan"
        description={unlinked.length ? `${unlinked.length} nama dari Excel belum tertaut. Pilih karyawan yang sesuai (usulan = nama termirip di site yang sama), lalu Tautkan. Nama yang bukan karyawan (mis. vendor) boleh dibiarkan.` : "Semua pengiriman dan pengajuan lama sudah tertaut ke karyawan."}
      >
        {unlinked.length > 0 && <UnlinkedList rows={unlinked} employees={employees} />}
      </Content>
    </>
  );
}
