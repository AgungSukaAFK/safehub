"use client";

// Detail temuan (prototipe FindingDetail): header + SourceChip, tab Detail/Lampiran/Riwayat (URL `tab`),
// Rencana Tindakan (kartu per peran), penutupan temuan. Tulis lewat Server Action → RPC.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, ExternalLink, FileText, Pencil, Trash2, User } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ActivityLogDialog } from "@/components/detail/activity-log-dialog";
import { InfoItem } from "@/components/detail/info-item";
import { StatusBadge } from "@/components/detail/status-badge";
import { FileDropzone } from "@/components/form/file-dropzone";
import type { SelectOption } from "@/components/form/searchable-select";
import { Content } from "@/components/list/content";
import { PageHeader } from "@/components/page-header";
import { ActionPlan, type PicaViewer } from "@/components/pica/action-cards";
import { SourceChip } from "@/components/source-chip";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UserProfileCard } from "@/components/user/user-profile-card";
import { BUCKET_LAMPIRAN } from "@/lib/app-config";
import { ACCEPT_DOCS, compressImage, safeStorageName } from "@/lib/attachments";
import { formatBytes, formatDate, formatDateTime } from "@/lib/format";
import { useOnline } from "@/lib/offline/use-online";
import type { StatusDef } from "@/lib/status";
import type { TemuanDetail } from "@/lib/temuan";
import { CONSEQUENCE, FINDING_FIELD_LABELS, FINDING_STATUS, LIKELIHOOD, ROOT_FACTOR_LABEL, SOURCE_KIND_LABEL } from "@/lib/temuan-rules";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { closeFindingAction } from "../actions";

const TABS = [
  { key: "detail", label: "Detail" },
  { key: "lampiran", label: "Lampiran" },
  { key: "riwayat", label: "Riwayat" },
] as const;

