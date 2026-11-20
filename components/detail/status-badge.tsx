import { resolveStatus, STATUS_CLASSES, type StatusDef, type StatusTone } from "@/lib/status";
import { cn } from "@/lib/utils";

/**
 * Status = warna + teks (tidak boleh warna saja). tone "solid" HANYA untuk status dokumen di header
 * detail; "soft" di semua tempat lain. Peta status per domain di lib/<domain>-rules.ts / lib/status.ts.
 */
export function StatusBadge({
  value,
  map,
  tone = "soft",
  className,
}: {
  value: string | null | undefined;
  map: Record<string, StatusDef>;
  tone?: StatusTone;
  className?: string;
}) {
  const s = resolveStatus(map, value);
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-md border px-2 py-0.5 text-xs whitespace-nowrap",
        tone === "solid" ? "font-semibold shadow-xs" : "font-medium",
        STATUS_CLASSES[s.color][tone],
        className,
      )}
    >
      {s.label}
    </span>
  );
}
