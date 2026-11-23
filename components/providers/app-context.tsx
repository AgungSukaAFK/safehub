"use client";

// Data sesi yang sudah dibaca SEKALI di layout (app) (server) lalu dibagi ke semua client component:
// akses user, daftar company, app lain milik user, dan hitungan badge awal. Tidak ada query ulang.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AppAccess } from "@/lib/access-types";
import { companyScope, type Company } from "@/lib/company-types";
import type { Site, SiteChoice } from "@/lib/site-types";
import { storageKey } from "@/lib/storage";
import { UPDATE_SEEN_KEY } from "@/lib/update-types";

export type MyApp = { id: string; name: string; description: string | null; url: string | null; role: string };

export type BadgeCounts = {
  notifications: number;
  /** Tugas Saya (my_tasks): approval + tugas workflow */
  tasks: number;
  support: number;
  updates: number;
};

type AppContextValue = {
  access: AppAccess;
  companies: Company[];
  scope: string[] | "ALL";
  myApps: MyApp[];
  /** Site dalam scope user (my_sites), opsi pemilih site */
  sites: Site[];
  /** Pilihan site perangkat saat render (cookie → site profil → site pertama); null = semua */
  initialSite: SiteChoice;
  badges: BadgeCounts;
  setBadge: (key: keyof BadgeCounts, value: number | ((prev: number) => number)) => void;
  /** Foto profil terbaru (berubah tanpa reload lewat event avatar-updated) */
  avatarUrl: string | null;
};

const AppContext = createContext<AppContextValue | null>(null);

export const AVATAR_UPDATED_EVENT = "avatar-updated";

export function AppProvider({
  access,
  companies,
  myApps,
  sites,
  initialSite,
  initialBadges,
  children,
}: {
  access: AppAccess;
  companies: Company[];
  myApps: MyApp[];
  sites: Site[];
  initialSite: SiteChoice;
  initialBadges: BadgeCounts;
  children: ReactNode;
}) {
  const [badges, setBadges] = useState(initialBadges);
  const [avatarUrl, setAvatarUrl] = useState(access.profile.avatarUrl);

  const setBadge = useCallback<AppContextValue["setBadge"]>((key, value) => {
    setBadges((prev) => ({ ...prev, [key]: Math.max(0, typeof value === "function" ? value(prev[key]) : value) }));
  }, []);

  useEffect(() => {
    const onAvatar = (e: Event) => setAvatarUrl((e as CustomEvent<string | null>).detail);
    // Pembaruan dibuka di tab lain → badge di tab ini ikut hilang (frontend-guide §20.1)
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey(UPDATE_SEEN_KEY)) setBadges((prev) => ({ ...prev, updates: 0 }));
    };
    window.addEventListener(AVATAR_UPDATED_EVENT, onAvatar);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(AVATAR_UPDATED_EVENT, onAvatar);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const value = useMemo(
    () => ({
      access,
      companies,
      scope: companyScope({ company: access.profile.company, platformAdmin: access.platformAdmin }, companies),
      myApps,
      sites,
      initialSite,
      badges,
      setBadge,
      avatarUrl,
    }),
    [access, companies, myApps, sites, initialSite, badges, setBadge, avatarUrl],
  );

  return <AppContext value={value}>{children}</AppContext>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp harus dipakai di dalam layout (app)");
  return ctx;
}

/** Versi aman di luar layout (app): null kalau tidak ada. */
export function useOptionalApp() {
  return useContext(AppContext);
}
