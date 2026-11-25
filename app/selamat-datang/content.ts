// Isi landing publik. Hanya kemampuan yang sudah ada di app; contoh tampilan diberi label "Contoh".
export const CHAPTERS = [
  {
    stage: "Lapor",
    title: "Laporkan saat masih di lokasi.",
    body: "Near miss, cedera, atau kondisi berbahaya dicatat dari HP, lengkap dengan foto dan area kejadian. Draf tetap tersimpan di perangkat kalau sinyal hilang.",
    sample: { code: "KJD-2026-0001", text: "Near miss di area workshop", status: "Dilaporkan" },
  },
  {
    stage: "Investigasi",
    title: "Temukan penyebab dasarnya.",
    body: "HSE mengklasifikasi, tim menginvestigasi, lalu EHS dan manajemen meninjau. Pembuat laporan tidak bisa meninjau laporannya sendiri.",
    sample: { code: "KJD-2026-0001", text: "Menunggu review EHS", status: "Review" },
  },
  {
    stage: "Perbaiki",
    title: "Setiap tindakan punya nama dan tanggal.",
    body: "Temuan ditindaklanjuti lewat PICA dengan PIC, tenggat, dan bukti. Mengubah tenggat wajib beralasan, jadi yang terlambat tetap terlihat.",
    sample: { code: "PCA-2026-0007", text: "Pasang pelindung kopling", status: "Dikerjakan" },
  },
  {
    stage: "Tutup",
    title: "Selesai setelah buktinya diterima.",
    body: "Verifikator memeriksa bukti dan boleh mengembalikannya. Kejadian ditutup otomatis setelah review manajemen dan semua tindakannya selesai.",
    sample: { code: "PCA-2026-0007", text: "Bukti diverifikasi", status: "Closed" },
  },
] as const;

export const MODULES = [
  { key: "k3lh", name: "K3LH", line: "Kejadian, inspeksi, observasi KTA/TTA, temuan, dan TSP dalam satu alur kerja.", items: ["Kejadian & Investigasi", "Inspeksi & Observasi", "Temuan & PICA", "TSP & Aktivitas"] },
  { key: "people", name: "People", line: "Siapa yang boleh bekerja di site, dan sampai kapan.", items: ["Manpower & permit", "Kompetensi", "Pelatihan", "MCU"] },
  { key: "kontraktor", name: "Kontraktor", line: "Legalitas, kontrak, dan penilaian CSMS mitra.", items: ["Izin & kontrak", "CSMS", "PJO / PJA"] },
  { key: "dokumen", name: "Dokumen", line: "SOP terbaru sampai ke orang yang wajib membacanya.", items: ["Revisi & approval", "Pengakuan baca", "Evaluasi peraturan", "Register KO"] },
  { key: "maintenance", name: "Maintenance", line: "Kondisi unit dari sistem maintenance, hanya baca.", items: ["PA, MTBF, MTTR", "Planned service", "Backlog", "Readiness LIB"] },
  { key: "laporan", name: "Laporan", line: "Angka periode dikunci saat terbit, dan koreksinya menjadi versi baru.", items: ["Laporan Periode", "Kamus KPI", "Pengingat", "Audit Trail"] },
] as const;

export const ROLES = [
  { name: "Karyawan", lead: "Menu ringkas, tombol Lapor paling depan.", does: ["Melaporkan kejadian dan observasi", "Mengerjakan tindakan sebagai PIC", "Membaca SOP yang ditujukan kepadanya"] },
  { name: "HSE", lead: "Seluruh siklus K3 di satu meja.", does: ["Mengklasifikasi dan menginvestigasi", "Memverifikasi bukti PICA", "Menyusun Laporan Periode"] },
  { name: "PJO", lead: "Keputusan operasional dengan konteks lengkap.", does: ["Membuat dan memantau temuan", "Menyetujui evaluasi TSP", "Menyetujui Laporan Periode"] },
  { name: "Manajemen", lead: "Ringkasan setiap site, dengan rincian di baliknya.", does: ["Review akhir kejadian", "Melihat KPI beserta rumusnya", "Menyetujui Laporan Periode"] },
  { name: "Auditor", lead: "Membaca data tanpa bisa mengubahnya.", does: ["Menelusuri Audit Trail", "Memeriksa bukti dan versi laporan", "Akses baca saja"] },
] as const;

export const PRINCIPLES = [
  { title: "Data medis dan biaya dibatasi", body: "Diagnosis MCU hanya untuk HR dan HSE. Biaya kejadian hanya untuk fungsi yang berhak." },
  { title: "Tetap terbaca saat sinyal hilang", body: "Halaman yang pernah dibuka bisa dibaca offline, dan draf laporan tersimpan di HP." },
  { title: "Perubahan tercatat", body: "Siapa mengubah apa dan kapan ada di riwayat setiap dokumen." },
  { title: "Tenggat mengingatkan sendiri", body: "PICA, MCU, sertifikat, izin, dan dokumen diingatkan sebelum jatuh tempo." },
] as const;
