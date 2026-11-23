import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/auth";
import { getK3Masters } from "@/lib/k3";
import { createClient } from "@/lib/supabase/server";
import { TemplateForm } from "../template-form";

export const metadata: Metadata = { title: "Template Baru" };

export default async function TemplateBaruPage() {
  const access = await requireAccess("viewer");
  if (!(access.role === "admin" || access.platformAdmin || (access.functions.includes("hse") && !access.functions.includes("auditor")))) redirect("/inspeksi");
  const masters = await getK3Masters(await createClient());
  return (
    <TemplateForm
      id={null}
      initial={{ name: "", typeCode: "", objectLabel: "", findingCategory: "operational_safety", isActive: true, items: [] }}
      types={masters.inspectionTypes.filter((t) => t.isActive).map((t) => ({ value: t.value, label: t.label }))}
      categories={masters.findingCategories.filter((t) => t.isActive).map((t) => ({ value: t.value, label: t.label }))}
    />
  );
}
