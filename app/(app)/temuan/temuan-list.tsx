"use client";

// Daftar temuan: saved views (tab) + toggle Tabel/Kanban (URL `mode`) + filter + ekspor. Kolom di client
// karena urutannya bisa digeser user. Kanban = loader yang sama dengan tabel (per kolom status).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, Columns3, Eye, MapPin, Plus, Rows3 } from "lucide-react";
import { StatusBadge } from "@/components/detail/status-badge";
import { CodeLink, DataTable, RowActionsMenu, type Column } from "@/components/list/data-table";
import { ExcelDownloadMenu } from "@/components/list/excel-download-menu";
import { FilterFields, FilterMultiSelect, FilterPanel, FilterRanges, type FilterChip, type FilterOption } from "@/components/list/filter-panel";
import { ListPendingBar, ListProvider, useList } from "@/components/list/list-context";
import { ListSearchInput } from "@/components/list/list-search-input";
import { ListToolbar } from "@/components/list/list-toolbar";
import { TablePaginationFooter } from "@/components/list/table-pagination-footer";
import { SourceChip } from "@/components/source-chip";
import { buttonVariants } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { UserProfileCard } from "@/components/user/user-profile-card";
import { formatDate } from "@/lib/format";
import type { StatusDef } from "@/lib/status";
import type { TemuanRow } from "@/lib/temuan";
import { FINDING_STATUS, FINDING_STATUS_OPTIONS, FINDING_VIEW_LABELS, FINDING_VIEWS, SOURCE_KIND_LABEL, SOURCE_KINDS, type FindingView } from "@/lib/temuan-rules";
import { cn } from "@/lib/utils";
import { countTemuanAction } from "./actions";

function Progress({ v }: { v: { closed: number; total: number } }) {
  if (!v.total) return <span className="text-xs text-muted-foreground">-</span>;
  return (
    <span className="flex items-center gap-2" title={`${v.closed} dari ${v.total} tindakan Closed`}>
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-muted" aria-hidden>
        <span className="block h-full rounded-full bg-green-600 dark:bg-green-500" style={{ width: `${(v.closed / v.total) * 100}%` }} />
      </span>
      <span className="text-xs font-medium tabular-nums">
        {v.closed}/{v.total}
      </span>
    </span>
  );
}

function DueCell({ r }: { r: TemuanRow }) {
  const late = r.lateDays;
  return (
    <span className={cn(late > 0 && "font-medium text-red-600 dark:text-red-400")}>
      {formatDate(r.dueDate)}
      {late > 0 && <span className="block text-xs">+{late} hari</span>}
    </span>
  );
}

// riskMap disuntik lewat kolom factory (master berwarna dari server); tetap konstanta stabil per peta
const columnCache = new WeakMap<Record<string, StatusDef>, Column<TemuanRow>[]>();
function columnsFor(riskMap: Record<string, StatusDef>): Column<TemuanRow>[] {
  const hit = columnCache.get(riskMap);
  if (hit) return hit;
  const cols: Column<TemuanRow>[] = [
    { id: "nomor", label: "Nomor", sort: "desc", className: "w-36", cell: (r) => <CodeLink href={`/temuan/${r.id}`}>{r.code}</CodeLink> },
    { id: "temuan", label: "Temuan", cell: (r) => <span className="block max-w-[300px] truncate font-medium" title={r.title}>{r.title}</span> },
    {
      id: "sumber",
      label: "Sumber",
      className: "w-44",
      cell: (r) =>
        r.sourceRef ? (
          <SourceChip label={SOURCE_KIND_LABEL[r.sourceKind] ?? "Sumber"} code={r.sourceRef} href={r.sourceHref} />
        ) : (
          <span className="text-xs text-muted-foreground">{SOURCE_KIND_LABEL[r.sourceKind]}</span>
        ),
    },
    { id: "lokasi", label: "Lokasi", className: "w-36", cell: (r) => r.areaName },
    { id: "prioritas", label: "Prioritas", sort: "desc", className: "w-28", cell: (r) => <StatusBadge value={r.riskLevel} map={riskMap} /> },
    {
      id: "pic",
      label: "PIC",
      className: "w-48",
      cell: (r) => (r.pic ? <UserProfileCard userId={r.pic.id} name={r.pic.name} avatarUrl={r.pic.avatarUrl} size="xs" /> : "-"),
    },
    { id: "due", label: "Due Date", sort: "asc", className: "w-28", cell: (r) => <DueCell r={r} /> },
    { id: "umur", label: "Umur", className: "w-20", cell: (r) => `${r.ageDays} hari` },
    { id: "status", label: "Status", sort: "asc", className: "w-40", cell: (r) => <StatusBadge value={r.overdue ? "overdue" : r.status} map={FINDING_STATUS} /> },
    { id: "tindakan", label: "Tindakan", className: "w-28", cell: (r) => <Progress v={r.actions} /> },
  ];
  columnCache.set(riskMap, cols);
  return cols;
}

