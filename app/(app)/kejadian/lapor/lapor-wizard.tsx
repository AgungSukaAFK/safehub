"use client";

// Wizard Lapor Kejadian (prototipe IncidentReport), prioritas HP: kamera, field besar, bar kirim lengket
// di atas tab bawah. Satu form, langkah = state client, submit sekali. Draf otomatis per perangkat
// (useFormDraft); lampiran diunggah setelah kejadian terbentuk ke kejadian/<id>/ (spesifikasi S7).
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, Camera, Check, CircleCheck, Flame, FileText, HardHat, Leaf, MoreHorizontal, Plus, Send, ShieldAlert, Trash2, UserRound, Wrench, X } from "lucide-react";
import { Field, fieldError, useFormAction } from "@/components/form-bits";
import { DraftBanner, DraftStatus } from "@/components/form/draft-banner";
import { FileDropzone } from "@/components/form/file-dropzone";
import { SearchableSelect, type SelectOption } from "@/components/form/searchable-select";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { BUCKET_LAMPIRAN } from "@/lib/app-config";
import { compressImage, safeStorageName } from "@/lib/attachments";
import { formatBytes, formatDateTime } from "@/lib/format";
import { COMPANY_KINDS, EMPLOYMENTS, newPerson, nowWibLocal, wibLocalToIso, type PersonValues, type ReportValues } from "@/lib/kejadian-rules";
import { useFormDraft } from "@/lib/offline/use-form-draft";
import { useOnline } from "@/lib/offline/use-online";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { reportIncidentAction } from "../actions";

const STEPS = [
  { label: "Informasi Kejadian", hint: "Waktu, lokasi, dan kategori" },
  { label: "Pihak Terkait", hint: "Pelapor, pekerja, dan saksi" },
  { label: "Bukti", hint: "Foto, video, dan dokumen" },
  { label: "Tinjau & Kirim", hint: "Periksa sebelum dikirim" },
] as const;

const CATEGORY_ICON: Record<string, typeof ShieldAlert> = {
  near_miss: ShieldAlert,
  injury: UserRound,
  property_damage: Wrench,
  fire: Flame,
  occupational_disease: HardHat,
  environment: Leaf,
  other: MoreHorizontal,
};

type Picked = { key: string; file: File; preview: string | null };
const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf,video/mp4,.jpg,.jpeg,.png,.webp,.pdf,.mp4";
const MAX_BYTES = 10 * 1024 * 1024;

/** Orang tanpa `key` React (payload & perbandingan draf). */
const strip = (p: PersonValues) => ({ role: p.role, name: p.name, company_kind: p.company_kind, contractor_id: p.contractor_id, employment: p.employment, position: p.position, contact: p.contact });
const plainPersons = (v: ReportValues) => ({ ...v, workers: v.workers.map(strip), witnesses: v.witnesses.map(strip) });

