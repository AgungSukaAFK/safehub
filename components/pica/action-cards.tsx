"use client";

// Rencana Tindakan (prototipe finding-management ActionCard): kartu tindakan bisa dibuka-tutup,
// dikelompokkan Koreksi/Pencegahan. Blok aksi sesuai peran: PIC (unggah bukti), verifikator
// (Terima/Kembalikan), pengelola (ubah due date beralasan). Deep link ?tindakan=<kode>.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, CheckCircle2, ChevronDown, CornerUpLeft, ExternalLink, FileText, History, Play, Plus, Upload } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ActivityLogDialog } from "@/components/detail/activity-log-dialog";
import { StatusBadge } from "@/components/detail/status-badge";
import { DatePicker } from "@/components/form/date-picker";
import { type SelectOption } from "@/components/form/searchable-select";
import { ActionFormSheet, EvidenceSheet, type ActionPrefill } from "@/components/pica/pica-sheets";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UserProfileCard } from "@/components/user/user-profile-card";
import { BUCKET_LAMPIRAN } from "@/lib/app-config";
import type { FormState } from "@/lib/form-state";
import { formatDate, formatDateTime, todayWib } from "@/lib/format";
import { useOnline } from "@/lib/offline/use-online";
import type { PicaAction } from "@/lib/pica";
import { ACTION_FIELD_LABELS, ACTION_GROUP_LABEL, ACTION_KIND_LABEL, ACTION_STATUS, actionDisplayStatus, daysLate } from "@/lib/pica-rules";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { changeDueAction, setEffectivenessAction, startActionAction, verifyActionAction } from "@/app/(app)/temuan/actions";

export type PicaViewer = {
  userId: string;
  /** boleh menambah tindakan (RPC pica_create memeriksa ulang) */
  canAdd: boolean;
  /** boleh mengubah due date (RPC pica_change_due memeriksa ulang) */
  canManage: boolean;
  isHse: boolean;
};

function expectOk(res: FormState) {
  if (res.status !== "ok") {
    toast.error(res.message);
    throw new Error(res.message);
  }
  toast.success(res.message);
}

async function openFile(path: string) {
  const { data, error } = await createClient().storage.from(BUCKET_LAMPIRAN).createSignedUrl(path, 300);
  if (error || !data) return toast.error("File tidak tersedia.", { description: "File bukti mungkin sudah dihapus dari penyimpanan." });
  window.open(data.signedUrl, "_blank", "noopener");
}

/** Daftar tindakan + tombol Tambah (drawer). `focusCode` = kode tindakan dari URL (dibuka & digulir). */
export function ActionPlan({
  actions,
  parent,
  viewer,
  people,
  defaultVerifierId,
  focusCode,
  locked,
  prefill,
  onPrefillUsed,
}: {
  actions: PicaAction[];
  parent: { findingId?: string; incidentId?: string };
  viewer: PicaViewer;
  people: SelectOption[];
  defaultVerifierId: string | null;
  focusCode?: string | null;
  /** induk sudah ditutup / belum boleh ditambah: sembunyikan tombol Tambah */
  locked?: boolean;
  /** isian awal drawer dari "Jadikan Tindakan" (analisis penyebab) */
  prefill?: ActionPrefill | null;
  onPrefillUsed?: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [formKey, setFormKey] = useState(0);
  // buka drawer saat ada prefill baru (render-time sync, tanpa setState di effect)
  const [lastPrefill, setLastPrefill] = useState<ActionPrefill | null | undefined>(null);
  if (prefill && prefill !== lastPrefill) {
    setLastPrefill(prefill);
    setFormKey((k) => k + 1);
    setAdding(true);
  }
  const canAdd = viewer.canAdd && !locked;
  const groups = (["corrective", "preventive"] as const).map((k) => ({ kind: k, items: actions.filter((a) => a.kind === k) })).filter((g) => g.items.length);
  let n = 0;

  return (
    <div className="space-y-3">
      {canAdd && (
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setLastPrefill(null);
              setFormKey((k) => k + 1);
              setAdding(true);
            }}
          >
            <Plus /> Tambah Tindakan
          </Button>
        </div>
      )}
      {actions.length === 0 && (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Belum ada tindakan.{canAdd ? " Tambahkan tindakan koreksi atau pencegahan." : ""}
        </p>
      )}
      {groups.map((g) => (
        <section key={g.kind} className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <span>{ACTION_GROUP_LABEL[g.kind]}</span>
            <span>{g.items.length} tindakan</span>
          </div>
          {g.items.map((a) => (
            <ActionCard key={a.id} action={a} index={++n} viewer={viewer} focus={focusCode === a.code} />
          ))}
        </section>
      ))}
      {adding && (
        <ActionFormSheet
          key={formKey}
          open={adding}
          onOpenChange={(o) => {
            setAdding(o);
            if (!o) onPrefillUsed?.();
          }}
          parent={parent}
          people={people}
          defaultVerifierId={defaultVerifierId}
          prefill={lastPrefill}
        />
      )}
    </div>
  );
}

