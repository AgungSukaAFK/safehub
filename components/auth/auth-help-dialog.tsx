"use client";

// "Belum bisa masuk?" di halaman auth (frontend-guide §14, §21). Semua user adalah karyawan:
// TANPA nomor kontak. Arahkan ke atasan (Department Head) atau tim IT langsung.
import Link from "next/link";
import { Headset, KeyRound, UserRoundCog } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function AskSupervisorNote({ title }: { title?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-md border p-3 text-sm">
      <UserRoundCog className="mt-0.5 size-5 shrink-0 text-primary" />
      <div className="space-y-1">
        {title && <p className="font-medium">{title}</p>}
        <p className="text-muted-foreground">
          Minta bantuan ke <strong className="text-foreground">atasan Anda (Department Head)</strong> atau langsung ke{" "}
          <strong className="text-foreground">tim IT</strong>. Akun dan reset password dibuat oleh tim IT. Siapkan nama,
          email kantor, dan departemen Anda.
        </p>
      </div>
    </div>
  );
}

export function AuthHelpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Headset className="size-5" /> Belum bisa masuk?
          </DialogTitle>
          <DialogDescription>Bantuan Admin di dalam app baru bisa dipakai setelah Anda masuk.</DialogDescription>
        </DialogHeader>
        <AskSupervisorNote title="Belum punya akun atau akun nonaktif" />
        <div className="flex items-start gap-3 rounded-md border p-3 text-sm">
          <KeyRound className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="space-y-2">
            <p className="font-medium">Lupa password</p>
            <p className="text-muted-foreground">Buat password baru lewat link yang dikirim ke email kantor Anda.</p>
            <Link
              href="/auth/lupa-password"
              onClick={() => onOpenChange(false)}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Lupa password
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
