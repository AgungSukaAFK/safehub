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
- **Beranda** (`app/(app)/page.tsx`; sejak fase 2 = Beranda K3, lihat bagian fase 2): urutan wajib §17.1, tiap blok data = Server
  Component dalam `<Suspense>` sendiri. Blok Pengajuan lama (`blocks.tsx`: Summary/Charts/Insight) tidak lagi dipasang.
  Catatan lama untuk contoh Pengajuan: periode di URL
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
- Approval: `lib/approval.ts` (`getMyQueue`, `getMyDecisions`, `getDocSummaries`, template, kepala departemen;
  `DOC_SUMMARY` per doc_type → tambah baris untuk dokumen baru), `lib/approval-template-rules.ts`
  (`pickTemplate` = cermin urutan `approval_start`).

## Safe Hub: fondasi K3 (fase 0, rancangan-implementasi.md)

Rancangan modul & keputusan D1–D15 ada di [rancangan-implementasi.md](rancangan-implementasi.md).

- **Fungsi K3** (D1, D14): role app tetap `viewer<editor<admin`; lapis kedua `members.functions text[]`
  (daftar di `lib/functions.ts` HARUS sama dengan constraint di `db/app/01_base.sql`, termasuk `hse_senior`).
  Kolom `functions`/`location_ids` dijaga `members_guard` (hanya admin). DB: `my_functions()`,
  `has_function()`, `has_any_function()`; policy pakai `'x' = any ((select my_functions())::text[])` (K8).
  App: `access.functions` (dibaca sekali di `getAccessResult`), `hasFunction()`, `NavItem.functions`.
  Diatur di `/pengguna/[id]` kartu "Peran K3" (`saveK3RolesAction`, CCTV `access.change_function`).
- **Site** (D2, D13): site = `public.locations` (baca saja). Batas opsional `members.location_ids`
  (null = semua); `my_location_scope()` (`'{*}'` = semua), `location_visible()`, `my_sites()`. Tabel
  operasional: `location_id` + policy scope company **dan** scope site. Pemilih site di top bar
  (`components/topbar/site-picker.tsx`): localStorage `site` + **cookie `safehub-site`** (penyimpangan:
  supaya loader server membaca pilihan tanpa navigasi ulang) + param URL `site` (`semua` = semua).
  Loader: `parseSiteParam(sp, access)` (`lib/sites.ts`) → URL → cookie → site profil → site pertama.
- **Master app** (`db/app/10_fondasi.sql`): `areas` (per site), `master_items` (kind
  `incident_category`/`risk_level`; `code` tetap, guard), `contractors` (mitra per company). Tidak ada
  DELETE (nonaktifkan). Log config + CCTV lewat `log_changes('config')`. UI generik `/master`
  (`lib/master-rules.ts` = konfigurasi per jenis + zod, `lib/master.ts`, `saveMasterAction`). Site &
  jabatan hanya ditampilkan; unit dibaca dari sistem maintenance (D7, D15: sebelum fase 5 isian bebas
  `unit_code` + `unit_label`).
- **Penomoran** (D3, menyimpang dari backend-guide §5): `next_doc_number(prefix, company, 'year')` →
  `KJD-2026-0001`, reset tahunan per prefix per company (period `Y2026`). Mode `'month'` (default) tetap
  untuk contoh Pengajuan. Nomor unik per `(company_code, code)`.
- **Tugas Saya** (`/tugas`, menggantikan `/approval` yang kini redirect): SATU sumber RPC `my_tasks()`
  (`kind, task_group, ref_type, ref_id, code, title, status, due_at, waiting_since, href, meta`). Modul baru
  menambah cabang `union all` di `my_tasks`; `lib/tasks.ts` mengelompokkan (action/verification/approval/
  scheduled), approval diperkaya `getDocSummaries`. Badge menu = `tasks` (`lib/badges.ts`).
- **Nav**: grup `menu/k3lh/people/dokumen/maintenance/laporan/inbox/admin/bantuan` (`NAV_GROUP_ORDER`);
  `createHref`/`createLabel`/`createMin` → tombol "Buat ▾" (`components/topbar/create-menu.tsx`).
