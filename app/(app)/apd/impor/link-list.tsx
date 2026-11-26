"use client";

// Nama penerima data lama (Excel) yang belum tertaut ke karyawan: pilih karyawan (usulan = nama termirip di site yang sama) lalu Tautkan.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UnlinkedRow } from "@/lib/apd";
import { useOnline } from "@/lib/offline/use-online";
import { toast } from "@/lib/toast";
import { linkRecipientAction } from "../actions";

export function UnlinkedList({ rows, employees }: { rows: UnlinkedRow[]; employees: Record<string, { value: string; label: string }[]> }) {
  return (
    <ul className="divide-y rounded-lg border">
      {rows.map((r) => <Row key={`${r.locationId}|${r.name}`} row={r} options={employees[r.locationId] ?? []} />)}
    </ul>
  );
}

function Row({ row, options }: { row: UnlinkedRow; options: { value: string; label: string }[] }) {
  const router = useRouter();
  const online = useOnline();
  const [pick, setPick] = useState(row.suggestId ?? "");
  const [busy, setBusy] = useState(false);
  const link = async () => {
    setBusy(true);
    const res = await linkRecipientAction(row.name, row.locationId, pick);
    setBusy(false);
    if (res.status === "ok") {
      toast.success(res.message);
      router.refresh();
    } else toast.error(res.message);
  };
  return (
    <li className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
      <span className="min-w-48 flex-1">
        <strong className="font-medium">{row.name}</strong>
        <small className="block text-xs text-muted-foreground">
          {row.site} · {[row.moves && `${row.moves} pengiriman`, row.requests && `${row.requests} pengajuan`].filter(Boolean).join(", ")}
          {row.suggestName && ` · usulan: ${row.suggestName}`}
        </small>
      </span>
      <select aria-label={`Karyawan untuk ${row.name}`} value={pick} onChange={(e) => setPick(e.target.value)} className="h-9 w-72 max-w-full rounded-md border bg-background px-2 text-sm">
        <option value="">{options.length ? "Pilih karyawan" : "Belum ada karyawan di site ini"}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <Button size="sm" variant="outline" onClick={link} disabled={!pick || busy || !online}>
        {busy ? <Loader2 className="animate-spin" /> : <Link2 />} Tautkan
      </Button>
    </li>
  );
}
