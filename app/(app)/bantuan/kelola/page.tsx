import type { Metadata } from "next";
import { NoOffline } from "@/components/pwa/pwa-support";
import { PageHeader } from "@/components/page-header";
import { SupportWorkspace, type AdminTab } from "@/components/support/support-workspace";
import { requireAccess } from "@/lib/auth";
import { countThreads, getThread, listAppAdmins, listThreads, type ThreadFilter } from "@/lib/support";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";

export const metadata: Metadata = { title: "Inbox Bantuan" };

const FILTERS: { key: ThreadFilter; label: string }[] = [
  { key: "menunggu", label: "Menunggu" },
  { key: "saya", label: "Percakapan Saya" },
  { key: "dibalas", label: "Dibalas" },
  { key: "selesai", label: "Selesai" },
  { key: "semua", label: "Semua" },
];

// Inbox Bantuan, sisi admin app (frontend-guide §14). Default tab "Menunggu" (yang perlu dibalas).
export default async function BantuanKelolaPage({ searchParams }: PageProps<"/bantuan/kelola">) {
  const access = await requireAccess("admin");
  const sp = await searchParams;
  const filter = (FILTERS.find((f) => f.key === sp.status)?.key ?? "menunggu") as ThreadFilter;
  const t = typeof sp.t === "string" && isUuid(sp.t) ? sp.t : null;
  const supabase = await createClient();
  const [threads, counts, admins, selected] = await Promise.all([
    listThreads(supabase, { me: access.userId, asAdmin: true, filter }),
    countThreads(supabase, access.userId),
    listAppAdmins(supabase),
    t ? getThread(supabase, t, access.userId) : null,
  ]);
  const tabs: AdminTab[] = FILTERS.map((f) => ({
    key: f.key,
    label: f.label,
    count: f.key === "menunggu" ? counts.menunggu : f.key === "saya" ? counts.saya : f.key === "dibalas" ? counts.dibalas : undefined,
    href: `/bantuan/kelola?status=${f.key}`,
    active: f.key === filter,
  }));

  return (
    <>
      {/* data orang lain / percakapan pribadi: jangan disimpan untuk offline */}
      <NoOffline />
      <PageHeader title="Inbox Bantuan" description="Percakapan bantuan dari pengguna app ini." />
      <SupportWorkspace asAdmin basePath="/bantuan/kelola" threads={threads} selected={selected} tabs={tabs} admins={admins} fromPage={null} query={`status=${filter}`} />
    </>
  );
}
