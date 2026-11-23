"use client";

// Form temuan (baru & ubah): FormSummaryLayout + draft perangkat. Nilai terkontrol → JSON `payload` →
// zod di Server Action → RPC finding_save (DB memeriksa fungsi K3, scope site, master aktif).
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Trash2 } from "lucide-react";
import { Field, fieldError, useFormAction } from "@/components/form-bits";
import { DatePicker } from "@/components/form/date-picker";
import { DraftBanner, DraftStatus } from "@/components/form/draft-banner";
import { FormSummaryLayout, summaryProgress, scrollToFormSection, type SummaryCheck } from "@/components/form/form-summary-layout";
import { SearchableSelect, type SelectOption } from "@/components/form/searchable-select";
import { Content } from "@/components/list/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { nowWibLocal, wibLocalToIso } from "@/lib/kejadian-rules";
import { formatDate } from "@/lib/format";
import { useFormDraft } from "@/lib/offline/use-form-draft";
import { useOnline } from "@/lib/offline/use-online";
import { CONSEQUENCE, LIKELIHOOD, ROOT_FACTORS, SOURCE_KINDS, type FindingValues } from "@/lib/temuan-rules";
import { toast } from "@/lib/toast";
import { saveFindingAction } from "./actions";

const plain = (v: FindingValues) => ({ ...v, root_causes: v.root_causes.map(({ factor, text }) => ({ factor, text })) });

