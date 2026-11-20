import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { requireAccess } from "@/lib/auth";
import { listNotifications, type NotificationFilters } from "@/lib/notifications/server";
import { NOTIFICATION_CATEGORIES } from "@/lib/notifications/types";
import { enumParam, textParam } from "@/lib/search-params";
import { createClient } from "@/lib/supabase/server";
import { NotificationList, NotificationSettingsButton } from "./notification-list";

export const metadata: Metadata = { title: "Notifikasi" };

export default async function NotifikasiPage({ searchParams }: PageProps<"/notifikasi">) {
  const access = await requireAccess("viewer");
  const sp = await searchParams;
  const filters: NotificationFilters = {
    status: enumParam(sp, "status", ["semua", "belum"] as const, "semua"),
    kategori: enumParam(sp, "kategori", Object.keys(NOTIFICATION_CATEGORIES)),
    q: textParam(sp, "q"),
  };
  const { items, hasMore } = await listNotifications(await createClient(), access.userId, filters);

  return (
    <>
      <PageHeader title="Notifikasi" description="Semua notifikasi untuk Anda. Notifikasi lama dihapus otomatis (dibaca > 90 hari, belum dibaca > 180 hari)." actions={<NotificationSettingsButton />} />
      <NotificationList key={JSON.stringify(filters)} initial={items} initialHasMore={hasMore} filters={filters} />
    </>
  );
}
