"use client";

// Daftar kejadian (prototipe IncidentList): saved views + filter + tabel. Kolom di client karena
// urutannya bisa digeser user. Status/umur/progres tindakan dihitung server.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Plus, Siren } from "lucide-react";
import { StatusBadge } from "@/components/detail/status-badge";
import { CodeLink, DataTable, RowActionsMenu, type Column } from "@/components/list/data-table";
import { ExcelDownloadMenu } from "@/components/list/excel-download-menu";
import { FilterFields, FilterMultiSelect, FilterPanel, FilterRanges, type FilterChip, type FilterOption } from "@/components/list/filter-panel";
import { ListPendingBar, ListProvider, useList } from "@/components/list/list-context";
import { ListSearchInput } from "@/components/list/list-search-input";
import { ListToolbar } from "@/components/list/list-toolbar";
import { TablePaginationFooter } from "@/components/list/table-pagination-footer";
import { buttonVariants } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { UserProfileCard } from "@/components/user/user-profile-card";
import { formatDate } from "@/lib/format";
import type { KejadianRow } from "@/lib/kejadian";
import { INCIDENT_STATUS, INCIDENT_VIEW_LABELS, INCIDENT_VIEWS, STATUS_OPTIONS, type IncidentView } from "@/lib/kejadian-rules";
import { cn } from "@/lib/utils";
import { countKejadianAction } from "./actions";

const COLUMNS: Column<KejadianRow>[] = [
  { id: "nomor", label: "Nomor", sort: "desc", className: "w-36", cell: (r) => <CodeLink href={`/kejadian/${r.id}`}>{r.code}</CodeLink> },
  {
    id: "uraian",
    label: "Kejadian",
    className: "min-w-[240px]",
    cell: (r) => (
      <span className="flex items-start gap-1.5">
        {r.isEmergency && <Siren className="mt-0.5 size-4 shrink-0 text-red-600" aria-label="Darurat" />}
        <span className="block max-w-[300px] truncate font-medium" title={r.description}>
          {r.description}
        </span>
      </span>
    ),
  },
  {
    id: "kategori",
    label: "Kategori",
    className: "w-48",
    cell: (r) => (
      <span title={r.classified ? "Kategori final HSE" : "Kategori dari pelapor (belum diklasifikasi)"}>
        {r.categoryLabel}
        {!r.classified && <span className="block text-[11px] text-muted-foreground">belum diklasifikasi</span>}
      </span>
    ),
  },
  { id: "kejadian", label: "Tgl Kejadian", sort: "desc", className: "w-28", cell: (r) => formatDate(r.occurredAt) },
  { id: "lokasi", label: "Lokasi", className: "w-36", cell: (r) => r.areaName },
  { id: "unit", label: "Unit", className: "w-40", cell: (r) => r.unit ?? "—" },
  {
    id: "pelapor",
    label: "Pelapor",
    className: "w-48",
    cell: (r) => (r.reporter ? <UserProfileCard userId={r.reporter.id} name={r.reporter.name} avatarUrl={r.reporter.avatarUrl} size="xs" /> : "-"),
  },
  {
    id: "status",
    label: "Status",
    sort: "asc",
    className: "w-44",
    cell: (r) => (
      <span className="flex flex-wrap items-center gap-1">
        <StatusBadge value={r.status} map={INCIDENT_STATUS} />
        {r.returned && <span className="rounded-md border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300">Dikembalikan</span>}
      </span>
    ),
  },
  {
    id: "tindakan",
    label: "Tindakan",
    className: "w-28",
    cell: (r) =>
      r.actions.total ? (
        <span className="flex items-center gap-2" title={`${r.actions.closed} dari ${r.actions.total} tindakan Closed`}>
          <span className="h-1.5 w-12 overflow-hidden rounded-full bg-muted" aria-hidden>
            <span className="block h-full rounded-full bg-green-600 dark:bg-green-500" style={{ width: `${(r.actions.closed / r.actions.total) * 100}%` }} />
          </span>
          <span className="text-xs font-medium tabular-nums">
            {r.actions.closed}/{r.actions.total}
          </span>
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">-</span>
      ),
  },
  {
    id: "umur",
    label: "Umur",
    className: "w-24",
    cell: (r) => `${r.ageDays} hari`,
  },
];

function ViewTabs({ view, counts }: { view: IncidentView; counts: Record<IncidentView, number> }) {
  const { setParams } = useList();
  return (
    <div className="-mx-1 flex gap-1 overflow-x-auto overflow-y-hidden px-1 pb-1" role="tablist" aria-label="Tampilan tersimpan">
      {INCIDENT_VIEWS.map((v) => (
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
          {INCIDENT_VIEW_LABELS[v]}
          <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", v === "klasifikasi" && counts[v] > 0 ? "bg-red-600 text-white" : "bg-muted text-muted-foreground")}>{counts[v]}</span>
        </button>
      ))}
    </div>
  );
}

export function KejadianTable({
  rows,
  total,
  page,
  size,
  view,
  counts,
  chips,
  filtered,
  options,
  canReport,
  mineOnly,
}: {
  rows: KejadianRow[];
  total: number;
  page: number;
  size: number;
  view: IncidentView;
  counts: Record<IncidentView, number>;
  chips: FilterChip[];
  filtered: boolean;
  options: { categories: FilterOption[]; areas: FilterOption[]; people: FilterOption[] };
  canReport: boolean;
  mineOnly: boolean;
}) {
  const router = useRouter();
  return (
    <ListProvider>
      <div className="space-y-3">
        <ViewTabs view={view} counts={counts} />
        <ListToolbar>
          <ListSearchInput placeholder="Cari nomor, uraian, unit..." searchableFields={["Nomor kejadian", "Uraian", "Kode & nama unit", "Detail lokasi"]} />
          <ExcelDownloadMenu itemLabel="kejadian" filteredCount={total} countAll={countKejadianAction} />
        </ListToolbar>
        <FilterPanel chips={chips}>
          <FilterFields>
            <FilterMultiSelect param="status" label="Status" options={STATUS_OPTIONS} />
            <FilterMultiSelect param="kategori" label="Kategori" options={options.categories} />
            <FilterMultiSelect param="area" label="Lokasi" options={options.areas} />
            {!mineOnly && <FilterMultiSelect param="pelapor" label="Pelapor" options={options.people} />}
          </FilterFields>
          <FilterRanges ranges={[{ kind: "date", label: "Tanggal kejadian", from: "dari", to: "sampai" }]} />
        </FilterPanel>
        <ListPendingBar />
        <DataTable
          tableKey="kejadian"
          columns={COLUMNS}
          rows={rows}
          rowKey={(r) => r.id}
          numberOffset={(page - 1) * size}
          rowHref={(r) => `/kejadian/${r.id}`}
          emptyText={canReport ? "Belum ada laporan kejadian. Laporkan lewat tombol Lapor Kejadian." : "Belum ada laporan kejadian."}
          emptyAction={
            canReport && !filtered ? (
              <Link href="/kejadian/lapor" className={buttonVariants({ size: "sm" })}>
                <Plus /> Lapor Kejadian
              </Link>
            ) : undefined
          }
          filtered={filtered}
          className="min-w-[1280px]"
          actions={(r) => (
            <RowActionsMenu>
              <DropdownMenuItem onClick={() => router.push(`/kejadian/${r.id}`)}>
                <Eye /> Lihat detail
              </DropdownMenuItem>
            </RowActionsMenu>
          )}
        />
        <TablePaginationFooter page={page} pageSize={size} total={total} itemLabel="kejadian" />
      </div>
    </ListProvider>
  );
}
