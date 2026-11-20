"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "@/lib/toast";

/**
 * Toast sekali pakai dari param `?ok=<kode>` / `?pesan=<kode>` (setelah redirect dari Server Action),
 * lalu param dihapus dari URL (frontend-guide §7.2). Tambah kode baru di FLASH.
 */
const FLASH: Record<string, { type: "success" | "error" | "info" | "warning"; message: string }> = {
  "akses-ditolak": { type: "warning", message: "Anda tidak punya izin untuk membuka halaman itu." },
  "password-diubah": { type: "success", message: "Password berhasil diganti." },
  disimpan: { type: "success", message: "Data berhasil disimpan." },
  dihapus: { type: "success", message: "Data berhasil dihapus." },
  "tidak-bisa-diubah": { type: "warning", message: "Dokumen ini tidak bisa diubah: hanya draft/ditolak milik Anda (atau admin)." },
};

export function FlashToast() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const code = sp.get("ok") ?? sp.get("pesan");

  useEffect(() => {
    if (!code) return;
    const f = FLASH[code];
    if (f) toast[f.type](f.message, { id: `flash-${code}` });
    const params = new URLSearchParams(sp.toString());
    params.delete("ok");
    params.delete("pesan");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [code, sp, router, pathname]);

  return null;
}

export { FLASH as FLASH_MESSAGES };
