# Spesifikasi Fase 4: People, Kontraktor & PJO/PJA, Dokumen, Impor Data

Langkah 0 (rancangan §3) untuk §4.6-§4.8 dan §2.12. Dikerjakan per bagian; keputusan sendiri ditandai **[X#]**.

| Bagian | Isi | Status |
|---|---|---|
| A | Manpower, Kompetensi & Sertifikat, MCU (+ data terbatas), Permit Site | **selesai** |
| B | Pelatihan (rencana, kalender, peserta, kehadiran, bukti) | **selesai** |
| C | Kontraktor & Legalitas, PJO/PJA | **selesai** |
| D | Prosedur & Dokumen (approval jenis A), Evaluasi Peraturan, Register KO | **selesai** (QA browser belum dijalankan) |
| E | Impor Data (wizard) + pengingat kedaluwarsa (MCU, sertifikat, izin, dokumen) | belum |

## Bagian A (selesai)

Route: `/manpower` (KPI, kebutuhan vs tersedia per jabatan, daftar), `/manpower/[id]` (tab Ringkasan, Kompetensi & Sertifikat, MCU, Permit Site;
riwayat lewat dialog), `/kompetensi` (matriks karyawan x kompetensi), `/mcu` (MCU terbaru per karyawan).

Entitas (`db/app/17_people.sql`): `employees`, `position_requirements`, `competencies` (+ jabatan yang wajib), `certificates`, `mcu_records`,
`mcu_restricted` (diagnosis/catatan: hanya HR/HSE, tidak dilog), `site_permits`. Tulis HANYA lewat RPC `employee_save`, `position_requirement_save`,
`competency_save`, `certificate_save`, `mcu_save`, `site_permit_save`, `people_sync_evidence`. Baca: `employee_overview`, `competency_matrix`,
`manpower_summary`, `expiry_state` (status masa berlaku turunan, ambang 30 hari).

| Aksi | Siapa |
|---|---|
| Lihat manpower/kompetensi/MCU (ringkasan) | staf K3 (bukan Karyawan) dalam scope company + site |
| Lihat diagnosis & catatan medis | `hr`, `hse` |
| Kelola karyawan, kebutuhan, kompetensi, sertifikat, permit | `hr`, `hse`, admin (bukan auditor) |
| Catat MCU | `hr`, `hse` (admin boleh) |

| # | Keputusan sendiri (mohon dikonfirmasi) | Alasan |
|---|---|---|
| X1 | Jabatan = teks bebas (snapshot) per karyawan dan per kebutuhan, bukan FK ke `public.job_titles` | Jabatan operasional (Teknisi AC, Mekanik) tidak tentu ada di master platform; kecocokan kebutuhan = teks sama |
| X2 | Kompetensi wajib ditentukan per jabatan di master kompetensi (`job_titles`); tanpa sertifikat = "Belum Ada" bila wajib, "Tidak wajib" bila tidak | Prototipe memakai kedua status itu di matriks |
| X3 | Pemenuhan manpower = Σ min(tersedia, kebutuhan) ÷ Σ kebutuhan; KPI `manpower_fulfillment` draf ("definisi kebutuhan menunggu pengesahan") | Rancangan §4.6 |
| X4 | Tenaga mitra = karyawan dengan `contractor_id` (mitra dari master `/master`) | Rancangan §4.7: personel mitra = employees |
| X5 | MCU: daftar hanya ringkasan aman (hasil + masa berlaku); diagnosis hanya di profil bagi HR/HSE; file bukti MCU juga hanya HR/HSE | Rancangan §2.7 |
| X6 | Nonaktifkan, tidak hapus karyawan; nonaktif keluar dari ringkasan dan matriks | Riwayat sertifikat/MCU tetap terjaga |
| X7 | Pengingat kedaluwarsa (MCU, sertifikat, permit) ditunda ke bagian E bersama aturan `reminder_rules` baru | Aturan perlu jenis baru di constraint |

## Bagian B: Pelatihan (keputusan sendiri Y1-Y5, menunggu konfirmasi)

| # | Keputusan | Alasan |
|---|---|---|
| Y1 | `/pelatihan` (daftar) + `/pelatihan/[id]` (detail); `/kompetensi` hanya menautkan. Status `planned > done \| cancelled` | Matriks kompetensi tetap ringkas; rancangan menyebut `/pelatihan/[id]` |
| Y2 | Nomor `TRN-YYYY-NNNN` (reset tahunan per company, 4 digit seperti KJD/AKT), bukan 3 digit prototipe | Satu pola penomoran |
| Y3 | Pelatihan selesai TIDAK otomatis menerbitkan sertifikat; HR/HSE mencatat nomor & masa berlaku asli di profil karyawan | Sertifikat resmi punya nomor/penerbit dari lembaga, bukan dari kehadiran |
| Y4 | Selesai = sudah lewat tanggal mulai, ada peserta, semua kehadiran dicatat (hadir/tidak hadir). Batal = alasan >= 10 karakter. Selesai/batal mengunci rencana & peserta | Data kehadiran yang bisa berubah sesudah selesai tidak bisa diaudit |
| Y5 | Peserta = karyawan AKTIF di site & company pelatihan; kapasitas dijaga DB. Peserta berakun diberi notifikasi (kategori `pelatihan`) saat didaftarkan, selesai, atau dibatalkan | Tanpa akun tetap bisa terdaftar (tenaga mitra) |

Tulis lewat RPC `training_save`, `training_participants_set`, `training_attendance_set`, `training_set_status`, `training_sync_evidence`
(`db/app/18_pelatihan.sql`); bukti di Storage `pelatihan/<id>/` (baca = pelatihan terlihat, unggah = HR/HSE/admin). Perubahan peserta/kehadiran
masuk `trainings_logs` (aksi `participants`, `attendance`). Uji: `db/tests/10_pelatihan.sql` (Y1-Y4).

## Bagian C: Kontraktor & PJO/PJA (keputusan sendiri Z1-Z7, menunggu konfirmasi)

| # | Keputusan | Alasan |
|---|---|---|
| Z1 | Pengelola = `kontraktor_admin`, `hse`, admin app (bukan auditor). Baca = staf K3 non-Karyawan. Nilai kontrak hanya `manajemen`, `kontraktor_admin`, admin | Rancangan §4.7: nilai = kolom komersial |
| Z2 | Status legalitas = TURUNAN dari izin terbaru per NAMA izin: ada yang kedaluwarsa = Kedaluwarsa; ada yang <= 30 hari = Akan Kedaluwarsa; tanpa izin = Belum Ada Izin. Perpanjang = tambah izin baru bernama sama (lama jadi riwayat) | Tidak ada master "izin wajib" per jenis mitra; ditunda |
| Z3 | Checklist dokumen wajib = 6 jenis tetap (`contractor_doc_types`: akta, NIB, NPWP, SBU, BPJS, SMK3); lengkap = status Diterima dan belum lewat masa berlaku. Tidak ada UI pengelola jenis dokumen | Cukup untuk kelengkapan; pengelola jenis menyusul bila diminta |
| Z4 | CSMS = penilaian bersejarah (skor 0-100). Hasil dari skor: >= 80 lulus, 60-79 bersyarat, < 60 gagal; berlaku default 1 tahun. Ambang ini tebakan saya | Rancangan hanya menyebut "pra-kualifikasi, skor, hasil" |
| Z5 | PJO/PJA = penunjukan karyawan aktif (peran, lingkup bebas, nomor SK, periode); site mengikuti site karyawan; tidak ada pemeriksaan tumpang tindih | Register, bukan penentu hak akses |
| Z6 | Personel mitra = `employees.contractor_id` (X4); tab Personel hanya membaca | Tanpa tabel baru |
| Z7 | Bukti Storage `izin/<id>/`, `kdok/<id>/`, `pjo/<id>/` (baca = record terlihat; unggah = pengelola). Kontrak tidak punya file | Berkas kontrak memuat nilai; tidak dibuka lewat bucket umum |

Tulis lewat RPC `contractor_save`, `contractor_permit_save`, `contractor_contract_save`, `csms_save`, `contractor_document_set`, `pjo_pja_save`,
`kontraktor_sync_evidence` (`db/app/19_kontraktor.sql`). Baca: `contractor_overview`. Nilai kontrak di `contractor_contract_values` (RLS fungsi, tidak dilog).
Uji: `db/tests/11_kontraktor.sql` (Z1-Z4). Pengingat izin kedaluwarsa menyusul di bagian E.

## Bagian D: Dokumen, Evaluasi Peraturan, Register KO (keputusan sendiri W1-W8, menunggu konfirmasi)

| # | Keputusan | Alasan |
|---|---|---|
| W1 | Yang disetujui engine = REVISI (doc_type `document_revision`, tautan `/dokumen/revisi/<id>` yang mengalihkan ke dokumen). Status revisi `draft > pending_approval > approved \| rejected`; revisi terbit sebelumnya otomatis `obsolete`. Hanya satu revisi terbit dan satu revisi terbuka per dokumen (indeks unik) | Rancangan §4.8 |
| W2 | Pengelola = `hse`, `hse_senior`, admin (bukan auditor). Dokumen terbit dapat dibaca SEMUA pengguna app dalam scope company (supaya distribusi sampai ke karyawan); draf/revisi berjalan hanya staf K3 | Pengakuan baca butuh akses baca bagi karyawan |
| W3 | Distribusi = jabatan (teks, UI) + orang (`distribute_employees`, DB saja; belum ada pemilih di UI). Pengakuan dibuat untuk karyawan AKTIF berakun yang cocok saat revisi disetujui, dan diberi notifikasi in-app (kategori `dokumen`). Push tidak terkirim dari hook DB | Sama dengan pengingat: DB tidak bisa mengirim push |
| W4 | Mengajukan revisi wajib punya minimal satu file di Storage `dokumen/<revisi>/` (dihitung saat diajukan). Karyawan membuka file lewat signed URL (baca = revisi terlihat) | Tanpa file, persetujuan tidak ada artinya |
| W5 | Jadwal review = tanggal berlaku + interval bulan dokumen; chip masa berlaku turunan (ambang 30 hari). Penarikan dokumen: alasan >= 10 karakter, revisi terbit jadi obsolete, draf dihapus; banner USANG di detail | Rancangan: varian obsolete (banner) |
| W6 | KPI `document_compliance` (draf, rumus belum disahkan): rata-rata (pengakuan selesai ÷ diminta) dan (dokumen aktif belum lewat jadwal review ÷ dokumen aktif). Bobot sama = usulan saya. Belum dipasang di Beranda | Rancangan §4.8 menyebut rumus belum disahkan |
| W7 | Evaluasi peraturan: per (peraturan, site, pasal). Sebagian/Tidak Sesuai wajib tindak lanjut; bisa DIJADIKAN TEMUAN sekali (sumber Audit, kategori Dokumen & Prosedur, pilih area/PIC/risiko/tenggat) lewat `k3_finding_insert` | "tindak lanjut → bisa menjadi temuan" |
| W8 | Register KO = register izin operasi / sertifikasi alat / sarana / dokumen teknis dengan masa berlaku, PJ, file; nomor `KO-YYYY-NNNN`. Rancangan tidak merinci isinya, ini tafsiran saya | Perlu dikonfirmasi isi sebenarnya Register KO |

Tulis lewat RPC `document_save`, `document_revision_start/save`, `document_withdraw`, `document_acknowledge`, `regulation_save`, `regulation_evaluation_save`,
`regulation_make_finding`, `ko_save`, `dokumen_sync_evidence`; hook `document_revision_context` / `document_revision_on_approval` (`db/app/20_dokumen.sql`).
Baca: `document_overview`, `document_compliance`. Uji: `db/tests/12_dokumen.sql` (D1-D9). Belum dibangun: cabang `my_tasks` untuk pengakuan yang tertunda
(hanya banner di /dokumen), pengingat review/KO kedaluwarsa (bagian E), blok Beranda kepatuhan dokumen, pemilih orang untuk distribusi.
