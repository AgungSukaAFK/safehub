"use client";

// CONTOH boilerplate: detail dokumen standar. Kiri: info, barang, lampiran. Kanan: kartu Tindakan
// (sesuai peran user saat ini) + Jalur Approval. Dokumen cetak A4 dirender tersembunyi (print-only).
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CalendarPlus,
  Check,
  ChevronDown,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Pencil,
  Printer,
  QrCode,
  Send,
  Trash2,
  Undo2,
  User,
  Wallet,
  X,
} from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ActivityLogDialog } from "@/components/detail/activity-log-dialog";
import { ApprovalPath } from "@/components/detail/approval-path";
import { FollowupButton } from "@/components/detail/followup-button";
import { InfoItem } from "@/components/detail/info-item";
import { StatusBadge } from "@/components/detail/status-badge";
import { StepChain, type StepChainItem } from "@/components/detail/step-chain";
import { FileDropzone } from "@/components/form/file-dropzone";
import { Content } from "@/components/list/content";
import { PageHeader } from "@/components/page-header";
import { PrintableDocument, type PrintColumn, type PrintMode } from "@/components/print/printable-document";
import { Button, buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { UserProfileCard } from "@/components/user/user-profile-card";
import { useNow } from "@/hooks/use-now";
import { currentTurn } from "@/lib/approval-types";
import { APP_NAME, APP_URL, BUCKET_LAMPIRAN } from "@/lib/app-config";
import { ACCEPT_DOCS, compressImage, safeStorageName } from "@/lib/attachments";
import type { Company } from "@/lib/company-types";
import type { FormState } from "@/lib/form-state";
import { formatBytes, formatDate, formatDateTime, formatNumber, formatRupiah } from "@/lib/format";
import { useOnline } from "@/lib/offline/use-online";
import type { PengajuanDetail, PengajuanItem } from "@/lib/pengajuan";
import { EDITABLE_STATUSES, PENGAJUAN_FIELD_LABELS } from "@/lib/pengajuan-rules";
import { printWithFileName } from "@/lib/print";
import { roleAtLeast, type Role } from "@/lib/roles";
import { APPROVAL_TYPE_LABELS, DOCUMENT_STATUS } from "@/lib/status";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { cancelPengajuanAction, decidePengajuanAction, deletePengajuanAction, followupPengajuanAction, logPrintAction, submitPengajuanAction } from "../actions";

const PRINT_COLUMNS: PrintColumn<PengajuanItem>[] = [
  { label: "No", className: "w-[28px] text-center", cell: (_r, i) => i + 1 },
  {
    label: "Barang",
    cell: (r) => (
      <>
        <span className="font-medium">{r.itemName}</span>
        {r.partNumber && <span> · PN {r.partNumber}</span>}
        {r.note && <span className="block italic">{r.note}</span>}
      </>
    ),
  },
  { label: "Jumlah", className: "w-[70px] text-right", cell: (r) => `${formatNumber(r.qty)} ${r.unit}` },
  { label: "Harga Satuan", className: "w-[95px] text-right", cell: (r) => formatRupiah(r.unitPrice) },
  { label: "Subtotal", className: "w-[100px] text-right", cell: (r) => formatRupiah(r.subtotal) },
];

/** Hasil Server Action → toast; lempar error supaya ConfirmDialog tetap terbuka. */
function expectOk(res: FormState) {
  if (res.status !== "ok") {
    toast.error(res.message);
    throw new Error(res.message);
  }
  toast.success(res.message);
}

export function PengajuanDetailView({
  doc,
  company,
  userId,
  role,
  printedBy,
  autoPrint,
}: {
  doc: PengajuanDetail;
  company: Company | null;
  userId: string;
  role: Role;
  printedBy: string;
  autoPrint: "qr" | "basah" | null;
}) {
  const router = useRouter();
  const online = useOnline();
  const now = useNow();
  const [note, setNote] = useState("");
  const [printMode, setPrintMode] = useState<PrintMode>(doc.code ? "qr" : "preview");
  const [uploading, setUploading] = useState(false);

  const isOwner = doc.requester?.id === userId;
  const isAdmin = role === "admin";
  const editable = EDITABLE_STATUSES.includes(doc.status) && ((isOwner && roleAtLeast(role, "editor")) || isAdmin);
  const turn = doc.status === "pending_approval" ? currentTurn(doc.steps) : null;
  const myTurn = turn?.approver.id === userId;
  const canCancel = doc.status === "pending_approval" && (isOwner || isAdmin);
  const canDelete = doc.status === "draft" && ((isOwner && roleAtLeast(role, "editor")) || isAdmin);
  const canFollowup = isOwner || roleAtLeast(role, "editor");
  const lastReject = doc.status === "rejected" ? doc.steps.find((s) => s.status === "rejected") : undefined;
  const label = doc.code ?? `draft "${doc.title}"`;
  const refresh = () => router.refresh();

  // ---------------------------------------------------------------- cetak
  const print = async (mode: PrintMode) => {
    setPrintMode(mode);
    void logPrintAction(doc.id, doc.code ?? "Draft", mode).catch(() => undefined);
    // tunggu render ulang dokumen cetak dengan mode baru
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await printWithFileName(doc.code ?? `Pratinjau-${doc.title}`);
  };
  const autoPrinted = useRef(false);
  useEffect(() => {
    if (!autoPrint || autoPrinted.current || !doc.code) return;
    autoPrinted.current = true;
    const t = window.setTimeout(() => {
      void print(autoPrint);
      router.replace(`/pengajuan/${doc.id}`, { scroll: false });
    }, 300);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPrint]);

  // ---------------------------------------------------------------- lampiran
  const upload = async (files: File[]) => {
    setUploading(true);
    const supabase = createClient();
    let okCount = 0;
    for (const f of files) {
      const file = await compressImage(f);
      const { error } = await supabase.storage.from(BUCKET_LAMPIRAN).upload(`${doc.id}/${safeStorageName(file.name)}`, file, { contentType: file.type || undefined });
      if (error) toast.error(`Gagal mengunggah ${f.name}`, { description: error.message });
      else okCount++;
    }
    setUploading(false);
    if (okCount) {
      toast.success(`${okCount} lampiran diunggah.`);
      refresh();
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
    refresh();
  };

  // ---------------------------------------------------------------- rantai proses
  const chain: StepChainItem[] = [
    { key: "draft", label: "Dibuat", state: "done", detail: doc.requester?.name.split(" ")[0] },
    ...doc.steps
      .filter((s) => s.status !== "skipped")
      .map((s): StepChainItem => ({
        key: s.id,
        label: APPROVAL_TYPE_LABELS[s.type] ?? s.type,
        detail: s.approver.name.split(" ")[0],
        state: s.status === "approved" ? "done" : s.status === "rejected" ? "rejected" : turn?.id === s.id ? "current" : "pending",
      })),
    { key: "selesai", label: "Disetujui", state: doc.status === "approved" || doc.status === "completed" ? "done" : "pending" },
  ];

  return (
    <>
      <div className="no-print col-span-12 grid grid-cols-12 gap-4 md:gap-6 [&>*]:min-w-0">
        <PageHeader
          title={
            <span className="flex flex-wrap items-center gap-2">
              <span className={doc.code ? "font-mono" : undefined}>{doc.code ?? "Draft"}</span>
              <StatusBadge value={doc.status} map={DOCUMENT_STATUS} tone="solid" />
            </span>
          }
          description={doc.title}
          actions={
            <>
              <ActivityLogDialog entity="pengajuan" recordId={doc.id} fieldLabels={PENGAJUAN_FIELD_LABELS} />
              <a href={`/pengajuan/${doc.id}/ekspor`} className={buttonVariants({ variant: "outline", size: "sm" })} download>
                <FileSpreadsheet /> Excel
              </a>
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
                  <Printer /> Cetak <ChevronDown />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  {doc.code ? (
                    <>
                      <DropdownMenuItem onClick={() => print("qr")}>
                        <QrCode /> Dengan QR (tanda tangan digital)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => print("basah")}>
                        <Pencil /> Tanpa QR (tanda tangan basah)
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <DropdownMenuItem onClick={() => print("preview")}>
                      <Printer /> Pratinjau cetak (belum diajukan)
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          }
        />

        {lastReject && (
          <div className="col-span-12 flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm dark:border-red-900 dark:bg-red-950/40">
            <AlertTriangle className="size-5 shrink-0 text-red-600 dark:text-red-400" />
            <div className="min-w-0">
              <p className="font-medium">Ditolak oleh {lastReject.approver.name}{lastReject.decidedAt ? ` · ${formatDateTime(lastReject.decidedAt)}` : ""}</p>
              {lastReject.note && <p className="mt-1 [overflow-wrap:anywhere] whitespace-pre-wrap text-muted-foreground">{lastReject.note}</p>}
              {editable && <p className="mt-1 text-muted-foreground">Perbaiki pengajuan lalu ajukan ulang.</p>}
            </div>
          </div>
        )}

        <div className="col-span-12 flex flex-col gap-4 md:gap-6 lg:col-span-8 [&>*]:min-w-0">
          <Content title="Informasi" size="lg">
            <div className="space-y-4">
              <div className="overflow-x-auto pb-1">
                <div className="min-w-[420px]">
                  <StepChain steps={chain} />
                </div>
              </div>
              <div className="grid gap-x-8 gap-y-2 md:grid-cols-2">
                <InfoItem icon={User} label="Pemohon" value={doc.requester ? <UserProfileCard userId={doc.requester.id} name={doc.requester.name} avatarUrl={doc.requester.avatarUrl} size="xs" /> : "-"} />
                <InfoItem icon={Building2} label="Perusahaan" value={[company?.shortName ?? doc.companyCode, doc.departmentName].filter(Boolean).join(" · ")} />
                <InfoItem icon={CalendarPlus} label="Dibuat" value={formatDateTime(doc.createdAt)} />
                <InfoItem icon={CalendarClock} label="Dibutuhkan" value={doc.neededDate ? formatDate(doc.neededDate) : "-"} />
                <InfoItem icon={Wallet} label="Total" value={<span className="tabular-nums">{formatRupiah(doc.total)}</span>} />
              </div>
              {doc.description && <InfoItem icon={FileText} label="Keterangan" isBlock value={<span className="[overflow-wrap:anywhere] whitespace-pre-wrap">{doc.description}</span>} />}
            </div>
          </Content>

          <Content title="Barang" description={`${doc.items.length} baris`} size="lg">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 text-center">No</TableHead>
                  <TableHead>Barang</TableHead>
                  <TableHead className="w-28 text-right">Jumlah</TableHead>
                  <TableHead className="w-36 text-right">Harga Satuan</TableHead>
                  <TableHead className="w-36 text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {doc.items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="text-center text-muted-foreground">{it.lineNo}</TableCell>
                    <TableCell className="whitespace-normal">
                      <p className="font-medium">{it.itemName}</p>
                      {(it.partNumber || it.note) && <p className="text-xs text-muted-foreground">{[it.partNumber && `PN ${it.partNumber}`, it.note].filter(Boolean).join(" · ")}</p>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(it.qty)} {it.unit}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatRupiah(it.unitPrice)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatRupiah(it.subtotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4} className="text-right">
                    Total
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatRupiah(doc.total)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </Content>

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
                      {editable && (
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
                !editable && <p className="text-sm text-muted-foreground">Tidak ada lampiran.</p>
              )}
              {editable && <FileDropzone multiple accept={ACCEPT_DOCS} loading={uploading} disabled={!online} onFiles={upload} hint="PDF, gambar, Excel, Word · maks 20 MB per file" />}
            </div>
          </Content>
        </div>

        <div className="col-span-12 flex flex-col gap-4 md:gap-6 lg:col-span-4 [&>*]:min-w-0">
          <Content title="Tindakan" size="lg">
            <div className="flex flex-col gap-2">
              {myTurn && turn && (
                <>
                  <p className="text-sm text-muted-foreground">
                    Giliran Anda untuk <span className="font-medium text-foreground">{(APPROVAL_TYPE_LABELS[turn.type] ?? turn.type).toLowerCase()}</span> pengajuan ini.
                  </p>
                  <ConfirmDialog
                    title={`Setujui ${label}?`}
                    description="Catatan bersifat opsional dan terlihat oleh pemohon."
                    confirmText="Ya, setujui"
                    onOpenChange={() => setNote("")}
                    onConfirm={async () => {
                      expectOk(await decidePengajuanAction(turn.id, "approved", note));
                      refresh();
                    }}
                    trigger={
                      <Button className="w-full" disabled={!online}>
                        <Check /> Setujui
                      </Button>
                    }
                  >
                    <NoteField value={note} onChange={setNote} label="Catatan (opsional)" />
                  </ConfirmDialog>
                  <ConfirmDialog
                    title={`Tolak ${label}?`}
                    description="Pemohon dapat memperbaiki lalu mengajukan ulang."
                    confirmText="Tolak"
                    destructive
                    confirmDisabled={note.trim().length < 5}
                    onOpenChange={() => setNote("")}
                    onConfirm={async () => {
                      expectOk(await decidePengajuanAction(turn.id, "rejected", note));
                      refresh();
                    }}
                    trigger={
                      <Button variant="outline" className="w-full text-destructive" disabled={!online}>
                        <X /> Tolak
                      </Button>
                    }
                  >
                    <NoteField value={note} onChange={setNote} label="Alasan penolakan (wajib, min. 5 karakter)" />
                  </ConfirmDialog>
                </>
              )}

              {editable && (
                <>
                  <ConfirmDialog
                    title={`${doc.status === "rejected" ? "Ajukan ulang" : "Ajukan"} ${label}?`}
                    description="Setelah diajukan, pengajuan terkunci dan masuk ke approver pertama. Nomor dokumen dibuat otomatis."
                    confirmText={doc.status === "rejected" ? "Ya, ajukan ulang" : "Ya, ajukan"}
                    onConfirm={async () => {
                      expectOk(await submitPengajuanAction(doc.id));
                      refresh();
                    }}
                    trigger={
                      <Button className="w-full" disabled={!online || doc.items.length === 0}>
                        <Send /> {doc.status === "rejected" ? "Ajukan Ulang" : "Ajukan"}
                      </Button>
                    }
                  />
                  <Link href={`/pengajuan/${doc.id}/ubah`} className={buttonVariants({ variant: "outline", className: "w-full" })}>
                    <Pencil /> Ubah
                  </Link>
                </>
              )}

              {canCancel && (
                <ConfirmDialog
                  title={`Tarik ${label}?`}
                  description="Approval yang sedang berjalan dihentikan dan pengajuan kembali menjadi draft."
                  confirmText="Ya, tarik"
                  onOpenChange={() => setNote("")}
                  onConfirm={async () => {
                    expectOk(await cancelPengajuanAction(doc.id, note));
                    refresh();
                  }}
                  trigger={
                    <Button variant="outline" className="w-full" disabled={!online}>
                      <Undo2 /> Tarik Pengajuan
                    </Button>
                  }
                >
                  <NoteField value={note} onChange={setNote} label="Alasan (opsional)" />
                </ConfirmDialog>
              )}

              {canDelete && (
                <ConfirmDialog
                  title={`Hapus ${label}?`}
                  description="Draft beserta barang dan lampirannya dihapus permanen. Riwayat aktivitas tetap tersimpan."
                  confirmText="Hapus"
                  destructive
                  onConfirm={async () => {
                    expectOk(await deletePengajuanAction(doc.id));
                    router.replace("/pengajuan");
                  }}
                  trigger={
                    <Button variant="ghost" className="w-full text-destructive" disabled={!online}>
                      <Trash2 /> Hapus Draft
                    </Button>
                  }
                />
              )}

              {!myTurn && !editable && !canCancel && !canDelete && (
                <p className="text-sm text-muted-foreground">
                  {doc.status === "pending_approval" && turn
                    ? `Menunggu ${turn.approver.name}. Tidak ada tindakan untuk Anda.`
                    : doc.status === "approved"
                      ? "Pengajuan sudah disetujui. Cetak dokumen lewat tombol Cetak."
                      : "Tidak ada tindakan untuk Anda."}
                </p>
              )}
            </div>
          </Content>

          <Content title="Jalur Approval" size="lg">
            <ApprovalPath
              steps={doc.steps}
              previousRounds={doc.previousRounds}
              emptyText="Jalur approval dibuat saat pengajuan diajukan."
              renderTurnAction={(s) =>
                canFollowup && s.approver.id !== userId ? (
                  <FollowupButton approvalId={s.id} approverName={s.approver.name} docLabel={`pengajuan ${doc.code}`} myLastFollowupAt={s.myLastFollowupAt} action={followupPengajuanAction} />
                ) : null
              }
            />
          </Content>
        </div>
      </div>

      <PrintableDocument
        company={company}
        title="Pengajuan Barang"
        code={doc.code ?? "DRAFT"}
        date={formatDate(doc.createdAt)}
        meta={
          <div className="grid grid-cols-2 gap-x-[16px] gap-y-[2px] text-[11px]">
            <p>
              <span className="inline-block w-[90px]">Judul</span>: <b>{doc.title}</b>
            </p>
            <p>
              <span className="inline-block w-[90px]">Pemohon</span>: {doc.requester?.name ?? "-"}
            </p>
            <p>
              <span className="inline-block w-[90px]">Departemen</span>: {doc.departmentName ?? "-"}
            </p>
            <p>
              <span className="inline-block w-[90px]">Dibutuhkan</span>: {doc.neededDate ? formatDate(doc.neededDate) : "-"}
            </p>
            {doc.description && (
              <p className="col-span-2 whitespace-pre-wrap">
                <span className="inline-block w-[90px]">Keterangan</span>: {doc.description}
              </p>
            )}
          </div>
        }
        columns={PRINT_COLUMNS}
        rows={doc.items}
        summary={
          <div className="flex justify-end text-[12px]">
            <span className="mr-[16px]">Total</span>
            <b>{formatRupiah(doc.total)}</b>
          </div>
        }
        signatures={[
          { role: "Pemohon", name: doc.requester?.name ?? "-", caption: doc.requester?.department, signedAt: doc.code ? formatDateTime(doc.createdAt) : null, signedVerb: "Diajukan" },
          ...doc.steps
            .filter((s) => s.status !== "skipped")
            .map((s) => ({
              role: APPROVAL_TYPE_LABELS[s.type] ?? s.type,
              name: s.approver.name,
              caption: s.approver.department,
              signedAt: s.status === "approved" && s.decidedAt ? formatDateTime(s.decidedAt) : null,
            })),
        ]}
        mode={printMode}
        qrValue={`${APP_URL}/pengajuan/${doc.id}`}
        qrCaption={`Pindai QR untuk membuka dokumen ini di ${APP_NAME}.`}
        printedBy={printedBy}
        printedAt={now ? formatDateTime(now) : ""}
      />
    </>
  );
}

function NoteField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="decision-note">{label}</Label>
      <Textarea id="decision-note" value={value} maxLength={1000} rows={3} onChange={(e) => onChange(e.target.value)} className="text-base md:text-sm" />
    </div>
  );
}

