# `db/`: SQL boilerplate

Template SQL, **bukan folder migration**. Saat app dibuat, file di sini digabung menjadi satu migration di
`lourdes-db/supabase/migrations/` (alur standar: dry-run → konfirmasi user → push).

| Folder | Isi | Dipakai di mana |
|---|---|---|
| `platform/` | `public.companies`, `public.cctv_events` + `cctv_log()`, `run_maintenance_all()`, unit systemd | **Sekali** untuk seluruh platform (lourdes-db) |
| `app/` | Modul per app dengan placeholder `__APP__` (app_id), `__HOST__` (subdomain), `__NAME__` | Migration tiap app |
| `app/example_pengajuan.sql` | Contoh dokumen lengkap dengan approval | Hapus saat app punya dokumen asli |
| `app/09_verify.sql` | Verifikasi QR publik (membuka schema app untuk `anon`) | **Opsional**, butuh izin user |
| `dev/` | Stub platform, stub storage, seed data DEMO | **Hanya lokal/uji**, jangan disalin |
| `tests/` | Uji keamanan & alur (§14 backend-guide + koreksi K1–K8) | `npm run db:test` |

## Perintah

```bash
npm run db:test            # uji semua SQL di container Postgres sekali pakai (tidak menyentuh DB lokal)
npm run db:local -- apply  # pasang ke Supabase lokal db-lourdes (stub + platform + app + seed DEMO)
npm run db:local -- reset  # hapus schema app + user demo, lalu pasang ulang
npm run db:types           # generate types/database.ts dari DB lokal
scripts/db-build.sh migration <app_id> <host> "<Nama>" > migration.sql   # gabung untuk lourdes-db (tanpa 09_verify)
scripts/create-app.sh <app_id> "<Nama>"   # app baru dari boilerplate (lihat README.md)
```

User DEMO (password `Demo12345!`):

| Email | Company | Role app | Peran di contoh |
|---|---|---|---|
| `it@demo.lourdes.test` | – | admin platform | Akun IT |
| `admin@demo.lourdes.test` | LOURDES | admin | Admin app |
| `budi@demo.lourdes.test` | GMI | editor | Pemohon GMI |
| `sari@demo.lourdes.test` | GIS | editor | Pemohon GIS |
| `andi@demo.lourdes.test` | GMI | viewer | Kepala Purchasing GMI (approver 1) |
| `dewi@demo.lourdes.test` | GIS | viewer | Kepala Purchasing GIS (approver 1) |
| `rina@demo.lourdes.test` | LOURDES | viewer | Finance (approver 2) |
| `viewer@demo.lourdes.test` | GMI | viewer | Hanya melihat |
| `noaccess@demo.lourdes.test` | GMI | – | Tanpa akses (uji `/no-access`) |
| `nonaktif@demo.lourdes.test` | GIS | viewer | Akun nonaktif (uji status di Pengguna & Akses) |

Persona K3 Safe Hub (semua GMI, site profil `Site MIFA`; fungsi di `members.functions`):

| Email | Nama | Role app | Fungsi K3 |
|---|---|---|---|
| `karyawan@demo.lourdes.test` | Rudi Hartono | viewer | karyawan (dibatasi Site MIFA) |
| `hse@demo.lourdes.test` | Andi Pratama | editor | hse |
| `hse.senior@demo.lourdes.test` | Yusuf Ramadhan | editor | hse, hse_senior |
| `pengawas@demo.lourdes.test` | Fajar Nugroho | editor | pengawas |
| `pjo@demo.lourdes.test` | Budi Santoso | editor | pjo |
| `pja@demo.lourdes.test` | Agus Salim | editor | pja |
| `manajemen@demo.lourdes.test` | Bambang Sutrisno | editor | manajemen |
| `hr@demo.lourdes.test` | Dewi Lestari | editor | hr |
| `maintenance@demo.lourdes.test` | Hendra Wijaya | editor | maintenance |
| `scm@demo.lourdes.test` | Sari Wulandari | editor | scm |
| `kontraktor@demo.lourdes.test` | Joko Susilo | editor | kontraktor_admin |
| `auditor@demo.lourdes.test` | Lina Marlina | viewer | auditor |

Site DEMO: `Site MIFA` (area Workshop Service, Pit Area, Hauling Road, Bay 3) dan `Site Demo Kalimantan`.

## Urutan file app

`00_schema` → `01_base` → `02_notifications` → `03_approval` → `04_support` → `05_feedback` →
`06_updates` → `07_storage` → `08_maintenance` → `10_fondasi` (Safe Hub: fungsi K3, scope site, area,
master, mitra, `my_tasks`) → `example_pengajuan` → `09_verify` (opsional).

`00_schema.sql` adalah **rekonstruksi** `lourdes-db/templates/new_app.sql`. Saat membuat app, pakai isi
template asli untuk bagian schema + grant + registry.

## Menambah jenis dokumen baru

Ikuti pola `example_pengajuan.sql`: tabel dengan kolom standar (backend-guide §3.1), `<tabel>_logs` +
trigger `log_changes`, trigger `search_text` + index trigram, guard status, dua hook approval
(`<doc>_approval_context`, `<doc>_on_approval`) + satu baris `approval_doc_types`, RPC simpan
(security invoker), lalu tambahkan ke `global_search`.