export function TemuanDetailView({
  doc,
  riskMap,
  categoryLabel,
  people,
  tab,
  focusCode,
  viewer,
  canEdit,
  canClose,
  canUpload,
}: {
  doc: TemuanDetail;
  riskMap: Record<string, StatusDef>;
  categoryLabel: string;
  people: SelectOption[];
  tab: "detail" | "lampiran" | "riwayat";
  focusCode: string | null;
  viewer: PicaViewer;
  canEdit: boolean;
  canClose: boolean;
  canUpload: boolean;
}) {
  const router = useRouter();
  const online = useOnline();
  const [closeNote, setCloseNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const open = doc.actions.filter((a) => a.status !== "closed").length;
  const allClosed = doc.actions.length > 0 && open === 0;
  const display = doc.status !== "closed" && doc.lateDays > 0 ? "overdue" : doc.status;
  const score = doc.likelihood && doc.consequence ? doc.likelihood * doc.consequence : null;
  const defaultVerifier = people.find((p) => p.value === viewer.userId && viewer.isHse)?.value ?? null;

  const upload = async (files: File[]) => {
    setUploading(true);
    const supabase = createClient();
    let ok = 0;
    for (const f of files) {
      const file = await compressImage(f);
      const { error } = await supabase.storage.from(BUCKET_LAMPIRAN).upload(`temuan/${doc.id}/${safeStorageName(file.name)}`, file, { contentType: file.type || undefined });
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
            <StatusBadge value={display} map={FINDING_STATUS} tone="solid" />
            <StatusBadge value={doc.riskLevel} map={riskMap} tone="solid" />
          </span>
        }
        description={doc.title}
        actions={
          <>
            <ActivityLogDialog entity="findings" recordId={doc.id} fieldLabels={FINDING_FIELD_LABELS} />
            {canEdit && (
              <Link href={`/temuan/${doc.id}/ubah`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                <Pencil /> Ubah
              </Link>
            )}
          </>
        }
      />

      <div className="col-span-12 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        {doc.sourceRef && <SourceChip label={SOURCE_KIND_LABEL[doc.sourceKind] ?? "Sumber"} code={doc.sourceRef} href={doc.sourceHref} />}
        <span className="flex items-center gap-1.5">
          <span className="text-muted-foreground">PIC</span>
          {doc.pic ? <UserProfileCard userId={doc.pic.id} name={doc.pic.name} avatarUrl={doc.pic.avatarUrl} size="xs" /> : "-"}
        </span>
        <span className={cn("flex items-center gap-1.5", doc.lateDays > 0 && "font-medium text-red-600 dark:text-red-400")}>
          <CalendarClock className="size-4" />
          Due {formatDate(doc.dueDate)}
          {doc.lateDays > 0 && ` · +${doc.lateDays} hari`}
        </span>
      </div>

      <nav className="col-span-12 flex gap-1 overflow-x-auto overflow-y-hidden border-b" aria-label="Bagian temuan">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={t.key === "detail" ? `/temuan/${doc.id}` : `/temuan/${doc.id}?tab=${t.key}`}
            scroll={false}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm",
              tab === t.key ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {t.key === "lampiran" && doc.files.length > 0 && ` (${doc.files.length})`}
          </Link>
        ))}
      </nav>

      {tab === "detail" && (
        <div className="col-span-12 flex flex-col gap-4 md:gap-6 [&>*]:min-w-0">
          <Content title="Uraian" size="lg">
            <div className="space-y-4">
              <p className="[overflow-wrap:anywhere] whitespace-pre-wrap">{doc.description}</p>
              <div className="grid gap-x-8 gap-y-2 md:grid-cols-2">
                <InfoItem icon={FileText} label="Lokasi" value={[doc.siteName, doc.areaName, doc.locationDetail].filter(Boolean).join(" · ")} />
                <InfoItem icon={CalendarClock} label="Ditemukan" value={formatDateTime(doc.foundAt)} />
                <InfoItem icon={User} label="Pelapor" value={doc.reporter ? <UserProfileCard userId={doc.reporter.id} name={doc.reporter.name} avatarUrl={doc.reporter.avatarUrl} size="xs" /> : "-"} />
                <InfoItem icon={FileText} label="Kategori" value={categoryLabel} />
              </div>
            </div>
          </Content>

          <Content title="Prioritas / Risiko" size="lg">
            {score ? (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <div className="rounded-lg border px-3 py-2">
                  <p className="text-xs text-muted-foreground">Kemungkinan</p>
                  <p className="font-semibold">
                    {doc.likelihood} · {LIKELIHOOD[doc.likelihood! - 1]}
                  </p>
                </div>
                <span aria-hidden>×</span>
                <div className="rounded-lg border px-3 py-2">
                  <p className="text-xs text-muted-foreground">Konsekuensi</p>
                  <p className="font-semibold">
                    {doc.consequence} · {CONSEQUENCE[doc.consequence! - 1]}
                  </p>
                </div>
                <span aria-hidden>=</span>
                <div className="rounded-lg border px-3 py-2">
                  <p className="text-xs text-muted-foreground">Nilai risiko</p>
                  <p className="font-semibold tabular-nums">
                    {score} · <StatusBadge value={doc.riskLevel} map={riskMap} />
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm">
                Prioritas: <StatusBadge value={doc.riskLevel} map={riskMap} />
              </p>
            )}
            <p className="mt-3 text-xs text-muted-foreground">Skema risiko contoh — menunggu pengesahan HSE. Prioritas yang berlaku adalah yang dipilih pembuat temuan.</p>
          </Content>

          {doc.rootCauses.length > 0 && (
            <Content title="Akar Penyebab" size="lg">
              <dl className="space-y-3">
                {doc.rootCauses.map((r, i) => (
                  <div key={i} className="grid gap-1 sm:grid-cols-[8rem_1fr]">
                    <dt className="text-sm font-medium">{ROOT_FACTOR_LABEL[r.factor] ?? r.factor}</dt>
                    <dd className="text-sm text-muted-foreground [overflow-wrap:anywhere] whitespace-pre-wrap">{r.text}</dd>
                  </div>
                ))}
              </dl>
            </Content>
          )}

          <Content title="Rencana Tindakan" description={doc.actions.length ? `${doc.actions.length - open} dari ${doc.actions.length} Closed` : undefined} size="lg">
            <ActionPlan
              actions={doc.actions}
              parent={{ findingId: doc.id }}
              viewer={viewer}
              people={people}
              defaultVerifierId={defaultVerifier}
              focusCode={focusCode}
              locked={doc.status === "closed"}
            />
          </Content>

          <Content title="Penutupan Temuan" size="lg">
            {doc.status === "closed" ? (
              <div className="space-y-1 text-sm">
                <p className="font-medium">Ditutup {doc.closedAt ? formatDateTime(doc.closedAt) : ""}{doc.closedBy ? ` oleh ${doc.closedBy.name}` : ""}</p>
                {doc.closeNote && <p className="text-muted-foreground [overflow-wrap:anywhere] whitespace-pre-wrap">{doc.closeNote}</p>}
              </div>
            ) : canClose ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="close-note">Alasan penutupan</Label>
                  <Textarea id="close-note" rows={3} maxLength={2000} value={closeNote} onChange={(e) => setCloseNote(e.target.value)} placeholder="Ringkas hasil tindakan dan alasan temuan dapat ditutup" className="text-base md:text-sm" />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground">
                    {doc.actions.length === 0 ? "Belum ada tindakan. Temuan belum dapat ditutup." : allClosed ? "Semua tindakan telah diverifikasi." : `${open} tindakan belum Closed. Temuan belum dapat ditutup.`}
                  </p>
                  <ConfirmDialog
                    title={`Tutup ${doc.code}?`}
                    description="Temuan yang ditutup tidak bisa diubah lagi."
                    confirmText="Tutup Temuan"
                    onConfirm={async () => {
                      const res = await closeFindingAction(doc.id, closeNote);
                      if (res.status !== "ok") {
                        toast.error(res.message);
                        throw new Error(res.message);
                      }
                      toast.success(res.message);
                      router.refresh();
                    }}
                    trigger={
                      <Button type="button" disabled={!allClosed || !closeNote.trim() || !online}>
                        Tutup Temuan
                      </Button>
                    }
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Temuan ditutup oleh HSE setelah semua tindakan terverifikasi.</p>
            )}
          </Content>
        </div>
      )}

      {tab === "lampiran" && (
        <div className="col-span-12">
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
                      {canUpload && (
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
                !canUpload && <p className="text-sm text-muted-foreground">Tidak ada lampiran.</p>
              )}
              {canUpload && <FileDropzone multiple accept={ACCEPT_DOCS} loading={uploading} disabled={!online} onFiles={upload} hint="PDF, gambar, Excel, Word · maks 20 MB per file" />}
            </div>
          </Content>
        </div>
      )}

      {tab === "riwayat" && (
        <div className="col-span-12">
          <Content title="Riwayat Aktivitas" size="lg">
            <p className="mb-3 text-sm text-muted-foreground">Setiap perubahan temuan dicatat. Riwayat tiap tindakan ada di kartu tindakan masing-masing.</p>
            <ActivityLogDialog entity="findings" recordId={doc.id} fieldLabels={FINDING_FIELD_LABELS} />
          </Content>
        </div>
      )}
    </div>
  );
}
