# Spesifikasi Fase 5: Maintenance (hanya baca)

Langkah 0 (rancangan §3) untuk §4.9. Keputusan sendiri ditandai **[M#]**; keputusan Anda (2026-11-24) ditandai **[D#]**.

## Keputusan Anda

| # | Keputusan |
|---|---|
| D12 | Sumber data = **impor Excel** ke tabel cermin `mnt_*` (bukan view lintas schema atau API). Tidak ada URL detail per record di sistem sumber yang diketahui, jadi tidak ada tautan "Buka di sistem maintenance" |
| Cakupan | **Inti**: Unit, Downtime, PS, Backlog (dashboard PA, MTBF, MTTR, PS Accuracy, Backlog Open). **Belum**: Material Request, Readiness LIB/part non-moving, Metal Scrap |

## Prinsip (rancangan §4.9)

Sistem maintenance tetap satu-satunya sumber kebenaran. Di Safe Hub tidak ada form tambah/ubah unit, downtime, PS, atau backlog; data masuk **hanya** lewat Impor Data
(`/impor`, target `mnt_units`, `mnt_downtime`, `mnt_ps`, `mnt_backlog`) dan setiap tampilan menyebut sumber + waktu sinkron terakhir.

## Yang dibangun

- DB `db/app/22_maintenance.sql`: `mnt_units`, `mnt_downtime`, `mnt_ps`, `mnt_backlog` (tanpa hak tulis untuk `authenticated`), `mnt_sync_state` (impor terakhir per jenis),
  `import_row_mnt` + `import_commit` diperluas (target `mnt_*` = fungsi `maintenance`, `hse`, atau admin; target people tetap HR/HSE/admin), RPC baca `mnt_dashboard(site, dari, sampai)`
  (SATU sumber angka: halaman, blok Beranda, nanti laporan), 5 KPI di Kamus KPI (draf).
- Impor idempoten per `source_key` (kolom "ID sumber"; bila kosong dibuat hash dari unit + tanggal + jenis/judul). Mode Perbarui memperbarui, Tambah baru menolak yang sudah ada.
  Impor Unit harus lebih dulu (baris lain mencari unit lewat kode).
- UI `/maintenance` (tab Ringkasan, Unit, Downtime, PS, Backlog; navigasi bulan; sumber + waktu sinkron), blok Beranda "Maintenance", saran unit (datalist) di form Lapor Kejadian.
  Hanya staf K3; Karyawan dialihkan.

| # | Keputusan sendiri (mohon dikonfirmasi) | Alasan |
|---|---|---|
| M1 | **Jam tersedia = unit tidak Dihentikan × hari periode × 24.** Bulan berjalan dihitung sampai hari ini. Jam operasi per unit (shift) tidak ada di kontrak data minimal | Tanpa jam kerja unit, 24 jam adalah satu-satunya asumsi yang konsisten; **PA/MTBF akan terlihat tinggi bila unit tidak beroperasi 24 jam**. Ganti bila sistem sumber punya jam tersedia |
| M2 | PA = (tersedia − jam breakdown) ÷ tersedia. MTBF = (tersedia − jam breakdown) ÷ jumlah breakdown. MTTR = jam breakdown ÷ jumlah breakdown. Tanpa breakdown, MTBF/MTTR = "Belum tersedia" (bukan 0). Downtime terencana tidak mengurangi PA | Rumus umum; ditandai "Rumus belum disahkan" |
| M3 | PS Accuracy = PS direncanakan di periode yang selesai paling lambat **2 hari** setelah rencana ÷ PS direncanakan di periode. PS belum dikerjakan dan lewat rencana dihitung tidak tepat | Toleransi 2 hari adalah usulan saya |
| M4 | Backlog Open = dibuka ≤ akhir periode dan belum ditutup sampai akhir periode (jadi melihat bulan lalu memberi angka bulan lalu). Umur dihitung sampai hari ini | Konsisten bila periode dipilih mundur |
| M5 | Unit berstatus Dihentikan dikeluarkan dari PA, MTBF, MTTR, dan daftar breakdown terbanyak, tetapi tetap tampil di tab Unit | Unit yang sudah tidak beroperasi tidak boleh menurunkan PA |
| M6 | Unit di record K3 tetap isian bebas `unit_code` + `unit_label` (D15). Data cermin hanya memberi **saran** (datalist) di Lapor Kejadian; Temuan/Inspeksi tidak punya field unit, jadi tidak berubah | Record K3 harus tetap terbaca bila unit hilang di sumber |
| M7 | Site unit diimpor lewat NAMA site persis seperti di Safe Hub | Sistem sumber tidak punya id site Safe Hub |
| M8 | Nama kolom dan nilai (status unit, jenis downtime, prioritas, status backlog) dikenali dalam Bahasa Indonesia/Inggris lewat alias; kolom sebenarnya di Excel sistem maintenance belum dilihat, jadi pemetaan manual di wizard mungkin perlu | Kontrak data hanya perkiraan |

## Belum dibangun

Material Request, Readiness LIB/part non-moving, Metal Scrap; bagian "Maintenance" dan "Isu Terbuka" di Laporan Periode (masih "Belum tersedia"); sinkron otomatis (API/schema);
tautan keluar ke sistem sumber; impor langsung nilai KPI hasil hitung sistem sumber (rumus tetap di Kamus KPI Safe Hub, jangan dihitung dua kali).

Uji: `db/tests/14_maintenance.sql` (M1-M5).
