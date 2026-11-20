"use client";

// SATU-SATUNYA tabel list (frontend-guide §8): header sticky di bawah top bar & sejajar saat scroll
// horizontal (port ga-web sticky-header-table), sort 3 putaran (default → kebalikan → bawaan),
// kolom bisa digeser (disimpan per perangkat), No & Aksi tetap, body redup saat pending, kosong
// yang menuntun. Data dari Server Component; definisi kolom di file client fitur.

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, GripVertical, MoreHorizontal, RotateCcw } from "lucide-react";
import { useList } from "@/components/list/list-context";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useColumnOrder } from "@/hooks/use-column-order";
import { cn } from "@/lib/utils";

export type SortDirection = "asc" | "desc";

export type Column<Row> = {
  id: string;
  label: string;
  /** Diisi = kolom bisa di-sort (kunci = id, harus ada di whitelist loader); nilai = arah klik pertama */
  sort?: SortDirection;
  /** Kelas <th> & <td> (mis. "text-right", "w-32") */
  className?: string;
  cell: (row: Row, index: number) => ReactNode;
};

// ---------------------------------------------------------------- sort
function nextSort(id: string, current: string, defaultDir: SortDirection): string | null {
  const [key, dir] = current.split(".");
  if (key !== id) return `${id}.${defaultDir}`;
  if (dir === defaultDir) return `${id}.${defaultDir === "asc" ? "desc" : "asc"}`;
  return null; // kembali ke urutan bawaan
}

function SortButton({ id, label, defaultDir, alignRight }: { id: string; label: string; defaultDir: SortDirection; alignRight?: boolean }) {
  const { get, setParams } = useList();
  const current = get("urut");
  const [key, dir] = current.split(".");
  const active = key === id;
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  const next = nextSort(id, current, defaultDir);
  const title = next === null ? "Kembalikan ke urutan bawaan" : next.endsWith(".asc") ? "Urutkan naik" : "Urutkan turun";
  return (
    <button
      type="button"
      onClick={() => setParams({ urut: next })}
      title={title}
      className={cn(
        "group/sort flex h-10 w-full cursor-pointer items-center gap-1 rounded-sm whitespace-nowrap hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        alignRight && "flex-row-reverse",
        active && "text-foreground",
      )}
    >
      {label}
      <Icon className={cn("size-3.5 shrink-0 transition-opacity", !active && "opacity-40 group-hover/sort:opacity-100")} />
    </button>
  );
}

function ariaSort(id: string, current: string) {
  const [key, dir] = current.split(".");
  if (key !== id) return "none" as const;
  return dir === "asc" ? ("ascending" as const) : ("descending" as const);
}

// ---------------------------------------------------------------- geser kolom (HTML5 DnD, desktop)
type Drag = { from: string; over: string | null };
const DragCtx = createContext<{ order: string[]; drag: Drag | null; setDrag: (d: Drag | null) => void; onMove: (a: string, b: string) => void } | null>(null);

function HeadCell<Row>({ column, reorderable }: { column: Column<Row>; reorderable: boolean }) {
  const ctx = useContext(DragCtx);
  const { get } = useList();
  const alignRight = column.className?.includes("text-right");
  const content = column.sort ? <SortButton id={column.id} label={column.label} defaultDir={column.sort} alignRight={alignRight} /> : column.label;

  if (!reorderable || !ctx) {
    return (
      <TableHead className={column.className} aria-sort={column.sort ? ariaSort(column.id, get("urut")) : undefined}>
        {content}
      </TableHead>
    );
  }
  const { order, drag, setDrag, onMove } = ctx;
  const dropSide = drag && drag.over === column.id && drag.from !== column.id ? (order.indexOf(drag.from) < order.indexOf(column.id) ? "right" : "left") : null;
  return (
    <TableHead
      draggable
      title="Geser untuk memindahkan kolom"
      aria-sort={column.sort ? ariaSort(column.id, get("urut")) : undefined}
      className={cn(
        "group/col relative cursor-grab active:cursor-grabbing",
        drag?.from === column.id && "opacity-40",
        dropSide && "before:absolute before:inset-y-1 before:w-0.5 before:rounded-full before:bg-primary",
        dropSide === "left" && "before:left-0",
        dropSide === "right" && "before:right-0",
        column.className,
      )}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", column.label);
        setDrag({ from: column.id, over: null });
      }}
      onDragOver={(e) => {
        if (!drag) return;
        e.preventDefault();
        if (drag.over !== column.id) setDrag({ ...drag, over: column.id });
      }}
      onDrop={(e) => {
        if (!drag) return;
        e.preventDefault();
        onMove(drag.from, column.id);
        setDrag(null);
      }}
      onDragEnd={() => setDrag(null)}
    >
      {/* Ikon geser absolut supaya label tetap sejajar dengan isi sel */}
      <GripVertical
        aria-hidden
        className={cn(
          "no-print absolute top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground opacity-0 transition-opacity pointer-coarse:hidden group-hover/col:opacity-100",
          alignRight ? "right-0" : "left-0",
        )}
      />
      {content}
    </TableHead>
  );
}

