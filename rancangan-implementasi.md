# Rancangan Implementasi: Safe Hub (K3PLH & Operasional GMI)

Guideline pengembangan fitur berdasarkan prototipe UI Figma di folder
[`GMI Safety Management App/`](GMI%20Safety%20Management%20App/). Dokumen ini berisi **prosedur**, bukan
kode. Detail teknis mengikuti [CLAUDE.md](CLAUDE.md), [frontend-guide.md](frontend-guide.md), dan
[backend-guide.md](backend-guide.md).

> Status: draf v0.8 (2026-11-24). Fase 3 sedang dikerjakan di cabang `fase-3-tsp-laporan` (TSP & Aktivitas selesai; Pengingat, Audit Trail, Laporan Periode menyusul; keputusan V1-V7 di docs/spec/fase-3-tsp-laporan.md). D9 (approval laporan = template + kepala departemen) dan D10 (tanpa email) diputuskan 2026-11-24. Sebelumnya v0.7 (2026-11-23). Fase 2 (Inspeksi & Observasi, Kamus KPI, Dashboard v1) dibangun di cabang `fase-2-inspeksi-dashboard`; keputusan T1-T9 menunggu konfirmasi (docs/spec/fase-2-inspeksi-dashboard.md). Fase 1 (Kejadian + Temuan/PICA) dibangun di cabang `fase-1-kejadian-pica`; keputusan S1-S7 menunggu konfirmasi (lihat docs/spec/fase-1-kejadian-pica.md). D1–D5, D7, D13–D15 sudah diputuskan. Fase 0 selesai di cabang
> `fase-0-fondasi` (lihat catatan di §4.0). Bagian bertanda **[KEPUTUSAN]** memakai asumsi default. Konfirmasi
> dulu sebelum modul terkait dikerjakan, lalu ubah tandanya menjadi **[DIPUTUSKAN]**.

---

## 0. Posisi dokumen & sumber kebenaran

| Hal | Sumber kebenaran |
|---|---|
| Tampilan, isi layar, istilah, alur bisnis | Prototipe `GMI Safety Management App/` |
| Arsitektur, pola kode, keamanan, komponen | Kode repo ini + CLAUDE.md |
| Konflik antara keduanya | **Pola repo menang.** Prototipe hanya menentukan *apa* yang dibangun, bukan *bagaimana* |

Aturan baku:

1. **Kode prototipe tidak disalin.** Prototipe memakai CSS custom, ikon SVG sendiri, data hardcode, dan
   navigasi berbasis state. Semua dibangun ulang dengan shadcn base-nova, lucide, Server Component, dan
   RLS.
2. Setiap layar prototipe dipetakan ke **pola boilerplate yang sudah ada** (kit list, kit form, detail +
   `ApprovalPath`, dashboard blocks). Kalau tidak ada pola yang cocok, buat komponen generik di
   `components/` dulu, baru dipakai modul.
3. Label UI berbahasa Indonesia sesuai prototipe. **Nilai DB tetap kode Inggris** (`in_progress`, bukan
   `"In Progress"`), dan labelnya dipetakan di `lib/<domain>-rules.ts`.
4. Folder prototipe tetap di repo sebagai referensi, tidak ikut build, dan tidak boleh diimpor dari
   kode app. Pastikan `tsconfig`/eslint mengecualikannya.

---

## 1. Peta sistem

### 1.1 Domain

Satu sumber data K3PLH (Keselamatan, Kesehatan Kerja, Pengelolaan Lingkungan Hidup) dan operasional
maintenance untuk **PT Garuda Mart Indonesia (GMI), Site MIFA**. Alurnya dari pencatatan di lapangan
sampai laporan periode yang terkunci.

### 1.2 Peta modul → route

| Grup nav | Modul (label prototipe) | Route | Komponen prototipe |
|---|---|---|---|
| Beranda | Dashboard | `/` | `dashboard.tsx` |
| K3LH | Lapor Kejadian | `/kejadian/lapor` | `incident-report.tsx` |
| K3LH | Kejadian & Investigasi | `/kejadian`, `/kejadian/[id]` | `incident-management.tsx` |
| K3LH | Inspeksi & Observasi | `/inspeksi`, `/inspeksi/[id]`, `/observasi/baru` | `inspection-management.tsx` |
| K3LH | Temuan & PICA | `/temuan`, `/temuan/[id]` | `finding-management.tsx` |
| K3LH | TSP & Aktivitas | `/tsp` | `tsp-management.tsx` |
| People & Compliance | Manpower | `/manpower`, `/manpower/[id]` | `people-compliance.tsx` |
| People & Compliance | Kompetensi & Pelatihan | `/kompetensi`, `/pelatihan/[id]` | `people-compliance.tsx` |
| People & Compliance | MCU | `/mcu` | `people-compliance.tsx` |
| People & Compliance | Kontraktor & Legalitas | `/kontraktor`, `/kontraktor/[id]` | `contractor-management.tsx` |
| People & Compliance | PJO/PJA | `/pjo-pja` | `contractor-management.tsx` |
| Dokumen | Prosedur & Dokumen | `/dokumen`, `/dokumen/[id]` | `documents-management.tsx` |
| Dokumen | Evaluasi Peraturan | `/peraturan` | `documents-management.tsx` |
| Dokumen | Register Keselamatan Operasi | `/register-ko` | `documents-management.tsx` |
| Maintenance | Dashboard Maintenance | `/maintenance` | `maintenance-management.tsx` |
| Maintenance | PS & Backlog | `/maintenance/ps-backlog` | 〃 |
| Maintenance | Material Request | `/maintenance/mr`, `/maintenance/mr/[id]` | 〃 |
| Maintenance | Readiness LIB | `/maintenance/lib` | 〃 |
| Maintenance | Metal Scrap | `/maintenance/scrap` | 〃 |
| Laporan | Laporan Periode | `/laporan`, `/laporan/[id]` | `report-management.tsx` |
| Inbox | Notifikasi | `/notifikasi` (sudah ada) | `notifications-management.tsx` |
| Inbox | Tugas Saya | `/tugas` (menggantikan/memperluas `/approval`) | 〃 |
| Admin | Pengguna & Peran | `/pengguna` (sudah ada, diperluas) | `admin-management.tsx` |
| Admin | Master Data | `/master` | 〃 |
| Admin | Impor Data | `/impor` | 〃 |
| Admin | Kamus KPI | `/kpi`, `/kpi/[kode]` | 〃 |
| Admin | Audit Trail | `/audit` | 〃 |
| Admin | Pengaturan Pengingat | `/pengingat` | `notifications-management.tsx` |

Route berbahasa Indonesia mengikuti pola boilerplate (`/pengajuan`, `/pengguna`). Satu modul = satu
folder `app/(app)/<modul>/` + `lib/<modul>.ts` + `lib/<modul>-rules.ts`.

### 1.3 Alur inti end-to-end (acuan uji penerimaan)

Diambil dari `demo-flow.tsx`. Ini skenario uji utama setelah fase 1 dan 2 selesai:

