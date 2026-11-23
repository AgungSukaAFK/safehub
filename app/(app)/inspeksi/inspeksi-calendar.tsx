// Kalender bulanan (md+) dan agenda per hari (HP). Server Component: tautan biasa ke detail, tanpa JS.
// Warna jenis = master berkode (kolom color) lewat peta kelas status yang sama dengan badge.
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import type { InspectionRow } from "@/lib/inspeksi";
import { INSPECTION_STATUS, MONTH_NAMES, parseMonth } from "@/lib/inspeksi-rules";
import { STATUS_CLASSES, type StatusColor } from "@/lib/status";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const MAX_PER_DAY = 3;

export const typeChipClass = (color: string | null) => STATUS_CLASSES[(color as StatusColor) ?? "gray"]?.soft ?? STATUS_CLASSES.gray.soft;

function Chip({ r }: { r: InspectionRow }) {
  const late = r.displayStatus === "late";
  return (
    <Link
      href={`/inspeksi/${r.id}`}
      title={`${r.title}${r.objectText ? ` · ${r.objectText}` : ""} · ${INSPECTION_STATUS[r.displayStatus]?.label}`}
      className={cn(
        "flex min-w-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] leading-tight transition-opacity hover:opacity-80",
        typeChipClass(r.typeColor),
        r.status === "cancelled" && "line-through opacity-60",
        late && "ring-1 ring-red-500",
      )}
    >
      <strong className="shrink-0 tabular-nums">{r.plannedTime}</strong>
      <span className="truncate">{r.title.replace(/^Inspeksi /, "")}</span>
      {(r.status === "submitted" || r.status === "verified") && <span aria-label="Terlaksana" className="shrink-0">✓</span>}
    </Link>
  );
}

export function InspeksiCalendar({ bulan, rows, today }: { bulan: string; rows: InspectionRow[]; today: string }) {
  const m = parseMonth(bulan)!;
  const first = new Date(Date.UTC(m.year, m.month - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7; // Senin = 0
  const daysInMonth = new Date(Date.UTC(m.year, m.month, 0)).getUTCDate();
  const cells = Math.ceil((lead + daysInMonth) / 7) * 7;
  const byDate = new Map<string, InspectionRow[]>();
  for (const r of rows) byDate.set(r.plannedDate, [...(byDate.get(r.plannedDate) ?? []), r]);
  const iso = (d: number) => `${m.year}-${String(m.month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const days = [...byDate.keys()].sort();

  return (
    <>
      {/* md+: grid kalender */}
      <div className="hidden overflow-hidden rounded-xl border md:block" role="grid" aria-label={`Kalender ${MONTH_NAMES[m.month - 1]} ${m.year}`}>
        <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-xs font-medium text-muted-foreground" role="row">
          {WEEKDAYS.map((d) => (
            <span key={d} className="py-2" role="columnheader">
              {d}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7" role="rowgroup">
          {Array.from({ length: cells }, (_, i) => {
            const day = i - lead + 1;
            const inMonth = day >= 1 && day <= daysInMonth;
            const date = inMonth ? iso(day) : "";
            const list = date ? (byDate.get(date) ?? []) : [];
            return (
              <div key={i} role="gridcell" className={cn("min-h-28 space-y-1 border-r border-b p-1.5 last:border-r-0 [&:nth-child(7n)]:border-r-0", !inMonth && "bg-muted/30")}>
                {inMonth && (
                  <span className={cn("inline-flex size-6 items-center justify-center rounded-full text-xs", date === today ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground")}>{day}</span>
                )}
                {list.slice(0, MAX_PER_DAY).map((r) => (
                  <Chip key={r.id} r={r} />
                ))}
                {list.length > MAX_PER_DAY && <span className="block px-1 text-[11px] text-muted-foreground">+{list.length - MAX_PER_DAY} lagi (lihat Daftar)</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* HP: agenda per hari */}
      <div className="space-y-3 md:hidden">
        {days.length === 0 && <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Tidak ada inspeksi bulan ini.</p>}
        {days.map((d) => (
          <section key={d} className="rounded-xl border">
            <h3 className={cn("flex items-center gap-2 border-b px-3 py-2 text-sm font-semibold", d === today && "text-primary")}>
              <CalendarDays className="size-4" />
              {Number(d.slice(8))} {MONTH_NAMES[m.month - 1]}
              {d === today && <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">Hari ini</span>}
            </h3>
            <div className="space-y-1.5 p-2">
              {byDate.get(d)!.map((r) => (
                <Chip key={r.id} r={r} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
