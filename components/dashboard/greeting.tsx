"use client";

// Sapaan Beranda (frontend-guide §17.1 no. 1): avatar (bentuk bisa diganti, per perangkat), sapaan
// sesuai jam WIB, departemen · role · perusahaan, tanggal & jam yang berdetak tiap menit.
import { Circle, Square, SquareRoundCorner } from "lucide-react";
import { useApp } from "@/components/providers/app-context";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/user/user-avatar";
import { useNow } from "@/hooks/use-now";
import { formatDateLong, formatTime, greeting } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/roles";
import { useStoredState } from "@/lib/storage";

type Shape = "circle" | "rounded" | "square";
const SHAPES: { value: Shape; label: string; icon: typeof Circle }[] = [
  { value: "circle", label: "Bulat", icon: Circle },
  { value: "rounded", label: "Sudut membulat", icon: SquareRoundCorner },
  { value: "square", label: "Kotak", icon: Square },
];

export function DashboardGreeting({ initialGreeting, initialDate }: { initialGreeting: string; initialDate: string }) {
  const { access, avatarUrl, companies } = useApp();
  const now = useNow();
  const [shape, setShape] = useStoredState<Shape>("dashboard-avatar-shape", "rounded");
  const p = access.profile;
  const company = companies.find((c) => c.code === p.company)?.shortName ?? p.company;
  const firstName = p.fullName.split(" ")[0];
  const hello = now ? greeting(new Date(now)) : initialGreeting;
  const date = now ? `${formatDateLong(now)} · ${formatTime(now)} WIB` : initialDate;

  return (
    <section className="col-span-12 flex items-center gap-4 rounded-xl border bg-card p-5 shadow-sm">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<button type="button" className="shrink-0 cursor-pointer rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none" aria-label="Ubah bentuk avatar" />}
        >
          <UserAvatar name={p.fullName} src={avatarUrl} shape={shape} className="size-14 text-base" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Bentuk avatar</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={shape} onValueChange={(v) => setShape(v as Shape)}>
              {SHAPES.map((s) => (
                <DropdownMenuRadioItem key={s.value} value={s.value}>
                  <s.icon /> {s.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          {hello}, {firstName}!
        </h1>
        <p className="text-sm text-muted-foreground">{[p.departmentName, ROLE_LABELS[access.role], company].filter(Boolean).join(" · ")}</p>
        <p className="text-xs text-muted-foreground tabular-nums">{date}</p>
      </div>
    </section>
  );
}
