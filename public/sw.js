/* Service worker app (frontend-guide §13.6, §22). Level offline: BACA halaman yang pernah dibuka +
   draft form (draft di localStorage, bukan di sini). Tidak ada antrian tulis.
   - Aset statis: cache-first (static-<versi>).
   - Navigasi halaman app: network-first (timeout 4 s) → salinan di pages-<userId> (maks 30, 3 hari)
     → offline: salinan terakhir → /~offline.
   - RSC / fetch / Server Action / Supabase TIDAK disentuh.
   - Keamanan: cache halaman per user; dihapus saat Keluar atau saat user berganti; halaman dengan
     <meta name="x-no-offline"> tidak pernah disimpan.
   NAIKKAN CACHE_VERSION setiap file ini atau /~offline berubah. */

const CACHE_VERSION = "v6";
const STATIC = `static-${CACHE_VERSION}`;
const META = "sw-meta";
const PAGES_PREFIX = "pages-";
const OFFLINE_URL = "/~offline";
const PRECACHE = [OFFLINE_URL, "/manifest.json", "/icon.svg", "/icons/icon-192.png", "/icons/icon-512.png"];
const MAX_PAGES = 30;
const MAX_AGE_MS = 3 * 24 * 3600 * 1000;
const NET_TIMEOUT_MS = 4000;
const NO_CACHE_PATHS = [/^\/auth(\/|$)/, /^\/selamat-datang(\/|$)/, /^\/api\//, /\/ekspor(\/|$)/, /^\/verifikasi(\/|$)/, /^\/no-access(\/|$)/, /^\/~offline$/];
const STATIC_PATHS = [/^\/_next\/static\//, /^\/_next\/image$/, /^\/icons\//, /\.(?:woff2?|svg|png|jpg|jpeg|webp|gif|ico)$/];

// ---------------------------------------------------------------- pemilik cache (userId)
let userId; // undefined = belum dibaca dari META
async function getUser() {
  if (userId !== undefined) return userId;
  try {
    const res = await (await caches.open(META)).match("/__sw-user");
    userId = res ? (await res.text()) || null : null;
  } catch {
    userId = null; // storage tidak tersedia → tanpa cache halaman
  }
  return userId;
}
async function setUser(id) {
  const meta = await caches.open(META);
  const prev = await getUser();
  if (prev && prev !== id) await deletePages(); // user berganti di perangkat ini → buang cache lama
  userId = id || null;
  if (userId) await meta.put("/__sw-user", new Response(userId));
  else await meta.delete("/__sw-user");
}
async function deletePages() {
  const keys = await caches.keys();
  await Promise.all(keys.filter((k) => k.startsWith(PAGES_PREFIX)).map((k) => caches.delete(k)));
}

// ---------------------------------------------------------------- lifecycle
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      // Cache gagal (disk penuh, storage diblokir) TIDAK boleh menggagalkan install: SW tetap dibutuhkan
      // untuk Web Push. Offline saja yang tidak tersedia.
      try {
        const cache = await caches.open(STATIC);
        // satu per satu: satu file gagal tidak membatalkan semuanya
        await Promise.all(PRECACHE.map((u) => cache.add(new Request(u, { cache: "reload" })).catch(() => {})));
      } catch {
        /* lanjut tanpa precache */
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("static-") && k !== STATIC).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "set-user") event.waitUntil(setUser(typeof data.userId === "string" ? data.userId : null));
  // aset yang dimuat SEBELUM SW mengendalikan halaman (kunjungan pertama) → simpan juga
  if (data.type === "warm" && Array.isArray(data.urls)) event.waitUntil(warm(data.urls));
  if (data.type === "clear-user-cache") event.waitUntil(Promise.all([deletePages(), setUser(null)]));
});

