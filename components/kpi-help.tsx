"use client";

import { CircleHelp } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { KPI_STATUS, STATUS_CLASSES } from "@/lib/status";
import { cn } from "@/lib/utils";

// Definisi KPI di setiap kartu (rancangan §2.8). Data datang dari Kamus KPI (kpi_definitions,
// fase 2), tidak di-hardcode di kartu. Status `draft` selalu menampilkan "Rumus belum disahkan".

export type KpiDefinition = {
  code: string;
  name: string;
  definition: string;
  formula: string;
  source: string | null;
  owner: string | null;
  unit: string | null;
  status: "draft" | "approved";
  version?: string | null;
};

export function KpiStatusBadge({ status, className }: { status: KpiDefinition["status"]; className?: string }) {
  if (status === "approved") return null;
  const def = KPI_STATUS.draft;
  return (
    <span className={cn("inline-flex w-fit items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium", STATUS_CLASSES[def.color].soft, className)}>
      <CircleHelp className="size-3" aria-hidden /> {def.label}
    </span>
  );
}

export function KpiHelp({ kpi, className }: { kpi: KpiDefinition; className?: string }) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={`Definisi ${kpi.name}`}
            className={cn("inline-flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground", className)}
          />
        }
      >
        <CircleHelp className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(22rem,calc(100vw-1rem))] gap-3 text-sm">
        <div className="space-y-1">
          <p className="font-semibold">
            {kpi.name} <span className="font-mono text-xs font-normal text-muted-foreground">{kpi.code}</span>
          </p>
          <KpiStatusBadge status={kpi.status} />
        </div>
        <p>{kpi.definition}</p>
        <div className="rounded-md bg-muted/60 p-2 font-mono text-xs leading-relaxed break-words">{kpi.formula}</div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          {kpi.unit && (
            <>
              <dt className="text-muted-foreground">Satuan</dt>
              <dd>{kpi.unit}</dd>
            </>
          )}
          <dt className="text-muted-foreground">Sumber</dt>
          <dd>{kpi.source ?? "-"}</dd>
          <dt className="text-muted-foreground">Pemilik</dt>
          <dd>{kpi.owner ?? "-"}</dd>
          {kpi.version && (
            <>
              <dt className="text-muted-foreground">Versi</dt>
              <dd>{kpi.version}</dd>
            </>
          )}
        </dl>
      </PopoverContent>
    </Popover>
  );
}
