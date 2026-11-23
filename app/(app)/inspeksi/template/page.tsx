import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { Content } from "@/components/list/content";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireAccess } from "@/lib/auth";
import { listTemplates } from "@/lib/inspeksi";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { typeChipClass } from "../inspeksi-calendar";

export const metadata: Metadata = { title: "Template Inspeksi" };

export default async function TemplateListPage() {
  const access = await requireAccess("viewer");
  const canManage = access.role === "admin" || access.platformAdmin || (access.functions.includes("hse") && !access.functions.includes("auditor"));
  if (!canManage) redirect("/inspeksi");
  const templates = await listTemplates(await createClient());

  return (
    <>
      <PageHeader
        title="Template Inspeksi"
        description="Checklist per jenis inspeksi. Perubahan hanya berlaku untuk inspeksi yang dimulai sesudahnya."
        actions={
          <Link href="/inspeksi/template/baru" className={buttonVariants()}>
            <Plus /> Template Baru
          </Link>
        }
      />
      <Content>
        {templates.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Belum ada template.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {templates.map((t) => (
              <li key={t.id}>
                <Link href={`/inspeksi/template/${t.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50">
                  <span className={cn("rounded-md border px-2 py-0.5 text-xs font-medium", typeChipClass(t.typeColor))}>{t.typeLabel}</span>
                  <span className="min-w-0 flex-1 font-medium">{t.name}</span>
                  <span className="text-xs text-muted-foreground">{t.itemCount} butir</span>
                  {!t.isActive && <span className="rounded-md border px-2 py-0.5 text-xs text-muted-foreground">Nonaktif</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Content>
    </>
  );
}
