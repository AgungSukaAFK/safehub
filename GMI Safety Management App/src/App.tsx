import { FormEvent, useEffect, useState } from "react"
import {
  Brand,
  Button,
  ExpiryChip,
  Field,
  Icon,
  IconButton,
  RestrictedData,
  Skeleton,
  StatusBadge,
  StatusDot,
  Toast,
} from "./components/ui"
import Dashboard from "./components/dashboard"
import IncidentReport from "./components/incident-report"
import IncidentManagement from "./components/incident-management"
import FindingManagement from "./components/finding-management"
import InspectionManagement from "./components/inspection-management"
import TspManagement from "./components/tsp-management"
import PeopleCompliance from "./components/people-compliance"
import ContractorManagement from "./components/contractor-management"
import DocumentsManagement from "./components/documents-management"
import MaintenanceManagement from "./components/maintenance-management"
import ReportManagement from "./components/report-management"
import {
  NotificationDropdown,
  default as NotificationsManagement,
} from "./components/notifications-management"
import AdminManagement from "./components/admin-management"
import DemoFlow from "./components/demo-flow"
import SystemStates, { NotFound } from "./components/system-states"

const photoUrl =
  "https://images.unsplash.com/photo-1725946687006-e5cf87668fd9?auto=format&fit=crop&w=1800&q=88"

const navigation = [
  { group: "BERANDA", items: [{ label: "Dashboard", icon: "grid" as const }] },
  {
    group: "K3LH",
    items: [
      { label: "Kejadian & Investigasi", icon: "shield" as const },
      { label: "Inspeksi & Observasi", icon: "clipboard" as const },
      {
        label: "Temuan & PICA",
        icon: "check" as const,
        count: 4,
        overdue: true,
      },
      { label: "TSP & Aktivitas", icon: "hard-hat" as const },
    ],
  },
  {
    group: "PEOPLE & COMPLIANCE",
    items: [
      { label: "Manpower", icon: "users" as const },
      { label: "Kompetensi & Pelatihan", icon: "book" as const },
      { label: "MCU", icon: "user" as const, count: 5 },
      { label: "Kontraktor & Legalitas", icon: "briefcase" as const },
      { label: "PJO/PJA", icon: "shield" as const },
    ],
  },
  {
    group: "DOKUMEN",
    items: [
      { label: "Prosedur & Dokumen", icon: "file" as const },
      { label: "Evaluasi Peraturan", icon: "book" as const },
      { label: "Register Keselamatan Operasi", icon: "clipboard" as const },
    ],
  },
  {
    group: "MAINTENANCE",
    items: [
      { label: "Dashboard Maintenance", icon: "chart" as const },
      { label: "PS & Backlog", icon: "tools" as const },
      { label: "Material Request", icon: "briefcase" as const },
      { label: "Readiness LIB", icon: "check" as const },
      { label: "Metal Scrap", icon: "settings" as const },
    ],
  },
  {
    group: "LAPORAN",
    items: [{ label: "Laporan Periode", icon: "chart" as const }],
  },
  {
    group: "ADMIN",
    items: [
      { label: "Pengguna & Peran", icon: "users" as const },
      { label: "Master Data", icon: "building" as const },
      { label: "Impor Data", icon: "file" as const },
      { label: "Kamus KPI", icon: "book" as const },
      { label: "Audit Trail", icon: "clipboard" as const },
      { label: "Pengaturan Pengingat", icon: "bell" as const },
    ],
  },
]