function ViewTabs({ view, counts }: { view: FindingView; counts: Record<FindingView, number> }) {
  const { setParams } = useList();
  return (
    <div className="-mx-1 flex gap-1 overflow-x-auto overflow-y-hidden px-1 pb-1" role="tablist" aria-label="Tampilan tersimpan">
      {FINDING_VIEWS.map((v) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={view === v}
          onClick={() => setParams({ tampilan: v === "semua" ? null : v })}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors",
            view === v ? "border-primary bg-primary/5 font-medium text-primary" : "hover:bg-accent",
          )}
        >
          {FINDING_VIEW_LABELS[v]}
          <span
            className={cn(
              "rounded-full px-1.5 text-[11px] tabular-nums",
              v === "overdue" && counts[v] > 0 ? "bg-red-600 text-white" : "bg-muted text-muted-foreground",
            )}
          >
            {counts[v]}
          </span>
        </button>
      ))}
    </div>
  );
}

function ModeToggle({ mode }: { mode: "tabel" | "kanban" }) {
  const { setParams } = useList();
  return (
    <div className="flex shrink-0 rounded-md border p-0.5" role="group" aria-label="Mode tampilan">
      {(["tabel", "kanban"] as const).map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={mode === m}
          onClick={() => setParams({ mode: m === "tabel" ? null : m })}
          className={cn("flex items-center gap-1.5 rounded px-2.5 py-1 text-sm", mode === m ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:text-foreground")}
        >
          {m === "tabel" ? <Rows3 className="size-4" /> : <Columns3 className="size-4" />}
          {m === "tabel" ? "Tabel" : "Kanban"}
        </button>
      ))}
    </div>
  );
}

