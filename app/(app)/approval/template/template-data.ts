// Data bersama halaman baru & ubah template (server).
import "server-only";
import { getDocTypes, getTemplates } from "@/lib/approval";
import { getCompanies } from "@/lib/companies";
import { getDepartments } from "@/lib/pengajuan";
import type { ServerClient } from "@/lib/supabase/server";

export async function getTemplateFormData(supabase: ServerClient) {
  const [templates, docTypes, companies, departments] = await Promise.all([getTemplates(supabase), getDocTypes(supabase), getCompanies(), getDepartments(supabase)]);
  return {
    templates,
    docTypes,
    companies: companies.filter((c) => !c.isGroup).map((c) => ({ value: c.code, label: c.name, description: c.code })),
    departments,
    others: templates.map((t) => ({
      id: t.id,
      name: t.name,
      doc_type: t.doc_type,
      company_code: t.company_code,
      department_id: t.department_id,
      min_amount: t.min_amount,
      max_amount: t.max_amount,
      priority: t.priority,
      is_active: t.is_active,
      created_at: t.created_at,
      stepCount: t.steps.length,
    })),
  };
}
