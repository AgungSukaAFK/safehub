"use client";

// Pilihan banyak / bisa dicari (frontend-guide §9.4): Combobox Base UI (pengganti cmdk
// SearchableSelect ga-web). Mode statis (`options`) atau async (`loadOptions`, debounce 250 ms,
// request basi diabaikan) untuk entitas dari DB (orang, barang, vendor).

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";

export type SelectOption = { value: string; label: string; description?: string; icon?: ReactNode };

export function SearchableSelect({
  id,
  name,
  value,
  onValueChange,
  options,
  loadOptions,
  selectedOption,
  placeholder = "Pilih...",
  emptyText = "Tidak ada yang cocok.",
  disabled,
  invalid,
  className,
  clearable = true,
}: {
  id?: string;
  /** Kirim value lewat FormData */
  name?: string;
  value: string | null;
  onValueChange: (value: string | null, option: SelectOption | null) => void;
  /** Mode statis */
  options?: SelectOption[];
  /** Mode async: dipanggil saat mengetik (≥ 1 huruf) & saat dibuka (q kosong) */
  loadOptions?: (q: string) => Promise<SelectOption[]>;
  /** Mode async: opsi terpilih (label untuk nilai awal) */
  selectedOption?: SelectOption | null;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  clearable?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);
  const async = !!loadOptions;

  useEffect(() => {
    if (!loadOptions) return;
    const id = ++reqId.current;
    const t = window.setTimeout(() => {
      setLoading(true);
      loadOptions(query.trim())
        .then((rows) => id === reqId.current && setRemote(rows))
        .catch(() => id === reqId.current && setRemote([]))
        .finally(() => id === reqId.current && setLoading(false));
    }, query ? 250 : 0);
    return () => window.clearTimeout(t);
  }, [query, loadOptions]);

  const items = useMemo(() => {
    if (!async) return options ?? [];
    const sel = selectedOption && !remote.some((o) => o.value === selectedOption.value) ? [selectedOption] : [];
    return [...sel, ...remote];
  }, [async, options, remote, selectedOption]);

  const selected = items.find((o) => o.value === value) ?? (selectedOption?.value === value ? selectedOption : null) ?? null;

  return (
    <>
      <Combobox
        items={items}
        value={selected}
        onValueChange={(o: SelectOption | null) => onValueChange(o?.value ?? null, o)}
        itemToStringLabel={(o: SelectOption) => o.label}
        isItemEqualToValue={(a: SelectOption, b: SelectOption) => a.value === b.value}
        filter={async ? null : undefined}
        onInputValueChange={(v) => setQuery(v)}
        disabled={disabled}
      >
        <ComboboxInput
          id={id}
          placeholder={placeholder}
          showClear={clearable && !!selected}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          className={cn("w-full", className)}
        />
        <ComboboxContent>
          {loading ? (
            <p className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Mencari...
            </p>
          ) : (
            <ComboboxEmpty>{emptyText}</ComboboxEmpty>
          )}
          <ComboboxList>
            {(o: SelectOption) => (
              <ComboboxItem key={o.value} value={o}>
                {o.icon}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{o.label}</span>
                  {o.description && <span className="block truncate text-xs text-muted-foreground">{o.description}</span>}
                </span>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {name && <input type="hidden" name={name} value={value ?? ""} />}
    </>
  );
}
