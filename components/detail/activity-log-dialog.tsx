"use client";

// Riwayat Aktivitas (frontend-guide §11.2, port ga-web activity-log-dialog). Data dimuat saat dialog
// dibuka (Server Action). Timeline: waktu WIB, badge aksi Indonesia, pelaku ("Sistem" kalau kosong),
// catatan (2 baris + Lihat selengkapnya), rincian "Label: lama → baru" (5 baris + Lihat semua).
// Label & format kolom dari FIELD_LABELS domain; kolom tidak terdaftar disembunyikan.

import { useLayoutEffect, useRef, useState, type ReactElement } from "react";
import { History, Loader2 } from "lucide-react";
import { StatusBadge } from "@/components/detail/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { UserProfileCard } from "@/components/user/user-profile-card";
import { loadActivityLogAction } from "@/lib/actions/common";
import { formatDate, formatDateTime, formatNumber, formatRupiah } from "@/lib/format";
import type { FieldLabel, LogEntry } from "@/lib/person-types";
import { ACTION_COLORS, ACTION_LABELS } from "@/lib/status";
import { cn } from "@/lib/utils";

const VISIBLE = 5;
const MAX_TEXT = 120;

function fmt(v: unknown, f: FieldLabel | undefined, people: Record<string, string>): string {
  if (v === null || v === undefined || v === "") return "(kosong)";
  // elemen array: format "status" tetap dipakai (mis. daftar fungsi K3), selain itu teks
  if (Array.isArray(v))
    return v.length ? v.map((x) => fmt(x, { ...f, format: f?.format === "status" ? "status" : "text" } as FieldLabel, people)).join("; ") : "(kosong)";
  switch (f?.format) {
    case "rupiah":
      return formatRupiah(Number(v));
    case "number":
      return formatNumber(Number(v));
    case "date":
      return formatDate(String(v));
    case "datetime":
      return formatDateTime(String(v));
    case "person":
      return people[String(v)] ?? "Pengguna lain";
    case "status":
      return f.statuses?.[String(v)]?.label ?? String(v);
    case "boolean":
      return v ? "Ya" : "Tidak";
  }
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  const named = people[s] ?? s;
  return named.length > MAX_TEXT ? `${named.slice(0, MAX_TEXT)}…` : named;
}

type Change = { label: string; from?: string; to?: string };

function toChanges(entry: LogEntry, labels: Record<string, FieldLabel>, people: Record<string, string>): Change[] {
  const c = entry.changes;
  if (!c || entry.action === "delete") return [];
  return Object.entries(c)
    .filter(([k]) => labels[k])
    .map(([k, v]) => {
      const f = labels[k];
      if (v && typeof v === "object" && !Array.isArray(v) && ("old" in v || "new" in v)) {
        const o = v as { old?: unknown; new?: unknown };
        return { label: f.label, from: o.old === null || o.old === undefined ? undefined : fmt(o.old, f, people), to: fmt(o.new, f, people) };
      }
      return { label: f.label, to: fmt(v, f, people) };
    });
}

function Changes({ changes }: { changes: Change[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? changes : changes.slice(0, VISIBLE);
  return (
    <div className="mt-1.5 rounded-md border bg-muted/40 p-2">
      <ul className="space-y-1 text-[11px]">
        {shown.map((c, i) => (
          <li key={i} className="break-words">
            <span className="font-medium">{c.label}</span>
            <span className="text-muted-foreground">: {c.from !== undefined ? `${c.from} → ${c.to}` : c.to}</span>
          </li>
        ))}
      </ul>
      {changes.length > VISIBLE && (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-1 text-[11px] font-medium text-primary hover:underline">
          {all ? "Sembunyikan" : `Lihat semua (${changes.length})`}
        </button>
      )}
    </div>
  );
}

function Note({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [overflow, setOverflow] = useState(false);
  const [open, setOpen] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el) setOverflow(el.scrollHeight > el.clientHeight + 1);
  }, [text]);
  return (
    <div>
      <p ref={ref} className={cn("text-xs whitespace-pre-wrap text-foreground/90", !open && "line-clamp-2")}>
        {text}
      </p>
      {(overflow || open) && (
        <button type="button" onClick={() => setOpen((v) => !v)} className="text-[11px] font-medium text-primary hover:underline">
          {open ? "Sembunyikan" : "Lihat selengkapnya"}
        </button>
      )}
    </div>
  );
}

export function ActivityLogDialog({
  entity,
  recordId,
  fieldLabels,
  trigger,
}: {
  /** nama tabel dokumen (punya <entity>_logs, terdaftar di LOG_ENTITIES) */
  entity: string;
  recordId: string;
  fieldLabels: Record<string, FieldLabel>;
  trigger?: ReactElement;
}) {
  const [state, setState] = useState<{ loading: boolean; error?: string; entries: LogEntry[]; people: Record<string, string> }>({
    loading: false,
    entries: [],
    people: {},
  });

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) return;
        setState((s) => ({ ...s, loading: true, error: undefined }));
        loadActivityLogAction(entity, recordId).then((r) =>
          setState("error" in r ? { loading: false, error: r.error, entries: [], people: {} } : { loading: false, entries: r.entries, people: r.people }),
        );
      }}
    >
      <DialogTrigger
        render={
          trigger ?? (
            <Button variant="outline" size="sm">
              <History /> Riwayat Aktivitas
            </Button>
          )
        }
      />
      <DialogContent className="flex max-h-[80vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Riwayat Aktivitas</DialogTitle>
          <DialogDescription>Siapa mengubah apa, kapan, dari berapa menjadi berapa.</DialogDescription>
        </DialogHeader>
        <div className="-mx-5 min-h-0 flex-1 overflow-y-auto px-5">
          {state.loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : state.error ? (
            <p className="py-8 text-center text-sm text-destructive">{state.error}</p>
          ) : state.entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Belum ada riwayat aktivitas.</p>
          ) : (
            <ol className="pb-2">
              {state.entries.map((e, i) => {
                const changes = toChanges(e, fieldLabels, state.people);
                return (
                  <li key={e.id} className="relative flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                      {i !== state.entries.length - 1 && <span className="w-px flex-1 bg-border" />}
                    </div>
                    <div className="min-w-0 flex-1 pb-4">
                      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
                        <span className="text-[11px] font-medium text-muted-foreground">{formatDateTime(e.at)}</span>
                        <StatusBadge
                          value={e.action}
                          map={Object.fromEntries(Object.keys(ACTION_LABELS).map((k) => [k, { label: ACTION_LABELS[k], color: ACTION_COLORS[k] ?? "gray" }]))}
                          className="px-1.5 py-0 text-[10px]"
                        />
                      </div>
                      <div className="mt-1 text-xs font-semibold">
                        {e.actor ? <UserProfileCard userId={e.actor.id} name={e.actor.name} avatarUrl={e.actor.avatarUrl} size="xs" /> : "Sistem"}
                      </div>
                      {e.note && (
                        <div className="mt-1">
                          <Note text={e.note} />
                        </div>
                      )}
                      {changes.length > 0 && <Changes changes={changes} />}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
