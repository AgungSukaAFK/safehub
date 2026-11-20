// Loader Feedback (frontend-guide §20.4, backend-guide §11.2 + koreksi K7). Pelapor membaca view
// feedback_mine (tanpa catatan admin); tabel feedback hanya terbaca admin app.
import "server-only";
import type { FilterChip } from "@/components/list/filter-panel";
import { BUCKET_LAMPIRAN } from "@/lib/app-config";
import { FEEDBACK_CATEGORY_VALUES, FEEDBACK_SORTS, FEEDBACK_STATUS, FEEDBACK_STATUSES, feedbackCategoryLabel } from "@/lib/feedback-rules";
import { getPeople, type Person } from "@/lib/people";
import type { RichNode } from "@/lib/rich-text";
import { listParam, pageParam, pageSizeParam, sortParam, textParam, type SearchParams } from "@/lib/search-params";
import type { ServerClient } from "@/lib/supabase/server";
import { escapeLike, searchTerms } from "@/lib/utils";

export type FeedbackFile = { path: string; name: string; url: string | null };

async function signFiles(supabase: ServerClient, paths: string[]): Promise<FeedbackFile[]> {
  if (!paths.length) return [];
  const { data } = await supabase.storage.from(BUCKET_LAMPIRAN).createSignedUrls(paths, 3600);
  const url = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return paths.map((p) => ({ path: p, name: p.split("/").pop()!.replace(/^\d+-/, ""), url: url.get(p) ?? null }));
}

// ---------------------------------------------------------------- milik sendiri

export type MyFeedback = { id: string; category: string; categoryOther: string | null; text: string; status: string; createdAt: string; updatedAt: string; files: number };

export async function listMyFeedback(supabase: ServerClient): Promise<MyFeedback[]> {
  const { data } = await supabase
    .from("feedback_mine")
    .select("id, category, category_other, content_text, attachments, status, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(30);
  return (data ?? []).map((f) => ({
    id: f.id!,
    category: f.category!,
    categoryOther: f.category_other,
    text: f.content_text ?? "",
    status: f.status!,
    createdAt: f.created_at!,
    updatedAt: f.updated_at!,
    files: f.attachments?.length ?? 0,
  }));
}

// ---------------------------------------------------------------- kelola (admin)

export type FeedbackFilters = {
  q: string;
  status: (typeof FEEDBACK_STATUSES)[number][];
  categories: string[];
  sort: ReturnType<typeof sortParam<(typeof FEEDBACK_SORTS)[number]>>;
  page: number;
  size: number;
};

export function parseFeedbackParams(sp: SearchParams): FeedbackFilters {
  return {
    q: textParam(sp, "q"),
    status: listParam(sp, "status", FEEDBACK_STATUSES),
    categories: listParam(sp, "kategori", FEEDBACK_CATEGORY_VALUES),
    sort: sortParam(sp, FEEDBACK_SORTS, { key: "tanggal", dir: "desc" }),
    page: pageParam(sp),
    size: pageSizeParam(sp),
  };
}

export function feedbackChips(f: FeedbackFilters): FilterChip[] {
  const chips: FilterChip[] = [];
  if (f.status.length) chips.push({ key: "status", label: "Status", value: f.status.map((s) => FEEDBACK_STATUS[s].label).join(", "), params: ["status"] });
  if (f.categories.length) chips.push({ key: "kategori", label: "Kategori", value: f.categories.map((c) => feedbackCategoryLabel(c)).join(", "), params: ["kategori"] });
  return chips;
}

export type FeedbackRow = {
  id: string;
  category: string;
  categoryOther: string | null;
  text: string;
  status: string;
  createdAt: string;
  files: number;
  reporter: Pick<Person, "id" | "name" | "avatarUrl"> | null;
};

export async function listFeedback(supabase: ServerClient, f: FeedbackFilters) {
  let q = supabase.from("feedback").select("id, user_id, category, category_other, content_text, attachments, status, created_at", { count: "exact" });
  for (const w of searchTerms(f.q)) q = q.ilike("content_text", `%${escapeLike(w)}%`);
  if (f.status.length) q = q.in("status", f.status);
  if (f.categories.length) q = q.in("category", f.categories);
  q = q.order(f.sort.key === "status" ? "status" : "created_at", { ascending: f.sort.dir === "asc" }).order("id");
  const from = (f.page - 1) * f.size;
  const { data, error, count } = await q.range(from, from + f.size - 1);
  if (error) throw error;
  const people = await getPeople(supabase, (data ?? []).map((r) => r.user_id));
  return {
    total: count ?? 0,
    rows: (data ?? []).map((r): FeedbackRow => {
      const p = people.get(r.user_id);
      return {
        id: r.id,
        category: r.category,
        categoryOther: r.category_other,
        text: r.content_text,
        status: r.status,
        createdAt: r.created_at,
        files: r.attachments.length,
        reporter: p ? { id: p.id, name: p.name, avatarUrl: p.avatarUrl } : null,
      };
    }),
  };
}

/** Hitungan per status (chip di atas list). */
export async function countFeedbackByStatus(supabase: ServerClient) {
  const head = { count: "exact" as const, head: true };
  const res = await Promise.all(FEEDBACK_STATUSES.map((s) => supabase.from("feedback").select("id", head).eq("status", s)));
  return Object.fromEntries(FEEDBACK_STATUSES.map((s, i) => [s, res[i].count ?? 0])) as Record<(typeof FEEDBACK_STATUSES)[number], number>;
}

export type FeedbackDetail = {
  id: string;
  category: string;
  categoryOther: string | null;
  content: RichNode;
  status: string;
  adminNote: string | null;
  context: Record<string, string | null> | null;
  createdAt: string;
  updatedAt: string;
  files: FeedbackFile[];
  reporter: Person | null;
  handledBy: string | null;
};

export async function getFeedbackDetail(supabase: ServerClient, id: string): Promise<FeedbackDetail | null> {
  const { data: r } = await supabase.from("feedback").select("*").eq("id", id).maybeSingle();
  if (!r) return null;
  const [people, files] = await Promise.all([getPeople(supabase, [r.user_id, r.handled_by]), signFiles(supabase, r.attachments)]);
  return {
    id: r.id,
    category: r.category,
    categoryOther: r.category_other,
    content: r.content as RichNode,
    status: r.status,
    adminNote: r.admin_note,
    context: r.context as Record<string, string | null> | null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    files,
    reporter: people.get(r.user_id) ?? null,
    handledBy: r.handled_by ? (people.get(r.handled_by)?.name ?? null) : null,
  };
}

/** Versi app terbaru (dari post Pembaruan) untuk konteks feedback. */
export async function latestAppVersion(supabase: ServerClient): Promise<string | null> {
  const { data } = await supabase.from("updates").select("version").order("id", { ascending: false }).limit(1).maybeSingle();
  return data?.version ?? null;
}
