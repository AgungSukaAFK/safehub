"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowRight, ClipboardCheck } from "lucide-react";
import { StatusBadge } from "@/components/detail/status-badge";
import { Content } from "@/components/list/content";
import { useApp } from "@/components/providers/app-context";
import { buttonVariants } from "@/components/ui/button";
import { useNow } from "@/hooks/use-now";
import { formatDate } from "@/lib/format";
import { TASK_KIND_LABEL, TASK_STATUS_MAP } from "@/lib/task-labels";
import type { TaskItem } from "@/lib/tasks";
import { cn } from "@/lib/utils";

/** Badge menu Tugas Saya mengikuti data server terbaru (sama dengan my_tasks di layout). */
export function TasksBadgeSync({ total }: { total: number }) {
  const { setBadge } = useApp();
  useEffect(() => setBadge("tasks", total), [total, setBadge]);
  return null;
}

export function TasksEmpty() {
  return (
    <Content>
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <ClipboardCheck className="size-9 text-muted-foreground opacity-60" />
        <p className="font-medium">Tidak ada tugas untuk Anda.</p>
        <p className="text-sm text-muted-foreground">Tugas baru (tindakan, verifikasi, persetujuan) akan muncul di sini dan di notifikasi.</p>
      </div>
    </Content>
  );
}

/** Daftar tugas workflow (Perlu Tindakan / Menunggu Verifikasi / Terjadwal). */
export function TaskList({ title, description, items }: { title: string; description: string; items: TaskItem[] }) {
  const now = useNow();
  if (!items.length) return null;
  return (
    <Content title={`${title} (${items.length})`} description={description}>
      <ul className="divide-y rounded-lg border">
        {items.map((t) => {
          const due = t.dueAt ? new Date(t.dueAt).getTime() : null;
          const overdue = !!now && due !== null && due < now;
          return (
            <li key={`${t.kind}:${t.refId}`} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  {t.code && (
                    <Link href={t.href} className="font-mono text-sm font-semibold text-primary hover:underline">
                      {t.code}
                    </Link>
                  )}
                  {TASK_STATUS_MAP[t.refType] ? (
                    <StatusBadge value={t.status} map={TASK_STATUS_MAP[t.refType]} />
                  ) : (
                    <span className="rounded border px-1.5 py-0.5 text-[11px] font-medium">{t.status}</span>
                  )}
                  {TASK_KIND_LABEL[t.kind] && <span className="text-xs text-muted-foreground">{TASK_KIND_LABEL[t.kind]}</span>}
                </div>
                <p className="truncate text-sm font-medium" title={t.title}>
                  {t.title}
                </p>
                {t.dueAt && (
                  <p className={cn("text-xs text-muted-foreground", overdue && "font-medium text-red-600 dark:text-red-400")}>
                    {overdue ? "Terlambat · " : "Batas "}
                    {formatDate(t.dueAt)}
                  </p>
                )}
              </div>
              <Link href={t.href} className={cn(buttonVariants({ size: "sm" }), "w-full sm:w-auto")}>
                Buka <ArrowRight />
              </Link>
            </li>
          );
        })}
      </ul>
    </Content>
  );
}
