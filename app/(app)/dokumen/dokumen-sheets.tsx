"use client";

// Sheet & kontrol Dokumen/Peraturan/KO (QuickSheet + panel revisi). Semua tulis lewat Server Action → RPC.
import { useState, useTransition, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Paperclip, Pencil, Send, Undo2 } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FileDropzone } from "@/components/form/file-dropzone";
import { QuickSheet } from "@/components/form/quick-sheet";
import type { SelectOption } from "@/components/form/searchable-select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BUCKET_LAMPIRAN } from "@/lib/app-config";
import { compressImage, safeStorageName } from "@/lib/attachments";
import { COMPLIANCE_OPTIONS, DOC_KINDS, KO_KINDS } from "@/lib/dokumen-rules";
import { useOnline } from "@/lib/offline/use-online";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import {
  acknowledgeDocumentAction,
  cancelRevisionAction,
  decideRevisionAction,
  makeFindingAction,
  saveDocumentAction,
  saveEvaluationAction,
  saveKoAction,
  saveRegulationAction,
  startRevisionAction,
  submitRevisionAction,
  syncFilesAction,
  withdrawDocumentAction,
} from "./actions";

const todayIso = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);

export function DocumentSheet({
  trigger,
  people,
  titles,
  doc,
}: {
  trigger: ReactElement;
  people: SelectOption[];
  titles: string[];
  doc?: { id: string; code: string; title: string; kind: string; ownerId: string | null; reviewMonths: number; distributeTitles: string[] };
}) {
  const router = useRouter();
  return (
    <QuickSheet
      trigger={trigger}
      eyebrow="Dokumen terkendali"
      title={doc ? `Ubah ${doc.code}` : "Dokumen Baru"}
      description={doc ? "Isi dokumen berubah lewat revisi, bukan lewat form ini." : "Revisi 1 dibuat sebagai draf. Unggah file PDF lalu ajukan untuk disetujui."}
      fields={[
        { name: "code", label: "Kode dokumen", required: true, maxLength: 40, placeholder: "SOP-HSE-002", hint: "Kode manual dari sistem dokumen. Tidak bisa diubah.", show: () => !doc },
        { name: "title", label: "Judul", required: true, maxLength: 200 },
        { name: "kind", label: "Jenis", type: "select", required: true, options: DOC_KINDS.map((k) => ({ value: k.value, label: k.label })) },
        { name: "owner_id", label: "Pemilik dokumen", type: "select", options: people, placeholder: "Saya" },
        { name: "review_months", label: "Interval review (bulan)", type: "number", required: true },
        { name: "distribute_titles", label: "Distribusi ke jabatan", type: "textarea", hint: `Pisahkan dengan koma. Pengakuan baca diminta dari karyawan berakun pada jabatan ini. Contoh: ${titles.slice(0, 4).join(", ")}` },
        { name: "change_summary", label: "Ringkasan revisi 1", maxLength: 2000, placeholder: "Penerbitan awal", show: () => !doc },
      ]}
      initial={doc ? { title: doc.title, kind: doc.kind, owner_id: doc.ownerId, review_months: doc.reviewMonths, distribute_titles: doc.distributeTitles.join(", ") } : { kind: "sop", review_months: 12 }}
      onSubmit={(v) => saveDocumentAction(doc?.id ?? null, { ...v, code: doc ? undefined : v.code, distribute_titles: v.distribute_titles.split(",").map((x) => x.trim()).filter(Boolean) })}
      onDone={(res) => {
        const id = res.data?.id as string | undefined;
        if (!doc && id) router.push(`/dokumen/${id}`);
        else router.refresh();
      }}
    />
  );
}

