"use client";

// Panel samping PICA (prototipe: drawer "Tambah Tindakan" & "Unggah Bukti"). Dipakai detail temuan
// dan tab Tindakan kejadian. Tulis lewat Server Action → RPC pica_* (cek peran di DB).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Send, Trash2 } from "lucide-react";
import { Field } from "@/components/form-bits";
import { DatePicker } from "@/components/form/date-picker";
import { FileDropzone } from "@/components/form/file-dropzone";
import { SearchableSelect, type SelectOption } from "@/components/form/searchable-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { BUCKET_LAMPIRAN } from "@/lib/app-config";
import { compressImage, safeStorageName } from "@/lib/attachments";
import type { FormState } from "@/lib/form-state";
import { formatBytes, formatDate, todayWib } from "@/lib/format";
import { useOnline } from "@/lib/offline/use-online";
import type { PicaAction } from "@/lib/pica";
import { ACCEPT_EVIDENCE, ACTION_KIND_LABEL, ACTION_KINDS, MAX_EVIDENCE_BYTES } from "@/lib/pica-rules";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { createActionAction, submitEvidenceAction } from "@/app/(app)/temuan/actions";

const errOf = (s: FormState | null, k: string) => s?.fieldErrors?.[k]?.[0];

export type ActionPrefill = { title?: string; causeRef?: string | null; kind?: "corrective" | "preventive" };

