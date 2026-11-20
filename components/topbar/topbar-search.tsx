"use client";

// Global search ⌘K (frontend-guide §6.6, port ga-web topbar-search.tsx). lg+: field inline + panel
// hasil di bawahnya. Di bawah lg: tombol ikon → dialog menempel di atas layar (tidak tertutup
// keyboard). ↑/↓ pilih (berputar), Enter buka (Enter sebelum hasil datang → tunggu lalu buka teratas),
// Esc tutup.

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, RotateCw, Search, SearchX, X } from "lucide-react";
import { useApp } from "@/components/providers/app-context";
import { TopbarIconButton } from "@/components/topbar/topbar-icon-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { LogoutConfirm } from "@/components/user/account-menu";
import { buildNavGroups } from "@/lib/nav";
import { setPendingNavUrl } from "@/lib/sidebar/nav-pending";
import { useThemeMode } from "@/lib/theme";
import { useOnline } from "@/lib/offline/use-online";
import { cn } from "@/lib/utils";
import {
  normalizeQuery,
  SEARCH_MIN_CHARS,
  type SearchStatus,
  useGlobalSearch,
  usePendingApprovals,
  useSearchHistory,
} from "./global-search-data";
import { buildSections, type BuildInput, type SearchItem, type SearchSection } from "./search-sections";

const noopSubscribe = () => () => {};