async function warm(urls) {
  try {
    const cache = await caches.open(STATIC);
    const ok = urls
      .map((u) => {
        try {
          return new URL(u, self.location.origin);
        } catch {
          return null;
        }
      })
      .filter((u) => u && u.origin === self.location.origin && STATIC_PATHS.some((r) => r.test(u.pathname)))
      .slice(0, 200);
    await Promise.all(ok.map(async (u) => ((await cache.match(u.href)) ? null : cache.add(u.href).catch(() => {}))));
  } catch {
    /* best-effort */
  }
}

// ---------------------------------------------------------------- fetch
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    if (NO_CACHE_PATHS.some((r) => r.test(url.pathname))) return;
    event.respondWith(navigate(event, req));
    return;
  }
  if (STATIC_PATHS.some((r) => r.test(url.pathname))) event.respondWith(cacheFirst(req));
});

async function cacheFirst(req) {
  let cache = null;
  try {
    cache = await caches.open(STATIC);
    const hit = await cache.match(req);
    if (hit) return hit;
  } catch {
    /* storage bermasalah → langsung jaringan */
  }
  const res = await fetch(req);
  if (cache && res.ok && res.type === "basic") cache.put(req, res.clone()).catch(() => {});
  return res;
}

function fresh(res) {
  const at = Number(res.headers.get("x-sw-cached-at") || 0);
  return Date.now() - at < MAX_AGE_MS;
}

async function savePage(uid, req, res) {
  const html = await res.clone().text();
  if (/<meta[^>]+name="x-no-offline"/.test(html)) return;
  const headers = new Headers(res.headers);
  headers.set("x-sw-cached-at", String(Date.now()));
  const cache = await caches.open(PAGES_PREFIX + uid);
  await cache.delete(req); // LRU: urutan keys() = urutan disimpan
  await cache.put(req, new Response(html, { status: 200, statusText: "OK", headers }));
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_PAGES)).map((k) => cache.delete(k)));
}

async function cachedPage(uid, req) {
  if (!uid) return null;
  try {
    const hit = await (await caches.open(PAGES_PREFIX + uid)).match(req);
    return hit && fresh(hit) ? hit : null;
  } catch {
    return null;
  }
}

async function navigate(event, req) {
  const uid = await getUser();
  const network = fetch(req).then((res) => {
    const html = (res.headers.get("content-type") || "").includes("text/html");
    // jangan simpan redirect (mis. ke login), error, atau halaman tanpa pemilik
    if (uid && res.ok && res.status === 200 && !res.redirected && html) event.waitUntil(savePage(uid, req, res).catch(() => {}));
    return res;
  });

  // jaringan lambat: pakai salinan kalau ada, tapi tetap biarkan request selesai (memperbarui cache)
  const timeout = new Promise((resolve) => setTimeout(resolve, NET_TIMEOUT_MS, "timeout"));
  try {
    const first = await Promise.race([network, timeout]);
    if (first !== "timeout") return first;
    const copy = await cachedPage(uid, req);
    return copy || (await network);
  } catch {
    const copy = await cachedPage(uid, req);
    if (copy) return copy;
    const offline = await caches
      .open(STATIC)
      .then((c) => c.match(OFFLINE_URL))
      .catch(() => null);
    return offline || new Response("Anda sedang offline.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}

// ---------------------------------------------------------------- Web Push (F6)
// Push dari server (lib/push.ts): { title, body, url, tag }
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: event.data ? event.data.text() : "Notifikasi baru" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Notifikasi baru", {
      body: data.body || undefined,
      tag: data.tag || undefined,
      renotify: !!data.tag,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/" },
    }),
  );
});

// Klik: fokus window yang sudah di URL itu → window app lain lalu pindah URL → baru buka window baru
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const exact = wins.find((w) => w.url === url);
      if (exact) return exact.focus();
      const any = wins.find((w) => new URL(w.url).origin === self.location.origin);
      if (any) {
        await any.focus();
        return any.navigate(url).catch(() => self.clients.openWindow(url));
      }
      return self.clients.openWindow(url);
    })(),
  );
});
