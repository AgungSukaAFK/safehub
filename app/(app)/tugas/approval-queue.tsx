"use client";

import Link from "next/link";
import { ArrowRight, BellRing, CheckCircle2, XCircle } from "lucide-react";
import { Content } from "@/components/list/content";
import { buttonVariants } from "@/components/ui/button";
import { UserProfileCard } from "@/components/user/user-profile-card";
import { useNow } from "@/hooks/use-now";
import type { DecisionItem, QueueItem } from "@/lib/approval";
import { formatDateTime, formatHours, formatRupiah, timeAgo } from "@/lib/format";
import { APPROVAL_TYPE_LABELS } from "@/lib/status";
import { cn } from "@/lib/utils";

/** Grup "Approval" di Tugas Saya: dikelompokkan per jenis dokumen. Kosong = tidak dirender. */
export function ApprovalQueue({ items }: { items: QueueItem[] }) {
  const now = useNow();
  if (items.length === 0) return null;

  const groups = [...new Set(items.map((i) => i.docLabel))];
  return (
    <>
      {groups.map((label) => {
        const rows = items.filter((i) => i.docLabel === label);
        return (
          <Content key={label} title={`Menunggu Persetujuan Anda (${label})`} description={`${rows.length} dokumen`}>
            <ul className="divide-y rounded-lg border">
              {rows.map((r) => {
                const due = r.dueAt ? new Date(r.dueAt).getTime() : null;
                const overdue = !!now && due !== null && due < now;
                return (
                  <li key={r.approvalId} className={cn("flex flex-col gap-3 p-3 sm:flex-row sm:items-center", r.followupCount > 0 && "bg-red-50/60 dark:bg-red-950/20")}>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={r.href} className="font-mono text-sm font-semibold text-primary hover:underline">
                          {r.doc?.code ?? "Draft"}
                        </Link>
                        <span className="rounded border px-1.5 py-0.5 text-[11px] font-medium">{APPROVAL_TYPE_LABELS[r.approvalType] ?? r.approvalType}</span>
                        {r.doc && <span className="rounded border px-1.5 py-0.5 text-[11px]">{r.doc.companyCode}</span>}
                        {r.followupCount > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-medium text-white">
                            <BellRing className="size-3" /> {r.followupCount}x follow-up
                          </span>
                        )}
                      </div>
                      <p className="truncate text-sm font-medium" title={r.doc?.title}>
                        {r.doc?.title ?? "-"}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {r.doc?.requester && <UserProfileCard userId={r.doc.requester.id} name={r.doc.requester.name} avatarUrl={r.doc.requester.avatarUrl} size="xs" />}
                        {r.doc?.amount !== null && r.doc?.amount !== undefined && <span className="font-medium text-foreground tabular-nums">{formatRupiah(r.doc.amount)}</span>}
                        <span>Menunggu sejak {now ? timeAgo(r.waitingSince, new Date(now)) : formatDateTime(r.waitingSince)}</span>
                        {due !== null && (
                          <span className={cn(overdue && "font-medium text-red-600 dark:text-red-400")}>
                            {overdue ? `Terlambat ${formatHours((now - due) / 3_600_000)}` : `Batas ${formatDateTime(r.dueAt)}`}
                          </span>
                        )}
                      </div>
                    </div>
                    <Link href={r.href} className={cn(buttonVariants({ size: "sm" }), "w-full sm:w-auto")}>
                      Buka <ArrowRight />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Content>
        );
      })}
    </>
  );
}

export function DecisionHistory({ items }: { items: DecisionItem[] }) {
  if (items.length === 0) return null;
  return (
    <Content title="Keputusan Terakhir Anda" description="20 keputusan terakhir">
      <ul className="divide-y">
        {items.map((d) => (
          <li key={d.id} className="flex items-start gap-3 py-2.5 text-sm">
            {d.status === "approved" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-600 dark:text-green-400" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />}
            <div className="min-w-0 flex-1">
              <p className="truncate">
                <Link href={d.href} className="font-mono font-medium text-primary hover:underline">
                  {d.doc?.code ?? "Dokumen"}
                </Link>{" "}
                <span className="text-muted-foreground">· {d.doc?.title ?? "-"}</span>
              </p>
              {d.note && <p className="truncate text-xs text-muted-foreground italic">“{d.note}”</p>}
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              {d.status === "approved" ? "Disetujui" : "Ditolak"} · {formatDateTime(d.decidedAt)}
            </span>
          </li>
        ))}
      </ul>
    </Content>
  );
}
