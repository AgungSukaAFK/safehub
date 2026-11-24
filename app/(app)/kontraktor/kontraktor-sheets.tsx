"use client";

// Sheet form Kontraktor & PJO/PJA (QuickSheet) + pengunggah bukti. Semua tulis lewat Server Action → RPC.
import { useState, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { Paperclip } from "lucide-react";
import { FileDropzone } from "@/components/form/file-dropzone";
import { QuickSheet } from "@/components/form/quick-sheet";
import type { SelectOption } from "@/components/form/searchable-select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { BUCKET_LAMPIRAN } from "@/lib/app-config";
import { compressImage, safeStorageName } from "@/lib/attachments";
import { APPOINTMENT_ROLE, CONTRACTOR_KINDS, DOC_STATUS_OPTIONS } from "@/lib/kontraktor-rules";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { saveAppointmentAction, saveContractAction, saveContractorAction, saveCsmsAction, saveDocumentAction, savePermitAction, syncKontraktorEvidenceAction } from "./actions";

export function ContractorSheet({
  trigger,
  companyCode,
  contractor,
}: {
  trigger: ReactElement;
  companyCode?: string | null;
  contractor?: { id: string; name: string; kind: string; picName: string | null; picContact: string | null; notes: string | null; isActive: boolean };
}) {
  const router = useRouter();
  return (
    <QuickSheet
      trigger={trigger}
      eyebrow="Kontraktor"
      title={contractor ? `Ubah ${contractor.name}` : "Tambah Kontraktor"}
      fields={[
        { name: "name", label: "Nama perusahaan", required: true, maxLength: 200 },
        { name: "kind", label: "Jenis", type: "select", required: true, options: CONTRACTOR_KINDS.map((k) => ({ value: k.value, label: k.label })) },
        { name: "pic_name", label: "PIC", maxLength: 120 },
        { name: "pic_contact", label: "Kontak PIC", maxLength: 120, placeholder: "No. HP atau email" },
        { name: "notes", label: "Catatan", type: "textarea", maxLength: 2000 },
        { name: "is_active", label: "Status", type: "select", options: [{ value: "1", label: "Aktif" }, { value: "0", label: "Nonaktif" }], show: () => !!contractor },
      ]}
      initial={contractor ? { name: contractor.name, kind: contractor.kind, pic_name: contractor.picName, pic_contact: contractor.picContact, notes: contractor.notes, is_active: contractor.isActive ? "1" : "0" } : { kind: "subkontraktor" }}
      onSubmit={(v) => saveContractorAction(contractor?.id ?? null, { ...v, company_code: companyCode ?? null, is_active: v.is_active !== "0" })}
      onDone={(res) => {
        const id = res.data?.id as string | undefined;
        if (!contractor && id) router.push(`/kontraktor/${id}`);
        else router.refresh();
      }}
    />
  );
}

export function PermitSheet({ trigger, contractorId, permit }: { trigger: ReactElement; contractorId: string; permit?: { id: string; name: string; number: string | null; issuer: string | null; validUntil: string } }) {
  return (
    <QuickSheet
      trigger={trigger}
      eyebrow="Izin kontraktor"
      title={permit ? "Ubah Izin" : "Tambah Izin"}
      description="Untuk memperpanjang, tambahkan izin baru dengan nama yang sama: yang berlaku terakhir dianggap izin aktif."
      fields={[
        { name: "name", label: "Nama izin", required: true, maxLength: 120, placeholder: "NIB, SBU, SKT, ..." },
        { name: "number", label: "Nomor", maxLength: 80 },
        { name: "issuer", label: "Penerbit", maxLength: 120 },
        { name: "valid_until", label: "Berlaku sampai", type: "date", required: true },
      ]}
      initial={permit ? { name: permit.name, number: permit.number, issuer: permit.issuer, valid_until: permit.validUntil } : undefined}
      onSubmit={(v) => savePermitAction(permit?.id ?? null, contractorId, v)}
    />
  );
}

export function ContractSheet({
  trigger,
  contractorId,
  canSeeCommercial,
  contract,
}: {
  trigger: ReactElement;
  contractorId: string;
  canSeeCommercial: boolean;
  contract?: { id: string; number: string; title: string; startsOn: string; endsOn: string; amount: number | null };
}) {
  return (
    <QuickSheet
      trigger={trigger}
      eyebrow="Kontrak"
      title={contract ? "Ubah Kontrak" : "Tambah Kontrak"}
      description={canSeeCommercial ? "Nilai kontrak adalah data komersial: hanya terlihat oleh Manajemen dan Pengelola Kontraktor." : undefined}
      fields={[
        { name: "number", label: "Nomor kontrak", required: true, maxLength: 80 },
        { name: "title", label: "Judul / lingkup pekerjaan", required: true, maxLength: 200 },
        { name: "starts_on", label: "Mulai", type: "date", required: true },
        { name: "ends_on", label: "Berakhir", type: "date", required: true },
        { name: "amount", label: "Nilai kontrak (Rp)", hint: "Angka saja, mis. 480000000.", show: () => canSeeCommercial },
      ]}
      initial={contract ? { number: contract.number, title: contract.title, starts_on: contract.startsOn, ends_on: contract.endsOn, amount: contract.amount } : undefined}
      onSubmit={(v) => saveContractAction(contract?.id ?? null, contractorId, { ...v, amount: canSeeCommercial ? v.amount : undefined })}
    />
  );
}

export function CsmsSheet({ trigger, contractorId }: { trigger: ReactElement; contractorId: string }) {
  return (
    <QuickSheet
      trigger={trigger}
      eyebrow="CSMS"
      title="Catat Penilaian CSMS"
      description="Hasil ditentukan dari skor: 80 ke atas lulus, 60-79 bersyarat, di bawah 60 gagal. Berlaku sampai default satu tahun."
      fields={[
        { name: "assessed_on", label: "Tanggal penilaian", type: "date", required: true },
        { name: "score", label: "Skor (0-100)", type: "number", required: true },
        { name: "valid_until", label: "Berlaku sampai", type: "date", hint: "Kosongkan untuk satu tahun." },
        { name: "note", label: "Catatan", type: "textarea", maxLength: 2000 },
      ]}
      onSubmit={(v) => saveCsmsAction(null, contractorId, v)}
    />
  );
}

export function DocumentSheet({
  trigger,
  contractorId,
  typeId,
  typeName,
  doc,
}: {
  trigger: ReactElement;
  contractorId: string;
  typeId: string;
  typeName: string;
  doc: { status: string; validUntil: string | null; note: string | null };
}) {
  return (
    <QuickSheet
      trigger={trigger}
      eyebrow="Checklist dokumen"
      title={typeName}
      fields={[
        { name: "status", label: "Status", type: "select", required: true, options: DOC_STATUS_OPTIONS },
        { name: "valid_until", label: "Berlaku sampai", type: "date", hint: "Kosongkan bila dokumen tidak punya masa berlaku." },
        { name: "note", label: "Catatan", maxLength: 500 },
      ]}
      initial={{ status: doc.status, valid_until: doc.validUntil, note: doc.note }}
      onSubmit={(v) => saveDocumentAction(contractorId, typeId, v)}
    />
  );
}

export function AppointmentSheet({
  trigger,
  employees,
  appointment,
}: {
  trigger: ReactElement;
  employees: SelectOption[];
  appointment?: { id: string; employeeId: string; role: string; scope: string; skNumber: string; startsOn: string; validUntil: string };
}) {
  return (
    <QuickSheet
      trigger={trigger}
      eyebrow="PJO/PJA"
      title={appointment ? "Ubah Penunjukan" : "Tetapkan PJO/PJA"}
      description="Site mengikuti site karyawan yang ditunjuk. Unggah file SK dari daftar setelah disimpan."
      fields={[
        { name: "employee_id", label: "Karyawan", type: "select", required: true, options: employees },
        { name: "role", label: "Peran", type: "select", required: true, options: APPOINTMENT_ROLE.map((r) => ({ value: r.value, label: r.label })) },
        { name: "scope", label: "Lingkup", required: true, maxLength: 200, placeholder: "Area Workshop Service" },
        { name: "sk_number", label: "Nomor SK", required: true, maxLength: 80 },
        { name: "starts_on", label: "Berlaku mulai", type: "date", required: true },
        { name: "valid_until", label: "Berlaku sampai", type: "date", required: true },
      ]}
      initial={appointment ? { employee_id: appointment.employeeId, role: appointment.role, scope: appointment.scope, sk_number: appointment.skNumber, starts_on: appointment.startsOn, valid_until: appointment.validUntil } : { role: "pja" }}
      onSubmit={(v) => saveAppointmentAction(appointment?.id ?? null, v)}
    />
  );
}

/** Unggah file bukti (izin, dokumen, SK PJO/PJA) ke Storage lalu hitung ulang jumlahnya. */
export function KontraktorEvidenceSheet({ kind, recordId, contractorId, count, label, canUpload }: { kind: "izin" | "kdok" | "pjo"; recordId: string; contractorId?: string; count: number; label: string; canUpload: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const upload = async (files: File[]) => {
    setBusy(true);
    const supabase = createClient();
    for (const f of files) {
      const file = await compressImage(f);
      const { error } = await supabase.storage.from(BUCKET_LAMPIRAN).upload(`${kind}/${recordId}/${safeStorageName(file.name)}`, file, { contentType: file.type || undefined });
      if (error) toast.error(`Gagal mengunggah ${f.name}`, { description: error.message });
    }
    const res = await syncKontraktorEvidenceAction(kind, recordId, contractorId);
    setBusy(false);
    if (res.status === "ok") {
      toast.success(`Bukti ${label} diperbarui.`);
      router.refresh();
    } else toast.error(res.message);
  };
  return (
    <Sheet>
      <SheetTrigger render={<button type="button" className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs hover:bg-accent" aria-label={`Bukti ${label}: ${count} file`} />}>
        <Paperclip className="size-3.5" aria-hidden /> {count > 0 ? `${count} file` : canUpload ? "Unggah" : "0 file"}
      </SheetTrigger>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>Bukti {label}</SheetTitle>
          <SheetDescription>{count} file tersimpan. File baru ditambahkan ke daftar bukti.</SheetDescription>
        </SheetHeader>
        <div className="p-4">
          {canUpload ? <FileDropzone multiple loading={busy} onFiles={upload} hint="PDF atau foto dokumen" /> : <p className="text-sm text-muted-foreground">Hanya pengelola kontraktor yang bisa mengunggah bukti.</p>}
        </div>
      </SheetContent>
    </Sheet>
  );
}
