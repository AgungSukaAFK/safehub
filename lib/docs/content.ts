// Isi Dokumentasi. DIISI PER APP. Nilai di bawah adalah CONTOH boilerplate: alur Pengajuan (hapus /
// ganti bersama contoh Pengajuan), Bantuan Admin, dan pengaturan admin (modul dasar, tetap relevan).
import {
  BellRing,
  CheckCheck,
  ClipboardCheck,
  Cpu,
  FilePen,
  Headset,
  KeyRound,
  MessageSquare,
  Paperclip,
  Printer,
  RotateCcw,
  Route,
  Send,
  Sparkles,
  UserCheck,
  UserCog,
  UserPen,
  Users,
} from "lucide-react";
import type { DocsContent } from "./types";

export const DOCS: DocsContent = {
  intro: {
    title: "Panduan memakai app",
    desc: "Pilih peran Anda untuk menyorot langkah yang Anda kerjakan. Setiap alur bisa diputar sebagai animasi atau dibaca sebagai teks.",
  },

  roles: [
    {
      id: "pemohon",
      label: "Pemohon",
      pick: "Saya Pemohon",
      desc: "Membuat, mengajukan, dan memantau pengajuan.",
      icon: UserPen,
      color: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/40 dark:text-sky-300 dark:border-sky-800",
      selectable: true,
    },
    {
      id: "approver",
      label: "Approver",
      pick: "Saya Approver",
      desc: "Memeriksa dan menyetujui dokumen yang ditugaskan.",
      icon: UserCheck,
      color: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/40 dark:text-violet-300 dark:border-violet-800",
      selectable: true,
    },
    {
      id: "admin",
      label: "Admin",
      pick: "Saya Admin",
      desc: "Mengatur akses, template approval, dan menjawab Bantuan.",
      icon: UserCog,
      color: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-800",
      selectable: true,
    },
    {
      id: "sistem",
      label: "Sistem (otomatis)",
      desc: "Dikerjakan app tanpa perlu diklik.",
      icon: Cpu,
      color: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
    },
  ],

  journey: [
    { title: "Buat", desc: "Isi pengajuan & lampiran", icon: FilePen, flow: "pengajuan", step: 0 },
    { title: "Ajukan", desc: "Nomor otomatis, approver diberi tahu", icon: Send, flow: "pengajuan", step: 2 },
    { title: "Diputuskan", desc: "Disetujui atau ditolak berjenjang", icon: ClipboardCheck, flow: "pengajuan", step: 4 },
    { title: "Selesai", desc: "Cetak dengan QR, riwayat tersimpan", icon: Printer, flow: "pengajuan", step: 7 },
  ],

  flows: [
    {
      id: "pengajuan",
      title: "Alur Pengajuan",
      subtitle: "Dari draft sampai disetujui dan dicetak (contoh dokumen boilerplate).",
      steps: [
        {
          short: "Buat",
          title: "Buat pengajuan",
          icon: FilePen,
          actors: ["pemohon"],
          summary: "Isi judul, perusahaan, departemen, dan daftar barang. Panel Ringkasan di kanan menunjukkan apa yang masih kurang.",
          menu: "Pengajuan → Buat Pengajuan",
          details: [
            "Isian tersimpan otomatis sebagai draft di perangkat ini; kalau browser tertutup, app menawarkan untuk memulihkannya.",
            "Klik baris di panel Ringkasan untuk melompat ke isian yang belum lengkap.",
            "Simpan sebagai Draft kalau belum siap diajukan.",
          ],
          status: { map: "document", to: "draft" },
          tip: "Departemen menentukan siapa kepala departemen yang memeriksa, jadi sebaiknya diisi.",
          visual: {
            window: "Pengajuan Baru",
            blocks: [
              { kind: "field", label: "Judul", value: "Penggantian ban forklift gudang A", highlight: true },
              { kind: "field", label: "Departemen", value: "Gudang" },
              { kind: "row", title: "Ban forklift 6.50-10", sub: "4 pcs × Rp 1.250.000" },
              { kind: "buttons", items: [{ label: "Simpan sebagai Draft", variant: "outline" }, { label: "Simpan & Ajukan", pulse: true }] },
            ],
          },
        },
        {
          short: "Lampiran",
          title: "Lampirkan dokumen pendukung",
          icon: Paperclip,
          actors: ["pemohon"],
          summary: "Tambahkan penawaran, foto, atau link Google Drive di halaman detail pengajuan.",
          menu: "Pengajuan → (buka dokumen) → Lampiran",
          details: ["Seret file ke kotak unggah, klik untuk memilih, atau tempel screenshot (Ctrl+V).", "File besar sebaiknya dilampirkan sebagai link Drive."],
          visual: {
            window: "Lampiran",
            blocks: [
              { kind: "note", text: "Seret & lepas file, klik, atau tempel (Ctrl+V)" },
              { kind: "row", title: "penawaran-vendor.pdf", sub: "312 KB" },
              { kind: "row", title: "foto-ban-lama.webp", sub: "180 KB", highlight: true },
            ],
          },
        },
        {
          short: "Ajukan",
          title: "Ajukan untuk disetujui",
          icon: Send,
          actors: ["pemohon"],
          summary: "Nomor dokumen dibuat otomatis dan jalur approval disusun sesuai template.",
          details: ["Pengajuan yang sudah diajukan tidak bisa diubah, kecuali ditarik kembali selama belum selesai.", "Jalur Approval di halaman detail menunjukkan urutan approver."],
          status: { map: "document", from: "draft", to: "pending_approval" },
          visual: {
            window: "PJ/GMI/2611/0001",
            blocks: [
              { kind: "row", title: "PJ/GMI/2611/0001", sub: "Penggantian ban forklift gudang A", status: { map: "document", value: "pending_approval" }, highlight: true },
              { kind: "path", items: [{ label: "Kepala Dept.", state: "current" }, { label: "Finance", state: "todo" }] },
            ],
          },
        },
        {
          short: "Notifikasi",
          title: "Approver diberi tahu",
          icon: BellRing,
          actors: ["sistem"],
          summary: "Approver mendapat notifikasi di Inbox, suara, dan Notifikasi HP (kalau diaktifkan).",
          details: ["Badge Approval Saya di sidebar bertambah tanpa perlu memuat ulang.", "Aktifkan Notifikasi HP di Profil supaya kabar tetap sampai saat app ditutup."],
          visual: {
            window: "Inbox",
            blocks: [
              { kind: "notification", title: "Perlu persetujuan Anda", body: "PJ/GMI/2611/0001 · Penggantian ban forklift gudang A" },
              { kind: "row", title: "Approval Saya", sub: "1 dokumen menunggu", highlight: true },
            ],
          },
        },
        {
          short: "Putuskan",
          title: "Periksa & putuskan",
          icon: ClipboardCheck,
          actors: ["approver"],
          summary: "Buka dokumen dari Approval Saya, periksa isi dan lampiran, lalu setujui atau tolak dengan alasan.",
          menu: "Approval Saya",
          details: ["Menolak wajib menulis alasan (minimal 5 karakter) supaya pemohon tahu yang harus diperbaiki.", "Setelah Anda menyetujui, approver berikutnya diberi tahu otomatis."],
          status: { map: "approval", from: "pending", to: "approved" },
          visual: {
            window: "Tindakan",
            blocks: [
              { kind: "path", items: [{ label: "Kepala Dept.", state: "current" }, { label: "Finance", state: "todo" }] },
              { kind: "field", label: "Catatan (opsional)", value: "Sesuai kebutuhan gudang." },
              { kind: "buttons", items: [{ label: "Tolak", variant: "danger" }, { label: "Setujui", pulse: true }] },
            ],
          },
        },
        {
          short: "Follow-up",
          title: "Ingatkan approver (follow-up)",
          icon: MessageSquare,
          actors: ["pemohon"],
          summary: "Kalau approver belum memutuskan, kirim follow-up dari halaman detail. Approver mendapat pengingat.",
          details: ["Follow-up bisa dikirim lagi setelah 1 jam.", "Permintaan follow-up tampil merah di Beranda approver."],
          visual: {
            window: "Jalur Approval",
            blocks: [
              { kind: "path", items: [{ label: "Kepala Dept.", state: "done" }, { label: "Finance", state: "current" }] },
              { kind: "buttons", items: [{ label: "Follow-up", variant: "outline", pulse: true }] },
              { kind: "note", text: "Follow-up terkirim. Bisa dikirim lagi setelah 1 jam.", tone: "success" },
            ],
          },
        },
        {
          short: "Revisi",
          title: "Perbaiki lalu ajukan ulang",
          icon: RotateCcw,
          actors: ["pemohon"],
          summary: "Kalau ditolak, ubah pengajuan sesuai alasan penolakan lalu ajukan ulang. Approval dimulai dari awal (putaran baru).",
          details: ["Riwayat Aktivitas menyimpan nilai lama → baru setiap perubahan.", "Alasan penolakan tetap terlihat di Jalur Approval putaran sebelumnya."],
          status: { map: "document", from: "rejected", to: "pending_approval" },
          visual: {
            window: "Ubah PJ/GMI/2611/0001",
            blocks: [
              { kind: "note", text: "Ditolak Finance: harga belum termasuk ongkir.", tone: "warning" },
              { kind: "field", label: "Harga satuan", value: "Rp 1.320.000", highlight: true },
              { kind: "buttons", items: [{ label: "Simpan & Ajukan", pulse: true }] },
            ],
          },
        },
        {
          short: "Selesai",
          title: "Disetujui & dicetak",
          icon: Printer,
          actors: ["pemohon", "approver"],
          summary: "Setelah approver terakhir menyetujui, pemohon mendapat kabar. Dokumen bisa dicetak dengan QR verifikasi atau tanda tangan basah.",
          menu: "Pengajuan → (buka dokumen) → Cetak",
          details: ["Nama file PDF otomatis mengikuti nomor dokumen.", "QR di dokumen cetak bisa dipindai untuk memastikan keasliannya."],
          status: { map: "document", from: "pending_approval", to: "approved" },
          visual: {
            window: "PJ/GMI/2611/0001",
            blocks: [
              { kind: "row", title: "PJ/GMI/2611/0001", sub: "Disetujui Finance · baru saja", status: { map: "document", value: "approved" }, highlight: true },
              { kind: "path", items: [{ label: "Kepala Dept.", state: "done" }, { label: "Finance", state: "done" }] },
              { kind: "buttons", items: [{ label: "Cetak dengan QR", pulse: true }, { label: "Unduh Excel", variant: "outline" }] },
            ],
          },
        },
      ],
    },
    {
      id: "bantuan",
      title: "Minta bantuan admin",
      subtitle: "Ada kendala atau pertanyaan? Tanyakan langsung ke admin app ini.",
      steps: [
        {
          short: "Tanya",
          title: "Buka percakapan baru",
          icon: Headset,
          actors: ["pemohon", "approver"],
          summary: "Klik ikon headset di top bar → Buka Bantuan Admin → Percakapan Baru. Pilih kategori, tulis subjek dan pesan.",
          menu: "Top bar → Bantuan Admin",
          details: ["Halaman yang sedang Anda buka dan info perangkat ikut terkirim otomatis.", "Screenshot bisa langsung ditempel ke kotak pesan."],
          status: { map: "support", to: "menunggu" },
          visual: {
            window: "Percakapan Baru",
            blocks: [
              { kind: "field", label: "Kategori", value: "Error / bug" },
              { kind: "field", label: "Subjek", value: "Tombol simpan tidak merespon", highlight: true },
              { kind: "note", text: "Info yang ikut terkirim: halaman /pengajuan/baru · Chrome · 1366×768" },
              { kind: "buttons", items: [{ label: "Kirim", pulse: true }] },
            ],
          },
        },
        {
          short: "Balas",
          title: "Admin mengambil & membalas",
          icon: UserCog,
          actors: ["admin"],
          summary: "Admin melihat percakapan di Inbox Bantuan, mengambilnya, dan membalas. Balasan muncul langsung tanpa memuat ulang.",
          menu: "Admin → Inbox Bantuan",
          details: ["Admin bisa mengalihkan percakapan ke admin lain.", "Anda mendapat notifikasi setiap ada balasan."],
          status: { map: "support", from: "menunggu", to: "dibalas" },
          visual: {
            window: "Tombol simpan tidak merespon",
            blocks: [
              { kind: "chat", text: "Tombol simpan tidak merespon saat saya klik.", name: "Budi" },
              { kind: "chat", text: "Sudah kami perbaiki, silakan coba lagi ya.", mine: true },
            ],
          },
        },
        {
          short: "Selesai",
          title: "Tandai selesai",
          icon: CheckCheck,
          actors: ["pemohon", "approver", "admin"],
          summary: "Kalau masalah sudah beres, tandai percakapan selesai. Kirim pesan lagi kapan saja untuk membukanya kembali.",
          details: [],
          status: { map: "support", from: "dibalas", to: "selesai" },
          visual: { window: "Bantuan Admin", blocks: [{ kind: "row", title: "Tombol simpan tidak merespon", sub: "Error / bug", status: { map: "support", value: "selesai" }, highlight: true }] },
        },
      ],
    },
    {
      id: "admin",
      title: "Pengaturan admin",
      subtitle: "Hal yang disiapkan admin app supaya alur berjalan.",
      steps: [
        {
          short: "Akses",
          title: "Beri akses pengguna",
          icon: KeyRound,
          actors: ["admin"],
          summary: "Tambahkan karyawan yang boleh membuka app dan pilih role-nya: Viewer, Editor, atau Admin.",
          menu: "Admin → Pengguna & Akses",
          details: ["Akun baru dan reset password dibuat tim IT di konsol platform.", "Admin aktif terakhir tidak bisa diturunkan atau dicabut."],
          visual: {
            window: "Tambah Akses",
            blocks: [
              { kind: "field", label: "Karyawan", value: "Sari Wulandari (GIS)", highlight: true },
              { kind: "row", title: "Editor", sub: "Viewer + membuat dan mengubah data" },
              { kind: "buttons", items: [{ label: "Beri Akses", pulse: true }] },
            ],
          },
        },
        {
          short: "Template",
          title: "Atur template approval",
          icon: Route,
          actors: ["admin"],
          summary: "Tentukan langkah approval per jenis dokumen: siapa memeriksa dan siapa menyetujui, dengan batas waktu.",
          menu: "Admin → Template Approval",
          details: ["Pratinjau menunjukkan jalur yang akan terbentuk untuk contoh dokumen.", "Perubahan template tercatat di riwayat dan CCTV."],
          visual: {
            window: "Template: Pengajuan standar",
            blocks: [
              { kind: "path", items: [{ label: "Kepala Dept. · memeriksa", state: "done" }, { label: "Finance · menyetujui", state: "current" }] },
              { kind: "buttons", items: [{ label: "Simpan template", pulse: true }] },
            ],
          },
        },
        {
          short: "Kepala dept.",
          title: "Isi kepala departemen",
          icon: Users,
          actors: ["admin"],
          summary: "Template yang memakai kepala departemen butuh data ini per departemen dan perusahaan.",
          menu: "Admin → Kepala Departemen",
          details: ["Kombinasi yang dipakai template tapi belum diisi ditandai peringatan."],
          visual: {
            window: "Kepala Departemen",
            blocks: [
              { kind: "row", title: "Gudang · GMI", sub: "Andi Pratama" },
              { kind: "row", title: "Gudang · GIS", sub: "Belum diisi", highlight: true },
            ],
          },
        },
        {
          short: "Pembaruan",
          title: "Umumkan pembaruan",
          icon: Sparkles,
          actors: ["admin"],
          summary: "Tulis catatan rilis dengan versi baru. Semua pengguna melihat badge dan banner selama 7 hari.",
          menu: "Pembaruan → Tulis Pembaruan",
          details: ["Versi harus lebih besar dari versi terakhir.", "Gunakan Pratinjau untuk melihat tampilan persis seperti pengguna."],
          visual: {
            window: "Pembaruan Baru",
            blocks: [
              { kind: "field", label: "Versi", value: "1.3.0", highlight: true },
              { kind: "field", label: "Judul", value: "Ekspor Excel kini menyertakan filter" },
              { kind: "buttons", items: [{ label: "Pratinjau", variant: "outline" }, { label: "Terbitkan", pulse: true }] },
            ],
          },
        },
      ],
    },
  ],

  glossary: [
    {
      title: "Status dokumen",
      map: "document",
      items: [
        { value: "draft", desc: "Masih disusun pemohon, belum diajukan. Bisa diubah dan dihapus." },
        { value: "pending_approval", desc: "Sedang menunggu keputusan approver. Tidak bisa diubah kecuali ditarik." },
        { value: "approved", desc: "Sudah disetujui semua approver. Siap dicetak." },
        { value: "rejected", desc: "Ditolak approver dengan alasan. Pemohon bisa memperbaiki dan mengajukan ulang." },
        { value: "cancelled", desc: "Dibatalkan dan tidak diproses lagi." },
      ],
    },
    {
      title: "Langkah approval",
      map: "approval",
      items: [
        { value: "pending", desc: "Giliran approver ini memutuskan." },
        { value: "approved", desc: "Approver ini sudah menyetujui." },
        { value: "rejected", desc: "Approver ini menolak; alur berhenti di langkah ini." },
        { value: "skipped", desc: "Langkah dilewati (mis. diubah admin)." },
      ],
    },
    {
      title: "Bantuan Admin",
      map: "support",
      items: [
        { value: "menunggu", desc: "Menunggu balasan admin." },
        { value: "dibalas", desc: "Admin sudah membalas; giliran Anda." },
        { value: "selesai", desc: "Masalah selesai. Kirim pesan untuk membuka lagi." },
      ],
    },
    {
      title: "Feedback",
      map: "feedback",
      items: [
        { value: "baru", desc: "Baru masuk, belum dibaca admin." },
        { value: "diproses", desc: "Sedang ditindaklanjuti." },
        { value: "selesai", desc: "Sudah ditangani." },
      ],
    },
  ],

  faq: [
    { q: "Saya tidak melihat menu tertentu. Kenapa?", a: "Menu menyesuaikan role Anda di app ini (Viewer, Editor, Admin). Minta admin app mengubah role Anda lewat Bantuan Admin." },
    { q: "Isian form hilang saat browser tertutup?", a: "Tidak. Form menyimpan draft di perangkat ini secara otomatis. Saat form dibuka lagi, app menawarkan untuk memulihkannya." },
    { q: "Pengajuan saya sudah diajukan tapi ada yang salah.", a: "Tarik kembali pengajuan dari halaman detail selama belum selesai disetujui. Statusnya kembali menjadi Draft dan bisa diubah." },
    { q: "Bagaimana tahu pengajuan saya sampai di mana?", a: "Buka dokumennya: Jalur Approval menunjukkan approver yang sedang memutuskan, dan Riwayat Aktivitas mencatat setiap perubahan." },
    { q: "Notifikasi HP tidak muncul.", a: "Buka Profil → Notifikasi lalu aktifkan Notifikasi HP di perangkat itu. Di iPhone, pasang app ke Layar Utama terlebih dulu." },
    { q: "Saya tidak bisa melihat dokumen perusahaan lain.", a: "Setiap orang hanya melihat dokumen perusahaannya sendiri (dan dokumen grup). Ini disengaja." },
    { q: "Lupa password atau akun terkunci?", a: "Pakai Lupa password di halaman masuk, atau hubungi atasan / tim IT. Akun dikelola tim IT, bukan admin app." },
    { q: "Cara melaporkan bug?", a: "Buka menu Feedback, pilih Laporan Bug, ceritakan kejadiannya, dan tempel screenshot. Halaman asal dan info perangkat ikut terkirim otomatis." },
  ],
};

