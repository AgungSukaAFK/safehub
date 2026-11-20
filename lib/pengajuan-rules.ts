// CONTOH boilerplate (hapus bersama /pengajuan). Aturan domain Pengajuan yang aman dipakai client &
// server: skema zod (validasi server = sumber kebenaran), label field Riwayat, opsi filter.
import { z } from "zod";
import type { FieldLabel } from "@/lib/person-types";
import { DOCUMENT_STATUS } from "@/lib/status";
import { randomUUID } from "@/lib/utils";

export const PENGAJUAN_STATUSES = ["draft", "pending_approval", "approved", "rejected", "cancelled", "completed"] as const;
export type PengajuanStatus = (typeof PENGAJUAN_STATUSES)[number];

/** Kolom yang boleh di-sort (id kolom tabel = key URL `urut=<key>.<dir>`) */
export const PENGAJUAN_SORTS = ["kode", "tanggal", "dibutuhkan", "total", "status"] as const;
export const PENGAJUAN_SEARCH_FIELDS = ["Kode", "Judul", "Keterangan", "Nama/part barang"];

export const STATUS_OPTIONS = PENGAJUAN_STATUSES.map((s) => ({ value: s, label: DOCUMENT_STATUS[s].label }));

/** Pengajuan bisa diubah/diajukan hanya saat draft atau ditolak (cermin guard DB). */
export const EDITABLE_STATUSES: readonly string[] = ["draft", "rejected"];

/** Di atas nilai ini Ringkasan memberi peringatan (contoh aturan bisnis). */
export const BIG_AMOUNT = 10_000_000;

const money = z.coerce.number({ invalid_type_error: "Harus angka" }).min(0, "Tidak boleh negatif").max(9_999_999_999_999, "Terlalu besar");

export const itemSchema = z.object({
  item_name: z.string().trim().min(1, "Nama barang wajib diisi").max(200, "Maksimal 200 karakter"),
  part_number: z.string().trim().max(100, "Maksimal 100 karakter").optional().default(""),
  qty: z.coerce.number({ invalid_type_error: "Harus angka" }).gt(0, "Jumlah harus lebih dari 0").max(99_999_999, "Terlalu besar"),
  unit: z.string().trim().min(1, "Satuan wajib diisi").max(20, "Maksimal 20 karakter"),
  unit_price: money,
  note: z.string().trim().max(500, "Maksimal 500 karakter").optional().default(""),
});

export const pengajuanSchema = z.object({
  company_code: z.string().min(1, "Pilih perusahaan"),
  department_id: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(3, "Judul minimal 3 karakter").max(200, "Maksimal 200 karakter"),
  description: z.string().trim().max(4000, "Maksimal 4000 karakter").optional().default(""),
  needed_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid")
    .nullable()
    .optional(),
  items: z.array(itemSchema).min(1, "Tambahkan minimal 1 barang").max(500, "Maksimal 500 baris"),
});
export type PengajuanInput = z.infer<typeof pengajuanSchema>;

/** Nilai form di client (semua string supaya input terkontrol). */
export type ItemValues = { key: string; item_name: string; part_number: string; qty: string; unit: string; unit_price: string; note: string };
export type PengajuanValues = {
  company_code: string | null;
  department_id: string | null;
  title: string;
  description: string;
  needed_date: string | null;
  items: ItemValues[];
};

/** Baris barang kosong (key = kunci React, tidak dikirim ke server). */
export const newItem = (): ItemValues => ({ key: randomUUID(), item_name: "", part_number: "", qty: "1", unit: "pcs", unit_price: "", note: "" });

export const lineTotal = (i: Pick<ItemValues, "qty" | "unit_price">) => Math.round((Number(i.qty) || 0) * (Number(i.unit_price) || 0) * 100) / 100;
export const itemsTotal = (items: Pick<ItemValues, "qty" | "unit_price">[]) => items.reduce((s, i) => s + lineTotal(i), 0);

/** Label kolom untuk Riwayat Aktivitas (kolom tabel `pengajuan` + ekstra `items`). */
export const PENGAJUAN_FIELD_LABELS: Record<string, FieldLabel> = {
  code: { label: "Nomor" },
  company_code: { label: "Perusahaan" },
  department_id: { label: "Departemen", format: "person" },
  status: { label: "Status", format: "status", statuses: DOCUMENT_STATUS },
  title: { label: "Judul" },
  description: { label: "Keterangan" },
  needed_date: { label: "Tanggal dibutuhkan", format: "date" },
  total_amount: { label: "Total", format: "rupiah" },
  items: { label: "Barang", format: "list" },
  langkah: { label: "Langkah approval", format: "number" },
  approver: { label: "Approver" },
};
