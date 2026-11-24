import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { StatusBadge } from "@/components/detail/status-badge";
import { ExpiryChip } from "@/components/expiry-chip";
import { Content } from "@/components/list/content";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireAccess } from "@/lib/auth";
import { listRegulations } from "@/lib/dokumen";
import { COMPLIANCE_OPTIONS, REGULATION_COMPLIANCE } from "@/lib/dokumen-rules";
import { formatDate } from "@/lib/format";
import { getAreas, getK3Masters, getK3People } from "@/lib/k3";
import { hrefWith, textParam } from "@/lib/search-params";
import { parseSiteParam } from "@/lib/sites";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { EvaluationSheet, MakeFindingSheet, RegulationSheet } from "../dokumen/dokumen-sheets";

export const metadata: Metadata = { title: "Evaluasi Peraturan" };

// Evaluasi kesesuaian peraturan (rancangan §4.8): pasal, kesesuaian, tindak lanjut → bisa dijadikan temuan.
export default async function PeraturanPage({ searchParams }: PageProps<"/peraturan">) {
  const access = await requireAccess("viewer");
  const isAdmin = access.role === "admin" || access.platformAdmin;
  if (!isAdmin && !access.functions.some((f) => f !== "karyawan")) redirect("/");
  const sp = await searchParams;
  const { siteId, label, sites } = await parseSiteParam(sp, access);
  const q = textParam(sp, "q");
  const compliance = textParam(sp, "kesesuaian") || "semua";
  const supabase = await createClient();
  const canManage = isAdmin || (!access.functions.includes("auditor") && (access.functions.includes("hse") || access.functions.includes("hse_senior")));
  const [regs, areas, people, masters] = await Promise.all([
    listRegulations(supabase, { q, site: siteId, compliance }),
    canManage ? getAreas(supabase) : Promise.resolve([]),
    canManage ? getK3People(supabase) : Promise.resolve([]),
    canManage ? getK3Masters(supabase) : Promise.resolve(null),
  ]);
  const href = (c: Record<string, string | null>) => hrefWith("/peraturan", sp, c);
  const siteOptions = sites.map((s) => ({ value: s.id, label: s.name }));
  const risks = (masters?.riskLevels ?? []).filter((r) => r.isActive).map((r) => ({ value: r.value, label: r.label }));
  const all = regs.flatMap((r) => r.evaluations);
  const gap = all.filter((e) => (e.compliance === "partial" || e.compliance === "non_compliant") && !e.findingId).length;

  return (
    <>
      <PageHeader
        title="Evaluasi Peraturan"
        description={`Kesesuaian pelaksanaan terhadap peraturan · ${label}`}
        actions={
          <>
            <Link href="/dokumen" className="text-sm underline underline-offset-2">Prosedur & Dokumen</Link>
            {canManage && <RegulationSheet trigger={<Button><Plus /> Tambah Peraturan</Button>} />}
          </>
        }
      />
      <section className="col-span-12 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Ringkasan evaluasi">
        {(["compliant", "partial", "non_compliant"] as const).map((c) => (
          <div key={c} className="rounded-xl border bg-card p-4">
            <span className="text-xs text-muted-foreground">{REGULATION_COMPLIANCE[c].label}</span>
            <strong className="block text-3xl tabular-nums">{all.filter((e) => e.compliance === c).length}</strong>
          </div>
        ))}
        <div className={cn("rounded-xl border bg-card p-4", gap > 0 && "border-amber-300 dark:border-amber-900")}>
          <span className="text-xs text-muted-foreground">Belum ditindaklanjuti</span>
          <strong className="block text-3xl tabular-nums">{gap}</strong>
          <small className="text-xs text-muted-foreground">Sebagian / Tidak Sesuai tanpa temuan</small>
        </div>
      </section>
      <div className="col-span-12 flex flex-wrap items-center gap-1.5">
        {[{ value: "semua", label: "Semua" }, ...COMPLIANCE_OPTIONS].map((o) => (
          <Link key={o.value} href={href({ kesesuaian: o.value === "semua" ? null : o.value })} aria-pressed={compliance === o.value} className={cn("rounded-full border px-2.5 py-0.5 text-xs", compliance === o.value ? "border-primary bg-primary/5 font-medium text-primary" : "hover:bg-accent")}>
            {o.label}
          </Link>
        ))}
        <form method="get" className="ml-auto flex gap-2">
          {compliance !== "semua" && <input type="hidden" name="kesesuaian" value={compliance} />}
          <input name="q" defaultValue={q} placeholder="Cari nomor / judul" aria-label="Cari" className="h-8 w-48 rounded-md border bg-background px-2 text-sm" />
        </form>
      </div>
      {regs.length === 0 && <p className="col-span-12 rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Belum ada peraturan untuk filter ini.</p>}
      {regs.map((r) => (
        <Content
          key={r.id}
          title={r.code}
          description={`${r.title}${r.issuer ? ` · ${r.issuer}` : ""}${r.issuedOn ? ` · ${formatDate(r.issuedOn)}` : ""}${r.isActive ? "" : " · nonaktif"}`}
          cardAction={
            canManage ? (
              <div className="flex gap-2">
                <RegulationSheet trigger={<Button variant="ghost" size="icon-sm" aria-label={`Ubah ${r.code}`}><Pencil /></Button>} regulation={{ id: r.id, code: r.code, title: r.title, issuer: r.issuer, issuedOn: r.issuedOn, isActive: r.isActive }} />
                <EvaluationSheet trigger={<Button size="sm" variant="outline"><Plus /> Evaluasi</Button>} regulationId={r.id} sites={siteOptions} />
              </div>
            ) : undefined
          }
        >
          {r.evaluations.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada evaluasi.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground"><tr>{["Pasal", "Persyaratan", "Kesesuaian", "Evaluasi", "Berikutnya", "Tindak lanjut", ""].map((h, i) => <th key={i} scope="col" className="px-3 py-2 text-left font-medium">{h}</th>)}</tr></thead>
                <tbody>
                  {r.evaluations.map((e) => (
                    <tr key={e.id} className="border-t align-top">
                      <td className="px-3 py-2 whitespace-nowrap font-medium">{e.clause}</td>
                      <td className="px-3 py-2">{e.requirement}</td>
                      <td className="px-3 py-2"><StatusBadge value={e.compliance} map={REGULATION_COMPLIANCE} /></td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(e.evaluatedOn)}</td>
                      <td className="px-3 py-2">{e.nextReview.validUntil ? <ExpiryChip expiry={e.nextReview} /> : "-"}</td>
                      <td className="px-3 py-2">
                        {e.followUp ?? "-"}
                        {e.findingId && <Link href={`/temuan/${e.findingId}`} className="mt-1 block text-xs underline underline-offset-2">Temuan {e.findingCode}</Link>}
                      </td>
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-1">
                          {canManage && !e.findingId && (e.compliance === "partial" || e.compliance === "non_compliant") && (
                            <MakeFindingSheet trigger={<Button size="sm" variant="outline">Jadikan Temuan</Button>} evaluationId={e.id} areas={areas.filter((a) => a.siteId === e.siteId && a.isActive).map((a) => ({ value: a.value, label: a.label }))} people={people} risks={risks} />
                          )}
                          {canManage && <EvaluationSheet trigger={<Button variant="ghost" size="icon-sm" aria-label={`Ubah evaluasi ${e.clause}`}><Pencil /></Button>} regulationId={r.id} sites={siteOptions} evaluation={{ id: e.id, siteId: e.siteId, clause: e.clause, requirement: e.requirement, compliance: e.compliance, evaluatedOn: e.evaluatedOn, followUp: e.followUp, nextReview: e.nextReview.validUntil }} />}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Content>
      ))}
    </>
  );
}
