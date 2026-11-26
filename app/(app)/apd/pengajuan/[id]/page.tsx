import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowDownToLine, FileText, Pencil, Truck } from "lucide-react";
import { ActivityLogDialog } from "@/components/detail/activity-log-dialog";
import { ApprovalPath } from "@/components/detail/approval-path";
import { StatusBadge } from "@/components/detail/status-badge";
import { Content } from "@/components/list/content";
import { PageHeader } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { getRequestDetail, getStockByWarehouse, listApdItems, listOpsRequests, listWarehouses, type OpsRequest } from "@/lib/apd";
import { APD_REQUEST_FIELD_LABELS, FULFILLMENT, MR_STATE, mrState, needsDeduction, REASON_LABELS, REQUEST_STATUS, type Reason } from "@/lib/apd-rules";
import { currentTurn } from "@/lib/approval-types";
import { requireAccess } from "@/lib/auth";
import { getCompanies } from "@/lib/companies";
import { formatDate, formatNumber } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn, isUuid } from "@/lib/utils";
import { ObservasiFiles } from "../../../observasi/[id]/observasi-files";
import { MrButton, RequestMovesSheet } from "../../ops-sheets";
import { CancelButton, DecideButtons, EvidenceUpload, PrintBeritaAcara, SubmitButton, WithdrawButton } from "./request-controls";

export async function generateMetadata({ params }: PageProps<"/apd/pengajuan/[id]">): Promise<Metadata> {
  const { id } = await params;
  if (!isUuid(id)) return { title: "Pengajuan APD" };
  const supabase = await createClient();
  const { data } = await supabase.from("apd_requests").select("code").eq("id", id).maybeSingle();
  return { title: data?.code ?? "Pengajuan APD" };
}

