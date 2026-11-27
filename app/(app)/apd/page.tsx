import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowDownToLine, ArrowDownUp, ArrowUpFromLine, FilePlus2, MoreHorizontal, Pencil, Plus, Truck, Upload } from "lucide-react";
import { StatusBadge } from "@/components/detail/status-badge";
import { Content } from "@/components/list/content";
import { PageHeader } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { getApdSummary, getStockByWarehouse, listApdItems, listApdTypes, listHoldings, listMoves, listOpsRequests, listRequests, listStock, listWarehouses, parseHoldingParams, parseMoveParams, parseRequestParams, type ApdType, type HoldingRow, type OpsRequest, type Warehouse } from "@/lib/apd";
import { APD_TAB_LABELS, APD_TABS, FULFILLMENT, HOLDING_FILTERS, HOLDING_STATE, intervalText, MOVE_FILTERS, MOVE_KIND, MR_STATE, mrState, REASON_LABELS, REQUEST_FILTER_LABELS, REQUEST_STATUS, REQUEST_STATUS_FILTERS, SIZE_KIND_LABELS, type Reason } from "@/lib/apd-rules";
import { requireAccess } from "@/lib/auth";
import { formatDate, formatNumber } from "@/lib/format";
import { enumParam, hrefWith, type SearchParams } from "@/lib/search-params";
import { parseSiteParam } from "@/lib/sites";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { ApdItemSheet, ApdTypeSheet, MoveSheet, VoidMoveButton } from "./apd-sheets";
import { MrButton, RequestMovesSheet, type OpsItem, type OpsWarehouse } from "./ops-sheets";

export const metadata: Metadata = { title: "Monitoring APD" };

type Supa = Awaited<ReturnType<typeof createClient>>;
const Th = ({ children, right }: { children: string; right?: boolean }) => <th scope="col" className={cn("px-3 py-2 font-medium", right ? "text-right" : "text-left")}>{children}</th>;
const Empty = ({ children }: { children: string }) => <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{children}</p>;
const Num = ({ v, warn }: { v: number; warn?: boolean }) => <td className={cn("px-3 py-2 text-right tabular-nums", warn && "font-semibold text-red-700 dark:text-red-400")}>{formatNumber(v)}</td>;