- **Tab bawah HP** (D4, penyimpangan standar §8): `components/shell/mobile-tabs.tsx` (< md): Beranda ·
  Tugas · Lapor (hanya bila ada menu dengan `createHref: "/kejadian/lapor"`) · Notifikasi · Profil.
  Konten diberi `pb` setinggi tab; toast HP digeser ke atas (`mobileOffset`).
- **Aksen default app = `gmi-k3`** (#0B4F7C; sidebar navy #0B2238 hanya di mode Terang, token di dalam
  `[data-sidebar="sidebar"]` ikut diganti). `zinc` = token dasar `:root` (`BASE_ACCENT`, tanpa class).
  Aksen prediktif per company (`CompanyAccent`) **tidak dipasang** di layout supaya default app berlaku.
- **Komponen generik K3**: `WorkflowStepper` (`components/detail/`, langkah disusun server),
  `ExpiryChip` + `expiryOf()` (`lib/expiry.ts`, status dihitung di loader; ambang 30 hari sementara
  sampai Pengaturan Pengingat), `RestrictedData`, `KpiHelp`/`KpiStatusBadge`, `SourceChip`. Peta status K3
  (`WORKFLOW_STATUS`, `EXPIRY_STATUS`, `KPI_STATUS`) di `lib/status.ts`.
- Folder prototipe `GMI Safety Management App/` dikecualikan dari tsconfig & eslint; jangan diimpor.
- **Top bar HP (< sm)**: breadcrumb disembunyikan; Bantuan Admin & Tampilan pindah ke menu profil
  (`AccountMenu`, item `sm:hidden`; Tampilan → `/profil#tampilan`; badge Bantuan = titik di avatar).
  Wadah Cari `min-width:auto` di bawah `lg`, pemilih site `min-w-0 shrink` (label terpotong). QA cek
  kontrol top bar tidak bertumpuk @360/@390.
- `npm run db:test` butuh Docker. `types/database.ts` SELALU dari `npm run db:types` (bukan manual).
- **`db:local` di Supabase lokal bersama** (`db-lourdes` juga dipakai app lain, mis. `boilerplate_demo`):
  `reset` hanya menghapus schema/policy/akses app ini (user demo & file storage dipertahankan); `expose`
  MENAMBAH schema app ke `pgrst.db_schemas` tanpa menghapus yang lain. Seed membuat draf Pengajuan contoh.
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

## Safe Hub: Kejadian & Temuan/PICA (fase 1)

Spesifikasi & keputusan sendiri S1-S7: [docs/spec/fase-1-kejadian-pica.md](docs/spec/fase-1-kejadian-pica.md).

- **Jenis B (workflow operasional)**: tabel `incidents`, `findings`, `pica_actions` TIDAK punya hak tulis untuk
  `authenticated`; semua perubahan lewat RPC security definer (`db/app/11_kejadian_pica.sql`) yang memeriksa
  fungsi K3 + visibilitas record (`k3_incident_visible/k3_finding_visible/k3_action_visible`), lalu
  `set_log_context` + `set_log_extra` (satu aksi = satu baris log), `notify()`, dan hasilnya memuat
  `notification_ids` untuk `sendPushForNotifications`. Baca = RLS (company + site; Karyawan = miliknya/atasan/tim/PIC).
- **Alur Kejadian**: `reported > classified > investigating > review_ehs > review_mgmt > actions > closed`.
  Kembalikan = `return_note` + kembali ke `investigating` (S3). Tutup otomatis saat review manajemen disetujui
  dan semua tindakan Closed (`k3_incident_try_close`, S4). Tutup dengan pengecualian = PJO + alasan >= 10 karakter.
  Pembuat laporan tidak boleh meninjau laporannya sendiri. Kategori final (`category`) dari HSE yang dipakai KPI.