1. **Karyawan** lapor kejadian (HP) → nomor `KJD-…` terbit.
2. **HSE** klasifikasi & dampak.
3. **HSE** investigasi + analisis penyebab → membuat tindakan (PICA).
4. **Pengawas (PIC)** mengunggah bukti penyelesaian dari Tugas Saya.
5. **HSE (verifikator)** menerima bukti → tindakan Closed.
6. **PJO** review & persetujuan manajemen → kejadian Closed.
7. **Dashboard** berubah (status kejadian, donut PICA).
8. **HSE** menyusun Laporan Periode → kelengkapan diperiksa → diajukan.
9. **PJO** menyetujui → laporan **Terbit** (snapshot terkunci, berversi).

---

## 2. Keputusan arsitektur lintas modul

Bagian ini **wajib selesai sebelum modul mana pun dikerjakan** (fase 0).

### 2.1 Model peran **[DIPUTUSKAN]**

Prototipe punya 12 peran bisnis, sedangkan boilerplate hanya punya `viewer < editor < admin` di
`public.app_access`.

**Diputuskan:** dua lapis.

| Lapis | Isi | Disimpan di | Dipakai untuk |
|---|---|---|---|
| Role app | `viewer` / `editor` / `admin` (tetap) | `public.app_access` | Gerbang akses app, modul admin |
| Fungsi K3 | `hse`, `hse_senior`, `manajemen`, `pjo`, `pja`, `pengawas`, `hr`, `maintenance`, `scm`, `kontraktor_admin`, `karyawan`, `auditor` | `__APP__.members.functions text[]` (kolom baru, dijaga `members_guard`) | Aksi per modul, menu, data terbatas |

Aturan:

- Satu user boleh punya beberapa fungsi (contoh: HSE + Pengawas).
- Helper DB `__APP__.has_function(text)` (security definer, stable) dipakai di RLS dan RPC. Helper TS
  `hasFunction(access, "hse")` dibaca sekali di layout dan dibagi lewat `useApp()`.
- `NavItem` mendapat field `functions?: Fn[]`. Menu tampil bila role memenuhi `min` **dan** (tanpa
  `functions` **atau** user punya salah satunya).
- **Auditor** = `viewer` + fungsi `auditor`: baca semua (termasuk audit trail), tidak bisa menulis.
  Ditegakkan di RLS, bukan hanya UI.
- **Karyawan** = `viewer` + fungsi `karyawan`: menu ringkas (Beranda, Lapor, Tugas Saya, Notifikasi),
  hanya melihat laporan miliknya sendiri dan tugas yang ditugaskan kepadanya.
- Fungsi diatur di `/pengguna/[id]` (tab "Peran K3"), dengan CCTV `access.change_function`.
- Mode demo "Lihat sebagai" dari prototipe **tidak** dibangun. Penggantinya user DEMO per fungsi di
  `db/dev/seed.sql`.

Matriks hak akses per modul ada di §4 tiap modul dan wajib dicerminkan di `db/tests/`.

### 2.2 Site & perusahaan **[DIPUTUSKAN]**

Akan ada **banyak site**. Master lokasi sudah ada di platform (`public.locations`: `id`, `name`,
`is_active`; dipakai juga oleh `profiles.location_id`).

- **Company** (`GMI`) memakai scope bawaan `my_company_scope()`, tanpa perubahan.
- **Site = `public.locations`.** App tidak membuat tabel site sendiri dan tidak menulis ke master
  platform. Penambahan site dilakukan di master DB Lourdes (konsol monitoring).
  - Setiap tabel operasional punya `location_id uuid not null references public.locations(id)`.
  - Index `(company_code, location_id, …)` di setiap tabel list.
- **Area di dalam site** (Workshop Service, Pit Area, Hauling Road, Bay 3) adalah master app
  `__APP__.areas (id, location_id, name, is_active)`, dikelola di `/master`. Field "Lokasi kejadian"
  di form = area dari site aktif.
- **Hak lihat per site:**
  - Default: user melihat semua site dalam company scope-nya.
  - Pembatasan opsional: `members.location_ids uuid[]` (null = semua). Kolom ini dijaga
    `members_guard` dan diatur admin di `/pengguna/[id]`.
  - Helper `__APP__.my_location_scope()` (pola sama dengan `my_company_scope()`, `'{*}'` = semua)
    dipakai di setiap policy bersama scope company.
- **Pemilih site di top bar:**
  - Opsinya = site dalam `my_location_scope()` yang aktif, ditambah "Semua site" bila user boleh
    melihat lebih dari satu.
  - Pilihan disimpan per perangkat lewat `lib/storage.ts` (`site`) dan dikirim sebagai param URL
    `site` ke loader. Implementasi: pilihan juga dicerminkan ke cookie `safehub-site` supaya loader
    server membacanya saat URL belum punya `site` (tanpa navigasi ulang).
  - Default = `profiles.location_id` user, atau site pertama bila kosong.
- **Agregasi:**
  - Dashboard & Laporan Periode menerima `site` = satu site atau semua.
  - Laporan Periode **selalu per site**. Satu laporan = satu site + satu periode.
  - KPI lintas site dijumlahkan dari pembilang & penyebut, bukan dirata-ratakan dari persentase.
- **Penomoran per company**, bukan per site (lihat §2.6). Site terlihat dari kolom, bukan dari nomor.
- Seed DEMO: tambah `Site MIFA` (+ satu site kedua) ke `public.locations` di stub, beserta area
  dari prototipe.
- Pemilih **periode** di top bar prototipe **tidak** dijadikan global. Periode tetap per halaman (param
  URL `bulan`/`tahun`), mengikuti pola `parseDashboardParams`.

### 2.3 Dua jenis alur status

| Jenis | Kapan dipakai | Mekanisme | Modul |
|---|---|---|---|
| **A. Approval engine** | Dokumen yang "diajukan lalu disetujui berjenjang" | `approval_doc_types` + template + `ApprovalPath` (pola Pengajuan) | Laporan Periode, Prosedur & Dokumen, Rencana Pelatihan (opsional) |
| **B. Workflow operasional** | Record yang berpindah tahap oleh peran berbeda, tidak sekadar setuju/tolak | Kolom `stage`/`status` + **RPC transisi** per langkah + guard trigger | Kejadian, Temuan & PICA (tindakan), Inspeksi |

Aturan jenis B:

- Status **hanya** berubah lewat RPC `<entitas>_transition(id, to, payload)` atau RPC spesifik
  (`incident_classify`, `pica_submit_evidence`, `pica_verify`). Guard trigger menolak update `status`
  langsung, mengikuti pola `pengajuan_guard`.
- Setiap transisi: cek fungsi pelaku → cek prasyarat → update → `set_log_context(...)` (satu aksi = satu
  baris log) → `notify()` ke pihak berikutnya → hasilnya mengembalikan id notifikasi untuk
  `sendPushForNotifications`.
- Langkah "persetujuan manajemen" di Kejadian memakai **RPC transisi** biasa, bukan approval engine
  (D5).
- Komponen stepper (`workflow-stepper` di prototipe) dibuat generik: `components/detail/workflow-stepper.tsx`,
  menerima `{key,label,meta,state}[]` yang disusun server.

### 2.4 Status turunan, bukan status tersimpan

**Overdue, Akan Kedaluwarsa, Kedaluwarsa, umur (hari)** tidak disimpan sebagai status. Semuanya dihitung
dari `due_date`/`valid_until` terhadap tanggal hari ini (WIB):

