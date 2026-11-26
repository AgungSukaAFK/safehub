# Spesifikasi Fase 6: Monitoring APD

Sumber: folder `Monitoring APD/` (2026-11-26): `Monitoring APD GMI 2026.xlsx`, `1. FORM BERITA ACARA KERUSAKAN APD.docx`,
`2. FORM REQUEST APD FIX.docx`. Belum ada di rancangan-implementasi; modul baru (grup menu `k3lh`). Keputusan user ditandai **[U#]**,
keputusan sendiri **[P#]**.

| Bagian | Isi | Status |
|---|---|---|
| A | Skema DB, RPC, uji, konversi data Excel (master, periodik, stok awal, IN, OUT, MR) | **selesai** |
| B | UI: `/apd` (ringkasan, stok, mutasi, karyawan, periodik, barang), pengajuan + approval + cetak, `/apd/saya` | **selesai** |
| C | Data per karyawan (ukuran + riwayat dari sheet Populasi Manpower) | **menunggu daftar NRP** |

## Isi sumber (ringkas)

- **Master Barang APD**: 51 item berkode `SS-01-40` (sepatu per merek/ukuran), `KM-`/`KS-` (kemeja/kaos per ukuran), `HLM-` (helm per warna),
  `SG`, `MSK`, `EPL`, `PDL`, `SRT`, `GSRT`, `RMP`. Harga kosong.
- **IN** (14 baris, no PR/MR), **OUT** (95 baris: site, karyawan, PIC pengiriman, no BAST kosong), **MTR MR** (60 baris permintaan per site/karyawan:
  qty, qty supply, OS, OPEN/CLOSE, lead time), **Update Stock** (stok = SO + IN − OUT − retur; OS MR per item).
- **Populasi Manpower** (196 orang, 12 site): ukuran + tanggal terakhir terima 16 jenis APD; jatuh tempo kemeja/kaos 180 hr, sepatu 545, helm 1095, jeans 730.
- **Matrix APD** (ditandatangani Head of Dept HSE, 24 Feb 2026): masa periodik + 4 aturan (rusak wajib foto; hilang potong gaji; wajib isi form; rawat APD).
- **Form Berita Acara Kehilangan/Kerusakan/Pengajuan**: data karyawan, terakhir dapat APD, tanggal kehilangan/kerusakan, 9 jenis APD (ukuran, qty),
  alasan Berkala / Rusak (Kelalaian), penjelasan, pernyataan potong gaji; tanda tangan Karyawan → HSE Staff → HR Manager → HSE Dept Head.
- **Form Request APD karyawan baru**: standar APD GMI (spesifikasi ANSI, merek), ukuran/warna/qty; poin 1 & 7 diisi HRD, sisanya user/Adm Service.

## Keputusan

| # | Keputusan | Alasan |
|---|---|---|
| U1 | Nilai awal masa periodik = sheet **Matrix APD** (bukan rumus Populasi atau gambar di form). Admin bisa mengubahnya | Pilihan user; dokumen resmi bertanda tangan |
| U2 | Data per karyawan (Populasi Manpower) dimuat setelah HR menyerahkan daftar NRP; tidak dicocokkan dari nama | Pilihan user; nama di Excel tidak konsisten |
| U3 | Cakupan lengkap: stok + MR + jatuh tempo + pengajuan digital dengan approval dan cetak Berita Acara | Pilihan user |
| U4 | Data Excel dimuat lewat **halaman impor di app** (`/apd/impor` → RPC `apd_import_legacy`, sekali). Semula file SQL sekali jalan; diubah 2026-11-26 karena aturan lourdes-db melarang tulis data manual di produksi | Pilihan user (dua kali) |
| P1 | Periodik disimpan sebagai `interval_days` (1x/th = 365, 2x/th = 182, 4x/th = 91, 1x/2 th = 730, 1x/3 th = 1095, 1x/minggu = 7) + label asli. `warn_days` per jenis (bawaan: ≤ 91 hr → 14, 182 → 30, 365 → 60, ≥ 730 → 90). Sarung tangan (mingguan) = habis pakai: tidak dilacak jatuh temponya | Excel memakai ambang "MR" 60/90/365 hari yang membuat helm berstatus MR 2 tahun; ambang dibuat proporsional dan bisa diubah admin |
| P2 | Jenis APD (`apd_types`) ≠ barang (`apd_items`). Jatuh tempo dilacak per **jenis**; stok per **barang** (kode). Seragam dipecah Kemeja / Kaos / Celana (periodik sama: Uniform 2x/th) karena Populasi mencatatnya terpisah | Ganti merek/ukuran tidak mengubah hak periodik |
| P3 | Stok = buku besar mutasi `apd_stock_moves` (opening, in, out, return, adjust) per gudang (`location_id`). Stok tidak disimpan. OUT baru ditolak bila stok kurang; data lama apa adanya (earplug −7 tampil sebagai minus + perlu stock opname) | Satu sumber angka, bisa diaudit |
| P4 | Pengajuan APD = dokumen jenis A (`apd_requests`, doc_type `apd_request`, nomor `APD-YYYY-NNNN`). Alasan: `new_hire` (karyawan baru), `periodic` (berkala), `damaged` (rusak), `lost` (hilang). Rusak wajib foto bukti (Matrix catatan 1); rusak karena kelalaian & hilang wajib centang pernyataan potong gaji; rusak/hilang wajib penjelasan ≥ 10 karakter | Isi Form Berita Acara + Matrix |
| P5 | Jalur approval dari template engine (admin mengatur approver). Seed demo: HSE Staff (memeriksa) → HR Manager (mengetahui) → HSE Dept Head (menyetujui) | Sama dengan tanda tangan di form |
| P6 | Pemenuhan: OUT ditautkan ke baris pengajuan; OS = qty − terkirim; status pemenuhan turunan (Belum / Sebagian / Terpenuhi); lead time = tanggal disetujui (data lama: tanggal MR) s.d. OUT terakhir. Nomor MR sistem perusahaan (`GMI/MR/...`) = teks referensi | Menggantikan sheet MTR MR tanpa input ganda "qty supply" |
| P7 | Transaksi menyimpan `employee_id` (boleh kosong untuk data lama) + snapshot nama penerima. Pengajuan baru dari app wajib memilih karyawan Manpower | U2: data lama tanpa NRP tetap bisa masuk; ditautkan saat NRP datang |
| P8 | Hak: kelola master/stok/mutasi = `apd_manager()` (hse, hse_senior, scm, admin; bukan auditor). Baca = staf K3 dalam scope company + site gudang/site tujuan. Pengajuan: dibuat pemohon mana pun (Karyawan hanya untuk dirinya), terbaca pemohon, karyawan ybs, approver, dan staf K3 | Pola 17/19 |
| P9 | Riwayat & jatuh tempo per karyawan per jenis: terakhir terima = OUT terbaru jenis itu (atau riwayat awal dari Populasi), jatuh tempo = + `interval_days`. Status: Kedaluwarsa / Segera Ganti (≤ `warn_days`) / Aman / Belum Pernah. Pengingat `apd_due` lewat `run_expiry_reminders` (in-app, karyawan berakun + HSE site) | Pola pengingat kedaluwarsa fase 4 E |
| P10 | Data lama dibersihkan saat konversi: nama di-trim, site diseragamkan (MANADO → Manado), "Ahmad Riani dan Dwi Catur" (qty 2) dipecah, "Dwi Catur" → "Dwi Catur Guntoro". Baris tanpa tanggal: OUT diisi tanggal baris sebelumnya, IN `SS-05-42` = tanggal OUT-nya (28 Okt); keduanya diberi catatan "tanggal tidak tercatat di Excel". MR tanpa tanggal tetap tanpa tanggal (lead time "tidak tercatat"). Stok awal (SO) bertanggal 1 Okt 2026 | Excel tidak punya nilai yang benar; jejak dibiarkan terlihat |
| P11 | Harga barang tidak dibawa (kosong di Excel; data komersial menyusul bila diminta) | YAGNI |

## Masalah data di Excel (dilaporkan ke HSE)

- Tidak ada NRP; nama tidak konsisten (spasi ekor, nama pendek/panjang, dua orang dalam satu baris).
- 47 dari 60 baris MR tanpa tanggal & nomor MR → lead time di Excel = 46352 hari (TODAY() − kosong).
- Stok earplug (`EPL-01`) −7: tidak ada SO/IN tetapi ada 7 OUT. `SS-05-42` tidak ikut hitungan sheet stok (kolom No kosong).
- `SS-01-38` dan `SS-03-38` bernama sama ("Krusher Safety Shoes Uk 38"); `SG-01` & `SG-02` sama-sama "Safety Glasses Clear" (beda merek).
- MR BIB meminta `SG-01`, OUT mengirim `SG-02`: MR dan OUT tidak tertaut di Excel.
- Populasi: supply kosong menghasilkan jatuh tempo tahun 1900 ("Expired" palsu); qty berbentuk teks "2+1"; satu tanggal berupa teks "23 December".
- Periodik bertentangan di tiga tempat (lihat U1).

## Implementasi

DB `db/app/24_apd.sql` + `25_apd_impor.sql`, uji `db/tests/16_apd.sql` (P1a-P7d), pembaca workbook `lib/apd-excel.ts`, halaman `/apd/impor`.
Rekonsiliasi konversi terhadap sheet Update Stock (SO, IN, OUT, stok, OS MR per kode): 50 dari 51 barang identik; `SS-05-42` hanya beda karena
tidak ikut dihitung di sheet stok Excel (stok akhir sama, 0). 95 baris OUT menjadi 98 mutasi (satu baris dua nama dipecah), 60 baris MR menjadi
42 pengajuan data lama (dikelompokkan per site + karyawan + no MR).

| # | Keputusan tambahan saat implementasi | Alasan |
|---|---|---|
| P12 | Jatuh tempo per karyawan hanya untuk jenis yang PERNAH diterima (tidak ada daftar APD wajib per jabatan) | Matrix APD tidak menyebut APD wajib per jabatan; "Belum pernah" tanpa acuan menyesatkan |
| P13 | Ringkasan stok selalu dari semua gudang yang terlihat; pemilih site hanya memfilter pengajuan, jatuh tempo, dan APD keluar | Gudang APD terpusat di HO; stok per site MIFA selalu 0 |
| P14 | Ukuran per karyawan tidak dilog | Bukan data sensitif; riwayat penerimaan sudah tercatat di mutasi |
| P15 | Pemetaan site saat impor dipilih admin dari nama lokasi persis (saran otomatis hanya bila tepat satu nama memuat kode site; HO disarankan `HEAD OFFICE (KM 8A)`, keputusan user). Semua site wajib dipetakan; tidak ada "lewati" | Generator yang menebak pola gagal di produksi (12/12 tidak cocok); data tanpa site tujuan merusak stok |
