import { useState, type ReactNode } from "react"
import { Button, ExpiryChip, Icon, IconButton, StatusBadge } from "./ui"

type DashboardProps = {
  role: string
  onNavigate: (page: string) => void
}

function Widget({
  title,
  period,
  module,
  onNavigate,
  children,
  className = "",
  info,
}: {
  title: string
  period?: string
  module: string
  onNavigate: (page: string) => void
  children: ReactNode
  className?: string
  info?: string
}) {
  return (
    <article className={`dashboard-widget ${className}`}>
      <header className="widget-header">
        <div>
          <button onClick={() => onNavigate(module)}>{title}</button>
          {period && <span>{period}</span>}
        </div>
        {info && (
          <IconButton label={info}>
            <Icon name="help" size={16} />
          </IconButton>
        )}
      </header>
      {children}
    </article>
  )
}

const safetyKpis = [
  [
    "Fatality",
    "Jumlah kejadian fatal",
    "Jumlah kejadian fatal terverifikasi",
    "Data kejadian",
    "0 kasus",
    "0 kasus",
    "safe",
  ],
  [
    "Lost Time Injury",
    "Cedera yang menyebabkan kehilangan hari kerja",
    "Total kasus LTI",
    "Investigasi kejadian",
    "0 kasus",
    "1 kasus",
    "danger",
  ],
  [
    "LTIFR",
    "Frekuensi LTI per satu juta jam kerja",
    "LTI × 1.000.000 ÷ jam kerja",
    "Kejadian dan manpower",
    "0,00",
    "0,11",
    "warning",
  ],
  [
    "LTISR",
    "Tingkat keparahan LTI per satu juta jam kerja",
    "Hari hilang × 1.000.000 ÷ jam kerja",
    "Kejadian dan manpower",
    "0,00",
    "2,10",
    "warning",
  ],
  [
    "Near Miss",
    "Kejadian nyaris celaka",
    "Total Near Miss terverifikasi",
    "Data kejadian",
    "3 kasus",
    "12 kasus",
    "info",
  ],
  [
    "Property Damage",
    "Kejadian kerusakan properti",
    "Total kerusakan properti",
    "Data kejadian",
    "1 kasus",
    "3 kasus",
    "danger",
  ],
] as const

function SafetyStrip({ period }: { period: "Bulan ini" | "YTD" }) {
  return (
    <section className="dashboard-section">
      <div className="section-title">
        <button>Kinerja Keselamatan</button>
        <span>
          {period === "YTD" ? "YTD · Jan–Sep 2026" : "September 2026"}
        </span>
      </div>
      <div className="safety-strip">
        {safetyKpis.map(
          ([label, definition, formula, source, monthly, ytd, tone]) => (
            <article className={`safety-kpi tone-${tone}`} key={label}>
              <div>
                <span>{label}</span>
                <IconButton
                  label={`${definition}. Rumus: ${formula}. Sumber: ${source}. Pemilik: HSE.`}
                >
                  <Icon name="help" size={14} />
                </IconButton>
              </div>
              <strong>{period === "YTD" ? ytd : monthly}</strong>
              <small>
                {period === "YTD" ? `Bulan ini: ${monthly}` : `YTD: ${ytd}`}
              </small>
            </article>
          ),
        )}
      </div>
    </section>
  )
}

function Sparkline() {
  return (
    <svg
      className="mini-sparkline"
      viewBox="0 0 160 42"
      role="img"
      aria-label="Jam kerja meningkat dari Januari hingga September"
    >
      <path d="M2 36 22 31 42 33 62 22 82 25 102 15 122 18 142 8 158 4" />
    </svg>
  )
}

