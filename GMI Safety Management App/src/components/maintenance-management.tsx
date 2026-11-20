import { useState, type ReactNode } from "react"
import { Button, Icon, IconButton, StatusBadge } from "./ui"

type Props = { page: string onNavigate: (page: string) => void }

function MaintenanceFilters() {
  return (
    <div className="maintenance-filters">
      {[
        ["Periode", "September 2026"],
        ["Section", "Semua section"],
        ["Model Unit", "Semua model"],
        ["Unit", "Semua unit"],
      ].map(([label, value]) => (
        <label key={label}>
          <span>{label}</span>
          <select>
            <option>{value}</option>
            {label === "Model Unit" && (
              <>
                <option>HD785-7</option>
                <option>PC1250</option>
                <option>PC2000</option>
                <option>GD825A</option>
              </>
            )}
          </select>
        </label>
      ))}
      <Button className="export-button">
        <Icon name="file" size={14} />
        Ekspor
      </Button>
    </div>
  )
}

function MaintenancePage({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="page maintenance-page">
      <div className="page-heading">
        <div>
          <p className="overline">MAINTENANCE</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </div>
      <MaintenanceFilters />
      {children}
    </section>
  )
}

const metricInfo: Record<string, string> = {
  "Physical Availability":
    "Numerator: waktu tersedia. Denominator: waktu kalender dikurangi planned downtime. Target: 90%. Sumber: data unit.",
  "PS Accuracy":
    "Numerator: PS dalam toleransi HM. Denominator: seluruh PS aktual. Toleransi: ±50 HM. Sumber: PS_September2026.xlsx.",
  MTBF: "Numerator: total jam operasi. Denominator: jumlah breakdown. Sumber: histori breakdown.",
  MTTR: "Numerator: total jam perbaikan. Denominator: jumlah breakdown. Sumber: work order.",
  "Redo PS":
    "Jumlah pekerjaan PS yang harus dikerjakan ulang. Sumber: evaluasi supervisor.",
  "Backlog Open":
    "Jumlah backlog dengan status Open atau In Progress. Sumber: register backlog.",
  "MR Open": "Jumlah Material Request yang belum Closed. Sumber: register MR.",
}

function MetricCard({
  label,
  value,
  unit,
  target,
  governance,
}: {
  label: string
  value: string
  unit?: string
  target?: string
  governance?: boolean
}) {
  return (
    <article className="maintenance-kpi">
      <header>
        <span>{label}</span>
        <IconButton label={metricInfo[label]}>
          <Icon name="help" size={14} />
        </IconButton>
      </header>
      <strong>
        {value} {unit && <small>{unit}</small>}
      </strong>
      {target && <p>{target}</p>}
      {governance && (
        <StatusBadge icon="help">Rumus belum disahkan</StatusBadge>
      )}
      <footer>September 2026 · Diperbarui 31 Okt</footer>
    </article>
  )
}

const months = ["Apr", "Mei", "Jun", "Jul", "Agu", "Sep"]

function ChartCard({
  title,
  subtitle,
  info,
  children,
}: {
  title: string
  subtitle: string
  info: string
  children: ReactNode
}) {
  return (
    <article className="maintenance-chart">
      <header>
        <div>
          <h2>{title}</h2>
          <span>{subtitle}</span>
        </div>
        <IconButton label={info}>
          <Icon name="help" size={15} />
        </IconButton>
      </header>
      {children}
    </article>
  )
}

function PaChart() {
  const values = [89, 91, 90, 93, 91, 92.4]
  return (
    <ChartCard
      title="PA per Bulan vs Target"
      subtitle="Apr–Sep 2026 · Target 90%"
      info="Physical Availability aktual dibanding target bulanan."
    >
      <div className="maintenance-legend">
        <span>
          <i className="actual" />
          Aktual
        </span>
        <span>
          <i className="target" />
          Target 90%
        </span>
      </div>
      <div className="vertical-bar-chart">
        <i className="chart-target">
          <span>90%</span>
        </i>
        {values.map((value, index) => (
          <div key={months[index]}>
            <span>
              <i style={{ height: `${value}%` }}>
                <b>{String(value).replace(".", ",")}%</b>
              </i>
            </span>
            <small>{months[index]}</small>
          </div>
        ))}
      </div>
    </ChartCard>
  )
}

