import { useState, type ReactNode } from "react"
import { Button, Icon, IconButton, StatusBadge } from "./ui"

type Props = { page: string onNavigate: (page: string) => void }

const reportRows = [
  [
    "LAP-2026-09",
    "Laporan Bulanan Keselamatan Pertambangan",
    "September 2026",
    "F-MAC-HSE-09-002 Rev 4.0",
    "Dalam Review",
    "Andi Pratama",
    "31 Okt 2026",
    "—",
  ],
  [
    "LAP-PJO-2026-09",
    "Evaluasi Monthly PJO",
    "September 2026",
    "F-MAC-IMS-08-015 Rev 8.0",
    "Draft",
    "Andi Pratama",
    "31 Okt 2026",
    "—",
  ],
  [
    "LAP-PJO-2026-08",
    "Evaluasi Monthly PJO",
    "Agustus 2026",
    "F-MAC-IMS-08-015 Rev 8.0",
    "Terbit",
    "Andi Pratama",
    "05 Sep 2026",
    "v1.0",
  ],
  [
    "LAP-PJO-2026-07",
    "Evaluasi Monthly PJO",
    "Juli 2026",
    "F-MAC-IMS-08-015 Rev 8.0",
    "Terbit",
    "Andi Pratama",
    "05 Agu 2026",
    "v1.1",
  ],
] as const

