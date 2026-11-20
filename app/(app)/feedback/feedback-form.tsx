"use client";

// Form Feedback (frontend-guide §20.4): kategori, isi rich text, screenshot (tempel langsung ke editor
// / klik / seret), konteks otomatis (halaman asal, versi, browser, layar, tema).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Info, Loader2, Send, X } from "lucide-react";
import { FileDropzone } from "@/components/form/file-dropzone";
import { Field, fieldError } from "@/components/form-bits";
import { useApp } from "@/components/providers/app-context";
import { RichTextEditor } from "@/components/rich-text/rich-text-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BUCKET_LAMPIRAN } from "@/lib/app-config";
import { compressImage, safeStorageName } from "@/lib/attachments";
import { collectClientContext, CONTEXT_LABELS, type ClientContext } from "@/lib/client-context";
import { FEEDBACK_CATEGORIES, MAX_FEEDBACK_FILES } from "@/lib/feedback-rules";
import { INITIAL_FORM_STATE, type FormState } from "@/lib/form-state";
import { formatBytes } from "@/lib/format";
import { docToText, EMPTY_DOC, type RichNode } from "@/lib/rich-text";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { submitFeedbackAction } from "./actions";

type Upload = { path: string; name: string; size: number; preview: string };

export function FeedbackForm({ fromPage, version }: { fromPage: string | null; version: string | null }) {
  const { access } = useApp();
  const router = useRouter();
  const [category, setCategory] = useState("");
  const [other, setOther] = useState("");
  const [doc, setDoc] = useState<RichNode>(EMPTY_DOC);
  const [editorKey, setEditorKey] = useState(0);
  const [files, setFiles] = useState<Upload[]>([]);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<FormState>(INITIAL_FORM_STATE);
  const [ctx, setCtx] = useState<ClientContext | null>(null);

  const addFiles = async (list: File[]) => {
    const room = MAX_FEEDBACK_FILES - files.length;
    if (room <= 0) return toast.error(`Maksimal ${MAX_FEEDBACK_FILES} lampiran.`);
    setUploading(true);
    const supabase = createClient();
    for (const raw of list.slice(0, room)) {
      if (!raw.type.startsWith("image/") && raw.type !== "application/pdf") {
        toast.error(`${raw.name}: hanya gambar atau PDF.`);
        continue;
      }
      const f = await compressImage(raw);
      const path = `feedback/${access.userId}/${safeStorageName(f.name || "screenshot.png")}`;
      const { error } = await supabase.storage.from(BUCKET_LAMPIRAN).upload(path, f, { contentType: f.type });
      if (error) toast.error(`${raw.name} gagal diunggah.`);
      else setFiles((prev) => [...prev, { path, name: f.name || "screenshot", size: f.size, preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : "" }]);
    }
    setUploading(false);
  };

  const removeFile = (u: Upload) => {
    setFiles((prev) => prev.filter((x) => x.path !== u.path));
    if (u.preview) URL.revokeObjectURL(u.preview);
    void createClient().storage.from(BUCKET_LAMPIRAN).remove([u.path]);
  };

  const submit = async () => {
    setBusy(true);
    const context = ctx ?? collectClientContext(fromPage, version);
    const res = await submitFeedbackAction({ category, categoryOther: other, content: doc, attachments: files.map((f) => f.path), context: context as Record<string, string | null> });
    setState(res);
    setBusy(false);
    if (res.status !== "ok") return toast.error(res.message);
    toast.success(res.message);
    files.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
    setCategory("");
    setOther("");
    setDoc(EMPTY_DOC);
    setEditorKey((k) => k + 1);
    setFiles([]);
    router.refresh();
  };

  const empty = !docToText(doc);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kategori" htmlFor="fb-cat" required error={fieldError(state, "category")}>
          <Select items={FEEDBACK_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))} value={category || null} onValueChange={(v) => setCategory(String(v ?? ""))}>
            <SelectTrigger id="fb-cat" className="w-full">
              <SelectValue placeholder="Pilih kategori" />
            </SelectTrigger>
            <SelectContent>
              {FEEDBACK_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {category === "lainnya" && (
          <Field label="Jenis feedback" htmlFor="fb-other" required error={fieldError(state, "categoryOther")}>
            <Input id="fb-other" value={other} onChange={(e) => setOther(e.target.value)} maxLength={100} placeholder="Mis. Usulan istilah" />
          </Field>
        )}
      </div>
      <Field label="Isi" htmlFor="fb-content" required error={fieldError(state, "content")} hint="Ceritakan apa yang terjadi atau yang Anda harapkan. Screenshot bisa langsung ditempel (Ctrl+V).">
        <RichTextEditor key={editorKey} id="fb-content" value={doc} onChange={setDoc} onPasteFiles={(fs) => void addFiles(fs)} placeholder="Tulis feedback Anda..." invalid={!!fieldError(state, "content")} />
      </Field>
      <div className="space-y-2">
        <FileDropzone
          multiple
          accept="image/*,.pdf"
          onFiles={(fs) => void addFiles(fs)}
          loading={uploading}
          disabled={files.length >= MAX_FEEDBACK_FILES}
          title="Lampirkan screenshot: seret, klik, atau tempel"
          hint={`Gambar atau PDF, maksimal ${MAX_FEEDBACK_FILES} file.`}
        />
        {files.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {files.map((f) => (
              <li key={f.path} className="relative flex items-center gap-2 rounded-md border p-1.5 pr-7 text-xs">
                {f.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element -- object URL lokal
                  <img src={f.preview} alt="" className="size-10 rounded object-cover" />
                ) : null}
                <span className="max-w-40 truncate">{f.name}</span>
                <span className="text-muted-foreground">{formatBytes(f.size)}</span>
                <button type="button" onClick={() => removeFile(f)} className="absolute top-1 right-1 text-muted-foreground hover:text-foreground" aria-label={`Hapus ${f.name}`}>
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <details
        className="rounded-md border bg-muted/40 px-3 py-2 text-xs"
        onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && setCtx(collectClientContext(fromPage, version))}
      >
        <summary className="flex cursor-pointer items-center gap-1.5 text-muted-foreground">
          <Info className="size-3.5" /> Info yang ikut terkirim otomatis
        </summary>
        {ctx && (
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            {(Object.keys(ctx) as (keyof ClientContext)[]).map((k) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{CONTEXT_LABELS[k]}</dt>
                <dd className="break-all">{ctx[k] ?? "-"}</dd>
              </div>
            ))}
          </dl>
        )}
      </details>
      <div className="flex justify-end">
        <Button onClick={submit} disabled={busy || uploading || !category || empty}>
          {busy ? <Loader2 className="animate-spin" /> : <Send />} Kirim Feedback
        </Button>
      </div>
    </div>
  );
}
