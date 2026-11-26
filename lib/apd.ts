// Monitoring APD: loader SATU sumber untuk /apd (tab), /apd/pengajuan, detail, APD saya, Beranda.
// Baca = RLS + RPC invoker (apd_summary, apd_stock_overview, apd_holdings). Spesifikasi docs/spec/fase-6-apd.md.
import "server-only";
import { REQUEST_STATUS_FILTERS, HOLDING_FILTERS, MOVE_FILTERS } from "@/lib/apd-rules";
import { BUCKET_LAMPIRAN } from "@/lib/app-config";
import type { ApprovalStepView } from "@/lib/approval-types";
import { getPeople } from "@/lib/people";
import { enumParam, textParam, type SearchParams } from "@/lib/search-params";
import type { SiteChoice } from "@/lib/site-types";
import type { ServerClient } from "@/lib/supabase/server";

const like = (q: string) => `%${q.replace(/[%_,()]/g, "")}%`;

// ---------------------------------------------------------------- ringkasan
export type ApdSummary = {
  itemsActive: number;
  itemsEmpty: number;
  itemsNegative: number;
  itemsBelowMin: number;
  stockTotal: number;
  requestsPending: number;
  requestsOpen: number;
  outstandingQty: number;
  leadDaysAvg: number | null;
  holdingsExpired: number;
  holdingsDueSoon: number;
  out30d: number;
};
export async function getApdSummary(supabase: ServerClient, site: SiteChoice): Promise<ApdSummary> {
  const { data, error } = await supabase.rpc("apd_summary", { p_location: site ?? undefined });
  if (error) throw error;
  const s = (data ?? {}) as Record<string, number | null>;
  const n = (k: string) => Number(s[k] ?? 0);
  return {
    itemsActive: n("items_active"),
    itemsEmpty: n("items_empty"),
    itemsNegative: n("items_negative"),
    itemsBelowMin: n("items_below_min"),
    stockTotal: n("stock_total"),
    requestsPending: n("requests_pending"),
    requestsOpen: n("requests_open"),
    outstandingQty: n("outstanding_qty"),
    leadDaysAvg: s.lead_days_avg == null ? null : Number(s.lead_days_avg),
    holdingsExpired: n("holdings_expired"),
    holdingsDueSoon: n("holdings_due_soon"),
    out30d: n("out_30d"),
  };
}

// ---------------------------------------------------------------- master
export type ApdType = {
  id: string;
  code: string;
  name: string;
  spec: string | null;
  intervalDays: number | null;
  intervalLabel: string | null;
  warnDays: number;
  tracked: boolean;
  sizeKind: string;
  note: string | null;
  isActive: boolean;
};
export async function listApdTypes(supabase: ServerClient): Promise<ApdType[]> {
  const { data, error } = await supabase.from("apd_types").select("*").order("sort_order").order("name");
  if (error) throw error;
  return (data ?? []).map((t) => ({
    id: t.id,
    code: t.code,
    name: t.name,
    spec: t.spec,
    intervalDays: t.interval_days,
    intervalLabel: t.interval_label,
    warnDays: t.warn_days,
    tracked: t.tracked,
    sizeKind: t.size_kind,
    note: t.note,
    isActive: t.is_active,
  }));
}

export type ApdItem = { id: string; code: string; name: string; typeId: string; brand: string | null; size: string | null; uom: string; minStock: number; isActive: boolean };
export async function listApdItems(supabase: ServerClient): Promise<ApdItem[]> {
  const { data, error } = await supabase.from("apd_items").select("*").order("code");
  if (error) throw error;
  return (data ?? []).map((i) => ({ id: i.id, code: i.code, name: i.name, typeId: i.type_id, brand: i.brand, size: i.size, uom: i.uom, minStock: i.min_stock, isActive: i.is_active }));
}

/** Semua lokasi (nama gudang / site tujuan; bisa di luar scope pemilih site). */
export async function getLocationNames(supabase: ServerClient): Promise<Map<string, string>> {
  const { data } = await supabase.schema("public").from("locations").select("id, name");
  return new Map((data ?? []).map((l) => [l.id, l.name]));
}

