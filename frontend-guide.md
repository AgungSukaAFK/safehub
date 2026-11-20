# Frontend Guide: Lourdes Boilerplate

Panduan frontend untuk semua app Lourdes yang dibangun dari repo **`lourdes-boilerplate`**. Tujuannya satu:
app baru langsung punya **"rasa" yang sama dengan Garuda Procure (`ga-web`)**, mulai dari tampilan, cara
bergerak, cara memberi feedback, sampai cara mencatat jejak, sambil tetap patuh pada standar platform
Lourdes.

Kondisi per **18 Nov 2026**.

---

## 0. Cara membaca dokumen ini

### 0.1 Posisi dokumen

| Dokumen | Isi | Lokasi |
|---|---|---|
| `claude-app-guide.md` | Fakta platform, database, migration | `~/project/lourdes-db/docs/` |
| `standar-app.md` | Standar repo app: struktur, keamanan, pola kode, deploy | `~/project/lourdes-db/docs/` |
| **`frontend-guide.md`** | **Ini.** Rasa UI/UX, modul dasar, dan pola frontend boilerplate | `lourdes-boilerplate/` |
| `backend-guide.md` | Pasangannya: tabel, RPC, RLS, approval engine, CCTV, retensi | `lourdes-boilerplate/` |
| `styling-guide.md`, `taste-ui.md` | Dokumentasi asli ga-web (sumber port, berisi detail procurement) | `~/project/ga-web/` |

Kalau ada aturan yang bertabrakan:

1. **Keamanan & database** → `standar-app.md` / `claude-app-guide.md` selalu menang (RLS, akses berlapis,
   tidak membuat user, migration hanya di `lourdes-db`, secret key).
