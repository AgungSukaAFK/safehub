"use client";

// Tabel Pengguna & Akses (list standar §8): kolom di client karena urutannya bisa digeser user.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Building2, HardHat, Calendar, Eye, KeyRound, Mail, MapPin, ShieldCheck, UserMinus, UserPlus, Users } from "lucide-react";
import { InfoItem } from "@/components/detail/info-item";
import { DataTable, RowActionsMenu, type Column } from "@/components/list/data-table";
import { ExcelDownloadMenu } from "@/components/list/excel-download-menu";
import { FilterFields, FilterMultiSelect, FilterPanel, type FilterChip, type FilterOption } from "@/components/list/filter-panel";
import { ListPendingBar, ListProvider } from "@/components/list/list-context";
import { ListSearchInput } from "@/components/list/list-search-input";
import { ListToolbar } from "@/components/list/list-toolbar";
import { QuickViewDialog } from "@/components/list/quick-view-dialog";
import { TablePaginationFooter } from "@/components/list/table-pagination-footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { UserProfileCard } from "@/components/user/user-profile-card";
import { formatDate, formatDateTime } from "@/lib/format";
import type { PenggunaRow } from "@/lib/pengguna";
import { FUNCTION_LABELS } from "@/lib/functions";
import { ACTIVE_OPTIONS, FUNCTION_OPTIONS, PENGGUNA_SEARCH_FIELDS, ROLE_OPTIONS } from "@/lib/pengguna-rules";
import { ROLE_LABELS, type Role } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { ChangeRoleDialog, GrantAccessDialog, RevokeAccessDialog, type AccessTarget } from "./access-dialogs";
import { countPenggunaAction } from "./actions";

const ROLE_STYLE: Record<Role, string> = {
  admin: "border-primary/30 bg-primary/10 text-primary",
  editor: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  viewer: "border-border bg-muted text-muted-foreground",
};

export function RoleBadge({ role }: { role: Role }) {
  return (
    <Badge variant="outline" className={cn("font-medium", ROLE_STYLE[role])}>
      {ROLE_LABELS[role]}
    </Badge>
  );
}

export function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className="size-1.5 rounded-full bg-success" /> Aktif
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="size-1.5 rounded-full bg-muted-foreground/50" /> Nonaktif
    </span>
  );
}

const COLUMNS: Column<PenggunaRow>[] = [
  {
    id: "nama",
    label: "Nama",
    sort: "asc",
    className: "w-60",
    cell: (r) => <UserProfileCard userId={r.userId} name={r.name} avatarUrl={r.avatarUrl} subtitle={r.email} size="md" />,
  },
  { id: "role", label: "Role", sort: "asc", className: "w-24", cell: (r) => <RoleBadge role={r.role} /> },
  {
    id: "fungsi",
    label: "Fungsi K3",
    className: "w-48",
    cell: (r) =>
      r.functions.length ? (
        <span className="flex flex-wrap gap-1">
          {r.functions.map((f) => (
            <span key={f} className="rounded border px-1.5 py-0.5 text-[11px] font-medium">
              {FUNCTION_LABELS[f]}
            </span>
          ))}
        </span>
      ) : (
        <span className="text-muted-foreground">-</span>
      ),
  },
  {
    id: "perusahaan",
    label: "Perusahaan",
    className: "w-24",
    cell: (r) => (r.company ? <span className="rounded border px-1.5 py-0.5 text-[11px] font-medium">{r.company}</span> : <span className="text-muted-foreground">-</span>),
  },
  { id: "departemen", label: "Departemen", className: "w-36", cell: (r) => r.department ?? "-" },
  { id: "jabatan", label: "Jabatan", className: "w-32", cell: (r) => r.jobTitle ?? "-" },
  { id: "lokasi", label: "Lokasi", className: "w-40", cell: (r) => <span className="block max-w-40 truncate">{r.location ?? "-"}</span> },
  { id: "status", label: "Status", className: "w-24", cell: (r) => <ActiveBadge active={r.isActive} /> },
  {
    id: "diberikan",
    label: "Diberikan",
    sort: "desc",
    className: "w-48",
    cell: (r) => (
      <span className="block leading-tight">
        <span className="block">{formatDate(r.grantedAt)}</span>
        <span className="block truncate text-xs text-muted-foreground">{r.grantedBy ? `oleh ${r.grantedBy.name}` : "oleh sistem / tim IT"}</span>
      </span>
    ),
  },
];

export function GrantAccessButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus /> Tambah Akses
      </Button>
      <GrantAccessDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