function PsChart() {
  const values = [
    [18, 17],
    [20, 18],
    [16, 15],
    [22, 20],
    [19, 17],
    [24, 21],
  ]
  return (
    <ChartCard
      title="PS Rencana vs Aktual"
      subtitle="Jumlah pekerjaan per bulan"
      info="Jumlah PS yang direncanakan dibanding pekerjaan aktual."
    >
      <div className="maintenance-legend">
        <span>
          <i className="plan" />
          Rencana
        </span>
        <span>
          <i className="actual" />
          Aktual
        </span>
      </div>
      <div className="grouped-maintenance-bars">
        {values.map(([plan, actual], index) => (
          <div key={months[index]}>
            <span>
              <i className="plan" style={{ height: `${plan * 4}%` }} />
              <i className="actual" style={{ height: `${actual * 4}%` }} />
            </span>
            <small>{months[index]}</small>
          </div>
        ))}
      </div>
    </ChartCard>
  )
}

function ReliabilityChart() {
  return (
    <ChartCard
      title="Tren MTBF & MTTR"
      subtitle="Apr–Sep 2026 · jam"
      info="MTBF lebih tinggi dan MTTR lebih rendah menunjukkan performa lebih baik."
    >
      <div className="maintenance-legend">
        <span>
          <i className="actual" />
          MTBF
        </span>
        <span>
          <i className="mttr" />
          MTTR
        </span>
      </div>
      <svg
        className="reliability-chart"
        viewBox="0 0 500 180"
        role="img"
        aria-label="Tren MTBF meningkat dan MTTR menurun"
      >
        <path className="grid" d="M35 25H485M35 75H485M35 125H485" />
        <path
          className="mtbf"
          d="M40 115 125 100 210 105 295 72 380 58 475 40"
        />
        <path
          className="mttr-line"
          d="M40 52 125 60 210 56 295 80 380 88 475 98"
        />
        {months.map((month, index) => (
          <text key={month} x={40 + index * 87} y="165">
            {month}
          </text>
        ))}
      </svg>
    </ChartCard>
  )
}

function BreakdownChart() {
  const values = [
    [62, 38],
    [68, 32],
    [66, 34],
    [72, 28],
    [70, 30],
    [74, 26],
  ]
  return (
    <ChartCard
      title="Breakdown Terjadwal vs Tidak Terjadwal"
      subtitle="Proporsi downtime per bulan"
      info="Persentase downtime terjadwal dan tidak terjadwal dari seluruh downtime."
    >
      <div className="maintenance-legend">
        <span>
          <i className="scheduled" />
          Terjadwal
        </span>
        <span>
          <i className="unscheduled" />
          Tidak Terjadwal
        </span>
      </div>
      <div className="stacked-breakdown">
        {values.map(([scheduled, unscheduled], index) => (
          <div key={months[index]}>
            <span>{months[index]}</span>
            <i>
              <b style={{ width: `${scheduled}%` }}>{scheduled}%</b>
              <em style={{ width: `${unscheduled}%` }}>{unscheduled}%</em>
            </i>
          </div>
        ))}
      </div>
    </ChartCard>
  )
}

