"use client";

// Panel filter yang bisa dilipat (frontend-guide §8.3, port ga-web filter-panel.tsx).
// - Tertutup saat pertama; status buka diingat per perangkat.
// - Chip filter aktif selalu tampil & bisa dihapus satu-satu; Reset menghapus semua.
// - Select langsung berlaku; rentang (tanggal/angka) setelah "Terapkan".
// Chip berupa DATA (bisa disusun Server Component): { key, label, value, params } → menutup chip
// menghapus `params` dari URL.

import { useId, useState, type ReactNode } from "react";
import { Check, ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { useList } from "@/components/list/list-context";
import { CurrencyInput } from "@/components/form/currency-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStoredState } from "@/lib/storage";
import { cn } from "@/lib/utils";

export type FilterChip = { key: string; label: string; value: string; params: string[] };
export type FilterOption = { value: string; label: string };

export function FilterPanel({ chips, children, className }: { chips: FilterChip[]; children: ReactNode; className?: string }) {
  const [open, setOpen] = useStoredState("filter-open", false);
  const { setParams, resetFilters } = useList();
  const panelId = useId();
  const count = chips.length;

  return (
    <div className={cn("max-w-full min-w-0 rounded-lg border bg-muted/50 dark:bg-muted/10", className)}>
      <div className="flex flex-wrap items-center gap-2 p-2 sm:px-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
          className="gap-2 px-2 font-medium shadow-none"
        >
          <SlidersHorizontal />
          Filter
          {count > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
              {count}
            </span>
          )}
          <ChevronDown className={cn("text-muted-foreground transition-transform", open && "rotate-180")} />
        </Button>
        {count === 0 && !open && <span className="text-xs text-muted-foreground">Tidak ada filter aktif</span>}
        {count > 0 && (
          <Button type="button" variant="ghost" size="sm" onClick={() => resetFilters()} className="ml-auto gap-1 px-2 text-muted-foreground shadow-none">
            <X className="size-3.5" />
            Reset
          </Button>
        )}
        {count > 0 && (
          <ul aria-label="Filter aktif" className="flex w-full min-w-0 flex-wrap gap-1.5">
            {chips.map((f) => (
              <li
                key={f.key}
                title={`${f.label}: ${f.value}`}
                className="inline-flex h-7 max-w-full min-w-0 items-center gap-1 rounded-full border bg-background pr-1 pl-2.5 text-xs shadow-xs"
              >
                <span className="shrink-0 text-muted-foreground">{f.label}:</span>
                <span className="min-w-0 truncate font-medium">{f.value}</span>
                <button
                  type="button"
                  onClick={() => setParams(Object.fromEntries(f.params.map((p) => [p, null])))}
                  aria-label={`Hapus filter ${f.label}`}
                  className="ml-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <X className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div
        id={panelId}
        hidden={!open}
        className="min-w-0 border-t p-3 sm:p-4 [&_.grid>*]:min-w-0 [&_[data-slot=select-trigger]]:w-full [&_input]:min-w-0"
      >
        {children}
      </div>
    </div>
  );
}

/** Baris field: jumlah kolom otomatis mengikuti lebar (jangan tulis grid manual). */
export function FilterFields({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,10rem),1fr))] gap-3">{children}</div>;
}

export function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

/** Select satu pilihan, langsung berlaku. "" = semua. */
export function FilterSelect({ param, label, options, allLabel = "Semua" }: { param: string; label: string; options: FilterOption[]; allLabel?: string }) {
  const { get, setParams } = useList();
  const value = get(param) || "__all";
  const items = [{ value: "__all", label: allLabel }, ...options];
  return (
    <FilterField label={label}>
      <Select items={items} value={value} onValueChange={(v) => setParams({ [param]: v === "__all" || !v ? null : String(v) })}>
        <SelectTrigger aria-label={label} className="h-9 bg-background">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterField>
  );
}

/** Multi pilih (mis. Perusahaan), disimpan `?param=A,B`. Langsung berlaku. */
export function FilterMultiSelect({ param, label, options }: { param: string; label: string; options: FilterOption[] }) {
  const { get, setParams } = useList();
  const selected = get(param).split(",").filter(Boolean);
  const toggle = (v: string, on: boolean) =>
    setParams({ [param]: on ? [...selected, v] : selected.filter((s) => s !== v) });
  const text =
    selected.length === 0
      ? "Semua"
      : selected.map((s) => options.find((o) => o.value === s)?.label ?? s).join(", ");
  return (
    <FilterField label={label}>
      <Popover>
        <PopoverTrigger
          render={
            <Button variant="outline" className="h-9 w-full justify-between bg-background px-3 font-normal shadow-none" aria-label={label}>
              <span className="truncate">{text}</span>
              <ChevronDown className="text-muted-foreground" />
            </Button>
          }
        />
        <PopoverContent align="start" className="w-56 gap-1 p-1">
          {options.map((o) => {
            const on = selected.includes(o.value);
            return (
              <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
                <Checkbox checked={on} onCheckedChange={(c) => toggle(o.value, !!c)} />
                <span className="flex-1">{o.label}</span>
                {on && <Check className="size-3.5 text-muted-foreground" />}
              </label>
            );
          })}
        </PopoverContent>
      </Popover>
    </FilterField>
  );
}

export type RangeDef =
  | { kind: "date"; label: string; from: string; to: string }
  | { kind: "number"; label: string; from: string; to: string; currency?: boolean };

/** Field rentang + satu tombol Terapkan. Nilai lokal, baru masuk URL saat diterapkan. */
export function FilterRanges({ ranges }: { ranges: RangeDef[] }) {
  const { get, setParams } = useList();
  const params = ranges.flatMap((r) => [r.from, r.to]);
  const current = Object.fromEntries(params.map((p) => [p, get(p)]));
  const [draft, setDraft] = useState(current);
  const [synced, setSynced] = useState(current);
  // URL berubah dari luar (chip dihapus, Reset, Back) → ikuti
  if (params.some((p) => current[p] !== synced[p])) {
    setSynced(current);
    setDraft(current);
  }
  const dirty = params.some((p) => (draft[p] ?? "") !== (current[p] ?? ""));
  const apply = () => setParams(Object.fromEntries(params.map((p) => [p, draft[p] || null])));
  const set = (p: string, v: string) => setDraft((d) => ({ ...d, [p]: v }));

  return (
    <div className="@container mt-3">
      <div className="grid grid-cols-1 items-end gap-3 @xl:grid-cols-2 @3xl:grid-cols-[1fr_1fr_auto]">
        {ranges.map((r) => (
          <FilterField key={r.from} label={r.label}>
            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5">
              {r.kind === "date" ? (
                <>
                  <Input type="date" aria-label={`${r.label} dari`} className="h-9 bg-background" value={draft[r.from] ?? ""} onChange={(e) => set(r.from, e.target.value)} />
                  <span className="text-muted-foreground">–</span>
                  <Input type="date" aria-label={`${r.label} sampai`} className="h-9 bg-background" value={draft[r.to] ?? ""} onChange={(e) => set(r.to, e.target.value)} />
                </>
              ) : r.currency ? (
                <>
                  <CurrencyInput aria-label={`${r.label} minimal`} placeholder="Min" className="h-9 bg-background" value={draft[r.from] ?? ""} onValueChange={(v) => set(r.from, v)} />
                  <span className="text-muted-foreground">–</span>
                  <CurrencyInput aria-label={`${r.label} maksimal`} placeholder="Maks" className="h-9 bg-background" value={draft[r.to] ?? ""} onValueChange={(v) => set(r.to, v)} />
                </>
              ) : (
                <>
                  <Input inputMode="decimal" aria-label={`${r.label} minimal`} placeholder="Min" className="h-9 bg-background" value={draft[r.from] ?? ""} onChange={(e) => set(r.from, e.target.value.replace(/[^\d.,]/g, ""))} />
                  <span className="text-muted-foreground">–</span>
                  <Input inputMode="decimal" aria-label={`${r.label} maksimal`} placeholder="Maks" className="h-9 bg-background" value={draft[r.to] ?? ""} onChange={(e) => set(r.to, e.target.value.replace(/[^\d.,]/g, ""))} />
                </>
              )}
            </div>
          </FilterField>
        ))}
        <Button type="button" onClick={apply} disabled={!dirty} className="w-full @xl:col-span-2 @3xl:col-span-1 @3xl:w-auto">
          Terapkan
        </Button>
      </div>
    </div>
  );
}