// ---------------------------------------------------------------- stok
export type StockRow = {
  itemId: string;
  code: string;
  name: string;
  typeName: string;
  brand: string | null;
  size: string | null;
  uom: string;
  minStock: number;
  isActive: boolean;
  opening: number;
  inQty: number;
  outQty: number;
  returnQty: number;
  adjustQty: number;
  stock: number;
  outstanding: number;
  lastMoveOn: string | null;
};
export async function listStock(supabase: ServerClient, warehouse: string | null): Promise<StockRow[]> {
  const { data, error } = await supabase.rpc("apd_stock_overview", { p_location: warehouse ?? undefined });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    itemId: r.item_id,
    code: r.code,
    name: r.name,
    typeName: r.type_name,
    brand: r.brand,
    size: r.size,
    uom: r.uom,
    minStock: r.min_stock,
    isActive: r.is_active,
    opening: r.opening,
    inQty: r.in_qty,
    outQty: r.out_qty,
    returnQty: r.return_qty,
    adjustQty: r.adjust_qty,
    stock: r.stock,
    outstanding: r.outstanding,
    lastMoveOn: r.last_move_on,
  }));
}

/** Gudang = lokasi yang punya mutasi (tidak ada master gudang terpisah, P3). */
export async function listWarehouses(supabase: ServerClient): Promise<{ id: string; name: string }[]> {
  const [{ data }, names] = await Promise.all([supabase.from("apd_stock_moves").select("location_id").limit(5000), getLocationNames(supabase)]);
  return [...new Set((data ?? []).map((m) => m.location_id))].map((id) => ({ id, name: names.get(id) ?? "-" })).sort((a, b) => a.name.localeCompare(b.name, "id"));
}

// ---------------------------------------------------------------- mutasi
export type MoveParams = { kind: (typeof MOVE_FILTERS)[number]; q: string; item: string | null };
export function parseMoveParams(sp: SearchParams): MoveParams {
  const item = textParam(sp, "barang");
  return { kind: enumParam(sp, "jenis", MOVE_FILTERS, "semua"), q: textParam(sp, "q"), item: /^[0-9a-f-]{36}$/.test(item) ? item : null };
}
export type MoveRow = {
  id: string;
  kind: string;
  movedOn: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  uom: string;
  qty: number;
  refNo: string | null;
  pic: string | null;
  warehouse: string;
  destSite: string | null;
  recipient: string | null;
  employeeId: string | null;
  requestId: string | null;
  requestCode: string | null;
  note: string | null;
  source: string;
  voidedAt: string | null;
  voidReason: string | null;
};
export async function listMoves(supabase: ServerClient, p: MoveParams, site: SiteChoice, limit = 500): Promise<MoveRow[]> {
  let q = supabase
    .from("apd_stock_moves")
    .select("id, kind, moved_on, item_id, qty, ref_no, pic, location_id, dest_location_id, recipient_name, employee_id, request_line_id, note, source, voided_at, void_reason, item:apd_items!inner(code, name, uom)");
  if (p.kind !== "semua") q = q.eq("kind", p.kind);
  if (p.item) q = q.eq("item_id", p.item);
  if (site) q = q.or(`location_id.eq.${site},dest_location_id.eq.${site}`);
  if (p.q) q = q.or(`recipient_name.ilike.${like(p.q)},ref_no.ilike.${like(p.q)},pic.ilike.${like(p.q)}`);
  const [{ data, error }, names] = await Promise.all([q.order("moved_on", { ascending: false }).order("created_at", { ascending: false }).limit(limit), getLocationNames(supabase)]);
  if (error) throw error;
  const lineIds = [...new Set((data ?? []).map((m) => m.request_line_id).filter((x): x is string => !!x))];
  const { data: lines } = lineIds.length
    ? await supabase.from("apd_request_lines").select("id, request:apd_requests!inner(id, code)").in("id", lineIds)
    : { data: [] as { id: string; request: { id: string; code: string } }[] };
  const reqOf = new Map((lines ?? []).map((l) => [l.id, l.request as { id: string; code: string }]));
  return (data ?? []).map((m) => {
    const item = m.item as { code: string; name: string; uom: string };
    const r = m.request_line_id ? reqOf.get(m.request_line_id) : undefined;
    return {
      id: m.id,
      kind: m.kind,
      movedOn: m.moved_on,
      itemId: m.item_id,
      itemCode: item.code,
      itemName: item.name,
      uom: item.uom,
      qty: m.qty,
      refNo: m.ref_no,
      pic: m.pic,
      warehouse: names.get(m.location_id) ?? "-",
      destSite: m.dest_location_id ? (names.get(m.dest_location_id) ?? "-") : null,
      recipient: m.recipient_name,
      employeeId: m.employee_id,
      requestId: r?.id ?? null,
      requestCode: r?.code ?? null,
      note: m.note,
      source: m.source,
      voidedAt: m.voided_at,
      voidReason: m.void_reason,
    };
  });
}

