import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireAccess } from "@/lib/auth";
import { getCompanies, getCompanyScope } from "@/lib/companies";
import { selectableCompanies } from "@/lib/company-types";
import { getDepartments, getPengajuanDetail } from "@/lib/pengajuan";
import { EDITABLE_STATUSES } from "@/lib/pengajuan-rules";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";
import { PengajuanForm } from "../../pengajuan-form";

export const metadata: Metadata = { title: "Ubah Pengajuan" };

export default async function PengajuanUbahPage({ params }: PageProps<"/pengajuan/[id]/ubah">) {
  const access = await requireAccess("editor");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const d = await getPengajuanDetail(supabase, id, access.userId);
  if (!d) notFound();
  // cermin guard DB: hanya draft/ditolak, milik sendiri atau admin
  if (!EDITABLE_STATUSES.includes(d.status) || (d.requester?.id !== access.userId && access.role !== "admin")) {
    redirect(`/pengajuan/${id}?pesan=tidak-bisa-diubah`);
  }
  const companies = selectableCompanies(
    await getCompanyScope({ company: access.profile.company, platformAdmin: access.platformAdmin }),
    await getCompanies(),
  );

  return (
    <>
      <PageHeader title={`Ubah ${d.code ?? "Draft"}`} description={d.status === "rejected" ? "Perbaiki sesuai catatan penolakan, lalu ajukan ulang." : "Ubah draft lalu simpan atau ajukan."} />
      <PengajuanForm
        id={d.id}
        code={d.code}
        version={d.updatedAt}
        initial={{
          company_code: d.companyCode,
          department_id: d.departmentId,
          title: d.title,
          description: d.description ?? "",
          needed_date: d.neededDate,
          items: d.items.map((i) => ({
            key: i.id,
            item_name: i.itemName,
            part_number: i.partNumber ?? "",
            qty: String(i.qty),
            unit: i.unit,
            unit_price: String(i.unitPrice),
            note: i.note ?? "",
          })),
        }}
        companies={companies.map((c) => ({ value: c.code, label: c.name, description: c.code }))}
        departments={await getDepartments(supabase)}
        userId={access.userId}
      />
    </>
  );
}
