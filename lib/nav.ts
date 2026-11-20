// [starter-standar] diperluas (frontend-guide §6.2). SATU sumber menu: sidebar + global search.
// Tambah fitur = tambah SATU baris di NAV_ITEMS.
import {
  BadgeCheck,
  BookOpen,
  Building2,
  ClipboardCheck,
  FileText,
  Headset,
  Inbox,
  Info,
  LayoutDashboard,
  type LucideIcon,
  MessageSquareHeart,
  Megaphone,
  MessagesSquare,
  Route,
  Sparkles,
  Users,
} from "lucide-react";
import type { AppAccess } from "@/lib/access-types";
import { roleAtLeast, type Role } from "@/lib/roles";

export type NavGroupId = "menu" | "admin" | "bantuan";

export type NavItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  min: Role;
  group: NavGroupId;
  /** sinonim, singkatan, istilah lama (untuk cari menu & global search) */
  keywords?: string[];
  /** aturan tambahan (company, data members) */
  visible?: (a: AppAccess) => boolean;
  /** kunci badge dari provider (notifikasi, bantuan, pembaruan, approval) */
  badge?: "notifications" | "support" | "updates" | "approvals";
};

export const NAV_GROUP_LABELS: Record<NavGroupId, string> = {
  menu: "Menu",
  admin: "Admin",
  bantuan: "Bantuan",
};

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
  {
    href: "/approval",
    label: "Approval Saya",
    description: "Dokumen yang menunggu persetujuan Anda",
    icon: ClipboardCheck,
    min: "viewer",
    group: "menu",
    keywords: ["persetujuan", "antrian", "setujui", "tolak", "acc"],
    badge: "approvals",
  },
  {
    href: "/notifikasi",
    label: "Notifikasi",
    description: "Semua notifikasi Anda",
    icon: Inbox,
    min: "viewer",
    group: "menu",
    keywords: ["inbox", "pemberitahuan", "notif"],
    badge: "notifications",
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
  },

  // ── Admin ─────────────────────────────────────────────────────────────
  {
    href: "/pengguna",
    label: "Pengguna & Akses",
    description: "Atur siapa yang bisa membuka app ini dan role-nya",
    icon: Users,
    min: "admin",
    group: "admin",
    keywords: ["user", "akses", "role", "hak akses", "karyawan"],
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
  return roleAtLeast(access.role, item.min) && (item.visible ? item.visible(access) : true);
}

/** Dipakai sidebar DAN global search: menu yang tidak boleh dibuka tidak pernah muncul. */
export function buildNavGroups(access: AppAccess): NavGroup[] {
  const order: NavGroupId[] = ["menu", "admin", "bantuan"];
  return order
    .map((id) => ({ id, label: NAV_GROUP_LABELS[id], items: NAV_ITEMS.filter((i) => i.group === id && canSee(i, access)) }))
    .filter((g) => g.items.length > 0);
}

/** Menu aktif = longest match (`/approval/template` tidak ikut mengaktifkan `/approval`). */
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
