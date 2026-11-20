"use client";

// Kerangka halaman auth (frontend-guide §21, port ga-web/components/auth/auth-shell.tsx).
// Desktop: slideshow foto lapangan di kiri + form di kanan. HP: foto jadi latar penuh, form di kartu.

import { useEffect, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import Image from "next/image";
import { Headset, Palette } from "lucide-react";
import { AppearanceTabs } from "@/components/appearance/appearance-panels";
import { AuthHelpDialog } from "@/components/auth/auth-help-dialog";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/app-config";
import { cn } from "@/lib/utils";

// kbFrom/kbTo = arah geser efek Ken Burns (keyframe auth-kenburns di globals.css)
const SLIDES = [
  { src: "/slide2.webp", kbFrom: "-2%, 1%", kbTo: "2%, -1%", position: "50% 55%" },
  { src: "/slide.webp", kbFrom: "1%, 1%", kbTo: "-2%, -2%", position: "60% 40%" },
  { src: "/slide3.webp", kbFrom: "2%, 0%", kbTo: "-2%, 1%", position: "50% 60%" },
  { src: "/slide4.webp", kbFrom: "0%, 2%", kbTo: "-1%, -2%", position: "50% 40%" },
  { src: "/slide5.webp", kbFrom: "-1%, -1%", kbTo: "2%, 1%", position: "50% 45%" },
  { src: "/slide6.webp", kbFrom: "2%, -1%", kbTo: "-1%, 1%", position: "50% 50%" },
];

const INTERVAL_MS = 6000;
const FADE_MS = 1400;

function subscribeVisibility(cb: () => void) {
  document.addEventListener("visibilitychange", cb);
  return () => document.removeEventListener("visibilitychange", cb);
}

function BackgroundSlideshow() {
  const [index, setIndex] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const hidden = useSyncExternalStore(subscribeVisibility, () => document.hidden, () => false);

  // Ganti slide; dijeda saat tab tersembunyi supaya tidak "loncat" beberapa slide.
  useEffect(() => {
    if (hidden) return;
    const id = window.setTimeout(() => {
      setPrev(index);
      setIndex((index + 1) % SLIDES.length);
    }, INTERVAL_MS);
    return () => window.clearTimeout(id);
  }, [index, hidden]);

  // Slide sebelumnya tetap beranimasi selama fade-out, lalu dilepas
  useEffect(() => {
    if (prev === null) return;
    const id = window.setTimeout(() => setPrev(null), FADE_MS);
    return () => window.clearTimeout(id);
  }, [prev]);

  return (
    <>
      <div className="absolute inset-0" aria-hidden="true">
        {SLIDES.map((slide, i) => {
          const active = i === index;
          return (
            <div
              key={slide.src}
              className={cn("absolute inset-0 transition-opacity ease-in-out", active ? "opacity-100" : "opacity-0")}
              style={{ transitionDuration: `${FADE_MS}ms` }}
            >
              <Image
                src={slide.src}
                alt=""
                fill
                priority={i === 0}
                sizes="(min-width: 1024px) 60vw, 100vw"
                className={cn("object-cover", (active || i === prev) && "auth-kenburns")}
                style={
                  {
                    objectPosition: slide.position,
                    "--kb-from": slide.kbFrom,
                    "--kb-to": slide.kbTo,
                    "--kb-duration": `${INTERVAL_MS + FADE_MS * 2}ms`,
                  } as CSSProperties
                }
              />
            </div>
          );
        })}
      </div>

      {/* Overlay supaya teks & form tetap terbaca di atas foto apa pun */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/55 to-slate-950/30" />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/60 via-transparent to-transparent" />

      <div className="absolute inset-0 hidden flex-col justify-between p-10 text-white lg:flex xl:p-14">
        <div className="flex items-center gap-4">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
            <Image src="/icon.svg" alt="" width={40} height={40} className="size-10 rounded-lg" />
          </div>
          <div className="leading-tight">
            <p className="text-xl font-semibold tracking-tight">{APP_NAME}</p>
            <p className="text-sm text-white/70">Lourdes Auto Parts · GMI · GIS</p>
          </div>
        </div>
        <div className="max-w-2xl space-y-3">
          <h2 className="text-3xl leading-tight font-semibold tracking-tight text-balance xl:text-4xl">
            Satu akun Lourdes untuk semua pekerjaan Anda.
          </h2>
          <p className="max-w-xl text-sm leading-relaxed text-white/75 xl:text-base">{APP_DESCRIPTION}</p>
        </div>
      </div>
    </>
  );
}

/** Lourdes = induk; GMI | GIS di bawahnya. */
export function CompanyLogos({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <Image
        src="/lourdes-logo.webp"
        alt="Lourdes Auto Parts"
        width={1024}
        height={392}
        priority
        className="h-14 w-auto sm:h-16 lg:h-20"
      />
      <div className="flex w-full items-center justify-center gap-3 sm:gap-5 lg:gap-6">
        <div className="flex min-w-0 flex-1 justify-end">
          <Image
            src="/gmi-landscape-stroke.webp"
            alt="PT. Garuda Mart Indonesia"
            width={1098}
            height={148}
            priority
            className="h-auto w-full max-w-[190px] lg:max-w-[235px]"
          />
        </div>
        <span className="h-9 w-px shrink-0 bg-border lg:h-12" aria-hidden="true" />
        <div className="flex min-w-0 flex-1 justify-start">
          <Image
            src="/gis-landscape.webp"
            alt="PT. Global Inti Sejati"
            width={1080}
            height={261}
            priority
            className="h-auto w-full max-w-[160px] lg:max-w-[195px]"
          />
        </div>
      </div>
    </div>
  );
}

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div className="relative min-h-svh w-full lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <aside className="fixed inset-0 overflow-hidden bg-slate-950 lg:sticky lg:inset-auto lg:top-0 lg:h-svh">
        <BackgroundSlideshow />
      </aside>

      <main className="relative z-10 flex min-h-svh flex-col px-4 py-4 sm:px-8 lg:bg-background lg:px-10 xl:px-16">
        <div className="flex justify-end">
          <div className="flex items-center gap-0.5 rounded-lg bg-background/80 p-0.5 backdrop-blur lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
            <Button variant="ghost" size="sm" title="Belum bisa masuk?" aria-label="Belum bisa masuk?" onClick={() => setHelpOpen(true)}>
              <Headset className="text-muted-foreground" size={16} />
            </Button>
            <Popover>
              <PopoverTrigger
                render={
                  <Button variant="ghost" size="sm" title="Tampilan" aria-label="Pengaturan tampilan">
                    <Palette className="text-muted-foreground" size={16} />
                  </Button>
                }
              />
              <PopoverContent align="end" sideOffset={8} className="max-h-[calc(100dvh-6rem)] w-[min(20rem,calc(100vw-1rem))] gap-0 overflow-y-auto p-0">
                <AppearanceTabs />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center py-6">
          <div className="w-full max-w-md rounded-2xl border bg-background/90 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-8 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none">
            <CompanyLogos className="lg:-mx-10" />
            <div className="my-6 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
            <div className="mb-6 space-y-1.5 text-center">
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              {description && <p className="text-sm text-muted-foreground">{description}</p>}
            </div>
            {children}
            {footer}
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <Headset className="size-4 shrink-0 text-primary" />
              <span>
                Belum bisa masuk? <strong className="font-medium text-foreground">Lihat cara mendapat bantuan</strong>
              </span>
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-white/70 lg:text-muted-foreground">
          © {new Date().getFullYear()} Lourdes Auto Parts · {APP_NAME}
        </p>
      </main>

      <AuthHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}
