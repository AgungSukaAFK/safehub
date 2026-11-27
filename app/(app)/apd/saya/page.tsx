import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { StatusBadge } from "@/components/detail/status-badge";
import { Content } from "@/components/list/content";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { getMyApd } from "@/lib/apd";
import { FULFILLMENT, HOLDING_STATE, REASON_LABELS, REQUEST_STATUS, type Reason } from "@/lib/apd-rules";
import { requireAccess } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "APD Saya" };

// APD milik user (semua peran, termasuk Karyawan): jatuh tempo per jenis + pengajuan milik sendiri.
export default async function MyApdPage() {
  const access = await requireAccess("viewer");
  const supabase = await createClient();
  const { holdings, employees, requests } = await getMyApd(supabase, access.userId);
  const canCreate = !access.functions.includes("auditor") && employees.length > 0;
  const due = holdings.filter((h) => h.state !== "ok");

  return (
    <>
      <PageHeader
        title="APD Saya"
        description={employees.length ? employees.map((e) => `${e.name} · ${e.code}`).join(", ") : "Akun belum terhubung ke data karyawan"}
        actions={canCreate ? <Link href="/apd/pengajuan/baru" className={buttonVariants()}><Plus /> Ajukan APD</Link> : undefined}
      />
      {employees.length === 0 && (
        <p role="note" className="col-span-12 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Akun Anda belum ditautkan ke data karyawan di Manpower. Minta HR menautkannya supaya riwayat dan jatuh tempo APD Anda tampil.
        </p>
      )}
      {due.length > 0 && (
        <p role="status" className="col-span-12 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {due.length} APD sudah atau segera mencapai masa penggantian: {due.map((d) => d.typeName).join(", ")}.{" "}
          {canCreate && <Link href="/apd/pengajuan/baru?alasan=periodic" className="font-medium underline underline-offset-2">Ajukan penggantian berkala</Link>}
        </p>
      )}
      <Content title="APD yang Saya Terima" description="Jatuh tempo = tanggal terakhir menerima + periodik di Matrix APD.">
        {holdings.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Belum ada riwayat penerimaan APD.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {holdings.map((h) => (
              <li key={`${h.employeeId}-${h.typeCode}`} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <strong className="font-medium">{h.typeName}</strong>
                  <StatusBadge value={h.state} map={HOLDING_STATE} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{h.lastItem}{h.size ? ` · ukuran ${h.size}` : ""}</p>
                <p className="mt-1 text-sm">Diterima {formatDate(h.lastOn)} · ganti {formatDate(h.nextDue)} <small className="text-muted-foreground">({h.daysLeft < 0 ? `lewat ${-h.daysLeft} hari` : `${h.daysLeft} hari lagi`})</small></p>
              </li>
            ))}
          </ul>
        )}
      </Content>
      <Content title="Pengajuan Saya">
        {requests.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Belum ada pengajuan APD.</p>
        ) : (
          <ul className="divide-y rounded-lg border text-sm">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span>
                  <Link href={`/apd/pengajuan/${r.id}`} className="font-medium underline underline-offset-2">{r.code}</Link>{" "}
                  <span className="text-muted-foreground">· {REASON_LABELS[r.reason as Reason] ?? r.reason} · {r.lines} jenis APD</span>
                </span>
                <span className="flex gap-1.5">
                  <StatusBadge value={r.status} map={REQUEST_STATUS} />
                  {r.status === "approved" && <StatusBadge value={r.fulfillment} map={FULFILLMENT} />}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Content>
    </>
  );
}
