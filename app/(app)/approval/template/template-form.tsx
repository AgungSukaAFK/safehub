"use client";

// Builder template approval (frontend-guide §10.4): cakupan, prioritas, langkah (tambah, naik/turun,
// tipe, approver orang / kepala departemen, batas waktu) + pratinjau template yang akan terpakai.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Field, fieldError, useFormAction } from "@/components/form-bits";
import { CurrencyInput } from "@/components/form/currency-input";
import { FormSummaryLayout, scrollToFormSection, summaryProgress, type SummaryCheck } from "@/components/form/form-summary-layout";
import { SearchableSelect, type SelectOption } from "@/components/form/searchable-select";
import { Content } from "@/components/list/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import type { ApprovalTemplate } from "@/lib/approval";
import { pickTemplate, type TemplateScope } from "@/lib/approval-template-rules";
import { formatRupiah } from "@/lib/format";
import { APPROVAL_TYPE_LABELS } from "@/lib/status";
import { toast } from "@/lib/toast";
import { randomUUID } from "@/lib/utils";
import { deleteTemplateAction, saveTemplateAction, searchAppPeopleAction } from "../actions";

type StepV = { key: string; approval_type: string; approver_kind: "user" | "department_head"; approver_id: string | null; approver_label: string | null; due_hours: string };
type V = {
  doc_type: string | null;
  name: string;
  description: string;
  company_code: string | null;
  department_id: string | null;
  min_amount: string;
  max_amount: string;
  priority: string;
  is_active: boolean;
  steps: StepV[];
};

const TYPE_OPTIONS: SelectOption[] = Object.entries(APPROVAL_TYPE_LABELS).map(([value, label]) => ({ value, label }));
const KIND_OPTIONS: SelectOption[] = [
  { value: "user", label: "Orang tertentu" },
  { value: "department_head", label: "Kepala departemen pemohon" },
];
const newStep = (): StepV => ({ key: randomUUID(), approval_type: "menyetujui", approver_kind: "user", approver_id: null, approver_label: null, due_hours: "" });

