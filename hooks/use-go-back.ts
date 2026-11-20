"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";

/**
 * Tombol "Kembali": ke halaman sebelumnya kalau ada riwayat di app ini, kalau tidak (dibuka dari
 * notifikasi push / link langsung) ke `fallback`. Jangan pakai router.back() langsung.
 */
export function useGoBack(fallback: string) {
  const router = useRouter();
  return useCallback(() => {
    const sameOrigin = document.referrer && new URL(document.referrer).origin === window.location.origin;
    if (window.history.length > 1 && sameOrigin) router.back();
    else router.push(fallback);
  }, [router, fallback]);
}
