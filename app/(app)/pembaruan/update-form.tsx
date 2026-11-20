"use client";

// Form Pembaruan (baru & ubah): FormSummaryLayout + draft perangkat + Pratinjau yang memakai komponen
// tampilan yang sama dengan user. Thumbnail 16:9 di-crop di browser; gambar isi diunggah ke bucket
// media (`updates/<kunci-form>/...`) dan disimpan sebagai path.
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, ImagePlus, Plus, Send, Trash2, X } from "lucide-react";
import { DraftBanner, DraftStatus } from "@/components/form/draft-banner";
import { FormSummaryLayout, scrollToFormSection, summaryProgress, type SummaryCheck } from "@/components/form/form-summary-layout";
import { Field } from "@/components/form-bits";
import { Content } from "@/components/list/content";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import { UpdateArticle } from "@/components/updates/update-article";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ImageCropDialog } from "@/components/user/image-crop-dialog";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { BUCKET_MEDIA } from "@/lib/app-config";
import { compressImage, safeStorageName } from "@/lib/attachments";
import { INITIAL_FORM_STATE, type FormState } from "@/lib/form-state";
import { useFormDraft } from "@/lib/offline/use-form-draft";
import { useOnline } from "@/lib/offline/use-online";
import { docImagePaths, docToText, type RichNode } from "@/lib/rich-text";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { compareVersion, type UpdateFormValues } from "@/lib/update-types";
import { randomUUID } from "@/lib/utils";
import { saveUpdateAction, signMediaAction } from "./actions";

type Version = [number, number, number];

