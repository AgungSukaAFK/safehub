# Spesifikasi Fase 4: People, Kontraktor & PJO/PJA, Dokumen, Impor Data

Langkah 0 (rancangan §3) untuk §4.6-§4.8 dan §2.12. Dikerjakan per bagian; keputusan sendiri ditandai **[X#]**.

| Bagian | Isi | Status |
|---|---|---|
| A | Manpower, Kompetensi & Sertifikat, MCU (+ data terbatas), Permit Site | **selesai** |
| B | Pelatihan (rencana, kalender, peserta, kehadiran, bukti) | **selesai** |
| C | Kontraktor & Legalitas, PJO/PJA | belum |
| D | Prosedur & Dokumen (approval jenis A), Evaluasi Peraturan, Register KO | belum |
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
