"use client";

import { useEffect } from "react";
import { RotateCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="col-span-12 flex flex-col items-center gap-3 rounded-xl border bg-card px-6 py-12 text-center shadow-sm">
      <TriangleAlert className="size-8 text-destructive" />
      <h1 className="text-lg font-semibold">Halaman gagal dimuat</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Coba muat ulang. Kalau masih terjadi, laporkan lewat Bantuan Admin
        {error.digest ? ` dengan kode ${error.digest}` : ""}.
      </p>
      <Button onClick={reset}>
        <RotateCw /> Coba lagi
      </Button>
    </div>
  );
}
