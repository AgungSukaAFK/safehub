"use client";

// "Percakapan Baru" (frontend-guide §14): kategori, subjek, pesan, 1 lampiran opsional. Halaman asal
// & info perangkat ikut otomatis (ditampilkan dulu supaya user tahu apa yang dikirim).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Info, Loader2, Paperclip, Send, X } from "lucide-react";
import { Field, fieldError } from "@/components/form-bits";
import { useApp } from "@/components/providers/app-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { openThreadAction } from "@/app/(app)/bantuan/actions";
import { BUCKET_LAMPIRAN } from "@/lib/app-config";
import { compressImage, MAX_FILE_BYTES, safeStorageName } from "@/lib/attachments";
import { collectClientContext, CONTEXT_LABELS, type ClientContext } from "@/lib/client-context";
import { INITIAL_FORM_STATE, type FormState } from "@/lib/form-state";
import { formatBytes } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { SUPPORT_CATEGORIES } from "@/lib/support-types";
import { toast } from "@/lib/toast";

export function NewThreadDialog({ open, onOpenChange, fromPage, basePath }: { open: boolean; onOpenChange: (o: boolean) => void; fromPage: string | null; basePath: string }) {
  const { access } = useApp();
  const router = useRouter();
  const [category, setCategory] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [ctx, setCtx] = useState<ClientContext | null>(null);
  const [state, setState] = useState<FormState>(INITIAL_FORM_STATE);
  const [busy, setBusy] = useState(false);

  const pickFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) return toast.error(`File maksimal ${formatBytes(MAX_FILE_BYTES)}.`);
    setFile(await compressImage(f));
  };

  const submit = async () => {
    setBusy(true);
    let path: string | null = null;
    try {
      if (file) {
        path = `support/new-${access.userId}/${safeStorageName(file.name)}`;
        const { error } = await createClient().storage.from(BUCKET_LAMPIRAN).upload(path, file, { contentType: file.type });
        if (error) throw new Error("Lampiran gagal diunggah. Periksa koneksi lalu coba lagi.");
      }
      const res = await openThreadAction({ category, subject, body, attachmentPath: path, context: ctx });
      setState(res);
      if (res.status !== "ok") {
        toast.error(res.message);
        if (path) void createClient().storage.from(BUCKET_LAMPIRAN).remove([path]);
        return;
      }
      toast.success(res.message);
      onOpenChange(false);
      setCategory("");
      setSubject("");
      setBody("");
      setFile(null);
      router.push(`${basePath}?t=${res.data?.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengirim.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (busy) return;
        onOpenChange(o);
        if (o) setCtx(collectClientContext(fromPage));
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Percakapan Baru</DialogTitle>
          <DialogDescription>Ceritakan kendalanya. Admin app akan membalas di sini.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Kategori" htmlFor="sp-cat" required error={fieldError(state, "category")}>
            <Select items={SUPPORT_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))} value={category || null} onValueChange={(v) => setCategory(String(v ?? ""))}>
              <SelectTrigger id="sp-cat" className="w-full">
                <SelectValue placeholder="Pilih kategori" />
              </SelectTrigger>
              <SelectContent>
                {SUPPORT_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Subjek" htmlFor="sp-subject" required error={fieldError(state, "subject")}>
            <Input id="sp-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} placeholder="Mis. Tidak bisa membuka menu Pengajuan" />
          </Field>
          <Field label="Pesan" htmlFor="sp-body" error={fieldError(state, "body")}>
            <Textarea
              id="sp-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onPaste={(e) => {
                const f = Array.from(e.clipboardData.files)[0];
                if (f) {
                  e.preventDefault();
                  void pickFile(f);
                }
              }}
              maxLength={4000}
              rows={4}
              placeholder="Apa yang Anda lakukan, dan apa yang terjadi? Screenshot bisa langsung ditempel."
            />
          </Field>
          <div className="flex items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              <Paperclip className="size-4" /> {file ? "Ganti lampiran" : "Lampirkan file"}
              <input type="file" className="hidden" accept="image/*,.pdf,.xlsx,.docx" onChange={(e) => void pickFile(e.target.files?.[0])} />
            </label>
            {file && (
              <span className="flex min-w-0 items-center gap-1 rounded border px-2 py-0.5 text-xs">
                <span className="truncate">{file.name}</span> ({formatBytes(file.size)})
                <button type="button" onClick={() => setFile(null)} aria-label="Hapus lampiran" className="text-muted-foreground hover:text-foreground">
                  <X className="size-3.5" />
                </button>
              </span>
            )}
          </div>
          {ctx && (
            <details className="rounded-md border bg-muted/40 px-3 py-2 text-xs">
              <summary className="flex cursor-pointer items-center gap-1.5 text-muted-foreground">
                <Info className="size-3.5" /> Info yang ikut terkirim (membantu admin)
              </summary>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                {(Object.keys(ctx) as (keyof ClientContext)[]).map((k) => (
                  <div key={k} className="contents">
                    <dt className="text-muted-foreground">{CONTEXT_LABELS[k]}</dt>
                    <dd className="break-all">{ctx[k] ?? "-"}</dd>
                  </div>
                ))}
              </dl>
            </details>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Batal
          </Button>
          <Button onClick={submit} disabled={busy || !category || subject.trim().length < 3 || (!body.trim() && !file)}>
            {busy ? <Loader2 className="animate-spin" /> : <Send />} Kirim
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
