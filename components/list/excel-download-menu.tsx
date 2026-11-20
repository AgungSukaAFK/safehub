"use client";

// Tombol "Download Data (Excel)" (frontend-guide §18.2, port ga-web). Mengunduh dari route handler
// `<pathname>/ekspor?<param list>&mode=filter|semua` (exceljs di server). Jumlah "Semua data"
// dihitung saat menu dibuka (Server Action), bukan tiap halaman dimuat.

import { useState } from "react";
import { ChevronDown, Database, FileSpreadsheet, Filter, Loader2 } from "lucide-react";
import { useList } from "@/components/list/list-context";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useOnline } from "@/lib/offline/use-online";
import { toast } from "@/lib/toast";

function filenameFrom(res: Response, fallback: string) {
  const cd = res.headers.get("content-disposition") ?? "";
  const m = /filename\*=UTF-8''([^;]+)/i.exec(cd) ?? /filename="?([^";]+)"?/i.exec(cd);
  return m ? decodeURIComponent(m[1]) : fallback;
}

export function ExcelDownloadMenu({
  itemLabel,
  filteredCount,
  countAll,
  exportPath,
}: {
  /** "pengajuan" */
  itemLabel: string;
  filteredCount: number;
  /** Server Action: jumlah semua data dalam scope user */
  countAll: () => Promise<number>;
  /** default `<pathname>/ekspor` */
  exportPath?: string;
}) {
  const { pathname, searchParams } = useList();
  const online = useOnline();
  const [allCount, setAllCount] = useState<number | "loading" | null>(null);
  const [busy, setBusy] = useState(false);

  const download = async (mode: "filter" | "semua") => {
    setBusy(true);
    const id = toast.loading("Menyiapkan file Excel...");
    try {
      const params = new URLSearchParams(mode === "filter" ? searchParams.toString() : "");
      params.delete("hal");
      params.set("mode", mode);
      const res = await fetch(`${exportPath ?? `${pathname}/ekspor`}?${params}`, { cache: "no-store" });
      if (res.status === 204) {
        toast.warning("Tidak ada data untuk diunduh.", { id });
        return;
      }
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        toast.error("Gagal menyiapkan file Excel", { id, description: msg || `Kode ${res.status}` });
        return;
      }
      const blob = await res.blob();
      const name = filenameFrom(res, `${itemLabel}.xlsx`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Safari iOS/PWA butuh URL tetap hidup sebentar
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast.success(`File ${name} diunduh.`, { id });
    } catch {
      toast.error("Gagal menyiapkan file Excel", { id, description: "Periksa koneksi internet lalu coba lagi." });
    } finally {
      setBusy(false);
    }
  };

  const text = (n: number) => `(${n.toLocaleString("id-ID")} ${itemLabel})`;

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (!open) return;
        setAllCount("loading");
        countAll()
          .then(setAllCount)
          .catch(() => setAllCount(null));
      }}
    >
      <DropdownMenuTrigger
        render={<Button variant="outline" disabled={busy || !online} title={!online ? "Butuh koneksi internet" : undefined} className="w-full md:w-auto" />}
      >
        {busy ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
        {busy ? "Menyiapkan data..." : "Download Data (Excel)"}
        <ChevronDown />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Export ke Excel</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => download("semua")}>
          <Database />
          Semua data
          {allCount === "loading" ? <Loader2 className="ml-auto size-3.5 animate-spin" /> : allCount !== null && <span className="text-muted-foreground">{text(allCount)}</span>}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={filteredCount === 0} onClick={() => download("filter")}>
          <Filter />
          Sesuai filter <span className="text-muted-foreground">{text(filteredCount)}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
