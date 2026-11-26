"use client";

// Quick action Monitoring APD (28): IN = terima barang MR ke gudang (boleh sebagian), OUT = kirim APD pengajuan dari gudang,
// Lengkapi MR = nomor MR sistem perusahaan. Semua baris satu pengajuan disimpan sekaligus (RPC apd_request_moves).
import { useMemo, useState, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Field } from "@/components/form-bits";
import { SearchableSelect } from "@/components/form/searchable-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { OpsRequest } from "@/lib/apd";
import { todayWib } from "@/lib/format";
import { useOnline } from "@/lib/offline/use-online";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { requestMovesAction, setMrAction } from "./actions";

export type OpsItem = { id: string; code: string; name: string; typeId: string; size: string | null; uom: string };
export type OpsWarehouse = { id: string; name: string; locationName: string | null };
type LineState = { lineId: string; itemId: string; qty: string };

/** Sisa per baris: IN = qty − diterima; OUT = sisa kirim. */
const remaining = (kind: "in" | "out", l: OpsRequest["lines"][number]) => Math.max(kind === "in" ? l.qty - l.received : l.outstanding, 0);

/** Barang default baris: barang di pengajuan, atau satu-satunya barang jenis itu dengan ukuran yang sama. */
function defaultItem(l: OpsRequest["lines"][number], items: OpsItem[]): string {
  if (l.itemId) return l.itemId;
  const ofType = items.filter((i) => i.typeId === l.typeId);
  const bySize = l.size ? ofType.filter((i) => (i.size ?? "").toLowerCase() === l.size!.toLowerCase()) : [];
  return bySize.length === 1 ? bySize[0].id : ofType.length === 1 ? ofType[0].id : "";
}