export function UpdateForm({
  id,
  initial,
  initialThumbUrl,
  latest,
  userId,
  authorName,
  version,
}: {
  id: number | null;
  initial: UpdateFormValues;
  initialThumbUrl: string | null;
  /** versi terbesar selain post ini */
  latest: Version | null;
  userId: string;
  authorName: string;
  /** updated_at post (draft usang) */
  version: string | null;
}) {
  const router = useRouter();
  const online = useOnline();
  const [v, setV] = useState<UpdateFormValues>(initial);
  const [thumbUrl, setThumbUrl] = useState<string | null>(initialThumbUrl);
  const [editorKey, setEditorKey] = useState(0);
  const [cropOpen, setCropOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const [state, setState] = useState<FormState>(INITIAL_FORM_STATE);
  const [saving, setSaving] = useState(false);
  const folder = useRef(`updates/${randomUUID()}`);
  const { dirty, resetBaseline } = useUnsavedChanges(v, true);
  const initialJson = useMemo(() => JSON.stringify(initial), [initial]);
  const draft = useFormDraft({ key: `pembaruan:${id ?? "baru"}`, userId, values: v, version, isEmpty: (x) => JSON.stringify(x) === initialJson });

  const set = <K extends keyof UpdateFormValues>(k: K, val: UpdateFormValues[K]) => setV((p) => ({ ...p, [k]: val }));

  // versi tidak valid / tidak naik
  const nums = [v.major, v.minor, v.patch].map((x) => (x.trim() === "" ? NaN : Number(x)));
  const versionValid = nums.every((n) => Number.isInteger(n) && n >= 0 && n <= 9999);
  const cur = nums as Version;
  // mengubah post tanpa mengganti versinya selalu boleh (trigger DB juga mengizinkan)
  const sameAsSaved = id !== null && [initial.major, initial.minor, initial.patch].join(".") === nums.join(".");
  const tooLow = versionValid && !sameAsSaved && latest && compareVersion(cur, latest) <= 0;
  const latestText = latest?.join(".");
  const bump = (i: 0 | 1 | 2) => {
    const base = latest ?? [0, 0, 0];
    const next: Version = [base[0], base[1], base[2]];
    next[i] += 1;
    for (let j = i + 1; j < 3; j++) next[j] = 0;
    setV((p) => ({ ...p, major: String(next[0]), minor: String(next[1]), patch: String(next[2]) }));
  };

  const highlights = v.highlights.filter((h) => h.trim());
  const hasBody = !!docToText(v.content) || docImagePaths(v.content).length > 0;
  const checks: SummaryCheck[] = [
    {
      id: "versi",
      label: "Versi",
      status: !versionValid || tooLow ? "todo" : "done",
      value: versionValid ? `v${nums.join(".")}` : undefined,
      hint: !versionValid ? "Isi major.minor.patch (angka)" : tooLow ? `Harus lebih besar dari ${latestText}` : undefined,
      targetId: "up-major",
    },
    { id: "judul", label: "Judul", status: v.title.trim().length >= 3 ? "done" : "todo", value: v.title || undefined, targetId: "up-title" },
    { id: "thumbnail", label: "Thumbnail", status: v.thumbnailPath ? "done" : "suggested", hint: v.thumbnailPath ? undefined : "Disarankan: kartu lebih menarik", targetId: "up-thumb" },
    {
      id: "poin",
      label: "Poin penting",
      status: highlights.length ? "done" : hasBody ? "suggested" : "todo",
      value: highlights.length ? `${highlights.length} poin` : undefined,
      hint: highlights.length ? undefined : "Ringkasan singkat yang tampil di kartu",
      targetId: "up-highlights",
    },
    { id: "isi", label: "Isi lengkap", status: hasBody ? "done" : highlights.length ? "optional" : "todo", targetId: "up-content" },
  ];

  const uploadThumb = async (blob: Blob) => {
    const path = `${folder.current}/thumb-${Date.now()}.${blob.type === "image/webp" ? "webp" : "jpg"}`;
    const { error } = await createClient().storage.from(BUCKET_MEDIA).upload(path, blob, { contentType: blob.type });
    if (error) throw new Error("Thumbnail gagal diunggah.");
    set("thumbnailPath", path);
    setThumbUrl(URL.createObjectURL(blob));
  };

  const uploadImage = async (file: File) => {
    const f = await compressImage(file, { maxSide: 1600 });
    const path = `${folder.current}/${safeStorageName(f.name)}`;
    const { error } = await createClient().storage.from(BUCKET_MEDIA).upload(path, f, { contentType: f.type });
    if (error) throw new Error(error.message.includes("exceeded") ? "Gambar maksimal 5 MB." : "Unggah gagal.");
    const src = (await signMediaAction(path)) ?? URL.createObjectURL(f);
    return { path, src };
  };

  const send = async () => {
    const first = summaryProgress(checks).pending[0];
    if (first?.targetId) return scrollToFormSection(first.targetId);
    setSaving(true);
    const res = await saveUpdateAction({ id, major: v.major, minor: v.minor, patch: v.patch, title: v.title, highlights: v.highlights, thumbnailPath: v.thumbnailPath, content: v.content });
    setSaving(false);
    setState(res);
    if (res.status !== "ok") return toast.error(res.message);
    toast.success(res.message);
    draft.clear();
    resetBaseline();
    router.replace(`/pembaruan?id=${res.data?.id}`);
    router.refresh();
  };

  useEffect(() => () => void (thumbUrl?.startsWith("blob:") && URL.revokeObjectURL(thumbUrl)), [thumbUrl]);

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate className="col-span-12">
      <FormSummaryLayout
        summary={{
          title: id ? `Ubah v${initial.major}.${initial.minor}.${initial.patch}` : "Pembaruan Baru",
          subtitle: latestText ? <span className="text-muted-foreground">Versi terakhir: v{latestText}</span> : <span className="text-muted-foreground">Belum ada versi sebelumnya</span>,
          checks,
          submitLabel: id ? "Simpan Perubahan" : "Terbitkan",
          submittingLabel: "Menyimpan...",
          submitIcon: <Send />,
          onSubmit: send,
          submitting: saving,
          disabled: !online,
          disabledReason: !online ? "Butuh koneksi internet" : undefined,
          dirty,
          error: state.status === "error" ? state.message : undefined,
          status: <DraftStatus savedAt={draft.savedAt} />,
          nextSteps: <>Setelah diterbitkan, semua pengguna melihat badge &quot;baru&quot; di menu Pembaruan, item di Inbox, dan banner di Beranda selama 7 hari.</>,
          secondaryActions: (
            <Button type="button" variant="outline" onClick={() => setPreview(true)}>
              <Eye /> Pratinjau
            </Button>
          ),
        }}
      >
        <DraftBanner
          draft={draft.pending}
          onRestore={() => {
            const d = draft.restore();
            if (d) {
              setV(d.values);
              setEditorKey((k) => k + 1);
            }
          }}
          onDiscard={draft.discard}
        />

        <Content title="Versi & judul" size="lg">
          <div className="space-y-4">
            <Field
              label="Versi"
              htmlFor="up-major"
              required
              error={state.fieldErrors?.major?.[0] ?? (tooLow ? `Harus lebih besar dari v${latestText}` : undefined)}
              hint="major.minor.patch: perbaikan kecil naikkan patch, fitur baru naikkan minor."
            >
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1">
                  {(["major", "minor", "patch"] as const).map((k, i) => (
                    <span key={k} className="flex items-center gap-1">
                      {i > 0 && <span className="text-muted-foreground">.</span>}
                      <Input
                        id={`up-${k}`}
                        aria-label={k}
                        inputMode="numeric"
                        value={v[k]}
                        onChange={(e) => set(k, e.target.value.replace(/\D/g, "").slice(0, 4))}
                        className="w-16 text-center tabular-nums"
                      />
                    </span>
                  ))}
                </div>
                <div className="flex gap-1">
                  <Button type="button" size="sm" variant="outline" onClick={() => bump(2)}>
                    +patch
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => bump(1)}>
                    +minor
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => bump(0)}>
                    +major
                  </Button>
                </div>
              </div>
            </Field>
            <Field label="Judul" htmlFor="up-title" required error={state.fieldErrors?.title?.[0]}>
              <Input id="up-title" value={v.title} onChange={(e) => set("title", e.target.value)} maxLength={200} placeholder="Mis. Ekspor Excel kini menyertakan filter" className="text-base md:text-sm" />
            </Field>
          </div>
        </Content>

        <Content id="up-thumb" title="Thumbnail" description="Gambar 16:9 di kartu & bagian atas detail." size="lg">
          {thumbUrl ? (
            <div className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- signed / object URL */}
              <img src={thumbUrl} alt="Thumbnail" className="aspect-video w-full max-w-md rounded-lg border object-cover" />
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setCropOpen(true)}>
                  <ImagePlus /> Ganti
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    set("thumbnailPath", null);
                    setThumbUrl(null);
                  }}
                >
                  <X /> Lepas
                </Button>
              </div>
            </div>
          ) : (
            <Button type="button" variant="outline" onClick={() => setCropOpen(true)}>
              <ImagePlus /> Pilih gambar
            </Button>
          )}
        </Content>

        <Content id="up-highlights" title="Poin penting" description="Ringkasan singkat (maks. 10) yang tampil di kartu." size="lg">
          <ol className="space-y-2">
            {v.highlights.map((h, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="w-5 text-right text-xs text-muted-foreground">{i + 1}.</span>
                <Input
                  value={h}
                  maxLength={160}
                  aria-label={`Poin ${i + 1}`}
                  onChange={(e) => set("highlights", v.highlights.map((x, j) => (j === i ? e.target.value : x)))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (v.highlights.length < 10) set("highlights", [...v.highlights.slice(0, i + 1), "", ...v.highlights.slice(i + 1)]);
                    }
                  }}
                  placeholder="Mis. Tombol unduh Excel di semua daftar"
                />
                <Button type="button" size="icon-sm" variant="ghost" aria-label={`Hapus poin ${i + 1}`} onClick={() => set("highlights", v.highlights.filter((_, j) => j !== i))}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ol>
          <Button type="button" size="sm" variant="outline" className="mt-2" disabled={v.highlights.length >= 10} onClick={() => set("highlights", [...v.highlights, ""])}>
            <Plus /> Tambah poin
          </Button>
        </Content>

        <Content id="up-content" title="Isi lengkap" description="Tampil saat kartu dibuka. Gambar bisa disisipkan atau ditempel." size="lg">
          <RichTextEditor key={editorKey} variant="full" value={v.content} onChange={(doc: RichNode) => set("content", doc)} onUploadImage={uploadImage} placeholder="Jelaskan apa yang berubah dan cara memakainya..." />
        </Content>
      </FormSummaryLayout>

      <ImageCropDialog
        open={cropOpen}
        onOpenChange={setCropOpen}
        onSave={uploadThumb}
        aspect={16 / 9}
        outputWidth={1280}
        maxBytes={400 * 1024}
        title="Thumbnail Pembaruan"
        editTitle="Sesuaikan Thumbnail"
        pickDescription="Pilih gambar maksimal 10 MB. Hasil 16:9."
        saveLabel="Pakai Gambar"
        errorTitle="Gagal memasang thumbnail"
      />
      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogTitle className="sr-only">Pratinjau</DialogTitle>
          <p className="rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">Pratinjau: begini yang dilihat pengguna.</p>
          <UpdateArticle
            version={versionValid ? nums.join(".") : "?.?.?"}
            title={v.title}
            highlights={v.highlights}
            thumbnailUrl={thumbUrl}
            content={v.content}
            date={new Date().toISOString()}
            author={authorName}
          />
        </DialogContent>
      </Dialog>
    </form>
  );
}
