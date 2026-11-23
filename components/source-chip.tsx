import Link from "next/link";
import { Link2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Tautan ke record sumber, mis. "Sumber: INS-2026-0230" di Temuan (rancangan §4.0 butir 5).
export function SourceChip({
  label = "Sumber",
  code,
  href,
  className,
}: {
  label?: string;
  code: string;
  /** null = sumber tidak bisa dibuka (dihapus / di luar akses) */
  href: string | null;
  className?: string;
}) {
  const body = (
    <>
      <Link2 className="size-3.5 shrink-0" aria-hidden />
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-mono font-medium">{code}</span>
    </>
  );
  const cls = cn("inline-flex w-fit items-center gap-1 rounded-md border bg-muted/40 px-2 py-0.5 text-xs whitespace-nowrap", className);
  return href ? (
    <Link href={href} className={cn(cls, "transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary")}>
      {body}
    </Link>
  ) : (
    <span className={cls}>{body}</span>
  );
}
