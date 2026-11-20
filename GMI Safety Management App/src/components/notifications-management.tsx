import { useState } from "react"
import { Button, Icon, StatusBadge } from "./ui"

type Props = { page: string role?: string onNavigate: (page: string) => void }

const notificationGroups = [
  {
    label: "Hari ini",
    items: [
      {
        type: "Tugas",
        icon: "shield",
        text: "KJD-2026-0013 baru dilaporkan oleh Rudi Hartono — perlu klasifikasi",
        time: "12 menit lalu",
        record: "KJD-2026-0013",
        cta: "Klasifikasi",
        target: "KJD-2026-0013",
        unread: true,
      },
      {
        type: "Persetujuan",
        icon: "file",
        text: "Laporan September 2026 dikembalikan oleh PJO: lengkapi data TSP",
        time: "1 jam lalu",
        record: "LAP-PJO-2026-09",
        cta: "Perbaiki",
        target: "Workspace Laporan PJO",
        unread: true,
      },
      {
        type: "Tugas",
        icon: "check",
        text: "Bukti TDK-2026-0144 menunggu verifikasi Anda",
        time: "3 jam lalu",
        record: "TDK-2026-0144",
        cta: "Verifikasi",
        target: "TMN-2026-0087",
        unread: true,
      },
    ],
  },
  {
    label: "Minggu ini",
    items: [
      {
        type: "Tenggat",
        icon: "calendar",
        text: "TDK-2026-0143 jatuh tempo dalam 2 hari",
        time: "Kemarin, 16:40",
        record: "TDK-2026-0143",
        cta: "Unggah Bukti",
        target: "TMN-2026-0087",
        unread: true,
      },
      {
        type: "Masa Berlaku",
        icon: "user",
        text: "MCU Dewi Lestari kedaluwarsa dalam 14 hari",
        time: "Kemarin, 08:15",
        record: "GMI-0009",
        cta: "Lihat MCU",
        target: "MCU",
        unread: false,
      },
      {
        type: "Masa Berlaku",
        icon: "building",
        text: "Izin usaha PT Sinar Teknik Mandiri berakhir dalam 30 hari",
        time: "28 Okt 2026",
        record: "IUJP-545/12/DPMPTSP/2024",
        cta: "Tinjau",
        target: "PT Sinar Teknik Mandiri",
        unread: false,
      },
    ],
  },
  {
    label: "Sebelumnya",
    items: [
      {
        type: "Persetujuan",
        icon: "clipboard",
        text: "Evaluasi TSP September 2026 menunggu persetujuan PJO",
        time: "25 Okt 2026",
        record: "TSP-EVL-2026-09",
        cta: "Review",
        target: "TSP & Aktivitas",
        unread: false,
      },
      {
        type: "Tenggat",
        icon: "file",
        text: "Review dokumen GMI-SOP-HSE-014 dijadwalkan ulang",
        time: "22 Okt 2026",
        record: "GMI-SOP-HSE-014",
        cta: "Lihat",
        target: "GMI-SOP-HSE-014",
        unread: false,
      },
    ],
  },
] as const

export function NotificationDropdown({
  onNavigate,
  onClose,
}: {
  onNavigate: (page: string) => void
  onClose: () => void
}) {
  const today = notificationGroups[0].items
  return (
    <div className="notification-dropdown">
      <header>
        <div>
          <h2>Notifikasi</h2>
          <span>3 belum dibaca</span>
        </div>
        <button>Tandai semua dibaca</button>
      </header>
      <div>
        {today.map((item) => (
          <article key={item.text} className={item.unread ? "is-unread" : ""}>
            <span
              className={`notification-icon type-${item.type.toLowerCase().replace(" ", "-")}`}
            >
              <Icon name={item.icon} size={17} />
            </span>
            <div>
              <p>{item.text}</p>
              <button
                onClick={() => {
                  onNavigate(item.target)
                  onClose()
                }}
              >
                {item.record}
              </button>
              <small>{item.time}</small>
            </div>
            {item.unread && <i />}
          </article>
        ))}
      </div>
      <footer>
        <button
          onClick={() => {
            onNavigate("Notifikasi")
            onClose()
          }}
        >
          Lihat semua notifikasi <Icon name="arrow-right" size={14} />
        </button>
      </footer>
    </div>
  )
}

