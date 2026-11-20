"use client";

// Lihat foto profil ukuran penuh (frontend-guide §15.4). Dipakai menu akun & halaman Profil.
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export function AvatarViewerDialog({
  open,
  onOpenChange,
  src,
  name,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string;
  name: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(32rem,calc(100%-2rem))] p-2 sm:max-w-md">
        <DialogTitle className="sr-only">Foto profil {name}</DialogTitle>
        {/* eslint-disable-next-line @next/next/no-img-element -- URL storage dinamis, ukuran asli */}
        <img src={src} alt={`Foto profil ${name}`} className="aspect-square w-full rounded-lg object-cover" />
      </DialogContent>
    </Dialog>
  );
}
