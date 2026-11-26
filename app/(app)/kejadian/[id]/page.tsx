import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { WorkflowStep, WorkflowStepState } from "@/components/detail/workflow-stepper";
import { NoOffline } from "@/components/pwa/pwa-support";
import { BUCKET_LAMPIRAN } from "@/lib/app-config";
import { requireAccess } from "@/lib/auth";
import { getCompanies } from "@/lib/companies";
import { formatDate } from "@/lib/format";
import { getK3Masters, getK3People, masterStatusMap } from "@/lib/k3";
import { getKejadianDetail, type KejadianDetail } from "@/lib/kejadian";
import { INCIDENT_STAGE_LABELS, INCIDENT_STATUSES, INCIDENT_TABS, type IncidentTab } from "@/lib/kejadian-rules";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";
import { InvestigationPrint, InvestigationPrintButton } from "./investigation-print";
import { KejadianDetailView, type IncidentPerms } from "./kejadian-detail";

export async function generateMetadata({ params }: PageProps<"/kejadian/[id]">): Promise<Metadata> {
  const { id } = await params;
  if (!isUuid(id)) return { title: "Kejadian" };
  const supabase = await createClient();
  const { data } = await supabase.from("incidents").select("code").eq("id", id).maybeSingle();
  return { title: data?.code ?? "Kejadian" };
}

const first = (n?: string | null) => n?.split(" ")[0];

/** Langkah stepper dari status + jejak review/log (disusun server, rancangan §2.3). */
function buildSteps(d: KejadianDetail): WorkflowStep[] {
  const cur = INCIDENT_STATUSES.indexOf(d.status);
  const closed = d.status === "closed";
  const decided = (stage: "ehs" | "mgmt") => d.reviews.filter((r) => r.stage === stage && r.decision === "approve").at(-1);
  const metas: (string | undefined)[] = [
    [formatDate(d.reportedAt), first(d.reporter?.name)].filter(Boolean).join(" · "),
    d.classifiedAt ? [formatDate(d.classifiedAt), first(d.classifiedBy?.name)].filter(Boolean).join(" · ") : undefined,
    d.team.find((t) => t.role === "lead") ? `Ketua: ${first(d.team.find((t) => t.role === "lead")!.user.name)}` : undefined,
    decided("ehs") ? [formatDate(decided("ehs")!.at), first(decided("ehs")!.actor?.name)].join(" · ") : undefined,
    decided("mgmt") ? [formatDate(decided("mgmt")!.at), first(decided("mgmt")!.actor?.name)].join(" · ") : undefined,
    d.actions.length ? `${d.actions.filter((a) => a.status === "closed").length}/${d.actions.length} tindakan` : undefined,
    closed && d.closedAt ? formatDate(d.closedAt) + (d.closedException ? " · pengecualian" : "") : undefined,
  ];
  // tahap yang benar-benar terjadi (untuk penutupan dengan pengecualian: tahap yang tidak terjadi = dilewati)
  const happened = [
    true,
    !!d.classifiedAt,
    d.team.length > 0,
    !!decided("ehs"),
    !!decided("mgmt"),
    d.actions.length > 0,
    true,
  ];
  return INCIDENT_STATUSES.map((s, i): WorkflowStep => {
    let state: WorkflowStepState = closed || i < cur ? "done" : i === cur ? "current" : "pending";
    if (closed && d.closedException && !happened[i]) state = "skipped";
    if (!closed && s === "investigating" && i === cur && d.returnNote) state = "returned";
    return { key: s, label: INCIDENT_STAGE_LABELS[s], state, meta: metas[i] || undefined };
  });
}

