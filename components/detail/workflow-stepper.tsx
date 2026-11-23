import { CheckIcon, CornerUpLeft, MinusIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Stepper workflow jenis B (rancangan §2.3): langkah disusun SERVER (status + log), komponen hanya
// menampilkan. HP = vertikal, md+ = horizontal. Status tidak dibedakan warna saja: setiap langkah
// punya ikon + teks keadaan (sr-only di horizontal, terlihat di vertikal).

export type WorkflowStepState = "done" | "current" | "returned" | "pending" | "skipped";

export type WorkflowStep = {
  key: string;
  label: string;
  /** Teks kecil: pelaku, tanggal, catatan singkat */
  meta?: string;
  state: WorkflowStepState;
};

const STATE_TEXT: Record<WorkflowStepState, string> = {
  done: "Selesai",
  current: "Tahap saat ini",
  returned: "Dikembalikan",
  pending: "Belum",
  skipped: "Dilewati",
};

const DOT: Record<WorkflowStepState, string> = {
  done: "bg-green-600 border-green-600 text-white dark:bg-green-500 dark:border-green-500",
  current: "bg-primary border-primary text-primary-foreground ring-4 ring-primary/15",
  returned: "bg-background border-amber-500 text-amber-700 dark:text-amber-300",
  pending: "bg-background border-muted-foreground/30 text-muted-foreground",
  skipped: "bg-muted border-dashed border-muted-foreground/40 text-muted-foreground",
};

function Dot({ step, n }: { step: WorkflowStep; n: number }) {
  return (
    <span
      className={cn("flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold", DOT[step.state])}
      aria-hidden
    >
      {step.state === "done" ? (
        <CheckIcon className="size-4" />
      ) : step.state === "returned" ? (
        <CornerUpLeft className="size-3.5" />
      ) : step.state === "skipped" ? (
        <MinusIcon className="size-3.5" />
      ) : (
        n
      )}
    </span>
  );
}

export function WorkflowStepper({ steps, className, label = "Tahapan proses" }: { steps: WorkflowStep[]; className?: string; label?: string }) {
  return (
    <ol aria-label={label} className={cn("flex flex-col gap-0 md:flex-row md:items-start", className)}>
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        return (
          <li
            key={s.key}
            aria-current={s.state === "current" ? "step" : undefined}
            className={cn("relative flex gap-3 pb-4 md:flex-1 md:flex-col md:items-center md:gap-1.5 md:pb-0 md:text-center", last && "pb-0 md:flex-none")}
          >
            {/* garis penghubung: vertikal di HP, horizontal di md+ */}
            {!last && (
              <span
                aria-hidden
                className={cn(
                  "absolute top-7 bottom-0 left-3.5 w-0.5 -translate-x-1/2 md:top-3.5 md:right-0 md:bottom-auto md:left-1/2 md:h-0.5 md:w-full md:translate-x-3.5",
                  s.state === "done" ? "bg-green-600 dark:bg-green-500" : "bg-muted-foreground/20",
                )}
              />
            )}
            <Dot step={s} n={i + 1} />
            <div className="min-w-0 md:max-w-32 md:px-1">
              <p className={cn("text-sm leading-tight md:text-xs", s.state === "current" ? "font-semibold" : "font-medium", s.state === "pending" && "text-muted-foreground")}>
                {s.label}
              </p>
              <p className="text-xs text-muted-foreground md:sr-only">{STATE_TEXT[s.state]}</p>
              {s.meta && <p className="mt-0.5 text-xs leading-tight text-muted-foreground">{s.meta}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
