// [starter-standar] diperluas (frontend-guide §6.2). SATU sumber menu: sidebar + global search.
// Tambah fitur = tambah SATU baris di NAV_ITEMS.
import {
  BadgeCheck,
  BookOpen,
  Building2,
  ClipboardCheck,
  ClipboardList,
  Eye,
  Gauge,
  Database,
  FileBarChart,
  GraduationCap,
  Presentation,
  Stethoscope,
  Users2,
  FileText,
  Headset,
  Inbox,
  Info,
  LayoutDashboard,
  ListChecks,
  type LucideIcon,
  MessageSquareHeart,
  Megaphone,
  BellRing,
  MessagesSquare,
  Route,
  ScrollText,
  ShieldAlert,
  Siren,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import type { AppAccess } from "@/lib/access-types";
import { hasAnyFunction, type Fn } from "@/lib/functions";
import { roleAtLeast, type Role } from "@/lib/roles";

// Grup sesuai prototipe Safe Hub (rancangan §2.13). Grup tanpa item yang boleh dilihat tidak tampil.
export type NavGroupId = "menu" | "k3lh" | "people" | "dokumen" | "maintenance" | "laporan" | "inbox" | "admin" | "bantuan";

export type NavItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  min: Role;
  group: NavGroupId;
  /** sinonim, singkatan, istilah lama (untuk cari menu & global search) */
  keywords?: string[];
  /** Fungsi K3 yang boleh melihat menu (salah satu). Tidak diisi = semua fungsi. */
  functions?: Fn[];
  /** aturan tambahan (company, data members) */
  visible?: (a: AppAccess) => boolean;
  /** kunci badge dari provider (notifikasi, bantuan, pembaruan, tugas) */
  badge?: "notifications" | "support" | "updates" | "tasks" | "incidents" | "findings";
  /** Halaman buat baru → muncul di tombol "Buat" top bar (rancangan §2.13) */
  createHref?: string;
  /** Label di menu "Buat" (default = label menu) */
  createLabel?: string;
  /** Role minimum untuk tombol Buat (default = min menu) */
  createMin?: Role;
  /** Aturan tambahan tombol Buat (mis. fungsi K3 tertentu); WAJIB sama dengan cek di RPC */
  createVisible?: (a: AppAccess) => boolean;
};

/** Semua yang bisa menulis K3 (auditor = baca saja, rancangan §2.1). Cermin k3_writer() di DB. */
const notAuditor = (a: AppAccess) => !a.functions.includes("auditor");
/** Staf K3 (fungsi selain karyawan) atau admin: menu daftar Temuan. Karyawan membuka temuan lewat Tugas Saya. */
const k3Staff = (a: AppAccess) => a.role === "admin" || a.platformAdmin || a.functions.some((f) => f !== "karyawan");

export const NAV_GROUP_LABELS: Record<NavGroupId, string> = {
  menu: "Menu",
  k3lh: "K3LH",
  people: "People & Compliance",
  dokumen: "Dokumen",
  maintenance: "Maintenance",
  laporan: "Laporan",
  inbox: "Inbox",
  admin: "Admin",
  bantuan: "Bantuan",
};

export const NAV_GROUP_ORDER: NavGroupId[] = ["menu", "k3lh", "people", "dokumen", "maintenance", "laporan", "inbox", "admin", "bantuan"];