export default async function KejadianDetailPage({ params, searchParams }: PageProps<"/kejadian/[id]">) {
  const access = await requireAccess("viewer");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const fns = access.functions;
  const has = (f: (typeof fns)[number]) => fns.includes(f);
  const isAdmin = access.role === "admin" || access.platformAdmin;
  // cermin policy incident_restricted / incident_costs di DB
  const canSeeRestricted = has("hse") || has("hr");
  const canSeeCost = has("hse") || has("pjo") || has("manajemen") || has("scm") || isAdmin;

  const doc = await getKejadianDetail(supabase, id, { canSeeRestricted, canSeeCost });
  if (!doc) notFound();
  const [masters, people, emps] = await Promise.all([
    getK3Masters(supabase),
    getK3People(supabase),
    has("hse") && !has("auditor")
      ? supabase.from("employees").select("id, code, name, job_title").eq("company_code", doc.companyCode).eq("status", "active").order("name").limit(2000)
      : Promise.resolve({ data: [] as { id: string; code: string; name: string; job_title: string }[] }),
  ]);
  // cetak Laporan Investigasi: kop company + foto lampiran (signed URL, maks. 6 gambar)
  const imagePaths = doc.files.filter((f) => (f.type ?? "").startsWith("image/") || /\.(jpe?g|png|webp)$/i.test(f.name)).slice(0, 6);
  const [company, signed] = await Promise.all([
    getCompanies().then((cs) => cs.find((c) => c.code === doc.companyCode) ?? null),
    imagePaths.length ? supabase.storage.from(BUCKET_LAMPIRAN).createSignedUrls(imagePaths.map((f) => f.path), 3600) : Promise.resolve({ data: [] }),
  ]);
  const photos = (signed.data ?? []).map((x, i) => ({ url: x.signedUrl ?? "", name: imagePaths[i]?.name ?? "" })).filter((x) => x.url);
  const categoryCode = doc.category ?? doc.reportedCategory;
  const categoryLabel = masters.incidentCategories.find((c) => c.value === categoryCode)?.label ?? categoryCode;
  const sp = await searchParams;
  const tab = (INCIDENT_TABS as readonly string[]).includes(String(sp.tab)) ? (sp.tab as IncidentTab) : "ringkasan";

  // izin per peran: cermin pemeriksaan RPC (DB tetap penjaga terakhir)
  const writer = !has("auditor");
  const isReporter = doc.reporter?.id === access.userId;
  const inTeam = doc.team.some((t) => t.user.id === access.userId);
  const isLead = doc.team.some((t) => t.user.id === access.userId && t.role === "lead");
  const open = doc.status !== "closed";
  const perms: IncidentPerms = {
    userId: access.userId,
    canClassify: writer && has("hse") && open,
    canSetTeam: writer && has("hse") && (doc.status === "classified" || doc.status === "investigating"),
    canEditInvestigation: writer && doc.status === "investigating" && (has("hse") || inTeam),
    canSubmitReview: writer && doc.status === "investigating" && (has("hse") || isLead),
    canReviewEhs: writer && has("hse_senior") && doc.status === "review_ehs" && !isReporter,
    canReviewMgmt: writer && (has("pjo") || has("manajemen")) && doc.status === "review_mgmt" && !isReporter,
    canCloseException: writer && has("pjo") && open,
    canUpload: writer && open && (isReporter || has("hse") || inTeam),
    canAddAction: writer && has("hse") && doc.status !== "reported" && open,
    canManageActions: writer && has("hse"),
    isHse: writer && has("hse"),
    canCreateFinding: writer && (has("hse") || has("pengawas") || has("pjo")),
    isReporter,
  };

  return (
    <>
      {/* data cedera (terbatas) tidak boleh tersimpan di cache offline perangkat */}
      {canSeeRestricted && <NoOffline />}
      <div className="no-print col-span-12 grid grid-cols-12 gap-4 md:gap-6 [&>*]:min-w-0">
      <KejadianDetailView
      printButton={<InvestigationPrintButton id={doc.id} code={doc.code} />}
      doc={doc}
      steps={buildSteps(doc)}
      perms={perms}
      tab={tab}
      focusCode={typeof sp.tindakan === "string" ? sp.tindakan : null}
      masters={{
        categories: masters.incidentCategories.map((c) => ({ value: c.value, label: c.label, isActive: c.isActive })),
        risks: masters.riskLevels.map((c) => ({ value: c.value, label: c.label, isActive: c.isActive })),
        riskMap: masterStatusMap(masters.riskLevels),
        employees: (emps.data ?? []).map((e) => ({ value: e.id, label: e.name, description: `${e.code} · ${e.job_title}` })),
      }}
      people={people.map((p) => ({ value: p.value, label: p.label, description: p.description }))}
      />
      </div>
      <InvestigationPrint doc={doc} company={company} categoryLabel={categoryLabel} photos={photos} printedBy={access.profile.fullName} />
    </>
  );
}
