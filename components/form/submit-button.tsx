"use client";

import type { ComponentProps, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OFFLINE_REASON, useOnline } from "@/lib/offline/use-online";

/**
 * Tombol submit standar: nonaktif + spinner + label "...ing" selama proses (frontend-guide §1.5).
 * `disabledReason` = alasan tombol nonaktif (mis. offline), tampil sebagai title.
 */
export function SubmitButton({
  pending,
  pendingLabel = "Menyimpan...",
  icon,
  children,
  disabled,
  disabledReason,
  offlineOk,
  ...props
}: ComponentProps<typeof Button> & {
  pending?: boolean;
  pendingLabel?: string;
  icon?: ReactNode;
  disabledReason?: string;
  /** Tetap aktif saat offline (jarang; default: aksi tulis butuh koneksi) */
  offlineOk?: boolean;
}) {
  const online = useOnline();
  const offline = !online && !offlineOk;
  return (
    <Button
      type="submit"
      disabled={pending || disabled || offline}
      aria-busy={pending || undefined}
      title={offline ? OFFLINE_REASON : disabled && disabledReason ? disabledReason : undefined}
      {...props}
    >
      {pending ? <Loader2 className="animate-spin" /> : icon}
      {pending ? pendingLabel : children}
    </Button>
  );
}
