import { CheckIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepChainItem = {
  key: string;
  label: string;
  state: "done" | "current" | "rejected" | "pending";
  /** Teks kecil tebal di bawah label (nominal, nama PIC) */
  detail?: string;
  href?: string;
};

const DOT: Record<StepChainItem["state"], string> = {
  done: "bg-green-600 border-green-600 text-white dark:bg-green-500 dark:border-green-500",
  current: "bg-orange-500 border-orange-500 text-white",
  rejected: "bg-red-600 border-red-600 text-white dark:bg-red-500 dark:border-red-500",
  pending: "bg-muted border-muted-foreground/30 text-muted-foreground",
};

/** Rantai proses horizontal (port taste-ui §9.3). */
export function StepChain({ steps }: { steps: StepChainItem[] }) {
  return (
    <div className="flex items-start" role="list" aria-label="Tahapan proses">
      {steps.map((s, i) => (
        <div key={s.key} role="listitem" className="flex flex-1 items-start last:flex-none">
          <div className="flex flex-col items-center gap-1">
            <div
              className={cn("flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-bold", DOT[s.state])}
              title={s.label}
              aria-current={s.state === "current" ? "step" : undefined}
            >
              {s.state === "done" ? <CheckIcon className="size-3.5" /> : s.state === "rejected" ? <XIcon className="size-3.5" /> : i + 1}
            </div>
            <span className="max-w-20 text-center text-[10px] leading-tight text-muted-foreground">
              {s.href ? (
                <a href={s.href} className="underline-offset-2 hover:underline">
                  {s.label}
                </a>
              ) : (
                s.label
              )}
              {s.detail && (
                <>
                  <br />
                  <span className="font-medium text-foreground">{s.detail}</span>
                </>
              )}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={cn("mt-3 h-0.5 flex-1", s.state === "done" ? "bg-green-600 dark:bg-green-500" : "bg-muted-foreground/20")} />
          )}
        </div>
      ))}
    </div>
  );
}
