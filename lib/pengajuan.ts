// CONTOH boilerplate (hapus bersama /pengajuan). Loader SATU sumber untuk tabel, ekspor Excel, dan
// detail. Hak akses & scope company dijaga RLS (sesi user); filter di sini hanya penyaring tampilan.
import "server-only";
import type { FilterChip } from "@/components/list/filter-panel";
import type { ApprovalStepView } from "@/lib/approval-types";
import { BUCKET_LAMPIRAN } from "@/lib/app-config";
import type { ExcelColumn } from "@/lib/excel";
import { formatRange, formatRupiah } from "@/lib/format";
import { labelsOf, type Option } from "@/lib/masters";
import { PENGAJUAN_SORTS, PENGAJUAN_STATUSES, type PengajuanStatus } from "@/lib/pengajuan-rules";
import { getPeople, type Person } from "@/lib/people";
import {
  dateParam,
  listParam,
  numberParam,
  pageParam,
  pageSizeParam,
  sortParam,
  textParam,
  wibDayEnd,
  wibDayStart,
  type SearchParams,
} from "@/lib/search-params";
import { DOCUMENT_STATUS } from "@/lib/status";
import type { ServerClient } from "@/lib/supabase/server";
import { escapeLike, isUuid, searchTerms } from "@/lib/utils";

export const MAX_EXPORT_ROWS = 50_000;
const BATCH = 1000;

// ---------------------------------------------------------------- list

export type PengajuanFilters = {
  q: string;
  status: PengajuanStatus[];
  companies: string[];
  departments: string[];
  dari: string | null;
  sampai: string | null;
  min: number | null;
  maks: number | null;
  sort: ReturnType<typeof sortParam<(typeof PENGAJUAN_SORTS)[number]>>;
  page: number;
  size: number;
};

export function parsePengajuanParams(sp: SearchParams, companyCodes: string[]): PengajuanFilters {
  return {
    q: textParam(sp, "q"),
    status: listParam(sp, "status", PENGAJUAN_STATUSES),
    companies: listParam(sp, "perusahaan", companyCodes),
    departments: listParam(sp, "departemen").filter(isUuid).slice(0, 50),
    dari: dateParam(sp, "dari"),
    sampai: dateParam(sp, "sampai"),
    min: numberParam(sp, "min"),
    maks: numberParam(sp, "maks"),
    sort: sortParam(sp, PENGAJUAN_SORTS, { key: "tanggal", dir: "desc" }),
    page: pageParam(sp),
    size: pageSizeParam(sp),
  };
}

/** Chip filter aktif (urutan = urutan panel filter). */
export function pengajuanChips(f: PengajuanFilters, departments: Option[] = []): FilterChip[] {
  const chips: FilterChip[] = [];
  if (f.status.length) chips.push({ key: "status", label: "Status", value: f.status.map((s) => DOCUMENT_STATUS[s].label).join(", "), params: ["status"] });
  if (f.companies.length) chips.push({ key: "perusahaan", label: "Perusahaan", value: f.companies.join(", "), params: ["perusahaan"] });
  if (f.departments.length)
    chips.push({ key: "departemen", label: "Departemen", value: labelsOf(f.departments, departments), params: ["departemen"] });
  if (f.dari || f.sampai) chips.push({ key: "tanggal", label: "Tanggal dibuat", value: formatRange(f.dari, f.sampai), params: ["dari", "sampai"] });
  if (f.min !== null || f.maks !== null)
    chips.push({ key: "total", label: "Total", value: `${f.min !== null ? formatRupiah(f.min) : "…"} – ${f.maks !== null ? formatRupiah(f.maks) : "…"}`, params: ["min", "maks"] });
  return chips;
}

/** Teks filter untuk sheet "Keterangan" Excel. */
export function pengajuanFilterText(f: PengajuanFilters, departments: Option[] = []): string {
  const parts = pengajuanChips(f, departments).map((c) => `${c.label}: ${c.value}`);
  if (f.q) parts.unshift(`Kata kunci: "${f.q}"`);
  return parts.join("; ") || "Tanpa filter";
}

export type PengajuanRow = {
  id: string;
  code: string | null;
  title: string;
  companyCode: string;
  departmentName: string | null;
  status: string;
  total: number;
  neededDate: string | null;
  createdAt: string;
  updatedAt: string;
  requester: Pick<Person, "id" | "name" | "avatarUrl"> | null;
};

const SORT_COLUMN: Record<(typeof PENGAJUAN_SORTS)[number], string> = {
  kode: "code",
  tanggal: "created_at",
  dibutuhkan: "needed_date",
  total: "total_amount",
  status: "status",
};

const LIST_COLUMNS = "id, code, title, company_code, department_id, status, total_amount, needed_date, created_at, updated_at, created_by";

