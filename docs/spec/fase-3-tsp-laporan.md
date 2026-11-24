# Spesifikasi Fase 3: TSP & Aktivitas, Pengingat, Audit Trail, Laporan Periode

Langkah 0 (rancangan §3) untuk §4.5, §4.12, §4.13 (Audit Trail), §4.10. Sumber layar: prototipe `tsp-management.tsx`,
`notifications-management.tsx`, `report-management.tsx`. Pola teknis mengikuti CLAUDE.md. Keputusan yang saya ambil
sendiri ditandai **[V#]**. Keputusan pengguna (2026-11-24): urutan TSP → Pengingat → Audit Trail → Laporan Periode;
D9 = template approval + kepala departemen yang sudah ada; data awal TSP = seed prototipe + input manual;
D10 = pengingat in-app + push saja (tanpa email).

Status pengerjaan: **semua empat bagian selesai** (TSP & Aktivitas, Pengingat, Audit Trail, Laporan Periode).

## 1. TSP & Aktivitas (selesai)

### Layar
| Route | Isi |
|---|---|
| `/tsp` | Capaian keseluruhan (+ `KpiHelp` + badge "Rumus belum disahkan") → filter tahun/bulan acuan/elemen/PJ/status → **Matriks program x 12 bulan** (sel aktual/rencana; elemen bisa dilipat; sel bulan depan terkunci) → **Aktivitas K3** (kartu terbaru) → **Evaluasi Bulanan** (capaian, program tertinggal beserta alasan, persetujuan PJO) |
| Sheet sel | Rencana (baca saja), aktual, bukti (unggah ke Storage), catatan, riwayat lewat log |
| Sheet program | Tambah/ubah program: no, elemen, nama, PJ, indikator, bukti wajib, target, rencana 12 bulan, aktif (HSE/admin) |
| Sheet aktivitas | Jenis, tanggal, lokasi, pelaksana, jumlah peserta, program TSP terkait, catatan, bukti |
| `/tsp/ekspor` | Excel dari loader yang sama dengan matriks |

### Entitas (`db/app/13_tsp.sql`)
`tsp_programs` (per company+site+tahun, `plan smallint[12]`) · `tsp_realizations` (program x bulan: aktual manual, catatan,
`evidence_count`) · `safety_activities` (nomor `AKT-YYYY-NNNN`, `program_id` opsional) · `tsp_evaluations` (satu per site per
bulan; `summary` = snapshot) · `*_logs` tanpa FK. Tulis HANYA lewat RPC (`tsp_program_save`, `tsp_realization_save`,
`safety_activity_save`, `safety_activity_sync_evidence`, `tsp_evaluation_submit/decide`).

### Peran
| Aksi | Siapa |
|---|---|
| Lihat | staf K3 (bukan Karyawan) dalam scope company + site |
| Kelola program | `hse`, admin |
| Catat realisasi / aktivitas | `hse`, `pengawas`, `pjo` (bukan auditor) |
| Ajukan evaluasi | `hse` |
| Setujui / kembalikan evaluasi | `pjo` yang bukan penyusun; alasan wajib saat mengembalikan |

### Angka (satu sumber)
`tsp_matrix(tahun, site)` → baris program dengan `plan/actual/evidence/notes` per bulan; `tsp_summary(tahun, bulan, site)` →
capaian, program tercapai/tertinggal, kelengkapan bukti. Halaman, evaluasi, dan ekspor memakai keduanya.

## 2. Keputusan sendiri bagian 1 (mohon dikonfirmasi)

| # | Keputusan | Alasan |
|---|---|---|
| V1 | Aktual sel = **terbesar** antara realisasi manual dan jumlah aktivitas terhubung di bulan itu | Menghindari hitung ganda tanpa sinkronisasi dua arah; aktivitas tidak dapat dihapus, jadi tidak ada angka yang "turun" diam-diam |
| V2 | Capaian = Σ min(aktual, rencana) per bulan ÷ Σ rencana s.d. bulan acuan; kelebihan di satu bulan tidak menutup bulan lain | Selaras prototipe (capaian dibatasi 100%); ditandai "Rumus belum disahkan" lewat KPI `tsp_achievement` (draf) |
| V3 | Bukti realisasi = jumlah file di Storage `tsp/<program>/<YYYY-MM>/`, dihitung saat simpan; bukti aktivitas = `aktivitas/<id>/` | Tanpa tabel lampiran (pola lampiran standar); status "Bukti kurang" turunan dari jumlah file |
| V4 | Realisasi bulan yang evaluasinya **disetujui** terkunci; bulan yang belum berjalan tidak bisa dicatat | Evaluasi yang disetujui adalah catatan resmi; mencegah realisasi fiktif |
| V5 | Evaluasi per site; tampilan "Semua site" hanya membaca | Satu evaluasi = satu site + satu bulan (selaras Laporan Periode §2.2) |
| V6 | Daftar jenis aktivitas tetap (check constraint), bukan master `/master` | Hanya 7 jenis dari prototipe; menambah master butuh perubahan constraint fase 0 |
| V7 | Program disusun per tahun; tahun baru = program baru (belum ada "salin dari tahun lalu") | Tidak diminta; bisa ditambah bila perlu |

## 2b. Pengingat dan Audit Trail (selesai)

- **Pengingat**: tiga jenis yang sumber datanya sudah ada (PICA, inspeksi, evaluasi TSP). **[V8]** Kanal in-app saja, push tidak dikirim dari
  DB (D10 menyebut in-app + push; push dari job DB tidak mungkin tanpa server app). **[V9]** Jenis fase 4-5 ditambahkan bersama modulnya.
  **[V10]** Aturan bawaan: PICA 7/3/1/0 hari, inspeksi 1/0 hari, evaluasi TSP 3 dan 7 hari setelah akhir bulan (ke HSE).
- **Audit Trail**: **[V11]** admin app dan Auditor; mengikuti RLS log tiap entitas (jadi Auditor tidak melihat log yang RLS-nya admin saja).
  Filter entitas/pelaku/aksi/periode, paginasi kursor 50 baris.

## 4. Laporan Periode (selesai)

Route: `/laporan` (ringkasan status, filter template/tahun, tombol Buat Laporan) dan `/laporan/[id]` (workspace: outline, bagian dengan tautan
"N data · lihat sumber", Pemeriksaan Kelengkapan, tindakan, riwayat versi, Jalur Approval). Alur: draf → ajukan → HSE Senior (memeriksa) → PJO →
Manajemen → **Terbit** (snapshot v1.0). Dikembalikan → bisa diubah dan diajukan ulang. Koreksi → v1.1 lewat approval yang sama, alasan wajib.

Keputusan sendiri (mohon dikonfirmasi):

| # | Keputusan | Alasan |
|---|---|---|
| W1 | Kelengkapan wajib = jam kerja bulan itu, semua kejadian periode terklasifikasi, narasi terisi; disarankan = bukti PICA terverifikasi, evaluasi TSP disetujui. Kekurangan wajib boleh diajukan dengan alasan (>= 10 karakter) | Rancangan §4.10: "atau dengan catatan"; angka palsu tidak dibuat |
| W2 | Narasi = teks biasa maks 4000 karakter per bagian, bukan Tiptap | Rich text menambah kompleksitas sanitasi; bisa diganti `RichTextEditor` tanpa mengubah DB (kolom jsonb) |
| W3 | Template laporan hanya dari seed (2 template prototipe); belum ada UI mengelolanya | Prototipe tidak menampilkan editor template |
| W4 | Kode laporan = periode (`LAP-2026-10`), unik per site+template+bulan; tanpa nomor urut | Rancangan §2.6 |
| W5 | Snapshot memuat daftar kejadian (maks 100) dan angka agregat, bukan seluruh record | Cukup untuk arsip resmi; record sumber tetap bisa dibuka |
| W6 | Jalur approval dari template engine (D9), tanpa kepala departemen (departemen null) | Persetujuan per jabatan tetap, mengikuti prototipe |

## 3. Belum dibangun
Ekspor PDF/Excel dan cetak Laporan Periode, blok Beranda "Pencapaian TSP per elemen", tautan aktivitas ke Leading Indicator dashboard, salin
program TSP antar tahun, cetak evaluasi TSP, rich text narasi.
