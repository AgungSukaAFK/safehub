# Spesifikasi Fase 2: Inspeksi & Observasi, Kamus KPI, Dashboard v1

Langkah 0 (rancangan §3) untuk §4.3, §4.4, §4.13 (Kamus KPI), dan §2.8. Sumber layar: prototipe
`inspection-management.tsx`, `dashboard.tsx`, bagian Kamus KPI di `admin-management.tsx`. Pola teknis mengikuti
CLAUDE.md. Keputusan yang saya ambil sendiri ditandai **[T#]** dan dikumpulkan di akhir.

## 1. Layar

| Route | Isi |
|---|---|
| `/inspeksi` | Kalender bulanan (md+) / agenda per hari (HP) atau Daftar (`?tampilan=daftar`), navigasi bulan (`?bulan=YYYY-MM`), filter jenis (`?jenis=`), panel **Rencana vs Aktual** per jenis, dialog **Jadwalkan Inspeksi** |
| `/inspeksi/[id]` | Terjadwal → tombol Mulai · In Progress → checklist HP (Sesuai / Tidak Sesuai / N/A, komentar, foto kamera, **Jadikan Temuan** inline, progres, autosimpan) · Menunggu Verifikasi → hasil + verifikasi HSE · Terverifikasi / Dibatalkan |
| `/inspeksi/template`, `/baru`, `/[id]` | Template checklist (HSE/admin): nama, jenis, label objek, kategori temuan otomatis, butir (satu baris per butir) |
| `/observasi`, `/observasi/baru`, `/observasi/[id]` | Daftar; form cepat KTA/TTA (satu layar HP); detail |
| `/kpi`, `/kpi/[kode]` | Kamus KPI: definisi, rumus, aturan, contoh, metadata, pengesahan, riwayat versi; admin: ubah + sahkan |
| `/kpi/jam-kerja` | Grid jam kerja bulanan per site (HSE/admin) |
| `/` (Beranda) | Sapaan → banner Pembaruan → **Perlu Aksi** (tugas K3) → periode (bulan) → **Kinerja Keselamatan** (Fatality, LTI, LTIFR, LTISR, Near Miss, Property Damage; toggle Bulan ini/YTD) → kartu (Jam Kerja YTD + sparkline, Temuan Overdue, Inspeksi Terlambat, Kejadian Terbuka) → **Leading Indicator** (rencana vs aktual per bulan, klik = daftar bulan itu) + **Status PICA** (donut) + **Umur Temuan** → Aktivitas terbaru |

Varian Beranda: **Karyawan** (tanpa fungsi staf) = sapaan, dua tombol besar (Lapor Kejadian, Observasi KTA/TTA), Perlu Aksi,
Laporan Saya, feed. Staf K3 = tampilan penuh. Setiap kartu KPI punya ikon definisi (`KpiHelp`, data dari Kamus KPI) dan
badge "Rumus belum disahkan" bila status draf (data, bukan hardcode).

## 2. Entitas (`db/app/12_inspeksi_kpi.sql`)

`inspection_templates` + `inspection_template_items` · `inspections` (jadwal = baris `scheduled`) + `inspection_answers`
(menyimpan teks butir, jadi mengubah template tidak mengubah riwayat) · `observations` · `work_hours` ·
`kpi_definitions` · `*_logs` (tanpa FK). Jenis inspeksi = master berkode `inspection_type` (warna kalender, dikelola di `/master`).

## 3. Status & transisi

```
scheduled ──start(pemeriksa)──▶ in_progress ──submit(pemeriksa, semua butir dijawab)──▶ submitted ──verify(HSE ≠ pemeriksa)──▶ verified
scheduled|in_progress ──cancel(HSE / pembuat jadwal, alasan)──▶ cancelled
```

"Terlambat" = turunan (terjadwal/berjalan dengan tanggal rencana < hari ini WIB), tidak disimpan. Kirim inspeksi membuat
temuan (sumber `inspection`, nomor TMN) untuk tiap butir Tidak Sesuai yang diberi toggle; PIC temuan dinotifikasi.

## 4. Peran (RLS + RPC; uji `db/tests/04_inspeksi_kpi.sql`)

| Aksi | Siapa |
|---|---|
| Menjadwalkan | `hse`, `pengawas`, `pjo` (bukan auditor) |
| Mulai / isi / kirim | pemeriksa yang ditugaskan |
| Membuat temuan saat kirim | pemeriksa dengan fungsi `hse`/`pengawas`/`pjo` |
| Verifikasi | `hse` yang bukan pemeriksa |
| Batalkan | `hse` atau pembuat jadwal |
| Kelola template, isi jam kerja | `hse`, admin |
| Observasi | semua kecuali auditor; **tindak lanjut membuat temuan walau pelapor Karyawan** |
| Ubah / sahkan Kamus KPI | admin |
| Lihat inspeksi / observasi | staf K3 dalam scope company+site; Karyawan hanya miliknya |

## 5. KPI (rancangan §2.8)

Dihitung di DB (`kpi_safety`, `dashboard_k3`), bukan di komponen. Hanya kejadian yang **sudah diklasifikasi HSE** dihitung.
LTIFR = LTI × 1.000.000 ÷ jam kerja; LTISR = hari kerja hilang × 1.000.000 ÷ jam kerja. Tanpa jam kerja nilai tidak
dihitung (ditampilkan "Belum tersedia", bukan 0). Mengubah definisi/rumus KPI yang sudah disahkan membuat versi baru dan
mengembalikan status ke draf (trigger); pengesahan hanya lewat RPC `kpi_approve` (admin, catatan wajib).
Satu sumber angka: hitungan di Beranda memakai RPC yang sama dengan daftar (mis. temuan overdue = filter Overdue).

## 6. Notifikasi & Tugas Saya

Kategori `inspeksi`: dijadwalkan (pemeriksa), dikirim (HSE), diverifikasi / dibatalkan (pemeriksa). Tugas Saya: jadwal 7 hari
ke depan atau terlambat (Terjadwal), berjalan (Perlu Tindakan), menunggu verifikasi (HSE).

## 7. Tidak diambil dari prototipe / ditunda

Blok Manpower, Kepatuhan Dokumen, Pencapaian TSP, Health Performance, Ringkasan Maintenance, Isu Terbuka, "Perlu Perhatian"
(fase 3–5, datanya belum ada); safety talk dan aktivitas TSP di leading indicator (fase 3); Sheet drill-down per bulan
(diganti tautan ke daftar bulan itu); ekspor Excel dan cetak inspeksi; jadwal berulang.

## 8. Keputusan sendiri (mohon dikonfirmasi)

| # | Keputusan | Alasan |
|---|---|---|
| T1 | Jadwal = baris `inspections` berstatus `scheduled`; tidak ada tabel jadwal terpisah | Satu record dari rencana sampai verifikasi; rencana vs aktual tinggal agregasi |
| T2 | Rencana = jadwal tidak dibatalkan di bulan tanggal rencana; aktual = yang sudah dikirim/diverifikasi (per bulan rencana, bukan bulan kirim) | Pencapaian tidak berubah-ubah saat laporan terlambat dikirim |
| T3 | Observasi KTA/TTA tidak punya rencana; tampil sebagai angka terpisah di leading indicator | Prototipe menyebut rencana vs aktual hanya untuk inspeksi/audit |
| T4 | Jam kerja = input bulanan per site (default D6) | Manpower baru fase 4; tanpa input LTIFR/LTISR "Belum tersedia" |
| T5 | LTI = kelas cedera Lost Time (Fatality dihitung terpisah); hari hilang dari data cedera terbatas | Definisi umum; bisa diubah admin lewat Kamus KPI (versi baru) |
| T6 | Semua KPI seed berstatus draf; ambang hanya Fatality, LTI, Temuan Overdue (bahaya ≥ 1) | D11 belum diputuskan: tidak mengarang ambang |
| T7 | Beranda K3 menggantikan blok Pengajuan (halaman /pengajuan tetap ada sampai contoh dihapus) | Angka contoh tidak relevan untuk GMI |
| T8 | Observasi tindak lanjut dibuat RPC definer (Karyawan boleh) | Prototipe menampilkan toggle ini di form HP pelapor |
| T9 | Verifikator inspeksi ≠ pemeriksa; pemeriksa wajib fungsi hse/pengawas/pjo untuk membuat temuan | Pemisahan tugas, selaras dengan Kejadian |
