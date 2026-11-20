"use client";

// Avatar + nama yang bisa diklik → kartu profil (frontend-guide §15.4): foto, nama, perusahaan,
// departemen, jabatan, lokasi, No HP + tombol WhatsApp. Data di-cache per sesi tab.
// Klik di dalam kartu tidak memicu klik baris tabel.

import { useState, type ReactNode } from "react";
import { Briefcase, Building2, Loader2, MapPin, MessageCircle, Phone } from "lucide-react";
import { UserAvatar } from "@/components/user/user-avatar";
import { buttonVariants } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getPersonCardAction } from "@/lib/actions/common";
import type { Person } from "@/lib/person-types";
import { cn } from "@/lib/utils";

const cache = new Map<string, Promise<Person | null>>();

/** Lupakan kartu yang di-cache (mis. setelah user mengganti foto / No HP sendiri). */
export function forgetPersonCard(userId: string) {
  cache.delete(userId);
}

function waNumber(phone: string) {
  const d = phone.replace(/\D/g, "");
  return d.startsWith("0") ? `62${d.slice(1)}` : d;
}

export function UserProfileCard({
  userId,
  name,
  avatarUrl,
  subtitle,
  size = "sm",
  showName = true,
  className,
}: {
  userId: string | null;
  name: string | null;
  avatarUrl?: string | null;
  subtitle?: ReactNode;
  size?: "xs" | "sm" | "md";
  showName?: boolean;
  className?: string;
}) {
  const [person, setPerson] = useState<Person | null>(null);
  const [loading, setLoading] = useState(false);
  const avatarCls = size === "xs" ? "size-6 text-[10px]" : size === "md" ? "size-9" : "size-7 text-[11px]";

  const inner = (
    <>
      <UserAvatar name={name ?? "Sistem"} src={avatarUrl} className={avatarCls} />
      {showName && (
        <span className="min-w-0 text-left leading-tight">
          <span className="block truncate">{name ?? "Sistem"}</span>
          {subtitle && <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>}
        </span>
      )}
    </>
  );

  if (!userId) return <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>{inner}</span>;

  return (
    <Popover
      onOpenChange={(open) => {
        if (!open || person) return;
        if (!cache.has(userId)) cache.set(userId, getPersonCardAction(userId));
        setLoading(true);
        cache.get(userId)!.then((p) => {
          setPerson(p);
          setLoading(false);
        });
      }}
    >
      <PopoverTrigger
        data-no-row-click
        onClick={(e) => e.stopPropagation()}
        className={cn("inline-flex max-w-full min-w-0 cursor-pointer items-center gap-2 rounded-md text-left hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none", className)}
      >
        {inner}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 gap-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <UserAvatar name={name} src={person?.avatarUrl ?? avatarUrl} className="size-12 text-base" />
          <div className="min-w-0">
            <p className="truncate font-semibold">{person?.name ?? name}</p>
            <p className="truncate text-xs text-muted-foreground">{person?.email ?? ""}</p>
          </div>
        </div>
        {loading ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Memuat profil...
          </p>
        ) : person ? (
          <ul className="space-y-1.5 text-sm">
            {person.company && (
              <li className="flex items-center gap-2">
                <Building2 className="size-4 text-muted-foreground" /> {person.company}
                {person.department ? ` · ${person.department}` : ""}
              </li>
            )}
            {person.jobTitle && (
              <li className="flex items-center gap-2">
                <Briefcase className="size-4 text-muted-foreground" /> {person.jobTitle}
              </li>
            )}
            {person.location && (
              <li className="flex items-center gap-2">
                <MapPin className="size-4 text-muted-foreground" /> {person.location}
              </li>
            )}
            {person.phone && (
              <li className="flex items-center gap-2">
                <Phone className="size-4 text-muted-foreground" /> {person.phone}
              </li>
            )}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Profil tidak tersedia.</p>
        )}
        {person?.phone && (
          <a
            href={`https://wa.me/${waNumber(person.phone)}`}
            target="_blank"
            rel="noopener noreferrer"
            data-pwa-new-window
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full")}
          >
            <MessageCircle /> Chat WhatsApp
          </a>
        )}
      </PopoverContent>
    </Popover>
  );
}
