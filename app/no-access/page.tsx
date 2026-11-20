import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { ExternalLink, LayoutGrid, ShieldOff } from "lucide-react";
import { NoAccessSignOut } from "./sign-out-button";
import { APP_ID, APP_NAME } from "@/lib/app-config";
import { getAccessResult } from "@/lib/auth";
import { isRole, ROLE_LABELS } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Belum punya akses" };

// [starter-standar] direkonstruksi + rasa ga-web (frontend-guide §21): kartu ramah + app lain yang bisa dibuka.
export default async function NoAccessPage() {
  const result = await getAccessResult();
  if (result.status === "guest") redirect("/auth/login");
  if (result.status === "ok") redirect("/");

  const supabase = await createClient();
  const { data: apps } = await supabase.schema("public").rpc("my_apps");
  const others = (apps ?? []).filter((a) => a.id !== APP_ID && a.id !== "platform" && a.url);
  const inactive = result.status === "inactive";

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border bg-card p-6 text-card-foreground shadow-sm sm:p-8">
        <Image src="/lourdes-logo.webp" alt="Lourdes Auto Parts" width={1024} height={392} className="mx-auto h-12 w-auto" />
        <div className="space-y-2 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
            <ShieldOff className="size-6" />
          </span>
          <h1 className="text-xl font-semibold tracking-tight">
            {inactive ? "Akun Anda tidak aktif" : `Akun Anda belum punya akses ke ${APP_NAME}`}
          </h1>
          <p className="text-sm text-muted-foreground">
            {inactive
              ? "Profil akun Anda belum lengkap atau sudah dinonaktifkan."
              : "Minta akses ke atasan Anda (Department Head) atau tim IT. Admin app ini yang memberikan akses."}
          </p>
        </div>

        {others.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">App yang sudah bisa Anda buka</p>
            <ul className="divide-y rounded-lg border">
              {others.map((a) => (
                <li key={a.id}>
                  <a href={a.url!} className="flex items-center gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-muted/50">
                    <LayoutGrid className="size-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{a.name}</span>
                      <span className="block text-xs text-muted-foreground">{isRole(a.role) ? ROLE_LABELS[a.role] : a.role}</span>
                    </span>
                    <ExternalLink className="size-3.5 text-muted-foreground" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <NoAccessSignOut />
      </div>
    </main>
  );
}