export function TemplateForm({
  template,
  others,
  docTypes,
  companies,
  departments,
}: {
  template: ApprovalTemplate | null;
  /** template lain (untuk pratinjau) */
  others: (TemplateScope & { name: string })[];
  docTypes: SelectOption[];
  companies: SelectOption[];
  departments: SelectOption[];
}) {
  const router = useRouter();
  const { state, pending, submit } = useFormAction(saveTemplateAction);
  const [v, setV] = useState<V>(() => ({
    doc_type: template?.doc_type ?? docTypes[0]?.value ?? null,
    name: template?.name ?? "",
    description: template?.description ?? "",
    company_code: template?.company_code ?? null,
    department_id: template?.department_id ?? null,
    min_amount: template?.min_amount !== null && template?.min_amount !== undefined ? String(template.min_amount) : "",
    max_amount: template?.max_amount !== null && template?.max_amount !== undefined ? String(template.max_amount) : "",
    priority: String(template?.priority ?? 0),
    is_active: template?.is_active ?? true,
    steps: template?.steps.map((s) => ({ key: randomUUID(), approval_type: s.approval_type, approver_kind: s.approver_kind, approver_id: s.approver_id, approver_label: s.approver_name, due_hours: s.due_hours ? String(s.due_hours) : "" })) ?? [newStep()],
  }));
  const [preview, setPreview] = useState<{ company: string | null; department: string | null; amount: string }>({ company: companies[0]?.value ?? null, department: departments[0]?.value ?? null, amount: "5000000" });
  const { dirty, resetBaseline } = useUnsavedChanges(v, true);
  const set = <K extends keyof V>(k: K, val: V[K]) => setV((p) => ({ ...p, [k]: val }));
  const setStep = (key: string, patch: Partial<StepV>) => setV((p) => ({ ...p, steps: p.steps.map((s) => (s.key === key ? { ...s, ...patch } : s)) }));
  const move = (i: number, d: -1 | 1) =>
    setV((p) => {
      const steps = [...p.steps];
      [steps[i], steps[i + d]] = [steps[i + d], steps[i]];
      return { ...p, steps };
    });

  const handled = useRef(0);
  useEffect(() => {
    if (!state.ts || state.ts === handled.current) return;
    handled.current = state.ts;
    if (state.status === "ok") {
      toast.success(state.message);
      resetBaseline();
      router.replace("/approval/template");
      router.refresh();
    } else if (state.message) toast.error(state.message);
  }, [state, resetBaseline, router]);

  const badStep = v.steps.findIndex((s) => s.approver_kind === "user" && !s.approver_id);
  const minN = v.min_amount ? Number(v.min_amount) : null;
  const maxN = v.max_amount ? Number(v.max_amount) : null;
  const checks: SummaryCheck[] = [
    { id: "doc", label: "Jenis dokumen", status: v.doc_type ? "done" : "todo", value: docTypes.find((d) => d.value === v.doc_type)?.label, targetId: "tpl-doc" },
    { id: "name", label: "Nama template", status: v.name.trim().length >= 3 ? "done" : "todo", value: v.name || undefined, targetId: "tpl-name" },
    {
      id: "scope",
      label: "Cakupan",
      status: minN !== null && maxN !== null && minN > maxN ? "todo" : "done",
      value: [companies.find((c) => c.value === v.company_code)?.label ?? "Semua PT", departments.find((d) => d.value === v.department_id)?.label ?? "Semua dept"].join(" · "),
      hint: minN !== null && maxN !== null && minN > maxN ? "Minimum harus ≤ maksimum" : undefined,
      targetId: "tpl-scope",
    },
    {
      id: "steps",
      label: "Langkah",
      status: v.steps.length === 0 || badStep >= 0 ? "todo" : "done",
      value: `${v.steps.length} langkah`,
      hint: v.steps.length === 0 ? "Minimal 1 langkah" : badStep >= 0 ? `Langkah ${badStep + 1}: pilih approver` : undefined,
      targetId: "tpl-steps",
    },
  ];

  // pratinjau: template mana yang akan dipakai dokumen contoh (template ini memakai nilai yang sedang diedit)
  const current: TemplateScope & { name: string } = {
    id: template?.id ?? "baru",
    name: v.name || "(template ini)",
    doc_type: v.doc_type ?? "",
    company_code: v.company_code,
    department_id: v.department_id,
    min_amount: minN,
    max_amount: maxN,
    priority: Number(v.priority) || 0,
    is_active: v.is_active,
    created_at: template?.created_at ?? "9999",
    stepCount: v.steps.length,
  };
  const winner = pickTemplate([...others.filter((o) => o.id !== current.id), current], {
    docType: v.doc_type ?? "",
    companyCode: preview.company,
    departmentId: preview.department,
    amount: Number(preview.amount) || 0,
  });

  const send = () => {
    const first = summaryProgress(checks).pending[0];
    if (first?.targetId) return scrollToFormSection(first.targetId);
    const fd = new FormData();
    fd.set(
      "payload",
      JSON.stringify({
        id: template?.id ?? null,
        doc_type: v.doc_type,
        name: v.name,
        description: v.description,
        company_code: v.company_code,
        department_id: v.department_id,
        min_amount: v.min_amount,
        max_amount: v.max_amount,
        priority: v.priority,
        is_active: v.is_active,
        steps: v.steps.map((s) => ({ approval_type: s.approval_type, approver_kind: s.approver_kind, approver_id: s.approver_kind === "user" ? s.approver_id : null, due_hours: s.due_hours })),
      }),
    );
    submit(fd);
  };
  const err = (k: string) => fieldError(state, k);

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate className="col-span-12">
      <FormSummaryLayout
        summary={{
          title: template ? `Ubah: ${template.name}` : "Template Baru",
          checks,
          submitLabel: "Simpan Template",
          submittingLabel: "Menyimpan...",
          submitIcon: <Save />,
          onSubmit: send,
          submitting: pending,
          dirty,
          error: state.status === "error" ? state.message : undefined,
          nextSteps: <>Perubahan berlaku untuk dokumen yang diajukan SETELAH disimpan. Dokumen yang sedang berjalan tetap memakai jalur lamanya.</>,
          secondaryActions: template ? (
            <ConfirmDialog
              title={`Hapus template "${template.name}"?`}
              description="Dokumen yang sudah diajukan tetap memakai jalurnya. Dokumen baru akan memakai template lain yang cocok."
              confirmText="Hapus"
              destructive
              onConfirm={async () => {
                const res = await deleteTemplateAction(template.id);
                if (res.status !== "ok") {
                  toast.error(res.message);
                  throw new Error(res.message);
                }
                toast.success(res.message);
                resetBaseline();
                router.replace("/approval/template");
                router.refresh();
              }}
              trigger={
                <Button type="button" variant="ghost" className="text-destructive">
                  <Trash2 /> Hapus template
                </Button>
              }
            />
          ) : undefined,
          children: (
            <div className="space-y-1 rounded-md bg-muted/60 p-3 text-xs">
              <p className="font-medium">Pratinjau</p>
              <p className="text-muted-foreground">
                Dokumen {companies.find((c) => c.value === preview.company)?.label ?? "-"} · {departments.find((d) => d.value === preview.department)?.label ?? "-"} · {formatRupiah(preview.amount || 0)} akan memakai:
              </p>
              <p className={winner?.id === current.id ? "font-semibold text-green-700 dark:text-green-400" : "font-semibold"}>
                {winner ? (winner.id === current.id ? `template ini (${current.name})` : `template lain: ${winner.name}`) : "Tidak ada template (dokumen tidak bisa diajukan)"}
              </p>
            </div>
          ),
        }}
      >
        <Content id="tpl-section" title="Informasi" size="lg">
          <div className="grid gap-4 @3xl/form:grid-cols-2">
            <Field label="Jenis dokumen" htmlFor="tpl-doc" required error={err("doc_type")}>
              <SearchableSelect id="tpl-doc" value={v.doc_type} onValueChange={(x) => set("doc_type", x)} options={docTypes} />
            </Field>
            <Field label="Nama template" htmlFor="tpl-name" required error={err("name")}>
              <Input id="tpl-name" value={v.name} maxLength={120} onChange={(e) => set("name", e.target.value)} className="text-base md:text-sm" />
            </Field>
            <Field label="Keterangan" htmlFor="tpl-desc" error={err("description")} className="@3xl/form:col-span-2">
              <Textarea id="tpl-desc" rows={2} maxLength={500} value={v.description} onChange={(e) => set("description", e.target.value)} className="text-base md:text-sm" />
            </Field>
            <Field label="Prioritas" htmlFor="tpl-priority" hint="Angka lebih besar dipilih lebih dulu bila beberapa template cocok." error={err("priority")}>
              <Input id="tpl-priority" type="number" min={-100} max={100} value={v.priority} onChange={(e) => set("priority", e.target.value)} className="text-base md:text-sm" />
            </Field>
            <Field label="Aktif" htmlFor="tpl-active">
              <div className="flex h-9 items-center gap-2">
                <Switch id="tpl-active" checked={v.is_active} onCheckedChange={(x) => set("is_active", x)} />
                <span className="text-sm text-muted-foreground">{v.is_active ? "Dipakai untuk dokumen baru" : "Tidak dipakai"}</span>
              </div>
            </Field>
          </div>
        </Content>

        <Content id="tpl-scope" title="Cakupan" description="Kosongkan untuk berlaku di semua perusahaan / departemen / nominal." size="lg">
          <div className="grid gap-4 @3xl/form:grid-cols-2">
            <Field label="Perusahaan" htmlFor="tpl-company">
              <SearchableSelect id="tpl-company" value={v.company_code} onValueChange={(x) => set("company_code", x)} options={companies} placeholder="Semua perusahaan" />
            </Field>
            <Field label="Departemen" htmlFor="tpl-dept">
              <SearchableSelect id="tpl-dept" value={v.department_id} onValueChange={(x) => set("department_id", x)} options={departments} placeholder="Semua departemen" />
            </Field>
            <Field label="Nominal minimum" htmlFor="tpl-min" error={err("min_amount")}>
              <CurrencyInput id="tpl-min" value={v.min_amount} onValueChange={(x) => set("min_amount", x)} placeholder="Tanpa batas" />
            </Field>
            <Field label="Nominal maksimum" htmlFor="tpl-max" error={err("max_amount")}>
              <CurrencyInput id="tpl-max" value={v.max_amount} onValueChange={(x) => set("max_amount", x)} placeholder="Tanpa batas" />
            </Field>
          </div>
        </Content>

        <Content
          id="tpl-steps"
          title="Langkah approval"
          description="Berurutan dari atas. Langkah yang approver-nya sama dengan pemohon otomatis dilewati."
          size="lg"
          cardAction={
            <Button type="button" size="sm" variant="outline" disabled={v.steps.length >= 20} onClick={() => set("steps", [...v.steps, newStep()])}>
              <Plus /> Tambah langkah
            </Button>
          }
        >
          {err("steps") && <p className="mb-3 text-sm text-destructive">{err("steps")}</p>}
          <ol className="space-y-3">
            {v.steps.map((s, i) => (
              <li key={s.key} className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Langkah {i + 1}</span>
                  <div className="flex gap-1">
                    <Button type="button" size="icon-sm" variant="ghost" aria-label="Naikkan" disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUp />
                    </Button>
                    <Button type="button" size="icon-sm" variant="ghost" aria-label="Turunkan" disabled={i === v.steps.length - 1} onClick={() => move(i, 1)}>
                      <ArrowDown />
                    </Button>
                    <Button type="button" size="icon-sm" variant="ghost" aria-label={`Hapus langkah ${i + 1}`} disabled={v.steps.length === 1} onClick={() => set("steps", v.steps.filter((x) => x.key !== s.key))}>
                      <Trash2 />
                    </Button>
                  </div>
                </div>
                <div className="grid gap-3 @3xl/form:grid-cols-12">
                  <Field label="Tipe" htmlFor={`tpl-step-${i}-type`} className="@3xl/form:col-span-3">
                    <SearchableSelect id={`tpl-step-${i}-type`} value={s.approval_type} onValueChange={(x) => setStep(s.key, { approval_type: x ?? "menyetujui" })} options={TYPE_OPTIONS} />
                  </Field>
                  <Field label="Approver" htmlFor={`tpl-step-${i}-kind`} className="@3xl/form:col-span-3">
                    <SearchableSelect
                      id={`tpl-step-${i}-kind`}
                      value={s.approver_kind}
                      onValueChange={(x) => setStep(s.key, { approver_kind: (x as StepV["approver_kind"]) ?? "user" })}
                      options={KIND_OPTIONS}
                    />
                  </Field>
                  {s.approver_kind === "user" ? (
                    <Field label="Orang" htmlFor={`tpl-step-${i}-person`} required error={err(`steps.${i}.approver_id`)} className="@3xl/form:col-span-4">
                      <SearchableSelect
                        id={`tpl-step-${i}-person`}
                        value={s.approver_id}
                        selectedOption={s.approver_id && s.approver_label ? { value: s.approver_id, label: s.approver_label } : null}
                        onValueChange={(x, opt) => setStep(s.key, { approver_id: x, approver_label: opt?.label ?? null })}
                        loadOptions={searchAppPeopleAction}
                        placeholder="Cari nama..."
                      />
                    </Field>
                  ) : (
                    <div className="flex items-end text-xs text-muted-foreground @3xl/form:col-span-4">Diambil dari menu Kepala Departemen sesuai departemen & perusahaan dokumen.</div>
                  )}
                  <Field label="Batas waktu (jam)" htmlFor={`tpl-step-${i}-due`} error={err(`steps.${i}.due_hours`)} className="@3xl/form:col-span-2">
                    <Input id={`tpl-step-${i}-due`} type="number" min={1} max={720} placeholder="-" value={s.due_hours} onChange={(e) => setStep(s.key, { due_hours: e.target.value })} className="text-base md:text-sm" />
                  </Field>
                </div>
              </li>
            ))}
          </ol>
        </Content>

        <Content title="Coba pratinjau" description="Ubah contoh dokumen untuk melihat template mana yang akan terpakai (tampil di panel Ringkasan)." size="lg">
          <div className="grid gap-4 @3xl/form:grid-cols-3">
            <Field label="Perusahaan dokumen" htmlFor="pv-company">
              <SearchableSelect id="pv-company" value={preview.company} onValueChange={(x) => setPreview((p) => ({ ...p, company: x }))} options={companies} />
            </Field>
            <Field label="Departemen dokumen" htmlFor="pv-dept">
              <SearchableSelect id="pv-dept" value={preview.department} onValueChange={(x) => setPreview((p) => ({ ...p, department: x }))} options={departments} />
            </Field>
            <Field label="Nominal dokumen" htmlFor="pv-amount">
              <CurrencyInput id="pv-amount" value={preview.amount} onValueChange={(x) => setPreview((p) => ({ ...p, amount: x }))} />
            </Field>
          </div>
        </Content>
      </FormSummaryLayout>
    </form>
  );
}