// ---------------------------------------------------------------- jatuh tempo per karyawan
export type HoldingParams = { state: (typeof HOLDING_FILTERS)[number]; q: string };
export function parseHoldingParams(sp: SearchParams): HoldingParams {
  return { state: enumParam(sp, "status", HOLDING_FILTERS, "semua"), q: textParam(sp, "q") };
}
export type HoldingRow = {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  jobTitle: string;
  locationId: string;
  typeCode: string;
  typeName: string;
  lastOn: string;
  lastQty: number | null;
  lastItem: string;
  size: string | null;
  nextDue: string;
  daysLeft: number;
  state: string;
};
const mapHolding = (h: {
  employee_id: string;
  employee_name: string;
  employee_code: string;
  job_title: string;
  location_id: string;
  type_code: string;
  type_name: string;
  last_on: string;
  last_qty: number | null;
  last_item: string;
  size: string | null;
  next_due: string;
  days_left: number;
  state: string;
}): HoldingRow => ({
  employeeId: h.employee_id,
  employeeName: h.employee_name,
  employeeCode: h.employee_code,
  jobTitle: h.job_title,
  locationId: h.location_id,
  typeCode: h.type_code,
  typeName: h.type_name,
  lastOn: h.last_on,
  lastQty: h.last_qty,
  lastItem: h.last_item,
  size: h.size,
  nextDue: h.next_due,
  daysLeft: h.days_left,
  state: h.state,
});
export async function listHoldings(supabase: ServerClient, site: SiteChoice, p: HoldingParams): Promise<HoldingRow[]> {
  const { data, error } = await supabase.rpc("apd_holdings", { p_location: site ?? undefined });
  if (error) throw error;
  const needle = p.q.toLowerCase();
  return (data ?? [])
    .map(mapHolding)
    .filter((h) => (p.state === "semua" || h.state === p.state) && (!needle || `${h.employeeName} ${h.employeeCode} ${h.jobTitle}`.toLowerCase().includes(needle)));
}

// ---------------------------------------------------------------- pengajuan
export type RequestParams = { status: (typeof REQUEST_STATUS_FILTERS)[number]; q: string };
export function parseRequestParams(sp: SearchParams): RequestParams {
  return { status: enumParam(sp, "status", REQUEST_STATUS_FILTERS, "semua"), q: textParam(sp, "q") };
}
export type RequestRow = {
  id: string;
  code: string;
  recipient: string;
  jobTitle: string | null;
  site: string;
  reason: string;
  status: string;
  source: string;
  mrNo: string | null;
  requestedOn: string | null;
  approvedOn: string | null;
  createdAt: string;
  lines: number;
  qtyTotal: number;
  supplied: number;
  outstanding: number;
  fulfillment: string;
  leadDays: number | null;
};
/** `mine`: hanya pengajuan buatan user atau untuk karyawan miliknya (APD saya). */
export async function listRequests(supabase: ServerClient, p: RequestParams, site: SiteChoice, limit = 300, mine?: { userId: string; employeeIds: string[] }): Promise<RequestRow[]> {
  let q = supabase.from("apd_requests").select("id, code, recipient_name, job_title, location_id, reason, status, source, mr_no, requested_on, approved_on, created_at");
  if (site) q = q.eq("location_id", site);
  if (mine) q = q.or([`created_by.eq.${mine.userId}`, ...(mine.employeeIds.length ? [`employee_id.in.(${mine.employeeIds.join(",")})`] : [])].join(","));
  if (p.status === "terbuka") q = q.eq("status", "approved");
  else if (p.status !== "semua") q = q.eq("status", p.status);
  if (p.q) q = q.ilike("search_text", like(p.q.toLowerCase()));
  const [{ data, error }, names] = await Promise.all([q.order("created_at", { ascending: false }).limit(limit), getLocationNames(supabase)]);
  if (error) throw error;
  const ids = (data ?? []).map((r) => r.id);
  const [{ data: prog }, { data: lineCounts }] = await Promise.all([
    ids.length ? supabase.from("apd_request_progress").select("*").in("request_id", ids) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from("apd_request_lines").select("request_id").in("request_id", ids) : Promise.resolve({ data: [] as { request_id: string }[] }),
  ]);
  const pm = new Map((prog ?? []).map((x) => [x.request_id, x]));
  const lc = new Map<string, number>();
  (lineCounts ?? []).forEach((l) => lc.set(l.request_id, (lc.get(l.request_id) ?? 0) + 1));
  const rows = (data ?? []).map((r) => {
    const g = pm.get(r.id);
    return {
      id: r.id,
      code: r.code,
      recipient: r.recipient_name,
      jobTitle: r.job_title,
      site: names.get(r.location_id) ?? "-",
      reason: r.reason,
      status: r.status,
      source: r.source,
      mrNo: r.mr_no,
      requestedOn: r.requested_on,
      approvedOn: r.approved_on,
      createdAt: r.created_at,
      lines: lc.get(r.id) ?? 0,
      qtyTotal: g?.qty_total ?? 0,
      supplied: g?.supplied_total ?? 0,
      outstanding: g?.outstanding_total ?? 0,
      fulfillment: g?.fulfillment ?? "none",
      leadDays: g?.lead_days ?? null,
    };
  });
  return p.status === "terbuka" ? rows.filter((r) => r.outstanding > 0) : rows;
}

