"use client";

// Matriks monitoring TSP: program x 12 bulan. Sel = aktual/rencana (teks + ikon, bukan warna saja).
// Klik sel → Sheet realisasi (aktual, catatan, bukti). Elemen bisa dilipat. Bulan yang belum berjalan terkunci.
import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, FileWarning, Loader2, Pencil } from "lucide-react";
import { Field } from "@/components/form-bits";
import { FileDropzone } from "@/components/form/file-dropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { BUCKET_LAMPIRAN } from "@/lib/app-config";
import { compressImage, safeStorageName } from "@/lib/attachments";
import { useOnline } from "@/lib/offline/use-online";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";
import type { TspRow } from "@/lib/tsp";
import { CELL_STATE_LABEL, MONTHS_LONG, MONTHS_SHORT, cellState, type CellState } from "@/lib/tsp-rules";
import { cn } from "@/lib/utils";
import { saveRealizationAction } from "./actions";
import { ProgramSheet, type ProgramSheetSite } from "./program-sheet";

const CELL_CLASS: Record<CellState, string> = {
  future: "border-dashed text-muted-foreground/60",
  empty: "text-muted-foreground/60",
  met: "border-green-300 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/50 dark:text-green-300",
  partial: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300",
  missed: "border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300",
};

export function TspMatrix({
  rows,
  year,
  currentMonth,
  limitMonth,
  canRecord,
  canManage,
  sites,
}: {
  rows: TspRow[];
  year: number;
  /** bulan WIB sekarang bila tahun ini; 12 untuk tahun lampau; 0 untuk tahun depan */
  currentMonth: number;
  /** bulan acuan capaian (kolom Capaian % = s.d. bulan ini) */
  limitMonth: number;
  canRecord: boolean;
  canManage: boolean;
  sites: ProgramSheetSite[];
}) {
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [open, setOpen] = useState<{ row: TspRow; month: number } | null>(null);
  const elements = [...new Set(rows.map((r) => r.element))];

  if (rows.length === 0) {
    return <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Belum ada program TSP untuk filter ini.</p>;
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[1280px] text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="sticky left-0 z-10 w-14 bg-muted/40 px-2 py-2 text-left font-medium">No</th>
              <th scope="col" className="sticky left-14 z-10 min-w-56 bg-muted/40 px-2 py-2 text-left font-medium">Program</th>
              <th scope="col" className="px-2 py-2 text-left font-medium">PJ</th>
              <th scope="col" className="min-w-48 px-2 py-2 text-left font-medium">Indikator &amp; bukti wajib</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">Target</th>
              {MONTHS_SHORT.map((m) => (
                <th key={m} scope="col" className="px-1 py-2 text-center font-medium">{m}</th>
              ))}
              <th scope="col" className="px-2 py-2 text-right font-medium">Total</th>
              <th scope="col" className="px-2 py-2 text-left font-medium">Capaian</th>
              {canManage && <th scope="col" className="w-10 px-1"><span className="sr-only">Ubah</span></th>}
            </tr>
          </thead>
          <tbody>
            {elements.map((el) => {
              const group = rows.filter((r) => r.element === el);
              const isCollapsed = collapsed.includes(el);
              return (
                <Fragment key={el}>
                  <tr className="border-t bg-muted/20">
                    <td colSpan={canManage ? 20 : 19} className="p-0">
                      <button
                        type="button"
                        aria-expanded={!isCollapsed}
                        onClick={() => setCollapsed((c) => (c.includes(el) ? c.filter((x) => x !== el) : [...c, el]))}
                        className="flex w-full items-center gap-2 px-2 py-1.5 text-left"
                      >
                        <ChevronDown className={cn("size-4 transition-transform", isCollapsed && "-rotate-90")} aria-hidden />
                        <strong>{el}</strong>
                        <span className="text-xs text-muted-foreground">{group.length} program</span>
                      </button>
                    </td>
                  </tr>
                  {!isCollapsed &&
                    group.map((r) => (
                      <tr key={r.id} className={cn("border-t", !r.isActive && "opacity-50")}>
                        <td className="sticky left-0 z-10 bg-background px-2 py-1.5 tabular-nums">{r.no}</td>
                        <th scope="row" className="sticky left-14 z-10 bg-background px-2 py-1.5 text-left font-medium">{r.name}</th>
                        <td className="px-2 py-1.5 whitespace-nowrap">{r.owner}</td>
                        <td className="px-2 py-1.5 text-xs text-muted-foreground">
                          {r.indicator}
                          {r.evidenceRequired && <span className="block">Bukti: {r.evidenceRequired}</span>}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{r.target}</td>
                        {MONTHS_SHORT.map((m, i) => {
                          const future = i + 1 > currentMonth;
                          const st = cellState(r.plan[i], r.actual[i], future);
                          const noProof = !future && r.actual[i] > 0 && r.evidence[i] === 0;
                          return (
                            <td key={m} className="px-0.5 py-1">
                              <button
                                type="button"
                                disabled={future}
                                onClick={() => setOpen({ row: r, month: i + 1 })}
                                aria-label={`${r.name}, ${MONTHS_LONG[i]}: aktual ${r.actual[i]} dari rencana ${r.plan[i]}, ${CELL_STATE_LABEL[st]}${noProof ? ", bukti kurang" : ""}`}
                                className={cn("flex h-8 w-full min-w-11 items-center justify-center gap-0.5 rounded border text-xs tabular-nums", CELL_CLASS[st], !future && "hover:ring-2 hover:ring-ring/40")}
                              >
                                {st === "empty" ? "·" : `${r.actual[i]}/${r.plan[i]}`}
                                {noProof && <FileWarning className="size-3" aria-hidden />}
                              </button>
                            </td>
                          );
                        })}
                        <td className="px-2 py-1.5 text-right tabular-nums">{r.totalActual}</td>
                        <td className="px-2 py-1.5">
                          {r.pct === null ? (
                            <span className="text-xs text-muted-foreground">-</span>
                          ) : (
                            <div className="flex items-center gap-2" title={`Capaian s.d. ${MONTHS_LONG[limitMonth - 1]}`}>
                              <strong className={cn("w-10 tabular-nums", r.pct < 80 && "text-red-600 dark:text-red-400")}>{r.pct}%</strong>
                              <span className="block h-1.5 w-14 overflow-hidden rounded-full bg-muted" aria-hidden>
                                <span className={cn("block h-full rounded-full", r.pct < 80 ? "bg-red-500" : "bg-green-600")} style={{ width: `${r.pct}%` }} />
                              </span>
                            </div>
                          )}
                        </td>
                        {canManage && (
                          <td className="px-1">
                            <ProgramSheet
                              program={r}
                              year={year}
                              sites={sites}
                              trigger={
                                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Ubah program ${r.no}`}>
                                  <Pencil />
                                </Button>
                              }
                            />
                          </td>
                        )}
                      </tr>
                    ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Keterangan warna sel">
        {(["met", "partial", "missed", "future"] as const).map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <i className={cn("size-3 rounded border", CELL_CLASS[s])} aria-hidden />
            {CELL_STATE_LABEL[s]}
          </li>
        ))}
        <li className="flex items-center gap-1.5"><FileWarning className="size-3" aria-hidden /> Bukti kurang</li>
      </ul>
      {open && <CellSheet key={`${open.row.id}-${open.month}`} row={open.row} month={open.month} year={year} canRecord={canRecord} onClose={() => setOpen(null)} />}
    </>
  );
}

type StoredFile = { name: string };

function CellSheet({ row, month, year, canRecord, onClose }: { row: TspRow; month: number; year: number; canRecord: boolean; onClose: () => void }) {
  const router = useRouter();
  const online = useOnline();
  const [actual, setActual] = useState(String(row.actual[month - 1] ?? 0));
  const [note, setNote] = useState(row.notes[month - 1] ?? "");
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const folder = `tsp/${row.id}/${year}-${String(month).padStart(2, "0")}`;

  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    void createClient()
      .storage.from(BUCKET_LAMPIRAN)
      .list(folder)
      .then(({ data }) => {
        if (live) setFiles((data ?? []).filter((f) => f.name && !f.name.startsWith(".")).map((f) => ({ name: f.name })));
      });
    return () => {
      live = false;
    };
  }, [folder, tick]);

  const upload = async (picked: File[]) => {
    setUploading(true);
    const supabase = createClient();
    for (const f of picked) {
      const file = await compressImage(f);
      const { error } = await supabase.storage.from(BUCKET_LAMPIRAN).upload(`${folder}/${safeStorageName(file.name)}`, file, { contentType: file.type || undefined });
      if (error) toast.error(`Gagal mengunggah ${f.name}`, { description: error.message });
    }
    setUploading(false);
    setTick((t) => t + 1);
  };

  const planned = row.plan[month - 1] ?? 0;
  const save = async () => {
    const n = Number(actual);
    if (!Number.isInteger(n) || n < 0) return setErr("Aktual harus bilangan bulat ≥ 0");
    setErr(null);
    setSaving(true);
    const res = await saveRealizationAction({ program_id: row.id, month, actual: n, note });
    setSaving(false);
    if (res.status === "ok") {
      toast.success(res.message);
      onClose();
      router.refresh();
    } else toast.error(res.message);
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Realisasi program TSP</p>
          <SheetTitle>{MONTHS_LONG[month - 1]} {year}</SheetTitle>
          <SheetDescription>
            {row.no} · {row.element} · {row.name}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <dl className="space-y-1 rounded-lg border bg-muted/30 p-3 text-sm">
            <div><dt className="inline text-muted-foreground">Penanggung jawab: </dt><dd className="inline">{row.owner}</dd></div>
            <div><dt className="inline text-muted-foreground">Indikator: </dt><dd className="inline">{row.indicator}</dd></div>
            <div><dt className="inline text-muted-foreground">Bukti wajib: </dt><dd className="inline">{row.evidenceRequired || "-"}</dd></div>
          </dl>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Rencana" htmlFor="tsp-plan"><Input id="tsp-plan" value={planned} readOnly disabled className="text-base md:text-sm" /></Field>
            <Field label="Aktual" htmlFor="tsp-actual" required error={err ?? undefined} hint="Aktivitas K3 yang terhubung ikut dihitung otomatis.">
              <Input id="tsp-actual" inputMode="numeric" value={actual} disabled={!canRecord} onChange={(e) => setActual(e.target.value)} className="text-base md:text-sm" />
            </Field>
          </div>
          <Field label="Bukti pelaksanaan" htmlFor="tsp-proof" hint={`${files.length} file tersimpan`}>
            <div className="space-y-2">
              {canRecord && <FileDropzone id="tsp-proof" multiple loading={uploading} onFiles={upload} hint="Daftar hadir, foto, MOM" />}
              {files.length > 0 && (
                <ul className="space-y-1 text-xs">
                  {files.map((f) => (
                    <li key={f.name} className="truncate rounded border px-2 py-1">{f.name.replace(/^\d+-/, "")}</li>
                  ))}
                </ul>
              )}
              {Number(actual) > 0 && files.length === 0 && (
                <p className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400"><FileWarning className="size-3.5" aria-hidden /> Aktual terisi tetapi belum ada bukti.</p>
              )}
            </div>
          </Field>
          <Field label="Catatan" htmlFor="tsp-note" hint="Kendala atau penjelasan realisasi; tampil sebagai alasan di evaluasi bulanan.">
            <Textarea id="tsp-note" rows={3} value={note} maxLength={1000} disabled={!canRecord} onChange={(e) => setNote(e.target.value)} className="text-base md:text-sm" />
          </Field>
        </div>
        <SheetFooter className="flex-row justify-end border-t">
          <Button type="button" variant="outline" onClick={onClose}>{canRecord ? "Batal" : "Tutup"}</Button>
          {canRecord && (
            <Button type="button" onClick={save} disabled={saving || uploading || !online}>
              {saving && <Loader2 className="animate-spin" />} Simpan
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
