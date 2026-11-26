import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowDownUp, ClipboardList, Pencil, Plus, Upload } from "lucide-react";
import { StatusBadge } from "@/components/detail/status-badge";
import { Content } from "@/components/list/content";
import { PageHeader } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { getApdSummary, listApdItems, listApdTypes, listHoldings, listMoves, listStock, listWarehouses, parseHoldingParams, parseMoveParams } from "@/lib/apd";
import { APD_TAB_LABELS, APD_TABS, HOLDING_FILTERS, HOLDING_STATE, intervalText, MOVE_FILTERS, MOVE_KIND, SIZE_KIND_LABELS } from "@/lib/apd-rules";
import { requireAccess } from "@/lib/auth";
import { formatDate, formatNumber } from "@/lib/format";
import { enumParam, hrefWith, type SearchParams } from "@/lib/search-params";
import { parseSiteParam } from "@/lib/sites";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { ApdItemSheet, ApdTypeSheet, MoveSheet, VoidMoveButton } from "./apd-sheets";

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
  const [items, types, warehouses] = await Promise.all([listApdItems(supabase), listApdTypes(supabase), canManage ? listWarehouses(supabase) : Promise.resolve([])]);
  const typeOptions = types.filter((t) => t.isActive).map((t) => ({ value: t.id, label: t.name }));
  const itemOptions = items.filter((i) => i.isActive).map((i) => ({ value: i.id, label: `${i.code} · ${i.name}` }));
  const siteOptions = sites.map((s) => ({ value: s.id, label: s.name }));
  const whOptions = [...new Map([...warehouses.map((w) => [w.id, w.name] as const), ...sites.map((s) => [s.id, s.name] as const)]).entries()].map(([value, l]) => ({ value, label: l }));
  const { data: emps } = canManage ? await supabase.from("employees").select("id, code, name").eq("status", "active").order("name").limit(2000) : { data: [] };
  const empOptions = (emps ?? []).map((e) => ({ value: e.id, label: `${e.name} · ${e.code}` }));

  return (
    <>
      <PageHeader
        title="Monitoring APD"
        description={`Stok gudang, pengiriman, dan jatuh tempo penggantian APD · ${label}`}
        actions={
          <>
            <Link href="/apd/pengajuan" className={buttonVariants({ variant: "outline" })}><ClipboardList /> Pengajuan APD</Link>
            {canManage && <Link href="/apd/impor" className={buttonVariants({ variant: "outline" })}><Upload /> Impor Data Lama</Link>}
            {canManage && <MoveSheet trigger={<Button><ArrowDownUp /> Catat Mutasi</Button>} warehouses={whOptions} items={itemOptions} employees={empOptions} sites={siteOptions} defaultWarehouse={warehouses[0]?.id} />}
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
      {tab === "ringkasan" && <SummaryTab supabase={supabase} site={siteId} siteLabel={label} />}
      {tab === "stok" && <StockTab supabase={supabase} sp={sp} warehouses={warehouses} />}
      {tab === "mutasi" && <MovesTab supabase={supabase} sp={sp} site={siteId} canManage={canManage} href={href} />}
      {tab === "karyawan" && <HoldingsTab supabase={supabase} sp={sp} site={siteId} href={href} />}
      {tab === "periodik" && (
        <Content
          title="Masa Periodik APD"
          description="Nilai awal dari Matrix APD PT. Garuda Mart Indonesia (Head of Dept HSE, 24 Februari 2026). Berlaku untuk HO, Branch & Site."
          cardAction={canPolicy ? <ApdTypeSheet trigger={<Button size="sm" variant="outline"><Plus /> Tambah Jenis</Button>} /> : undefined}
        >
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr><Th>Jenis APD</Th><Th>Masa periodik</Th><Th>Peringatan</Th><Th>Ukuran</Th><Th>Keterangan</Th><Th>{""}</Th></tr>
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
  const s = await getApdSummary(supabase, site);
  const tiles: { title: string; value: string; hint: string; href: string; warn?: boolean }[] = [
    { title: "Stok tersedia", value: formatNumber(s.stockTotal), hint: `${s.itemsActive} kode barang aktif · semua gudang`, href: "/apd?tab=stok" },
    { title: "Barang kosong", value: formatNumber(s.itemsEmpty), hint: s.itemsNegative ? `${s.itemsNegative} minus: perlu stock opname` : "Stok 0 atau kurang", href: "/apd?tab=stok&status=kosong", warn: s.itemsNegative > 0 },
    { title: "Di bawah minimum", value: formatNumber(s.itemsBelowMin), hint: "Stok < stok minimum barang", href: "/apd?tab=stok&status=minimum", warn: s.itemsBelowMin > 0 },
    { title: "Menunggu approval", value: formatNumber(s.requestsPending), hint: `Pengajuan · ${siteLabel}`, href: "/apd/pengajuan?status=pending_approval" },
    { title: "Belum terpenuhi", value: formatNumber(s.requestsOpen), hint: `${formatNumber(s.outstandingQty)} unit outstanding (OS)`, href: "/apd/pengajuan?status=terbuka", warn: s.requestsOpen > 0 },
    { title: "Rata-rata lead time", value: s.leadDaysAvg === null ? "Belum tersedia" : `${formatNumber(s.leadDaysAvg)} hari`, hint: "Disetujui s.d. terkirim penuh, 90 hari terakhir", href: "/apd/pengajuan?status=approved" },
    { title: "Lewat jatuh tempo", value: formatNumber(s.holdingsExpired), hint: "APD karyawan melewati masa periodik", href: "/apd?tab=karyawan&status=expired", warn: s.holdingsExpired > 0 },
    { title: "Segera ganti", value: formatNumber(s.holdingsDueSoon), hint: "Masuk masa peringatan", href: "/apd?tab=karyawan&status=due_soon" },
    { title: "APD keluar 30 hari", value: formatNumber(s.out30d), hint: `Unit dikirim ke ${siteLabel}`, href: "/apd?tab=mutasi&jenis=out" },
  ];
  return (
    <div className="col-span-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tiles.map((t) => (
        <Link key={t.title} href={t.href} className={cn("rounded-xl border bg-card p-4 hover:bg-accent/40", t.warn && "border-amber-300 dark:border-amber-900")}>
          <span className="text-xs text-muted-foreground">{t.title}</span>
          <strong className={cn("block text-2xl tabular-nums", t.value === "Belum tersedia" && "text-base font-medium text-muted-foreground")}>{t.value}</strong>
          <small className="text-xs text-muted-foreground">{t.hint}</small>
        </Link>
      ))}
    </div>
  );
}