function BacklogChart() {
  const units = [
    ["H57197", 2, 1, 0],
    ["E51203", 3, 1, 1],
    ["G5809", 1, 2, 0],
    ["DA54853", 2, 0, 1],
    ["E5126", 2, 2, 1],
  ]
  return (
    <ChartCard
      title="Backlog per Unit"
      subtitle="Open · In Progress · Overdue"
      info="Jumlah backlog aktif dikelompokkan per unit dan status."
    >
      <div className="maintenance-legend">
        <span>
          <i className="open" />
          Open
        </span>
        <span>
          <i className="progress" />
          In Progress
        </span>
        <span>
          <i className="overdue" />
          Overdue
        </span>
      </div>
      <div className="unit-backlog-bars">
        {units.map(([unit, open, progress, overdue]) => (
          <div key={String(unit)}>
            <span>{unit}</span>
            <i>
              <b style={{ width: `${Number(open) * 16}%` }} />
              <em style={{ width: `${Number(progress) * 16}%` }} />
              <u style={{ width: `${Number(overdue) * 16}%` }} />
            </i>
            <strong>{Number(open) + Number(progress) + Number(overdue)}</strong>
          </div>
        ))}
      </div>
    </ChartCard>
  )
}

function DashboardMaintenance() {
  return (
    <MaintenancePage
      title="Dashboard Maintenance"
      description="Ringkasan performa maintenance unit Site MIFA."
    >
      <div className="data-source-banner">
        <Icon name="file" size={18} />
        <p>
          <strong>Data PS diimpor dari PS_September2026.xlsx</strong>
          <span>31 Okt 2026 07:50 · oleh Hendra Wijaya</span>
        </p>
        <StatusBadge tone="danger">2 baris gagal validasi</StatusBadge>
        <button
          onClick={() =>
            window.alert(
              "Baris 18: HM aktual kosong. Baris 42: unit tidak ditemukan.",
            )
          }
        >
          Lihat detail →
        </button>
      </div>
      <div className="maintenance-kpis">
        <MetricCard
          label="Physical Availability"
          value="92,4%"
          target="Target 90% · +2,4 poin"
        />
        <MetricCard label="PS Accuracy" value="87,5%" governance />
        <MetricCard
          label="MTBF"
          value="412"
          unit="jam"
          target="↑ 18 jam vs Agustus"
        />
        <MetricCard
          label="MTTR"
          value="3,6"
          unit="jam"
          target="↓ 0,4 jam vs Agustus"
        />
        <MetricCard label="Redo PS" value="2" target="Target ≤ 1" />
        <MetricCard
          label="Backlog Open"
          value="11"
          target="3 prioritas tinggi"
        />
        <MetricCard label="MR Open" value="7" target="4 status Waiting" />
      </div>
      <div className="maintenance-charts-grid">
        <PaChart />
        <PsChart />
        <ReliabilityChart />
        <BreakdownChart />
        <BacklogChart />
      </div>
    </MaintenancePage>
  )
}

const psRows = [
  [
    "H57197 · HD785-7",
    "PS2",
    "10.500",
    "10.532",
    "28 Sep 2026",
    "29 Sep 2026",
    "+32 HM",
    true,
    "Selesai",
  ],
  [
    "E51203 · PC1250",
    "PS1",
    "8.000",
    "8.072",
    "25 Sep 2026",
    "27 Sep 2026",
    "+72 HM",
    false,
    "Selesai",
  ],
  [
    "G5809 · GD825A",
    "PS3",
    "14.000",
    "13.968",
    "18 Sep 2026",
    "18 Sep 2026",
    "−32 HM",
    true,
    "Selesai",
  ],
  [
    "DA54853 · Mercedes Arocs",
    "PS1",
    "6.500",
    "6.526",
    "12 Sep 2026",
    "12 Sep 2026",
    "+26 HM",
    true,
    "Selesai",
  ],
  [
    "E5126 · PC2000",
    "PS4",
    "20.000",
    "20.118",
    "05 Sep 2026",
    "08 Sep 2026",
    "+118 HM",
    false,
    "Redo PS",
  ],
  [
    "H57183 · HD785-7",
    "PS2",
    "11.000",
    "10.984",
    "02 Sep 2026",
    "02 Sep 2026",
    "−16 HM",
    true,
    "Selesai",
  ],
] as const

