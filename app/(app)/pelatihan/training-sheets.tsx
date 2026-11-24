"use client";

// Sheet & kontrol Pelatihan: form rencana, pemilih peserta, kehadiran, selesai/batal, unggah bukti.
import { useState, useTransition, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Paperclip, X } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FileDropzone } from "@/components/form/file-dropzone";
import { QuickSheet } from "@/components/form/quick-sheet";
import type { SelectOption } from "@/components/form/searchable-select";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { BUCKET_LAMPIRAN } from "@/lib/app-config";
import { compressImage, safeStorageName } from "@/lib/attachments";
import { useOnline } from "@/lib/offline/use-online";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { saveTrainingAction, setAttendanceAction, setParticipantsAction, setTrainingStatusAction, syncTrainingEvidenceAction } from "./actions";

type TrainingInit = { id: string; title: string; competencyId: string | null; provider: string | null; venue: string | null; startsOn: string; endsOn: string; capacity: number | null; notes: string | null };

export function TrainingSheet({
  trigger,
  siteId,
  companyCode,
  competencies,
  training,
}: {
  trigger: ReactElement;
  siteId: string;
  companyCode?: string | null;
  competencies: SelectOption[];
  training?: TrainingInit;
}) {
  const router = useRouter();
  return (
    <QuickSheet
      trigger={trigger}
      eyebrow="Pelatihan"
      title={training ? "Ubah Rencana Pelatihan" : "Rencanakan Pelatihan"}
      description="Nomor TRN dibuat otomatis. Peserta diatur setelah rencana disimpan."
      fields={[
        { name: "title", label: "Judul pelatihan", required: true, maxLength: 160 },
        { name: "competency_id", label: "Kompetensi terkait", type: "select", options: competencies, placeholder: "Tidak terkait kompetensi tertentu" },
        { name: "provider", label: "Penyelenggara", maxLength: 120 },
        { name: "venue", label: "Tempat", maxLength: 120 },
        { name: "starts_on", label: "Tanggal mulai", type: "date", required: true },
        { name: "ends_on", label: "Tanggal selesai", type: "date", required: true },
        { name: "capacity", label: "Kapasitas peserta", type: "number", hint: "Kosongkan bila tanpa batas." },
        { name: "notes", label: "Catatan", type: "textarea", maxLength: 2000 },
      ]}
      initial={training ? { title: training.title, competency_id: training.competencyId, provider: training.provider, venue: training.venue, starts_on: training.startsOn, ends_on: training.endsOn, capacity: training.capacity, notes: training.notes } : undefined}
      onSubmit={(v) => saveTrainingAction(training?.id ?? null, { ...v, location_id: siteId, company_code: companyCode ?? null })}
      onDone={(res) => {
        const id = res.data?.id as string | undefined;
        if (!training && id) router.push(`/pelatihan/${id}`);
        else router.refresh();
      }}
    />
  );
}

