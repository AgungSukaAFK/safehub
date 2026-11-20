import { Fragment, useState, type ReactNode } from "react"
import { Button, Field, Icon, IconButton, StatusBadge } from "./ui"

type Props = { onNavigate: (page: string) => void }
type Program = {
  no: string
  element: string
  program: string
  owner: string
  indicator: string
  evidence: string
  target: number
  actuals: number[]
  missing?: number
}

const programs: Program[] = [
  {
    no: "1.1",
    element: "1. Kebijakan",
    program: "Tinjauan Kebijakan",
    owner: "PJO",
    indicator: "Kebijakan ditinjau, dibuktikan daftar hadir dan notulen",
    evidence: "Jadwal Rapat Tinjauan Manajemen",
    target: 1,
    actuals: [0, 0, 0, 0, 0, 0, 0, 0, 1],
  },
  {
    no: "1.2",
    element: "1. Kebijakan",
    program: "Komunikasi Kebijakan SMT",
    owner: "All Departemen",
    indicator: "1x per bulan saat General Safety Talk",
    evidence: "Daftar Hadir dan Dokumentasi",
    target: 12,
    actuals: [1, 1, 1, 1, 1, 0, 1, 1, 1],
    missing: 5,
  },
  {
    no: "1.3",
    element: "1. Kebijakan",
    program: "Pemasangan Kebijakan SMT",
    owner: "All Departemen",
    indicator: "Kebijakan terpasang di area kerja dan office",
    evidence: "Foto Pemasangan",
    target: 12,
    actuals: [1, 1, 1, 1, 1, 1, 1, 1, 0],
  },
  {
    no: "2.1",
    element: "2. Perencanaan",
    program: "Review IBPR",
    owner: "All Departemen",
    indicator: "Review IBPR dilakukan 2x per tahun",
    evidence: "IBPR, Daftar Hadir, MOM",
    target: 2,
    actuals: [0, 0, 0, 1, 0, 0, 0, 0, 0],
  },
  {
    no: "2.1A",
    element: "2. Perencanaan",
    program: "Review Top 10 High Risk Activity",
    owner: "All Departemen",
    indicator: "Top 10 risiko tinggi diperbarui per semester",
    evidence: "Register Risiko dan MOM",
    target: 2,
    actuals: [0, 0, 1, 0, 0, 0, 0, 0, 0],
  },
  {
    no: "2.2",
    element: "2. Perencanaan",
    program: "Komunikasi dan Konsultasi Risiko",
    owner: "PJO",
    indicator: "Konsultasi risiko dengan seluruh bagian",
    evidence: "Daftar Hadir, Dokumentasi, MOM",
    target: 2,
    actuals: [0, 0, 0, 0, 1, 0, 0, 0, 0],
  },
  {
    no: "3.5",
    element: "3. Implementasi",
    program: "Kampanye K3",
    owner: "HSE",
    indicator: "Kampanye tematik dilaksanakan per kuartal",
    evidence: "Materi, Daftar Hadir, Dokumentasi",
    target: 4,
    actuals: [0, 0, 1, 0, 0, 1, 0, 0, 0],
  },
  {
    no: "3.7",
    element: "3. Implementasi",
    program: "Pelatihan Penggunaan APD",
    owner: "HSE",
    indicator: "Seluruh pekerja mengikuti refresh penggunaan APD",
    evidence: "Daftar Hadir dan Evaluasi",
    target: 2,
    actuals: [0, 0, 0, 1, 0, 0, 0, 0, 1],
    missing: 8,
  },
  {
    no: "3.8",
    element: "3. Implementasi",
    program: "Program Induksi SMT",
    owner: "HSE",
    indicator: "Induksi diberikan kepada pekerja baru dan visitor",
    evidence: "Form Induksi dan Dokumentasi",
    target: 12,
    actuals: [1, 1, 1, 1, 1, 1, 1, 0, 1],
  },
]

const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
]

function MonthCell({
  program,
  month,
  onOpen,
}: {
  program: Program
  month: number
  onOpen: () => void
}) {
  const future = month > 8
  const monthly = program.target >= 12
  const plan = future
    ? 1
    : monthly
      ? 1
      : program.actuals[month]
        ? 1
        : month === 8
          ? 1
          : 0
  const actual = program.actuals[month] ?? 0
  const missing = program.missing === month
  const state = future
    ? "future"
    : missing
      ? "missing"
      : actual >= plan && actual > 0
        ? "met"
        : actual > 0
          ? "partial"
          : plan > 0
            ? "missed"
            : "empty"
  return (
    <button
      className={`tsp-month-cell is-${state}`}
      onClick={onOpen}
      disabled={future}
    >
      <span>
        {actual}/{plan}
      </span>
      {missing && <Icon name="file" size={10} />}
    </button>
  )
}

