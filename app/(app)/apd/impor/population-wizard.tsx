"use client";

// Impor karyawan dari sheet Populasi Manpower (boleh diulang): file → ringkasan → petakan site → impor.
// Karyawan dicocokkan nama + site (tidak dobel); yang baru diberi NIK sementara APD-NNNN. Riwayat lama tertaut otomatis.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FileDropzone } from "@/components/form/file-dropzone";
import { Content } from "@/components/list/content";
import { Button } from "@/components/ui/button";
import type { ApdPopulationSummary } from "@/lib/apd-excel";
import { formatNumber } from "@/lib/format";
import { toast } from "@/lib/toast";
import { commitApdPopulationAction, previewApdPopulationAction } from "../actions";
import { suggestLocation } from "./import-wizard";

export function ApdPopulationWizard({ locations }: { locations: { id: string; name: string }[] }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<ApdPopulationSummary | null>(null);
  const [sites, setSites] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const missing = summary ? summary.sites.filter((s) => !sites[s]) : [];

  const pick = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setBusy(true);
    setResult(null);
    const fd = new FormData();
    fd.set("file", f);
    const res = await previewApdPopulationAction(fd);
    setBusy(false);
    if (res.status === "error") return void toast.error(res.message);
    setFile(f);
    setSummary(res.summary);
    setSites(Object.fromEntries(res.summary.sites.map((s) => [s, suggestLocation(s, locations)])));
  };

  const commit = async () => {
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    fd.set("sites", JSON.stringify(sites));
    fd.set("company", "GMI");
    const res = await commitApdPopulationAction(fd);
    if (res.status !== "ok") {
      toast.error(res.message ?? "Impor gagal.");
      throw new Error(res.message);
    }
    toast.success("Data karyawan APD diimpor.");
    setResult(res.message ?? null);
    router.refresh();
  };

  return (
    <Content
      title="Data Karyawan APD (sheet Populasi Manpower)"
      description="Karyawan, ukuran APD, dan tanggal terakhir menerima tiap jenis APD. Boleh diulang dengan file yang lebih baru: karyawan dicocokkan nama + site, riwayat yang sama tidak dobel."
    >
      <div className="space-y-4">
        <FileDropzone accept=".xlsx" loading={busy} onFiles={pick} hint={file ? `Terbaca: ${file.name}` : "File Monitoring APD (.xlsx), maks. 1,5 MB"} />
        {result && <p role="status" className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-900 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200">{result}</p>}
        {summary && (
          <>
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              {[
                ["Karyawan", formatNumber(summary.people)],
                ["Ukuran APD", formatNumber(summary.sizes)],
                ["Riwayat terima", formatNumber(summary.issues)],
                ["Per site", Object.entries(summary.bySite).map(([s, n]) => `${s} ${n}`).join(", ")],
              ].map(([k, v]) => (
                <div key={k} className={k === "Per site" ? "col-span-2 sm:col-span-4" : undefined}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>
              ))}
            </dl>
            {summary.notes.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground">{summary.notes.length} catatan</summary>
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-muted-foreground">{summary.notes.map((n) => <li key={n}>{n}</li>)}</ul>
              </details>
            )}
            <p className="text-xs text-muted-foreground">
              Karyawan yang belum ada dibuat dengan <strong>NIK sementara APD-NNNN</strong> (ganti dengan NRP asli di Manpower kapan saja). Kolom Duedate/Warn Days Excel tidak dibaca:
              jatuh tempo dihitung ulang dari masa periodik Matrix APD.
            </p>
            <ul className="divide-y rounded-lg border">
              {summary.sites.map((s) => (
                <li key={s} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <label htmlFor={`pop-site-${s}`} className="font-mono font-semibold">{s} <span className="font-sans font-normal text-muted-foreground">({summary.bySite[s]} karyawan)</span></label>
                  <select id={`pop-site-${s}`} value={sites[s] ?? ""} onChange={(e) => setSites((m) => ({ ...m, [s]: e.target.value }))} className="h-9 w-72 max-w-full rounded-md border bg-background px-2 text-sm">
                    <option value="">Pilih lokasi</option>
                    {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </li>
              ))}
            </ul>
            {missing.length > 0 && <p role="alert" className="text-sm text-amber-700 dark:text-amber-400">Belum dipetakan: {missing.join(", ")}. Buat lokasinya dulu di konsol platform bila belum ada.</p>}
            <ConfirmDialog
              title="Impor data karyawan APD?"
              description="Karyawan baru dibuat, yang sudah ada diperbarui ukurannya, riwayat terima ditambahkan, lalu data pengiriman/pengajuan lama ditautkan otomatis."
              confirmText="Impor"
              confirmDisabled={missing.length > 0}
              onConfirm={commit}
              trigger={<Button disabled={missing.length > 0}><UserPlus /> Impor Karyawan</Button>}
            />
          </>
        )}
      </div>
    </Content>
  );
}