- **Data terbatas** (rancangan §2.7): `incident_restricted` (cedera: HSE/HR) dan `incident_costs` (biaya:
  HSE/PJO/Manajemen/SCM/admin) = tabel terpisah dengan RLS fungsi; loader `getKejadianDetail` hanya
  membacanya bila `canSeeRestricted/canSeeCost`; UI `RestrictedData`. Ekspor Excel tidak memuatnya. Halaman
  detail ditandai `<NoOffline />` bagi yang berhak (data cedera tidak masuk cache SW).
- **PICA**: tindakan milik temuan ATAU kejadian (`pica_actions`), nomor `PCA-YYYY-NNNN` (S1). Bukti per putaran
  di storage `pica/<action_id>/r<putaran>/` (policy insert: hanya PIC, putaran berjalan); RPC
  `pica_submit_evidence` memverifikasi file ada. Verifikasi Terima/Kembalikan (S2), komentar wajib; ubah due
  date wajib beralasan. Status temuan = cache turunan (`k3_finding_refresh`, tanpa log); overdue dihitung
  (`due_date < today WIB`), tidak disimpan.
- **Lampiran** `kejadian/<id>/`, `temuan/<id>/` ikut hak baca record (policy `<host>-lampiran` didefinisikan ulang
  di 11_kejadian_pica.sql). Lapor: foto diunggah SETELAH kejadian terbentuk (S7); draf hanya di perangkat.
- **Lib**: `lib/kejadian-rules.ts`, `temuan-rules.ts`, `pica-rules.ts` (zod, label, fungsi murni; aman client);
  loader `lib/kejadian.ts`, `temuan.ts`, `pica.ts` (SATU sumber: tabel, kanban, ekspor `all: true`, detail);
  `lib/k3.ts` (master berkode, area, pilihan orang `k3_user_options`, mitra); `lib/k3-actions.ts` (`k3DbError`:
  pesan RPC 42501 berbahasa Indonesia ditampilkan apa adanya). Izin per peran dihitung di `page.tsx` server
  (cermin RPC) lalu dioper sebagai `perms`; DB tetap penjaga terakhir.
- **Halaman**: `/kejadian` (saved views + filter + ekspor), `/kejadian/lapor` (wizard HP-first, `lapor-wizard.tsx`),
  `/kejadian/[id]` (stepper 7 tahap, tab via `?tab=`, panel `tab-klasifikasi/investigasi/review`),
  `/temuan` (strip angka + widget dari RPC `finding_stats`, Tabel/Kanban via `?mode=kanban`), `/temuan/baru`,
  `/temuan/[id]` (+ `/ubah`), kartu tindakan bersama `components/pica/*`. Deep link `?tindakan=<kode>`.
- **Tugas Saya** (`my_tasks`): cabang `incident_classify`, `incident_investigate`, `incident_review` (grup
  approval), `pica_do`, `pica_verify`. Label di `lib/task-labels.ts`. Badge menu: `incidents` (perlu klasifikasi,
  HSE) dan `findings` (overdue) dari RPC `k3_badges`.
- **Seed DEMO**: 8 kejadian + 8 temuan + 15 tindakan dari prototipe, dibuat LEWAT RPC sebagai persona (log,
  notifikasi, nomor wajar) lalu tanggal dimundurkan; plus 6 draf Pengajuan contoh (budi/GMI, sari/GIS).
- **Belum dibangun (fase 1)**: cetak/PDF kejadian, matriks akses fungsi x modul di `/pengguna`, tautan unit ke
  sistem maintenance (D15: isian bebas), unggah lampiran dari antrean offline.

## Safe Hub: Inspeksi, Observasi, KPI & Beranda (fase 2)

Spesifikasi & keputusan sendiri T1-T9: [docs/spec/fase-2-inspeksi-dashboard.md](docs/spec/fase-2-inspeksi-dashboard.md).

