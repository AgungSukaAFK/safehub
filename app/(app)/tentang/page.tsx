import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Building2, CheckCircle2, Sparkles, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { requireAccess } from "@/lib/auth";
import { ABOUT, COMPANY_BLURB } from "@/lib/about";
import { getCompanies } from "@/lib/companies";
import { formatDateLong } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { listReleases } from "@/lib/updates";

export const metadata: Metadata = { title: "Tentang App" };

// Tentang App (frontend-guide §20.2, port tampilan ga-web tentang-app). Hero ikut aksen (bg-primary),
// versi & "Apa yang baru" dari post Pembaruan terbaru, isi teks dari lib/about.ts, logo dari
// public.companies.

function SectionHeading({ eyebrow, title, desc }: { eyebrow: string; title: string; desc?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-bold tracking-tight text-balance sm:text-3xl">{title}</h2>
      {desc && <p className="mt-3 leading-relaxed text-pretty text-muted-foreground">{desc}</p>}
    </div>
  );
}

function Pill({ children, solid }: { children: ReactNode; solid?: boolean }) {
  return (
    <span
      className={
        solid
          ? "inline-flex items-center gap-1 rounded-md bg-primary-foreground px-2 py-0.5 text-xs font-semibold text-primary"
          : "inline-flex items-center rounded-md border border-primary-foreground/20 bg-primary-foreground/10 px-2 py-0.5 text-xs font-medium"
      }
    >
      {children}
    </span>
  );
}

