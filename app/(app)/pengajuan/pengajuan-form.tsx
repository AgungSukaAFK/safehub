"use client";

// CONTOH boilerplate: form standar (panel Ringkasan + draft otomatis + tanda "Belum disimpan") untuk
// buat & ubah pengajuan. Nilai terkontrol → dikirim sebagai JSON `payload` → zod di Server Action.
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Send, Trash2 } from "lucide-react";
import { Field, fieldError, useFormAction } from "@/components/form-bits";
import { CurrencyInput } from "@/components/form/currency-input";
import { DatePicker } from "@/components/form/date-picker";
import { DraftBanner, DraftStatus } from "@/components/form/draft-banner";
import { FormSummaryLayout, scrollToFormSection, summaryProgress, type SummaryCheck } from "@/components/form/form-summary-layout";
import { SearchableSelect, type SelectOption } from "@/components/form/searchable-select";
import { Content } from "@/components/list/content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { formatDate, formatRupiah } from "@/lib/format";
import { useFormDraft } from "@/lib/offline/use-form-draft";
import { useOnline } from "@/lib/offline/use-online";
import { BIG_AMOUNT, itemsTotal, lineTotal, newItem, type ItemValues, type PengajuanValues } from "@/lib/pengajuan-rules";
import { toast } from "@/lib/toast";
import { savePengajuanAction } from "./actions";

/** Baris item tanpa `key` (kunci React) untuk payload/draft. */
const plainItems = (items: ItemValues[]) =>
  items.map((i) => ({ item_name: i.item_name, part_number: i.part_number, qty: i.qty, unit: i.unit, unit_price: i.unit_price, note: i.note }));

const itemOk = (i: ItemValues) => i.item_name.trim().length > 0 && Number(i.qty) > 0 && i.unit.trim().length > 0;