- Di DB: kolom generated tidak bisa memakai `now()`, jadi pakai view atau ekspresi di loader/RPC.
- Filter "Overdue" di list = `due_date < today and status not in (closed…)`.
- Komponen `ExpiryChip` (≤ 30 hari = Akan Kedaluwarsa) dibuat sekali di `components/` dan dipakai MCU,
  sertifikat, izin kontraktor, dokumen review.
- Ambang 30 hari diambil dari **Pengaturan Pengingat** (§4.12), bukan hardcode.

### 2.5 Peta status & warna

Semua status masuk `lib/status.ts` (satu-satunya map warna). Pemetaan dari design system prototipe:

| Label prototipe | Warna `StatusColor` |
|---|---|
| Draft | gray |
| Open | blue |
| In Progress | amber |
| Menunggu Verifikasi | violet |
| Closed / Berlaku / Sesuai / NIHIL | green |
| Overdue / Ditolak / Kedaluwarsa / Di atas batas | red |
| Dikembalikan | amber (outlined) |
| Terbit | gray + ikon gembok |
| Belum Ada | gray (garis putus) |
| Rumus belum disahkan | gray + ikon bantuan |

Prinsip prototipe dipertahankan: **status tidak boleh dibedakan dengan warna saja**. Badge selalu
berlabel, dan ikon dipakai untuk status khusus.

### 2.6 Penomoran **[DIPUTUSKAN]**

Prototipe memakai `KJD-2026-0012`, `TMN-2026-0087`, `INS-2026-0230`, `OBS-2026-0518`, `TRN-2026-031`,
`LAP-PJO-2026-08`. Bawaan boilerplate: `<PREFIX>/<COMPANY>/<YYMM>/<NNNN>`, reset bulanan.

**Diputuskan:** format prototipe `<PREFIX>-<YYYY>-<NNNN>`, reset **tahunan** per prefix per company.
Tahun diambil dari tanggal dokumen dibuat (WIB), bukan dari tanggal kejadian.

Langkah implementasi:

1. Perluas `doc_sequences`/fungsi penomoran dengan parameter `period` (`month`/`year`) dan format.
   Kunci urutannya `(prefix, company_code, period_key)` dengan `period_key = 'YYYY'`.
2. Contoh Pengajuan tetap memakai format bulanan sampai dihapus. Keduanya harus lolos `db:test`.
3. Catat di CLAUDE.md sebagai penyimpangan dari backend-guide §5.

Catatan:

- Nomor tidak memuat kode site.
- Bila dua company memakai prefix yang sama di tahun yang sama, nomornya bisa sama (`KJD-2026-0001`
  milik GMI dan milik company lain). Nomor unik per `(company_code, code)`. Tampilan dan pencarian
  global menyertakan company bila user melihat lebih dari satu company.

| Prefix | Entitas |
|---|---|
| KJD | Kejadian |
| TMN | Temuan |
| PCA | Tindakan PICA |
| INS | Inspeksi |
| OBS | Observasi KTA/TTA |
| TRN | Pelatihan |
| LAP / LAP-PJO | Laporan periode (nomor = periode, bukan urut) |

Dokumen terkendali (SOP/IK) memakai kode manual `GMI-SOP-HSE-014` yang diisi pemilik dokumen, unik per
company.

### 2.7 Data terbatas (medis, cedera)

Prototipe menampilkan blok "Data terbatas: hanya HSE dan HR".

- Data sensitif (diagnosis MCU, detail cedera/bagian tubuh, identitas korban bila diminta) disimpan di
  **tabel terpisah** `<entitas>_restricted` (1:1). RLS-nya hanya untuk fungsi `hse`/`hr`.
- Tabel utama hanya menyimpan ringkasan yang aman, misalnya `fit_status`.
- UI: loader mengembalikan `restricted: true` bila baris tidak terbaca, lalu tampilkan
  `<RestrictedData />` (komponen generik baru).
- Ekspor Excel **tidak** menyertakan kolom terbatas kecuali pengekspor punya fungsinya.

### 2.8 KPI terdefinisi

KPI (LTIFR, LTISR, PA, PS Accuracy, MTBF, MTTR, CMR, dst.) punya **Kamus KPI** (§4.13).

- Rumus dihitung di **DB** (fungsi SQL per KPI, misalnya `kpi_ltifr(site, from, to)`), tidak di
  komponen.
- Tabel `kpi_definitions` (kode, nama, definisi, rumus teks, sumber, pemilik, satuan, ambang, arah baik,
  `status`: `draft`/`approved`, versi).
- KPI berstatus `draft` selalu tampil dengan badge **"Rumus belum disahkan"**. Badge ini datang dari
  data, bukan hardcode di kartu.
- Ikon bantuan (?) di setiap kartu KPI membuka definisi + rumus + sumber + pemilik dari tabel yang sama.

### 2.9 Snapshot & versi laporan

Laporan Periode yang **Terbit** adalah snapshot terkunci:

- Saat terbit, RPC menyimpan `snapshot jsonb` (semua angka + daftar sumber) ke
  `report_versions (report_id, version, snapshot, approved_by, published_at)`.
- Tampilan laporan terbit **hanya** membaca snapshot, tidak pernah menghitung ulang.
- Koreksi = versi baru `1.1` lewat alur approval yang sama, dengan alasan wajib. Versi lama tetap bisa
  dibuka.

### 2.10 Lampiran, foto, kamera

- Pola standar: browser → Storage `<host>-lampiran/<entitas>/<record_id>/<nama>`, daftar via
  `storage.list`.
- Form lapor (HP): tombol **Kamera** = `<input type="file" accept="image/*" capture="environment">`.
  Gambar dikompres ke WebP sebelum unggah (pakai ulang utilitas `ImageCropDialog`/kompresi avatar tanpa
  crop wajib).
- Lampiran sebelum record punya id (draf lapor) memakai folder `new-<uid>/` lalu dipindah oleh RPC
  simpan, mengikuti pola K9 Bantuan.
- Bukti PICA dan bukti pelatihan wajib minimal satu file sebelum transisi ke "Menunggu Verifikasi".
  Cek ini dilakukan di RPC.

### 2.11 Notifikasi, tugas, pengingat

- Setiap transisi status memanggil `notify()` ke pelaku berikutnya, dengan kategori per modul
  (`kejadian`, `pica`, `inspeksi`, `laporan`, `kepatuhan`).
- **Tugas Saya** = gabungan (union) dari approval queue engine + tugas workflow B (klasifikasi,
  investigasi, unggah bukti, verifikasi, inspeksi terjadwal). Sumber datanya satu: view/RPC `my_tasks()`
  yang mengembalikan `{kind, ref_id, code, title, due, status, href}`.
- Pengingat jatuh tempo (kedaluwarsa MCU/sertifikat/izin, PICA overdue, review dokumen) dibuat oleh
  `run_maintenance` harian. Ambang hari dan penerima dibaca dari tabel `reminder_rules` (§4.12).
  Idempotensinya dijaga dengan kunci `(rule, ref_id, tanggal)`.

### 2.12 Impor data

Banyak data awal (manpower, MCU, sertifikat, PS/backlog, TSP) akan masuk dari Excel. Wizard impor
(prototipe: unggah → pemetaan kolom → pratinjau & validasi → hasil) dibangun **sekali** sebagai kit:

