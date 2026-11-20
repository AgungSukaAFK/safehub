"use client";

// Halaman Dokumentasi (frontend-guide §20.3). Semua isi dari data (lib/docs); komponen ini generik.
// - Pilih peran di hero → langkah peran itu ditandai di semua section (disimpan per perangkat).
// - Perjalanan & "Tugas Anda" melompat ke langkah di stepper. Deep link: #alur-<id> atau
//   #alur-<id>-langkah-<n> (n mulai 1).
// - Daftar isi: sticky di kanan (desktop), pilihan di atas (HP); section aktif disorot saat scroll.
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ArrowRight, BookOpen, ListTree, X } from "lucide-react";
import { StatusBadge } from "@/components/detail/status-badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DOCS } from "@/lib/docs/content";
import type { DocsContent, RoleId } from "@/lib/docs/types";
import { useStoredState } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { FlowStepper } from "./flow-stepper";
import { RoleChip, STATUS_MAPS } from "./primitives";

// ---------------------------------------------------------------- hash (#alur-x-langkah-n)
function subscribeHash(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}
function useHash() {
  return useSyncExternalStore(subscribeHash, () => window.location.hash.slice(1), () => "");
}

function parseHash(hash: string): { flow: string; step: number | null } | null {
  const m = hash.match(/^alur-(.+?)(?:-langkah-(\d+))?$/);
  return m ? { flow: m[1], step: m[2] ? Number(m[2]) - 1 : null } : null;
}

// ---------------------------------------------------------------- section aktif (scroll spy)
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ids]);
  return active;
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
}

function SectionTitle({ eyebrow, title, desc }: { eyebrow: string; title: string; desc?: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">{eyebrow}</p>
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h2>
      {desc && <p className="text-sm text-muted-foreground">{desc}</p>}
    </div>
  );
}

const SECTION = "scroll-mt-24 rounded-xl border bg-card p-5 shadow-sm sm:p-6";

