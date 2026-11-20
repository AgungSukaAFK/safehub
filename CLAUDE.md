# CLAUDE.md: Safe Hub (safehub)

Starter untuk semua app Lourdes. Panduan awal: [frontend-guide.md](frontend-guide.md),
[backend-guide.md](backend-guide.md). Dibuat dari lourdes-boilerplate pada 2026-11-20. Setelah boilerplate jadi,
**kode di repo ini** yang menjadi sumber kebenaran; guide hanya panduan awal (tidak di-patch).

@AGENTS.md

## Penanda boilerplate

Nilai `safehub` / `safehub` / `Safe Hub` (di `lib/app-config.ts`, `db/` lewat
placeholder `__APP__`/`__HOST__`/`__NAME__`, seed `@demo.lourdes.test`) adalah penanda boilerplate. App
nyata menggantinya lewat `scripts/create-app.sh`. Kalau masih terlihat di app nyata: belum diganti.

File bertanda `[starter-standar] direkonstruksi` ditulis ulang dari deskripsi guide karena
`lourdes-db/templates/next-app` tidak tersedia saat boilerplate dibuat. Selaraskan dengan template asli
saat tersedia.

## Arsitektur singkat (termasuk penyimpangan dari standar-app.md)

- Next.js 16.4 (`proxy.ts`), React 19.3, Tailwind 4, shadcn `base-nova` (Base UI), zod 3. Versi dipin.
- **`cacheComponents` dimatikan**: pola standar memakai `requireAccess()` di layout dan loader server
  dinamis per request. Dengan Cache Components, setiap baca cookie wajib di dalam `<Suspense>`.
- Data: Server Component + loader `lib/<domain>.ts`; tulis lewat Server Action → RPC/tabel dengan sesi
  user + RLS. Tidak ada secret key Supabase.
- Client Supabase schema default = schema app (`APP_ID`); platform lewat `.schema("public")`.
- **Menyimpang dari standar §8 (disetujui di frontend-guide)**: sidebar + top bar (bukan header
  `max-w-7xl`); 4 mode tema + aksen (standar: belum ada mode gelap); satu channel realtime global untuk
  notifikasi (+ satu channel di halaman Bantuan).
- Preferensi per perangkat: hanya lewat `lib/storage.ts` (prefix `<app_id>:`).
- Layout `(app)` membaca akses, company, `my_apps`, dan badge SEKALI di server lalu membaginya lewat
  `AppProvider` (`useApp()`); client component tidak query ulang data sesi.
- `Content` (`components/list/content.tsx`) sengaja bukan `<Card>`: Card base-nova memakai
  `overflow-hidden` yang mematikan header tabel sticky.
- Wrapper `PopoverContent`/`DropdownMenuContent` ditambah `collisionPadding` (default 8).
- `cctv(e, { immediate: true })` untuk event yang sesinya hilang di request yang sama (logout).
- **Kit list**: `page.tsx` (server) memanggil loader → baris data biasa → `<fitur>-table.tsx` (client)
  yang berisi `COLUMNS: Column<Row>[]` (konstanta di luar komponen) + `DataTable`. Kolom harus di client
  karena urutannya bisa digeser user. Semua kontrol list di dalam `<ListProvider>` (URL via
  startTransition). Chip filter = data `{key,label,value,params}` disusun server.
- **Kit form**: `FormSummaryLayout` membungkus SELURUH isi halaman form (panel fixed hanya mendorong isi
  layout itu). Submit panel = `requestSubmit()` form induk → Server Action. Nilai field via state
  terkontrol atau `useWatchedForm`; draft via `useFormDraft` + `DraftBanner`.
- **Detail**: `ApprovalPath` membaca `ApprovalStepView` (lib/approval-types.ts); `ActivityLogDialog`
  memuat `<entity>_logs` lewat `loadActivityLogAction` (whitelist `LOG_ENTITIES` di lib/actions/common.ts).
