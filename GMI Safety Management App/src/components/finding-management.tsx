import { useMemo, useState, type ReactNode } from "react"
import { Button, Field, Icon, IconButton, StatusBadge } from "./ui"

type Props = { page: string onNavigate: (page: string) => void }

const findings = [
  [
    "TMN-2026-0087",
    "Padlock LOTO tidak terpasang saat perbaikan unit E5126",
    "INS-2026-0230",
    "Workshop Service",
    "Kritis",
    "Fajar Nugroho",
    "25 Okt 2026",
    "+5 hari",
    "13 hari",
    "In Progress",
    "1/3",
  ],
  [
    "TMN-2026-0086",
    "APAR workshop belum diinspeksi bulan September",
    "INS-2026-0228",
    "Workshop Service",
    "Tinggi",
    "Andi Pratama",
    "28 Okt 2026",
    "+2 hari",
    "16 hari",
    "Overdue",
    "0/2",
  ],
  [
    "TMN-2026-0085",
    "Kotak P3K office kurang perlengkapan",
    "OBS-2026-0518",
    "Office GMI",
    "Sedang",
    "Dewi Lestari",
    "04 Nov 2026",
    "",
    "9 hari",
    "Open",
    "0/2",
  ],
  [
    "TMN-2026-0084",
    "Matriks pelatihan mandatory BMC belum diperbarui",
    "Audit CSMS",
    "Office GMI",
    "Tinggi",
    "Dewi Lestari",
    "22 Okt 2026",
    "+8 hari",
    "28 hari",
    "Overdue",
    "2/3",
  ],
  [
    "TMN-2026-0083",
    "Housekeeping area penyimpanan refrigerant belum standar",
    "INS-2026-0222",
    "Warehouse",
    "Sedang",
    "Sari Wulandari",
    "02 Nov 2026",
    "",
    "11 hari",
    "Menunggu Verifikasi",
    "2/2",
  ],
  [
    "TMN-2026-0082",
    "Checklist harian unit DA54853 belum ditandatangani",
    "OBS-2026-0509",
    "Hauling Road",
    "Rendah",
    "Rudi Hartono",
    "07 Nov 2026",
    "",
    "7 hari",
    "In Progress",
    "1/2",
  ],
  [
    "TMN-2026-0081",
    "Guard fan kondensor unit G5809 longgar",
    "KJD-2026-0010",
    "Pit Area",
    "Tinggi",
    "Hendra Wijaya",
    "24 Okt 2026",
    "+6 hari",
    "20 hari",
    "Overdue",
    "1/3",
  ],
  [
    "TMN-2026-0080",
    "Label limbah B3 pudar dan tidak terbaca",
    "INS-2026-0219",
    "Warehouse",
    "Sedang",
    "Sari Wulandari",
    "01 Nov 2026",
    "",
    "14 hari",
    "Menunggu Verifikasi",
    "1/1",
  ],
  [
    "TMN-2026-0079",
    "JSA penggantian kompresor belum memuat titik jepit",
    "KJD-2026-0012",
    "Workshop Service",
    "Kritis",
    "Fajar Nugroho",
    "20 Okt 2026",
    "",
    "18 hari",
    "Closed",
    "3/3",
  ],
  [
    "TMN-2026-0078",
    "Permit kerja panas belum dilampirkan pada WO",
    "Audit CSMS",
    "Workshop Service",
    "Tinggi",
    "Andi Pratama",
    "06 Nov 2026",
    "",
    "8 hari",
    "Open",
    "0/2",
  ],
  [
    "TMN-2026-0077",
    "Penerangan area parkir unit kurang memadai",
    "MOM-2026-09",
    "Workshop Service",
    "Sedang",
    "Budi Santoso",
    "12 Nov 2026",
    "",
    "25 hari",
    "In Progress",
    "1/2",
  ],
  [
    "TMN-2026-0076",
    "Sertifikat kalibrasi manifold gauge kedaluwarsa",
    "INS-2026-0215",
    "Warehouse",
    "Tinggi",
    "Hendra Wijaya",
    "18 Okt 2026",
    "+12 hari",
    "32 hari",
    "Overdue",
    "2/3",
  ],
] as const

