import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Content } from "@/components/list/content";
import { buttonVariants } from "@/components/ui/button";
import { requireAccess } from "@/lib/auth";
import { AUDIT_ENTITIES, AUDIT_ENTITY_OPTIONS, AUDIT_PAGE_SIZE, summarizeChanges } from "@/lib/audit-rules";
import { formatDateTime } from "@/lib/format";
import { getK3People } from "@/lib/k3";
import { getPeople } from "@/lib/people";
import { textParam } from "@/lib/search-params";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Audit Trail" };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ACTION = /^[a-z][a-z0-9_]{1,40}$/;

// Audit Trail (rancangan §4.13): gabungan semua riwayat perubahan. Admin dan Auditor; mengikuti RLS log masing-masing.
export default async function AuditPage({ searchParams }: PageProps<"/audit">) {
  const access = await requireAccess("viewer");
  if (!(access.role === "admin" || access.platformAdmin || access.functions.includes("auditor"))) redirect("/");
  const sp = await searchParams;
  const entitas = textParam(sp, "entitas");
  const aksi = textParam(sp, "aksi");
  const pelaku = textParam(sp, "pelaku");
  const dari = textParam(sp, "dari");
  const sampai = textParam(sp, "sampai");
  const sebelum = textParam(sp, "sebelum", 40);
  const entities = entitas in AUDIT_ENTITIES ? [entitas] : undefined;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("audit_trail", {
    p_entities: entities,
    p_actor: /^[0-9a-f-]{36}$/.test(pelaku) ? pelaku : undefined,
    p_action: ACTION.test(aksi) ? aksi : undefined,
    p_from: DATE.test(dari) ? `${dari}T00:00:00+07:00` : undefined,
    p_to: DATE.test(sampai) ? new Date(Date.parse(`${sampai}T00:00:00+07:00`) + 86_400_000).toISOString() : undefined,
    p_before: sebelum && !Number.isNaN(Date.parse(sebelum)) ? new Date(sebelum).toISOString() : undefined,
    p_limit: AUDIT_PAGE_SIZE,
  });
  if (error) throw error;
  const all = data ?? [];
  const hasMore = all.length > AUDIT_PAGE_SIZE;
  const rows = all.slice(0, AUDIT_PAGE_SIZE);
  const [people, options] = await Promise.all([getPeople(supabase, rows.map((r) => r.actor_id)), getK3People(supabase)]);

  const keep = new URLSearchParams();
  for (const [k, v] of Object.entries({ entitas, aksi, pelaku, dari, sampai })) if (v) keep.set(k, v);
  const nextQs = new URLSearchParams(keep);
  if (hasMore) nextQs.set("sebelum", rows[rows.length - 1].at);

  return (
    <>
      <PageHeader title="Audit Trail" description="Riwayat perubahan seluruh modul. Event keamanan ada di CCTV platform." />
      <Content>
        <form method="get" className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6" aria-label="Filter audit trail">
          <label className="space-y-1 text-xs text-muted-foreground">
            Entitas
            <select name="entitas" defaultValue={entitas} className="block h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground">
              <option value="">Semua entitas</option>
              {AUDIT_ENTITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            Pelaku
            <select name="pelaku" defaultValue={pelaku} className="block h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground">
              <option value="">Semua pelaku</option>
              {options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            Aksi (kode)
            <input name="aksi" defaultValue={aksi} placeholder="mis. approve" className="block h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground" />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            Dari
            <input type="date" name="dari" defaultValue={dari} className="block h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground" />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            Sampai
            <input type="date" name="sampai" defaultValue={sampai} className="block h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground" />
          </label>
          <div className="flex items-end gap-2">
            <button type="submit" className={buttonVariants()}>Terapkan</button>
            <Link href="/audit" className={buttonVariants({ variant: "outline" })}>Reset</Link>
          </div>
        </form>

        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Tidak ada riwayat untuk filter ini.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Waktu</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Pelaku</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Entitas</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Aksi</th>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Perubahan / catatan</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const meta = AUDIT_ENTITIES[r.entity];
                  const href = meta?.href?.(r.record_id);
                  const summary = summarizeChanges(r.changes);
                  return (
                    <tr key={`${r.entity}-${r.id}`} className="border-t align-top">
                      <td className="px-3 py-2 whitespace-nowrap tabular-nums">{formatDateTime(r.at)}</td>
                      <td className="px-3 py-2">{r.actor_id ? (people.get(r.actor_id)?.name ?? "—") : "Sistem"}</td>
                      <td className="px-3 py-2">
                        {href ? (
                          <Link href={href} className="underline underline-offset-2">{meta.label}</Link>
                        ) : (
                          (meta?.label ?? r.entity)
                        )}
                      </td>
                      <td className="px-3 py-2"><code className="rounded bg-muted px-1.5 py-0.5 text-xs">{r.action}</code></td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {summary && <span className="block">{summary}</span>}
                        {r.note && <span className="block text-foreground">{r.note}</span>}
                        {!summary && !r.note && "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {hasMore && (
          <div className="mt-3 flex justify-center">
            <Link href={`/audit?${nextQs}`} className={buttonVariants({ variant: "outline" })}>Muat lebih lama</Link>
          </div>
        )}
      </Content>
    </>
  );
}
