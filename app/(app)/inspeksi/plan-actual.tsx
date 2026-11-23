// Panel "Rencana vs Aktual Bulan Ini" (Server Component). Rencana = jadwal tidak dibatalkan pada bulan itu,
// aktual = yang sudah dikirim/diverifikasi. Angka = RPC inspection_plan_actual (satu sumber dengan dashboard).
import Link from "next/link";
import type { PlanActualRow } from "@/lib/inspeksi";
import { achievementPct, monthLabel } from "@/lib/inspeksi-rules";
import { cn } from "@/lib/utils";

export function PlanActualPanel({ bulan, rows, plan, actual }: { bulan: string; rows: PlanActualRow[]; plan: number; actual: number }) {
  const pct = achievementPct(actual, plan);
  return (
    <aside className="rounded-xl border bg-card p-4">
      <header className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Rencana vs Aktual</h2>
        <span className="text-xs text-muted-foreground">{monthLabel(bulan)}</span>
      </header>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Belum ada jadwal bulan ini.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const behind = r.actual < r.plan;
            return (
              <li key={r.typeCode}>
                <Link href={`/inspeksi?bulan=${bulan}&tampilan=daftar&jenis=${r.typeCode}`} className="block space-y-1 rounded-md hover:bg-accent/50">
                  <span className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate">{r.label}</span>
                    <strong className={cn("shrink-0 tabular-nums", behind && "text-red-600 dark:text-red-400")}>
                      {r.actual}/{r.plan}
                    </strong>
                  </span>
                  <span className="block h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={r.actual} aria-valuemax={r.plan} aria-label={`${r.label}: ${r.actual} dari ${r.plan}`}>
                    <span className={cn("block h-full rounded-full", behind ? "bg-amber-500" : "bg-green-600 dark:bg-green-500")} style={{ width: `${r.plan ? (r.actual / r.plan) * 100 : 0}%` }} />
                  </span>
                  <small className="block text-xs text-muted-foreground">{behind ? `${r.plan - r.actual} kegiatan tertinggal` : "Tercapai"}</small>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <footer className="mt-4 grid grid-cols-3 gap-2 border-t pt-3 text-center">
        <div>
          <strong className="block text-lg tabular-nums">{actual}</strong>
          <span className="text-xs text-muted-foreground">Aktual</span>
        </div>
        <div>
          <strong className="block text-lg tabular-nums">{plan}</strong>
          <span className="text-xs text-muted-foreground">Rencana</span>
        </div>
        <div>
          <strong className="block text-lg tabular-nums">{pct === null ? "-" : `${pct}%`}</strong>
          <span className="text-xs text-muted-foreground">Pencapaian</span>
        </div>
      </footer>
    </aside>
  );
}
