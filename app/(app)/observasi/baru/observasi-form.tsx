"use client";

// Observasi KTA/TTA (prototipe ObservationPage): lapor cepat, muat satu layar di HP. Foto diunggah setelah
// observasi tersimpan (observasi/<id>/). Tindak lanjut = temuan yang dibuat RPC (PIC diberi tahu).
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Building2, Camera, CircleCheck, Loader2, Send, User, X } from "lucide-react";
import { Field, fieldError, useFormAction } from "@/components/form-bits";
import { SearchableSelect, type SelectOption } from "@/components/form/searchable-select";
import { Button, buttonVariants } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { BUCKET_LAMPIRAN } from "@/lib/app-config";
import { compressImage, safeStorageName } from "@/lib/attachments";
import { OBS_KINDS } from "@/lib/inspeksi-rules";
import { useOnline } from "@/lib/offline/use-online";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { submitObservationAction } from "../actions";

type Photo = { key: string; file: File; preview: string };

export function ObservasiForm({
  siteId,
  siteName,
  areas,
  risks,
  people,
  companyCode,
}: {
  siteId: string;
  siteName: string;
  areas: SelectOption[];
  risks: SelectOption[];
  people: SelectOption[];
  companyCode: string | null;
}) {
  const online = useOnline();
  const { state, pending, submit } = useFormAction(submitObservationAction);
  const [v, setV] = useState({
    kind: "kta" as "kta" | "tta",
    area_id: "",
    description: "",
    immediate_action: "",
    followup: false,
    risk_level: risks.find((r) => r.value === "medium")?.value ?? risks[0]?.value ?? "",
    pic_id: null as string | null,
  });
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState<{ id: string; code: string; findingCode: string | null; failed: number } | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((p) => ({ ...p, [k]: val }));
  const err = (k: string) => fieldError(state, k);

  const handled = useRef(0);
  useEffect(() => {
    if (!state.ts || state.ts === handled.current) return;
    handled.current = state.ts;
    if (state.status !== "ok") {
      if (state.message) toast.error(state.message);
      return;
    }
    const id = state.data?.id as string;
    void (async () => {
      let failed = 0;
      if (photos.length) {
        setUploading(true);
        const supabase = createClient();
        for (const p of photos) {
          const f = await compressImage(p.file);
          const { error } = await supabase.storage.from(BUCKET_LAMPIRAN).upload(`observasi/${id}/${safeStorageName(f.name)}`, f, { contentType: f.type || undefined });
          if (error) failed++;
        }
        setUploading(false);
      }
      setDone({ id, code: state.data?.code as string, findingCode: (state.data?.findingCode as string | null) ?? null, failed });
      window.scrollTo({ top: 0 });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const send = () => {
    const fd = new FormData();
    fd.set(
      "payload",
      JSON.stringify({
        company_code: companyCode,
        location_id: siteId,
        area_id: v.area_id,
        kind: v.kind,
        description: v.description,
        immediate_action: v.immediate_action,
        followup: v.followup,
        risk_level: v.followup ? v.risk_level : null,
        pic_id: v.followup ? v.pic_id : null,
      }),
    );
    submit(fd);
  };

  if (done)
    return (
      <section className="col-span-12 mx-auto flex max-w-lg flex-col items-center gap-3 py-10 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400">
          <CircleCheck className="size-9" />
        </span>
        <h1 className="text-2xl font-semibold">Observasi terkirim</h1>
        <p className="font-mono text-lg font-semibold">{done.code}</p>
        <p className="text-sm text-muted-foreground">{done.findingCode ? `Temuan ${done.findingCode} dibuat untuk tindak lanjut.` : "Terima kasih telah berkontribusi menjaga keselamatan kerja."}</p>
        {done.failed > 0 && <p className="text-sm text-amber-700 dark:text-amber-300">{done.failed} foto gagal diunggah. Unggah ulang dari halaman detail.</p>}
        <div className="mt-2 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          <Link href={`/observasi/${done.id}`} className={buttonVariants()}>
            Lihat Observasi
          </Link>
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
            Kembali ke Beranda
          </Link>
        </div>
      </section>
    );

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate className="col-span-12 mx-auto flex w-full max-w-xl flex-col gap-4">
      <header className="pt-2">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Lapor cepat</p>
        <h1 className="text-2xl font-semibold tracking-tight">Observasi KTA/TTA</h1>
        <p className="text-sm text-muted-foreground">Catat kondisi atau tindakan tidak aman yang Anda temukan · {siteName}</p>
      </header>

      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Jenis observasi">
        {OBS_KINDS.map((k) => {
          const on = v.kind === k.value;
          return (
            <button
              key={k.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => set("kind", k.value)}
              className={cn("flex min-h-16 items-center gap-3 rounded-xl border p-3 text-left transition-colors", on ? "border-primary bg-primary/5" : "hover:bg-accent")}
            >
              <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", on ? "bg-primary text-primary-foreground" : "bg-muted")}>{k.value === "kta" ? <Building2 className="size-5" /> : <User className="size-5" />}</span>
              <span>
                <strong className="block">{k.label}</strong>
                <small className="text-muted-foreground">{k.full}</small>
              </span>
            </button>
          );
        })}
      </div>

      <Field label="Lokasi" htmlFor="ob-area" required error={err("area_id")}>
        <SearchableSelect id="ob-area" value={v.area_id || null} onValueChange={(x) => set("area_id", x ?? "")} options={areas} placeholder="Pilih lokasi" />
      </Field>
      <Field label="Uraian" htmlFor="ob-desc" required error={err("description")}>
        <Textarea id="ob-desc" rows={3} maxLength={1000} value={v.description} onChange={(e) => set("description", e.target.value)} placeholder={`Jelaskan ${v.kind === "kta" ? "kondisi" : "tindakan"} tidak aman yang diamati`} className="text-base md:text-sm" />
      </Field>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => {
        const f = Array.from(e.target.files ?? []).slice(0, 5 - photos.length);
        setPhotos((p) => [...p, ...f.map((file) => ({ key: crypto.randomUUID(), file, preview: URL.createObjectURL(file) }))]);
        e.target.value = "";
      }} />
      <button type="button" onClick={() => cameraRef.current?.click()} disabled={photos.length >= 5} className="flex items-center gap-3 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-3 text-left transition-colors hover:bg-primary/10 disabled:opacity-50">
        <Camera className="size-7 shrink-0 text-primary" />
        <span>
          <strong className="block">{photos.length ? `${photos.length} foto ditambahkan` : "Ambil Foto"}</strong>
          <small className="text-muted-foreground">Gunakan kamera perangkat (maks. 5)</small>
        </span>
      </button>
      {photos.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {photos.map((p) => (
            <li key={p.key} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.preview} alt="" className="size-16 rounded-md object-cover" />
              <button type="button" aria-label="Hapus foto" onClick={() => { URL.revokeObjectURL(p.preview); setPhotos((x) => x.filter((y) => y.key !== p.key)); }} className="absolute -top-1.5 -right-1.5 rounded-full border bg-background p-0.5 shadow">
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Field label="Tindakan langsung yang diambil" htmlFor="ob-act" hint="Contoh: menghentikan pekerjaan dan memasang barricade">
        <Textarea id="ob-act" rows={2} maxLength={1000} value={v.immediate_action} onChange={(e) => set("immediate_action", e.target.value)} className="text-base md:text-sm" />
      </Field>

      <label className="flex items-start gap-3 rounded-xl border p-3">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">Perlu tindak lanjut?</span>
          <span className="block text-xs text-muted-foreground">Aktifkan untuk membuat temuan dan menugaskan PIC.</span>
        </span>
        <Switch checked={v.followup} onCheckedChange={(c) => set("followup", c)} aria-label="Perlu tindak lanjut" />
      </label>
      {v.followup && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Prioritas" htmlFor="ob-risk" required error={err("risk_level")}>
            <SearchableSelect id="ob-risk" value={v.risk_level || null} onValueChange={(x) => set("risk_level", x ?? "")} options={risks} placeholder="Pilih prioritas" />
          </Field>
          <Field label="PIC" htmlFor="ob-pic" required error={err("pic_id")}>
            <SearchableSelect id="ob-pic" value={v.pic_id} onValueChange={(x) => set("pic_id", x)} options={people} placeholder="Pilih PIC" />
          </Field>
        </div>
      )}

      <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur md:bottom-0 md:mx-0 md:rounded-xl md:border">
        <Button type="button" className="h-11 w-full" onClick={send} disabled={pending || uploading || !online || !v.area_id || !v.description.trim()}>
          {pending || uploading ? <Loader2 className="animate-spin" /> : <Send />} {pending ? "Mengirim..." : uploading ? "Mengunggah foto..." : "Kirim"}
        </Button>
      </div>
    </form>
  );
}
