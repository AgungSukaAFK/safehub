import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { requireAccess } from "@/lib/auth";
import { getCompanies, getCompanyScope } from "@/lib/companies";
import { selectableCompanies } from "@/lib/company-types";
import { getDepartments } from "@/lib/pengajuan";
import { newItem } from "@/lib/pengajuan-rules";
import { createClient } from "@/lib/supabase/server";
import { PengajuanForm } from "../pengajuan-form";

export const metadata: Metadata = { title: "Pengajuan Baru" };

export default async function PengajuanBaruPage() {
  const access = await requireAccess("editor");
  const companies = selectableCompanies(
    await getCompanyScope({ company: access.profile.company, platformAdmin: access.platformAdmin }),
    await getCompanies(),
  );
  const departments = await getDepartments(await createClient());
  const myCompany = companies.find((c) => c.code === access.profile.company)?.code ?? (companies.length === 1 ? companies[0].code : null);

  return (
    <>
      <PageHeader title="Pengajuan Baru" description="Isi informasi dan daftar barang. Draft tersimpan otomatis di perangkat ini." />
      <PengajuanForm
        id={null}
        initial={{ company_code: myCompany, department_id: access.profile.departmentId, title: "", description: "", needed_date: null, items: [newItem()] }}
        companies={companies.map((c) => ({ value: c.code, label: c.name, description: c.code }))}
        departments={departments}
        userId={access.userId}
      />
    </>
  );
}
