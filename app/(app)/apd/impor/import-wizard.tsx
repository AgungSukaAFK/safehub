"use client";

// Wizard impor data lama APD: 1) pilih file → ringkasan; 2) petakan kode site → lokasi; 3) impor (sekali).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FileDropzone } from "@/components/form/file-dropzone";
import { Content } from "@/components/list/content";
import { Button } from "@/components/ui/button";
import type { ApdImportSummary } from "@/lib/apd-excel";
import { formatNumber } from "@/lib/format";
import { toast } from "@/lib/toast";
import { commitApdImportAction, previewApdImportAction } from "../actions";

const LOCATION_HINT: Record<string, string> = { HO: "Gudang APD pusat + karyawan Head Office" };
const SUGGEST_HO = "HEAD OFFICE (KM 8A)";

/** Saran awal: nama lokasi persis (HO) atau satu-satunya lokasi yang memuat kode site sebagai kata. Admin tetap memeriksa. */
export function suggestLocation(code: string, locations: { id: string; name: string }[]): string {
  if (code === "HO") return locations.find((l) => l.name === SUGGEST_HO)?.id ?? "";
  const hits = locations.filter((l) => new RegExp(`\\b${code}\\b`, "i").test(l.name));
  return hits.length === 1 ? hits[0].id : "";
}

export function ApdImportWizard({ locations }: { locations: { id: string; name: string }[] }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<ApdImportSummary | null>(null);
  const [sites, setSites] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const missing = summary ? summary.sites.filter((s) => !sites[s]) : [];

  const pick = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setBusy(true);
    const fd = new FormData();
    fd.set("file", f);
    const res = await previewApdImportAction(fd);
    setBusy(false);
    if (res.status === "error") {
      toast.error(res.message);
      return;
    }
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
    const res = await commitApdImportAction(fd);
    if (res.status !== "ok") {
      toast.error(res.message ?? "Impor gagal.");
      throw new Error(res.message);
    }
    toast.success(res.message ?? "Impor selesai.");
    router.push("/apd?tab=stok");
    router.refresh();
  };

  return (
    <>
      <Content title="1. Pilih file" description="Workbook Monitoring APD (.xlsx) dengan sheet Master Barang APD, Update Stock, IN, OUT, dan MTR MR. Sheet Populasi Manpower tidak dibaca.">
        <FileDropzone accept=".xlsx" loading={busy} onFiles={pick} hint={file ? `Terbaca: ${file.name}` : "Maks. 1,5 MB"} />
      </Content>

      {summary && (
        <>
          <Content title="2. Ringkasan isi file">
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              {[
                ["Barang", `${summary.items} kode`],
                ["Stok awal (SO)", `${summary.opening} barang · ${formatNumber(summary.openingUnits)} unit`],
                ["Barang masuk", `${summary.ins} baris · ${formatNumber(summary.inUnits)} unit`],
                ["Pengiriman", `${summary.outs} baris · ${formatNumber(summary.outUnits)} unit`],
                ["Pengajuan data lama", `${summary.requests} dari ${summary.mrRows} baris MR`],
                ["Site", summary.sites.join(", ")],
              ].map(([k, v]) => (
                <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>
              ))}
            </dl>
            {summary.notes.length > 0 && (
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-muted-foreground">{summary.notes.length} catatan pembersihan data</summary>
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-muted-foreground">{summary.notes.map((n) => <li key={n}>{n}</li>)}</ul>
              </details>
            )}
            <p className="mt-3 text-xs text-muted-foreground">Stok awal bertanggal 1 Oktober 2026. Barang yang kodenya sudah ada tidak ditimpa. Karyawan belum ditautkan ke Manpower (menunggu daftar NRP).</p>
          </Content>

          <Content
            title="3. Petakan site ke lokasi"
            description="Pilih lokasi yang sesuai untuk tiap kode site di Excel. Lokasi yang belum ada dibuat dulu di konsol platform (Pengguna & lokasi), lalu muat ulang halaman ini."
          >
            <ul className="divide-y rounded-lg border">
              {summary.sites.map((s) => (
                <li key={s} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <label htmlFor={`site-${s}`} className="min-w-0">
                    <strong className="font-mono">{s}</strong>
                    {LOCATION_HINT[s] && <small className="block text-xs text-muted-foreground">{LOCATION_HINT[s]}</small>}
                  </label>
                  <select id={`site-${s}`} value={sites[s] ?? ""} onChange={(e) => setSites((m) => ({ ...m, [s]: e.target.value }))} className="h-9 w-72 max-w-full rounded-md border bg-background px-2 text-sm">
                    <option value="">Pilih lokasi</option>
                    {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </li>
              ))}
            </ul>
            {missing.length > 0 && <p role="alert" className="mt-2 text-sm text-amber-700 dark:text-amber-400">Belum dipetakan: {missing.join(", ")}.</p>}
          </Content>

          <div className="col-span-12">
            <ConfirmDialog
              title="Impor data lama APD?"
              description="Semua data ditulis dalam satu transaksi dan hanya bisa dilakukan sekali. Pastikan pemetaan site sudah benar."
              confirmText="Impor"
              confirmDisabled={missing.length > 0}
              onConfirm={commit}
              trigger={<Button disabled={missing.length > 0}>{busy ? <Loader2 className="animate-spin" /> : <Upload />} Impor Sekarang</Button>}
            />
          </div>
        </>
      )}
    </>
  );
}
