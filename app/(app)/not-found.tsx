import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="col-span-12 flex flex-col items-center gap-3 rounded-xl border bg-card px-6 py-12 text-center shadow-sm">
      <FileQuestion className="size-8 text-muted-foreground" />
      <h1 className="text-lg font-semibold">Data tidak ditemukan</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Data mungkin sudah dihapus, atau Anda tidak punya akses ke data ini.
      </p>
      <Link href="/" className={buttonVariants()}>
        Kembali ke Beranda
      </Link>
    </div>
  );
}