export function TemuanList({
  mode,
  view,
  counts,
  rows,
  total,
  kanban,
  page,
  size,
  chips,
  filtered,
  riskMap,
  options,
  canCreate,
}: {
  mode: "tabel" | "kanban";
  view: FindingView;
  counts: Record<FindingView, number>;
  rows: TemuanRow[];
  total: number;
  kanban: { status: string; total: number; rows: TemuanRow[] }[];
  page: number;
  size: number;
  chips: FilterChip[];
  filtered: boolean;
  riskMap: Record<string, StatusDef>;
  options: { categories: FilterOption[]; risks: FilterOption[]; areas: FilterOption[]; people: FilterOption[] };
  canCreate: boolean;
}) {
  const router = useRouter();
  const columns = columnsFor(riskMap);
  return (
    <ListProvider>
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <ViewTabs view={view} counts={counts} />
          <ModeToggle mode={mode} />
        </div>
        <ListToolbar>
          <ListSearchInput placeholder="Cari nomor, judul, referensi..." searchableFields={["Nomor temuan", "Judul", "Uraian", "Referensi sumber", "Detail lokasi"]} />
          <ExcelDownloadMenu itemLabel="temuan" filteredCount={mode === "tabel" ? total : kanban.reduce((a, k) => a + k.total, 0)} countAll={countTemuanAction} />
        </ListToolbar>
        <FilterPanel chips={chips}>
          <FilterFields>
            <FilterMultiSelect param="status" label="Status" options={FINDING_STATUS_OPTIONS} />
            <FilterMultiSelect param="sumber" label="Sumber" options={SOURCE_KINDS.map((s) => ({ value: s.value, label: s.label }))} />
            <FilterMultiSelect param="kategori" label="Kategori" options={options.categories} />
            <FilterMultiSelect param="prioritas" label="Prioritas" options={options.risks} />
            <FilterMultiSelect param="pic" label="PIC" options={options.people} />
            <FilterMultiSelect param="area" label="Lokasi" options={options.areas} />
          </FilterFields>
          <FilterRanges
            ranges={[
              { kind: "date", label: "Tanggal ditemukan", from: "dari", to: "sampai" },
              { kind: "date", label: "Due date", from: "due_dari", to: "due_sampai" },
            ]}
          />
        </FilterPanel>
        <ListPendingBar />
        {mode === "tabel" ? (
          <>
            <DataTable
              tableKey="temuan"
              columns={columns}
              rows={rows}
              rowKey={(r) => r.id}
              numberOffset={(page - 1) * size}
              rowHref={(r) => `/temuan/${r.id}`}
              emptyText={canCreate ? "Belum ada temuan. Buat lewat tombol Temuan Baru." : "Belum ada temuan."}
              emptyAction={
                canCreate && !filtered ? (
                  <Link href="/temuan/baru" className={buttonVariants({ size: "sm" })}>
                    <Plus /> Temuan Baru
                  </Link>
                ) : undefined
              }
              filtered={filtered || view !== "semua"}
              className="min-w-[1240px]"
              actions={(r) => (
                <RowActionsMenu>
                  <DropdownMenuItem onClick={() => router.push(`/temuan/${r.id}`)}>
                    <Eye /> Lihat detail
                  </DropdownMenuItem>
                </RowActionsMenu>
              )}
            />
            <TablePaginationFooter page={page} pageSize={size} total={total} itemLabel="temuan" />
          </>
        ) : (
          <Kanban columns={kanban} riskMap={riskMap} />
        )}
      </div>
    </ListProvider>
  );
}

function Kanban({ columns, riskMap }: { columns: { status: string; total: number; rows: TemuanRow[] }[]; riskMap: Record<string, StatusDef> }) {
  return (
    <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
      {columns.map((c) => (
        <section key={c.status} className="flex w-72 shrink-0 snap-start flex-col rounded-xl border bg-muted/30" aria-label={FINDING_STATUS[c.status].label}>
          <header className="flex items-center justify-between border-b px-3 py-2">
            <StatusBadge value={c.status} map={FINDING_STATUS} />
            <span className="text-xs font-medium tabular-nums text-muted-foreground">{c.total}</span>
          </header>
          <div className="flex flex-col gap-2 p-2">
            {c.rows.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">Kosong</p>}
            {c.rows.map((r) => (
              <Link
                key={r.id}
                href={`/temuan/${r.id}`}
                className={cn(
                  "space-y-2 rounded-lg border bg-card p-3 text-left shadow-xs transition-colors hover:border-primary/40",
                  r.overdue && "border-l-4 border-l-red-500",
                )}
              >
                <span className="block font-mono text-xs text-muted-foreground">{r.code}</span>
                <span className="block text-sm leading-snug font-medium">{r.title}</span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="size-3" /> {r.areaName}
                </span>
                <span className="flex items-center justify-between gap-2">
                  <StatusBadge value={r.riskLevel} map={riskMap} />
                  <span className="truncate text-xs text-muted-foreground">{r.pic?.name}</span>
                </span>
                <span className={cn("flex items-center gap-1 text-xs", r.overdue ? "font-medium text-red-600 dark:text-red-400" : "text-muted-foreground")}>
                  <CalendarClock className="size-3" />
                  {formatDate(r.dueDate)}
                  {r.overdue && " · Overdue"}
                </span>
              </Link>
            ))}
            {c.total > c.rows.length && <p className="text-center text-xs text-muted-foreground">+{c.total - c.rows.length} lainnya (pakai Tabel)</p>}
          </div>
        </section>
      ))}
    </div>
  );
}
