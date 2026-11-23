"use client";

// Mode "Daftar" /inspeksi: tabel inspeksi satu bulan (urut tanggal rencana). Tanpa paginasi (maks. 500/bulan).
import { StatusBadge } from "@/components/detail/status-badge";
import { CodeLink, DataTable, type Column } from "@/components/list/data-table";
import { ListProvider } from "@/components/list/list-context";
import { UserProfileCard } from "@/components/user/user-profile-card";
import { formatDate } from "@/lib/format";
import type { InspectionRow } from "@/lib/inspeksi";
import { INSPECTION_STATUS } from "@/lib/inspeksi-rules";
import { cn } from "@/lib/utils";
import { typeChipClass } from "./inspeksi-calendar";

const COLUMNS: Column<InspectionRow>[] = [
  { id: "nomor", label: "Nomor", className: "w-36", cell: (r) => <CodeLink href={`/inspeksi/${r.id}`}>{r.code}</CodeLink> },
  { id: "tanggal", label: "Tanggal", className: "w-28", cell: (r) => formatDate(r.plannedAt) },
  {
    id: "jenis",
    label: "Jenis",
    className: "min-w-[220px]",
    cell: (r) => (
      <span className="flex items-center gap-2">
        <span className={cn("size-2.5 shrink-0 rounded-full border", typeChipClass(r.typeColor))} aria-hidden />
        <span className={cn("truncate font-medium", r.status === "cancelled" && "line-through")}>{r.title}</span>
      </span>
    ),
  },
  { id: "objek", label: "Objek", className: "w-36", cell: (r) => r.objectText ?? "—" },
  { id: "lokasi", label: "Lokasi", className: "w-36", cell: (r) => r.areaName },
  { id: "waktu", label: "Waktu", className: "w-24", cell: (r) => `${r.plannedTime} WIB` },
  { id: "pemeriksa", label: "Pemeriksa", className: "w-48", cell: (r) => (r.inspector ? <UserProfileCard userId={r.inspector.id} name={r.inspector.name} avatarUrl={r.inspector.avatarUrl} size="xs" /> : "-") },
  { id: "status", label: "Status", className: "w-44", cell: (r) => <StatusBadge value={r.displayStatus} map={INSPECTION_STATUS} /> },
  {
    id: "hasil",
    label: "Hasil",
    className: "w-32",
    cell: (r) =>
      r.summary ? (
        <span className="text-xs tabular-nums" title="Sesuai / Tidak sesuai / N/A">
          {r.summary.compliant} / <strong className={r.summary.noncompliant ? "text-red-600 dark:text-red-400" : undefined}>{r.summary.noncompliant}</strong> / {r.summary.na}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">-</span>
      ),
  },
];

export function InspeksiList({ rows }: { rows: InspectionRow[] }) {
  return (
    <ListProvider>
      <DataTable tableKey="inspeksi" columns={COLUMNS} rows={rows} rowKey={(r) => r.id} rowHref={(r) => `/inspeksi/${r.id}`} emptyText="Tidak ada inspeksi pada bulan dan filter ini." filtered className="min-w-[1100px]" reorderable={false} />
    </ListProvider>
  );
}
