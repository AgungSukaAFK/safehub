import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function RootNotFound() {
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <div className="flex max-w-md flex-col items-center gap-3 rounded-xl border bg-card px-6 py-12 text-center shadow-sm">
        <FileQuestion className="size-8 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Halaman tidak ditemukan</h1>
        <p className="text-sm text-muted-foreground">Alamat yang Anda buka tidak ada atau sudah dipindah.</p>
        <Link href="/" className={buttonVariants()}>
          Kembali ke Beranda
        </Link>
      </div>
    </main>
  );
}