export type RequestLineView = {
  id: string;
  lineNo: number;
  typeId: string;
  typeName: string;
  itemId: string | null;
  itemLabel: string | null;
  size: string | null;
  qty: number;
  supplied: number;
  outstanding: number;
  lastSupplyOn: string | null;
  note: string | null;
};
export type RequestDetail = {
  id: string;
  code: string;
  companyCode: string;
  locationId: string;
  site: string;
  employeeId: string | null;
  recipient: string;
  jobTitle: string | null;
  reason: string;
  negligence: boolean;
  incidentOn: string | null;
  lastReceivedOn: string | null;
  explanation: string | null;
  deductionAck: boolean;
  mrNo: string | null;
  requestedOn: string | null;
  approvedOn: string | null;
  status: string;
  source: string;
  cancelNote: string | null;
  createdBy: string | null;
  creatorName: string | null;
  createdAt: string;
  lines: RequestLineView[];
  fulfillment: string;
  leadDays: number | null;
  files: { path: string; name: string }[];
  moves: MoveRow[];
  steps: ApprovalStepView[];
  previousRounds: ApprovalStepView[][];
};

export async function getRequestDetail(supabase: ServerClient, id: string, userId: string): Promise<RequestDetail | null> {
  const { data: r } = await supabase.from("apd_requests").select("*").eq("id", id).maybeSingle();
  if (!r) return null;
  const [{ data: lines }, { data: prog }, { data: progAll }, types, items, files, approvals, names] = await Promise.all([
    supabase.from("apd_request_lines").select("*").eq("request_id", id).order("line_no"),
    supabase.from("apd_request_line_progress").select("*").eq("request_id", id),
    supabase.from("apd_request_progress").select("*").eq("request_id", id).maybeSingle(),
    listApdTypes(supabase),
    listApdItems(supabase),
    supabase.storage.from(BUCKET_LAMPIRAN).list(`apd/${id}`, { limit: 50 }),
    supabase
      .from("approvals")
      .select("id, round, step_no, approval_type, approver_id, status, note, decided_at, due_at, followups(requested_by, requested_at)")
      .eq("doc_type", "apd_request")
      .eq("record_id", id)
      .order("round", { ascending: false })
      .order("step_no"),
    getLocationNames(supabase),
  ]);
  const tn = new Map(types.map((t) => [t.id, t.name]));
  const im = new Map(items.map((i) => [i.id, i]));
  const pg = new Map((prog ?? []).map((x) => [x.line_id, x]));
  const lineIds = (lines ?? []).map((l) => l.id);
  const { data: mv } = lineIds.length ? await supabase.from("apd_stock_moves").select("id").in("request_line_id", lineIds) : { data: [] as { id: string }[] };
  const mvIds = new Set((mv ?? []).map((m) => m.id));
  const moves = mvIds.size ? (await listMoves(supabase, { kind: "out", q: "", item: null }, null, 1000)).filter((m) => mvIds.has(m.id)) : [];
  const rows = approvals.data ?? [];
  const people = await getPeople(supabase, [r.created_by, ...rows.map((a) => a.approver_id)]);
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
    id: r.id,
    code: r.code,
    companyCode: r.company_code,
    locationId: r.location_id,
    site: names.get(r.location_id) ?? "-",
    employeeId: r.employee_id,
    recipient: r.recipient_name,
    jobTitle: r.job_title,
    reason: r.reason,
    negligence: r.negligence,
    incidentOn: r.incident_on,
    lastReceivedOn: r.last_received_on,
    explanation: r.explanation,
    deductionAck: r.deduction_ack,
    mrNo: r.mr_no,
    requestedOn: r.requested_on,
    approvedOn: r.approved_on,
    status: r.status,
    source: r.source,
    cancelNote: r.cancel_note,
    createdBy: r.created_by,
    creatorName: r.created_by ? (people.get(r.created_by)?.name ?? null) : null,
    createdAt: r.created_at,
    lines: (lines ?? []).map((l) => {
      const it = l.item_id ? im.get(l.item_id) : undefined;
      const g = pg.get(l.id);
      return {
        id: l.id,
        lineNo: l.line_no,
        typeId: l.type_id,
        typeName: tn.get(l.type_id) ?? "-",
        itemId: l.item_id,
        itemLabel: it ? `${it.code} · ${it.name}` : null,
        size: l.size,
        qty: l.qty,
        supplied: g?.supplied ?? 0,
        outstanding: g?.outstanding ?? l.qty,
        lastSupplyOn: g?.last_supply_on ?? null,
        note: l.note,
      };
    }),
    fulfillment: progAll?.fulfillment ?? "none",
    leadDays: progAll?.lead_days ?? null,
    files: (files.data ?? []).filter((f) => f.name && !f.name.startsWith(".")).map((f) => ({ path: `apd/${id}/${f.name}`, name: f.name.replace(/^\d+-/, "") })),
    moves,
    steps: steps.filter((s) => s.round === rounds[0]),
    previousRounds: rounds.slice(1).map((x) => steps.filter((s) => s.round === x)),
  };
}

