"use client";

// Grid jam kerja: baris = site, kolom = bulan. Sel disimpan saat selesai diisi (blur/Enter) lewat RPC.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { WorkHoursRow } from "@/lib/kpi";
import { MONTH_SHORT } from "@/lib/inspeksi-rules";
import { formatNumber } from "@/lib/format";
import type { Site } from "@/lib/site-types";
import { toast } from "@/lib/toast";
import { saveWorkHoursAction } from "../actions";

type Key = string;
const keyOf = (site: string, month: string): Key => `${site}|${month}`;

export function WorkHoursGrid({ year, sites, rows, canEdit, currentMonth }: { year: number; sites: Site[]; rows: WorkHoursRow[]; canEdit: boolean; currentMonth: string }) {
  const router = useRouter();
  const saved = new Map(rows.map((r) => [keyOf(r.locationId, r.month), r.hours]));
  const [draft, setDraft] = useState<Record<Key, string>>({});
  const [busy, setBusy] = useState<Key | null>(null);
  const [ok, setOk] = useState<Key | null>(null);
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);

  const commit = async (site: string, month: string) => {
    const k = keyOf(site, month);
    const raw = draft[k];
    if (raw === undefined) return;
    const current = saved.get(k);
    const value = raw.trim() === "" ? null : Number(raw.replace(/\./g, "").replace(",", "."));
    if (value === null || Number.isNaN(value) || value === current) {
      setDraft((d) => Object.fromEntries(Object.entries(d).filter(([x]) => x !== k)));
      return;
    }
    setBusy(k);
    const res = await saveWorkHoursAction({ location_id: site, month, hours: value, note: null });
    setBusy(null);
    if (res.status === "ok") {
      setOk(k);
      setDraft((d) => Object.fromEntries(Object.entries(d).filter(([x]) => x !== k)));
      router.refresh();
    } else toast.error(res.message);
  };

  const total = (site: string) => months.reduce((s, m) => s + (saved.get(keyOf(site, m)) ?? 0), 0);

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[1100px] text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="sticky left-0 z-10 bg-muted/40 px-3 py-2 text-left font-medium">Site</th>
            {months.map((m, i) => (
              <th key={m} className="px-1 py-2 text-right font-medium">
                {MONTH_SHORT[i]}
              </th>
            ))}
            <th className="px-3 py-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {sites.map((s) => (
            <tr key={s.id} className="border-t">
              <th scope="row" className="sticky left-0 z-10 bg-background px-3 py-2 text-left font-medium whitespace-nowrap">
                {s.name}
              </th>
              {months.map((m) => {
                const k = keyOf(s.id, m);
                const future = m > currentMonth;
                const value = draft[k] ?? (saved.has(k) ? String(saved.get(k)) : "");
                return (
                  <td key={m} className="px-1 py-1">
                    {canEdit && !future ? (
                      <div className="relative">
                        <Input
                          value={value}
                          inputMode="decimal"
                          aria-label={`Jam kerja ${s.name} ${m}`}
                          onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
                          onBlur={() => commit(s.id, m)}
                          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                          className="h-8 w-20 px-2 text-right text-xs tabular-nums"
                          placeholder="—"
                        />
                        {busy === k && <Loader2 className="absolute top-2 left-1 size-3.5 animate-spin" />}
                        {ok === k && busy !== k && <Check className="absolute top-2 left-1 size-3.5 text-green-600" aria-hidden />}
                      </div>
                    ) : (
                      <span className="block px-2 text-right text-xs tabular-nums text-muted-foreground">{saved.has(k) ? formatNumber(saved.get(k)!) : "—"}</span>
                    )}
                  </td>
                );
              })}
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatNumber(total(s.id))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
