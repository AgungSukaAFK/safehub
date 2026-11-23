// Primitif Dokumentasi (port ga-web dokumentasi/primitives): chip peran, transisi status (StatusBadge
// yang SAMA dengan app), dan renderer mock UI dari data `StepVisual` (lib/docs/types.ts).
import { ArrowRight, Bell, Check, X } from "lucide-react";
import { StatusBadge } from "@/components/detail/status-badge";
import type { DocRole, MockBlock, StatusMapKey, StepVisual } from "@/lib/docs/types";
import { FEEDBACK_STATUS } from "@/lib/feedback-rules";
import { INCIDENT_STATUS } from "@/lib/kejadian-rules";
import { ACTION_STATUS } from "@/lib/pica-rules";
import { APPROVAL_STEP_STATUS, DOCUMENT_STATUS, type StatusDef } from "@/lib/status";
import { SUPPORT_STATUS } from "@/lib/support-types";
import { cn } from "@/lib/utils";

export const STATUS_MAPS: Record<StatusMapKey, Record<string, StatusDef>> = {
  document: DOCUMENT_STATUS,
  approval: APPROVAL_STEP_STATUS,
  support: SUPPORT_STATUS,
  feedback: FEEDBACK_STATUS,
  incident: INCIDENT_STATUS,
  action: ACTION_STATUS,
};

export function RoleChip({ role, className }: { role: DocRole | undefined; className?: string }) {
  if (!role) return null;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap", role.color, className)}>
      <role.icon className="size-3" /> {role.label}
    </span>
  );
}

/** "Status A → Status B"; status tujuan muncul dengan animasi pop. */
export function StatusTransition({ map, from, to }: { map: StatusMapKey; from?: string; to: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {from && (
        <>
          <StatusBadge value={from} map={STATUS_MAPS[map]} className="opacity-60" />
          <ArrowRight className="size-4 text-muted-foreground" />
        </>
      )}
      <span className="docs-pop" style={{ animationDelay: "0.35s" }}>
        <StatusBadge value={to} map={STATUS_MAPS[map]} tone={map === "document" ? "solid" : "soft"} />
      </span>
    </div>
  );
}

function Block({ b, delay }: { b: MockBlock; delay: number }) {
  const style = { animationDelay: `${delay}s` };
  switch (b.kind) {
    case "field":
      return (
        <div className="docs-fade-up space-y-1" style={style}>
          <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">{b.label}</p>
          <div className={cn("rounded-md border bg-card px-2.5 py-1.5", b.highlight && "border-primary ring-2 ring-primary/20")}>{b.value}</div>
        </div>
      );
    case "row":
      return (
        <div className={cn("docs-fade-up flex items-center gap-2 rounded-md border bg-card px-2.5 py-2", b.highlight && "border-primary ring-2 ring-primary/20")} style={style}>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{b.title}</p>
            {b.sub && <p className="truncate text-[11px] text-muted-foreground">{b.sub}</p>}
          </div>
          {b.status && <StatusBadge value={b.status.value} map={STATUS_MAPS[b.status.map]} />}
        </div>
      );
    case "buttons":
      return (
        <div className="flex flex-wrap justify-end gap-2">
          {b.items.map((it, i) => (
            <span
              key={it.label}
              className={cn(
                "docs-fade-up inline-flex items-center rounded-md px-2.5 py-1.5 text-[11px] font-semibold",
                (it.variant ?? "primary") === "primary" && "bg-primary text-primary-foreground",
                it.variant === "outline" && "border bg-background",
                it.variant === "danger" && "bg-destructive text-white",
                it.pulse && "docs-ring",
              )}
              style={{ animationDelay: `${delay + i * 0.08}s` }}
            >
              {it.label}
            </span>
          ))}
        </div>
      );
    case "note":
      return (
        <p
          className={cn(
            "docs-fade-up rounded-md border px-2.5 py-1.5 text-[11px]",
            b.tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
            b.tone === "warning" && "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
            (!b.tone || b.tone === "info") && "border-dashed bg-muted/40 text-muted-foreground",
          )}
          style={style}
        >
          {b.text}
        </p>
      );
    case "notification":
      return (
        <div className="docs-pop flex gap-2 rounded-lg border bg-popover p-2.5 shadow-md" style={style}>
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Bell className="size-3.5" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold">{b.title}</p>
            <p className="truncate text-[11px] text-muted-foreground">{b.body}</p>
          </div>
        </div>
      );
    case "chat":
      return (
        <div className={cn("docs-fade-up flex", b.mine && "justify-end")} style={style}>
          <div className={cn("max-w-[80%] rounded-2xl px-3 py-1.5", b.mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted")}>
            {b.name && <p className="text-[10px] opacity-70">{b.name}</p>}
            {b.text}
          </div>
        </div>
      );
    case "path":
      return (
        <ol className="docs-fade-up flex items-center gap-1.5" style={style}>
          {b.items.map((it, i) => (
            <li key={it.label} className="flex min-w-0 items-center gap-1.5">
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border-2 text-[9px]",
                  it.state === "done" && "border-emerald-500 bg-emerald-500 text-white",
                  it.state === "current" && "docs-ring border-amber-500 bg-background text-amber-600",
                  it.state === "rejected" && "border-red-500 bg-red-500 text-white",
                  it.state === "todo" && "border-border bg-background text-muted-foreground",
                )}
              >
                {it.state === "done" ? <Check className="size-3" /> : it.state === "rejected" ? <X className="size-3" /> : i + 1}
              </span>
              <span className={cn("truncate text-[11px]", it.state === "current" ? "font-semibold" : "text-muted-foreground")}>{it.label}</span>
              {i < b.items.length - 1 && <span className="h-px w-4 shrink-0 bg-border" aria-hidden />}
            </li>
          ))}
        </ol>
      );
  }
}

/** Bingkai "jendela aplikasi" + isi mock dari data. Dekoratif (aria-hidden); teksnya ada di panduan. */
export function StepVisualView({ visual }: { visual: StepVisual }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-background shadow-sm" aria-hidden>
      <div className="flex items-center gap-1.5 border-b bg-muted/60 px-3 py-2">
        <span className="size-2.5 rounded-full bg-red-400/80" />
        <span className="size-2.5 rounded-full bg-yellow-400/80" />
        <span className="size-2.5 rounded-full bg-green-400/80" />
        <span className="ml-2 truncate text-[11px] font-medium text-muted-foreground">{visual.window}</span>
      </div>
      <div className="space-y-3 p-4 text-xs">
        {visual.blocks.map((b, i) => (
          <Block key={i} b={b} delay={0.1 + i * 0.12} />
        ))}
      </div>
    </div>
  );
}
