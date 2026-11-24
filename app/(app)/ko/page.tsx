import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { ExpiryChip } from "@/components/expiry-chip";
import { Content } from "@/components/list/content";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireAccess } from "@/lib/auth";
import { listKo, parseKoParams } from "@/lib/dokumen";
import { KO_FILTERS, koKindLabel } from "@/lib/dokumen-rules";
import { getK3People } from "@/lib/k3";
import { hrefWith } from "@/lib/search-params";
import { parseSiteParam } from "@/lib/sites";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { KoFilesButton, KoSheet } from "../dokumen/dokumen-sheets";

export const metadata: Metadata = { title: "Register KO" };

const FILTER_LABEL: Record<(typeof KO_FILTERS)[number], string> = { semua: "Semua", expiring: "Akan Kedaluwarsa", expired: "Kedaluwarsa" };

// Register Keselamatan Operasi (KO): izin operasi, sertifikasi alat, sarana, dokumen teknis + masa berlakunya.
export default async function KoPage({ searchParams }: PageProps<"/ko">) {
  const access = await requireAccess("viewer");
  const isAdmin = access.role === "admin" || access.platformAdmin;
  if (!isAdmin && !access.functions.some((f) => f !== "karyawan")) redirect("/");
  const sp = await searchParams;
  const { siteId, label, sites } = await parseSiteParam(sp, access);
  const p = parseKoParams(sp, siteId);
  const supabase = await createClient();
  const canManage = isAdmin || (!access.functions.includes("auditor") && (access.functions.includes("hse") || access.functions.includes("hse_senior")));
  const [rows, people] = await Promise.all([listKo(supabase, p), canManage ? getK3People(supabase) : Promise.resolve([])]);
  const formSite = siteId ?? (access.profile.locationId && sites.some((s) => s.id === access.profile.locationId) ? access.profile.locationId : sites[0]?.id);
  const href = (c: Record<string, string | null>) => hrefWith("/ko", sp, c);

  return (
    <>
      <PageHeader
        title="Register KO"
        description={`Register Keselamatan Operasi: izin, sertifikasi, dan dokumen teknis · ${label}`}
        actions={
          <>
            <Link href="/dokumen" className="text-sm underline underline-offset-2">Prosedur & Dokumen</Link>
            {canManage && formSite && <KoSheet trigger={<Button><Plus /> Tambah Item KO</Button>} siteId={formSite} people={people} />}
          </>
        }
      />
      <div className="col-span-12 flex flex-wrap items-center gap-1.5">
        {KO_FILTERS.map((f) => (
          <Link key={f} href={href({ status: f === "semua" ? null : f })} aria-pressed={p.filter === f} className={cn("rounded-full border px-2.5 py-0.5 text-xs", p.filter === f ? "border-primary bg-primary/5 font-medium text-primary" : "hover:bg-accent")}>
            {FILTER_LABEL[f]}
          </Link>
        ))}
        <form method="get" className="ml-auto flex gap-2">
          {p.filter !== "semua" && <input type="hidden" name="status" value={p.filter} />}
          <input name="q" defaultValue={p.q} placeholder="Cari nomor KO / judul" aria-label="Cari" className="h-8 w-48 rounded-md border bg-background px-2 text-sm" />
        </form>
      </div>
      <Content title="Daftar Item KO" description={`${rows.length} item`}>
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Tidak ada item untuk filter ini.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground"><tr>{["Nomor KO", "Judul", "Jenis", "Nomor Izin", "Penanggung Jawab", "Masa Berlaku", "File", ""].map((h, i) => <th key={i} scope="col" className="px-3 py-2 text-left font-medium">{h}</th>)}</tr></thead>
              <tbody>
                {rows.map((k) => (
                  <tr key={k.id} className="border-t hover:bg-accent/30">
                    <td className="px-3 py-2 tabular-nums whitespace-nowrap">{k.code}</td>
                    <td className="px-3 py-2 font-medium">{k.title}{k.notes && <small className="block text-xs font-normal text-muted-foreground">{k.notes}</small>}</td>
                    <td className="px-3 py-2">{koKindLabel(k.kind)}</td>
                    <td className="px-3 py-2">{k.number ?? "-"}</td>
                    <td className="px-3 py-2">{k.ownerName ?? "-"}</td>
                    <td className="px-3 py-2"><ExpiryChip expiry={k.expiry} /></td>
                    <td className="px-3 py-2"><KoFilesButton koId={k.id} count={k.evidence} canUpload={canManage} /></td>
                    <td className="px-3 py-2">{canManage && <KoSheet trigger={<Button variant="ghost" size="icon-sm" aria-label={`Ubah ${k.code}`}><Pencil /></Button>} siteId={k.siteId} companyCode={k.companyCode} people={people} item={{ id: k.id, title: k.title, kind: k.kind, number: k.number, ownerId: k.ownerId, validUntil: k.validUntil, notes: k.notes }} />}</td>
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
