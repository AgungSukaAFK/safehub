"use client";

// Kontrol detail Pengajuan APD: ajukan, putuskan (giliran approver), tarik, batalkan, unggah foto bukti, cetak Berita Acara.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Printer, Send, Undo2, X } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FileDropzone } from "@/components/form/file-dropzone";
import { PrintableDocument, type PrintColumn, type PrintMode } from "@/components/print/printable-document";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { useNow } from "@/hooks/use-now";
import type { RequestDetail } from "@/lib/apd";
import { needsDeduction, REASON_LABELS, type Reason } from "@/lib/apd-rules";
import { APP_NAME, APP_URL, BUCKET_LAMPIRAN } from "@/lib/app-config";
import { compressImage, safeStorageName } from "@/lib/attachments";
import type { Company } from "@/lib/company-types";
import type { FormState } from "@/lib/form-state";
import { formatDate, formatDateTime } from "@/lib/format";
import { useOnline } from "@/lib/offline/use-online";
import { printWithFileName } from "@/lib/print";
import { APPROVAL_TYPE_LABELS } from "@/lib/status";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { cancelRequestAction, decideRequestAction, logApdPrintAction, submitRequestAction, syncRequestEvidenceAction, withdrawRequestAction } from "../../actions";

function useRun() {
  const router = useRouter();
  return async (p: Promise<FormState>) => {
    const res = await p;
    if (res.status !== "ok") {
      toast.error(res.message ?? "Gagal.");
      throw new Error(res.message);
    }
    toast.success(res.message ?? "Tersimpan.");
    router.refresh();
  };
}

export function SubmitButton({ id, code, resubmit }: { id: string; code: string; resubmit: boolean }) {
  const run = useRun();
  const online = useOnline();
  return (
    <ConfirmDialog
      title={`Ajukan ${code}?`}
      description="Jalur approval dimulai (HSE Staff → HR Manager → HSE Dept Head sesuai template). Pengajuan tidak bisa diubah selama menunggu."
      confirmText="Ajukan"
      onConfirm={() => run(submitRequestAction(id))}
      trigger={<Button disabled={!online}><Send /> {resubmit ? "Ajukan Ulang" : "Ajukan"}</Button>}
    />
  );
}

export function DecideButtons({ approvalId, requestId }: { approvalId: string; requestId: string }) {
  const run = useRun();
  const [note, setNote] = useState("");
  return (
    <div className="flex flex-wrap gap-2">
      <ConfirmDialog
        title="Setujui pengajuan APD ini?"
        description="Setelah langkah terakhir menyetujui, gudang diberi tahu untuk mengirim APD."
        confirmText="Setujui"
        onConfirm={() => run(decideRequestAction(approvalId, "approved", note, requestId))}
        trigger={<Button size="sm"><Check /> Setujui</Button>}
      >
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Catatan (opsional)" aria-label="Catatan persetujuan" className="text-base md:text-sm" />
      </ConfirmDialog>
      <ConfirmDialog
        title="Kembalikan pengajuan?"
        description="Pengajuan kembali ke pemohon untuk diperbaiki. Tulis alasannya."
        confirmText="Kembalikan"
        destructive
        confirmDisabled={note.trim().length < 5}
        onConfirm={() => run(decideRequestAction(approvalId, "rejected", note, requestId))}
        trigger={<Button size="sm" variant="outline"><X /> Kembalikan</Button>}
      >
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Alasan pengembalian (wajib)" aria-label="Alasan pengembalian" className="text-base md:text-sm" />
      </ConfirmDialog>
    </div>
  );
}

export function WithdrawButton({ id }: { id: string }) {
  const run = useRun();
  return (
    <ConfirmDialog
      title="Tarik pengajuan?"
      description="Proses approval dihentikan dan pengajuan kembali menjadi draf."
      confirmText="Tarik"
      onConfirm={() => run(withdrawRequestAction(id, "Ditarik pemohon"))}
      trigger={<Button variant="outline"><Undo2 /> Tarik</Button>}
    />
  );
}

export function CancelButton({ id, code }: { id: string; code: string }) {
  const run = useRun();
  const [note, setNote] = useState("");
  return (
    <ConfirmDialog
      title={`Batalkan ${code}?`}
      description="Pengajuan dibatalkan dan tidak bisa diajukan lagi. Tulis alasan (minimal 10 karakter)."
      confirmText="Ya, batalkan"
      destructive
      confirmDisabled={note.trim().length < 10}
      onConfirm={() => run(cancelRequestAction(id, note))}
      trigger={<Button variant="outline">Batalkan</Button>}
    >
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Alasan pembatalan" aria-label="Alasan pembatalan" maxLength={1000} />
    </ConfirmDialog>
  );
}

