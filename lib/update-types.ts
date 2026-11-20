// Tipe & aturan Pembaruan / Update Web (aman client + server).
import { z } from "zod";
import type { Person } from "@/lib/person-types";
import type { RichNode } from "@/lib/rich-text";

export const REACTION_EMOJIS = ["👍", "❤️", "🎉", "😂", "😮", "🙏"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

/** Event window + key storage: post sudah dilihat (badge sinkron antar tab). */
export const UPDATE_SEEN_KEY = "update-seen";

export type ReactionGroup = { emoji: string; count: number; names: string[]; mine: boolean };

export type UpdatePost = {
  id: number;
  version: string;
  title: string;
  highlights: string[];
  thumbnailUrl: string | null;
  createdAt: string;
  updatedAt: string;
  author: Pick<Person, "id" | "name" | "avatarUrl"> | null;
  reactions: ReactionGroup[];
  myReaction: string | null;
  comments: number;
  /** ≤ 7 hari & belum dilihat user */
  isNew: boolean;
};

export type UpdateComment = { id: string; body: string; createdAt: string; mine: boolean; user: Pick<Person, "id" | "name" | "avatarUrl"> | null };

export type UpdateFormValues = {
  major: string;
  minor: string;
  patch: string;
  title: string;
  highlights: string[];
  thumbnailPath: string | null;
  content: RichNode;
};

const vnum = z.coerce.number({ invalid_type_error: "Angka" }).int("Bilangan bulat").min(0, "≥ 0").max(9999, "Terlalu besar");

export const updateSchema = z.object({
  id: z.number().int().positive().nullable(),
  major: vnum,
  minor: vnum,
  patch: vnum,
  title: z.string().trim().min(3, "Judul minimal 3 karakter").max(200, "Maksimal 200 karakter"),
  highlights: z.array(z.string().trim().max(160, "Maksimal 160 karakter per poin")).max(10, "Maksimal 10 poin").transform((a) => a.filter(Boolean)),
  thumbnailPath: z.string().max(300).nullable(),
  content: z.unknown(),
});

/** Bandingkan versi "1.2.3". >0 kalau a lebih besar. */
export function compareVersion(a: [number, number, number], b: [number, number, number]) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}