- **Inspeksi** (jenis B, `db/app/12_inspeksi_kpi.sql`): jadwal = baris `inspections` berstatus `scheduled` (tanpa tabel jadwal
  terpisah); `scheduled > in_progress > submitted > verified | cancelled`. Tulis HANYA lewat RPC `inspection_*` (pemeriksa
  = `inspector_id`; verifikator HSE bukan pemeriksa). `inspection_answers` menyimpan teks butir (snapshot template).
  Kirim membuat temuan lewat `k3_finding_insert` (sumber `inspection`). "Terlambat" turunan (`inspectionDisplayStatus`).
  Foto checklist ke storage `inspeksi/<id>/` (hanya pemeriksa, saat berjalan); `observasi/<id>/` (pembuat).
- **Observasi KTA/TTA** (`observation_submit`): tindak lanjut membuat temuan walau pelapor Karyawan (RPC definer).
- **Kamus KPI**: `kpi_definitions` (admin menulis langsung; trigger `kpi_definitions_guard`: ubah definisi/rumus = versi
  baru + kembali draf; status hanya lewat `kpi_approve`). Badge "Rumus belum disahkan" dari data (`KpiStatusBadge`).
- **KPI & Beranda**: `kpi_safety` (definer; hanya kejadian TERKLASIFIKASI HSE; LTIFR/LTISR dari `work_hours`, null = "Belum
  tersedia", bukan 0) dan `dashboard_k3` (SATU RPC; promise dari `getDashboardK3` dibagi ke blok `<Suspense>`
  di `components/dashboard/k3-blocks.tsx`). Grafik = HTML/SVG dengan token `--viz-*` + label teks + tabel `sr-only`.
  Beranda K3 menggantikan blok Pengajuan (komponen lama tetap ada). Karyawan = varian ringkas. Jam kerja: `/kpi/jam-kerja`.
- **Feed & pencarian**: `activity_feed_k3` dan `global_search_k3` (+ `_core` dari fase 1) = satu sumber modul K3; contoh
  Pengajuan membungkusnya (UNION). Hindari mendefinisikan ulang fungsi itu di file contoh tanpa memanggil versi K3.
- **Lib**: `lib/inspeksi-rules.ts`, `kpi-rules.ts` (zod, label, fungsi murni), loader `lib/inspeksi.ts`, `lib/kpi.ts`.
  Jenis inspeksi = master `inspection_type` (warna kalender; kelas warna lewat `typeChipClass` = `STATUS_CLASSES`).
- **Gotcha UI**: `ConfirmDialog trigger` tidak boleh diberi `onClick` sendiri (menimpa pembuka dialog); toast di kanan
  bawah menutupi bar kirim sticky beberapa detik (QA menunggu toast hilang); kartu `col-span-12` tidak boleh berada di
  `grid` tanpa template (kolom implisit meluber di font XL) pakai `flex flex-col`.
- **Belum dibangun (fase 2)**: ekspor Excel/cetak inspeksi, jadwal berulang, blok Beranda yang datanya belum ada
  (Manpower, Kepatuhan Dokumen, TSP, Health, Maintenance, Isu Terbuka, Perlu Perhatian).

## Safe Hub: TSP & Aktivitas, Pengingat, Audit Trail, Laporan Periode (fase 3)

Spesifikasi & keputusan sendiri V1-V7: [docs/spec/fase-3-tsp-laporan.md](docs/spec/fase-3-tsp-laporan.md). Dikerjakan berurutan;
**semua empat bagian selesai** (TSP & Aktivitas, Pengingat, Audit Trail, Laporan Periode).

- **TSP** (`db/app/13_tsp.sql`, jenis B): `tsp_programs` (rencana per bulan = `plan smallint[12]`), `tsp_realizations`, `safety_activities`
  (`AKT-YYYY-NNNN`), `tsp_evaluations` (HSE ajukan → PJO setujui/kembalikan, snapshot `summary`). Tulis HANYA lewat RPC `tsp_*` /
  `safety_activity_*`. Aktual sel = max(manual, jumlah aktivitas terhubung) (V1). SATU sumber angka: `tsp_matrix` + `tsp_summary`
  (halaman, evaluasi, ekspor). Capaian = Σ min(aktual, rencana) ÷ Σ rencana s.d. bulan acuan; KPI `tsp_achievement` draf.