export function LaporWizard({
  initial,
  companies,
  siteId,
  siteName,
  areas,
  categories,
  people,
  contractors,
  reporter,
  userId,
}: {
  initial: ReportValues;
  companies: SelectOption[];
  siteId: string;
  siteName: string;
  areas: SelectOption[];
  categories: { value: string; label: string }[];
  people: SelectOption[];
  contractors: SelectOption[];
  reporter: { name: string; subtitle: string };
  userId: string;
}) {
  const router = useRouter();
  const online = useOnline();
  const { state, pending, submit } = useFormAction(reportIncidentAction);
  const [step, setStep] = useState(1);
  const [v, setV] = useState<ReportValues>(initial);
  const [files, setFiles] = useState<Picked[]>([]);
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<{ id: string; code: string; failed: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const { dirty, resetBaseline } = useUnsavedChanges(v, !done);
  const initialJson = useMemo(() => JSON.stringify(plainPersons(initial)), [initial]);
  const draft = useFormDraft({ key: "kejadian:lapor", userId, values: v, isEmpty: (x) => JSON.stringify(plainPersons(x)) === initialJson });
  const set = <K extends keyof ReportValues>(k: K, val: ReportValues[K]) => {
    setV((p) => ({ ...p, [k]: val }));
    setStepErrors((e) => (e[k as string] ? { ...e, [k]: "" } : e));
  };
  const err = (k: string) => stepErrors[k] || fieldError(state, k);

  // ---------------------------------------------------------------- validasi langkah 1
  const validate1 = () => {
    const e: Record<string, string> = {};
    if (!v.occurred_at) e.occurred_at = "Tanggal kejadian wajib diisi";
    else if (v.occurred_at > nowWibLocal()) e.occurred_at = "Tanggal kejadian tidak boleh melebihi waktu laporan";
    if (!v.area_id) e.area_id = "Lokasi kejadian wajib dipilih";
    if (!v.category) e.category = "Kategori kejadian wajib dipilih";
    if (!v.description.trim()) e.description = "Uraian kejadian wajib diisi";
    if (companies.length > 1 && !v.company_code) e.company_code = "Pilih perusahaan";
    setStepErrors(e);
    return Object.keys(e).length === 0;
  };
  const next = () => {
    if (step === 1 && !validate1()) return;
    setStep((s) => Math.min(4, s + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ---------------------------------------------------------------- kirim
  const send = () => {
    if (!validate1()) return setStep(1);
    if (!v.declared) {
      setStepErrors({ declared: "Pernyataan kebenaran informasi wajib disetujui" });
      return setStep(4);
    }
    const fd = new FormData();
    fd.set(
      "payload",
      JSON.stringify({
        company_code: v.company_code,
        location_id: siteId,
        area_id: v.area_id,
        location_detail: v.location_detail,
        occurred_at: wibLocalToIso(v.occurred_at),
        category: v.category,
        unit_code: v.unit_code,
        unit_label: v.unit_label,
        description: v.description,
        is_emergency: v.is_emergency,
        supervisor_id: v.supervisor_id,
        persons: [...v.workers, ...v.witnesses].filter((p) => p.name.trim()).map(strip),
      }),
    );
    submit(fd);
  };

  // hasil action: unggah lampiran ke kejadian/<id>/, lalu layar sukses
  // galat validasi server di langkah 1 → kembali ke langkah 1 (sinkronisasi saat render, bukan di effect)
  const [seenTs, setSeenTs] = useState(0);
  if (state.ts && state.ts !== seenTs) {
    setSeenTs(state.ts);
    const firstErr = Object.keys(state.fieldErrors ?? {})[0];
    if (state.status === "error" && firstErr && ["occurred_at", "area_id", "category", "description", "location_id"].includes(firstErr)) setStep(1);
  }

  const handled = useRef(0);
  useEffect(() => {
    if (!state.ts || state.ts === handled.current) return;
    handled.current = state.ts;
    if (state.status !== "ok") {
      if (state.message) toast.error(state.message);
      return;
    }
    const id = state.data?.id as string;
    const code = state.data?.code as string;
    void (async () => {
      let failed = 0;
      if (files.length) {
        setUploading(true);
        const supabase = createClient();
        for (const p of files) {
          const f = await compressImage(p.file);
          const { error } = await supabase.storage.from(BUCKET_LAMPIRAN).upload(`kejadian/${id}/${safeStorageName(f.name)}`, f, { contentType: f.type || undefined });
          if (error) failed++;
        }
        setUploading(false);
      }
      draft.clear();
      resetBaseline();
      setDone({ id, code, failed });
      window.scrollTo({ top: 0 });
      router.refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const addFiles = (list: File[]) => {
    const ok = list.filter((f) => {
      if (f.size > MAX_BYTES) {
        toast.error(`${f.name} melebihi ${formatBytes(MAX_BYTES)}`);
        return false;
      }
      return true;
    });
    setFiles((p) => [...p, ...ok.map((file) => ({ key: crypto.randomUUID(), file, preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : null }))].slice(0, 15));
  };
  const removeFile = (key: string) =>
    setFiles((p) => {
      const hit = p.find((x) => x.key === key);
      if (hit?.preview) URL.revokeObjectURL(hit.preview);
      return p.filter((x) => x.key !== key);
    });

  const patchPerson = (list: "workers" | "witnesses", key: string, patch: Partial<PersonValues>) => set(list, v[list].map((p) => (p.key === key ? { ...p, ...patch } : p)));
  const area = areas.find((a) => a.value === v.area_id)?.label;
  const catLabel = categories.find((c) => c.value === v.category)?.label;
  const completed = [!!v.occurred_at && !!v.area_id && !!v.category && !!v.description.trim(), true, true, v.declared];

  // ---------------------------------------------------------------- sukses
  if (done)
    return (
      <section className="col-span-12 mx-auto flex max-w-lg flex-col items-center gap-3 py-10 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400">
          <CircleCheck className="size-9" />
        </span>
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Laporan kejadian</p>
        <h1 className="text-2xl font-semibold">Laporan terkirim</h1>
        <p className="font-mono text-lg font-semibold">{done.code}</p>
        <p className="text-sm text-muted-foreground">Notifikasi telah dikirim ke HSE dan PJO. Anda dapat memantau statusnya di Kejadian & Investigasi.</p>
        {done.failed > 0 && (
          <p className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertTriangle className="size-4 shrink-0" /> {done.failed} lampiran gagal diunggah. Unggah ulang dari halaman detail.
          </p>
        )}
        <div className="mt-2 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          <Link href={`/kejadian/${done.id}`} className={buttonVariants()}>
            Lihat Laporan
          </Link>
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
            Kembali ke Beranda
          </Link>
        </div>
      </section>
    );

  // ---------------------------------------------------------------- form
  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate className="col-span-12 mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2 pt-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Lapor Kejadian</h1>
          <p className="text-sm text-muted-foreground">Catat informasi awal kejadian secara lengkap dan akurat · {siteName}</p>
        </div>
        <DraftStatus savedAt={draft.savedAt} />
      </div>
      <DraftBanner
        draft={draft.pending}
        onRestore={() => {
          const d = draft.restore();
          if (d) setV(d.values);
        }}
        onDiscard={draft.discard}
      />

      <ol className="grid grid-cols-4 gap-1" aria-label="Langkah laporan">
        {STEPS.map((s, i) => {
          const n = i + 1;
          const isDone = step > n || (completed[i] && step !== n && n < step);
          return (
            <li key={s.label} aria-current={step === n ? "step" : undefined}>
              <button
                type="button"
                disabled={n > step}
                onClick={() => n < step && setStep(n)}
                className={cn("flex w-full flex-col items-center gap-1 rounded-lg p-1.5 text-center disabled:cursor-default", n < step && "hover:bg-accent")}
              >
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full border-2 text-sm font-semibold",
                    step === n ? "border-primary bg-primary text-primary-foreground" : isDone ? "border-green-600 bg-green-600 text-white" : "border-muted-foreground/30 text-muted-foreground",
                  )}
                >
                  {isDone ? <Check className="size-4" /> : n}
                </span>
                <span className={cn("text-[11px] leading-tight sm:text-xs", step === n ? "font-semibold" : "text-muted-foreground")}>{s.label}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="rounded-xl border bg-card p-4 md:p-6">
        <header className="mb-4">
          <h2 className="text-lg font-semibold">{STEPS[step - 1].label}</h2>
          <p className="text-sm text-muted-foreground">{STEPS[step - 1].hint}</p>
        </header>

        {step === 1 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {companies.length > 1 && (
              <Field label="Perusahaan" htmlFor="lp-company" required error={err("company_code")} className="sm:col-span-2">
                <SearchableSelect id="lp-company" value={v.company_code} onValueChange={(x) => set("company_code", x)} options={companies} placeholder="Pilih perusahaan" />
              </Field>
            )}
            <Field label="Tanggal & jam kejadian" htmlFor="lp-when" required error={err("occurred_at")}>
              <div className="flex gap-2">
                <Input id="lp-when" type="datetime-local" value={v.occurred_at} max={nowWibLocal()} onChange={(e) => set("occurred_at", e.target.value)} className="h-11 text-base md:h-9 md:text-sm" />
                <Button type="button" variant="outline" className="h-11 md:h-9" onClick={() => set("occurred_at", nowWibLocal())}>
                  Sekarang
                </Button>
              </div>
            </Field>
            <Field label="Dilaporkan" hint="Dicatat otomatis, terpisah dari waktu kejadian">
              <Input value="Saat laporan dikirim" readOnly disabled className="h-11 md:h-9" />
            </Field>
            <Field label="Lokasi" htmlFor="lp-area" required error={err("area_id")} hint={`Area di ${siteName}`}>
              <SearchableSelect id="lp-area" value={v.area_id || null} onValueChange={(x) => set("area_id", x ?? "")} options={areas} placeholder="Cari atau pilih lokasi" />
            </Field>
            <Field label="Detail lokasi" htmlFor="lp-detail" error={err("location_detail")}>
              <Input id="lp-detail" value={v.location_detail} maxLength={200} placeholder="Contoh: Bay 2, sisi kiri unit" onChange={(e) => set("location_detail", e.target.value)} className="h-11 text-base md:h-9 md:text-sm" />
            </Field>
            <fieldset id="lp-category" className="space-y-2 sm:col-span-2">
              <legend className="text-sm font-medium">
                Kategori kejadian <span className="text-destructive">*</span>
              </legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {categories.map((c) => {
                  const Icon = CATEGORY_ICON[c.value] ?? MoreHorizontal;
                  const on = v.category === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set("category", c.value)}
                      className={cn("flex min-h-14 items-center gap-2 rounded-lg border p-3 text-left text-sm transition-colors", on ? "border-primary bg-primary/5 font-medium text-primary" : "hover:bg-accent")}
                    >
                      <Icon className="size-5 shrink-0" />
                      <span className="flex-1">{c.label}</span>
                      {on && <Check className="size-4 shrink-0" />}
                    </button>
                  );
                })}
              </div>
              {err("category") && <p className="text-sm text-destructive">{err("category")}</p>}
            </fieldset>
            <Field label="Kode unit" htmlFor="lp-unit" hint="Contoh: H57197">
              <Input id="lp-unit" value={v.unit_code} maxLength={40} onChange={(e) => set("unit_code", e.target.value)} className="h-11 text-base md:h-9 md:text-sm" />
            </Field>
            <Field label="Model / nama unit" htmlFor="lp-unit-label" hint="Contoh: HD785-7. Opsional">
              <Input id="lp-unit-label" value={v.unit_label} maxLength={120} onChange={(e) => set("unit_label", e.target.value)} className="h-11 text-base md:h-9 md:text-sm" />
            </Field>
            <Field label="Uraian singkat kejadian" htmlFor="lp-desc" required error={err("description")} className="sm:col-span-2">
              <Textarea
                id="lp-desc"
                rows={5}
                maxLength={1000}
                value={v.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Jelaskan apa yang terjadi, kondisi sebelum kejadian, dan tindakan awal yang dilakukan."
                className="text-base md:text-sm"
              />
              <p className="mt-1 text-right text-xs text-muted-foreground tabular-nums">{v.description.length}/1000</p>
            </Field>
            <label className="flex items-start gap-3 rounded-lg border p-3 sm:col-span-2">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">Butuh penanganan darurat?</span>
                <span className="block text-xs text-muted-foreground">Aktifkan jika kondisi masih berbahaya atau memerlukan bantuan segera.</span>
              </span>
              <Switch checked={v.is_emergency} onCheckedChange={(c) => set("is_emergency", c)} aria-label="Butuh penanganan darurat" />
            </label>
            {v.is_emergency && (
              <div role="alert" className="flex gap-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm sm:col-span-2 dark:border-red-900 dark:bg-red-950/40">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-600 dark:text-red-400" />
                <p>
                  <strong className="block">Segera hubungi tim tanggap darurat site.</strong>
                  <span className="text-muted-foreground">Laporan ini akan langsung ditandai DARURAT dan dikirim ke HSE dan PJO.</span>
                </p>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {reporter.name
                  .split(" ")
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("")}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Pelapor</p>
                <p className="truncate font-medium">{reporter.name}</p>
                <p className="truncate text-xs text-muted-foreground">{reporter.subtitle}</p>
              </div>
              <span className="rounded-md border px-2 py-0.5 text-xs">Otomatis</span>
            </div>
            <PersonList
              title="Pekerja yang terlibat"
              hint="Tambahkan semua pekerja yang terlibat langsung."
              addLabel="Tambah pekerja"
              list={v.workers}
              onAdd={() => set("workers", [...v.workers, newPerson("involved")])}
              onRemove={(k) => set("workers", v.workers.filter((p) => p.key !== k))}
              onPatch={(k, patch) => patchPerson("workers", k, patch)}
              contractors={contractors}
              showEmployment
            />
            <PersonList
              title="Saksi"
              hint="Tambahkan saksi yang melihat atau mengetahui kejadian."
              addLabel="Tambah saksi"
              list={v.witnesses}
              onAdd={() => set("witnesses", [...v.witnesses, newPerson("witness")])}
              onRemove={(k) => set("witnesses", v.witnesses.filter((p) => p.key !== k))}
              onPatch={(k, patch) => patchPerson("witnesses", k, patch)}
              contractors={contractors}
            />
            <Field label="Atasan langsung" htmlFor="lp-sup" hint="Opsional. Atasan ikut bisa melihat laporan ini.">
              <SearchableSelect id="lp-sup" value={v.supervisor_id} onValueChange={(x) => set("supervisor_id", x)} options={people} placeholder="Pilih atasan langsung" />
            </Field>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
            <button type="button" onClick={() => cameraRef.current?.click()} className="flex w-full items-center gap-4 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-4 text-left transition-colors hover:bg-primary/10">
              <Camera className="size-8 shrink-0 text-primary" />
              <span>
                <strong className="block">Ambil Foto</strong>
                <span className="text-sm text-muted-foreground">Gunakan kamera perangkat</span>
              </span>
            </button>
            <FileDropzone multiple accept={ACCEPT} maxBytes={MAX_BYTES} onFiles={addFiles} title="Tarik dan lepas file di sini" hint="JPG, PNG, PDF, MP4 · maks 10 MB per file" />
            {files.length > 0 && (
              <ul className="grid gap-2 sm:grid-cols-2">
                {files.map((p) => (
                  <li key={p.key} className="flex items-center gap-3 rounded-lg border p-2">
                    {p.preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.preview} alt="" className="size-14 shrink-0 rounded-md object-cover" />
                    ) : (
                      <span className="flex size-14 shrink-0 items-center justify-center rounded-md bg-muted">
                        <FileText className="size-6 text-muted-foreground" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.file.name}</span>
                      <span className="block text-xs text-muted-foreground">{formatBytes(p.file.size)}</span>
                    </span>
                    <Button type="button" size="icon-sm" variant="ghost" aria-label={`Hapus ${p.file.name}`} onClick={() => removeFile(p.key)}>
                      <X />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">Lampiran hanya dapat dilihat oleh pihak berwenang. Lampiran diunggah setelah laporan terkirim.</p>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <Review title="Informasi Kejadian" onEdit={() => setStep(1)}>
              <Row label="Waktu kejadian" value={v.occurred_at ? formatDateTime(wibLocalToIso(v.occurred_at)) : "Belum diisi"} />
              <Row label="Lokasi" value={[siteName, area, v.location_detail].filter(Boolean).join(" · ") || "Belum dipilih"} />
              <Row label="Kategori" value={catLabel ?? "Belum dipilih"} />
              <Row label="Unit/peralatan" value={[v.unit_code, v.unit_label].filter(Boolean).join(" · ") || "Tidak ada"} />
              <Row label="Darurat" value={v.is_emergency ? "Ya" : "Tidak"} />
              <Row label="Uraian" value={v.description || "Belum diisi"} wide />
            </Review>
            <Review title="Pihak Terkait" onEdit={() => setStep(2)}>
              <Row label="Pelapor" value={reporter.name} />
              <Row label="Atasan langsung" value={people.find((p) => p.value === v.supervisor_id)?.label ?? "Tidak ada"} />
              <Row label="Pekerja terlibat" value={String(v.workers.filter((p) => p.name.trim()).length || "Tidak ada")} />
              <Row label="Saksi" value={String(v.witnesses.filter((p) => p.name.trim()).length || "Tidak ada")} />
            </Review>
            <Review title="Bukti" onEdit={() => setStep(3)}>
              <Row label="Lampiran" value={files.length ? `${files.length} file` : "Belum ada lampiran"} wide />
            </Review>
            <label className={cn("flex items-start gap-3 rounded-lg border p-3", err("declared") && "border-destructive")}>
              <input type="checkbox" checked={v.declared} onChange={(e) => set("declared", e.target.checked)} className="mt-1 size-5 shrink-0 accent-[var(--primary)]" />
              <span className="text-sm">Informasi yang saya laporkan benar sesuai pengetahuan saya</span>
            </label>
            {err("declared") && <p className="text-sm text-destructive">{err("declared")}</p>}
            {state.status === "error" && state.message && <p className="text-sm text-destructive">{state.message}</p>}
          </div>
        )}
      </div>

      <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 -mx-4 flex items-center justify-between gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur md:bottom-0 md:mx-0 md:rounded-xl md:border">
        <Link href="/kejadian" className={buttonVariants({ variant: "ghost", className: "h-11 md:h-9" })} title="Isian tersimpan otomatis sebagai draf di perangkat ini">
          Batal
        </Link>
        <div className="flex gap-2">
          {step > 1 && (
            <Button type="button" variant="outline" className="h-11 md:h-9" onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft /> Kembali
            </Button>
          )}
          {step < 4 ? (
            <Button type="button" className="h-11 md:h-9" onClick={next}>
              Lanjutkan <ArrowRight />
            </Button>
          ) : (
            <Button type="button" className="h-11 md:h-9" onClick={send} disabled={pending || uploading || !online}>
              <Send /> {pending ? "Mengirim..." : uploading ? "Mengunggah..." : "Kirim Laporan"}
            </Button>
          )}
        </div>
      </div>
      {dirty && <span className="sr-only">Ada perubahan yang belum dikirim</span>}
    </form>
  );
}

function Review({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border">
      <header className="flex items-center justify-between border-b px-3 py-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <button type="button" onClick={onEdit} className="text-sm font-medium text-primary hover:underline">
          Ubah
        </button>
      </header>
      <dl className="grid gap-x-6 gap-y-2 p-3 sm:grid-cols-2">{children}</dl>
    </section>
  );
}
function Row({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={cn(wide && "sm:col-span-2")}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium [overflow-wrap:anywhere] whitespace-pre-wrap">{value}</dd>
    </div>
  );
}

function PersonList({
  title,
  hint,
  addLabel,
  list,
  onAdd,
  onRemove,
  onPatch,
  contractors,
  showEmployment,
}: {
  title: string;
  hint: string;
  addLabel: string;
  list: PersonValues[];
  onAdd: () => void;
  onRemove: (key: string) => void;
  onPatch: (key: string, patch: Partial<PersonValues>) => void;
  contractors: SelectOption[];
  showEmployment?: boolean;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={onAdd} disabled={list.length >= 30}>
          <Plus /> {addLabel}
        </Button>
      </div>
      {list.length === 0 && <p className="rounded-lg border border-dashed p-3 text-center text-sm text-muted-foreground">Belum ada. Opsional.</p>}
      {list.map((p, i) => (
        <div key={p.key} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">
          <div className="flex items-center justify-between sm:col-span-2">
            <span className="text-xs font-semibold text-muted-foreground">
              {title} {i + 1}
            </span>
            <Button type="button" size="icon-sm" variant="ghost" aria-label={`Hapus ${title.toLowerCase()} ${i + 1}`} onClick={() => onRemove(p.key)}>
              <Trash2 />
            </Button>
          </div>
          <Input value={p.name} maxLength={120} placeholder="Nama" aria-label="Nama" onChange={(e) => onPatch(p.key, { name: e.target.value })} className="h-11 text-base md:h-9 md:text-sm sm:col-span-2" />
          <SearchableSelect
            value={p.company_kind ?? "internal"}
            onValueChange={(x) => onPatch(p.key, { company_kind: (x ?? "internal") as PersonValues["company_kind"], contractor_id: x === "contractor" ? p.contractor_id : null })}
            options={COMPANY_KINDS.map((c) => ({ value: c.value, label: c.label }))}
            placeholder="Perusahaan"
          />
          {p.company_kind === "contractor" ? (
            <SearchableSelect value={p.contractor_id ?? null} onValueChange={(x) => onPatch(p.key, { contractor_id: x })} options={contractors} placeholder="Pilih kontraktor" />
          ) : showEmployment ? (
            <SearchableSelect value={p.employment ?? null} onValueChange={(x) => onPatch(p.key, { employment: x as PersonValues["employment"] })} options={EMPLOYMENTS.map((e) => ({ value: e.value, label: e.label }))} placeholder="Status kerja" />
          ) : (
            <Input value={p.contact ?? ""} maxLength={40} inputMode="tel" placeholder="Kontak (telepon)" aria-label="Kontak" onChange={(e) => onPatch(p.key, { contact: e.target.value })} className="h-11 text-base md:h-9 md:text-sm" />
          )}
          {showEmployment && <Input value={p.position ?? ""} maxLength={100} placeholder="Jabatan, mis. Teknisi AC" aria-label="Jabatan" onChange={(e) => onPatch(p.key, { position: e.target.value })} className="h-11 text-base md:h-9 md:text-sm sm:col-span-2" />}
        </div>
      ))}
    </section>
  );
}