- `useNow()` untuk waktu saat render (Date.now() di render dilarang lint).
- **Contoh dokumen (Pengajuan, hapus saat app punya dokumen asli)**: `lib/pengajuan.ts` (loader SATU
  sumber: `parsePengajuanParams` → `listPengajuan` untuk tabel & ekspor `all: true`, `getPengajuanDetail`),
  `lib/pengajuan-rules.ts` (zod, `newItem`, FIELD_LABELS; aman client+server), `app/(app)/pengajuan/`
  (`actions.ts`, `pengajuan-table.tsx`, `pengajuan-form.tsx` untuk baru & `[id]/ubah`, `[id]/pengajuan-detail.tsx`,
  `ekspor/route.ts`, `[id]/ekspor/route.ts`). Form mengirim JSON `payload` + `intent` (`draft`/`ajukan`).
- Fungsi yang dipanggil di Server Component tidak boleh berasal dari file `"use client"` (taruh di lib bersama).
- Lampiran: browser → Storage `<host>-lampiran/<record_id>/<nama>` langsung (tanpa tabel); daftar via
  `storage.list(id)`. Catatan: policy baca bucket saat ini cukup `viewer` (path berisi uuid dokumen).
- Excel: `lib/excel.ts` (`buildWorkbook` + sheet Keterangan, `xlsxResponse`, `excelFileName`), HANYA server.
- Cetak: `PrintableDocument` (render `print-only` di halaman detail, ukuran px, paginasi diukur) +
  `printWithFileName(code)` + `logPrintAction` (CCTV). `?cetak=qr|basah` memicu cetak otomatis.
- Push: `sendPushForNotifications(notificationIds(rpcResult))` setelah RPC engine (no-op tanpa VAPID env).
- **Notifikasi**: `NotificationProvider` (di layout `(app)`) = satu-satunya channel realtime global
  (`postgres_changes` INSERT `notifications` milik user) → badge (`refreshBadgesAction`), suara
  (`lib/notifications/sound.ts`), notifikasi browser via SW (tab tidak fokus) / toast (tab fokus), event
  `NOTIFICATION_EVENT` untuk halaman terbuka. Pengaturan per perangkat: `useNotificationSettings`
  (`components/notifications/notification-settings.tsx`, dipakai juga di Profil F7).
- **PWA/offline** (`public/sw.js`, `components/pwa/*`, `lib/offline/*`, `lib/pwa/*`): baca offline + draft,
  tanpa antrian tulis. SW: statis cache-first (`static-<CACHE_VERSION>`), navigasi network-first 4 s →
  `pages-<userId>` (30 halaman, 3 hari) → `/~offline`. **Naikkan `CACHE_VERSION`** setiap `sw.js` atau
  `/~offline` berubah. Pemilik cache dikirim `PwaUser` (`set-user`); Keluar → `clear-user-cache`; halaman
  sensitif pakai `<NoOffline />`. Akses cache di SW selalu try/catch (storage rusak tidak boleh mematikan
  Web Push). `/~offline` TANPA komponen client (disajikan di URL lain, chunk-nya belum tentu ter-cache).
  Aksi tulis nonaktif otomatis saat offline di `SubmitButton`, `ConfirmDialog` (kecuali `offlineOk`),
  `FileDropzone`, submit `FormSummaryLayout`. `ThemeColorSync` hanya mengubah atribut meta (jangan
  hapus/tambah elemen `<head>` milik React). Manifest = route `/manifest.json` dari `lib/app-config.ts`;
  ikon PNG dari `public/icon.svg` lewat `npm run icons`. Uji offline di build produksi (mode dev tidak
  hydrate saat offline). `web-push` CJS → `import * as`.
- **Pengguna & Akses** (`/pengguna`, admin): `lib/pengguna.ts` (loader satu sumber tabel + ekspor; embed
  `profile:profiles!app_access_user_id_fkey!inner` karena app_access punya 2 FK ke profiles; filter
  `profile.<kolom>`). Tulis langsung ke `public.app_access` lewat `app/(app)/pengguna/actions.ts`; guard
  **admin aktif terakhir** (`countOtherActiveAdmins`) sebelum turunkan/cabut; CCTV `access.grant/change_role/revoke`.
  Admin platform tidak tercantum (aksesnya dari platform). `/pengguna/[id]`: profil read-only + `members`
  (log lewat trigger, CCTV otomatis). Catatan: policy SELECT `members` = viewer, jadi `admin_note`
  terbaca semua user app lewat API (UI hanya menampilkannya di halaman admin).
