"use client";

// Form Pengajuan APD = isi digital "Form Berita Acara Kehilangan/Kerusakan/Pengajuan APD" + "Form Request APD" (P4).
// Disimpan sebagai draf → foto bukti & pengajuan approval di halaman detail.
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Field } from "@/components/form-bits";
import { SearchableSelect } from "@/components/form/searchable-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { needsDeduction, REASON_HINTS, REASON_LABELS, REASONS, type Reason } from "@/lib/apd-rules";
import type { FormState } from "@/lib/form-state";
import { todayWib } from "@/lib/format";
import { useOnline } from "@/lib/offline/use-online";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { saveRequestAction } from "../actions";

type TypeOpt = { id: string; code: string; name: string; sizeKind: string; spec: string | null };
type ItemOpt = { id: string; code: string; name: string; typeId: string; size: string | null };
type EmpOpt = { id: string; code: string; name: string; jobTitle: string; sizes: Record<string, string> };
type Line = { key: number; type_id: string; item_id: string; size: string; qty: string; note: string };
export type RequestInit = {
  id: string;
  employeeId: string;
  reason: Reason;
  negligence: boolean;
  incidentOn: string | null;
  lastReceivedOn: string | null;
  explanation: string | null;
  deductionAck: boolean;
  mrNo: string | null;
  lines: { typeId: string; itemId: string | null; size: string | null; qty: number; note: string | null }[];
};

/** Set awal karyawan baru (Form Request APD "Standar & Jenis APD GMI"). */
const NEW_HIRE_SET: [code: string, qty: number][] = [
  ["safety_shoes", 1],
  ["safety_glass", 1],
  ["safety_helmet", 1],
  ["earplug", 1],
  ["mask_carbon", 2],
  ["padlock", 1],
  ["safety_glove", 2],
  ["uniform_shirt", 1],
  ["uniform_tshirt", 3],
  ["safety_vest", 1],
];

let seq = 0;
const nextKey = () => ++seq;

