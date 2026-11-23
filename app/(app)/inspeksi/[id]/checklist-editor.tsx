"use client";

// Checklist per butir (prototipe ChecklistPage), HP-first: tombol jawab besar, komentar, foto kamera,
// "Jadikan Temuan" inline untuk butir Tidak Sesuai. Jawaban disimpan otomatis ke server (draf) dan ke
// perangkat (useFormDraft); kirim = satu aksi (RPC inspection_submit membuat temuan).
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, CircleCheck, Loader2, Send, X } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DraftBanner } from "@/components/form/draft-banner";
import { DatePicker } from "@/components/form/date-picker";
import { SearchableSelect, type SelectOption } from "@/components/form/searchable-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { BUCKET_LAMPIRAN } from "@/lib/app-config";
import { compressImage, safeStorageName } from "@/lib/attachments";
import type { InspectionDetail } from "@/lib/inspeksi";
import { ANSWERS, type Answer } from "@/lib/inspeksi-rules";
import { useFormDraft } from "@/lib/offline/use-form-draft";
import { useOnline } from "@/lib/offline/use-online";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { saveAnswersAction, submitInspectionAction } from "../actions";

type ItemState = {
  answer: Answer | "";
  comment: string;
  photos: string[];
  finding: { on: boolean; description: string; risk: string; pic: string | null; due: string | null };
};
type State = Record<number, ItemState>;
type SubmitResult = { summary: { compliant: number; noncompliant: number; na: number; findings: number }; findingCodes: string[] };

const addDays = (iso: string, n: number) => new Date(Date.parse(iso) + n * 86_400_000).toISOString().slice(0, 10);