- `lib/import/<target>.ts` mendefinisikan `{kolom, zod schema, kunci unik, upsert RPC}` per target.
- Parsing dilakukan di server (Server Action, file dari Storage `imports/<uid>/`). Validasi per baris
  dikembalikan ke UI. Commit lewat satu RPC batch (transaksi), hanya baris valid, dengan mode
  `insert`/`upsert`.
- Setiap impor dicatat di `import_jobs` (siapa, target, file, jumlah ok/gagal) dan CCTV `import.commit`.

### 2.13 Visual & shell

| Prototipe | Implementasi |
|---|---|
| Palet GMI (primary `#0B4F7C`, sidebar navy `#0B2238`) | Aksen tema baru "GMI" (default app) di sistem tema 4 mode yang sudah ada. Sidebar navy hanya di mode terang/sistem, sedangkan mode gelap mengikuti token gelap |
| Ikon SVG custom | lucide (padanan: shield, clipboard-check, hard-hat, users, book-open, briefcase, file-text, wrench, bar-chart) |
| Font Inter | Pakai font yang sudah diatur `lib/fonts.ts`; Inter ditambahkan sebagai opsi bila belum ada |
| Grup nav K3LH / People & Compliance / Dokumen / Maintenance / Laporan / Admin | `NavGroupId` baru di `lib/nav.ts` |
| Badge hitungan menu (merah bila overdue) | Kunci badge baru di `lib/badges.ts`, dihitung di layout sekali |
| Tombol "Buat ▾" di top bar | Dropdown dari `NAV_ITEMS` yang punya `createHref`, difilter fungsi user |
| Pencarian global ⌘K | `global_search` yang sudah ada + tambah setiap entitas baru |
| Bottom tabs mobile (Beranda / Tugas / **Lapor** / Notifikasi / Profil) | **[DIPUTUSKAN]** Komponen baru `components/shell/mobile-tabs.tsx`, aktif < md. Ini penyimpangan dari standar dan dicatat di CLAUDE.md |
| Tabel prototipe | Kit list (`DataTable`, `ListProvider`, saved views = preset filter URL) |
| Drawer kanan | `Sheet` shadcn |
| Modal alasan / konfirmasi | `ConfirmDialog` dengan field alasan wajib |
| Login dengan foto | Ikuti login boilerplate. Foto + tagline boleh ditambahkan sebagai varian visual tanpa mengubah alur auth. SSO hanya bila platform menyediakan |
| Halaman Design System & Status UI | **Tidak** dibangun sebagai halaman produk. State kosong/error/tanpa akses sudah ada di boilerplate |
| Tag "Data contoh", "Mode demo" | Tidak dibangun |

---

## 3. Prosedur standar membangun satu modul

Ikuti urutan ini untuk **setiap** modul. Satu modul = satu cabang git = satu PR.

### Langkah 0: Spesifikasi dari prototipe

1. Buka komponen prototipe terkait (§1.2) dan jalankan prototipe (`pnpm dev` di folder prototipe) bila
   perlu melihat interaksi.
2. Tulis spesifikasi singkat di deskripsi PR (atau `docs/spec/<modul>.md` bila besar):
   - Daftar layar dan isinya (kolom tabel, field form, tab detail, widget).
   - Entitas & field. Ekstrak dari tuple data contoh prototipe dan beri tipe.
   - Status + transisi + siapa yang boleh (fungsi K3).
   - Notifikasi yang terkirim di setiap transisi.
   - Angka yang muncul di dashboard/laporan dari modul ini.
3. Tandai yang **tidak** diambil dari prototipe (dekorasi, data contoh, fitur demo).

### Langkah 1: Database (`db/app/<nn>_<modul>.sql`)

Ikuti pola `example_pengajuan.sql` dan backend-guide §3, §6, §8, §10:

1. Tabel utama dengan kolom standar (`id`, `company_code`, `location_id` (site), `code`, `status`, `created_by`,
   `created_at`, `updated_at`, `search_text`).
2. Tabel anak (item, pihak terkait, tindakan, peserta) dan tabel `_restricted` bila ada data sensitif.
3. `<entitas>_logs` + trigger `log_changes` (tanpa FK cascade, K4).
4. Guard trigger: status/nomor hanya lewat RPC, record yang sudah diproses tidak bisa diubah.
5. Trigger `search_text` + index trigram. Index untuk filter list (status, site, due_date, pic).
6. RLS: `viewer` read + company scope + `my_location_scope()` + aturan fungsi (Karyawan hanya miliknya; data terbatas).
   Pakai pola `= any ((select f())::text[])` (K8).
7. RPC simpan (security invoker) + RPC transisi (jenis B) **atau** registrasi `approval_doc_types` +
   dua hook (jenis A).
8. `notify()` di setiap transisi; tambah kategori notifikasi baru bila perlu.
9. Tambah entitas ke `global_search` dan ke `LOG_ENTITIES` (whitelist log aktivitas).
10. Seed DEMO di `db/dev/seed.sql`, memakai **data contoh prototipe** (nama, unit, lokasi) supaya
    tampilan bisa dibandingkan langsung.
11. Uji di `db/tests/<nn>_<modul>.sql`: RLS per fungsi, transisi sah/tidak sah, guard, scope company.
12. `npm run db:test` hijau → `npm run db:local -- reset` → `npm run db:types`.

### Langkah 2: Lib (`lib/<modul>-rules.ts`, `lib/<modul>.ts`)

1. `-rules.ts` (aman untuk client + server): zod schema form, label status → `StatusDef`, label field
   (`FIELD_LABELS`), opsi enum (kategori, tingkat risiko), fungsi murni (hitung umur, overdue).
2. `<modul>.ts` (server-only): `parse<Modul>Params` → `list<Modul>` (dipakai tabel **dan** ekspor
   `all: true`) → `get<Modul>Detail`. Satu loader, satu sumber angka.
3. Status turunan (overdue, kedaluwarsa) dihitung di sini atau di view DB, tidak di komponen.

### Langkah 3: Server Actions (`app/(app)/<modul>/actions.ts`)

1. Satu action per niat user (simpan draf, ajukan, klasifikasi, unggah bukti, verifikasi, kembalikan).
2. Validasi zod → RPC → `cctv(...)` → `sendPushForNotifications(...)` → `revalidatePath`.
3. Error RPC (`P0001`) diteruskan sebagai pesan user, sesuai backend-guide §3.3.

### Langkah 4: Halaman

| Layar prototipe | Pola |
|---|---|
| Daftar dengan tab "saved views" + filter + ekspor | `page.tsx` → loader → `<modul>-table.tsx` (`COLUMNS` + `DataTable`) dalam `ListProvider`; saved view = preset param URL |
| Kanban (Temuan) | Varian tampilan dari loader yang sama; mode disimpan di URL `tampilan=kanban` |
| Form / wizard | `FormSummaryLayout` + `useFormDraft` + `DraftBanner`. Wizard = satu form, langkah = state client, submit sekali |
| Detail bertab + stepper + aside | `components/detail/*` + `WorkflowStepper` + tab via param URL `tab` |
| Drawer tambah/aksi | `Sheet` + form action |
| Modal alasan | `ConfirmDialog` dengan textarea wajib |
| Ekspor Excel | `ekspor/route.ts` + `lib/excel.ts` |
| Cetak / PDF | `PrintableDocument` + `printWithFileName` |

### Langkah 5: Integrasi shell

