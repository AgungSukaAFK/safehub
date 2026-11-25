// Tab Readiness LIB, Metal Scrap, dan Material Request ("segera hadir") di /maintenance. Hanya baca; data dari impor Excel.
import type { ReactNode } from "react";
import { StatusBadge } from "@/components/detail/status-badge";
import { Content } from "@/components/list/content";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { listMntLib, listMntScrap, type MntParams } from "@/lib/maintenance";
import { LIB_STATE } from "@/lib/maintenance-rules";
import { MONTHS_LONG } from "@/lib/tsp-rules";
import type { ServerClient } from "@/lib/supabase/server";

type Props = { supabase: ServerClient; p: MntParams; syncedAt: string | null; search: ReactNode };

const Th = ({ children }: { children: string }) => (
  <th scope="col" className="px-3 py-2 text-left font-medium">
    {children}
  </th>
);
const Empty = ({ children }: { children: string }) => <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{children}</p>;
const kg = (v: number | null) => (v === null ? "-" : formatNumber(v));

export async function LibTab({ supabase, p, syncedAt, search }: Props) {
  const rows = await listMntLib(supabase, p);
  const non = rows.filter((r) => r.state === "non_moving").length;
  const below = rows.filter((r) => r.state === "below_min").length;
  return (
    <Content
      title="Readiness LIB"
      description={`${rows.length} part · ${non} non-moving · ${below} di bawah minimum · potret stok${syncedAt ? ` per ${formatDateTime(syncedAt)}` : ", belum ada data diimpor"}`}
      cardAction={search}
    >
      {rows.length === 0 ? (
        <Empty>Belum ada data part. Impor Readiness LIB dari menu Impor Data.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>{["Kode part", "Nama", "Stok", "Minimum", "Pergerakan terakhir", "Status"].map((h) => <Th key={h}>{h}</Th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2 font-medium tabular-nums">{r.code}</td>
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {formatNumber(r.qty)}
                    {r.uom ? ` ${r.uom}` : ""}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{r.minQty > 0 ? formatNumber(r.minQty) : "-"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.lastMovedOn ? `${formatDate(r.lastMovedOn)} (${r.idleDays} hari)` : "Belum pernah"}</td>
                  <td className="px-3 py-2">
                    <StatusBadge value={r.state} map={LIB_STATE} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Content>
  );
}

export async function ScrapTab({ supabase, p, syncedAt, search }: Props) {
  const year = Number(p.bulan.slice(0, 4));
  const rows = await listMntScrap(supabase, { site: p.site, q: p.q, year });
  return (
    <Content
      title="Metal Scrap"
      description={`Tahun ${year} · ${rows.length} baris · aktual vs forecast (kg)${syncedAt ? ` · diperbarui ${formatDateTime(syncedAt)}` : ""}`}
      cardAction={search}
    >
      {rows.length === 0 ? (
        <Empty>Belum ada data scrap untuk tahun ini. Impor Metal Scrap dari menu Impor Data.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>{["Bulan", "Jenis logam", "Aktual (kg)", "Forecast (kg)", "Capaian"].map((h) => <Th key={h}>{h}</Th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2 whitespace-nowrap">
                    {MONTHS_LONG[Number(r.month.slice(5, 7)) - 1]} {r.month.slice(0, 4)}
                  </td>
                  <td className="px-3 py-2 font-medium">{r.metal}</td>
                  <td className="px-3 py-2 tabular-nums">{kg(r.actualKg)}</td>
                  <td className="px-3 py-2 tabular-nums">{kg(r.forecastKg)}</td>
                  <td className="px-3 py-2 tabular-nums">{r.actualKg !== null && r.forecastKg ? `${Math.round((r.actualKg * 100) / r.forecastKg)}%` : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Content>
  );
}

export function MrTab() {
  return (
    <Content title="Material Request" description="Segera hadir">
      <div role="status" className="rounded-lg border border-dashed p-8 text-center">
        <strong className="block text-sm font-medium">Segera hadir</strong>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          Daftar Material Request (MR Open dan waktu tunggu SCM) akan tampil di sini setelah datanya tersedia dari sistem maintenance. Sementara itu, kelola MR langsung di sistem maintenance.
        </p>
      </div>
    </Content>
  );
}
