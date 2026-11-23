# Spesifikasi Fase 1: Kejadian & Investigasi + Temuan & PICA

Langkah 0 (rancangan §3) untuk rancangan §4.1 dan §4.2. Sumber layar: prototipe
`incident-report.tsx`, `incident-management.tsx`, `finding-management.tsx`. Pola teknis mengikuti
CLAUDE.md; bila bertentangan, pola repo menang.

Keputusan yang **saya ambil sendiri** (belum dikonfirmasi) ditandai **[S#]** dan dikumpulkan di
bagian akhir.

---

## 1. Layar

### 1.1 `/kejadian/lapor`: wizard 4 langkah (prioritas HP)

| Langkah | Isi |
|---|---|
| 1. Informasi Kejadian | Tanggal & jam kejadian* (tombol "Sekarang", ≤ waktu lapor) · waktu lapor (otomatis, baca saja) · Lokasi* = area dari site aktif · Detail lokasi · Kategori* (kartu ikon dari master `incident_category`) · Unit/peralatan (isian bebas kode + label, D15) · Uraian* (maks 1000, penghitung) · toggle "Butuh penanganan darurat?" → callout + tombol telepon tim tanggap darurat |
| 2. Pihak Terkait | Kartu pelapor (otomatis) · "Tambah detail (opsional)": pekerja terlibat (nama, perusahaan GMI/Kontraktor/Visitor, status kerja, jabatan), saksi (nama, perusahaan, kontak), atasan langsung (pilih user) |
| 3. Bukti | Tombol **Ambil Foto** (`capture="environment"`, dikompres WebP) + dropzone (JPG/PNG/PDF/MP4, maks 10 MB) · catatan privasi |
| 4. Tinjau & Kirim | Ringkasan per bagian + tombol "Ubah" ke langkah terkait · pernyataan kebenaran* |

- Satu form, langkah = state client, submit sekali. Draf otomatis per perangkat (`useFormDraft` +
  `DraftBanner`). "Simpan Draf" = simpan draf perangkat sekarang.
- Sukses: layar nomor `KJD-YYYY-NNNN` + "Lihat Laporan" / "Kembali ke Beranda".
- HP: bar kirim menempel di bawah (di atas tab bawah).

### 1.2 `/kejadian`: daftar

- Saved views (URL `tampilan`): Semua · Perlu Klasifikasi · Investigasi · Menunggu Review · Closed.
  Hitungan di tab dari loader yang sama.
- Filter: periode (tanggal kejadian), kategori, area, status, pelapor; site dari pemilih top bar.
- Kolom: No · Nomor · Judul (= ringkasan uraian) · Kategori · Tanggal Kejadian · Lokasi · Unit ·
  Pelapor · Status · Tindakan (`closed/total` + bar) · Umur (hari sejak lapor; berhenti saat closed).
- Ekspor Excel (loader yang sama, `all: true`). Kolom terbatas tidak ikut.
- Karyawan hanya melihat laporannya sendiri.

### 1.3 `/kejadian/[id]`: detail

- Header: nomor, badge kategori, badge status (+ "Dikembalikan" bila ada catatan kembali), judul,
  area · waktu kejadian. Aksi: Tambah Tindakan, Tutup Kejadian (popover syarat penutupan dari RPC),
  menu ⋯ (Cetak, Riwayat Aktivitas).
- `WorkflowStepper` 7 tahap: Dilaporkan · Klasifikasi HSE · Investigasi · Review EHS · Review
  Manajemen · Tindakan & Verifikasi · Closed (meta: tanggal · pelaku).
- Tab (URL `tab`): Ringkasan · Klasifikasi & Dampak · Investigasi · Analisis Penyebab · Tindakan (n) ·
  Review & Persetujuan · Lampiran (n) · Riwayat.
- Aside: lokasi, unit, pelapor, waktu kejadian & lapor, klasifikasi, ketua investigasi, temuan terkait.

| Tab | Isi | Siapa mengubah |
|---|---|---|
| Ringkasan | uraian, detail lokasi, darurat, foto, pekerja terlibat, saksi, atasan | (baca) |
| Klasifikasi & Dampak | kategori final, kelas cedera, keparahan aktual & potensi (master `risk_level`), APD dipakai; **terbatas** (HSE/HR): jenis cedera, bagian tubuh, perawatan, fasilitas, hari hilang, hari terbatas; **komersial** (HSE/PJO/Manajemen/SCM): deskripsi kerusakan, estimasi biaya | HSE |
| Investigasi | tim (ketua + anggota), kronologi (waktu + peristiwa), rekonstruksi | HSE + tim |
| Analisis Penyebab | 4 kelompok (Tindakan Tidak Aman, Kondisi Tidak Aman, Faktor Pekerjaan, Faktor Personal): butir + penjelasan; rekomendasi + "Jadikan Tindakan" | HSE + tim |
| Tindakan | tabel tindakan PICA kejadian (nomor, deskripsi, jenis, PIC, due, status, bukti, verifikator) | HSE |
| Review & Persetujuan | Investigator (kirim) → Review EHS → Review Manajemen; Setujui / Kembalikan dengan Catatan; pembuat laporan tidak boleh menyetujui laporannya sendiri | sesuai tahap |
| Lampiran | file `kejadian/<id>/` | pelapor & HSE unggah |
| Riwayat | `incidents_logs` | (baca) |

### 1.4 `/temuan`: daftar

- Strip angka: Open · In Progress · Menunggu Verifikasi · Overdue · Closed bulan ini · Rata-rata umur.
  Klik = filter list.
- Widget: Temuan per Sumber (bar), Tren 6 bulan dibuka vs ditutup (garis), Overdue per PIC (top 5).
  Semua dari loader/RPC dengan filter yang sama.
- Saved views: Semua · Ditugaskan ke Saya · Overdue · Menunggu Verifikasi · Closed. Toggle
  **Tabel/Kanban** (URL `mode=kanban`).
- Filter: periode, sumber, kategori, prioritas, status, PIC, area, due date.
- Kolom: Nomor · Temuan · Sumber (`SourceChip`) · Lokasi · Prioritas · PIC · Due (+ keterlambatan) ·
  Umur · Status · Tindakan (`x/y`).
- Kanban: kolom Open (termasuk overdue, kartu bergaris merah) · In Progress · Menunggu Verifikasi ·
  Closed.
- Tombol "Temuan Baru" → `/temuan/baru`.

### 1.5 `/temuan/baru`, `/temuan/[id]/ubah`: form temuan

Judul*, uraian*, sumber* (Inspeksi/Observasi/Audit/Kejadian/Rapat/Lainnya) + referensi (nomor bebas;
Kejadian = pilih kejadian), area*, detail lokasi, waktu ditemukan*, kategori* (master
`finding_category` baru), prioritas* (master `risk_level`) + kemungkinan × konsekuensi (1–5,
opsional), PIC temuan*, due date*, akar penyebab (Manusia/Metode/Mesin/Material/Lingkungan/
Manajemen: teks). Lampiran foto.

### 1.6 `/temuan/[id]`: detail

- Header: nomor, status, prioritas, judul, `SourceChip`, PIC, due + "+N hari".
- Tab: Detail · Lampiran · Riwayat.
- Detail: uraian & foto, prioritas/risiko (L × K = nilai, catatan "skema risiko contoh"), akar
  penyebab, **Rencana Tindakan** (dikelompokkan Koreksi/Pencegahan, kartu bisa dibuka-tutup),
  penutupan temuan (alasan + tombol, aktif bila semua tindakan Closed).
- Kartu tindakan: PIC, due, verifikator, bukti, bukti yang diwajibkan.
  - PIC & status open/in_progress: blok "Unggah Bukti" → drawer (min 1 file + catatan).
  - Verifikator & status waiting_verification: daftar file bukti + komentar* → Terima / Kembalikan.
  - Closed: "Bukti diterima oleh … · waktu · komentar".
  - Verifikasi efektivitas (opsional): tanggal + catatan, diisi verifikator setelah Closed.
  - Ubah due date: alasan wajib ("Konfirmasi Perubahan").

### 1.7 Drawer "Tambah Tindakan" (dipakai kejadian & temuan)

Deskripsi*, jenis* (Korektif/Preventif), PIC*, due date*, bukti yang diwajibkan, verifikator*
(default: pembuat bila HSE, selain itu user HSE pertama di site).

---

## 2. Entitas (`db/app/11_kejadian_pica.sql`)

| Tabel | Kolom penting |
|---|---|
| `incidents` | `code` KJD, `company_code`, `location_id` (site), `area_id`, `location_detail`, `occurred_at`, `reported_at`, `reported_category` (kode pelapor), `category` (kode final HSE), `injury_class`, `severity`, `potential_severity`, `unit_code`, `unit_label`, `description`, `is_emergency`, `supervisor_id`, `ppe` jsonb, `damage_description`, `status`, `return_note`, `returned_at`, `lead_investigator_id`, `closed_at`, `close_note`, `closed_exception`, `search_text` |
| `incident_persons` | `incident_id`, `role` (`involved`/`witness`), `name`, `company_kind` (`internal`/`contractor`/`visitor`), `contractor_id`, `employment` , `position`, `contact`, `line_no` |
| `incident_restricted` | 1:1, HSE/HR: `injury_type`, `body_parts text[]`, `treatment`, `facility`, `lost_days`, `restricted_days` |
| `incident_costs` | 1:1, HSE/PJO/Manajemen/SCM/admin: `estimated_cost` |
| `incident_team` | `incident_id`, `user_id`, `role` (`lead`/`member`) |
| `incident_investigations` | 1:1: `timeline` jsonb `[{time, event}]`, `reconstruction`, `causes` jsonb `{unsafe_act:[{text,note}], unsafe_condition, job_factor, personal_factor}`, `recommendations` jsonb `[{text}]` **[S6]** |
| `incident_reviews` | riwayat keputusan review: `stage` (`investigation`/`ehs`/`mgmt`), `decision` (`submit`/`approve`/`return`), `note`, `actor_id`, `at` |
| `findings` | `code` TMN, `company_code`, `location_id`, `area_id`, `location_detail`, `found_at`, `title`, `description`, `source_kind`, `source_ref`, `source_id` (kejadian), `category`, `risk_level`, `likelihood`, `consequence`, `root_causes` jsonb, `pic_id`, `due_date`, `status` (cache turunan), `closed_at`, `close_note`, `search_text` |
| `pica_actions` | `code` PCA **[S1]**, `finding_id` **atau** `incident_id`, `company_code`, `location_id`, `title`, `kind` (`corrective`/`preventive`), `pic_id`, `verifier_id`, `due_date`, `required_evidence`, `status`, `round`, `returned` (bool), `closed_at`, `effectiveness_date`, `effectiveness_note`, `cause_ref` |
| `pica_evidence` | `action_id`, `round`, `note`, `files text[]` (path storage), `submitted_by/at`, `decision` (`accepted`/`returned`), `decision_note`, `decided_by/at` |
| `*_logs` | `incidents_logs`, `findings_logs`, `pica_actions_logs` (tanpa FK, K4) |

Master baru: `master_items.kind` + `finding_category` (Keselamatan Operasional, Kesehatan Kerja,
Lingkungan, Housekeeping, Peralatan & APD, Dokumen & Prosedur).

Storage `<host>-lampiran`: folder `kejadian/<id>/`, `temuan/<id>/`, `pica/<action_id>/r<round>/`.
Baca = record terbaca (ikut RLS). Tulis = record terbaca + (pelapor/HSE untuk kejadian; pembuat/PIC/HSE
untuk temuan; PIC untuk bukti). MIME `video/mp4` ditambahkan.

---

## 3. Status & transisi (jenis B, hanya lewat RPC)

### 3.1 Kejadian

```
reported ──classify(HSE)──▶ classified ──start_investigation(HSE)──▶ investigating
investigating ──submit_review(HSE/ketua)──▶ review_ehs
review_ehs ──approve(hse_senior, ≠ pelapor)──▶ review_mgmt     ──return(catatan*)──▶ investigating
review_mgmt ──approve(pjo/manajemen, ≠ pelapor)──▶ actions | closed   ──return──▶ investigating
actions ──(tindakan terakhir Closed, otomatis)──▶ closed
* ──close_exception(pjo, alasan*)──▶ closed (closed_exception = true)
```

- "Dikembalikan" = `return_note` terisi (status kembali ke `investigating`) **[S3]**.
- Setelah review manajemen: bila semua tindakan sudah Closed (atau tidak ada tindakan) → langsung
  `closed`, selain itu `actions` **[S4]**.
- Syarat penutupan (`incident_close_check`): klasifikasi ada, investigasi terkirim, review EHS &
  manajemen disetujui, semua tindakan Closed.
- Kategori untuk KPI hanya dari `category` (diisi HSE), bukan `reported_category`.

### 3.2 Tindakan PICA

```
open ──start(PIC)──▶ in_progress
open|in_progress ──submit_evidence(PIC, ≥1 file)──▶ waiting_verification
waiting_verification ──accept(verifikator, komentar*)──▶ closed
waiting_verification ──return(verifikator, komentar*)──▶ in_progress (returned, round+1)
```

Ubah due date: pembuat temuan/HSE, alasan wajib (dicatat di log). Verifikator ≠ PIC.

### 3.3 Temuan (status turunan, di-cache)

`closed` bila ditutup; selain itu dari tindakan: tanpa tindakan/semua open → `open`; semua yang belum
closed sedang `waiting_verification` → `waiting_verification`; lainnya → `in_progress`. **Overdue**
= `due_date < hari ini (WIB)` dan belum closed (dihitung, tidak disimpan). Tutup temuan: HSE, alasan*,
semua tindakan Closed.

---

## 4. Peran (RLS + RPC; diuji di `db/tests/03_kejadian_pica.sql`)

| Aksi | Siapa |
|---|---|
| Lapor kejadian | semua fungsi kecuali `auditor` (role ≥ viewer) |
| Baca kejadian | Karyawan: miliknya; lainnya: scope company + site |
| Klasifikasi, mulai investigasi, tambah tindakan kejadian | `hse` |
| Ubah investigasi & analisis | `hse` + tim investigasi |
| Kirim ke review | `hse` atau ketua tim |
| Review EHS | `hse_senior` (bukan pelapor) |
| Review manajemen | `pjo`, `manajemen` (bukan pelapor) |
| Tutup dengan pengecualian | `pjo` |
| Baca data cedera | `hse`, `hr` |
| Baca/isi estimasi biaya | `hse` (isi), `pjo`, `manajemen`, `scm`, admin |
| Buat/ubah temuan | `hse`, `pengawas`, `pjo` |
| Baca temuan | scope company + site; Karyawan: temuan yang ia jadi PIC/pembuat |
| Tambah tindakan temuan | pembuat temuan, `hse`, `pjo` |
| Unggah bukti | PIC tindakan |
| Verifikasi | verifikator tindakan |
| Tutup temuan | `hse` |
| Auditor | baca semua, tidak menulis apa pun |

---

## 5. Notifikasi (kategori `kejadian`, `pica`)

| Kejadian | Penerima |
|---|---|
| Kejadian dilaporkan | HSE di site itu + PJO (darurat: judul "DARURAT") |
| Diklasifikasi / investigasi dimulai | pelapor; tim investigasi |
| Dikirim ke review EHS | `hse_senior` |
| Disetujui EHS | `pjo` + `manajemen` |
| Dikembalikan | ketua tim + HSE pengklasifikasi |
| Disetujui manajemen / Closed | pelapor + ketua tim |
| Tindakan dibuat | PIC |
| Bukti dikirim | verifikator |
| Diterima / dikembalikan | PIC |
| Temuan dibuat | PIC temuan |

Penerima "fungsi X di site Y" = anggota aktif app dengan fungsi X dan scope site mencakup Y
(`users_with_function(fn, location)`).

## 6. Tugas Saya (`my_tasks` + cabang baru)

| Tugas | Grup | Untuk |
|---|---|---|
| Klasifikasi kejadian (`reported`) | action | HSE (site) |
| Investigasi (`classified`/`investigating`) | action | ketua tim (atau HSE bila belum ada tim) |
| Review EHS / Manajemen | approval | `hse_senior` / `pjo`+`manajemen` |
| Kerjakan tindakan / unggah bukti (`open`/`in_progress`) | action | PIC |
| Verifikasi bukti (`waiting_verification`) | verification | verifikator |

## 7. Dashboard & pencarian

- Fase 1 tidak mengubah Beranda (dashboard v1 = fase 2). Badge menu: Kejadian = perlu klasifikasi
  (HSE), Temuan = overdue (merah).
- `global_search`: kejadian (nomor, uraian, unit), temuan (nomor, judul), tindakan (nomor, judul).
- `LOG_ENTITIES`: `incidents`, `findings`, `pica_actions`.

## 8. Tidak diambil dari prototipe

Foto Unsplash, data contoh hardcode, "Pengikut", akses lampiran per file (Terbatas/Internal) **[S5]**,
caption per lampiran, diagram tubuh SVG (diganti pilihan bagian tubuh), ekspor PDF terpisah (pakai Cetak).

---

## 9. Keputusan sendiri (mohon dikonfirmasi)

| # | Keputusan | Alasan |
|---|---|---|
| S1 | Nomor tindakan `PCA-YYYY-NNNN` (prototipe: `TDK-…`) | Mengikuti tabel prefix §2.6 yang sudah diputuskan |
| S2 | Verifikator hanya **Terima** / **Kembalikan** (prototipe juga punya "Tolak") | "Tolak" tanpa aturan lanjutan membuat temuan tidak bisa ditutup; perbaikan = kembalikan |
| S3 | "Dikembalikan" = catatan + kembali ke `investigating`, bukan status terpisah | Stepper tetap linear; status dikembalikan terlihat dari badge |
| S4 | Kejadian tertutup otomatis setelah review manajemen + semua tindakan Closed | Urutan alur inti §1.3 (tindakan bisa selesai sebelum/ sesudah review) |
| S5 | Semua lampiran kejadian mengikuti hak baca kejadian (tanpa label per file) | Lebih sederhana; data sensitif ada di tabel terbatas, bukan file |
| S6 | Kronologi, analisis penyebab, rekomendasi disimpan sebagai jsonb satu baris investigasi | Selalu dibaca/disimpan bersama; tidak dihitung di KPI |
| S7 | Draf lapor hanya di perangkat; lampiran diunggah setelah kejadian dibuat (folder `kejadian/<id>/`) | Tanpa folder `new-<uid>` dan pemindahan file di server |