export function ParticipantsSheet({
  trigger,
  trainingId,
  candidates,
  selected,
  capacity,
}: {
  trigger: ReactElement;
  trainingId: string;
  candidates: { id: string; code: string; name: string; jobTitle: string }[];
  selected: string[];
  capacity: number | null;
}) {
  const router = useRouter();
  const online = useOnline();
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<Set<string>>(new Set(selected));
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();
  const needle = q.trim().toLowerCase();
  const list = candidates.filter((c) => !needle || `${c.code} ${c.name} ${c.jobTitle}`.toLowerCase().includes(needle));
  const over = capacity !== null && pick.size > capacity;
  const toggle = (id: string) =>
    setPick((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const save = () =>
    start(async () => {
      const res = await setParticipantsAction(trainingId, [...pick]);
      if (res.status === "ok") {
        toast.success(res.message);
        setOpen(false);
        router.refresh();
      } else toast.error(res.message);
    });
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setPick(new Set(selected));
      }}
    >
      <SheetTrigger render={trigger} />
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>Peserta Pelatihan</SheetTitle>
          <SheetDescription>
            {pick.size} dipilih{capacity !== null ? ` dari kapasitas ${capacity}` : ""}. Hanya karyawan aktif di site ini.
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari NIK / nama / jabatan" aria-label="Cari peserta" className="h-9 w-full rounded-md border bg-background px-3 text-sm" />
          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {list.map((c) => (
              <li key={c.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm hover:bg-accent/40">
                  <input type="checkbox" checked={pick.has(c.id)} onChange={() => toggle(c.id)} className="size-4" />
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate font-medium">{c.name}</strong>
                    <small className="text-xs text-muted-foreground">{c.code} · {c.jobTitle}</small>
                  </span>
                </label>
              </li>
            ))}
            {list.length === 0 && <li className="p-4 text-center text-sm text-muted-foreground">Tidak ada karyawan.</li>}
          </ul>
          {over && <p role="alert" className="text-sm text-red-600 dark:text-red-400">Melebihi kapasitas ({capacity}).</p>}
        </div>
        <SheetFooter className="border-t">
          <Button onClick={save} disabled={pending || over || !online}>
            {pending && <Loader2 className="animate-spin" />} Simpan Peserta
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/** Tombol Hadir / Tidak hadir per peserta (aktif setelah tanggal mulai). */
export function AttendanceControl({ trainingId, employeeId, name, value, disabled }: { trainingId: string; employeeId: string; name: string; value: string; disabled: boolean }) {
  const router = useRouter();
  const online = useOnline();
  const [pending, start] = useTransition();
  const set = (v: string) =>
    start(async () => {
      const res = await setAttendanceAction(trainingId, employeeId, v);
      if (res.status === "ok") router.refresh();
      else toast.error(res.message);
    });
  const btn = (v: "present" | "absent", label: string, Icon: typeof Check) => (
    <button
      type="button"
      onClick={() => set(value === v ? "registered" : v)}
      disabled={disabled || pending || !online}
      aria-pressed={value === v}
      aria-label={`${label}: ${name}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs disabled:opacity-50",
        value === v ? (v === "present" ? "border-green-600 bg-green-50 font-medium text-green-800 dark:bg-green-950 dark:text-green-300" : "border-red-600 bg-red-50 font-medium text-red-800 dark:bg-red-950 dark:text-red-300") : "hover:bg-accent",
      )}
    >
      <Icon className="size-3.5" aria-hidden /> {label}
    </button>
  );
  return (
    <span className="flex gap-1.5">
      {btn("present", "Hadir", Check)}
      {btn("absent", "Tidak hadir", X)}
    </span>
  );
}

export function StatusActions({ trainingId, code }: { trainingId: string; code: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const run = async (status: "done" | "cancelled") => {
    const res = await setTrainingStatusAction(trainingId, status, note);
    if (res.status === "ok") {
      toast.success(res.message);
      router.refresh();
    } else {
      toast.error(res.message);
      throw new Error(res.message);
    }
  };
  return (
    <>
      <ConfirmDialog
        trigger={<Button>Selesaikan</Button>}
        title={`Selesaikan ${code}?`}
        description="Semua peserta harus sudah dicatat hadir atau tidak hadir. Setelah selesai, peserta dan data pelatihan tidak bisa diubah."
        confirmText="Ya, selesaikan"
        onConfirm={() => run("done")}
      />
      <ConfirmDialog
        trigger={<Button variant="outline">Batalkan</Button>}
        title={`Batalkan ${code}?`}
        description="Peserta berakun akan diberi tahu. Tulis alasan pembatalan (minimal 10 karakter)."
        confirmText="Ya, batalkan"
        destructive
        confirmDisabled={note.trim().length < 10}
        onConfirm={() => run("cancelled")}
      >
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Alasan pembatalan" aria-label="Alasan pembatalan" maxLength={2000} />
      </ConfirmDialog>
    </>
  );
}

/** Unggah bukti (daftar hadir, sertifikat kolektif, foto) ke pelatihan/<id>/ lalu hitung ulang. */
export function TrainingEvidenceSheet({ trainingId, count, canUpload }: { trainingId: string; count: number; canUpload: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const upload = async (files: File[]) => {
    setBusy(true);
    const supabase = createClient();
    for (const f of files) {
      const file = await compressImage(f);
      const { error } = await supabase.storage.from(BUCKET_LAMPIRAN).upload(`pelatihan/${trainingId}/${safeStorageName(file.name)}`, file, { contentType: file.type || undefined });
      if (error) toast.error(`Gagal mengunggah ${f.name}`, { description: error.message });
    }
    const res = await syncTrainingEvidenceAction(trainingId);
    setBusy(false);
    if (res.status === "ok") {
      toast.success("Bukti pelatihan diperbarui.");
      router.refresh();
    } else toast.error(res.message);
  };
  return (
    <Sheet>
      <SheetTrigger render={<button type="button" className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent" aria-label={`Bukti pelatihan: ${count} file`} />}>
        <Paperclip className="size-3.5" aria-hidden /> {count > 0 ? `${count} file` : canUpload ? "Unggah bukti" : "Belum ada bukti"}
      </SheetTrigger>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle>Bukti Pelatihan</SheetTitle>
          <SheetDescription>{count} file tersimpan. Contoh: daftar hadir bertanda tangan, foto kegiatan, sertifikat kolektif.</SheetDescription>
        </SheetHeader>
        <div className="p-4">
          {canUpload ? <FileDropzone multiple loading={busy} onFiles={upload} hint="PDF atau foto" /> : <p className="text-sm text-muted-foreground">Hanya HR atau HSE yang bisa mengunggah bukti.</p>}
        </div>
      </SheetContent>
    </Sheet>
  );
}
