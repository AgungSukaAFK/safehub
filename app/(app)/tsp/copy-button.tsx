"use client";

// "Salin dari tahun lalu": menyalin program aktif (rencana, target, bukti wajib) ke tahun tampilan; realisasi tidak ikut.
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { useOnline } from "@/lib/offline/use-online";
import { toast } from "@/lib/toast";
import { copyProgramsAction } from "./actions";

export function CopyProgramsButton({ fromYear, toYear, siteId }: { fromYear: number; toYear: number; siteId: string }) {
  const router = useRouter();
  const online = useOnline();
  return (
    <ConfirmDialog
      title={`Salin program TSP ${fromYear} ke ${toYear}?`}
      description="Program aktif disalin lengkap dengan rencana per bulan. Realisasi dan bukti tidak ikut. Nomor yang sudah ada di tahun tujuan dilewati."
      confirmText="Salin"
      onConfirm={async () => {
        const res = await copyProgramsAction(fromYear, toYear, siteId);
        if (res.status !== "ok") {
          toast.error(res.message ?? "Gagal menyalin");
          throw new Error(res.message);
        }
        toast.success(res.message);
        router.refresh();
      }}
      trigger={
        <Button type="button" variant="outline" disabled={!online}>
          <Copy /> Salin dari {fromYear}
        </Button>
      }
    />
  );
}