export default async function TentangPage() {
  await requireAccess("viewer");
  const supabase = await createClient();
  const [releases, companies] = await Promise.all([listReleases(supabase, 5), getCompanies()]);
  const latest = releases[0] ?? null;
  const group = companies.find((c) => c.isGroup) ?? companies[0];

  return (
    <div className="col-span-12 flex flex-col gap-16 pb-4 xl:col-span-10 xl:col-start-2">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-primary px-6 py-10 text-primary-foreground shadow-lg sm:px-10 sm:py-14">
        <div aria-hidden className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] [background-size:32px_32px] opacity-[0.07]" />
        <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-primary-foreground/15 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-16 size-72 rounded-full bg-primary-foreground/10 blur-3xl" />
        <div className="relative grid items-center gap-10 lg:grid-cols-[1.3fr_1fr]">
          <div className="space-y-5 text-center lg:text-left">
            <div className="flex flex-wrap justify-center gap-2 lg:justify-start">
              {latest && (
                <Link href="/pembaruan" className="rounded-md focus-visible:ring-2 focus-visible:ring-primary-foreground focus-visible:outline-none">
                  <Pill solid>
                    <Sparkles className="size-3" /> Versi {latest.version}
                  </Pill>
                </Link>
              )}
              {ABOUT.badges.map((b) => (
                <Pill key={b}>{b}</Pill>
              ))}
            </div>
            <h1 className="text-3xl leading-tight font-bold tracking-tight text-balance sm:text-5xl">
              {ABOUT.headline.lead} <span className="text-primary-foreground/75">{ABOUT.headline.accent}</span>
            </h1>
            <p className="mx-auto max-w-xl text-base leading-relaxed text-primary-foreground/80 sm:text-lg lg:mx-0">
              <span className="font-semibold text-primary-foreground">{ABOUT.appName}</span> {ABOUT.description}
            </p>
          </div>
          {group && (
            <div className="mx-auto w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-primary-foreground/20 sm:p-8">
              {/* eslint-disable-next-line @next/next/no-img-element -- logo dari public.companies (bisa URL luar) */}
              <img src={group.logoLandscapeUrl} alt={`Logo ${group.name}`} className="pointer-events-none h-auto w-full" />
            </div>
          )}
        </div>
        <div className="relative mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {ABOUT.stats.map(({ icon: Icon, value, label }) => (
            <div key={label} className="rounded-xl border border-primary-foreground/10 bg-primary-foreground/5 p-4 backdrop-blur-sm">
              <Icon className="size-5 text-primary-foreground/80" />
              <p className="mt-3 text-lg font-bold sm:text-xl">{value}</p>
              <p className="text-xs text-primary-foreground/70 sm:text-sm">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Rilis */}
      <section className="space-y-8">
        <SectionHeading eyebrow="Rilis" title="Apa yang baru" desc="Versi app selalu mengikuti catatan Pembaruan terbaru." />
        {latest ? (
          <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            <Link href={`/pembaruan?id=${latest.id}`} className="group rounded-2xl border border-primary/25 bg-primary/5 p-6 transition-colors hover:border-primary/50">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-semibold text-primary">v{latest.version}</span>
                {formatDateLong(latest.createdAt)}
              </div>
              <p className="mt-3 text-lg font-semibold group-hover:underline">{latest.title}</p>
              {latest.highlights.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {latest.highlights.map((h, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /> {h}
                    </li>
                  ))}
                </ul>
              )}
              <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-primary">
                Baca selengkapnya <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
            <div className="rounded-2xl border bg-card p-6 shadow-sm">
              <p className="font-semibold">Riwayat rilis</p>
              <ol className="mt-4 space-y-4 border-l pl-4">
                {releases.map((r) => (
                  <li key={r.id} className="relative">
                    <span aria-hidden className="absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-background bg-primary" />
                    <Link href={`/pembaruan?id=${r.id}`} className="block hover:underline">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        v{r.version} · {formatDateLong(r.createdAt)}
                      </span>
                      <span className="block text-sm font-medium">{r.title}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        ) : (
          <p className="text-center text-sm text-muted-foreground">Belum ada catatan rilis.</p>
        )}
      </section>

      {/* Fitur */}
      <section className="space-y-8">
        <SectionHeading eyebrow="Fitur" title="Semua yang dibutuhkan, dalam satu app" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ABOUT.features.map(({ icon: Icon, title, desc, points }) => (
            <div key={title} className="group flex flex-col rounded-xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-md motion-reduce:hover:translate-y-0">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon className="size-5" />
              </div>
              <p className="mt-4 font-semibold">{title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{desc}</p>
              <ul className="mt-4 space-y-1.5 border-t pt-4">
                {points.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary/70" /> {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Alur kerja */}
      <section className="space-y-8">
        <SectionHeading eyebrow="Cara kerja" title={`${ABOUT.stages.length} tahap alur kerja`} desc="Setiap dokumen bergerak melalui tahapan yang sama, sehingga semua pihak tahu posisi dan tanggung jawabnya." />
        <ol className="relative grid gap-4 lg:grid-cols-5">
          <div aria-hidden className="absolute top-6 right-[10%] left-[10%] hidden h-px bg-gradient-to-r from-primary/0 via-primary/50 to-primary/0 lg:block" />
          {ABOUT.stages.map(({ icon: Icon, title, desc }, i) => (
            <li key={title} className="relative flex gap-4 rounded-xl border bg-card p-5 shadow-sm lg:flex-col lg:items-center lg:border-0 lg:bg-transparent lg:p-0 lg:text-center lg:shadow-none">
              <div className="relative flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-4 ring-background">
                <Icon className="size-5" />
                <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-background text-[10px] font-bold text-primary ring-1 ring-border">{i + 1}</span>
              </div>
              <div>
                <p className="font-semibold">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="text-center">
          <Link href="/dokumentasi" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            Lihat panduan langkah demi langkah <ArrowRight className="size-4" />
          </Link>
        </p>
      </section>

      {/* Peran */}
      <section className="space-y-8">
        <SectionHeading eyebrow="Pengguna" title="Setiap peran punya tugas yang jelas" desc="Menu dan akses menyesuaikan role Anda di app ini." />
        <div className="grid gap-3 sm:grid-cols-2">
          {ABOUT.roles.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex gap-4 rounded-xl border bg-card p-5 shadow-sm">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                <Icon className="size-5" />
              </div>
              <div>
                <p className="font-semibold">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Sebelum / sesudah */}
      <section className="space-y-8">
        <SectionHeading eyebrow="Latar belakang" title="Dari proses manual ke satu sistem" />
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-6 dark:border-rose-900/50 dark:bg-rose-950/20">
            <p className="flex items-center gap-2 font-semibold text-rose-700 dark:text-rose-400">
              <XCircle className="size-5" /> Sebelum
            </p>
            <ul className="mt-5 space-y-5">
              {ABOUT.before.map(({ icon: Icon, title, desc }) => (
                <li key={title} className="flex gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
                    <Icon className="size-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-primary/25 bg-primary/5 p-6">
            <p className="flex items-center gap-2 font-semibold text-primary">
              <CheckCircle2 className="size-5" /> Sesudah, dengan {ABOUT.appName}
            </p>
            <ul className="mt-5 space-y-5">
              {ABOUT.after.map(({ icon: Icon, title, desc }) => (
                <li key={title} className="flex gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Grup perusahaan */}
      {companies.length > 0 && (
        <section className="space-y-8">
          <SectionHeading eyebrow="Grup perusahaan" title={`Dikembangkan untuk ${companies.map((c) => c.shortName).join(", ").replace(/, ([^,]*)$/, " & $1")}`} desc="Satu sistem yang dipakai bersama seluruh entitas grup, dengan alur dan standar yang sama." />
          <div className="grid gap-4 sm:grid-cols-3">
            {companies.map((c) => (
              <div key={c.code} className="group flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:-translate-y-1 hover:shadow-md motion-reduce:hover:translate-y-0">
                {/* latar putih tetap putih di mode gelap supaya logo terbaca */}
                <div className="flex h-36 items-center justify-center border-b bg-white p-6">
                  {/* eslint-disable-next-line @next/next/no-img-element -- logo dari public.companies */}
                  <img src={c.logoLandscapeUrl} alt={`Logo ${c.name}`} className="h-full w-auto max-w-full object-contain transition-transform group-hover:scale-105" />
                </div>
                <div className="flex-1 p-5">
                  <p className="font-semibold">{c.name}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{COMPANY_BLURB[c.code] ?? c.shortName}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Bantuan */}
      <section className="relative overflow-hidden rounded-2xl bg-primary px-6 py-10 text-primary-foreground shadow-lg sm:px-10">
        <div aria-hidden className="pointer-events-none absolute -top-10 -right-10 size-48 rounded-full bg-primary-foreground/10 blur-2xl" />
        <div className="relative space-y-8">
          <div className="mx-auto max-w-2xl space-y-3 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{ABOUT.closing}</h2>
            <p className="text-primary-foreground/90">Butuh bantuan atau punya ide untuk {ABOUT.appName}? Kami siap membantu.</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {ABOUT.help.map(({ icon: Icon, title, desc, href }) => (
              <Link key={href} href={href} className="group flex items-center gap-3 rounded-xl border border-primary-foreground/15 bg-primary-foreground/5 p-4 transition-colors hover:bg-primary-foreground/15">
                <Icon className="size-5 shrink-0 text-primary-foreground/80" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="text-xs text-primary-foreground/70">{desc}</p>
                </div>
                <ArrowRight className="size-4 shrink-0 opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <footer className="flex flex-col items-center gap-1 text-center text-xs text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <Building2 className="size-3.5" /> Dikembangkan untuk {ABOUT.organization}
        </p>
        <p>
          {ABOUT.appName}
          {latest && ` · Versi ${latest.version} · Diperbarui ${formatDateLong(latest.createdAt)}`}
        </p>
      </footer>
    </div>
  );
}