function baseQuery(supabase: ServerClient, f: PengajuanFilters, count: boolean) {
  let q = supabase.from("pengajuan").select(LIST_COLUMNS, count ? { count: "exact" } : undefined);
  for (const w of searchTerms(f.q)) q = q.ilike("search_text", `%${escapeLike(w)}%`);
  if (f.status.length) q = q.in("status", f.status);
  if (f.companies.length) q = q.in("company_code", f.companies);
  if (f.departments.length) q = q.in("department_id", f.departments);
  if (f.dari) q = q.gte("created_at", wibDayStart(f.dari));
  if (f.sampai) q = q.lte("created_at", wibDayEnd(f.sampai));
  if (f.min !== null) q = q.gte("total_amount", f.min);
  if (f.maks !== null) q = q.lte("total_amount", f.maks);
  // sort whitelist + id sebagai pemecah seri (paginasi stabil)
  return q
    .order(SORT_COLUMN[f.sort.key], { ascending: f.sort.dir === "asc", nullsFirst: false })
    .order("id", { ascending: true });
}

type RawRow = {
  id: string;
  code: string | null;
  title: string;
  company_code: string;
  department_id: string | null;
  status: string;
  total_amount: number;
  needed_date: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

async function hydrate(supabase: ServerClient, raw: RawRow[]): Promise<PengajuanRow[]> {
  const people = await getPeople(supabase, raw.map((r) => r.created_by));
  const deptIds = [...new Set(raw.map((r) => r.department_id).filter((x): x is string => !!x))];
  const depts = deptIds.length ? ((await supabase.schema("public").from("departments").select("id, name").in("id", deptIds)).data ?? []) : [];
  const deptName = new Map(depts.map((d) => [d.id, d.name]));
  return raw.map((r) => {
    const p = r.created_by ? people.get(r.created_by) : null;
    return {
      id: r.id,
      code: r.code,
      title: r.title,
      companyCode: r.company_code,
      departmentName: r.department_id ? (deptName.get(r.department_id) ?? null) : null,
      status: r.status,
      total: Number(r.total_amount),
      neededDate: r.needed_date,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      requester: p ? { id: p.id, name: p.name, avatarUrl: p.avatarUrl } : null,
    };
  });
}

export class TooManyRowsError extends Error {}

/** Satu halaman (tabel) atau semua baris (`all: true`, ekspor) dengan filter yang sama. */
export async function listPengajuan(supabase: ServerClient, f: PengajuanFilters, opts: { all?: boolean } = {}) {
  if (opts.all) {
    const raw: RawRow[] = [];
    for (let from = 0; ; from += BATCH) {
      const { data, error } = await baseQuery(supabase, f, false).range(from, from + BATCH - 1);
      if (error) throw error;
      raw.push(...((data ?? []) as RawRow[]));
      if (raw.length > MAX_EXPORT_ROWS) throw new TooManyRowsError("Terlalu banyak data, persempit filter dulu.");
      if (!data || data.length < BATCH) break;
    }
    return { rows: await hydrate(supabase, raw), total: raw.length };
  }
  const from = (f.page - 1) * f.size;
  const { data, error, count } = await baseQuery(supabase, f, true).range(from, from + f.size - 1);
  if (error) throw error;
  return { rows: await hydrate(supabase, (data ?? []) as RawRow[]), total: count ?? 0 };
}

/** Jumlah semua pengajuan dalam scope user (menu Excel "Semua data"). */
export async function countPengajuan(supabase: ServerClient) {
  const { count } = await supabase.from("pengajuan").select("id", { count: "exact", head: true });
  return count ?? 0;
}

/** Definisi kolom ekspor (urutan tetap, bukan urutan geser kolom tabel). */
export const PENGAJUAN_EXPORT_COLUMNS: ExcelColumn<PengajuanRow>[] = [
  { header: "Nomor", value: (r) => r.code ?? "Draft" },
  { header: "Judul", value: (r) => r.title },
  { header: "Perusahaan", value: (r) => r.companyCode },
  { header: "Departemen", value: (r) => r.departmentName },
  { header: "Pemohon", value: (r) => r.requester?.name ?? null },
  { header: "Status", value: (r) => DOCUMENT_STATUS[r.status]?.label ?? r.status },
  { header: "Tanggal Dibuat", type: "datetime", value: (r) => r.createdAt },
  { header: "Tanggal Dibutuhkan", type: "date", value: (r) => r.neededDate },
  { header: "Total (Rp)", type: "money", value: (r) => r.total },
];

// ---------------------------------------------------------------- detail

export type PengajuanItem = {
  id: string;
  lineNo: number;
  itemName: string;
  partNumber: string | null;
  qty: number;
  unit: string;
  unitPrice: number;
  subtotal: number;
  note: string | null;
};

export type StoredFile = { path: string; name: string; size: number | null; type: string | null; createdAt: string | null };

export type PengajuanDetail = {
  id: string;
  code: string | null;
  title: string;
  description: string | null;
  companyCode: string;
  departmentId: string | null;
  departmentName: string | null;
  status: string;
  total: number;
  neededDate: string | null;
  createdAt: string;
  updatedAt: string;
  verifyToken: string | null;
  requester: Person | null;
  items: PengajuanItem[];
  /** putaran terakhir */
  steps: ApprovalStepView[];
  /** putaran sebelumnya, terbaru dulu */
  previousRounds: ApprovalStepView[][];
  files: StoredFile[];
};

export async function getPengajuanDetail(supabase: ServerClient, id: string, userId: string): Promise<PengajuanDetail | null> {
  const { data: d } = await supabase
    .from("pengajuan")
    .select("id, code, title, description, company_code, department_id, status, total_amount, needed_date, created_at, updated_at, verify_token, created_by")
    .eq("id", id)
    .maybeSingle();
  if (!d) return null;

  const [items, approvals, files, dept] = await Promise.all([
    supabase.from("pengajuan_items").select("id, line_no, item_name, part_number, qty, unit, unit_price, subtotal, note").eq("pengajuan_id", id).order("line_no"),
    supabase
      .from("approvals")
      .select("id, round, step_no, approval_type, approver_id, status, note, decided_at, due_at, followups(requested_by, requested_at)")
      .eq("doc_type", "pengajuan")
      .eq("record_id", id)
      .order("round", { ascending: false })
      .order("step_no"),
    supabase.storage.from(BUCKET_LAMPIRAN).list(id, { limit: 100, sortBy: { column: "created_at", order: "asc" } }),
    d.department_id ? supabase.schema("public").from("departments").select("name").eq("id", d.department_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const rows = approvals.data ?? [];
  const people = await getPeople(supabase, [d.created_by, ...rows.map((a) => a.approver_id)]);
  const steps: ApprovalStepView[] = rows.map((a) => {
    const fu = (a.followups ?? []) as { requested_by: string; requested_at: string }[];
    const p = people.get(a.approver_id);
    const mine = fu.filter((x) => x.requested_by === userId).map((x) => x.requested_at).sort();
    return {
      id: a.id,
      round: a.round,
      stepNo: a.step_no,
      type: a.approval_type,
      status: a.status as ApprovalStepView["status"],
      approver: { id: a.approver_id, name: p?.name ?? "(pengguna dihapus)", avatarUrl: p?.avatarUrl ?? null, department: p?.department ?? null },
      decidedAt: a.decided_at,
      note: a.note,
      dueAt: a.due_at,
      followupCount: fu.length,
      myLastFollowupAt: mine.at(-1) ?? null,
    };
  });
  const rounds = [...new Set(steps.map((s) => s.round))].sort((a, b) => b - a);

  return {
    id: d.id,
    code: d.code,
    title: d.title,
    description: d.description,
    companyCode: d.company_code,
    departmentId: d.department_id,
    departmentName: dept.data?.name ?? null,
    status: d.status,
    total: Number(d.total_amount),
    neededDate: d.needed_date,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
    verifyToken: d.verify_token,
    requester: d.created_by ? (people.get(d.created_by) ?? null) : null,
    items: (items.data ?? []).map((i) => ({
      id: i.id,
      lineNo: i.line_no,
      itemName: i.item_name,
      partNumber: i.part_number,
      qty: Number(i.qty),
      unit: i.unit,
      unitPrice: Number(i.unit_price),
      subtotal: Number(i.subtotal),
      note: i.note,
    })),
    steps: steps.filter((s) => s.round === rounds[0]),
    previousRounds: rounds.slice(1).map((r) => steps.filter((s) => s.round === r)),
    files: (files.data ?? [])
      .filter((f) => f.id) // folder virtual tidak punya id
      .map((f) => ({
        path: `${id}/${f.name}`,
        name: f.name.replace(/^\d{10,}-/, ""),
        size: (f.metadata?.size as number | undefined) ?? null,
        type: (f.metadata?.mimetype as string | undefined) ?? null,
        createdAt: f.created_at ?? null,
      })),
  };
}

/** Departemen aktif untuk pilihan form. */
export async function getDepartments(supabase: ServerClient) {
  const { data } = await supabase.schema("public").from("departments").select("id, name, code").eq("is_active", true).order("name");
  return (data ?? []).map((d) => ({ value: d.id, label: d.name, description: d.code ?? undefined }));
}

// ---------------------------------------------------------------- dokumen milik satu user

export type PengajuanBrief = { id: string; code: string | null; title: string; status: string; createdAt: string };

/** Pengajuan terbaru yang dibuat `userId` (dalam scope RLS user yang melihat). Untuk /pengguna/[id]. */
export async function listPengajuanByUser(supabase: ServerClient, userId: string, limit = 10) {
  const { data, count } = await supabase
    .from("pengajuan")
    .select("id, code, title, status, created_at", { count: "exact" })
    .eq("created_by", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return {
    total: count ?? 0,
    rows: (data ?? []).map((d): PengajuanBrief => ({ id: d.id, code: d.code, title: d.title, status: d.status, createdAt: d.created_at })),
  };
}
