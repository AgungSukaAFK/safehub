import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { ActivityLogDialog } from "@/components/detail/activity-log-dialog";
import { ApprovalPath } from "@/components/detail/approval-path";
import { StatusBadge } from "@/components/detail/status-badge";
import { ExpiryChip } from "@/components/expiry-chip";
import { Content } from "@/components/list/content";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { currentTurn } from "@/lib/approval-types";
import { requireAccess } from "@/lib/auth";
import { getDocumentDetail } from "@/lib/dokumen";
import { DOCUMENT_STATE, DOKUMEN_FIELD_LABELS, REVISION_STATUS, docKindLabel } from "@/lib/dokumen-rules";
import { formatDate } from "@/lib/format";
import { getK3People } from "@/lib/k3";
import { createClient } from "@/lib/supabase/server";
import { cn, isUuid } from "@/lib/utils";
import { ObservasiFiles } from "../../observasi/[id]/observasi-files";
import { AcknowledgeButton, DocumentSheet, RevisionPanel, StartRevisionButton, WithdrawButton } from "../dokumen-sheets";

export async function generateMetadata({ params }: PageProps<"/dokumen/[id]">): Promise<Metadata> {
  const { id } = await params;
  if (!isUuid(id)) return { title: "Dokumen" };
  const supabase = await createClient();
  const { data } = await supabase.from("controlled_documents").select("code").eq("id", id).maybeSingle();
  return { title: data?.code ?? "Dokumen" };
}