1. Satu baris `NAV_ITEMS` (+ `functions`, `keywords`, `badge`, `createHref`).
2. Kunci badge di `lib/badges.ts` bila menu punya hitungan.
3. Blok dashboard bila modul menyumbang angka (lihat §4.4).
4. Kontribusi ke `my_tasks()` bila modul membuat tugas.
5. Aturan pengingat bila ada tanggal jatuh tempo.

### Langkah 6: Dokumentasi & QA

1. Tambah alur modul di `lib/docs/content.ts` (halaman Dokumentasi).
2. Perbarui CLAUDE.md: ringkasan arsitektur modul + penyimpangan baru.
3. Tambah cek halaman baru di `scripts/qa/qa.mjs`.
4. `npm run lint && npm run typecheck && npm run db:test`, lalu `npm run build && npm start` +
   `npm run qa`.
5. Bandingkan layar dengan prototipe berdampingan, termasuk lebar HP 375 px.

### Definisi selesai (per modul)

- [ ] Semua layar di spesifikasi ada dan memakai data nyata (tanpa hardcode).
- [ ] RLS diuji untuk setiap fungsi K3 yang relevan (termasuk "tidak boleh").
- [ ] Setiap perubahan status tercatat di log (satu aksi = satu baris) dan CCTV.
- [ ] Notifikasi + push terkirim ke pihak yang benar.
- [ ] Angka di list = angka di dashboard = angka di ekspor.
- [ ] Bekerja di HP (form lapor/aksi lapangan) dan offline-read sesuai pola PWA.
- [ ] 4 mode tema terbaca. Status tidak hanya dibedakan warna.
- [ ] Dokumentasi + CLAUDE.md diperbarui, QA hijau.

---

## 4. Spesifikasi prosedural per modul

Format setiap modul: **Entitas → Status → Peran → Layar → Catatan khusus.**

### 4.0 Fondasi (fase 0)

1. Kolom `members.functions` + `has_function()` + UI tab "Peran K3" di `/pengguna/[id]` (§2.1).
2. Master data (§4.13):
   - Site = `public.locations` (baca saja), area per site, dan `my_location_scope()` (§2.2).
   - Master **unit** (kode unit, model, contoh `E51203 · PC1250`) **dibaca dari sistem maintenance**
     (§4.9), tidak dibuat ulang di app ini.
   - Jabatan memakai `public.job_titles`.
   - Master app yang dikelola di `/master`: perusahaan mitra, kategori kejadian, tingkat risiko.
3. Penomoran tahunan dengan prefix (§2.6).
4. Aksen tema GMI, grup nav baru, mobile tabs, tombol "Buat" (§2.13).
5. Komponen generik: `WorkflowStepper`, `ExpiryChip`, `RestrictedData`, `KpiHelp` (popover definisi
   KPI), `SourceChip` (tautan ke record sumber, misalnya "Sumber: INS-2026-0230").
6. `my_tasks()` + halaman `/tugas` (awal: hanya approval, lalu diperluas tiap modul).
7. Seed DEMO: satu user per fungsi K3 dengan persona prototipe (Rudi = Karyawan, Andi = HSE,
   Fajar = Pengawas, Budi = PJO, Dewi = HR, Hendra = Maintenance, Sari = SCM).

**Catatan pelaksanaan fase 0 (2026-11-23):**
- Selesai: butir 1–7 (DB `db/app/10_fondasi.sql` + uji `db/tests/02_fondasi.sql`; detail di CLAUDE.md
  bagian "Safe Hub: fondasi K3"). Persona memakai email per fungsi (`hse@demo.lourdes.test`, dst.)
  supaya user contoh Pengajuan (`andi@`, `budi@`, ...) tidak berubah.
- "Tab Peran K3" dibuat sebagai kartu di `/pengguna/[id]` (halaman itu berbentuk kartu, bukan tab).
- Disetujui (2026-11-23): cookie `safehub-site`, `CompanyAccent` tidak dipasang, matriks akses ditunda ke
  fase 1, kartu Peran K3. Top bar HP: Bantuan & Tampilan pindah ke menu profil (< sm).
- **Ditunda:** matriks akses fungsi × modul × aksi di `/pengguna` (§4.13). Belum ada modul ber-fungsi,
  jadi matriksnya akan kosong; dibuat bersama modul pertama (fase 1) dari konstanta yang sama dengan
  `NAV_ITEMS`.
- Ambang `ExpiryChip` sementara 30 hari (`DEFAULT_EXPIRY_WARN_DAYS`) sampai Pengaturan Pengingat (§4.12).
- `KpiHelp` siap dipakai; datanya dari Kamus KPI (fase 2).

### 4.1 Lapor Kejadian & Kejadian & Investigasi (fase 1)

**Entitas:** `incidents`, `incident_persons` (pekerja terlibat & saksi), `incident_impacts`
(`_restricted`: cedera, bagian tubuh, hari hilang), `incident_investigations`, `incident_causes`
(analisis penyebab per kelompok), tindakan = `pica_actions` dengan `source = incident` (§4.2).

**Status (jenis B):**
`reported` (Dilaporkan) → `classified` (Klasifikasi HSE) → `investigating` (Investigasi) →
`review_ehs` → `review_mgmt` → `actions` (Tindakan & Verifikasi) → `closed`.
Cabang: `returned` (Dikembalikan dengan catatan, kembali ke tahap sebelumnya), `closed_exception`
(PJO menutup dengan pengecualian + alasan wajib).

**Peran:** lapor = semua fungsi kecuali auditor · klasifikasi/investigasi = `hse` · review EHS = `hse_senior`
(D14) · review manajemen = `pjo`/`manajemen` · tutup dengan pengecualian = `pjo` · baca dampak cedera
= `hse`/`hr`.

**Layar:**
- `/kejadian/lapor`: wizard 4 langkah (Informasi Kejadian, Pihak Terkait, Bukti, Tinjau & Kirim) +
  draf otomatis + pernyataan kebenaran wajib + layar sukses dengan nomor. **Prioritas HP**: kamera,
  field besar.
- `/kejadian`: saved views (Semua, Perlu Klasifikasi, Investigasi, Menunggu Review, Closed) + filter
  (periode, kategori, lokasi, status, pelapor) + kolom progres tindakan (`x/y`) + umur.
- `/kejadian/[id]`: header (nomor, kategori, status) + stepper 7 tahap + tab (Ringkasan, Klasifikasi &
  Dampak, Investigasi, Analisis Penyebab, Tindakan, Review & Persetujuan, Lampiran, Riwayat) + aside
  ringkasan + popover **syarat penutupan** (daftar prasyarat dari RPC, bukan hardcode).

**Catatan:**
- Validasi: tanggal kejadian ≤ waktu lapor; lokasi, kategori, uraian wajib.
- Kategori yang memengaruhi KPI (LTI, Fatality, Near Miss, Property Damage) baru dihitung **setelah
  diklasifikasi HSE**, bukan dari input pelapor.
- Diagram tubuh (BodyDiagram) disederhanakan menjadi pilihan bagian tubuh bila SVG interaktif terlalu
  mahal. Tetap berada di tabel terbatas.
- Unit sebelum integrasi maintenance (D15): isian bebas `unit_code` + `unit_label` (snapshot, §4.9).
  Di fase 5 diganti pemilih dari sumber tanpa migrasi data.
