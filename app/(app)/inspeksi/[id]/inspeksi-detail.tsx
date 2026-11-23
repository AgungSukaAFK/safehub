"use client";

// Detail inspeksi: header + info, lalu sesuai status: Terjadwal (mulai/batal), In Progress (checklist
// untuk pemeriksa), Menunggu Verifikasi (hasil + verifikasi HSE), Terverifikasi/Dibatalkan (hasil).
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, CalendarClock, Check, ExternalLink, MapPin, Play, User, X } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ActivityLogDialog } from "@/components/detail/activity-log-dialog";
import { StatusBadge } from "@/components/detail/status-badge";
import type { SelectOption } from "@/components/form/searchable-select";
import { Content } from "@/components/list/content";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UserProfileCard } from "@/components/user/user-profile-card";
import { BUCKET_LAMPIRAN } from "@/lib/app-config";
import { formatDateTime } from "@/lib/format";
import type { InspectionDetail } from "@/lib/inspeksi";
import { ANSWER_LABEL, INSPECTION_FIELD_LABELS, INSPECTION_STATUS } from "@/lib/inspeksi-rules";
import { useOnline } from "@/lib/offline/use-online";
import { FINDING_STATUS } from "@/lib/temuan-rules";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { cancelInspectionAction, startInspectionAction, verifyInspectionAction } from "../actions";
import { typeChipClass } from "../inspeksi-calendar";
import { ChecklistEditor } from "./checklist-editor";

export type InspectionPerms = {
  userId: string;
  isInspector: boolean;
  canStart: boolean;
  canFill: boolean;
  canVerify: boolean;
  canCancel: boolean;
  canCreateFindings: boolean;
};

async function openFile(path: string) {
  const { data, error } = await createClient().storage.from(BUCKET_LAMPIRAN).createSignedUrl(path, 300);
  if (error || !data) return toast.error("Foto tidak tersedia.");
  window.open(data.signedUrl, "_blank", "noopener");
}