export function RequestMovesSheet({
  kind,
  trigger,
  requests,
  items,
  warehouses,
  stock,
  defaultRequestId,
  defaultWarehouseId,
}: {
  kind: "in" | "out";
  trigger: ReactElement;
  requests: OpsRequest[];
  items: OpsItem[];
  warehouses: OpsWarehouse[];
  /** stok `${gudang}|${barang}` (hanya OUT menampilkan & membatasi) */
  stock: Record<string, number>;
  defaultRequestId?: string;
  defaultWarehouseId?: string | null;
}) {
  const router = useRouter();
  const online = useOnline();
  const eligible = useMemo(
    () => requests.filter((r) => (kind === "in" ? !!r.mrNo : true) && r.lines.some((l) => remaining(kind, l) > 0)),
    [requests, kind],
  );
  const [open, setOpen] = useState(false);
  const [reqId, setReqId] = useState<string | null>(null);
  const [wh, setWh] = useState<string>("");
  const [on, setOn] = useState(todayWib());
  const [ref, setRef] = useState("");
  const [pic, setPic] = useState("");
  const [lines, setLines] = useState<LineState[]>([]);
  const [busy, setBusy] = useState(false);
  const req = eligible.find((r) => r.id === reqId) ?? null;

  const pick = (id: string | null) => {
    setReqId(id);
    const r = eligible.find((x) => x.id === id);
    setLines(r ? r.lines.filter((l) => remaining(kind, l) > 0).map((l) => ({ lineId: l.id, itemId: defaultItem(l, items), qty: String(remaining(kind, l)) })) : []);
  };
  const reset = () => {
    setWh(defaultWarehouseId ?? (warehouses.length === 1 ? warehouses[0].id : ""));
    setOn(todayWib());
    setRef("");
    setPic("");
    pick(defaultRequestId && eligible.some((r) => r.id === defaultRequestId) ? defaultRequestId : eligible.length === 1 ? eligible[0].id : null);
  };
  const setLine = (id: string, patch: Partial<LineState>) => setLines((ls) => ls.map((l) => (l.lineId === id ? { ...l, ...patch } : l)));
  const short = kind === "out" && wh ? lines.filter((l) => l.itemId && Number(l.qty) > (stock[`${wh}|${l.itemId}`] ?? 0)) : [];
  const valid = !!req && !!wh && lines.some((l) => Number(l.qty) > 0) && lines.every((l) => Number(l.qty) === 0 || l.itemId) && short.length === 0;

  const submit = async () => {
    if (!req) return;
    setBusy(true);
    const res = await requestMovesAction(kind, {
      request_id: req.id,
      warehouse_id: wh,
      moved_on: on,
      ref_no: ref,
      pic,
      lines: lines.map((l) => ({ line_id: l.lineId, item_id: l.itemId, qty: l.qty || 0 })),
    });
    setBusy(false);
    if (res.status === "ok") {
      toast.success(res.message);
      setOpen(false);
      router.refresh();
    } else toast.error(res.message);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (o) reset(); }}>
      <SheetTrigger render={trigger} />
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        <SheetHeader className="border-b">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{kind === "in" ? "IN Barang" : "OUT Barang"}</p>
          <SheetTitle>{kind === "in" ? "Terima Barang MR" : "Kirim APD Pengajuan"}</SheetTitle>
          <SheetDescription>
            {kind === "in"
              ? "Pilih MR yang barangnya datang, gudang penerima, lalu jumlah per barang (boleh sebagian). Stok gudang bertambah."
              : "Pilih pengajuan yang disetujui dan gudang asal. Stok gudang berkurang; pemenuhan pengajuan & jatuh tempo karyawan ikut ter-update."}
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          {eligible.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              {kind === "in" ? "Tidak ada MR yang menunggu barang. Lengkapi nomor MR di pengajuan yang disetujui terlebih dahulu." : "Tidak ada pengajuan disetujui yang belum terkirim."}
            </p>
          ) : (
            <>
              <Field label={kind === "in" ? "MR / Pengajuan" : "Pengajuan"} htmlFor={`ops-req-${kind}`} required>
                <SearchableSelect
                  id={`ops-req-${kind}`}
                  value={reqId}
                  onValueChange={(v) => pick(v)}
                  options={eligible.map((r) => ({ value: r.id, label: kind === "in" ? `${r.mrNo} · ${r.code}` : r.code, description: `${r.recipient} · ${r.site}` }))}
                  placeholder={kind === "in" ? "Pilih MR" : "Pilih pengajuan"}
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={kind === "in" ? "Diterima di gudang" : "Diambil dari gudang"} htmlFor={`ops-wh-${kind}`} required>
                  <select id={`ops-wh-${kind}`} value={wh} onChange={(e) => setWh(e.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                    <option value="">{warehouses.length ? "Pilih gudang" : "Belum ada gudang (atur di Master Data)"}</option>
                    {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}{w.locationName ? ` · ${w.locationName}` : ""}</option>)}
                  </select>
                </Field>
                <Field label="Tanggal" htmlFor={`ops-on-${kind}`} required>
                  <Input id={`ops-on-${kind}`} type="date" max={todayWib()} value={on} onChange={(e) => setOn(e.target.value)} />
                </Field>
                <Field label={kind === "in" ? "No referensi (default: nomor MR)" : "No BAST"} htmlFor={`ops-ref-${kind}`}>
                  <Input id={`ops-ref-${kind}`} value={ref} maxLength={60} onChange={(e) => setRef(e.target.value)} placeholder={kind === "in" ? (req?.mrNo ?? "") : ""} />
                </Field>
                <Field label={kind === "in" ? "PIC penerima" : "PIC pengiriman"} htmlFor={`ops-pic-${kind}`}>
                  <Input id={`ops-pic-${kind}`} value={pic} maxLength={120} onChange={(e) => setPic(e.target.value)} />
                </Field>
              </div>
              {req && (
                <ul className="space-y-2">
                  {lines.map((ls) => {
                    const l = req.lines.find((x) => x.id === ls.lineId)!;
                    const opts = items.filter((i) => i.typeId === l.typeId);
                    const left = remaining(kind, l);
                    const avail = wh && ls.itemId ? (stock[`${wh}|${ls.itemId}`] ?? 0) : null;
                    const lacking = kind === "out" && avail !== null && Number(ls.qty) > avail;
                    return (
                      <li key={ls.lineId} className={cn("grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_6rem]", lacking && "border-red-400")}>
                        <div className="min-w-0 space-y-1.5">
                          <p className="text-sm font-medium">{l.typeName}{l.size ? ` · ${l.size}` : ""}</p>
                          <p className="text-xs text-muted-foreground">
                            {kind === "in" ? `MR ${l.qty} · diterima ${l.received} · sisa ${left}` : `Diminta ${l.qty} · terkirim ${l.supplied} · sisa ${left}`}
                          </p>
                          <select aria-label={`Barang untuk ${l.typeName}`} value={ls.itemId} onChange={(e) => setLine(ls.lineId, { itemId: e.target.value })} className="h-8 w-full rounded-md border bg-background px-2 text-xs">
                            <option value="">Pilih barang</option>
                            {opts.map((i) => (
                              <option key={i.id} value={i.id}>
                                {i.code} · {i.name}{kind === "out" && wh ? ` (stok ${stock[`${wh}|${i.id}`] ?? 0})` : ""}
                              </option>
                            ))}
                          </select>
                          {lacking && <p role="alert" className="text-xs text-red-600 dark:text-red-400">Stok di gudang ini hanya {avail}.</p>}
                        </div>
                        <Field label="Jumlah" htmlFor={`ops-q-${ls.lineId}`}>
                          <Input id={`ops-q-${ls.lineId}`} type="number" min={0} max={left} value={ls.qty} onChange={(e) => setLine(ls.lineId, { qty: e.target.value })} />
                        </Field>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>
        <SheetFooter className="border-t">
          <Button onClick={submit} disabled={!valid || busy || !online}>
            {busy && <Loader2 className="animate-spin" />} {kind === "in" ? "Terima ke Gudang" : "Kirim"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/** Lengkapi / ubah nomor MR (sistem perusahaan) pada pengajuan disetujui. */
export function MrButton({ requestId, code, current, trigger }: { requestId: string; code: string; current: string | null; trigger: ReactElement }) {
  const router = useRouter();
  const [mr, setMr] = useState(current ?? "");
  return (
    <ConfirmDialog
      trigger={trigger}
      title={current ? `Ubah nomor MR ${code}` : `Lengkapi MR ${code}`}
      description="Nomor MR dari sistem perusahaan (mis. GMI/MR/XI/26/TAL/848). Setelah terisi, barangnya bisa diterima lewat IN Barang."
      confirmText="Simpan"
      confirmDisabled={mr.trim() === (current ?? "")}
      onConfirm={async () => {
        const res = await setMrAction(requestId, mr);
        if (res.status !== "ok") {
          toast.error(res.message);
          throw new Error(res.message);
        }
        toast.success(res.message);
        router.refresh();
      }}
    >
      <Input value={mr} onChange={(e) => setMr(e.target.value)} maxLength={60} placeholder="GMI/MR/…" aria-label="Nomor MR" />
    </ConfirmDialog>
  );
}