- "Jadikan tindakan" dari analisis penyebab membuka drawer tindakan dengan penyebab terisi.

### 4.2 Temuan & PICA (fase 1)

**Entitas:** `findings` (temuan; sumber = inspeksi/observasi/audit/kejadian, disimpan sebagai
`source_kind` + `source_id`), `pica_actions` (tindakan korektif/preventif, milik temuan **atau**
kejadian), `pica_evidence` (metadata file bukti per putaran verifikasi).

**Status tindakan (jenis B):** `open` → `in_progress` → `waiting_verification` → `closed`.
Verifikator menolak → kembali ke `in_progress` sebagai **Dikembalikan** (alasan wajib, putaran +1).
Perubahan due date setelah ditetapkan wajib beralasan ("Konfirmasi Perubahan").

**Status temuan:** turunan dari tindakannya. `closed` hanya bila semua tindakan closed + penilaian
efektivitas terisi. Overdue = turunan (§2.4).

**Peran:** buat temuan = `hse`/`pengawas`/`pjo` · PIC tindakan = siapa pun yang ditunjuk (unggah
bukti) · verifikator = ditunjuk saat tindakan dibuat (default HSE) · tutup temuan = `hse`.

**Layar:**
- `/temuan`: chart ringkas (status, tingkat risiko, umur), toggle **Tabel/Kanban**, saved views (Semua,
  Milik saya, Overdue).
- `/temuan/[id]`: header (nomor, status, tingkat risiko, PIC, due + keterlambatan) + `SourceChip` +
  tab Detail/Lampiran/Riwayat + kartu tindakan yang bisa dibuka-tutup (PIC: blok unggah bukti;
  verifikator: komentar + efektivitas + Terima/Tolak).
- Drawer "Unggah Bukti" (minimal satu file + catatan).

**Catatan:** Donut PICA dan bar umur temuan di dashboard memakai **loader yang sama** dengan filter
list, sehingga klik segmen membuka list dengan filter itu.

### 4.3 Inspeksi & Observasi (fase 2)

**Entitas:** `inspection_templates` (checklist + item + bobot, dikelola di Master Data),
`inspection_schedules` (rencana), `inspections` (pelaksanaan + jawaban per item: sesuai/tidak/NA +
foto + catatan), `observations` (KTA/TTA cepat).

**Status inspeksi:** `scheduled` → `in_progress` → `submitted` → `verified`. Item "tidak sesuai" →
**membuat temuan otomatis** (draf, dengan `source = inspection`) yang dikonfirmasi saat submit.

**Layar:** kalender + daftar jadwal + "Rencana vs Aktual bulan ini" + modal jadwal baru · checklist
per item (HP) + ringkasan sukses · form cepat Observasi KTA/TTA (HP, maksimal 1 layar).

**Catatan:** Leading Indicator di dashboard = jumlah inspeksi + observasi + KTA/TTA + safety talk
(rencana vs aktual). Pastikan semua jenis tercatat dengan tanggal pelaksanaan.

### 4.4 Dashboard (fase 2, diperluas tiap fase)

Mengikuti pola `app/(app)/page.tsx` yang ada (satu RPC ringkasan, blok Server Component dalam
`<Suspense>`, Recharts hanya di `charts-inner.tsx`).

| Blok prototipe | Sumber | Fase |
|---|---|---|
| Strip Kinerja Keselamatan (Fatality, LTI, LTIFR, LTISR, Near Miss, Property Damage) + toggle Bulan ini/YTD | `dashboard_summary` → kejadian terklasifikasi + jam kerja | 2 |
| Kartu ringkasan (Jam Kerja YTD + sparkline, Manpower, Temuan Overdue, Kepatuhan Dokumen) | manpower, temuan, dokumen | 2–4 |
| Leading Indicator rencana vs aktual + drill-down per bulan (Sheet) | inspeksi/observasi/aktivitas | 2 |
| Status PICA (donut) + Umur Temuan | `pica_actions`, `findings` | 1–2 |
| Pencapaian TSP per elemen | TSP | 3 |
| Health Performance (CMR/MFR/SSR/ASR vs ambang) | MCU/kesehatan agregat | 4 |
| Perlu Perhatian | `my_attention()` (kedaluwarsa, review terlambat, laporan menunggu) | 3+ |
| Ringkasan Maintenance | maintenance | 5 |
| Isu Terbuka | **[KEPUTUSAN]** tabel `issues` (isu dari MOM/rapat) atau temuan bersumber "rapat" | 5 |

**Varian per fungsi:**
- `karyawan`: sapaan, tombol Lapor besar, tugas saya, laporan saya.
- `hse`: kartu tugas + jadwal inspeksi di atas, tanpa blok manajemen.
- Fungsi lain: tampilan lengkap.

Setiap widget punya judul yang menaut ke modulnya, keterangan periode, ikon definisi (§2.8), dan
"Diperbarui <waktu>".

### 4.5 TSP & Aktivitas (fase 3)

**Entitas:** `tsp_programs` (per tahun: no, elemen, program, pemilik, indikator, bukti, target
frekuensi), `tsp_realizations` (program × bulan: jumlah aktual + bukti), `safety_activities` (aktivitas
K3: safety talk, P5M, dll. yang menjadi realisasi TSP dan leading indicator).

**Layar:** matriks program × bulan (sel = aktual/target dengan warna capaian, ikon bukti kurang) →
Sheet per sel (bukti + catat realisasi) · daftar aktivitas K3 + form catat aktivitas · evaluasi
bulanan per elemen (%).

**Catatan:** Program TSP tahunan diimpor dari Excel (§2.12). Persentase capaian per elemen adalah KPI
(§2.8). Elemen yang rumusnya belum disahkan ditandai.

### 4.6 People & Compliance: Manpower, Kompetensi & Pelatihan, MCU (fase 4)

**Entitas:** `employees` (NIK, nama, jabatan, departemen, perusahaan GMI/mitra, status kerja, tanggal
masuk; ditautkan ke `profiles` bila punya akun), `position_requirements` (kebutuhan per jabatan:
jumlah + kompetensi wajib), `certificates` (kompetensi/sertifikat + masa berlaku), `trainings` +
`training_participants` (rencana, kalender, kehadiran, bukti), `mcu_records` (tanggal, hasil
`fit/fit_note/unfit`, berlaku sampai) + `mcu_records_restricted` (diagnosis), `site_permits`,
`work_hours` (jam kerja per bulan, sumber LTIFR).

**Layar:**
- `/manpower`: kebutuhan vs tersedia per jabatan + daftar manpower → profil karyawan bertab
  (Ringkasan, Kompetensi & Sertifikat, Pelatihan, MCU, Permit Site, Riwayat Perubahan).
- `/kompetensi`: **matriks kompetensi** (karyawan × kompetensi; sel = Berlaku / Akan Kedaluwarsa
  N hari / Kedaluwarsa / Belum Ada) + rencana & kalender pelatihan → `/pelatihan/[id]` (peserta,
  kehadiran, bukti).
- `/mcu`: daftar MCU + ExpiryChip; diagnosis hanya `hse`/`hr`.

**Catatan:** Jam kerja adalah penyebut LTIFR/LTISR. Putuskan sumbernya: input bulanan per site
(default) atau turunan absensi. Data awal semua tabel ini lewat Impor Data.

