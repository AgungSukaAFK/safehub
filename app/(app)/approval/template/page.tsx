import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { ActivityLogDialog } from "@/components/detail/activity-log-dialog";
import { Content } from "@/components/list/content";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { getDocTypes, getTemplates } from "@/lib/approval";
import { requireAccess } from "@/lib/auth";
import { getCompanies } from "@/lib/companies";
import { formatRupiah } from "@/lib/format";
import { getDepartments } from "@/lib/pengajuan";
import { APPROVAL_TYPE_LABELS } from "@/lib/status";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Template Approval" };

export default async function TemplateListPage() {
  await requireAccess("admin");
  const supabase = await createClient();
  const [templates, docTypes, companies, departments] = await Promise.all([getTemplates(supabase), getDocTypes(supabase), getCompanies(), getDepartments(supabase)]);
  const docLabel = (c: string) => docTypes.find((d) => d.value === c)?.label ?? c;
  const dept = (id: string | null) => (id ? (departments.find((d) => d.value === id)?.label ?? "-") : "Semua departemen");
  const comp = (c: string | null) => (c ? (companies.find((x) => x.code === c)?.shortName ?? c) : "Semua perusahaan");
  const range = (min: number | null, max: number | null) =>
    min === null && max === null ? "Semua nominal" : `${min !== null ? formatRupiah(min) : "…"} – ${max !== null ? formatRupiah(max) : "…"}`;

  return (
    <>
      <PageHeader
        title="Template Approval"
        description="Aturan jalur approval per jenis dokumen. Dokumen memakai template aktif yang cocok dengan prioritas tertinggi, lalu yang paling spesifik."
        actions={
          <Link href="/approval/template/baru" className={buttonVariants()}>
            <Plus /> Buat Template
          </Link>
        }
      />
      {templates.length === 0 ? (
        <Content>
          <p className="py-10 text-center text-sm text-muted-foreground">Belum ada template. Dokumen belum bisa diajukan sampai ada template yang cocok.</p>
        </Content>
      ) : (
        [...new Set(templates.map((t) => t.doc_type))].map((type) => (
          <Content key={type} title={docLabel(type)} description={`${templates.filter((t) => t.doc_type === type).length} template`}>
            <ul className="divide-y rounded-lg border">
              {templates
                .filter((t) => t.doc_type === type)
                .map((t) => (
                  <li key={t.id} className={cn("flex flex-col gap-2 p-3 sm:flex-row sm:items-center", !t.is_active && "opacity-60")}>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/approval/template/${t.id}`} className="font-semibold hover:underline">
                          {t.name}
                        </Link>
                        <span className="rounded border px-1.5 py-0.5 text-[11px]">Prioritas {t.priority}</span>
                        {!t.is_active && <span className="rounded bg-muted px-1.5 py-0.5 text-[11px]">Nonaktif</span>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {comp(t.company_code)} · {dept(t.department_id)} · {range(t.min_amount, t.max_amount)}
                      </p>
                      <p className="text-xs">
                        {t.steps.map((s, i) => (
                          <span key={i}>
                            {i > 0 && <span className="text-muted-foreground"> → </span>}
                            {APPROVAL_TYPE_LABELS[s.approval_type]}: <b>{s.approver_kind === "user" ? s.approver_name : "Kepala departemen"}</b>
                          </span>
                        ))}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <ActivityLogDialog entity="approval_templates" recordId={t.id} fieldLabels={{ name: { label: "Nama" }, priority: { label: "Prioritas", format: "number" }, is_active: { label: "Aktif", format: "boolean" }, langkah: { label: "Langkah" } }} />
                      <Link href={`/approval/template/${t.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                        Ubah <ArrowRight />
                      </Link>
                    </div>
                  </li>
                ))}
            </ul>
          </Content>
        ))
      )}
    </>
  );
}
