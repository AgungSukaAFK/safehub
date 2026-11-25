"use client";

// Wizard Impor Data (rancangan §2.12), 4 langkah: unggah → pemetaan kolom → pratinjau & validasi → hasil.
// File dibaca server; validasi bentuk jalan juga di browser (kode sama), commit memvalidasi ulang di server.
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Download, Loader2, Upload } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { autoMap, IMPORT_TARGET_LIST, IMPORT_TARGETS, validateRows, type ImportGroup, type ImportMode, type ImportTargetId } from "@/lib/import/targets";
import { useOnline } from "@/lib/offline/use-online";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { commitImportAction, parseImportFileAction, type CommitResult } from "./actions";

const STEPS = ["Unggah File", "Pemetaan Kolom", "Pratinjau & Validasi", "Hasil"] as const;
const AFTER_LINK: Record<ImportTargetId, { href: string; label: string }> = {
  employees: { href: "/manpower", label: "Buka Manpower" },
  certificates: { href: "/kompetensi", label: "Buka Matriks Kompetensi" },
  mcu: { href: "/mcu", label: "Buka MCU" },
  site_permits: { href: "/manpower", label: "Buka Manpower" },
  mnt_units: { href: "/maintenance?tab=unit", label: "Buka Maintenance" },
  mnt_downtime: { href: "/maintenance?tab=downtime", label: "Buka Maintenance" },
  mnt_ps: { href: "/maintenance?tab=ps", label: "Buka Maintenance" },
  mnt_backlog: { href: "/maintenance?tab=backlog", label: "Buka Maintenance" },
  mnt_lib: { href: "/maintenance?tab=lib", label: "Buka Readiness LIB" },
  mnt_scrap: { href: "/maintenance?tab=scrap", label: "Buka Metal Scrap" },
  tsp_realizations: { href: "/tsp", label: "Buka TSP" },
};
const selectCls = "h-9 w-full rounded-md border bg-background px-2 text-sm";

const GROUP_LABEL: Record<ImportGroup, string> = { people: "People & Compliance", maintenance: "Maintenance (cermin sistem maintenance, hanya baca di Safe Hub)", tsp: "TSP & Aktivitas" };

