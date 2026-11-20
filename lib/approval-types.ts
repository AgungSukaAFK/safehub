// Bentuk data langkah approval untuk UI (dibentuk loader dari tabel <app>.approvals). Aman di client.

export type ApprovalStepView = {
  id: string;
  round: number;
  stepNo: number;
  /** mengetahui | memeriksa | menyetujui */
  type: string;
  status: "pending" | "approved" | "rejected" | "skipped";
  approver: { id: string; name: string; avatarUrl: string | null; department: string | null };
  decidedAt: string | null;
  note: string | null;
  dueAt: string | null;
  followupCount: number;
  /** follow-up terakhir oleh user yang sedang login */
  myLastFollowupAt: string | null;
};

/** Langkah yang sedang giliran di putaran ini (pending pertama tanpa pending sebelumnya), atau null. */
export function currentTurn(steps: ApprovalStepView[]): ApprovalStepView | null {
  const sorted = [...steps].sort((a, b) => a.stepNo - b.stepNo);
  const first = sorted.find((s) => s.status === "pending");
  return first ?? null;
}
