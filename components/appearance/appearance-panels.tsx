"use client";

// Panel Tampilan (frontend-guide §5): Tema / Aksen / Font. Dipakai di top bar, halaman Profil,
// dan halaman auth. Penanda opsi terpilih punya view-transition-name sendiri supaya bergeser.

import type { CSSProperties, ReactNode } from "react";
import { useHydrated } from "@/hooks/use-hydrated";
import { Check, Monitor, Moon, MoonStar, Sun, SunDim } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { accentThemes, fontFamilies, fontSizes, themeModes, type ThemeMode } from "@/lib/font-options";
import { useAppearance, useThemeMode } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { originFromEvent } from "@/lib/view-transition";

const MODE_ICONS: Record<ThemeMode, typeof Sun> = {
  light: Sun,
  "soft-light": SunDim,
  dark: Moon,
  "soft-dark": MoonStar,
  system: Monitor,
};

const companyThemes = accentThemes.filter((t) => t.group === "company");
const generalThemes = accentThemes.filter((t) => t.group === "general");

function SectionLabel({ children }: { children: ReactNode }) {
  return <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{children}</span>;
}

/** Latar opsi terpilih yang dianimasikan bergeser (induk wajib `relative isolate`). */
function SelectedIndicator({ name, className }: { name: string; className: string }) {
  return (
    <span
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 -z-10", className)}
      style={{ viewTransitionName: name }}
    />
  );
}

export function ThemeModePanel() {
  const mounted = useHydrated();
  const { mode, setMode } = useThemeMode();

  return (
    <>
      <SectionLabel>Mode Tampilan</SectionLabel>
      <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Mode tampilan">
        {themeModes.map(({ name, label }) => {
          const Icon = MODE_ICONS[name];
          const selected = mounted && mode === name;
          return (
            <button
              key={name}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={(e) => setMode(name, originFromEvent(e))}
              className={cn(
                "relative isolate flex flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 text-xs transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                selected && "font-semibold",
              )}
            >
              {selected && (
                <SelectedIndicator name="appearance-mode" className="rounded-lg border border-primary bg-primary/5" />
              )}
              <Icon className={cn("size-4", selected ? "text-primary" : "text-muted-foreground")} />
              {label}
            </button>
          );
        })}
      </div>
    </>
  );
}

export function AccentPanel() {
  const { accent, setAccent, accentChosen } = useAppearance();

  return (
    <>
      <SectionLabel>Warna Perusahaan</SectionLabel>
      <div className="grid grid-cols-2 gap-1.5">
        {companyThemes.map((t) => {
          const selected = accent === t.name;
          return (
            <button
              key={t.name}
              type="button"
              aria-pressed={selected}
              onClick={() => setAccent(t.name)}
              className="relative isolate flex items-center gap-2 rounded-lg border px-2 py-1.5 text-sm transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {selected && (
                <SelectedIndicator name="appearance-accent" className="rounded-lg border border-primary bg-primary/5" />
              )}
              <span className="size-5 shrink-0 rounded-full border" style={{ backgroundColor: t.color }} />
              <span className="font-semibold">{t.label}</span>
              {selected && <Check className="ml-auto size-4" />}
            </button>
          );
        })}
      </div>

      <div className="my-3 h-px bg-border" />

      <SectionLabel>Warna Umum</SectionLabel>
      <div className="grid grid-cols-4 gap-1">
        {generalThemes.map((t) => {
          const selected = accent === t.name;
          return (
            <button
              key={t.name}
              type="button"
              aria-pressed={selected}
              onClick={() => setAccent(t.name)}
              title={t.label}
              className="relative isolate flex flex-col items-center gap-1 rounded-md px-1 py-1.5 transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {selected && <SelectedIndicator name="appearance-accent" className="rounded-md bg-accent" />}
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full border",
                  selected && "ring-2 ring-offset-2 ring-offset-background",
                )}
                style={{ backgroundColor: t.color, "--tw-ring-color": t.color } as CSSProperties}
              >
                {selected && <Check className="size-3.5 text-white" />}
              </span>
              <span className="w-full truncate text-center text-[11px] leading-tight">
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
      {!accentChosen && (
        <p className="mt-3 text-xs text-muted-foreground">Saat ini memakai aksen default app (GMI K3).</p>
      )}
    </>
  );
}

export function FontPanel() {
  const { fontFamily, setFontFamily, fontSize, setFontSize } = useAppearance();
  const sizeIndex = Math.max(
    0,
    fontSizes.findIndex((s) => s.name === fontSize),
  );

  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Ukuran Font</span>
        <span className="text-xs font-semibold">{fontSizes[sizeIndex].label}</span>
      </div>
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1.5">
        <span className="text-xs text-muted-foreground">A</span>
        <Slider
          min={0}
          max={fontSizes.length - 1}
          step={1}
          value={[sizeIndex]}
          onValueChange={(v) => {
            const i = Array.isArray(v) ? v[0] : v;
            setFontSize(fontSizes[i].name);
          }}
          aria-label="Ukuran font"
        />
        <span className="text-lg leading-none text-muted-foreground">A</span>
        <div className="col-start-2 flex justify-between px-2">
          {fontSizes.map((s, i) => (
            <button
              key={s.name}
              type="button"
              onClick={() => setFontSize(s.name)}
              className="flex w-0 flex-col items-center gap-1"
              aria-label={`Ukuran ${s.label}`}
            >
              <span className={cn("h-1.5 w-px bg-border", i === sizeIndex && "bg-primary")} />
              <span
                className={cn(
                  "text-[10px] leading-tight whitespace-nowrap text-muted-foreground",
                  i === sizeIndex && "font-semibold text-foreground",
                )}
              >
                {s.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="my-3 h-px bg-border" />

      <SectionLabel>Jenis Font</SectionLabel>
      <div className="flex flex-col gap-0.5">
        {fontFamilies.map((f) => {
          const selected = fontFamily === f.name;
          return (
            <button
              key={f.name}
              type="button"
              aria-pressed={selected}
              onClick={() => setFontFamily(f.name)}
              className="relative isolate flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              style={{ fontFamily: f.preview }}
            >
              {selected && <SelectedIndicator name="appearance-font" className="rounded-md bg-accent" />}
              <span className="flex-1">{f.label}</span>
              {selected && <Check className="size-4 shrink-0" />}
            </button>
          );
        })}
      </div>
    </>
  );
}

/** Tiga tab Tema / Aksen / Font (isi popover Tampilan di top bar). */
export function AppearanceTabs({ defaultTab = "theme" }: { defaultTab?: "theme" | "accent" | "font" }) {
  return (
    <Tabs defaultValue={defaultTab} className="gap-0">
      <div className="border-b p-2">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="theme">Tema</TabsTrigger>
          <TabsTrigger value="accent">Aksen</TabsTrigger>
          <TabsTrigger value="font">Font</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="theme" className="mt-0 p-3">
        <ThemeModePanel />
      </TabsContent>
      <TabsContent value="accent" className="mt-0 p-3">
        <AccentPanel />
      </TabsContent>
      <TabsContent value="font" className="mt-0 p-3">
        <FontPanel />
      </TabsContent>
    </Tabs>
  );
}