const STOCK_FILTERS = ["semua", "kosong", "minimum", "os"] as const;
const STOCK_FILTER_LABELS: Record<(typeof STOCK_FILTERS)[number], string> = { semua: "Semua", kosong: "Kosong / minus", minimum: "Di bawah minimum", os: "Ada outstanding" };

async function StockTab({ supabase, sp, warehouses }: { supabase: Supa; sp: SearchParams; warehouses: { id: string; name: string }[] }) {
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
            {[{ id: null, name: "Semua gudang" }, ...warehouses].map((w) => (
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
              <tr><Th>Kode</Th><Th>Barang</Th><Th right>Stok awal</Th><Th right>Masuk</Th><Th right>Keluar</Th><Th right>Kembali</Th><Th right>Penyesuaian</Th><Th right>Stok</Th><Th>Status</Th><Th right>OS pengajuan</Th><Th>Mutasi terakhir</Th></tr>
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
    <Content title="Mutasi Stok" description={`${rows.length} mutasi${rows.length >= 500 ? " (500 terbaru)" : ""} · gudang atau site tujuan sesuai pilihan site`}>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {MOVE_FILTERS.map((k) => (
          <Link key={k} href={href({ jenis: k === "semua" ? null : k })} aria-pressed={p.kind === k} className={cn("rounded-full border px-2.5 py-0.5 text-xs", p.kind === k ? "border-primary bg-primary/5 font-medium text-primary" : "hover:bg-accent")}>{k === "semua" ? "Semua" : MOVE_KIND[k].label}</Link>
        ))}
        {p.item && <Link href={href({ barang: null })} className="rounded-full border border-primary bg-primary/5 px-2.5 py-0.5 text-xs text-primary">Satu barang ✕</Link>}
        <form method="get" className="ml-auto flex gap-2">
          <input type="hidden" name="tab" value="mutasi" />
          {p.kind !== "semua" && <input type="hidden" name="jenis" value={p.kind} />}
          <input name="q" defaultValue={p.q} placeholder="Cari penerima / no ref / PIC" aria-label="Cari mutasi" className="h-8 w-56 rounded-md border bg-background px-2 text-sm" />
        </form>
      </div>
      {rows.length === 0 ? (
        <Empty>Belum ada mutasi untuk filter ini.</Empty>
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

async function HoldingsTab({ supabase, sp, site, href }: { supabase: Supa; sp: SearchParams; site: string | null; href: (c: Record<string, string | null>) => string }) {
  const p = parseHoldingParams(sp);
  const rows = await listHoldings(supabase, site, p);
  const people = new Set(rows.map((r) => r.employeeId)).size;
  return (
    <Content title="Jatuh Tempo APD per Karyawan" description={`${rows.length} APD · ${people} karyawan. Hanya jenis yang pernah diterima dan dilacak masa periodiknya.`}>
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
      {rows.length === 0 ? (
        <Empty>Belum ada riwayat APD karyawan untuk filter ini. Riwayat terbentuk dari pengiriman (mutasi keluar) yang ditautkan ke karyawan.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr><Th>Karyawan</Th><Th>Jenis APD</Th><Th>Ukuran</Th><Th>Terakhir terima</Th><Th>Jatuh tempo</Th><Th>Status</Th><Th>{""}</Th></tr>
            </thead>
            <tbody>
              {rows.map((h) => (
                <tr key={`${h.employeeId}-${h.typeCode}`} className="border-t">
                  <td className="px-3 py-2"><Link href={`/manpower/${h.employeeId}`} className="font-medium underline underline-offset-2">{h.employeeName}</Link><small className="block text-xs text-muted-foreground">{h.employeeCode} · {h.jobTitle}</small></td>
                  <td className="px-3 py-2">{h.typeName}<small className="block text-xs text-muted-foreground">{h.lastItem}</small></td>
                  <td className="px-3 py-2">{h.size ?? "-"}</td>
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">{formatDate(h.lastOn)}</td>
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">{formatDate(h.nextDue)}<small className="block text-xs text-muted-foreground">{h.daysLeft < 0 ? `lewat ${-h.daysLeft} hari` : `${h.daysLeft} hari lagi`}</small></td>
                  <td className="px-3 py-2"><StatusBadge value={h.state} map={HOLDING_STATE} /></td>
                  <td className="px-3 py-2 text-right">{h.state !== "ok" && <Link href={`/apd/pengajuan/baru?karyawan=${h.employeeId}&alasan=periodic`} className="text-xs underline underline-offset-2">Ajukan ganti</Link>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Content>
  );
}
