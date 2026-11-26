"use client";

// Detail kejadian (prototipe IncidentDetail): header + stepper 7 tahap + tab (URL `tab`) + aside ringkasan.
// Izin dihitung server (cermin RPC) dan dioper sebagai `perms`; DB tetap penjaga terakhir.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarClock, Check, ExternalLink, FileText, MapPin, Plus, Siren, Trash2, User, X } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ActivityLogDialog } from "@/components/detail/activity-log-dialog";
import { StatusBadge } from "@/components/detail/status-badge";
import { WorkflowStepper, type WorkflowStep } from "@/components/detail/workflow-stepper";
import { FileDropzone } from "@/components/form/file-dropzone";
import type { SelectOption } from "@/components/form/searchable-select";
import { Content } from "@/components/list/content";
import { PageHeader } from "@/components/page-header";
import { ActionPlan } from "@/components/pica/action-cards";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { UserProfileCard } from "@/components/user/user-profile-card";
import { BUCKET_LAMPIRAN } from "@/lib/app-config";
import { ACCEPT_DOCS, compressImage, safeStorageName } from "@/lib/attachments";
import { formatBytes, formatDate, formatDateTime } from "@/lib/format";
import type { KejadianDetail } from "@/lib/kejadian";
import {
  COMPANY_KIND_LABEL,
  EMPLOYMENT_LABEL,
  INCIDENT_FIELD_LABELS,
  INCIDENT_STATUS,
  INCIDENT_TABS,
  INJURY_CLASS_LABEL,
  type IncidentTab,
} from "@/lib/kejadian-rules";
import { useOnline } from "@/lib/offline/use-online";
import { FINDING_STATUS } from "@/lib/temuan-rules";
import { createClient } from "@/lib/supabase/client";
import type { StatusDef } from "@/lib/status";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { closeExceptionAction } from "../actions";
import { ClassifyPanel } from "./tab-klasifikasi";
import { InvestigationPanel, TeamCard } from "./tab-investigasi";
import { ReviewPanel } from "./tab-review";

export type IncidentPerms = {
  userId: string;
  canClassify: boolean;
  canSetTeam: boolean;
  canEditInvestigation: boolean;
  canSubmitReview: boolean;
  canReviewEhs: boolean;
  canReviewMgmt: boolean;
  canCloseException: boolean;
  canUpload: boolean;
  canAddAction: boolean;
  canManageActions: boolean;
  isHse: boolean;
  canCreateFinding: boolean;
  isReporter: boolean;
};

export type DetailMasters = {
  categories: { value: string; label: string; isActive: boolean }[];
  risks: { value: string; label: string; isActive: boolean }[];
  riskMap: Record<string, StatusDef>;
  /** karyawan aktif company kejadian (pilihan korban; hanya dimuat untuk HSE) */
  employees: { value: string; label: string; description?: string }[];
};

const TAB_LABEL: Record<IncidentTab, string> = {
  ringkasan: "Ringkasan",
  klasifikasi: "Klasifikasi & Dampak",
  investigasi: "Investigasi",
  penyebab: "Analisis Penyebab",
  tindakan: "Tindakan",
  review: "Review & Persetujuan",
  lampiran: "Lampiran",
  riwayat: "Riwayat",
};

