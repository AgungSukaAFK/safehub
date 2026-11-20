// Tipe & label Bantuan Admin (aman client + server).
import type { Person } from "@/lib/person-types";
import type { StatusDef } from "@/lib/status";

type Brief = Pick<Person, "id" | "name" | "avatarUrl">;

export type SupportThread = {
  id: string;
  category: string;
  subject: string;
  status: string;
  context: Record<string, unknown> | null;
  lastMessageAt: string;
  createdAt: string;
  user: Brief | null;
  assignedTo: Brief | null;
  /** ada pesan dari lawan bicara yang belum dibaca */
  unread: boolean;
};

export type SupportMessage = {
  id: string;
  body: string | null;
  createdAt: string;
  readAt: string | null;
  mine: boolean;
  sender: Brief | null;
  attachment: { path: string; name: string; url: string | null } | null;
  /** pesan optimistik yang belum dikonfirmasi server */
  pending?: boolean;
};

export type SupportThreadDetail = SupportThread & { messages: SupportMessage[] };

export const SUPPORT_CATEGORIES = [
  { value: "akses", label: "Kendala akses" },
  { value: "error", label: "Error / bug" },
  { value: "cara_pakai", label: "Cara pakai" },
  { value: "data", label: "Data salah" },
  { value: "lainnya", label: "Lainnya" },
] as const;
export const SUPPORT_CATEGORY_VALUES = SUPPORT_CATEGORIES.map((c) => c.value);
export const supportCategoryLabel = (v: string) => SUPPORT_CATEGORIES.find((c) => c.value === v)?.label ?? v;

export const SUPPORT_STATUS: Record<string, StatusDef> = {
  menunggu: { label: "Menunggu", color: "amber" },
  dibalas: { label: "Dibalas", color: "blue" },
  selesai: { label: "Selesai", color: "emerald" },
};
