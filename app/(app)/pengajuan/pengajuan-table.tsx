"use client";

// CONTOH boilerplate: tabel list standar (kolom di client karena urutannya bisa digeser user).
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Calendar, CalendarClock, Eye, FileText, Pencil, Plus, Printer, QrCode, Trash2, User, Wallet } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { InfoItem } from "@/components/detail/info-item";
import { StatusBadge } from "@/components/detail/status-badge";
import { CodeLink, DataTable, RowActionsMenu, type Column } from "@/components/list/data-table";
import { ExcelDownloadMenu } from "@/components/list/excel-download-menu";
import { FilterFields, FilterMultiSelect, FilterPanel, FilterRanges, type FilterChip, type FilterOption } from "@/components/list/filter-panel";
import { ListPendingBar, ListProvider } from "@/components/list/list-context";
import { ListSearchInput } from "@/components/list/list-search-input";
import { ListToolbar } from "@/components/list/list-toolbar";
import { QuickViewDialog } from "@/components/list/quick-view-dialog";
import { TablePaginationFooter } from "@/components/list/table-pagination-footer";
import { buttonVariants } from "@/components/ui/button";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { UserProfileCard } from "@/components/user/user-profile-card";
import { formatDate, formatRupiah } from "@/lib/format";
import type { PengajuanRow } from "@/lib/pengajuan";
import { EDITABLE_STATUSES, PENGAJUAN_SEARCH_FIELDS, STATUS_OPTIONS } from "@/lib/pengajuan-rules";
import { DOCUMENT_STATUS } from "@/lib/status";
import { toast } from "@/lib/toast";
import { countPengajuanAction, deletePengajuanAction } from "./actions";

const COLUMNS: Column<PengajuanRow>[] = [
  {
    id: "kode",
    label: "Nomor",
    sort: "asc",
    className: "w-44",
    cell: (r) => <CodeLink href={`/pengajuan/${r.id}`}>{r.code ?? <span className="text-muted-foreground italic">Draft</span>}</CodeLink>,
  },
  { id: "judul", label: "Judul", cell: (r) => <span className="block max-w-[280px] truncate" title={r.title}>{r.title}</span> },
  { id: "tanggal", label: "Dibuat", sort: "desc", className: "w-28", cell: (r) => formatDate(r.createdAt) },
  { id: "status", label: "Status", sort: "asc", className: "w-40", cell: (r) => <StatusBadge value={r.status} map={DOCUMENT_STATUS} /> },
  {
    id: "perusahaan",
    label: "Perusahaan",
    className: "w-24",
    cell: (r) => <span className="rounded border px-1.5 py-0.5 text-[11px] font-medium">{r.companyCode}</span>,
  },
  {
    id: "pemohon",
    label: "Pemohon",
    className: "w-52",
    cell: (r) => (r.requester ? <UserProfileCard userId={r.requester.id} name={r.requester.name} avatarUrl={r.requester.avatarUrl} size="xs" /> : "-"),
  },
  { id: "dibutuhkan", label: "Dibutuhkan", sort: "asc", className: "w-28", cell: (r) => (r.neededDate ? formatDate(r.neededDate) : "-") },
  { id: "total", label: "Total", sort: "desc", className: "w-36 text-right tabular-nums", cell: (r) => formatRupiah(r.total) },
];

