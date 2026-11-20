"use client";

// Footer tabel list (frontend-guide §8.3, port ga-web): "Baris [25]  1–25 dari 230 pengajuan",
// paginasi (angka halaman disembunyikan di HP), "Hal. [n] / total [Buka]".

import { useState, type FormEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useList } from "@/components/list/list-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PAGE_SIZES } from "@/lib/search-params";
import { cn } from "@/lib/utils";

function pageList(current: number, total: number): (number | "dots")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const left = Math.max(current - 1, 1);
  const right = Math.min(current + 1, total);
  const showLeft = left > 2;
  const showRight = right < total - 2;
  if (!showLeft && showRight) return [1, 2, 3, 4, 5, "dots", total];
  if (showLeft && !showRight) return [1, "dots", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "dots", ...Array.from({ length: right - left + 1 }, (_, i) => left + i), "dots", total];
}

function JumpToPage({ page, totalPages, onGo }: { page: number; totalPages: number; onGo: (p: number) => void }) {
  const [value, setValue] = useState(String(page));
  const [lastPage, setLastPage] = useState(page);
  if (page !== lastPage) {
    setLastPage(page);
    setValue(String(page));
  }
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!value) return;
    const target = Math.min(Math.max(Number(value), 1), totalPages);
    setValue(String(target));
    if (target !== page) onGo(target);
  };
  return (
    <form onSubmit={submit} className="flex items-center gap-2 text-sm whitespace-nowrap text-muted-foreground">
      <label htmlFor="jump-to-page">Hal.</label>
      <Input
        id="jump-to-page"
        inputMode="numeric"
        enterKeyHint="go"
        autoComplete="off"
        aria-label={`Lompat ke halaman, 1 sampai ${totalPages}`}
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
        onFocus={(e) => e.target.select()}
        onBlur={() => !value && setValue(String(page))}
        className="h-8 w-14 px-2 text-center tabular-nums"
      />
      <span className="tabular-nums">/ {totalPages.toLocaleString("id-ID")}</span>
      <Button type="submit" variant="outline" size="sm" disabled={!value || Number(value) === page}>
        Buka
      </Button>
    </form>
  );
}

export function TablePaginationFooter({
  page,
  pageSize,
  total,
  itemLabel,
  className,
}: {
  page: number;
  pageSize: number;
  total: number;
  /** "pengajuan", "pengguna" */
  itemLabel: string;
  className?: string;
}) {
  const { setParams } = useList();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const go = (p: number) => setParams({ hal: p > 1 ? p : null }, { push: true });

  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-x-6 gap-y-3 md:justify-between", className)}>
      <div className="flex items-center gap-4 text-sm whitespace-nowrap text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>Baris</span>
          <Select
            items={PAGE_SIZES.map((n) => ({ value: String(n), label: String(n) }))}
            value={String(pageSize)}
            onValueChange={(v) => setParams({ baris: v === "25" ? null : String(v) })}
          >
            <SelectTrigger aria-label="Jumlah baris per halaman" className="h-8 w-20 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="tabular-nums">
          {total > 0 && start <= total ? `${start.toLocaleString("id-ID")}–${end.toLocaleString("id-ID")}` : "0"} dari{" "}
          {total.toLocaleString("id-ID")} {itemLabel}
        </span>
      </div>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <nav aria-label="Halaman" className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="shadow-none" disabled={page <= 1} onClick={() => go(page - 1)} aria-label="Halaman sebelumnya">
              <ChevronLeft /> <span className="hidden sm:inline">Sebelumnya</span>
            </Button>
            {pageList(page, totalPages).map((p, i) =>
              p === "dots" ? (
                <span key={`d${i}`} className="hidden px-1 text-muted-foreground sm:inline">
                  …
                </span>
              ) : (
                <Button
                  key={p}
                  variant={p === page ? "outline" : "ghost"}
                  size="icon-sm"
                  aria-current={p === page ? "page" : undefined}
                  className={cn("hidden tabular-nums shadow-none sm:inline-flex", p === page && "font-semibold")}
                  onClick={() => p !== page && go(p)}
                >
                  {p}
                </Button>
              ),
            )}
            <Button variant="ghost" size="sm" className="shadow-none" disabled={page >= totalPages} onClick={() => go(page + 1)} aria-label="Halaman berikutnya">
              <span className="hidden sm:inline">Berikutnya</span> <ChevronRight />
            </Button>
          </nav>
          <JumpToPage page={page} totalPages={totalPages} onGo={go} />
        </div>
      )}
    </div>
  );
}
