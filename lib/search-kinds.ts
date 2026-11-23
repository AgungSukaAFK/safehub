// Registry jenis data global search (frontend-guide §6.6). SATU baris per jenis yang dikembalikan
// RPC <app>.global_search (kolom `kind`). Dokumen baru: tambah union di SQL global_search + baris di sini.
import { ClipboardList, FileText, ListChecks, type LucideIcon, ShieldAlert } from "lucide-react";
import { INCIDENT_STATUS } from "@/lib/kejadian-rules";
import { ACTION_STATUS } from "@/lib/pica-rules";
import { DOCUMENT_STATUS, type StatusDef } from "@/lib/status";
import { FINDING_STATUS } from "@/lib/temuan-rules";

export type SearchKind = {
  label: string;
  icon: LucideIcon;
  /** Halaman list yang membaca ?q= (untuk "Lihat semua hasil") */
  listHref?: (q: string) => string;
  statuses?: Record<string, StatusDef>;
};

export const SEARCH_KINDS: Record<string, SearchKind> = {
  kejadian: {
    label: "Kejadian",
    icon: ShieldAlert,
    listHref: (q) => `/kejadian?q=${encodeURIComponent(q)}`,
    statuses: INCIDENT_STATUS,
  },
  temuan: {
    label: "Temuan",
    icon: ClipboardList,
    listHref: (q) => `/temuan?q=${encodeURIComponent(q)}`,
    statuses: FINDING_STATUS,
  },
  tindakan: {
    label: "Tindakan PICA",
    icon: ListChecks,
    statuses: ACTION_STATUS,
  },
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
