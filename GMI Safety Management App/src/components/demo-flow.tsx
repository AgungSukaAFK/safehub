import { useState } from "react"
import { Icon } from "./ui"

const steps = [
  {
    role: "Karyawan",
    page: "Lapor Kejadian",
    title: "Rudi melaporkan kejadian",
    detail: "Isi Lapor Kejadian dan kirim hingga muncul KJD-2026-0013.",
  },
  {
    role: "HSE",
    page: "KJD-2026-0013",
    title: "HSE melakukan klasifikasi",
    detail: "Buka tab Klasifikasi & Dampak untuk melengkapi data awal.",
  },
  {
    role: "HSE",
    page: "KJD-2026-0013",
    title: "Investigasi & tindakan",
    detail: "Tinjau Investigasi dan Analisis Penyebab, lalu jadikan tindakan.",
  },
  {
    role: "Pengawas",
    page: "Tugas Saya",
    title: "Fajar mengunggah bukti",
    detail: "Buka tugas tindakan dan unggah bukti penyelesaian.",
  },
  {
    role: "HSE",
    page: "TMN-2026-0087",
    title: "HSE memverifikasi",
    detail: "Beri komentar lalu pilih Terima agar tindakan Closed.",
  },
  {
    role: "PJO",
    page: "KJD-2026-0013",
    title: "PJO menyetujui",
    detail: "Buka Review & Persetujuan untuk keputusan manajemen.",
  },
  {
    role: "PJO",
    page: "Dashboard",
    title: "Dashboard diperbarui",
    detail: "Tinjau perubahan status kejadian dan donut PICA.",
  },
  {
    role: "HSE",
    page: "Workspace Laporan PJO",
    title: "Laporan diajukan",
    detail: "Periksa kelengkapan 92% dan pilih Ajukan.",
  },
  {
    role: "PJO",
    page: "Laporan Agustus 2026",
    title: "Laporan diterbitkan",
    detail: "Lihat snapshot terkunci beserta versi dan approver.",
  },
]

export default function DemoFlow({
  onRole,
  onNavigate,
}: {
  onRole: (role: string) => void
  onNavigate: (page: string) => void
}) {
  const [step, setStep] = useState(0)
  const [hidden, setHidden] = useState(false)

  function openStep(index: number) {
    const next = steps[index]
    setStep(index)
    onRole(next.role)
    onNavigate(next.page)
  }

  if (hidden) {
    return (
      <button
        className="demo-helper-restore"
        onClick={() => setHidden(false)}
        title="Tampilkan alur demo"
      >
        <Icon name="help" size={18} />
      </button>
    )
  }

  const current = steps[step]
  return (
    <aside className="demo-helper">
      <header>
        <div>
          <span>LANGKAH DEMO {step + 1}/9</span>
          <strong>{current.title}</strong>
        </div>
        <button onClick={() => setHidden(true)} aria-label="Sembunyikan helper">
          <Icon name="x" size={15} />
        </button>
      </header>
      <p>{current.detail}</p>
      <footer>
        <button disabled={step === 0} onClick={() => openStep(step - 1)}>
          Sebelumnya
        </button>
        <button
          className="demo-next"
          onClick={() => openStep(step === steps.length - 1 ? 0 : step + 1)}
        >
          {step === steps.length - 1 ? "Ulangi demo" : "Berikutnya"}{" "}
          <Icon name="arrow-right" size={14} />
        </button>
      </footer>
    </aside>
  )
}