export function ImportWizard({ sites, defaultSite, groups }: { sites: { id: string; name: string }[]; defaultSite: string | null; groups: ImportGroup[] }) {
  const online = useOnline();
  const [step, setStep] = useState(0);
  const allowed = IMPORT_TARGET_LIST.filter((t) => groups.includes(t.group));
  const [targetId, setTargetId] = useState<ImportTargetId>(allowed[0]?.id ?? "employees");
  const [mode, setMode] = useState<ImportMode>("insert");
  const [siteId, setSiteId] = useState<string>(defaultSite ?? sites[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<{ filename: string; headers: string[]; rows: string[][]; truncated: boolean } | null>(null);
  const [mapping, setMapping] = useState<Record<string, number | null>>({});
  const [result, setResult] = useState<CommitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const target = IMPORT_TARGETS[targetId];

  const checked = useMemo(() => (parsed ? validateRows(target, parsed.rows, mapping) : []), [parsed, target, mapping]);
  const valid = checked.filter((r) => r.d);
  const invalid = checked.filter((r) => !r.d);
  const requiredMissing = target.columns.filter((c) => c.required && (mapping[c.key] === null || mapping[c.key] === undefined));

  const readFile = () =>
    start(async () => {
      setError(null);
      if (!file) return setError("Pilih file Excel (.xlsx) dulu.");
      const fd = new FormData();
      fd.set("file", file);
      const res = await parseImportFileAction(fd);
      if (res.status !== "ok") return setError(res.message);
      setParsed({ filename: res.filename, headers: res.sheet.headers, rows: res.sheet.rows, truncated: res.sheet.truncated });
      setMapping(autoMap(target, res.sheet.headers));
      setStep(1);
    });

  const commit = async () => {
    if (!parsed) return;
    const res = await commitImportAction(targetId, mode, parsed.filename, target.needsSite ? siteId : null, parsed.rows, mapping);
    if (res.status !== "ok" || !res.result) {
      toast.error(res.message ?? "Impor gagal.");
      throw new Error(res.message);
    }
    setResult(res.result);
    setStep(3);
  };

  const reset = () => {
    setStep(0);
    setFile(null);
    setParsed(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="space-y-4">
      <ol className="flex flex-wrap gap-2" aria-label="Langkah impor">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined} className={cn("flex items-center gap-2 rounded-full border px-3 py-1 text-xs", i === step ? "border-primary bg-primary/5 font-medium text-primary" : i < step ? "text-foreground" : "text-muted-foreground")}>
            <span className={cn("grid size-5 place-items-center rounded-full border text-[11px]", i < step && "bg-primary text-primary-foreground")}>{i < step ? "✓" : i + 1}</span>
            {s}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <section className="space-y-4 rounded-xl border bg-card p-4">
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium">Data yang diimpor</legend>
            {allowed.map((t, i) => (
              <label key={t.id} className={cn("flex cursor-pointer gap-3 rounded-lg border p-3 text-sm", targetId === t.id && "border-primary bg-primary/5")}>
                <input type="radio" name="target" checked={targetId === t.id} onChange={() => setTargetId(t.id)} className="mt-1" />
                <span>
                  {(i === 0 || allowed[i - 1].group !== t.group) && groups.length > 1 && <small className="mb-0.5 block text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{GROUP_LABEL[t.group]}</small>}
                  <strong className="block font-medium">{t.label}</strong>
                  <small className="text-xs text-muted-foreground">{t.description}</small>
                </span>
              </label>
            ))}
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium">Mode</legend>
            {([["insert", "Tambah baru", "Baris yang sudah ada (kunci sama) ditolak."], ["upsert", "Perbarui jika sudah ada", "Baris dengan kunci sama diperbarui; yang belum ada ditambahkan."]] as const).map(([v, l, d]) => (
              <label key={v} className={cn("flex cursor-pointer gap-3 rounded-lg border p-3 text-sm", mode === v && "border-primary bg-primary/5")}>
                <input type="radio" name="mode" checked={mode === v} onChange={() => setMode(v)} className="mt-1" />
                <span><strong className="block font-medium">{l}</strong><small className="text-xs text-muted-foreground">{d}</small></span>
              </label>
            ))}
          </fieldset>
          {target.needsSite && (
            <div className="space-y-1">
              <label htmlFor="imp-site" className="text-sm font-medium">Site tujuan</label>
              <select id="imp-site" value={siteId} onChange={(e) => setSiteId(e.target.value)} className={selectCls}>
                {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          <div className="space-y-2">
            <label htmlFor="imp-file" className="text-sm font-medium">File Excel (.xlsx, maks. 5 MB, maks. 1000 baris)</label>
            <input id="imp-file" type="file" accept=".xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-background file:px-3 file:py-1.5 file:text-sm" />
            <a href={`/impor/template?target=${targetId}`} className="inline-flex items-center gap-1 text-sm underline underline-offset-2"><Download className="size-4" aria-hidden /> Unduh template {target.label}</a>
          </div>
          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <Button onClick={readFile} disabled={pending || !online || !file || (target.needsSite && !siteId)}>
            {pending ? <Loader2 className="animate-spin" /> : <Upload />} Baca File
          </Button>
        </section>
      )}

      {step === 1 && parsed && (
        <section className="space-y-4 rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">{parsed.filename} · {parsed.rows.length} baris data{parsed.truncated ? " (dipotong di 1000 baris pertama)" : ""}. Cocokkan kolom file dengan kolom {target.label}.</p>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground"><tr>{["Kolom aplikasi", "Kolom di file", "Contoh isi"].map((h) => <th key={h} scope="col" className="px-3 py-2 text-left font-medium">{h}</th>)}</tr></thead>
              <tbody>
                {target.columns.map((c) => {
                  const idx = mapping[c.key];
                  return (
                    <tr key={c.key} className="border-t align-top">
                      <td className="px-3 py-2"><strong className="font-medium">{c.label}</strong>{c.required && <span className="ml-1 text-red-600 dark:text-red-400" title="Wajib">*</span>}{c.hint && <small className="block text-xs text-muted-foreground">{c.hint}</small>}</td>
                      <td className="px-3 py-2">
                        <select aria-label={`Kolom file untuk ${c.label}`} value={idx ?? ""} onChange={(e) => setMapping((m) => ({ ...m, [c.key]: e.target.value === "" ? null : Number(e.target.value) }))} className={selectCls}>
                          <option value="">— tidak diisi —</option>
                          {parsed.headers.map((h, i) => <option key={i} value={i}>{h}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{idx !== null && idx !== undefined ? (parsed.rows[0]?.[idx] || "(kosong)") : "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {requiredMissing.length > 0 && <p role="alert" className="text-sm text-amber-700 dark:text-amber-400">Kolom wajib belum dipetakan: {requiredMissing.map((c) => c.label).join(", ")}.</p>}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(0)}>Kembali</Button>
            <Button onClick={() => setStep(2)} disabled={requiredMissing.length > 0}>Lanjut ke Pratinjau</Button>
          </div>
        </section>
      )}

      {step === 2 && parsed && (
        <section className="space-y-4 rounded-xl border bg-card p-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg border p-3"><strong className="block text-2xl tabular-nums">{checked.length}</strong><small className="text-xs text-muted-foreground">Total baris</small></div>
            <div className="rounded-lg border p-3"><strong className="block text-2xl tabular-nums text-green-700 dark:text-green-400">{valid.length}</strong><small className="text-xs text-muted-foreground">Valid</small></div>
            <div className={cn("rounded-lg border p-3", invalid.length > 0 && "border-red-300 dark:border-red-900")}><strong className="block text-2xl tabular-nums text-red-700 dark:text-red-400">{invalid.length}</strong><small className="text-xs text-muted-foreground">Bermasalah (dilewati)</small></div>
          </div>
          {invalid.length > 0 && (
            <div>
              <h3 className="mb-1 flex items-center gap-1.5 text-sm font-medium"><AlertTriangle className="size-4 text-red-600" aria-hidden /> Baris bermasalah</h3>
              <ul className="max-h-64 divide-y overflow-y-auto rounded-lg border text-sm">
                {invalid.slice(0, 100).map((r) => (
                  <li key={r.n} className="px-3 py-2"><strong className="tabular-nums">Baris {r.n}</strong>: {r.errors.join("; ")}</li>
                ))}
              </ul>
              {invalid.length > 100 && <p className="mt-1 text-xs text-muted-foreground">Menampilkan 100 dari {invalid.length} baris bermasalah.</p>}
            </div>
          )}
          {valid.length > 0 && (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground"><tr><th scope="col" className="px-3 py-2 text-left font-medium">Baris</th>{target.columns.map((c) => <th key={c.key} scope="col" className="px-3 py-2 text-left font-medium">{c.label}</th>)}</tr></thead>
                <tbody>
                  {valid.slice(0, 10).map((r) => (
                    <tr key={r.n} className="border-t"><td className="px-3 py-2 tabular-nums">{r.n}</td>{target.columns.map((c) => <td key={c.key} className="px-3 py-2">{r.d?.[c.key] || <span className="text-muted-foreground">-</span>}</td>)}</tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t px-3 py-1.5 text-xs text-muted-foreground">Pratinjau 10 baris valid pertama.</p>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Mode: <strong>{mode === "insert" ? "Tambah baru" : "Perbarui jika sudah ada"}</strong>. Aturan data (mis. NIK dikenal, mitra ada, MCU tidak di masa depan) diperiksa lagi per baris saat impor; baris yang ditolak dilaporkan di hasil.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setStep(1)}>Kembali</Button>
            <ConfirmDialog
              title={`Impor ${valid.length} baris?`}
              description={`${invalid.length > 0 ? `${invalid.length} baris bermasalah dilewati. ` : ""}Data langsung masuk ke ${target.label}. Perubahan bisa dilihat di Riwayat Perubahan masing-masing data.`}
              confirmText="Impor Sekarang"
              onConfirm={commit}
              trigger={<Button disabled={valid.length === 0 || !online}>Impor {valid.length} Baris Valid</Button>}
            />
          </div>
        </section>
      )}

      {step === 3 && result && (
        <section className="space-y-4 rounded-xl border bg-card p-4">
          <p className="flex items-center gap-2 text-base font-medium">
            <CheckCircle2 className="size-5 text-green-600" aria-hidden /> Impor selesai: {result.ok} dari {result.total} baris berhasil.
          </p>
          {result.failed > 0 && (
            <div>
              <h3 className="mb-1 text-sm font-medium">{result.failed} baris tidak masuk</h3>
              <ul className="max-h-64 divide-y overflow-y-auto rounded-lg border text-sm">
                {result.errors.map((e, i) => <li key={i} className="px-3 py-2"><strong className="tabular-nums">Baris {e.row}</strong>: {e.message}</li>)}
              </ul>
              <p className="mt-1 text-xs text-muted-foreground">Baris yang gagal validasi bentuk di langkah 3 tidak dicantumkan di sini. Perbaiki di file, lalu impor ulang (mode Perbarui aman dipakai).</p>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Link href={AFTER_LINK[targetId].href} className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">{AFTER_LINK[targetId].label}</Link>
            <Button variant="outline" onClick={reset}>Impor Lagi</Button>
          </div>
        </section>
      )}
    </div>
  );
}