/** Panel revisi terbuka: ringkasan, unggah file, ajukan / tarik / putuskan. */
export function RevisionPanel({
  docId,
  code,
  revision,
  canManage,
  myTurnApprovalId,
}: {
  docId: string;
  code: string;
  revision: { id: string; revNo: number; summary: string; status: string; fileCount: number };
  canManage: boolean;
  myTurnApprovalId: string | null;
}) {
  const router = useRouter();
  const online = useOnline();
  const [summary, setSummary] = useState(revision.summary);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const editable = canManage && (revision.status === "draft" || revision.status === "rejected");
  const expectOk = (res: { status: string; message?: string }) => {
    if (res.status !== "ok") {
      toast.error(res.message ?? "Gagal.");
      throw new Error(res.message);
    }
    toast.success(res.message ?? "Tersimpan.");
    router.refresh();
  };
  const upload = async (files: File[]) => {
    setBusy(true);
    const supabase = createClient();
    for (const f of files) {
      const file = await compressImage(f);
      const { error } = await supabase.storage.from(BUCKET_LAMPIRAN).upload(`dokumen/${revision.id}/${Date.now()}-${safeStorageName(file.name)}`, file, { contentType: file.type || undefined });
      if (error) toast.error(`Gagal mengunggah ${f.name}`, { description: error.message });
    }
    const res = await syncFilesAction("dokumen", revision.id, docId);
    setBusy(false);
    if (res.status === "ok") {
      toast.success("File revisi diperbarui.");
      router.refresh();
    } else toast.error(res.message ?? "Gagal.");
  };

  return (
    <div className="space-y-3">
      {editable ? (
        <>
          <div className="space-y-1">
            <Label htmlFor="rev-summary" className="text-xs">Ringkasan perubahan (minimal 5 karakter)</Label>
            <Textarea id="rev-summary" rows={3} value={summary} maxLength={2000} onChange={(e) => setSummary(e.target.value)} className="text-base md:text-sm" />
          </div>
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Paperclip className="size-3.5" aria-hidden /> {revision.fileCount} file revisi (PDF). Wajib minimal satu sebelum diajukan.</p>
            <FileDropzone multiple loading={busy} onFiles={upload} hint="PDF atau dokumen kerja" />
          </div>
          <ConfirmDialog
            title={`Ajukan ${code} Rev ${revision.revNo}?`}
            description="Ringkasan disimpan dan jalur approval dari template dimulai. Revisi tidak bisa diubah selama menunggu."
            confirmText="Ajukan"
            onConfirm={async () => expectOk(await submitRevisionAction(docId, revision.id, summary))}
            trigger={<Button className="w-full" disabled={!online}><Send /> {revision.status === "rejected" ? "Ajukan Ulang" : "Ajukan"}</Button>}
          />
        </>
      ) : (
        <p className="text-sm">{revision.summary}</p>
      )}
      {myTurnApprovalId && (
        <div className="space-y-2">
          <ConfirmDialog
            title="Setujui revisi ini?"
            description="Revisi menjadi berlaku setelah langkah terakhir menyetujui; revisi sebelumnya otomatis usang."
            confirmText="Setujui"
            onConfirm={async () => expectOk(await decideRevisionAction(myTurnApprovalId, "approved", note, docId))}
            trigger={<Button className="w-full" disabled={!online}><Check /> Setujui</Button>}
          >
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Catatan (opsional)" className="text-base md:text-sm" />
          </ConfirmDialog>
          <ConfirmDialog
            title="Kembalikan revisi?"
            description="Revisi kembali ke penyusun untuk diperbaiki."
            confirmText="Kembalikan"
            destructive
            confirmDisabled={note.trim().length < 5}
            onOpenChange={() => setNote("")}
            onConfirm={async () => expectOk(await decideRevisionAction(myTurnApprovalId, "rejected", note, docId))}
            trigger={<Button variant="outline" className="w-full" disabled={!online}><Undo2 /> Kembalikan</Button>}
          >
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Alasan (wajib, min. 5 karakter)" className="text-base md:text-sm" />
          </ConfirmDialog>
        </div>
      )}
      {canManage && revision.status === "pending_approval" && (
        <ConfirmDialog
          title="Tarik pengajuan?"
          description="Approval dihentikan dan revisi kembali menjadi draf."
          confirmText="Ya, tarik"
          onOpenChange={() => setNote("")}
          onConfirm={async () => expectOk(await cancelRevisionAction(docId, revision.id, note))}
          trigger={<Button variant="outline" className="w-full" disabled={!online}><Undo2 /> Tarik Pengajuan</Button>}
        >
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Alasan (opsional)" className="text-base md:text-sm" />
        </ConfirmDialog>
      )}
    </div>
  );
}

export function StartRevisionButton({ docId }: { docId: string }) {
  const router = useRouter();
  const online = useOnline();
  const [summary, setSummary] = useState("");
  return (
    <ConfirmDialog
      title="Mulai revisi baru?"
      description="Revisi dibuat sebagai draf. Revisi yang berlaku tetap dipakai sampai revisi baru disetujui."
      confirmText="Mulai Revisi"
      confirmDisabled={summary.trim().length < 5}
      onOpenChange={() => setSummary("")}
      onConfirm={async () => {
        const res = await startRevisionAction(docId, summary);
        if (res.status !== "ok") {
          toast.error(res.message ?? "Gagal.");
          throw new Error(res.message);
        }
        toast.success(res.message ?? "Revisi dibuat.");
        router.refresh();
      }}
      trigger={<Button variant="outline" disabled={!online}><Pencil /> Revisi Baru</Button>}
    >
      <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} placeholder="Ringkasan perubahan (wajib, min. 5 karakter)" className="text-base md:text-sm" />
    </ConfirmDialog>
  );
}