const backlogRows = [
  [
    "BKL-2026-0098",
    "H57197 · HD785-7",
    "AC hot – kondensor bocor + low compression",
    "Ganti kondensor dan compressor assy",
    "MR-2026-0412",
    "05 Nov 2026",
    "—",
    "Fajar Nugroho",
    "Open",
    "10.560",
  ],
  [
    "BKL-2026-0097",
    "E51203 · PC1250",
    "Blower kabin berisik pada kecepatan tinggi",
    "Periksa bearing dan ganti motor blower",
    "MR-2026-0408",
    "02 Nov 2026",
    "—",
    "Agus Setiawan",
    "Waiting",
    "8.102",
  ],
  [
    "BKL-2026-0095",
    "G5809 · GD825A",
    "Evaporator icing setelah 2 jam operasi",
    "Flushing dan penggantian expansion valve",
    "MR-2026-0399",
    "28 Okt 2026",
    "30 Okt 2026",
    "Rudi Hartono",
    "Closed",
    "14.012",
  ],
  [
    "BKL-2026-0093",
    "DA54853 · Mercedes Arocs",
    "Magnetic clutch slip",
    "Ganti clutch assembly",
    "MR-2026-0394",
    "25 Okt 2026",
    "—",
    "Dedi Irawan",
    "Overdue",
    "6.590",
  ],
  [
    "BKL-2026-0091",
    "E5126 · PC2000",
    "High pressure trip intermittent",
    "Pemeriksaan pressure switch dan wiring",
    "—",
    "08 Nov 2026",
    "—",
    "Fajar Nugroho",
    "In Progress",
    "20.145",
  ],
] as const

function PsBacklog() {
  const [tab, setTab] = useState<"PS" | "Backlog">("PS")
  return (
    <MaintenancePage
      title="PS & Backlog"
      description="Akurasi periodical service dan tindak lanjut masalah unit."
    >
      <div className="maintenance-tabs">
        <button
          className={tab === "PS" ? "is-active" : ""}
          onClick={() => setTab("PS")}
        >
          Periodical Service
        </button>
        <button
          className={tab === "Backlog" ? "is-active" : ""}
          onClick={() => setTab("Backlog")}
        >
          Backlog <span>11</span>
        </button>
      </div>
      {tab === "PS" ? <PsTable /> : <BacklogTable />}
    </MaintenancePage>
  )
}

