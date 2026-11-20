"use client";

// Form + panel Ringkasan di kanan (frontend-guide §9, port ga-web form-summary-panel.tsx).
// - Panel fixed setinggi layar; desktop ≥1280px mendorong form, layar kecil = overlay + backdrop (Esc).
// - Status buka diingat per perangkat (desktop). Tab vertikal "Ringkasan" saat tertutup (titik amber
//   kalau dirty). Bar submit selalu ada di akhir form.
// - Klik baris checklist → scroll ke section + ring. Klik submit saat masih ada `todo` → scroll ke
//   langkah pertama yang kurang, BUKAN submit. Submit = requestSubmit() pada <form> induk
//   (Server Action), atau `onSubmit` kalau diberikan.
// - Area form: grid 12 kolom + container `@container/form` (pakai `@4xl/form:col-span-8`).

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, Circle, CircleDashed, ListChecks, Loader2, PanelRightClose } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OFFLINE_REASON, useOnline } from "@/lib/offline/use-online";
import { useStoredState } from "@/lib/storage";
import { cn } from "@/lib/utils";

export type CheckStatus = "done" | "todo" | "suggested" | "warning" | "optional";

export type SummaryCheck = {
  id: string;
  label: string;
  status: CheckStatus;
  value?: ReactNode;
  hint?: string;
  /** id section/field yang di-scroll & di-highlight */
  targetId?: string;
};

export type SummaryProps = {
  title: string;
  subtitle?: ReactNode;
  checks: SummaryCheck[];
  /** Konten tambahan di bawah checklist (mis. total estimasi) */
  children?: ReactNode;
  /** "Setelah diajukan, …" */
  nextSteps?: ReactNode;
  submitLabel: string;
  submittingLabel?: string;
  submitIcon?: ReactNode;
  /** Kosongkan = requestSubmit() pada <form> induk */
  onSubmit?: () => void;
  submitting?: boolean;
  /** Nonaktif karena proses lain (upload, offline) — BUKAN karena belum lengkap */
  disabled?: boolean;
  disabledReason?: string;
  error?: string;
  dirty?: boolean;
  /** Mis. "Draft tersimpan · baru saja" */
  status?: ReactNode;
  secondaryActions?: ReactNode;
};

const XL = "(min-width: 1280px)";
const HIGHLIGHT = ["ring-2", "ring-primary", "ring-offset-2", "ring-offset-background"];

export function scrollToFormSection(targetId: string) {
  const el = document.getElementById(targetId);
  if (!el) return;
  const topbar = document.querySelector("[data-app-topbar]");
  const offset = (topbar?.getBoundingClientRect().bottom ?? 0) + 16;
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior: "smooth" });
  el.classList.add(...HIGHLIGHT, "transition-shadow");
  window.setTimeout(() => el.classList.remove(...HIGHLIGHT), 1600);
  const focusable = el.matches("input,textarea,select,button") ? el : el.querySelector<HTMLElement>("input,textarea,select,[role=combobox]");
  window.setTimeout(() => focusable?.focus({ preventScroll: true }), 450);
}

const ICON: Record<CheckStatus, ReactNode> = {
  done: <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />,
  todo: <Circle className="size-4 text-muted-foreground" />,
  suggested: <Circle className="size-4 text-amber-500 dark:text-amber-400" />,
  warning: <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />,
  optional: <CircleDashed className="size-4 text-muted-foreground/70" />,
};

export function summaryProgress(checks: SummaryCheck[]) {
  const counted = checks.filter((c) => c.status !== "optional");
  const done = counted.filter((c) => c.status === "done" || c.status === "warning").length;
  const pending = checks.filter((c) => c.status === "todo");
  const suggested = checks.filter((c) => c.status === "suggested");
  return {
    done,
    total: counted.length,
    pending,
    suggested,
    complete: pending.length === 0 && suggested.length === 0,
    percent: counted.length ? Math.round((done / counted.length) * 100) : 100,
  };
}

function ProgressBadge({ done, total, complete }: { done: number; total: number; complete: boolean }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
        complete ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-muted text-muted-foreground",
      )}
    >
      {done}/{total}
    </span>
  );
}

function DirtyBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
      <span className="size-1.5 rounded-full bg-amber-500" />
      Belum disimpan
    </span>
  );
}

