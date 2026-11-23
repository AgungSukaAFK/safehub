// Aturan Pengguna & Akses + Profil (aman client + server): sort whitelist, opsi filter, zod, label log.
import { z } from "zod";
import { FUNCTION_LABELS, FUNCTIONS } from "@/lib/functions";
import type { FieldLabel } from "@/lib/person-types";
import { ROLE_LABELS, ROLES } from "@/lib/roles";

export const PENGGUNA_SORTS = ["nama", "role", "diberikan"] as const;
export const PENGGUNA_SEARCH_FIELDS = ["Nama", "Email", "NRP"];

export const ROLE_OPTIONS = ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }));
export { FUNCTION_OPTIONS } from "@/lib/functions";

export const ACTIVE_STATUSES = ["aktif", "nonaktif"] as const;
export const ACTIVE_OPTIONS = [
  { value: "aktif", label: "Aktif" },
  { value: "nonaktif", label: "Nonaktif" },
];

/** Penjelasan role di dialog Tambah Akses / Ubah role (frontend-guide §15.2). */
export const ROLE_HINTS = {
  viewer: "Melihat data dan memproses approval yang ditugaskan.",
  editor: "Viewer + membuat dan mengubah data.",
  admin: "Editor + menghapus data dan mengelola akses, template approval, serta modul admin.",
} as const;

// ---------------------------------------------------------------- members (data khusus app)

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} maksimal ${max} karakter`)
    .transform((v) => v || null)
    .nullable()
    .optional()
    .transform((v) => v ?? null);

export const memberSchema = z.object({
  team: optionalText(100, "Tim"),
  approval_limit: z
    .number({ invalid_type_error: "Isi angka" })
    .min(0, "Tidak boleh negatif")
    .max(1e15, "Angka terlalu besar")
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  admin_note: optionalText(1000, "Catatan"),
});
export type MemberInput = z.infer<typeof memberSchema>;

/** Label kolom members di Riwayat Aktivitas (kolom lain disembunyikan). */
export const MEMBER_FIELD_LABELS: Record<string, FieldLabel> = {
  team: { label: "Tim" },
  approval_limit: { label: "Batas approval", format: "rupiah" },
  admin_note: { label: "Catatan admin" },
  functions: { label: "Fungsi K3", format: "status", statuses: Object.fromEntries(FUNCTIONS.map((f) => [f, { label: FUNCTION_LABELS[f] }])) },
  // statuses (id → nama site) dilengkapi halaman dari daftar site
  location_ids: { label: "Batas site", format: "status" },
};

// ---------------------------------------------------------------- Peran K3 (rancangan §2.1, §2.2)

export const k3RolesSchema = z.object({
  functions: z.array(z.enum(FUNCTIONS)).max(FUNCTIONS.length),
  /** null = semua site */
  location_ids: z.array(z.string().uuid("Site tidak valid")).min(1, "Pilih minimal satu site").max(200).nullable(),
});
export type K3RolesInput = z.infer<typeof k3RolesSchema>;

// ---------------------------------------------------------------- profil sendiri

/** No HP Indonesia: 08… / +62… / 62…, boleh spasi atau tanda hubung. Kosong = hapus. */
export const phoneSchema = z
  .string()
  .trim()
  .max(20, "Maksimal 20 karakter")
  .refine((v) => v === "" || /^(\+62|62|0)8[0-9\s-]{7,15}$/.test(v), "Format No HP tidak valid (contoh: 0812 3456 7890)")
  .transform((v) => (v ? v.replace(/[\s-]/g, "") : null));
