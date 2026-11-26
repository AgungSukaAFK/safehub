"use client";

// Sheet & kontrol Monitoring APD: jenis (masa periodik), barang, mutasi stok, batal mutasi.
import { useState, type ReactElement } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { QuickSheet } from "@/components/form/quick-sheet";
import type { SelectOption } from "@/components/form/searchable-select";
import { Textarea } from "@/components/ui/textarea";
import { MOVE_KIND, MOVE_KINDS, SIZE_KIND_LABELS, SIZE_KINDS } from "@/lib/apd-rules";
import { todayWib } from "@/lib/format";
import { toast } from "@/lib/toast";
import { useRouter } from "next/navigation";
import { saveApdItemAction, saveApdTypeAction, saveMoveAction, voidMoveAction } from "./actions";

const YES_NO: SelectOption[] = [
  { value: "true", label: "Ya" },
  { value: "false", label: "Tidak" },
];

export type TypeInit = {
  id: string;
  code: string;
  name: string;
  spec: string | null;
  intervalDays: number | null;
  intervalLabel: string | null;
  warnDays: number;
  tracked: boolean;
  sizeKind: string;
  note: string | null;
  isActive: boolean;
};

export function ApdTypeSheet({ trigger, type }: { trigger: ReactElement; type?: TypeInit }) {
  return (
    <QuickSheet
      trigger={trigger}
      eyebrow="Masa periodik APD"
      title={type ? `Ubah ${type.name}` : "Tambah Jenis APD"}
      description="Jatuh tempo karyawan = tanggal terakhir menerima + masa periodik. Status 'Segera Ganti' mulai sejumlah hari peringatan sebelum jatuh tempo."
      fields={[
        ...(type ? [] : [{ name: "code", label: "Kode", required: true, hint: "Huruf kecil, angka, garis bawah. Tidak bisa diubah.", maxLength: 41 }]),
        { name: "name", label: "Nama jenis", required: true, maxLength: 80 },
        { name: "spec", label: "Standar / spesifikasi", placeholder: "mis. ANSI Z41", maxLength: 200 },
        { name: "tracked", label: "Lacak jatuh tempo per karyawan", type: "select", options: YES_NO, required: true },
        { name: "interval_days", label: "Masa periodik (hari)", type: "number", hint: "1x/tahun = 365 · 2x/tahun = 182 · 4x/tahun = 91 · 3 tahun = 1095" },
        { name: "interval_label", label: "Label periodik (Matrix APD)", placeholder: "mis. 2x setahun", maxLength: 60 },
        { name: "warn_days", label: "Peringatan sebelum jatuh tempo (hari)", type: "number", required: true },
        { name: "size_kind", label: "Jenis ukuran", type: "select", options: SIZE_KINDS.map((k) => ({ value: k, label: SIZE_KIND_LABELS[k] })), required: true },
        { name: "note", label: "Keterangan", type: "textarea", maxLength: 500 },
        ...(type ? [{ name: "is_active", label: "Aktif", type: "select" as const, options: YES_NO, required: true }] : []),
      ]}
      initial={
        type
          ? { name: type.name, spec: type.spec, tracked: String(type.tracked), interval_days: type.intervalDays, interval_label: type.intervalLabel, warn_days: type.warnDays, size_kind: type.sizeKind, note: type.note, is_active: String(type.isActive) }
          : { tracked: "true", warn_days: 30, size_kind: "none" }
      }
      onSubmit={(v) => saveApdTypeAction(type?.id ?? null, v)}
    />
  );
}

export type ItemInit = { id: string; code: string; name: string; typeId: string; brand: string | null; size: string | null; uom: string; minStock: number; isActive: boolean };

export function ApdItemSheet({ trigger, item, types }: { trigger: ReactElement; item?: ItemInit; types: SelectOption[] }) {
  return (
    <QuickSheet
      trigger={trigger}
      eyebrow="Barang APD"
      title={item ? `Ubah ${item.code}` : "Tambah Barang APD"}
      description="Kode barang mengikuti kode gudang (mis. SS-01-40 = sepatu merek 01 ukuran 40). Kode tidak bisa diubah setelah dibuat."
      fields={[
        { name: "code", label: "Kode barang", required: true, maxLength: 30, hint: item ? "Tidak bisa diubah." : undefined },
        { name: "name", label: "Nama barang", required: true, maxLength: 120 },
        { name: "type_id", label: "Jenis APD", type: "select", options: types, required: true },
        { name: "brand", label: "Merek", maxLength: 60 },
        { name: "size", label: "Ukuran / warna", maxLength: 20 },
        { name: "uom", label: "Satuan", required: true, maxLength: 20, placeholder: "Pcs / Pasang / Set" },
        { name: "min_stock", label: "Stok minimum", type: "number", hint: "0 = tanpa batas minimum." },
        ...(item ? [{ name: "is_active", label: "Aktif", type: "select" as const, options: YES_NO, required: true }] : []),
      ]}
      initial={
        item
          ? { code: item.code, name: item.name, type_id: item.typeId, brand: item.brand, size: item.size, uom: item.uom, min_stock: item.minStock, is_active: String(item.isActive) }
          : { uom: "Pcs", min_stock: 0 }
      }
      onSubmit={(v) => saveApdItemAction(item?.id ?? null, { ...v, code: item?.code ?? v.code })}
    />
  );
}

