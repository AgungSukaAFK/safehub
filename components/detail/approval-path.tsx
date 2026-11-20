"use client";

// Jalur approval (frontend-guide §10.2/§10.4, port taste-ui §9.2): stepper vertikal per langkah
// putaran terakhir: avatar, nama, departemen, tipe, waktu proses, catatan, batas waktu ("Terlambat
// 5 jam" merah). Baris yang sedang giliran disorot + slot aksi (Follow-up). Putaran sebelumnya di
// accordion "Pengajuan sebelumnya (ditolak)".

import { TimeAgo } from "@/components/time-ago";
import type { ReactNode } from "react";
import { CheckCircle2, Circle, CircleSlash, Clock, XCircle } from "lucide-react";
import { StatusBadge } from "@/components/detail/status-badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { UserProfileCard } from "@/components/user/user-profile-card";
import { useNow } from "@/hooks/use-now";
import { currentTurn, type ApprovalStepView } from "@/lib/approval-types";
import { formatDateTime, formatHours } from "@/lib/format";
import { APPROVAL_STEP_STATUS, APPROVAL_TYPE_LABELS } from "@/lib/status";
import { cn } from "@/lib/utils";

const ICON = {
  approved: <CheckCircle2 className="size-4 text-green-600 dark:text-green-400" />,
  rejected: <XCircle className="size-4 text-red-600 dark:text-red-400" />,
  skipped: <CircleSlash className="size-4 text-muted-foreground" />,
  pending: <Circle className="size-4 text-muted-foreground" />,
};

function Steps({ steps, renderTurnAction, now }: { steps: ApprovalStepView[]; renderTurnAction?: (s: ApprovalStepView) => ReactNode; now: number }) {
  const turn = currentTurn(steps);
  return (
    <ol className="relative space-y-2">
      {[...steps]
        .sort((a, b) => a.stepNo - b.stepNo)
        .map((s, i, arr) => {
          const isTurn = turn?.id === s.id;
          const dueMs = s.dueAt ? new Date(s.dueAt).getTime() : null;
          const overdue = now > 0 && isTurn && dueMs !== null && dueMs < now;
          const action = isTurn ? renderTurnAction?.(s) : null;
          return (
            <li key={s.id} className={cn("relative flex gap-3 rounded-md p-3 transition-all", isTurn && "bg-primary/10 ring-2 ring-primary/50")}>
              {i < arr.length - 1 && <span aria-hidden className="absolute top-10 bottom-[-0.75rem] left-[1.4rem] w-px bg-border" />}
              <span className="relative mt-1 shrink-0">{isTurn ? <Clock className="size-4 text-amber-600 dark:text-amber-400" /> : ICON[s.status]}</span>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <UserProfileCard
                    userId={s.approver.id}
                    name={s.approver.name}
                    avatarUrl={s.approver.avatarUrl}
                    subtitle={[APPROVAL_TYPE_LABELS[s.type] ?? s.type, s.approver.department].filter(Boolean).join(" · ")}
                    size="md"
                    className="font-semibold"
                  />
                  <StatusBadge value={isTurn ? "pending" : s.status} map={APPROVAL_STEP_STATUS} className="shrink-0" />
                </div>
                {s.decidedAt && s.status !== "pending" && <p className="text-xs text-muted-foreground italic">{formatDateTime(s.decidedAt)}</p>}
                {s.note && <p className="rounded-md bg-muted/60 px-2 py-1 text-xs [overflow-wrap:anywhere] whitespace-pre-wrap">{s.note}</p>}
                {isTurn && dueMs !== null && (
                  <p className={cn("text-xs font-medium", overdue ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>
                    {overdue ? `Terlambat ${formatHours((now - dueMs) / 3_600_000)}` : `Batas waktu ${formatDateTime(s.dueAt)}`}
                  </p>
                )}
                {isTurn && s.followupCount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {s.followupCount}x diminta follow-up{s.myLastFollowupAt && (
                      <>
                        {" · terakhir oleh Anda "}
                        <TimeAgo at={s.myLastFollowupAt} />
                      </>
                    )}
                  </p>
                )}
                {action && <div className="flex justify-end pt-1">{action}</div>}
              </div>
            </li>
          );
        })}
    </ol>
  );
}

export function ApprovalPath({
  steps,
  previousRounds = [],
  renderTurnAction,
  emptyText = "Jalur approval dibuat saat dokumen diajukan.",
}: {
  /** Langkah putaran terakhir */
  steps: ApprovalStepView[];
  /** Putaran sebelumnya (terbaru dulu) */
  previousRounds?: ApprovalStepView[][];
  renderTurnAction?: (step: ApprovalStepView) => ReactNode;
  emptyText?: string;
}) {
  const now = useNow();
  if (steps.length === 0) return <p className="py-4 text-center text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <div className="space-y-3">
      <Steps steps={steps} renderTurnAction={renderTurnAction} now={now} />
      {previousRounds.length > 0 && (
        <Accordion>
          {previousRounds.map((round) => (
            <AccordionItem key={round[0]?.round} value={String(round[0]?.round)}>
              <AccordionTrigger className="text-xs text-muted-foreground">
                Pengajuan sebelumnya (ke-{round[0]?.round},{" "}
                {round.some((s) => s.status === "rejected") ? "ditolak" : "ditarik"})
              </AccordionTrigger>
              <AccordionContent>
                <Steps steps={round} now={now} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