const statusTone = (status: string) =>
  status === "Closed"
    ? "success"
    : status === "Overdue" || status === "Ditolak"
      ? "danger"
      : status === "Menunggu Verifikasi"
        ? "verification"
        : status === "In Progress"
          ? "warning"
          : "info"
const priorityTone = (priority: string) =>
  priority === "Kritis"
    ? "danger"
    : priority === "Tinggi"
      ? "warning"
      : priority === "Sedang"
        ? "info"
        : "neutral"

function Widget({
  title,
  period,
  children,
}: {
  title: string
  period: string
  children: ReactNode
}) {
  return (
    <article className="finding-chart-widget">
      <header>
        <div>
          <h2>{title}</h2>
          <span>{period}</span>
        </div>
        <IconButton label={`Informasi ${title}`}>
          <Icon name="help" size={15} />
        </IconButton>
      </header>
      {children}
    </article>
  )
}

function FindingCharts() {
  const source = [
    ["Inspeksi", 28],
    ["Observasi KTA/TTA", 22],
    ["Audit CSMS", 16],
    ["Investigasi", 12],
    ["Rapat/MOM", 9],
    ["Lainnya", 5],
  ]
  const pics = [
    ["F. Nugroho", 7],
    ["A. Pratama", 5],
    ["D. Lestari", 4],
    ["H. Wijaya", 3],
    ["S. Wulandari", 2],
  ]
  return (
    <div className="finding-charts">
      <Widget title="Temuan per Sumber" period="Jan–Okt 2026">
        <div className="source-bars">
          {source.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <i>
                <b style={{ width: `${Number(value) * 3}%` }} />
              </i>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </Widget>
      <Widget title="Tren 6 Bulan" period="Mei–Okt 2026">
        <div className="trend-chart">
          <div className="chart-legend">
            <span>
              <i className="actual" />
              Dibuka
            </span>
            <span>
              <i className="closed-line" />
              Ditutup
            </span>
          </div>
          <svg
            viewBox="0 0 360 120"
            role="img"
            aria-label="Tren temuan dibuka dan ditutup enam bulan"
          >
            <path className="grid" d="M30 15H350M30 55H350M30 95H350" />
            <path
              className="opened"
              d="M35 84 95 53 155 68 215 31 275 45 335 23"
            />
            <path
              className="closed"
              d="M35 92 95 72 155 61 215 70 275 38 335 50"
            />
            <g>
              <text x="35" y="115">
                Mei
              </text>
              <text x="95" y="115">
                Jun
              </text>
              <text x="155" y="115">
                Jul
              </text>
              <text x="215" y="115">
                Agu
              </text>
              <text x="275" y="115">
                Sep
              </text>
              <text x="335" y="115">
                Okt
              </text>
            </g>
          </svg>
        </div>
      </Widget>
      <Widget title="Overdue per PIC" period="Top 5 · per 31 Okt 2026">
        <div className="pic-bars">
          {pics.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <i>
                <b style={{ width: `${Number(value) * 13}%` }} />
              </i>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </Widget>
    </div>
  )
}

function FindingTable({ onNavigate }: Pick<Props, "onNavigate">) {
  return (
    <div className="finding-table">
      <table>
        <thead>
          <tr>
            <th>
              <input type="checkbox" aria-label="Pilih semua" />
            </th>
            <th>ID</th>
            <th>Temuan</th>
            <th>Sumber</th>
            <th>Lokasi</th>
            <th>Prioritas</th>
            <th>PIC</th>
            <th>Due Date</th>
            <th>Umur</th>
            <th>Status</th>
            <th>Tindakan</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {findings.map(
            ([
              id,
              title,
              source,
              location,
              priority,
              pic,
              due,
              late,
              age,
              status,
              action,
            ]) => (
              <tr
                key={id}
                className={id === "TMN-2026-0087" ? "is-clickable" : ""}
                onClick={() => id === "TMN-2026-0087" && onNavigate(id)}
              >
                <td onClick={(event) => event.stopPropagation()}>
                  <input type="checkbox" aria-label={`Pilih ${id}`} />
                </td>
                <td>
                  <button>{id}</button>
                </td>
                <td>
                  <strong>{title}</strong>
                </td>
                <td>
                  <button className="source-link">
                    <Icon name="arrow-right" size={12} />
                    {source}
                  </button>
                </td>
                <td>{location}</td>
                <td>
                  <StatusBadge tone={priorityTone(priority)}>
                    {priority}
                  </StatusBadge>
                </td>
                <td>
                  <div className="pic-cell">
                    <span>
                      {pic
                        .split(" ")
                        .map((word) => word[0])
                        .slice(0, 2)
                        .join("")}
                    </span>
                    {pic}
                  </div>
                </td>
                <td className={late ? "is-late" : ""}>
                  {due}
                  {late && <small>{late}</small>}
                </td>
                <td>{age}</td>
                <td>
                  <StatusBadge tone={statusTone(status)}>{status}</StatusBadge>
                </td>
                <td>
                  <div className="action-progress">
                    <span>
                      <i
                        style={{
                          width: `${(Number(action[0]) / Number(action[2])) * 100}%`,
                        }}
                      />
                    </span>
                    <b>{action}</b>
                  </div>
                </td>
                <td>
                  <Icon name="more" size={16} />
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  )
}

function FindingKanban({ onNavigate }: Pick<Props, "onNavigate">) {
  const columns = ["Open", "In Progress", "Menunggu Verifikasi", "Closed"]
  return (
    <div className="finding-kanban">
      {columns.map((column) => {
        const cards = findings
          .filter(
            (row) =>
              row[9] === column || (column === "Open" && row[9] === "Overdue"),
          )
          .slice(0, 4)
        return (
          <section key={column}>
            <header>
              <span>{column}</span>
              <b>{cards.length}</b>
            </header>
            <div>
              {cards.map(
                ([id, title, , location, priority, pic, due, late]) => (
                  <button
                    key={id}
                    className={late ? "is-overdue" : ""}
                    onClick={() => id === "TMN-2026-0087" && onNavigate(id)}
                  >
                    <span>{id}</span>
                    <strong>{title}</strong>
                    <small>
                      <Icon name="building" size={12} />
                      {location}
                    </small>
                    <footer>
                      <StatusBadge tone={priorityTone(priority)}>
                        {priority}
                      </StatusBadge>
                      <span>{pic}</span>
                    </footer>
                    <p className={late ? "is-late" : ""}>
                      <Icon name="calendar" size={12} />
                      {due} {late}
                    </p>
                  </button>
                ),
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function FindingsList({ onNavigate }: Pick<Props, "onNavigate">) {
  const [view, setView] = useState("Semua")
  const [mode, setMode] = useState<"Tabel" | "Kanban">("Tabel")
  const kpis = [
    ["Open", "9", "info"],
    ["In Progress", "14", "warning"],
    ["Menunggu Verifikasi", "5", "verification"],
    ["Overdue", "4", "danger"],
    ["Closed bulan ini", "21", "success"],
    ["Rata-rata umur", "18 hari", "neutral"],
  ] as const
  return (
    <section className="page findings-page">
      <div className="page-heading">
        <div>
          <p className="overline">K3LH</p>
          <h1>Temuan & PICA</h1>
          <p>Pantau temuan, tindakan perbaikan, dan proses verifikasi.</p>
        </div>
        <Button className="create-button">
          <Icon name="plus" size={16} />
          Temuan Baru
        </Button>
      </div>
      <div className="finding-kpi-strip">
        {kpis.map(([label, value, tone]) => (
          <button key={label} className={tone === "danger" ? "is-danger" : ""}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>Per 31 Okt 2026</small>
          </button>
        ))}
      </div>
      <FindingCharts />
      <div className="finding-data-card">
        <div className="saved-view-tabs finding-views">
          {[
            "Semua",
            "Ditugaskan ke Saya",
            "Overdue",
            "Menunggu Verifikasi",
            "Closed",
          ].map((item) => (
            <button
              key={item}
              className={view === item ? "is-active" : ""}
              onClick={() => setView(item)}
            >
              {item}
              {item === "Overdue" && <i>4</i>}
            </button>
          ))}
          <div className="view-toggle">
            <button
              className={mode === "Tabel" ? "is-active" : ""}
              onClick={() => setMode("Tabel")}
            >
              <Icon name="menu" size={14} />
              Tabel
            </button>
            <button
              className={mode === "Kanban" ? "is-active" : ""}
              onClick={() => setMode("Kanban")}
            >
              <Icon name="grid" size={14} />
              Kanban
            </button>
          </div>
        </div>
        <div className="finding-filter-bar">
          {[
            "Periode",
            "Sumber",
            "Kategori",
            "Prioritas",
            "Status",
            "PIC",
            "Lokasi",
            "Due Date",
          ].map((item) => (
            <button key={item}>
              {item}
              <Icon name="chevron-down" size={12} />
            </button>
          ))}
          <button className="clear-filter">Atur filter</button>
        </div>
        {mode === "Tabel" ? (
          <FindingTable onNavigate={onNavigate} />
        ) : (
          <FindingKanban onNavigate={onNavigate} />
        )}
        <footer className="table-pagination">
          <span>1–12 dari 100 temuan</span>
          <div>
            <button>‹</button>
            <button className="is-active">1</button>
            <button>2</button>
            <button>3</button>
            <button>›</button>
          </div>
        </footer>
      </div>
    </section>
  )
}

type ActionState = {
  id: string
  title: string
  type: string
  pic: string
  due: string
  status: string
  evidence: number
  verifier: string
}
const initialActions: ActionState[] = [
  {
    id: "TDK-2026-0146",
    title: "Pasang padlock LOTO pada seluruh toolkit teknisi",
    type: "Korektif",
    pic: "Fajar Nugroho",
    due: "02 Nov 2026",
    status: "In Progress",
    evidence: 0,
    verifier: "Andi Pratama",
  },
  {
    id: "TDK-2026-0147",
    title: "Sosialisasi ulang prosedur LOTO kepada tim Service AC",
    type: "Preventif",
    pic: "Andi Pratama",
    due: "04 Nov 2026",
    status: "Menunggu Verifikasi",
    evidence: 2,
    verifier: "Budi Santoso",
  },
  {
    id: "TDK-2026-0148",
    title: "Tambahkan pemeriksaan LOTO pada checklist pengawas",
    type: "Preventif",
    pic: "Fajar Nugroho",
    due: "28 Okt 2026",
    status: "Closed",
    evidence: 3,
    verifier: "Andi Pratama",
  },
]

function FindingSection({
  title,
  children,
  action,
}: {
  title: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <section className="finding-section">
      <header>
        <h2>{title}</h2>
        {action}
      </header>
      <div>{children}</div>
    </section>
  )
}

function ActionCard({
  action,
  index,
  onUpload,
  onDecision,
}: {
  action: ActionState
  index: number
  onUpload: () => void
  onDecision: (decision: string, comment: string) => void
}) {
  const [open, setOpen] = useState(index !== 2)
  const [comment, setComment] = useState("")
  const [effectiveness, setEffectiveness] = useState("")
  return (
    <article className={`pica-action-card ${open ? "is-open" : ""}`}>
      <button className="action-card-head" onClick={() => setOpen(!open)}>
        <span>{index + 1}</span>
        <div>
          <strong>{action.title}</strong>
          <small>
            {action.id} · {action.type}
          </small>
        </div>
        <StatusBadge tone={statusTone(action.status)}>
          {action.status}
        </StatusBadge>
        <Icon name="chevron-down" size={16} />
      </button>
      {open && (
        <div className="action-card-body">
          <dl>
            <div>
              <dt>PIC</dt>
              <dd>{action.pic}</dd>
            </div>
            <div>
              <dt>Due Date</dt>
              <dd>{action.due}</dd>
            </div>
            <div>
              <dt>Verifikator</dt>
              <dd>{action.verifier}</dd>
            </div>
            <div>
              <dt>Bukti</dt>
              <dd>{action.evidence} file</dd>
            </div>
          </dl>
          {action.status === "In Progress" && (
            <div className="pic-action-block">
              <div>
                <Icon name="upload" size={20} />
                <p>
                  <strong>Bukti penyelesaian belum dikirim</strong>
                  <span>Unggah bukti agar tindakan dapat diverifikasi.</span>
                </p>
              </div>
              <Button className="primary-button" onClick={onUpload}>
                Unggah Bukti
              </Button>
            </div>
          )}
          {action.status === "Menunggu Verifikasi" && (
            <div className="verification-block">
              <div className="verification-note">
                <Icon name="help" size={16} />
                Tindakan belum Closed sampai bukti diverifikasi.
              </div>
              <div className="evidence-files">
                <span>
                  <Icon name="camera" size={18} />
                  Foto_padlock_terpasang.jpg
                </span>
                <span>
                  <Icon name="file" size={18} />
                  BA_sosialisasi_LOTO.pdf
                </span>
              </div>
              <label>
                <span>Komentar verifikator</span>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Tuliskan hasil pemeriksaan bukti"
                />
              </label>
              <div className="verification-actions">
                <Button
                  className="accept-button"
                  disabled={!comment.trim()}
                  onClick={() => onDecision("Closed", comment)}
                >
                  Terima
                </Button>
                <Button
                  disabled={!comment.trim()}
                  onClick={() => onDecision("In Progress", comment)}
                >
                  Minta Perbaikan
                </Button>
                <Button
                  className="reject-button"
                  disabled={!comment.trim()}
                  onClick={() => onDecision("Ditolak", comment)}
                >
                  Tolak
                </Button>
              </div>
            </div>
          )}
          {action.status === "Closed" && (
            <div className="closed-verification">
              <Icon name="check" size={18} />
              <div>
                <strong>Bukti diterima oleh {action.verifier}</strong>
                <span>
                  30 Okt 2026, 14:22 WIB · Sesuai persyaratan tindakan
                </span>
              </div>
            </div>
          )}
          <label className="effectiveness-field">
            <span>Verifikasi Efektivitas (opsional)</span>
            <input
              type="date"
              value={effectiveness}
              onChange={(e) => setEffectiveness(e.target.value)}
            />
          </label>
        </div>
      )}
    </article>
  )
}

function FindingDetail({ onNavigate }: Pick<Props, "onNavigate">) {
  const [tab, setTab] = useState("Detail")
  const [actions, setActions] = useState(initialActions)
  const [drawerAction, setDrawerAction] = useState<ActionState | null>(null)
  const [closeReason, setCloseReason] = useState("")
  const allClosed = useMemo(
    () => actions.every((action) => action.status === "Closed"),
    [actions],
  )
  const updateStatus = (index: number, status: string) =>
    setActions((current) =>
      current.map((item, i) =>
        i === index
          ? {
              ...item,
              status,
              evidence:
                status === "Menunggu Verifikasi"
                  ? Math.max(item.evidence, 1)
                  : item.evidence,
            }
          : item,
      ),
    )
  return (
    <section className="page finding-detail-page">
      <button
        className="record-back"
        onClick={() => onNavigate("Temuan & PICA")}
      >
        <Icon name="arrow-right" size={15} />
        Kembali ke Temuan & PICA
      </button>
      <header className="finding-record-header">
        <div>
          <div>
            <strong>TMN-2026-0087</strong>
            <StatusBadge tone="warning">In Progress</StatusBadge>
            <StatusBadge tone="danger">Kritis</StatusBadge>
          </div>
          <h1>Padlock LOTO tidak terpasang saat perbaikan unit E5126</h1>
          <button className="source-chip">
            <Icon name="arrow-right" size={13} />
            Sumber: Inspeksi Padlock · INS-2026-0230
          </button>
        </div>
        <dl>
          <div>
            <dt>PIC</dt>
            <dd>
              <span>FN</span>Fajar Nugroho
            </dd>
          </div>
          <div>
            <dt>Due Date</dt>
            <dd className="is-late">25 Okt 2026 · +5 hari</dd>
          </div>
        </dl>
      </header>
      <nav className="record-tabs finding-tabs">
        {["Detail", "Lampiran", "Riwayat"].map((item) => (
          <button
            className={tab === item ? "is-active" : ""}
            key={item}
            onClick={() => setTab(item)}
          >
            {item}
            {item === "Lampiran" && " (4)"}
          </button>
        ))}
      </nav>
      {tab === "Detail" && (
        <main className="finding-detail-content">
          <FindingSection title="Uraian & Foto">
            <div className="finding-description">
              <div>
                <p>
                  Saat inspeksi pekerjaan perbaikan AC unit E5126 · PC2000,
                  ditemukan teknisi melakukan pekerjaan pada panel kelistrikan
                  tanpa memasang padlock LOTO. Tag informasi sudah tersedia,
                  namun energi belum diamankan menggunakan padlock personal.
                </p>
                <dl>
                  <div>
                    <dt>Lokasi</dt>
                    <dd>Workshop Service · Bay 3</dd>
                  </div>
                  <div>
                    <dt>Ditemukan</dt>
                    <dd>18 Okt 2026, 09:15 WIB</dd>
                  </div>
                  <div>
                    <dt>Pelapor</dt>
                    <dd>Andi Pratama · HSE</dd>
                  </div>
                  <div>
                    <dt>Kategori</dt>
                    <dd>Keselamatan Operasional</dd>
                  </div>
                </dl>
              </div>
              <figure>
                <img
                  src="https://images.unsplash.com/photo-1622645916455-aa13b87438ec?auto=format&fit=crop&w=900&q=85"
                  alt="Teknisi di area unit alat berat"
                />
                <figcaption>Kondisi saat inspeksi · 18 Okt 2026</figcaption>
              </figure>
            </div>
          </FindingSection>
          <FindingSection title="Prioritas / Risiko">
            <div className="risk-panel">
              <div>
                <span>Kemungkinan</span>
                <strong>3 · Mungkin terjadi</strong>
              </div>
              <b>×</b>
              <div>
                <span>Konsekuensi</span>
                <strong>4 · Cedera berat</strong>
              </div>
              <b>=</b>
              <div className="risk-result">
                <span>Nilai risiko</span>
                <strong>12 · Kritis</strong>
              </div>
            </div>
            <p className="scheme-note">
              <Icon name="help" size={14} />
              Skema risiko contoh — menunggu pengesahan HSE
            </p>
          </FindingSection>
          <FindingSection title="Akar Penyebab">
            <div className="root-causes">
              <div>
                <span>Manusia</span>
                <p>
                  Pemahaman teknisi tentang kewajiban padlock personal belum
                  konsisten.
                </p>
              </div>
              <div>
                <span>Metode</span>
                <p>
                  Checklist pekerjaan belum memiliki hold point verifikasi LOTO.
                </p>
              </div>
              <div>
                <span>Manajemen</span>
                <p>
                  Inspeksi kepatuhan LOTO belum dilakukan secara rutin oleh
                  pengawas.
                </p>
              </div>
            </div>
          </FindingSection>
          <FindingSection
            title="Rencana Tindakan"
            action={
              <Button className="create-button">
                <Icon name="plus" size={15} />
                Tambah Tindakan
              </Button>
            }
          >
            <div className="action-group-title">
              <span>Tindakan Koreksi</span>
              <b>1 tindakan</b>
            </div>
            <ActionCard
              action={actions[0]}
              index={0}
              onUpload={() => setDrawerAction(actions[0])}
              onDecision={(status) => updateStatus(0, status)}
            />
            <div className="action-group-title">
              <span>Tindakan Pencegahan</span>
              <b>2 tindakan</b>
            </div>
            {actions.slice(1).map((action, offset) => (
              <ActionCard
                key={action.id}
                action={action}
                index={offset + 1}
                onUpload={() => setDrawerAction(action)}
                onDecision={(status) => updateStatus(offset + 1, status)}
              />
            ))}
            <div className="action-version">
              <header>
                <strong>Versi Tindakan</strong>
                <button>Lihat riwayat lengkap</button>
              </header>
              <div>
                <span>v2</span>
                <p>
                  <strong>Due Date TDK-2026-0146 diubah</strong>
                  <small>
                    28 Okt 2026 → 02 Nov 2026 · Alasan: menunggu pengadaan
                    padlock personal
                  </small>
                </p>
                <time>28 Okt 2026 · Fajar Nugroho</time>
              </div>
              <div>
                <span>v1</span>
                <p>
                  <strong>Rencana tindakan dibuat</strong>
                  <small>3 tindakan koreksi dan pencegahan ditambahkan</small>
                </p>
                <time>20 Okt 2026 · Andi Pratama</time>
              </div>
            </div>
          </FindingSection>
          <FindingSection title="Penutupan Temuan">
            <div className="finding-close">
              <label className="textarea-field">
                <span>Alasan Penutupan</span>
                <textarea
                  value={closeReason}
                  onChange={(e) => setCloseReason(e.target.value)}
                  placeholder="Ringkas hasil tindakan dan alasan temuan dapat ditutup"
                />
              </label>
              <div>
                <p>
                  {allClosed
                    ? "Semua tindakan telah diverifikasi."
                    : `${actions.filter((item) => item.status !== "Closed").length} tindakan belum Closed. Temuan belum dapat ditutup.`}
                </p>
                <Button
                  className="primary-button"
                  disabled={!allClosed || !closeReason.trim()}
                >
                  Tutup Temuan
                </Button>
              </div>
            </div>
          </FindingSection>
        </main>
      )}
      {tab === "Lampiran" && (
        <FindingSection title="Lampiran (4)">
          <div className="attachment-grid">
            {[
              "Foto_temuan_LOTO.jpg",
              "Checklist_inspeksi.pdf",
              "Prosedur_LOTO.pdf",
              "Foto_unit_E5126.jpg",
            ].map((file) => (
              <article key={file}>
                <span>
                  <Icon
                    name={file.endsWith(".pdf") ? "file" : "camera"}
                    size={24}
                  />
                </span>
                <strong>{file}</strong>
                <small>Andi Pratama · 18 Okt 2026</small>
                <StatusBadge>Internal</StatusBadge>
              </article>
            ))}
          </div>
        </FindingSection>
      )}
      {tab === "Riwayat" && (
        <FindingSection title="Riwayat">
          <div className="audit-timeline">
            {[
              [
                "30 Okt 2026 · 14:22 WIB",
                "Andi Pratama memverifikasi TDK-2026-0148",
                "Menunggu Verifikasi → Closed",
              ],
              [
                "28 Okt 2026 · 08:40 WIB",
                "Fajar Nugroho mengubah Due Date TDK-2026-0146",
                "28 Okt → 02 Nov 2026",
              ],
              [
                "20 Okt 2026 · 11:10 WIB",
                "Andi Pratama membuat rencana tindakan",
                "3 tindakan ditambahkan",
              ],
              [
                "18 Okt 2026 · 09:20 WIB",
                "Andi Pratama membuat temuan",
                "Open · Prioritas Kritis",
              ],
            ].map(([time, action, change]) => (
              <div key={time}>
                <i />
                <span>{time}</span>
                <strong>{action}</strong>
                <p>{change}</p>
              </div>
            ))}
          </div>
        </FindingSection>
      )}
      {drawerAction && (
        <ActionDrawer
          action={drawerAction}
          onClose={() => setDrawerAction(null)}
          onSubmit={() => {
            const index = actions.findIndex(
              (item) => item.id === drawerAction.id,
            )
            updateStatus(index, "Menunggu Verifikasi")
            setDrawerAction(null)
          }}
        />
      )}
    </section>
  )
}

function ActionDrawer({
  action,
  onClose,
  onSubmit,
}: {
  action: ActionState
  onClose: () => void
  onSubmit: () => void
}) {
  const [uploaded, setUploaded] = useState(false)
  const [notes, setNotes] = useState("")
  const dueDays = action.id === "TDK-2026-0146" ? 2 : 4
  return (
    <>
      <button
        className="drawer-backdrop"
        onClick={onClose}
        aria-label="Tutup drawer"
      />
      <aside className="pica-drawer">
        <header>
          <div>
            <span>TUGAS TINDAKAN</span>
            <h2>Unggah Bukti</h2>
          </div>
          <IconButton label="Tutup" onClick={onClose}>
            <Icon name="x" />
          </IconButton>
        </header>
        <div className="pica-drawer-body">
          <section>
            <span className="drawer-id">{action.id}</span>
            <h3>{action.title}</h3>
            <dl>
              <div>
                <dt>PIC</dt>
                <dd>{action.pic}</dd>
              </div>
              <div>
                <dt>Jenis</dt>
                <dd>{action.type}</dd>
              </div>
              <div>
                <dt>Due Date</dt>
                <dd>{action.due}</dd>
              </div>
            </dl>
            <StatusBadge tone="warning" icon="calendar">
              Jatuh tempo {dueDays} hari
            </StatusBadge>
          </section>
          <button
            className={`drawer-dropzone ${uploaded ? "is-uploaded" : ""}`}
            onClick={() => setUploaded(true)}
          >
            {uploaded ? (
              <>
                <Icon name="check" size={25} />
                <strong>Foto_padlock_LOTO.jpg</strong>
                <span>1,8 MB · siap dikirim</span>
              </>
            ) : (
              <>
                <Icon name="upload" size={26} />
                <strong>Unggah bukti penyelesaian</strong>
                <span>JPG, PNG, PDF, MP4 · maks 10 MB</span>
              </>
            )}
          </button>
          <label className="textarea-field">
            <span>Catatan penyelesaian</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Jelaskan pekerjaan yang telah diselesaikan"
            />
          </label>
          <div className="privacy-note">
            <Icon name="help" size={16} />
            Setelah dikirim, status berubah menjadi Menunggu Verifikasi.
          </div>
        </div>
        <footer>
          <Button className="back-button" onClick={onClose}>
            Batal
          </Button>
          <Button
            className="primary-button"
            disabled={!uploaded}
            onClick={onSubmit}
          >
            Kirim untuk Verifikasi
          </Button>
        </footer>
      </aside>
    </>
  )
}

export default function FindingManagement({ page, onNavigate }: Props) {
  return page === "TMN-2026-0087" ? (
    <FindingDetail onNavigate={onNavigate} />
  ) : (
    <FindingsList onNavigate={onNavigate} />
  )
}
