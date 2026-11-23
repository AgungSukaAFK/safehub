// Blok Beranda K3 (rancangan §4.4). Server Component; angka dari SATU RPC dashboard_k3 (data dikirim sebagai
// promise supaya tiap blok di <Suspense> sendiri menunggu hasil yang sama). Grafik = HTML/SVG dengan token
// --viz-* (tervalidasi dataviz); setiap grafik punya label nilai teks + tabel sr-only. Judul menaut ke modulnya.
import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarClock, ClipboardCheck, ShieldAlert } from "lucide-react";
import { Content } from "@/components/list/content";
import { KpiHelp, KpiStatusBadge, type KpiDefinition } from "@/components/kpi-help";
import { formatNumber, timeAgo } from "@/lib/format";
import { MONTH_SHORT, achievementPct, monthLabel } from "@/lib/inspeksi-rules";
import type { DashboardK3, KpiDef, SafetyKpi } from "@/lib/kpi";
import { kpiTone } from "@/lib/kpi-rules";
import { getMyTasks } from "@/lib/tasks";
import type { ServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const toHelp = (k: KpiDef): KpiDefinition => ({ code: k.code, name: k.name, definition: k.definition, formula: k.formula, source: k.source, owner: k.owner, unit: k.unit, status: k.status, version: `v${k.version}` });

// ---------------------------------------------------------------- Perlu Aksi (tugas K3 + approval)
export async function K3ActionNeeded({ supabase }: { supabase: ServerClient }) {
  const t = await getMyTasks(supabase);
  const items = [
    ...t.others.action.map((x) => ({ key: `${x.kind}:${x.refId}`, href: x.href, title: x.code ? `${x.code} · ${x.title}` : x.title, sub: x.dueAt ? `Batas ${new Date(x.dueAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", timeZone: "Asia/Jakarta" })}` : "Perlu tindakan", tone: "amber" as const })),
    ...t.others.verification.map((x) => ({ key: `${x.kind}:${x.refId}`, href: x.href, title: x.code ? `${x.code} · ${x.title}` : x.title, sub: "Menunggu verifikasi Anda", tone: "violet" as const })),
    ...t.others.approval.map((x) => ({ key: `${x.kind}:${x.refId}`, href: x.href, title: x.code ? `${x.code} · ${x.title}` : x.title, sub: "Menunggu review Anda", tone: "violet" as const })),
    ...t.approvals.map((a) => ({ key: a.approvalId, href: a.href, title: a.docLabel, sub: `Menunggu ${timeAgo(a.waitingSince)}`, tone: "amber" as const })),
    ...t.others.scheduled.map((x) => ({ key: `${x.kind}:${x.refId}`, href: x.href, title: x.code ? `${x.code} · ${x.title}` : x.title, sub: "Terjadwal", tone: "sky" as const })),
  ];
  const shown = items.slice(0, 6);
  return (
    <Content
      title="Perlu Aksi Anda"
      description={items.length ? "Tugas yang menunggu Anda, urutan dari Tugas Saya." : undefined}
      cardAction={
        items.length > shown.length && (
          <Link href="/tugas" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            Semua ({items.length}) <ArrowRight className="size-4" />
          </Link>
        )
      }
    >
      {shown.length ? (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((i) => (
            <Link key={i.key} href={i.href} className="group flex items-center gap-3 rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-accent/40">
              <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", i.tone === "amber" && "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300", i.tone === "violet" && "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300", i.tone === "sky" && "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300")}>
                <ClipboardCheck className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{i.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{i.sub}</span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      ) : (
        <p className="py-4 text-center text-sm text-muted-foreground">Tidak ada yang perlu Anda kerjakan sekarang.</p>
      )}
    </Content>
  );
}

// ---------------------------------------------------------------- Kinerja Keselamatan
type Card = { code: string; label: string; unit: string; value: (k: SafetyKpi) => number | null; decimals?: number };
const CARDS: Card[] = [
  { code: "fatality", label: "Fatality", unit: "kasus", value: (k) => k.fatality },
  { code: "lti", label: "Lost Time Injury", unit: "kasus", value: (k) => k.lti },
  { code: "ltifr", label: "LTIFR", unit: "", value: (k) => k.ltifr, decimals: 2 },
  { code: "ltisr", label: "LTISR", unit: "", value: (k) => k.ltisr, decimals: 2 },
  { code: "near_miss", label: "Near Miss", unit: "kasus", value: (k) => k.near_miss },
  { code: "property_damage", label: "Property Damage", unit: "kasus", value: (k) => k.property_damage },
];

const fmt = (n: number | null, decimals = 0, unit = "") => (n === null ? "Belum tersedia" : `${n.toLocaleString("id-ID", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${unit ? ` ${unit}` : ""}`);

export async function SafetyStrip({ data, kpis, bulan, rentang, hrefFor, canEditHours }: { data: Promise<DashboardK3>; kpis: KpiDef[]; bulan: string; rentang: "bulan" | "ytd"; hrefFor: (r: "bulan" | "ytd") => string; canEditHours: boolean }) {
  const d = await data;
  if (!d.month || !d.ytd) return null; // hanya staf K3
  const ytd = rentang === "ytd";
  const main = ytd ? d.ytd : d.month;
  const other = ytd ? d.month : d.ytd;
  const noHours = main.hours === null;
  return (
    <section className="col-span-12 space-y-3" aria-labelledby="sec-keselamatan">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="sec-keselamatan" className="flex items-baseline gap-2 font-semibold">
          <Link href="/kejadian" className="hover:underline">
            Kinerja Keselamatan
          </Link>
          <span className="text-sm font-normal text-muted-foreground">{ytd ? `YTD · Jan–${MONTH_SHORT[Number(bulan.slice(5)) - 1]} ${bulan.slice(0, 4)}` : monthLabel(bulan)}</span>
        </h2>
        <div className="flex rounded-md border p-0.5 text-sm" role="group" aria-label="Rentang">
          {(["bulan", "ytd"] as const).map((r) => (
            <Link key={r} href={hrefFor(r)} aria-current={rentang === r ? "true" : undefined} className={cn("rounded px-2.5 py-1", rentang === r ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:text-foreground")}>
              {r === "bulan" ? "Bulan ini" : "YTD"}
            </Link>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6 [&>*]:min-w-0">
        {CARDS.map((c) => {
          const def = kpis.find((k) => k.code === c.code);
          const v = c.value(main);
          const o = c.value(other);
          const tone = kpiTone(v, def?.thresholds);
          return (
            <article key={c.code} className={cn("flex flex-col gap-1 rounded-xl border bg-card p-3", tone === "danger" && "border-red-300 bg-red-50/60 dark:border-red-900 dark:bg-red-950/30", tone === "warning" && "border-amber-300 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/30")}>
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs text-muted-foreground">{c.label}</span>
                {def && <KpiHelp kpi={toHelp(def)} />}
              </div>
              <strong className={cn("text-2xl leading-tight tabular-nums", v === null && "text-base font-medium text-muted-foreground", tone === "danger" && "text-red-700 dark:text-red-400")}>{v === null ? "Belum tersedia" : fmt(v, c.decimals ?? 0, c.unit)}</strong>
              <small className="text-xs text-muted-foreground">
                {ytd ? "Bulan ini" : "YTD"}: {o === null ? "–" : fmt(o, c.decimals ?? 0, c.unit)}
              </small>
              {def && def.status === "draft" && <KpiStatusBadge status="draft" className="mt-1" />}
            </article>
          );
        })}
      </div>
      {noHours && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <AlertTriangle className="size-3.5 shrink-0" /> LTIFR dan LTISR belum bisa dihitung: jam kerja periode ini belum diisi.
          {canEditHours && (
            <Link href="/kpi/jam-kerja" className="font-medium text-primary hover:underline">
              Isi jam kerja
            </Link>
          )}
        </p>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- kartu ringkasan
function Sparkline({ series }: { series: { month: string; hours: number }[] }) {
  if (series.length < 2) return null;
  const max = Math.max(1, ...series.map((s) => s.hours));
  const pts = series.map((s, i) => `${(i / (series.length - 1)) * 156 + 2},${40 - (s.hours / max) * 36}`).join(" ");
  return (
    <svg viewBox="0 0 160 42" role="img" aria-label={`Jam kerja bulanan ${series[0].month} sampai ${series.at(-1)!.month}`} className="h-10 w-full">
      <polyline points={pts} fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="stroke-viz-1" />
    </svg>
  );
}

export async function SummaryCards({ data, bulan }: { data: Promise<DashboardK3>; bulan: string }) {
  const d = await data;
  const ytdHours = d.ytd?.hours ?? null;
  const cards = [
    d.ytd && {
      href: "/kpi/jam-kerja",
      label: "Jam Kerja (YTD)",
      value: ytdHours === null ? "Belum tersedia" : formatNumber(ytdHours),
      unit: ytdHours === null ? "" : "jam",
      extra: <Sparkline series={d.hours_series} />,
      foot: `Jan–${MONTH_SHORT[Number(bulan.slice(5)) - 1]} ${bulan.slice(0, 4)}`,
    },
    {
      href: "/temuan?tampilan=overdue",
      label: "Temuan Overdue",
      value: String(d.findings.overdue),
      unit: "",
      danger: d.findings.overdue > 0,
      extra: <p className={cn("text-xs", d.findings.overdue > 0 ? "font-medium text-red-700 dark:text-red-400" : "text-muted-foreground")}>{d.findings.overdue > 0 ? "Perlu tindak lanjut segera" : "Tidak ada yang terlambat"}</p>,
      foot: `${d.findings.open} temuan terbuka`,
    },
    {
      href: "/inspeksi",
      label: "Inspeksi Terlambat",
      value: String(d.inspections_late),
      unit: "",
      danger: d.inspections_late > 0,
      extra: <p className="text-xs text-muted-foreground">Jadwal lewat yang belum dikirim</p>,
      foot: "Lihat jadwal →",
    },
    {
      href: "/kejadian",
      label: "Kejadian Terbuka",
      value: String(d.incidents_open),
      unit: "",
      extra: <p className="text-xs text-muted-foreground">{d.incidents_to_classify > 0 ? `${d.incidents_to_classify} menunggu klasifikasi HSE` : "Semua sudah diklasifikasi"}</p>,
      foot: "Lihat kejadian →",
    },
  ].filter(Boolean) as { href: string; label: string; value: string; unit: string; danger?: boolean; extra: React.ReactNode; foot: string }[];
  return (
    <div className="col-span-12 grid grid-cols-2 gap-3 xl:grid-cols-4 [&>*]:min-w-0">
      {cards.map((c) => (
        <Link key={c.label} href={c.href} className={cn("flex flex-col gap-1 rounded-xl border bg-card p-3 transition-colors hover:border-primary/40", c.danger && "border-red-300 bg-red-50/60 dark:border-red-900 dark:bg-red-950/30")}>
          <span className="text-xs text-muted-foreground">{c.label}</span>
          <strong className={cn("text-2xl leading-tight tabular-nums", c.value === "Belum tersedia" && "text-base font-medium text-muted-foreground", c.danger && "text-red-700 dark:text-red-400")}>
            {c.value}
            {c.unit && <small className="ml-1 text-sm font-normal text-muted-foreground">{c.unit}</small>}
          </strong>
          {c.extra}
          <small className="mt-auto pt-1 text-xs text-muted-foreground">{c.foot}</small>
        </Link>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Leading indicator
export async function LeadingBlock({ data, bulan }: { data: Promise<DashboardK3>; bulan: string }) {
  const d = await data;
  const rows = d.leading;
  const max = Math.max(1, ...rows.flatMap((r) => [r.plan, r.actual]));
  const totPlan = rows.reduce((s, r) => s + r.plan, 0);
  const totActual = rows.reduce((s, r) => s + r.actual, 0);
  const pct = achievementPct(totActual, totPlan);
  const cur = rows.at(-1);
  return (
    <Content
      className="col-span-12 min-w-0 lg:col-span-7"
      title="Leading Indicator — Rencana vs Aktual"
      description={`Inspeksi Jan–${MONTH_SHORT[Number(bulan.slice(5)) - 1]} ${bulan.slice(0, 4)}${pct === null ? "" : ` · pencapaian ${pct}%`}`}
      cardAction={
        <Link href="/inspeksi" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          Inspeksi <ArrowRight className="size-4" />
        </Link>
      }
    >
      <div className="mb-2 flex gap-4 text-xs text-muted-foreground" aria-hidden>
        <span className="flex items-center gap-1.5">
          <i className="size-2.5 rounded-sm bg-viz-1" /> Rencana
        </span>
        <span className="flex items-center gap-1.5">
          <i className="size-2.5 rounded-sm bg-viz-2" /> Aktual
        </span>
      </div>
      <div className="flex h-44 items-end gap-1.5 border-b border-viz-axis/40">
        {rows.map((r) => (
          <Link key={r.month} href={`/inspeksi?bulan=${r.month}&tampilan=daftar`} title={`${monthLabel(r.month)}: rencana ${r.plan}, aktual ${r.actual}, observasi ${r.observations}`} className="flex h-full min-w-0 flex-1 flex-col justify-end rounded-t hover:bg-accent/50">
            <span className="flex h-full items-end justify-center gap-[2px]">
              <span className="relative flex h-full w-full max-w-5 items-end">
                <span className="w-full rounded-t-[4px] bg-viz-1" style={{ height: `${(r.plan / max) * 100}%`, minHeight: r.plan ? 2 : 0 }} />
              </span>
              <span className="relative flex h-full w-full max-w-5 items-end">
                <span className="w-full rounded-t-[4px] bg-viz-2" style={{ height: `${(r.actual / max) * 100}%`, minHeight: r.actual ? 2 : 0 }} />
              </span>
            </span>
          </Link>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5 text-[11px] text-muted-foreground" aria-hidden>
        {rows.map((r) => (
          <span key={r.month} className="min-w-0 flex-1 text-center">
            {MONTH_SHORT[Number(r.month.slice(5)) - 1]}
          </span>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {cur ? `${monthLabel(cur.month)}: ${cur.actual} dari ${cur.plan} inspeksi terlaksana · ${cur.observations} observasi KTA/TTA.` : ""} Klik batang untuk membuka daftar bulan itu.
      </p>
      <table className="sr-only">
        <caption>Inspeksi direncanakan dan terlaksana per bulan</caption>
        <thead>
          <tr>
            <th>Bulan</th>
            <th>Rencana</th>
            <th>Aktual</th>
            <th>Observasi</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.month}>
              <td>{monthLabel(r.month)}</td>
              <td>{r.plan}</td>
              <td>{r.actual}</td>
              <td>{r.observations}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Content>
  );
}

// ---------------------------------------------------------------- Status PICA (donut) + Umur Temuan
const PICA_SEGMENTS = [
  { key: "open", label: "Open", stroke: "stroke-blue-500", dot: "bg-blue-500" },
  { key: "in_progress", label: "In Progress", stroke: "stroke-amber-500", dot: "bg-amber-500" },
  { key: "waiting_verification", label: "Menunggu Verifikasi", stroke: "stroke-violet-500", dot: "bg-violet-500" },
  { key: "overdue", label: "Overdue", stroke: "stroke-red-500", dot: "bg-red-500" },
  { key: "closed", label: "Closed", stroke: "stroke-green-600", dot: "bg-green-600" },
] as const;

export async function PicaBlock({ data }: { data: Promise<DashboardK3> }) {
  const d = await data;
  const total = PICA_SEGMENTS.reduce((s, x) => s + d.pica[x.key], 0);
  const R = 38;
  const C = 2 * Math.PI * R;
  let offset = 0;
  const age = [
    { label: "0–7 hari", n: d.findings.age.d0_7 },
    { label: "8–14 hari", n: d.findings.age.d8_14 },
    { label: "15–30 hari", n: d.findings.age.d15_30 },
    { label: "> 30 hari", n: d.findings.age.d31p },
  ];
  const maxAge = Math.max(1, ...age.map((a) => a.n));
  return (
    <div className="col-span-12 flex min-w-0 flex-col gap-4 lg:col-span-5">
      <Content title="Status PICA" description="Tindakan perbaikan dan pencegahan" cardAction={<Link href="/temuan" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">Temuan <ArrowRight className="size-4" /></Link>}>
        <div className="flex items-center gap-5">
          <div className="relative size-32 shrink-0">
            <svg viewBox="0 0 100 100" className="size-full -rotate-90" role="img" aria-label={`Status ${total} tindakan PICA`}>
              <circle cx="50" cy="50" r={R} fill="none" strokeWidth="14" className="stroke-muted" />
              {total > 0 &&
                PICA_SEGMENTS.map((s) => {
                  const n = d.pica[s.key];
                  if (!n) return null;
                  const len = (n / total) * C;
                  const el = <circle key={s.key} cx="50" cy="50" r={R} fill="none" strokeWidth="14" strokeDasharray={`${Math.max(len - 1.5, 0.5)} ${C}`} strokeDashoffset={-offset} className={s.stroke} />;
                  offset += len;
                  return el;
                })}
            </svg>
            <span className="absolute inset-0 flex flex-col items-center justify-center">
              <strong className="text-2xl tabular-nums">{total}</strong>
              <span className="text-[11px] text-muted-foreground">tindakan</span>
            </span>
          </div>
          <ul className="min-w-0 flex-1 space-y-1.5 text-sm">
            {PICA_SEGMENTS.map((s) => (
              <li key={s.key} className="flex items-center gap-2">
                <i className={cn("size-2.5 shrink-0 rounded-full", s.dot)} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{s.label}</span>
                <strong className="tabular-nums">{d.pica[s.key]}</strong>
              </li>
            ))}
          </ul>
        </div>
      </Content>
      <Content title="Umur Temuan Terbuka" description={`${d.findings.open} temuan belum Closed`} cardAction={<Link href="/temuan" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">Temuan <ArrowRight className="size-4" /></Link>}>
        <ul className="space-y-1.5">
          {age.map((a) => (
            <li key={a.label} className="grid grid-cols-[5.5rem_1fr_2rem] items-center gap-2 text-sm">
              <span className="text-muted-foreground">{a.label}</span>
              <span className="h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                <span className="block h-full rounded-full bg-viz-1" style={{ width: `${(a.n / maxAge) * 100}%` }} />
              </span>
              <span className="text-right font-medium tabular-nums">{a.n}</span>
            </li>
          ))}
        </ul>
      </Content>
    </div>
  );
}

// ---------------------------------------------------------------- variant Karyawan
export async function MyReports({ supabase, userId }: { supabase: ServerClient; userId: string }) {
  const { data } = await supabase.from("incidents").select("id, code, description, status, reported_at").eq("created_by", userId).order("reported_at", { ascending: false }).limit(5);
  return (
    <Content title="Laporan Saya" cardAction={<Link href="/kejadian" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">Semua <ArrowRight className="size-4" /></Link>}>
      {(data ?? []).length ? (
        <ul className="divide-y rounded-lg border">
          {(data ?? []).map((r) => (
            <li key={r.id}>
              <Link href={`/kejadian/${r.id}`} className="flex items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-accent/50">
                <ShieldAlert className="size-4 shrink-0 text-muted-foreground" />
                <span className="font-mono text-xs font-semibold text-primary">{r.code}</span>
                <span className="min-w-0 flex-1 truncate">{r.description}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(r.reported_at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-4 text-center text-sm text-muted-foreground">Anda belum membuat laporan kejadian.</p>
      )}
    </Content>
  );
}

export function UpdatedAt({ at }: { at: Date }) {
  return (
    <p className="col-span-12 flex items-center gap-1.5 text-xs text-muted-foreground">
      <CalendarClock className="size-3.5" /> Diperbarui {at.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })} WIB. Angka mengikuti site yang dipilih di top bar.
    </p>
  );
}
