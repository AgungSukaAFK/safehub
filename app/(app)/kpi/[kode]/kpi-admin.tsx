"use client";

// Admin Kamus KPI: ubah definisi (versi baru + kembali draf) dan mengesahkan (catatan wajib).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Field } from "@/components/form-bits";
import { SearchableSelect } from "@/components/form/searchable-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { FormState } from "@/lib/form-state";
import type { KpiDef } from "@/lib/kpi";
import { KPI_DIRECTIONS } from "@/lib/kpi-rules";
import { useOnline } from "@/lib/offline/use-online";
import { toast } from "@/lib/toast";
import { approveKpiAction, saveKpiAction } from "../actions";

const num = (s: string) => (s.trim() === "" ? null : Number(s));

export function KpiAdmin({ kpi }: { kpi: KpiDef }) {
  const router = useRouter();
  const online = useOnline();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<FormState | null>(null);
  const [note, setNote] = useState("");
  const [v, setV] = useState({
    name: kpi.name,
    definition: kpi.definition,
    formula: kpi.formula,
    rule_text: kpi.ruleText ?? "",
    example: kpi.example ?? "",
    source: kpi.source ?? "",
    owner: kpi.owner ?? "",
    unit: kpi.unit ?? "",
    direction: kpi.direction as string,
    warn: kpi.thresholds?.warn_gte != null ? String(kpi.thresholds.warn_gte) : "",
    danger: kpi.thresholds?.danger_gte != null ? String(kpi.thresholds.danger_gte) : "",
  });
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((p) => ({ ...p, [k]: val }));
  const err = (k: string) => state?.fieldErrors?.[k]?.[0];

  const save = async () => {
    setPending(true);
    const res = await saveKpiAction(kpi.code, {
      name: v.name,
      definition: v.definition,
      formula: v.formula,
      rule_text: v.rule_text,
      example: v.example,
      source: v.source,
      owner: v.owner,
      unit: v.unit,
      direction: v.direction,
      warn_gte: num(v.warn),
      danger_gte: num(v.danger),
    });
    setPending(false);
    setState(res);
    if (res.status === "ok") {
      toast.success(res.message);
      setOpen(false);
      router.refresh();
    } else toast.error(res.message);
  };

  return (
    <div className="mt-4 flex flex-col gap-2 border-t pt-4">
      {kpi.status === "draft" && (
        <ConfirmDialog
          title={`Sahkan rumus ${kpi.name} (versi ${kpi.version})?`}
          description="Pengesahan dicatat pada riwayat. Mengubah definisi atau rumus sesudahnya membuat versi baru yang kembali menjadi draf."
          confirmText="Sahkan"
          confirmDisabled={note.trim().length < 5}
          onOpenChange={() => setNote("")}
          onConfirm={async () => {
            const res = await approveKpiAction(kpi.code, note);
            if (res.status !== "ok") {
              toast.error(res.message);
              throw new Error(res.message);
            }
            toast.success(res.message);
            router.refresh();
          }}
          trigger={
            <Button type="button" size="sm" disabled={!online}>
              <Check /> Sahkan Rumus
            </Button>
          }
        >
          <div className="space-y-1.5">
            <Label htmlFor="approve-note">Catatan pengesahan (wajib)</Label>
            <Textarea id="approve-note" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Mis. Disetujui HSE Manager dalam rapat 12 Nov 2026" className="text-base md:text-sm" />
          </div>
        </ConfirmDialog>
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={<Button type="button" size="sm" variant="outline" />}>
          <Pencil /> Ubah Definisi
        </SheetTrigger>
        <SheetContent className="w-full gap-0 sm:max-w-lg">
          <SheetHeader className="border-b">
            <SheetTitle>Ubah {kpi.name}</SheetTitle>
            <SheetDescription>Perubahan definisi, rumus, satuan, arah, atau ambang membuat versi {kpi.version + 1} dan mengembalikan status ke draf.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <Field label="Nama" htmlFor="k-name" required error={err("name")}>
              <Input id="k-name" value={v.name} maxLength={120} onChange={(e) => set("name", e.target.value)} className="text-base md:text-sm" />
            </Field>
            <Field label="Definisi" htmlFor="k-def" required error={err("definition")}>
              <Textarea id="k-def" rows={2} maxLength={1000} value={v.definition} onChange={(e) => set("definition", e.target.value)} className="text-base md:text-sm" />
            </Field>
            <Field label="Rumus" htmlFor="k-formula" required error={err("formula")}>
              <Input id="k-formula" value={v.formula} maxLength={500} onChange={(e) => set("formula", e.target.value)} className="font-mono text-base md:text-sm" />
            </Field>
            <Field label="Aturan perhitungan" htmlFor="k-rule" error={err("rule_text")}>
              <Textarea id="k-rule" rows={3} maxLength={2000} value={v.rule_text} onChange={(e) => set("rule_text", e.target.value)} className="text-base md:text-sm" />
            </Field>
            <Field label="Contoh" htmlFor="k-ex">
              <Textarea id="k-ex" rows={2} maxLength={1000} value={v.example} onChange={(e) => set("example", e.target.value)} className="text-base md:text-sm" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Sumber data" htmlFor="k-src">
                <Input id="k-src" value={v.source} maxLength={300} onChange={(e) => set("source", e.target.value)} className="text-base md:text-sm" />
              </Field>
              <Field label="Pemilik" htmlFor="k-own">
                <Input id="k-own" value={v.owner} maxLength={120} onChange={(e) => set("owner", e.target.value)} className="text-base md:text-sm" />
              </Field>
              <Field label="Satuan" htmlFor="k-unit">
                <Input id="k-unit" value={v.unit} maxLength={40} onChange={(e) => set("unit", e.target.value)} className="text-base md:text-sm" />
              </Field>
              <Field label="Arah" htmlFor="k-dir">
                <SearchableSelect id="k-dir" value={v.direction} onValueChange={(x) => set("direction", x ?? "neutral")} options={KPI_DIRECTIONS.map((d) => ({ value: d.value, label: d.label }))} placeholder="Arah" />
              </Field>
              <Field label="Ambang peringatan (≥)" htmlFor="k-warn" hint="Kosong = tanpa ambang">
                <Input id="k-warn" type="number" inputMode="decimal" value={v.warn} onChange={(e) => set("warn", e.target.value)} className="text-base md:text-sm" />
              </Field>
              <Field label="Ambang bahaya (≥)" htmlFor="k-danger">
                <Input id="k-danger" type="number" inputMode="decimal" value={v.danger} onChange={(e) => set("danger", e.target.value)} className="text-base md:text-sm" />
              </Field>
            </div>
          </div>
          <SheetFooter className="flex-row justify-end border-t">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="button" onClick={save} disabled={pending || !online}>
              {pending && <Loader2 className="animate-spin" />} Simpan
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