// Detail Pengajuan APD: isi Berita Acara, foto bukti, jalur approval, pemenuhan per baris (OUT dari gudang), cetak.
export default async function ApdRequestDetailPage({ params }: PageProps<"/apd/pengajuan/[id]">) {
  const access = await requireAccess("viewer");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const r = await getRequestDetail(supabase, id, access.userId);
  if (!r) notFound();
  const isAdmin = access.role === "admin" || access.platformAdmin;
  const writer = isAdmin || !access.functions.includes("auditor");
  const canManage = isAdmin || (writer && access.functions.some((f) => f === "hse" || f === "hse_senior" || f === "scm"));
  const isOwner = r.createdBy === access.userId;
  const editable = r.source === "app" && ["draft", "rejected"].includes(r.status) && (isOwner || canManage) && writer;
  const turn = r.status === "pending_approval" ? currentTurn(r.steps) : null;
  const myTurn = turn && turn.approver.id === access.userId ? turn : null;
  const approved = r.status === "approved";
  const canFulfill = canManage && approved && r.lines.some((l) => l.outstanding > 0);
  const qtyTotal = r.lines.reduce((s, l) => s + l.qty, 0);
  const received = r.lines.reduce((s, l) => s + l.received, 0);
  const ms = mrState(r.mrNo, received, qtyTotal);
  const canReceive = canManage && approved && !!r.mrNo && ms !== "full";
  const ops = canFulfill || canReceive;
  const [company, items, warehouses, opsReqs, stock] = await Promise.all([
    getCompanies().then((cs) => cs.find((c) => c.code === r.companyCode) ?? null),
    ops ? listApdItems(supabase) : Promise.resolve([]),
    ops ? listWarehouses(supabase) : Promise.resolve([]),
    ops ? listOpsRequests(supabase) : Promise.resolve([] as OpsRequest[]),
    ops ? getStockByWarehouse(supabase) : Promise.resolve({} as Record<string, number>),
  ]);
  const opsProps = {
    requests: opsReqs.filter((x) => x.id === r.id),
    items: items.filter((i) => i.isActive).map((i) => ({ id: i.id, code: i.code, name: i.name, typeId: i.typeId, size: i.size, uom: i.uom })),
    warehouses: warehouses.filter((w) => w.companyCode === r.companyCode).map((w) => ({ id: w.id, name: w.name, locationName: w.locationName })),
    stock,
    defaultRequestId: r.id,
  };
  const lastReject = r.status === "rejected" ? r.steps.find((s) => s.status === "rejected") : undefined;
  const deduction = needsDeduction(r.reason, r.negligence);
  const totalOs = r.lines.reduce((s, l) => s + l.outstanding, 0);

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {r.code}
            <StatusBadge value={r.status} map={REQUEST_STATUS} tone="solid" />
            {r.status === "approved" && <StatusBadge value={r.fulfillment} map={FULFILLMENT} />}
          </span>
        }
        description={`${r.recipient}${r.jobTitle ? ` · ${r.jobTitle}` : ""} · ${r.site} · ${REASON_LABELS[r.reason as Reason] ?? r.reason}`}
        actions={
          <>
            {editable && <Link href={`/apd/pengajuan/${r.id}/ubah`} className={buttonVariants({ variant: "outline" })}><Pencil /> Ubah</Link>}
            {editable && <SubmitButton id={r.id} code={r.code} resubmit={r.status === "rejected"} />}
            {canManage && approved && <MrButton requestId={r.id} code={r.code} current={r.mrNo} trigger={<Button variant="outline"><FileText /> {r.mrNo ? "Ubah MR" : "Lengkapi MR"}</Button>} />}
            {canReceive && <RequestMovesSheet kind="in" trigger={<Button variant="outline"><ArrowDownToLine /> Terima MR</Button>} {...opsProps} />}
            {canFulfill && <RequestMovesSheet kind="out" trigger={<Button><Truck /> Kirim</Button>} {...opsProps} />}
            {r.status === "pending_approval" && (isOwner || isAdmin) && <WithdrawButton id={r.id} />}
            {((editable) || (r.status === "approved" && canManage && r.lines.every((l) => l.supplied === 0))) && <CancelButton id={r.id} code={r.code} />}
            {r.source === "app" && <PrintBeritaAcara r={r} company={company} printedBy={access.profile.fullName} />}
            <ActivityLogDialog entity="apd_requests" recordId={r.id} fieldLabels={APD_REQUEST_FIELD_LABELS} />
          </>
        }
      />
      {r.source === "import" && (
        <p role="note" className="col-span-12 rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Data lama dari sheet MTR MR (Excel Monitoring APD 2026). Tidak melalui approval{r.employeeId ? "." : "; nama belum ditautkan ke karyawan Manpower (tautkan di Impor Data APD)."}
        </p>
      )}
      {lastReject && (
        <p role="status" className="col-span-12 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>Dikembalikan oleh <strong>{lastReject.approver.name}</strong>{lastReject.note ? `: ${lastReject.note}` : "."} Perbaiki lalu ajukan ulang.</span>
        </p>
      )}
      {r.status === "cancelled" && r.cancelNote && <p role="status" className="col-span-12 rounded-lg border px-3 py-2 text-sm text-muted-foreground">Dibatalkan: {r.cancelNote}</p>}

      <div className={cn("col-span-12 grid gap-4", r.source === "app" ? "lg:grid-cols-[1fr_22rem]" : "")}>
        <div className="flex min-w-0 flex-col gap-4">
          <Content title="Berita Acara" size="md">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
              {[
                ["Karyawan", r.employeeId ? <Link key="e" href={`/manpower/${r.employeeId}`} className="underline underline-offset-2">{r.recipient}</Link> : r.recipient],
                ["Lokasi kerja", r.site],
                ["Alasan", `${REASON_LABELS[r.reason as Reason] ?? r.reason}${r.negligence ? " (kelalaian)" : ""}`],
                ["Terakhir dapat APD", r.lastReceivedOn ? formatDate(r.lastReceivedOn) : "-"],
                ["Tgl kehilangan / kerusakan", r.incidentOn ? formatDate(r.incidentOn) : "-"],
                ["No MR", r.mrNo ? <span key="mr">{r.mrNo} <StatusBadge value={ms} map={MR_STATE} className="ml-1" /></span> : approved ? "Belum dilengkapi" : "-"],
                ["Diajukan", r.requestedOn ? formatDate(r.requestedOn) : "-"],
                ["Disetujui", r.approvedOn ? formatDate(r.approvedOn) : "-"],
                ["Dibuat oleh", r.creatorName ?? (r.source === "import" ? "Impor Excel" : "-")],
              ].map(([k, v]) => (
                <div key={k as string}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>
              ))}
              {r.explanation && <div className="col-span-full"><dt className="text-xs text-muted-foreground">Penjelasan pergantian APD</dt><dd className="whitespace-pre-wrap">{r.explanation}</dd></div>}
            </dl>
            {deduction && (
              <p className={cn("mt-4 rounded-lg border p-3 text-sm", r.deductionAck ? "border-primary/30 bg-primary/5" : "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40")}>
                <strong>{r.deductionAck ? "Karyawan menyatakan bersedia dipotong gaji" : "Pernyataan potong gaji belum dicentang"}</strong> untuk penggantian APD yang {r.reason === "lost" ? "hilang" : "rusak karena kelalaian"}.
              </p>
            )}
          </Content>

          <Content
            title="APD Diminta & Pemenuhan"
            description={r.status === "approved" ? `${totalOs > 0 ? `${formatNumber(totalOs)} unit belum dikirim` : "Semua sudah dikirim"}${r.leadDays !== null ? ` · lead time ${r.leadDays} hari` : ""}` : "Pengiriman dicatat gudang setelah disetujui."}
          >
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>{["Jenis APD", "Ukuran", "Qty", "Diterima MR", "Terkirim", "OS"].map((h, i) => <th key={i} scope="col" className={cn("px-3 py-2 font-medium", i >= 2 ? "text-right" : "text-left")}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {r.lines.map((l) => (
                    <tr key={l.id} className="border-t">
                      <td className="px-3 py-2 font-medium">{l.typeName}{l.itemLabel && <small className="block text-xs font-normal text-muted-foreground">{l.itemLabel}</small>}{l.note && <small className="block text-xs font-normal text-muted-foreground">{l.note}</small>}</td>
                      <td className="px-3 py-2">{l.size ?? "-"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{l.qty}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.mrNo ? l.received : "-"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{l.supplied}{l.lastSupplyOn && <small className="block text-xs text-muted-foreground">{formatDate(l.lastSupplyOn)}</small>}</td>
                      <td className={cn("px-3 py-2 text-right tabular-nums", approved && l.outstanding > 0 && "font-semibold text-amber-700 dark:text-amber-400")}>{approved ? l.outstanding : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {r.moves.length > 0 && (
              <ul className="mt-3 divide-y rounded-lg border text-sm">
                {r.moves.map((m) => (
                  <li key={m.id} className={cn("flex flex-wrap items-center justify-between gap-2 px-3 py-2", m.voidedAt && "text-muted-foreground line-through")}>
                    <span>{formatDate(m.movedOn)} · <strong className="text-xs font-semibold">{m.kind === "in" ? "Diterima (MR)" : "Dikirim"}</strong> · <span className="font-mono text-xs">{m.itemCode}</span> {m.itemName} × {m.qty}</span>
                    <small className="text-xs text-muted-foreground">{[m.refNo && `${m.kind === "in" ? "Ref" : "BAST"} ${m.refNo}`, m.pic, m.warehouse].filter(Boolean).join(" · ")}</small>
                  </li>
                ))}
              </ul>
            )}
          </Content>
        </div>

        {r.source === "app" && (
          <aside className="flex min-w-0 flex-col gap-4">
            <Content title="Foto Bukti" description={r.reason === "damaged" ? "Wajib minimal satu foto APD yang rusak (Matrix APD)." : "Opsional."}>
              <ObservasiFiles files={r.files} />
              {editable && <div className="mt-3"><EvidenceUpload id={r.id} /></div>}
            </Content>
            <Content title="Jalur Approval">
              {myTurn && (
                <div className="mb-3 space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <p className="text-sm font-medium">Giliran Anda memutuskan.</p>
                  <DecideButtons approvalId={myTurn.id} requestId={r.id} />
                </div>
              )}
              <ApprovalPath steps={r.steps} previousRounds={r.previousRounds} emptyText="Jalur approval dibuat saat pengajuan diajukan." />
            </Content>
          </aside>
        )}
      </div>
    </>
  );
}