function NotificationPage({ role, onNavigate }: Props) {
  const [tab, setTab] = useState("Semua")
  const [readAll, setReadAll] = useState(false)
  const tabs = ["Semua", "Tugas", "Tenggat", "Masa Berlaku", "Persetujuan"]
  return (
    <section className="page notifications-page">
      <div className="page-heading">
        <div>
          <p className="overline">INBOX</p>
          <h1>Notifikasi</h1>
          <p>Pembaruan tugas, tenggat, masa berlaku, dan persetujuan.</p>
        </div>
        <div className="notification-page-actions">
          {(role === "HSE" || role === "Administrator") && (
            <Button
              className="export-button"
              onClick={() => onNavigate("Pengaturan Pengingat")}
            >
              <Icon name="settings" size={14} />
              Pengaturan Pengingat
            </Button>
          )}
          <Button className="link-button" onClick={() => setReadAll(true)}>
            Tandai semua dibaca
          </Button>
        </div>
      </div>
      <nav className="saved-view-tabs notification-tabs">
        {tabs.map((item) => (
          <button
            key={item}
            className={tab === item ? "is-active" : ""}
            onClick={() => setTab(item)}
          >
            {item}
            {item === "Semua" && !readAll && <i>4</i>}
          </button>
        ))}
      </nav>
      <div className="notification-feed">
        {notificationGroups.map((group) => {
          const filtered = group.items.filter(
            (item) => tab === "Semua" || item.type === tab,
          )
          if (!filtered.length) return null
          return (
            <section key={group.label}>
              <h2>{group.label}</h2>
              <div>
                {filtered.map((item) => (
                  <article
                    key={item.text}
                    className={item.unread && !readAll ? "is-unread" : ""}
                  >
                    <span
                      className={`notification-icon type-${item.type.toLowerCase().replace(" ", "-")}`}
                    >
                      <Icon name={item.icon} size={19} />
                    </span>
                    <div>
                      <p>{item.text}</p>
                      <span>
                        <button onClick={() => onNavigate(item.target)}>
                          {item.record}
                        </button>
                        <small>{item.time}</small>
                      </span>
                    </div>
                    <Button
                      className="notification-cta"
                      onClick={() => onNavigate(item.target)}
                    >
                      {item.cta}
                    </Button>
                    {item.unread && !readAll && <i />}
                  </article>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </section>
  )
}

const tasks = [
  [
    "Overdue",
    "Verifikasi bukti tindakan perbaikan",
    "TDK-2026-0144 · Revisi JSA penggantian kompresor",
    "Overdue · 2 hari",
    "Verifikasi",
    "TMN-2026-0087",
    "danger",
  ],
  [
    "Overdue",
    "Lengkapi data MCU karyawan",
    "GMI-0015 · Agus Setiawan",
    "Overdue · 12 hari",
    "Perbarui MCU",
    "MCU",
    "danger",
  ],
  [
    "Jatuh tempo minggu ini",
    "Unggah bukti penyelesaian tindakan",
    "TDK-2026-0143 · Pengadaan lifting aid kompresor",
    "Jatuh tempo 2 hari",
    "Unggah Bukti",
    "TMN-2026-0087",
    "warning",
  ],
  [
    "Jatuh tempo minggu ini",
    "Review investigasi kejadian",
    "KJD-2026-0012 · Jari terjepit saat pemasangan kompresor",
    "Jatuh tempo 3 hari",
    "Review",
    "KJD-2026-0012",
    "warning",
  ],
  [
    "Jatuh tempo minggu ini",
    "Setujui evaluasi TSP September",
    "TSP-EVL-2026-09 · Evaluasi Bulanan",
    "Jatuh tempo 5 hari",
    "Setujui",
    "TSP & Aktivitas",
    "warning",
  ],
  [
    "Lainnya",
    "Klasifikasi laporan kejadian baru",
    "KJD-2026-0013 · Kebocoran refrigerant unit E51203",
    "Tidak ada tenggat",
    "Klasifikasi",
    "KJD-2026-0013",
    "info",
  ],
  [
    "Lainnya",
    "Review laporan periodik",
    "LAP-PJO-2026-09 · Evaluasi Monthly PJO",
    "Diajukan hari ini",
    "Review",
    "Workspace Laporan PJO",
    "verification",
  ],
] as const

function TasksPage({ onNavigate }: Pick<Props, "onNavigate">) {
  const groups = ["Overdue", "Jatuh tempo minggu ini", "Lainnya"]
  return (
    <section className="page tasks-page">
      <div className="page-heading">
        <div>
          <p className="overline">INBOX</p>
          <h1>Tugas Saya</h1>
          <p>Tindakan yang memerlukan perhatian atau keputusan Anda.</p>
        </div>
        <div className="task-summary-pill">
          <span>7 tugas aktif</span>
          <strong>2 overdue</strong>
        </div>
      </div>
      <div className="task-groups">
        {groups.map((group) => (
          <section key={group}>
            <header>
              <h2>{group}</h2>
              <span>{tasks.filter((task) => task[0] === group).length}</span>
            </header>
            <div>
              {tasks
                .filter((task) => task[0] === group)
                .map(([, action, record, due, cta, target, tone]) => (
                  <article key={record}>
                    <span className={`task-icon tone-${tone}`}>
                      <Icon
                        name={
                          cta === "Setujui"
                            ? "check"
                            : cta.includes("Unggah")
                              ? "upload"
                              : cta.includes("MCU") || cta.includes("Perbarui")
                                ? "user"
                                : "clipboard"
                        }
                        size={19}
                      />
                    </span>
                    <div>
                      <strong>{action}</strong>
                      <button onClick={() => onNavigate(target)}>
                        {record}
                      </button>
                    </div>
                    <StatusBadge tone={tone}>{due}</StatusBadge>
                    <Button
                      className="task-action-button"
                      onClick={() => onNavigate(target)}
                    >
                      {cta}
                    </Button>
                  </article>
                ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  )
}

const reminderRows = [
  [
    "Tindakan PICA",
    ["H-14", "H-7", "H-1", "Hari H"],
    ["PIC", "Atasan", "HSE"],
    "Jika overdue 3 hari kerja → eskalasi ke atasan; 7 hari kerja → PJO",
  ],
  [
    "MCU",
    ["H-60", "H-30", "H-14", "H-7", "H-1"],
    ["PIC", "HR", "HSE"],
    "Jika overdue 3 hari kerja → eskalasi ke atasan; 7 hari kerja → PJO",
  ],
  [
    "Sertifikat Kompetensi",
    ["H-60", "H-30", "H-14", "H-7"],
    ["PIC", "Atasan", "HR"],
    "Jika overdue 7 hari kerja → HSE dan PJO",
  ],
  [
    "Izin Usaha",
    ["H-60", "H-30", "H-14", "H-7"],
    ["PIC", "Pengelola Kontraktor", "PJO"],
    "Jika overdue 3 hari kerja → Pengelola Kontraktor; 7 hari kerja → PJO",
  ],
  [
    "Kontrak",
    ["H-60", "H-30", "H-14", "H-7"],
    ["PIC", "SCM/Gudang", "Manajemen"],
    "Jika overdue 7 hari kerja → Manajemen",
  ],
  [
    "Dokumen/Prosedur",
    ["H-60", "H-30", "H-14", "H-7", "H-1"],
    ["Pemilik", "HSE", "PJO"],
    "Jika overdue 3 hari kerja → atasan pemilik; 7 hari kerja → PJO",
  ],
  [
    "Laporan Periode",
    ["H-14", "H-7", "H-1", "Hari H"],
    ["Penyusun", "Reviewer", "PJO"],
    "Jika overdue 3 hari kerja → PJO; 7 hari kerja → Manajemen",
  ],
] as const

function ReminderSettings({ onNavigate }: Pick<Props, "onNavigate">) {
  const [workingDays, setWorkingDays] = useState(true)
  const [email, setEmail] = useState(true)
  const [saved, setSaved] = useState(false)
  return (
    <section className="page reminder-settings-page">
      <button className="record-back" onClick={() => onNavigate("Notifikasi")}>
        <Icon name="arrow-right" size={14} />
        Kembali ke Notifikasi
      </button>
      <div className="page-heading">
        <div>
          <p className="overline">ADMINISTRASI</p>
          <h1>Pengaturan Pengingat</h1>
          <p>Atur interval, penerima, channel, dan eskalasi tenggat.</p>
        </div>
        <Button
          className="create-button"
          onClick={() => {
            setSaved(true)
            window.setTimeout(() => setSaved(false), 1800)
          }}
        >
          Simpan Pengaturan
        </Button>
      </div>
      {saved && (
        <div className="settings-saved">
          <Icon name="check" size={16} />
          Pengaturan pengingat berhasil disimpan.
        </div>
      )}
      <div className="reminder-global-settings">
        <label>
          <span>
            <strong>Kalender hari kerja</strong>
            <small>Interval dan eskalasi hanya menghitung Senin–Jumat.</small>
          </span>
          <input
            type="checkbox"
            checked={workingDays}
            onChange={(e) => setWorkingDays(e.target.checked)}
          />
          <i />
        </label>
        <div>
          <span>Channel aktif</span>
          <StatusBadge tone="success">In-app</StatusBadge>
          <button
            className={email ? "is-active" : ""}
            onClick={() => setEmail(!email)}
          >
            Email <small>jika tersedia</small>
          </button>
        </div>
      </div>
      <div className="reminder-table-card">
        <div className="reminder-table">
          <table>
            <thead>
              <tr>
                <th>Objek</th>
                <th>Interval Pengingat</th>
                <th>Penerima</th>
                <th>Aturan Eskalasi</th>
                <th>Channel</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {reminderRows.map(
                ([object, intervals, recipients, escalation]) => (
                  <ReminderRow
                    key={object}
                    object={object}
                    intervals={[...intervals]}
                    recipients={[...recipients]}
                    escalation={escalation}
                    email={email}
                  />
                ),
              )}
            </tbody>
          </table>
        </div>
      </div>
      <section className="reminder-preview">
        <header>
          <span>
            <Icon name="bell" size={19} />
          </span>
          <div>
            <h2>Preview Pengingat</h2>
            <p>Contoh berdasarkan konfigurasi MCU</p>
          </div>
        </header>
        <div>
          <p>
            <strong>MCU berakhir</strong>
            <span>30 Nov 2026</span>
          </p>
          <Icon name="arrow-right" size={17} />
          <div className="preview-dates">
            {["31 Okt", "16 Nov", "23 Nov", "29 Nov"].map((date, index) => (
              <span key={date}>
                <i>{index + 1}</i>
                {date}
              </span>
            ))}
          </div>
        </div>
        <footer>
          Pengingat dikirim kepada PIC, HR, dan HSE melalui In-app
          {email ? " dan Email jika tersedia" : ""}.
        </footer>
      </section>
    </section>
  )
}

function ReminderRow({
  object,
  intervals: initialIntervals,
  recipients,
  escalation,
  email,
}: {
  object: string
  intervals: string[]
  recipients: string[]
  escalation: string
  email: boolean
}) {
  const [intervals, setIntervals] = useState(initialIntervals)
  const available = ["H-60", "H-30", "H-14", "H-7", "H-1", "Hari H"]
  return (
    <tr>
      <td>
        <div className="reminder-object">
          <span>
            <Icon
              name={
                object === "MCU"
                  ? "user"
                  : object.includes("Kontrak") || object.includes("Izin")
                    ? "building"
                    : object.includes("Dokumen") || object.includes("Laporan")
                      ? "file"
                      : "clipboard"
              }
              size={16}
            />
          </span>
          <strong>{object}</strong>
        </div>
      </td>
      <td>
        <div className="interval-chips">
          {available.map((item) => (
            <button
              key={item}
              className={intervals.includes(item) ? "is-active" : ""}
              onClick={() =>
                setIntervals((current) =>
                  current.includes(item)
                    ? current.filter((value) => value !== item)
                    : [...current, item],
                )
              }
            >
              {item}
            </button>
          ))}
        </div>
      </td>
      <td>
        <div className="recipient-chips">
          {recipients.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </td>
      <td>
        <p className="escalation-rule">{escalation}</p>
      </td>
      <td>
        <div className="channel-chips">
          <span>
            <Icon name="bell" size={12} />
            In-app
          </span>
          {email && (
            <span>
              <Icon name="file" size={12} />
              Email
            </span>
          )}
        </div>
      </td>
      <td>
        <Icon name="more" size={15} />
      </td>
    </tr>
  )
}

export default function NotificationsManagement({
  page,
  role,
  onNavigate,
}: Props) {
  if (page === "Tugas Saya") return <TasksPage onNavigate={onNavigate} />
  if (page === "Pengaturan Pengingat")
    return <ReminderSettings onNavigate={onNavigate} />
  return <NotificationPage role={role} page={page} onNavigate={onNavigate} />
}
