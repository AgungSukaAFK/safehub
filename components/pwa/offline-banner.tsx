"use client";

// Banner offline (frontend-guide §22.3): strip amber di bawah top bar "Anda sedang offline ·
// menampilkan data per 14.32 WIB" (waktu dari <meta name="x-rendered-at"> layout). Saat kembali
// online: strip hijau sebentar + router.refresh() supaya data segar.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CloudOff, Wifi } from "lucide-react";
import { formatDateTime, formatTime } from "@/lib/format";
import { onOnlineChange, useOnline } from "@/lib/offline/use-online";

function renderedAt(): string | null {
  const metas = document.querySelectorAll('meta[name="x-rendered-at"]');
  const v = metas[metas.length - 1]?.getAttribute("content");
  return v && !Number.isNaN(Date.parse(v)) ? v : null;
}

export function OfflineBanner() {
  const online = useOnline();
  const router = useRouter();
  const [back, setBack] = useState(false);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const off = onOnlineChange((v) => {
      if (!v) return setBack(false);
      setBack(true);
      router.refresh();
      t = setTimeout(() => setBack(false), 3000);
    });
    return () => {
      off();
      clearTimeout(t);
    };
  }, [router]);

  if (online && !back) return null;
  if (online)
    return (
      <div role="status" className="no-print -mt-4 mb-4 flex items-center justify-center gap-2 bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white">
        <Wifi className="size-3.5" /> Kembali online. Data diperbarui.
      </div>
    );

  const at = renderedAt();
  const sameDay = at && new Date(at).toDateString() === new Date().toDateString();
  return (
    <div role="status" className="no-print -mt-4 mb-4 flex items-center justify-center gap-2 bg-amber-100 px-4 py-1.5 text-center text-xs font-medium text-amber-900 dark:bg-amber-950/70 dark:text-amber-200">
      <CloudOff className="size-3.5 shrink-0" />
      <span>
        Anda sedang offline{at ? ` · menampilkan data per ${sameDay ? `${formatTime(at)} WIB` : formatDateTime(at)}` : ""}. Perubahan belum bisa disimpan.
      </span>
    </div>
  );
}