export function RequestForm({
  types,
  items,
  employees,
  initial,
  defaultEmployee,
  defaultReason,
}: {
  types: TypeOpt[];
  items: ItemOpt[];
  employees: EmpOpt[];
  initial?: RequestInit;
  defaultEmployee?: string | null;
  defaultReason?: Reason | null;
}) {
  const router = useRouter();
  const online = useOnline();
  const [employeeId, setEmployeeId] = useState<string | null>(initial?.employeeId ?? defaultEmployee ?? (employees.length === 1 ? employees[0].id : null));
  const [reason, setReason] = useState<Reason>(initial?.reason ?? defaultReason ?? "periodic");
  const [negligence, setNegligence] = useState(initial?.negligence ?? false);
  const [incidentOn, setIncidentOn] = useState(initial?.incidentOn ?? "");
  const [lastReceivedOn, setLastReceivedOn] = useState(initial?.lastReceivedOn ?? "");
  const [explanation, setExplanation] = useState(initial?.explanation ?? "");
  const [deductionAck, setDeductionAck] = useState(initial?.deductionAck ?? false);
  const [mrNo, setMrNo] = useState(initial?.mrNo ?? "");
  const [lines, setLines] = useState<Line[]>(
    initial?.lines.map((l) => ({ key: nextKey(), type_id: l.typeId, item_id: l.itemId ?? "", size: l.size ?? "", qty: String(l.qty), note: l.note ?? "" })) ?? [],
  );
  const [state, setState] = useState<FormState | null>(null);
  const [pending, setPending] = useState(false);
  const emp = employees.find((e) => e.id === employeeId) ?? null;
  const typeById = useMemo(() => new Map(types.map((t) => [t.id, t])), [types]);
  const err = (k: string) => state?.fieldErrors?.[k]?.[0];
  const deduction = needsDeduction(reason, negligence);
  const incident = reason === "damaged" || reason === "lost";

  const addLine = (typeId = "", qty = 1) =>
    setLines((ls) => [...ls, { key: nextKey(), type_id: typeId, item_id: "", size: (typeId && emp?.sizes[typeId]) || "", qty: String(qty), note: "" }]);
  const setLine = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const addNewHireSet = () => {
    const have = new Set(lines.map((l) => l.type_id));
    NEW_HIRE_SET.forEach(([code, qty]) => {
      const t = types.find((x) => x.code === code);
      if (t && !have.has(t.id)) addLine(t.id, qty);
    });
  };

  const submit = async () => {
    if (!employeeId) {
      setState({ status: "error", message: "Pilih karyawan.", fieldErrors: { employee_id: ["Pilih karyawan"] }, ts: Date.now() });
      return;
    }
    setPending(true);
    const res = await saveRequestAction(initial?.id ?? null, {
      employee_id: employeeId,
      reason,
      negligence: reason === "damaged" ? negligence : false,
      incident_on: incident ? incidentOn : "",
      last_received_on: lastReceivedOn,
      explanation,
      deduction_ack: deduction ? deductionAck : false,
      mr_no: mrNo,
      lines: lines.map((l) => ({ type_id: l.type_id, item_id: l.item_id, size: l.size, qty: l.qty, note: l.note })),
    });
    setPending(false);
    setState(res);
    if (res.status === "ok") {
      toast.success(res.message);
      router.push(`/apd/pengajuan/${(res.data?.id as string) ?? initial?.id}`);
      router.refresh();
    } else toast.error(res.message);
  };

  return (
    <div className="col-span-12 flex max-w-3xl flex-col gap-5">
      <section className="space-y-4 rounded-xl border bg-card p-4">
        <h2 className="font-semibold">Data karyawan</h2>
        <Field label="Karyawan" htmlFor="apd-employee" required error={err("employee_id")} hint={emp ? `${emp.code} · ${emp.jobTitle}` : "Nama, NRP, jabatan, dan site diambil dari data Manpower."}>
          <SearchableSelect
            id="apd-employee"
            value={employeeId}
            onValueChange={(v) => setEmployeeId(v)}
            options={employees.map((e) => ({ value: e.id, label: e.name, description: `${e.code} · ${e.jobTitle}` }))}
            placeholder="Pilih karyawan"
            clearable={employees.length > 1}
            invalid={!!err("employee_id")}
          />
        </Field>
        {employees.length === 0 && <p className="text-sm text-amber-700 dark:text-amber-400">Akun Anda belum terhubung ke data karyawan. Minta HR menautkan akun di Manpower.</p>}
        <Field label="Terakhir dapat APD" htmlFor="apd-last" hint="Opsional, sesuai Form Berita Acara.">
          <Input id="apd-last" type="date" max={todayWib()} value={lastReceivedOn} onChange={(e) => setLastReceivedOn(e.target.value)} className="w-48" />
        </Field>
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-4">
        <h2 className="font-semibold">Alasan permintaan</h2>
        <div role="radiogroup" aria-label="Alasan permintaan APD" className="grid gap-2 sm:grid-cols-2">
          {REASONS.map((r) => (
            <label key={r} className={cn("flex cursor-pointer gap-3 rounded-lg border p-3 text-sm", reason === r ? "border-primary bg-primary/5" : "hover:bg-accent/40")}>
              <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="mt-0.5 size-4" />
              <span><strong className="block font-medium">{REASON_LABELS[r]}</strong><small className="text-xs text-muted-foreground">{REASON_HINTS[r]}</small></span>
            </label>
          ))}
        </div>
        {reason === "damaged" && (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={negligence} onChange={(e) => setNegligence(e.target.checked)} className="mt-0.5 size-4" />
            <span>Rusak karena kelalaian karyawan</span>
          </label>
        )}
        {incident && (
          <Field label={reason === "lost" ? "Tanggal kehilangan" : "Tanggal kerusakan"} htmlFor="apd-incident" required error={err("incident_on")}>
            <Input id="apd-incident" type="date" max={todayWib()} value={incidentOn} onChange={(e) => setIncidentOn(e.target.value)} className="w-48" />
          </Field>
        )}
        <Field label="Penjelasan pergantian APD" htmlFor="apd-expl" required={incident} hint={incident ? "Wajib minimal 10 karakter saat diajukan. Foto bukti diunggah setelah draf tersimpan." : undefined} error={err("explanation")}>
          <Textarea id="apd-expl" rows={3} maxLength={2000} value={explanation} onChange={(e) => setExplanation(e.target.value)} className="text-base md:text-sm" />
        </Field>
        {deduction && (
          <label className={cn("flex items-start gap-2 rounded-lg border p-3 text-sm", deductionAck ? "border-primary/40 bg-primary/5" : "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40")}>
            <input type="checkbox" checked={deductionAck} onChange={(e) => setDeductionAck(e.target.checked)} className="mt-0.5 size-4" />
            <span>
              <strong className="block">Pernyataan pemotongan gaji</strong>
              Dikarenakan kelalaian saya dalam menjaga dan merawat APD Perusahaan yang diberikan kepada saya seperti tersebut di atas, maka dengan ini saya
              bersedia untuk dilakukan pemotongan gaji untuk penggantian APD yang rusak/hilang.
            </span>
          </label>
        )}
        <Field label="No MR (sistem perusahaan)" htmlFor="apd-mr" hint="Opsional, mis. GMI/MR/XI/26/TAL/848.">
          <Input id="apd-mr" maxLength={60} value={mrNo} onChange={(e) => setMrNo(e.target.value)} className="w-72" />
        </Field>
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">APD yang diminta</h2>
          <span className="flex gap-2">
            {reason === "new_hire" && <Button type="button" size="sm" variant="outline" onClick={addNewHireSet}>Isi set karyawan baru</Button>}
            <Button type="button" size="sm" variant="outline" onClick={() => addLine()}><Plus /> Tambah APD</Button>
          </span>
        </div>
        {err("lines") && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{err("lines")}</p>}
        {lines.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Belum ada APD. Klik Tambah APD.</p>
        ) : (
          <ul className="space-y-2">
            {lines.map((l, i) => {
              const t = typeById.get(l.type_id);
              const itemOpts = items.filter((x) => x.typeId === l.type_id);
              return (
                <li key={l.key} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_8rem_5rem_auto] sm:items-end">
                  <Field label={`APD ${i + 1}`} htmlFor={`apd-type-${l.key}`}>
                    <select
                      id={`apd-type-${l.key}`}
                      value={l.type_id}
                      onChange={(e) => setLine(l.key, { type_id: e.target.value, item_id: "", size: (emp?.sizes[e.target.value] ?? l.size) || "" })}
                      className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                    >
                      <option value="">Pilih jenis APD</option>
                      {types.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </select>
                  </Field>
                  <Field label={t?.sizeKind === "color" ? "Warna" : "Ukuran"} htmlFor={`apd-size-${l.key}`}>
                    <Input id={`apd-size-${l.key}`} value={l.size} maxLength={20} disabled={t?.sizeKind === "none"} onChange={(e) => setLine(l.key, { size: e.target.value })} placeholder={t?.sizeKind === "shoe" ? "mis. 41" : t?.sizeKind === "clothing" ? "S-5XL" : ""} />
                  </Field>
                  <Field label="Qty" htmlFor={`apd-qty-${l.key}`}>
                    <Input id={`apd-qty-${l.key}`} type="number" min={1} max={500} value={l.qty} onChange={(e) => setLine(l.key, { qty: e.target.value })} />
                  </Field>
                  <Button type="button" size="icon" variant="ghost" aria-label={`Hapus APD ${i + 1}`} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}><Trash2 /></Button>
                  {itemOpts.length > 0 && (
                    <select aria-label={`Barang spesifik APD ${i + 1}`} value={l.item_id} onChange={(e) => setLine(l.key, { item_id: e.target.value })} className="h-8 rounded-md border bg-background px-2 text-xs text-muted-foreground sm:col-span-4">
                      <option value="">Barang spesifik (opsional, diisi gudang)</option>
                      {itemOpts.map((x) => <option key={x.id} value={x.id}>{x.code} · {x.name}</option>)}
                    </select>
                  )}
                  {t?.spec && <small className="text-xs text-muted-foreground sm:col-span-4">Standar: {t.spec}</small>}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={submit} disabled={pending || !online}>{pending && <Loader2 className="animate-spin" />} {initial ? "Simpan Perubahan" : "Simpan Draf"}</Button>
        <span className="text-xs text-muted-foreground">Setelah draf tersimpan: unggah foto bukti (bila rusak), lalu Ajukan untuk approval HSE → HR → HSE Dept Head.</span>
      </div>
    </div>
  );
}