function ReportList({ onNavigate }: Pick<Props, "onNavigate">) {
  const [createOpen, setCreateOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  return (
    <section className="page reports-page">
      <div className="page-heading">
        <div>
          <p className="overline">LAPORAN</p>
          <h1>Laporan Periode</h1>
          <p>Susun, review, setujui, dan terbitkan laporan berkala.</p>
        </div>
        <div className="report-page-actions">
          <Button className="export-button" onClick={() => setExportOpen(true)}>
            <Icon name="file" size={14} />
            Ekspor
          </Button>
          <Button className="create-button" onClick={() => setCreateOpen(true)}>
            <Icon name="plus" size={15} />
            Buat Laporan
          </Button>
        </div>
      </div>
      <div className="report-summary">
        <article>
          <span>Draft</span>
          <strong>2</strong>
        </article>
        <article>
          <span>Dalam Review</span>
          <strong>1</strong>
        </article>
        <article>
          <span>Menunggu Persetujuan</span>
          <strong>1</strong>
        </article>
        <article>
          <span>Terbit 2026</span>
          <strong>8</strong>
        </article>
      </div>
      <div className="report-list-card">
        <header>
          <div>
            <h2>Daftar Laporan</h2>
            <span>Site MIFA · Tahun 2026</span>
          </div>
          <div>
            <button>
              Semua template <Icon name="chevron-down" size={12} />
            </button>
            <button>
              Semua status <Icon name="chevron-down" size={12} />
            </button>
          </div>
        </header>
        <div className="report-list-table">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Nama Laporan</th>
                <th>Periode</th>
                <th>Template & Versi</th>
                <th>Status</th>
                <th>Penyusun</th>
                <th>Diperbarui/Terbit</th>
                <th>Versi</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {reportRows.map(
                ([
                  id,
                  name,
                  period,
                  template,
                  status,
                  author,
                  date,
                  version,
                ]) => (
                  <tr
                    key={id}
                    onClick={() =>
                      status === "Terbit" && period === "Agustus 2026"
                        ? onNavigate("Laporan Agustus 2026")
                        : name === "Evaluasi Monthly PJO" &&
                            period === "September 2026"
                          ? onNavigate("Workspace Laporan PJO")
                          : undefined
                    }
                    className={
                      period === "Agustus 2026" || period === "September 2026"
                        ? "is-clickable"
                        : ""
                    }
                  >
                    <td>
                      <button>{id}</button>
                    </td>
                    <td>
                      <strong>
                        {name} — {period}
                      </strong>
                    </td>
                    <td>{period}</td>
                    <td>{template}</td>
                    <td>
                      <StatusBadge
                        tone={
                          status === "Terbit"
                            ? "success"
                            : status === "Dalam Review"
                              ? "verification"
                              : "neutral"
                        }
                        icon={status === "Terbit" ? "lock" : undefined}
                      >
                        {status}
                      </StatusBadge>
                    </td>
                    <td>{author}</td>
                    <td>{date}</td>
                    <td>{version}</td>
                    <td>
                      <Icon name="more" size={16} />
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </div>
      {createOpen && (
        <CreateReportModal
          onClose={() => setCreateOpen(false)}
          onCreate={() => {
            setCreateOpen(false)
            onNavigate("Workspace Laporan PJO")
          }}
        />
      )}
      {exportOpen && <ExportModal onClose={() => setExportOpen(false)} />}
    </section>
  )
}

function CreateReportModal({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: () => void
}) {
  return (
    <div className="modal-layer">
      <button
        className="modal-backdrop"
        onClick={onClose}
        aria-label="Tutup modal"
      />
      <section className="report-modal">
        <header>
          <div>
            <p className="overline">LAPORAN BARU</p>
            <h2>Buat Laporan</h2>
          </div>
          <IconButton label="Tutup" onClick={onClose}>
            <Icon name="x" />
          </IconButton>
        </header>
        <div>
          <label className="select-field">
            <span>Site *</span>
            <select>
              <option>Site MIFA</option>
            </select>
          </label>
          <label className="select-field">
            <span>Periode *</span>
            <select>
              <option>September 2026</option>
              <option>Oktober 2026</option>
            </select>
          </label>
          <label className="select-field full">
            <span>Template & Versi *</span>
            <select>
              <option>F-MAC-IMS-08-015 Rev 8.0 · Evaluasi Monthly PJO</option>
              <option>
                F-MAC-HSE-09-002 Rev 4.0 · Laporan Bulanan Keselamatan
                Pertambangan
              </option>
            </select>
          </label>
          <div className="template-note">
            <Icon name="help" size={17} />
            <p>
              <strong>Data awal akan ditarik dari sistem</strong>
              <span>
                Anda dapat memeriksa kelengkapan dan memperbarui narasi sebelum
                laporan diajukan.
              </span>
            </p>
          </div>
        </div>
        <footer>
          <Button className="back-button" onClick={onClose}>
            Batal
          </Button>
          <Button className="primary-button" onClick={onCreate}>
            Buat Workspace
          </Button>
        </footer>
      </section>
    </div>
  )
}

const outline = [
  ["1.", "Safety Performance & Pencapaian TSP", "complete"],
  ["a.", "People & Development", "complete"],
  ["a.1", "Man Power Fulfillment", "complete"],
  ["a.2", "Competency Planner/Technician (TNA)", "warning"],
  ["a.3", "Training Participant", "complete"],
  ["a.4", "Data Manpower & Permit", "warning"],
  ["a.5", "Data Metal Scrap", "complete"],
  ["2.", "Maintenance Process", "complete"],
  ["2.1", "PS Accuracy", "info"],
  ["2.2", "Backlog Parts Execution", "complete"],
  ["2.3", "Condition Monitoring", "complete"],
  ["3.", "Result", "complete"],
  ["3.1", "Physical Availability", "complete"],
  ["3.2", "MTBF", "complete"],
  ["3.3", "Redo PS", "complete"],
  ["3.4", "Breakdown Schedule", "complete"],
  ["4.", "Readiness LIB", "warning"],
  ["5.", "Issue", "complete"],
] as const

function Outline({
  selected,
  onSelect,
}: {
  selected: string
  onSelect: (item: string) => void
}) {
  return (
    <aside className="report-outline">
      <header>
        <h2>Outline Template</h2>
        <span>F-MAC-IMS-08-015 Rev 8.0</span>
      </header>
      <nav>
        {outline.map(([number, label, state]) => (
          <button
            key={`${number}-${label}`}
            className={`${selected === label ? "is-active" : ""} level-${
              number.includes(".") && number.length > 2 ? "child" : "parent"
            }`}
            onClick={() => onSelect(label)}
          >
            <span className={`outline-state is-${state}`}>
              {state === "complete" ? (
                <Icon name="check" size={12} />
              ) : state === "warning" ? (
                "!"
              ) : (
                <Icon name="help" size={12} />
              )}
            </span>
            <i>{number}</i>
            <strong>{label}</strong>
          </button>
        ))}
      </nav>
      <footer>
        <div>
          <span>Kelengkapan</span>
          <strong>92%</strong>
        </div>
        <i>
          <b style={{ width: "92%" }} />
        </i>
      </footer>
    </aside>
  )
}

function PreviewPage({
  section,
  onDrilldown,
}: {
  section: string
  onDrilldown: () => void
}) {
  const maintenance = [
    "Maintenance Process",
    "PS Accuracy",
    "Backlog Parts Execution",
    "Condition Monitoring",
  ].includes(section)
  const result = [
    "Result",
    "Physical Availability",
    "MTBF",
    "Redo PS",
    "Breakdown Schedule",
  ].includes(section)
  const title = maintenance
    ? "2. MAINTENANCE PROCESS"
    : result
      ? "3. RESULT"
      : section === "Readiness LIB"
        ? "4. READINESS LIB"
        : section === "Issue"
          ? "5. ISSUE"
          : "1. SAFETY PERFORMANCE & PENCAPAIAN TSP"
  return (
    <div className="report-preview-area">
      <div className="preview-toolbar">
        <div>
          <button>−</button>
          <span>85%</span>
          <button>+</button>
        </div>
        <span>Pratinjau langsung · A4</span>
        <button>
          <Icon name="more" size={16} />
        </button>
      </div>
      <article className="report-a4">
        <header>
          <div className="report-logo">GMI</div>
          <div>
            <strong>EVALUASI MONTHLY PJO</strong>
            <span>PT Garuda Mart Indonesia · Site MIFA</span>
          </div>
          <dl>
            <div>
              <dt>Periode</dt>
              <dd>September 2026</dd>
            </div>
            <div>
              <dt>Template</dt>
              <dd>Rev 8.0</dd>
            </div>
          </dl>
        </header>
        <h1>{title}</h1>
        {maintenance ? (
          <MaintenancePreview onDrilldown={onDrilldown} />
        ) : result ? (
          <ResultPreview onDrilldown={onDrilldown} />
        ) : section === "Readiness LIB" ? (
          <LibPreview onDrilldown={onDrilldown} />
        ) : section === "Issue" ? (
          <IssuePreview onDrilldown={onDrilldown} />
        ) : (
          <SafetyPreview onDrilldown={onDrilldown} />
        )}
        <footer>
          <span>Evaluasi Monthly PJO · September 2026</span>
          <span>Halaman 3 dari 14</span>
        </footer>
      </article>
    </div>
  )
}

function SourceLine({ count, onClick }: { count: string onClick: () => void }) {
  return (
    <p className="report-source">
      Sumber: {count} record · <button onClick={onClick}>Lihat data</button>
    </p>
  )
}

function ReportBlock({
  title,
  children,
  source,
  onDrilldown,
}: {
  title: string
  children: ReactNode
  source: string
  onDrilldown: () => void
}) {
  return (
    <section className="report-block">
      <h2>{title}</h2>
      {children}
      <SourceLine count={source} onClick={onDrilldown} />
    </section>
  )
}

function SafetyPreview({ onDrilldown }: { onDrilldown: () => void }) {
  return (
    <>
      <div className="report-stat-row">
        {[
          ["Fatality", "NIHIL"],
          ["LTI", "NIHIL"],
          ["Near Miss", "NIHIL"],
          ["Jam Kerja", "95.106"],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong className={value === "NIHIL" ? "is-zero" : ""}>
              {value}
            </strong>
            <small>YTD September 2026</small>
          </div>
        ))}
      </div>
      <ReportBlock
        title="1.1 Pencapaian TSP"
        source="22"
        onDrilldown={onDrilldown}
      >
        <div className="report-progress-table">
          {[
            ["Kebijakan", 96],
            ["Perencanaan", 84],
            ["Organisasi & Personel", 91],
            ["Implementasi", 78],
            ["Evaluasi", 88],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <span>{label}</span>
              <i>
                <b style={{ width: `${value}%` }} />
              </i>
              <strong>{value}%</strong>
            </div>
          ))}
        </div>
      </ReportBlock>
      <ReportBlock
        title="1.2 Leading Indicator"
        source="47"
        onDrilldown={onDrilldown}
      >
        <div className="report-mini-bars">
          {[78, 86, 72, 94, 88, 92].map((value, index) => (
            <div key={index}>
              <i style={{ height: `${value}%` }} />
              <span>{["Apr", "Mei", "Jun", "Jul", "Agu", "Sep"][index]}</span>
            </div>
          ))}
        </div>
      </ReportBlock>
    </>
  )
}

function MaintenancePreview({ onDrilldown }: { onDrilldown: () => void }) {
  return (
    <>
      <ReportBlock
        title="2.1 PS Accuracy"
        source="24"
        onDrilldown={onDrilldown}
      >
        <div className="report-kpi-line">
          <strong>87,5%</strong>
          <div>
            <span>21 dari 24 pekerjaan PS akurat</span>
            <StatusBadge icon="help">Rumus belum disahkan</StatusBadge>
          </div>
        </div>
        <div className="report-grouped-bars">
          {[
            ["Apr", 18, 17],
            ["Mei", 20, 18],
            ["Jun", 16, 15],
            ["Jul", 22, 20],
            ["Agu", 19, 17],
            ["Sep", 24, 21],
          ].map(([month, plan, actual]) => (
            <div key={String(month)}>
              <span>
                <i style={{ height: `${Number(plan) * 3}%` }} />
                <b style={{ height: `${Number(actual) * 3}%` }} />
              </span>
              <small>{month}</small>
            </div>
          ))}
        </div>
      </ReportBlock>
      <ReportBlock
        title="2.2 Backlog Parts Execution"
        source="11"
        onDrilldown={onDrilldown}
      >
        <table className="report-table">
          <thead>
            <tr>
              <th>Unit</th>
              <th>Open</th>
              <th>In Progress</th>
              <th>Overdue</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>H57197 · HD785-7</td>
              <td>2</td>
              <td>1</td>
              <td>0</td>
            </tr>
            <tr>
              <td>E51203 · PC1250</td>
              <td>3</td>
              <td>1</td>
              <td>1</td>
            </tr>
            <tr>
              <td>E5126 · PC2000</td>
              <td>2</td>
              <td>2</td>
              <td>1</td>
            </tr>
          </tbody>
        </table>
      </ReportBlock>
    </>
  )
}

function ResultPreview({ onDrilldown }: { onDrilldown: () => void }) {
  return (
    <>
      <div className="report-stat-row">
        {[
          ["Physical Availability", "92,4%"],
          ["MTBF", "412 jam"],
          ["MTTR", "3,6 jam"],
          ["Redo PS", "2"],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>September 2026</small>
          </div>
        ))}
      </div>
      <ReportBlock
        title="3.1 Physical Availability vs Target"
        source="5 unit"
        onDrilldown={onDrilldown}
      >
        <div className="report-pa-chart">
          {[89, 91, 90, 93, 91, 92].map((value, index) => (
            <div key={index}>
              <i style={{ height: `${value}%` }} />
              <span>{["Apr", "Mei", "Jun", "Jul", "Agu", "Sep"][index]}</span>
            </div>
          ))}
        </div>
      </ReportBlock>
      <ReportBlock
        title="3.2 Catatan Kinerja"
        source="8"
        onDrilldown={onDrilldown}
      >
        <p className="report-narrative-text">
          PA September mencapai 92,4%, di atas target 90%. MTBF meningkat 18 jam
          dibanding Agustus, sementara dua pekerjaan Redo PS masih memerlukan
          evaluasi supervisor.
        </p>
      </ReportBlock>
    </>
  )
}

function LibPreview({ onDrilldown }: { onDrilldown: () => void }) {
  return (
    <>
      <ReportBlock
        title="4.1 Readiness Inventory"
        source="486 item"
        onDrilldown={onDrilldown}
      >
        <div className="report-lib">
          <div className="report-donut">
            <span>
              486<small>Item</small>
            </span>
          </div>
          <div>
            <p>
              <i className="fast" />
              Fast Moving <strong>312</strong>
            </p>
            <p>
              <i className="slow" />
              Slow Moving <strong>118</strong>
            </p>
            <p>
              <i className="non" />
              Non-Moving <strong>56</strong>
            </p>
          </div>
        </div>
        <StatusBadge icon="help">
          Aturan klasifikasi contoh — menunggu pengesahan
        </StatusBadge>
      </ReportBlock>
    </>
  )
}

function IssuePreview({ onDrilldown }: { onDrilldown: () => void }) {
  return (
    <ReportBlock title="5.1 Isu Terbuka" source="4" onDrilldown={onDrilldown}>
      <table className="report-table">
        <thead>
          <tr>
            <th>Isu</th>
            <th>PIC</th>
            <th>Due Date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Pemenuhan audit CSMS</td>
            <td>Budi Santoso</td>
            <td>15 Okt 2026</td>
            <td>In Progress</td>
          </tr>
          <tr>
            <td>Revisi KPI MTTR dan MTBF</td>
            <td>Hendra Wijaya</td>
            <td>21 Okt 2026</td>
            <td>Open</td>
          </tr>
          <tr>
            <td>Perbaikan health performance</td>
            <td>Andi Pratama</td>
            <td>05 Okt 2026</td>
            <td>Overdue</td>
          </tr>
        </tbody>
      </table>
    </ReportBlock>
  )
}

function CompletenessPanel({
  onReturn,
  onExport,
}: {
  onReturn: () => void
  onExport: () => void
}) {
  const [stage, setStage] = useState("Review Pemilik Data")
  const gaps = [
    ["2 kejadian belum diklasifikasi", "Kejadian & Investigasi"],
    ["MCU 3 karyawan belum diperbarui", "MCU"],
    ["PS Accuracy: rumus belum disahkan", "Kamus KPI"],
    ["Bukti TSP 1.2 bulan September belum diunggah", "TSP & Aktivitas"],
  ]
  return (
    <aside className="report-review-panel">
      <section>
        <header>
          <h2>Pemeriksaan Kelengkapan</h2>
          <strong>92%</strong>
        </header>
        <i className="completeness-track">
          <b style={{ width: "92%" }} />
        </i>
        <div className="report-gaps">
          {gaps.map(([gap, link], index) => (
            <button key={gap}>
              <span className={index < 2 ? "is-warning" : "is-info"}>
                {index < 2 ? "!" : "i"}
              </span>
              <p>
                <strong>{gap}</strong>
                <small>Buka {link} →</small>
              </p>
            </button>
          ))}
        </div>
      </section>
      <section>
        <header>
          <h2>Persetujuan</h2>
        </header>
        <div className="report-approval-flow">
          <div className="is-done">
            <span>
              <Icon name="check" size={13} />
            </span>
            <p>
              <strong>Disusun HSE</strong>
              <small>Andi Pratama · 31 Okt 2026</small>
            </p>
          </div>
          <div
            className={
              stage === "Review Pemilik Data" ? "is-current" : "is-done"
            }
          >
            <span>
              {stage === "Review Pemilik Data" ? (
                "2"
              ) : (
                <Icon name="check" size={13} />
              )}
            </span>
            <p>
              <strong>Review Pemilik Data</strong>
              <small>
                {stage === "Review Pemilik Data"
                  ? "Sedang berlangsung"
                  : "Disetujui Hendra Wijaya"}
              </small>
            </p>
          </div>
          <div className={stage === "Persetujuan PJO" ? "is-current" : ""}>
            <span>3</span>
            <p>
              <strong>Persetujuan PJO</strong>
              <small>
                {stage === "Persetujuan PJO"
                  ? "Menunggu keputusan"
                  : "Belum dimulai"}
              </small>
            </p>
          </div>
          <div>
            <span>4</span>
            <p>
              <strong>Persetujuan Manajemen</strong>
              <small>Belum dimulai</small>
            </p>
          </div>
        </div>
        <div className="report-approval-actions">
          <Button
            className="primary-button"
            onClick={() => setStage("Persetujuan PJO")}
          >
            {stage === "Review Pemilik Data" ? "Ajukan" : "Setujui"}
          </Button>
          <Button className="return-button" onClick={onReturn}>
            Kembalikan untuk Perbaikan
          </Button>
        </div>
      </section>
      <Button className="export-report-button" onClick={onExport}>
        <Icon name="file" size={15} />
        Ekspor Laporan
      </Button>
    </aside>
  )
}

function Workspace({ onNavigate }: Pick<Props, "onNavigate">) {
  const [selected, setSelected] = useState(
    "Safety Performance & Pencapaian TSP",
  )
  const [drawer, setDrawer] = useState(false)
  const [returnModal, setReturnModal] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  return (
    <section className="report-workspace-page">
      <header className="workspace-report-header">
        <div>
          <button onClick={() => onNavigate("Laporan Periode")}>
            <Icon name="arrow-right" size={14} />
            Laporan Periode
          </button>
          <h1>Evaluasi Monthly PJO — September 2026</h1>
          <span>LAP-PJO-2026-09 · F-MAC-IMS-08-015 Rev 8.0</span>
        </div>
        <div>
          <StatusBadge tone="verification">Dalam Review</StatusBadge>
          <span>Draf tersimpan · 08:54</span>
        </div>
      </header>
      <div className="report-workspace-grid">
        <Outline selected={selected} onSelect={setSelected} />
        <PreviewPage section={selected} onDrilldown={() => setDrawer(true)} />
        <CompletenessPanel
          onReturn={() => setReturnModal(true)}
          onExport={() => setExportOpen(true)}
        />
      </div>
      {drawer && <SourceDrawer onClose={() => setDrawer(false)} />}
      {returnModal && <ReturnModal onClose={() => setReturnModal(false)} />}
      {exportOpen && <ExportModal onClose={() => setExportOpen(false)} />}
    </section>
  )
}

function SourceDrawer({ onClose }: { onClose: () => void }) {
  return (
    <>
      <button
        className="drawer-backdrop"
        onClick={onClose}
        aria-label="Tutup rincian"
      />
      <aside className="source-drawer">
        <header>
          <div>
            <p className="overline">SUMBER DATA</p>
            <h2>Leading Indicator · September 2026</h2>
          </div>
          <IconButton label="Tutup" onClick={onClose}>
            <Icon name="x" />
          </IconButton>
        </header>
        <div>
          <div className="source-summary">
            <span>47 record</span>
            <StatusBadge tone="success">46 lengkap</StatusBadge>
            <StatusBadge tone="warning">1 perlu review</StatusBadge>
          </div>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Aktivitas</th>
                <th>Tanggal</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>INS-2026-0230</td>
                <td>Inspeksi Workshop Service</td>
                <td>29 Sep 2026</td>
                <td>
                  <StatusBadge tone="success">Closed</StatusBadge>
                </td>
              </tr>
              <tr>
                <td>OBS-2026-0518</td>
                <td>Observasi APD Pit Area</td>
                <td>27 Sep 2026</td>
                <td>
                  <StatusBadge tone="success">Closed</StatusBadge>
                </td>
              </tr>
              <tr>
                <td>TSP-ACT-0098</td>
                <td>Safety Talk Bulanan</td>
                <td>29 Sep 2026</td>
                <td>
                  <StatusBadge tone="warning">Kurang Bukti</StatusBadge>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </aside>
    </>
  )
}

function ReturnModal({ onClose }: { onClose: () => void }) {
  const [comment, setComment] = useState("")
  return (
    <div className="modal-layer">
      <button className="modal-backdrop" onClick={onClose} aria-label="Tutup" />
      <section className="report-modal return-report-modal">
        <header>
          <div>
            <p className="overline">PERBAIKAN LAPORAN</p>
            <h2>Kembalikan untuk Perbaikan</h2>
          </div>
          <IconButton label="Tutup" onClick={onClose}>
            <Icon name="x" />
          </IconButton>
        </header>
        <div>
          <label className="textarea-field full">
            <span>Catatan perbaikan *</span>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Jelaskan data atau bagian yang harus diperbaiki"
            />
          </label>
        </div>
        <footer>
          <Button className="back-button" onClick={onClose}>
            Batal
          </Button>
          <Button
            className="primary-button"
            disabled={!comment.trim()}
            onClick={onClose}
          >
            Kembalikan
          </Button>
        </footer>
      </section>
    </div>
  )
}

function Published({ onNavigate }: Pick<Props, "onNavigate">) {
  const [correction, setCorrection] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  return (
    <section className="page published-report-page">
      <button
        className="record-back"
        onClick={() => onNavigate("Laporan Periode")}
      >
        <Icon name="arrow-right" size={14} />
        Kembali ke daftar laporan
      </button>
      <div className="locked-report-banner">
        <Icon name="lock" size={20} />
        <p>
          <strong>Versi 1.0 · Terbit 05 Sep 2026</strong>
          <span>
            Disetujui oleh Budi Santoso (PJO) · Snapshot terkunci — perubahan
            data tidak mengubah laporan ini.
          </span>
        </p>
      </div>
      <header className="published-report-header">
        <div>
          <p className="overline">LAP-PJO-2026-08</p>
          <h1>Evaluasi Monthly PJO — Agustus 2026</h1>
          <p>F-MAC-IMS-08-015 Rev 8.0</p>
        </div>
        <div>
          <Button className="export-button" onClick={() => setExportOpen(true)}>
            <Icon name="file" size={14} />
            Ekspor
          </Button>
          <Button className="create-button" onClick={() => setCorrection(true)}>
            Buat Koreksi (Versi 1.1)
          </Button>
        </div>
      </header>
      <div className="published-layout">
        <div className="published-preview">
          <PreviewPage
            section="Safety Performance & Pencapaian TSP"
            onDrilldown={() => {}}
          />
        </div>
        <aside className="version-history">
          <h2>Riwayat Versi</h2>
          <div className="is-current">
            <span>v1.0</span>
            <p>
              <strong>Versi terbit</strong>
              <small>05 Sep 2026 · Budi Santoso</small>
            </p>
            <StatusBadge icon="lock" tone="success">
              Terkunci
            </StatusBadge>
          </div>
          <div>
            <span>Draft</span>
            <p>
              <strong>Diajukan untuk persetujuan</strong>
              <small>03 Sep 2026 · Andi Pratama</small>
            </p>
          </div>
          <div>
            <span>Draft</span>
            <p>
              <strong>Workspace dibuat</strong>
              <small>31 Agu 2026 · Sistem</small>
            </p>
          </div>
        </aside>
      </div>
      {correction && <CorrectionModal onClose={() => setCorrection(false)} />}
      {exportOpen && <ExportModal onClose={() => setExportOpen(false)} />}
    </section>
  )
}

function CorrectionModal({ onClose }: { onClose: () => void }) {
  const [reason, setReason] = useState("")
  return (
    <div className="modal-layer">
      <button className="modal-backdrop" onClick={onClose} aria-label="Tutup" />
      <section className="report-modal return-report-modal">
        <header>
          <div>
            <p className="overline">KOREKSI SNAPSHOT</p>
            <h2>Buat Koreksi Versi 1.1</h2>
          </div>
          <IconButton label="Tutup" onClick={onClose}>
            <Icon name="x" />
          </IconButton>
        </header>
        <div>
          <div className="correction-note">
            <Icon name="lock" size={17} />
            <p>Versi 1.0 tetap tersimpan dan tidak akan ditimpa.</p>
          </div>
          <label className="textarea-field full">
            <span>Alasan koreksi *</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Jelaskan data atau informasi yang harus dikoreksi"
            />
          </label>
        </div>
        <footer>
          <Button className="back-button" onClick={onClose}>
            Batal
          </Button>
          <Button
            className="primary-button"
            disabled={!reason.trim()}
            onClick={onClose}
          >
            Buat Versi 1.1
          </Button>
        </footer>
      </section>
    </div>
  )
}

function ExportModal({ onClose }: { onClose: () => void }) {
  const [format, setFormat] = useState("PDF")
  const [attachment, setAttachment] = useState(true)
  const [sections, setSections] = useState([
    "Safety Performance",
    "Maintenance Process",
    "Result",
    "Readiness LIB",
    "Issue",
  ])
  return (
    <div className="modal-layer">
      <button className="modal-backdrop" onClick={onClose} aria-label="Tutup" />
      <section className="export-modal">
        <header>
          <div>
            <p className="overline">EKSPOR LAPORAN</p>
            <h2>Atur File Ekspor</h2>
          </div>
          <IconButton label="Tutup" onClick={onClose}>
            <Icon name="x" />
          </IconButton>
        </header>
        <div>
          <fieldset>
            <legend>Format</legend>
            <div className="format-options">
              {["PDF", "XLSX"].map((item) => (
                <button
                  key={item}
                  className={format === item ? "is-active" : ""}
                  onClick={() => setFormat(item)}
                >
                  <Icon name="file" size={20} />
                  <strong>{item}</strong>
                  <small>
                    {item === "PDF"
                      ? "Dokumen siap cetak"
                      : "Data dan tabel kerja"}
                  </small>
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Bagian yang disertakan</legend>
            <div className="export-sections">
              {[
                "Safety Performance",
                "Maintenance Process",
                "Result",
                "Readiness LIB",
                "Issue",
              ].map((item) => (
                <label key={item}>
                  <input
                    type="checkbox"
                    checked={sections.includes(item)}
                    onChange={() =>
                      setSections((current) =>
                        current.includes(item)
                          ? current.filter((value) => value !== item)
                          : [...current, item],
                      )
                    }
                  />
                  <span>
                    <Icon name="check" size={13} />
                  </span>
                  {item}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="attachment-toggle">
            <span>
              <strong>Sertakan lampiran</strong>
              <small>Bukti, foto, dan dokumen pendukung</small>
            </span>
            <input
              type="checkbox"
              checked={attachment}
              onChange={(e) => setAttachment(e.target.checked)}
            />
            <i />
          </label>
          <div className="export-privacy">
            <Icon name="shield" size={18} />
            <p>
              File ekspor menyertakan definisi periode, satuan, label status dan
              waktu pembuatan. Ekspor hanya mencakup data sesuai hak akses Anda.
            </p>
          </div>
        </div>
        <footer>
          <Button className="back-button" onClick={onClose}>
            Batal
          </Button>
          <Button
            className="primary-button"
            disabled={!sections.length}
            onClick={onClose}
          >
            Ekspor {format}
          </Button>
        </footer>
      </section>
    </div>
  )
}

export default function ReportManagement({ page, onNavigate }: Props) {
  if (page === "Workspace Laporan PJO")
    return <Workspace onNavigate={onNavigate} />
  if (page === "Laporan Agustus 2026")
    return <Published onNavigate={onNavigate} />
  return <ReportList onNavigate={onNavigate} />
}
