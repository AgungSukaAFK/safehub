"use client";

// Workspace Laporan Periode: outline kiri, pratinjau bagian (angka dari RPC/snapshot), panel kelengkapan + approval kanan.
// Draf/dikembalikan: narasi bisa diubah (HSE/admin). Terbit: snapshot terkunci + riwayat versi + koreksi.
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, CircleHelp, Lock, Pencil, Send, Undo2 } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ActivityLogDialog } from "@/components/detail/activity-log-dialog";
import { ApprovalPath } from "@/components/detail/approval-path";
import { StatusBadge } from "@/components/detail/status-badge";
import { Content } from "@/components/list/content";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { monthLabel } from "@/lib/inspeksi-rules";
import { currentTurn } from "@/lib/approval-types";
import type { ReportDetail } from "@/lib/laporan";
import { completenessSummary, REPORT_FIELD_LABELS, REPORT_STATUS, type ReportSection } from "@/lib/laporan-rules";
import { useOnline } from "@/lib/offline/use-online";
import { toast } from "@/lib/toast";
import { MONTHS_LONG } from "@/lib/tsp-rules";
import { cn } from "@/lib/utils";
import { cancelReportAction, decideReportAction, saveNarrativesAction, startCorrectionAction, submitReportAction } from "../actions";

type Props = { doc: ReportDetail; userId: string; canEdit: boolean; incidentCategories: Record<string, string>; inspectionTypes: Record<string, string> };

function expectOk(res: { status: string; message?: string }) {
  if (res.status !== "ok") {
    toast.error(res.message ?? "Gagal");
    throw new Error(res.message);
  }
  toast.success(res.message ?? "Berhasil");
}