export function PengajuanTable({
  rows,
  total,
  page,
  size,
  chips,
  filtered,
  companyOptions,
  departmentOptions,
  userId,
  isAdmin,
  canCreate,
}: {
  rows: PengajuanRow[];
  total: number;
  page: number;
  size: number;
  chips: FilterChip[];
  filtered: boolean;
  /** kosong = user hanya melihat satu perusahaan (filter disembunyikan) */
  companyOptions: FilterOption[];
  departmentOptions: FilterOption[];
  userId: string;
  isAdmin: boolean;
  canCreate: boolean;
}) {
  const router = useRouter();
  const [quick, setQuick] = useState<PengajuanRow | null>(null);
  const [toDelete, setToDelete] = useState<PengajuanRow | null>(null);
  const mine = (r: PengajuanRow) => r.requester?.id === userId;
  const canEdit = (r: PengajuanRow) => EDITABLE_STATUSES.includes(r.status) && ((mine(r) && canCreate) || isAdmin);
  const canDelete = (r: PengajuanRow) => r.status === "draft" && ((mine(r) && canCreate) || isAdmin);
  const openPrint = (r: PengajuanRow, mode: "qr" | "basah") => window.open(`/pengajuan/${r.id}?cetak=${mode}`, "_blank", "noopener");

  return (
    <ListProvider>
      <div className="space-y-3">
        <ListToolbar>
          <ListSearchInput placeholder="Cari nomor, judul, barang..." searchableFields={PENGAJUAN_SEARCH_FIELDS} />
          <ExcelDownloadMenu itemLabel="pengajuan" filteredCount={total} countAll={countPengajuanAction} />
        </ListToolbar>
        <FilterPanel chips={chips}>
          <FilterFields>
            <FilterMultiSelect param="status" label="Status" options={STATUS_OPTIONS} />
            {companyOptions.length > 0 && <FilterMultiSelect param="perusahaan" label="Perusahaan" options={companyOptions} />}
            <FilterMultiSelect param="departemen" label="Departemen" options={departmentOptions} />
          </FilterFields>
          <FilterRanges
            ranges={[
              { kind: "date", label: "Tanggal dibuat", from: "dari", to: "sampai" },
              { kind: "number", label: "Total", from: "min", to: "maks", currency: true },
            ]}
          />
        </FilterPanel>
        <ListPendingBar />
        <DataTable
          tableKey="pengajuan"
          columns={COLUMNS}
          rows={rows}
          rowKey={(r) => r.id}
          numberOffset={(page - 1) * size}
          onRowClick={setQuick}
          emptyText={canCreate ? "Belum ada pengajuan. Buat lewat tombol Buat Pengajuan." : "Belum ada pengajuan."}
          emptyAction={
            canCreate && !filtered ? (
              <Link href="/pengajuan/baru" className={buttonVariants({ size: "sm" })}>
                <Plus /> Buat Pengajuan
              </Link>
            ) : undefined
          }
          filtered={filtered}
          className="min-w-[1080px]"
          actions={(r) => (
            <RowActionsMenu>
              <DropdownMenuItem onClick={() => router.push(`/pengajuan/${r.id}`)}>
                <Eye /> Lihat detail
              </DropdownMenuItem>
              {canEdit(r) && (
                <DropdownMenuItem onClick={() => router.push(`/pengajuan/${r.id}/ubah`)}>
                  <Pencil /> Ubah
                </DropdownMenuItem>
              )}
              {r.code && (
                <>
                  <DropdownMenuItem onClick={() => openPrint(r, "qr")}>
                    <QrCode /> Cetak dengan QR
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openPrint(r, "basah")}>
                    <Printer /> Cetak tanda tangan basah
                  </DropdownMenuItem>
                </>
              )}
              {canDelete(r) && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => setToDelete(r)}>
                    <Trash2 /> Hapus draft
                  </DropdownMenuItem>
                </>
              )}
            </RowActionsMenu>
          )}
        />
        <TablePaginationFooter page={page} pageSize={size} total={total} itemLabel="pengajuan" />
      </div>

      {quick && (
        <QuickViewDialog open onOpenChange={(o) => !o && setQuick(null)} title={quick.code ?? "Draft"} description={quick.title} href={`/pengajuan/${quick.id}`}>
          <div className="space-y-2">
            <InfoItem icon={FileText} label="Status" value={<StatusBadge value={quick.status} map={DOCUMENT_STATUS} />} />
            <InfoItem icon={Building2} label="Perusahaan" value={[quick.companyCode, quick.departmentName].filter(Boolean).join(" · ")} />
            <InfoItem icon={User} label="Pemohon" value={quick.requester?.name ?? "-"} />
            <InfoItem icon={Calendar} label="Dibuat" value={formatDate(quick.createdAt)} />
            <InfoItem icon={CalendarClock} label="Dibutuhkan" value={quick.neededDate ? formatDate(quick.neededDate) : "-"} />
            <InfoItem icon={Wallet} label="Total" value={formatRupiah(quick.total)} />
          </div>
        </QuickViewDialog>
      )}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Hapus draft "${toDelete?.title ?? ""}"?`}
        description="Draft beserta barang dan lampirannya dihapus permanen. Riwayat aktivitas tetap tersimpan."
        confirmText="Hapus"
        destructive
        onConfirm={async () => {
          const res = await deletePengajuanAction(toDelete!.id);
          if (res.status !== "ok") {
            toast.error(res.message);
            throw new Error(res.message);
          }
          toast.success(res.message);
          router.refresh();
        }}
      />
    </ListProvider>
  );
}