### 4.7 Kontraktor & PJO/PJA (fase 4)

**Entitas:** `contractors` (perusahaan mitra, jenis: subkontraktor/vendor), `contractor_permits` (izin
+ masa berlaku), `contractor_contracts` (nilai kontrak = kolom **komersial**, terlihat hanya oleh fungsi
tertentu), personel = `employees` dengan `company = mitra`, `csms_assessments` (CSMS: pra-kualifikasi,
skor, hasil), `contractor_documents` (checklist dokumen wajib), `pjo_pja_appointments` (penunjukan
PJO/PJA: orang, lingkup, SK, berlaku).

**Layar:** daftar mitra (status legalitas, izin terdekat kedaluwarsa) → profil bertab (Ringkasan, Izin,
Kontrak, Personel, CSMS, Checklist Dokumen, Riwayat) · register PJO/PJA + Sheet detail.

**Peran:** `kontraktor_admin` mengelola; nilai kontrak hanya `manajemen`/`kontraktor_admin`.

### 4.8 Dokumen: Prosedur, Evaluasi Peraturan, Register KO (fase 4)

**Entitas:** `controlled_documents` (kode manual, judul, jenis SOP/IK/Form, pemilik, revisi aktif,
jadwal review, status `draft/review/approved/obsolete`), `document_revisions` (file PDF per revisi +
ringkasan perubahan), `document_acknowledgements` (distribusi ke jabatan/orang + pengakuan "sudah
membaca"), `regulations` + `regulation_evaluations` (peraturan, pasal, kesesuaian, tindak lanjut →
bisa menjadi temuan), `ko_register` (register keselamatan operasi).

**Alur:** revisi dokumen = **jenis A** (approval engine, doc_type `document_revision`). Setelah
disetujui, revisi lama otomatis `obsolete` dan distribusi + permintaan pengakuan dikirim.

**Layar:** register dokumen · detail dengan pratinjau PDF (signed URL), metadata, riwayat revisi,
`ApprovalPath`, distribusi & pengakuan (progres %) · varian **obsolete** (banner + watermark) ·
evaluasi peraturan · register KO.

**Catatan:** "Kepatuhan Dokumen %" di dashboard = KPI turunan (pengakuan + review tepat waktu).
Statusnya *Rumus belum disahkan* sampai disepakati.

### 4.9 Maintenance (fase 5) **[DIPUTUSKAN: sistem sudah ada]**

Data maintenance (unit, PS, backlog, downtime, Material Request, LIB, scrap) **sudah dikelola di sistem
maintenance yang ada**. Safe Hub **tidak** membuat ulang pencatatannya. Modul ini hanya **membaca &
menampilkan** data tersebut untuk dashboard, laporan periode, dan konteks K3.

**Prinsip:**
- Satu sumber kebenaran = sistem maintenance. Di Safe Hub tidak ada form tambah/ubah PS, backlog, MR,
  atau scrap.
- Item "Material Request" di tombol "Buat ▾" prototipe **dihapus**. Diganti tautan keluar ke sistem
  maintenance bila ada URL-nya.