- **Foto profil**: `ImageCropDialog` (WebP 512, dikompres < 300 KB) → `uploadAvatarFile` (browser →
  `avatars/<uid>/avatar-<ts>.webp`) → `setAvatarAction` (pasang URL, hapus file lama) → event
  `AVATAR_UPDATED_EVENT` + `forgetPersonCard(uid)` + `router.refresh()`. No HP via `updatePhoneAction`.
- **Beranda** (`app/(app)/page.tsx`): urutan wajib §17.1, tiap blok data = Server Component di
  `components/dashboard/blocks.tsx` dalam `<Suspense>` sendiri (key = periode). Periode di URL
  (`bulan`, `minggu`, `perusahaan`) via `parseDashboardParams` (`lib/dashboard.ts`). Angka = SATU RPC
  `dashboard_summary`; tren `dashboard_daily`, distribusi `dashboard_by_department`, feed `activity_feed`.
  Drill-down & link "Buka di daftar" = loader list Pengajuan dengan filter yang sama (`pengajuanListHref`),
  jadi angka dashboard = total list. Recharts hanya di `charts-inner.tsx` (dimuat `dynamic`, ssr:false);
  definisi seri di `chart-defs.ts`. Token `--viz-1/2` divalidasi `dataviz` di 4 mode; ubah palet = jalankan
  ulang validatornya. Dokumen baru: ganti isi RPC dashboard + `STAT_STATUS`/kartu di `stat-cards.tsx`.
- **Rich text**: simpan JSON Tiptap HANYA lewat `sanitizeDoc` (`lib/rich-text.ts`: node/mark whitelist, link
  http(s)/mailto, gambar = `path` storage). Tampil lewat `RichTextView` (render JSON, tanpa Tiptap/HTML
  mentah). Editor `RichTextEditor` (dynamic, varian `basic`/`full`).
- **Bantuan Admin** (`components/support/*`, `lib/support.ts`): tulis lewat RPC `support_*`; realtime hanya
  channel thread yang terbuka (+ refresh saat notifikasi kategori `bantuan`). Lampiran pesan pertama di
  `support/new-<uid>/` (K9). Konteks perangkat: `collectClientContext` (`lib/client-context.ts`, halaman
  asal dari `?dari=` atau path sebelumnya yang dicatat NavigationProgress).
- **Feedback** (`/feedback`, `/feedback/kelola`): RPC `feedback_submit/set_status`; pelapor baca view
  `feedback_mine` (K7). Lampiran `feedback/<uid>/`.
- **Pembaruan** (`/pembaruan`): tabel langsung (RLS admin). Media private `<host>-media/updates/<kunci>/…` →
  signed URL saat render. Dibuka → `markUpdatesSeenAction` + `writeStorage("update-seen")`; tab lain
  menghapus badge lewat event `storage` di `AppProvider`.
- `cctv({ url })` menerima path app; `lib/cctv.ts` mengubahnya jadi `APP_URL + path` (constraint
  `cctv_events.url ~ '^https://'`).
- **Tentang App** (`/tentang`, Server Component): teks per app di `lib/about.ts`; versi & riwayat rilis dari
  `listReleases` (post Pembaruan, tidak pernah di-hardcode); logo grup dari `getCompanies()`.
- **Dokumentasi** (`/dokumentasi`): data-driven `lib/docs/content.ts` (peran, perjalanan, alur, glosarium,
  FAQ; mock UI tiap langkah = data `MockBlock`). `DocsView` (client) mengimpor data sendiri karena berisi
  komponen ikon (tidak bisa dioper dari server). Deep link `#alur-<id>-langkah-<n>`. Isi contoh = alur
  Pengajuan: ganti bersama contoh Pengajuan.
- Approval: `lib/approval.ts` (`getMyQueue`, `getMyDecisions`, template, kepala departemen;
  `DOC_SUMMARY` per doc_type → tambah baris untuk dokumen baru), `lib/approval-template-rules.ts`
  (`pickTemplate` = cermin urutan `approval_start`).
