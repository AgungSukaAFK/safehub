import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getTemplateFormData } from "../template-data";
import { TemplateForm } from "../template-form";

export const metadata: Metadata = { title: "Template Baru" };

export default async function TemplateBaruPage() {
  await requireAccess("admin");
  const d = await getTemplateFormData(await createClient());
  return (
    <>
      <PageHeader title="Template Approval Baru" description="Tentukan cakupan dokumen dan urutan approver." />
      <TemplateForm template={null} others={d.others} docTypes={d.docTypes} companies={d.companies} departments={d.departments} />
    </>
  );
}