- **Bukti** = Storage `tsp/<program>/<YYYY-MM>/` dan `aktivitas/<id>/` (policy lampiran didefinisikan ulang di 13); jumlah file dihitung
  RPC (`tsp_count_files`, tertutup untuk client), bukan tabel. Realisasi bulan yang evaluasinya disetujui terkunci.
- **Lib/halaman**: `lib/tsp-rules.ts` (zod, `cellState`, `programProgress`), `lib/tsp.ts` (loader), `app/(app)/tsp/` (`page.tsx`,
  `tsp-matrix.tsx` + sheet realisasi, `program-sheet.tsx`, `activity-sheet.tsx`, `evaluation-panel.tsx`, `ekspor/route.ts`).
  Hanya staf K3 (bukan Karyawan) yang melihat; menu `TSP & Aktivitas` (grup k3lh). `my_tasks` punya cabang `tsp_approve` (PJO).
- Helper DB baru: `k3_staff()` (staf K3 / admin), `tsp_recorder()` (hse/pengawas/pjo, bukan auditor). Kategori notifikasi `tsp`.
- **Pengingat** (`db/app/14_pengingat.sql`, `/pengingat`): `reminder_rules` (satu baris per jenis: `pica_due`, `inspection_due`,
  `tsp_evaluation`; admin mengubah lewat RPC `reminder_rule_save`, staf K3 membaca) + `reminder_sent` (idempoten per aturan/record/offset/jatuh
  tempo). Eksekusi = `run_reminders()` dipanggil `run_maintenance()` (08 didefinisikan ulang di 14). Kanal HANYA in-app: DB tidak bisa
  mengirim push (tab terbuka tetap menerima lewat realtime). Jenis MCU/sertifikat/izin/dokumen menyusul bersama modulnya (ubah check `kind`).
  `ExpiryChip` masih 30 hari (belum membaca aturan: belum ada data kedaluwarsa).
- **Audit Trail** (`db/app/15_audit.sql`, `/audit`): RPC `audit_trail` = UNION semua `<entitas>_logs` (security invoker, hanya admin app
  dan Auditor, kursor `sebelum`). Entitas log baru = tambah satu cabang di 15 + `lib/audit-rules.ts` + `LOG_ENTITIES`.
- **Laporan Periode** (`db/app/16_laporan.sql`, `/laporan`, jenis A): `report_templates` (kode form + `sections` jsonb; sumber `kpi|incidents|
  findings|inspections|tsp|narrative|unavailable`), `reports` (site + template + bulan; kode `LAP-YYYY-MM` / `LAP-PJO-YYYY-MM` = periode, bukan
  urut), `report_versions` (snapshot jsonb). Approval engine doc_type `laporan` (template seed: HSE Senior → PJO → Manajemen; `DOC_SUMMARY.laporan`
  di lib/approval.ts). Hook `report_on_approval`: submitted = cek kelengkapan wajib (kekurangan hanya boleh dengan `submit_note` >= 10 karakter),
  approved = **snapshot versi baru** (1.0, koreksi 1.1, ...) + status `published`. Angka draf = `report_build_data` (SATU sumber, definer, tidak
  bergantung scope approver) lewat `report_data`; tampilan terbit HANYA membaca snapshot. Koreksi = `report_start_correction` (alasan >= 10) →
  draf → approval lagi. Bagian modul yang belum ada = `unavailable` ("Belum tersedia", tanpa angka). Narasi = teks biasa (bukan rich text).
  Lib: `lib/laporan-rules.ts`, `lib/laporan.ts`; halaman `app/(app)/laporan/` (daftar, `create-sheet.tsx`, `[id]/laporan-view.tsx`).
- **Belum dibangun (fase 3)**: ekspor PDF/Excel & cetak Laporan Periode, blok Beranda "Pencapaian TSP", rich text narasi, template laporan
  yang bisa diubah di UI.

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
npm run db:types           # generate types/database.ts (butuh Supabase lokal)
```

Detail `db/`: [db/README.md](db/README.md).