// ---------------------------------------------------------------- aksi baris
/**
 * Kolom Aksi: SELALU titik tiga + menu, walau aksinya satu. Item berbahaya paling bawah, merah
 * (DropdownMenuItem variant="destructive"). Satu ConfirmDialog controlled per tabel.
 */
export function RowActionsMenu({ children, label = "Aksi" }: { children: ReactNode; label?: string }) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className="shadow-none" aria-label="Buka menu aksi" />}>
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs text-muted-foreground">{label}</DropdownMenuLabel>
          {children}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------- tabel
export function DataTable<Row>({
  tableKey,
  columns,
  rows,
  rowKey,
  numberOffset = 0,
  actions,
  rowHref,
  onRowClick,
  emptyText,
  filtered,
  emptyAction,
  className = "min-w-[720px]",
  reorderable = true,
}: {
  /** Kunci unik tabel (urutan kolom disimpan per tabel per perangkat) */
  tableKey: string;
  /** HARUS referensi stabil (konstanta di luar komponen) */
  columns: readonly Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  /** (hal - 1) * baris untuk kolom No */
  numberOffset?: number;
  /** Isi menu titik tiga per baris (DropdownMenuItem) */
  actions?: (row: Row) => ReactNode;
  /** Klik baris → halaman ini (Link di kolom kode tetap langsung ke detail) */
  rowHref?: (row: Row) => string;
  /** Klik baris → aksi lain (mis. QuickView). Diprioritaskan di atas rowHref. */
  onRowClick?: (row: Row) => void;
  /** Tanpa filter: "Belum ada pengajuan. Buat lewat tombol di atas." */
  emptyText: string;
  /** true kalau ada filter/cari aktif → kosong menampilkan "Tidak ada yang cocok…" + Reset filter */
  filtered: boolean;
  emptyAction?: ReactNode;
  className?: string;
  reorderable?: boolean;
}) {
  const { isPending, resetFilters } = useList();
  const router = useRouter();
  const { order, ordered, moveColumn, resetOrder, isCustomOrder } = useColumnOrder(tableKey, columns);
  const [drag, setDrag] = useState<Drag | null>(null);
  const colCount = ordered.length + 1 + (actions ? 1 : 0);

  // ---- header sticky terpisah yang menimpa <thead> asli (lebar & scroll disamakan lewat JS)
  const stickyRef = useRef<HTMLDivElement>(null);
  const headScrollRef = useRef<HTMLDivElement>(null);
  const headTableRef = useRef<HTMLTableElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const bodyTableRef = useRef<HTMLTableElement>(null);

  const syncLayout = useCallback(() => {
    const headScroll = headScrollRef.current;
    const headTable = headTableRef.current;
    const container = containerRef.current;
    const bodyTable = bodyTableRef.current;
    if (!headScroll || !headTable || !container || !bodyTable) return;
    headTable.style.width = `${bodyTable.getBoundingClientRect().width}px`;
    const headCells = headTable.tHead?.rows[0]?.cells;
    const bodyCells = bodyTable.tHead?.rows[0]?.cells;
    if (headCells && bodyCells) {
      Array.from(headCells).forEach((cell, i) => {
        const w = bodyCells[i]?.getBoundingClientRect().width;
        if (w) cell.style.width = `${w}px`;
      });
    }
    container.style.marginTop = `-${headScroll.offsetHeight}px`;
  }, []);

  useLayoutEffect(syncLayout);

  useEffect(() => {
    const sticky = stickyRef.current;
    const headScroll = headScrollRef.current;
    const bodyScroll = bodyTableRef.current?.parentElement;
    if (!sticky || !headScroll || !bodyScroll || !bodyTableRef.current) return;
    const topbar = document.querySelector<HTMLElement>("[data-app-topbar]");
    const syncTop = () => {
      sticky.style.top = `${topbar?.offsetHeight ?? 0}px`;
    };
    const syncScroll = () => {
      headScroll.scrollLeft = bodyScroll.scrollLeft;
    };
    const forwardWheel = (e: WheelEvent) => {
      bodyScroll.scrollLeft += e.deltaX || (e.shiftKey ? e.deltaY : 0);
    };
    syncTop();
    syncScroll();
    bodyScroll.addEventListener("scroll", syncScroll, { passive: true });
    headScroll.addEventListener("wheel", forwardWheel, { passive: true });
    const ro = new ResizeObserver(() => {
      syncTop();
      syncLayout();
    });
    ro.observe(bodyTableRef.current);
    if (topbar) ro.observe(topbar);
    return () => {
      bodyScroll.removeEventListener("scroll", syncScroll);
      headScroll.removeEventListener("wheel", forwardWheel);
      ro.disconnect();
    };
  }, [syncLayout]);

  const header = (
    <TableRow className="hover:bg-transparent">
      <TableHead className="w-12 text-center">No</TableHead>
      {ordered.map((c) => (
        <HeadCell key={c.id} column={c} reorderable={reorderable} />
      ))}
      {actions && <TableHead className="w-16 text-right">Aksi</TableHead>}
    </TableRow>
  );

  return (
    <DragCtx value={{ order, drag, setDrag, onMove: moveColumn }}>
      <div className="space-y-2">
        {reorderable && isCustomOrder && (
          <div className="no-print flex items-center justify-end gap-2 text-xs text-muted-foreground">
            Urutan kolom sudah diubah.
            <Button variant="ghost" size="xs" className="shadow-none" onClick={resetOrder}>
              <RotateCcw /> Kembalikan urutan bawaan
            </Button>
          </div>
        )}
        <div>
          {/* pt-2 = jarak dari top bar; latar solid menutup baris yang lewat di celah itu */}
          <div ref={stickyRef} className="no-print sticky z-30 -mt-2 bg-card pt-2">
            <div ref={headScrollRef} className="overflow-hidden rounded-t-md border-x border-t">
              <table ref={headTableRef} className="table-fixed caption-bottom text-sm">
                <TableHeader className="[&_th]:bg-muted [&_th]:text-xs [&_th]:font-semibold [&_th]:text-muted-foreground">{header}</TableHeader>
              </table>
            </div>
          </div>
          <div ref={containerRef} className="rounded-b-md border-x border-b print:!mt-0">
            <Table ref={bodyTableRef} className={cn("printable-list", className)}>
              <TableHeader className="[&_th]:invisible [&_th]:text-xs print:[&_th]:visible">{header}</TableHeader>
              <TableBody className={cn("transition-opacity duration-150", isPending && "opacity-60")}>
                {rows.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={colCount} className="h-24 text-center text-sm text-muted-foreground">
                      {filtered ? (
                        <span>
                          Tidak ada yang cocok dengan filter ini.{" "}
                          <button type="button" onClick={() => resetFilters()} className="font-medium text-primary underline-offset-4 hover:underline">
                            Reset filter
                          </button>
                        </span>
                      ) : (
                        <span className="inline-flex flex-col items-center gap-2">
                          {emptyText}
                          {emptyAction}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row, i) => {
                    const href = rowHref?.(row);
                    const clickable = !!(onRowClick || href);
                    return (
                      <TableRow
                        key={rowKey(row)}
                        className={cn(clickable && "cursor-pointer transition-colors hover:bg-muted/50")}
                        onClick={(e) => {
                          // klik di link/tombol/menu di dalam baris tidak memicu klik baris
                          if ((e.target as HTMLElement).closest("a,button,input,label,[role=menuitem],[data-no-row-click]")) return;
                          if (window.getSelection()?.toString()) return; // sedang menyeleksi teks
                          if (onRowClick) onRowClick(row);
                          else if (href) {
                            if (e.ctrlKey || e.metaKey) window.open(href, "_blank", "noopener");
                            else router.push(href);
                          }
                        }}
                      >
                        <TableCell className="text-center text-muted-foreground tabular-nums">{numberOffset + i + 1}</TableCell>
                        {ordered.map((c) => (
                          <TableCell key={c.id} className={c.className}>
                            {c.cell(row, i)}
                          </TableCell>
                        ))}
                        {actions && (
                          <TableCell className="text-right" data-no-row-click onClick={(e) => e.stopPropagation()}>
                            {actions(row)}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </DragCtx>
  );
}

/** Pakai di sel kode: link langsung ke detail. */
export function CodeLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-mono text-xs font-semibold text-primary underline-offset-4 hover:underline">
      {children}
    </Link>
  );
}
