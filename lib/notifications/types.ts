// Bentuk notifikasi untuk UI (aman di client). Kategori = kolom `category` (diisi RPC domain).
import { ClipboardCheck, ClipboardList, Headset, Info, ListChecks, MessageSquareText, ShieldAlert, type LucideIcon } from "lucide-react";

export type NotificationItem = {
  id: string;
  type: string;
  category: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
  actor: { id: string; name: string; avatarUrl: string | null } | null;
};

export const NOTIFICATION_CATEGORIES: Record<string, { label: string; icon: LucideIcon }> = {
  approval: { label: "Approval", icon: ClipboardCheck },
  kejadian: { label: "Kejadian", icon: ShieldAlert },
  pica: { label: "Temuan & PICA", icon: ClipboardList },
  inspeksi: { label: "Inspeksi", icon: ListChecks },
  bantuan: { label: "Bantuan", icon: Headset },
  feedback: { label: "Feedback", icon: MessageSquareText },
  umum: { label: "Umum", icon: Info },
};

export const categoryLabel = (c: string) => NOTIFICATION_CATEGORIES[c]?.label ?? c;

/** Event window saat notifikasi baru masuk (halaman /notifikasi & inbox ikut memuat ulang). */
export const NOTIFICATION_EVENT = "app:notification";