function SearchField({
  inputRef,
  query,
  onQueryChange,
  onKeyDown,
  onFocus,
  loading,
  listId,
  expanded,
  activeId,
  shortcut,
  className,
}: {
  inputRef: Ref<HTMLInputElement>;
  query: string;
  onQueryChange: (q: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onFocus?: () => void;
  loading?: boolean;
  listId: string;
  expanded: boolean;
  activeId?: string;
  shortcut?: ReactNode;
  className?: string;
}) {
  const Icon = loading ? Loader2 : Search;
  return (
    <form
      role="search"
      onSubmit={(e) => e.preventDefault()}
      className={cn(
        "group/search flex h-9 w-full min-w-0 items-center rounded-lg border border-border/70 bg-muted/40 text-muted-foreground shadow-xs transition-colors focus-within:border-ring focus-within:bg-background focus-within:ring-2 focus-within:ring-ring/20 hover:bg-muted/70 focus-within:hover:bg-background",
        className,
      )}
    >
      <Icon className={cn("pointer-events-none ml-3 size-4 shrink-0", loading && "animate-spin")} />
      <input
        ref={inputRef}
        type="search"
        enterKeyHint="search"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        placeholder="Cari dokumen, menu, aksi…"
        aria-label="Cari di seluruh app"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={expanded ? activeId : undefined}
        autoComplete="off"
        className="h-full min-w-0 flex-1 bg-transparent px-2 text-base text-foreground outline-none placeholder:text-muted-foreground md:text-sm [&::-webkit-search-cancel-button]:hidden"
      />
      {query ? (
        <button
          type="button"
          onClick={() => onQueryChange("")}
          aria-label="Hapus pencarian"
          className="mr-1.5 flex size-6 shrink-0 items-center justify-center rounded-md hover:bg-accent hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      ) : (
        shortcut
      )}
    </form>
  );
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function Highlight({ text, query }: { text: string; query: string }) {
  const words = normalizeQuery(query)
    .split(" ")
    .filter((w) => w.length >= 2)
    .map(escapeRegExp);
  if (words.length === 0) return <>{text}</>;
  const parts = text.split(new RegExp(`(${words.join("|")})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded-[3px] bg-primary/15 text-inherit">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

function SearchResults({
  sections,
  listId,
  optionId,
  activeIndex,
  query,
  status,
  onHover,
  onSelect,
  onRetry,
  onClearHistory,
  showKeyHints,
  className,
}: {
  sections: SearchSection[];
  listId: string;
  optionId: (i: number) => string;
  activeIndex: number;
  query: string;
  status: SearchStatus;
  onHover: (i: number) => void;
  onSelect: (item: SearchItem) => void;
  onRetry: () => void;
  onClearHistory: () => void;
  showKeyHints?: boolean;
  className?: string;
}) {
  const q = normalizeQuery(query);
  const empty = sections.length === 0;
  const tooShort = !!q && q.length < SEARCH_MIN_CHARS;

  const online = useOnline();
  let message: ReactNode = null;
  if (!online && q && !tooShort) {
    // menu & aksi lokal tetap dicari; data (RPC) butuh jaringan (frontend-guide §22.3)
    message = <p className="px-4 py-3 text-center text-xs text-amber-700 dark:text-amber-400">Anda offline: pencarian data butuh koneksi internet. Menu & aksi tetap bisa dicari.</p>;
  } else if (status === "error") {
    message = (
      <div className="flex flex-col items-center gap-2 px-4 py-5 text-center text-sm text-muted-foreground">
        Pencarian data gagal dimuat.
        <Button variant="outline" size="xs" onClick={onRetry}>
          <RotateCw /> Coba lagi
        </Button>
      </div>
    );
  } else if (status === "loading" && empty) {
    message = (
      <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Mencari…
      </p>
    );
  } else if (q && empty && !tooShort) {
    message = (
      <div className="flex flex-col items-center gap-2 px-4 py-6 text-center text-sm text-muted-foreground">
        <SearchX className="size-6 opacity-60" />
        <p>
          Tidak ada hasil untuk &ldquo;<span className="font-medium text-foreground">{q}</span>&rdquo;
        </p>
      </div>
    );
  } else if (!q && empty) {
    message = <p className="px-4 py-6 text-center text-sm text-muted-foreground">Ketik nomor dokumen, judul, atau nama menu.</p>;
  }

  let index = 0;
  return (
    // mousedown di panel tidak boleh mencuri fokus dari input
    <div onMouseDown={(e) => e.preventDefault()} className={className}>
      <div className="max-h-[min(30rem,calc(100dvh-10rem))] overflow-y-auto overscroll-contain py-1.5">
        <div id={listId} role="listbox" aria-label="Hasil pencarian">
          {sections.map((section) => {
            const headingId = `${listId}-${section.id}`;
            return (
              <div key={section.id} role="group" aria-labelledby={headingId} className="pb-1">
                <div className="flex items-center justify-between gap-2 px-3.5 pt-2 pb-1">
                  <span id={headingId} className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    {section.label}
                  </span>
                  {section.clearable && (
                    <button
                      type="button"
                      onClick={onClearHistory}
                      className="text-[11px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    >
                      Hapus riwayat
                    </button>
                  )}
                </div>
                {section.items.map((item) => {
                  const i = index++;
                  const Icon = item.icon;
                  const active = i === activeIndex;
                  return (
                    <div
                      key={item.key}
                      id={optionId(i)}
                      role="option"
                      aria-selected={active}
                      onMouseMove={() => onHover(i)}
                      onClick={() => onSelect(item)}
                      className={cn(
                        "mx-1.5 flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5",
                        active && "bg-accent text-accent-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground",
                          item.more && "border-transparent bg-transparent",
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block truncate text-sm", item.more ? "text-muted-foreground" : "font-medium")}>
                          {item.fillQuery !== undefined ? item.title : <Highlight text={item.title} query={query} />}
                        </span>
                        {item.subtitle && (
                          <span className="block truncate text-xs text-muted-foreground">
                            <Highlight text={item.subtitle} query={query} />
                          </span>
                        )}
                      </span>
                      {(item.status || item.hint) && (
                        <span className="flex shrink-0 flex-col items-end gap-0.5">
                          {item.status && (
                            <span className="max-w-[9rem] truncate rounded-full border px-2 py-px text-[10px] font-medium text-muted-foreground">
                              {item.status}
                            </span>
                          )}
                          {item.hint && <span className="text-[11px] text-muted-foreground tabular-nums">{item.hint}</span>}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
        {message}
        {tooShort && (
          <p className="px-3.5 pt-2 pb-1.5 text-xs text-muted-foreground">
            Ketik minimal {SEARCH_MIN_CHARS} huruf untuk mencari dokumen &amp; data.
          </p>
        )}
      </div>
      {showKeyHints && (
        <div className="flex items-center gap-3 border-t px-3.5 py-1.5 text-[11px] text-muted-foreground">
          <span>
            <kbd className="font-sans">↑↓</kbd> pilih
          </span>
          <span>
            <kbd className="font-sans">Enter</kbd> buka
          </span>
          <span>
            <kbd className="font-sans">Esc</kbd> tutup
          </span>
          <span className="ml-auto">
            <kbd className="font-sans">Ctrl/⌘ K</kbd> cari
          </span>
        </div>
      )}
    </div>
  );
}

export function TopbarSearch() {
  const { access } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const { mode, setMode } = useThemeMode();

  const [query, setQuery] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [opening, setOpening] = useState(false);
  const inlineRef = useRef<HTMLInputElement>(null);
  const dialogInputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const optionId = (i: number) => `${listId}-opt-${i}`;
  const open = panelOpen || dialogOpen;

  const isMac = useSyncExternalStore(
    noopSubscribe,
    () => /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent),
    () => null,
  );

  const navGroups = useMemo(() => buildNavGroups(access), [access]);
  const search = useGlobalSearch(query, access.userId);
  const pending = usePendingApprovals(access.userId, open);
  const { history, addDoc, addQuery, clear: clearHistory } = useSearchHistory(access.userId);

  const input: BuildInput = { query, navGroups, access, rows: search.rows, pending, history, theme: mode };
  const sections = useMemo(
    () => buildSections({ query, navGroups, access, rows: search.rows, pending, history, theme: mode }),
    [query, navGroups, access, search.rows, pending, history, mode],
  );
  const items = useMemo(() => sections.flatMap((s) => s.items), [sections]);
  const active = activeIndex < items.length ? activeIndex : 0;

  // ⌘K / Ctrl+K di mana saja
  useEffect(() => {
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key.toLowerCase() !== "k" || !(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      const el = inlineRef.current;
      if (el && el.offsetParent !== null) {
        el.focus();
        el.select();
        setPanelOpen(true);
      } else {
        setDialogOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Tutup panel inline saat klik di luar
  useEffect(() => {
    if (!panelOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setPanelOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [panelOpen]);

  const scrollTo = (i: number) =>
    requestAnimationFrame(() => document.getElementById(optionId(i))?.scrollIntoView({ block: "nearest" }));

  const closeAll = () => {
    setPanelOpen(false);
    setDialogOpen(false);
    inlineRef.current?.blur();
  };

  const select = (item: SearchItem) => {
    if (item.fillQuery !== undefined) {
      setQuery(item.fillQuery);
      setActiveIndex(0);
      (dialogOpen ? dialogInputRef : inlineRef).current?.focus();
      return;
    }
    if (normalizeQuery(query)) addQuery(query);
    if (item.recent) addDoc(item.recent);
    setQuery("");
    setActiveIndex(0);
    closeAll();
    if (item.action?.type === "theme") setMode(item.action.value);
    else if (item.action?.type === "logout") setLogoutOpen(true);
    else if (item.href) {
      const path = item.href.split("?")[0];
      if (path !== pathname) setPendingNavUrl(path);
      router.push(item.href);
    }
  };

  const handleEnter = async () => {
    if (opening) return;
    // Hasil server belum datang & user belum memilih: tunggu lalu buka teratas (kode persis selalu di atas)
    if (active === 0 && search.status === "loading") {
      setOpening(true);
      try {
        const rows = await search.flush();
        const top = buildSections({ ...input, rows }).flatMap((s) => s.items)[0];
        if (top) select(top);
      } catch {
        /* status error ditampilkan panel */
      } finally {
        setOpening(false);
      }
      return;
    }
    const item = items[active];
    if (item) select(item);
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>, inline: boolean) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (inline) setPanelOpen(true);
      if (!items.length) return;
      const next = (active + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      setActiveIndex(next);
      scrollTo(next);
    } else if (e.key === "Enter") {
      e.preventDefault();
      void handleEnter();
    } else if (e.key === "Escape" && inline) {
      setQuery("");
      closeAll();
    }
  };

  const changeQuery = (q: string, inline: boolean) => {
    setQuery(q);
    setActiveIndex(0);
    if (inline) setPanelOpen(true);
  };

  const shortcut = isMac !== null && (
    <kbd className="pointer-events-none mr-2 inline-flex h-5 shrink-0 items-center gap-1 rounded border bg-background px-1.5 font-sans text-[10px] leading-none font-medium whitespace-nowrap select-none group-focus-within/search:hidden">
      {isMac ? "⌘K" : "Ctrl K"}
    </kbd>
  );

  const loading = opening || search.status === "loading";
  const activeId = items.length ? optionId(active) : undefined;
  const results = (keyHints: boolean, className?: string) => (
    <SearchResults
      sections={sections}
      listId={listId}
      optionId={optionId}
      activeIndex={active}
      query={query}
      status={search.status}
      onHover={setActiveIndex}
      onSelect={select}
      onRetry={() => void search.flush().catch(() => {})}
      onClearHistory={clearHistory}
      showKeyHints={keyHints}
      className={className}
    />
  );

  return (
    <>
      <div ref={wrapRef} className="relative hidden w-full max-w-md min-w-0 lg:block">
        <SearchField
          inputRef={inlineRef}
          query={query}
          onQueryChange={(q) => changeQuery(q, true)}
          onKeyDown={(e) => handleKey(e, true)}
          onFocus={() => setPanelOpen(true)}
          loading={loading}
          listId={listId}
          expanded={panelOpen}
          activeId={activeId}
          shortcut={shortcut}
        />
        {panelOpen && (
          <div className="absolute top-full left-1/2 z-50 mt-2 w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10 data-open:animate-in data-open:fade-in-0" data-open="">
            {results(true)}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <TopbarIconButton label="Cari" className="lg:hidden" onClick={() => setDialogOpen(true)}>
          <Search />
        </TopbarIconButton>
        <DialogContent
          showCloseButton={false}
          initialFocus={dialogInputRef}
          className="top-3 max-w-[calc(100%-1.5rem)] translate-y-0 grid-cols-[minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:top-[12vh] sm:max-w-lg"
        >
          <DialogTitle className="sr-only">Cari di seluruh app</DialogTitle>
          <div className="flex items-center gap-1 p-2">
            <SearchField
              inputRef={dialogInputRef}
              query={query}
              onQueryChange={(q) => changeQuery(q, false)}
              onKeyDown={(e) => handleKey(e, false)}
              loading={loading}
              listId={listId}
              expanded={dialogOpen}
              activeId={activeId}
              className="h-10 border-transparent bg-transparent shadow-none focus-within:border-transparent focus-within:bg-transparent focus-within:ring-0"
            />
            <DialogClose render={<Button variant="ghost" size="sm" className="h-10 shrink-0 px-3 shadow-none" />}>Batal</DialogClose>
          </div>
          {results(false, "border-t")}
        </DialogContent>
      </Dialog>

      <LogoutConfirm open={logoutOpen} onOpenChange={setLogoutOpen} />
    </>
  );
}