// Detail dokumen terkendali (rancangan §4.8): revisi berlaku + file, revisi berjalan + approval, pengakuan, riwayat.
export default async function DokumenDetailPage({ params }: PageProps<"/dokumen/[id]">) {
  const access = await requireAccess("viewer");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const isAdmin = access.role === "admin" || access.platformAdmin;
  const staff = isAdmin || access.functions.some((f) => f !== "karyawan");
  const canManage = isAdmin || (!access.functions.includes("auditor") && (access.functions.includes("hse") || access.functions.includes("hse_senior")));
  const supabase = await createClient();
  const d = await getDocumentDetail(supabase, id, access.userId, staff);
  if (!d) notFound();
  const [people, titles] = await Promise.all([
    canManage ? getK3People(supabase) : Promise.resolve([]),
    canManage ? supabase.from("employees").select("job_title").eq("status", "active") : Promise.resolve({ data: [] as { job_title: string }[] }),
  ]);
  const jobTitles = [...new Set((titles.data ?? []).map((t) => t.job_title))].sort();
  const current = d.revisions.find((r) => r.id === d.currentId) ?? null;
  const open = d.revisions.find((r) => r.id === d.openId) ?? null;
  const turn = open?.status === "pending_approval" ? currentTurn(d.steps) : null;
  const myTurn = turn && turn.approver.id === access.userId ? turn : null;
  const ackDone = d.acks.filter((a) => a.acknowledgedAt).length;
  const state = !d.isActive ? "withdrawn" : current ? "published" : "unpublished";

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {d.title}
            <StatusBadge value={state} map={DOCUMENT_STATE} />
          </span>
        }
        description={`${d.code} · ${docKindLabel(d.kind)}${d.ownerName ? ` · Pemilik ${d.ownerName}` : ""}${current ? ` · Rev ${current.revNo}` : ""}`}
        actions={
          <>
            {canManage && d.isActive && (
              <>
                <DocumentSheet trigger={<Button variant="outline">Ubah Data</Button>} people={people} titles={jobTitles} doc={{ id: d.id, code: d.code, title: d.title, kind: d.kind, ownerId: d.ownerId, reviewMonths: d.reviewMonths, distributeTitles: d.distributeTitles }} />
                {!open && current && <StartRevisionButton docId={d.id} />}
                {!open || open.status !== "pending_approval" ? <WithdrawButton docId={d.id} code={d.code} /> : null}
              </>
            )}
            {staff && <ActivityLogDialog entity="controlled_documents" recordId={d.id} fieldLabels={DOKUMEN_FIELD_LABELS} />}
          </>
        }
      />
      {!d.isActive && (
        <p role="status" className="col-span-12 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span><strong>Dokumen ini sudah ditarik (USANG).</strong> Jangan dipakai sebagai acuan kerja.{d.withdrawReason ? ` Alasan: ${d.withdrawReason}` : ""}</span>
        </p>
      )}

      <div className={cn("col-span-12 grid gap-4", open && staff ? "lg:grid-cols-[1fr_22rem]" : "")}>
        <div className="flex min-w-0 flex-col gap-4">
          <Content title={current ? `Revisi Berlaku: Rev ${current.revNo}` : "Revisi Berlaku"} description={current?.effectiveOn ? `Berlaku sejak ${formatDate(current.effectiveOn)}` : undefined}>
            {current ? (
              <div className="space-y-3">
                <p className="text-sm">{current.summary}</p>
                <ObservasiFiles files={current.files} />
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Jadwal review:</span> <ExpiryChip expiry={d.review} />
                  <span className="text-muted-foreground">· interval {d.reviewMonths} bulan</span>
                </p>
                {d.myAck && !d.myAck.acknowledgedAt && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
                    <span className="text-sm">Dokumen ini ditujukan kepada Anda. Buka dan baca file di atas, lalu konfirmasi.</span>
                    <AcknowledgeButton docId={d.id} revisionId={d.myAck.revisionId} />
                  </div>
                )}
                {d.myAck?.acknowledgedAt && <p className="text-sm text-green-700 dark:text-green-400">Anda sudah mengakui membaca revisi ini ({formatDate(d.myAck.acknowledgedAt)}).</p>}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Belum ada revisi yang terbit.{open ? " Revisi pertama sedang disiapkan." : ""}</p>
            )}
          </Content>

          {staff && current && (
            <Content title="Distribusi & Pengakuan Baca" description={`${ackDone} dari ${d.acks.length} sudah membaca${d.distributeTitles.length ? ` · jabatan: ${d.distributeTitles.join(", ")}` : ""}`}>
              {d.acks.length === 0 ? (
                <p className="text-sm text-muted-foreground">Tidak ada penerima. Atur jabatan tujuan lewat Ubah Data; berlaku untuk revisi berikutnya.</p>
              ) : (
                <>
                  <div className="mb-3 h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${ackDone} dari ${d.acks.length} sudah membaca`}>
                    <span className="block h-full bg-viz-2" style={{ width: `${(ackDone / d.acks.length) * 100}%` }} />
                  </div>
                  <ul className="divide-y rounded-lg border text-sm">
                    {d.acks.map((a) => (
                      <li key={a.userId} className="flex items-center justify-between gap-2 px-3 py-2">
                        <span>{a.name}</span>
                        {a.acknowledgedAt ? <span className="text-green-700 dark:text-green-400">Sudah membaca · {formatDate(a.acknowledgedAt)}</span> : <span className="text-amber-700 dark:text-amber-400">Belum membaca</span>}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Content>
          )}

          {staff && (
            <Content title="Riwayat Revisi">
              <ul className="divide-y rounded-lg border text-sm">
                {d.revisions.map((r) => (
                  <li key={r.id} className="space-y-1 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong>Rev {r.revNo}</strong>
                      <StatusBadge value={r.status} map={REVISION_STATUS} />
                    </div>
                    <p className="text-muted-foreground">{r.summary}</p>
                    <small className="text-xs text-muted-foreground">{r.effectiveOn ? `Berlaku ${formatDate(r.effectiveOn)}` : "Belum terbit"}{r.files.length ? ` · ${r.files.length} file` : ""}</small>
                    {r.status === "obsolete" && r.files.length > 0 && <ObservasiFiles files={r.files} />}
                  </li>
                ))}
              </ul>
            </Content>
          )}
        </div>

        {open && staff && (
          <aside className="flex min-w-0 flex-col gap-4">
            <Content title={`Revisi Berjalan: Rev ${open.revNo}`} description={REVISION_STATUS[open.status]?.label}>
              <RevisionPanel docId={d.id} code={d.code} revision={{ id: open.id, revNo: open.revNo, summary: open.summary, status: open.status, fileCount: open.files.length }} canManage={canManage} myTurnApprovalId={myTurn?.id ?? null} />
              {open.files.length > 0 && <div className="mt-3"><ObservasiFiles files={open.files} /></div>}
            </Content>
            <Content title="Jalur Approval">
              <ApprovalPath steps={d.steps} previousRounds={d.previousRounds} emptyText="Jalur approval dibuat saat revisi diajukan." />
            </Content>
          </aside>
        )}
      </div>
    </>
  );
}