export function WithdrawButton({ docId, code }: { docId: string; code: string }) {
  const router = useRouter();
  const online = useOnline();
  const [reason, setReason] = useState("");
  return (
    <ConfirmDialog
      title={`Tarik ${code}?`}
      description="Dokumen dan revisi yang berlaku menjadi usang dan tidak bisa direvisi lagi. Tulis alasan (minimal 10 karakter)."
      confirmText="Ya, tarik dokumen"
      destructive
      confirmDisabled={reason.trim().length < 10}
      onOpenChange={() => setReason("")}
      onConfirm={async () => {
        const res = await withdrawDocumentAction(docId, reason);
        if (res.status !== "ok") {
          toast.error(res.message ?? "Gagal.");
          throw new Error(res.message);
        }
        toast.success(res.message ?? "Dokumen ditarik.");
        router.refresh();
      }}
      trigger={<Button variant="outline" disabled={!online}>Tarik Dokumen</Button>}
    >
      <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Alasan penarikan" className="text-base md:text-sm" />
    </ConfirmDialog>
  );
}

export function AcknowledgeButton({ docId, revisionId }: { docId: string; revisionId: string }) {
  const router = useRouter();
  const online = useOnline();
  const [pending, start] = useTransition();
  return (
    <Button
      disabled={pending || !online}
      onClick={() =>
        start(async () => {
          const res = await acknowledgeDocumentAction(docId, revisionId);
          if (res.status === "ok") {
            toast.success(res.message ?? "Tercatat.");
            router.refresh();
          } else toast.error(res.message ?? "Gagal.");
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <Check />} Saya sudah membaca
    </Button>
  );
}

// ---------------------------------------------------------------- peraturan
export function RegulationSheet({ trigger, regulation }: { trigger: ReactElement; regulation?: { id: string; code: string; title: string; issuer: string | null; issuedOn: string | null; isActive: boolean } }) {
  return (
    <QuickSheet
      trigger={trigger}
      eyebrow="Peraturan"
      title={regulation ? `Ubah ${regulation.code}` : "Tambah Peraturan"}
      fields={[
        { name: "code", label: "Nomor peraturan", required: true, maxLength: 80, placeholder: "PP 50 Tahun 2012", show: () => !regulation },
        { name: "title", label: "Judul", required: true, maxLength: 300 },
        { name: "issuer", label: "Penerbit", maxLength: 120 },
        { name: "issued_on", label: "Tanggal terbit", type: "date" },
        { name: "is_active", label: "Status", type: "select", options: [{ value: "1", label: "Aktif" }, { value: "0", label: "Nonaktif" }], show: () => !!regulation },
      ]}
      initial={regulation ? { title: regulation.title, issuer: regulation.issuer, issued_on: regulation.issuedOn, is_active: regulation.isActive ? "1" : "0" } : undefined}
      onSubmit={(v) => saveRegulationAction(regulation?.id ?? null, { ...v, code: regulation ? regulation.code : v.code, is_active: v.is_active !== "0" })}
    />
  );
}

export function EvaluationSheet({
  trigger,
  regulationId,
  sites,
  evaluation,
}: {
  trigger: ReactElement;
  regulationId: string;
  sites: SelectOption[];
  evaluation?: { id: string; siteId: string; clause: string; requirement: string; compliance: string; evaluatedOn: string; followUp: string | null; nextReview: string | null };
}) {
  return (
    <QuickSheet
      trigger={trigger}
      eyebrow="Evaluasi peraturan"
      title={evaluation ? "Ubah Evaluasi" : "Catat Evaluasi"}
      description="Hasil Sebagian atau Tidak Sesuai wajib punya tindak lanjut, dan bisa dijadikan temuan."
      fields={[
        { name: "location_id", label: "Site", type: "select", required: true, options: sites },
        { name: "clause", label: "Pasal / ayat", required: true, maxLength: 120 },
        { name: "requirement", label: "Persyaratan", type: "textarea", required: true, maxLength: 2000 },
        { name: "compliance", label: "Kesesuaian", type: "select", required: true, options: COMPLIANCE_OPTIONS },
        { name: "evaluated_on", label: "Tanggal evaluasi", type: "date", required: true },
        { name: "follow_up", label: "Tindak lanjut", type: "textarea", maxLength: 2000, show: (v) => v.compliance === "partial" || v.compliance === "non_compliant" },
        { name: "next_review_on", label: "Evaluasi berikutnya", type: "date" },
      ]}
      initial={evaluation ? { location_id: evaluation.siteId, clause: evaluation.clause, requirement: evaluation.requirement, compliance: evaluation.compliance, evaluated_on: evaluation.evaluatedOn, follow_up: evaluation.followUp, next_review_on: evaluation.nextReview } : { location_id: sites[0]?.value, evaluated_on: todayIso() }}
      onSubmit={(v) => saveEvaluationAction(evaluation?.id ?? null, regulationId, v)}
    />
  );
}

export function MakeFindingSheet({ trigger, evaluationId, areas, people, risks }: { trigger: ReactElement; evaluationId: string; areas: SelectOption[]; people: SelectOption[]; risks: SelectOption[] }) {
  const router = useRouter();
  return (
    <QuickSheet
      trigger={trigger}
      eyebrow="Tindak lanjut"
      title="Jadikan Temuan"
      description="Temuan dibuat dengan sumber Audit dan kategori Dokumen & Prosedur. Tindakan PICA ditambahkan dari halaman temuan."
      submitLabel="Buat Temuan"
      fields={[
        { name: "area_id", label: "Area", type: "select", required: true, options: areas },
        { name: "pic_id", label: "PIC", type: "select", required: true, options: people },
        { name: "risk_level", label: "Tingkat risiko", type: "select", required: true, options: risks },
        { name: "due_date", label: "Tenggat", type: "date", required: true },
      ]}
      initial={{ risk_level: "medium" }}
      onSubmit={(v) => makeFindingAction(evaluationId, v)}
      onDone={(res) => {
        const id = res.data?.id as string | undefined;
        if (id) router.push(`/temuan/${id}`);
        else router.refresh();
      }}
    />
  );
}

// ---------------------------------------------------------------- register KO
export function KoSheet({
  trigger,
  siteId,
  companyCode,
  people,
  item,
}: {
  trigger: ReactElement;
  siteId: string;
  companyCode?: string | null;
  people: SelectOption[];
  item?: { id: string; title: string; kind: string; number: string | null; ownerId: string | null; validUntil: string; notes: string | null };
}) {
  return (
    <QuickSheet
      trigger={trigger}
      eyebrow="Register KO"
      title={item ? "Ubah Item KO" : "Tambah Item KO"}
      description="Nomor KO dibuat otomatis. Unggah file dari daftar setelah disimpan."
      fields={[
        { name: "title", label: "Judul", required: true, maxLength: 200 },
        { name: "kind", label: "Jenis", type: "select", required: true, options: KO_KINDS.map((k) => ({ value: k.value, label: k.label })) },
        { name: "number", label: "Nomor izin / sertifikat", maxLength: 80 },
        { name: "owner_id", label: "Penanggung jawab", type: "select", options: people },
        { name: "valid_until", label: "Berlaku sampai", type: "date", required: true },
        { name: "notes", label: "Catatan", type: "textarea", maxLength: 2000 },
      ]}
      initial={item ? { title: item.title, kind: item.kind, number: item.number, owner_id: item.ownerId, valid_until: item.validUntil, notes: item.notes } : { kind: "izin_operasi" }}
      onSubmit={(v) => saveKoAction(item?.id ?? null, { ...v, location_id: siteId, company_code: companyCode ?? null })}
    />
  );
}

export function KoFilesButton({ koId, count, canUpload }: { koId: string; count: number; canUpload: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const upload = async (files: File[]) => {
    setBusy(true);
    const supabase = createClient();
    for (const f of files) {
      const file = await compressImage(f);
      const { error } = await supabase.storage.from(BUCKET_LAMPIRAN).upload(`ko/${koId}/${Date.now()}-${safeStorageName(file.name)}`, file, { contentType: file.type || undefined });
      if (error) toast.error(`Gagal mengunggah ${f.name}`, { description: error.message });
    }
    const res = await syncFilesAction("ko", koId);
    setBusy(false);
    if (res.status === "ok") {
      toast.success("File diperbarui.");
      router.refresh();
    } else toast.error(res.message ?? "Gagal.");
  };
  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs hover:bg-accent">
        <Paperclip className="size-3.5" aria-hidden /> {count > 0 ? `${count} file` : canUpload ? "Unggah" : "0 file"}
      </button>
      {open && canUpload && <FileDropzone multiple loading={busy} onFiles={upload} hint="PDF atau foto" />}
    </span>
  );
}
