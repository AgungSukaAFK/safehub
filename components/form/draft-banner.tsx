"use client";

import { useEffect, useState } from "react";
import { History, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/format";
import type { PendingDraft } from "@/lib/offline/use-form-draft";

/** "Ada draft dari 10 menit lalu. [Pulihkan] [Buang]" (frontend-guide §22.4). */
export function DraftBanner<T>({
  draft,
  onRestore,
  onDiscard,
}: {
  draft: PendingDraft<T> | null;
  onRestore: () => void;
  onDiscard: () => void;
}) {
  if (!draft) return null;
  return (
    <div className="col-span-12 flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm sm:flex-row sm:items-center dark:border-amber-900 dark:bg-amber-950/40">
      <History className="size-5 shrink-0 text-amber-700 dark:text-amber-300" />
      <div className="min-w-0 flex-1 text-amber-900 dark:text-amber-100">
        <p className="font-medium">Ada draft dari {timeAgo(draft.savedAt)}.</p>
        {draft.stale && <p className="text-xs">Draft ini dibuat dari versi dokumen yang lebih lama. Periksa lagi setelah dipulihkan.</p>}
        {!!draft.fileNames?.length && <p className="text-xs">Lampiran tidak ikut tersimpan; lampirkan ulang: {draft.fileNames.join(", ")}.</p>}
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={onRestore}>
          Pulihkan
        </Button>
        <Button size="sm" variant="outline" onClick={onDiscard}>
          <Trash2 /> Buang
        </Button>
      </div>
    </div>
  );
}

/** Teks kecil "Draft tersimpan · baru saja" untuk bar submit; diperbarui tiap 30 detik. */
export function DraftStatus({ savedAt }: { savedAt: number | null }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!savedAt) return;
    const t = window.setInterval(() => tick((n) => n + 1), 30_000);
    return () => window.clearInterval(t);
  }, [savedAt]);
  if (!savedAt) return null;
  return <span>Draft tersimpan · {timeAgo(savedAt)}</span>;
}
