"use client";

// Tab Review & Persetujuan (rancangan D5: RPC transisi, bukan approval engine). Alur: Investigator
// (kirim) → Review EHS (hse_senior) → Review Manajemen (pjo/manajemen). Pembuat laporan tidak boleh
// meninjau laporannya sendiri; catatan wajib saat mengembalikan.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CornerUpLeft, HelpCircle, Send } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Content } from "@/components/list/content";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FormState } from "@/lib/form-state";
import { formatDateTime } from "@/lib/format";
import type { KejadianDetail, ReviewEntry } from "@/lib/kejadian";
import { useOnline } from "@/lib/offline/use-online";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { reviewIncidentAction, submitReviewAction } from "../actions";
import type { IncidentPerms } from "./kejadian-detail";

type StageState = "done" | "current" | "pending";

function ok(res: FormState) {
  if (res.status !== "ok") {
    toast.error(res.message);
    throw new Error(res.message);
  }
  toast.success(res.message);
}

export function ReviewPanel({ doc, perms }: { doc: KejadianDetail; perms: IncidentPerms }) {
  const router = useRouter();
  const online = useOnline();
  const [note, setNote] = useState("");
  const last = (stage: ReviewEntry["stage"], decision: ReviewEntry["decision"]) => doc.reviews.filter((r) => r.stage === stage && r.decision === decision).at(-1);
  const order = ["classified", "investigating", "review_ehs", "review_mgmt", "actions", "closed"];
  const idx = order.indexOf(doc.status);

  const stages: { key: string; title: string; who: string; state: StageState; entry?: ReviewEntry; wait?: string }[] = [
    {
      key: "investigation",
      title: "1 · Investigator",
      who: doc.team.find((t) => t.role === "lead")?.user.name ?? "Ketua investigasi",
      state: idx >= 2 ? "done" : idx === 1 ? "current" : "pending",
      entry: last("investigation", "submit"),
      wait: "Menyusun investigasi dan analisis penyebab",
    },
    {
      key: "ehs",
      title: "2 · Review EHS",
      who: last("ehs", "approve")?.actor?.name ?? "HSE Senior",
      state: idx >= 3 ? "done" : idx === 2 ? "current" : "pending",
      entry: last("ehs", "approve"),
      wait: idx < 2 ? "Menunggu investigasi dikirim" : "Sedang menunggu keputusan",
    },
    {
      key: "mgmt",
      title: "3 · Review Manajemen",
      who: last("mgmt", "approve")?.actor?.name ?? "PJO / Manajemen",
      state: idx >= 4 ? "done" : idx === 3 ? "current" : "pending",
      entry: last("mgmt", "approve"),
      wait: idx < 3 ? "Menunggu Review EHS selesai" : "Sedang menunggu keputusan",
    },
  ];
  const currentReviewer = doc.status === "review_ehs" ? perms.canReviewEhs : doc.status === "review_mgmt" ? perms.canReviewMgmt : false;
  const blockedSelf = (doc.status === "review_ehs" || doc.status === "review_mgmt") && perms.isReporter;
  const returns = doc.reviews.filter((r) => r.decision === "return");

  return (
    <>
      {doc.returnNote && doc.status === "investigating" && (
        <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/40">
          <CornerUpLeft className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300" />
          <div>
            <p className="font-medium">Dikembalikan dengan catatan</p>
            <p className="text-muted-foreground [overflow-wrap:anywhere] whitespace-pre-wrap">{doc.returnNote}</p>
            <p className="mt-1 text-xs text-muted-foreground">Perbaiki investigasi lalu kirim ulang ke Review EHS.</p>
          </div>
        </div>
      )}

      <Content title="Alur Persetujuan" size="lg">
        <ol className="space-y-3">
          {stages.map((s) => (
            <li key={s.key} className={cn("flex gap-3 rounded-lg border p-3", s.state === "current" && "border-primary/50 bg-primary/5")}>
              <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold", s.state === "done" ? "border-green-600 bg-green-600 text-white" : s.state === "current" ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30 text-muted-foreground")}>
                {s.state === "done" ? <Check className="size-4" /> : s.key === "investigation" ? 1 : s.key === "ehs" ? 2 : 3}
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-semibold">{s.title}</p>
                <p className="text-sm">{s.who}</p>
                {s.entry ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      {s.entry.decision === "submit" ? "Dikirim" : "Disetujui"} · {formatDateTime(s.entry.at)}
                    </p>
                    {s.entry.note && <p className="text-sm text-muted-foreground [overflow-wrap:anywhere] whitespace-pre-wrap">{s.entry.note}</p>}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">{s.state === "current" ? s.wait : s.state === "pending" ? s.wait : "Selesai"}</p>
                )}

                {s.key === "investigation" && s.state === "current" && perms.canSubmitReview && (
                  <ConfirmDialog
                    title="Kirim ke Review EHS?"
                    description="Investigasi dan analisis penyebab dikunci selama review. Pastikan kronologi dan penyebab sudah lengkap."
                    confirmText="Kirim"
                    onOpenChange={() => setNote("")}
                    onConfirm={async () => {
                      ok(await submitReviewAction(doc.id, note));
                      router.refresh();
                    }}
                    trigger={
                      <Button type="button" size="sm" className="mt-2" disabled={!online}>
                        <Send /> Kirim ke Review EHS
                      </Button>
                    }
                  >
                    <div className="space-y-1.5">
                      <Label htmlFor="sub-note">Catatan (opsional)</Label>
                      <Textarea id="sub-note" rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} className="text-base md:text-sm" />
                    </div>
                  </ConfirmDialog>
                )}

                {((s.key === "ehs" && doc.status === "review_ehs") || (s.key === "mgmt" && doc.status === "review_mgmt")) && (
                  <div className="space-y-2 pt-1">
                    {currentReviewer ? (
                      <div className="flex flex-wrap gap-2">
                        <ConfirmDialog
                          title={`Setujui ${s.title.slice(4)}?`}
                          description="Catatan bersifat opsional."
                          confirmText="Setujui"
                          onOpenChange={() => setNote("")}
                          onConfirm={async () => {
                            ok(await reviewIncidentAction(doc.id, "approve", note));
                            router.refresh();
                          }}
                          trigger={
                            <Button type="button" size="sm" disabled={!online}>
                              <Check /> Setujui
                            </Button>
                          }
                        >
                          <div className="space-y-1.5">
                            <Label htmlFor="ap-note">Catatan (opsional)</Label>
                            <Textarea id="ap-note" rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} className="text-base md:text-sm" />
                          </div>
                        </ConfirmDialog>
                        <ConfirmDialog
                          title="Kembalikan dengan catatan"
                          description="Catatan wajib diisi agar investigator memahami perbaikan yang diperlukan."
                          confirmText="Kembalikan"
                          confirmDisabled={!note.trim()}
                          onOpenChange={() => setNote("")}
                          onConfirm={async () => {
                            ok(await reviewIncidentAction(doc.id, "return", note));
                            router.refresh();
                          }}
                          trigger={
                            <Button type="button" size="sm" variant="outline" disabled={!online}>
                              <CornerUpLeft /> Kembalikan dengan Catatan
                            </Button>
                          }
                        >
                          <div className="space-y-1.5">
                            <Label htmlFor="rt-note">Catatan (wajib)</Label>
                            <Textarea id="rt-note" rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} className="text-base md:text-sm" />
                          </div>
                        </ConfirmDialog>
                      </div>
                    ) : blockedSelf ? (
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <HelpCircle className="size-3.5" /> Pembuat laporan tidak dapat menyetujui laporannya sendiri.
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Menunggu keputusan {s.key === "ehs" ? "HSE Senior" : "PJO/Manajemen"}.</p>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      </Content>

      {returns.length > 0 && (
        <Content title="Riwayat Pengembalian" size="lg">
          <ul className="space-y-2">
            {returns.map((r, i) => (
              <li key={i} className="rounded-lg border p-3 text-sm">
                <p className="text-xs text-muted-foreground">
                  {r.stage === "ehs" ? "Review EHS" : "Review Manajemen"} · {r.actor?.name} · {formatDateTime(r.at)}
                </p>
                <p className="[overflow-wrap:anywhere] whitespace-pre-wrap">{r.note}</p>
              </li>
            ))}
          </ul>
        </Content>
      )}
    </>
  );
}