/** Foto bukti ke apd/<id>/ (hanya saat draf/dikembalikan; policy storage = pembuat atau pengelola APD). */
export function EvidenceUpload({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const upload = async (files: File[]) => {
    setBusy(true);
    const supabase = createClient();
    for (const f of files) {
      const file = await compressImage(f);
      const { error } = await supabase.storage.from(BUCKET_LAMPIRAN).upload(`apd/${id}/${Date.now()}-${safeStorageName(file.name)}`, file, { contentType: file.type || undefined });
      if (error) toast.error(`Gagal mengunggah ${f.name}`, { description: error.message });
    }
    const res = await syncRequestEvidenceAction(id);
    setBusy(false);
    if (res.status === "ok") {
      toast.success("Foto bukti diperbarui.");
      router.refresh();
    } else toast.error(res.message ?? "Gagal.");
  };
  return <FileDropzone multiple accept="image/*,application/pdf" loading={busy} onFiles={upload} hint="Foto APD yang rusak / bukti pendukung" />;
}

type PrintLine = RequestDetail["lines"][number];
const PRINT_COLUMNS: PrintColumn<PrintLine>[] = [
  { label: "No", className: "w-[28px] text-center", cell: (_r, i) => i + 1 },
  { label: "Jenis APD", cell: (r) => <>{r.typeName}{r.itemLabel && <span className="block text-[9px]">{r.itemLabel}</span>}</> },
  { label: "Ukuran", className: "w-[70px]", cell: (r) => r.size ?? "-" },
  { label: "Qty", className: "w-[44px] text-right", cell: (r) => r.qty },
  { label: "Terkirim", className: "w-[60px] text-right", cell: (r) => r.supplied },
];

/** Cetak Form Berita Acara APD (QR = tanda tangan digital dari approval; basah = ruang tanda tangan). */
export function PrintBeritaAcara({ r, company, printedBy }: { r: RequestDetail; company: Company | null; printedBy: string }) {
  const now = useNow();
  const [mode, setMode] = useState<PrintMode>(r.status === "approved" ? "qr" : "preview");
  const print = async (m: PrintMode) => {
    setMode(m);
    void logApdPrintAction(r.id, r.code, m).catch(() => undefined);
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    await printWithFileName(r.code);
  };
  const deduction = needsDeduction(r.reason, r.negligence);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline"><Printer /> Cetak</Button>} />
        <DropdownMenuContent align="end">
          {r.status === "approved" && <DropdownMenuItem onClick={() => void print("qr")}>Berita Acara (tanda tangan digital + QR)</DropdownMenuItem>}
          <DropdownMenuItem onClick={() => void print("basah")}>Berita Acara (tanda tangan basah)</DropdownMenuItem>
          {r.status !== "approved" && <DropdownMenuItem onClick={() => void print("preview")}>Pratinjau</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>
      <PrintableDocument
        company={company}
        title="Berita Acara Kehilangan / Kerusakan / Pengajuan APD"
        code={r.code}
        date={formatDate(r.requestedOn ?? r.createdAt)}
        meta={
          <div className="grid grid-cols-2 gap-x-[16px] gap-y-[2px] text-[11px]">
            <p><span className="inline-block w-[110px]">Nama</span>: <b>{r.recipient}</b></p>
            <p><span className="inline-block w-[110px]">Jabatan</span>: {r.jobTitle ?? "-"}</p>
            <p><span className="inline-block w-[110px]">Lokasi kerja</span>: {r.site}</p>
            <p><span className="inline-block w-[110px]">Terakhir dapat APD</span>: {r.lastReceivedOn ? formatDate(r.lastReceivedOn) : "-"}</p>
            <p><span className="inline-block w-[110px]">Alasan</span>: {REASON_LABELS[r.reason as Reason] ?? r.reason}{r.negligence ? " (kelalaian)" : ""}</p>
            <p><span className="inline-block w-[110px]">Tgl kehilangan/rusak</span>: {r.incidentOn ? formatDate(r.incidentOn) : "-"}</p>
            {r.explanation && <p className="col-span-2 whitespace-pre-wrap"><span className="inline-block w-[110px]">Penjelasan</span>: {r.explanation}</p>}
          </div>
        }
        columns={PRINT_COLUMNS}
        rows={r.lines}
        summary={
          deduction ? (
            <p className="text-[10px] leading-snug">
              <b>Pernyataan pemotongan gaji{r.deductionAck ? " (disetujui karyawan)" : " (BELUM disetujui)"}:</b> Dikarenakan kelalaian saya dalam menjaga dan merawat APD Perusahaan yang diberikan
              kepada saya seperti tersebut di atas, maka dengan ini saya bersedia untuk dilakukan pemotongan gaji untuk penggantian APD yang rusak/hilang.
            </p>
          ) : undefined
        }
        signatures={[
          { role: "Dibuat oleh (Karyawan)", name: r.recipient, caption: r.jobTitle, signedAt: r.requestedOn && r.source === "app" ? formatDate(r.requestedOn) : null, signedVerb: "Diajukan" },
          ...r.steps
            .filter((s) => s.status !== "skipped")
            .map((s) => ({ role: APPROVAL_TYPE_LABELS[s.type] ?? s.type, name: s.approver.name, caption: s.approver.department, signedAt: s.status === "approved" && s.decidedAt ? formatDateTime(s.decidedAt) : null })),
        ]}
        mode={mode}
        qrValue={`${APP_URL}/apd/pengajuan/${r.id}`}
        qrCaption={`Pindai QR untuk membuka pengajuan ini di ${APP_NAME}.`}
        printedBy={printedBy}
        printedAt={now ? formatDateTime(now) : ""}
      />
    </>
  );
}
