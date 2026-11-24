"use client";

// "Catat Aktivitas" K3 (prototipe ActivityForm) sebagai Sheet. Aktivitas dibuat lewat RPC, bukti diunggah
// SETELAH record punya id (browser → aktivitas/<id>/), lalu jumlah file dihitung ulang di server.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { Field } from "@/components/form-bits";
import { FileDropzone } from "@/components/form/file-dropzone";
import { SearchableSelect, type SelectOption } from "@/components/form/searchable-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { BUCKET_LAMPIRAN } from "@/lib/app-config";
import { compressImage, safeStorageName } from "@/lib/attachments";
import type { FormState } from "@/lib/form-state";
import { useOnline } from "@/lib/offline/use-online";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { ACTIVITY_TYPES } from "@/lib/tsp-rules";
import { saveActivityAction, syncActivityEvidenceAction } from "./actions";

export function ActivitySheet({
  siteId,
  siteName,
  year,
  today,
  areas,
  people,
  programs,
  companies,
  defaultCompany,
  defaultLeaderId,
}: {
  siteId: string;
  siteName: string;
  year: number;
  /** YYYY-MM-DD WIB */
  today: string;
  areas: SelectOption[];
  people: SelectOption[];
  programs: SelectOption[];
  companies: SelectOption[];
  defaultCompany: string | null;
  defaultLeaderId: string | null;
}) {
  const router = useRouter();
  const online = useOnline();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<FormState | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [v, setV] = useState({
    type_code: "safety_talk",
    activity_date: today,
    area_id: "",
    leader_id: defaultLeaderId ?? "",
    participant_count: "0",
    program_id: "",
    notes: "",
    company_code: defaultCompany,
  });
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((p) => ({ ...p, [k]: val }));
  const err = (k: string) => state?.fieldErrors?.[k]?.[0];

  const submit = async () => {
    setPending(true);
    const res = await saveActivityAction({ ...v, location_id: siteId });
    setState(res);
    if (res.status !== "ok") {
      setPending(false);
      toast.error(res.message);
      return;
    }
    const id = (res.data as { id?: string } | undefined)?.id;
    if (id && files.length) {
      const supabase = createClient();
      for (const f of files) {
        const file = await compressImage(f);
        const { error } = await supabase.storage.from(BUCKET_LAMPIRAN).upload(`aktivitas/${id}/${safeStorageName(file.name)}`, file, { contentType: file.type || undefined });
        if (error) toast.error(`Gagal mengunggah ${f.name}`, { description: error.message });
      }
      await syncActivityEvidenceAction(id);
    }
    setPending(false);
    toast.success(res.message);
    setOpen(false);
    setFiles([]);
    setV((p) => ({ ...p, notes: "", participant_count: "0", program_id: "" }));
    router.refresh();
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button />}>
        <Plus /> Catat Aktivitas
      </SheetTrigger>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Aktivitas K3</p>
          <SheetTitle>Catat Aktivitas</SheetTitle>
          <SheetDescription>{siteName}. Aktivitas yang dihubungkan ke program ikut menambah aktual program di bulannya.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {companies.length > 1 && (
            <Field label="Perusahaan" htmlFor="ac-company" required error={err("company_code")}>
              <SearchableSelect id="ac-company" value={v.company_code} onValueChange={(x) => set("company_code", x)} options={companies} placeholder="Pilih perusahaan" />
            </Field>
          )}
          <Field label="Jenis" htmlFor="ac-type" required error={err("type_code")}>
            <SearchableSelect id="ac-type" value={v.type_code} onValueChange={(x) => set("type_code", x ?? "")} options={ACTIVITY_TYPES.map((t) => ({ value: t.value, label: t.label }))} placeholder="Pilih jenis" />
          </Field>
          <Field label="Tanggal" htmlFor="ac-date" required error={err("activity_date")}>
            <Input id="ac-date" type="date" value={v.activity_date} max={today} onChange={(e) => set("activity_date", e.target.value)} className="text-base md:text-sm" />
          </Field>
          <Field label="Lokasi" htmlFor="ac-area" required error={err("area_id")}>
            <SearchableSelect id="ac-area" value={v.area_id || null} onValueChange={(x) => set("area_id", x ?? "")} options={areas} placeholder="Pilih lokasi" />
          </Field>
          <Field label="Pelaksana" htmlFor="ac-leader" required error={err("leader_id")}>
            <SearchableSelect id="ac-leader" value={v.leader_id || null} onValueChange={(x) => set("leader_id", x ?? "")} options={people} placeholder="Pilih pelaksana" />
          </Field>
          <Field label="Jumlah peserta" htmlFor="ac-count" error={err("participant_count")}>
            <Input id="ac-count" inputMode="numeric" value={v.participant_count} onChange={(e) => set("participant_count", e.target.value)} className="text-base md:text-sm" />
          </Field>
          <Field label="Program TSP terkait" htmlFor="ac-prog" error={err("program_id")} hint={`Program aktif tahun ${year} di site ini. Opsional.`}>
            <SearchableSelect id="ac-prog" value={v.program_id || null} onValueChange={(x) => set("program_id", x ?? "")} options={programs} placeholder="Tanpa program" />
          </Field>
          <Field label="Catatan" htmlFor="ac-notes" error={err("notes")}>
            <Textarea id="ac-notes" rows={3} value={v.notes} maxLength={2000} onChange={(e) => set("notes", e.target.value)} className="text-base md:text-sm" />
          </Field>
          <Field label="Bukti" htmlFor="ac-proof" hint="Daftar hadir, foto, materi, atau MOM. Diunggah saat disimpan.">
            <div className="space-y-2">
              <FileDropzone id="ac-proof" multiple onFiles={(f) => setFiles((p) => [...p, ...f].slice(0, 10))} />
              {files.length > 0 && (
                <ul className="space-y-1 text-xs">
                  {files.map((f, i) => (
                    <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded border px-2 py-1">
                      <span className="truncate">{f.name}</span>
                      <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} aria-label={`Hapus ${f.name}`}>
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Field>
        </div>
        <SheetFooter className="flex-row justify-end border-t">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Batal
          </Button>
          <Button type="button" onClick={submit} disabled={pending || !online}>
            {pending && <Loader2 className="animate-spin" />} Simpan Aktivitas
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
