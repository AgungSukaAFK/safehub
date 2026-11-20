// Registry jenis data global search (frontend-guide §6.6). SATU baris per jenis yang dikembalikan
// RPC <app>.global_search (kolom `kind`). Dokumen baru: tambah union di SQL global_search + baris di sini.
import { FileText, type LucideIcon } from "lucide-react";
import { DOCUMENT_STATUS, type StatusDef } from "@/lib/status";

export type SearchKind = {
  label: string;
  icon: LucideIcon;
  /** Halaman list yang membaca ?q= (untuk "Lihat semua hasil") */
  listHref?: (q: string) => string;
  statuses?: Record<string, StatusDef>;
};

export const SEARCH_KINDS: Record<string, SearchKind> = {
  // CONTOH boilerplate (hapus bersama /pengajuan)
  pengajuan: {
    label: "Pengajuan",
    icon: FileText,
    listHref: (q) => `/pengajuan?q=${encodeURIComponent(q)}`,
    statuses: DOCUMENT_STATUS,
  },
};

/** Urutan grup data di hasil pencarian */
export const SEARCH_KIND_ORDER = Object.keys(SEARCH_KINDS);
