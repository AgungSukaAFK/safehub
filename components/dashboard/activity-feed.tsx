"use client";

// Feed aktivitas Beranda (frontend-guide §17.3): gabungan <entitas>_logs (RPC activity_feed, ikut
// RLS), chip filter jenis aksi, "Muat lebih banyak" dengan kursor waktu.
import { TimeAgo } from "@/components/time-ago";
import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { StatusBadge } from "@/components/detail/status-badge";
import { Button } from "@/components/ui/button";
import { UserProfileCard } from "@/components/user/user-profile-card";
import { loadFeedAction } from "@/app/(app)/dashboard-actions";
import type { FeedItem } from "@/lib/dashboard-types";
import { formatDateTime } from "@/lib/format";
import { ACTION_COLORS, ACTION_LABELS } from "@/lib/status";
import { cn } from "@/lib/utils";

const ACTION_MAP = Object.fromEntries(Object.entries(ACTION_LABELS).map(([k, label]) => [k, { label, color: ACTION_COLORS[k] ?? "gray" }]));

const CHIPS: { key: string; label: string; actions: string[] | null }[] = [
  { key: "semua", label: "Semua", actions: null },
  { key: "ajukan", label: "Diajukan / Dilaporkan", actions: ["submit", "followup", "report", "schedule", "submit_review", "submit_evidence"] },
  { key: "putus", label: "Diputuskan", actions: ["approve", "reject", "override", "approve_ehs", "approve_mgmt", "accept", "return", "verify", "close", "close_exception"] },
  { key: "ubah", label: "Dibuat / Diubah", actions: ["create", "update", "admin_edit", "cancel", "delete", "classify", "start", "start_investigation", "save_investigation", "change_due", "effectiveness"] },
];

export function ActivityFeed({ initial, pageSize }: { initial: FeedItem[]; pageSize: number }) {
  const [items, setItems] = useState(initial);
  const [more, setMore] = useState(initial.length >= pageSize);
  const [loading, setLoading] = useState(false);
  const [chip, setChip] = useState("semua");
  const active = CHIPS.find((c) => c.key === chip)!;
  const shown = active.actions ? items.filter((i) => active.actions!.includes(i.action)) : items;

  const loadMore = async () => {
    setLoading(true);
    const next = await loadFeedAction(items[items.length - 1].at);
    setItems((prev) => [...prev, ...next.filter((n) => !prev.some((p) => p.id === n.id && p.entity === n.entity))]);
    setMore(next.length >= 15);
    setLoading(false);
  };

  return (
    <div className="space-y-3">
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label="Jenis aktivitas">
        {CHIPS.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setChip(c.key)}
            aria-pressed={chip === c.key}
            className={cn(
              "inline-flex h-7 shrink-0 items-center rounded-full border px-2.5 text-xs font-medium whitespace-nowrap",
              chip === c.key ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{items.length ? "Tidak ada aktivitas jenis ini di daftar yang dimuat." : "Belum ada aktivitas."}</p>
      ) : (
        <ol className="space-y-3">
          {shown.map((i) => (
            <li key={`${i.entity}-${i.id}`} className="flex gap-3 text-sm">
              <UserProfileCard userId={i.actor?.id ?? null} name={i.actor?.name ?? "Sistem"} avatarUrl={i.actor?.avatarUrl} showName={false} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="leading-snug">
                  <span className="font-medium">{i.actor?.name ?? "Sistem"}</span>{" "}
                  <StatusBadge value={i.action} map={ACTION_MAP} className="mx-0.5 align-middle" />{" "}
                  <Link href={i.href} className="font-medium text-primary hover:underline">
                    {i.label}
                  </Link>
                </p>
                {i.note && <p className="line-clamp-2 text-xs text-muted-foreground">{i.note}</p>}
                <p className="text-xs text-muted-foreground" title={formatDateTime(i.at)}>
                  <TimeAgo at={i.at} />
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
      {more && items.length > 0 && (
        <Button variant="outline" size="sm" className="w-full" onClick={loadMore} disabled={loading}>
          {loading && <Loader2 className="animate-spin" />} Muat lebih banyak
        </Button>
      )}
    </div>
  );
}
