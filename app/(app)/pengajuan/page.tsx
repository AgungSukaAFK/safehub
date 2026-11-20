import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Content } from "@/components/list/content";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireAccess } from "@/lib/auth";
import { getCompanies, getCompanyScope } from "@/lib/companies";
import { getDirectoryMasters } from "@/lib/masters";
import { listPengajuan, parsePengajuanParams, pengajuanChips } from "@/lib/pengajuan";
import { roleAtLeast } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { PengajuanTable } from "./pengajuan-table";

export const metadata: Metadata = { title: "Pengajuan" };

// CONTOH boilerplate: pola list standar (loader server → tabel client). Hapus saat app punya dokumen asli.
export default async function PengajuanPage({ searchParams }: PageProps<"/pengajuan">) {
  const access = await requireAccess("viewer");
  const sp = await searchParams;
  const companies = await getCompanies();
  const scope = await getCompanyScope({ company: access.profile.company, platformAdmin: access.platformAdmin });
  const visible = companies.filter((c) => scope === "ALL" || scope.includes(c.code));

  const f = parsePengajuanParams(sp, visible.map((c) => c.code));
  const supabase = await createClient();
  const [{ rows, total }, { departments }] = await Promise.all([listPengajuan(supabase, f), getDirectoryMasters(supabase)]);
  const chips = pengajuanChips(f, departments);
  const canCreate = roleAtLeast(access.role, "editor");

  return (
    <>
      <PageHeader
        title="Pengajuan"
        description="Contoh dokumen dengan approval (boilerplate). Cari, saring, dan unduh daftar pengajuan."
        actions={
          canCreate && (
            <Link href="/pengajuan/baru" className={buttonVariants()}>
              <Plus /> Buat Pengajuan
            </Link>
          )
        }
      />
      <Content>
        <PengajuanTable
          rows={rows}
          total={total}
          page={f.page}
          size={f.size}
          chips={chips}
          filtered={!!(f.q || chips.length)}
          departmentOptions={departments}
          companyOptions={visible.length > 1 ? visible.map((c) => ({ value: c.code, label: c.shortName })) : []}
          userId={access.userId}
          isAdmin={access.role === "admin"}
          canCreate={canCreate}
        />
      </Content>
    </>
  );
}