function SummaryKpis({ onNavigate }: Pick<DashboardProps, "onNavigate">) {
  return (
    <div className="summary-kpi-grid">
      <button className="summary-kpi" onClick={() => onNavigate("Manpower")}>
        <div className="kpi-label">
          <span>Jam Kerja (YTD)</span>
          <Icon name="help" size={14} />
        </div>
        <strong>
          95.106 <small>jam</small>
        </strong>
        <Sparkline />
        <footer>
          <span>Jan–Sep 2026</span>
          <span>Diperbarui 31 Okt</span>
        </footer>
      </button>
      <button className="summary-kpi" onClick={() => onNavigate("Manpower")}>
        <div className="kpi-label">
          <span>Manpower</span>
          <Icon name="help" size={14} />
        </div>
        <strong>
          32 <small>orang</small>
        </strong>
        <p className="delta-negative">↓ 2 vs Agustus</p>
        <footer>
          <span>September 2026</span>
          <span>Diperbarui 31 Okt</span>
        </footer>
      </button>
      <button
        className="summary-kpi is-danger"
        onClick={() => onNavigate("Temuan & PICA")}
      >
        <div className="kpi-label">
          <span>Temuan Overdue</span>
          <Icon name="help" size={14} />
        </div>
        <strong>4</strong>
        <p className="danger-copy">Perlu tindak lanjut segera</p>
        <footer>
          <span>Per 30 Sep 2026</span>
          <span>Lihat PICA →</span>
        </footer>
      </button>
      <button
        className="summary-kpi"
        onClick={() => onNavigate("Prosedur & Dokumen")}
      >
        <div className="kpi-label">
          <span>Kepatuhan Dokumen</span>
          <Icon name="help" size={14} />
        </div>
        <strong>
          94<small>%</small>
        </strong>
        <StatusBadge icon="help">Rumus belum disahkan</StatusBadge>
        <footer>
          <span>September 2026</span>
          <span>Diperbarui 31 Okt</span>
        </footer>
      </button>
    </div>
  )
}

const months = [
  ["Jan", 64, 52],
  ["Feb", 70, 68],
  ["Mar", 61, 72],
  ["Apr", 76, 70],
  ["Mei", 67, 62],
  ["Jun", 82, 76],
  ["Jul", 73, 80],
  ["Agu", 88, 82],
  ["Sep", 80, 92],
] as const

function LeadingChart({
  onOpen,
  onNavigate,
}: {
  onOpen: (month: string) => void
  onNavigate: (page: string) => void
}) {
  return (
    <Widget
      title="Leading Indicator — Rencana vs Aktual"
      period="Jan–Sep 2026 · seluruh aktivitas"
      module="Inspeksi & Observasi"
      onNavigate={onNavigate}
      info="Jumlah kegiatan Inspeksi, Observasi, KTA/TTA, dan Safety Talk. Sumber: aktivitas K3LH. Pemilik: HSE."
      className="leading-widget"
    >
      <div className="chart-legend">
        <span>
          <i className="plan" />
          Rencana
        </span>
        <span>
          <i className="actual" />
          Aktual
        </span>
        <span>
          <i className="target" />
          Target 80
        </span>
      </div>
      <div className="bar-chart">
        <div className="y-axis">
          <span>100</span>
          <span>75</span>
          <span>50</span>
          <span>25</span>
          <span>0</span>
        </div>
        <div className="bar-plot">
          <i className="target-line">
            <span>Target</span>
          </i>
          {months.map(([month, plan, actual]) => (
            <button
              className="bar-group"
              key={month}
              onClick={() => onOpen(month)}
              aria-label={`${month}: rencana ${plan}, aktual ${actual}`}
            >
              <span className="bar-pair">
                <i className="plan-bar" style={{ height: `${plan}%` }} />
                <i className="actual-bar" style={{ height: `${actual}%` }} />
              </span>
              <small>{month}</small>
            </button>
          ))}
        </div>
      </div>
      <p className="chart-axis-label">Jumlah aktivitas per bulan</p>
    </Widget>
  )
}

function PicaWidget({ onNavigate }: Pick<DashboardProps, "onNavigate">) {
  return (
    <Widget
      title="Status PICA"
      period="Per 30 Sep 2026"
      module="Temuan & PICA"
      onNavigate={onNavigate}
      info="Distribusi status seluruh PICA aktif dan selesai. Sumber: register tindakan PICA."
    >
      <div className="donut-layout">
        <div
          className="donut"
          role="img"
          aria-label="Open 9, In Progress 14, Menunggu Verifikasi 5, Overdue 4, Closed 68"
        >
          <div>
            <strong>100</strong>
            <span>Total PICA</span>
          </div>
        </div>
        <div className="donut-legend">
          <span>
            <i className="donut-open" />
            Open <strong>9</strong>
          </span>
          <span>
            <i className="donut-progress" />
            In Progress <strong>14</strong>
          </span>
          <span>
            <i className="donut-verify" />
            Menunggu Verifikasi <strong>5</strong>
          </span>
          <span>
            <i className="donut-overdue" />
            Overdue <strong>4</strong>
          </span>
          <span>
            <i className="donut-closed" />
            Closed <strong>68</strong>
          </span>
        </div>
      </div>
      <div className="age-chart">
        <div>
          <strong>Umur Temuan</strong>
          <span>Temuan aktif · hari</span>
        </div>
        <div className="age-bar">
          <i className="age-1" />
          <i className="age-2" />
          <i className="age-3" />
          <i className="age-4" />
        </div>
        <div className="age-legend">
          <span>
            0–7 <b>8</b>
          </span>
          <span>
            8–30 <b>12</b>
          </span>
          <span>
            31–60 <b>7</b>
          </span>
          <span>
            &gt;60 hari <b>5</b>
          </span>
        </div>
      </div>
    </Widget>
  )
}

