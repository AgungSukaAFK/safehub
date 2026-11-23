"use client";

// Tab Investigasi (tim, kronologi, rekonstruksi) dan Analisis Penyebab (4 kelompok + rekomendasi →
// "Jadikan Tindakan"). Satu panel memegang SELURUH isian investigasi supaya tiap simpan lengkap
// (RPC incident_save_investigation mengganti seluruh baris); simpan sebelum pindah tab.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, Save, Trash2, UsersRound, X } from "lucide-react";
import { SearchableSelect, type SelectOption } from "@/components/form/searchable-select";
import { Content } from "@/components/list/content";
import { ActionFormSheet } from "@/components/pica/pica-sheets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { UserProfileCard } from "@/components/user/user-profile-card";
import { formatDateTime } from "@/lib/format";
import type { KejadianDetail } from "@/lib/kejadian";
import { CAUSE_GROUPS, CAUSE_LEVEL_LABEL, type CauseKey } from "@/lib/kejadian-rules";
import { useOnline } from "@/lib/offline/use-online";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { saveInvestigationAction, setTeamAction } from "../actions";

// ---------------------------------------------------------------- tim
export function TeamCard({ doc, people, canSet }: { doc: KejadianDetail; people: SelectOption[]; canSet: boolean }) {
  const router = useRouter();
  const online = useOnline();
  const lead = doc.team.find((t) => t.role === "lead");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [leadId, setLeadId] = useState<string | null>(lead?.user.id ?? null);
  const [memberIds, setMemberIds] = useState<string[]>(doc.team.filter((t) => t.role === "member").map((t) => t.user.id));

  const save = async () => {
    if (!leadId) return toast.error("Pilih ketua investigasi.");
    setSaving(true);
    const res = await setTeamAction(doc.id, { lead_id: leadId, member_ids: memberIds });
    setSaving(false);
    if (res.status === "ok") {
      toast.success(res.message);
      setEditing(false);
      router.refresh();
    } else toast.error(res.message);
  };

  return (
    <Content
      title="Tim Investigasi"
      size="lg"
      cardAction={
        canSet && !editing ? (
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
            <UsersRound /> {doc.team.length ? "Ubah Tim" : "Tetapkan Tim"}
          </Button>
        ) : undefined
      }
    >
      {editing ? (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <span className="text-sm font-medium">Ketua investigasi *</span>
            <SearchableSelect value={leadId} onValueChange={(x) => { setLeadId(x); setMemberIds((m) => m.filter((i) => i !== x)); }} options={people} placeholder="Pilih ketua" />
          </div>
          <div className="space-y-1.5">
            <span className="text-sm font-medium">Anggota</span>
            <SearchableSelect value={null} onValueChange={(x) => x && !memberIds.includes(x) && x !== leadId && setMemberIds((m) => [...m, x])} options={people.filter((p) => p.value !== leadId && !memberIds.includes(p.value))} placeholder="Tambah anggota" />
            <ul className="flex flex-wrap gap-1.5">
              {memberIds.map((id) => (
                <li key={id} className="flex items-center gap-1 rounded-full border bg-muted/40 py-0.5 pr-1 pl-2.5 text-xs">
                  {people.find((p) => p.value === id)?.label ?? id}
                  <button type="button" aria-label="Hapus anggota" onClick={() => setMemberIds((m) => m.filter((i) => i !== id))} className="rounded-full p-0.5 hover:bg-accent">
                    <X className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)} disabled={saving}>
              Batal
            </Button>
            <Button type="button" size="sm" onClick={save} disabled={saving || !online || !leadId}>
              {saving ? <Loader2 className="animate-spin" /> : <Check />} Simpan Tim
            </Button>
          </div>
        </div>
      ) : doc.team.length ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {doc.team.map((t) => (
            <li key={t.user.id} className="flex items-center gap-3 rounded-lg border p-2">
              <span className="min-w-0 flex-1">
                <UserProfileCard userId={t.user.id} name={t.user.name} avatarUrl={t.user.avatarUrl} size="xs" />
                <span className="block truncate pl-8 text-xs text-muted-foreground">{t.user.jobTitle}</span>
              </span>
              <span className={cn("rounded-md border px-2 py-0.5 text-xs", t.role === "lead" && "border-primary/40 bg-primary/5 text-primary")}>{t.role === "lead" ? "Ketua" : "Anggota"}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{canSet ? "Tim belum ditetapkan. Menetapkan tim memulai tahap Investigasi." : "Tim investigasi belum ditetapkan HSE."}</p>
      )}
    </Content>
  );
}

// ---------------------------------------------------------------- investigasi + penyebab
type Row = { key: string; a: string; b: string };
const rows = (list: { time?: string; event?: string; text?: string; note?: string }[], mode: "tl" | "cause" | "rec"): Row[] =>
  list.map((x) => ({ key: crypto.randomUUID(), a: mode === "tl" ? (x.time ?? "") : (x.text ?? ""), b: mode === "tl" ? (x.event ?? "") : (x.note ?? "") }));

export function InvestigationPanel({
  doc,
  part,
  canEdit,
  canAddAction,
  people,
  verifierId,
}: {
  doc: KejadianDetail;
  part: "investigasi" | "penyebab";
  canEdit: boolean;
  canAddAction: boolean;
  people: SelectOption[];
  verifierId: string | null;
}) {
  const router = useRouter();
  const online = useOnline();
  const inv = doc.investigation;
  const [saving, setSaving] = useState(false);
  const [timeline, setTimeline] = useState<Row[]>(() => rows(inv.timeline, "tl"));
  const [recon, setRecon] = useState(inv.reconstruction ?? "");
  const [causes, setCauses] = useState<Record<CauseKey, Row[]>>(() => Object.fromEntries(CAUSE_GROUPS.map((g) => [g.key, rows(inv.causes[g.key] ?? [], "cause")])) as Record<CauseKey, Row[]>);
  const [recs, setRecs] = useState<Row[]>(() => inv.recommendations.map((r) => ({ key: crypto.randomUUID(), a: r.text, b: "" })));
  const [sheet, setSheet] = useState<{ key: number; title: string } | null>(null);

  const save = async () => {
    setSaving(true);
    const res = await saveInvestigationAction(doc.id, {
      timeline: timeline.filter((r) => r.b.trim()).map((r) => ({ time: r.a, event: r.b })),
      reconstruction: recon,
      causes: Object.fromEntries(CAUSE_GROUPS.map((g) => [g.key, causes[g.key].filter((r) => r.a.trim()).map((r) => ({ text: r.a, note: r.b }))])),
      recommendations: recs.filter((r) => r.a.trim()).map((r) => ({ text: r.a })),
    });
    setSaving(false);
    if (res.status === "ok") {
      toast.success(res.message);
      router.refresh();
    } else toast.error(res.message);
  };
  const saveBar = canEdit && (
    <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">
        {inv.updatedAt ? `Terakhir disimpan ${formatDateTime(inv.updatedAt)}${inv.updatedBy ? ` oleh ${inv.updatedBy}` : ""}. ` : ""}Simpan sebelum pindah tab.
      </p>
      <Button type="button" size="sm" onClick={save} disabled={saving || !online}>
        {saving ? <Loader2 className="animate-spin" /> : <Save />} Simpan
      </Button>
    </div>
  );

  if (part === "investigasi")
    return (
      <>
        {doc.status === "classified" && <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">Tetapkan tim investigasi untuk memulai tahap Investigasi.</p>}
        <Content
          title="Kronologi Kejadian"
          size="lg"
          cardAction={
            canEdit ? (
              <Button type="button" size="sm" variant="outline" disabled={timeline.length >= 100} onClick={() => setTimeline((t) => [...t, { key: crypto.randomUUID(), a: "", b: "" }])}>
                <Plus /> Tambah baris
              </Button>
            ) : undefined
          }
        >
          {timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada kronologi.</p>
          ) : (
            <ol className="space-y-3">
              {timeline.map((r) => (
                <li key={r.key} className="grid gap-2 sm:grid-cols-[6rem_1fr_auto] sm:items-start">
                  {canEdit ? (
                    <>
                      <Input value={r.a} maxLength={20} placeholder="Waktu" aria-label="Waktu" onChange={(e) => setTimeline((t) => t.map((x) => (x.key === r.key ? { ...x, a: e.target.value } : x)))} className="text-base md:text-sm" />
                      <Textarea rows={2} maxLength={1000} value={r.b} placeholder="Jelaskan peristiwa" aria-label="Peristiwa" onChange={(e) => setTimeline((t) => t.map((x) => (x.key === r.key ? { ...x, b: e.target.value } : x)))} className="text-base md:text-sm" />
                      <Button type="button" size="icon-sm" variant="ghost" aria-label="Hapus baris" onClick={() => setTimeline((t) => t.filter((x) => x.key !== r.key))}>
                        <Trash2 />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="font-mono text-sm font-semibold">{r.a || "—"}</span>
                      <span className="text-sm [overflow-wrap:anywhere] whitespace-pre-wrap sm:col-span-2">{r.b}</span>
                    </>
                  )}
                </li>
              ))}
            </ol>
          )}
        </Content>
        <Content title="Rekonstruksi" size="lg">
          {canEdit ? (
            <Textarea rows={5} maxLength={4000} value={recon} onChange={(e) => setRecon(e.target.value)} placeholder="Jelaskan hasil rekonstruksi kejadian" className="text-base md:text-sm" />
          ) : recon ? (
            <p className="[overflow-wrap:anywhere] whitespace-pre-wrap">{recon}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Belum ada rekonstruksi.</p>
          )}
        </Content>
        {saveBar}
      </>
    );

  return (
    <>
      {(["direct", "basic"] as const).map((level) => (
        <Content key={level} title={CAUSE_LEVEL_LABEL[level]} size="lg">
          <div className="space-y-5">
            {CAUSE_GROUPS.filter((g) => g.level === level).map((g) => (
              <fieldset key={g.key} className="space-y-2">
                <legend className="flex w-full items-center justify-between text-sm font-semibold">
                  {g.label}
                  {canEdit && (
                    <Button type="button" size="xs" variant="ghost" disabled={causes[g.key].length >= 30} onClick={() => setCauses((c) => ({ ...c, [g.key]: [...c[g.key], { key: crypto.randomUUID(), a: "", b: "" }] }))}>
                      <Plus /> Tambah
                    </Button>
                  )}
                </legend>
                {causes[g.key].length === 0 && <p className="text-sm text-muted-foreground">Belum ada.</p>}
                {causes[g.key].map((r) => (
                  <div key={r.key} className="space-y-1.5 rounded-lg border p-2.5">
                    {canEdit ? (
                      <>
                        <div className="flex gap-2">
                          <Input value={r.a} maxLength={300} placeholder="Penyebab" aria-label="Penyebab" onChange={(e) => setCauses((c) => ({ ...c, [g.key]: c[g.key].map((x) => (x.key === r.key ? { ...x, a: e.target.value } : x)) }))} className="text-base md:text-sm" />
                          <Button type="button" size="icon-sm" variant="ghost" aria-label="Hapus penyebab" onClick={() => setCauses((c) => ({ ...c, [g.key]: c[g.key].filter((x) => x.key !== r.key) }))}>
                            <Trash2 />
                          </Button>
                        </div>
                        <Input value={r.b} maxLength={1000} placeholder="Temuan atau bukti pendukung (opsional)" aria-label="Bukti pendukung" onChange={(e) => setCauses((c) => ({ ...c, [g.key]: c[g.key].map((x) => (x.key === r.key ? { ...x, b: e.target.value } : x)) }))} className="text-base md:text-sm" />
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium">{r.a}</p>
                        {r.b && <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{r.b}</p>}
                      </>
                    )}
                  </div>
                ))}
              </fieldset>
            ))}
          </div>
        </Content>
      ))}
      <Content
        title="Rekomendasi"
        size="lg"
        cardAction={
          canEdit ? (
            <Button type="button" size="sm" variant="outline" disabled={recs.length >= 50} onClick={() => setRecs((r) => [...r, { key: crypto.randomUUID(), a: "", b: "" }])}>
              <Plus /> Tambah
            </Button>
          ) : undefined
        }
      >
        {recs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada rekomendasi.</p>
        ) : (
          <ol className="space-y-2">
            {recs.map((r, i) => (
              <li key={r.key} className="flex items-start gap-3 rounded-lg border p-2.5">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">{i + 1}</span>
                {canEdit ? (
                  <Textarea rows={2} maxLength={500} value={r.a} aria-label={`Rekomendasi ${i + 1}`} onChange={(e) => setRecs((x) => x.map((y) => (y.key === r.key ? { ...y, a: e.target.value } : y)))} className="min-w-0 flex-1 text-base md:text-sm" />
                ) : (
                  <p className="min-w-0 flex-1 text-sm [overflow-wrap:anywhere]">{r.a}</p>
                )}
                <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                  {canAddAction && r.a.trim() && (
                    <Button type="button" size="xs" variant="outline" onClick={() => setSheet({ key: Date.now(), title: r.a.trim() })}>
                      Jadikan Tindakan
                    </Button>
                  )}
                  {canEdit && (
                    <Button type="button" size="icon-sm" variant="ghost" aria-label="Hapus rekomendasi" onClick={() => setRecs((x) => x.filter((y) => y.key !== r.key))}>
                      <Trash2 />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Content>
      {saveBar}
      {sheet && (
        <ActionFormSheet
          key={sheet.key}
          open
          onOpenChange={(o) => !o && setSheet(null)}
          parent={{ incidentId: doc.id }}
          people={people}
          defaultVerifierId={verifierId}
          prefill={{ title: sheet.title, causeRef: sheet.title.slice(0, 200) }}
        />
      )}
    </>
  );
}