export const NAV_ITEMS: NavItem[] = [
  // ── Menu ──────────────────────────────────────────────────────────────
  {
    href: "/",
    label: "Beranda",
    description: "Ringkasan, yang perlu aksi Anda, dan statistik",
    icon: LayoutDashboard,
    min: "viewer",
    group: "menu",
    keywords: ["dashboard", "home", "ringkasan"],
  },
  // CONTOH: hapus bersama db/app/example_pengajuan.sql saat app punya dokumen asli
  {
    href: "/pengajuan",
    label: "Pengajuan",
    description: "Contoh dokumen dengan approval (boilerplate)",
    icon: FileText,
    min: "viewer",
    group: "menu",
    keywords: ["pj", "permintaan", "request", "contoh"],
    createHref: "/pengajuan/baru",
    createLabel: "Pengajuan (contoh)",
    createMin: "editor",
  },

  // ── K3LH ──────────────────────────────────────────────────────────────
  {
    href: "/kejadian/lapor",
    label: "Lapor Kejadian",
    description: "Catat kejadian, near miss, cedera, atau kondisi berbahaya",
    icon: Siren,
    min: "viewer",
    group: "k3lh",
    keywords: ["lapor", "insiden", "kecelakaan", "near miss", "nearmiss", "cedera", "darurat", "kjd"],
    visible: notAuditor,
    createHref: "/kejadian/lapor",
    createLabel: "Lapor Kejadian",
  },
  {
    href: "/kejadian",
    label: "Kejadian & Investigasi",
    description: "Klasifikasi, investigasi, review, dan penutupan kejadian",
    icon: ShieldAlert,
    min: "viewer",
    group: "k3lh",
    keywords: ["insiden", "kecelakaan", "investigasi", "kjd", "laporan saya", "near miss"],
    badge: "incidents",
  },
  {
    href: "/inspeksi",
    label: "Inspeksi & Observasi",
    description: "Jadwal inspeksi, checklist, rencana vs aktual",
    icon: ListChecks,
    min: "viewer",
    group: "k3lh",
    keywords: ["inspeksi", "audit", "checklist", "jadwal", "ins", "padlock", "apar", "p3k", "kalender"],
    visible: k3Staff,
  },
  {
    href: "/observasi",
    label: "Observasi KTA/TTA",
    description: "Lapor cepat kondisi atau tindakan tidak aman",
    icon: Eye,
    min: "viewer",
    group: "k3lh",
    keywords: ["observasi", "kta", "tta", "kondisi tidak aman", "tindakan tidak aman", "obs"],
    createHref: "/observasi/baru",
    createLabel: "Observasi KTA/TTA",
    createVisible: notAuditor,
  },
  {
    href: "/temuan",
    label: "Temuan & PICA",
    description: "Temuan, tindakan perbaikan, dan verifikasi bukti",
    icon: ClipboardList,
    min: "viewer",
    group: "k3lh",
    keywords: ["temuan", "pica", "tindakan", "capa", "finding", "tmn", "pca", "kanban", "overdue"],
    visible: k3Staff,
    badge: "findings",
    createHref: "/temuan/baru",
    createLabel: "Temuan",
    createVisible: (a) => notAuditor(a) && a.functions.some((f) => f === "hse" || f === "pengawas" || f === "pjo"),
  },
  {
    href: "/tsp",
    label: "TSP & Aktivitas",
    description: "Tujuan dan Sasaran Program, aktivitas K3, evaluasi bulanan",
    icon: Target,
    min: "viewer",
    group: "k3lh",
    keywords: ["tsp", "program", "sasaran", "aktivitas", "safety talk", "kampanye", "evaluasi", "akt", "capaian"],
    visible: k3Staff,
  },
  {
    href: "/laporan",
    label: "Laporan Periode",
    description: "Susun, review, setujui, dan terbitkan laporan berkala",
    icon: FileBarChart,
    min: "viewer",
    group: "laporan",
    keywords: ["laporan", "periode", "bulanan", "evaluasi monthly", "pjo", "lap", "terbit", "snapshot"],
    visible: k3Staff,
  },
  // ── People & Compliance ───────────────────────────────────────────────
  {
    href: "/manpower",
    label: "Manpower",
    description: "Tenaga kerja aktif, kebutuhan personel, permit site",
    icon: Users2,
    min: "viewer",
    group: "people",
    keywords: ["manpower", "karyawan", "tenaga kerja", "nik", "personel", "permit", "izin masuk"],
    visible: k3Staff,
  },
  {
    href: "/kompetensi",
    label: "Kompetensi",
    description: "Matriks kompetensi, sertifikat, dan masa berlaku",
    icon: GraduationCap,
    min: "viewer",
    group: "people",
    keywords: ["kompetensi", "sertifikat", "k3 umum", "bmc", "matriks"],
    visible: k3Staff,
  },
  {
    href: "/pelatihan",
    label: "Pelatihan",
    description: "Rencana, peserta, kehadiran, dan bukti pelatihan",
    icon: Presentation,
    min: "viewer",
    group: "people",
    keywords: ["pelatihan", "training", "peserta", "kehadiran", "trn", "kelas"],
    visible: k3Staff,
  },
  {
    href: "/mcu",
    label: "MCU",
    description: "Medical Check Up dan masa berlakunya",
    icon: Stethoscope,
    min: "viewer",
    group: "people",
    keywords: ["mcu", "medical", "kesehatan", "fit", "check up"],
    visible: k3Staff,
  },
  // ── Inbox ─────────────────────────────────────────────────────────────
  {
    href: "/tugas",
    label: "Tugas Saya",
    description: "Yang perlu tindakan, verifikasi, dan persetujuan Anda",
    icon: ClipboardCheck,
    min: "viewer",
    group: "inbox",
    keywords: ["approval", "persetujuan", "antrian", "setujui", "tolak", "acc", "todo"],
    badge: "tasks",
  },
  {
    href: "/notifikasi",
    label: "Notifikasi",
    description: "Semua notifikasi Anda",
    icon: Inbox,
    min: "viewer",
    group: "inbox",
    keywords: ["inbox", "pemberitahuan", "notif"],
    badge: "notifications",
  },

  // ── Laporan ───────────────────────────────────────────────────────────
  {
    href: "/kpi",
    label: "Kamus KPI",
    description: "Definisi, rumus, sumber, dan pemilik setiap KPI",
    icon: Gauge,
    min: "viewer",
    group: "laporan",
    keywords: ["kpi", "ltifr", "ltisr", "rumus", "definisi", "jam kerja", "indikator"],
    visible: k3Staff,
  },
  {
    href: "/pengingat",
    label: "Pengaturan Pengingat",
    description: "Kapan dan kepada siapa pengingat jatuh tempo dikirim",
    icon: BellRing,
    min: "viewer",
    group: "laporan",
    keywords: ["pengingat", "reminder", "jatuh tempo", "notifikasi", "kedaluwarsa"],
    visible: k3Staff,
  },
  {
    href: "/audit",
    label: "Audit Trail",
    description: "Riwayat perubahan seluruh modul (admin dan Auditor)",
    icon: ScrollText,
    min: "viewer",
    group: "admin",
    keywords: ["audit", "riwayat", "log", "jejak", "perubahan", "auditor"],
    visible: (a) => a.role === "admin" || a.platformAdmin || a.functions.includes("auditor"),
  },
  // ── Admin ─────────────────────────────────────────────────────────────
  {
    href: "/pengguna",
    label: "Pengguna & Peran",
    description: "Atur siapa yang bisa membuka app ini, role, dan fungsi K3-nya",
    icon: Users,
    min: "admin",
    group: "admin",
    keywords: ["user", "akses", "role", "hak akses", "karyawan", "fungsi k3", "peran"],
  },
  {
    href: "/master",
    label: "Master Data",
    description: "Area per site, kategori kejadian, tingkat risiko, perusahaan mitra",
    icon: Database,
    min: "admin",
    group: "admin",
    keywords: ["master", "area", "site", "lokasi", "kategori", "risiko", "mitra", "kontraktor", "subkon", "vendor"],
  },
  {
    href: "/approval/template",
    label: "Template Approval",
    description: "Aturan jalur approval per jenis dokumen",
    icon: Route,
    min: "admin",
    group: "admin",
    keywords: ["jalur", "alur", "approver", "workflow"],
  },
  {
    href: "/approval/kepala-departemen",
    label: "Kepala Departemen",
    description: "Kepala departemen per perusahaan untuk approval",
    icon: Building2,
    min: "admin",
    group: "admin",
    keywords: ["dept head", "atasan", "departemen", "manager"],
  },
  {
    href: "/bantuan/kelola",
    label: "Inbox Bantuan",
    description: "Percakapan bantuan dari pengguna",
    icon: MessagesSquare,
    min: "admin",
    group: "admin",
    keywords: ["chat", "tiket", "support", "helpdesk"],
  },
  {
    href: "/feedback/kelola",
    label: "Kelola Feedback",
    description: "Laporan bug dan saran dari pengguna",
    icon: BadgeCheck,
    min: "admin",
    group: "admin",
    keywords: ["saran", "bug", "laporan"],
  },

  // ── Bantuan ───────────────────────────────────────────────────────────
  {
    href: "/dokumentasi",
    label: "Dokumentasi",
    description: "Panduan interaktif cara memakai app",
    icon: BookOpen,
    min: "viewer",
    group: "bantuan",
    keywords: ["panduan", "tutorial", "cara", "manual", "faq"],
  },
  {
    href: "/bantuan",
    label: "Bantuan Admin",
    description: "Tanya atau laporkan kendala ke admin app",
    icon: Headset,
    min: "viewer",
    group: "bantuan",
    keywords: ["chat admin", "tanya", "kendala", "support"],
    badge: "support",
  },
  {
    href: "/feedback",
    label: "Feedback",
    description: "Kirim saran atau laporan bug",
    icon: MessageSquareHeart,
    min: "viewer",
    group: "bantuan",
    keywords: ["saran", "masukan", "bug"],
  },
  {
    href: "/pembaruan",
    label: "Pembaruan",
    description: "Catatan rilis dan pengumuman app",
    icon: Megaphone,
    min: "viewer",
    group: "bantuan",
    keywords: ["update", "changelog", "rilis", "versi", "update web"],
    badge: "updates",
  },
  {
    href: "/tentang",
    label: "Tentang App",
    description: "Tentang app ini dan versinya",
    icon: Info,
    min: "viewer",
    group: "bantuan",
    keywords: ["about", "versi", "info"],
  },
];

