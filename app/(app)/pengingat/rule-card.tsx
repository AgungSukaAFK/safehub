"use client";

// Satu aturan pengingat: hari, penerima, aktif, dan Preview Pengingat (contoh teks notifikasi dari isian saat ini).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Loader2 } from "lucide-react";
import { Field } from "@/components/form-bits";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { FUNCTION_OPTIONS, type Fn } from "@/lib/functions";
import { useOnline } from "@/lib/offline/use-online";
import { parseOffsets, REMINDER_KINDS, type ReminderKind } from "@/lib/pengingat-rules";
import { toast } from "@/lib/toast";
import { saveReminderRuleAction } from "./actions";

export type RuleView = { id: string; kind: ReminderKind; name: string; offsets: number[]; notifyAssignee: boolean; notifyFunctions: Fn[]; isActive: boolean };

export function RuleCard({ rule, canEdit }: { rule: RuleView; canEdit: boolean }) {
  const router = useRouter();
  const online = useOnline();
  const meta = REMINDER_KINDS[rule.kind];
  const [offsets, setOffsets] = useState(rule.offsets.join(", "));
  const [assignee, setAssignee] = useState(rule.notifyAssignee);
  const [fns, setFns] = useState<Fn[]>(rule.notifyFunctions);
  const [active, setActive] = useState(rule.isActive);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const parsed = parseOffsets(offsets);
  const sample = meta.preview(parsed?.[0] ?? 1);
  const dirty = offsets !== rule.offsets.join(", ") || assignee !== rule.notifyAssignee || active !== rule.isActive || fns.join() !== rule.notifyFunctions.join();

  const save = async () => {
    if (!parsed || parsed.length === 0) return setErr("Isi angka hari, pisahkan dengan koma (mis. 7, 3, 1, 0)");
    setErr(null);
    setPending(true);
    const res = await saveReminderRuleAction(rule.id, { offsets: parsed, notify_assignee: assignee, notify_functions: fns, is_active: active });
    setPending(false);
    if (res.status === "ok") {
      toast.success(res.message);
      router.refresh();
    } else {
      setErr(res.fieldErrors?.offsets?.[0] ?? res.message ?? null);
      toast.error(res.message);
    }
  };

  return (
    <section className="rounded-xl border bg-card p-4" aria-labelledby={`rule-${rule.kind}`}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 id={`rule-${rule.kind}`} className="text-base font-semibold">{meta.label}</h2>
          <p className="text-sm text-muted-foreground">{rule.name}</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span>{active ? "Aktif" : "Nonaktif"}</span>
          <Switch checked={active} disabled={!canEdit} onCheckedChange={setActive} aria-label={`Aturan ${meta.label} aktif`} />
        </label>
      </header>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Field label={meta.offsetLabel} htmlFor={`off-${rule.kind}`} error={err ?? undefined} hint="Pisahkan dengan koma. Setiap angka mengirim satu pengingat (tidak ganda).">
            <Input id={`off-${rule.kind}`} value={offsets} disabled={!canEdit} onChange={(e) => setOffsets(e.target.value)} className="text-base md:text-sm" />
          </Field>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Penerima</legend>
            {rule.kind !== "tsp_evaluation" && (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={assignee} disabled={!canEdit} onCheckedChange={(c) => setAssignee(c === true)} /> {meta.assigneeLabel}
              </label>
            )}
            <div className="grid grid-cols-2 gap-1.5">
              {FUNCTION_OPTIONS.map((f) => (
                <label key={f.value} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={fns.includes(f.value)}
                    disabled={!canEdit}
                    onCheckedChange={(c) => setFns((p) => (c === true ? [...p, f.value] : p.filter((x) => x !== f.value)))}
                  />
                  {f.label}
                </label>
              ))}
            </div>
            {rule.kind === "tsp_evaluation" && <p className="text-xs text-muted-foreground">Tanpa pilihan, pengingat dikirim ke HSE.</p>}
          </fieldset>
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Preview Pengingat</h3>
          <div className="flex gap-3 rounded-lg border bg-muted/30 p-3">
            <BellRing className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0 text-sm">
              <strong className="block">{sample.title}</strong>
              <span className="text-muted-foreground">{sample.body}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Dikirim sebagai notifikasi di dalam app. Pemeriksaan dijalankan setiap hari pukul 03.00 WIB.</p>
        </div>
      </div>
      {canEdit && (
        <footer className="mt-4 flex justify-end">
          <Button type="button" onClick={save} disabled={!dirty || pending || !online}>
            {pending && <Loader2 className="animate-spin" />} Simpan
          </Button>
        </footer>
      )}
    </section>
  );
}
