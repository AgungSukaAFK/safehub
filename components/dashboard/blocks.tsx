// Blok Beranda (Server Component). Tiap blok mengambil datanya sendiri dan dibungkus <Suspense>
// di page.tsx supaya sapaan & "Perlu Aksi" tampil dulu tanpa menunggu grafik (streaming).
import "server-only";
import Link from "next/link";
import { AlertTriangle, ArrowRight, BellRing, ClipboardCheck, FilePen, FileX, Sparkles } from "lucide-react";
import { StatusBadge } from "@/components/detail/status-badge";
import { Content } from "@/components/list/content";
import { Skeleton } from "@/components/ui/skeleton";
import { getActivityFeed, getUnseenUpdate, getByDepartment, getDaily, getSummary, pengajuanListHref, type DashboardPeriod } from "@/lib/dashboard";
import { STAT_STATUS, type StatKey } from "@/lib/dashboard-types";
import { formatDate, formatRupiah, timeAgo } from "@/lib/format";
import { listPengajuan, parsePengajuanParams } from "@/lib/pengajuan";
import type { ServerClient } from "@/lib/supabase/server";
import { DOCUMENT_STATUS } from "@/lib/status";
import { cn } from "@/lib/utils";
import { ActivityFeed } from "./activity-feed";
import { DepartmentCard, TrendCard } from "./charts";
import { StatCards } from "./stat-cards";

const MAX_DEPT_BARS = 8;

// ---------------------------------------------------------------- 2. banner Pembaruan

export async function UpdateBanner({ supabase, userId }: { supabase: ServerClient; userId: string }) {
  const u = await getUnseenUpdate(supabase, userId);
  if (!u) return null;
  return (
    <Link
      href="/pembaruan"
      className="col-span-12 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm transition-colors hover:bg-primary/10"
    >
      <span className="relative flex size-2.5 shrink-0" aria-hidden>
        <span className="absolute inline-flex size-full rounded-full bg-primary opacity-60 motion-safe:animate-ping" />
        <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
      </span>
      <Sparkles className="size-4 shrink-0 text-primary" aria-hidden />
      <span className="min-w-0 flex-1 truncate">
        <span className="font-medium">Versi {u.version}:</span> {u.title}
      </span>
      <span className="shrink-0 font-medium text-primary">Lihat</span>
    </Link>
  );
}

// ---------------------------------------------------------------- 3–4. follow-up & perlu aksi

type ActionItem = { key: string; href: string; title: string; sub: string; icon: typeof ClipboardCheck; tone: "red" | "amber" | "blue" | "gray" };

const TONE: Record<ActionItem["tone"], string> = {
  red: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  blue: "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
  gray: "bg-muted text-muted-foreground",
};