const roles = [
  "HSE",
  "Manajemen",
  "PJO",
  "PJA",
  "Pengawas",
  "HR",
  "Service/Maintenance",
  "SCM/Gudang",
  "Pengelola Kontraktor",
  "Karyawan",
  "Auditor",
  "Administrator",
]

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!email.trim() || !password) {
      setError("Email/NIK atau kata sandi salah")
      return
    }
    setError("")
    setLoading(true)
    window.setTimeout(onLogin, 700)
  }

  return (
    <main className="login-layout">
      <section
        className="login-visual"
        aria-label="Operasional pertambangan Site MIFA"
      >
        <img
          src={photoUrl}
          alt="Kendaraan operasional di area pertambangan saat senja"
        />
        <div className="login-visual__wash" />
        <div className="login-visual__top">
          <Brand inverse />
        </div>
        <div className="login-visual__content">
          <p className="overline overline--light">K3PLH & OPERASIONAL GMI</p>
          <h1>
            Kerja aman.
            <br />
            Data terkendali.
          </h1>
          <p>
            Satu sumber data K3PLH dan operasional — dari pencatatan sampai
            laporan.
          </p>
        </div>
        <a
          className="photo-credit"
          href="https://unsplash.com/@qil92"
          target="_blank"
          rel="noreferrer"
        >
          Foto: Shaqil Jabarullah / Unsplash
        </a>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div className="login-logo">
            <Brand />
            <span>Site MIFA</span>
          </div>
          <div className="login-heading">
            <h2>Masuk</h2>
            <p className="muted">
              Gunakan akun perusahaan Anda untuk melanjutkan.
            </p>
          </div>
          {error && (
            <div className="login-error">
              <Icon name="x" size={17} />
              {error}
            </div>
          )}
          <form onSubmit={submit} noValidate>
            <Field
              label="Email atau NIK"
              name="email"
              value={email}
              placeholder="nama@gmi.co.id atau NIK"
              autoComplete="username"
              onChange={(e) => {
                setEmail(e.target.value)
                setError("")
              }}
            />
            <Field
              label="Kata sandi"
              name="password"
              type={showPassword ? "text" : "password"}
              value={password}
              placeholder="Masukkan kata sandi"
              autoComplete="current-password"
              onChange={(e) => {
                setPassword(e.target.value)
                setError("")
              }}
              endAdornment={
                <IconButton
                  label={
                    showPassword
                      ? "Sembunyikan kata sandi"
                      : "Tampilkan kata sandi"
                  }
                  className="field-action"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <Icon name={showPassword ? "eye-off" : "eye"} size={19} />
                </IconButton>
              }
            />
            <div className="form-options">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                <span>
                  <Icon name="check" size={13} />
                </span>
                Ingat saya
              </label>
              <Button
                type="button"
                className="link-button"
                onClick={() =>
                  window.alert(
                    "Tautan pemulihan akun telah disiapkan untuk mode prototipe.",
                  )
                }
              >
                Lupa kata sandi?
              </Button>
            </div>
            <Button className="primary-button" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner" />
                  Memproses...
                </>
              ) : (
                "Masuk"
              )}
            </Button>
            <div className="divider">
              <span>atau</span>
            </div>
            <Button
              className="secondary-button"
              type="button"
              onClick={() => {
                setLoading(true)
                window.setTimeout(onLogin, 700)
              }}
            >
              <Icon name="building" size={18} />
              Masuk dengan SSO Perusahaan
            </Button>
          </form>
        </div>
        <footer className="login-footer">
          PT Garuda Mart Indonesia · Site MIFA · Prototype v0.1
        </footer>
      </section>
    </main>
  )
}

