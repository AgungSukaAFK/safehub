"use client";

// SATU-SATUNYA komponen konfirmasi (frontend-guide §12.2, port taste-ui.md §9.4).
// Mode trigger (children) atau controlled (open/onOpenChange). onConfirm boleh async: dialog
// menunggu, tetap terbuka kalau gagal (throw). Hanya untuk aksi yang tidak bisa dibatalkan.

import { useState, type ReactElement, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { OFFLINE_REASON, useOnline } from "@/lib/offline/use-online";

type ConfirmDialogProps = {
  /** Sebut objeknya: "Hapus pengajuan PJ-0042?" */
  title?: ReactNode;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  /** Tombol konfirmasi merah (hapus, tolak, keluar, cabut akses) */
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  /** Elemen pemicu (mode trigger). Kosongkan kalau pakai `open`. */
  trigger?: ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Isi tambahan (mis. textarea alasan) di antara deskripsi dan tombol */
  children?: ReactNode;
  /** Nonaktifkan tombol konfirmasi (mis. alasan belum diisi) */
  confirmDisabled?: boolean;
  /** Aksi tetap boleh saat offline (mis. Keluar: membersihkan data lokal). Default: nonaktif offline. */
  offlineOk?: boolean;
};

export function ConfirmDialog({
  title = "Apakah Anda yakin?",
  description = "Tindakan ini tidak bisa dibatalkan.",
  confirmText = "Ya, lanjutkan",
  cancelText = "Batal",
  destructive = false,
  onConfirm,
  trigger,
  open: openProp,
  onOpenChange,
  children,
  confirmDisabled,
  offlineOk = false,
}: ConfirmDialogProps) {
  const online = useOnline();
  const blocked = !online && !offlineOk;
  const [innerOpen, setInnerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const open = openProp ?? innerOpen;

  const setOpen = (next: boolean) => {
    if (openProp === undefined) setInnerOpen(next);
    onOpenChange?.(next);
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      setOpen(false);
    } catch {
      // tetap terbuka; pemanggil menampilkan toast error
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => !loading && setOpen(next)}>
      {trigger && <AlertDialogTrigger render={trigger} />}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        {children}
        {blocked && <p className="text-xs text-amber-700 dark:text-amber-400">Anda sedang offline. Aksi ini butuh koneksi internet.</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{cancelText}</AlertDialogCancel>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={loading || confirmDisabled || blocked}
            aria-busy={loading || undefined}
            title={blocked ? OFFLINE_REASON : undefined}
          >
            {loading && <Loader2 className="animate-spin" />}
            {confirmText}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
