import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";
import { getTemplateFormData } from "../template-data";
import { TemplateForm } from "../template-form";

export const metadata: Metadata = { title: "Ubah Template" };

export default async function TemplateUbahPage({ params }: PageProps<"/approval/template/[id]">) {
  await requireAccess("admin");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const d = await getTemplateFormData(await createClient());
  const template = d.templates.find((t) => t.id === id);
  if (!template) notFound();
  return (
    <>
      <PageHeader title="Ubah Template Approval" description={template.name} />
      <TemplateForm template={template} others={d.others} docTypes={d.docTypes} companies={d.companies} departments={d.departments} />
    </>
  );
}