function TspMatrix({
  onCell,
}: {
  onCell: (program: Program, month: number) => void
}) {
  const [collapsed, setCollapsed] = useState<string[]>([])
  const elements = [...new Set(programs.map((item) => item.element))]
  return (
    <div className="tsp-table-wrap">
      <table className="tsp-table">
        <thead>
          <tr>
            <th className="freeze-1">No</th>
            <th className="freeze-2">Program</th>
            <th className="freeze-3">Penanggung Jawab</th>
            <th>Indikator Pencapaian</th>
            <th>Bukti Wajib</th>
            <th>Target/Tahun</th>
            {months.map((month) => (
              <th className="month-heading" key={month}>
                {month}
              </th>
            ))}
            <th>Total</th>
            <th>Capaian %</th>
          </tr>
        </thead>
        <tbody>
          {elements.map((element) => {
            const rows = programs.filter((item) => item.element === element)
            const isCollapsed = collapsed.includes(element)
            return (
              <Fragment key={element}>
                {
                  <tr className="element-row">
                    <td colSpan={20}>
                      <button
                        onClick={() =>
                          setCollapsed((current) =>
                            current.includes(element)
                              ? current.filter((item) => item !== element)
                              : [...current, element],
                          )
                        }
                      >
                        <Icon name="chevron-down" size={14} />
                        <strong>{element}</strong>
                        <span>{rows.length} program</span>
                      </button>
                    </td>
                  </tr>
                }
                {!isCollapsed &&
                  rows.map((program) => {
                    const total = program.actuals.reduce(
                      (sum, value) => sum + value,
                      0,
                    )
                    const achievement = Math.min(
                      100,
                      Math.round((total / program.target) * 100),
                    )
                    return (
                      <tr key={program.no}>
                        <td className="freeze-1">{program.no}</td>
                        <td className="freeze-2">
                          <strong>{program.program}</strong>
                        </td>
                        <td className="freeze-3">
                          <span className="owner-cell">
                            <i>{program.owner.slice(0, 2).toUpperCase()}</i>
                            {program.owner}
                          </span>
                        </td>
                        <td>{program.indicator}</td>
                        <td>{program.evidence}</td>
                        <td className="number-cell">{program.target}</td>
                        {months.map((_, month) => (
                          <td className="month-data" key={month}>
                            <MonthCell
                              program={program}
                              month={month}
                              onOpen={() => onCell(program, month)}
                            />
                          </td>
                        ))}
                        <td className="number-cell">{total}</td>
                        <td>
                          <div className="tsp-achievement">
                            <strong
                              className={achievement < 80 ? "is-low" : ""}
                            >
                              {achievement}%
                            </strong>
                            <i>
                              <b style={{ width: `${achievement}%` }} />
                            </i>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

const images = [
  "https://images.unsplash.com/photo-1672954766589-49f0dd0e106f?auto=format&fit=crop&w=900&q=85",
  "https://images.unsplash.com/photo-1759922378222-47ad736a174d?auto=format&fit=crop&w=900&q=85",
  "https://images.unsplash.com/photo-1774599730788-edc1fe2489b2?auto=format&fit=crop&w=900&q=85",
]

const activities = [
  [
    "Safety Talk",
    "29 Sep 2026",
    "Workshop Service",
    "32 peserta",
    "1.2 · Komunikasi Kebijakan SMT",
    "Lengkap",
  ],
  [
    "Sosialisasi JSA",
    "24 Sep 2026",
    "Office GMI",
    "18 peserta",
    "2.2 · Komunikasi Risiko",
    "Lengkap",
  ],
  [
    "Sosialisasi IK",
    "18 Sep 2026",
    "Workshop Service",
    "21 peserta",
    "3.7 · Pelatihan APD",
    "Kurang Bukti",
  ],
  [
    "Sosialisasi SOP",
    "12 Sep 2026",
    "Warehouse",
    "14 peserta",
    "3.8 · Program Induksi SMT",
    "Lengkap",
  ],
  [
    "Kampanye K3",
    "08 Sep 2026",
    "Pit Area",
    "34 peserta",
    "3.5 · Kampanye K3",
    "Menunggu Review",
  ],
  [
    "Inspeksi Bersama",
    "03 Sep 2026",
    "Hauling Road",
    "8 peserta",
    "2.1 · Review IBPR",
    "Lengkap",
  ],
] as const

function Activities({ onAdd }: { onAdd: () => void }) {
  return (
    <section className="tsp-content-section">
      <header>
        <div>
          <h2>Aktivitas K3</h2>
          <p>
            Dokumentasi aktivitas keselamatan yang terhubung dengan program TSP.
          </p>
        </div>
        <Button className="create-button" onClick={onAdd}>
          <Icon name="plus" size={15} />
          Catat Aktivitas
        </Button>
      </header>
      <div className="activity-gallery">
        {activities.map(
          ([type, date, location, participants, program, status], index) => (
            <article key={`${type}-${date}`}>
              <img
                src={images[index % images.length]}
                alt={`Dokumentasi ${type}`}
              />
              <div>
                <div className="activity-card-title">
                  <strong>{type}</strong>
                  <StatusBadge
                    tone={
                      status === "Lengkap"
                        ? "success"
                        : status === "Kurang Bukti"
                          ? "warning"
                          : "verification"
                    }
                  >
                    {status}
                  </StatusBadge>
                </div>
                <p>
                  <Icon name="calendar" size={13} />
                  {date}
                  <span>·</span>
                  <Icon name="building" size={13} />
                  {location}
                </p>
                <p>
                  <Icon name="users" size={13} />
                  {participants}
                </p>
                <button className="program-chip">
                  <Icon name="arrow-right" size={12} />
                  {program}
                </button>
              </div>
            </article>
          ),
        )}
      </div>
    </section>
  )
}

function Evaluation() {
  const [submitted, setSubmitted] = useState(false)
  return (
    <section className="tsp-content-section evaluation-section">
      <header>
        <div>
          <h2>Evaluasi Bulanan</h2>
          <p>September 2026 · periode evaluasi terakhir</p>
        </div>
        <StatusBadge tone={submitted ? "verification" : "warning"}>
          {submitted ? "Menunggu Persetujuan PJO" : "Draft"}
        </StatusBadge>
      </header>
      <div className="evaluation-layout">
        <div className="evaluation-summary">
          <div>
            <span>Capaian bulan ini</span>
            <strong>84%</strong>
            <small>Target minimum 90%</small>
          </div>
          <div>
            <span>Program tercapai</span>
            <strong>18/22</strong>
            <small>4 program tertinggal</small>
          </div>
          <div>
            <span>Bukti lengkap</span>
            <strong>91%</strong>
            <small>2 bukti belum lengkap</small>
          </div>
        </div>
        <div className="lagging-programs">
          <h3>Program Tertinggal</h3>
          {[
            [
              "1.2 Komunikasi Kebijakan SMT",
              "Realisasi Juni belum dilengkapi daftar hadir.",
            ],
            [
              "1.3 Pemasangan Kebijakan SMT",
              "Dokumentasi September belum diunggah.",
            ],
            ["3.5 Kampanye K3", "Aktivitas Q3 bergeser ke awal Oktober."],
            [
              "3.8 Program Induksi SMT",
              "Induksi Agustus tidak terlaksana karena tidak ada pekerja baru.",
            ],
          ].map(([program, reason], index) => (
            <div key={program}>
              <span>{index + 1}</span>
              <p>
                <strong>{program}</strong>
                <small>{reason}</small>
              </p>
            </div>
          ))}
        </div>
        <div className="evaluation-approval">
          <h3>Persetujuan</h3>
          <div className="is-done">
            <span>
              <Icon name="check" size={14} />
            </span>
            <p>
              <strong>Disusun oleh HSE</strong>
              <small>Andi Pratama · 31 Okt 2026, 08:10 WIB</small>
            </p>
          </div>
          <div className={submitted ? "is-current" : ""}>
            <span>2</span>
            <p>
              <strong>Persetujuan PJO</strong>
              <small>
                {submitted ? "Menunggu Budi Santoso" : "Belum diajukan"}
              </small>
            </p>
          </div>
          <Button
            className="primary-button"
            disabled={submitted}
            onClick={() => setSubmitted(true)}
          >
            {submitted ? "Evaluasi Diajukan" : "Ajukan Evaluasi"}
          </Button>
        </div>
      </div>
    </section>
  )
}

function CellDrawer({
  program,
  month,
  onClose,
}: {
  program: Program
  month: number
  onClose: () => void
}) {
  const [uploaded, setUploaded] = useState(false)
  const actual = program.actuals[month] || 0
  return (
    <>
      <button
        className="drawer-backdrop"
        onClick={onClose}
        aria-label="Tutup drawer"
      />
      <aside className="tsp-drawer">
        <header>
          <div>
            <span>REALISASI PROGRAM TSP</span>
            <h2>{months[month]} 2026</h2>
          </div>
          <IconButton label="Tutup" onClick={onClose}>
            <Icon name="x" />
          </IconButton>
        </header>
        <div className="tsp-drawer-body">
          <section className="drawer-program-info">
            <span>
              {program.no} · {program.element}
            </span>
            <h3>{program.program}</h3>
            <dl>
              <div>
                <dt>Penanggung Jawab</dt>
                <dd>{program.owner}</dd>
              </div>
              <div>
                <dt>Indikator</dt>
                <dd>{program.indicator}</dd>
              </div>
              <div>
                <dt>Bukti wajib</dt>
                <dd>{program.evidence}</dd>
              </div>
            </dl>
          </section>
          <div className="plan-actual-inputs">
            <Field label="Rencana" type="number" defaultValue="1" />
            <Field label="Aktual" type="number" defaultValue={String(actual)} />
          </div>
          <button
            className={`drawer-dropzone ${uploaded ? "is-uploaded" : ""}`}
            onClick={() => setUploaded(true)}
          >
            {uploaded ? (
              <>
                <Icon name="check" size={24} />
                <strong>3 bukti siap disimpan</strong>
                <span>Daftar hadir · Dokumentasi · MOM</span>
              </>
            ) : (
              <>
                <Icon name="upload" size={25} />
                <strong>Unggah bukti pelaksanaan</strong>
                <span>Daftar Hadir, Dokumentasi, MOM</span>
              </>
            )}
          </button>
          <label className="textarea-field">
            <span>Catatan</span>
            <textarea placeholder="Tambahkan penjelasan realisasi atau kendala" />
          </label>
          <div className="drawer-review-status">
            <span>Status</span>
            <StatusBadge tone="verification">Menunggu Review PJO</StatusBadge>
          </div>
          <section className="mini-audit">
            <h3>Riwayat</h3>
            <div>
              <i />
              <p>
                <strong>Andi Pratama memperbarui aktual 0 → {actual}</strong>
                <span>30 Sep 2026, 16:42 WIB</span>
              </p>
            </div>
            <div>
              <i />
              <p>
                <strong>Program bulan {months[month]} dibuat otomatis</strong>
                <span>01 {months[month]} 2026, 00:01 WIB</span>
              </p>
            </div>
          </section>
        </div>
        <footer>
          <Button className="back-button" onClick={onClose}>
            Batal
          </Button>
          <Button className="primary-button" onClick={onClose}>
            Simpan Perubahan
          </Button>
        </footer>
      </aside>
    </>
  )
}

function ActivityForm({ onClose }: { onClose: () => void }) {
  const [uploaded, setUploaded] = useState(false)
  return (
    <div className="modal-layer">
      <button
        className="modal-backdrop"
        onClick={onClose}
        aria-label="Tutup form"
      />
      <section className="activity-form">
        <header>
          <div>
            <p className="overline">AKTIVITAS K3</p>
            <h2>Catat Aktivitas</h2>
          </div>
          <IconButton label="Tutup" onClick={onClose}>
            <Icon name="x" />
          </IconButton>
        </header>
        <div>
          <label className="select-field">
            <span>Jenis *</span>
            <select>
              <option>Safety Talk</option>
              <option>Sosialisasi JSA</option>
              <option>Sosialisasi IK</option>
              <option>Sosialisasi SOP</option>
              <option>Kampanye K3</option>
              <option>Inspeksi Bersama</option>
            </select>
          </label>
          <label className="native-field">
            <span>Tanggal *</span>
            <input type="date" defaultValue="2026-10-31" />
          </label>
          <label className="select-field">
            <span>Lokasi *</span>
            <select>
              <option>Workshop Service</option>
              <option>Pit Area</option>
              <option>Warehouse</option>
              <option>Office GMI</option>
            </select>
          </label>
          <label className="select-field">
            <span>Pelaksana *</span>
            <select>
              <option>Andi Pratama · HSE</option>
              <option>Fajar Nugroho · Pengawas</option>
            </select>
          </label>
          <Field label="Peserta" placeholder="Cari nama peserta" />
          <Field label="Jumlah peserta" type="number" defaultValue="0" />
          <label className="select-field activity-program">
            <span>Program TSP terkait *</span>
            <select>
              <option>1.2 · Komunikasi Kebijakan SMT</option>
              <option>2.2 · Komunikasi dan Konsultasi Risiko</option>
              <option>3.5 · Kampanye K3</option>
              <option>3.7 · Pelatihan Penggunaan APD</option>
            </select>
          </label>
          <button
            className={`activity-upload ${uploaded ? "is-uploaded" : ""}`}
            onClick={() => setUploaded(true)}
          >
            <Icon name={uploaded ? "check" : "upload"} size={20} />
            <span>
              <strong>
                {uploaded ? "Bukti berhasil ditambahkan" : "Unggah Bukti"}
              </strong>
              <small>Daftar hadir, foto, materi, atau MOM</small>
            </span>
          </button>
        </div>
        <footer>
          <Button className="back-button" onClick={onClose}>
            Batal
          </Button>
          <Button className="primary-button" onClick={onClose}>
            Simpan Aktivitas
          </Button>
        </footer>
      </section>
    </div>
  )
}

export default function TspManagement(_: Props) {
  const [drawer, setDrawer] = useState<{
    program: Program
    month: number
  } | null>(null)
  const [activityForm, setActivityForm] = useState(false)
  return (
    <section className="page tsp-page">
      <div className="page-heading tsp-heading">
        <div>
          <p className="overline">K3LH</p>
          <h1>TSP & Aktivitas</h1>
          <p>Monitoring Tujuan dan Sasaran Program Site MIFA.</p>
        </div>
        <div className="tsp-overall">
          <span>Capaian keseluruhan</span>
          <strong>84%</strong>
          <StatusBadge icon="help">Rumus belum disahkan</StatusBadge>
          <IconButton label="Formula capaian keseluruhan masih menunggu persetujuan HSE dan PJO.">
            <Icon name="help" size={16} />
          </IconButton>
        </div>
      </div>
      <div className="tsp-filters">
        <label>
          <span>Tahun</span>
          <select>
            <option>2026</option>
          </select>
        </label>
        <label>
          <span>Elemen</span>
          <select>
            <option>Semua elemen</option>
            <option>1. Kebijakan</option>
            <option>2. Perencanaan</option>
            <option>3. Implementasi</option>
          </select>
        </label>
        <label>
          <span>Penanggung Jawab</span>
          <select>
            <option>Semua penanggung jawab</option>
            <option>PJO</option>
            <option>HSE</option>
            <option>All Departemen</option>
          </select>
        </label>
        <label>
          <span>Status</span>
          <select>
            <option>Semua status</option>
            <option>Tercapai</option>
            <option>Tertinggal</option>
            <option>Menunggu Review</option>
          </select>
        </label>
        <Button className="export-button">
          <Icon name="file" size={15} />
          Ekspor
        </Button>
      </div>
      <section className="tsp-matrix-card">
        <header>
          <div>
            <h2>Monitoring Matrix TSP</h2>
            <p>Aktual / Rencana · Januari–Desember 2026</p>
          </div>
          <div className="matrix-legend">
            <span>
              <i className="met" />
              Tercapai
            </span>
            <span>
              <i className="partial" />
              Sebagian
            </span>
            <span>
              <i className="missed" />
              Tidak tercapai
            </span>
            <span>
              <i className="future" />
              Belum berjalan
            </span>
            <span>
              <i className="missing" />
              Bukti kurang
            </span>
          </div>
        </header>
        <TspMatrix onCell={(program, month) => setDrawer({ program, month })} />
      </section>
      <Activities onAdd={() => setActivityForm(true)} />
      <Evaluation />
      {drawer && (
        <CellDrawer
          program={drawer.program}
          month={drawer.month}
          onClose={() => setDrawer(null)}
        />
      )}
      {activityForm && <ActivityForm onClose={() => setActivityForm(false)} />}
    </section>
  )
}
