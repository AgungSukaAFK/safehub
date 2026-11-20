import { useMemo, useState, type ReactNode } from "react"
import { Button, Field, Icon, IconButton, StatusBadge } from "./ui"

type Props = { page: string onNavigate: (page: string) => void }

const typeMeta = [
  ["Inspeksi Padlock", "blue"],
  ["Inspeksi LV", "teal"],
  ["Inspeksi Peralatan Kerja", "amber"],
  ["Inspeksi Kotak P3K & APAR", "purple"],
  ["Observasi Maintenance", "slate"],
  ["Audit Internal", "red"],
] as const

const events = [
  [1, "Inspeksi Padlock", "Workshop Service", "08:00"],
  [3, "Inspeksi LV", "Area Parkir", "09:30"],
  [5, "Inspeksi Kotak P3K & APAR", "Office GMI", "08:30"],
  [7, "Observasi Maintenance", "Workshop Service", "13:00"],
  [9, "Inspeksi Peralatan Kerja", "Warehouse", "10:00"],
  [12, "Inspeksi LV", "Pit Area", "08:00"],
  [14, "Audit Internal", "Office GMI", "09:00"],
  [16, "Inspeksi Padlock", "Workshop Service", "14:00"],
  [19, "Inspeksi Kotak P3K & APAR", "Workshop Service", "08:00"],
  [21, "Observasi Maintenance", "Pit Area", "11:00"],
  [23, "Inspeksi LV", "Hauling Road", "07:30"],
  [26, "Inspeksi Peralatan Kerja", "Workshop Service", "09:00"],
  [28, "Inspeksi Kotak P3K & APAR", "Warehouse", "13:30"],
  [30, "Audit Internal", "Workshop Service", "08:30"],
] as const

