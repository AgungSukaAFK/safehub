import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Baris info di halaman detail (port taste-ui §9.1): ikon + label abu (1/3) | nilai tebal (2/3). */
export function InfoItem({
  icon: Icon,
  label,
  value,
  isBlock = false,
}: {
  icon: ElementType;
  label: string;
  value: ReactNode;
  /** Label di atas nilai (teks panjang) */
  isBlock?: boolean;
}) {
  return (
    <div className={cn(isBlock ? "flex flex-col gap-1" : "grid grid-cols-[minmax(6.5rem,1fr)_2fr] items-start gap-x-3")}>
      <div className="mt-0.5 flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4 shrink-0" />
        {label}
      </div>
      <div className="min-w-0 text-sm font-semibold whitespace-pre-wrap [overflow-wrap:anywhere]">
        {value === null || value === undefined || value === "" ? "-" : value}
      </div>
    </div>
  );
}