/** Isi diimpor di sini (bukan props dari server) karena data berisi komponen ikon. */
export function DocsView({ content = DOCS }: { content?: DocsContent }) {
  const { roles, flows } = content;
  const [role, setRole] = useStoredState<RoleId | null>("docs-role", null);
  const [steps, setSteps] = useState<Record<string, number>>({});
  const hash = useHash();
  const fromHash = parseHash(hash);
  const roleOf = (id: RoleId) => roles.find((r) => r.id === id);
  const selectable = roles.filter((r) => r.selectable);

  const stepOf = (flowId: string) => steps[flowId] ?? (fromHash?.flow === flowId && fromHash.step !== null ? fromHash.step : 0);
  const setStep = useCallback((flowId: string, step: number) => setSteps((s) => ({ ...s, [flowId]: step })), []);

  // lompat ke #hash setelah render (konten client)
  useEffect(() => {
    if (!hash) return;
    const id = parseHash(hash) ? `alur-${parseHash(hash)!.flow}` : hash;
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }));
  }, [hash]);

  const jumpTo = (flowId: string, step: number) => {
    setStep(flowId, step);
    history.replaceState(null, "", `#alur-${flowId}-langkah-${step + 1}`);
    scrollToId(`alur-${flowId}`);
  };

  const myTasks = useMemo(
    () => (role ? flows.flatMap((f) => f.steps.map((s, i) => ({ flow: f, step: s, index: i })).filter((x) => x.step.actors.includes(role))) : []),
    [flows, role],
  );

  const toc = useMemo(
    () => [
      { id: "perjalanan", label: "Gambaran besar" },
      ...(role ? [{ id: "tugas-anda", label: "Tugas Anda" }] : []),
      ...flows.map((f) => ({ id: `alur-${f.id}`, label: f.title })),
      { id: "status", label: "Arti status" },
      { id: "faq", label: "Pertanyaan umum" },
    ],
    [flows, role],
  );
  const tocIds = useMemo(() => toc.map((t) => t.id), [toc]);
  const active = useActiveSection(tocIds);

  return (
    <div className="col-span-12 grid gap-6 xl:grid-cols-[minmax(0,1fr)_220px]">
      <div className="min-w-0 space-y-6">
        {/* hero + pilih peran */}
        <section className="relative overflow-hidden rounded-2xl bg-primary px-6 py-8 text-primary-foreground shadow-lg sm:px-8">
          <div aria-hidden className="pointer-events-none absolute -top-20 -right-20 size-64 rounded-full bg-primary-foreground/10 blur-3xl" />
          <div className="relative space-y-4">
            <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] uppercase opacity-80">
              <BookOpen className="size-4" /> Dokumentasi
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-balance sm:text-4xl">{content.intro.title}</h1>
            <p className="max-w-2xl text-primary-foreground/85">{content.intro.desc}</p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Peran Anda">
              {selectable.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  role="radio"
                  aria-checked={role === r.id}
                  onClick={() => setRole(role === r.id ? null : r.id)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
                    role === r.id ? "border-primary-foreground bg-primary-foreground text-primary" : "border-primary-foreground/30 bg-primary-foreground/10 hover:bg-primary-foreground/20",
                  )}
                >
                  <r.icon className="size-4" /> {r.pick ?? r.label}
                </button>
              ))}
              {role && (
                <button type="button" onClick={() => setRole(null)} className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm opacity-80 hover:opacity-100">
                  <X className="size-4" /> Tampilkan semua
                </button>
              )}
            </div>
            {role && <p className="text-sm text-primary-foreground/85">{roleOf(role)?.desc} Langkah Anda ditandai &quot;Anda&quot;.</p>}
          </div>
        </section>

        {/* daftar isi HP */}
        <div className="xl:hidden">
          <Select items={toc.map((t) => ({ value: t.id, label: t.label }))} value={null} onValueChange={(v) => v && scrollToId(String(v))}>
            <SelectTrigger className="w-full bg-card" aria-label="Lompat ke bagian">
              <ListTree className="size-4" />
              <SelectValue placeholder="Lompat ke bagian..." />
            </SelectTrigger>
            <SelectContent>
              {toc.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* gambaran besar */}
        <section id="perjalanan" className={SECTION}>
          <SectionTitle eyebrow="Gambaran besar" title="Perjalanan sebuah dokumen" desc="Klik tahap untuk melihat langkah detailnya." />
          <ol className="relative mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div aria-hidden className="absolute top-6 right-[12%] left-[12%] hidden h-0.5 overflow-hidden rounded bg-border lg:block">
              <div className="docs-grow-x h-full bg-primary/50" />
            </div>
            {content.journey.map((j, i) => (
              <li key={j.title} className="relative">
                <button
                  type="button"
                  onClick={() => jumpTo(j.flow, j.step)}
                  className="docs-fade-up group flex w-full gap-3 rounded-xl border bg-background p-4 text-left transition-colors hover:border-primary/50 lg:flex-col lg:items-center lg:border-0 lg:bg-transparent lg:p-0 lg:text-center"
                  style={{ animationDelay: `${i * 0.1}s` }}
                >
                  <span className="relative flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-4 ring-card transition-transform group-hover:scale-105">
                    <j.icon className="size-5" />
                  </span>
                  <span>
                    <span className="block font-semibold group-hover:underline">{j.title}</span>
                    <span className="block text-sm text-muted-foreground">{j.desc}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>

        {/* tugas peran terpilih */}
        {role && (
          <section id="tugas-anda" className={cn(SECTION, "border-sky-200 dark:border-sky-900")}>
            <SectionTitle eyebrow="Tugas Anda" title={`Yang dikerjakan ${roleOf(role)?.label ?? ""}`} />
            {myTasks.length ? (
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {myTasks.map(({ flow, step, index }) => (
                  <li key={`${flow.id}-${index}`}>
                    <button type="button" onClick={() => jumpTo(flow.id, index)} className="group flex w-full items-center gap-3 rounded-lg border bg-background p-3 text-left hover:border-primary/50">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400">
                        <step.icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{step.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {flow.title} · langkah {index + 1}
                        </span>
                      </span>
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Belum ada langkah khusus untuk peran ini.</p>
            )}
          </section>
        )}

        {/* alur */}
        {flows.map((f) => (
          <section key={f.id} id={`alur-${f.id}`} className={SECTION}>
            <FlowStepper flow={f} step={stepOf(f.id)} onStepChange={(s) => setStep(f.id, s)} activeRole={role} roles={roles} />
          </section>
        ))}

        {/* glosarium status */}
        <section id="status" className={SECTION}>
          <SectionTitle eyebrow="Glosarium" title="Arti status" desc="Badge di bawah sama persis dengan yang tampil di app." />
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {content.glossary.map((g) => (
              <div key={g.title} className="space-y-2">
                <p className="text-sm font-semibold">{g.title}</p>
                <dl className="divide-y rounded-lg border">
                  {g.items.map((it) => (
                    <div key={it.value} className="flex items-start gap-3 px-3 py-2.5">
                      <dt className="w-36 shrink-0">
                        <StatusBadge value={it.value} map={STATUS_MAPS[g.map]} />
                      </dt>
                      <dd className="text-sm text-muted-foreground">{it.desc}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            Peran:{" "}
            {roles.map((r) => (
              <RoleChip key={r.id} role={r} />
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className={SECTION}>
          <SectionTitle eyebrow="FAQ" title="Pertanyaan umum" />
          <Accordion className="mt-4">
            {content.faq.map((f, i) => (
              <AccordionItem key={i} value={String(i)}>
                <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      </div>

      {/* daftar isi desktop */}
      <nav aria-label="Daftar isi" className="hidden xl:block">
        <div className="sticky top-20 space-y-1 rounded-xl border bg-card p-3 text-sm shadow-sm">
          <p className="px-2 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Daftar isi</p>
          {toc.map((t) => (
            <a
              key={t.id}
              href={`#${t.id}`}
              onClick={(e) => {
                e.preventDefault();
                scrollToId(t.id);
              }}
              aria-current={active === t.id ? "true" : undefined}
              className={cn("block rounded-md px-2 py-1.5 transition-colors", active === t.id ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
            >
              {t.label}
            </a>
          ))}
        </div>
      </nav>
    </div>
  );
}