/** Drawer "Tambah Tindakan". `parent` = induk tindakan (temuan ATAU kejadian). */
export function ActionFormSheet({
  open,
  onOpenChange,
  parent,
  people,
  defaultVerifierId,
  prefill,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parent: { findingId?: string; incidentId?: string };
  people: SelectOption[];
  defaultVerifierId: string | null;
  prefill?: ActionPrefill | null;
}) {
  const router = useRouter();
  const online = useOnline();
  const [state, setState] = useState<FormState | null>(null);
  const [pending, setPending] = useState(false);
  const [v, setV] = useState(() => ({
    title: prefill?.title ?? "",
    kind: prefill?.kind ?? ("corrective" as "corrective" | "preventive"),
    pic_id: null as string | null,
    verifier_id: defaultVerifierId,
    due_date: null as string | null,
    required_evidence: "",
    cause_ref: prefill?.causeRef ?? null,
  }));
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((p) => ({ ...p, [k]: val }));

  const submit = async () => {
    setPending(true);
    const res = await createActionAction({
      finding_id: parent.findingId ?? null,
      incident_id: parent.incidentId ?? null,
      ...v,
      pic_id: v.pic_id ?? "",
      verifier_id: v.verifier_id ?? "",
      due_date: v.due_date ?? "",
    });
    setPending(false);
    setState(res);
    if (res.status === "ok") {
      toast.success(res.message);
      onOpenChange(false);
      router.refresh();
    } else toast.error(res.message);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Tindakan PICA</p>
          <SheetTitle>Tambah Tindakan</SheetTitle>
          <SheetDescription>PIC menerima notifikasi dan tugas di Tugas Saya.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {v.cause_ref && (
            <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs">
              <span className="text-muted-foreground">Dari penyebab/rekomendasi: </span>
              {v.cause_ref}
            </p>
          )}
          <Field label="Deskripsi" htmlFor="act-title" required error={errOf(state, "title")}>
            <Textarea id="act-title" rows={3} maxLength={500} value={v.title} onChange={(e) => set("title", e.target.value)} placeholder="Jelaskan tindakan yang harus dilakukan" className="text-base md:text-sm" />
          </Field>
          <Field label="Jenis" required error={errOf(state, "kind")}>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Jenis tindakan">
              {ACTION_KINDS.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  role="radio"
                  aria-checked={v.kind === k.value}
                  onClick={() => set("kind", k.value)}
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                    v.kind === k.value ? "border-primary bg-primary/5 text-primary" : "hover:bg-accent",
                  )}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="PIC" htmlFor="act-pic" required error={errOf(state, "pic_id")}>
            <SearchableSelect id="act-pic" value={v.pic_id} onValueChange={(x) => set("pic_id", x)} options={people} placeholder="Pilih penanggung jawab" />
          </Field>
          <Field label="Due date" htmlFor="act-due" required error={errOf(state, "due_date")}>
            <DatePicker id="act-due" value={v.due_date} onValueChange={(d) => set("due_date", d)} min={todayWib()} />
          </Field>
          <Field label="Bukti yang diwajibkan" htmlFor="act-evidence" hint="Contoh: foto lifting aid dan BA penerimaan">
            <Input id="act-evidence" maxLength={500} value={v.required_evidence} onChange={(e) => set("required_evidence", e.target.value)} className="text-base md:text-sm" />
          </Field>
          <Field label="Verifikator" htmlFor="act-verifier" required error={errOf(state, "verifier_id")} hint="Memeriksa bukti sebelum tindakan Closed. Tidak boleh sama dengan PIC.">
            <SearchableSelect id="act-verifier" value={v.verifier_id} onValueChange={(x) => set("verifier_id", x)} options={people} placeholder="Pilih verifikator" />
          </Field>
        </div>
        <SheetFooter className="flex-row justify-end border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button type="button" onClick={submit} disabled={pending || !online}>
            {pending && <Loader2 className="animate-spin" />} Simpan Tindakan
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/** Drawer "Unggah Bukti" (PIC). File diunggah ke pica/<id>/r<putaran>/ lalu dikirim lewat RPC. */
export function EvidenceSheet({ action, open, onOpenChange }: { action: PicaAction; open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const online = useOnline();
  const [files, setFiles] = useState<{ path: string; name: string; size: number }[]>([]);
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const folder = `pica/${action.id}/r${action.round}`;

  const upload = async (picked: File[]) => {
    setUploading(true);
    const supabase = createClient();
    const added: typeof files = [];
    for (const f of picked) {
      const file = await compressImage(f);
      const path = `${folder}/${safeStorageName(file.name)}`;
      const { error } = await supabase.storage.from(BUCKET_LAMPIRAN).upload(path, file, { contentType: file.type || undefined });
      if (error) toast.error(`Gagal mengunggah ${f.name}`, { description: error.message });
      else added.push({ path, name: f.name, size: file.size });
    }
    setFiles((p) => [...p, ...added]);
    setUploading(false);
  };
  const remove = async (path: string) => {
    await createClient().storage.from(BUCKET_LAMPIRAN).remove([path]);
    setFiles((p) => p.filter((f) => f.path !== path));
  };
  const send = async () => {
    setSending(true);
    const res = await submitEvidenceAction(
      action.id,
      note,
      files.map((f) => f.path),
    );
    setSending(false);
    if (res.status === "ok") {
      toast.success(res.message);
      setFiles([]);
      setNote("");
      onOpenChange(false);
      router.refresh();
    } else toast.error(res.message);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Tugas Tindakan</p>
          <SheetTitle>Unggah Bukti</SheetTitle>
          <SheetDescription>Setelah dikirim, status berubah menjadi Menunggu Verifikasi.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <section className="space-y-1 rounded-lg border bg-muted/30 p-3 text-sm">
            <p className="font-mono text-xs text-muted-foreground">{action.code}</p>
            <p className="font-medium">{action.title}</p>
            <p className="text-xs text-muted-foreground">
              {ACTION_KIND_LABEL[action.kind]} · Due {formatDate(action.dueDate)}
              {action.round > 1 && ` · Putaran ${action.round}`}
            </p>
            {action.requiredEvidence && (
              <p className="text-xs">
                <span className="text-muted-foreground">Bukti diwajibkan: </span>
                {action.requiredEvidence}
              </p>
            )}
          </section>
          <FileDropzone
            multiple
            accept={ACCEPT_EVIDENCE}
            maxBytes={MAX_EVIDENCE_BYTES}
            loading={uploading}
            disabled={!online}
            onFiles={upload}
            title="Unggah bukti penyelesaian"
            hint="JPG, PNG, PDF, MP4 · maks 10 MB per file"
          />
          {files.length > 0 && (
            <ul className="divide-y rounded-lg border">
              {files.map((f) => (
                <li key={f.path} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <span className="text-xs text-muted-foreground">{formatBytes(f.size)}</span>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={`Hapus ${f.name}`} onClick={() => remove(f.path)}>
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <Field label="Catatan penyelesaian" htmlFor="ev-note">
            <Textarea id="ev-note" rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Jelaskan pekerjaan yang telah diselesaikan" className="text-base md:text-sm" />
          </Field>
        </div>
        <SheetFooter className="flex-row justify-end border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button type="button" onClick={send} disabled={!files.length || sending || uploading || !online}>
            {sending ? <Loader2 className="animate-spin" /> : <Send />} Kirim untuk Verifikasi
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