/** Catat mutasi stok. `lineId` = OUT untuk baris pengajuan (penerima & site dari pengajuan). */
export function MoveSheet({
  trigger,
  warehouses,
  items,
  employees,
  sites,
  defaultWarehouse,
  defaultKind = "in",
  lineId,
  title,
}: {
  trigger: ReactElement;
  warehouses: SelectOption[];
  items: SelectOption[];
  employees?: SelectOption[];
  sites?: SelectOption[];
  defaultWarehouse?: string | null;
  defaultKind?: (typeof MOVE_KINDS)[number];
  lineId?: string;
  title?: string;
}) {
  const forLine = !!lineId;
  const isKind = (...k: string[]) => (v: Record<string, string>) => k.includes(v.kind);
  return (
    <QuickSheet
      trigger={trigger}
      eyebrow="Mutasi stok APD"
      title={title ?? "Catat Mutasi Stok"}
      description={forLine ? "Pengiriman untuk pengajuan: penerima dan site tujuan diambil dari pengajuan. Stok gudang tidak boleh minus." : "Stok dihitung dari semua mutasi. Pengeluaran ditolak bila stok gudang tidak cukup."}
      fields={[
        ...(forLine ? [] : [{ name: "kind", label: "Jenis mutasi", type: "select" as const, required: true, options: MOVE_KINDS.map((k) => ({ value: k, label: MOVE_KIND[k].label, description: MOVE_KIND[k].hint })) }]),
        { name: "location_id", label: "Gudang", type: "select", options: warehouses, required: true },
        { name: "item_id", label: "Barang", type: "select", options: items, required: true },
        { name: "qty", label: "Jumlah", type: "number", required: true, hint: forLine ? undefined : "Penyesuaian: angka negatif untuk mengurangi stok." },
        { name: "moved_on", label: "Tanggal", type: "date", required: true },
        { name: "ref_no", label: "No referensi", placeholder: "No PR/MR (masuk) atau no BAST (keluar)", maxLength: 60 },
        { name: "pic", label: "PIC", placeholder: "Penerima di gudang / pengirim", maxLength: 120 },
        ...(forLine
          ? []
          : [
              { name: "employee_id", label: "Karyawan", type: "select" as const, options: employees ?? [], show: isKind("out", "return"), hint: "Kosongkan bila penerima bukan karyawan terdaftar." },
              { name: "recipient_name", label: "Nama penerima", maxLength: 120, show: (v: Record<string, string>) => v.kind === "out" && !v.employee_id, placeholder: "mis. Tim OJT Kalimantan" },
              { name: "dest_location_id", label: "Site tujuan", type: "select" as const, options: sites ?? [], show: isKind("out"), hint: "Default: site karyawan." },
            ]),
        { name: "note", label: "Catatan", type: "textarea", maxLength: 500, hint: "Wajib (min. 10 karakter) untuk penyesuaian." },
      ]}
      initial={{ kind: forLine ? "out" : defaultKind, location_id: defaultWarehouse ?? warehouses[0]?.value ?? "", moved_on: todayWib() }}
      onSubmit={(v) => saveMoveAction({ ...v, kind: forLine ? "out" : v.kind, request_line_id: lineId ?? null })}
    />
  );
}

export function VoidMoveButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  return (
    <ConfirmDialog
      trigger={<button type="button" className="text-xs text-red-700 underline underline-offset-2 dark:text-red-400">Batalkan</button>}
      title={`Batalkan mutasi ${label}?`}
      description="Mutasi tidak dihapus: tetap tercatat dengan alasan, tetapi tidak dihitung dalam stok. Tulis alasan (minimal 10 karakter)."
      confirmText="Ya, batalkan"
      destructive
      confirmDisabled={reason.trim().length < 10}
      onConfirm={async () => {
        const res = await voidMoveAction(id, reason);
        if (res.status !== "ok") {
          toast.error(res.message);
          throw new Error(res.message);
        }
        toast.success(res.message);
        router.refresh();
      }}
    >
      <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Alasan pembatalan" aria-label="Alasan pembatalan" maxLength={1000} />
    </ConfirmDialog>
  );
}
