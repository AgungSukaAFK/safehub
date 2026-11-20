"use client";

// Waktu relatif ("5 menit lalu") yang aman untuk hydration. Server dan browser bisa berbeda menit
// (HP lambat hydrate setelah pergantian menit) → React error #418. Teks di-suppress saat hydration lalu
// diperbarui tiap menit lewat useNow(). Waktu lengkap WIB di `title`.
import { useNow } from "@/hooks/use-now";
import { formatDateTime, timeAgo } from "@/lib/format";

export function TimeAgo({ at, className }: { at: string | number | Date; className?: string }) {
  const now = useNow(); // 0 saat render server & hydration
  return (
    <time dateTime={new Date(at).toISOString()} title={formatDateTime(at)} className={className} suppressHydrationWarning>
      {timeAgo(at, now ? new Date(now) : undefined)}
    </time>
  );
}
