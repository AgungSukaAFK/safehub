"use client";

// Evaluasi bulanan TSP: capaian, program tertinggal (alasan = catatan realisasi), persetujuan PJO.
// Angka = RPC tsp_summary (satu sumber dengan matriks). Setelah diajukan, tampilan memakai snapshot.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { StatusBadge } from "@/components/detail/status-badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import { toast } from "@/lib/toast";
import type { EvaluationView } from "@/lib/tsp";
import { EVALUATION_STATUS, MONTHS_LONG, type TspSummary } from "@/lib/tsp-rules";
import { decideEvaluationAction, submitEvaluationAction } from "./actions";

export function EvaluationPanel({
  year,
  month,
  siteId,
  live,
  evaluation,
  canSubmit,
  canDecide,
}: {
  year: number;
  month: number;
  /** null = "Semua site": evaluasi hanya per site */
  siteId: string | null;
  /** ringkasan hidup (tsp_summary) */
  live: TspSummary;
  evaluation: EvaluationView | null;
  canSubmit: boolean;
  canDecide: boolean;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const locked = evaluation && (evaluation.status === "submitted" || evaluation.status === "approved");
  const s = locked && evaluation.summary ? evaluation.summary : live;
  const status = evaluation?.status ?? "draft";

  const run = async (fn: () => ReturnType<typeof submitEvaluationAction>) => {
    const res = await fn();
    if (res.status === "ok") {
      toast.success(res.message);
      setNote("");
      router.refresh();
    } else {
      toast.error(res.message);
      throw new Error(res.message);
    }
  };

  return (
    <section className="rounded-xl border bg-card p-4" aria-labelledby="eval-title">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="eval-title" className="text-base font-semibold">Evaluasi Bulanan</h2>
          <p className="text-sm text-muted-foreground">
            {MONTHS_LONG[month - 1]} {year} · capaian kumulatif s.d. bulan ini{locked ? " (snapshot saat diajukan)" : ""}
          </p>
        </div>
        <StatusBadge value={status} map={EVALUATION_STATUS} />
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="grid grid-cols-3 gap-2 lg:grid-cols-1">
          <Metric label="Capaian" value={s.achievement === null ? "-" : `${s.achievement}%`} hint="Rumus belum disahkan" />
          <Metric label="Program tercapai" value={`${s.programs_met}/${s.programs_total}`} hint={`${s.programs_total - s.programs_met} tertinggal`} />
          <Metric label="Bukti lengkap" value={s.evidence_pct === null ? "-" : `${s.evidence_pct}%`} hint={`${s.evidence_missing} bulan belum berbukti`} />
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">Program Tertinggal</h3>
          {s.lagging.length === 0 ? (
            <p className="flex items-center gap-1.5 rounded-lg border border-dashed p-3 text-sm text-muted-foreground"><Check className="size-4" aria-hidden /> Semua program sesuai rencana.</p>
          ) : (
            <ol className="space-y-2">
              {s.lagging.map((l, i) => (
                <li key={l.program_id} className="flex gap-2 text-sm">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs">{i + 1}</span>
                  <span className="min-w-0">
                    <strong className="block">{l.no} {l.name}</strong>
                    <small className="block text-muted-foreground">
                      {l.actual}/{l.plan} terealisasi{l.reason ? ` · ${l.reason}` : " · belum ada catatan alasan"}
                    </small>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Persetujuan</h3>
          <ol className="space-y-2 text-sm">
            <li className="flex gap-2">
              <span className={`flex size-5 shrink-0 items-center justify-center rounded-full text-xs ${evaluation?.submittedAt ? "bg-green-600 text-white" : "bg-muted"}`}>{evaluation?.submittedAt ? <Check className="size-3" aria-hidden /> : 1}</span>
              <span>
                <strong className="block">Disusun oleh HSE</strong>
                <small className="text-muted-foreground">{evaluation?.preparedBy ? `${evaluation.preparedBy} · ${evaluation.submittedAt ? formatDateTime(evaluation.submittedAt) : ""}` : "Belum diajukan"}</small>
              </span>
            </li>
            <li className="flex gap-2">
              <span className={`flex size-5 shrink-0 items-center justify-center rounded-full text-xs ${status === "approved" ? "bg-green-600 text-white" : "bg-muted"}`}>{status === "approved" ? <Check className="size-3" aria-hidden /> : 2}</span>
              <span>
                <strong className="block">Persetujuan PJO</strong>
                <small className="text-muted-foreground">
                  {status === "approved" ? `${evaluation?.decidedBy ?? "PJO"} · ${evaluation?.decidedAt ? formatDateTime(evaluation.decidedAt) : ""}` : status === "submitted" ? "Menunggu PJO" : "Belum diajukan"}
                </small>
              </span>
            </li>
          </ol>
          {status === "returned" && evaluation?.decisionNote && (
            <p className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              Dikembalikan: {evaluation.decisionNote}
            </p>
          )}
          {!siteId && <p className="text-xs text-muted-foreground">Pilih satu site di pemilih site untuk mengajukan evaluasi.</p>}
          {siteId && canSubmit && (status === "draft" || status === "returned") && (
            <ConfirmDialog
              title={`Ajukan evaluasi ${MONTHS_LONG[month - 1]} ${year}?`}
              description="Capaian saat ini disimpan sebagai snapshot dan realisasi bulan ini dikunci setelah disetujui."
              confirmText="Ajukan"
              onConfirm={() => run(() => submitEvaluationAction(year, month, siteId))}
              trigger={<Button type="button">Ajukan Evaluasi</Button>}
            />
          )}
          {evaluation && status === "submitted" && canDecide && (
            <div className="space-y-2">
              <Label htmlFor="eval-note" className="text-xs">Catatan (wajib bila dikembalikan)</Label>
              <Textarea id="eval-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} className="text-base md:text-sm" />
              <div className="flex gap-2">
                <ConfirmDialog title="Setujui evaluasi?" description="Realisasi bulan ini akan dikunci." confirmText="Setujui" onConfirm={() => run(() => decideEvaluationAction(evaluation.id, true, note))} trigger={<Button type="button">Setujui</Button>} />
                <ConfirmDialog
                  title="Kembalikan evaluasi?"
                  description="HSE menerima notifikasi beserta alasannya."
                  confirmText="Kembalikan"
                  confirmDisabled={!note.trim()}
                  destructive
                  onConfirm={() => run(() => decideEvaluationAction(evaluation.id, false, note))}
                  trigger={<Button type="button" variant="outline">Kembalikan</Button>}
                />
              </div>
            </div>
          )}
          <Link href="/kpi/tsp_achievement" className="block text-xs text-muted-foreground underline underline-offset-2">Definisi &amp; rumus capaian</Link>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border p-3">
      <span className="block text-xs text-muted-foreground">{label}</span>
      <strong className="block text-2xl tabular-nums">{value}</strong>
      <small className="text-xs text-muted-foreground">{hint}</small>
    </div>
  );
}