export function TemuanForm({
  id,
  code,
  initial,
  version,
  companies,
  areas,
  categories,
  risks,
  people,
  incidents,
  userId,
  siteName,
}: {
  id: string | null;
  code?: string | null;
  initial: FindingValues;
  version?: string | null;
  companies: SelectOption[];
  /** area dalam site terpilih */
  areas: SelectOption[];
  categories: SelectOption[];
  risks: SelectOption[];
  people: SelectOption[];
  incidents: SelectOption[];
  userId: string;
  siteName: string;
}) {
  const router = useRouter();
  const online = useOnline();
  const { state, pending, submit } = useFormAction(saveFindingAction);
  const [v, setV] = useState<FindingValues>(initial);
  const { dirty, resetBaseline } = useUnsavedChanges(v, true);
  const initialJson = useMemo(() => JSON.stringify(plain(initial)), [initial]);
  const draft = useFormDraft({
    key: `temuan:${id ?? "baru"}`,
    userId,
    values: v,
    version: version ?? null,
    isEmpty: (x) => JSON.stringify(plain(x)) === initialJson,
  });
  const set = <K extends keyof FindingValues>(k: K, val: FindingValues[K]) => setV((p) => ({ ...p, [k]: val }));
  const dueChanged = !!id && v.due_date !== initial.due_date;

  const handled = useRef(0);
  useEffect(() => {
    if (!state.ts || state.ts === handled.current) return;
    handled.current = state.ts;
    const savedId = state.data?.id as string | undefined;
    if (state.status === "ok") toast.success(state.message);
    else if (state.message) toast.error(state.message);
    if (state.status === "ok" && savedId) {
      draft.clear();
      resetBaseline();
      router.replace(`/temuan/${savedId}`);
      router.refresh();
    }
  }, [state, draft, resetBaseline, router]);

  const err = (k: string) => fieldError(state, k);
  const checks: SummaryCheck[] = [
    { id: "title", label: "Judul", status: v.title.trim().length >= 3 ? "done" : "todo", value: v.title || undefined, hint: v.title && v.title.trim().length < 3 ? "Minimal 3 karakter" : undefined, targetId: "tm-title" },
    { id: "description", label: "Uraian", status: v.description.trim() ? "done" : "todo", targetId: "tm-description" },
    { id: "source", label: "Sumber", status: v.source_kind && !(v.source_kind === "incident" && !v.source_id) ? "done" : "todo", value: SOURCE_KINDS.find((s) => s.value === v.source_kind)?.label, targetId: "tm-source" },
    { id: "area", label: "Lokasi", status: v.area_id ? "done" : "todo", value: areas.find((a) => a.value === v.area_id)?.label, targetId: "tm-area" },
    { id: "found", label: "Waktu ditemukan", status: v.found_at ? "done" : "todo", targetId: "tm-found" },
    { id: "category", label: "Kategori", status: v.category ? "done" : "todo", value: categories.find((c) => c.value === v.category)?.label, targetId: "tm-category" },
    { id: "risk", label: "Prioritas", status: v.risk_level ? "done" : "todo", value: risks.find((c) => c.value === v.risk_level)?.label, targetId: "tm-risk" },
    { id: "pic", label: "PIC temuan", status: v.pic_id ? "done" : "todo", value: people.find((p) => p.value === v.pic_id)?.label, targetId: "tm-pic" },
    {
      id: "due",
      label: "Due date",
      status: v.due_date && !(dueChanged && !v.change_reason.trim()) ? "done" : "todo",
      value: v.due_date ? formatDate(v.due_date) : undefined,
      hint: dueChanged && !v.change_reason.trim() ? "Alasan perubahan due date wajib" : undefined,
      targetId: "tm-due",
    },
    { id: "root", label: "Akar penyebab", status: v.root_causes.some((r) => r.text.trim()) ? "done" : "optional", targetId: "tm-root" },
  ];

  const send = () => {
    const first = summaryProgress(checks).pending[0];
    if (first?.targetId) return scrollToFormSection(first.targetId);
    const fd = new FormData();
    if (id) fd.set("id", id);
    fd.set(
      "payload",
      JSON.stringify({
        company_code: v.company_code,
        location_id: v.location_id,
        area_id: v.area_id,
        location_detail: v.location_detail,
        found_at: wibLocalToIso(v.found_at),
        title: v.title,
        description: v.description,
        source_kind: v.source_kind,
        source_ref: v.source_kind === "incident" ? null : v.source_ref,
        source_id: v.source_kind === "incident" ? v.source_id : null,
        category: v.category,
        risk_level: v.risk_level,
        likelihood: v.likelihood,
        consequence: v.consequence,
        root_causes: v.root_causes.filter((r) => r.text.trim()).map(({ factor, text }) => ({ factor, text })),
        pic_id: v.pic_id,
        due_date: v.due_date,
        change_reason: v.change_reason,
      }),
    );
    submit(fd);
  };

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate className="col-span-12">
      <FormSummaryLayout
        summary={{
          title: id ? `Ubah ${code}` : "Temuan Baru",
          subtitle: <span className="text-muted-foreground">{id ? siteName : `${siteName} · nomor dibuat otomatis`}</span>,
          checks,
          submitLabel: id ? "Simpan Perubahan" : "Simpan Temuan",
          submittingLabel: "Menyimpan...",
          submitIcon: <Save />,
          onSubmit: send,
          submitting: pending,
          disabled: !online,
          disabledReason: !online ? "Butuh koneksi internet" : undefined,
          dirty,
          error: state.status === "error" ? state.message : undefined,
          status: <DraftStatus savedAt={draft.savedAt} />,
          nextSteps: <>Setelah disimpan, PIC temuan diberi tahu. Tambahkan tindakan koreksi/pencegahan dari halaman detail.</>,
        }}
      >
        <DraftBanner
          draft={draft.pending}
          onRestore={() => {
            const d = draft.restore();
            if (d) setV(d.values);
          }}
          onDiscard={draft.discard}
        />

        <Content id="tm-section-utama" title="Temuan" size="lg">
          <div className="grid gap-4 @3xl/form:grid-cols-2">
            <Field label="Judul" htmlFor="tm-title" required error={err("title")} className="@3xl/form:col-span-2">
              <Input id="tm-title" value={v.title} maxLength={200} onChange={(e) => set("title", e.target.value)} className="text-base md:text-sm" />
            </Field>
            <Field label="Uraian" htmlFor="tm-description" required error={err("description")} className="@3xl/form:col-span-2">
              <Textarea id="tm-description" value={v.description} rows={4} maxLength={4000} onChange={(e) => set("description", e.target.value)} className="text-base md:text-sm" />
            </Field>
            {companies.length > 1 && !id && (
              <Field label="Perusahaan" htmlFor="tm-company" required error={err("company_code")}>
                <SearchableSelect id="tm-company" value={v.company_code} onValueChange={(x) => set("company_code", x)} options={companies} placeholder="Pilih perusahaan" />
              </Field>
            )}
            <Field label="Sumber" htmlFor="tm-source" required error={err("source_kind")}>
              <SearchableSelect
                id="tm-source"
                value={v.source_kind || null}
                onValueChange={(x) => setV((p) => ({ ...p, source_kind: (x ?? "") as FindingValues["source_kind"], source_id: x === "incident" ? p.source_id : null }))}
                options={SOURCE_KINDS.map((s) => ({ value: s.value, label: s.label }))}
                placeholder="Pilih sumber"
              />
            </Field>
            {v.source_kind === "incident" ? (
              <Field label="Kejadian sumber" htmlFor="tm-src-inc" required error={err("source_id")}>
                <SearchableSelect id="tm-src-inc" value={v.source_id} onValueChange={(x) => set("source_id", x)} options={incidents} placeholder="Pilih kejadian" />
              </Field>
            ) : (
              <Field label="Referensi sumber" htmlFor="tm-src-ref" hint="Mis. INS-2026-0230, Audit CSMS" error={err("source_ref")}>
                <Input id="tm-src-ref" value={v.source_ref} maxLength={60} onChange={(e) => set("source_ref", e.target.value)} className="text-base md:text-sm" />
              </Field>
            )}
            <Field label="Lokasi" htmlFor="tm-area" required error={err("area_id")} hint={`Area di ${siteName}`}>
              <SearchableSelect id="tm-area" value={v.area_id || null} onValueChange={(x) => set("area_id", x ?? "")} options={areas} placeholder="Pilih area" />
            </Field>
            <Field label="Detail lokasi" htmlFor="tm-loc" error={err("location_detail")}>
              <Input id="tm-loc" value={v.location_detail} maxLength={200} placeholder="Contoh: Bay 3, sisi kiri unit" onChange={(e) => set("location_detail", e.target.value)} className="text-base md:text-sm" />
            </Field>
            <Field label="Waktu ditemukan" htmlFor="tm-found" required error={err("found_at")}>
              <Input id="tm-found" type="datetime-local" value={v.found_at} max={nowWibLocal()} onChange={(e) => set("found_at", e.target.value)} className="text-base md:text-sm" />
            </Field>
            <Field label="Kategori" htmlFor="tm-category" required error={err("category")}>
              <SearchableSelect id="tm-category" value={v.category || null} onValueChange={(x) => set("category", x ?? "")} options={categories} placeholder="Pilih kategori" />
            </Field>
          </div>
        </Content>

        <Content id="tm-section-risiko" title="Prioritas & Penanggung Jawab" size="lg">
          <div className="grid gap-4 @3xl/form:grid-cols-2">
            <Field label="Prioritas" htmlFor="tm-risk" required error={err("risk_level")} className="@3xl/form:col-span-2">
              <SearchableSelect id="tm-risk" value={v.risk_level || null} onValueChange={(x) => set("risk_level", x ?? "")} options={risks} placeholder="Pilih prioritas" />
            </Field>
            <Field label="Kemungkinan (opsional)" htmlFor="tm-lik" hint="Skema risiko contoh — menunggu pengesahan HSE">
              <SearchableSelect
                id="tm-lik"
                value={v.likelihood ? String(v.likelihood) : null}
                onValueChange={(x) => set("likelihood", x ? Number(x) : null)}
                options={LIKELIHOOD.map((l, i) => ({ value: String(i + 1), label: `${i + 1} · ${l}` }))}
                placeholder="Pilih"
              />
            </Field>
            <Field label="Konsekuensi (opsional)" htmlFor="tm-con">
              <SearchableSelect
                id="tm-con"
                value={v.consequence ? String(v.consequence) : null}
                onValueChange={(x) => set("consequence", x ? Number(x) : null)}
                options={CONSEQUENCE.map((l, i) => ({ value: String(i + 1), label: `${i + 1} · ${l}` }))}
                placeholder="Pilih"
              />
            </Field>
            <Field label="PIC temuan" htmlFor="tm-pic" required error={err("pic_id")}>
              <SearchableSelect id="tm-pic" value={v.pic_id} onValueChange={(x) => set("pic_id", x)} options={people} placeholder="Pilih PIC" />
            </Field>
            <Field label="Due date" htmlFor="tm-due" required error={err("due_date")}>
              <DatePicker id="tm-due" value={v.due_date} onValueChange={(d) => set("due_date", d)} />
            </Field>
            {dueChanged && (
              <Field label="Alasan perubahan due date" htmlFor="tm-reason" required error={err("change_reason")} className="@3xl/form:col-span-2">
                <Textarea id="tm-reason" rows={2} maxLength={500} value={v.change_reason} onChange={(e) => set("change_reason", e.target.value)} className="text-base md:text-sm" />
              </Field>
            )}
          </div>
        </Content>

        <Content
          id="tm-root"
          title="Akar Penyebab"
          description="Opsional. Pilih faktor lalu jelaskan."
          size="lg"
          cardAction={
            <Button type="button" size="sm" variant="outline" disabled={v.root_causes.length >= 30} onClick={() => set("root_causes", [...v.root_causes, { key: crypto.randomUUID(), factor: "man", text: "" }])}>
              <Plus /> Tambah
            </Button>
          }
        >
          {v.root_causes.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">Belum ada akar penyebab.</p>
          ) : (
            <ul className="space-y-3">
              {v.root_causes.map((r) => (
                <li key={r.key} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[11rem_1fr_auto] sm:items-start">
                  <SearchableSelect
                    value={r.factor}
                    onValueChange={(x) => set("root_causes", v.root_causes.map((y) => (y.key === r.key ? { ...y, factor: (x ?? "man") as typeof r.factor } : y)))}
                    options={ROOT_FACTORS.map((f) => ({ value: f.value, label: f.label }))}
                    placeholder="Faktor"
                  />
                  <Textarea rows={2} maxLength={1000} value={r.text} onChange={(e) => set("root_causes", v.root_causes.map((y) => (y.key === r.key ? { ...y, text: e.target.value } : y)))} placeholder="Jelaskan penyebabnya" className="text-base md:text-sm" />
                  <Button type="button" size="icon-sm" variant="ghost" aria-label="Hapus akar penyebab" onClick={() => set("root_causes", v.root_causes.filter((y) => y.key !== r.key))}>
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Content>
      </FormSummaryLayout>
    </form>
  );
}
