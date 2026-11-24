"use client";

// Sheet form People & Compliance (memakai QuickSheet): karyawan, kebutuhan, kompetensi, sertifikat, MCU, permit,
// plus pengunggah bukti sertifikat/MCU. Semua tulis lewat Server Action → RPC (hak dicek di DB).
import { useState, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { Paperclip } from "lucide-react";
import { FileDropzone } from "@/components/form/file-dropzone";
import { QuickSheet, type QuickField } from "@/components/form/quick-sheet";
import type { SelectOption } from "@/components/form/searchable-select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { BUCKET_LAMPIRAN } from "@/lib/app-config";
import { compressImage, safeStorageName } from "@/lib/attachments";
import { EMPLOYMENTS, MCU_RESULT_OPTIONS } from "@/lib/people-rules";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { saveCertificateAction, saveCompetencyAction, saveEmployeeAction, saveMcuAction, savePermitAction, saveRequirementAction, syncEvidenceAction } from "./actions";

const num = (v: string) => (v.trim() === "" ? 0 : Number(v));

export function EmployeeSheet({
  trigger,
  siteId,
  companyCode,
  employee,
  contractors,
  jobTitles,
}: {
  trigger: ReactElement;
  siteId: string;
  companyCode?: string | null;
  employee?: { id: string; code: string; name: string; jobTitle: string; department: string | null; employment: string; joinDate: string | null; status: string; contractorId: string | null };
  contractors: SelectOption[];
  jobTitles: string[];
}) {
  const fields: QuickField[] = [
    { name: "code", label: "NIK", required: true, maxLength: 30, placeholder: "GMI-0017" },
    { name: "name", label: "Nama", required: true, maxLength: 120 },
    { name: "job_title", label: "Jabatan", required: true, type: "select", options: jobTitles.map((j) => ({ value: j, label: j })), hint: "Pilih dari jabatan yang sudah ada atau ketik jabatan baru lewat Kebutuhan Manpower." },
    { name: "department", label: "Section", maxLength: 80 },
    { name: "employment", label: "Hubungan kerja", type: "select", required: true, options: EMPLOYMENTS.map((x) => ({ value: x, label: x })) },
    { name: "join_date", label: "Tanggal mulai", type: "date" },
    { name: "status", label: "Status", type: "select", options: [{ value: "active", label: "Aktif" }, { value: "inactive", label: "Nonaktif" }] },
    { name: "contractor_id", label: "Mitra (bila tenaga mitra)", type: "select", options: contractors, placeholder: "Bukan tenaga mitra" },
  ];
  return (
    <QuickSheet
      trigger={trigger}
      eyebrow="Manpower"
      title={employee ? `Ubah ${employee.name}` : "Tambah Karyawan"}
      fields={fields}
      initial={employee ? { code: employee.code, name: employee.name, job_title: employee.jobTitle, department: employee.department, employment: employee.employment, join_date: employee.joinDate, status: employee.status, contractor_id: employee.contractorId } : { employment: "PKWTT", status: "active" }}
      onSubmit={(v) => saveEmployeeAction(employee?.id ?? null, { ...v, location_id: siteId, company_code: companyCode ?? null })}
    />
  );
}

export function RequirementSheet({ trigger, siteId, companyCode, jobTitle, required }: { trigger: ReactElement; siteId: string; companyCode?: string | null; jobTitle?: string; required?: number }) {
  return (
    <QuickSheet
      trigger={trigger}
      eyebrow="Kebutuhan manpower"
      title={jobTitle ? `Kebutuhan ${jobTitle}` : "Tambah kebutuhan jabatan"}
      description="Definisi kebutuhan menunggu pengesahan (Kamus KPI: Pemenuhan Manpower)."
      fields={[
        { name: "job_title", label: "Jabatan", required: true, maxLength: 80 },
        { name: "required", label: "Jumlah kebutuhan", required: true, type: "number" },
      ]}
      initial={{ job_title: jobTitle, required: required ?? 1 }}
      onSubmit={(v) => saveRequirementAction({ ...v, required: num(v.required), location_id: siteId, company_code: companyCode ?? null })}
    />
  );
}

export function CompetencySheet({ trigger, competency, jobTitles }: { trigger: ReactElement; competency?: { id: string; code: string; name: string; jobTitles: string[]; isActive: boolean }; jobTitles: string[] }) {
  return (
    <QuickSheet
      trigger={trigger}
      eyebrow="Kompetensi"
      title={competency ? `Ubah ${competency.name}` : "Tambah Kompetensi"}
      description="Jabatan yang wajib memilikinya menentukan sel Belum Ada vs Tidak wajib di matriks."
      fields={[
        { name: "code", label: "Kode", required: true, maxLength: 41, hint: "Huruf kecil, angka, garis bawah. Tidak bisa diubah setelah dibuat.", show: () => !competency },
        { name: "name", label: "Nama", required: true, maxLength: 120 },
        { name: "job_titles", label: "Wajib untuk jabatan", type: "textarea", hint: `Pisahkan dengan koma. Contoh jabatan: ${jobTitles.slice(0, 4).join(", ")}` },
        { name: "is_active", label: "Status", type: "select", options: [{ value: "1", label: "Aktif" }, { value: "0", label: "Nonaktif" }] },
      ]}
      initial={competency ? { code: competency.code, name: competency.name, job_titles: competency.jobTitles.join(", "), is_active: competency.isActive ? "1" : "0" } : { is_active: "1" }}
      onSubmit={(v) => saveCompetencyAction(competency?.id ?? null, { code: competency?.code ?? v.code, name: v.name, job_titles: v.job_titles.split(",").map((x) => x.trim()).filter(Boolean), is_active: v.is_active !== "0" })}
    />
  );
}

export function CertificateSheet({
  trigger,
  employeeId,
  competencies,
  cert,
}: {
  trigger: ReactElement;
  employeeId: string;
  competencies: SelectOption[];
  cert?: { id: string; competencyId: string; number: string | null; issuer: string | null; issuedOn: string | null; validUntil: string | null };
}) {
  return (
    <QuickSheet
      trigger={trigger}
      eyebrow="Kompetensi & sertifikat"
      title={cert ? "Ubah Sertifikat" : "Tambah Sertifikat"}
      description="Kosongkan Berlaku sampai bila seumur hidup. Unggah file bukti dari daftar sertifikat setelah disimpan."
      fields={[
        { name: "competency_id", label: "Kompetensi", required: true, type: "select", options: competencies },
        { name: "number", label: "Nomor sertifikat", maxLength: 80 },
        { name: "issuer", label: "Penerbit", maxLength: 120 },
        { name: "issued_on", label: "Tanggal terbit", type: "date" },
        { name: "valid_until", label: "Berlaku sampai", type: "date" },
      ]}
      initial={cert ? { competency_id: cert.competencyId, number: cert.number, issuer: cert.issuer, issued_on: cert.issuedOn, valid_until: cert.validUntil } : undefined}
      onSubmit={(v) => saveCertificateAction(cert?.id ?? null, employeeId, v)}
    />
  );
}

export function McuSheet({ trigger, employeeId, mcu, canWriteMedical }: { trigger: ReactElement; employeeId: string; mcu?: { id: string; checkedOn: string; validUntil: string; result: string; diagnosis: string | null; note: string | null }; canWriteMedical: boolean }) {
  return (
    <QuickSheet
      trigger={trigger}
      eyebrow="MCU"
      title={mcu ? "Ubah MCU" : "Catat MCU"}
      description={canWriteMedical ? "Diagnosis dan catatan medis hanya terlihat oleh HR dan HSE." : undefined}
      fields={[
        { name: "checked_on", label: "Tanggal pemeriksaan", type: "date", required: true },
        { name: "valid_until", label: "Berlaku sampai", type: "date", required: true },
        { name: "result", label: "Hasil", type: "select", required: true, options: MCU_RESULT_OPTIONS },
        { name: "diagnosis", label: "Diagnosis (terbatas)", type: "textarea", maxLength: 2000 },
        { name: "note", label: "Catatan medis (terbatas)", type: "textarea", maxLength: 2000 },
      ]}
      initial={mcu ? { checked_on: mcu.checkedOn, valid_until: mcu.validUntil, result: mcu.result, diagnosis: mcu.diagnosis, note: mcu.note } : undefined}
      onSubmit={(v) => saveMcuAction(mcu?.id ?? null, employeeId, v)}
    />
  );
}

export function PermitSheet({ trigger, employeeId, permit }: { trigger: ReactElement; employeeId: string; permit?: { id: string; name: string; number: string | null; validUntil: string } }) {
  return (
    <QuickSheet
      trigger={trigger}
      eyebrow="Permit site"
      title={permit ? "Ubah Permit" : "Tambah Permit"}
      fields={[
        { name: "name", label: "Nama permit", required: true, maxLength: 120, placeholder: "Izin Masuk Site" },
        { name: "number", label: "Nomor", maxLength: 80 },
        { name: "valid_until", label: "Berlaku sampai", type: "date", required: true },
      ]}
      initial={permit ? { name: permit.name, number: permit.number, valid_until: permit.validUntil } : { name: "Izin Masuk Site" }}
      onSubmit={(v) => savePermitAction(permit?.id ?? null, employeeId, v)}
    />
  );
}

/** Unggah file bukti sertifikat/MCU ke Storage lalu hitung ulang jumlahnya. */
export function EvidenceSheet({ kind, recordId, employeeId, count, label }: { kind: "sertifikat" | "mcu"; recordId: string; employeeId: string; count: number; label: string }) {
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
    const res = await syncEvidenceAction(kind, recordId, employeeId);
    setBusy(false);
    if (res.status === "ok") {
      toast.success(`Bukti ${label} diperbarui.`);
      router.refresh();
    } else toast.error(res.message);
  };
  return (
    <Sheet>
      <SheetTrigger render={<button type="button" className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs hover:bg-accent" aria-label={`Bukti ${label}: ${count} file`} />}>
        <Paperclip className="size-3.5" aria-hidden /> {count > 0 ? `${count} file` : "Unggah"}
      </SheetTrigger>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>Bukti {label}</SheetTitle>
          <SheetDescription>{count} file tersimpan. File baru ditambahkan ke daftar bukti.</SheetDescription>
        </SheetHeader>
        <div className="p-4">
          <FileDropzone multiple loading={busy} onFiles={upload} hint="PDF atau foto sertifikat/hasil" />
        </div>
      </SheetContent>
    </Sheet>
  );
}
