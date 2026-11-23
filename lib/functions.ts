// Fungsi K3 (rancangan-implementasi §2.1, keputusan D1/D14). Lapis kedua di atas role app:
// role (viewer/editor/admin) = gerbang app; fungsi = aksi per modul, menu, data terbatas.
// Disimpan di __APP__.members.functions (dijaga members_guard). Daftar ini HARUS sama dengan
// constraint members.functions di db/app/01_base.sql. Aman dipakai client + server.
import type { AppAccess } from "@/lib/access-types";

export const FUNCTIONS = [
  "hse",
  "hse_senior",
  "manajemen",
  "pjo",
  "pja",
  "pengawas",
  "hr",
  "maintenance",
  "scm",
  "kontraktor_admin",
  "karyawan",
  "auditor",
] as const;
export type Fn = (typeof FUNCTIONS)[number];

export function isFn(v: unknown): v is Fn {
  return typeof v === "string" && (FUNCTIONS as readonly string[]).includes(v);
}

export const FUNCTION_LABELS: Record<Fn, string> = {
  hse: "HSE",
  hse_senior: "HSE Senior",
  manajemen: "Manajemen",
  pjo: "PJO",
  pja: "PJA",
  pengawas: "Pengawas",
  hr: "HR",
  maintenance: "Service/Maintenance",
  scm: "SCM/Gudang",
  kontraktor_admin: "Pengelola Kontraktor",
  karyawan: "Karyawan",
  auditor: "Auditor",
};

export const FUNCTION_DESCRIPTIONS: Record<Fn, string> = {
  hse: "Klasifikasi & investigasi kejadian, temuan, inspeksi, laporan periode.",
  hse_senior: "Review EHS kejadian (sebelum review manajemen). Biasanya bersama fungsi HSE.",
  manajemen: "Review & persetujuan manajemen, melihat semua ringkasan.",
  pjo: "Penanggung Jawab Operasional: persetujuan kejadian & laporan periode.",
  pja: "Penanggung Jawab Area.",
  pengawas: "PIC tindakan di lapangan, membuat temuan, inspeksi.",
  hr: "Manpower, kompetensi, MCU (termasuk data kesehatan terbatas).",
  maintenance: "Data maintenance (baca dari sistem maintenance).",
  scm: "Material request & gudang (baca dari sistem maintenance).",
  kontraktor_admin: "Mengelola data kontraktor, izin, dan PJO/PJA.",
  karyawan: "Menu ringkas: lapor kejadian, tugas, dan notifikasi milik sendiri.",
  auditor: "Membaca semua data termasuk audit trail, tanpa menulis.",
};

export const FUNCTION_OPTIONS = FUNCTIONS.map((f) => ({ value: f, label: FUNCTION_LABELS[f] }));

/** true kalau user punya fungsi `fn`. */
export function hasFunction(access: Pick<AppAccess, "functions">, fn: Fn): boolean {
  return access.functions.includes(fn);
}

/** true kalau user punya salah satu fungsi di `fns`. */
export function hasAnyFunction(access: Pick<AppAccess, "functions">, fns: readonly Fn[]): boolean {
  return fns.some((f) => access.functions.includes(f));
}

/** Urutkan & buang nilai tidak dikenal (data dari DB atau form). */
export function normalizeFunctions(values: readonly unknown[]): Fn[] {
  const set = new Set(values.filter(isFn));
  return FUNCTIONS.filter((f) => set.has(f));
}
