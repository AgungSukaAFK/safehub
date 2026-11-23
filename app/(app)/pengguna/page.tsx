import type { Metadata } from "next";
import { NoOffline } from "@/components/pwa/pwa-support";
import { Info } from "lucide-react";
import { Content } from "@/components/list/content";
import { PageHeader } from "@/components/page-header";
import { PLATFORM_CONSOLE_URL } from "@/lib/app-config";
import { requireAccess } from "@/lib/auth";
import { getCompanies } from "@/lib/companies";
import { getDirectoryMasters, listPengguna, parsePenggunaParams, penggunaChips } from "@/lib/pengguna";
import { createClient } from "@/lib/supabase/server";
import { GrantAccessButton, PenggunaTable } from "./pengguna-table";

export const metadata: Metadata = { title: "Pengguna & Peran" };

export default async function PenggunaPage({ searchParams }: PageProps<"/pengguna">) {
  const access = await requireAccess("admin");
  const sp = await searchParams;
  const supabase = await createClient();
  const [companies, masters] = await Promise.all([getCompanies(), getDirectoryMasters(supabase)]);

  const f = parsePenggunaParams(sp, {
    companies: companies.map((c) => c.code),
    departments: masters.departments.map((d) => d.value),
    locations: masters.locations.map((l) => l.value),
  });
  const { rows, total } = await listPengguna(supabase, f);
  const chips = penggunaChips(f, masters);

  return (
    <>
      {/* data orang lain / percakapan pribadi: jangan disimpan untuk offline */}
      <NoOffline />
      <PageHeader
        title="Pengguna & Peran"
        description="Siapa saja yang bisa membuka app ini, role, dan fungsi K3-nya."
        actions={<GrantAccessButton />}
      />
      <div className="col-span-12 flex gap-3 rounded-lg border bg-muted/40 p-4 text-sm">
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="space-y-1">
          <p>
            Akun baru, reset password, dan perubahan profil (nama, departemen, jabatan) dikelola tim IT di konsol platform. Di sini Anda hanya
            mengatur akses ke app ini.
          </p>
          <p className="text-muted-foreground">Admin platform otomatis punya akses Admin di semua app, jadi tidak tercantum di daftar ini.</p>
          {access.platformAdmin && (
            <a href={`${PLATFORM_CONSOLE_URL}/pengguna`} target="_blank" rel="noopener noreferrer" className="inline-block font-medium text-primary hover:underline">
              Buka konsol platform →
            </a>
          )}
        </div>
      </div>
      <Content>
        <PenggunaTable
          rows={rows}
          total={total}
          page={f.page}
          size={f.size}
          chips={chips}
          filtered={!!(f.q || chips.length)}
          companyOptions={companies.map((c) => ({ value: c.code, label: c.shortName }))}
          departmentOptions={masters.departments}
          locationOptions={masters.locations}
          currentUserId={access.userId}
        />
      </Content>
    </>
  );
}
