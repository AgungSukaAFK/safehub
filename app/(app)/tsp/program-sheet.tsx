"use client";

// Tambah/ubah program TSP (HSE/admin). Rencana = 12 angka per bulan. Tulis lewat saveProgramAction → RPC tsp_program_save.
import { useState, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { Field } from "@/components/form-bits";
import { SearchableSelect } from "@/components/form/searchable-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import type { FormState } from "@/lib/form-state";
import { useOnline } from "@/lib/offline/use-online";
import { toast } from "@/lib/toast";
import type { TspRow } from "@/lib/tsp";
import { MONTHS_SHORT } from "@/lib/tsp-rules";
import { saveProgramAction } from "./actions";

export type ProgramSheetSite = { id: string; name: string };

export function ProgramSheet({ program, year, sites, trigger }: { program?: TspRow; year: number; sites: ProgramSheetSite[]; trigger?: ReactElement }) {
  const router = useRouter();
  const online = useOnline();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<FormState | null>(null);
  const [v, setV] = useState(() => ({
    location_id: program?.siteId ?? sites[0]?.id ?? "",
    no: program?.no ?? "",
    element: program?.element ?? "",
    name: program?.name ?? "",
    owner_label: program?.owner ?? "",
    indicator: program?.indicator ?? "",
    evidence_required: program?.evidenceRequired ?? "",
    annual_target: String(program?.target ?? 12),
    plan: (program?.plan ?? Array(12).fill(1)).map(String),
    is_active: program?.isActive ?? true,
    sort_order: String(program?.sortOrder ?? 0),
  }));
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV((p) => ({ ...p, [k]: val }));
  const err = (k: string) => state?.fieldErrors?.[k]?.[0];
  const planSum = v.plan.reduce((s, x) => s + (Number(x) || 0), 0);

  const submit = async () => {
    setPending(true);
    const res = await saveProgramAction(program?.id ?? null, { ...v, year, plan: v.plan.map((x) => Number(x) || 0) });
    setPending(false);
    setState(res);
    if (res.status === "ok") {
      toast.success(res.message);
      setOpen(false);
      router.refresh();
    } else toast.error(res.message);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={trigger ?? <Button variant="outline" />}>
        {trigger ? undefined : (
          <>
            <Plus /> Tambah Program
          </>
        )}
      </SheetTrigger>
      <SheetContent className="w-full gap-0 sm:max-w-lg">
        <SheetHeader className="border-b">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Program TSP {year}</p>
          <SheetTitle>{program ? `Ubah program ${program.no}` : "Tambah program"}</SheetTitle>
          <SheetDescription>Rencana per bulan menentukan sel matriks dan perhitungan capaian.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {sites.length > 1 && (
            <Field label="Site" htmlFor="pg-site" required error={err("location_id")}>
              <SearchableSelect id="pg-site" value={v.location_id || null} onValueChange={(x) => set("location_id", x ?? "")} options={sites.map((s) => ({ value: s.id, label: s.name }))} placeholder="Pilih site" />
            </Field>
          )}
          <div className="grid grid-cols-3 gap-3">
            <Field label="No" htmlFor="pg-no" required error={err("no")}>
              <Input id="pg-no" value={v.no} maxLength={12} onChange={(e) => set("no", e.target.value)} className="text-base md:text-sm" />
            </Field>
            <div className="col-span-2">
              <Field label="Elemen" htmlFor="pg-el" required error={err("element")} hint="Mis. 1. Kebijakan">
                <Input id="pg-el" value={v.element} maxLength={80} onChange={(e) => set("element", e.target.value)} className="text-base md:text-sm" />
              </Field>
            </div>
          </div>
          <Field label="Nama program" htmlFor="pg-name" required error={err("name")}>
            <Input id="pg-name" value={v.name} maxLength={160} onChange={(e) => set("name", e.target.value)} className="text-base md:text-sm" />
          </Field>
          <Field label="Penanggung jawab" htmlFor="pg-owner" required error={err("owner_label")} hint="Mis. PJO, HSE, All Departemen">
            <Input id="pg-owner" value={v.owner_label} maxLength={60} onChange={(e) => set("owner_label", e.target.value)} className="text-base md:text-sm" />
          </Field>
          <Field label="Indikator pencapaian" htmlFor="pg-ind" required error={err("indicator")}>
            <Input id="pg-ind" value={v.indicator} maxLength={300} onChange={(e) => set("indicator", e.target.value)} className="text-base md:text-sm" />
          </Field>
          <Field label="Bukti wajib" htmlFor="pg-ev" error={err("evidence_required")}>
            <Input id="pg-ev" value={v.evidence_required} maxLength={300} onChange={(e) => set("evidence_required", e.target.value)} className="text-base md:text-sm" />
          </Field>
          <Field label="Target per tahun" htmlFor="pg-target" required error={err("annual_target")} hint={planSum !== Number(v.annual_target) ? `Jumlah rencana bulanan = ${planSum} (berbeda dari target)` : undefined}>
            <Input id="pg-target" inputMode="numeric" value={v.annual_target} onChange={(e) => set("annual_target", e.target.value)} className="text-base md:text-sm" />
          </Field>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Rencana per bulan</legend>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {MONTHS_SHORT.map((m, i) => (
                <label key={m} className="space-y-1 text-center text-xs text-muted-foreground">
                  {m}
                  <Input
                    inputMode="numeric"
                    aria-label={`Rencana ${m}`}
                    value={v.plan[i]}
                    onChange={(e) =>
                      set(
                        "plan",
                        v.plan.map((x, j) => (j === i ? e.target.value : x)),
                      )
                    }
                    className="h-8 px-1 text-center text-base md:text-sm"
                  />
                </label>
              ))}
            </div>
            {err("plan") && <p className="text-xs text-destructive">{err("plan")}</p>}
          </fieldset>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <label htmlFor="pg-active" className="text-sm">
              Program aktif<span className="block text-xs text-muted-foreground">Nonaktif = tidak dihitung di capaian</span>
            </label>
            <Switch id="pg-active" checked={v.is_active} onCheckedChange={(c) => set("is_active", c)} />
          </div>
        </div>
        <SheetFooter className="flex-row justify-end border-t">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Batal
          </Button>
          <Button type="button" onClick={submit} disabled={pending || !online}>
            {pending && <Loader2 className="animate-spin" />} Simpan
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