function Calendar({ onOpen }: { onOpen: () => void }) {
  const leading = 4
  const days = Array.from({ length: 35 }, (_, index) => index - leading + 1)
  return (
    <div className="inspection-calendar">
      <div className="calendar-weekdays">
        {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="calendar-grid">
        {days.map((day, index) => {
          const dayEvents = events.filter((event) => event[0] === day)
          return (
            <div
              key={index}
              className={`${day < 1 || day > 31 ? "is-outside" : ""} ${
                day === 31 ? "is-today" : ""
              }`}
            >
              <span>{day < 1 ? 30 + day : day > 31 ? day - 31 : day}</span>
              {dayEvents.map((event) => {
                const tone =
                  typeMeta.find((item) => item[0] === event[1])?.[1] || "blue"
                return (
                  <button
                    key={event[1]}
                    className={`event-${tone}`}
                    onClick={onOpen}
                  >
                    <i /> <strong>{event[3]}</strong> {event[1]}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ScheduleList({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="schedule-table">
      <table>
        <thead>
          <tr>
            <th>Tanggal</th>
            <th>Jenis</th>
            <th>Lokasi</th>
            <th>Waktu</th>
            <th>Pemeriksa</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {events.map(([day, type, location, time], index) => (
            <tr key={`${day}-${type}`} onClick={onOpen}>
              <td>{day} Okt 2026</td>
              <td>
                <span
                  className={`type-dot event-${typeMeta.find((item) => item[0] === type)?.[1]}`}
                />
                {type}
              </td>
              <td>{location}</td>
              <td>{time} WIB</td>
              <td>{index % 2 ? "Fajar Nugroho" : "Andi Pratama"}</td>
              <td>
                <StatusBadge tone={day < 31 ? "success" : "info"}>
                  {day < 31 ? "Selesai" : "Terjadwal"}
                </StatusBadge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PlanActual() {
  const items = [
    ["Inspeksi Padlock", 4, 4],
    ["Inspeksi LV", 8, 6],
    ["Peralatan Kerja", 6, 5],
    ["Kotak P3K & APAR", 4, 4],
    ["Observasi Maintenance", 8, 7],
    ["Audit Internal", 2, 1],
  ] as const
  return (
    <aside className="plan-panel">
      <header>
        <h2>Rencana vs Aktual Bulan Ini</h2>
        <span>Oktober 2026</span>
      </header>
      <div>
        {items.map(([label, plan, actual]) => (
          <article key={label}>
            <div>
              <span>{label}</span>
              <strong className={actual < plan ? "is-behind" : ""}>
                {actual}/{plan}
              </strong>
            </div>
            <div className="plan-track">
              <i style={{ width: `${(actual / plan) * 100}%` }} />
            </div>
            <small>
              {actual === plan
                ? "Tercapai"
                : `${plan - actual} kegiatan tertinggal`}
            </small>
          </article>
        ))}
      </div>
      <footer>
        <div>
          <strong>27</strong>
          <span>Aktual</span>
        </div>
        <div>
          <strong>32</strong>
          <span>Rencana</span>
        </div>
        <div>
          <strong>84%</strong>
          <span>Pencapaian</span>
        </div>
      </footer>
    </aside>
  )
}

function SchedulePage({ onNavigate }: Pick<Props, "onNavigate">) {
  const [mode, setMode] = useState<"Kalender" | "Daftar">("Kalender")
  const [modal, setModal] = useState(false)
  return (
    <section className="page inspection-page">
      <div className="page-heading">
        <div>
          <p className="overline">K3LH</p>
          <h1>Inspeksi & Observasi</h1>
          <p>Rencanakan dan pantau pelaksanaan inspeksi Site MIFA.</p>
        </div>
        <Button className="create-button" onClick={() => setModal(true)}>
          <Icon name="plus" size={16} />
          Jadwalkan Inspeksi
        </Button>
      </div>
      <div className="inspection-toolbar">
        <div>
          <Button>
            <Icon name="arrow-right" size={15} />
          </Button>
          <strong>Oktober 2026</strong>
          <Button>
            <Icon name="arrow-right" size={15} />
          </Button>
          <button className="today-button">Hari ini</button>
        </div>
        <div className="calendar-legend">
          {typeMeta.map(([label, tone]) => (
            <span key={label}>
              <i className={`event-${tone}`} />
              {label}
            </span>
          ))}
        </div>
        <div className="view-toggle">
          <button
            className={mode === "Kalender" ? "is-active" : ""}
            onClick={() => setMode("Kalender")}
          >
            <Icon name="calendar" size={14} />
            Kalender
          </button>
          <button
            className={mode === "Daftar" ? "is-active" : ""}
            onClick={() => setMode("Daftar")}
          >
            <Icon name="menu" size={14} />
            Daftar
          </button>
        </div>
      </div>
      <div className="inspection-layout">
        <main>
          {mode === "Kalender" ? (
            <Calendar onOpen={() => onNavigate("Checklist Inspeksi")} />
          ) : (
            <ScheduleList onOpen={() => onNavigate("Checklist Inspeksi")} />
          )}
        </main>
        <PlanActual />
      </div>
      <button
        className="inspection-list-link"
        onClick={() => setMode("Daftar")}
      >
        Lihat seluruh inspeksi & observasi →
      </button>
      {modal && <ScheduleModal onClose={() => setModal(false)} />}
    </section>
  )
}

function ScheduleModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-layer">
      <button
        className="modal-backdrop"
        onClick={onClose}
        aria-label="Tutup modal"
      />
      <section className="schedule-modal">
        <header>
          <div>
            <p className="overline">JADWAL BARU</p>
            <h2>Jadwalkan Inspeksi</h2>
          </div>
          <IconButton label="Tutup" onClick={onClose}>
            <Icon name="x" />
          </IconButton>
        </header>
        <div>
          <label className="select-field">
            <span>Jenis inspeksi</span>
            <select>
              <option>Inspeksi Kotak P3K & APAR</option>
              {typeMeta.map(([type]) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          <label className="select-field">
            <span>Lokasi</span>
            <select>
              <option>Workshop Service</option>
              <option>Pit Area</option>
              <option>Warehouse</option>
              <option>Office GMI</option>
            </select>
          </label>
          <label className="native-field">
            <span>Tanggal & waktu</span>
            <input type="datetime-local" defaultValue="2026-11-02T08:00" />
          </label>
          <label className="select-field">
            <span>Pemeriksa</span>
            <select>
              <option>Andi Pratama · HSE</option>
              <option>Fajar Nugroho · Pengawas</option>
            </select>
          </label>
        </div>
        <footer>
          <Button className="back-button" onClick={onClose}>
            Batal
          </Button>
          <Button className="primary-button" onClick={onClose}>
            Simpan Jadwal
          </Button>
        </footer>
      </section>
    </div>
  )
}

const questions = [
  "APAR tersedia pada lokasi yang telah ditentukan dan mudah dijangkau.",
  "Nomor identifikasi APAR sesuai dengan register peralatan.",
  "Pin pengaman dan segel APAR terpasang dalam kondisi baik.",
  "Tekanan pada pressure gauge berada di area hijau.",
  "Selang dan nozzle APAR tidak retak, tersumbat, atau rusak.",
  "Tabung APAR tidak berkarat, penyok, atau mengalami kerusakan fisik.",
  "Label instruksi penggunaan terlihat dan dapat dibaca dengan jelas.",
  "Tanggal inspeksi bulanan sebelumnya telah dicatat pada tag.",
  "Masa berlaku dan jadwal hydrotest APAR masih aktif.",
  "Area di sekitar APAR bebas dari material yang menghalangi akses.",
  "Bracket atau dudukan APAR terpasang kuat.",
  "Rambu lokasi APAR terlihat dari jarak yang memadai.",
  "Kotak P3K tersedia dan mudah diakses.",
  "Daftar isi perlengkapan P3K tersedia dan terbaru.",
  "Obat dan perlengkapan P3K belum melewati tanggal kedaluwarsa.",
  "Jumlah perlengkapan P3K sesuai dengan daftar minimum.",
  "Kotak P3K dalam kondisi bersih dan tidak rusak.",
  "Nama petugas P3K dan nomor darurat terpasang di dekat kotak.",
]

function ChecklistPage({ onNavigate }: Pick<Props, "onNavigate">) {
  const initial = Object.fromEntries(
    questions
      .slice(0, 12)
      .map((_, index) => [
        index,
        index === 3 || index === 8
          ? "Tidak Sesuai"
          : index === 10
            ? "N/A"
            : "Sesuai",
      ]),
  )
  const [answers, setAnswers] = useState<Record<number, string>>(initial)
  const [findings, setFindings] = useState<Record<number, boolean>>({
    3: true,
    8: true,
  })
  const [submitted, setSubmitted] = useState(false)
  const answered = Object.keys(answers).length
  const counts = useMemo(
    () => ({
      sesuai: Object.values(answers).filter((item) => item === "Sesuai").length,
      tidak: Object.values(answers).filter((item) => item === "Tidak Sesuai")
        .length,
      na: Object.values(answers).filter((item) => item === "N/A").length,
    }),
    [answers],
  )
  if (submitted)
    return <ChecklistSummary counts={counts} onNavigate={onNavigate} />
  return (
    <section className="page checklist-page">
      <header className="checklist-header">
        <button
          className="record-back"
          onClick={() => onNavigate("Inspeksi & Observasi")}
        >
          <Icon name="arrow-right" size={15} />
          Kembali
        </button>
        <div>
          <div>
            <p className="overline">INS-2026-0234</p>
            <h1>Inspeksi Kotak P3K & APAR</h1>
          </div>
          <StatusBadge tone="info">In Progress</StatusBadge>
        </div>
        <dl>
          <div>
            <dt>Lokasi</dt>
            <dd>Workshop Service</dd>
          </div>
          <div>
            <dt>Objek</dt>
            <dd>APAR #07 · Workshop Service</dd>
          </div>
          <div>
            <dt>Pemeriksa</dt>
            <dd>Andi Pratama</dd>
          </div>
          <div>
            <dt>Tanggal</dt>
            <dd>31 Okt 2026, 08:30 WIB</dd>
          </div>
        </dl>
        <div className="checklist-progress">
          <div>
            <span>Progres checklist</span>
            <strong>{answered}/18 butir</strong>
          </div>
          <i>
            <b style={{ width: `${(answered / 18) * 100}%` }} />
          </i>
        </div>
      </header>
      <main className="checklist-items">
        {questions.map((question, index) => (
          <ChecklistItem
            key={question}
            number={index + 1}
            question={question}
            answer={answers[index] || ""}
            finding={!!findings[index]}
            onAnswer={(answer) => {
              setAnswers((current) => ({ ...current, [index]: answer }))
              if (answer !== "Tidak Sesuai")
                setFindings((current) => ({ ...current, [index]: false }))
            }}
            onFinding={(value) =>
              setFindings((current) => ({ ...current, [index]: value }))
            }
          />
        ))}
      </main>
      <footer className="checklist-footer">
        <span>Draf tersimpan otomatis · 08:47</span>
        <div>
          <Button className="draft-button">Simpan Draf</Button>
          <Button className="primary-button" onClick={() => setSubmitted(true)}>
            Selesai & Kirim
          </Button>
        </div>
      </footer>
    </section>
  )
}

function ChecklistItem({
  number,
  question,
  answer,
  finding,
  onAnswer,
  onFinding,
}: {
  number: number
  question: string
  answer: string
  finding: boolean
  onAnswer: (answer: string) => void
  onFinding: (value: boolean) => void
}) {
  const [comment, setComment] = useState("")
  const [photo, setPhoto] = useState(false)
  return (
    <article
      className={`checklist-item ${
        answer === "Tidak Sesuai" ? "is-noncompliant" : ""
      }`}
    >
      <header>
        <span>{number}</span>
        <p>{question}</p>
        <div className="answer-segments">
          {["Sesuai", "Tidak Sesuai", "N/A"].map((option) => (
            <button
              key={option}
              className={
                answer === option
                  ? `is-selected ${
                      option === "Tidak Sesuai" ? "is-danger" : ""
                    }`
                  : ""
              }
              onClick={() => onAnswer(option)}
            >
              {option === "Sesuai" && <Icon name="check" size={14} />}
              {option === "Tidak Sesuai" && <Icon name="x" size={14} />}
              {option}
            </button>
          ))}
        </div>
      </header>
      <div className="checklist-item-tools">
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Tambahkan komentar (opsional)"
        />
        <button
          className={photo ? "has-photo" : ""}
          onClick={() => setPhoto(true)}
        >
          <Icon name={photo ? "check" : "camera"} size={17} />
          {photo ? "Foto ditambahkan" : "Ambil foto"}
        </button>
      </div>
      {answer === "Tidak Sesuai" && (
        <div className="inline-finding">
          <label className="finding-toggle">
            <span>
              <strong>Jadikan Temuan</strong>
              <small>Buat tindak lanjut dari butir yang tidak sesuai.</small>
            </span>
            <input
              type="checkbox"
              checked={finding}
              onChange={(e) => onFinding(e.target.checked)}
            />
            <i />
          </label>
          {finding && (
            <div>
              <Field
                label="Uraian"
                defaultValue={`Ketidaksesuaian pada APAR #07: ${question}`}
              />
              <label className="select-field">
                <span>Prioritas</span>
                <select defaultValue="Tinggi">
                  <option>Rendah</option>
                  <option>Sedang</option>
                  <option>Tinggi</option>
                  <option>Kritis</option>
                </select>
              </label>
              <label className="select-field">
                <span>PIC</span>
                <select>
                  <option>Fajar Nugroho</option>
                  <option>Andi Pratama</option>
                  <option>Hendra Wijaya</option>
                </select>
              </label>
              <label className="native-field">
                <span>Due Date</span>
                <input type="date" defaultValue="2026-11-07" />
              </label>
            </div>
          )}
        </div>
      )}
    </article>
  )
}

function ChecklistSummary({
  counts,
  onNavigate,
}: {
  counts: { sesuai: number tidak: number na: number }
  onNavigate: (page: string) => void
}) {
  return (
    <section className="checklist-summary">
      <div className="success-check">
        <Icon name="check" size={32} />
      </div>
      <p className="overline">INS-2026-0234</p>
      <h1>Inspeksi berhasil dikirim</h1>
      <p>
        Hasil inspeksi telah tercatat dan notifikasi dikirim kepada PIC terkait.
      </p>
      <div className="summary-counts">
        <div>
          <strong>{counts.sesuai}</strong>
          <span>Sesuai</span>
        </div>
        <div className="is-danger">
          <strong>{counts.tidak}</strong>
          <span>Tidak Sesuai</span>
        </div>
        <div>
          <strong>{counts.na}</strong>
          <span>N/A</span>
        </div>
      </div>
      <div className="created-findings">
        <Icon name="clipboard" size={21} />
        <p>
          <strong>2 temuan dibuat</strong>
          <span>TMN-2026-0092 · TMN-2026-0093</span>
        </p>
      </div>
      <div className="summary-actions">
        <Button
          className="primary-button"
          onClick={() => onNavigate("Inspeksi & Observasi")}
        >
          Kembali ke Jadwal
        </Button>
        <Button
          className="secondary-button"
          onClick={() => onNavigate("Temuan & PICA")}
        >
          Lihat Temuan
        </Button>
      </div>
    </section>
  )
}

function ObservationPage({ onNavigate }: Pick<Props, "onNavigate">) {
  const [type, setType] = useState<"KTA" | "TTA">("KTA")
  const [followup, setFollowup] = useState(false)
  const [photo, setPhoto] = useState(false)
  const [sent, setSent] = useState(false)
  if (sent)
    return (
      <section className="observation-success">
        <div className="success-check">
          <Icon name="check" size={32} />
        </div>
        <h1>Observasi terkirim</h1>
        <strong>OBS-2026-0521</strong>
        <p>
          {followup
            ? "Temuan TMN-2026-0094 dibuat untuk tindak lanjut."
            : "Terima kasih telah berkontribusi menjaga keselamatan kerja."}
        </p>
        <Button
          className="primary-button"
          onClick={() => onNavigate("Dashboard")}
        >
          Kembali ke Dashboard
        </Button>
      </section>
    )
  return (
    <section className="page observation-page">
      <header>
        <button className="record-back" onClick={() => onNavigate("Dashboard")}>
          <Icon name="arrow-right" size={15} />
          Kembali
        </button>
        <p className="overline">LAPOR CEPAT</p>
        <h1>Observasi KTA/TTA</h1>
        <p>Catat kondisi atau tindakan tidak aman yang Anda temukan.</p>
      </header>
      <main>
        <div className="observation-type">
          <button
            className={type === "KTA" ? "is-active" : ""}
            onClick={() => setType("KTA")}
          >
            <span>
              <Icon name="building" size={22} />
            </span>
            <div>
              <strong>KTA</strong>
              <small>Kondisi Tidak Aman</small>
            </div>
          </button>
          <button
            className={type === "TTA" ? "is-active" : ""}
            onClick={() => setType("TTA")}
          >
            <span>
              <Icon name="user" size={22} />
            </span>
            <div>
              <strong>TTA</strong>
              <small>Tindakan Tidak Aman</small>
            </div>
          </button>
        </div>
        <label className="select-field">
          <span>Lokasi *</span>
          <select>
            <option value="">Pilih lokasi</option>
            <option>Workshop Service</option>
            <option>Pit Area</option>
            <option>Hauling Road</option>
            <option>Warehouse</option>
          </select>
        </label>
        <label className="textarea-field">
          <span>Uraian *</span>
          <textarea
            placeholder={`Jelaskan ${
              type === "KTA" ? "kondisi" : "tindakan"
            } tidak aman yang diamati`}
          />
        </label>
        <button
          className={`observation-camera ${photo ? "has-photo" : ""}`}
          onClick={() => setPhoto(true)}
        >
          <Icon name={photo ? "check" : "camera"} size={24} />
          <span>
            <strong>
              {photo ? "Foto berhasil ditambahkan" : "Ambil Foto"}
            </strong>
            <small>
              {photo ? "Foto_observasi_01.jpg" : "Gunakan kamera perangkat"}
            </small>
          </span>
        </button>
        <label className="textarea-field">
          <span>Tindakan langsung yang diambil</span>
          <textarea placeholder="Contoh: menghentikan pekerjaan dan memasang barricade" />
        </label>
        <label className="emergency-toggle observation-followup">
          <span>
            <strong>Perlu tindak lanjut?</strong>
            <small>Aktifkan untuk membuat temuan dan menugaskan PIC.</small>
          </span>
          <input
            type="checkbox"
            checked={followup}
            onChange={(e) => setFollowup(e.target.checked)}
          />
          <i />
        </label>
        {followup && (
          <div className="observation-followup-fields">
            <label className="select-field">
              <span>Prioritas</span>
              <select>
                <option>Sedang</option>
                <option>Tinggi</option>
                <option>Kritis</option>
              </select>
            </label>
            <label className="select-field">
              <span>PIC</span>
              <select>
                <option>Fajar Nugroho</option>
                <option>Andi Pratama</option>
              </select>
            </label>
          </div>
        )}
      </main>
      <footer>
        <Button className="primary-button" onClick={() => setSent(true)}>
          Kirim
        </Button>
      </footer>
    </section>
  )
}

export default function InspectionManagement({ page, onNavigate }: Props) {
  if (page === "Checklist Inspeksi")
    return <ChecklistPage onNavigate={onNavigate} />
  if (page === "Observasi KTA/TTA")
    return <ObservationPage onNavigate={onNavigate} />
  return <SchedulePage onNavigate={onNavigate} />
}