export function PengajuanForm({
  id,
  code,
  initial,
  version,
  companies,
  departments,
  userId,
}: {
  /** null = buat baru */
  id: string | null;
  code?: string | null;
  initial: PengajuanValues;
  /** updated_at dokumen: draft lokal dari versi lain ditandai usang */
  version?: string | null;
  companies: SelectOption[];
  departments: SelectOption[];
  userId: string;
}) {
  const router = useRouter();
  const online = useOnline();
  const { state, pending, submit } = useFormAction(savePengajuanAction);
  const [v, setV] = useState<PengajuanValues>(initial);
  const [intent, setIntent] = useState<"ajukan" | "draft">("ajukan");
  const { dirty, resetBaseline } = useUnsavedChanges(v, true);
  const initialJson = useMemo(() => JSON.stringify({ ...initial, items: plainItems(initial.items) }), [initial]);
  const draft = useFormDraft({
    key: `pengajuan:${id ?? "baru"}`,
    userId,
    values: v,
    version: version ?? null,
    isEmpty: (x) => JSON.stringify({ ...x, items: plainItems(x.items) }) === initialJson,
  });

  const set = <K extends keyof PengajuanValues>(k: K, val: PengajuanValues[K]) => setV((p) => ({ ...p, [k]: val }));
  const setItem = (key: string, patch: Partial<ItemValues>) => setV((p) => ({ ...p, items: p.items.map((i) => (i.key === key ? { ...i, ...patch } : i)) }));
  const total = itemsTotal(v.items);

  // hasil action: toast + pindah ke detail (juga saat tersimpan tapi gagal diajukan)
  const handled = useRef(0);
  useEffect(() => {
    if (!state.ts || state.ts === handled.current) return;
    handled.current = state.ts;
    const savedId = state.data?.id as string | undefined;
    if (state.status === "ok") toast.success(state.message);
    else if (state.message) toast.error(state.message, savedId ? { description: "Data sudah tersimpan sebagai draft." } : undefined);
    if (savedId) {
      draft.clear();
      resetBaseline();
      router.replace(`/pengajuan/${savedId}`);
      router.refresh();
    }
  }, [state, draft, resetBaseline, router]);

  const badItem = v.items.findIndex((i) => !itemOk(i));
  const checks: SummaryCheck[] = [
    { id: "title", label: "Judul", status: v.title.trim().length >= 3 ? "done" : "todo", value: v.title || undefined, hint: v.title && v.title.trim().length < 3 ? "Minimal 3 karakter" : undefined, targetId: "pj-title" },
    { id: "company", label: "Perusahaan", status: v.company_code ? "done" : "todo", value: v.company_code ?? undefined, targetId: "pj-company" },
    { id: "department", label: "Departemen", status: v.department_id ? "done" : "suggested", value: departments.find((d) => d.value === v.department_id)?.label, hint: v.department_id ? undefined : "Disarankan: menentukan kepala departemen", targetId: "pj-department" },
    { id: "needed", label: "Tanggal dibutuhkan", status: v.needed_date ? "done" : "optional", value: v.needed_date ? formatDate(v.needed_date) : undefined, targetId: "pj-needed" },
    {
      id: "items",
      label: "Barang",
      status: v.items.length === 0 || badItem >= 0 ? "todo" : "done",
      value: v.items.length ? `${v.items.length} baris` : undefined,
      hint: v.items.length === 0 ? "Tambahkan minimal 1 barang" : badItem >= 0 ? `Baris ${badItem + 1}: nama, jumlah, dan satuan wajib` : undefined,
      targetId: "pj-items",
    },
    {
      id: "total",
      label: "Total",
      status: total > BIG_AMOUNT ? "warning" : total > 0 ? "done" : "optional",
      value: formatRupiah(total),
      hint: total > BIG_AMOUNT ? `Di atas ${formatRupiah(BIG_AMOUNT)}: pastikan anggaran tersedia` : total === 0 ? "Harga satuan belum diisi" : undefined,
      targetId: "pj-items",
    },
    { id: "description", label: "Keterangan", status: v.description.trim() ? "done" : "optional", targetId: "pj-description" },
  ];

  const send = (next: "ajukan" | "draft") => {
    const first = summaryProgress(checks).pending[0];
    if (first?.targetId) return scrollToFormSection(first.targetId);
    setIntent(next);
    const fd = new FormData();
    if (id) fd.set("id", id);
    fd.set("intent", next);
    fd.set(
      "payload",
      JSON.stringify({
        company_code: v.company_code,
        department_id: v.department_id,
        title: v.title,
        description: v.description,
        needed_date: v.needed_date,
        items: plainItems(v.items),
      }),
    );
    submit(fd);
  };

  const err = (k: string) => fieldError(state, k);
  const itemErr = (i: number, k: string) => fieldError(state, `items.${i}.${k}`);

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate className="col-span-12">
      <FormSummaryLayout
        summary={{
          title: id ? `Ubah ${code ?? "Draft"}` : "Pengajuan Baru",
          subtitle: <span className="text-muted-foreground">Nomor dibuat otomatis saat diajukan</span>,
          checks,
          submitLabel: "Simpan & Ajukan",
          submittingLabel: intent === "ajukan" ? "Mengajukan..." : "Menyimpan...",
          submitIcon: <Send />,
          onSubmit: () => send("ajukan"),
          submitting: pending,
          disabled: !online,
          disabledReason: !online ? "Butuh koneksi internet" : undefined,
          dirty,
          error: state.status === "error" ? state.message : undefined,
          status: <DraftStatus savedAt={draft.savedAt} />,
          nextSteps: <>Setelah diajukan, pengajuan diperiksa kepala departemen lalu disetujui Finance (template DEMO). Anda dapat menarik pengajuan selama belum selesai.</>,
          secondaryActions: (
            <Button type="button" variant="outline" disabled={pending || !online} onClick={() => send("draft")}>
              <Save /> Simpan sebagai Draft
            </Button>
          ),
          children: (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="font-semibold tabular-nums">{formatRupiah(total)}</span>
            </div>
          ),
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

        <Content id="pj-section-utama" title="Informasi Pengajuan" size="lg">
          <div className="grid gap-4 @3xl/form:grid-cols-2">
            <Field label="Judul" htmlFor="pj-title" required error={err("title")} hint="Ringkas dan jelas, mis. Penggantian ban forklift gudang A" className="@3xl/form:col-span-2">
              <Input id="pj-title" value={v.title} maxLength={200} onChange={(e) => set("title", e.target.value)} className="text-base md:text-sm" />
            </Field>
            <Field label="Perusahaan" htmlFor="pj-company" required error={err("company_code")}>
              <SearchableSelect id="pj-company" value={v.company_code} onValueChange={(val) => set("company_code", val)} options={companies} placeholder="Pilih perusahaan" />
            </Field>
            <Field label="Departemen" htmlFor="pj-department" error={err("department_id")}>
              <SearchableSelect id="pj-department" value={v.department_id} onValueChange={(val) => set("department_id", val)} options={departments} placeholder="Pilih departemen" />
            </Field>
            <Field label="Tanggal dibutuhkan" htmlFor="pj-needed" error={err("needed_date")}>
              <DatePicker id="pj-needed" value={v.needed_date} onValueChange={(d) => set("needed_date", d)} />
            </Field>
            <Field label="Keterangan" htmlFor="pj-description" error={err("description")} className="@3xl/form:col-span-2">
              <Textarea id="pj-description" value={v.description} maxLength={4000} rows={3} onChange={(e) => set("description", e.target.value)} className="text-base md:text-sm" />
            </Field>
          </div>
        </Content>

        <Content
          id="pj-items"
          title="Barang"
          description="Subtotal = jumlah × harga satuan. Maksimal 500 baris."
          size="lg"
          cardAction={
            <Button type="button" size="sm" variant="outline" onClick={() => set("items", [...v.items, newItem()])} disabled={v.items.length >= 500}>
              <Plus /> Tambah barang
            </Button>
          }
        >
          {err("items") && <p className="mb-3 text-sm text-destructive">{err("items")}</p>}
          {v.items.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Belum ada barang.{" "}
              <button type="button" className="font-medium text-primary hover:underline" onClick={() => set("items", [newItem()])}>
                Tambah barang pertama
              </button>
            </div>
          ) : (
            <ol className="space-y-3">
              {v.items.map((it, i) => (
                <li key={it.key} className="rounded-lg border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">Barang {i + 1}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold tabular-nums">{formatRupiah(lineTotal(it))}</span>
                      <Button type="button" size="icon-sm" variant="ghost" aria-label={`Hapus barang ${i + 1}`} onClick={() => set("items", v.items.filter((x) => x.key !== it.key))}>
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 @3xl/form:grid-cols-12">
                    <Field label="Nama barang" htmlFor={`pj-item-${i}-name`} required error={itemErr(i, "item_name")} className="col-span-2 @3xl/form:col-span-5">
                      <Input id={`pj-item-${i}-name`} value={it.item_name} maxLength={200} onChange={(e) => setItem(it.key, { item_name: e.target.value })} className="text-base md:text-sm" />
                    </Field>
                    <Field label="Part number" htmlFor={`pj-item-${i}-part`} error={itemErr(i, "part_number")} className="col-span-2 @3xl/form:col-span-3">
                      <Input id={`pj-item-${i}-part`} value={it.part_number} maxLength={100} onChange={(e) => setItem(it.key, { part_number: e.target.value })} className="text-base md:text-sm" />
                    </Field>
                    <Field label="Jumlah" htmlFor={`pj-item-${i}-qty`} required error={itemErr(i, "qty")} className="@3xl/form:col-span-2">
                      <Input id={`pj-item-${i}-qty`} type="number" inputMode="decimal" min={0} step="any" value={it.qty} onChange={(e) => setItem(it.key, { qty: e.target.value })} className="text-right text-base tabular-nums md:text-sm" />
                    </Field>
                    <Field label="Satuan" htmlFor={`pj-item-${i}-unit`} required error={itemErr(i, "unit")} className="@3xl/form:col-span-2">
                      <Input id={`pj-item-${i}-unit`} value={it.unit} maxLength={20} onChange={(e) => setItem(it.key, { unit: e.target.value })} className="text-base md:text-sm" />
                    </Field>
                    <Field label="Harga satuan" htmlFor={`pj-item-${i}-price`} error={itemErr(i, "unit_price")} className="col-span-2 @3xl/form:col-span-4">
                      <CurrencyInput id={`pj-item-${i}-price`} value={it.unit_price} onValueChange={(a) => setItem(it.key, { unit_price: a })} />
                    </Field>
                    <Field label="Catatan" htmlFor={`pj-item-${i}-note`} error={itemErr(i, "note")} className="col-span-2 @3xl/form:col-span-8">
                      <Input id={`pj-item-${i}-note`} value={it.note} maxLength={500} onChange={(e) => setItem(it.key, { note: e.target.value })} className="text-base md:text-sm" />
                    </Field>
                  </div>
                </li>
              ))}
            </ol>
          )}
          {v.items.length > 0 && (
            <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm">
              <span className="text-muted-foreground">{v.items.length} barang</span>
              <span>
                Total <span className="ml-2 text-base font-semibold tabular-nums">{formatRupiah(total)}</span>
              </span>
            </div>
          )}
        </Content>

        <Content title="Lampiran" size="lg">
          <p className="text-sm text-muted-foreground">Lampiran (foto, PDF, penawaran) ditambahkan di halaman detail setelah pengajuan disimpan.</p>
        </Content>
      </FormSummaryLayout>
    </form>
  );
}