function ActionCard({ action: a, index, viewer, focus }: { action: PicaAction; index: number; viewer: PicaViewer; focus: boolean }) {
  const router = useRouter();
  const online = useOnline();
  const today = todayWib();
  const display = actionDisplayStatus(a, today);
  const [open, setOpen] = useState(focus || a.status !== "closed");
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [due, setDue] = useState<string | null>(a.dueDate);
  const [reason, setReason] = useState("");
  const [effDate, setEffDate] = useState<string | null>(a.effectivenessDate ?? today);
  const [effNote, setEffNote] = useState(a.effectivenessNote ?? "");
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (focus) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focus]);

  const isPic = a.pic?.id === viewer.userId;
  const isVerifier = a.verifier?.id === viewer.userId;
  const current = a.evidence.find((e) => e.round === a.round) ?? null;
  const lastReturn = a.evidence.find((e) => e.decision === "returned") ?? null;
  const accepted = a.evidence.find((e) => e.decision === "accepted") ?? null;
  const late = a.status !== "closed" ? daysLate(a.dueDate, today) : 0;
  const refresh = () => router.refresh();

  return (
    <article ref={ref} id={`tindakan-${a.code}`} className={cn("rounded-lg border bg-card", focus && "ring-2 ring-primary/40")}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex w-full items-start gap-3 p-3 text-left">
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">{index}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium [overflow-wrap:anywhere]">{a.title}</span>
            <span className="block text-xs text-muted-foreground">
              <span className="font-mono">{a.code}</span> · {ACTION_KIND_LABEL[a.kind]}
            </span>
          </span>
          <StatusBadge value={display} map={ACTION_STATUS} />
          <ChevronDown className={cn("mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-3 border-t p-3">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:grid-cols-4">
              <div>
                <dt className="text-xs text-muted-foreground">PIC</dt>
                <dd className="font-medium">{a.pic ? <UserProfileCard userId={a.pic.id} name={a.pic.name} avatarUrl={a.pic.avatarUrl} size="xs" /> : "-"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Due date</dt>
                <dd className={cn("font-medium", late > 0 && "text-red-600 dark:text-red-400")}>
                  {formatDate(a.dueDate)}
                  {late > 0 && <span className="block text-xs">Terlambat {late} hari</span>}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Verifikator</dt>
                <dd className="font-medium">{a.verifier ? <UserProfileCard userId={a.verifier.id} name={a.verifier.name} avatarUrl={a.verifier.avatarUrl} size="xs" /> : "-"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Bukti</dt>
                <dd className="font-medium">{current ? `${current.files.length} file` : "Belum ada"}</dd>
              </div>
              {a.requiredEvidence && (
                <div className="col-span-2 md:col-span-4">
                  <dt className="text-xs text-muted-foreground">Bukti yang diwajibkan</dt>
                  <dd>{a.requiredEvidence}</dd>
                </div>
              )}
              {a.causeRef && (
                <div className="col-span-2 md:col-span-4">
                  <dt className="text-xs text-muted-foreground">Penyebab terkait</dt>
                  <dd>{a.causeRef}</dd>
                </div>
              )}
            </dl>

            {/* dikembalikan: catatan verifikator terakhir untuk PIC */}
            {a.returned && a.status !== "closed" && lastReturn && (
              <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/40">
                <CornerUpLeft className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300" />
                <div>
                  <p className="font-medium">Dikembalikan oleh {lastReturn.decidedBy?.name ?? "verifikator"}</p>
                  <p className="text-muted-foreground [overflow-wrap:anywhere] whitespace-pre-wrap">{lastReturn.decisionNote}</p>
                </div>
              </div>
            )}

            {/* PIC: kerjakan & unggah bukti */}
            {isPic && (a.status === "open" || a.status === "in_progress") && (
              <div className="flex flex-col gap-3 rounded-md border border-dashed p-3 sm:flex-row sm:items-center">
                <Upload className="size-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium">Bukti penyelesaian belum dikirim</p>
                  <p className="text-muted-foreground">Unggah bukti agar tindakan dapat diverifikasi.</p>
                </div>
                <div className="flex gap-2">
                  {a.status === "open" && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!online}
                      onClick={async () => {
                        const res = await startActionAction(a.id);
                        if (res.status === "ok") {
                          toast.success(res.message);
                          refresh();
                        } else toast.error(res.message);
                      }}
                    >
                      <Play /> Mulai
                    </Button>
                  )}
                  <Button type="button" size="sm" disabled={!online} onClick={() => setEvidenceOpen(true)}>
                    <Upload /> Unggah Bukti
                  </Button>
                </div>
              </div>
            )}
            {!isPic && (a.status === "open" || a.status === "in_progress") && (
              <p className="text-sm text-muted-foreground">Menunggu PIC mengirim bukti penyelesaian.</p>
            )}

            {/* bukti putaran berjalan */}
            {a.status === "waiting_verification" && current && (
              <div className="space-y-3 rounded-md border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">
                  Dikirim {current.submittedBy?.name ?? "PIC"} · {formatDateTime(current.submittedAt)}
                  {a.round > 1 && ` · Putaran ${a.round}`}
                </p>
                {current.note && <p className="text-sm [overflow-wrap:anywhere] whitespace-pre-wrap">{current.note}</p>}
                <FileList files={current.files} />
                {isVerifier ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Tindakan belum Closed sampai bukti diverifikasi.</p>
                    <Label htmlFor={`cmt-${a.id}`}>Komentar verifikator</Label>
                    <Textarea
                      id={`cmt-${a.id}`}
                      rows={2}
                      maxLength={2000}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Tuliskan hasil pemeriksaan bukti"
                      className="text-base md:text-sm"
                    />
                    <div className="flex flex-wrap gap-2">
                      <ConfirmDialog
                        title={`Terima bukti ${a.code}?`}
                        description="Tindakan menjadi Closed."
                        confirmText="Terima"
                        onConfirm={async () => {
                          expectOk(await verifyActionAction(a.id, "accept", comment));
                          refresh();
                        }}
                        trigger={
                          <Button type="button" size="sm" disabled={!comment.trim() || !online}>
                            <Check /> Terima
                          </Button>
                        }
                      />
                      <ConfirmDialog
                        title={`Kembalikan ${a.code} ke PIC?`}
                        description="PIC memperbaiki lalu mengirim bukti baru (putaran berikutnya)."
                        confirmText="Kembalikan"
                        onConfirm={async () => {
                          expectOk(await verifyActionAction(a.id, "return", comment));
                          refresh();
                        }}
                        trigger={
                          <Button type="button" size="sm" variant="outline" disabled={!comment.trim() || !online}>
                            <CornerUpLeft /> Minta Perbaikan
                          </Button>
                        }
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Menunggu verifikasi {a.verifier?.name ?? "verifikator"}.</p>
                )}
              </div>
            )}

            {/* closed */}
            {a.status === "closed" && (
              <div className="space-y-3">
                <div className="flex gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm dark:border-green-900 dark:bg-green-950/40">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-700 dark:text-green-400" />
                  <div className="min-w-0">
                    <p className="font-medium">Bukti diterima oleh {accepted?.decidedBy?.name ?? a.verifier?.name ?? "verifikator"}</p>
                    <p className="text-muted-foreground">
                      {accepted?.decidedAt ? formatDateTime(accepted.decidedAt) : a.closedAt ? formatDateTime(a.closedAt) : ""}
                      {accepted?.decisionNote ? ` · ${accepted.decisionNote}` : ""}
                    </p>
                    {accepted && <FileList files={accepted.files} className="mt-2" />}
                  </div>
                </div>
                {a.effectivenessDate ? (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Verifikasi efektivitas: </span>
                    {formatDate(a.effectivenessDate)}
                    {a.effectivenessNote ? ` · ${a.effectivenessNote}` : ""}
                  </p>
                ) : (
                  (isVerifier || viewer.isHse) && (
                    <ConfirmDialog
                      title="Verifikasi efektivitas"
                      description="Catat tanggal pemeriksaan bahwa tindakan efektif mencegah kejadian berulang (opsional)."
                      confirmText="Simpan"
                      confirmDisabled={!effDate}
                      onConfirm={async () => {
                        expectOk(await setEffectivenessAction(a.id, effDate!, effNote));
                        refresh();
                      }}
                      trigger={
                        <Button type="button" size="sm" variant="outline">
                          <CalendarClock /> Verifikasi Efektivitas
                        </Button>
                      }
                    >
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <Label htmlFor={`eff-${a.id}`}>Tanggal</Label>
                          <DatePicker id={`eff-${a.id}`} value={effDate} onValueChange={setEffDate} max={today} />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`effn-${a.id}`}>Catatan (opsional)</Label>
                          <Textarea id={`effn-${a.id}`} rows={2} value={effNote} onChange={(e) => setEffNote(e.target.value)} className="text-base md:text-sm" />
                        </div>
                      </div>
                    </ConfirmDialog>
                  )
                )}
              </div>
            )}

            {/* riwayat bukti putaran sebelumnya */}
            {a.evidence.filter((e) => e.decision === "returned").length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Riwayat bukti dikembalikan</summary>
                <ul className="mt-2 space-y-2">
                  {a.evidence
                    .filter((e) => e.decision === "returned")
                    .map((e) => (
                      <li key={e.round} className="rounded-md border p-2">
                        <p className="text-xs text-muted-foreground">
                          Putaran {e.round} · dikirim {formatDateTime(e.submittedAt)} · dikembalikan {e.decidedAt ? formatDateTime(e.decidedAt) : ""}
                        </p>
                        {e.decisionNote && <p className="mt-1">{e.decisionNote}</p>}
                        <FileList files={e.files} className="mt-1" />
                      </li>
                    ))}
                </ul>
              </details>
            )}

            <div className="flex flex-wrap items-center gap-2 border-t pt-3">
              {viewer.canManage && a.status !== "closed" && (
                <ConfirmDialog
                  title={`Ubah due date ${a.code}?`}
                  description="Perubahan ini dicatat pada Riwayat dan audit trail. PIC diberi tahu."
                  confirmText="Konfirmasi Perubahan"
                  confirmDisabled={!due || due === a.dueDate || !reason.trim()}
                  onOpenChange={(o) => {
                    if (!o) {
                      setDue(a.dueDate);
                      setReason("");
                    }
                  }}
                  onConfirm={async () => {
                    expectOk(await changeDueAction(a.id, due!, reason));
                    refresh();
                  }}
                  trigger={
                    <Button type="button" size="sm" variant="ghost">
                      <CalendarClock /> Ubah due date
                    </Button>
                  }
                >
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor={`due-${a.id}`}>Due date baru</Label>
                      <DatePicker id={`due-${a.id}`} value={due} onValueChange={setDue} min={today} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`rsn-${a.id}`}>Alasan (wajib)</Label>
                      <Textarea
                        id={`rsn-${a.id}`}
                        rows={2}
                        maxLength={1000}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Tuliskan alasan secara jelas dan spesifik"
                        className="text-base md:text-sm"
                      />
                    </div>
                  </div>
                </ConfirmDialog>
              )}
              <ActivityLogDialog
                entity="pica_actions"
                recordId={a.id}
                fieldLabels={ACTION_FIELD_LABELS}
                trigger={
                  <Button type="button" size="sm" variant="ghost">
                    <History /> Riwayat
                  </Button>
                }
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
      {evidenceOpen && <EvidenceSheet action={a} open={evidenceOpen} onOpenChange={setEvidenceOpen} />}
    </article>
  );
}

function FileList({ files, className }: { files: { path: string; name: string }[]; className?: string }) {
  if (!files.length) return null;
  return (
    <ul className={cn("flex flex-wrap gap-2", className)}>
      {files.map((f) => (
        <li key={f.path}>
          <button
            type="button"
            onClick={() => openFile(f.path)}
            className="inline-flex max-w-64 items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs hover:border-primary/40 hover:text-primary"
          >
            <FileText className="size-3.5 shrink-0" />
            <span className="truncate">{f.name}</span>
            <ExternalLink className="size-3 shrink-0 opacity-60" />
          </button>
        </li>
      ))}
    </ul>
  );
}