function PsTable() {
  return (
    <div className="maintenance-table-card">
      <header>
        <div>
          <h2>Periodical Service</h2>
          <span>Toleransi akurasi ±50 HM</span>
        </div>
        <Button className="export-button">
          <Icon name="file" size={14} />
          Ekspor
        </Button>
      </header>
      <div className="maintenance-table">
        <table>
          <thead>
            <tr>
              <th>Unit</th>
              <th>Tipe Service</th>
              <th>Forecast HM</th>
              <th>HM Aktual</th>
              <th>Tanggal Rencana</th>
              <th>Tanggal Aktual</th>
              <th>Deviasi</th>
              <th>Akurat</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {psRows.map(
              ([
                unit,
                service,
                forecast,
                actual,
                plan,
                date,
                deviation,
                accurate,
                status,
              ]) => (
                <tr key={String(unit)}>
                  <td>
                    <strong>{unit}</strong>
                  </td>
                  <td>
                    <StatusBadge tone="info">{service}</StatusBadge>
                  </td>
                  <td>{forecast}</td>
                  <td>{actual}</td>
                  <td>{plan}</td>
                  <td>{date}</td>
                  <td className={accurate ? "" : "variance-bad"}>
                    {deviation}
                  </td>
                  <td>
                    <span
                      className={`accuracy-icon ${
                        accurate ? "is-accurate" : "is-inaccurate"
                      }`}
                      title="Akurat jika deviasi HM berada dalam toleransi ±50 HM"
                    >
                      {accurate ? "✓" : "×"}
                    </span>
                  </td>
                  <td>
                    <StatusBadge
                      tone={status === "Selesai" ? "success" : "warning"}
                    >
                      {status}
                    </StatusBadge>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function BacklogTable() {
  return (
    <div className="maintenance-table-card">
      <header>
        <div>
          <h2>Backlog Maintenance</h2>
          <span>11 backlog aktif</span>
        </div>
        <Button className="create-button">
          <Icon name="plus" size={14} />
          Tambah Backlog
        </Button>
      </header>
      <div className="maintenance-table backlog-table">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Unit</th>
              <th>Deskripsi Masalah</th>
              <th>Tindakan</th>
              <th>Part Dibutuhkan</th>
              <th>Target</th>
              <th>Aktual</th>
              <th>PIC</th>
              <th>Status</th>
              <th>HM</th>
            </tr>
          </thead>
          <tbody>
            {backlogRows.map(
              ([
                id,
                unit,
                problem,
                action,
                mr,
                target,
                actual,
                pic,
                status,
                hm,
              ]) => (
                <tr key={id}>
                  <td>
                    <button>{id}</button>
                  </td>
                  <td>
                    <strong>{unit}</strong>
                  </td>
                  <td>{problem}</td>
                  <td>{action}</td>
                  <td>
                    {mr !== "—" ? (
                      <button className="linked-mr">
                        <Icon name="arrow-right" size={12} />
                        {mr}
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{target}</td>
                  <td>{actual}</td>
                  <td>{pic}</td>
                  <td>
                    <StatusBadge
                      tone={
                        status === "Closed"
                          ? "success"
                          : status === "Overdue"
                            ? "danger"
                            : status === "Waiting"
                              ? "verification"
                              : status === "In Progress"
                                ? "warning"
                                : "info"
                      }
                    >
                      {status}
                    </StatusBadge>
                  </td>
                  <td>{hm}</td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const mrRows = [
  [
    "MR-2026-0412",
    "29 Okt 2026",
    "14L-0113",
    "Compressor Assy for HD785-7",
    "1",
    "EA",
    "H57197 · WO-260982",
    "Open",
    "2",
    "—",
    "BKL-2026-0098",
  ],
  [
    "MR-2026-0408",
    "25 Okt 2026",
    "14L-0228",
    "Motor Blower Cabin PC1250",
    "1",
    "EA",
    "E51203 · WO-260971",
    "Waiting",
    "6",
    "—",
    "BKL-2026-0097",
  ],
  [
    "MR-2026-0404",
    "22 Okt 2026",
    "14L-0352",
    "Magnetic Clutch Arocs",
    "2",
    "EA",
    "DA54853 · WO-260965",
    "Waiting",
    "9",
    "—",
    "BKL-2026-0093",
  ],
  [
    "MR-2026-0399",
    "17 Okt 2026",
    "14L-0478",
    "Evaporator GD825A",
    "1",
    "EA",
    "G5809 · WO-260951",
    "Closed",
    "5",
    "22 Okt 2026",
    "BKL-2026-0095",
  ],
  [
    "MR-2026-0394",
    "10 Okt 2026",
    "14L-0331",
    "Pressure Switch PC2000",
    "2",
    "EA",
    "E5126 · WO-260938",
    "Open",
    "21",
    "—",
    "BKL-2026-0091",
  ],
  [
    "MR-2026-0388",
    "02 Okt 2026",
    "R134A-13KG",
    "Refrigerant R134a 13,6 kg",
    "4",
    "BTL",
    "Workshop Service",
    "Closed",
    "4",
    "06 Okt 2026",
    "—",
  ],
] as const

function MaterialRequest() {
  return (
    <MaintenancePage
      title="Material Request"
      description="Pemantauan permintaan material dan pemenuhan kebutuhan backlog."
    >
      <div className="mr-kpis">
        <article>
          <span>Open</span>
          <strong>7</strong>
        </article>
        <article>
          <span>Waiting</span>
          <strong>4</strong>
        </article>
        <article>
          <span>Closed bulan ini</span>
          <strong>23</strong>
        </article>
        <article>
          <span>Rata-rata pemenuhan</span>
          <strong>
            6 <small>hari</small>
          </strong>
        </article>
      </div>
      <ChartCard
        title="Aging Material Request"
        subtitle="MR aktif berdasarkan umur"
        info="Jumlah MR Open dan Waiting berdasarkan hari sejak dibuat."
      >
        <div className="aging-bars">
          {[
            ["0–3 hari", 4, "success"],
            ["4–7 hari", 3, "info"],
            ["8–14 hari", 2, "warning"],
            [">14 hari", 2, "danger"],
          ].map(([label, count, tone]) => (
            <div key={label}>
              <span>{label}</span>
              <i>
                <b
                  className={`tone-${tone}`}
                  style={{ width: `${Number(count) * 20}%` }}
                />
              </i>
              <strong>{count} MR</strong>
            </div>
          ))}
        </div>
      </ChartCard>
      <div className="maintenance-table-card mr-table-card">
        <header>
          <div>
            <h2>Daftar Material Request</h2>
            <span>September–Oktober 2026</span>
          </div>
          <Button className="create-button">
            <Icon name="plus" size={14} />
            Material Request
          </Button>
        </header>
        <div className="maintenance-table">
          <table>
            <thead>
              <tr>
                <th>No. MR</th>
                <th>Tanggal</th>
                <th>Part Number</th>
                <th>Deskripsi</th>
                <th>Qty</th>
                <th>Satuan</th>
                <th>Unit/WO</th>
                <th>Status</th>
                <th>Umur</th>
                <th>Tanggal Pemenuhan</th>
                <th>Backlog Terkait</th>
              </tr>
            </thead>
            <tbody>
              {mrRows.map(
                ([
                  id,
                  date,
                  part,
                  description,
                  qty,
                  unit,
                  equipment,
                  status,
                  age,
                  fulfilled,
                  backlog,
                ]) => (
                  <tr key={id}>
                    <td>
                      <button>{id}</button>
                    </td>
                    <td>{date}</td>
                    <td>
                      <strong>{part}</strong>
                    </td>
                    <td>{description}</td>
                    <td>{qty}</td>
                    <td>{unit}</td>
                    <td>{equipment}</td>
                    <td>
                      <StatusBadge
                        tone={
                          status === "Closed"
                            ? "success"
                            : status === "Waiting"
                              ? "verification"
                              : "info"
                        }
                      >
                        {status}
                      </StatusBadge>
                    </td>
                    <td className={Number(age) > 14 ? "variance-bad" : ""}>
                      {age} hari
                    </td>
                    <td>{fulfilled}</td>
                    <td>
                      {backlog !== "—" ? (
                        <button className="linked-mr">
                          <Icon name="arrow-right" size={12} />
                          {backlog}
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </div>
    </MaintenancePage>
  )
}

function ReadinessLib() {
  const [basis, setBasis] = useState<"Item" | "Nilai">("Item")
  const parts = [
    [
      "14L-0102",
      "Compressor Only for PC1250, PC2000, D155",
      3,
      248,
      "Rp86.400.000",
    ],
    ["14L-0478", "Evaporator GD825A", 2, 216, "Rp34.800.000"],
    ["14L-0170", "Condenser for PC1250, PC400", 4, 194, "Rp62.000.000"],
    ["14L-0291", "Receiver Dryer Assembly", 7, 175, "Rp18.900.000"],
    ["14L-0550", "Expansion Valve PC2000", 5, 162, "Rp12.500.000"],
  ] as const
  return (
    <MaintenancePage
      title="Readiness LIB"
      description="Kesiapan inventory berdasarkan klasifikasi pergerakan material."
    >
      <div className="lib-governance">
        <Icon name="help" size={16} />
        <span>Aturan klasifikasi contoh — menunggu pengesahan</span>
      </div>
      <div className="lib-grid">
        <ChartCard
          title="Klasifikasi Pergerakan"
          subtitle={
            basis === "Item"
              ? "Berdasarkan jumlah item"
              : "Berdasarkan nilai inventory"
          }
          info="Fast, Slow, dan Non-Moving menggunakan aturan klasifikasi contoh."
        >
          <div className="lib-toggle">
            <button
              className={basis === "Item" ? "is-active" : ""}
              onClick={() => setBasis("Item")}
            >
              Item
            </button>
            <button
              className={basis === "Nilai" ? "is-active" : ""}
              onClick={() => setBasis("Nilai")}
            >
              Nilai
            </button>
          </div>
          <div className="lib-donut-layout">
            <div className={`lib-donut ${basis === "Nilai" ? "by-value" : ""}`}>
              <div>
                <strong>{basis === "Item" ? "486" : "Rp2,8 M"}</strong>
                <span>Total</span>
              </div>
            </div>
            <div className="lib-legend">
              <span>
                <i className="fast" />
                Fast Moving{" "}
                <strong>{basis === "Item" ? "312" : "Rp1,9 M"}</strong>
              </span>
              <span>
                <i className="slow" />
                Slow Moving{" "}
                <strong>{basis === "Item" ? "118" : "Rp640 jt"}</strong>
              </span>
              <span>
                <i className="non" />
                Non-Moving{" "}
                <strong>{basis === "Item" ? "56" : "Rp260 jt"}</strong>
              </span>
            </div>
          </div>
        </ChartCard>
        <ChartCard
          title="Rencana vs Aktual"
          subtitle="Readiness per bulan · %"
          info="Persentase item tersedia dibanding rencana kebutuhan."
        >
          <div className="maintenance-legend">
            <span>
              <i className="plan" />
              Rencana
            </span>
            <span>
              <i className="actual" />
              Aktual
            </span>
          </div>
          <svg className="lib-trend" viewBox="0 0 500 180">
            <path className="grid" d="M35 25H485M35 75H485M35 125H485" />
            <path
              className="plan-line"
              d="M40 52 125 48 210 45 295 40 380 38 475 35"
            />
            <path
              className="actual-line"
              d="M40 88 125 72 210 78 295 58 380 62 475 45"
            />
            {months.map((month, index) => (
              <text key={month} x={40 + index * 87} y="165">
                {month}
              </text>
            ))}
          </svg>
        </ChartCard>
      </div>
      <div className="maintenance-table-card">
        <header>
          <div>
            <h2>Part Non-Moving Teratas</h2>
            <span>Tanpa pergerakan ≥ 150 hari</span>
          </div>
          <Button className="export-button">Lihat Semua</Button>
        </header>
        <div className="maintenance-table">
          <table>
            <thead>
              <tr>
                <th>Part Number</th>
                <th>Deskripsi</th>
                <th>Qty</th>
                <th>Hari Tanpa Pergerakan</th>
                <th>Nilai</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {parts.map(([part, description, qty, days, value]) => (
                <tr key={part}>
                  <td>
                    <strong>{part}</strong>
                  </td>
                  <td>{description}</td>
                  <td>{qty}</td>
                  <td className="variance-bad">{days} hari</td>
                  <td>{value}</td>
                  <td>
                    <StatusBadge tone="danger">Non-Moving</StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </MaintenancePage>
  )
}

const scrapRows = [
  [
    "SCR-2026-0041",
    "14L-0113",
    "Compressor Assy for HD785-7",
    "28 Okt 2026",
    "PS 4 (REPLACE COMPRESSOR)",
    "H57183",
    "1",
    "—",
    "compressor",
    "Tersimpan",
  ],
  [
    "SCR-2026-0040",
    "14L-0170",
    "Condenser for PC1250, PC400",
    "24 Okt 2026",
    "PS 4 (REPLACE CONDENSOR)",
    "E51203",
    "1",
    "30 Okt 2026",
    "condenser",
    "Dibuang",
  ],
  [
    "SCR-2026-0039",
    "14L-0478",
    "Evaporator GD825A",
    "17 Okt 2026",
    "AC HOT (REPLACE EVAPORATOR)",
    "G5809",
    "1",
    "—",
    "evaporator",
    "Tersimpan",
  ],
  [
    "SCR-2026-0038",
    "14L-0102",
    "Compressor Only for PC-1250, PC2000, D155",
    "10 Okt 2026",
    "LOW COMPRESSION",
    "E5126",
    "1",
    "22 Okt 2026",
    "compressor",
    "Dibuang",
  ],
] as const

function ScrapThumb({ type }: { type: string }) {
  return (
    <span className="scrap-thumb">
      <Icon name={type === "condenser" ? "grid" : "tools"} size={18} />
    </span>
  )
}

function MetalScrap() {
  const forecasts = [
    ["14L-0113", "Compressor Assy for HD785-7", "EA", 4, 3],
    ["14L-0170", "Condenser for PC1250, PC400", "EA", 6, 8],
    ["14L-0478", "Evaporator GD825A", "EA", 3, 3],
    ["14L-0102", "Compressor Only for PC1250, PC2000, D155", "EA", 5, 2],
    ["R134A-13KG", "Refrigerant R134a 13,6 kg", "BTL", 12, 15],
  ] as const
  return (
    <MaintenancePage
      title="Metal Scrap"
      description="Register komponen bekas, penyimpanan, dan pembuangan material."
    >
      <div className="maintenance-table-card">
        <header>
          <div>
            <h2>Register Metal Scrap</h2>
            <span>Oktober 2026</span>
          </div>
          <Button className="create-button">
            <Icon name="plus" size={14} />
            Catat Scrap
          </Button>
        </header>
        <div className="maintenance-table scrap-table">
          <table>
            <thead>
              <tr>
                <th>No.</th>
                <th>Part Number</th>
                <th>Komponen</th>
                <th>Tanggal</th>
                <th>Keterangan</th>
                <th>Dari Unit</th>
                <th>Qty</th>
                <th>Tanggal Pembuangan</th>
                <th>Foto</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {scrapRows.map(
                ([
                  id,
                  part,
                  component,
                  date,
                  note,
                  unit,
                  qty,
                  disposed,
                  type,
                  status,
                ]) => (
                  <tr key={id}>
                    <td>{id}</td>
                    <td>
                      <strong>{part}</strong>
                    </td>
                    <td>{component}</td>
                    <td>{date}</td>
                    <td>{note}</td>
                    <td>{unit}</td>
                    <td>{qty}</td>
                    <td>{disposed}</td>
                    <td>
                      <ScrapThumb type={type} />
                    </td>
                    <td>
                      <StatusBadge
                        tone={status === "Dibuang" ? "success" : "warning"}
                      >
                        {status}
                      </StatusBadge>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="maintenance-table-card forecast-table-card">
        <header>
          <div>
            <h2>Forecast Service & Consumable</h2>
            <span>Rencana vs aktual penggunaan September 2026</span>
          </div>
          <Button className="export-button">
            <Icon name="file" size={14} />
            Ekspor
          </Button>
        </header>
        <div className="maintenance-table">
          <table>
            <thead>
              <tr>
                <th>Part Number</th>
                <th>Deskripsi</th>
                <th>Satuan</th>
                <th>Rencana</th>
                <th>Aktual</th>
                <th>Variance</th>
              </tr>
            </thead>
            <tbody>
              {forecasts.map(([part, description, unit, plan, actual]) => {
                const variance = Number(actual) - Number(plan)
                return (
                  <tr key={part}>
                    <td>
                      <strong>{part}</strong>
                    </td>
                    <td>{description}</td>
                    <td>{unit}</td>
                    <td>{plan}</td>
                    <td>{actual}</td>
                    <td>
                      <span
                        className={`forecast-variance ${
                          variance > 0
                            ? "is-over"
                            : variance < 0
                              ? "is-under"
                              : "is-equal"
                        }`}
                      >
                        {variance > 0 ? `+${variance}` : variance}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </MaintenancePage>
  )
}

export default function MaintenanceManagement({ page }: Props) {
  if (page === "PS & Backlog") return <PsBacklog />
  if (page === "Material Request") return <MaterialRequest />
  if (page === "Readiness LIB") return <ReadinessLib />
  if (page === "Metal Scrap") return <MetalScrap />
  return <DashboardMaintenance />
}
