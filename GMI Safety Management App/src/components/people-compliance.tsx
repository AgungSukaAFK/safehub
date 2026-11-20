import { Fragment, useState, type ReactNode } from "react"
import {
  Button,
  ExpiryChip,
  Icon,
  IconButton,
  RestrictedData,
  StatusBadge,
} from "./ui"

type Props = { page: string role: string onNavigate: (page: string) => void }

const people = [
  [
    "GMI-0017",
    "Rudi Hartono",
    "Teknisi AC",
    "Service AC",
    "PKWT",
    "12 Feb 2024",
    "Aktif",
    18,
    "4/5 terpenuhi",
    64,
  ],
  [
    "GMI-0004",
    "Fajar Nugroho",
    "Pengawas Service",
    "Service AC",
    "PKWTT",
    "03 Jan 2021",
    "Aktif",
    124,
    "6/6 terpenuhi",
    21,
  ],
  [
    "GMI-0008",
    "Andi Pratama",
    "HSE Officer",
    "HSE",
    "PKWTT",
    "15 Mar 2022",
    "Aktif",
    240,
    "6/6 terpenuhi",
    186,
  ],
  [
    "GMI-0011",
    "Hendra Wijaya",
    "Planner",
    "Planner",
    "PKWTT",
    "08 Agu 2022",
    "Aktif",
    54,
    "4/4 terpenuhi",
    92,
  ],
  [
    "GMI-0013",
    "Sari Wulandari",
    "Admin Gudang",
    "Warehouse/SCM",
    "PKWT",
    "04 Sep 2023",
    "Aktif",
    27,
    "3/4 terpenuhi",
    14,
  ],
  [
    "GMI-0015",
    "Agus Setiawan",
    "Teknisi AC",
    "Service AC",
    "PKWT",
    "22 Jan 2024",
    "Aktif",
    -12,
    "5/5 terpenuhi",
    70,
  ],
  [
    "GMI-0019",
    "Dedi Irawan",
    "Mekanik",
    "Service AC",
    "PKWT",
    "05 Mei 2024",
    "Aktif",
    88,
    "3/5 terpenuhi",
    115,
  ],
  [
    "GMI-0021",
    "Yusuf Maulana",
    "Teknisi AC",
    "Service AC",
    "PKWT",
    "12 Jun 2024",
    "Aktif",
    204,
    "4/5 terpenuhi",
    -4,
  ],
  [
    "GMI-0006",
    "Bambang Kurniawan",
    "Mekanik",
    "Service AC",
    "PKWTT",
    "01 Jul 2021",
    "Nonaktif",
    -95,
    "2/5 terpenuhi",
    -120,
  ],
] as const

function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="overline">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  )
}

