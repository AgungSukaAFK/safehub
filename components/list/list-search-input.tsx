"use client";

// Kotak cari halaman list (frontend-guide §8.3, port ga-web). Placeholder PENDEK; daftar kolom yang
// dicari ada di popover ⓘ (searchableFields, harus sama dengan kolom yang benar-benar dicari loader).
// Sinkron ke ?q= dengan debounce 400 ms; Back tetap jalan.

import { CircleHelp, Loader2, Search, X } from "lucide-react";
import { useList } from "@/components/list/list-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useUrlSearchInput } from "@/hooks/use-url-search-input";

export function ListSearchInput({
  placeholder = "Cari...",
  searchableFields,
  param = "q",
}: {
  placeholder?: string;
  searchableFields: readonly string[];
  param?: string;
}) {
  const { get, setParams, isPending } = useList();
  const [value, onChange, reset] = useUrlSearchInput(get(param), (v) => setParams({ [param]: v || null }));
  const Icon = isPending ? Loader2 : Search;

  return (
    <div className="relative min-w-0 flex-1">
      <Icon
        className={`pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground ${isPending ? "animate-spin" : ""}`}
      />
      <Input
        type="search"
        enterKeyHint="search"
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-9 pr-16 pl-9 text-base md:text-sm [&::-webkit-search-cancel-button]:hidden"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            reset("");
            setParams({ [param]: null });
          }
        }}
      />
      {value && (
        <button
          type="button"
          aria-label="Hapus pencarian"
          onClick={() => {
            reset("");
            setParams({ [param]: null });
          }}
          className="absolute top-1/2 right-9 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
      <Popover>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Lihat yang bisa dicari"
              className="absolute top-1/2 right-0.5 -translate-y-1/2 text-muted-foreground shadow-none"
            />
          }
        >
          <CircleHelp />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 text-sm">
          <p className="font-medium">Bisa dicari berdasarkan</p>
          <ul className="grid list-inside list-disc grid-cols-2 gap-x-3 gap-y-1 text-muted-foreground">
            {searchableFields.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Cukup ketik sebagian kata. Beberapa kata = semua harus ada, urutan bebas.
          </p>
        </PopoverContent>
      </Popover>
    </div>
  );
}