export function LaporanView({ doc, userId, canEdit, incidentCategories, inspectionTypes }: Props) {
  const router = useRouter();
  const online = useOnline();
  const [narr, setNarr] = useState<Record<string, string>>(doc.narratives);
  const [submitNote, setSubmitNote] = useState(doc.submitNote ?? "");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const editable = canEdit && (doc.status === "draft" || doc.status === "rejected");
  const locked = doc.fromSnapshot;
  const turn = doc.status === "pending_approval" ? currentTurn(doc.steps) : null;
  const myTurn = turn && turn.approver.id === userId ? turn : null;
  const comp = completenessSummary(doc.completeness);
  const d = doc.data;
  const [yr, mo] = doc.period.split("-").map(Number);
  const refresh = () => router.refresh();

  const save = async () => {
    setSaving(true);
    const res = await saveNarrativesAction(doc.id, narr, submitNote);
    setSaving(false);
    if (res.status === "ok") {
      toast.success(res.message);
      refresh();
    } else toast.error(res.message);
  };

  const srcLink = (key: ReportSection["source"]): { n: number | null; href: string } | null => {
    switch (key) {
      case "incidents":
        return { n: d.incidents.total, href: "/kejadian" };
      case "findings":
        return { n: d.findings.opened, href: "/temuan" };
      case "inspections":
        return { n: d.inspections.reduce((s, x) => s + x.actual, 0), href: `/inspeksi?bulan=${doc.period}&tampilan=daftar` };
      case "tsp":
        return { n: d.tsp.programs_total, href: `/tsp?tahun=${yr}&bulan=${mo}` };
      case "kpi":
        return { n: null, href: "/kpi" };
      default:
        return null;
    }
  };

  const renderBody = (s: ReportSection): ReactNode => {
    switch (s.source) {
      case "narrative":
        return editable ? (
          <Textarea value={narr[s.key] ?? ""} rows={5} maxLength={4000} onChange={(e) => setNarr((p) => ({ ...p, [s.key]: e.target.value }))} className="text-base md:text-sm" aria-label={s.title} />
        ) : s.narrative?.trim() ? (
          <p className="text-sm whitespace-pre-wrap">{s.narrative}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Belum diisi.</p>
        );
      case "kpi":
        return (
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              ["Fatality", d.kpi.fatality],
              ["LTI", d.kpi.lti],
              ["LTIFR", d.kpi.ltifr],
              ["LTISR", d.kpi.ltisr],
              ["Near Miss", d.kpi.near_miss],
              ["Property Damage", d.kpi.property_damage],
              ["Jam kerja", d.kpi.hours],
            ].map(([label, v]) => (
              <div key={String(label)} className="rounded-lg border p-3">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className={cn("text-xl font-semibold tabular-nums", v === null && "text-sm font-medium text-muted-foreground")}>{v === null ? "Belum tersedia" : formatNumber(v as number)}</dd>
              </div>
            ))}
          </dl>
        );
      case "incidents":
        return d.incidents.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tidak ada kejadian pada periode ini (NIHIL).</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground"><tr><th className="py-1 text-left font-medium">No</th><th className="text-left font-medium">Tanggal</th><th className="text-left font-medium">Kategori final</th></tr></thead>
            <tbody>
              {d.incidents.rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="py-1.5"><Link href={`/kejadian/${r.id}`} className="underline underline-offset-2">{r.code}</Link></td>
                  <td>{formatDate(r.date)}</td>
                  <td>{r.category ? (incidentCategories[r.category] ?? r.category) : <span className="text-amber-700 dark:text-amber-400">Belum diklasifikasi</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      case "findings":
        return (
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[
              ["Temuan baru", d.findings.opened],
              ["Temuan ditutup", d.findings.closed],
              ["Terbuka akhir periode", d.findings.open_end],
              ["Overdue (saat ini)", d.findings.overdue_now],
              ["Tindakan ditutup", d.findings.actions_closed],
              ["Menunggu verifikasi", d.findings.actions_waiting],
            ].map(([label, v]) => (
              <div key={String(label)} className="rounded-lg border p-3">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="text-xl font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        );
      case "inspections":
        return d.inspections.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tidak ada inspeksi terjadwal pada periode ini.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {d.inspections.map((x) => (
              <li key={x.type_code} className="flex justify-between gap-3 border-b py-1">
                <span>{inspectionTypes[x.type_code] ?? x.type_code}</span>
                <strong className="tabular-nums">{x.actual}/{x.plan}</strong>
              </li>
            ))}
          </ul>
        );
      case "tsp":
        return (
          <div className="space-y-2 text-sm">
            <p>
              Capaian s.d. {MONTHS_LONG[mo - 1]} {yr}: <strong>{d.tsp.achievement === null ? "-" : `${d.tsp.achievement}%`}</strong> · {d.tsp.programs_met}/{d.tsp.programs_total} program sesuai rencana ·{" "}
              {d.tsp.evidence_pct === null ? "-" : `${d.tsp.evidence_pct}%`} bukti lengkap{" "}
              <span className="rounded border border-dashed px-1.5 text-xs text-muted-foreground">Rumus belum disahkan</span>
            </p>
            {d.tsp.lagging.length > 0 && (
              <ul className="list-disc pl-5 text-muted-foreground">
                {d.tsp.lagging.map((l) => (
                  <li key={l.program_id}>{l.no} {l.name}: {l.actual}/{l.plan}{l.reason ? ` · ${l.reason}` : ""}</li>
                ))}
              </ul>
            )}
          </div>
        );
      default:
        return (
          <p className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            <CircleHelp className="size-4 shrink-0" aria-hidden /> Belum tersedia. Datanya menyusul bersama modulnya; tidak ada angka sementara.
          </p>
        );
    }
  };

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {doc.code}
            <StatusBadge value={doc.status} map={REPORT_STATUS} tone="solid" />
            {doc.status === "published" || doc.version ? (
              <span className="flex items-center gap-1 text-sm font-normal text-muted-foreground"><Lock className="size-3.5" aria-hidden /> v{doc.shownVersion ?? doc.version}</span>
            ) : null}
          </span>
        }
        description={`${doc.templateName} · ${doc.templateCode} ${doc.revision} · ${monthLabel(doc.period)}`}
        actions={<ActivityLogDialog entity="reports" recordId={doc.id} fieldLabels={REPORT_FIELD_LABELS} />}
      />

      {doc.correctionReason && doc.status !== "published" && (
        <p className="col-span-12 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> Koreksi berjalan: {doc.correctionReason}. Versi terbit sebelumnya tetap bisa dibuka.
        </p>
      )}
      {locked && (
        <p className="col-span-12 flex items-center gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
          <Lock className="size-4 shrink-0" aria-hidden /> Menampilkan snapshot terkunci v{doc.shownVersion}. Angka tidak dihitung ulang.
        </p>
      )}

      <div className="col-span-12 grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)_20rem] lg:gap-6 [&>*]:min-w-0">
        <nav aria-label="Outline laporan" className="hidden lg:block">
          <ol className="sticky top-20 space-y-1 text-sm">
            {d.sections.map((s, i) => (
              <li key={s.key}>
                <a href={`#bagian-${s.key}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs">{i + 1}</span>
                  <span className="truncate">{s.title}</span>
                  {s.source === "unavailable" && <span className="ml-auto text-[10px] text-muted-foreground">belum ada</span>}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <main className="space-y-4">
          {d.sections.map((s, i) => {
            const link = srcLink(s.source);
            return (
              <Content key={s.key} id={`bagian-${s.key}`} title={`${i + 1}. ${s.title}`} cardAction={link ? <Link href={link.href} className="text-xs text-muted-foreground underline underline-offset-2">{link.n === null ? "Lihat sumber" : `${link.n} data · lihat sumber`}</Link> : undefined}>
                {renderBody(s)}
              </Content>
            );
          })}
          {editable && (
            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={save} disabled={saving || !online}>Simpan Perubahan</Button>
            </div>
          )}
        </main>

        <aside className="space-y-4">
          <Content title="Pemeriksaan Kelengkapan" description={`${comp.pct}% terpenuhi`}>
            <ul className="space-y-2 text-sm">
              {doc.completeness.map((c) => (
                <li key={c.key} className="flex gap-2">
                  {c.ok ? <Check className="mt-0.5 size-4 shrink-0 text-green-600" aria-hidden /> : <AlertTriangle className={cn("mt-0.5 size-4 shrink-0", c.required ? "text-red-600" : "text-amber-600")} aria-hidden />}
                  <span>
                    {c.href && !c.ok ? <Link href={c.href} className="underline underline-offset-2">{c.label}</Link> : c.label}
                    {!c.ok && <small className="block text-muted-foreground">{c.required ? "Wajib" : "Disarankan"}{c.detail ? ` · ${c.detail}` : ""}</small>}
                  </span>
                </li>
              ))}
            </ul>
            {editable && comp.missingRequired.length > 0 && (
              <div className="mt-3 space-y-1">
                <Label htmlFor="submit-note" className="text-xs">Alasan mengajukan dengan kekurangan wajib (min. 10 karakter)</Label>
                <Textarea id="submit-note" rows={2} value={submitNote} maxLength={1000} onChange={(e) => setSubmitNote(e.target.value)} className="text-base md:text-sm" />
              </div>
            )}
          </Content>

          <Content title="Tindakan">
            <div className="space-y-2">
              {editable && (
                <ConfirmDialog
                  title={`Ajukan ${doc.code}?`}
                  description="Perubahan disimpan dan jalur approval dari template dimulai. Laporan tidak bisa diubah selama menunggu."
                  confirmText="Ajukan"
                  onConfirm={async () => {
                    expectOk(await submitReportAction(doc.id, narr, submitNote));
                    refresh();
                  }}
                  trigger={
                    <Button className="w-full" disabled={!online}>
                      <Send /> {doc.status === "rejected" ? "Ajukan Ulang" : "Ajukan"}
                    </Button>
                  }
                />
              )}
              {myTurn && (
                <>
                  <ConfirmDialog
                    title="Setujui laporan?"
                    description={turn?.stepNo === doc.steps.length ? "Ini langkah terakhir: laporan akan terbit dan angkanya dikunci sebagai snapshot." : "Laporan lanjut ke approver berikutnya."}
                    confirmText="Setujui"
                    onOpenChange={() => setNote("")}
                    onConfirm={async () => {
                      expectOk(await decideReportAction(myTurn.id, "approved", note, doc.id));
                      refresh();
                    }}
                    trigger={<Button className="w-full" disabled={!online}><Check /> Setujui</Button>}
                  >
                    <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Catatan (opsional)" className="text-base md:text-sm" />
                  </ConfirmDialog>
                  <ConfirmDialog
                    title="Kembalikan laporan?"
                    description="Penyusun menerima notifikasi beserta alasannya."
                    confirmText="Kembalikan"
                    destructive
                    confirmDisabled={note.trim().length < 5}
                    onOpenChange={() => setNote("")}
                    onConfirm={async () => {
                      expectOk(await decideReportAction(myTurn.id, "rejected", note, doc.id));
                      refresh();
                    }}
                    trigger={<Button variant="outline" className="w-full" disabled={!online}><Undo2 /> Kembalikan</Button>}
                  >
                    <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Alasan (wajib, min. 5 karakter)" className="text-base md:text-sm" />
                  </ConfirmDialog>
                </>
              )}
              {canEdit && doc.status === "pending_approval" && (
                <ConfirmDialog
                  title="Tarik pengajuan?"
                  description="Approval dihentikan dan laporan kembali menjadi draf."
                  confirmText="Ya, tarik"
                  onOpenChange={() => setNote("")}
                  onConfirm={async () => {
                    expectOk(await cancelReportAction(doc.id, note));
                    refresh();
                  }}
                  trigger={<Button variant="outline" className="w-full" disabled={!online}><Undo2 /> Tarik Pengajuan</Button>}
                >
                  <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Alasan (opsional)" className="text-base md:text-sm" />
                </ConfirmDialog>
              )}
              {canEdit && doc.status === "published" && (
                <ConfirmDialog
                  title="Buat koreksi?"
                  description="Laporan kembali menjadi draf dan, setelah disetujui, terbit sebagai versi berikutnya. Versi sekarang tetap tersimpan."
                  confirmText="Mulai Koreksi"
                  confirmDisabled={note.trim().length < 10}
                  onOpenChange={() => setNote("")}
                  onConfirm={async () => {
                    expectOk(await startCorrectionAction(doc.id, note));
                    refresh();
                  }}
                  trigger={<Button variant="outline" className="w-full" disabled={!online}><Pencil /> Buat Koreksi</Button>}
                >
                  <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Alasan koreksi (wajib, min. 10 karakter)" className="text-base md:text-sm" />
                </ConfirmDialog>
              )}
              {!editable && !myTurn && doc.status !== "published" && <p className="text-sm text-muted-foreground">{turn ? `Menunggu ${turn.approver.name}.` : "Tidak ada tindakan untuk Anda."}</p>}
            </div>
          </Content>

          {doc.versions.length > 0 && (
            <Content title="Riwayat Versi">
              <ul className="space-y-2 text-sm">
                {doc.versions.map((v) => (
                  <li key={v.version}>
                    <Link href={`/laporan/${doc.id}?versi=${v.version}`} aria-current={v.version === doc.shownVersion ? "true" : undefined} className={cn("flex items-baseline justify-between gap-2 rounded px-2 py-1 hover:bg-accent", v.version === doc.shownVersion && "bg-accent font-medium")}>
                      <span>v{v.version}</span>
                      <span className="text-xs text-muted-foreground">{formatDateTime(v.publishedAt)}</span>
                    </Link>
                    {v.reason && <small className="block px-2 text-xs text-muted-foreground">Koreksi: {v.reason}</small>}
                  </li>
                ))}
              </ul>
            </Content>
          )}

          <Content title="Jalur Approval">
            <ApprovalPath steps={doc.steps} previousRounds={doc.previousRounds} emptyText="Jalur approval dibuat saat laporan diajukan." />
          </Content>
        </aside>
      </div>
    </>
  );
}
