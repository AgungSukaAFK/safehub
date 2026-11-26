import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { getRequestDetail, listApdItems, listApdTypes, listRequestEmployees } from "@/lib/apd";
import type { Reason } from "@/lib/apd-rules";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";
import { RequestForm } from "../../request-form";

export const metadata: Metadata = { title: "Ubah Pengajuan APD" };

export default async function EditApdRequestPage({ params }: PageProps<"/apd/pengajuan/[id]/ubah">) {
  const access = await requireAccess("viewer");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const r = await getRequestDetail(supabase, id, access.userId);
  if (!r) notFound();
  if (!["draft", "rejected"].includes(r.status) || r.source !== "app" || !r.employeeId) redirect(`/apd/pengajuan/${id}`);
  const staff = access.role === "admin" || access.platformAdmin || access.functions.some((f) => f !== "karyawan");
  const [types, items, employees] = await Promise.all([listApdTypes(supabase), listApdItems(supabase), listRequestEmployees(supabase, staff, r.locationId)]);
  return (
    <>
      <PageHeader title={`Ubah ${r.code}`} description={`${r.recipient} · ${r.site}`} />
      <RequestForm
        types={types.filter((t) => t.isActive || r.lines.some((l) => l.typeId === t.id)).map((t) => ({ id: t.id, code: t.code, name: t.name, sizeKind: t.sizeKind, spec: t.spec }))}
        items={items.map((i) => ({ id: i.id, code: i.code, name: i.name, typeId: i.typeId, size: i.size }))}
        employees={employees}
        initial={{
          id: r.id,
          employeeId: r.employeeId,
          reason: r.reason as Reason,
          negligence: r.negligence,
          incidentOn: r.incidentOn,
          lastReceivedOn: r.lastReceivedOn,
          explanation: r.explanation,
          deductionAck: r.deductionAck,
          mrNo: r.mrNo,
          lines: r.lines.map((l) => ({ typeId: l.typeId, itemId: l.itemId, size: l.size, qty: l.qty, note: l.note })),
        }}
      />
    </>
  );
}