// Monitoring APD (fase 6): pengganti Excel "Monitoring APD GMI 2026". Stok = buku besar mutasi; jatuh tempo per karyawan dari masa periodik Matrix APD.
export default async function ApdPage({ searchParams }: PageProps<"/apd">) {
  const access = await requireAccess("viewer");
  const isAdmin = access.role === "admin" || access.platformAdmin;
  if (!isAdmin && !access.functions.some((f) => f !== "karyawan")) redirect("/apd/saya");
  const sp = await searchParams;
  const tab = enumParam(sp, "tab", APD_TABS, "ringkasan");
  const { siteId, label, sites } = await parseSiteParam(sp, access);
  const supabase = await createClient();
  const writer = isAdmin || !access.functions.includes("auditor");
  const canManage = isAdmin || (writer && access.functions.some((f) => f === "hse" || f === "hse_senior" || f === "scm"));
  const canPolicy = isAdmin || (writer && access.functions.some((f) => f === "hse" || f === "hse_senior"));
  const href = (c: Record<string, string | null>) => hrefWith("/apd", sp, c);
  const [items, types, warehouses, allWarehouses, ops, stockBy] = await Promise.all([
    listApdItems(supabase),
    listApdTypes(supabase),
    listWarehouses(supabase),
    listWarehouses(supabase, true),
    canManage ? listOpsRequests(supabase) : Promise.resolve([] as OpsRequest[]),
    canManage ? getStockByWarehouse(supabase) : Promise.resolve({} as Record<string, number>),
  ]);
  const typeOptions = types.filter((t) => t.isActive).map((t) => ({ value: t.id, label: t.name }));
  const itemOptions = items.filter((i) => i.isActive).map((i) => ({ value: i.id, label: `${i.code} · ${i.name}` }));
  const siteOptions = sites.map((s) => ({ value: s.id, label: s.name }));
  const whOptions = warehouses.map((w) => ({ value: w.id, label: w.name, description: w.locationName ?? undefined }));
  const opsItems: OpsItem[] = items.filter((i) => i.isActive).map((i) => ({ id: i.id, code: i.code, name: i.name, typeId: i.typeId, size: i.size, uom: i.uom }));
  const opsWh: OpsWarehouse[] = warehouses.map((w) => ({ id: w.id, name: w.name, locationName: w.locationName }));
  const ops$ = { requests: ops, items: opsItems, warehouses: opsWh, stock: stockBy };
  const { data: emps } = canManage ? await supabase.from("employees").select("id, code, name").eq("status", "active").order("name").limit(2000) : { data: [] };
  const empOptions = (emps ?? []).map((e) => ({ value: e.id, label: `${e.name} · ${e.code}` }));

  return (
    <>
      <PageHeader
        title="Monitoring APD"
        description={`Stok gudang, pengiriman, dan jatuh tempo penggantian APD · ${label}`}
        actions={
          <>
            {canManage && <RequestMovesSheet kind="in" trigger={<Button variant="outline"><ArrowDownToLine /> IN Barang</Button>} {...ops$} />}
            {canManage && <RequestMovesSheet kind="out" trigger={<Button variant="outline"><ArrowUpFromLine /> OUT Barang</Button>} {...ops$} />}
            {writer && <Link href="/apd/pengajuan/baru" className={buttonVariants()}><FilePlus2 /> Ajukan APD</Link>}
            {canManage && <MoveSheet trigger={<Button variant="ghost" size="sm"><ArrowDownUp /> In / Out lain</Button>} warehouses={whOptions} items={itemOptions} employees={empOptions} sites={siteOptions} />}
            {(canManage || (writer && access.functions.includes("hr"))) && <Link href="/apd/impor" className={buttonVariants({ variant: "ghost", size: "sm" })}><Upload /> Impor Data</Link>}
          </>
        }
      />
      <nav className="col-span-12 flex flex-wrap gap-1 border-b" aria-label="Tab Monitoring APD">
        {APD_TABS.map((t) => (
          <Link key={t} href={hrefWith("/apd", {}, { tab: t === "ringkasan" ? null : t })} aria-current={tab === t ? "page" : undefined} className={cn("-mb-px border-b-2 px-3 py-2 text-sm", tab === t ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {APD_TAB_LABELS[t]}
          </Link>
        ))}
      </nav>
      {canManage && warehouses.length === 0 && (
        <p role="note" className="col-span-12 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Belum ada gudang APD. {isAdmin ? <Link href="/master?jenis=gudang-apd" className="font-medium underline underline-offset-2">Tambah gudang di Master Data</Link> : "Minta admin menambah gudang di Master Data"} sebelum mencatat IN/OUT.
        </p>
      )}
      {tab === "ringkasan" && <SummaryTab supabase={supabase} site={siteId} siteLabel={label} />}
      {tab === "pengajuan" && <RequestsTab supabase={supabase} sp={sp} site={siteId} siteLabel={label} canManage={canManage} ops={ops$} />}
      {tab === "stok" && <StockTab supabase={supabase} sp={sp} warehouses={allWarehouses} />}
      {tab === "mutasi" && <MovesTab supabase={supabase} sp={sp} site={siteId} canManage={canManage} href={href} />}
      {tab === "karyawan" && <HoldingsTab supabase={supabase} sp={sp} site={siteId} href={href} types={types} siteNames={Object.fromEntries(sites.map((s) => [s.id, s.name]))} />}
      {tab === "periodik" && (
        <Content
          title="Matrix APD"
          description="Nilai awal dari Matrix APD PT. Garuda Mart Indonesia (Head of Dept HSE, 24 Februari 2026). Berlaku untuk HO, Branch & Site."
          cardAction={canPolicy ? <ApdTypeSheet trigger={<Button size="sm" variant="outline"><Plus /> Tambah Jenis</Button>} /> : undefined}
        >
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr><Th>Jenis APD</Th><Th>Periodik penggantian</Th><Th>Peringatan</Th><Th>Ukuran</Th><Th>Keterangan</Th><Th>{""}</Th></tr>
              </thead>
              <tbody>
                {types.map((t) => (
                  <tr key={t.id} className={cn("border-t", !t.isActive && "opacity-60")}>
                    <td className="px-3 py-2 font-medium">{t.name}{t.spec && <small className="block text-xs font-normal text-muted-foreground">{t.spec}</small>}</td>
                    <td className="px-3 py-2">{t.intervalLabel ?? intervalText(t.intervalDays)}<small className="block text-xs text-muted-foreground">{t.tracked ? `${intervalText(t.intervalDays)} · jatuh tempo dilacak` : "Tidak dilacak (habis pakai / tanpa periodik)"}</small></td>
                    <td className="px-3 py-2 tabular-nums">{t.tracked ? `${t.warnDays} hari` : "-"}</td>
                    <td className="px-3 py-2">{SIZE_KIND_LABELS[t.sizeKind as keyof typeof SIZE_KIND_LABELS] ?? t.sizeKind}</td>
                    <td className="px-3 py-2 text-muted-foreground">{t.note ?? "-"}{!t.isActive && " (nonaktif)"}</td>
                    <td className="px-3 py-2 text-right">{canPolicy && <ApdTypeSheet trigger={<Button size="icon-sm" variant="ghost" aria-label={`Ubah ${t.name}`}><Pencil /></Button>} type={t} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>APD yang diganti karena rusak wajib disertai foto bukti.</li>
            <li>APD yang hilang (atau rusak karena kelalaian) diganti dengan pemotongan gaji.</li>
            <li>Permintaan APD baru atau penggantian wajib lewat Pengajuan APD.</li>
            <li>Rawat dan jaga APD agar masa pakainya sesuai periodik.</li>
          </ul>
        </Content>
      )}
      {tab === "barang" && (
        <Content
          title="Barang APD"
          description={`${items.length} kode barang. Kode mengikuti gudang (SS = sepatu, KM = kemeja, KS = kaos, HLM = helm, ...).`}
          cardAction={canManage ? <ApdItemSheet trigger={<Button size="sm" variant="outline"><Plus /> Tambah Barang</Button>} types={typeOptions} /> : undefined}
        >
          {items.length === 0 ? (
            <Empty>Belum ada barang APD.</Empty>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr><Th>Kode</Th><Th>Nama</Th><Th>Jenis</Th><Th>Merek</Th><Th>Ukuran</Th><Th>Satuan</Th><Th right>Stok min.</Th><Th>{""}</Th></tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.id} className={cn("border-t", !i.isActive && "opacity-60")}>
                      <td className="px-3 py-2 font-mono text-xs">{i.code}</td>
                      <td className="px-3 py-2 font-medium">{i.name}{!i.isActive && <small className="ml-1 text-muted-foreground">(nonaktif)</small>}</td>
                      <td className="px-3 py-2">{types.find((t) => t.id === i.typeId)?.name ?? "-"}</td>
                      <td className="px-3 py-2">{i.brand ?? "-"}</td>
                      <td className="px-3 py-2">{i.size ?? "-"}</td>
                      <td className="px-3 py-2">{i.uom}</td>
                      <Num v={i.minStock} />
                      <td className="px-3 py-2 text-right">{canManage && <ApdItemSheet trigger={<Button size="icon-sm" variant="ghost" aria-label={`Ubah ${i.code}`}><Pencil /></Button>} item={i} types={typeOptions} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Content>
      )}
    </>
  );
}

async function SummaryTab({ supabase, site, siteLabel }: { supabase: Supa; site: string | null; siteLabel: string }) {
  const [s, holdings] = await Promise.all([getApdSummary(supabase, site), listHoldings(supabase, site, { state: "semua", q: "" })]);
  const tiles: { title: string; value: string; hint: string; href: string; warn?: boolean }[] = [
    { title: "Stok tersedia", value: formatNumber(s.stockTotal), hint: `${s.itemsActive} kode barang aktif · semua gudang`, href: "/apd?tab=stok" },
    { title: "Barang kosong", value: formatNumber(s.itemsEmpty), hint: s.itemsNegative ? `${s.itemsNegative} minus: perlu stock opname` : "Stok 0 atau kurang", href: "/apd?tab=stok&status=kosong", warn: s.itemsNegative > 0 },
    { title: "Di bawah minimum", value: formatNumber(s.itemsBelowMin), hint: "Stok < stok minimum barang", href: "/apd?tab=stok&status=minimum", warn: s.itemsBelowMin > 0 },
    { title: "Menunggu approval", value: formatNumber(s.requestsPending), hint: `Pengajuan · ${siteLabel}`, href: "/apd?tab=pengajuan&status=pending_approval" },
    { title: "Belum terpenuhi", value: formatNumber(s.requestsOpen), hint: `${formatNumber(s.outstandingQty)} unit outstanding (OS)`, href: "/apd?tab=pengajuan&status=terbuka", warn: s.requestsOpen > 0 },
    { title: "Rata-rata lead time", value: s.leadDaysAvg === null ? "Belum tersedia" : `${formatNumber(s.leadDaysAvg)} hari`, hint: "Disetujui s.d. terkirim penuh, 90 hari terakhir", href: "/apd?tab=pengajuan&status=approved" },
    { title: "APD keluar 30 hari", value: formatNumber(s.out30d), hint: `Unit dikirim ke ${siteLabel}`, href: "/apd?tab=mutasi&jenis=out" },
  ];
  return (
    <>
      <DueList
        rows={holdings.filter((h) => h.state === "expired")}
        title="Sudah Lewat Jatuh Tempo"
        description={`${formatNumber(s.holdingsExpired)} APD melewati periodik Matrix APD · ${siteLabel}`}
        empty="Tidak ada APD karyawan yang lewat jatuh tempo."
        status="expired"
      />
      <DueList
        rows={holdings.filter((h) => h.state === "due_soon")}
        title="Segera Jatuh Tempo (Segera MR)"
        description={`${formatNumber(s.holdingsDueSoon)} APD masuk masa peringatan · ${siteLabel}`}
        empty="Tidak ada APD karyawan yang segera jatuh tempo."
        status="due_soon"
      />
      <div className="col-span-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <Link key={t.title} href={t.href} className={cn("rounded-xl border bg-card p-4 hover:bg-accent/40", t.warn && "border-amber-300 dark:border-amber-900")}>
            <span className="text-xs text-muted-foreground">{t.title}</span>
            <strong className={cn("block text-2xl tabular-nums", t.value === "Belum tersedia" && "text-base font-medium text-muted-foreground")}>{t.value}</strong>
            <small className="text-xs text-muted-foreground">{t.hint}</small>
          </Link>
        ))}
      </div>
    </>
  );
}

const DUE_LIMIT = 12;

/** Ringkasan: karyawan dengan APD lewat / segera jatuh tempo, satu baris per karyawan, paling mendesak di atas. */
function DueList({ rows, title, description, empty, status }: { rows: HoldingRow[]; title: string; description: string; empty: string; status: "expired" | "due_soon" }) {
  const byEmp = new Map<string, { id: string; name: string; code: string; jobTitle: string; items: HoldingRow[] }>();
  for (const h of rows) {
    const e = byEmp.get(h.employeeId) ?? { id: h.employeeId, name: h.employeeName, code: h.employeeCode, jobTitle: h.jobTitle, items: [] };
    e.items.push(h);
    byEmp.set(h.employeeId, e);
  }
  const people = [...byEmp.values()]
    .map((e) => ({ ...e, items: e.items.sort((a, b) => a.daysLeft - b.daysLeft) }))
    .sort((a, b) => a.items[0].daysLeft - b.items[0].daysLeft);
  const shown = people.slice(0, DUE_LIMIT);
  const expired = status === "expired";
  return (
    <Content
      size="md"
      title={title}
      description={`${formatNumber(people.length)} karyawan · ${description}`}
      cardAction={people.length > 0 ? <Link href={`/apd?tab=karyawan&status=${status}`} className="text-sm underline underline-offset-2">Lihat semua</Link> : undefined}
      className={cn(people.length > 0 && (expired ? "border-red-300 dark:border-red-900" : "border-amber-300 dark:border-amber-900"))}
      bodyClassName="px-0"
    >
      {people.length === 0 ? (
        <p className="px-5 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y border-y">
          {shown.map((e) => (
            <li key={e.id} className="flex flex-wrap items-start gap-x-3 gap-y-1.5 px-5 py-2.5">
              <div className="min-w-0 flex-1">
                <Link href={`/manpower/${e.id}`} className="font-medium underline underline-offset-2">{e.name}</Link>
                <small className="block truncate text-xs text-muted-foreground">{e.code} · {e.jobTitle}</small>
                <span className="mt-1 flex flex-wrap gap-1">
                  {e.items.map((h) => (
                    <span key={h.typeCode} className={cn("rounded border px-1.5 py-0.5 text-xs", expired ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200" : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200")}>
                      {h.typeName} · <span className="tabular-nums">{h.daysLeft < 0 ? `lewat ${-h.daysLeft} hari` : h.daysLeft === 0 ? "hari ini" : `${h.daysLeft} hari lagi`}</span>
                    </span>
                  ))}
                </span>
              </div>
              <Link href={`/apd/pengajuan/baru?karyawan=${e.id}&alasan=periodic`} className={buttonVariants({ size: "xs", variant: expired ? "default" : "outline" })}>
                <FilePlus2 /> Ajukan MR
              </Link>
            </li>
          ))}
        </ul>
      )}
      {people.length > DUE_LIMIT && (
        <Link href={`/apd?tab=karyawan&status=${status}`} className="mt-2 block px-5 text-sm text-muted-foreground underline underline-offset-2">+{formatNumber(people.length - DUE_LIMIT)} karyawan lainnya</Link>
      )}
    </Content>
  );
}

async function RequestsTab({
  supabase,
  sp,
  site,
  siteLabel,
  canManage,
  ops,
}: {
  supabase: Supa;
  sp: SearchParams;
  site: string | null;
  siteLabel: string;
  canManage: boolean;
  ops: { requests: OpsRequest[]; items: OpsItem[]; warehouses: OpsWarehouse[]; stock: Record<string, number> };
}) {
  const p = parseRequestParams(sp);
  const rows = await listRequests(supabase, p, site);
  const href = (c: Record<string, string | null>) => hrefWith("/apd", sp, c);
  const open = rows.filter((r) => r.status === "approved" && r.outstanding > 0).length;
  return (
    <Content title="Pengajuan APD" description={`${rows.length} pengajuan · ${open} belum terpenuhi · ${siteLabel}`}>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {REQUEST_STATUS_FILTERS.map((s) => (
          <Link key={s} href={href({ status: s === "semua" ? null : s })} aria-pressed={p.status === s} className={cn("rounded-full border px-2.5 py-0.5 text-xs", p.status === s ? "border-primary bg-primary/5 font-medium text-primary" : "hover:bg-accent")}>
            {REQUEST_FILTER_LABELS[s]}
          </Link>
        ))}
        <form method="get" className="ml-auto flex gap-2">
          <input type="hidden" name="tab" value="pengajuan" />
          {p.status !== "semua" && <input type="hidden" name="status" value={p.status} />}
          <input name="q" defaultValue={p.q} placeholder="Cari nomor / nama / no MR" aria-label="Cari pengajuan" className="h-8 w-56 rounded-md border bg-background px-2 text-sm" />
        </form>
      </div>
      {rows.length === 0 ? (
        <Empty>Belum ada pengajuan untuk filter ini.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[1080px] text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr><Th>Nomor</Th><Th>Karyawan</Th><Th>Site</Th><Th>Alasan</Th><Th>Tanggal</Th><Th>Status</Th><Th>MR</Th><Th right>OS</Th><Th>{"Aksi"}</Th></tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const editable = r.source === "app" && ["draft", "rejected"].includes(r.status);
                const approved = r.status === "approved";
                const ms = mrState(r.mrNo, r.received, r.qtyTotal);
                return (
                  <tr key={r.id} className="border-t align-top hover:bg-accent/30">
                    <td className="px-3 py-2 whitespace-nowrap"><Link href={`/apd/pengajuan/${r.id}`} className="font-medium tabular-nums underline underline-offset-2">{r.code}</Link></td>
                    <td className="px-3 py-2">{r.employeeId ? <Link href={`/manpower/${r.employeeId}`} className="underline underline-offset-2">{r.recipient}</Link> : r.recipient}<small className="block text-xs text-muted-foreground">{r.jobTitle ?? (r.source === "import" ? "Data lama Excel" : "-")} · {r.lines} jenis</small></td>
                    <td className="px-3 py-2">{r.site}</td>
                    <td className="px-3 py-2">{REASON_LABELS[r.reason as Reason] ?? r.reason}</td>
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums">{r.requestedOn ? formatDate(r.requestedOn) : <span className="text-muted-foreground">{r.source === "import" ? "Tidak tercatat" : `Draf ${formatDate(r.createdAt)}`}</span>}</td>
                    <td className="px-3 py-2"><StatusBadge value={r.status} map={REQUEST_STATUS} />{approved && <StatusBadge value={r.fulfillment} map={FULFILLMENT} className="mt-1" />}</td>
                    <td className="px-3 py-2 text-xs">{approved ? <>{r.mrNo && <span className="block font-mono">{r.mrNo}</span>}<StatusBadge value={ms} map={MR_STATE} /></> : "-"}</td>
                    <td className={cn("px-3 py-2 text-right tabular-nums", approved && r.outstanding > 0 && "font-semibold text-amber-700 dark:text-amber-400")}>{approved ? `${formatNumber(r.outstanding)}/${formatNumber(r.qtyTotal)}` : "-"}</td>
                    <td className="px-3 py-2">
                      <span className="flex flex-wrap gap-1">
                        {editable && <Link href={`/apd/pengajuan/${r.id}/ubah`} className={buttonVariants({ variant: "outline", size: "xs" })}><Pencil /> Edit</Link>}
                        {canManage && approved && <MrButton requestId={r.id} code={r.code} current={r.mrNo} trigger={<Button size="xs" variant="outline"><MoreHorizontal /> {r.mrNo ? "Ubah MR" : "Lengkapi MR"}</Button>} />}
                        {canManage && approved && r.mrNo && ms !== "full" && (
                          <RequestMovesSheet kind="in" trigger={<Button size="xs" variant="outline"><ArrowDownToLine /> Terima MR</Button>} defaultRequestId={r.id} {...ops} />
                        )}
                        {canManage && approved && r.outstanding > 0 && (
                          <RequestMovesSheet kind="out" trigger={<Button size="xs"><Truck /> Kirim</Button>} defaultRequestId={r.id} {...ops} />
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Content>
  );
}

const STOCK_FILTERS = ["semua", "kosong", "minimum", "os"] as const;
const STOCK_FILTER_LABELS: Record<(typeof STOCK_FILTERS)[number], string> = { semua: "Semua", kosong: "Kosong / minus", minimum: "Di bawah minimum", os: "Ada outstanding" };

async function StockTab({ supabase, sp, warehouses }: { supabase: Supa; sp: SearchParams; warehouses: Warehouse[] }) {
  const wh = typeof sp.gudang === "string" && warehouses.some((w) => w.id === sp.gudang) ? sp.gudang : null;
  const filter = enumParam(sp, "status", STOCK_FILTERS, "semua");
  const all = await listStock(supabase, wh);
  const rows = all.filter((r) => (filter === "kosong" ? r.isActive && r.stock <= 0 : filter === "minimum" ? r.minStock > 0 && r.stock < r.minStock : filter === "os" ? r.outstanding > 0 : true));
  const href = (c: Record<string, string | null>) => hrefWith("/apd", sp, c);
  return (
    <Content
      title="Stok per Barang"
      description={`Stok = stok awal + masuk − keluar + kembali ± penyesuaian · ${wh ? warehouses.find((w) => w.id === wh)?.name : "semua gudang"}`}
      cardAction={
        warehouses.length > 1 ? (
          <span className="flex flex-wrap gap-1">
            {[{ id: null as string | null, name: "Semua gudang" }, ...warehouses.map((w) => ({ id: w.id as string | null, name: w.isActive ? w.name : `${w.name} (nonaktif)` }))].map((w) => (
              <Link key={w.id ?? "all"} href={href({ gudang: w.id })} aria-pressed={wh === w.id} className={cn("rounded-full border px-2.5 py-0.5 text-xs", wh === w.id ? "border-primary bg-primary/5 font-medium text-primary" : "hover:bg-accent")}>{w.name}</Link>
            ))}
          </span>
        ) : undefined
      }
    >
      <div className="mb-3 flex flex-wrap gap-1.5">
        {STOCK_FILTERS.map((f) => (
          <Link key={f} href={href({ status: f === "semua" ? null : f })} aria-pressed={filter === f} className={cn("rounded-full border px-2.5 py-0.5 text-xs", filter === f ? "border-primary bg-primary/5 font-medium text-primary" : "hover:bg-accent")}>{STOCK_FILTER_LABELS[f]}</Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <Empty>Tidak ada barang untuk filter ini.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="sticky top-0 bg-muted/40 text-xs text-muted-foreground">
              <tr><Th>Kode</Th><Th>Barang</Th><Th right>Stok awal</Th><Th right>Masuk</Th><Th right>Keluar</Th><Th right>Kembali</Th><Th right>Penyesuaian</Th><Th right>Stok</Th><Th>Status</Th><Th right>OS pengajuan</Th><Th>In / Out terakhir</Th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.itemId} className="border-t hover:bg-accent/30">
                  <td className="px-3 py-2 font-mono text-xs"><Link href={`/apd?tab=mutasi&barang=${r.itemId}`} className="underline underline-offset-2">{r.code}</Link></td>
                  <td className="px-3 py-2">{r.name}<small className="block text-xs text-muted-foreground">{r.typeName}{r.brand ? ` · ${r.brand}` : ""}</small></td>
                  <Num v={r.opening} />
                  <Num v={r.inQty} />
                  <Num v={r.outQty} />
                  <Num v={r.returnQty} />
                  <Num v={r.adjustQty} />
                  <td className={cn("px-3 py-2 text-right font-semibold tabular-nums", r.stock < 0 && "text-red-700 dark:text-red-400")}>{formatNumber(r.stock)} <small className="font-normal text-muted-foreground">{r.uom}</small></td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {r.stock < 0 ? <span className="text-xs font-medium text-red-700 dark:text-red-400">Minus: cek opname</span>
                      : r.stock === 0 ? <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Kosong</span>
                      : r.minStock > 0 && r.stock < r.minStock ? <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Di bawah min. {r.minStock}</span>
                      : <span className="text-xs text-green-700 dark:text-green-400">Tersedia</span>}
                  </td>
                  <Num v={r.outstanding} warn={r.outstanding > Math.max(r.stock, 0)} />
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{r.lastMoveOn ? formatDate(r.lastMoveOn) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Content>
  );
}

async function MovesTab({ supabase, sp, site, canManage, href }: { supabase: Supa; sp: SearchParams; site: string | null; canManage: boolean; href: (c: Record<string, string | null>) => string }) {
  const p = parseMoveParams(sp);
  const rows = await listMoves(supabase, p, site);
  return (
    <Content title="In / Out Stok" description={`${rows.length} transaksi${rows.length >= 500 ? " (500 terbaru)" : ""} · gudang atau site tujuan sesuai pilihan site`}>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {MOVE_FILTERS.map((k) => (
          <Link key={k} href={href({ jenis: k === "semua" ? null : k })} aria-pressed={p.kind === k} className={cn("rounded-full border px-2.5 py-0.5 text-xs", p.kind === k ? "border-primary bg-primary/5 font-medium text-primary" : "hover:bg-accent")}>{k === "semua" ? "Semua" : MOVE_KIND[k].label}</Link>
        ))}
        {p.item && <Link href={href({ barang: null })} className="rounded-full border border-primary bg-primary/5 px-2.5 py-0.5 text-xs text-primary">Satu barang ✕</Link>}
        <form method="get" className="ml-auto flex gap-2">
          <input type="hidden" name="tab" value="mutasi" />
          {p.kind !== "semua" && <input type="hidden" name="jenis" value={p.kind} />}
          <input name="q" defaultValue={p.q} placeholder="Cari penerima / no ref / PIC" aria-label="Cari In / Out" className="h-8 w-56 rounded-md border bg-background px-2 text-sm" />
        </form>
      </div>
      {rows.length === 0 ? (
        <Empty>Belum ada transaksi In / Out untuk filter ini.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[1040px] text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr><Th>Tanggal</Th><Th>Jenis</Th><Th>Barang</Th><Th right>Qty</Th><Th>Penerima / tujuan</Th><Th>No ref</Th><Th>PIC</Th><Th>Gudang</Th><Th>Catatan</Th>{canManage ? <Th>{""}</Th> : <></>}</tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} id={`mutasi-${m.id}`} className={cn("border-t", m.voidedAt && "text-muted-foreground line-through decoration-1")}>
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">{formatDate(m.movedOn)}</td>
                  <td className="px-3 py-2"><StatusBadge value={m.kind} map={MOVE_KIND} /></td>
                  <td className="px-3 py-2"><span className="font-mono text-xs">{m.itemCode}</span> <span className="block text-xs">{m.itemName}</span></td>
                  <td className="px-3 py-2 text-right tabular-nums">{m.kind === "out" ? "−" : m.qty > 0 ? "+" : ""}{formatNumber(Math.abs(m.qty))}</td>
                  <td className="px-3 py-2">
                    {m.employeeId ? <Link href={`/manpower/${m.employeeId}`} className="underline underline-offset-2">{m.recipient}</Link> : (m.recipient ?? "-")}
                    {m.destSite && <small className="block text-xs text-muted-foreground">{m.destSite}</small>}
                    {m.requestId && <Link href={`/apd/pengajuan/${m.requestId}`} className="block text-xs underline underline-offset-2">{m.requestCode}</Link>}
                  </td>
                  <td className="px-3 py-2 text-xs">{m.refNo ?? "-"}</td>
                  <td className="px-3 py-2 text-xs">{m.pic ?? "-"}</td>
                  <td className="px-3 py-2 text-xs">{m.warehouse}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {m.voidedAt ? <span className="no-underline">Dibatalkan: {m.voidReason}</span> : m.note}
                    {m.source === "import" && <span className="ml-1 rounded border px-1 text-[10px]">Excel</span>}
                  </td>
                  {canManage && <td className="px-3 py-2 text-right">{!m.voidedAt && <VoidMoveButton id={m.id} label={`${MOVE_KIND[m.kind as keyof typeof MOVE_KIND]?.label ?? m.kind} ${m.itemCode} ${formatDate(m.movedOn)}`} />}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Content>
  );
}

// Label pendek seperti kolom status sheet "Populasi Manpower" di Excel (Expired / MR / On Time).
const MATRIX_STATE: Record<string, { label: string; cell: string }> = {
  expired: { label: "Expired", cell: "bg-red-100 text-red-900 dark:bg-red-950/60 dark:text-red-200" },
  due_soon: { label: "MR", cell: "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200" },
  ok: { label: "On Time", cell: "bg-green-100 text-green-900 dark:bg-green-950/50 dark:text-green-200" },
};
const STATE_RANK: Record<string, number> = { expired: 0, due_soon: 1, ok: 2 };
const SubTh = ({ children, first }: { children: string; first?: boolean }) => <th scope="col" className={cn("border-b px-2 py-1.5 text-left font-medium whitespace-nowrap", first && "border-l")}>{children}</th>;

/**
 * Matriks APD per karyawan, mengikuti sheet "Populasi Manpower" Excel: satu baris per karyawan, satu grup kolom per jenis
 * (UK/Warna · QTY · Supply · Duedate · Days Left · status). Grup hanya untuk jenis yang muncul di data; kolom UK hanya untuk
 * jenis berukuran, QTY hanya bila ada penerimaan > 1. Filter status = karyawan yang punya minimal satu APD berstatus itu.
 */
async function HoldingsTab({ supabase, sp, site, href, types, siteNames }: { supabase: Supa; sp: SearchParams; site: string | null; href: (c: Record<string, string | null>) => string; types: ApdType[]; siteNames: Record<string, string> }) {
  const p = parseHoldingParams(sp);
  const all = await listHoldings(supabase, site, { state: "semua", q: p.q });
  const byEmp = new Map<string, { id: string; name: string; code: string; jobTitle: string; site: string; cells: Map<string, HoldingRow>; worst: number }>();
  for (const h of all) {
    const e = byEmp.get(h.employeeId) ?? { id: h.employeeId, name: h.employeeName, code: h.employeeCode, jobTitle: h.jobTitle, site: siteNames[h.locationId] ?? "-", cells: new Map(), worst: 2 };
    e.cells.set(h.typeCode, h);
    e.worst = Math.min(e.worst, STATE_RANK[h.state] ?? 2);
    byEmp.set(h.employeeId, e);
  }
  const people = [...byEmp.values()]
    .filter((e) => p.state === "semua" || [...e.cells.values()].some((h) => h.state === p.state))
    .sort((a, b) => a.site.localeCompare(b.site, "id") || a.name.localeCompare(b.name, "id"));
  const present = new Set(all.map((h) => h.typeCode));
  const groups = types
    .filter((t) => present.has(t.code))
    .map((t) => ({
      code: t.code,
      name: t.name,
      sizeLabel: t.sizeKind === "none" ? null : t.sizeKind === "color" ? "Warna" : "UK",
      qty: all.some((h) => h.typeCode === t.code && (h.lastQty ?? 1) > 1),
    }));
  const count = (s: string) => all.filter((h) => h.state === s).length;
  return (
    <Content
      title="APD Karyawan"
      description={`${people.length} karyawan · ${count("expired")} APD expired · ${count("due_soon")} APD perlu MR. Supply = terakhir terima, Duedate = Supply + periodik Matrix APD, MR = masuk masa peringatan.`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {HOLDING_FILTERS.map((k) => (
          <Link key={k} href={href({ status: k === "semua" ? null : k })} aria-pressed={p.state === k} className={cn("rounded-full border px-2.5 py-0.5 text-xs", p.state === k ? "border-primary bg-primary/5 font-medium text-primary" : "hover:bg-accent")}>{k === "semua" ? "Semua" : HOLDING_STATE[k].label}</Link>
        ))}
        <form method="get" className="ml-auto flex gap-2">
          <input type="hidden" name="tab" value="karyawan" />
          {p.state !== "semua" && <input type="hidden" name="status" value={p.state} />}
          <input name="q" defaultValue={p.q} placeholder="Cari nama / NIK / jabatan" aria-label="Cari karyawan" className="h-8 w-56 rounded-md border bg-background px-2 text-sm" />
        </form>
      </div>
      {people.length === 0 ? (
        <Empty>Belum ada riwayat APD karyawan untuk filter ini. Riwayat terbentuk dari pengiriman (OUT) yang ditautkan ke karyawan.</Empty>
      ) : (
        <div className="max-h-[75vh] overflow-auto rounded-lg border">
          <table className="w-max min-w-full border-separate border-spacing-0 text-xs">
            <thead className="sticky top-0 z-20 bg-muted text-muted-foreground">
              <tr>
                <th scope="col" rowSpan={2} className="sticky left-0 z-30 w-9 border-b bg-muted px-2 py-1.5 text-left font-medium">No</th>
                <th scope="col" rowSpan={2} className="sticky left-9 z-30 min-w-44 border-r border-b bg-muted px-2 py-1.5 text-left font-medium">Nama</th>
                <th scope="col" rowSpan={2} className="border-b px-2 py-1.5 text-left font-medium">Site</th>
                <th scope="col" rowSpan={2} className="border-b px-2 py-1.5 text-left font-medium">Jabatan</th>
                {groups.map((g) => (
                  <th key={g.code} scope="colgroup" colSpan={4 + (g.sizeLabel ? 1 : 0) + (g.qty ? 1 : 0)} className="border-b border-l px-2 py-1.5 text-center font-semibold text-foreground">{g.name}</th>
                ))}
                <th scope="col" rowSpan={2} className="border-b border-l px-2 py-1.5 font-medium">{""}</th>
              </tr>
              <tr>
                {groups.map((g) => (
                  <Fragment key={g.code}>
                    {g.sizeLabel && <SubTh first>{g.sizeLabel}</SubTh>}
                    {g.qty && <SubTh first={!g.sizeLabel}>QTY</SubTh>}
                    <SubTh first={!g.sizeLabel && !g.qty}>Supply</SubTh>
                    <SubTh>Duedate</SubTh>
                    <SubTh>Days Left</SubTh>
                    <SubTh>Status</SubTh>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map((e, i) => (
                <tr key={e.id} className="group">
                  <td className="sticky left-0 z-10 w-9 border-t bg-card px-2 py-1.5 tabular-nums group-hover:bg-muted">{i + 1}</td>
                  <td className="sticky left-9 z-10 border-t border-r bg-card px-2 py-1.5 group-hover:bg-muted">
                    <Link href={`/manpower/${e.id}`} className="font-medium underline underline-offset-2">{e.name}</Link>
                    <small className="block text-[11px] text-muted-foreground">{e.code}</small>
                  </td>
                  <td className="border-t px-2 py-1.5 whitespace-nowrap">{e.site}</td>
                  <td className="border-t px-2 py-1.5 whitespace-nowrap">{e.jobTitle}</td>
                  {groups.map((g) => {
                    const h = e.cells.get(g.code);
                    const st = h ? MATRIX_STATE[h.state] : null;
                    return (
                      <Fragment key={g.code}>
                        {g.sizeLabel && <td className="border-t border-l px-2 py-1.5">{h?.size ?? ""}</td>}
                        {g.qty && <td className={cn("border-t px-2 py-1.5 text-right tabular-nums", !g.sizeLabel && "border-l")}>{h?.lastQty ?? ""}</td>}
                        <td title={h?.lastItem} className={cn("border-t px-2 py-1.5 whitespace-nowrap tabular-nums", !g.sizeLabel && !g.qty && "border-l")}>{h ? formatDate(h.lastOn) : ""}</td>
                        <td className="border-t px-2 py-1.5 whitespace-nowrap tabular-nums">{h ? formatDate(h.nextDue) : ""}</td>
                        <td className={cn("border-t px-2 py-1.5 text-right tabular-nums", st?.cell)}>{h ? formatNumber(h.daysLeft) : ""}</td>
                        <td className={cn("border-t px-2 py-1.5 font-medium whitespace-nowrap", st?.cell)}>{st?.label ?? ""}</td>
                      </Fragment>
                    );
                  })}
                  <td className="border-t border-l px-2 py-1.5 whitespace-nowrap">
                    {e.worst < 2 && <Link href={`/apd/pengajuan/baru?karyawan=${e.id}&alasan=periodic`} className="underline underline-offset-2">Ajukan MR</Link>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Content>
  );
}