const tsp = [
  ["1. Kebijakan", 96, "0 program tertinggal"],
  ["2. Perencanaan", 84, "2 program tertinggal"],
  ["3. Organisasi & Personel", 91, "1 program tertinggal"],
  ["4. Implementasi", 78, "4 program tertinggal"],
  ["5. Evaluasi & Tindak Lanjut", 88, "2 program tertinggal"],
] as const

function TspWidget({ onNavigate }: Pick<DashboardProps, "onNavigate">) {
  return (
    <Widget
      title="Pencapaian TSP"
      period="September 2026"
      module="TSP & Aktivitas"
      onNavigate={onNavigate}
      info="Persentase realisasi program TSP terhadap rencana periode berjalan."
    >
      <div className="progress-list">
        {tsp.map(([label, progress, note], index) => (
          <div className="progress-row" key={label}>
            <div>
              <span>{label}</span>
              <strong>{progress}%</strong>
            </div>
            <div className="progress-track">
              <i style={{ width: `${progress}%` }} />
            </div>
            <small>{note}</small>
            {index === 3 && (
              <StatusBadge icon="help">Rumus belum disahkan</StatusBadge>
            )}
          </div>
        ))}
      </div>
    </Widget>
  )
}

function HealthWidget({ onNavigate }: Pick<DashboardProps, "onNavigate">) {
  const rows = [
    ["CMR", "≤ 2,21", "1,84", "1,72", true],
    ["MFR", "≤ 40,0", "38,6", "36,2", true],
    ["SSR", "≤ 4,00", "4,35", "3,82", false],
    ["ASR", "≤ 60,0", "52,8", "49,7", true],
  ] as const
  return (
    <Widget
      title="Health Performance"
      period="September 2026 · YTD"
      module="MCU"
      onNavigate={onNavigate}
      info="Indikator kesehatan kerja dibanding ambang batas perusahaan. Sumber: data kesehatan agregat HSE/HR."
    >
      <div className="health-table">
        <table>
          <thead>
            <tr>
              <th>Indikator</th>
              <th>Threshold</th>
              <th>Bulan ini</th>
              <th>YTD</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([name, threshold, month, ytd, safe]) => (
              <tr key={name}>
                <td>{name}</td>
                <td>{threshold}</td>
                <td>{month}</td>
                <td>{ytd}</td>
                <td>
                  <StatusBadge tone={safe ? "success" : "danger"}>
                    {safe ? "Sesuai" : "Di atas batas"}
                  </StatusBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Widget>
  )
}

const attention = [
  ["5 karyawan MCU akan kedaluwarsa ≤ 30 hari", "MCU", "warning"],
  ["2 sertifikat kompetensi kedaluwarsa", "Kompetensi & Pelatihan", "danger"],
  [
    "1 izin kontraktor berakhir dalam 14 hari",
    "Kontraktor & Legalitas",
    "warning",
  ],
  ["3 prosedur melewati jadwal review", "Prosedur & Dokumen", "danger"],
  [
    "Laporan September 2026 menunggu persetujuan PJO",
    "Laporan Periode",
    "verification",
  ],
] as const

function AttentionWidget({ onNavigate }: Pick<DashboardProps, "onNavigate">) {
  return (
    <Widget
      title="Perlu Perhatian"
      period="5 item memerlukan tindakan"
      module="Dashboard"
      onNavigate={onNavigate}
    >
      <div className="attention-list">
        {attention.map(([text, module, tone]) => (
          <button key={text} onClick={() => onNavigate(module)}>
            <span className={`attention-icon ${tone}`}>
              <Icon name={tone === "danger" ? "x" : "bell"} size={16} />
            </span>
            <strong>{text}</strong>
            <span>Tinjau →</span>
          </button>
        ))}
      </div>
    </Widget>
  )
}

function MaintenanceWidget({ onNavigate }: Pick<DashboardProps, "onNavigate">) {
  const metrics = [
    ["PA", "92,4%", "Target 90%"],
    ["PS Accuracy", "87,5%", "Rumus belum disahkan"],
    ["MTBF", "412 jam", "↑ 18 jam"],
    ["MTTR", "3,6 jam", "↓ 0,4 jam"],
    ["Backlog Open", "11", "3 prioritas tinggi"],
    ["MR Open", "7", "2 menunggu SCM"],
  ]
  return (
    <Widget
      title="Ringkasan Maintenance"
      period="September 2026"
      module="Dashboard Maintenance"
      onNavigate={onNavigate}
      info="Ringkasan performa maintenance unit Site MIFA. Sumber: register maintenance dan material."
    >
      <div className="maintenance-grid">
        {metrics.map(([label, value, note]) => (
          <button
            key={label}
            onClick={() => onNavigate("Dashboard Maintenance")}
          >
            <span>{label}</span>
            <strong>{value}</strong>
            {note === "Rumus belum disahkan" ? (
              <StatusBadge icon="help">{note}</StatusBadge>
            ) : (
              <small>{note}</small>
            )}
          </button>
        ))}
      </div>
      <button
        className="widget-link"
        onClick={() => onNavigate("Dashboard Maintenance")}
      >
        Lihat Dashboard Maintenance →
      </button>
    </Widget>
  )
}

function IssuesTable({ onNavigate }: Pick<DashboardProps, "onNavigate">) {
  const rows = [
    [
      "Pemenuhan tindak lanjut audit CSMS",
      "MOM Evaluasi PJO Semester 1",
      "Budi Santoso",
      "15 Okt 2026",
      "In Progress",
      "warning",
    ],
    [
      "Perbaikan laporan health performance",
      "MOM Evaluasi PJO September",
      "Andi Pratama",
      "05 Okt 2026",
      "Overdue",
      "danger",
    ],
    [
      "Revisi standar KPI MTTR, MTBF dan LIB",
      "Evaluasi Operasional Q3",
      "Hendra Wijaya",
      "21 Okt 2026",
      "Open",
      "info",
    ],
    [
      "Percepatan tindak lanjut inspeksi tim keselamatan operasional",
      "MOM Evaluasi PJO September",
      "Fajar Nugroho",
      "10 Okt 2026",
      "Menunggu Verifikasi",
      "verification",
    ],
  ] as const
  return (
    <Widget
      title="Isu Terbuka"
      period="Evaluasi dan rapat koordinasi"
      module="Audit Trail"
      onNavigate={onNavigate}
      className="issues-widget"
    >
      <div className="issues-table">
        <table>
          <thead>
            <tr>
              <th>Isu</th>
              <th>Sumber</th>
              <th>PIC</th>
              <th>Due Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([issue, source, pic, due, status, tone]) => (
              <tr key={issue}>
                <td>
                  <button onClick={() => onNavigate("Audit Trail")}>
                    {issue}
                  </button>
                </td>
                <td>{source}</td>
                <td>{pic}</td>
                <td>{due}</td>
                <td>
                  <StatusBadge tone={tone}>{status}</StatusBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Widget>
  )
}

function TaskCards({ onNavigate }: Pick<DashboardProps, "onNavigate">) {
  const tasks = [
    [
      "Klasifikasi KJD-2026-0013",
      "Dilaporkan 2 jam lalu",
      "Kejadian & Investigasi",
    ],
    [
      "Review investigasi KJD-2026-0012",
      "Jatuh tempo hari ini",
      "Kejadian & Investigasi",
    ],
    [
      "Verifikasi 3 tindakan PICA",
      "2 tindakan mendekati tenggat",
      "Temuan & PICA",
    ],
    ["Lengkapi data TSP September", "Progres 82%", "TSP & Aktivitas"],
  ]
  return (
    <section className="dashboard-section">
      <div className="section-title">
        <button onClick={() => onNavigate("Tugas Saya")}>Tugas Saya</button>
        <StatusBadge tone="verification">7 Menunggu Review Saya</StatusBadge>
      </div>
      <div className="task-card-grid">
        {tasks.map(([title, meta, module]) => (
          <button key={title} onClick={() => onNavigate(module)}>
            <span>
              <Icon name="clipboard" size={18} />
            </span>
            <strong>{title}</strong>
            <small>{meta}</small>
            <Icon name="arrow-right" size={16} />
          </button>
        ))}
      </div>
    </section>
  )
}

function InspectionSchedule({
  onNavigate,
}: Pick<DashboardProps, "onNavigate">) {
  return (
    <Widget
      title="Jadwal Inspeksi Minggu Ini"
      period="28 Sep–4 Okt 2026"
      module="Inspeksi & Observasi"
      onNavigate={onNavigate}
      info="Jadwal inspeksi yang ditugaskan kepada tim HSE."
    >
      <div className="schedule-list">
        <div>
          <span>
            <b>SEL</b>
            <strong>29</strong>
          </span>
          <p>
            <strong>Inspeksi Workshop Service</strong>
            <small>09:00 WIB · Andi Pratama</small>
          </p>
          <StatusBadge tone="success">Selesai</StatusBadge>
        </div>
        <div>
          <span>
            <b>KAM</b>
            <strong>01</strong>
          </span>
          <p>
            <strong>Inspeksi unit H57197 · HD785-7</strong>
            <small>13:30 WIB · Pit Area</small>
          </p>
          <StatusBadge tone="info">Terjadwal</StatusBadge>
        </div>
        <div>
          <span>
            <b>SAB</b>
            <strong>03</strong>
          </span>
          <p>
            <strong>Inspeksi Warehouse & material</strong>
            <small>08:00 WIB · Warehouse</small>
          </p>
          <StatusBadge tone="neutral">Belum Mulai</StatusBadge>
        </div>
      </div>
    </Widget>
  )
}

function EmployeeDashboard({ onNavigate }: Pick<DashboardProps, "onNavigate">) {
  const reports = [
    [
      "KJD-2026-0013",
      "Kebocoran refrigerant pada unit H57197",
      "Menunggu Verifikasi",
      "verification",
    ],
    [
      "OBS-2026-0518",
      "Penggunaan APD lengkap di Pit Area",
      "Closed",
      "success",
    ],
    [
      "TMN-2026-0087",
      "Pelindung fan kondensor longgar",
      "In Progress",
      "warning",
    ],
  ] as const
  return (
    <div className="employee-dashboard">
      <section className="employee-hero">
        <div>
          <p>Senin, 31 Oktober 2026</p>
          <h2>Halo, Rudi</h2>
          <span>
            Selamat bekerja. Pastikan aktivitas hari ini dilakukan dengan aman.
          </span>
        </div>
        <Icon name="hard-hat" size={42} />
      </section>
      <div className="employee-actions">
        <button onClick={() => onNavigate("Lapor Kejadian")}>
          <span>
            <Icon name="shield" size={25} />
          </span>
          <div>
            <strong>Lapor Kejadian</strong>
            <small>Laporkan kejadian atau Near Miss</small>
          </div>
          <Icon name="arrow-right" size={20} />
        </button>
        <button onClick={() => onNavigate("Observasi KTA/TTA")}>
          <span>
            <Icon name="clipboard" size={25} />
          </span>
          <div>
            <strong>Observasi KTA/TTA</strong>
            <small>Catat kondisi atau tindakan</small>
          </div>
          <Icon name="arrow-right" size={20} />
        </button>
      </div>
      <div className="employee-grid">
        <Widget
          title="Laporan Saya"
          period="3 laporan terbaru"
          module="Kejadian & Investigasi"
          onNavigate={onNavigate}
        >
          <div className="my-report-list">
            {reports.map(([id, title, status, tone]) => (
              <button key={id}>
                <div>
                  <strong>{id}</strong>
                  <span>{title}</span>
                </div>
                <StatusBadge tone={tone}>{status}</StatusBadge>
              </button>
            ))}
          </div>
        </Widget>
        <Widget
          title="Tugas Saya"
          period="1 tugas aktif"
          module="Tugas Saya"
          onNavigate={onNavigate}
        >
          <div className="employee-task">
            <span>
              <Icon name="calendar" size={20} />
            </span>
            <div>
              <strong>Unggah bukti TDK-2026-0143</strong>
              <small>Jatuh tempo 2 hari · 02 Nov 2026</small>
            </div>
            <StatusBadge tone="warning">In Progress</StatusBadge>
          </div>
        </Widget>
      </div>
      <Widget
        title="Dokumen Saya"
        period="Status masa berlaku"
        module="Kompetensi & Pelatihan"
        onNavigate={onNavigate}
      >
        <div className="employee-expiry">
          <div>
            <span>MCU</span>
            <ExpiryChip days={18} />
          </div>
          <div>
            <span>Permit Site</span>
            <StatusBadge tone="success">Berlaku</StatusBadge>
          </div>
          <div>
            <span>Sertifikat Teknisi AC</span>
            <ExpiryChip days={64} />
          </div>
        </div>
      </Widget>
    </div>
  )
}

function DrilldownDrawer({
  month,
  onClose,
}: {
  month: string
  onClose: () => void
}) {
  return (
    <>
      <button
        className="drawer-backdrop"
        aria-label="Tutup rincian"
        onClick={onClose}
      />
      <aside className="drilldown-drawer">
        <header>
          <div>
            <span>RINCIAN LEADING INDICATOR</span>
            <h2>{month} 2026</h2>
          </div>
          <IconButton label="Tutup" onClick={onClose}>
            <Icon name="x" />
          </IconButton>
        </header>
        <div className="drawer-summary">
          <div>
            <span>Rencana</span>
            <strong>80</strong>
          </div>
          <div>
            <span>Aktual</span>
            <strong>92</strong>
          </div>
          <div>
            <span>Pencapaian</span>
            <strong>115%</strong>
          </div>
        </div>
        <div className="drawer-records">
          <h3>Catatan aktivitas</h3>
          {[
            ["INS-2026-0230", "Inspeksi Workshop Service", "Closed"],
            ["OBS-2026-0518", "Observasi APD Pit Area", "Closed"],
            ["INS-2026-0224", "Inspeksi unit E51203 · PC1250", "In Progress"],
            [
              "OBS-2026-0509",
              "Observasi housekeeping Warehouse",
              "Menunggu Verifikasi",
            ],
          ].map(([id, title, status]) => (
            <button key={id}>
              <div>
                <strong>{id}</strong>
                <span>{title}</span>
              </div>
              <StatusBadge
                tone={
                  status === "Closed"
                    ? "success"
                    : status === "In Progress"
                      ? "warning"
                      : "verification"
                }
              >
                {status}
              </StatusBadge>
            </button>
          ))}
        </div>
      </aside>
    </>
  )
}

export default function Dashboard({ role, onNavigate }: DashboardProps) {
  const [period, setPeriod] = useState<"Bulan ini" | "YTD">("YTD")
  const [drawerMonth, setDrawerMonth] = useState("")
  const employee = role === "Karyawan"
  const hse = role === "HSE"
  return (
    <section className="page dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1>Dashboard Ringkasan</h1>
          <p>Site MIFA · September 2026</p>
        </div>
        <div className="dashboard-header__actions">
          <span>Diperbarui 31 Okt 2026, 08:15 WIB</span>
          <div className="period-toggle">
            <button
              className={period === "Bulan ini" ? "is-active" : ""}
              onClick={() => setPeriod("Bulan ini")}
            >
              Bulan ini
            </button>
            <button
              className={period === "YTD" ? "is-active" : ""}
              onClick={() => setPeriod("YTD")}
            >
              YTD
            </button>
          </div>
          <Button
            className="export-button"
            onClick={() =>
              window.alert("Ekspor PDF disiapkan untuk prototype.")
            }
          >
            <Icon name="file" size={16} />
            Ekspor PDF
          </Button>
        </div>
      </div>
      {employee ? (
        <EmployeeDashboard onNavigate={onNavigate} />
      ) : (
        <>
          {hse && (
            <div className="hse-top">
              <TaskCards onNavigate={onNavigate} />
              <InspectionSchedule onNavigate={onNavigate} />
            </div>
          )}
          <SafetyStrip period={period} />
          {!hse && <SummaryKpis onNavigate={onNavigate} />}
          <div className="dashboard-split split-2-1">
            <LeadingChart onOpen={setDrawerMonth} onNavigate={onNavigate} />
            <PicaWidget onNavigate={onNavigate} />
          </div>
          {!hse && (
            <>
              <div className="dashboard-split">
                <TspWidget onNavigate={onNavigate} />
                <HealthWidget onNavigate={onNavigate} />
              </div>
              <div className="dashboard-split">
                <AttentionWidget onNavigate={onNavigate} />
                <MaintenanceWidget onNavigate={onNavigate} />
              </div>
              <IssuesTable onNavigate={onNavigate} />
            </>
          )}
        </>
      )}
      {drawerMonth && (
        <DrilldownDrawer
          month={drawerMonth}
          onClose={() => setDrawerMonth("")}
        />
      )}
    </section>
  )
}