export function KejadianDetailView({
  doc,
  steps,
  perms,
  tab,
  focusCode,
  masters,
  people,
  printButton,
}: {
  doc: KejadianDetail;
  steps: WorkflowStep[];
  perms: IncidentPerms;
  tab: IncidentTab;
  focusCode: string | null;
  masters: DetailMasters;
  people: SelectOption[];
  /** tombol Cetak Laporan Investigasi (dirender server page) */
  printButton?: React.ReactNode;
}) {
  const router = useRouter();
  const online = useOnline();
  const [reason, setReason] = useState("");
  const [uploading, setUploading] = useState(false);
  const closed = doc.status === "closed";
  const catLabel = masters.categories.find((c) => c.value === (doc.category ?? doc.reportedCategory))?.label ?? doc.category ?? doc.reportedCategory;
  const lead = doc.team.find((t) => t.role === "lead");
  const verifierDefault = perms.isHse ? perms.userId : null;
  const counts: Partial<Record<IncidentTab, number>> = { tindakan: doc.actions.length, lampiran: doc.files.length };

  const upload = async (files: File[]) => {
    setUploading(true);
    const supabase = createClient();
    let ok = 0;
    for (const f of files) {
      const file = await compressImage(f);
      const { error } = await supabase.storage.from(BUCKET_LAMPIRAN).upload(`kejadian/${doc.id}/${safeStorageName(file.name)}`, file, { contentType: file.type || undefined });
      if (error) toast.error(`Gagal mengunggah ${f.name}`, { description: error.message });
      else ok++;
    }
    setUploading(false);
    if (ok) {
      toast.success(`${ok} lampiran diunggah.`);
      router.refresh();
    }
  };
  const openFile = async (path: string) => {
    const { data, error } = await createClient().storage.from(BUCKET_LAMPIRAN).createSignedUrl(path, 300);
    if (error || !data) return toast.error("Lampiran gagal dibuka.", { description: error?.message });
    window.open(data.signedUrl, "_blank", "noopener");
  };
  const removeFile = async (path: string) => {
    const { data, error } = await createClient().storage.from(BUCKET_LAMPIRAN).remove([path]);
    if (error || !data?.length) {
      toast.error("Lampiran tidak bisa dihapus (hanya pengunggah atau admin).");
      throw new Error("gagal");
    }
    toast.success("Lampiran dihapus.");
    router.refresh();
  };

  return (
    <div className="col-span-12 grid grid-cols-12 gap-4 md:gap-6 [&>*]:min-w-0">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{doc.code}</span>
            <StatusBadge value={doc.status} map={INCIDENT_STATUS} tone="solid" />
            {doc.returnNote && doc.status === "investigating" && <span className="rounded-md border border-amber-400 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">Dikembalikan</span>}
            {doc.isEmergency && (
              <span className="flex items-center gap-1 rounded-md bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                <Siren className="size-3.5" /> DARURAT
              </span>
            )}
          </span>
        }
        description={
          <span className="[overflow-wrap:anywhere]">
            {doc.description.length > 160 ? `${doc.description.slice(0, 160)}…` : doc.description}
            <span className="mt-1 block text-xs">
              {doc.siteName} · {doc.areaName} · Kejadian {formatDateTime(doc.occurredAt)}
            </span>
          </span>
        }
        actions={
          <>
            {printButton}
            <ActivityLogDialog entity="incidents" recordId={doc.id} fieldLabels={INCIDENT_FIELD_LABELS} />
            {perms.canAddAction && (
              <Link href={`/kejadian/${doc.id}?tab=tindakan`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                <Plus /> Tambah Tindakan
              </Link>
            )}
            {!closed && (
              <Popover>
                <PopoverTrigger render={<Button variant="outline" size="sm" />}>Tutup Kejadian</PopoverTrigger>
                <PopoverContent align="end" className="w-80 gap-2 p-4">
                  <p className="text-sm font-semibold">Syarat penutupan</p>
                  <ul className="space-y-1.5 text-sm">
                    {doc.closeCheck.map((c) => (
                      <li key={c.key} className={cn("flex items-start gap-2", c.ok ? "text-green-700 dark:text-green-400" : "text-muted-foreground")}>
                        {c.ok ? <Check className="mt-0.5 size-4 shrink-0" /> : <X className="mt-0.5 size-4 shrink-0" />}
                        {c.label}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground">Kejadian tertutup otomatis setelah review manajemen disetujui dan semua tindakan Closed.</p>
                  {perms.canCloseException && (
                    <ConfirmDialog
                      title="Tutup dengan pengecualian"
                      description="Hanya untuk kejadian yang tidak perlu diproses penuh. Alasan dicatat pada Riwayat dan audit trail."
                      confirmText="Tutup Kejadian"
                      destructive
                      confirmDisabled={reason.trim().length < 10}
                      onOpenChange={() => setReason("")}
                      onConfirm={async () => {
                        const res = await closeExceptionAction(doc.id, reason);
                        if (res.status !== "ok") {
                          toast.error(res.message);
                          throw new Error(res.message);
                        }
                        toast.success(res.message);
                        router.refresh();
                      }}
                      trigger={
                        <Button type="button" variant="link" size="sm" className="h-auto justify-start p-0">
                          Tutup dengan pengecualian →
                        </Button>
                      }
                    >
                      <div className="space-y-1.5">
                        <Label htmlFor="close-reason">Alasan (wajib, min. 10 karakter)</Label>
                        <Textarea id="close-reason" rows={3} maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} className="text-base md:text-sm" />
                      </div>
                    </ConfirmDialog>
                  )}
                </PopoverContent>
              </Popover>
            )}
          </>
        }
      />

      <div className="col-span-12 rounded-xl border bg-card p-4">
        <WorkflowStepper steps={steps} />
      </div>

      {closed && doc.closeNote && (
        <div className="col-span-12 flex gap-3 rounded-lg border bg-muted/40 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">{doc.closedException ? "Ditutup dengan pengecualian" : "Ditutup"}</p>
            <p className="text-muted-foreground [overflow-wrap:anywhere] whitespace-pre-wrap">{doc.closeNote}</p>
          </div>
        </div>
      )}

      <nav className="col-span-12 flex gap-1 overflow-x-auto overflow-y-hidden border-b" aria-label="Bagian kejadian">
        {INCIDENT_TABS.map((t) => (
          <Link
            key={t}
            href={t === "ringkasan" ? `/kejadian/${doc.id}` : `/kejadian/${doc.id}?tab=${t}`}
            scroll={false}
            aria-current={tab === t ? "page" : undefined}
            className={cn("-mb-px shrink-0 border-b-2 px-3 py-2 text-sm", tab === t ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            {TAB_LABEL[t]}
            {counts[t] ? ` (${counts[t]})` : ""}
          </Link>
        ))}
      </nav>

      <div className="col-span-12 grid grid-cols-12 gap-4 md:gap-6 [&>*]:min-w-0">
        <main className="col-span-12 flex flex-col gap-4 md:gap-6 lg:col-span-8 [&>*]:min-w-0">
          {tab === "ringkasan" && <SummaryTab doc={doc} />}
          {tab === "klasifikasi" && <ClassifyPanel key={doc.updatedAt} doc={doc} masters={masters} canEdit={perms.canClassify} />}
          {tab === "investigasi" && (
            <>
              <TeamCard key={`team-${doc.updatedAt}`} doc={doc} people={people} canSet={perms.canSetTeam} />
              <InvestigationPanel key={`inv-${doc.updatedAt}`} doc={doc} part="investigasi" canEdit={perms.canEditInvestigation} canAddAction={false} people={people} verifierId={verifierDefault} />
            </>
          )}
          {tab === "penyebab" && <InvestigationPanel key={`cause-${doc.updatedAt}`} doc={doc} part="penyebab" canEdit={perms.canEditInvestigation} canAddAction={perms.canAddAction} people={people} verifierId={verifierDefault} />}
          {tab === "tindakan" && (
            <Content title="Tindakan Perbaikan" description={doc.actions.length ? `${doc.actions.filter((a) => a.status === "closed").length} dari ${doc.actions.length} Closed` : undefined} size="lg">
              <ActionPlan
                actions={doc.actions}
                parent={{ incidentId: doc.id }}
                viewer={{ userId: perms.userId, canAdd: perms.canAddAction, canManage: perms.canManageActions, isHse: perms.isHse }}
                people={people}
                defaultVerifierId={verifierDefault}
                focusCode={focusCode}
                locked={closed || doc.status === "reported"}
              />
            </Content>
          )}
          {tab === "review" && <ReviewPanel doc={doc} perms={perms} />}
          {tab === "lampiran" && (
            <Content title="Lampiran" description={doc.files.length ? `${doc.files.length} file` : undefined} size="lg">
              <div className="space-y-3">
                {doc.files.length > 0 ? (
                  <ul className="divide-y rounded-lg border">
                    {doc.files.map((f) => (
                      <li key={f.path} className="flex items-center gap-3 px-3 py-2 text-sm">
                        <FileText className="size-4 shrink-0 text-muted-foreground" />
                        <button type="button" className="min-w-0 flex-1 truncate text-left font-medium hover:underline" onClick={() => openFile(f.path)} title={f.name}>
                          {f.name}
                        </button>
                        <span className="shrink-0 text-xs text-muted-foreground">{f.size ? formatBytes(f.size) : ""}</span>
                        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Buka ${f.name}`} onClick={() => openFile(f.path)}>
                          <ExternalLink />
                        </Button>
                        {perms.canUpload && (
                          <ConfirmDialog
                            title={`Hapus lampiran ${f.name}?`}
                            description="File dihapus permanen dari penyimpanan."
                            confirmText="Hapus"
                            destructive
                            onConfirm={() => removeFile(f.path)}
                            trigger={
                              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Hapus ${f.name}`}>
                                <Trash2 />
                              </Button>
                            }
                          />
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  !perms.canUpload && <p className="text-sm text-muted-foreground">Tidak ada lampiran.</p>
                )}
                <p className="text-xs text-muted-foreground">Lampiran mengikuti hak baca kejadian: hanya pihak yang berhak melihat kejadian ini yang dapat membukanya.</p>
                {perms.canUpload && <FileDropzone multiple accept={ACCEPT_DOCS} loading={uploading} disabled={!online} onFiles={upload} hint="PDF, gambar, Excel, Word · maks 20 MB per file" />}
              </div>
            </Content>
          )}
          {tab === "riwayat" && (
            <Content title="Riwayat Aktivitas" size="lg">
              <p className="mb-3 text-sm text-muted-foreground">Setiap aksi pada kejadian dicatat. Riwayat tiap tindakan ada di kartu tindakan masing-masing.</p>
              <ActivityLogDialog entity="incidents" recordId={doc.id} fieldLabels={INCIDENT_FIELD_LABELS} />
            </Content>
          )}
        </main>

        <aside className="col-span-12 flex flex-col gap-4 lg:col-span-4 [&>*]:min-w-0">
          <Content title="Ringkasan" size="lg">
            <dl className="space-y-3 text-sm">
              <Aside icon={MapPin} label="Lokasi" value={`${doc.areaName}${doc.locationDetail ? ` · ${doc.locationDetail}` : ""}`} />
              <Aside icon={FileText} label="Unit" value={[doc.unitCode, doc.unitLabel].filter(Boolean).join(" · ") || "-"} />
              <Aside icon={User} label="Pelapor" value={doc.reporter ? <UserProfileCard userId={doc.reporter.id} name={doc.reporter.name} avatarUrl={doc.reporter.avatarUrl} size="xs" /> : "-"} />
              <Aside icon={CalendarClock} label="Tanggal kejadian" value={formatDateTime(doc.occurredAt)} />
              <Aside icon={CalendarClock} label="Tanggal dilaporkan" value={formatDateTime(doc.reportedAt)} />
              <Aside icon={FileText} label="Klasifikasi" value={doc.category ? `${catLabel}${doc.injuryClass && doc.injuryClass !== "none" ? ` · ${INJURY_CLASS_LABEL[doc.injuryClass]}` : ""}` : "Belum diklasifikasi"} />
              <Aside icon={User} label="Ketua investigasi" value={lead ? <UserProfileCard userId={lead.user.id} name={lead.user.name} avatarUrl={lead.user.avatarUrl} size="xs" /> : "-"} />
            </dl>
          </Content>
          <Content title="Temuan Terkait" size="lg">
            {doc.relatedFindings.length > 0 ? (
              <ul className="space-y-2">
                {doc.relatedFindings.map((f) => (
                  <li key={f.id}>
                    <Link href={`/temuan/${f.id}`} className="flex flex-col gap-1 rounded-lg border p-2 text-sm transition-colors hover:border-primary/40">
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-semibold text-primary">{f.code}</span>
                        <StatusBadge value={f.status} map={FINDING_STATUS} />
                      </span>
                      <span className="[overflow-wrap:anywhere]">{f.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Belum ada temuan yang bersumber dari kejadian ini.</p>
            )}
            {perms.canCreateFinding && (
              <Link href={`/temuan/baru?kejadian=${doc.id}`} className={buttonVariants({ variant: "outline", size: "sm", className: "mt-3 w-full" })}>
                <Plus /> Buat Temuan dari Kejadian
              </Link>
            )}
          </Content>
        </aside>
      </div>
    </div>
  );
}

function Aside({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(6rem,1fr)_2fr] items-start gap-x-3">
      <dt className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4 shrink-0" />
        {label}
      </dt>
      <dd className="min-w-0 font-medium [overflow-wrap:anywhere]">{value}</dd>
    </div>
  );
}

function SummaryTab({ doc }: { doc: KejadianDetail }) {
  const involved = doc.persons.filter((p) => p.role === "involved");
  const witnesses = doc.persons.filter((p) => p.role === "witness");
  const Person = ({ p }: { p: KejadianDetail["persons"][number] }) => (
    <li className="flex items-center gap-3 rounded-lg border p-2 text-sm">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
        {p.name
          .split(" ")
          .map((w) => w[0])
          .slice(0, 2)
          .join("")}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{p.name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {[p.position, p.contractorName ?? COMPANY_KIND_LABEL[p.companyKind], p.employment && EMPLOYMENT_LABEL[p.employment], p.contact].filter(Boolean).join(" · ")}
        </span>
      </span>
    </li>
  );
  return (
    <>
      <Content title="Laporan Awal" size="lg">
        <div className="space-y-3">
          <p className="[overflow-wrap:anywhere] whitespace-pre-wrap">{doc.description}</p>
          {doc.isEmergency && <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">Pelapor menandai kejadian ini membutuhkan penanganan darurat.</p>}
          {doc.supervisor && (
            <p className="text-sm">
              <span className="text-muted-foreground">Atasan langsung: </span>
              {doc.supervisor.name}
            </p>
          )}
        </div>
      </Content>
      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        <Content title="Pihak Terlibat" size="lg">
          {involved.length ? <ul className="space-y-2">{involved.map((p) => <Person key={p.id} p={p} />)}</ul> : <p className="text-sm text-muted-foreground">Tidak dicantumkan.</p>}
        </Content>
        <Content title="Saksi" size="lg">
          {witnesses.length ? <ul className="space-y-2">{witnesses.map((p) => <Person key={p.id} p={p} />)}</ul> : <p className="text-sm text-muted-foreground">Tidak dicantumkan.</p>}
        </Content>
      </div>
      <p className="text-xs text-muted-foreground">Dilaporkan {formatDate(doc.reportedAt)}. Foto dan dokumen ada di tab Lampiran.</p>
    </>
  );
}