export function ChecklistEditor({
  doc,
  riskOptions,
  people,
  userId,
  today,
  canCreateFindings,
}: {
  doc: InspectionDetail;
  riskOptions: SelectOption[];
  people: SelectOption[];
  userId: string;
  today: string;
  canCreateFindings: boolean;
}) {
  const router = useRouter();
  const online = useOnline();
  const defaultRisk = riskOptions.find((r) => r.value === "high")?.value ?? riskOptions[0]?.value ?? "";
  const initial = useMemo<State>(
    () =>
      Object.fromEntries(
        doc.answers.map((a) => [
          a.lineNo,
          {
            answer: a.answer ?? "",
            comment: a.comment ?? "",
            photos: a.photos,
            finding: { on: a.answer === "noncompliant" && canCreateFindings, description: "", risk: defaultRisk, pic: userId, due: addDays(today, 7) },
          } satisfies ItemState,
        ]),
      ),
    [doc.answers, defaultRisk, userId, today, canCreateFindings],
  );
  const [items, setItems] = useState<State>(initial);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState<number | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const cameraFor = useRef<number | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const total = doc.answers.length;
  const answered = Object.values(items).filter((i) => i.answer).length;
  const counts = {
    compliant: Object.values(items).filter((i) => i.answer === "compliant").length,
    noncompliant: Object.values(items).filter((i) => i.answer === "noncompliant").length,
    na: Object.values(items).filter((i) => i.answer === "na").length,
  };

  // payload yang dikirim ke server (tanpa isian temuan, itu hanya saat kirim)
  const answersPayload = (s: State) =>
    doc.answers.map((a) => ({ line_no: a.lineNo, answer: s[a.lineNo]?.answer ?? "", comment: s[a.lineNo]?.comment ?? "", photos: s[a.lineNo]?.photos ?? [] }));
  const draftValues = useMemo(() => answersPayload(items), [items]); // eslint-disable-line react-hooks/exhaustive-deps
  const draft = useFormDraft({ key: `inspeksi:${doc.id}`, userId, values: draftValues, isEmpty: (v) => v.every((x) => !x.answer && !x.comment && x.photos.length === 0) });

  // simpan otomatis ke server (debounce); hanya bila ada jawaban/komentar/foto
  const json = JSON.stringify(draftValues);
  const serverSaved = useRef(JSON.stringify(answersPayload(initial)));
  useEffect(() => {
    if (!online || json === serverSaved.current) return;
    const t = window.setTimeout(async () => {
      setSaving(true);
      const res = await saveAnswersAction(doc.id, JSON.parse(json));
      setSaving(false);
      if (res.status === "ok") {
        serverSaved.current = json;
        setSavedAt(Date.now());
      }
    }, 1200);
    return () => window.clearTimeout(t);
  }, [json, online, doc.id]);

  const patch = (line: number, p: Partial<ItemState>) => setItems((s) => ({ ...s, [line]: { ...s[line], ...p } }));
  const setAnswer = (line: number, answer: Answer) =>
    setItems((s) => ({ ...s, [line]: { ...s[line], answer, finding: { ...s[line].finding, on: answer === "noncompliant" && canCreateFindings } } }));
  const patchFinding = (line: number, p: Partial<ItemState["finding"]>) => setItems((s) => ({ ...s, [line]: { ...s[line], finding: { ...s[line].finding, ...p } } }));

  const pickPhoto = async (files: File[]) => {
    const line = cameraFor.current;
    if (line === null || !files.length) return;
    setUploading(line);
    const supabase = createClient();
    const added: string[] = [];
    for (const f of files.slice(0, 5 - items[line].photos.length)) {
      const file = await compressImage(f);
      const path = `inspeksi/${doc.id}/${safeStorageName(file.name)}`;
      const { error } = await supabase.storage.from(BUCKET_LAMPIRAN).upload(path, file, { contentType: file.type || undefined });
      if (error) toast.error(`Gagal mengunggah ${f.name}`, { description: error.message });
      else added.push(path);
    }
    setItems((s) => ({ ...s, [line]: { ...s[line], photos: [...s[line].photos, ...added] } }));
    setUploading(null);
  };

  const findingsPayload = () =>
    doc.answers
      .filter((a) => items[a.lineNo]?.answer === "noncompliant" && items[a.lineNo].finding.on)
      .map((a) => {
        const f = items[a.lineNo].finding;
        return { line_no: a.lineNo, description: f.description, risk_level: f.risk, pic_id: f.pic ?? "", due_date: f.due ?? "" };
      });
  const findingsInvalid = findingsPayload().some((f) => !f.risk_level || !f.pic_id || !f.due_date);

  const send = async () => {
    setSending(true);
    const res = await submitInspectionAction(doc.id, answersPayload(items), findingsPayload());
    setSending(false);
    if (res.status === "ok") {
      draft.clear();
      setResult({ summary: res.data!.summary as SubmitResult["summary"], findingCodes: (res.data!.findingCodes as string[]) ?? [] });
      window.scrollTo({ top: 0 });
      router.refresh();
    } else toast.error(res.message);
  };

  if (result)
    return (
      <section className="mx-auto flex max-w-lg flex-col items-center gap-3 py-8 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400">
          <CircleCheck className="size-9" />
        </span>
        <p className="font-mono text-sm text-muted-foreground">{doc.code}</p>
        <h2 className="text-2xl font-semibold">Inspeksi berhasil dikirim</h2>
        <p className="text-sm text-muted-foreground">Hasil tercatat dan HSE diberi tahu untuk verifikasi.</p>
        <div className="grid w-full grid-cols-3 gap-2">
          {[
            ["Sesuai", result.summary.compliant, ""],
            ["Tidak Sesuai", result.summary.noncompliant, "text-red-600 dark:text-red-400"],
            ["N/A", result.summary.na, ""],
          ].map(([l, n, c]) => (
            <div key={String(l)} className="rounded-lg border p-3">
              <strong className={cn("block text-2xl tabular-nums", String(c))}>{n}</strong>
              <span className="text-xs text-muted-foreground">{l}</span>
            </div>
          ))}
        </div>
        {result.findingCodes.length > 0 && (
          <p className="w-full rounded-lg border bg-muted/40 p-3 text-sm">
            <strong>{result.findingCodes.length} temuan dibuat</strong>
            <span className="mt-0.5 block font-mono text-xs text-muted-foreground">{result.findingCodes.join(" · ")}</span>
          </p>
        )}
      </section>
    );

  return (
    <div className="space-y-4">
      <DraftBanner
        draft={draft.pending}
        onRestore={() => {
          const d = draft.restore();
          if (d)
            setItems((s) => {
              const next = { ...s };
              for (const x of d.values) if (next[x.line_no]) next[x.line_no] = { ...next[x.line_no], answer: x.answer as Answer | "", comment: x.comment, photos: x.photos };
              return next;
            });
        }}
        onDiscard={draft.discard}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          void pickPhoto(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />

      <div className="sticky top-14 z-20 -mx-1 rounded-xl border bg-background/95 p-3 backdrop-blur md:top-16">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="font-medium">Progres checklist</span>
          <strong className="tabular-nums">
            {answered}/{total} butir
          </strong>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={answered} aria-valuemax={total} aria-label="Progres checklist">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${total ? (answered / total) * 100 : 0}%` }} />
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          {saving ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
          {saving ? "Menyimpan…" : savedAt ? "Draf tersimpan otomatis" : online ? "Draf tersimpan otomatis saat Anda mengisi" : "Offline: draf tersimpan di perangkat ini"}
        </p>
      </div>

      <ol className="space-y-3">
        {doc.answers.map((a) => {
          const it = items[a.lineNo];
          const nc = it.answer === "noncompliant";
          return (
            <li key={a.lineNo} id={`butir-${a.lineNo}`} className={cn("rounded-xl border bg-card p-3", nc && "border-red-300 dark:border-red-900")}>
              <div className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">{a.lineNo}</span>
                <p className="min-w-0 flex-1 text-sm leading-snug">{a.itemText}</p>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label={`Jawaban butir ${a.lineNo}`}>
                {ANSWERS.map((o) => {
                  const on = it.answer === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setAnswer(a.lineNo, o.value)}
                      className={cn(
                        "flex min-h-11 items-center justify-center gap-1 rounded-lg border px-2 text-sm font-medium transition-colors",
                        on && o.value === "compliant" && "border-green-600 bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-300",
                        on && o.value === "noncompliant" && "border-red-600 bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300",
                        on && o.value === "na" && "border-muted-foreground bg-muted",
                        !on && "hover:bg-accent",
                      )}
                    >
                      {on && o.value === "compliant" && <Check className="size-4" />}
                      {on && o.value === "noncompliant" && <X className="size-4" />}
                      {o.label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex gap-2">
                <Input value={it.comment} maxLength={1000} placeholder="Komentar (opsional)" aria-label={`Komentar butir ${a.lineNo}`} onChange={(e) => patch(a.lineNo, { comment: e.target.value })} className="h-11 text-base md:h-9 md:text-sm" />
                <Button
                  type="button"
                  variant={it.photos.length ? "secondary" : "outline"}
                  className="h-11 shrink-0 md:h-9"
                  disabled={uploading !== null || it.photos.length >= 5 || !online}
                  onClick={() => {
                    cameraFor.current = a.lineNo;
                    cameraRef.current?.click();
                  }}
                  aria-label={`Ambil foto butir ${a.lineNo}`}
                >
                  {uploading === a.lineNo ? <Loader2 className="animate-spin" /> : it.photos.length ? <Check /> : <Camera />}
                  {it.photos.length ? `${it.photos.length} foto` : "Foto"}
                </Button>
              </div>

              {nc && (
                <div className="mt-3 space-y-3 rounded-lg border bg-muted/30 p-3">
                  <label className="flex items-start gap-3">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">Jadikan Temuan</span>
                      <span className="block text-xs text-muted-foreground">{canCreateFindings ? "Buat tindak lanjut dari butir yang tidak sesuai." : "Hanya HSE, Pengawas, atau PJO yang bisa membuat temuan."}</span>
                    </span>
                    <Switch checked={it.finding.on} disabled={!canCreateFindings} onCheckedChange={(c) => patchFinding(a.lineNo, { on: c })} aria-label="Jadikan temuan" />
                  </label>
                  {it.finding.on && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <Textarea
                          rows={2}
                          maxLength={4000}
                          value={it.finding.description}
                          aria-label="Uraian temuan"
                          placeholder={`Ketidaksesuaian pada ${doc.objectText ?? doc.title}: ${a.itemText}`}
                          onChange={(e) => patchFinding(a.lineNo, { description: e.target.value })}
                          className="text-base md:text-sm"
                        />
                      </div>
                      <SearchableSelect value={it.finding.risk || null} onValueChange={(x) => patchFinding(a.lineNo, { risk: x ?? "" })} options={riskOptions} placeholder="Prioritas" />
                      <SearchableSelect value={it.finding.pic} onValueChange={(x) => patchFinding(a.lineNo, { pic: x })} options={people} placeholder="PIC" />
                      <DatePicker value={it.finding.due} onValueChange={(d) => patchFinding(a.lineNo, { due: d })} min={today} />
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 -mx-4 flex items-center justify-between gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur md:bottom-0 md:mx-0 md:rounded-xl md:border">
        <span className="text-xs text-muted-foreground">
          {counts.compliant} sesuai · <strong className={counts.noncompliant ? "text-red-600 dark:text-red-400" : undefined}>{counts.noncompliant} tidak sesuai</strong> · {counts.na} N/A
        </span>
        <ConfirmDialog
          title={`Kirim ${doc.code}?`}
          description={`${counts.noncompliant} butir tidak sesuai, ${findingsPayload().length} akan dibuat sebagai temuan. Setelah dikirim, checklist tidak bisa diubah.`}
          confirmText="Kirim Inspeksi"
          onConfirm={send}
          trigger={
            <Button
              type="button"
              className="h-11 md:h-9"
              disabled={sending || !online || answered < total || findingsInvalid}
              title={answered < total ? `Masih ${total - answered} butir belum dijawab` : findingsInvalid ? "Lengkapi prioritas, PIC, dan due date temuan" : undefined}
            >
              <Send /> Selesai & Kirim
            </Button>
          }
        />
      </div>
    </div>
  );
}
