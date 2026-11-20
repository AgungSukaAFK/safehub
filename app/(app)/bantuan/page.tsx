import type { Metadata } from "next";
import { NoOffline } from "@/components/pwa/pwa-support";
import { PageHeader } from "@/components/page-header";
import { SupportWorkspace } from "@/components/support/support-workspace";
import { requireAccess } from "@/lib/auth";
import { safeFromPath } from "@/lib/safe-next-path";
import { getThread, listThreads } from "@/lib/support";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";

export const metadata: Metadata = { title: "Bantuan Admin" };

// Bantuan Admin, sisi user (frontend-guide §14): percakapan milik sendiri dengan admin app.
export default async function BantuanPage({ searchParams }: PageProps<"/bantuan">) {
  const access = await requireAccess("viewer");
  const sp = await searchParams;
  const t = typeof sp.t === "string" && isUuid(sp.t) ? sp.t : null;
  const supabase = await createClient();
  const [threads, selected] = await Promise.all([
    listThreads(supabase, { me: access.userId, asAdmin: false }),
    t ? getThread(supabase, t, access.userId) : null,
  ]);
  // admin yang membuka thread miliknya dari sini tetap di mode user; thread orang lain → kelola
  const own = selected && selected.user?.id === access.userId ? selected : null;

  return (
    <>
      {/* data orang lain / percakapan pribadi: jangan disimpan untuk offline */}
      <NoOffline />
      <PageHeader title="Bantuan Admin" description="Tanya atau laporkan kendala ke admin app ini. Balasan masuk ke notifikasi Anda." />
      <SupportWorkspace
        asAdmin={false}
        basePath="/bantuan"
        threads={threads}
        selected={own}
        fromPage={safeFromPath(typeof sp.dari === "string" ? sp.dari : null)}
        query=""
      />
    </>
  );
}
