import type { Metadata } from "next";

export const metadata: Metadata = { title: "Offline" };
export const dynamic = "force-static";

// Fallback service worker (frontend-guide §22.1): dipakai saat offline dan halaman tujuan belum pernah
// dibuka di perangkat ini. Statis, tanpa login (dikecualikan dari proxy, di-precache sw.js).
//
// SENGAJA tanpa komponen client: halaman ini disajikan SW di URL lain (mis. /pengguna) saat offline,
// dan chunk JS-nya belum tentu ada di cache, jadi React bisa tidak pernah hydrate. Semua perilaku
// memakai HTML biasa + skrip inline kecil:
// - "Coba lagi" = link ke URL yang sama (muat ulang penuh).
// - Muat ulang otomatis begitu ping /api/health berhasil (event `online` sering terlalu dini), dicoba
//   lagi tiap 10 detik.
const RETRY_SCRIPT = `(function () {
  if (location.pathname === "/~offline") return;
  var t;
  function ping() {
    clearTimeout(t);
    fetch("/api/health", { cache: "no-store" })
      .then(function (r) { if (r.ok) location.reload(); else t = setTimeout(ping, 10000); })
      .catch(function () { t = setTimeout(ping, 10000); });
  }
  window.addEventListener("online", ping);
  t = setTimeout(ping, 10000);
})();`;

export default function OfflinePage() {
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <div className="max-w-sm space-y-4 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
          <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 20h.01M8.5 16.43a5 5 0 0 1 7 0M5 12.86a10 10 0 0 1 5.17-2.69M19 12.86a10 10 0 0 0-2.007-1.523M2 8.82a15 15 0 0 1 4.177-2.643M22 8.82a15 15 0 0 0-11.288-3.764M2 2l20 20" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold">Anda sedang offline</h1>
        <p className="text-sm text-muted-foreground">
          Halaman ini belum pernah dibuka di perangkat ini, jadi belum tersimpan untuk offline. Halaman yang sudah pernah Anda buka tetap bisa dilihat.
          Halaman dimuat ulang otomatis begitu koneksi kembali.
        </p>
        <div className="flex flex-col items-center gap-2">
          {/* href="" = URL yang sama → muat ulang penuh, tanpa JavaScript */}
          <a href="" className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Coba lagi
          </a>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className="text-sm text-primary hover:underline">
            Ke Beranda
          </a>
        </div>
      </div>
      <script dangerouslySetInnerHTML={{ __html: RETRY_SCRIPT }} />
    </main>
  );
}
