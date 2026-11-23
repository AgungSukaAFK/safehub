import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireAccess } from "@/lib/auth";
import { getTemplate } from "@/lib/inspeksi";
import { getK3Masters } from "@/lib/k3";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";
import { TemplateForm } from "../template-form";

export const metadata: Metadata = { title: "Ubah Template" };

export default async function TemplateUbahPage({ params }: PageProps<"/inspeksi/template/[id]">) {
  const access = await requireAccess("viewer");
  if (!(access.role === "admin" || access.platformAdmin || (access.functions.includes("hse") && !access.functions.includes("auditor")))) redirect("/inspeksi");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const [tpl, masters] = await Promise.all([getTemplate(supabase, id), getK3Masters(supabase)]);
  if (!tpl) notFound();
  return (
    <TemplateForm
      id={tpl.id}
      initial={{ name: tpl.name, typeCode: tpl.typeCode, objectLabel: tpl.objectLabel, findingCategory: tpl.findingCategory, isActive: tpl.isActive, items: tpl.items }}
      // jenis/kategori nonaktif yang sudah dipakai template tetap bisa dipilih
      types={masters.inspectionTypes.filter((t) => t.isActive || t.value === tpl.typeCode).map((t) => ({ value: t.value, label: t.label }))}
      categories={masters.findingCategories.filter((t) => t.isActive || t.value === tpl.findingCategory).map((t) => ({ value: t.value, label: t.label }))}
    />
  );
}
