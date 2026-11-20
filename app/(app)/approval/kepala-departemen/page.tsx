import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { getDepartmentHeads, getTemplates } from "@/lib/approval";
import { requireAccess } from "@/lib/auth";
import { getCompanies } from "@/lib/companies";
import { getDepartments } from "@/lib/pengajuan";
import { createClient } from "@/lib/supabase/server";
import { HeadsGrid } from "./heads-grid";

export const metadata: Metadata = { title: "Kepala Departemen" };

// Tabel departemen × perusahaan → kepala departemen (approver langkah "kepala departemen").
export default async function KepalaDepartemenPage() {
  await requireAccess("admin");
  const supabase = await createClient();
  const [departments, companies, heads, templates] = await Promise.all([getDepartments(supabase), getCompanies(), getDepartmentHeads(supabase), getTemplates(supabase)]);
  // cakupan template aktif yang memakai langkah kepala departemen → sel kosong di cakupan ini = peringatan
  const needs = templates
    .filter((t) => t.is_active && t.steps.some((s) => s.approver_kind === "department_head"))
    .map((t) => ({ name: t.name, company: t.company_code, department: t.department_id }));

  return (
    <>
      <PageHeader title="Kepala Departemen" description="Approver untuk langkah “Kepala departemen pemohon” di template approval, per departemen dan perusahaan." />
      <HeadsGrid
        departments={departments.map((d) => ({ id: d.value, name: d.label }))}
        companies={companies.filter((c) => !c.isGroup).map((c) => ({ code: c.code, name: c.shortName }))}
        heads={heads}
        needs={needs}
      />
    </>
  );
}
