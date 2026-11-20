"use client";

// Klik baris → ringkasan cepat → "Lihat Detail Lengkap" (frontend-guide §8.3). Link kode di tabel
// tetap langsung ke detail.
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function QuickViewDialog({
  open,
  onOpenChange,
  title,
  description,
  href,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  href: string;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="min-w-0">{children}</div>
        <DialogFooter>
          <Link href={href} className={buttonVariants()} onClick={() => onOpenChange(false)}>
            Lihat Detail Lengkap <ArrowRight />
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
