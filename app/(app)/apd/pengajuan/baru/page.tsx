import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { listApdItems, listApdTypes, listRequestEmployees } from "@/lib/apd";
import { REASONS, type Reason } from "@/lib/apd-rules";
import { requireAccess } from "@/lib/auth";
import { textParam } from "@/lib/search-params";
import { parseSiteParam } from "@/lib/sites";
import { createClient } from "@/lib/supabase/server";
import { RequestForm } from "../request-form";

export const metadata: Metadata = { title: "Ajukan APD" };

// Buat Pengajuan APD (draf). Karyawan: hanya untuk dirinya; staf K3: karyawan aktif di site terpilih.
export default async function NewApdRequestPage({ searchParams }: PageProps<"/apd/pengajuan/baru">) {
  const access = await requireAccess("viewer");
  if (access.functions.includes("auditor")) redirect("/apd/pengajuan");
  const sp = await searchParams;
  const staff = access.role === "admin" || access.platformAdmin || access.functions.some((f) => f !== "karyawan");
  const { siteId } = await parseSiteParam(sp, access);
  const supabase = await createClient();
  const [types, items, employees] = await Promise.all([listApdTypes(supabase), listApdItems(supabase), listRequestEmployees(supabase, staff, siteId)]);
  const emp = textParam(sp, "karyawan");
  const reason = textParam(sp, "alasan");
  return (
    <>
      <PageHeader title="Ajukan APD" description="Form Berita Acara Kehilangan / Kerusakan / Pengajuan APD dan Request APD karyawan baru." />
      <RequestForm
        types={types.filter((t) => t.isActive).map((t) => ({ id: t.id, code: t.code, name: t.name, sizeKind: t.sizeKind, spec: t.spec }))}
        items={items.filter((i) => i.isActive).map((i) => ({ id: i.id, code: i.code, name: i.name, typeId: i.typeId, size: i.size }))}
        employees={employees}
        defaultEmployee={employees.some((e) => e.id === emp) ? emp : null}
        defaultReason={(REASONS as readonly string[]).includes(reason) ? (reason as Reason) : null}
      />
    </>
  );
}