- **App baru**: `scripts/create-app.sh <app_id> "<Nama>"` (salin, ganti penanda, migration gabungan di
  `db/out/` via mode `migration` = tanpa `09_verify`, `git init`). `09_verify` hanya lewat `--dengan-verifikasi`.
- **QA**: `npm run qa` (Chrome headless via DevTools Protocol, `scripts/qa/`), jalankan terhadap build
  produksi (`npm run build && npm start`). Gagal = exit 1; INP = peringatan. Tambah cek di `qa.mjs` saat
  menambah halaman/pola baru.
- Waktu relatif di client component pakai `<TimeAgo at>` (`components/time-ago.tsx`), BUKAN `timeAgo()`
  langsung saat render: HP lambat hydrate di menit berikutnya → React #418. Kemampuan browser
  (`pushSupported()`, `matchMedia`) hanya dibaca setelah `useHydrated()` atau di effect/handler.
- Layout: `<SidebarInset className="min-w-0">` wajib (konten lebar bergulir di wadahnya). Kolom samping
  sempit pakai `flex flex-col`, jangan grid 12 bersarang (gap 11× melebihi lebar kolom di font XL).
- Modifikasi shadcn (bertanda `[boilerplate]`): `SidebarMenuButton` memasang Tooltip hanya di mode ikon
  desktop; panel menu HP `initialFocus` = kontainer (hindari pemindaian tabbable mahal); overlay
  Sheet/Dialog/AlertDialog `backdrop-blur` hanya `md:`. Pertahankan saat memperbarui komponen shadcn.
- Dev: setelah `next typegen` atau kalau dev server reload terus-menerus, hentikan server lalu hapus `.next/dev`.
- Lint React 19 ketat: jangan `setState` sinkron di effect atau membaca ref saat render; pakai
  `useSyncExternalStore` (`useStoredState`, `useHydrated`, `useIsMobile`).

## Koreksi terhadap guide (sudah diterapkan di `db/`)

| # | Masalah di guide | Perbaikan |
|---|---|---|
| K1 | `pending_for_me` mengurutkan kolom tanpa alias → error | Kolom diberi alias |
| K2 | Batas ukuran `cctv_events` lolos kalau salah satu kolom null | `coalesce(pg_column_size(x), 0)` |
| K3 | `approval_start` tidak mengecek status dokumen | `approval_context.status`; hanya `draft`/`rejected` yang bisa diajukan |
| K4 | Log frontend punya FK cascade, backend tidak | Ikut backend: log tanpa FK (tetap ada saat dokumen dihapus) |
| K5 | Frontend menyebut `company_visible()` | Ditambahkan sebagai pembungkus `my_company_scope()` |
| K6 | Beberapa RPC hanya dideskripsikan | Ditulis lengkap: `approval_cancel/override`, `request_followup`, `push_*`, `support_*`, `feedback_*`, `approval_template_save` |
| K7 | `admin_note` feedback bisa dibaca pelapor langsung dari tabel | Tabel hanya admin; pelapor lewat view `feedback_mine` (owner-rights, difilter `auth.uid()`) |
| K8 | Pola `x = any ((select f()))` dibaca Postgres sebagai subquery → "malformed array literal" | `x = any ((select f())::text[])` (tetap initplan, dievaluasi sekali) |
| K9 | Lampiran pesan pertama Bantuan diunggah ke `support/new-<uid>/`, tapi policy read hanya mengenal folder id thread → file tidak terbaca siapa pun | Policy read: pemilik folder `new-<uid>` + admin app |

Tambahan: `log_changes` membaca `app.log_extra` supaya RPC penyimpan dokumen menulis ringkasan item di
baris log yang sama (satu aksi = satu baris log); `verify_token` tidak ikut riwayat.

## Perintah

```bash
npm run dev | build | lint | typecheck
npm run db:test            # uji semua SQL (container sekali pakai)
npm run db:local -- apply  # pasang ke Supabase lokal db-lourdes
npm run db:types           # generate types/database.ts
```

Detail `db/`: [db/README.md](db/README.md).
