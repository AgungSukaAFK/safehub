"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { StatusBadge } from "@/components/detail/status-badge";
import { CodeLink, DataTable, type Column } from "@/components/list/data-table";
import { ListProvider } from "@/components/list/list-context";
import { buttonVariants } from "@/components/ui/button";
import { UserProfileCard } from "@/components/user/user-profile-card";
import { formatDateTime } from "@/lib/format";
import type { ObservationRow } from "@/lib/inspeksi";
import { OBS_KIND_LABEL } from "@/lib/inspeksi-rules";
import { FINDING_STATUS } from "@/lib/temuan-rules";

const COLUMNS: Column<ObservationRow>[] = [
  { id: "nomor", label: "Nomor", className: "w-36", cell: (r) => <CodeLink href={`/observasi/${r.id}`}>{r.code}</CodeLink> },
  { id: "jenis", label: "Jenis", className: "w-40", cell: (r) => <span className="rounded border px-1.5 py-0.5 text-[11px] font-medium">{OBS_KIND_LABEL[r.kind] ?? r.kind}</span> },
  { id: "uraian", label: "Uraian", className: "min-w-[260px]", cell: (r) => <span className="block max-w-[340px] truncate" title={r.description}>{r.description}</span> },
  { id: "lokasi", label: "Lokasi", className: "w-36", cell: (r) => r.areaName },
  { id: "waktu", label: "Waktu", className: "w-40", cell: (r) => formatDateTime(r.observedAt) },
  { id: "pelapor", label: "Pelapor", className: "w-48", cell: (r) => (r.reporter ? <UserProfileCard userId={r.reporter.id} name={r.reporter.name} avatarUrl={r.reporter.avatarUrl} size="xs" /> : "-") },
  {
    id: "tindak",
    label: "Tindak lanjut",
    className: "w-48",
    cell: (r) =>
      r.finding ? (
        <Link href={`/temuan/${r.finding.id}`} className="inline-flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-primary">{r.finding.code}</span>
          <StatusBadge value={r.finding.status} map={FINDING_STATUS} />
        </Link>
      ) : (
        <span className="text-xs text-muted-foreground">Tanpa temuan</span>
      ),
  },
];

export function ObservasiTable({ rows, canReport }: { rows: ObservationRow[]; canReport: boolean }) {
  return (
    <ListProvider>
      <DataTable
        tableKey="observasi"
        columns={COLUMNS}
        rows={rows}
        rowKey={(r) => r.id}
        rowHref={(r) => `/observasi/${r.id}`}
        emptyText={canReport ? "Belum ada observasi. Laporkan lewat tombol Lapor Observasi." : "Belum ada observasi."}
        emptyAction={
          canReport ? (
            <Link href="/observasi/baru" className={buttonVariants({ size: "sm" })}>
              <Plus /> Lapor Observasi
            </Link>
          ) : undefined
        }
        filtered={false}
        className="min-w-[1000px]"
      />
    </ListProvider>
  );
}
