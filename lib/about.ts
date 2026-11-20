// Isi halaman Tentang App (frontend-guide §20.2). DIISI PER APP: komponennya dari boilerplate,
// teks di sini. Versi TIDAK ditulis di sini: selalu dari post Pembaruan terbaru.
// Nilai di bawah adalah CONTOH boilerplate (alur Pengajuan); ganti saat app punya modul asli.
import {
  BellRing,
  ClipboardCheck,
  FileSpreadsheet,
  FileText,
  FolderSearch,
  Headset,
  History,
  Inbox,
  type LucideIcon,
  MessageSquareHeart,
  Printer,
  Send,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserCog,
  UserPen,
  Users,
  Workflow,
  BookOpen,
} from "lucide-react";
import { APP_NAME } from "@/lib/app-config";

type Item = { icon: LucideIcon; title: string; desc: string };

export const ABOUT = {
  appName: APP_NAME,
  /** pemilik/pengguna app (kalimat di hero & footer) */
  organization: "Lourdes Auto Parts, PT. Garuda Mart Indonesia & PT. Global Inti Sejati",
  /** badge di hero (modul utama) */
  badges: ["Pengajuan", "Approval"],
  headline: { lead: "Pengajuan dan persetujuan yang", accent: "cepat, jelas, dan tercatat." },
  description: "membantu tim mengajukan kebutuhan, menyetujuinya berjenjang, dan melacak statusnya dari satu tempat.",
  stats: [
    { icon: Workflow, value: "5", label: "Tahap alur pengajuan" },
    { icon: BellRing, value: "Real-time", label: "Notifikasi & status" },
    { icon: ShieldCheck, value: "Berjenjang", label: "Approval terstruktur" },
    { icon: History, value: "Lengkap", label: "Riwayat setiap perubahan" },
  ],
  features: [
    { icon: FileText, title: "Pengajuan", desc: "Buat pengajuan dengan daftar barang, lampiran, dan panel Ringkasan yang menuntun.", points: ["Draft tersimpan di perangkat", "Nomor otomatis saat diajukan", "Lampiran file & link"] },
    { icon: ClipboardCheck, title: "Approval", desc: "Persetujuan berjenjang sesuai template, dengan follow-up dan alasan penolakan.", points: ["Antrian Approval Saya", "Follow-up ke approver", "Jalur approval terlihat jelas"] },
    { icon: Inbox, title: "Notifikasi", desc: "Kabar langsung saat ada yang perlu Anda kerjakan, di app maupun di HP.", points: ["Inbox & badge real-time", "Notifikasi HP (Web Push)", "Suara bisa diatur"] },
    { icon: FileSpreadsheet, title: "Laporan & cetak", desc: "Unduh Excel sesuai filter dan cetak dokumen resmi dengan kop perusahaan.", points: ["Excel = isi tabel", "Cetak dengan QR verifikasi", "Nama file otomatis"] },
    { icon: FolderSearch, title: "Cari & lacak", desc: "Temukan dokumen dari mana saja dan lihat riwayat setiap perubahan.", points: ["Pencarian global (Ctrl+K)", "Filter & urutan tersimpan di URL", "Riwayat aktivitas lama → baru"] },
    { icon: Headset, title: "Bantuan & masukan", desc: "Tanya admin langsung dan kirim saran tanpa keluar dari app.", points: ["Bantuan Admin real-time", "Feedback dengan screenshot", "Catatan Pembaruan"] },
  ],
  stages: [
    { icon: UserPen, title: "Buat", desc: "Pemohon mengisi pengajuan, simpan sebagai draft kapan saja." },
    { icon: Send, title: "Ajukan", desc: "Nomor dibuat otomatis dan approver pertama diberi tahu." },
    { icon: UserCheck, title: "Diperiksa", desc: "Kepala departemen memeriksa, bisa menolak dengan alasan." },
    { icon: ShieldCheck, title: "Disetujui", desc: "Approver terakhir menyetujui; pemohon mendapat kabar." },
    { icon: Printer, title: "Cetak & arsip", desc: "Dokumen dicetak dengan QR dan riwayatnya tersimpan." },
  ],
  roles: [
    { icon: UserPen, title: "Pemohon (Editor)", desc: "Membuat dan mengubah pengajuan, mengajukan, dan menarik kembali bila perlu." },
    { icon: UserCheck, title: "Approver", desc: "Memeriksa dan menyetujui atau menolak dokumen yang ditugaskan kepadanya." },
    { icon: Users, title: "Viewer", desc: "Melihat data sesuai perusahaannya dan memproses approval yang ditugaskan." },
    { icon: UserCog, title: "Admin app", desc: "Mengatur akses, template approval, kepala departemen, Pembaruan, dan Bantuan." },
  ],
  before: [
    { icon: FileText, title: "Formulir kertas & chat", desc: "Pengajuan tersebar di kertas, chat, dan spreadsheet sehingga mudah terselip." },
    { icon: History, title: "Status tidak jelas", desc: "Pemohon harus bertanya ke sana-sini untuk tahu pengajuannya sampai mana." },
    { icon: ClipboardCheck, title: "Approval tidak tercatat", desc: "Sulit menelusuri siapa menyetujui apa dan kapan." },
  ] satisfies Item[],
  after: [
    { icon: Workflow, title: "Satu alur yang sama", desc: "Setiap pengajuan melewati tahapan yang jelas dan terlihat semua pihak." },
    { icon: BellRing, title: "Kabar otomatis", desc: "Approver dan pemohon diberi tahu tepat saat giliran mereka." },
    { icon: History, title: "Jejak lengkap", desc: "Setiap perubahan dan keputusan tercatat beserta waktunya." },
  ] satisfies Item[],
  closing: "Satu sistem, satu alur, satu sumber data.",
  help: [
    { icon: BookOpen, title: "Dokumentasi", desc: "Panduan langkah demi langkah", href: "/dokumentasi" },
    { icon: Headset, title: "Bantuan Admin", desc: "Tanya langsung ke admin app", href: "/bantuan" },
    { icon: MessageSquareHeart, title: "Feedback", desc: "Laporkan bug atau beri saran", href: "/feedback" },
    { icon: Sparkles, title: "Pembaruan", desc: "Lihat apa yang baru", href: "/pembaruan" },
  ],
};

/** Deskripsi per perusahaan di section grup (kode → kalimat). Perusahaan lain memakai nama saja. */
export const COMPANY_BLURB: Record<string, string> = {
  LOURDES: "Brand suku cadang otomotif yang menjadi wajah operasional grup, didukung GMI dan GIS.",
  GMI: "PT. Garuda Mart Indonesia, salah satu entitas grup yang memakai app ini.",
  GIS: "PT. Global Inti Sejati, salah satu entitas grup yang memakai app ini.",
};
