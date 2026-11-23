import { AlertTriangle, CalendarCheck, CalendarX, CircleDashed } from "lucide-react";
import type { Expiry } from "@/lib/expiry";
import { formatDate } from "@/lib/format";
import { EXPIRY_STATUS, STATUS_CLASSES } from "@/lib/status";
import { cn } from "@/lib/utils";

// Chip masa berlaku (MCU, sertifikat, izin kontraktor, review dokumen; rancangan §2.4). Status
// dihitung di loader lewat expiryOf() (lib/expiry.ts), komponen ini hanya menampilkan.
// "Belum Ada" = garis putus (rancangan §2.5).

const ICON = { valid: CalendarCheck, expiring: AlertTriangle, expired: CalendarX, none: CircleDashed } as const;

function detail(e: Expiry): string | null {
  if (e.daysLeft === null) return null;
  if (e.state === "expired") return `lewat ${-e.daysLeft} hari`;
  if (e.state === "expiring") return e.daysLeft === 0 ? "hari ini" : `${e.daysLeft} hari lagi`;
  return null;
}

export function ExpiryChip({ expiry, showDate = true, className }: { expiry: Expiry; showDate?: boolean; className?: string }) {
  const def = EXPIRY_STATUS[expiry.state];
  const Icon = ICON[expiry.state];
  const extra = detail(expiry);
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        STATUS_CLASSES[def.color].soft,
        expiry.state === "none" && "border-dashed",
        className,
      )}
      title={expiry.validUntil ? `Berlaku sampai ${formatDate(expiry.validUntil)}` : undefined}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {def.label}
      {extra && <span className="font-normal">· {extra}</span>}
      {showDate && expiry.validUntil && expiry.state === "valid" && <span className="font-normal">· s.d. {formatDate(expiry.validUntil)}</span>}
    </span>
  );
}