export function PenggunaTable({
  rows,
  total,
  page,
  size,
  chips,
  filtered,
  companyOptions,
  departmentOptions,
  locationOptions,
  currentUserId,
}: {
  rows: PenggunaRow[];
  total: number;
  page: number;
  size: number;
  chips: FilterChip[];
  filtered: boolean;
  companyOptions: FilterOption[];
  departmentOptions: FilterOption[];
  locationOptions: FilterOption[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [quick, setQuick] = useState<PenggunaRow | null>(null);
  const [roleTarget, setRoleTarget] = useState<AccessTarget | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<AccessTarget | null>(null);
  const [grantOpen, setGrantOpen] = useState(false);
  const target = (r: PenggunaRow): AccessTarget => ({ userId: r.userId, name: r.name, role: r.role });

  return (
    <ListProvider>
      <div className="space-y-3">
        <ListToolbar>
          <ListSearchInput placeholder="Cari nama, email, NRP..." searchableFields={PENGGUNA_SEARCH_FIELDS} />
          <ExcelDownloadMenu itemLabel="pengguna" filteredCount={total} countAll={countPenggunaAction} />
        </ListToolbar>
        <FilterPanel chips={chips}>
          <FilterFields>
            <FilterMultiSelect param="role" label="Role" options={ROLE_OPTIONS} />
            <FilterMultiSelect param="fungsi" label="Fungsi K3" options={FUNCTION_OPTIONS} />
            <FilterMultiSelect param="perusahaan" label="Perusahaan" options={companyOptions} />
            <FilterMultiSelect param="departemen" label="Departemen" options={departmentOptions} />
            <FilterMultiSelect param="lokasi" label="Lokasi" options={locationOptions} />
            <FilterMultiSelect param="status" label="Status akun" options={ACTIVE_OPTIONS} />
          </FilterFields>
        </FilterPanel>
        <ListPendingBar />
        <DataTable
          tableKey="pengguna"
          columns={COLUMNS}
          rows={rows}
          rowKey={(r) => r.userId}
          numberOffset={(page - 1) * size}
          onRowClick={setQuick}
          emptyText="Belum ada yang diberi akses."
          emptyAction={
            !filtered ? (
              <Button size="sm" onClick={() => setGrantOpen(true)}>
                <UserPlus /> Tambah Akses
              </Button>
            ) : undefined
          }
          filtered={filtered}
          className="min-w-[1300px]"
          actions={(r) => (
            <RowActionsMenu>
              <DropdownMenuItem onClick={() => router.push(`/pengguna/${r.userId}`)}>
                <Eye /> Lihat detail
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setRoleTarget(target(r))}>
                <KeyRound /> Ubah role
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setRevokeTarget(target(r))}>
                <UserMinus /> Cabut akses
              </DropdownMenuItem>
            </RowActionsMenu>
          )}
        />
        <TablePaginationFooter page={page} pageSize={size} total={total} itemLabel="pengguna" />
      </div>

      {quick && (
        <QuickViewDialog open onOpenChange={(o) => !o && setQuick(null)} title={quick.name} description={quick.email ?? undefined} href={`/pengguna/${quick.userId}`}>
          <div className="space-y-2">
            <InfoItem icon={ShieldCheck} label="Role" value={<RoleBadge role={quick.role} />} />
            <InfoItem icon={HardHat} label="Fungsi K3" value={quick.functions.map((f) => FUNCTION_LABELS[f]).join(", ") || "-"} />
            <InfoItem icon={Users} label="Status akun" value={<ActiveBadge active={quick.isActive} />} />
            <InfoItem icon={Building2} label="Perusahaan" value={[quick.company, quick.department].filter(Boolean).join(" · ")} />
            <InfoItem icon={Briefcase} label="Jabatan" value={quick.jobTitle} />
            <InfoItem icon={MapPin} label="Lokasi" value={quick.location} />
            <InfoItem icon={Mail} label="Email" value={quick.email} />
            <InfoItem icon={Calendar} label="Diberikan" value={`${formatDateTime(quick.grantedAt)}${quick.grantedBy ? ` oleh ${quick.grantedBy.name}` : ""}`} />
          </div>
        </QuickViewDialog>
      )}

      <GrantAccessDialog open={grantOpen} onOpenChange={setGrantOpen} />
      <ChangeRoleDialog target={roleTarget} currentUserId={currentUserId} onOpenChange={(o) => !o && setRoleTarget(null)} />
      <RevokeAccessDialog target={revokeTarget} currentUserId={currentUserId} onOpenChange={(o) => !o && setRevokeTarget(null)} />
    </ListProvider>
  );
}
