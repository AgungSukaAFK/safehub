import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { ExpiryChip } from "@/components/expiry-chip";
import { Content } from "@/components/list/content";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireAccess } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { listAppointments } from "@/lib/kontraktor";
import { APPOINTMENT_ROLE } from "@/lib/kontraktor-rules";
import { enumParam, hrefWith, textParam } from "@/lib/search-params";
import { parseSiteParam } from "@/lib/sites";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { AppointmentSheet, KontraktorEvidenceSheet } from "../kontraktor/kontraktor-sheets";

export const metadata: Metadata = { title: "PJO/PJA" };

const ROLES = ["semua", "pjo", "pja"] as const;

// Register penunjukan PJO/PJA (rancangan §4.7): orang, lingkup, nomor SK, masa berlaku, file SK.
export default async function PjoPjaPage({ searchParams }: PageProps<"/pjo-pja">) {
  const access = await requireAccess("viewer");
  const isAdmin = access.role === "admin" || access.platformAdmin;
  if (!isAdmin && !access.functions.some((f) => f !== "karyawan")) redirect("/");
  const sp = await searchParams;
  const { siteId, label } = await parseSiteParam(sp, access);
  const role = enumParam(sp, "peran", ROLES, "semua");
  const q = textParam(sp, "q");
  const supabase = await createClient();
  const canManage = isAdmin || (!access.functions.includes("auditor") && (access.functions.includes("kontraktor_admin") || access.functions.includes("hse")));
  const [rows, emps] = await Promise.all([
    listAppointments(supabase, siteId, { role, q }),
    canManage ? supabase.from("employees").select("id, code, name, job_title").eq("status", "active").order("name").limit(500) : Promise.resolve({ data: [] as { id: string; code: string; name: string; job_title: string }[] }),
  ]);
  const href = (c: Record<string, string | null>) => hrefWith("/pjo-pja", sp, c);
  const options = (emps.data ?? []).map((e) => ({ value: e.id, label: `${e.name} (${e.code})`, description: e.job_title }));

  return (
    <>
      <PageHeader
        title="PJO / PJA"
        description={`Register penunjukan Penanggung Jawab Operasional dan Area · ${label}`}
        actions={
          <>
            <Link href="/kontraktor" className="text-sm underline underline-offset-2">Kontraktor</Link>
            {canManage && <AppointmentSheet trigger={<Button><Plus /> Tetapkan PJO/PJA</Button>} employees={options} />}
          </>
        }
      />
      <div className="col-span-12 flex flex-wrap items-center gap-1.5">
        {ROLES.map((r) => (
          <Link key={r} href={href({ peran: r === "semua" ? null : r })} aria-pressed={role === r} className={cn("rounded-full border px-2.5 py-0.5 text-xs", role === r ? "border-primary bg-primary/5 font-medium text-primary" : "hover:bg-accent")}>
            {r === "semua" ? "Semua" : r.toUpperCase()}
          </Link>
        ))}
        <form method="get" className="ml-auto flex gap-2">
          {role !== "semua" && <input type="hidden" name="peran" value={role} />}
          <input name="q" defaultValue={q} placeholder="Cari nama / lingkup / SK" aria-label="Cari" className="h-8 w-52 rounded-md border bg-background px-2 text-sm" />
        </form>
      </div>
      <Content title="Register Penunjukan" description={`${rows.length} penunjukan`}>
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Belum ada penunjukan untuk filter ini.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>{["Nama", "Peran", "Lingkup", "Nomor SK", "Periode", "Masa berlaku", "File SK", ""].map((h, i) => <th key={i} scope="col" className="px-3 py-2 text-left font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className="border-t hover:bg-accent/30">
                    <td className="px-3 py-2 font-medium"><Link href={`/manpower/${a.employeeId}`} className="underline underline-offset-2">{a.employeeName}</Link><small className="block text-xs font-normal text-muted-foreground">{a.employeeCode}</small></td>
                    <td className="px-3 py-2 font-medium">{a.role.toUpperCase()}</td>
                    <td className="px-3 py-2">{a.scope}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{a.skNumber}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(a.startsOn)} – {formatDate(a.validUntil)}</td>
                    <td className="px-3 py-2">{a.upcoming ? <span className="text-muted-foreground">Belum berlaku</span> : <ExpiryChip expiry={a.expiry} />}</td>
                    <td className="px-3 py-2"><KontraktorEvidenceSheet kind="pjo" recordId={a.id} count={a.evidence} label={`SK ${a.skNumber}`} canUpload={canManage} /></td>
                    <td className="px-3 py-2">{canManage && <AppointmentSheet trigger={<Button variant="ghost" size="icon-sm" aria-label={`Ubah penunjukan ${a.employeeName}`}><Pencil /></Button>} employees={options} appointment={{ id: a.id, employeeId: a.employeeId, role: a.role, scope: a.scope, skNumber: a.skNumber, startsOn: a.startsOn, validUntil: a.validUntil }} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Peran yang tersedia: {APPOINTMENT_ROLE.map((r) => r.label).join(", ")}. Masa berlaku dihitung dari tanggal berlaku sampai.</p>
      </Content>
    </>
  );
}
