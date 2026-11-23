import { Lock } from "lucide-react";
import { FUNCTION_LABELS, type Fn } from "@/lib/functions";
import { cn } from "@/lib/utils";

// Blok "Data terbatas" (rancangan §2.7). Data sensitif ada di tabel `<entitas>_restricted` yang
// RLS-nya hanya untuk fungsi tertentu; loader mengembalikan `restricted: true` bila tidak terbaca.
// Dipakai juga sebagai bingkai: kalau `children` ada (user berhak), isi ditampilkan dengan label.

export function RestrictedData({
  functions,
  restricted,
  title = "Data terbatas",
  children,
  className,
}: {
  /** Fungsi yang boleh membaca (untuk teks keterangan) */
  functions: Fn[];
  /** true = user tidak berhak; isi tidak ditampilkan */
  restricted: boolean;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const who = functions.map((f) => FUNCTION_LABELS[f]).join(" dan ");
  if (restricted) {
    return (
      <div className={cn("flex items-start gap-3 rounded-lg border border-dashed bg-muted/40 p-4 text-sm", className)} role="note">
        <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="space-y-0.5">
          <p className="font-medium">{title}</p>
          <p className="text-muted-foreground">Hanya {who} yang dapat melihat data ini.</p>
        </div>
      </div>
    );
  }
  return (
    <div className={cn("rounded-lg border p-4", className)}>
      <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Lock className="size-3.5" aria-hidden /> {title} · hanya {who}
      </p>
      {children}
    </div>
  );
}
