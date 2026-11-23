import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireAccess } from "@/lib/auth";
import { getAreas, getK3Masters, getK3People } from "@/lib/k3";
import { getIncidentOptions } from "@/lib/kejadian";
import { createClient } from "@/lib/supabase/server";
import { getTemuanDetail } from "@/lib/temuan";
import { newFindingValues } from "@/lib/temuan-rules";
import { isUuid } from "@/lib/utils";
import { TemuanForm } from "../../temuan-form";

export const metadata: Metadata = { title: "Ubah Temuan" };

/** `timestamptz` ISO → nilai datetime-local WIB (YYYY-MM-DDTHH:mm). */
const toWibLocal = (iso: string) => new Date(Date.parse(iso) + 7 * 3_600_000).toISOString().slice(0, 16);

export default async function UbahTemuanPage({ params }: PageProps<"/temuan/[id]/ubah">) {
  const access = await requireAccess("viewer");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const doc = await getTemuanDetail(supabase, id);
  if (!doc) notFound();
  // cermin finding_save: pembuat atau HSE; belum ditutup; bukan auditor
  const allowed = !access.functions.includes("auditor") && (doc.createdById === access.userId || access.functions.includes("hse"));
  if (!allowed || doc.status === "closed") redirect(`/temuan/${id}`);

  const [areas, masters, people, incidents] = await Promise.all([getAreas(supabase), getK3Masters(supabase), getK3People(supabase), getIncidentOptions(supabase)]);
  return (
    <TemuanForm
      id={doc.id}
      code={doc.code}
      version={doc.updatedAt}
      initial={newFindingValues({
        company_code: doc.companyCode,
        location_id: doc.siteId,
        area_id: doc.areaId,
        location_detail: doc.locationDetail ?? "",
        found_at: toWibLocal(doc.foundAt),
        title: doc.title,
        description: doc.description,
        source_kind: doc.sourceKind as never,
        source_ref: doc.sourceId ? "" : (doc.sourceRef ?? ""),
        source_id: doc.sourceId,
        category: doc.category,
        risk_level: doc.riskLevel,
        likelihood: doc.likelihood,
        consequence: doc.consequence,
        root_causes: doc.rootCauses.map((r) => ({ key: crypto.randomUUID(), factor: r.factor as never, text: r.text })),
        pic_id: doc.pic?.id ?? null,
        due_date: doc.dueDate,
      })}
      companies={[]}
      // area/kategori/prioritas lama yang sudah nonaktif tetap bisa dipertahankan (RPC mengizinkan nilai lama)
      areas={areas.filter((a) => a.siteId === doc.siteId && (a.isActive || a.value === doc.areaId)).map((a) => ({ value: a.value, label: a.label }))}
      categories={masters.findingCategories.filter((c) => c.isActive || c.value === doc.category).map((c) => ({ value: c.value, label: c.label }))}
      risks={masters.riskLevels.filter((c) => c.isActive || c.value === doc.riskLevel).map((c) => ({ value: c.value, label: c.label }))}
      people={people.map((p) => ({ value: p.value, label: p.label, description: p.description }))}
      incidents={incidents}
      userId={access.userId}
      siteName={doc.siteName}
    />
  );
}