function Manpower({ onNavigate }: Pick<Props, "onNavigate">) {
  const [inactive, setInactive] = useState(false)
  const rows = inactive ? people : people.filter((row) => row[6] === "Aktif")
  const roles = [
    ["Teknisi AC", 12, 11],
    ["Mekanik", 8, 6],
    ["Planner", 3, 3],
    ["Admin", 4, 4],
    ["HSE Officer", 3, 3],
    ["Pengawas", 5, 5],
  ]
  return (
    <section className="page people-page">
      <PageHeader
        eyebrow="PEOPLE & COMPLIANCE"
        title="Manpower"
        description="Data tenaga kerja aktif dan kebutuhan personel Site MIFA."
        action={
          <Button className="create-button">
            <Icon name="plus" size={16} />
            Tambah Karyawan
          </Button>
        }
      />
      <div className="manpower-kpis">
        <article>
          <span>Total aktif</span>
          <strong>
            32 <small>orang</small>
          </strong>
          <p>30 GMI · 2 kontraktor</p>
        </article>
        <article>
          <span>Kebutuhan</span>
          <strong>
            35 <small>orang</small>
          </strong>
          <p>Rencana manpower 2026</p>
        </article>
        <article>
          <span>Pemenuhan</span>
          <strong>
            91<small>%</small>
          </strong>
          <StatusBadge icon="help">
            Definisi kebutuhan menunggu pengesahan
          </StatusBadge>
        </article>
        <article className="is-warning">
          <span>Permit akan kedaluwarsa</span>
          <strong>3</strong>
          <p>≤ 30 hari</p>
        </article>
      </div>
      <div className="manpower-chart-card">
        <header>
          <div>
            <h2>Kebutuhan vs Tersedia per Jabatan</h2>
            <span>Posisi aktif · Oktober 2026</span>
          </div>
          <div className="chart-legend">
            <span>
              <i className="plan" />
              Kebutuhan
            </span>
            <span>
              <i className="actual" />
              Tersedia
            </span>
          </div>
        </header>
        <div className="role-bars">
          {roles.map(([role, need, available]) => (
            <div key={String(role)}>
              <span>{role}</span>
              <div>
                <i
                  className="need-bar"
                  style={{ width: `${(Number(need) / 12) * 100}%` }}
                >
                  <b>{need}</b>
                </i>
                <i
                  className="available-bar"
                  style={{ width: `${(Number(available) / 12) * 100}%` }}
                >
                  <b>{available}</b>
                </i>
              </div>
              <strong className={available < need ? "is-gap" : ""}>
                {Number(need) - Number(available) > 0
                  ? `−${Number(need) - Number(available)}`
                  : "Penuh"}
              </strong>
            </div>
          ))}
        </div>
      </div>
      <div className="people-table-card">
        <header>
          <div>
            <h2>Daftar Manpower</h2>
            <span>{rows.length} dari 33 karyawan</span>
          </div>
          <label className="inactive-toggle">
            <input
              type="checkbox"
              checked={inactive}
              onChange={(e) => setInactive(e.target.checked)}
            />
            <i />
            <span>Tampilkan nonaktif</span>
          </label>
        </header>
        <div className="people-table">
          <table>
            <thead>
              <tr>
                <th>NIK</th>
                <th>Nama</th>
                <th>Jabatan</th>
                <th>Section</th>
                <th>Hubungan Kerja</th>
                <th>Tanggal Mulai</th>
                <th>Status</th>
                <th>MCU</th>
                <th>Kompetensi</th>
                <th>Permit Site</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map(
                ([
                  nik,
                  name,
                  position,
                  section,
                  employment,
                  start,
                  status,
                  mcu,
                  competence,
                  permit,
                ]) => (
                  <tr
                    key={nik}
                    className={name === "Rudi Hartono" ? "is-clickable" : ""}
                    onClick={() =>
                      name === "Rudi Hartono" &&
                      onNavigate("Profil Rudi Hartono")
                    }
                  >
                    <td>
                      <button>{nik}</button>
                    </td>
                    <td>
                      <div className="employee-cell">
                        <span>
                          {name
                            .split(" ")
                            .map((word) => word[0])
                            .slice(0, 2)
                            .join("")}
                        </span>
                        <strong>{name}</strong>
                      </div>
                    </td>
                    <td>{position}</td>
                    <td>{section}</td>
                    <td>{employment}</td>
                    <td>{start}</td>
                    <td>
                      <StatusBadge
                        tone={status === "Aktif" ? "success" : "neutral"}
                      >
                        {status}
                      </StatusBadge>
                    </td>
                    <td>
                      <ExpiryChip days={Number(mcu)} />
                    </td>
                    <td>
                      <span
                        className={
                          String(competence).startsWith("6/6") ||
                          String(competence).startsWith("5/5") ||
                          String(competence).startsWith("4/4")
                            ? "competence-ok"
                            : "competence-gap"
                        }
                      >
                        {competence}
                      </span>
                    </td>
                    <td>
                      <ExpiryChip days={Number(permit)} />
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
        <footer className="table-pagination">
          <span>1–{rows.length} dari 33 karyawan</span>
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

const certificates = [
  [
    "Teknisi Refrigerasi dan Tata Udara",
    "BNSP",
    "BNSP-TRU-2024-01872",
    "15 Mar 2024",
    "15 Mar 2027",
    500,
  ],
  [
    "K3 Umum",
    "Kemnaker RI",
    "K3U/2024/0912",
    "20 Apr 2024",
    "20 Apr 2027",
    535,
  ],
  [
    "Pemadam Kebakaran Kelas D",
    "Disnaker Aceh Barat",
    "DAMKAR-D/2025/027",
    "10 Feb 2025",
    "10 Feb 2027",
    467,
  ],
  [
    "BMC Basic",
    "PT MIFA Bersaudara",
    "BMC-2025-1182",
    "05 Jun 2025",
    "05 Jun 2026",
    217,
  ],
] as const

function EmployeeProfile({ onNavigate }: Pick<Props, "onNavigate">) {
  const [tab, setTab] = useState("Ringkasan")
  return (
    <section className="page employee-profile-page">
      <button className="record-back" onClick={() => onNavigate("Manpower")}>
        <Icon name="arrow-right" size={15} />
        Kembali ke Manpower
      </button>
      <header className="employee-profile-header">
        <div className="profile-photo">RH</div>
        <div>
          <p className="overline">GMI-0017</p>
          <h1>Rudi Hartono</h1>
          <p>Teknisi AC · Service AC</p>
          <div>
            <StatusBadge tone="success">Aktif</StatusBadge>
            <StatusBadge tone="info">PKWT</StatusBadge>
            <ExpiryChip days={64} />
          </div>
        </div>
        <Button className="export-button">Ubah Profil</Button>
      </header>
      <nav className="record-tabs profile-tabs">
        {[
          "Ringkasan",
          "Kompetensi & Sertifikat",
          "Pelatihan",
          "MCU",
          "Permit",
          "Riwayat",
        ].map((item) => (
          <button
            key={item}
            className={tab === item ? "is-active" : ""}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </nav>
      <main className="employee-profile-content">
        {tab === "Ringkasan" && (
          <>
            <div className="profile-summary-grid">
              <section>
                <h2>Informasi Pekerjaan</h2>
                <dl>
                  <div>
                    <dt>NIK</dt>
                    <dd>GMI-0017</dd>
                  </div>
                  <div>
                    <dt>Jabatan</dt>
                    <dd>Teknisi AC</dd>
                  </div>
                  <div>
                    <dt>Section</dt>
                    <dd>Service AC</dd>
                  </div>
                  <div>
                    <dt>Atasan</dt>
                    <dd>Fajar Nugroho</dd>
                  </div>
                  <div>
                    <dt>Tanggal mulai</dt>
                    <dd>12 Feb 2024</dd>
                  </div>
                  <div>
                    <dt>Hubungan kerja</dt>
                    <dd>PKWT</dd>
                  </div>
                </dl>
              </section>
              <section>
                <h2>Status Kepatuhan</h2>
                <div className="compliance-list">
                  <div>
                    <span>MCU</span>
                    <ExpiryChip days={18} />
                  </div>
                  <div>
                    <span>Permit Site</span>
                    <ExpiryChip days={64} />
                  </div>
                  <div>
                    <span>Kompetensi</span>
                    <StatusBadge tone="warning">4/5 terpenuhi</StatusBadge>
                  </div>
                  <div>
                    <span>Pelatihan wajib</span>
                    <StatusBadge tone="success">8/8 selesai</StatusBadge>
                  </div>
                </div>
              </section>
            </div>
            <section className="profile-activity">
              <h2>Aktivitas Terbaru</h2>
              {[
                [
                  "29 Okt 2026",
                  "Mengikuti Safety Talk bulanan",
                  "TSP & Aktivitas",
                ],
                [
                  "25 Okt 2026",
                  "Mengunggah bukti tindakan TDK-2026-0143",
                  "Temuan & PICA",
                ],
                [
                  "18 Okt 2026",
                  "Membuat laporan KJD-2026-0012",
                  "Kejadian & Investigasi",
                ],
              ].map(([date, action, source]) => (
                <div key={date + action}>
                  <i />
                  <span>{date}</span>
                  <p>
                    <strong>{action}</strong>
                    <small>{source}</small>
                  </p>
                </div>
              ))}
            </section>
          </>
        )}
        {tab === "Kompetensi & Sertifikat" && <Certificates />}
        {tab === "Pelatihan" && <ProfileTraining />}
        {tab === "MCU" && (
          <section className="profile-tab-card">
            <h2>Riwayat MCU</h2>
            <div className="profile-mcu-row">
              <div>
                <span>MCU terakhir</span>
                <strong>18 Nov 2025</strong>
              </div>
              <div>
                <span>MCU berikutnya</span>
                <strong>18 Nov 2026</strong>
              </div>
              <StatusBadge tone="warning">
                Akan Kedaluwarsa · 18 hari
              </StatusBadge>
              <StatusBadge tone="success">Fit</StatusBadge>
            </div>
          </section>
        )}
        {tab === "Permit" && (
          <section className="profile-tab-card">
            <h2>Permit Site</h2>
            <div className="certificate-row">
              <span>
                <Icon name="file" size={20} />
              </span>
              <div>
                <strong>Permit Site MIFA 2026</strong>
                <small>
                  Nomor: MIFA-GMI-2026-017 · Berlaku s.d. 03 Jan 2027
                </small>
              </div>
              <StatusBadge tone="success">Berlaku</StatusBadge>
            </div>
          </section>
        )}
        {tab === "Riwayat" && (
          <section className="profile-tab-card">
            <h2>Riwayat Perubahan</h2>
            <div className="audit-timeline">
              <div>
                <i />
                <span>20 Okt 2026</span>
                <strong>Dewi Lestari memperbarui tanggal berakhir PKWT</strong>
                <p>12 Feb 2026 → 12 Feb 2027</p>
              </div>
              <div>
                <i />
                <span>18 Nov 2025</span>
                <strong>Andi Pratama menambahkan hasil MCU</strong>
                <p>Status: Fit</p>
              </div>
            </div>
          </section>
        )}
      </main>
    </section>
  )
}

function Certificates() {
  return (
    <section className="profile-tab-card">
      <header>
        <div>
          <h2>Kompetensi & Sertifikat</h2>
          <p>4 sertifikat aktif · 1 kompetensi belum terpenuhi</p>
        </div>
        <Button className="create-button">
          <Icon name="plus" size={15} />
          Tambah Sertifikat
        </Button>
      </header>
      <div className="certificate-table">
        <table>
          <thead>
            <tr>
              <th>Sertifikat</th>
              <th>Penerbit</th>
              <th>Nomor</th>
              <th>Tanggal Terbit</th>
              <th>Berlaku s.d.</th>
              <th>Status</th>
              <th>File</th>
            </tr>
          </thead>
          <tbody>
            {certificates.map(
              ([name, issuer, number, issued, expiry, days]) => (
                <tr key={name}>
                  <td>
                    <strong>{name}</strong>
                  </td>
                  <td>{issuer}</td>
                  <td>{number}</td>
                  <td>{issued}</td>
                  <td>{expiry}</td>
                  <td>
                    <ExpiryChip days={Number(days)} />
                  </td>
                  <td>
                    <button className="file-preview-button">
                      <Icon name="file" size={16} />
                      PDF
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function ProfileTraining() {
  return (
    <section className="profile-tab-card">
      <h2>Riwayat Pelatihan</h2>
      <div className="training-history">
        {[
          ["Awareness Hand Safety", "15 Agu 2026", "Lulus"],
          ["Basic Mechanical Course", "05 Jun 2025", "Lulus"],
          ["Induksi Site MIFA", "12 Feb 2024", "Lulus"],
        ].map(([name, date, result]) => (
          <div key={name}>
            <span>
              <Icon name="book" size={18} />
            </span>
            <p>
              <strong>{name}</strong>
              <small>{date} · 8 jam</small>
            </p>
            <StatusBadge tone="success">{result}</StatusBadge>
          </div>
        ))}
      </div>
    </section>
  )
}

const competencies = [
  "K3 Umum",
  "P3K",
  "Pemadam Kebakaran",
  "Teknisi Refrigerasi/AC",
  "Pengawas Operasional Pertama",
  "BMC",
]
const competencyPeople = [
  [
    "Rudi Hartono",
    "Teknisi AC",
    "Service AC",
    ["valid", "missing", "valid", "valid", "na", "warning"],
  ],
  [
    "Fajar Nugroho",
    "Pengawas Service",
    "Service AC",
    ["valid", "valid", "valid", "valid", "valid", "warning"],
  ],
  [
    "Andi Pratama",
    "HSE Officer",
    "HSE",
    ["valid", "valid", "valid", "na", "valid", "valid"],
  ],
  [
    "Hendra Wijaya",
    "Planner",
    "Planner",
    ["valid", "expired", "na", "na", "na", "valid"],
  ],
  [
    "Sari Wulandari",
    "Admin Gudang",
    "Warehouse/SCM",
    ["valid", "warning", "valid", "na", "na", "missing"],
  ],
  [
    "Agus Setiawan",
    "Teknisi AC",
    "Service AC",
    ["valid", "valid", "warning", "valid", "na", "valid"],
  ],
] as const

function CompetencyPage({ onNavigate }: Pick<Props, "onNavigate">) {
  const [tab, setTab] = useState<"Matrix Kompetensi" | "Pelatihan & TNA">(
    "Matrix Kompetensi",
  )
  return (
    <section className="page competency-page">
      <PageHeader
        eyebrow="PEOPLE & COMPLIANCE"
        title="Kompetensi & Pelatihan"
        description="Pantau pemenuhan kompetensi dan rencana pelatihan karyawan."
        action={
          <div className="people-subtabs">
            <button
              className={tab === "Matrix Kompetensi" ? "is-active" : ""}
              onClick={() => setTab("Matrix Kompetensi")}
            >
              Matrix Kompetensi
            </button>
            <button
              className={tab === "Pelatihan & TNA" ? "is-active" : ""}
              onClick={() => setTab("Pelatihan & TNA")}
            >
              Pelatihan & TNA
            </button>
          </div>
        }
      />
      {tab === "Matrix Kompetensi" ? (
        <CompetencyMatrix />
      ) : (
        <TrainingPage onNavigate={onNavigate} />
      )}
    </section>
  )
}

function CompetencyMatrix() {
  return (
    <>
      <div className="competency-summary">
        <div>
          <span>Diwajibkan</span>
          <strong>160</strong>
        </div>
        <div>
          <span>Terpenuhi</span>
          <strong>142</strong>
        </div>
        <div className="is-danger">
          <span>Belum terpenuhi</span>
          <strong>9</strong>
        </div>
        <div className="is-warning">
          <span>Akan kedaluwarsa</span>
          <strong>9</strong>
        </div>
      </div>
      <div className="competency-filters">
        {["Jabatan", "Section", "Status"].map((item) => (
          <label key={item}>
            <span>{item}</span>
            <select>
              <option>Semua {item.toLowerCase()}</option>
            </select>
          </label>
        ))}
        <Button className="export-button">
          <Icon name="file" size={15} />
          Ekspor
        </Button>
      </div>
      <div className="competency-matrix">
        <table>
          <thead>
            <tr>
              <th>Karyawan</th>
              <th>Jabatan</th>
              <th>Section</th>
              {competencies.map((item) => (
                <th key={item}>{item}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {competencyPeople.map(([name, position, section, cells]) => (
              <tr key={name}>
                <td>
                  <div className="employee-cell">
                    <span>
                      {String(name)
                        .split(" ")
                        .map((word) => word[0])
                        .slice(0, 2)
                        .join("")}
                    </span>
                    <strong>{name}</strong>
                  </div>
                </td>
                <td>{position}</td>
                <td>{section}</td>
                {cells.map((state, index) => (
                  <td key={index}>
                    <CompetencyCell state={state} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="matrix-legend competency-legend">
        <span>
          <i className="competency-valid">✓</i>Berlaku
        </span>
        <span>
          <i className="competency-warning">!</i>Akan Kedaluwarsa
        </span>
        <span>
          <i className="competency-expired">×</i>Kedaluwarsa
        </span>
        <span>
          <i className="competency-missing">○</i>Belum Ada
        </span>
        <span>
          <i className="competency-na">—</i>Tidak Wajib
        </span>
      </div>
    </>
  )
}

function CompetencyCell({ state }: { state: string }) {
  const labels: Record<string, string> = {
    valid: "Berlaku",
    warning: "Akan Kedaluwarsa · 21 hari",
    expired: "Kedaluwarsa",
    missing: "Belum Ada",
    na: "Tidak Wajib",
  }
  const icons: Record<string, string> = {
    valid: "✓",
    warning: "!",
    expired: "×",
    missing: "○",
    na: "—",
  }
  return (
    <button
      className={`competency-cell competency-${state}`}
      title={labels[state]}
    >
      <i>{icons[state]}</i>
      {state === "warning" && <small>21 hari</small>}
    </button>
  )
}

const trainingPlans = [
  [
    "TRN-2026-031",
    "Awareness AC untuk Mekanik",
    "12 Nov 2026",
    "Workshop Service",
    "18 peserta",
    "Terjadwal",
  ],
  [
    "TRN-2026-030",
    "Refresh Training LOTO",
    "05 Nov 2026",
    "Office GMI",
    "12 peserta",
    "Terjadwal",
  ],
  [
    "TRN-2026-029",
    "Simulasi Pemadam Kebakaran",
    "28 Okt 2026",
    "Workshop Service",
    "32 peserta",
    "Selesai",
  ],
  [
    "TRN-2026-028",
    "Hand Safety Awareness",
    "15 Okt 2026",
    "Office GMI",
    "24 peserta",
    "Selesai",
  ],
] as const

function TrainingPage({ onNavigate }: Pick<Props, "onNavigate">) {
  return (
    <div className="training-layout">
      <section className="training-plan-card">
        <header>
          <div>
            <h2>Rencana Pelatihan</h2>
            <span>Oktober–November 2026</span>
          </div>
          <Button className="create-button">
            <Icon name="plus" size={15} />
            Rencana Baru
          </Button>
        </header>
        <div>
          {trainingPlans.map(
            ([id, name, date, location, participants, status]) => (
              <button
                key={id}
                onClick={() =>
                  name === "Awareness AC untuk Mekanik" &&
                  onNavigate("Pelatihan Awareness AC")
                }
              >
                <span className="training-date">
                  <strong>{date.split(" ")[0]}</strong>
                  <small>{date.split(" ")[1]}</small>
                </span>
                <p>
                  <strong>{name}</strong>
                  <small>
                    {id} · {location} · {participants}
                  </small>
                </p>
                <StatusBadge tone={status === "Selesai" ? "success" : "info"}>
                  {status}
                </StatusBadge>
                <Icon name="arrow-right" size={16} />
              </button>
            ),
          )}
        </div>
      </section>
      <TrainingCalendar />
    </div>
  )
}

function TrainingCalendar() {
  return (
    <section className="training-calendar">
      <header>
        <h2>Kalender Pelatihan</h2>
        <span>November 2026</span>
      </header>
      <div className="mini-calendar">
        <div>
          {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <main>
          {Array.from({ length: 35 }, (_, index) => {
            const day = index - 5
            return (
              <span
                key={index}
                className={`${day === 5 || day === 12 ? "has-training" : ""} ${
                  day < 1 || day > 30 ? "is-outside" : ""
                }`}
              >
                {day < 1 ? 31 + day : day > 30 ? day - 30 : day}
              </span>
            )
          })}
        </main>
      </div>
      <div className="calendar-training-list">
        <div>
          <i />
          <p>
            <strong>05 Nov · Refresh Training LOTO</strong>
            <small>12 peserta</small>
          </p>
        </div>
        <div>
          <i />
          <p>
            <strong>12 Nov · Awareness AC untuk Mekanik</strong>
            <small>18 peserta</small>
          </p>
        </div>
      </div>
    </section>
  )
}

function TrainingDetail({ onNavigate }: Pick<Props, "onNavigate">) {
  const [status, setStatus] = useState("Terjadwal")
  const [attendance, setAttendance] = useState<Record<number, boolean>>({
    0: true,
    1: true,
    2: true,
  })
  const [results, setResults] = useState<Record<number, string>>({
    0: "Lulus",
    1: "Lulus",
    2: "Tidak Lulus",
  })
  const participants = [
    "Dedi Irawan",
    "Agus Setiawan",
    "Rian Saputra",
    "Yusuf Maulana",
    "Bambang Putra",
    "Rio Kurnia",
  ]
  return (
    <section className="page training-detail-page">
      <button
        className="record-back"
        onClick={() => onNavigate("Kompetensi & Pelatihan")}
      >
        <Icon name="arrow-right" size={15} />
        Kembali ke Pelatihan
      </button>
      <header className="training-detail-header">
        <div>
          <p className="overline">TRN-2026-031</p>
          <h1>Awareness AC untuk Mekanik</h1>
          <p>12 Nov 2026 · 08:00–16:00 WIB · Workshop Service</p>
        </div>
        <div>
          <StatusBadge
            tone={
              status === "Selesai"
                ? "success"
                : status === "Berlangsung"
                  ? "warning"
                  : "info"
            }
          >
            {status}
          </StatusBadge>
          <Button
            className="export-button"
            onClick={() =>
              setStatus(status === "Terjadwal" ? "Berlangsung" : "Selesai")
            }
          >
            {status === "Terjadwal" ? "Mulai Pelatihan" : "Tandai Selesai"}
          </Button>
        </div>
      </header>
      <div className="training-detail-grid">
        <main>
          <section className="training-participants">
            <header>
              <div>
                <h2>Peserta</h2>
                <span>{participants.length} peserta terdaftar</span>
              </div>
            </header>
            <table>
              <thead>
                <tr>
                  <th>Peserta</th>
                  <th>Jabatan</th>
                  <th>Kehadiran</th>
                  <th>Hasil</th>
                </tr>
              </thead>
              <tbody>
                {participants.map((name, index) => (
                  <tr key={name}>
                    <td>
                      <div className="employee-cell">
                        <span>
                          {name
                            .split(" ")
                            .map((word) => word[0])
                            .slice(0, 2)
                            .join("")}
                        </span>
                        <strong>{name}</strong>
                      </div>
                    </td>
                    <td>Mekanik</td>
                    <td>
                      <label className="attendance-toggle">
                        <input
                          type="checkbox"
                          checked={!!attendance[index]}
                          onChange={(e) =>
                            setAttendance((current) => ({
                              ...current,
                              [index]: e.target.checked,
                            }))
                          }
                        />
                        <i />
                        <span>
                          {attendance[index] ? "Hadir" : "Tidak Hadir"}
                        </span>
                      </label>
                    </td>
                    <td>
                      <select
                        value={results[index] || ""}
                        onChange={(e) =>
                          setResults((current) => ({
                            ...current,
                            [index]: e.target.value,
                          }))
                        }
                      >
                        <option value="">Belum Dinilai</option>
                        <option>Lulus</option>
                        <option>Tidak Lulus</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </main>
        <aside className="training-sidebar">
          <section>
            <h2>Detail Pelatihan</h2>
            <dl>
              <div>
                <dt>Instruktur</dt>
                <dd>Hendra Wijaya</dd>
              </div>
              <div>
                <dt>Durasi</dt>
                <dd>8 jam</dd>
              </div>
              <div>
                <dt>Target</dt>
                <dd>Seluruh Mekanik</dd>
              </div>
              <div>
                <dt>Sumber TNA</dt>
                <dd>Gap kompetensi Q3</dd>
              </div>
            </dl>
          </section>
          <section>
            <h2>Bukti Pelatihan</h2>
            <button className="training-evidence">
              <Icon name="upload" size={20} />
              <span>Unggah bukti</span>
            </button>
            <div className="evidence-file">
              <Icon name="file" size={17} />
              <span>Materi_Awareness_AC.pdf</span>
            </div>
          </section>
        </aside>
      </div>
    </section>
  )
}

const mcuRows = [
  [
    "GMI-0017",
    "Rudi Hartono",
    "Teknisi AC",
    "18 Nov 2025",
    "18 Nov 2026",
    18,
    "Fit",
  ],
  [
    "GMI-0004",
    "Fajar Nugroho",
    "Pengawas Service",
    "05 Mar 2026",
    "05 Mar 2027",
    125,
    "Fit",
  ],
  [
    "GMI-0008",
    "Andi Pratama",
    "HSE Officer",
    "29 Jun 2026",
    "29 Jun 2027",
    241,
    "Fit",
  ],
  [
    "GMI-0011",
    "Hendra Wijaya",
    "Planner",
    "24 Des 2025",
    "24 Des 2026",
    54,
    "Fit dengan Catatan",
  ],
  [
    "GMI-0013",
    "Sari Wulandari",
    "Admin Gudang",
    "27 Nov 2025",
    "27 Nov 2026",
    27,
    "Fit",
  ],
  [
    "GMI-0015",
    "Agus Setiawan",
    "Teknisi AC",
    "19 Okt 2025",
    "19 Okt 2026",
    -12,
    "Belum Dinilai",
  ],
  [
    "GMI-0019",
    "Dedi Irawan",
    "Mekanik",
    "27 Jan 2026",
    "27 Jan 2027",
    88,
    "Fit dengan Catatan",
  ],
  [
    "GMI-0021",
    "Yusuf Maulana",
    "Teknisi AC",
    "12 Mei 2026",
    "12 Mei 2027",
    193,
    "Fit",
  ],
] as const

function McuPage({ role }: { role: string }) {
  const [selected, setSelected] = useState<string[]>([])
  const [expanded, setExpanded] = useState("")
  const medicalAccess = role === "HSE" || role === "HR"
  return (
    <section className="page mcu-page">
      <PageHeader
        eyebrow="PEOPLE & COMPLIANCE"
        title="MCU"
        description="Pantau masa berlaku pemeriksaan kesehatan dan kelayakan kerja."
        action={
          <Button className="create-button">
            <Icon name="plus" size={15} />
            Tambah Hasil MCU
          </Button>
        }
      />
      <div className="mcu-chips">
        <button>
          <StatusBadge tone="success">Berlaku</StatusBadge>
          <strong>25</strong>
        </button>
        <button>
          <StatusBadge tone="warning">Akan Kedaluwarsa ≤ 30 hari</StatusBadge>
          <strong>5</strong>
        </button>
        <button>
          <StatusBadge tone="danger">Kedaluwarsa</StatusBadge>
          <strong>2</strong>
        </button>
      </div>
      <div className="mcu-table-card">
        <header>
          <div>
            <h2>Daftar MCU Karyawan</h2>
            <span>Per 31 Okt 2026</span>
          </div>
          <Button
            className="export-button"
            disabled={!selected.length}
            onClick={() =>
              window.alert(
                `Pengingat dikirim kepada ${selected.length} karyawan.`,
              )
            }
          >
            <Icon name="bell" size={15} />
            Kirim Pengingat {selected.length ? `(${selected.length})` : ""}
          </Button>
        </header>
        <div className="mcu-table">
          <table>
            <thead>
              <tr>
                <th>
                  <input type="checkbox" aria-label="Pilih semua" />
                </th>
                <th>NIK</th>
                <th>Nama</th>
                <th>Jabatan</th>
                <th>Tanggal MCU</th>
                <th>MCU Berikutnya</th>
                <th>Status Masa Berlaku</th>
                <th>Kelayakan Kerja</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {mcuRows.map(
                ([nik, name, position, date, next, days, fitness]) => (
                  <Fragment key={nik}>
                    <tr
                      className="is-clickable"
                      onClick={() => setExpanded(expanded === nik ? "" : nik)}
                    >
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.includes(nik)}
                          onChange={() =>
                            setSelected((current) =>
                              current.includes(nik)
                                ? current.filter((item) => item !== nik)
                                : [...current, nik],
                            )
                          }
                        />
                      </td>
                      <td>{nik}</td>
                      <td>
                        <div className="employee-cell">
                          <span>
                            {name
                              .split(" ")
                              .map((word) => word[0])
                              .slice(0, 2)
                              .join("")}
                          </span>
                          <strong>{name}</strong>
                        </div>
                      </td>
                      <td>{position}</td>
                      <td>{date}</td>
                      <td>{next}</td>
                      <td>
                        <ExpiryChip days={Number(days)} />
                      </td>
                      <td>
                        <StatusBadge
                          tone={
                            fitness === "Fit"
                              ? "success"
                              : fitness === "Fit dengan Catatan"
                                ? "warning"
                                : "neutral"
                          }
                        >
                          {fitness}
                        </StatusBadge>
                      </td>
                      <td>
                        <Icon name="chevron-down" size={15} />
                      </td>
                    </tr>
                    {expanded === nik && (
                      <tr className="mcu-detail-row">
                        <td colSpan={9}>
                          {medicalAccess ? (
                            <div className="medical-detail">
                              <div>
                                <span>Kesimpulan dokter</span>
                                <strong>{fitness}</strong>
                              </div>
                              <div>
                                <span>Pembatasan kerja</span>
                                <strong>
                                  {fitness === "Fit dengan Catatan"
                                    ? "Hindari paparan bising >85 dB tanpa APD"
                                    : "Tidak ada"}
                                </strong>
                              </div>
                              <div>
                                <span>Fasilitas kesehatan</span>
                                <strong>Klinik MIFA</strong>
                              </div>
                              <button>Lihat dokumen MCU</button>
                            </div>
                          ) : (
                            <RestrictedData />
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ),
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

export default function PeopleCompliance({ page, role, onNavigate }: Props) {
  if (page === "Profil Rudi Hartono")
    return <EmployeeProfile onNavigate={onNavigate} />
  if (page === "Kompetensi & Pelatihan")
    return <CompetencyPage onNavigate={onNavigate} />
  if (page === "Pelatihan Awareness AC")
    return <TrainingDetail onNavigate={onNavigate} />
  if (page === "MCU") return <McuPage role={role} />
  return <Manpower onNavigate={onNavigate} />
}
