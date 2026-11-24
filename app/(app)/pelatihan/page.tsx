import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { StatusBadge } from "@/components/detail/status-badge";
import { Content } from "@/components/list/content";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireAccess } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { listCompetencies } from "@/lib/manpower";
import { listTrainings, parseTrainingParams } from "@/lib/pelatihan";
import { TRAINING_STATUS, TRAINING_STATUS_FILTERS } from "@/lib/pelatihan-rules";
import { hrefWith } from "@/lib/search-params";
import { parseSiteParam } from "@/lib/sites";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { TrainingSheet } from "./training-sheets";

export const metadata: Metadata = { title: "Pelatihan" };

const FILTER_LABEL: Record<(typeof TRAINING_STATUS_FILTERS)[number], string> = { semua: "Semua", planned: "Direncanakan", done: "Selesai", cancelled: "Dibatalkan" };

// Rencana & kalender pelatihan (rancangan §4.6). Peserta, kehadiran, dan bukti ada di /pelatihan/[id].
export default async function PelatihanPage({ searchParams }: PageProps<"/pelatihan">) {
  const access = await requireAccess("viewer");
  const isAdmin = access.role === "admin" || access.platformAdmin;
  if (!isAdmin && !access.functions.some((f) => f !== "karyawan")) redirect("/");
  const sp = await searchParams;
  const { siteId, label, sites } = await parseSiteParam(sp, access);
  const p = parseTrainingParams(sp, siteId);
  const supabase = await createClient();
  const [rows, comps] = await Promise.all([listTrainings(supabase, p), listCompetencies(supabase)]);
  const canManage = isAdmin || (!access.functions.includes("auditor") && (access.functions.includes("hr") || access.functions.includes("hse")));
  const formSite = siteId ?? (access.profile.locationId && sites.some((s) => s.id === access.profile.locationId) ? access.profile.locationId : sites[0]?.id);
  const href = (c: Record<string, string | null>) => hrefWith("/pelatihan", sp, c);
  const planned = rows.filter((r) => r.status === "planned").length;

  return (
    <>
      <PageHeader
        title="Pelatihan"
        description={`Rencana, peserta, dan kehadiran pelatihan · ${label}`}
        actions={
          <>
            <Link href="/kompetensi" className="text-sm underline underline-offset-2">Matriks Kompetensi</Link>
            {canManage && formSite && (
              <TrainingSheet trigger={<Button><Plus /> Rencanakan Pelatihan</Button>} siteId={formSite} competencies={comps.filter((c) => c.isActive).map((c) => ({ value: c.id, label: c.name }))} />
            )}
          </>
        }
      />
      <div className="col-span-12 flex flex-wrap items-center gap-1.5">
        {TRAINING_STATUS_FILTERS.map((s) => (
          <Link key={s} href={href({ status: s === "semua" ? null : s })} aria-pressed={p.status === s} className={cn("rounded-full border px-2.5 py-0.5 text-xs", p.status === s ? "border-primary bg-primary/5 font-medium text-primary" : "hover:bg-accent")}>
            {FILTER_LABEL[s]}
          </Link>
        ))}
        <form method="get" className="ml-auto flex gap-2">
          {p.status !== "semua" && <input type="hidden" name="status" value={p.status} />}
          <input name="q" defaultValue={p.q} placeholder="Cari judul" aria-label="Cari judul" className="h-8 w-48 rounded-md border bg-background px-2 text-sm" />
        </form>
      </div>
      <Content title="Daftar Pelatihan" description={`${rows.length} pelatihan · ${planned} direncanakan`}>
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Belum ada pelatihan untuk filter ini.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>{["Nomor", "Judul", "Kompetensi", "Tanggal", "Tempat", "Peserta", "Status"].map((h) => <th key={h} scope="col" className="px-3 py-2 text-left font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t hover:bg-accent/30">
                    <td className="px-3 py-2 tabular-nums whitespace-nowrap">{r.code}</td>
                    <td className="px-3 py-2 font-medium"><Link href={`/pelatihan/${r.id}`} className="underline underline-offset-2">{r.title}</Link>{r.provider && <small className="block text-xs font-normal text-muted-foreground">{r.provider}</small>}</td>
                    <td className="px-3 py-2">{r.competencyName ?? "-"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(r.startsOn)}{r.endsOn !== r.startsOn && ` – ${formatDate(r.endsOn)}`}</td>
                    <td className="px-3 py-2">{r.venue ?? "-"}</td>
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums">{r.participants}{r.capacity ? `/${r.capacity}` : ""}{r.status === "done" && <small className="ml-1 text-muted-foreground">({r.present} hadir)</small>}</td>
                    <td className="px-3 py-2"><StatusBadge value={r.status} map={TRAINING_STATUS} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Content>
    </>
  );
}
