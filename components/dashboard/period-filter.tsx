// Filter periode Beranda (frontend-guide §17.1 no. 5): ‹ November 2026 › + chip Minggu 1–5 +
// pemilih perusahaan (kalau user melihat > 1 perusahaan). Semuanya link URL, tanpa state client.
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { DashboardPeriod } from "@/lib/dashboard-types";
import { cn } from "@/lib/utils";

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function dashboardHref(p: Pick<DashboardPeriod, "month" | "week" | "company">, change: Partial<Pick<DashboardPeriod, "month" | "week" | "company">> = {}) {
  const n = { ...p, ...change };
  const q = new URLSearchParams();
  q.set("bulan", n.month);
  if (n.week) q.set("minggu", String(n.week));
  if (n.company) q.set("perusahaan", n.company);
  return `/?${q}`;
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium whitespace-nowrap transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
      )}
    >
      {children}
    </Link>
  );
}

export function PeriodFilter({ period, companies }: { period: DashboardPeriod; companies: { code: string; label: string }[] }) {
  const next = shiftMonth(period.month, 1);
  return (
    <div className="col-span-12 flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-1">
        <Link
          href={dashboardHref(period, { month: shiftMonth(period.month, -1), week: null })}
          scroll={false}
          className={buttonVariants({ variant: "ghost", size: "icon" })}
          aria-label="Bulan sebelumnya"
        >
          <ChevronLeft />
        </Link>
        <span className="min-w-36 text-center text-sm font-semibold">{monthLabel(period.month)}</span>
        {period.isCurrentMonth ? (
          <span className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "pointer-events-none opacity-40")} aria-hidden>
            <ChevronRight />
          </span>
        ) : (
          <Link href={dashboardHref(period, { month: next, week: null })} scroll={false} className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label="Bulan berikutnya">
            <ChevronRight />
          </Link>
        )}
      </div>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:pb-0" role="group" aria-label="Minggu">
        <Chip href={dashboardHref(period, { week: null })} active={!period.week}>
          Sebulan
        </Chip>
        {Array.from({ length: period.weeks }, (_, i) => i + 1).map((w) => (
          <Chip key={w} href={dashboardHref(period, { week: w })} active={period.week === w}>
            Minggu {w}
          </Chip>
        ))}
      </div>
      {companies.length > 1 && (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 lg:pb-0" role="group" aria-label="Perusahaan">
          <Chip href={dashboardHref(period, { company: null })} active={!period.company}>
            Semua
          </Chip>
          {companies.map((c) => (
            <Chip key={c.code} href={dashboardHref(period, { company: c.code })} active={period.company === c.code}>
              {c.label}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}
