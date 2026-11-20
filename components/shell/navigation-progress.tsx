"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { rememberPath } from "@/lib/client-context";
import { setPendingNavUrl, useNavPhase } from "@/lib/sidebar/nav-pending";

/**
 * Bar tipis di atas layar selama pindah halaman (frontend-guide §6.4): jalan pelan ke ~85%, penuh
 * + memudar saat halaman tujuan aktif, batal otomatis setelah 20 detik.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const phase = useNavPhase();

  // Halaman tujuan sudah aktif → selesai (store eksternal, bukan setState)
  useEffect(() => {
    setPendingNavUrl(null);
  }, [pathname, search]);

  // halaman sebelumnya (konteks otomatis Bantuan/Feedback saat dibuka dari sidebar)
  useEffect(() => rememberPath(pathname), [pathname]);

  if (phase === "idle") return null;

  return (
    <div aria-hidden className="no-print pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5">
      <div
        key={phase}
        className="h-full origin-left bg-primary shadow-[0_0_8px_hsl(var(--primary))] motion-reduce:transition-none"
        style={
          phase === "loading"
            ? { transform: "scaleX(0.85)", animation: "nav-progress 8s cubic-bezier(0.1, 0.7, 0.3, 1)" }
            : { transform: "scaleX(1)", opacity: 0, animation: "nav-progress-done 350ms ease-out" }
        }
      />
    </div>
  );
}