function ProgressHint({ p }: { p: ReturnType<typeof summaryProgress> }) {
  if (p.pending.length > 0)
    return (
      <>
        Lengkapi {p.pending.length} langkah wajib bertanda <Circle className="-mt-0.5 inline size-3" /> dulu.
      </>
    );
  if (p.suggested.length > 0)
    return (
      <>
        {p.suggested.length} data belum lengkap <Circle className="-mt-0.5 inline size-3 text-amber-500" />, tetap bisa disimpan.
      </>
    );
  return <>Semua data lengkap.</>;
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
      <p className="font-medium">Perhatian</p>
      <p>{message}</p>
    </div>
  );
}

function SubmitBtn({ s, onClick }: { s: SummaryProps; onClick: () => void }) {
  const online = useOnline(); // aksi tulis selalu butuh koneksi (draft tetap tersimpan)
  return (
    <Button
      type="button"
      size="lg"
      className="w-full"
      onClick={onClick}
      disabled={s.submitting || s.disabled || !online}
      title={!online ? OFFLINE_REASON : s.disabled ? s.disabledReason : undefined}
      aria-busy={s.submitting || undefined}
    >
      {s.submitting ? <Loader2 className="animate-spin" /> : s.submitIcon}
      {s.submitting ? (s.submittingLabel ?? "Mengajukan...") : s.submitLabel}
    </Button>
  );
}

function subscribeXl(cb: () => void) {
  const mql = window.matchMedia(XL);
  mql.addEventListener("change", cb);
  return () => mql.removeEventListener("change", cb);
}

