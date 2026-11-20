"use client";

// Kelola Feedback (frontend-guide §20.4): list standar + dialog detail (isi, lampiran, konteks),
// ubah status + catatan internal (notify pelapor), tombol WhatsApp ke pelapor.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, FileText, Info, Loader2, MessageCircle, Paperclip, Tag, Trash2, User } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { InfoItem } from "@/components/detail/info-item";
import { StatusBadge } from "@/components/detail/status-badge";
import { DataTable, type Column } from "@/components/list/data-table";
import { FilterFields, FilterMultiSelect, FilterPanel, type FilterChip } from "@/components/list/filter-panel";
import { ListPendingBar, ListProvider } from "@/components/list/list-context";
import { ListSearchInput } from "@/components/list/list-search-input";
import { ListToolbar } from "@/components/list/list-toolbar";
import { TablePaginationFooter } from "@/components/list/table-pagination-footer";
import { RichTextView } from "@/components/rich-text/rich-text-view";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UserProfileCard } from "@/components/user/user-profile-card";
import { CONTEXT_LABELS } from "@/lib/client-context";
import type { FeedbackDetail, FeedbackRow } from "@/lib/feedback";
import { FEEDBACK_CATEGORIES, FEEDBACK_STATUS, FEEDBACK_STATUSES, feedbackCategoryLabel } from "@/lib/feedback-rules";
import { formatDate, formatDateTime } from "@/lib/format";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { deleteFeedbackAction, getFeedbackDetailAction, setFeedbackStatusAction } from "../actions";

const COLUMNS: Column<FeedbackRow>[] = [
  { id: "tanggal", label: "Masuk", sort: "desc", className: "w-28", cell: (r) => formatDate(r.createdAt) },
  {
    id: "pelapor",
    label: "Pelapor",
    className: "w-52",
    cell: (r) => (r.reporter ? <UserProfileCard userId={r.reporter.id} name={r.reporter.name} avatarUrl={r.reporter.avatarUrl} size="xs" /> : "-"),
  },
  { id: "kategori", label: "Kategori", className: "w-40", cell: (r) => feedbackCategoryLabel(r.category, r.categoryOther) },
  {
    id: "isi",
    label: "Isi",
    cell: (r) => (
      <span className="flex max-w-[420px] items-center gap-1.5">
        <span className="truncate" title={r.text}>
          {r.text}
        </span>
        {r.files > 0 && (
          <span className="inline-flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground">
            <Paperclip className="size-3" />
            {r.files}
          </span>
        )}
      </span>
    ),
  },
  { id: "status", label: "Status", sort: "asc", className: "w-28", cell: (r) => <StatusBadge value={r.status} map={FEEDBACK_STATUS} /> },
];

const waNumber = (phone: string) => {
  const d = phone.replace(/\D/g, "");
  return d.startsWith("0") ? `62${d.slice(1)}` : d;
};

export function FeedbackAdmin({
  rows,
  total,
  page,
  size,
  chips,
  filtered,
  openId,
}: {
  rows: FeedbackRow[];
  total: number;
  page: number;
  size: number;
  chips: FilterChip[];
  filtered: boolean;
  /** dari notifikasi (?id=) → dialog langsung terbuka */
  openId: string | null;
}) {
  const [open, setOpen] = useState<string | null>(openId);
  return (
    <ListProvider>
      <div className="space-y-3">
        <ListToolbar>
          <ListSearchInput placeholder="Cari isi feedback..." searchableFields={["Isi feedback"]} />
        </ListToolbar>
        <FilterPanel chips={chips}>
          <FilterFields>
            <FilterMultiSelect param="status" label="Status" options={FEEDBACK_STATUSES.map((s) => ({ value: s, label: FEEDBACK_STATUS[s].label }))} />
            <FilterMultiSelect param="kategori" label="Kategori" options={FEEDBACK_CATEGORIES.map((c) => ({ value: c.value, label: c.label }))} />
          </FilterFields>
        </FilterPanel>
        <ListPendingBar />
        <DataTable
          tableKey="feedback"
          columns={COLUMNS}
          rows={rows}
          rowKey={(r) => r.id}
          numberOffset={(page - 1) * size}
          onRowClick={(r) => setOpen(r.id)}
          emptyText="Belum ada feedback."
          filtered={filtered}
          className="min-w-[900px]"
        />
        <TablePaginationFooter page={page} pageSize={size} total={total} itemLabel="feedback" />
      </div>
      {open && <FeedbackDialog id={open} onClose={() => setOpen(null)} />}
    </ListProvider>
  );
}

function FeedbackDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const router = useRouter();
  const [d, setD] = useState<FeedbackDetail | null | undefined>(undefined);
  const [status, setStatus] = useState("baru");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let alive = true;
    void getFeedbackDetailAction(id).then((r) => {
      if (!alive) return;
      setD(r);
      if (r) {
        setStatus(r.status);
        setNote(r.adminNote ?? "");
      }
    });
    return () => {
      alive = false;
    };
  }, [id]);

  const save = async () => {
    setSaving(true);
    const res = await setFeedbackStatusAction(id, status, note);
    setSaving(false);
    if (res.status !== "ok") return toast.error(res.message);
    toast.success(res.message);
    onClose();
    router.refresh();
  };

  const changed = d && (status !== d.status || note !== (d.adminNote ?? ""));

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{d ? feedbackCategoryLabel(d.category, d.categoryOther) : "Feedback"}</DialogTitle>
          <DialogDescription>{d ? `Dari ${d.reporter?.name ?? "pengguna"} · ${formatDateTime(d.createdAt)}` : "Memuat..."}</DialogDescription>
        </DialogHeader>
        {d === undefined ? (
          <p className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Memuat...
          </p>
        ) : d === null ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Feedback tidak ditemukan atau sudah dihapus.</p>
        ) : (
          <div className="space-y-5">
            <div className="rounded-lg border p-4">
              <RichTextView doc={d.content} />
            </div>
            {d.files.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {d.files.map((f) =>
                  f.url && /\.(png|jpe?g|webp|gif)$/i.test(f.name) ? (
                    <a key={f.path} href={f.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-md border" title={f.name}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- signed URL */}
                      <img src={f.url} alt={f.name} className="h-28 w-auto object-cover" />
                    </a>
                  ) : (
                    <a key={f.path} href={f.url ?? undefined} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
                      <FileText /> {f.name}
                    </a>
                  ),
                )}
              </div>
            )}
            <div className="grid gap-2.5 sm:grid-cols-2">
              <InfoItem icon={User} label="Pelapor" value={d.reporter?.name} />
              <InfoItem icon={Tag} label="Kategori" value={feedbackCategoryLabel(d.category, d.categoryOther)} />
              <InfoItem icon={Calendar} label="Masuk" value={formatDateTime(d.createdAt)} />
              <InfoItem icon={Info} label="Ditangani" value={d.handledBy} />
            </div>
            {d.context && (
              <details className="rounded-md border bg-muted/40 px-3 py-2 text-xs">
                <summary className="cursor-pointer text-muted-foreground">Info perangkat & halaman</summary>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  {Object.entries(d.context).map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="text-muted-foreground">{CONTEXT_LABELS[k as keyof typeof CONTEXT_LABELS] ?? k}</dt>
                      <dd className="break-all">{v ?? "-"}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            )}
            <div className="space-y-3 rounded-lg border p-4">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Status feedback">
                  {FEEDBACK_STATUSES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={status === s}
                      onClick={() => setStatus(s)}
                      className={cn("rounded-md border px-3 py-1.5 text-sm", status === s ? "border-primary bg-primary/10 font-medium" : "hover:bg-muted")}
                    >
                      {FEEDBACK_STATUS[s].label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fb-note">Catatan internal</Label>
                <Textarea id="fb-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} rows={3} placeholder="Hanya terlihat oleh admin app." />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-2">
                  {d.reporter?.phone && (
                    <a href={`https://wa.me/${waNumber(d.reporter.phone)}`} target="_blank" rel="noopener noreferrer" data-pwa-new-window className={buttonVariants({ variant: "outline", size: "sm" })}>
                      <MessageCircle /> WhatsApp pelapor
                    </a>
                  )}
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>
                    <Trash2 /> Hapus
                  </Button>
                </div>
                <Button onClick={save} disabled={!changed || saving}>
                  {saving && <Loader2 className="animate-spin" />} Simpan
                </Button>
              </div>
              {status !== d.status && <p className="text-xs text-muted-foreground">Pelapor mendapat notifikasi perubahan status.</p>}
            </div>
          </div>
        )}
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Hapus feedback ini?"
          description="Feedback dihapus permanen."
          confirmText="Hapus"
          destructive
          onConfirm={async () => {
            const res = await deleteFeedbackAction(id);
            if (res.status !== "ok") {
              toast.error(res.message);
              throw new Error(res.message);
            }
            toast.success(res.message);
            onClose();
            router.refresh();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