// ---------------------------------------------------------------- form pengajuan
export type EmployeeOption = { id: string; code: string; name: string; jobTitle: string; siteId: string; sizes: Record<string, string> };
/** Staf: karyawan aktif dalam scope (opsional satu site). Karyawan: dirinya sendiri lewat apd_my_employees. */
export async function listRequestEmployees(supabase: ServerClient, staff: boolean, site: SiteChoice): Promise<EmployeeOption[]> {
  let emps: { id: string; code: string; name: string; job_title: string; location_id: string }[] = [];
  if (staff) {
    let q = supabase.from("employees").select("id, code, name, job_title, location_id").eq("status", "active");
    if (site) q = q.eq("location_id", site);
    emps = (await q.order("name").limit(2000)).data ?? [];
  }
  const mine = (await supabase.rpc("apd_my_employees")).data ?? [];
  const all = new Map([...emps, ...mine].map((e) => [e.id, e]));
  const ids = [...all.keys()];
  const { data: sizes } = ids.length ? await supabase.from("apd_employee_sizes").select("employee_id, type_id, size").in("employee_id", ids) : { data: [] };
  const sz = new Map<string, Record<string, string>>();
  (sizes ?? []).forEach((s) => sz.set(s.employee_id, { ...(sz.get(s.employee_id) ?? {}), [s.type_id]: s.size }));
  return [...all.values()]
    .map((e) => ({ id: e.id, code: e.code, name: e.name, jobTitle: e.job_title, siteId: e.location_id, sizes: sz.get(e.id) ?? {} }))
    .sort((a, b) => a.name.localeCompare(b.name, "id"));
}

// ---------------------------------------------------------------- APD saya
export async function getMyApd(supabase: ServerClient, userId: string) {
  const [{ data: h, error }, { data: emps }] = await Promise.all([supabase.rpc("apd_my_holdings"), supabase.rpc("apd_my_employees")]);
  if (error) throw error;
  const employees = (emps ?? []).map((e) => ({ id: e.id, code: e.code, name: e.name, jobTitle: e.job_title }));
  const requests = await listRequests(supabase, { status: "semua", q: "" }, null, 50, { userId, employeeIds: employees.map((e) => e.id) });
  return { holdings: (h ?? []).map(mapHolding), employees, requests };
}
