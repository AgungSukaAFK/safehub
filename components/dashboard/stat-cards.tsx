"use client";

// ClickableStatCard (frontend-guide §17.3): angka + ikon + deskripsi + tren vs periode lalu. Klik →
// dialog drill-down berpaginasi (Server Action = loader list yang sama) + "Buka di daftar".
import { useEffect, useState, type ElementType } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, CheckCircle2, Clock, FileText, Loader2, Wallet, XCircle } from "lucide-react";
import { StatusBadge } from "@/components/detail/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { drillDownAction } from "@/app/(app)/dashboard-actions";
import type { DashboardPeriod, StatKey, Summary } from "@/lib/dashboard-types";
import { formatDate, formatNumber, formatRupiah } from "@/lib/format";
import type { PengajuanRow } from "@/lib/pengajuan";
import { DOCUMENT_STATUS } from "@/lib/status";
import { cn } from "@/lib/utils";

type CardDef = {
  key: StatKey;
  label: string;
  desc: string;
  icon: ElementType;
  money?: boolean;
  /** naik = baik (hijau) / buruk (merah) / netral */
  upIs: "good" | "bad" | "neutral";
};

const CARDS: CardDef[] = [
  { key: "total", label: "Pengajuan dibuat", desc: "Semua status", icon: FileText, upIs: "neutral" },
  { key: "pending", label: "Menunggu approval", desc: "Dibuat di periode ini", icon: Clock, upIs: "bad" },
  { key: "approved", label: "Disetujui", desc: "Dibuat di periode ini", icon: CheckCircle2, upIs: "good" },
  { key: "rejected", label: "Ditolak", desc: "Perlu diperbaiki pemohon", icon: XCircle, upIs: "bad" },
  { key: "amount_approved", label: "Nilai disetujui", desc: "Total pengajuan disetujui", icon: Wallet, money: true, upIs: "good" },
];

/** Angka naik dari 0 saat pertama tampil (≤ 600 ms, mati di prefers-reduced-motion). */
function useCountUp(value: number) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || value === 0) return;
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 600);
      setShown(value * (1 - (1 - p) ** 3));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return shown;
}

function Trend({ cur, prev, upIs }: { cur: number; prev: number; upIs: CardDef["upIs"] }) {
  if (cur === prev) return <span className="text-xs text-muted-foreground">Sama dengan periode lalu</span>;
  if (prev === 0) return <span className="text-xs text-muted-foreground">Periode lalu: 0</span>;
  const pct = Math.round(((cur - prev) / prev) * 100);
  const up = pct > 0;
  const tone = upIs === "neutral" ? "text-muted-foreground" : (up ? upIs === "good" : upIs === "bad") ? "text-success" : "text-destructive";
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", tone)} title={`Periode lalu: ${formatNumber(prev)}`}>
      <Icon className="size-3.5" aria-hidden />
      {up ? "naik" : "turun"} {Math.abs(pct)}%<span className="font-normal text-muted-foreground">&nbsp;vs periode lalu</span>
    </span>
  );
}

function StatCard({ def, cur, prev, onOpen }: { def: CardDef; cur: number; prev: number; onOpen: () => void }) {
  const shown = useCountUp(cur);
  const text = def.money ? formatRupiah(Math.round(shown)) : formatNumber(Math.round(shown));
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex cursor-pointer flex-col gap-2 rounded-xl border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        {def.label}
        <def.icon className="size-4 shrink-0" aria-hidden />
      </span>
      <span className={cn("font-semibold tracking-tight tabular-nums", def.money ? "text-xl" : "text-2xl")}>{text}</span>
      <span className="text-xs text-muted-foreground">{def.desc}</span>
      <Trend cur={cur} prev={prev} upIs={def.upIs} />
    </button>
  );
}

export function StatCards({ summary, period, listHrefs }: { summary: Summary; period: DashboardPeriod; listHrefs: Record<StatKey, string> }) {
  const [open, setOpen] = useState<CardDef | null>(null);
  return (
    <>
      <div className="col-span-12 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5 [&>*:last-child]:col-span-2 md:[&>*:last-child]:col-span-1">
        {CARDS.map((c) => (
          <StatCard key={c.key} def={c} cur={summary.cur[c.key]} prev={summary.prev[c.key]} onOpen={() => setOpen(c)} />
        ))}
      </div>
      {open && <DrillDownDialog def={open} period={period} href={listHrefs[open.key]} onClose={() => setOpen(null)} />}
    </>
  );
}

function DrillDownDialog({ def, period, href, onClose }: { def: CardDef; period: DashboardPeriod; href: string; onClose: () => void }) {
  const [page, setPage] = useState(1);
  const [state, setState] = useState<{ loading: boolean; rows: PengajuanRow[]; total: number; error?: string }>({ loading: true, rows: [], total: 0 });

  useEffect(() => {
    let alive = true;
    drillDownAction(def.key, { from: period.from, to: period.to, company: period.company }, page).then((r) => {
      if (!alive) return;
      setState("error" in r ? { loading: false, rows: [], total: 0, error: r.error } : { loading: false, rows: r.rows, total: r.total });
    });
    return () => {
      alive = false;
    };
  }, [def.key, period.from, period.to, period.company, page]);

  const pages = Math.max(1, Math.ceil(state.total / 10));
  const go = (p: number) => {
    setState((s) => ({ ...s, loading: true }));
    setPage(p);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{def.label}</DialogTitle>
          <DialogDescription>
            {formatDate(period.from)} – {formatDate(period.to)}
            {period.company ? ` · ${period.company}` : ""} · {state.loading && !state.total ? "memuat..." : `${formatNumber(state.total)} pengajuan`}
          </DialogDescription>
        </DialogHeader>
        <div className={cn("min-h-40 overflow-x-auto transition-opacity", state.loading && "opacity-60")}>
          {state.error ? (
            <p className="py-10 text-center text-sm text-destructive">{state.error}</p>
          ) : !state.loading && state.rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Belum ada data di periode ini.</p>
          ) : (
            <Table className="min-w-[520px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Nomor</TableHead>
                  <TableHead>Judul</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      <Link href={`/pengajuan/${r.id}`} className="text-primary hover:underline">
                        {r.code ?? "Draft"}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-56 truncate" title={r.title}>
                      {r.title}
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={r.status} map={DOCUMENT_STATUS} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatRupiah(r.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {state.loading && state.rows.length === 0 && !state.error && (
            <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Memuat...
            </p>
          )}
        </div>
        <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1 || state.loading} onClick={() => go(page - 1)}>
              Sebelumnya
            </Button>
            <span className="px-2 text-xs text-muted-foreground tabular-nums">
              {page}/{pages}
            </span>
            <Button variant="outline" size="sm" disabled={page >= pages || state.loading} onClick={() => go(page + 1)}>
              Berikutnya
            </Button>
          </div>
          <Link href={href} className={buttonVariants({ size: "sm" })}>
            Buka di daftar <ArrowRight />
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