- Setiap tampilan data maintenance menyebut sumber + waktu sinkron terakhir ("Sumber: <sistem> ·
  diperbarui …").

**Prosedur integrasi (pilih satu saat fase 5, lihat D12):**

| Kondisi sistem sumber | Cara | Keterangan |
|---|---|---|
| Schema app Lourdes lain di DB yang sama | View/RPC **read-only** lintas schema yang diberi grant ke Safe Hub | Paling sederhana dan real time. Butuh izin pemilik schema |
| Sistem lain dengan API | Job sinkron terjadwal → tabel cermin `__APP__.mnt_*` (read-only bagi user) | Simpan `synced_at`. Idempoten per kunci sumber |
| Hanya ekspor Excel | Kit Impor Data (§2.12) dengan target `mnt_*` | Manual per periode. Validasi kunci unit |

**Data yang dibutuhkan Safe Hub** (kontrak minimal ke sistem sumber):

| Data | Dipakai untuk |
|---|---|
| Unit (kode, model, site, status) | Pilihan unit di Kejadian/Temuan/Inspeksi |
| Downtime/breakdown per unit | PA, MTBF, MTTR |
| PS rencana vs aktual | PS Accuracy |
| Backlog (prioritas, status, umur) | Backlog Open |
| MR (status, tunggu SCM) | MR Open |
| Readiness LIB/part non-moving | Ringkasan |
| Metal scrap + forecast | Ringkasan |

**Layar** (semua hanya baca, filter site + periode):
- dashboard maintenance (PA, PS, MTBF/MTTR, breakdown, backlog)
- tabel PS & Backlog, daftar MR, Readiness LIB, Metal Scrap

Setiap baris punya tautan "Buka di sistem maintenance" bila sistem sumber punya URL detail.

**Catatan:**
- Rumus KPI maintenance tetap didefinisikan di Kamus KPI Safe Hub (§2.8). Bila sistem sumber sudah
  menghitung KPI, ambil angkanya dan tandai sumbernya. Jangan menghitung dua kali dengan rumus
  berbeda.
- Unit di tabel K3 (`incidents.unit_code`, dll.) disimpan sebagai **kode unit sumber + snapshot
  label**. Dengan begitu record K3 tetap terbaca walau unit berubah atau hilang di sumber.

### 4.10 Laporan Periode (fase 3, setelah sumber datanya ada)

**Entitas:** `report_templates` (kode form, mis. `F-MAC-IMS-08-015 Rev 8.0`, outline bagian),
`reports` (template, periode, status), `report_sections` (catatan/narasi per bagian, rich text via
`sanitizeDoc`), `report_versions` (snapshot, §2.9).

**Alur (jenis A):** `draft` → ajukan (syarat **kelengkapan** terpenuhi, atau dengan catatan) →
Review Pemilik Data → Persetujuan PJO → Persetujuan Manajemen → **Terbit** (snapshot terkunci, v1.0).
Dikembalikan → `draft` dengan catatan per bagian. Koreksi → v1.1 lewat alur yang sama.

**Layar:**
- `/laporan`: daftar + modal Buat Laporan (pilih template + periode).
- `/laporan/[id]` saat draf/review: **workspace**, yaitu outline di kiri, pratinjau bagian (angka live
  dari loader modul + `SourceLine` "N data · lihat sumber" → Sheet daftar record sumber), dan panel
  **Pemeriksaan Kelengkapan** (% + daftar kekurangan yang bisa diklik) + `ApprovalPath` di kanan.
- `/laporan/[id]` saat terbit: tampilan snapshot + riwayat versi + Ekspor (modal pengaturan file:
  PDF/Excel, bagian yang disertakan) + Buat Koreksi.

**Catatan:** Kelengkapan = daftar aturan per template (mis. "Health performance belum diisi",
"2 PICA belum diverifikasi"), dihitung di RPC `report_completeness(id)`.

### 4.11 Inbox: Notifikasi & Tugas Saya (fase 0 → tumbuh)

- `/notifikasi` sudah ada. Cukup tambahkan kategori modul + pengelompokan (Hari ini, Kemarin, Lebih
  lama) sesuai prototipe.
- Dropdown notifikasi di top bar sudah ada. Samakan isinya dengan prototipe.
- `/tugas` dikelompokkan per jenis (Perlu Tindakan, Menunggu Verifikasi, Approval, Terjadwal), memakai
  `my_tasks()` (§2.11). Menu "Approval Saya" yang lama digabung ke sini (redirect).

### 4.12 Pengaturan Pengingat (fase 3)

**Entitas:** `reminder_rules` (jenis: MCU, sertifikat, izin kontraktor, PICA due, review dokumen,
inspeksi terjadwal, laporan periode; `days_before[]`, penerima: PIC/atasan/fungsi, kanal:
in-app/push/email bila ada, aktif).

**Layar:** daftar aturan dengan toggle + edit inline + **Preview Pengingat** (contoh teks notifikasi
dari aturan yang sedang diedit).

**Eksekusi:** `run_maintenance` harian membaca aturan → `notify()` idempoten (§2.11).

### 4.13 Admin (bertahap)

| Layar | Prosedur | Fase |
|---|---|---|
| Pengguna & Peran | Perluas `/pengguna` yang ada: kolom fungsi K3, filter per fungsi, **matriks akses** (fungsi × modul × aksi) hanya-baca yang dibangkitkan dari konstanta yang sama dengan `NAV_ITEMS`/aturan aksi | 0 |
| Master Data | Satu halaman dengan pemilih jenis master milik app (area per site, kategori, tingkat risiko, kompetensi, template checklist, mitra). Site, jabatan, dan unit dikelola di sistem asalnya dan hanya ditampilkan. Tiap jenis = konfigurasi `{tabel, kolom, zod}`, CRUD generik admin | 0 → tumbuh |
| Impor Data | Wizard 4 langkah (§2.12) | 4 |
| Kamus KPI | Daftar + detail (Definisi, Rumus, Aturan Perhitungan, Contoh, Metadata, Riwayat Versi), status Draft/Disahkan; mengesahkan = admin + catatan (§2.8) | 2 |
| Audit Trail | View gabungan semua `<entitas>_logs` (+ filter entitas, pelaku, aksi, periode). Event keamanan tetap di CCTV platform | 3 |

---

## 5. Urutan fase & dependensi

```
Fase 0  Fondasi ─────────────────────────────────────────────┐
        (fungsi K3, site/unit/master, penomoran, tema & nav,  │
         komponen generik, my_tasks, seed persona)            │
                                                              ▼
Fase 1  Kejadian (lapor + investigasi) ◀──▶ Temuan & PICA   (alur inti 1–7)
                                                              │
Fase 2  Inspeksi & Observasi → Dashboard v1 + Kamus KPI       │
                                                              ▼
Fase 3  TSP & Aktivitas → Laporan Periode v1 → Pengingat → Audit Trail  (alur inti 8–9)
                                                              │
Fase 4  People (Manpower, Kompetensi, MCU) → Kontraktor/PJO → Dokumen → Impor Data
                                                              │
Fase 5  Integrasi Maintenance (baca saja) → Dashboard v2 (Health, Maintenance, Isu Terbuka) → hapus contoh Pengajuan
```

- Hapus contoh **Pengajuan** (beserta dashboard, dokumentasi, dan seed contohnya) setelah Kejadian +
  PICA menggantikan perannya sebagai contoh dokumen. Ikuti catatan di CLAUDE.md.
- Setiap fase berakhir dengan uji alur inti (§1.3) sejauh modulnya sudah ada, dijalankan di build
  produksi.
- Laporan Periode sengaja di fase 3: angkanya bergantung pada modul fase 1–2. Bagian yang modulnya
  belum ada ditampilkan "Belum tersedia" di outline, tidak memakai angka palsu.

---

## 6. Yang tidak dibangun dari prototipe

| Elemen prototipe | Alasan |
|---|---|
| Pemilih peran "Mode demo · Lihat sebagai" dan panel Demo Flow | Alat presentasi; diganti user DEMO per fungsi |
| Tag "Data contoh" | Data nyata |
| Halaman Design System & Status UI | Sudah tercakup oleh komponen & state boilerplate |
| Navigasi berbasis state/label | Diganti route App Router + URL yang bisa dibagikan |
| CSS custom (`index.css`) & ikon SVG custom | Diganti Tailwind + shadcn + lucide |
| Foto Unsplash di login/kejadian | Hanya placeholder; aset nyata dari GMI (`public/gmi-*.webp`) |
| `window.alert` untuk ekspor/lupa sandi | Diganti alur nyata (ekspor route, reset password platform) |

---

## 7. Keputusan terbuka

Isi kolom "Keputusan" saat sudah dikonfirmasi, lalu perbarui bagian terkait.

| # | Pertanyaan | Default di dokumen ini | Keputusan |
|---|---|---|---|
| D1 | Model peran: role app + fungsi K3 di `members`? (§2.1) | Ya, dua lapis | **Setuju** (2026-11-20) |
| D2 | Site: `public.locations` atau `__APP__.sites` + `areas`? Akan ada site selain MIFA? (§2.2) | Siapkan multi-site | **Banyak site; site = `public.locations` (master DB Lourdes), area = master app** (2026-11-20) |
| D3 | Format nomor `KJD-2026-0012` reset tahunan? (§2.6) | Ya, ikuti prototipe | **Reset tiap tahun** (2026-11-20) |
| D4 | Mobile bottom tabs sebagai penyimpangan standar? (§2.13) | Ya | **Setuju** (2026-11-20) |
| D5 | Review manajemen Kejadian lewat approval engine atau RPC transisi? (§4.1) | Putuskan di fase 1 | **RPC transisi** (2026-11-21) |
| D6 | Sumber jam kerja (penyebut LTIFR)? (§4.6) | Input bulanan per site | |
| D7 | Maintenance: input penuh di app atau impor/integrasi sistem lain? (§4.9) | Impor + dashboard dulu | **Sistem maintenance sudah ada; Safe Hub hanya membaca** (2026-11-20) |
| D8 | "Isu Terbuka" = entitas `issues` sendiri atau temuan bersumber rapat? (§4.4) | Temuan dengan `source_kind = meeting` | |
| D9 | Penyetuju Laporan Periode & Dokumen: tetap per template atau per jabatan? | Template approval + kepala departemen yang sudah ada | **Setuju default** (2026-11-24) |
| D10 | Email sebagai kanal pengingat? (§4.12) | Tidak; in-app + push | **Setuju default** (2026-11-24) |
| D11 | Ambang KPI kesehatan (CMR ≤ 2,21, dst.) dan target leading indicator: siapa pemilik & di mana diatur? | Kamus KPI (kolom ambang, versi) | |
| D12 | Sistem maintenance yang ada: schema Lourdes di DB yang sama, API, atau hanya ekspor Excel? Apakah ada URL detail per record? (§4.9) | View read-only lintas schema bila satu DB | |
| D13 | Perlu pembatasan user per site (`members.location_ids`), atau semua user melihat semua site dalam company-nya? (§2.2) | Kolom disiapkan, default semua site | **Setuju default: semua site, batas opsional per user oleh admin** (2026-11-23) |
| D14 | "Review EHS = hse senior" dibedakan bagaimana? (§4.1) | n/a | **Fungsi K3 baru `hse_senior`** (2026-11-21) |
| D15 | Field unit sebelum integrasi maintenance (fase 1–4)? (§4.9) | n/a | **Isian bebas kode + label snapshot** (2026-11-21) |