export function FormSummaryLayout({
  summary,
  children,
  enabled = true,
  className,
}: {
  summary: SummaryProps;
  children: ReactNode;
  /** false = panel, tab & bar submit disembunyikan (halaman detail di luar mode ubah) */
  enabled?: boolean;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const isXl = useSyncExternalStore(subscribeXl, () => window.matchMedia(XL).matches, () => false);
  const [storedOpen, setStoredOpen] = useStoredState("summary-open", false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [animate, setAnimate] = useState(false);
  const open = enabled && (isXl ? storedOpen : overlayOpen);

  // Transisi diaktifkan setelah frame pertama: panel tidak "geser masuk" sendiri saat halaman dibuka
  useEffect(() => {
    const f = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(f);
  }, []);

  useEffect(() => {
    if (!open || isXl) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOverlayOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, isXl]);

  const setOpen = (v: boolean) => (isXl ? setStoredOpen(v) : setOverlayOpen(v));
  const navigate = (targetId: string) => {
    if (!isXl) setOverlayOpen(false);
    scrollToFormSection(targetId);
  };

  const p = summaryProgress(summary.checks);
  const handleSubmit = () => {
    const first = p.pending[0];
    if (first) {
      if (first.targetId) navigate(first.targetId);
      return;
    }
    if (summary.onSubmit) summary.onSubmit();
    else rootRef.current?.closest("form")?.requestSubmit();
  };

  const transition = animate ? "duration-300 ease-out motion-reduce:duration-0" : "duration-0";

  return (
    <div ref={rootRef} className={cn("col-span-12 flex", className)}>
      <div className="@container/form grid min-w-0 flex-1 grid-cols-12 content-start items-start gap-4 md:gap-6 [&>*]:min-w-0">
        {children}

        {enabled && (
          <div className={cn("col-span-12 rounded-xl border bg-card shadow-sm", open && "xl:hidden")} aria-hidden={open && isXl}>
            {summary.error && (
              <div className="px-5 pt-4">
                <ErrorBox message={summary.error} />
              </div>
            )}
            <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <ProgressBadge done={p.done} total={p.total} complete={p.complete} />
                <span className="text-muted-foreground">
                  <ProgressHint p={p} />
                </span>
                {summary.dirty && <DirtyBadge />}
                {summary.status && <span className="text-xs text-muted-foreground">{summary.status}</span>}
                <Button type="button" variant="link" size="sm" className="h-auto px-0" onClick={() => setOpen(true)}>
                  Lihat ringkasan
                </Button>
              </div>
              <div className="flex flex-col gap-2 sm:w-64 sm:shrink-0">
                <SubmitBtn s={summary} onClick={handleSubmit} />
                {summary.secondaryActions}
              </div>
            </div>
          </div>
        )}
      </div>

      {enabled && (
        <>
          <div aria-hidden className={cn("hidden shrink-0 transition-[width] xl:block", transition, open ? "w-[384px]" : "w-0")} />
          <div
            aria-hidden
            onClick={() => setOverlayOpen(false)}
            className={cn("fixed inset-0 z-40 bg-black/40 transition-opacity xl:hidden", transition, open ? "opacity-100" : "pointer-events-none opacity-0")}
          />
        </>
      )}

      <aside
        aria-label={summary.title}
        aria-hidden={!open}
        inert={!open}
        className={cn(
          "no-print fixed inset-y-0 right-0 z-50 w-[min(360px,calc(100vw-3rem))] border-l bg-card shadow-xl transition-transform xl:top-16 xl:z-30 xl:shadow-none xl:group-has-data-[collapsible=icon]/sidebar-wrapper:top-12",
          transition,
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex h-full flex-col">
          <div className="shrink-0 space-y-3 border-b px-5 pt-4 pb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="leading-tight font-semibold [overflow-wrap:anywhere]">{summary.title}</h2>
                {summary.subtitle && <div className="mt-1.5 truncate text-xs text-muted-foreground">{summary.subtitle}</div>}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <ProgressBadge done={p.done} total={p.total} complete={p.complete} />
                <Button type="button" variant="ghost" size="icon-sm" className="-mr-2 shadow-none" onClick={() => setOpen(false)} title="Sembunyikan ringkasan" aria-label="Sembunyikan ringkasan">
                  <PanelRightClose />
                </Button>
              </div>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={p.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Kelengkapan form">
              <div className={cn("h-full rounded-full transition-all duration-500", p.complete ? "bg-emerald-500" : "bg-primary")} style={{ width: `${p.percent}%` }} />
            </div>
            {summary.dirty && <DirtyBadge />}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <ul className="px-2 py-2">
              {summary.checks.map((c) => {
                const clickable = !!c.targetId;
                const Row = clickable ? "button" : "div";
                return (
                  <li key={c.id}>
                    <Row
                      {...(clickable ? { type: "button" as const, onClick: () => navigate(c.targetId!) } : {})}
                      className={cn("group flex w-full items-start gap-2.5 rounded-md px-3 py-2 text-left text-sm", clickable && "transition-colors hover:bg-muted/60")}
                    >
                      <span className="mt-0.5 shrink-0">{ICON[c.status]}</span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "block [overflow-wrap:anywhere]",
                            c.status === "todo" || c.status === "suggested" ? "font-medium" : "text-muted-foreground",
                            c.status === "done" && "line-through decoration-muted-foreground/50",
                          )}
                        >
                          {c.label}
                          {c.status === "optional" && <span className="ml-1 text-[11px] text-muted-foreground/70">(opsional)</span>}
                        </span>
                        {c.hint && (
                          <span
                            className={cn(
                              "mt-0.5 block text-xs [overflow-wrap:anywhere]",
                              c.status === "warning" || c.status === "suggested"
                                ? "text-amber-700 dark:text-amber-400"
                                : c.status === "todo"
                                  ? "text-destructive"
                                  : "text-muted-foreground",
                            )}
                          >
                            {c.hint}
                          </span>
                        )}
                      </span>
                      {c.value !== undefined && c.value !== null && c.value !== "" && <span className="max-w-[50%] truncate text-right font-medium">{c.value}</span>}
                      {clickable && <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground" />}
                    </Row>
                  </li>
                );
              })}
            </ul>
            {summary.children && <div className="border-t px-5 py-4">{summary.children}</div>}
            {summary.nextSteps && <div className="border-t px-5 py-4 text-xs text-muted-foreground">{summary.nextSteps}</div>}
          </div>

          <div className="shrink-0 space-y-3 border-t bg-muted/30 px-5 py-4">
            {summary.error && <ErrorBox message={summary.error} />}
            <SubmitBtn s={summary} onClick={handleSubmit} />
            {summary.status && <p className="text-center text-xs text-muted-foreground">{summary.status}</p>}
            {summary.secondaryActions}
          </div>
        </div>
      </aside>

      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Tampilkan ringkasan"
        title="Tampilkan ringkasan"
        className={cn(
          "no-print fixed top-1/2 right-0 z-30 flex -translate-y-1/2 flex-col items-center gap-1.5 rounded-l-md border border-r-0 bg-primary px-1 py-2 text-primary-foreground shadow-md transition-transform hover:px-1.5",
          transition,
          enabled && !open ? "translate-x-0" : "translate-x-full",
        )}
        tabIndex={enabled && !open ? 0 : -1}
        aria-hidden={!enabled || open}
      >
        {summary.dirty && <span className="absolute -top-1 -left-1 size-2.5 rounded-full border-2 border-background bg-amber-500" />}
        <ListChecks className="size-3.5" />
        <span className="rotate-180 text-[10px] leading-none font-medium [writing-mode:vertical-rl]">Ringkasan</span>
        <span className={cn("rounded-full px-1 py-px text-[9px] font-semibold tabular-nums", p.complete ? "bg-emerald-500 text-white" : "bg-primary-foreground/20")}>
          {p.done}/{p.total}
        </span>
      </button>
    </div>
  );
}