/** Ikon tambahan untuk aksi cepat global search */
export const QUICK_ACTION_ICON = Sparkles;

export type NavGroup = { id: NavGroupId; label: string; items: NavItem[] };

export function canSee(item: NavItem, access: AppAccess): boolean {
  return (
    roleAtLeast(access.role, item.min) &&
    (!item.functions?.length || hasAnyFunction(access, item.functions)) &&
    (item.visible ? item.visible(access) : true)
  );
}

/** Item tombol "Buat" di top bar: menu yang boleh dilihat dan punya halaman buat baru. */
export function buildCreateItems(access: AppAccess): NavItem[] {
  return NAV_ITEMS.filter(
    (i) => i.createHref && canSee(i, access) && roleAtLeast(access.role, i.createMin ?? i.min) && (i.createVisible ? i.createVisible(access) : true),
  );
}

/** Dipakai sidebar DAN global search: menu yang tidak boleh dibuka tidak pernah muncul. */
export function buildNavGroups(access: AppAccess): NavGroup[] {
  return NAV_GROUP_ORDER
    .map((id) => ({ id, label: NAV_GROUP_LABELS[id], items: NAV_ITEMS.filter((i) => i.group === id && canSee(i, access)) }))
    .filter((g) => g.items.length > 0);
}

/** Menu aktif = longest match (`/pengajuan/baru` tetap mengaktifkan `/pengajuan`, menu terpanjang menang). */
export function activeHref(pathname: string, items: NavItem[]): string | null {
  let best: string | null = null;
  for (const i of items) {
    const match = i.href === "/" ? pathname === "/" : pathname === i.href || pathname.startsWith(`${i.href}/`);
    if (match && (!best || i.href.length > best.length)) best = i.href;
  }
  return best;
}

/** Label crumb untuk path (breadcrumb). */
export function labelForPath(path: string): string | null {
  return NAV_ITEMS.find((i) => i.href === path)?.label ?? null;
}
