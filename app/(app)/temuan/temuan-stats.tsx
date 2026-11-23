// Strip angka + widget /temuan (Server Component, tanpa JS). Angka dari RPC finding_stats dengan scope
// site yang sama dengan list; setiap angka adalah tautan ke list dengan filter yang sama.
// Grafik: bar HTML (satu seri = --viz-1; dua seri = --viz-1/--viz-2, token tervalidasi dataviz),
// label nilai langsung + tabel data tersembunyi untuk pembaca layar.
import Link from "next/link";
import { formatMonth } from "@/lib/format";
import type { TemuanStats } from "@/lib/temuan";
import { SOURCE_KINDS } from "@/lib/temuan-rules";
import { cn } from "@/lib/utils";

const KPIS: { key: keyof TemuanStats; label: string; href: string; danger?: boolean }[] = [
  { key: "open", label: "Open", href: "/temuan?status=open" },
  { key: "in_progress", label: "In Progress", href: "/temuan?status=in_progress" },
  { key: "waiting_verification", label: "Menunggu Verifikasi", href: "/temuan?tampilan=verifikasi" },
  { key: "overdue", label: "Overdue", href: "/temuan?tampilan=overdue", danger: true },
  { key: "closed_this_month", label: "Closed bulan ini", href: "/temuan?tampilan=closed" },
];

export function TemuanStatsView({ stats }: { stats: TemuanStats }) {
  const sources = SOURCE_KINDS.map((s) => ({ label: s.label, n: stats.by_source[s.value] ?? 0, href: `/temuan?sumber=${s.value}` }));
  const maxSource = Math.max(1, ...sources.map((s) => s.n));
  const maxPic = Math.max(1, ...stats.overdue_by_pic.map((p) => p.n));
  const maxTrend = Math.max(1, ...stats.trend.flatMap((t) => [t.opened, t.closed]));

  return (
    <div className="col-span-12 space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {KPIS.map((k) => {
          const n = stats[k.key] as number;
          const danger = k.danger && n > 0;
          return (
            <Link
              key={k.key}
              href={k.href}
              className={cn(
                "rounded-xl border bg-card p-3 transition-colors hover:border-primary/40",
                danger && "border-red-300 bg-red-50/60 dark:border-red-900 dark:bg-red-950/30",
              )}
            >
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className={cn("text-2xl font-semibold tabular-nums", danger && "text-red-700 dark:text-red-400")}>{n}</p>
            </Link>
          );
        })}
        <div className="rounded-xl border bg-card p-3">
          <p className="text-xs text-muted-foreground">Rata-rata umur (terbuka)</p>
          <p className="text-2xl font-semibold tabular-nums">
            {stats.avg_age_days ?? 0}
            <span className="ml-1 text-sm font-normal text-muted-foreground">hari</span>
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Widget title="Temuan per Sumber" period="Semua temuan dalam site terpilih">
          <BarList items={sources.map((s) => ({ key: s.label, label: s.label, n: s.n, href: s.href }))} max={maxSource} />
        </Widget>

        <Widget title="Tren 6 Bulan" period="Temuan dibuka vs ditutup per bulan">
          <div className="mb-2 flex gap-4 text-xs text-muted-foreground" aria-hidden>
            <span className="flex items-center gap-1.5">
              <i className="size-2.5 rounded-sm bg-viz-1" /> Dibuka
            </span>
            <span className="flex items-center gap-1.5">
              <i className="size-2.5 rounded-sm bg-viz-2" /> Ditutup
            </span>
          </div>
          <div className="flex h-36 items-end gap-2 border-b border-viz-axis/40" aria-hidden>
            {stats.trend.map((t) => (
              <div key={t.month} className="flex h-full flex-1 flex-col justify-end">
                <div className="flex h-full items-end justify-center gap-[2px]">
                  <span
                    className="w-full max-w-4 rounded-t-[4px] bg-viz-1"
                    style={{ height: `${(t.opened / maxTrend) * 100}%`, minHeight: t.opened ? 2 : 0 }}
                    title={`${formatMonth(`${t.month}-01`)}: ${t.opened} dibuka`}
                  />
                  <span
                    className="w-full max-w-4 rounded-t-[4px] bg-viz-2"
                    style={{ height: `${(t.closed / maxTrend) * 100}%`, minHeight: t.closed ? 2 : 0 }}
                    title={`${formatMonth(`${t.month}-01`)}: ${t.closed} ditutup`}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-1 flex gap-2 text-[11px] text-muted-foreground" aria-hidden>
            {stats.trend.map((t) => (
              <span key={t.month} className="flex-1 text-center">
                {formatMonth(`${t.month}-01`).split(" ")[0].slice(0, 3)}
              </span>
            ))}
          </div>
          <table className="sr-only">
            <caption>Temuan dibuka dan ditutup per bulan</caption>
            <thead>
              <tr>
                <th>Bulan</th>
                <th>Dibuka</th>
                <th>Ditutup</th>
              </tr>
            </thead>
            <tbody>
              {stats.trend.map((t) => (
                <tr key={t.month}>
                  <td>{formatMonth(`${t.month}-01`)}</td>
                  <td>{t.opened}</td>
                  <td>{t.closed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Widget>

        <Widget title="Overdue per PIC" period="Top 5 · temuan melewati due date">
          {stats.overdue_by_pic.length ? (
            <BarList items={stats.overdue_by_pic.map((p) => ({ key: p.pic_id, label: p.name, n: p.n, href: `/temuan?tampilan=overdue&pic=${p.pic_id}` }))} max={maxPic} />
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">Tidak ada temuan overdue.</p>
          )}
        </Widget>
      </div>
    </div>
  );
}

function Widget({ title, period, children }: { title: string; period: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mb-3 text-xs text-muted-foreground">{period}</p>
      {children}
    </section>
  );
}

/** Bar horizontal satu seri (--viz-1), label & nilai sebagai teks, baris = tautan filter. */
function BarList({ items, max }: { items: { key: string; label: string; n: number; href: string }[]; max: number }) {
  return (
    <ul className="space-y-1">
      {items.map((s) => (
        <li key={s.key}>
          <Link href={s.href} className="grid grid-cols-[minmax(0,8rem)_1fr_2rem] items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-accent">
            <span className="truncate text-muted-foreground" title={s.label}>
              {s.label}
            </span>
            <span className="h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
              <span className="block h-full rounded-full bg-viz-1" style={{ width: `${(s.n / max) * 100}%` }} />
            </span>
            <span className="text-right font-medium tabular-nums">{s.n}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