export function InspeksiDetailView({
  doc,
  perms,
  riskOptions,
  people,
  today,
}: {
  doc: InspectionDetail;
  perms: InspectionPerms;
  riskOptions: SelectOption[];
  people: SelectOption[];
  today: string;
}) {
  const router = useRouter();
  const online = useOnline();
  const [note, setNote] = useState("");
  const [starting, setStarting] = useState(false);
  const done = doc.status === "submitted" || doc.status === "verified";
  const total = doc.answers.length;
  const answered = doc.answers.filter((a) => a.answer).length;

  const start = async () => {
    setStarting(true);
    const res = await startInspectionAction(doc.id);
    setStarting(false);
    if (res.status === "ok") {
      toast.success(res.message);
      router.refresh();
    } else toast.error(res.message);
  };
  const expectOk = (res: { status: string; message?: string }) => {
    if (res.status !== "ok") {
      toast.error(res.message ?? "Gagal.");
      throw new Error(res.message);
    }
    toast.success(res.message ?? "Berhasil.");
  };

  return (
    <div className="col-span-12 grid grid-cols-12 gap-4 md:gap-6 [&>*]:min-w-0">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{doc.code}</span>
            <StatusBadge value={doc.displayStatus} map={INSPECTION_STATUS} tone="solid" />
            <span className={cn("rounded-md border px-2 py-0.5 text-xs font-medium", typeChipClass(doc.typeColor))}>{doc.typeLabel}</span>
          </span>
        }
        description={`${doc.title}${doc.objectText ? ` · ${doc.objectText}` : ""}`}
        actions={
          <>
            <ActivityLogDialog entity="inspections" recordId={doc.id} fieldLabels={INSPECTION_FIELD_LABELS} />
            {perms.canCancel && (
              <ConfirmDialog
                title={`Batalkan ${doc.code}?`}
                description="Jadwal tidak dihitung di rencana bulan ini. Pemeriksa diberi tahu."
                confirmText="Batalkan Inspeksi"
                destructive
                confirmDisabled={!note.trim()}
                onOpenChange={() => setNote("")}
                onConfirm={async () => {
                  expectOk(await cancelInspectionAction(doc.id, note));
                  router.refresh();
                }}
                trigger={
                  <Button type="button" variant="outline" size="sm" disabled={!online}>
                    <Ban /> Batalkan
                  </Button>
                }
              >
                <div className="space-y-1.5">
                  <Label htmlFor="cancel-reason">Alasan (wajib)</Label>
                  <Textarea id="cancel-reason" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} className="text-base md:text-sm" />
                </div>
              </ConfirmDialog>
            )}
          </>
        }
      />

      <div className="col-span-12 grid gap-x-8 gap-y-2 rounded-xl border bg-card p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Info icon={MapPin} label="Lokasi" value={`${doc.siteName} · ${doc.areaName}`} />
        <Info icon={CalendarClock} label="Rencana" value={`${formatDateTime(doc.plannedAt)}`} />
        <Info icon={User} label="Pemeriksa" value={doc.inspector ? <UserProfileCard userId={doc.inspector.id} name={doc.inspector.name} avatarUrl={doc.inspector.avatarUrl} size="xs" /> : "-"} />
        <Info label={doc.objectLabel ?? "Objek"} value={doc.objectText ?? "-"} />
      </div>

      {doc.status === "cancelled" && (
        <div className="col-span-12 flex gap-3 rounded-lg border bg-muted/40 p-4 text-sm">
          <Ban className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">Inspeksi dibatalkan</p>
            {doc.cancelReason && <p className="text-muted-foreground [overflow-wrap:anywhere] whitespace-pre-wrap">{doc.cancelReason}</p>}
          </div>
        </div>
      )}

      {doc.status === "scheduled" && (
        <div className="col-span-12">
          <Content title="Belum dimulai" size="lg">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {perms.canStart ? "Mulai inspeksi saat Anda berada di lokasi. Checklist disalin dari template saat dimulai." : `Menunggu ${doc.inspector?.name ?? "pemeriksa"} memulai inspeksi.`}
                {doc.displayStatus === "late" && <strong className="ml-1 text-red-600 dark:text-red-400">Jadwal sudah terlewat.</strong>}
              </p>
              {perms.canStart &&
                (doc.templateItems > 0 ? (
                  <Button type="button" onClick={start} disabled={starting || !online}>
                    <Play /> Mulai Inspeksi
                  </Button>
                ) : (
                  <p className="text-sm text-destructive">Template tidak punya butir. Hubungi HSE.</p>
                ))}
            </div>
          </Content>
        </div>
      )}

      {doc.status === "in_progress" && perms.canFill && (
        <div className="col-span-12">
          <ChecklistEditor key={doc.updatedAt} doc={doc} riskOptions={riskOptions} people={people} userId={perms.userId} today={today} canCreateFindings={perms.canCreateFindings} />
        </div>
      )}
      {doc.status === "in_progress" && !perms.canFill && (
        <div className="col-span-12">
          <Content title="Sedang berjalan" size="lg">
            <p className="text-sm text-muted-foreground">
              {doc.inspector?.name ?? "Pemeriksa"} sedang mengisi checklist ({answered}/{total} butir). Hasil tampil setelah dikirim.
            </p>
          </Content>
        </div>
      )}

      {done && (
        <>
          <div className="col-span-12 grid grid-cols-3 gap-3 sm:max-w-md">
            {[
              ["Sesuai", doc.summary?.compliant ?? 0, ""],
              ["Tidak Sesuai", doc.summary?.noncompliant ?? 0, "text-red-600 dark:text-red-400"],
              ["N/A", doc.summary?.na ?? 0, ""],
            ].map(([l, n, c]) => (
              <div key={String(l)} className="rounded-xl border bg-card p-3 text-center">
                <strong className={cn("block text-2xl tabular-nums", String(c))}>{n}</strong>
                <span className="text-xs text-muted-foreground">{l}</span>
              </div>
            ))}
          </div>

          <div className="col-span-12 flex flex-col gap-4 lg:col-span-8">
            <Content title="Hasil Checklist" description={`${total} butir`} size="lg">
              <ol className="space-y-2">
                {doc.answers.map((a) => (
                  <li key={a.lineNo} className={cn("rounded-lg border p-3", a.answer === "noncompliant" && "border-red-300 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20")}>
                    <div className="flex items-start gap-3">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">{a.lineNo}</span>
                      <p className="min-w-0 flex-1 text-sm">{a.itemText}</p>
                      <span
                        className={cn(
                          "flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
                          a.answer === "compliant" && "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300",
                          a.answer === "noncompliant" && "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
                        )}
                      >
                        {a.answer === "compliant" && <Check className="size-3" />}
                        {a.answer === "noncompliant" && <X className="size-3" />}
                        {a.answer ? ANSWER_LABEL[a.answer] : "-"}
                      </span>
                    </div>
                    {(a.comment || a.photos.length > 0 || a.finding) && (
                      <div className="mt-2 space-y-1.5 pl-9 text-sm">
                        {a.comment && <p className="text-muted-foreground [overflow-wrap:anywhere]">{a.comment}</p>}
                        {a.photos.length > 0 && (
                          <p className="flex flex-wrap gap-1.5">
                            {a.photos.map((p, i) => (
                              <button key={p} type="button" onClick={() => openFile(p)} className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-0.5 text-xs hover:border-primary/40 hover:text-primary">
                                Foto {i + 1} <ExternalLink className="size-3" />
                              </button>
                            ))}
                          </p>
                        )}
                        {a.finding && (
                          <Link href={`/temuan/${a.finding.id}`} className="inline-flex items-center gap-2 rounded-md border bg-background px-2 py-1 text-xs hover:border-primary/40">
                            <span className="font-mono font-semibold text-primary">{a.finding.code}</span>
                            <StatusBadge value={a.finding.status} map={FINDING_STATUS} />
                          </Link>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </Content>
          </div>

          <div className="col-span-12 flex flex-col gap-4 lg:col-span-4">
            <Content title="Verifikasi" size="lg">
              {doc.status === "verified" ? (
                <div className="space-y-1 text-sm">
                  <p className="flex items-center gap-1.5 font-medium text-green-700 dark:text-green-400">
                    <Check className="size-4" /> Diverifikasi {doc.verifier ? `oleh ${doc.verifier.name}` : ""}
                  </p>
                  {doc.verifiedAt && <p className="text-muted-foreground">{formatDateTime(doc.verifiedAt)}</p>}
                  {doc.verifyNote && <p className="text-muted-foreground [overflow-wrap:anywhere] whitespace-pre-wrap">{doc.verifyNote}</p>}
                </div>
              ) : perms.canVerify ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Periksa hasil dan temuan yang dibuat, lalu verifikasi.</p>
                  <div className="space-y-1.5">
                    <Label htmlFor="verify-note">Catatan (opsional)</Label>
                    <Textarea id="verify-note" rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} className="text-base md:text-sm" />
                  </div>
                  <ConfirmDialog
                    title={`Verifikasi ${doc.code}?`}
                    confirmText="Verifikasi"
                    onConfirm={async () => {
                      expectOk(await verifyInspectionAction(doc.id, note));
                      router.refresh();
                    }}
                    trigger={
                      <Button type="button" className="w-full" disabled={!online}>
                        <Check /> Verifikasi
                      </Button>
                    }
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {perms.isInspector ? "Pemeriksa tidak dapat memverifikasi inspeksinya sendiri. " : ""}Menunggu verifikasi HSE.
                </p>
              )}
            </Content>
            <Content title="Waktu" size="lg">
              <dl className="space-y-1.5 text-sm">
                <Row label="Dimulai" v={doc.startedAt} />
                <Row label="Dikirim" v={doc.submittedAt} />
                <Row label="Diverifikasi" v={doc.verifiedAt} />
              </dl>
            </Content>
          </div>
        </>
      )}
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon?: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {Icon && <Icon className="size-3.5" />} {label}
      </p>
      <div className="font-medium [overflow-wrap:anywhere]">{value}</div>
    </div>
  );
}
function Row({ label, v }: { label: string; v: string | null }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{v ? formatDateTime(v) : "-"}</dd>
    </div>
  );
}