function ActionCard({ item }: { item: ActionItem }) {
  return (
    <Link href={item.href} className="group flex items-center gap-3 rounded-lg border bg-background p-3 transition-colors hover:border-primary/40 hover:bg-muted/40">
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", TONE[item.tone])}>
        <item.icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{item.title}</span>
        <span className="block truncate text-xs text-muted-foreground">{item.sub}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

export async function ActionNeeded({ supabase, userId }: { supabase: ServerClient; userId: string }) {
  const [queue, mine] = await Promise.all([
    supabase.rpc("pending_for_me", { p_limit: 30 }),
    supabase
      .from("pengajuan")
      .select("id, code, title, status, updated_at")
      .eq("created_by", userId)
      .in("status", ["draft", "rejected"])
      .order("updated_at", { ascending: false })
      .limit(6),
  ]);
  const rows = queue.data ?? [];
  const followups = rows.filter((r) => r.followup_count > 0);
  const waiting = rows.filter((r) => r.followup_count === 0);

  const items: ActionItem[] = [
    ...waiting.slice(0, 6).map(
      (r): ActionItem => ({
        key: r.approval_id,
        href: r.href,
        title: `${r.doc_label} · ${r.approval_type === "memeriksa" ? "periksa" : "setujui"}`,
        sub: `Langkah ${r.step_no} · menunggu ${timeAgo(r.waiting_since)}`,
        icon: ClipboardCheck,
        tone: "amber",
      }),
    ),
    ...(mine.data ?? []).map(
      (d): ActionItem => ({
        key: d.id,
        href: d.status === "rejected" ? `/pengajuan/${d.id}/ubah` : `/pengajuan/${d.id}`,
        title: d.status === "rejected" ? `Perbaiki ${d.code ?? d.title}` : `Ajukan draft "${d.title}"`,
        sub: d.status === "rejected" ? "Ditolak, ubah lalu ajukan ulang" : `Draft terakhir diubah ${timeAgo(d.updated_at)}`,
        icon: d.status === "rejected" ? FileX : FilePen,
        tone: d.status === "rejected" ? "red" : "gray",
      }),
    ),
  ];

  return (
    <>
      {followups.length > 0 && (
        <section className="col-span-12 rounded-xl border border-red-300 bg-red-50/60 p-4 shadow-sm dark:border-red-900 dark:bg-red-950/30">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-red-700 dark:text-red-300">
            <BellRing className="size-4" /> Permintaan Follow-up ({followups.length})
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {followups.map((r) => (
              <ActionCard
                key={r.approval_id}
                item={{
                  key: r.approval_id,
                  href: r.href,
                  title: r.doc_label,
                  sub: `Diingatkan ${r.followup_count}× · terakhir ${timeAgo(r.last_followup_at)}`,
                  icon: AlertTriangle,
                  tone: "red",
                }}
              />
            ))}
          </div>
        </section>
      )}
      <Content
        title="Perlu Aksi Anda"
        description={items.length ? "Diurutkan dari yang paling lama menunggu." : undefined}
        cardAction={
          waiting.length > 6 && (
            <Link href="/tugas" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              Semua ({waiting.length}) <ArrowRight className="size-4" />
            </Link>
          )
        }
      >
        {items.length ? (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((i) => (
              <ActionCard key={i.key} item={i} />
            ))}
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">Tidak ada yang perlu Anda kerjakan sekarang.</p>
        )}
      </Content>
    </>
  );
}

// ---------------------------------------------------------------- 6. stat card

export async function SummaryBlock({ supabase, period }: { supabase: ServerClient; period: DashboardPeriod }) {
  const summary = await getSummary(supabase, period);
  const listHrefs = Object.fromEntries(
    (Object.keys(STAT_STATUS) as StatKey[]).map((k) => {
      const status = STAT_STATUS[k];
      return [k, pengajuanListHref(period, { ...(status ? { status } : {}), ...(k === "amount_approved" ? { urut: "total.desc" } : {}) })];
    }),
  ) as Record<StatKey, string>;
  return <StatCards summary={summary} period={period} listHrefs={listHrefs} />;
}

// ---------------------------------------------------------------- 7. grafik & insight

export async function ChartsBlock({ supabase, period, prevHref }: { supabase: ServerClient; period: DashboardPeriod; prevHref: string }) {
  const [daily, depts] = await Promise.all([getDaily(supabase, period), getByDepartment(supabase, period)]);
  // > 8 kategori dilipat jadi "Lainnya" (tidak bisa diklik)
  const top = depts.slice(0, MAX_DEPT_BARS - (depts.length > MAX_DEPT_BARS ? 1 : 0));
  const rest = depts.slice(top.length);
  const bars = [
    ...top.map((d) => ({ key: d.id ?? "none", name: d.name, total: d.total, amount: d.amount, clickable: !!d.id })),
    ...(rest.length
      ? [{ key: "other", name: `Lainnya (${rest.length})`, total: rest.reduce((s, d) => s + d.total, 0), amount: rest.reduce((s, d) => s + d.amount, 0), clickable: false }]
      : []),
  ];
  const scope = { from: period.from, to: period.to, company: period.company };
  return (
    <>
      <TrendCard data={daily} period={scope} prevHref={prevHref} />
      <DepartmentCard data={bars} period={scope} prevHref={prevHref} />
    </>
  );
}

export async function InsightBlock({ supabase, period, companies }: { supabase: ServerClient; period: DashboardPeriod; companies: string[] }) {
  const base = { dari: period.from, sampai: period.to, perusahaan: period.company ?? undefined, baris: "10" };
  const [top, recent] = await Promise.all([
    listPengajuan(supabase, { ...parsePengajuanParams({ ...base, urut: "total.desc" }, companies), size: 5 }),
    listPengajuan(supabase, { ...parsePengajuanParams({ urut: "tanggal.desc", perusahaan: period.company ?? undefined }, companies), size: 5 }),
  ]);
  return (
    <>
      <Content
        size="md"
        title="Pengajuan terbesar"
        description="Lima nilai tertinggi yang dibuat di periode ini."
        cardAction={
          top.total > 5 && (
            <Link href={pengajuanListHref(period, { urut: "total.desc" })} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              Lihat detail <ArrowRight className="size-4" />
            </Link>
          )
        }
      >
        {top.rows.length ? (
          <ol className="divide-y">
            {top.rows.map((r, i) => (
              <li key={r.id}>
                <Link href={`/pengajuan/${r.id}`} className="flex items-center gap-3 py-2.5 hover:bg-muted/40">
                  <span className="w-4 text-center text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[r.code ?? "Draft", r.departmentName, r.requester?.name].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">{formatRupiah(r.total)}</span>
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">Belum ada data di periode ini.</p>
        )}
      </Content>
      <Content
        size="md"
        title="Terbaru"
        description="Pengajuan terakhir yang bisa Anda lihat."
        cardAction={
          <Link href="/pengajuan" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            Semua <ArrowRight className="size-4" />
          </Link>
        }
      >
        {recent.rows.length ? (
          <ul className="divide-y">
            {recent.rows.map((r) => (
              <li key={r.id}>
                <Link href={`/pengajuan/${r.id}`} className="flex items-center gap-3 py-2.5 hover:bg-muted/40">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.code ?? "Draft"}</span>
                    <span className="block truncate text-xs text-muted-foreground">{r.title}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <StatusBadge value={r.status} map={DOCUMENT_STATUS} />
                    <span className="text-[11px] text-muted-foreground">{formatDate(r.createdAt)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">Belum ada pengajuan.</p>
        )}
      </Content>
    </>
  );
}

// ---------------------------------------------------------------- 8. feed

const FEED_SIZE = 15;

export async function FeedBlock({ supabase }: { supabase: ServerClient }) {
  const items = await getActivityFeed(supabase, FEED_SIZE);
  return (
    <Content title="Aktivitas terbaru" description="Semua perubahan dokumen yang bisa Anda lihat.">
      <ActivityFeed initial={items} pageSize={FEED_SIZE} />
    </Content>
  );
}

// ---------------------------------------------------------------- skeleton (bentuk kartu/grafik)

export function CardsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="col-span-12 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

export function BlockSkeleton({ size = "md", height = "h-64" }: { size?: "md" | "lg"; height?: string }) {
  return (
    <div className={cn("col-span-12 space-y-4 rounded-xl border bg-card p-5 shadow-sm", size === "md" && "lg:col-span-6")}>
      <Skeleton className="h-5 w-40" />
      <Skeleton className={cn("w-full", height)} />
    </div>
  );
}