2. **Tampilan & interaksi** → dokumen ini menang. Penyimpangannya dari `standar-app.md` §8 dicatat di
   [§2](#2-rekonsiliasi-ga-web--standar-lourdes), dan wajib dicatat juga di bagian "Arsitektur singkat"
   `CLAUDE.md` app.

### 0.2 Label

- **Wajib**: tidak boleh dilanggar tanpa izin eksplisit user.
- **Sebaiknya**: default. Kalau menyimpang, tulis alasannya di `CLAUDE.md` app.
- *Sumber port*: file di `~/project/ga-web` yang menjadi acuan. Port = salin perilaku, kelas, dan teksnya,
  lalu ganti primitive Radix ke Base UI ([§3.3](#33-port-radix--base-ui)) dan pola data ke server-first
  ([§7](#7-pola-data-server-first-yang-tetap-terasa-instan)).

### 0.3 Daftar isi

1. [Prinsip "rasa"](#1-prinsip-rasa)
2. [Rekonsiliasi ga-web ↔ standar Lourdes](#2-rekonsiliasi-ga-web--standar-lourdes)
3. [Stack, dependensi, dan port Base UI](#3-stack-dependensi-dan-port-base-ui)
4. [Struktur repo](#4-struktur-repo)
5. [Fondasi visual & tema dinamis](#5-fondasi-visual--tema-dinamis)
6. [App shell: sidebar, top bar, global search](#6-app-shell-sidebar-top-bar-global-search)
7. [Pola data server-first yang tetap terasa instan](#7-pola-data-server-first-yang-tetap-terasa-instan)
8. [Halaman list & tabel standar](#8-halaman-list--tabel-standar)
9. [Form + panel Ringkasan di kanan](#9-form--panel-ringkasan-di-kanan)
10. [Halaman detail, approval, follow-up](#10-halaman-detail-approval-follow-up)
11. [Riwayat & audit trail](#11-riwayat--audit-trail)
12. [Toast, dialog, konfirmasi](#12-toast-dialog-konfirmasi)
13. [Notifikasi & Inbox](#13-notifikasi--inbox)
14. [Bantuan Admin](#14-bantuan-admin)
15. [Pengguna & akses, profil, foto profil](#15-pengguna--akses-profil-foto-profil)
16. [Multi company](#16-multi-company)
17. [Dashboard](#17-dashboard)
18. [Download Excel](#18-download-excel)
19. [Cetak dokumen](#19-cetak-dokumen)
20. [Update Web, Tentang App, Dokumentasi, Feedback](#20-update-web-tentang-app-dokumentasi-feedback)
21. [Halaman auth](#21-halaman-auth)
22. [Offline & PWA](#22-offline--pwa)
23. [Performa & responsif](#23-performa--responsif)
24. [UX prediktif](#24-ux-prediktif)
25. [Preferensi per perangkat](#25-preferensi-per-perangkat)
26. [Format & bahasa](#26-format--bahasa)
27. [Larangan](#27-larangan)
28. [Definisi selesai (frontend)](#28-definisi-selesai-frontend)
- [Lampiran A. Peta port file](#lampiran-a-peta-port-file)
- [Lampiran B. Aset yang dibawa](#lampiran-b-aset-yang-dibawa)
- [Lampiran C. Tabel modul dasar](#lampiran-c-tabel-modul-dasar)
- [Lampiran D. Keputusan & hal terbuka](#lampiran-d-keputusan--hal-terbuka)

---

## 1. Prinsip "rasa"

Sepuluh hal ini yang membuat sebuah app terasa "sama" dengan ga-web. Warna hanya sebagian kecilnya.

1. **Bahasa Indonesia yang singkat dan ramah.** Tombol berupa kata kerja ("Buat Pengajuan", "Simpan",
   "Ajukan Ulang"). Pesan error menyebut apa yang salah **dan** apa yang harus dilakukan.
2. **Semua yang bisa dibagikan ada di URL.** Pencarian, filter, urutan, halaman, dan jumlah baris disimpan
   di query string. Link bisa dikirim ke orang lain, dan tombol Back selalu bekerja.
3. **Preferensi tampilan disimpan per perangkat** (`localStorage`, key ber-prefix app). Data bisnis tidak
   pernah disimpan di sana.
4. **Actionable-first.** Angka dan status bisa diklik dan membawa user ke tempat aksinya. Yang butuh aksi
   selalu tampil di atas statistik.
5. **Feedback instan.** Klik menu langsung aktif dan berputar, tombol submit berubah jadi "Menyimpan...",
   `toast.loading` diganti hasilnya di toast yang sama, dan tabel tidak berkedip saat filter berubah.
6. **Satu kebutuhan, satu komponen.** Semua tabel list memakai komponen yang sama, termasuk yang aksinya
   cuma satu. Jangan membuat varian baru.
7. **Layak di HP dan layar sentuh.** Tidak ada scroll horizontal di halaman, aksi hover tetap terlihat di
   layar sentuh, dan app enak dipakai sebagai PWA.
8. **Jejak selalu ada.** Dokumen penting punya Riwayat Aktivitas (nilai lama → baru), jalur approval
   dengan waktu proses, dan diskusi. User tidak perlu bertanya "ini nyangkut di siapa?".
9. **Konfirmasi hanya untuk yang tidak bisa dibatalkan** (hapus, tolak, keluar), tidak untuk aksi biasa.
10. **Hormati preferensi user:** ukuran font global (rem), fokus terlihat, `aria-label` di tombol ikon,
    dan `prefers-reduced-motion`.

---

## 2. Rekonsiliasi ga-web ↔ standar Lourdes

ga-web dibangun sebelum standar Lourdes ada. Boilerplate **mengambil rasa ga-web** tapi **memakai pondasi
standar**. Tabel ini wajib dipahami sebelum mem-port apa pun.

| Hal | ga-web | Boilerplate (wajib) |
|---|---|---|
| Next.js | 15, `middleware.ts` | **16.4**, `proxy.ts`, `LayoutProps`/`PageProps` bertipe. Baca `node_modules/next/dist/docs/` sebelum menulis kode |
| Primitive UI | shadcn `new-york` (Radix, `asChild`) | shadcn **`base-nova`** (`@base-ui/react`, prop `render`). Lihat [§3.3](#33-port-radix--base-ui) |
| Baca data | Client component + `useEffect` + `services/*.ts` | **Server Component** + loader `lib/<domain>.ts` (`server-only`, `requireAccess`) |
| Tulis data | Client langsung ke Supabase | **Server Action** (`actions.ts`): akses → zod → tulis → `revalidatePath` → `FormState` |
| State global | Zustand | Tidak ada. Context kecil untuk hal UI (notifikasi, top bar) |
| Param URL | `search`, `page`, `limit`, `sort`, `startDate` | `q`, `hal`, `baris`, `urut`, `dari`, `sampai`, `status`, … ([§8.2](#82-param-url)) |
| Role | `profiles.role` + departemen | `app_access` (`viewer` < `editor` < `admin`) + data app di `<app>.members` |
| User management | App membuat user, reset password | App **hanya** mengatur akses app & data `members`. Akun dibuat di `monitoring.lourdes.cloud/pengguna` |
| Log aktivitas | `logActivity()` dari client | Tabel `<entitas>_logs` diisi **trigger** + RPC untuk aksi bisnis, aksi penting ikut ke **CCTV** platform ([§11](#11-riwayat--audit-trail)) |
| Approval | Kolom JSON `approvals` per dokumen, logika di client | **Approval engine generik** di DB (template, langkah, RPC) ([§10.4](#104-approval-engine-di-ui)) |
| Nomor dokumen | Dibuat di client saat form dibuka | Dibuat DB **saat diajukan** (`next_doc_number`) |
| Notifikasi | Insert dari client, realtime per fitur | Hanya dibuat RPC domain (mis. approval), **satu** channel realtime per tab ([§13](#13-notifikasi--inbox)) |
| Excel | `exceljs` di browser | `exceljs` di **route handler** server (tidak masuk bundle client) ([§18](#18-download-excel)) |
| Offline | Halaman fallback saja | Baca offline + draft form ([§22](#22-offline--pwa)) |
| Tema | 4 mode + 17 aksen | Sama. **Menyimpang** dari standar §8 ("belum ada mode gelap"). Catat di `CLAUDE.md` |
| Header | Sidebar + top bar sticky | Sama. **Menyimpang** dari standar §8 (header + `max-w-7xl`). Catat di `CLAUDE.md` |
| Grafik | `chart-1..5` + warna custom | Recharts + token **`--viz-*`** (skill dataviz, standar §8) |
| Signup | Ada halaman daftar | **Tidak ada.** Hanya login, lupa password, password baru |
| Verifikasi publik (QR tanpa login) | Ada | **Modul opsional per app**: satu RPC terbatas untuk `anon`, tabel tetap tertutup ([§19.4](#194-qr-di-dokumen-cetak)) |
| Web Push | Opsional, kirim dari route API | **Wajib**: kirim dari Server Action lewat RPC `push_targets`, tanpa secret key Supabase ([§13.6](#136-web-push)) |
| Daftar perusahaan | Hardcode `lib/companyDetails.ts` | Tabel master **`public.companies`** (platform) ([§16](#16-multi-company)) |

---

## 3. Stack, dependensi, dan port Base UI

### 3.1 Dasar (dari standar, jangan diubah di app)

Next.js 16.4 · React 19.3 · Tailwind CSS 4 · shadcn `base-nova` + `@base-ui/react` · `lucide-react` · Geist ·
`@supabase/ssr` · `zod` 3 · Node 22 · versi di-pin persis (tanpa `^`).

### 3.2 Tambahan boilerplate

Semua di-pin persis dan di-upgrade di boilerplate dulu, baru turun ke app.

| Paket | Dipakai untuk | Catatan |
|---|---|---|
| `next-themes` | 4 mode tema | Provider custom untuk aksen & font ([§5](#5-fondasi-visual--tema-dinamis)) |
| `sonner` | Toast | Lewat wrapper `lib/toast.tsx` |
| `recharts` | Grafik dashboard | Lewat `npx shadcn@latest add chart`, di-`dynamic()` |
| `exceljs` | Export Excel | **Server only** (route handler) |
| `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-{link,image,placeholder,mention}` | Rich text (diskusi, Update Web, feedback) | Di-`dynamic()`, jangan masuk bundle halaman list |
| `qrcode.react` | QR di dokumen cetak | |
| `date-fns` | Hitung rentang tanggal (minggu ke-n, dsb.) | Tampilan tetap lewat `lib/format.ts` (WIB) |
| `react-day-picker` | Kalender `DatePicker` | Ikut `npx shadcn add calendar` |
| `web-push` | Kirim Web Push (VAPID) | **Server only** (`lib/push.ts`) |

Yang **tidak** dipakai (standar §3): Zustand, React Query/SWR, react-hook-form, ORM, `cmdk` (Base UI sudah
punya `Combobox` dan `Autocomplete`).

### 3.3 Port Radix → Base UI

Komponen ga-web memakai Radix. Saat mem-port, **kelas Tailwind, teks, dan perilakunya disalin persis**.
Yang berubah hanya API primitive-nya:

| Radix (ga-web) | Base UI (boilerplate) |
|---|---|
| `<X asChild><Link/></X>` | `<X render={<Link href="…" />}>…</X>`. Untuk link berbentuk tombol: `<Link className={buttonVariants({…})}>` |
| `data-[state=open]:…` (trigger) | `data-popup-open:…` |
| `data-[state=open]` / `closed` (popup) | `data-open` / `data-closed` |
| `data-[state=checked]` | `data-checked` |
| `data-[highlighted]` (item menu) | `data-highlighted` |
| Animasi masuk/keluar (`animate-in`, `fade-in-0`, …) | `data-starting-style:` / `data-ending-style:` (atau bawaan komponen shadcn base-nova) |
| `DropdownMenu modal={false}` | `Menu.Root modal={false}` |
| `cmdk` (`SearchableSelect`, global search list) | `Combobox` / `Autocomplete` Base UI, atau listbox ARIA manual seperti global search ga-web |
| `onSelect` di item menu | `onClick` |

Selalu cek nama atribut di file `components/ui/*` hasil `npx shadcn@latest add`, karena itulah sumber
kebenarannya. Jangan menebak.

### 3.4 Komponen shadcn yang ditambahkan

```
accordion alert-dialog avatar badge breadcrumb button calendar card chart checkbox collapsible
combobox dialog dropdown-menu input label popover progress radio-group scroll-area select separator
sheet sidebar skeleton slider switch table tabs textarea tooltip
```

Lalu terapkan modifikasi ga-web di atasnya:

- `button`/`badge`: shadow halus (`shadow-xs`), ikon otomatis `size-4`.
- `dialog`/`alert-dialog`: `max-h-[calc(100dvh-2rem)] overflow-y-auto`.
- `table`: pembungkus `overflow-x-auto`.

Komponen buatan sendiri (`currency-input`, `copy-text-button`, `toast-copy-button`) diletakkan di
`components/ui/` juga.

---

## 4. Struktur repo

Memperluas struktur standar §4. Yang ditandai ★ adalah tambahan boilerplate.

```
app/
  (app)/                         wajib login + punya role (gerbang dari standar)
    layout.tsx                   requireAccess + gerbang profil + ★ AppShell (sidebar + top bar)
    page.tsx                     ★ Dashboard (beranda)
    error.tsx, loading.tsx
    ★ notifikasi/                halaman semua notifikasi
    ★ profil/                    profil saya, tampilan, notifikasi, akses saya
    ★ pengguna/                  pengguna & akses app (admin)
      [id]/
    ★ bantuan/                   Bantuan Admin (chat user ↔ admin app)
      kelola/                    inbox admin
    ★ feedback/                  kirim feedback
      kelola/                    kelola feedback (admin)
    ★ pembaruan/                 Update Web (changelog)
      baru/, [id]/ubah/
    ★ approval/                  Approval Saya (antrian)
      template/, kepala-departemen/   (admin)
    ★ dokumentasi/               panduan interaktif
    ★ tentang/                   Tentang App
    <fitur>/                     page.tsx, actions.ts, <x>-form.tsx, baru/, [id]/, ★ ekspor/route.ts
  auth/                          login, lupa password, password baru, confirm, signout (standar)
  no-access/                     (standar)
  api/health/                    (standar)
  ★ ~offline/                    halaman fallback offline (di-precache SW)
components/
  ui/                            shadcn base-nova + modifikasi
  ★ shell/                       app-sidebar, nav-main, nav-user, sidebar-search, app-switcher,
                                 navigation-progress, breadcrumbs
  ★ topbar/                      topbar, topbar-icon-button, topbar-search, topbar-inbox,
                                 topbar-help, topbar-appearance, topbar-profile
  ★ list/                        content, list-toolbar, list-search-input, filter-panel,
                                 sticky-header-table, sortable-table-head, reorderable-table-head,
                                 row-actions-menu, table-pagination-footer, excel-download-menu, quick-view
  ★ form/                        form-summary-layout, currency-input, date-picker, file-dropzone,
                                 link-attachment-form, draft-banner, submit-button
  ★ detail/                      info-item, status-badge, approval-path, step-chain,
                                 activity-log-dialog, followup-button, discussion-panel
  ★ user/                        user-avatar, user-profile-card, avatar-viewer-dialog,
                                 image-crop-dialog, profile-avatar-dialog
  ★ notification/, support/, update/, feedback/, docs/, dashboard/, print/, pwa/, auth/
  app-header.tsx, page-header.tsx, form-bits.tsx … (standar, tetap ada)
lib/
  (standar) env, auth, roles, profile, nav, action-state, search-params, people, format, supabase/*
  ★ theme.ts, fonts.ts, font-options.ts, view-transition.ts
  ★ toast.tsx, clipboard.ts, storage.ts (localStorage aman + prefix)
  ★ companies.ts                 loader public.companies (server) + scope perusahaan
  ★ push.ts                      server-only: kirim Web Push (VAPID)
  ★ status.ts                    satu-satunya map status → warna
  ★ excel.ts                     server-only: workbook ber-style
  ★ print.ts                     printWithFileName
  ★ offline/                     use-online, use-form-draft, page-cache
  ★ notifications/               sound, settings, browser
hooks/                           ★ use-url-search-input, use-column-order, use-go-back, use-mobile,
                                 use-unsaved-changes, use-file-drop
db/                              ★ SQL modul dasar (placeholder __APP__), DISALIN ke
                                 lourdes-db/supabase/migrations saat app dibuat. Bukan folder migration.
public/                          logo, slide auth, ikon PWA, manifest, sw.js
```

> **Wajib:** repo app tidak punya `supabase/migrations`. File di `db/` hanya template yang disalin ke
> `lourdes-db` ([Lampiran C](#lampiran-c-tabel-modul-dasar)).

---

## 5. Fondasi visual & tema dinamis

*Sumber port:* `ga-web/app/globals.css`, `lib/theme-provider.tsx`, `lib/fonts.ts`, `lib/font-options.ts`,
`lib/view-transition.ts`, `components/topbar/topbar-appearance.tsx`.

### 5.1 Token warna

- **Ganti** token oklch bawaan base-nova dengan token ga-web: HSL **tanpa** `hsl()`
  (`--primary: 240 5.9% 10%`), dibungkus di `@theme` → `--color-primary: hsl(var(--primary))`.
- **Pertahankan** token standar `--viz-*`, `--success`, `--warning` dan definisikan di keempat mode.
- Token baru wajib punya nilai di **keempat** mode.

| Token | Pakai untuk |
|---|---|
| `background` / `foreground` | Latar halaman & teks utama |
| `card`, `popover` | Card, dropdown, dialog |
| `primary` | Tombol utama, link, indikator aktif, badge hitung |
| `secondary` | Tombol sekunder, badge netral |
| `muted` / `muted-foreground` | Latar redup, teks keterangan |
| `accent` | Hover item menu/ghost, item terpilih |
| `destructive` | Hapus, tolak, error (versi terang di mode gelap; isian solid diredam `dark:bg-destructive/60`) |
| `border`, `input`, `ring` | Garis, border input, focus ring |
| `sidebar-*` | Sidebar. `--sidebar-ring` mengikuti `--ring` (ikut aksen) |
| `viz-*` | Grafik (standar dataviz) |

Radius `--radius: 0.5rem`: kontrol `rounded-md`, card `rounded-xl`.

### 5.2 Empat mode + System

| Mode (class di `<html>`) | Karakter |
|---|---|
| `light` | Zinc bersih, teks zinc-950 |
| `soft-light` | Off-white hangat (`40 14% 91.5%`), tidak silau |
| `dark` | Zinc gelap (`240 5.9% 10%`), tidak hitam pekat |
| `soft-dark` | Abu kebiruan redup (`215 14% 16.5%`) |
| System | Bukan class: next-themes memasang `light`/`dark` sesuai OS |

```css
@custom-variant dark (&:is(.dark *, .soft-dark *));   /* soft-dark dihitung gelap */
```

```tsx
<ThemeProvider attribute="class" defaultTheme="system" enableSystem
  themes={["light", "dark", "soft-light", "soft-dark"]} disableTransitionOnChange>
```

### 5.3 Warna aksen

Class `theme-<nama>` di `<html>`, **hanya** mengubah `--primary`, `--primary-foreground`, `--ring`.

- **Warna Perusahaan:** `theme-gmi` (navy `#242365`), `theme-gis` (hijau `rgb(23 88 49)`). Ada versi
  terang di mode gelap.
- **Warna Umum:** blue, sky, cyan, teal, emerald, green, amber, orange, red, rose, pink, fuchsia, purple,
  violet, indigo. `zinc` = default (tanpa class).
- **Prediktif ★:** kalau user belum pernah memilih aksen, aksen awal mengikuti `profiles.company`
  lewat `public.companies.accent` (GMI → `gmi`, GIS → `gis`, LOURDES/null → default). Begitu user
  memilih, pilihannya yang dipakai.

### 5.4 Font

- Default **Geist** (sesuai standar). Pilihan: Inter, Plus Jakarta Sans, Poppins, Nunito, Roboto,
  Atkinson Hyperlegible, Font Sistem → `html[data-font=…]`.
- Ukuran global `html[data-font-size=sm|lg|xl]` (87.5% / 112.5% / 125%). Karena itu **wajib unit rem**
  (class Tailwind biasa). `px` hanya untuk label mikro `text-[10px]`/`text-[11px]`.
- Script anti-flash (`fontInitScript`) di `<head>` memasang font & ukuran sebelum render.
- Saat cetak, font & ukuran kembali ke default.

### 5.5 Animasi ganti tampilan

`runViewTransition(update, { origin })`:

- Ganti mode → tampilan baru **menyebar melingkar** dari tombol yang diklik (`originFromEvent(e)`).
- Ganti aksen & jenis font → cross-fade 250 ms.
- Ukuran font → tanpa animasi (slider).
- Penanda opsi terpilih punya `viewTransitionName` sendiri, sehingga bergeser ke opsi baru.
- Browser tanpa dukungan atau `prefers-reduced-motion` → langsung berubah.
- **Wajib:** di mana pun tema diganti, panggil `runViewTransition(() => setTheme(v))`, bukan `setTheme`
  langsung.

### 5.6 Tipografi

| Elemen | Class |
|---|---|
| Judul halaman (`PageHeader`) | `text-2xl font-semibold tracking-tight` |
| Kode dokumen di header detail | `text-3xl font-bold` |
| Judul card | `leading-none font-semibold` |
| Deskripsi / teks bantu | `text-sm text-muted-foreground` |
| Label kecil / section label | `text-xs font-medium text-muted-foreground` |
| Kode dokumen di tabel | `font-mono text-xs font-semibold` |
| Angka & uang | `tabular-nums`, rata kanan di tabel |

`font-medium` untuk tombol & label, `font-semibold` untuk judul. Hampir tidak pernah `font-bold`.

### 5.7 Warna status

**Satu file:** `lib/status.ts` (port dari `taste-ui.md` §9.5). Dua tone:

| Tone | Dipakai |
|---|---|
| `solid` | Status **dokumen** di header halaman detail |
| `soft` | Semua tempat lain: kolom tabel, chip, riwayat |

| Warna | Makna |
|---|---|
| gray | Draft / menunggu / default |
| blue, sky | Sedang diproses |
| amber | Menunggu approval, sebagian, perlu perhatian |
| orange | Butuh tindak lanjut / ditahan |
| green | Disetujui |
| emerald | Selesai / ditutup |
| red | Ditolak / bermasalah |

Status selalu tampil sebagai **warna + teks** (standar §8), tidak boleh warna saja. Label tampilan ada di
`lib/<domain>-rules.ts`; nilai di DB tetap kode Inggris (`pending`, `approved`).

### 5.8 Lapisan, bayangan, fokus

- z-index: header tabel sticky `z-30`, top bar `z-40`, progress navigasi `z-[100]`.
- Bayangan: `shadow-xs`/`shadow-sm` di card & chip. **Tidak** ada glow, glassmorphism, atau gradient
  dekoratif di halaman app. Blur hanya di top bar (fungsional) dan halaman auth.
- Fokus: `focus-visible:ring-1 ring-ring` (tombol), `ring-2` (chip/link kecil). Jangan menghapus outline
  tanpa menggantinya.
- Animasi baru wajib punya blok `@media (prefers-reduced-motion: reduce)`.

---

## 6. App shell: sidebar, top bar, global search

*Sumber port:* `ga-web/app/(With Sidebar)/layout.tsx`, `components/app-sidebar.tsx`, `nav-main.tsx`,
`nav-user.tsx`, `sidebar-search.tsx`, `team-switcher.tsx`, `navigation-progress.tsx`, `lib/sidebar/*`,
`components/topbar/*`.

### 6.1 Anatomi

```
┌──────────────┬──────────────────────────────────────────────────────────┐
│ [Logo grup]  │ ☰ │ App › Pengajuan › Baru  [🔍 Cari…  ⌘K]   📥³ 🎧 🎨 │ (👤)  ← top bar sticky
│ [Pindah app▾]├──────────────────────────────────────────────────────────┤   h-14 / md:h-16
│ 🔍 Cari menu │  grid-cols-12 gap-4 md:gap-6                              │
│──────────────│  ┌──────────────── <Content> ──────────────────────┐     │
│ Menu    Atur │  │ Judul                             [Aksi utama]  │     │
│  • Beranda   │  └─────────────────────────────────────────────────┘     │
│  • Notif (3) │                                                          │
│ Admin   Atur │                                                          │
│ Bantuan      │                                                          │
│──────────────│                                                          │
│ [👤 Nama ▾]  │                                                          │
└──────────────┴──────────────────────────────────────────────────────────┘
```

Layout `(app)`:

```tsx
// app/(app)/layout.tsx (server)
const access = await requireAccess();
// … gerbang profil & onboarding (standar)
return (
  <NotificationProvider userId={access.userId}>
    <NavigationProgress />
    <SidebarProvider>
      <AppSidebar access={access} className="no-print shadow-lg" />
      <SidebarInset>
        <Topbar access={access} />                      {/* header[data-app-topbar] */}
        <OfflineBanner />
        <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 pt-0 break-words">
          <div className="grid grid-cols-12 items-start gap-4 md:gap-6 [&>*]:min-w-0">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  </NotificationProvider>
);
```

**Wajib:** jangan memasang `overflow-*` di elemen antara `<main>` dan tabel, karena header tabel sticky
akan berhenti menempel.

### 6.2 Menu: satu sumber

`lib/nav.ts` standar diperluas, dan tetap **satu baris per fitur**:

```ts
export type NavItem = {
  href: string; label: string; description: string;
  icon: LucideIcon; min: Role;
  group: "menu" | "admin" | "bantuan";
  keywords?: string[];            // sinonim, singkatan, istilah lama
  visible?: (a: AppAccess) => boolean; // aturan tambahan (company, data members)
};
```

- `buildNavGroups(access)` dipakai **sidebar dan global search**. Menu yang tidak boleh dibuka tidak
  pernah muncul di keduanya.
- Grup: **Menu** (Beranda, Approval Saya, Notifikasi, fitur app), **Admin** (Pengguna & Akses, Template
  Approval, Kepala Departemen, Inbox Bantuan, Kelola Feedback), **Bantuan** (Dokumentasi, Bantuan Admin, Feedback, Pembaruan, Tentang App). Grup kosong
  tidak dirender.
- Menu aktif memakai **longest match**: `/pengajuan/approval` tidak ikut mengaktifkan `/pengajuan`.
- Badge (`/notifikasi`, `/bantuan`, `/pembaruan`) berasal dari provider/hook, bukan query di sidebar.
  Tampil `rounded-full bg-red-500 text-white text-[10px] font-bold`, maksimal `99+`. Saat sidebar
  diciutkan, badge pindah ke pojok ikon.

### 6.3 Sidebar

- `collapsible="icon"`. Header: logo grup (`/lourdes-logo.webp`) full width, lalu **App Switcher**.
- **App Switcher ★**: dropdown dari `public.my_apps()` (nama, deskripsi, role, url). App aktif ditandai ✓.
  Ini cara user berpindah antar app Lourdes dengan satu akun.
- **Cari menu**: cocok ke judul, singkatan otomatis, `keywords`, nama grup, dan tahan salah ketik 1 huruf.
  Enter membuka hasil teratas, Esc mengosongkan, query bertahan antar halaman. Saat sidebar diciutkan,
  muncul sebagai tombol ikon. Tidak ada hasil → ikon `SearchX` + "Tidak ada menu untuk "…"" + "Hapus
  pencarian".
- **Atur** per grup: tombol ghost kecil → checklist menu yang disembunyikan. Disimpan per perangkat dan
  sinkron antar tab. Grup Bantuan tidak bisa disembunyikan. Menu tersembunyi tetap ikut dicari.
- Link `next/link`, `rounded-md px-3 py-2 hover:bg-accent active:scale-[0.98]`, aktif `bg-primary/5`.
- Footer: `NavUser` (avatar, nama, email → Profil Saya, Lihat Foto, Keluar dengan konfirmasi).

### 6.4 Feedback navigasi

- Item yang diklik langsung aktif (`bg-primary/10`), ikonnya diganti `Loader2 animate-spin text-primary`,
  dan diberi `aria-busy`.
- `NavigationProgress`: bar `h-0.5 bg-primary` fixed di atas (`z-[100]`, `no-print`), berjalan pelan ke
  ~85%, penuh + fade saat pathname berubah, batal otomatis setelah 20 detik.
- Ctrl/Cmd/Shift/klik tengah tidak memicu loading. Di HP, sidebar menutup setelah klik.

### 6.5 Top bar

- `header[data-app-topbar]`: `sticky top-0 z-40`, `h-14 md:h-16` (`h-12` saat sidebar mode ikon),
  `bg-background/90 backdrop-blur-md` (blur kuat baru mulai `md:`), `border-b border-border/60` + garis
  gradien aksen tipis `via-primary/30`. Tanpa shadow. `no-print`.
- Kiri: `SidebarTrigger` │ Breadcrumb (di HP hanya crumb terakhir; segmen UUID tidak ditampilkan).
- Tengah (`lg+`): Global Search.
- Kanan, berurutan: **Inbox → Bantuan Admin → Tampilan** │ **Profil**.
- Semua tombol ikon memakai `TopbarIconButton`: ghost bulat `size-8` (area tap 36 px) / `sm:size-9`, badge
  `bg-red-600 ring-2 ring-background`, `label` menjadi `title` + `aria-label` ("Inbox (3 baru)"), tetap
  tersorot selama popover-nya terbuka (`data-popup-open:bg-accent`).
- Popover top bar: `align="end" sideOffset={8} collisionPadding={8}`, lebar
  `w-[min(24rem,calc(100vw-1rem))]`.
- **Tampilan**: tombol `Palette` → popover `Tabs` **Tema / Aksen / Font** ([§5](#5-fondasi-visual--tema-dinamis)).
- **Profil**: avatar (+ nama mulai `lg:`) → kepala (avatar, nama, email, role app) → Profil Saya, Lihat
  Foto, **Keluar** merah dengan konfirmasi. Saat dimuat: skeleton bulat.
- Inbox: [§13.4](#134-inbox-top-bar). Bantuan Admin: [§14](#14-bantuan-admin).

### 6.6 Global search (⌘K)

*Sumber port:* `components/topbar/topbar-search.tsx`, `search-sections.ts`, `use-global-search.ts`,
`ga-web/supabase/migrations/0008_global_search.sql`.

- `lg+`: field inline `max-w-md bg-muted/40` dengan panel hasil di bawahnya. Di bawah `lg`: tombol 🔍 →
  dialog yang menempel di **atas** layar (`top-3`, `sm:top-[12vh]`) supaya tidak tertutup keyboard.
- `⌘K`/`Ctrl K` di mana saja. `↑/↓` pilih (berputar), Enter buka, Esc tutup. **Enter sebelum hasil
  datang** → tunggu hasil lalu buka yang teratas; kode yang persis sama selalu di urutan pertama.
- Susunan hasil:
  - Query kosong: **Menunggu aksi Anda → Terakhir dibuka → Pencarian terakhir → Aksi cepat**.
  - Query mirip kode (ada angka atau `/`): **Paling cocok → data → Menu → Aksi**.
  - Query biasa: **Paling cocok → Menu → Aksi → data**.
- Menu & aksi dicocokkan secara lokal (skor minimal, tahan typo). Data dicari lewat **satu RPC**
  `<app>.global_search(q, lim)` (`security invoker`, RLS & scope company tetap berlaku), dipanggil setelah
  berhenti mengetik 250 ms dan minimal 3 huruf. Request basi dibatalkan, hasil di-cache 60 detik.
  Hasil lama tetap tampil selama mencari (tidak berkedip).
- Grup data yang penuh → "Lihat semua hasil X" ke halaman list dengan `?q=`. Karena itu halaman list
  **wajib** membaca `?q=`.
- Aksi cepat: "Buat <dokumen>", "Profil Saya", "Tema: <mode>", "Keluar". Aturan `visible` aksi **sama
  persis** dengan tombol aslinya.
- Riwayat (5 dokumen terakhir dibuka, 4 query terakhir) per akun per perangkat, dengan tombol "Hapus
  riwayat".

---

## 7. Pola data server-first yang tetap terasa instan

Standar mewajibkan data dibaca di Server Component dan ditulis lewat Server Action. ga-web terasa instan
karena memakai state client. Pola di bawah memberi rasa yang sama tanpa melanggar standar.

### 7.1 Halaman list

```
page.tsx (server)                         ← baca searchParams → listX() → render
 ├─ <PageHeader>                          judul + aksi utama
 └─ <Content>
     ├─ <ListToolbar> (client)            cari, filter, Excel  → ubah URL di dalam startTransition
     ├─ <ListPending> (client)            context isPending dari toolbar/footer
     │   └─ <StickyHeaderTable> (client)  header tetap; <TableBody> dirender server
     └─ <TablePaginationFooter> (client)
```

- Kontrol client mengubah URL dengan `router.replace/push(href, { scroll: false })` di dalam
  `startTransition`. Selama transisi, **UI lama tetap tampil**: header, filter, dan baris sebelumnya tidak
  hilang. Inilah rasa "tidak berkedip" ga-web.
- `isPending` dibagikan lewat context `ListPending`:
  - `<TableBody>` diberi `opacity-60 transition-opacity`;
  - bar `h-0.5` tipis di atas tabel;
  - ikon cari berubah menjadi spinner.
- Pertama kali dibuka: `loading.tsx` per fitur berisi **skeleton berbentuk layout** (header tabel asli +
  baris `Skeleton h-8`). Tidak boleh spinner satu halaman.
- Membaca param memakai `lib/search-params.ts` (`textParam`, `enumParam`, `pageParam`). Nilai asing
  kembali ke default.

### 7.2 Menulis

- Form memakai `useFormAction(action)` (standar, `components/form-bits.tsx`), ditambah:
  - `useActionToast(state)` ★ → `toast.success(state.message)` / `toast.error(...)` saat state berubah;
  - error per field tetap tampil inline (`Field`) **dan** checklist ringkasan ([§9](#9-form--panel-ringkasan-di-kanan)).
- Aksi satu klik (setujui, tandai dibaca, hapus) memanggil Server Action dari `startTransition`, dengan
  `toast.loading` → `toast.success/error({ id })`.
- **Optimistic** (`useOptimistic`) hanya untuk aksi ringan yang hampir pasti berhasil: tandai dibaca,
  reaction, toggle. Dokumen & uang tidak boleh optimistic.
- Setelah sukses: `revalidatePath` di action. Kalau perlu pindah halaman, `redirect()` dari action, lalu
  toast dibaca dari param sekali pakai `?ok=<kode>` yang dihapus setelah tampil.

### 7.3 Client fetch yang diizinkan

Client Supabase (`lib/supabase/client.ts`) hanya untuk:

- auth;
- realtime ([§13](#13-notifikasi--inbox));
- upload langsung ke Storage;
- pencarian interaktif yang dipicu ketikan (combobox entitas, global search, mention). Ini juga boleh
  lewat Server Action.

**Jangan** fetch data awal halaman di `useEffect`.

---

## 8. Halaman list & tabel standar

*Sumber port:* `ga-web/components/{content,filter-panel,list-search-input,sticky-header-table,sortable-table-head,reorderable-table-head,row-actions-menu,excel-download-menu,table-pagination-footer,custom-pagination}.tsx`,
`hooks/use-url-search-input.ts`, `hooks/use-column-order.ts`. Detail perilaku lengkap: `ga-web/taste-ui.md`
§3.4 (rujukan wajib saat mem-port).

### 8.1 Anatomi

```
[🔍 Cari kode, nama, pemohon........  ⓘ]                    [Download Data (Excel) ▾]
┌ Filter (3) ▾ ───────────────────────────────────────────────────────── ✕ Reset ┐
│ (Status: Disetujui ✕) (Perusahaan: GMI ✕) (Tanggal: 01 Nov – 18 Nov 2026 ✕)    │
│ field filter + field rentang [Terapkan]   (hanya saat dibuka)                    │
└──────────────────────────────────────────────────────────────────────────────────┘
                     Urutan kolom sudah diubah. [↺ Kembalikan urutan bawaan]
┌ header menempel di bawah top bar ────────────────────────────────────────────────┐
│ No │ ⋮⋮Kode ↕ │ ⋮⋮Tanggal ↓ │ ⋮⋮Status │ ⋮⋮Perusahaan │ ⋮⋮Total ↕ │       Aksi │
├──────────────────────────────────────────────────────────────────────────────────┤
│ 1  │ PJ-0001  │ 18 Nov 2026 │ Disetujui│ GMI          │ Rp 150.000 │         ⋯ │
└──────────────────────────────────────────────────────────────────────────────────┘
Baris [25 ▾]  1–25 dari 230 pengajuan          ‹ 1 2 3 … 10 ›   Hal. [1] / 10 [Buka]
```

### 8.2 Param URL

| Param | Isi | Contoh |
|---|---|---|
| `q` | Kata kunci | `q=pompa` |
| `hal` | Halaman (≥ 1) | `hal=2` |
| `baris` | Baris per halaman: `10 / 25 / 50 / 100`, default 25 | `baris=50` |
| `urut` | `<kunci>.<asc\|desc>`, kunci harus ada di whitelist | `urut=total.desc` |
| `status`, `perusahaan`, `lokasi`, `departemen` | Filter pilihan | `status=approved` |
| `dari`, `sampai` | Rentang tanggal (`YYYY-MM-DD`, batas hari WIB) | `dari=2026-11-01` |
| `min`, `maks` | Rentang angka | `min=100000` |

Mengubah filter apa pun → `hal` kembali ke 1. Param kosong dibuang (`hrefWith`).

### 8.3 Komponen (semua wajib di halaman list)

| Bagian | Komponen | Aturan inti |
|---|---|---|
| Wadah | `Content` | Setiap blok halaman = `<Content>` di grid 12 kolom (`size`: `lg` 12, `md` 6, `sm` 4, `xs` 6/4/3). Jangan `<Card>` langsung |
| Cari | `ListSearchInput` + `useUrlSearchInput` | Placeholder **pendek**; daftar kolom yang dicari di popover ⓘ (`searchableFields`, harus sama dengan query). Debounce 400 ms; Back tetap jalan |
| Filter | `FilterPanel`, `FilterFields`, `FilterField`, `FilterRangeFields`, `FilterRange`, `FilterApplyButton` | Tertutup saat pertama kali dibuka, status buka diingat. Chip filter aktif selalu tampil dan bisa dihapus satu-satu. Select langsung berlaku; rentang setelah "Terapkan". Grid otomatis, jangan tulis grid manual |
| Tabel | `StickyHeaderTable` | Header menempel di bawah top bar dan sejajar saat scroll horizontal. `th` latar **solid** `bg-muted`. Harus di dalam `Content` |
| Sort | `SortableTableHead` + `resolveSort` | Seluruh sel bisa diklik; putaran: default → kebalikan → urutan bawaan. `title` menyebut hasil klik berikutnya |
| Geser kolom | `ReorderableHeaderRow` + `useColumnOrder` | Untuk list utama berkolom banyak. No & Aksi tetap. Disimpan per tabel per perangkat |
| Aksi | `RowActionsMenu` | **Selalu** titik tiga, walau aksinya satu. Item berbahaya paling bawah, merah. Satu `ConfirmDialog` controlled per tabel |
| Footer | `TablePaginationFooter` | "Baris [25]", "1–25 dari 230 X", paginasi, "Hal. [n] / total [Buka]". Di HP angka halaman disembunyikan |
| Export | `ExcelDownloadMenu` | [§18](#18-download-excel) |
| Quick view | `QuickViewDialog` | Klik baris → ringkasan → "Lihat Detail Lengkap". Link kode tetap langsung ke detail |

### 8.4 Aturan sel & keadaan

- Kolom No: `(hal - 1) * baris + i + 1`. Status: `StatusBadge`. Nama orang: `UserAvatar` + nama.
- Uang/angka rata kanan `tabular-nums`; kode `font-mono text-xs font-semibold`; teks panjang
  `max-w-[…] truncate` + `title`.
- Tabel lebar: `min-w-[…px]` lewat `className`, dan `overflow-x-auto` di `containerClassName`.
- Baris yang bisa diklik: `cursor-pointer hover:bg-muted/50 transition-colors`. Sel Aksi wajib
  `stopPropagation`.
- **Kosong** (satu baris `colSpan` penuh, `h-24 text-center`):
  - tanpa filter: "Belum ada pengajuan. Buat lewat tombol di atas.";
  - dengan filter: "Tidak ada yang cocok dengan filter ini." + link **Reset filter**.
- Query: kolom eksplisit, `.range()`, `{ count: "exact" }`, sort utama + `.order("id")` supaya stabil.
  Kata kunci di `.or()` wajib di-escape (`orIlikePattern`, port dari ga-web
  `lib/supabase/search-filter.ts`).
- Aturan list (kolom sort, filter, kolom cari, scope company) ditulis **sekali** di `lib/<domain>.ts` dan
  dipakai halaman list, export Excel, dan global search.

---

## 9. Form + panel Ringkasan di kanan

*Sumber port:* `ga-web/components/form-summary-panel.tsx` (`FormSummaryLayout`), pemakaian di
`material-request/buat/page.tsx` dan `purchase-order/create/page.tsx`.

Ini ciri khas ga-web: setiap form buat/ubah dokumen punya **panel Ringkasan di kanan** yang menunjukkan
apa yang sudah dan belum diisi, lalu menuntun user sampai submit.

### 9.1 Anatomi

```
┌──────────── form (Content per section) ─────────────┐ ┌──── Ringkasan Pengajuan ──── ⇥ ┐
│ Informasi Utama                                     │ │ PJ/GMI/2611/0042               │
│ Barang / Item                                       │ │ ██████████░░░░  3/5            │
│ Lampiran                                            │ │ ✓ Perusahaan       GMI         │
│                                                     │ │ ✓ Kategori         Sparepart   │
│ ─────────────────────────────────────────────────── │ │ ○ Barang      Minimal 1 barang │
│ [3/5] Lengkapi 2 langkah wajib…  ● Belum disimpan   │ │ ⚠ Lokasi      Beda dari profil │
│        Lihat ringkasan        [Ajukan Pengajuan]    │ │ ◌ Lampiran        (opsional)   │
└─────────────────────────────────────────────────────┘ │ Total estimasi  Rp 4.250.000   │
                                                        │ Setelah diajukan: …            │
                                                        │ [Ajukan Pengajuan]             │
                                                        └────────────────────────────────┘
```

- **Bar submit** di akhir form: badge progres `3/5`, petunjuk ("Lengkapi 2 langkah wajib…"), badge
  "Belum disimpan", link "Lihat ringkasan", tombol submit.
- **Panel kanan**: checklist langkah, nilai saat ini, konten tambahan (total biaya), penjelasan "Setelah
  diajukan…", dan tombol submit.
  - Desktop ≥ 1280 px: panel mendorong form (form menyempit).
  - Layar lebih kecil: overlay + backdrop, tutup dengan Esc.
  - Status buka/tutup diingat per perangkat.
- **Tab vertikal "Ringkasan"** di tepi kanan saat panel tertutup, dengan titik amber kalau ada perubahan
  belum disimpan.
- Klik baris checklist → scroll ke section + highlight ring. Klik submit saat masih ada `todo` → scroll ke
  langkah pertama yang kurang, bukan submit.

### 9.2 Status checklist

| Status | Arti | Memblok submit | Dihitung progres |
|---|---|---|---|
| `done` | Terpenuhi | – | ✔ selesai |
| `todo` | Wajib, belum diisi | **Ya** | ✔ belum |
| `suggested` | Disarankan (form ubah yang longgar) | Tidak | ✔ belum |
| `warning` | Terpenuhi tapi perlu perhatian | Tidak | ✔ selesai |
| `optional` | Opsional & kosong | Tidak | ✘ |

### 9.3 Integrasi dengan Server Action

```tsx
"use client";
const { state, pending, onSubmit } = useFormAction(createPengajuanAction);
useActionToast(state);
const values = useWatchedForm(formRef);               // nilai terkini untuk checklist & draft
const { dirty, resetBaseline } = useUnsavedChanges(values, ready);
const draft = useFormDraft({ key: "pengajuan-baru", values, onRestore: fill }); // §22.4

<form ref={formRef} onSubmit={onSubmit} noValidate>
  <FormSummaryLayout summary={{
    title: "Ringkasan Pengajuan",
    subtitle: doc?.code
      ? <span className="font-mono">{doc.code}</span>
      : <span className="text-muted-foreground">Draft · nomor dibuat saat diajukan</span>,
    checks: buildPengajuanChecks(values, state.fieldErrors), // lib/<domain>-rules.ts
    submitLabel: "Ajukan Pengajuan", submittingLabel: "Mengajukan...",
    submitting: pending, disabled: uploading || !online,     // proses lain / offline
    dirty, nextSteps: <>Pengajuan akan diperiksa oleh admin.</>,
    children: <TotalEstimasi values={values} />,
  }}>
    <Content id="section-utama" title="Informasi Utama">…</Content>
    <Content id="section-item" title="Barang">…</Content>
    <Content id="section-lampiran" title="Lampiran">…</Content>
  </FormSummaryLayout>
</form>
```

- Checklist dibangun dari **aturan yang sama** dengan zod di `lib/<domain>-rules.ts`, sehingga client dan
  server tidak pernah berbeda pendapat.
- `fieldErrors` dari server (`invalid(error)`) mengubah langkah terkait menjadi `todo` dengan hint
  pesannya, lalu panel scroll ke langkah pertama yang gagal.
- `enabled={false}` mematikan panel di halaman detail yang hanya menjadi form saat mode ubah.
- `beforeunload` + konfirmasi saat meninggalkan form `dirty` (kecuali sudah tersimpan sebagai draft).

### 9.4 Input standar

| Kebutuhan | Komponen |
|---|---|
| Pilihan ≤ ~7 | `Select` |
| Pilihan banyak / bisa dicari | `Combobox` Base UI (port perilaku `SearchableSelect`) |
| Entitas dari DB (barang, vendor, orang) | Combobox async + debounce 250 ms (Server Action / client query) |
| Uang | `CurrencyInput` (tampil `Rp 1.500.000`, kirim angka) |
| Tanggal | `DatePicker`; di panel filter boleh `<Input type="date">` |
| Teks panjang + mention | `RichMentionEditor` (Tiptap, `@` orang; jenis mention lain disesuaikan app) |
| File | `FileDropzone` (klik / seret / tempel) + `LinkAttachmentForm` untuk file besar (link Drive) |

- Label di atas, input full width, `id` untuk target scroll, hint `text-xs text-muted-foreground`.
- Input teks `text-base md:text-sm` (16 px di HP supaya iOS tidak zoom).
- Upload langsung browser → Storage (bucket `<app>-lampiran`, private, path `<record_id>/<nama>`),
  progres lewat toast, lalu action hanya menyimpan path. Gambar dikompres di browser sebelum upload.
- *(Sebaiknya)* "Pakai Template" dan "Ambil dari Riwayat" di form buat (pola `MrTemplatePickerDialog`,
  `MrHistoryPickerDialog`).

---

## 10. Halaman detail, approval, follow-up

*Sumber port:* `material-request/[id]/page.tsx`, `taste-ui.md` §3.6 dan §9.1–9.3,
`components/followup-approval-button.tsx`.

### 10.1 Struktur

```
PJ/GMI/2611/0042                       [Riwayat Aktivitas] [Cetak ▾] [Ubah] [⋯]
Dibuat Rabu, 18 November 2026 · [Disetujui] · Umur: 3 Hari 4 Jam
[Banner kontekstual, mis. "Menunggu konfirmasi penerimaan Anda" + tombol]
┌──────────── lg:col-span-8 ────────────┐ ┌──── lg:col-span-4 ─────┐
│ Informasi Utama (InfoItem)            │ │ Tindakan               │
│ Daftar Item                           │ │ Jalur Approval         │
│ …                                     │ │ Lampiran               │
│                                       │ │ Diskusi                │
└───────────────────────────────────────┘ └────────────────────────┘
```

- Server Component membaca dokumen + approvals + lampiran sekaligus (`Promise.all`). Data tidak ada atau
  role kurang → `notFound()`.
- Judul: kode `text-3xl font-bold`; meta + `StatusBadge tone="solid"` + umur dokumen (`formatAge`).
- Tombol "Kembali" memakai `useGoBack(fallbackHref)`, bukan `router.back()`. Halaman yang dibuka dari
  notifikasi push tidak punya riwayat.
- **Kartu Tindakan** selalu ada di kanan atas:
  - giliran user → tombol Setujui/Tolak (Tolak wajib alasan, dengan `ConfirmDialog destructive`);
  - bukan giliran → kalimat penjelasan ("Menunggu persetujuan **Budi**, sejak 2 jam lalu").
- Banner kontekstual: `rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900
  dark:bg-amber-950/40` + ikon + teks + tombol.
- Mode ubah di halaman yang sama: `FormSummaryLayout enabled={isEditing}`, kolom memakai container query
  (`@4xl/form:col-span-8`).

### 10.2 Komponen

| Komponen | Isi |
|---|---|
| `InfoItem` | Ikon + label abu (1/3) dan nilai `font-semibold` (2/3), atau bertumpuk (`isBlock`) |
| `ApprovalPath` | Stepper vertikal: avatar, nama, departemen, tipe (Mengetahui/Menyetujui), waktu proses, status. Baris yang sedang giliran `bg-primary/10 ring-2 ring-primary/50` + slot aksi (Follow-up) |
| `StepChain` | Rantai proses horizontal (`done` hijau ✓, `current` oranye, `rejected` merah ✕, `pending` abu) |
| `DiscussionPanel` | Chat per dokumen: bubble kanan/kiri, balas kutipan, gambar (drag/paste), mention, emoji. Controlled; simpan lewat Server Action |
| `ActivityLogDialog` | [§11](#11-riwayat--audit-trail) |
| Riwayat revisi *(sebaiknya)* | Badge "Versi Asli", "Revisi 2", …, "Versi Terkini" kalau approver boleh mengedit sebelum menyetujui |

Kode siap pakai `InfoItem`, `ApprovalPath`, `StepChain`, `ConfirmDialog`, dan `StatusBadge` ada di
`ga-web/taste-ui.md` §9. Port ke Base UI dan ganti `formatDateWithTime` → `formatDateTime` (WIB).

### 10.3 Follow-up approval

Untuk app yang punya unsur approval. Requester atau admin bisa "mencolek" approver yang sedang giliran.

- Tombol outline kecil **Follow-up** (ikon `BellRing`) di baris `ApprovalPath` yang sedang giliran. Hanya
  tampil untuk pemilik dokumen/admin, dan tidak untuk approver itu sendiri.
- Konfirmasi:
  - pertama kali: "Kirim notifikasi follow-up ke **Nama** supaya segera memproses approval PJ-0042?";
  - pernah dikirim: "Anda sudah meminta follow-up ke **Nama** 3 jam lalu. Ajukan lagi?".
- Server Action `requestFollowupAction(approvalId)` memanggil RPC `<app>.request_followup()` yang
  dalam satu transaksi:
  1. cek giliran & hak;
  2. **jeda minimal 1 jam** per (langkah, peminta);
  3. insert `followups`;
  4. tulis log + CCTV;
  5. kirim notifikasi ke approver (+ Web Push).
- Hasil: `toast.success("Follow-up terkirim ke Budi.")`, teks "Terakhir di-follow-up 5 menit lalu" di
  bawah tombol.
- Di sisi approver: panel **"Permintaan Follow-up Approval"** paling atas di dashboard (border merah,
  ikon berdenyut, "3x diminta follow-up, terakhir 10 menit lalu") dan item di Inbox.

### 10.4 Approval engine di UI

Semua dokumen ber-approval memakai engine yang sama (`backend-guide.md` §6). Di frontend:

| Halaman / komponen | Isi |
|---|---|
| Tombol **Ajukan** (form/detail draft) | Action → RPC `approval_start`. Nomor dokumen baru muncul setelah diajukan. Error "Belum ada template…" tampil apa adanya (pesan `P0001`) |
| Kartu **Tindakan** | Dari `approvals` dokumen: giliran user → **Setujui** / **Tolak** (alasan wajib ≥ 5 karakter) → `approval_decide`. Pemohon saat pending → **Tarik Pengajuan** (`approval_cancel`). Admin → **Ubah Approval** (ganti/lewati approver, alasan wajib) |
| `ApprovalPath` | Langkah putaran terakhir: tipe (Mengetahui/Memeriksa/Menyetujui), status, waktu, catatan, batas waktu ("Terlambat 5 jam" merah). Putaran sebelumnya di accordion "Pengajuan sebelumnya (ditolak)" |
| **`/approval`** — Approval Saya | Antrian dari `pending_for_me()`, dikelompokkan per jenis dokumen ("Menunggu Persetujuan Anda (Pengajuan)"), urut follow-up terbanyak lalu terlama. Antrian kosong tetap tampil: "Tidak ada yang menunggu Anda." |
| **`/approval/template`** (admin) | Builder template: jenis dokumen, nama, cakupan (company, departemen, rentang nominal), prioritas, langkah (tambah, naik/turun, tipe, approver = orang tertentu / kepala departemen, batas waktu jam). Pratinjau "Dokumen GMI · IT · Rp 5 jt akan memakai template ini". Memakai `FormSummaryLayout` |
| **`/approval/kepala-departemen`** (admin) | Tabel departemen × company → kepala departemen (Combobox orang). Peringatan untuk sel kosong yang dipakai template |

- Menu: "Approval Saya" di grup **Menu** (dengan badge jumlah antrian); "Template Approval" dan "Kepala
  Departemen" di grup **Admin**.
- Setiap aksi approval memberi toast hasil + notifikasi ke pihak berikutnya + Web Push, sehingga alur
  berjalan tanpa user perlu saling menghubungi.

---

## 11. Riwayat & audit trail

Tujuannya: siapa pun yang membuka dokumen bisa menjawab "siapa mengubah apa, kapan, dari berapa menjadi
berapa" tanpa bertanya ke IT.

### 11.1 Data (standar §7: `<entitas>_logs` diisi trigger)

Setiap tabel dokumen punya tabel log dengan **bentuk yang sama**, sehingga satu komponen UI bisa membaca
semuanya:

```sql
create table __APP__.pengajuan_logs (
  id          bigint generated always as identity primary key,
  record_id   uuid not null references __APP__.pengajuan(id) on delete cascade,
  at          timestamptz not null default now(),
  actor_id    uuid default auth.uid() references public.profiles(id) on delete set null,
  action      text not null,          -- insert | update | delete | approve | reject | followup | …
  changes     jsonb,                  -- {"kolom": {"old": …, "new": …}} hanya kolom yang berubah
  note        text                    -- alasan tolak, catatan admin
);
```

- Trigger generik `__APP__.log_changes()` (template di `db/`) dipasang `after insert or update or delete`.
  Isinya hanya kolom yang berubah, dan `updated_at` diabaikan.
- **Aksi bisnis** (setujui, tolak, follow-up, ubah status) ditulis oleh RPC yang menjalankan aksinya, di
  transaksi yang sama, dengan `action` yang bermakna dan `note`. Bukan dari client.
- RLS: baca mengikuti hak baca dokumennya. Insert hanya lewat trigger/RPC (`security definer` +
  `set search_path = ''`). Tidak ada update/delete dari app.
- Retensi: disimpan minimal 5 tahun, setelah itu dipindah ke arsip, tidak dihapus
  ([§13.7](#137-retensi-data)).
- `public.audit_log` tetap khusus data platform (profil, akses). App tidak menulis ke sana.

### 11.2 UI

`<ActivityLogDialog entity="pengajuan" recordId={id} />`: tombol outline **Riwayat Aktivitas** (ikon
`History`) → dialog timeline.

- Titik primary + garis vertikal. Tiap entri berisi waktu (WIB), **badge aksi berbahasa Indonesia**
  (`ACTION_LABELS`: "Dibuat", "Diubah", "Disetujui", "Ditolak", "Diedit Admin", "Follow-up"), avatar +
  nama pelaku ("Sistem" kalau kosong), dan catatan (2 baris + "Lihat selengkapnya").
- **Rincian perubahan**: `Label: nilai lama → nilai baru`, 5 baris pertama lalu "Lihat semua (N)".
  - Label kolom & cara format nilai dari `FIELD_LABELS` di `lib/<domain>-rules.ts` (Rupiah, tanggal WIB,
    nama orang dari id, label status).
  - Kolom yang tidak terdaftar disembunyikan (id teknis, kolom pencarian).
  - Teks panjang dipotong.
- Data dimuat saat dialog dibuka (Server Action), bukan saat halaman dimuat.
- Kosong: "Belum ada riwayat aktivitas."

### 11.3 Tracing lintas dokumen

- Halaman detail menampilkan **rantai dokumen** (`StepChain` + link) kalau dokumen punya induk/anak.
- Setiap notifikasi, follow-up, dan log punya `href` ke dokumennya. Dari mana pun user bisa sampai ke
  sumbernya dengan satu klik.
- *(Sebaiknya)* halaman admin **Log Aktivitas** (`/log`): semua `<entitas>_logs` digabung lewat view
  `security_invoker`, dengan filter pelaku/aksi/tanggal/entitas dan export Excel. Gunanya untuk audit.

### 11.4 CCTV (jejak lintas app di konsol monitoring)

Aksi penting setiap app juga dikirim ke `public.cctv_events`. Tim IT bisa menelusurinya dari halaman
**CCTV** di konsol monitoring (detail di `backend-guide.md` §2.2 dan §9).

- **Otomatis dari DB**: buat/hapus dokumen, diajukan, disetujui, ditolak, dibatalkan, follow-up, edit
  admin, perubahan template approval. Frontend tidak perlu melakukan apa-apa.
- **Dari server app** lewat `cctv()` (`lib/cctv.ts`, best-effort di `after()`): masuk/keluar, akses
  ditolak, download Excel (jumlah baris + filter), cetak dokumen, perubahan akses user.
- Karena itu **cetak dokumen memanggil Server Action `logPrintAction(docId, mode)` sebelum
  `printWithFileName()`**. Kalau action gagal, cetak tetap jalan.
- Tidak ada indikator CCTV di UI user. Admin app bisa melihat CCTV app-nya di konsol monitoring.

---

## 12. Toast, dialog, konfirmasi

*Sumber port:* `ga-web/lib/toast.tsx`, `components/ui/toast-copy-button.tsx`, `lib/clipboard.ts`,
`taste-ui.md` §9.4 (`ConfirmDialog`).

### 12.1 Toast

```tsx
// app/layout.tsx
<Toaster richColors closeButton position="bottom-right"
  toastOptions={{ closeButtonAriaLabel: "Tutup", classNames: { content: "flex-1" } }} />
```

- **Wajib** `import { toast } from "@/lib/toast"`, bukan dari `sonner`. API-nya sama, tapi
  success/error/info/warning/message otomatis punya **tombol Salin**. User bisa menyalin pesan error untuk
  dilaporkan lewat Bantuan Admin. `toast.loading` sengaja tanpa tombol Salin.
- Pola:

  ```ts
  const id = toast.loading("Mengajukan pengajuan...");
  // … action
  toast.success("Pengajuan PJ-0042 berhasil diajukan dan menunggu persetujuan.", { id });
  toast.error("Gagal mengajukan pengajuan", { id, description: state.message });
  ```

- Sukses: kalimat lengkap yang menyebut objeknya. Gagal: "Gagal <aksi>" + detail di `description`.
- Toast yang butuh aksi: `action: { label: "Lihat", onClick }`.
- Tombol Salin memakai `writeClipboard` (jalan di HTTP/IP LAN dan di dalam Dialog).

### 12.2 Dialog

| Kebutuhan | Pakai |
|---|---|
| Form / detail di atas halaman | `Dialog` (isi panjang: `ScrollArea`, `max-h-[80vh]`) |
| Konfirmasi | `ConfirmDialog` (satu-satunya). Mode trigger & controlled, default teks Indonesia, varian `destructive`, `onConfirm` async (dialog menunggu, tetap terbuka kalau gagal) |
| Panel samping | `Sheet` |
| Info kecil | `Tooltip` / `Popover` |

- Konfirmasi menyebut objeknya: "Hapus pengajuan PJ-0042?".
- Hanya untuk yang tidak bisa dibatalkan: hapus, tolak, keluar, cabut akses.

---

## 13. Notifikasi & Inbox

*Sumber port:* `ga-web/components/providers/NotificationProvider.tsx`, `notifications/page.tsx`,
`components/topbar/topbar-inbox.tsx`, `use-inbox.ts`, `lib/notifications/*`,
`components/notification-settings.tsx`.

### 13.1 Data

`__APP__.notifications` ([Lampiran C](#lampiran-c-tabel-modul-dasar)): `user_id`, `actor_id`, `type`,
`category`, `title`, `body`, `href`, `entity`, `record_id`, `read_at`, `created_at`.

- **Dibuat oleh DB**, bukan client. `__APP__.notify()` adalah fungsi internal yang hanya dipanggil RPC
  domain (approval, Bantuan, feedback). App tidak bisa memanggilnya langsung, sehingga user tidak bisa
  memalsukan notifikasi untuk orang lain. RPC domain mengembalikan `notification_ids` untuk Web Push.
- RLS: user hanya membaca dan menandai miliknya sendiri.
- **Bukan email.** Kuota Resend dipakai login semua app (standar §6.8).
- Retensi ([§13.7](#137-retensi-data)): notifikasi dibaca > 90 hari dan belum dibaca > 180 hari dihapus
  otomatis.

### 13.2 `NotificationProvider`

`useNotification()` → `{ unreadCount, latest, markRead, markAllRead, refresh }`.

- **Satu** channel realtime per tab: `postgres_changes` `INSERT` pada `notifications` dengan filter
  `user_id=eq.<uid>`. Ini satu-satunya realtime global (standar membatasi realtime). Penyimpangan ini
  dicatat di `CLAUDE.md`.
- Event baru:
  1. badge sidebar, Inbox, dan halaman ikut berubah;
  2. suara (Web Audio sintetis, tanpa file; jalan offline);
  3. notifikasi browser lewat **service worker** (`registration.showNotification`, `data.url`) kalau tab
     tidak fokus, jatuh ke `new Notification()` hanya kalau tidak ada SW;
  4. toast kecil "Notifikasi baru: …" dengan aksi **Lihat** kalau tab sedang fokus.
- Tab kembali fokus / online lagi → `refresh()` sekali (menutup celah event yang terlewat).
- Klik notifikasi browser (di `sw.js`): fokus ke window yang sudah di URL itu → window app lain lalu
  pindah URL → baru buka window baru.

### 13.3 Halaman `/notifikasi`

- Filter di URL: Semua/Belum dibaca, kategori, modul, `q`. Dijalankan di query, bukan menyaring data yang
  sudah dimuat.
- Dikelompokkan per tanggal: "Hari ini", "Kemarin", lalu tanggal.
- "Muat lebih banyak" (30 per halaman), bukan paginasi.
- Toggle dibaca/belum per item. Tombolnya muncul saat hover hanya di perangkat berpointer
  (`pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100`) dan selalu terlihat di layar sentuh.
- **Pilih banyak:** checkbox per baris, bar seleksi (`N dipilih` · Tandai dibaca · Tandai belum dibaca ·
  ✕). Hanya item yang statusnya berubah yang di-update, dalam satu query. Hasilnya
  `toast.success("3 notifikasi ditandai sudah dibaca")`.

### 13.4 Inbox top bar

Satu daftar cepat yang menggabungkan semua sumber:

| Sumber | Warna ikon |
|---|---|
| Notifikasi | `bg-primary` |
| Bantuan Admin (balasan/percakapan menunggu) | `bg-sky-600` |
| Pembaruan (Update Web baru) | `bg-amber-600` |
| Follow-up untuk Anda | `bg-red-600` |

- Header: "Inbox" + pill "N baru" + "Tandai semua dibaca". Chip filter Semua / Notifikasi / Bantuan /
  Pembaruan dengan jumlah belum dibaca.
- Baris: avatar pelaku + ikon sumber kecil di pojok, judul (`font-semibold` kalau belum dibaca), pesan
  `line-clamp-2`, "Sumber · 5 menit lalu". Belum dibaca = `bg-primary/[0.06]` + garis aksen kiri + titik
  primary.
- Klik → tandai dibaca + tutup + pindah ke `href`.
- Hanya **7 hari terakhir, maks. 20 item** (ditulis juga di footer), plus link "Semua notifikasi".
- Kosong → ikon `Inbox` + "Inbox kosong".

### 13.5 Pengaturan (halaman Profil)

Suara on/off, volume, jenis nada, ringtone custom (IndexedDB) *(sebaiknya)*, izin notifikasi browser
(dengan tombol "Uji notifikasi"), **Notifikasi HP** (Web Push, [§13.6](#136-web-push)), dan install app
(PWA). Disimpan per perangkat.

### 13.6 Web Push

*Sumber port:* `ga-web/lib/notifications/push.ts`, `app/api/push/send/route.ts`, handler `push` di
`public/sw.js`, `lib/pwa/use-install-prompt.ts`.

Notifikasi tetap masuk ke HP/laptop walaupun tab atau browser sudah ditutup.

**Env**

| Env | Isi | Di Coolify |
|---|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Public key VAPID (boleh publik) | Buildtime ✔ + runtime |
| `VAPID_PRIVATE_KEY` | Private key VAPID | **Runtime saja**, buildtime ✘ (Production **dan** Preview) |
| `VAPID_SUBJECT` | `mailto:` alamat tim IT | Runtime |

Satu pasang key **per app** (`npx web-push generate-vapid-keys`), diambil langsung ke `.env.local` tanpa
ditampilkan. Tidak memakai `SUPABASE_SECRET_KEY`.

**Alur kirim (tanpa secret key Supabase)**

```
Server Action (sesi user)
  1. rpc domain (mis. approval_decide) → { notification_ids } (actor_id = auth.uid())
  2. rpc push_targets(ids)      → endpoint + keys milik PENERIMA notifikasi itu saja
  3. lib/push.ts sendPush(...)  → web-push, paralel, timeout 5 s, TTL 24 jam
  4. rpc push_prune(endpoints)  → hapus subscription yang dibalas 404/410
```

- `push_targets` adalah fungsi `security definer`. Ia hanya mengembalikan subscription untuk notifikasi yang
  **dibuat oleh pemanggil** dalam 2 menit terakhir. User tidak bisa membaca subscription orang lain
  secara bebas.
- Notifikasi yang dibuat trigger (perubahan status) juga punya `actor_id = auth.uid()`, jadi action yang
  memicunya bisa langsung memanggil langkah 2–4.
- Pengiriman push **tidak boleh** menggagalkan aksi utama. Error dicatat di log server, aksi tetap sukses.
- Payload: `{ title, body, url, tag }`. Tidak berisi data sensitif (nominal, NRP), cukup judul dan kode
  dokumen.

**Berlangganan (client)**

- Kartu "Notifikasi HP" di Profil + ajakan sekali di dashboard (bisa ditutup, diingat per perangkat):
  "Aktifkan notifikasi supaya approval tidak terlewat."
- Klik **Aktifkan** → minta izin → `pushManager.subscribe({ applicationServerKey })` → Server Action
  menyimpan ke `__APP__.push_subscriptions` (endpoint unik, `user_id`, `user_agent`, `last_used_at`).
- **iOS/iPadOS**: Web Push hanya jalan dari app yang sudah di-install ke Home Screen. Kalau belum, kartu
  menampilkan langkah "Bagikan → Tambah ke Layar Utama" (`isStandalone()`). Android/desktop: tombol
  **Install App** (`use-install-prompt`).
- Status per perangkat: Aktif / Diblokir browser (beri cara membuka izin) / Belum aktif. Ada tombol **Uji
  notifikasi** dan **Matikan di perangkat ini**.
- Saat Keluar: subscription perangkat itu dihapus, supaya notifikasi user lain tidak masuk ke HP yang
  dipakai bergantian.

**Service worker**

- `push` → `showNotification(title, { body, icon: "/icons/icon-192.png", badge, tag, data: { url } })`.
  `tag` per dokumen, sehingga notifikasi untuk dokumen yang sama saling menggantikan, tidak menumpuk.
- `notificationclick` → alur fokus/pindah window seperti [§13.2](#132-notificationprovider).
- Kalau tab app sedang fokus, notifikasi OS tidak ditampilkan (sudah ada toast + suara).

### 13.7 Retensi data

Dijalankan oleh `<app>.run_maintenance()` yang dipanggil `public.run_maintenance_all()` dari **systemd
timer di VPS** (pola sama dengan backup; instance Lourdes tidak memakai `pg_cron`). Jadwal 03:00 WIB,
setelah backup 02:00. Job yang sama juga mengirim pengingat approval yang melewati batas waktu. Detail:
`backend-guide.md` §2.3 dan §12.

| Data | Aturan default |
|---|---|
| `notifications` | Dibaca > 90 hari, atau belum dibaca > 180 hari → hapus |
| `push_subscriptions` | `last_used_at` > 90 hari → hapus |
| `followups` | Dokumen sudah selesai/ditolak > 180 hari → hapus |
| `support_threads` + pesan | Status `selesai` > 1 tahun → hapus, termasuk lampirannya di storage |
| `<entitas>_logs` | **Disimpan minimal 5 tahun** (jejak audit). Lebih lama dari itu → dipindah ke tabel `*_logs_archive`, tidak dihapus |
| Draft & cache offline | Di perangkat: 14 hari (draft), 3 hari (halaman) |

- Hasil tiap run (jumlah baris per tabel) ditulis ke `__APP__.maintenance_runs` dan
  `public.maintenance_runs`, supaya bisa dicek dari konsol monitoring.
- Batas hari ditulis sebagai konstanta di fungsi. App yang punya kewajiban arsip lebih lama (keuangan)
  menaikkan angkanya di migration-nya sendiri.

---

## 14. Bantuan Admin

*Sumber port:* `ga-web/app/(With Sidebar)/chat-admin*/`, `components/support-chat/*`,
`components/topbar/topbar-chat-admin.tsx`, `components/auth/chat-admin-info-dialog.tsx`,
`hooks/use-support-chat-badge.ts`.

Chat antara user dan **admin app ini** (role `admin`), per topik (percakapan).

- **`/bantuan`** (user) dan **`/bantuan/kelola`** (admin) memakai komponen yang sama
  (`SupportTicketList`, `SupportChatThread`, `SupportComposer`). Bedanya hanya `asAdmin`.
- Pola dua panel dalam satu `<Content>`: grid `md:grid-cols-[minmax(260px,340px)_1fr]`, tinggi
  `h-[calc(100svh-15rem)] min-h-[480px]`. Di HP hanya satu panel (daftar atau thread + tombol kembali).
- Percakapan terpilih di `?t=<id>`, sehingga link dari notifikasi langsung membukanya. Belum memilih →
  ikon `Headset` dalam lingkaran `bg-primary/10` + petunjuk.
- "Percakapan Baru" → dialog singkat: kategori (Kendala akses, Error/bug, Cara pakai, Data salah,
  Lainnya), subjek, pesan, lampiran opsional. **Prediktif:** isi otomatis "Halaman: <URL terakhir>" dan
  info perangkat (browser, ukuran layar, mode tema) sebagai lampiran teks kecil, supaya admin tidak perlu
  bertanya.
- Status: `menunggu` / `dibalas` / `selesai`. User bisa menandai Selesai. Admin bisa Ambil, alihkan ke
  admin lain, tandai selesai/buka kembali, dan hapus (konfirmasi).
- Composer: Enter kirim, Shift+Enter baris baru (di HP Enter = baris baru), 1 lampiran via klip atau
  tempel. File baru diunggah saat pesan dikirim.
- Realtime **hanya di halaman ini** (thread yang sedang dibuka). Badge di luar halaman ikut dari
  notifikasi (`type = 'support_message'`), jadi tidak menambah channel.
- **Top bar**: tombol `Headset` → **dropdown**, tidak langsung pindah halaman (isian form yang sedang
  diketik tidak hilang). User: satu kalimat + "Buka Bantuan Admin"/"Lihat Balasan". Admin: "Inbox
  Bantuan" + "Percakapan Saya" dengan pill angka.
- **Halaman auth**: tombol `Headset` → dialog "Belum bisa masuk?". Bantuan Admin baru bisa dipakai setelah
  login. Semua user adalah karyawan, jadi dialog ini **tanpa nomor kontak**. Isinya: minta bantuan ke
  atasan (Department Head) atau langsung ke tim IT. Akun dan reset password dibuat oleh tim IT.
  Kalau lupa password, pakai "Lupa password" di bawah form.

---

## 15. Pengguna & akses, profil, foto profil

### 15.1 Batas (wajib, dari standar)

App **tidak** membuat, menghapus, memblokir user, mereset password, atau mengubah profil dasar orang lain.
Semua itu lewat konsol `monitoring.lourdes.cloud/pengguna`. Yang boleh dilakukan app:

- membaca direktori `public.profiles` (+ master departemen/jabatan/lokasi);
- **admin app** mengatur `public.app_access` untuk app ini (policy mengizinkan);
- mengelola data khusus app di `__APP__.members`.

### 15.2 Halaman `/pengguna` (admin) — "Pengguna & Akses"

*Sumber port tampilan:* `ga-web/app/(With Sidebar)/user-management/*`.

- List standar ([§8](#8-halaman-list--tabel-standar)) berisi user yang punya akses ke app ini: avatar,
  nama, email, perusahaan, departemen, jabatan, lokasi, **role app**, diberikan oleh/kapan, dan
  status aktif (dari profil).
- Filter: role, perusahaan, departemen, lokasi, aktif. Cari: nama, email, NRP.
- **Tambah Akses** (`cardAction`): dialog → cari orang dari direktori (Combobox async, hanya
  `is_active`) → pilih role (dengan penjelasan Viewer = baca, Editor = tambah/ubah, Admin = hapus &
  kelola akses) → Simpan.
- Aksi baris: Ubah role, **Cabut akses** (`ConfirmDialog destructive`, tidak bisa mencabut diri sendiri
  kalau admin terakhir).
- Kartu info di atas: "Akun baru dan reset password dikelola tim IT di konsol platform." Link ke konsol
  hanya tampil untuk platform admin.
- **`/pengguna/[id]`**: profil dasar (read-only), role app, data `members` yang bisa diubah admin
  (level approval, tim, dll.), dan dokumen milik user di app ini.
- Export Excel daftar akses.

### 15.3 Profil saya (`/profil`)

Kartu berurutan:

1. **Data Profil** (`size="md"`): foto (bisa diganti), nama, email, perusahaan, NRP, departemen, jabatan,
   lokasi. Hanya **No HP** yang bisa diubah sendiri (sesuai `profiles_guard`). Kolom lain diberi hint
   "Diubah oleh tim IT".
2. **Tampilan**: mode, aksen, font (komponen yang sama dengan top bar).
3. **Notifikasi** ([§13.5](#135-pengaturan-halaman-profil)).
4. **Akses Saya**: daftar `my_apps()` dengan role dan link ke tiap app.
5. Data khusus app (`members`) di paling bawah, kalau ada.

### 15.4 Foto profil

*Sumber port:* `components/{image-crop-dialog,profile-avatar-dialog,avatar-viewer-dialog,user-avatar,user-profile-card}.tsx`.

- Foto yang bisa diklik: overlay `bg-black/50` + ikon kamera saat hover (`pointer-coarse:hidden`). Di
  layar sentuh diganti badge kamera kecil `bg-primary` di pojok yang selalu tampil.
- `ImageCropDialog`: pilih file / kamera / tempel → crop bulat (zoom, geser) → output **WebP 512×512**,
  dikompres sampai < 300 KB (bucket `avatars` maks 2 MB, hanya jpeg/png/webp).
- Simpan:
  1. upload ke `avatars/<uid>/avatar-<timestamp>.webp`;
  2. Server Action update `profiles.avatar_url`;
  3. hapus file lama;
  4. pancarkan event `avatar-updated` supaya top bar, sidebar, dan dashboard ikut berubah tanpa reload.
- Hapus foto → kembali ke inisial.
- `UserAvatar` ada di mana pun nama orang tampil (tabel, approval, diskusi, log). Klik →
  `UserProfileCard` (popover: foto, nama, perusahaan, departemen, jabatan, lokasi, No HP dengan tombol
  WhatsApp). Data kartu di-cache per sesi. Klik di popover tidak memicu klik baris tabel.
- `AvatarViewerDialog` untuk melihat foto ukuran penuh.
- Avatar dashboard bisa diganti bentuknya oleh user (bulat/rounded/kotak, disimpan per perangkat).

---

## 16. Multi company

Mengikuti ga-web. Sumber kebenaran company user: `public.profiles.company` (`GMI` / `GIS` / `LOURDES` =
keduanya / `null` = akun IT).

### 16.1 Tabel master `public.companies` (platform)

Daftar perusahaan menjadi **master data platform**, dikelola platform admin di konsol monitoring seperti
departemen/jabatan/lokasi. Ini perubahan schema `public`, jadi migration-nya ditulis di `lourdes-db`
(backward compatible, [Lampiran C](#lampiran-c-tabel-modul-dasar)):

| Kolom | Isi |
|---|---|
| `code` PK | `GMI`, `GIS`, `LOURDES` (pola `^[A-Z][A-Z0-9_]{1,15}$`) |
| `name`, `short_name` | "PT. Garuda Mart Indonesia", "GMI" |
| `address`, `phone`, `email` | Untuk kop cetak & Excel |
| `logo_url`, `logo_landscape_url` | URL logo (bucket public `branding`, atau path `/gmi-logo.webp` di app) |
| `accent` | Nama tema aksen (`gmi`, `gis`, `zinc`, …) |
| `is_group` | `true` untuk LOURDES (= mencakup semua anak perusahaan) |
| `sort_order`, `is_active` | Urutan tampil; nonaktifkan, jangan hapus |

- `profiles.company` berubah dari check constraint menjadi FK ke `companies.code`. Aturan NRP per company
  (`profiles_company_nrp`) tetap dijaga platform.
- Logo default untuk 3 company yang sudah ada tetap dibawa di `public/` boilerplate (fallback kalau
  `logo_url` kosong atau gagal dimuat).

### 16.2 `lib/companies.ts`

Port dari `ga-web/lib/companyDetails.ts` + `lib/mr-list.ts#getMrAllowedScope`.

```ts
import "server-only";
export type Company = { code: string; name: string; shortName: string; address: string | null;
  phone: string | null; email: string | null; logoUrl: string; logoLandscapeUrl: string;
  accent: string; isGroup: boolean };

/** Semua company aktif (di-cache per request, dibaca sekali di layout lalu dioper ke client). */
export const getCompanies = cache(async (): Promise<Company[]> => { /* .schema("public").from("companies") */ });

/** Company dokumen yang boleh dilihat user. Platform admin / company grup / akun IT = semua. */
export function companyScope(user: { company: string | null; platformAdmin: boolean }, companies: Company[]): string[] | "ALL" {
  const mine = companies.find((c) => c.code === user.company);
  if (user.platformAdmin || !mine || mine.isGroup) return "ALL";
  return [mine.code, ...companies.filter((c) => c.isGroup).map((c) => c.code)];
}
```

- Client menerima daftar company lewat context `CompaniesProvider` dari layout, sehingga tidak ada query
  ulang.
- Tidak ada lagi nama, alamat, atau logo perusahaan yang ditulis langsung di komponen.

### 16.3 Aturan

- Setiap tabel dokumen punya `company_code text not null references public.companies(code)` + index.
- **Scope dijaga di RLS** (penjaga terakhir) lewat helper `__APP__.company_visible(company_code)`, bukan
  hanya di query. Query list, export, dan global search tetap memfilter dengan `companyScope()` supaya
  hasil dan hitungannya cocok.
- **Default prediktif**: form buat dokumen mengisi `company_code` dari profil. User LOURDES memilih GMI/GIS
  (select wajib). GMI/GIS terkunci (tampil sebagai badge).
- List punya filter **Perusahaan** (multi pilih, hanya opsi dalam scope) dan kolom Perusahaan berbentuk
  badge kecil.
- Dashboard: judul "Ringkasan GMI" mengikuti scope. User LOURDES punya pemilih perusahaan di header
  dashboard (`?perusahaan=`).
- Kop cetak dan Excel memakai data company dokumen dari `getCompanies()`. Nomor dokumen sebaiknya memuat
  `short_name` (`PJ/GMI/2611/0042`).
- Aksen awal mengikuti `companies.accent` milik user ([§5.3](#53-warna-aksen)). Kalau company baru
  ditambahkan dengan aksen baru, class `theme-<accent>` ditambahkan dulu di `globals.css` boilerplate.

---

## 17. Dashboard

*Sumber port:* `ga-web/app/(With Sidebar)/dashboard/page.tsx`, `components/dashboard/*`,
`components/update-web/UpdateWebDashboardBanner.tsx`, `components/petty-cash/{PcActionNeededList,PcActivityFeed}.tsx`.

### 17.1 Urutan (wajib)

1. **Sapaan + profil**: `DashboardProfileAvatar`, "Selamat pagi, Budi!", departemen · role · perusahaan,
   jam & tanggal (WIB, berdetak tiap menit).
2. **Banner Pembaruan** (hanya kalau ada post baru belum dilihat ≤ 7 hari, kecil, "denyut" halus).
3. **Permintaan Follow-up** (merah, paling mendesak).
4. **Perlu Aksi Anda**: kartu grid 1/2/3 kolom, tiap item deep-link ke halaman aksinya.
5. **Filter periode**: bulan (‹ November 2026 ›) + chip Minggu 1–5 + (LOURDES) pemilih perusahaan.
   Semuanya di URL (`bulan=2026-11&minggu=2&perusahaan=GMI`).
6. **Stat card** (`size="xs"`), semuanya bisa diklik.
7. **Grafik & insight**.
8. **Terbaru** (tabel ringkas dokumen terakhir) + **Feed aktivitas** dengan chip filter jenis.

Yang butuh aksi **selalu di atas** angka statistik.

### 17.2 Data

- Server Component. Setiap blok dibungkus `<Suspense fallback={<Skeleton…/>}>` sendiri, sehingga sapaan
  dan "Perlu Aksi" tampil dulu tanpa menunggu grafik (streaming).
- Angka ringkasan dari **satu RPC** `__APP__.dashboard_summary(p_from, p_to, p_company)` (`security
  invoker`), bukan banyak query count dan bukan loop JavaScript (standar §6.1).
- Insight berat (top item, waktu approval rata-rata) per kartu, masing-masing RPC dengan Suspense.

### 17.3 Komponen

| Komponen | Interaksi |
|---|---|
| `ClickableStatCard` | Angka + ikon + deskripsi + **tren vs periode lalu** (▲ 12%). Klik → dialog tabel drill-down berpaginasi (`fetchPage` = Server Action) + "Buka di daftar" (link ke list dengan filter yang sama) |
| `ScoreStatCard` *(sebaiknya)* | Skor/grade A–E untuk umur dokumen (hijau → merah) |
| Grafik tren | Recharts (`dynamic`, `ssr: false`), token `--viz-*`, satu sumbu Y, label/legend langsung, tooltip. **Klik titik/batang → list terfilter tanggal itu** |
| Distribusi | Bar horizontal per departemen/kategori, klik → list terfilter |
| Insight card | Top 5 + "Lihat detail" → dialog dengan tabel lengkap |
| Tampilan tabel grafik | Toggle "Grafik / Tabel" di tiap kartu grafik (standar dataviz) |
| Feed aktivitas | Dari `<entitas>_logs` gabungan, chip filter, "Muat lebih banyak" |

### 17.4 Rasa

- Kartu `rounded-xl border bg-card shadow-sm`. Angka besar `text-2xl font-semibold tabular-nums`.
- Animasi angka naik saat pertama tampil (≤ 600 ms, mati di `prefers-reduced-motion`).
- Skeleton berbentuk kartu/grafik, bukan spinner.
- Kosong: "Belum ada data di periode ini." + tombol ke periode sebelumnya.

---

## 18. Download Excel

*Sumber port:* `ga-web/lib/excel-export.ts`, `components/excel-download-menu.tsx`.

### 18.1 Alur

```
ExcelDownloadMenu (client) ── fetch GET /<fitur>/ekspor?<param list>&mode=filter|semua
                                   │
                    app/(app)/<fitur>/ekspor/route.ts (server)
                    requireAccess → listX({ …param, all: true }) → buildWorkbook() → xlsx
```

- Route handler memakai **loader yang sama** dengan tabel (`lib/<domain>.ts`) dengan `all: true` (ambil per
  batch 1000 sampai habis). Hasil export selalu sama dengan tabel. Hak akses & RLS tetap berlaku (sesi
  user).
- `exceljs` hanya di server (`lib/excel.ts` dengan `server-only`), sehingga bundle client tetap ringan.
- Respons: `Content-Disposition: attachment; filename*=UTF-8''<nama>.xlsx`.
- Batas: > 50.000 baris → tolak dengan pesan "Terlalu banyak data, persempit filter dulu."

### 18.2 Menu

- Tombol outline **Download Data (Excel)** (ikon `FileSpreadsheet` + `ChevronDown`, `w-full md:w-auto`),
  menu `w-64`:
  - **Semua data** (jumlah dihitung saat menu dibuka, lewat Server Action `count`);
  - **Sesuai filter (N pengajuan)**, nonaktif kalau 0.
- `toast.loading("Menyiapkan file Excel...")` → `toast.success("File Pengajuan_2026-11-18.xlsx diunduh.")`.
  Data kosong → `toast.warning`, bukan file kosong.
- Unduh via blob; `URL.revokeObjectURL` ditunda 10 detik (Safari iOS/PWA).
- Halaman detail punya "Download Excel" sendiri: dokumen + item (multi sheet).

### 18.3 Style workbook (identik ga-web + tambahan)

| Bagian | Style |
|---|---|
| Header | Navy `#1E3A5F`, teks putih tebal 11, rata tengah, wrap, tinggi 22 |
| Border | Tipis `#D1D5DB` di semua sel |
| Zebra | Baris genap `#F3F4F6` |
| Freeze & filter | Header dibekukan (`ySplit: 1`) + autofilter |
| Lebar kolom | Otomatis dari isi terpanjang, 10–45 |
| Uang | Angka asli + format `#,##0` (bukan teks "Rp …"), rata kanan |
| Tanggal ★ | Nilai tanggal Excel asli + format `dd mmm yyyy` / `dd mmm yyyy hh:mm` (WIB), bukan string |
| Nama sheet | Maks 31 karakter, karakter `: \ / ? * [ ]` diganti `-` |
| Sheet "Keterangan" ★ | Nama app, judul data, perusahaan (scope), filter yang dipakai (teks), jumlah baris, diekspor oleh (nama + email), waktu ekspor (WIB). Gunanya untuk audit |

- Header kolom berbahasa Indonesia dan berurutan sesuai **definisi export** di `lib/<domain>.ts`, bukan
  urutan geser kolom tabel.
- Nama file: `<Judul>_<YYYY-MM-DD>.xlsx` (contoh `Pengajuan_GMI_2026-11-18.xlsx`).

---

## 19. Cetak dokumen

*Sumber port:* `ga-web/lib/print.ts`, `purchase-order/[id]/PaginatedPrintDocument.tsx`,
`purchase-order/PrintablePO.tsx`, `components/petty-cash/PcPrintMenu.tsx`, blok `@media print` di
`globals.css`.

### 19.1 Dasar

- `.no-print` menyembunyikan elemen; `.print-only` hanya tampil saat cetak (`grid-column: 1 / -1`).
- `@page { size: A4; margin: 15mm }`. Saat cetak, sidebar (`[data-slot="sidebar"]` termasuk gap-nya),
  top bar, dan header sticky disembunyikan. `<thead>` asli yang tampil.
- Font & ukuran kembali ke default (preferensi user tidak ikut tercetak).
- **Wajib** `printWithFileName(kode)`, bukan `window.print()`, supaya nama file "Save as PDF" =
  `PJ-GMI-2611-0042.pdf`, bukan nama app. Title dikembalikan di `afterprint`.
- Sebelum `print()`, tunggu logo selesai di-decode (`waitForLogoReady`), supaya logo tidak kosong.

### 19.2 Dokumen cetak A4

`<PrintableDocument>` generik (port `PaginatedPrintDocument`):

- Baris tabel diukur di kontainer tersembunyi lalu dipecah per halaman, sehingga **"Halaman X dari Y"
  akurat** dan tidak ada halaman kosong ekstra. Ukuran font/padding dokumen cetak adalah class biasa (bukan
  `@media print`), supaya hasil ukur = hasil cetak.
- Setiap halaman: **kop** (logo, nama, alamat, telepon, email company dokumen dari `getCompanies()`, garis bawah tebal),
  judul dokumen + kode + tanggal, isi, **footer** (dicetak oleh, waktu WIB, "Halaman X dari Y").
- Halaman terakhir: ringkasan total + kolom tanda tangan sesuai jalur approval (nama, jabatan, tanggal
  disetujui).
- Mode **Pratinjau** (dokumen belum diajukan): watermark "PRATINJAU" diagonal, tanpa QR.

### 19.3 Menu cetak

Tombol **Cetak ▾** (`size="sm"`):

- **dengan QR**: kolom tanda tangan berisi QR + "Disetujui secara digital, <waktu>";
- **tanpa QR**: ruang kosong untuk tanda tangan basah.

Dari luar halaman detail (baris tabel), menu membuka detail di tab baru dengan `?cetak=qr|basah`, lalu
halaman itu langsung memicu dialog cetak. Sumber dokumen cetak tetap satu.

Cetak list *(sebaiknya)*: tombol "Cetak" di toolbar list mencetak tabel yang sedang tampil (`no-print` di
toolbar, filter tercetak sebagai teks ringkas di atas tabel).

### 19.4 QR di dokumen cetak

**Default:** QR mengarah ke **halaman detail di app** (perlu login), dengan teks "Pindai untuk membuka
dokumen ini di <Nama App>".

**Modul opsional: Verifikasi Publik.** Aktifkan hanya kalau dokumen cetak dipakai pihak luar (vendor,
penerima barang, auditor), dan catat di `CLAUDE.md` app.

- Setiap dokumen punya `verify_token uuid default gen_random_uuid()` (bukan id dokumen, tidak bisa
  ditebak). QR berisi `https://<app>.lourdes.cloud/verifikasi/<token>`.
- `anon` tetap tidak punya akses ke **tabel** mana pun. Yang dibuka hanya satu fungsi
  `__APP__.verify_document(p_token uuid)` (`security definer`, `set search_path = ''`,
  `grant execute … to anon`) yang mengembalikan **kolom minimal**: jenis & kode dokumen, perusahaan,
  tanggal, status, nama approver + waktu setuju, dan total kalau memang perlu dicocokkan. Tanpa daftar
  item, lampiran, atau data pribadi (email, No HP, NRP).
- Halaman `app/verifikasi/[token]/page.tsx` berada di luar `(app)` dan dikecualikan dari redirect login
  di `proxy.ts`. Tampilannya kartu sederhana dengan logo company, centang hijau "Dokumen asli", ringkasan,
  dan peringatan "Cocokkan isi dengan dokumen fisik". Token salah/dokumen dibatalkan → kartu merah
  "Dokumen tidak ditemukan atau sudah tidak berlaku".
- Token bisa dicabut (dibuat ulang) oleh admin, misalnya kalau dokumen dicetak ulang setelah revisi.
- Batasi beban: hasil verifikasi di-cache 60 detik (`revalidate`), dan halaman `noindex`.

---

## 20. Update Web, Tentang App, Dokumentasi, Feedback

### 20.1 Pembaruan (Update Web) — `/pembaruan`

*Sumber port:* `ga-web/app/(With Sidebar)/update-web/*`, `components/update-web/*`, `components/tiptap/*`,
`lib/emoji-confetti.ts`.

- Changelog/pengumuman app. **Hanya admin app** yang bisa membuat/mengubah.
- Post: versi `major.minor.patch` (unik, naik), judul, thumbnail, **highlights** (poin singkat), isi rich
  text (Tiptap + gambar + video embed + link), waktu, penulis.
- List: kartu dengan thumbnail, badge versi, highlights, reaction. Detail di dialog/halaman dengan
  komentar (diskusi).
- **Reaction**: 👍 ❤️ 🎉 😂 😮 🙏. Satu user satu emoji aktif per post (klik emoji lain = ganti, klik yang
  sama = hapus), tooltip daftar siapa saja, dan **konfeti emoji** saat memberi reaction.
- **Baru**: post ≤ 7 hari yang id-nya > `last_seen` user (disimpan **per akun** di DB) → badge merah di
  sidebar, item di Inbox, dan banner kecil di dashboard. Membuka `/pembaruan` menandai sudah dilihat dan
  sinkron antar tab (event `update-seen`).
- Form post memakai `FormSummaryLayout` ([§9](#9-form--panel-ringkasan-di-kanan)) + **Pratinjau** persis
  seperti tampilan user.

### 20.2 Tentang App — `/tentang`

*Sumber port:* `ga-web/app/(With Sidebar)/tentang-app/page.tsx`.

- **Hero** berwarna `bg-primary text-primary-foreground` (ikut aksen): badge versi (link ke
  `/pembaruan`), badge modul, headline `text-3xl sm:text-5xl font-bold`, deskripsi, logo grup di kartu
  putih, dan 4 stat kecil.
- **Versi tidak di-hardcode**: selalu mengikuti post Pembaruan terbaru, lalu "Apa yang baru" + riwayat rilis
  singkat.
- Section dengan `SectionHeading` (eyebrow, judul, deskripsi): fitur utama, alur kerja (tahapan), peran &
  tugasnya, "dari proses manual ke satu sistem", dan "Dikembangkan untuk Lourdes, GMI & GIS" (logo grup).
- Isi teks dari `lib/about.ts` (diisi per app). Komponennya dari boilerplate.

### 20.3 Dokumentasi — `/dokumentasi`

*Sumber port:* `ga-web/app/(With Sidebar)/dokumentasi/*` (`docs-data.tsx`, `flow-stepper.tsx`,
`step-visuals.tsx`, `primitives.tsx`, `sections.tsx`), keyframe `docs-*` di `globals.css`.

- **Data-driven**: semua isi di `lib/docs/` (peran, alur, langkah, status, FAQ). Komponennya generik.
- **Pilih peran** di hero ("Saya Pemohon / Approver / Admin") → langkah milik peran itu di-highlight di
  semua section. Disimpan per perangkat.
- **Perjalanan** (gambaran besar) → klik tahap = lompat ke langkah di stepper.
- **FlowStepper** per alur: mode **visual** (mock UI beranimasi, autoplay, bisa dijeda) dan mode
  **teks**. Langkah aktif bisa di-deep-link (`#alur-pengajuan`).
- **Glosarium status** memakai `StatusBadge` yang sama dengan app, sehingga tampilannya identik.
- **FAQ** (accordion) + daftar isi: sticky di kanan (desktop), dropdown di atas (HP), section aktif
  di-highlight saat scroll.
- Animasi `docs-fade-up`, `docs-pop`, `docs-ring`, `docs-grow-x` dengan blok reduced-motion.

### 20.4 Feedback — `/feedback` dan `/feedback/kelola`

*Sumber port:* `ga-web/app/(With Sidebar)/feedback*/page.tsx`.

- Form user: kategori (Laporan Bug, Saran Fitur, Masalah Tampilan, Performa Lambat, Pertanyaan Umum,
  Lainnya + isian bebas), isi rich text (bold/italic/list), lampiran screenshot (tempel langsung),
  **otomatis** menyertakan halaman asal (`?dari=<path>`), versi app, browser, ukuran layar, mode tema.
- Setelah kirim: `toast.success("Terima kasih! Feedback Anda sudah kami terima.")` + daftar "Feedback
  saya" dengan status.
- Kelola (admin app): list standar, filter status `baru` (biru) / `diproses` (amber) / `selesai`
  (emerald) + hitungan per status, dialog detail, ubah status, **catatan internal**, tombol WhatsApp ke
  pelapor (dari `profiles.phone`). Mengubah status mengirim notifikasi ke pelapor.

---

## 21. Halaman auth

*Sumber port:* `ga-web/components/auth/{auth-shell,auth-input}.tsx`, `docs/auth-page-design-guide.md`
(spesifikasi lengkap), blok `auth-kenburns` di `globals.css`. Logika auth tetap dari starter standar
(`app/auth/*`, jangan diubah per app).

- **Halaman:** Masuk, Lupa Password, Password Baru, `/no-access`. **Tanpa daftar** (signup mati).
- **Desktop (`lg`)**: kiri slideshow foto lapangan (6 slide, efek Ken Burns, fade 1,4 s, ganti tiap 6 s,
  berhenti saat tab tersembunyi) dengan overlay `from-slate-950 via-slate-950/55`. Logo app di kotak
  `rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur`, headline + subjudul `text-white/75`. Kanan:
  form di `bg-background`.
- **HP**: foto jadi latar penuh, form di kartu `rounded-2xl border bg-background/90 p-6 shadow-2xl
  shadow-black/30 backdrop-blur-xl`.
- Kanan atas: Bantuan (Headset → "Belum bisa masuk?", tanpa kontak, [§14](#14-bantuan-admin)), Aksen,
  Font, Tema (ghost `sm`, ikon `size={16} text-muted-foreground`).
- Logo grup: Lourdes di atas; GMI | GIS di bawah, dipisah garis vertikal `bg-border`.
- `AuthInput`: ikon kiri, `h-11 pl-10`, toggle lihat password, `autoComplete` benar.
- Pesan error dari `authErrorMessage()` (standar). `429` → "Terlalu banyak percobaan, coba lagi sebentar
  lagi."
- Prediktif: email terakhir yang berhasil login diingat per perangkat (bukan password) dan field password
  langsung fokus. `?next=` dijaga `getSafeNextPath`.
- `/no-access`: kartu ramah "Akun Anda belum punya akses ke <App>" + daftar app yang sudah bisa dibuka
  (`my_apps`) + "Minta akses ke atasan Anda atau tim IT" + Keluar.
- Footer `© {tahun} Lourdes Auto Parts · <Nama App>` `text-xs`.

---

## 22. Offline & PWA

Level yang dipilih: **baca offline + draft form**. Aksi tulis dinonaktifkan saat offline. Tidak ada antrian
sinkronisasi.

### 22.1 Komponen

| Bagian | File | Fungsi |
|---|---|---|
| Registrasi SW | `components/pwa/pwa-support.tsx` | Daftar `sw.js` untuk semua user, kirim `userId` ke SW |
| Service worker | `public/sw.js` | Cache aset, halaman, fallback, Web Push, klik notifikasi |
| Status jaringan | `lib/offline/use-online.ts` | `useOnline()` (event online/offline + ping `/api/health` saat ragu) |
| Banner | `components/pwa/offline-banner.tsx` | Strip amber di bawah top bar |
| Penjaga navigasi | `components/pwa/offline-link-guard.tsx` | Saat offline, klik link internal = navigasi penuh (supaya SW bisa melayani cache) |
| Draft | `lib/offline/use-form-draft.ts` + `components/form/draft-banner.tsx` | Simpan & pulihkan isian form |
| Fallback | `app/~offline/page.tsx` | "Kamu sedang offline" + "Coba lagi" (muat ulang otomatis saat online) |
| Warna status bar | `components/pwa/theme-color-sync.tsx` | `<meta name="theme-color">` ikut tema user |
| Link standalone | `components/pwa/standalone-link-handler.tsx` | Link `_blank` internal tetap di dalam app (kecuali `data-pwa-new-window`) |
| Manifest | `public/manifest.json` | `id`, `name`, `short_name`, `display: standalone`, ikon `any` + `maskable` |

### 22.2 Strategi cache (`sw.js`)

| Request | Strategi |
|---|---|
| `/_next/static/*`, font, ikon, logo, slide | **Cache-first** (immutable), cache `static-<versi>` |
| Navigasi halaman `(app)` (`mode: navigate`, GET, 200, bukan `/auth/*`, `/api/*`, `*/ekspor`, `/verifikasi/*`) | **Network-first** (timeout 4 s) → simpan salinan di `pages-<userId>` → offline: salinan terakhir → kalau tidak ada: `/~offline` |
| RSC / fetch / Server Action / Supabase | Tidak disentuh SW |
| `/~offline`, manifest, ikon | Precache saat install. `/~offline`, `/sw.js`, dan `/manifest.json` wajib dikecualikan dari matcher `proxy.ts`, supaya tidak di-redirect ke login saat di-precache |

- Cache halaman dibatasi **30 halaman terakhir (LRU)** dan **3 hari**.
- Layout menulis `<meta name="x-rendered-at" content="<ISO>">`. Banner offline membacanya: **"Anda sedang
  offline · menampilkan data per 14.32 WIB"**.
- **Keamanan (wajib):** cache halaman berisi data pribadi.
  - Saat Keluar → `postMessage({ type: "clear-user-cache" })` lalu hapus `pages-*`.
  - Saat `userId` yang terdaftar berbeda dengan pemilik cache → cache lama dihapus dulu.
  - Halaman yang ditandai `<meta name="x-no-offline">` (mis. pengguna & akses) tidak pernah di-cache.
- Naikkan `CACHE_VERSION` setiap `sw.js` atau `/~offline` berubah.

### 22.3 Perilaku UI saat offline

- Banner amber `no-print` di bawah top bar. Saat kembali online, banner hijau sebentar "Kembali online" +
  `router.refresh()`.
- **Semua aksi tulis nonaktif**: `SubmitButton`, item `RowActionsMenu` yang memanggil action, upload. Diberi
  tooltip "Butuh koneksi internet". Form tetap bisa diisi (draft).
- Global search: menu & aksi lokal tetap jalan, dengan catatan "Pencarian data butuh koneksi internet."
- Export Excel & cetak dokumen dari halaman yang sudah ter-cache: cetak tetap bisa, Excel nonaktif.
- Realtime: provider berhenti mencoba saat offline, lalu `refresh()` saat online.

### 22.4 Draft form

`useFormDraft({ key, values, onRestore, enabled })`:

- Disimpan ke `localStorage` `<app>:draft:<userId>:<key>` dengan debounce 800 ms. Hanya **nilai field**;
  file tidak disimpan (yang tersimpan hanya nama filenya, dan user diberi tahu untuk melampirkan ulang).
- Saat membuka form dan ada draft: banner **"Ada draft dari 10 menit lalu. [Pulihkan] [Buang]"**. Tidak
  dipulihkan diam-diam.
- Selama mengetik: teks kecil di bar submit "Draft tersimpan · baru saja".
- Dihapus setelah submit sukses atau dibuang. Kedaluwarsa 14 hari. Dibersihkan saat Keluar.
- Form ubah dokumen: key mengandung `id` + `updated_at` dokumen. Kalau dokumen sudah berubah di server,
  draft ditandai "dibuat dari versi lama" sebelum dipulihkan.

---

## 23. Performa & responsif

### 23.1 Performa (resource VPS dipakai bersama)

- **Server-first**: halaman list & detail tidak mengirim JS fetching. Client component hanya kontrol
  interaktif.
- `Promise.all` untuk query yang tidak saling bergantung. Kolom eksplisit, selalu paging, `count` hanya
  saat perlu.
- Agregasi di SQL (view/RPC `security invoker`). Index untuk FK dan setiap kolom filter/sort, plus index
  trigram untuk kolom yang dicari.
- **Streaming**: `loading.tsx` per fitur + `<Suspense>` per kartu dashboard.
- **Code splitting** (`next/dynamic`): Tiptap, Recharts, ImageCropDialog, EmojiPicker, PrintableDocument,
  dialog besar. Excel di server.
- Gambar: `next/image` WebP, ukuran eksplisit; avatar dikompres; slide auth ≤ 400 KB.
- Realtime: maksimal 1 channel global (notifikasi) + 1 channel halaman (chat). Lepas saat unmount.
- Debounce pencarian (250–400 ms) + `AbortController` untuk request basi. Cache global search 60 detik.
- Cache per request: `getAccess()` (standar) dan `cache()` untuk loader yang dipanggil beberapa kali.
- Target (HP kelas menengah, 4G): LCP < 2,5 s, INP < 200 ms, CLS < 0,1. Cek dengan Lighthouse sebelum
  rilis besar.

### 23.2 Responsif & perangkat

- Cek di **390 px** (standar) dan desktop, plus 768 px (tablet) dan sidebar mode ikon.
- Halaman **tidak boleh** scroll horizontal. Tabel lebar scroll di dalam card-nya, kolom terpenting di
  kiri.
- Grid turun ke 1 kolom. Panel samping (Ringkasan, chat) menjadi overlay/satu panel.
- Aksi hover memakai `pointer-fine:` / `pointer-coarse:`, bukan breakpoint.
- Area tap minimal 36 px (`TopbarIconButton` memperluas area tap).
- Dialog di HP: `max-h-[calc(100dvh-2rem)]` dengan scroll di dalam, search dialog menempel di atas.
- `randomUUID()` dari `lib/utils.ts` (jalan di luar HTTPS/IP LAN), bukan `crypto.randomUUID()`.
- Uji di ukuran font "Sangat Besar": tidak ada teks yang terpotong atau tumpang tindih.

---

## 24. UX prediktif

Daftar pola yang membuat app "tahu" apa yang user mau. Setiap fitur baru minimal memakai yang relevan.

| Pola | Contoh |
|---|---|
| **Default dari profil** | Perusahaan, departemen, lokasi terisi otomatis di form; aksen awal ikut perusahaan |
| **Lanjutkan yang tertunda** | Draft form, "Terakhir dibuka" di global search, chat terakhir di `?t=` |
| **Yang perlu aksi di depan** | Panel "Perlu Aksi Anda" & follow-up di dashboard, "Menunggu aksi Anda" di global search, Inbox |
| **Satu klik ke tempat aksi** | Notifikasi, stat card, titik grafik, chip filter → halaman yang tepat dengan filter terisi |
| **Enter langsung jalan** | Cari menu (Enter = hasil teratas), global search (Enter sebelum hasil datang), filter |
| **Template & riwayat** | "Pakai Template" / "Ambil dari Riwayat" di form buat; harga/vendor terakhir di combobox barang |
| **Tuntun, jangan blokir** | Checklist Ringkasan; klik submit scroll ke langkah kurang; tombol tidak disabled tanpa alasan |
| **Petunjuk di tempat** | Popover ⓘ "Bisa dicari berdasarkan", hint field, tooltip tombol nonaktif yang menjelaskan sebabnya |
| **Ingat pilihan tampilan** | Panel filter terbuka, urutan kolom, menu tersembunyi, mode/aksen/font, bentuk avatar |
| **Konteks otomatis** | Bantuan Admin & Feedback otomatis menyertakan halaman asal + info perangkat |
| **Kembali yang benar** | `useGoBack` → halaman sebelumnya atau fallback yang masuk akal |
| **Kosong yang menuntun** | Empty state selalu memberi langkah berikutnya ("Buat lewat tombol di atas", "Reset filter") |
| **Pintasan keyboard** | `⌘K` cari, `Esc` tutup, `↑/↓` pilih, Enter kirim chat. Daftarnya tampil di footer global search |

---

## 25. Preferensi per perangkat

Semua lewat `lib/storage.ts` (try/catch, dibaca setelah mount, sinkron antar tab via event `storage`).
**Wajib prefix `<app_id>:`** supaya app Lourdes lain di domain `*.lourdes.cloud` tidak saling menimpa.

| Preferensi | Key |
|---|---|
| Mode tema | `<app>:theme` (`storageKey` next-themes) |
| Aksen | `<app>:accent` |
| Jenis & ukuran font | `<app>:font-family`, `<app>:font-size` |
| Menu sidebar tersembunyi | `<app>:sidebar-hidden` |
| Query cari menu | `<app>:sidebar-search` |
| Riwayat global search | `<app>:search-history:<userId>` |
| Urutan kolom tabel | `<app>:column-order:<tabel>` |
| Panel filter terbuka | `<app>:filter-open` |
| Panel Ringkasan terbuka | `<app>:summary-open` |
| Pengaturan notifikasi | `<app>:notif-settings` |
| Bentuk avatar dashboard | `<app>:avatar-shape` |
| Peran di Dokumentasi | `<app>:docs-role` |
| Email login terakhir | `<app>:last-email` |
| Draft form | `<app>:draft:<userId>:<form>` |

Data bisnis, role, dan status "sudah dilihat" yang harus sama di semua perangkat **tidak** disimpan di
sini, melainkan di DB.

---

## 26. Format & bahasa

| Data | Format | Helper (`lib/format.ts`, standar + tambahan) |
|---|---|---|
| Uang | `Rp 1.500.000` | `formatRupiah`, `CurrencyInput` |
| Angka | `1.250,5` | `formatNumber` |
| Tanggal | `18 Nov 2026` | `formatDate` |
| Tanggal panjang (header) | `Rabu, 18 November 2026` | `formatDateLong` ★ |
| Tanggal + jam | `18 Nov 2026 14.30 WIB` | `formatDateTime` |
| Relatif | `5 menit lalu` | `timeAgo` |
| Umur dokumen | `3 Hari 4 Jam` | `formatAge` ★ |
| Chip filter | `01 Nov – 18 Nov 2026` | `formatRange` ★ |

- Waktu selalu WIB. Batas hari dihitung `+07:00`.
- **Kosakata tombol** (standar + ga-web): Simpan, Batal, Tambah, Ubah, Hapus, Cari, Reset, Masuk, Keluar,
  Ajukan, Ajukan Ulang, Setujui, Tolak, Lihat Detail, Riwayat Aktivitas, Lampiran, Diskusi, Tindakan, Jalur
  Approval, Follow-up, Terapkan.
- Menyapa dengan "Anda". Status dokumen ditampilkan dengan label Indonesia dari `lib/<domain>-rules.ts`.
- Teks UI tidak boleh campur bahasa Inggris ("Cancel", "Continue"), kecuali istilah yang sudah baku di
  kantor (Approval, Follow-up, Dashboard).

---

## 27. Larangan

| Jangan | Gantinya |
|---|---|
| Fetch data awal di `useEffect` | Server Component + loader |
| Filter/cari/halaman di `useState` | URL + `useUrlSearchInput` |
| `<Table>` langsung di halaman list | `StickyHeaderTable` |
| Skeleton menggantikan seluruh tabel saat filter berubah | `startTransition` + `opacity-60` di body |
| Deretan tombol di kolom Aksi | `RowActionsMenu` |
| Komponen paginasi/konfirmasi/filter baru | Yang sudah ada |
| `import { toast } from "sonner"` | `@/lib/toast` |
| `navigator.clipboard.writeText` langsung | `writeClipboard` |
| `window.print()` langsung | `printWithFileName` |
| `exceljs` di client | Route handler `ekspor` |
| Query export terpisah dari query tabel | Loader yang sama (`all: true`) |
| Log ditulis dari client | Trigger / RPC |
| Notifikasi dibuat dari client untuk user lain | RPC `notify` / trigger |
| Realtime per kartu/per fitur | Satu channel notifikasi + chat halaman |
| `getStatusBadge` / map warna per halaman | `StatusBadge` + `lib/status.ts` |
| `bg-white`, `text-gray-500`, `border-gray-200`, `bg-indigo-600` | Token (`bg-background`, `text-muted-foreground`, `border`, `text-primary`) |
| Gradient/glow/glassmorphism di halaman app | Permukaan polos + `shadow-sm` |
| `setTheme(v)` langsung | `runViewTransition(() => setTheme(v))` |
| `router.back()` di tombol Kembali | `useGoBack(fallback)` |
| Hover-only dengan `md:opacity-0` | `pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100` |
| `crypto.randomUUID()` | `randomUUID()` |
| Key `localStorage` tanpa prefix app | `<app>:…` |
| Halaman daftar akun, reset password, blokir user | Konsol platform |
| Menebak atribut Base UI dari Radix | Cek `components/ui/*` hasil shadcn |
| Menu ditulis di dua tempat | `lib/nav.ts` → `buildNavGroups` |

---

## 28. Definisi selesai (frontend)

Dipakai bersama checklist standar §11.

- [ ] Halaman memakai `PageHeader` + `<Content>` di grid 12 kolom, rapi di 390 px dan desktop.
- [ ] List: `q/hal/baris/urut/filter` di URL, Back bekerja, `?q=` dibaca (untuk global search).
- [ ] List memakai `ListSearchInput`, `FilterPanel`, `StickyHeaderTable`, `RowActionsMenu`,
      `TablePaginationFooter`, dan `ExcelDownloadMenu`. `searchableFields` = kolom yang benar-benar dicari.
- [ ] Header tabel menempel dan sejajar (scroll vertikal + horizontal, sidebar buka/tutup).
- [ ] Ganti filter tidak membuat tabel berkedip; ada indikator pending.
- [ ] Export Excel memakai loader yang sama, style standar, dan sheet Keterangan.
- [ ] Form panjang memakai `FormSummaryLayout` dengan checklist dari aturan zod yang sama, draft otomatis,
      dan peringatan "Belum disimpan".
- [ ] Aksi async: tombol nonaktif + label "...", toast loading → hasil (dengan tombol Salin).
- [ ] Aksi destruktif lewat `ConfirmDialog` yang menyebut objeknya.
- [ ] Aksi penting tercatat di `<entitas>_logs` (trigger/RPC); Riwayat Aktivitas menampilkan nilai lama →
      baru dengan label Indonesia.
- [ ] Status memakai `StatusBadge`; nama orang memakai `UserAvatar`.
- [ ] Scope company dijaga di RLS **dan** di query; kop cetak/Excel sesuai company dokumen.
- [ ] Event penting membuat notifikasi lewat DB; `href` membuka tempat yang tepat; Web Push ikut terkirim
      (gagal push tidak menggagalkan aksi).
- [ ] Menu baru di `lib/nav.ts` (+ `keywords`), jenis data baru di `global_search`, aksi "Buat X" di aksi
      cepat dengan aturan `visible` yang sama.
- [ ] Offline: halaman bisa dibuka dari cache, aksi tulis nonaktif dengan alasan, form punya draft.
      Halaman sensitif diberi `x-no-offline`.
- [ ] Diuji di light, soft-light, dark, soft-dark × aksen default, GMI, dan satu warna umum; font "Sangat
      Besar"; sidebar mode ikon; layar sentuh; `prefers-reduced-motion`.
- [ ] Diuji sebagai `viewer` (tombol tulis tidak tampil, aksi ditolak), `editor`, `admin`, dan user
      dengan company berbeda.
- [ ] Bagian yang tidak perlu dicetak diberi `no-print`; cetak memakai `printWithFileName`.
- [ ] Penyimpangan dari standar dicatat di "Arsitektur singkat" `CLAUDE.md`.

---

## Lampiran A. Peta port file

Dari `~/project/ga-web` ke `lourdes-boilerplate`. **Port** = salin perilaku/kelas/teks, lalu ganti
primitive Radix → Base UI dan pola data → server-first. **Ganti** = tulis ulang mengikuti standar.

| Area | Port dari ga-web | Catatan |
|---|---|---|
| Tema | `app/globals.css` (token, 4 mode, aksen, border per mode, print, view transitions, `auth-*`, `docs-*`), `lib/theme-provider.tsx`, `lib/fonts.ts`, `lib/font-options.ts`, `lib/view-transition.ts`, `components/{theme,accent-theme,font}-switcher.tsx` | Gabungkan dengan `--viz-*` standar; key storage diberi prefix |
| Toast | `lib/toast.tsx`, `lib/clipboard.ts`, `components/ui/toast-copy-button.tsx`, `copy-text-button.tsx` | Tidak bergantung Radix |
| Shell | `app/(With Sidebar)/layout.tsx`, `app-sidebar`, `nav-main`, `nav-user`, `sidebar-search`, `team-switcher`, `navigation-progress`, `lib/sidebar/*` | Menu dari `lib/nav.ts`; switcher dari `my_apps()` |
| Top bar | `components/topbar/*` | Inbox sumbernya diganti; Chat Admin → Bantuan Admin |
| Global search | `topbar-search`, `search-sections`, `use-global-search`, `supabase/migrations/0008_global_search.sql` | RPC ditulis ulang di `db/` per app |
| List | `content`, `filter-panel`, `list-search-input`, `sticky-header-table`, `sortable-table-head`, `reorderable-table-head`, `row-actions-menu`, `table-pagination-footer`, `custom-pagination`, `excel-download-menu`, `hooks/use-url-search-input`, `hooks/use-column-order`, `lib/supabase/search-filter.ts` | Param URL diganti ke §8.2; `isPending` dari context |
| Form | `form-summary-panel`, `date-picker`, `combobox`, `ui/searchable-select`, `ui/currency-input`, `file-dropzone`, `link-attachment-form`, `hooks/use-file-drop`, `lib/attachments.ts`, `lib/debounce-async.ts` | Combobox → Base UI; submit → Server Action |
| Detail | `taste-ui.md` §9 (`InfoItem`, `ApprovalPath`, `StepChain`, `ConfirmDialog`, `StatusBadge`), `followup-approval-button`, `activity-log-dialog`, `hooks/use-go-back`, `PcRevisionHistory` | Log & follow-up lewat RPC |
| Diskusi | `discussion-panel`, `discussion-message-bubble`, `discussion-attachment-view`, `message-attachment-toolbar`, `emoji-sticker-picker`, `rich-mention-editor`, `rich-content-view`, `note-with-links`, `message-with-mentions`, `components/tiptap/*`, `lib/rich-content.ts`, `lib/discussion-reply.ts` | Mention disesuaikan entitas app |
| User | `user-avatar`, `user-profile-card`, `avatar-viewer-dialog`, `profile-avatar-dialog`, `image-crop-dialog`, `lib/avatar.ts`, `lib/avatar-cache.ts`, `user-management/*` (tampilan saja) | Upload ke bucket `avatars`; tanpa buat user/reset password |
| Notifikasi | `providers/NotificationProvider`, `notifications/page.tsx`, `notification-settings`, `custom-ringtone-settings`, `lib/notifications/{sound,settings,custom-sound-db}.ts` | Sumber data & insert diganti (RPC) |
| Bantuan Admin | `app/(With Sidebar)/chat-admin*/`, `components/support-chat/*`, `topbar-chat-admin`, `auth/chat-admin-info-dialog`, `hooks/use-support-chat-badge` | Admin = role `admin` app |
| Dashboard | `dashboard/page.tsx` (susunan), `components/dashboard/*`, `PcActionNeededList`, `PcActivityFeed`, `UpdateWebDashboardBanner` | Data dari RPC + Suspense |
| Excel | `lib/excel-export.ts` | Pindah ke server (`lib/excel.ts`) + format tanggal + sheet Keterangan |
| Cetak | `lib/print.ts`, `PaginatedPrintDocument`, `PrintablePO` (kop & footer), `PcPrintMenu`, `lib/companyDetails.ts#waitForLogoReady` | Generik `PrintableDocument` |
| Modul | `update-web/*` + `components/update-web/*` + `lib/emoji-confetti.ts`, `tentang-app/`, `dokumentasi/*`, `feedback/`, `feedback-management/` | Isi teks per app di `lib/about.ts`, `lib/docs/` |
| Auth | `components/auth/{auth-shell,auth-input}.tsx`, `docs/auth-page-design-guide.md` | Logika tetap starter standar; tanpa signup |
| PWA | `components/pwa/*`, `lib/pwa.ts`, `lib/pwa/use-install-prompt.ts`, `public/sw.js`, `public/manifest.json` | SW diperluas ([§22](#22-offline--pwa)) |
| Util | `lib/utils.ts#randomUUID`, `hooks/use-mobile.ts` | Format pakai `lib/format.ts` standar |

**Tidak dibawa:** semua modul procurement (MR, PO, petty cash, vendor, barang, cost center, goods receipt),
announcer, `services/*` (diganti loader + action), Zustand store, `app/protected`, tutorial/landing
starter Supabase, signup, `ResetPasswordCard`, `CreateUserDialog`, Fonnte/WA gateway.

---

## Lampiran B. Aset yang dibawa

**Sudah disalin** (18 Nov 2026) dari `~/project/ga-web/public/` ke `lourdes-boilerplate/public/`:

| File | Ukuran | Dipakai di |
|---|---|---|
| `lourdes-logo.webp` | 44K | Header sidebar, auth, Tentang, kop LOURDES |
| `gmi-logo.webp` | 4K | Kop dokumen GMI, Tentang |
| `gis-logo.webp` | 132K | Kop dokumen GIS, Tentang |
| `gmi-landscape-stroke.webp` | 32K | Logo GMI di halaman auth |
| `gis-landscape.webp` | 32K | Logo GIS di halaman auth |
| `lourdes.png` | 92K | Ikon notifikasi browser |
| `slide.webp`, `slide2.webp` … `slide6.webp` | 80–388K | Slideshow halaman auth |

Kalau perlu menyalin ulang:

```bash
SRC=~/project/ga-web/public; DEST=~/project/lourdes-boilerplate/public
mkdir -p "$DEST/icons"
cp "$SRC"/{lourdes-logo.webp,gmi-logo.webp,gis-logo.webp,gmi-landscape-stroke.webp,gis-landscape.webp,lourdes.png} "$DEST/"
cp "$SRC"/slide{,2,3,4,5,6}.webp "$DEST/"
```

**Perlu dibuat baru** (jangan pakai milik Garuda Procure):

- **Ikon app generik boilerplate**: `public/icon.svg`, `icons/icon-192.png`, `icons/icon-512.png`,
  `icons/icon-maskable-512.png`, `app/favicon.ico`. Setiap app nanti menggantinya dengan ikonnya sendiri.
- `app/opengraph-image.png` per app (atau tidak usah, karena app internal `noindex`).
- `public/manifest.json` dengan placeholder `__NAME__`.

Saran: `slide2.webp` dan `slide3.webp` (388K) dikompres ulang ke ≤ 200K (WebP q≈70, lebar 1920) supaya
halaman login lebih cepat di HP.

Tidak perlu file suara: suara notifikasi disintesis dengan Web Audio.

---

## Lampiran C. Tabel modul dasar

Skema lengkap (tabel, RLS, RPC, trigger) ada di **[`backend-guide.md`](backend-guide.md)**. Itu
satu-satunya sumber. Peta cepat modul frontend → backend:

| Fitur frontend | Backend (`backend-guide.md`) |
|---|---|
| Multi company, kop, aksen awal | §2.1 `public.companies`, §4 `my_company_scope` |
| Nomor dokumen | §5 `next_doc_number` |
| Approval, follow-up, antrian, template | §6 approval engine |
| Notifikasi, Inbox, Web Push | §7 |
| Riwayat Aktivitas | §8 `<entitas>_logs` + `log_changes` |
| CCTV | §2.2, §9 |
| Pencarian list, global search, dashboard, export | §10 |
| Bantuan Admin, Feedback, Update Web, members, Pengguna & Akses, verifikasi QR | §11 |
| Retensi & pengingat harian | §2.3, §12 |
| Lampiran, media | §13 |

---

## Lampiran D. Keputusan & hal terbuka

**Sudah diputuskan (18 Nov 2026):**

- Boilerplate = starter terpisah `lourdes-boilerplate` (bukan pengganti `templates/next-app`), dan akan
  terus diperbarui mengikuti perkembangan semua web Lourdes.
- Primitive UI mengikuti standar: shadcn `base-nova` / Base UI. Komponen ga-web di-port.
- Pola data mengikuti standar: Server Component + Server Action + RLS.
- Offline: baca offline + draft form, tanpa antrian sinkronisasi.
- Multi company: seperti ga-web (1 company per user, `company_code` di dokumen, scope GMI/GIS + LOURDES).
- Menyimpang dari `standar-app.md` §8 (wajib dicatat di `CLAUDE.md` app): sidebar + top bar (bukan header
  `max-w-7xl`), 4 mode tema + aksen (standar: belum ada mode gelap), satu channel realtime global untuk
  notifikasi.

**Diputuskan 18 Nov 2026 (lanjutan):**

1. **Web Push wajib** di boilerplate: VAPID per app (private key runtime saja), kirim lewat RPC
   `push_targets` tanpa secret key Supabase ([§13.6](#136-web-push)).
2. **Verifikasi QR publik = modul opsional per app**: satu fungsi untuk `anon` dengan kolom minimal,
   tabel tetap tertutup ([§19.4](#194-qr-di-dokumen-cetak)).
3. **`public.companies` jadi tabel master platform**: `profiles.company` jadi FK ([§16](#16-multi-company)).
4. **Retensi wajib**: fungsi SQL terjadwal, log audit disimpan minimal 5 tahun lalu diarsip
   ([§13.7](#137-retensi-data)).
5. **Tanpa kontak IT** di halaman auth: semua user karyawan, jadi diarahkan ke atasan atau tim IT langsung.

**Masih terbuka:**

1. Hal terbuka sisi database (migration platform, NRP untuk company baru, `pg_trgm`, timer maintenance,
   halaman CCTV di konsol): lihat `backend-guide.md` §16.
2. Apakah konsol `monitoring-lourdes` nanti ikut memakai shell boilerplate ini, supaya semua web Lourdes
   benar-benar seragam.

**Diputuskan 18 Nov 2026 (backend):** approval engine generik di boilerplate; modul (notifikasi,
Bantuan, Feedback, Update Web) per app; aksi penting setiap app dikirim ke **CCTV** platform
(`public.cctv_events`) untuk audit/tracing dari konsol monitoring; job harian memakai systemd timer
(tanpa `pg_cron`).