function Sidebar({
  active,
  role,
  collapsed,
  mobileOpen,
  onToggle,
  onClose,
  onSelect,
}: {
  active: string
  role: string
  collapsed: boolean
  mobileOpen: boolean
  onToggle: () => void
  onClose: () => void
  onSelect: (item: string) => void
}) {
  const visibleNavigation =
    role === "Karyawan"
      ? [
          {
            group: "MENU",
            items: [
              { label: "Dashboard", icon: "grid" as const },
              { label: "Lapor", icon: "plus" as const },
              { label: "Tugas Saya", icon: "clipboard" as const },
              { label: "Notifikasi", icon: "bell" as const },
            ],
          },
        ]
      : navigation
  return (
    <>
      {mobileOpen && (
        <button
          className="sidebar-backdrop"
          onClick={onClose}
          aria-label="Tutup menu"
        />
      )}
      <aside
        className={`sidebar ${collapsed ? "is-collapsed" : ""} ${
          mobileOpen ? "is-open" : ""
        }`}
      >
        <div className="sidebar__brand">
          <Brand inverse compact={collapsed} />
          <IconButton
            label="Tutup menu"
            className="sidebar__close"
            onClick={onClose}
          >
            <Icon name="x" />
          </IconButton>
        </div>
        <div className="sidebar__product">
          <strong>K3PLH & Operasional</strong>
          <span>Site MIFA</span>
        </div>
        <nav className="sidebar__nav" aria-label="Navigasi utama">
          {visibleNavigation.map((group) => (
            <div className="nav-group" key={group.group}>
              <p>{group.group}</p>
              {group.items.map((item) => (
                <button
                  title={collapsed ? item.label : undefined}
                  key={item.label}
                  className={`nav-item ${
                    active === item.label ? "is-active" : ""
                  }`}
                  onClick={() => {
                    onSelect(item.label)
                    onClose()
                  }}
                >
                  <Icon name={item.icon} size={18} />
                  <span>{item.label}</span>
                  {"count" in item && item.count && (
                    <i
                      className={
                        "overdue" in item && item.overdue ? "is-overdue" : ""
                      }
                    >
                      {item.count}
                    </i>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <button className="collapse-button" onClick={onToggle}>
          <Icon name="arrow-right" size={17} />
          <span>Ciutkan menu</span>
        </button>
      </aside>
    </>
  )
}

function Topbar({
  active,
  role,
  onRole,
  onMenu,
  onNavigate,
  onLogout,
}: {
  active: string
  role: string
  onRole: (role: string) => void
  onMenu: () => void
  onNavigate: (page: string) => void
  onLogout: () => void
}) {
  const [profileOpen, setProfileOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const canCreate = role !== "Auditor"
  const personas: Record<string, [string, string, string]> = {
    Karyawan: ["Rudi Hartono", "Teknisi AC", "RH"],
    HSE: ["Andi Pratama", "HSE Officer", "AP"],
    Pengawas: ["Fajar Nugroho", "Pengawas Service", "FN"],
    PJO: ["Budi Santoso", "PJO", "BS"],
    HR: ["Dewi Lestari", "HR", "DL"],
    "Service/Maintenance": ["Hendra Wijaya", "Planner Maintenance", "HW"],
    "SCM/Gudang": ["Sari Wulandari", "SCM/Gudang", "SW"],
  }
  const persona = personas[role] || ["Andi Pratama", role, "AP"]
  return (
    <header className="topbar">
      <div className="topbar__leading">
        <IconButton label="Buka menu" className="menu-trigger" onClick={onMenu}>
          <Icon name="menu" />
        </IconButton>
        <div className="breadcrumb">
          <span>Site MIFA</span>
          <b>/</b>
          <strong>{active}</strong>
        </div>
      </div>
      <div className="topbar__center">
        <div className="search-box">
          <Icon name="search" size={17} />
          <input
            aria-label="Pencarian global"
            placeholder="Cari kejadian, temuan, karyawan, unit, dokumen…"
          />
          <kbd>⌘K</kbd>
        </div>
      </div>
      <div className="topbar__actions">
        <span className="sample-tag">Data contoh</span>
        <label className="demo-role">
          <span>Mode demo · Lihat sebagai:</span>
          <select value={role} onChange={(e) => onRole(e.target.value)}>
            {roles.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <button className="top-select">
          <Icon name="building" size={16} />
          <span>Site MIFA</span>
          <Icon name="chevron-down" size={14} />
        </button>
        <button className="top-select period-select">
          <Icon name="calendar" size={16} />
          <span>September 2026</span>
          <Icon name="chevron-down" size={14} />
        </button>
        {canCreate && (
          <div className="create-wrap">
            <Button
              className="create-button"
              onClick={() => setCreateOpen(!createOpen)}
            >
              <Icon name="plus" size={17} />
              Buat
              <Icon name="chevron-down" size={14} />
            </Button>
            {createOpen && (
              <div className="popover create-menu">
                {[
                  "Lapor Kejadian",
                  "Observasi KTA/TTA",
                  "Temuan Baru",
                  "Material Request",
                ].map((item) => (
                  <button
                    key={item}
                    onClick={() => {
                      setCreateOpen(false)
                      onNavigate(item)
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="notification-wrap">
          <IconButton
            label="Notifikasi, 3 belum dibaca"
            className="notification-button"
            onClick={() => setNotificationOpen(!notificationOpen)}
          >
            <Icon name="bell" size={19} />
            <span>3</span>
          </IconButton>
          {notificationOpen && (
            <NotificationDropdown
              onNavigate={onNavigate}
              onClose={() => setNotificationOpen(false)}
            />
          )}
        </div>
        <div className="profile-wrap">
          <Button
            className="profile-button"
            onClick={() => setProfileOpen(!profileOpen)}
          >
            <span className="avatar">{persona[2]}</span>
            <span className="profile-copy">
              <strong>{persona[0]}</strong>
              <small>{persona[1]}</small>
            </span>
            <Icon name="chevron-down" size={15} />
          </Button>
          {profileOpen && (
            <div className="popover profile-menu">
              <div className="profile-menu__head">
                <strong>{persona[0]}</strong>
                <span>{persona[1]} · GMI</span>
              </div>
              <button>
                <Icon name="user" size={17} />
                Profil
              </button>
              <button
                onClick={() => {
                  onNavigate("Design System")
                  setProfileOpen(false)
                }}
              >
                <Icon name="settings" size={17} />
                Design System
              </button>
              <button
                onClick={() => {
                  onNavigate("Status UI")
                  setProfileOpen(false)
                }}
              >
                <Icon name="help" size={17} />
                Status UI
              </button>
              <button onClick={onLogout}>
                <Icon name="logout" size={17} />
                Keluar
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

const badgeRows = [
  ["Draft", "neutral"],
  ["Open", "info"],
  ["In Progress", "warning"],
  ["Menunggu Verifikasi", "verification"],
  ["Closed", "success"],
  ["Overdue", "danger"],
  ["Dikembalikan", "warning"],
  ["Ditolak", "danger"],
] as const

function KpiDemo() {
  return (
    <article className="kpi-card">
      <div className="kpi-card__top">
        <span>Total jam kerja aman</span>
        <IconButton label="Definisi KPI">
          <Icon name="help" size={16} />
        </IconButton>
      </div>
      <strong>
        10.560 <small>jam</small>
      </strong>
      <div className="kpi-card__delta">
        <span>↑ 4,2%</span> dibanding Agustus 2026
      </div>
      <svg
        viewBox="0 0 240 44"
        role="img"
        aria-label="Tren jam kerja aman meningkat"
      >
        <path d="M2 38 35 30 68 34 100 19 135 24 170 10 205 15 238 3" />
      </svg>
      <div className="kpi-card__foot">
        <span>September 2026</span>
        <span>Diperbarui 30 Sep 2026, 17:10 WIB</span>
      </div>
    </article>
  )
}

function DesignSystemPage() {
  const colors = [
    ["Primary", "#0B4F7C"],
    ["Sidebar", "#0B2238"],
    ["Background", "#F4F6F8"],
    ["Success", "#15803D"],
    ["Warning", "#B45309"],
    ["Danger", "#B91C1C"],
    ["Info", "#1D4ED8"],
    ["Verification", "#6D28D9"],
  ]
  return (
    <section className="page design-page">
      <div className="page-heading">
        <div>
          <p className="overline">FONDASI PRODUK</p>
          <h1>Design System</h1>
          <p>
            Token dan komponen acuan untuk seluruh modul K3PLH & Operasional
            GMI.
          </p>
        </div>
        <StatusBadge tone="info">Versi 0.1</StatusBadge>
      </div>
      <section className="ds-section">
        <h2>Warna</h2>
        <p>
          Palet utama dengan kontras teks yang memenuhi kebutuhan antarmuka
          enterprise.
        </p>
        <div className="color-grid">
          {colors.map(([name, value]) => (
            <div className="color-token" key={name}>
              <span style={{ background: value }} />
              <strong>{name}</strong>
              <code>{value}</code>
            </div>
          ))}
        </div>
      </section>
      <section className="ds-section">
        <h2>Tipografi</h2>
        <div className="type-list">
          <div>
            <span>Display · 28/36</span>
            <strong className="type-display">Keselamatan dan kinerja</strong>
          </div>
          <div>
            <span>H1 · 24/32</span>
            <strong className="type-h1">Dashboard Operasional</strong>
          </div>
          <div>
            <span>H2 · 20/28</span>
            <strong className="type-h2">Temuan & PICA</strong>
          </div>
          <div>
            <span>Body · 14/20</span>
            <p>
              Data yang konsisten mendukung keputusan yang dapat ditelusuri.
            </p>
          </div>
          <div>
            <span>Small · 12/16</span>
            <small>Diperbarui 30 Sep 2026, 17:10 WIB</small>
          </div>
        </div>
      </section>
      <section className="ds-section">
        <h2>Status badge</h2>
        <p>
          Status wajib menggunakan label baku dan tidak dibedakan dengan warna
          saja.
        </p>
        <div className="badge-grid">
          {badgeRows.map(([label, tone]) => (
            <StatusBadge
              key={label}
              tone={tone}
              outlined={label === "Dikembalikan" || label === "Ditolak"}
            >
              {label}
            </StatusBadge>
          ))}
        </div>
        <div className="badge-grid">
          <StatusBadge tone="success">Berlaku</StatusBadge>
          <ExpiryChip days={18} />
          <StatusBadge tone="danger">Kedaluwarsa</StatusBadge>
          <StatusBadge dashed>Belum Ada</StatusBadge>
          <StatusBadge tone="success">NIHIL</StatusBadge>
          <StatusBadge icon="lock">Terbit</StatusBadge>
          <StatusBadge icon="help">Rumus belum disahkan</StatusBadge>
        </div>
      </section>
      <section className="ds-section">
        <h2>Komponen inti</h2>
        <div className="component-grid">
          <KpiDemo />
          <div className="component-stack">
            <RestrictedData />
            <Skeleton lines={3} />
            <Toast message="Perubahan berhasil disimpan" />
          </div>
        </div>
      </section>
      <section className="ds-section">
        <h2>Data table</h2>
        <div className="table-toolbar">
          <div className="saved-views">
            <button className="is-active">Semua</button>
            <button>Milik saya</button>
            <button>Overdue</button>
          </div>
          <div>
            <button>↕ Kerapatan</button>
            <button>Ekspor</button>
          </div>
        </div>
        <div className="demo-table">
          <table>
            <thead>
              <tr>
                <th>
                  <input type="checkbox" aria-label="Pilih semua" />
                </th>
                <th>ID ↕</th>
                <th>Judul</th>
                <th>Status</th>
                <th>Pemilik</th>
                <th>Tenggat</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <input type="checkbox" aria-label="Pilih TMN-2026-0087" />
                </td>
                <td>TMN-2026-0087</td>
                <td>Pelindung fan kondensor longgar</td>
                <td>
                  <StatusBadge tone="warning">In Progress</StatusBadge>
                </td>
                <td>Fajar Nugroho</td>
                <td>03 Okt 2026</td>
              </tr>
              <tr>
                <td>
                  <input type="checkbox" aria-label="Pilih INS-2026-0230" />
                </td>
                <td>INS-2026-0230</td>
                <td>Inspeksi Workshop Service</td>
                <td>
                  <StatusBadge tone="verification">
                    Menunggu Verifikasi
                  </StatusBadge>
                </td>
                <td>Andi Pratama</td>
                <td>30 Sep 2026</td>
              </tr>
            </tbody>
          </table>
          <footer>
            <span>1–2 dari 134</span>
            <span>‹ &nbsp; 1 &nbsp; 2 &nbsp; 3 &nbsp; ›</span>
          </footer>
        </div>
      </section>
    </section>
  )
}

function MobileTabs({
  active,
  onSelect,
}: {
  active: string
  onSelect: (item: string) => void
}) {
  return (
    <nav className="mobile-tabs" aria-label="Navigasi mobile">
      {[
        ["Dashboard", "grid"],
        ["Tugas Saya", "clipboard"],
        ["Lapor", "plus"],
        ["Notifikasi", "bell"],
        ["Profil", "user"],
      ].map(([label, icon]) => (
        <button
          key={label}
          className={`${active === label ? "is-active" : ""} ${
            label === "Lapor" ? "is-primary" : ""
          }`}
          onClick={() => onSelect(label)}
        >
          <span>
            <Icon name={icon as "grid"} size={20} />
          </span>
          <small>{label === "Dashboard" ? "Beranda" : label}</small>
        </button>
      ))}
    </nav>
  )
}

function AppShell({ onLogout }: { onLogout: () => void }) {
  const [active, setActive] = useState("Dashboard")
  const [role, setRole] = useState("Manajemen")
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  useEffect(() => {
    if (role === "Karyawan") {
      setActive((current) =>
        [
          "Dashboard",
          "Lapor",
          "Lapor Kejadian",
          "Tugas Saya",
          "Notifikasi",
          "Profil Rudi Hartono",
        ].includes(current)
          ? current
          : "Dashboard",
      )
    } else if (role === "Auditor") {
      setActive("Dashboard")
    }
  }, [role])
  return (
    <div className={`app-shell ${collapsed ? "shell-collapsed" : ""}`}>
      <Sidebar
        active={active}
        role={role}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggle={() => setCollapsed(!collapsed)}
        onClose={() => setMobileOpen(false)}
        onSelect={setActive}
      />
      <div className="workspace">
        <Topbar
          active={active}
          role={role}
          onRole={setRole}
          onMenu={() => setMobileOpen(true)}
          onNavigate={setActive}
          onLogout={onLogout}
        />
        <main className="workspace__main">
          {active === "Design System" ? (
            <DesignSystemPage />
          ) : active === "Status UI" ? (
            <SystemStates onNavigate={setActive} />
          ) : active === "Dashboard" ? (
            <Dashboard role={role} onNavigate={setActive} />
          ) : active === "Lapor Kejadian" || active === "Lapor" ? (
            <IncidentReport
              onNavigate={setActive}
              reporter={role === "Karyawan" ? "Rudi Hartono" : "Andi Pratama"}
            />
          ) : active === "Kejadian & Investigasi" ||
            active === "KJD-2026-0012" ||
            active === "KJD-2026-0013" ? (
            <IncidentManagement
              role={role}
              page={active}
              onNavigate={setActive}
            />
          ) : active === "Temuan & PICA" || active === "TMN-2026-0087" ? (
            <FindingManagement page={active} onNavigate={setActive} />
          ) : active === "Inspeksi & Observasi" ||
            active === "Checklist Inspeksi" ||
            active === "Observasi KTA/TTA" ? (
            <InspectionManagement page={active} onNavigate={setActive} />
          ) : active === "TSP & Aktivitas" ? (
            <TspManagement onNavigate={setActive} />
          ) : active === "Manpower" ||
            active === "Profil Rudi Hartono" ||
            active === "Kompetensi & Pelatihan" ||
            active === "Pelatihan Awareness AC" ||
            active === "MCU" ? (
            <PeopleCompliance
              page={active}
              role={role}
              onNavigate={setActive}
            />
          ) : active === "Kontraktor & Legalitas" ||
            active === "PT Sinar Teknik Mandiri" ||
            active === "PJO/PJA" ? (
            <ContractorManagement
              page={active}
              role={role}
              onNavigate={setActive}
            />
          ) : active === "Prosedur & Dokumen" ||
            active === "GMI-SOP-HSE-014" ||
            active === "GMI-IK-OPS-009" ||
            active === "Evaluasi Peraturan" ||
            active === "Register Keselamatan Operasi" ? (
            <DocumentsManagement page={active} onNavigate={setActive} />
          ) : active === "Dashboard Maintenance" ||
            active === "PS & Backlog" ||
            active === "Material Request" ||
            active === "Readiness LIB" ||
            active === "Metal Scrap" ? (
            <MaintenanceManagement page={active} onNavigate={setActive} />
          ) : active === "Laporan Periode" ||
            active === "Workspace Laporan PJO" ||
            active === "Laporan Agustus 2026" ? (
            <ReportManagement page={active} onNavigate={setActive} />
          ) : active === "Notifikasi" ||
            active === "Tugas Saya" ||
            active === "Pengaturan Pengingat" ? (
            <NotificationsManagement
              page={active}
              role={role}
              onNavigate={setActive}
            />
          ) : active === "Pengguna & Peran" ||
            active === "Master Data" ||
            active === "Impor Data" ||
            active === "Kamus KPI" ||
            active === "KPI LTIFR" ||
            active === "KPI PS Accuracy" ||
            active === "Audit Trail" ? (
            <AdminManagement page={active} onNavigate={setActive} />
          ) : (
            <NotFound onNavigate={setActive} />
          )}
        </main>
      </div>
      <MobileTabs
        active={active}
        onSelect={(page) =>
          setActive(page === "Profil" ? "Profil Rudi Hartono" : page)
        }
      />
      <DemoFlow onRole={setRole} onNavigate={setActive} />
    </div>
  )
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false)
  return loggedIn ? (
    <AppShell onLogout={() => setLoggedIn(false)} />
  ) : (
    <LoginScreen onLogin={() => setLoggedIn(true)} />
  )
}
