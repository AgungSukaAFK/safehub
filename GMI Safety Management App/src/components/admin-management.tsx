import { useState, type ReactNode } from "react"
import { Button, Field, Icon, IconButton, StatusBadge } from "./ui"

type Props = { page: string onNavigate: (page: string) => void }

const users = [
  [
    "Budi Santoso",
    "budi.santoso@gmi.co.id",
    "PJO",
    "Site MIFA · Semua Section",
    "Aktif",
    "31 Okt 2026, 08:02",
  ],
  [
    "Andi Pratama",
    "andi.pratama@gmi.co.id",
    "HSE",
    "Site MIFA · HSE",
    "Aktif",
    "31 Okt 2026, 08:15",
  ],
  [
    "Fajar Nugroho",
    "fajar.nugroho@gmi.co.id",
    "Pengawas",
    "Site MIFA · Service AC",
    "Aktif",
    "30 Okt 2026, 17:22",
  ],
  [
    "Dewi Lestari",
    "dewi.lestari@gmi.co.id",
    "HR",
    "Site MIFA · Admin & HR",
    "Aktif",
    "30 Okt 2026, 15:48",
  ],
  [
    "Hendra Wijaya",
    "hendra.wijaya@gmi.co.id",
    "Service/Maintenance",
    "Site MIFA · Planner",
    "Aktif",
    "31 Okt 2026, 07:50",
  ],
  [
    "Sari Wulandari",
    "sari.wulandari@gmi.co.id",
    "SCM/Gudang",
    "Site MIFA · Warehouse/SCM",
    "Aktif",
    "29 Okt 2026, 16:10",
  ],
  [
    "Rudi Hartono",
    "GMI-0017",
    "Karyawan",
    "Site MIFA · Service AC",
    "Aktif",
    "31 Okt 2026, 07:32",
  ],
  [
    "Ahmad Rizal",
    "ahmad.rizal@audit.co.id",
    "Auditor",
    "Site MIFA · Read-only",
    "Nonaktif",
    "18 Sep 2026, 11:04",
  ],
] as const

function AdminHeader({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="overline">ADMIN</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  )
}

function UsersPage() {
  const [tab, setTab] = useState("Pengguna")
  const [selected, setSelected] = useState<typeof users[number] | null>(null)
  return (
    <section className="page admin-page">
      <AdminHeader
        title="Pengguna & Peran"
        description="Kelola pengguna, role, cakupan data, dan hak akses."
        action={
          <Button className="create-button">
            <Icon name="plus" size={15} />
            Tambah Pengguna
          </Button>
        }
      />
      <nav className="admin-tabs">
        <button
          className={tab === "Pengguna" ? "is-active" : ""}
          onClick={() => setTab("Pengguna")}
        >
          Pengguna
        </button>
        <button
          className={tab === "Matriks Hak Akses" ? "is-active" : ""}
          onClick={() => setTab("Matriks Hak Akses")}
        >
          Matriks Hak Akses
        </button>
      </nav>
      {tab === "Pengguna" ? (
        <div className="admin-table-card">
          <header>
            <div>
              <h2>Daftar Pengguna</h2>
              <span>7 aktif · 1 nonaktif</span>
            </div>
            <div>
              <button>
                Semua peran <Icon name="chevron-down" size={12} />
              </button>
              <button>
                Semua status <Icon name="chevron-down" size={12} />
              </button>
            </div>
          </header>
          <div className="admin-table">
            <table>
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Email/NIK</th>
                  <th>Peran</th>
                  <th>Cakupan Site/Section</th>
                  <th>Status</th>
                  <th>Login Terakhir</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user[1]} onClick={() => setSelected(user)}>
                    <td>
                      <div className="employee-cell">
                        <span>
                          {user[0]
                            .split(" ")
                            .map((word) => word[0])
                            .slice(0, 2)
                            .join("")}
                        </span>
                        <strong>{user[0]}</strong>
                      </div>
                    </td>
                    <td>{user[1]}</td>
                    <td>
                      <StatusBadge tone="info">{user[2]}</StatusBadge>
                    </td>
                    <td>{user[3]}</td>
                    <td>
                      <StatusBadge
                        tone={user[4] === "Aktif" ? "success" : "neutral"}
                      >
                        {user[4]}
                      </StatusBadge>
                    </td>
                    <td>{user[5]}</td>
                    <td>
                      <Icon name="arrow-right" size={15} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <AccessMatrix />
      )}
      {selected && (
        <UserDrawer user={selected} onClose={() => setSelected(null)} />
      )}
    </section>
  )
}

const permissions: Record<string, string[]> = {
  Manajemen: ["Lihat", "Review", "Setujui", "Ekspor"],
  PJO: ["Lihat", "Buat", "Ubah", "Review", "Setujui", "Ekspor"],
  HSE: ["Lihat", "Buat", "Ubah", "Review", "Ekspor"],
  Pengawas: ["Lihat", "Buat", "Ubah", "Review"],
  HR: ["Lihat", "Buat", "Ubah", "Ekspor"],
  "Service/Maintenance": ["Lihat", "Buat", "Ubah"],
  "SCM/Gudang": ["Lihat", "Buat", "Ubah", "Ekspor"],
  Karyawan: ["Lihat", "Buat"],
  Auditor: ["Lihat", "Ekspor"],
  Administrator: ["Lihat", "Buat", "Ubah", "Review", "Setujui", "Ekspor"],
  "Data medis": ["HSE", "HR"],
  "Data komersial": ["Manajemen", "PJO", "SCM/Gudang", "Administrator"],
}

function AccessMatrix() {
  const modules = [
    "Dashboard",
    "K3LH",
    "People",
    "Dokumen",
    "Maintenance",
    "Laporan",
    "Admin",
  ]
  return (
    <div className="access-matrix-wrap">
      <div className="access-note">
        <Icon name="shield" size={17} />
        Hak akses efektif juga mengikuti cakupan Site dan Section pengguna.
      </div>
      <div className="access-matrix">
        <table>
          <thead>
            <tr>
              <th>Peran / Data Khusus</th>
              {modules.map((module) => (
                <th key={module}>{module}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(permissions).map(([role, items]) => (
              <tr
                key={role}
                className={role.startsWith("Data") ? "special-access-row" : ""}
              >
                <td>
                  <strong>{role}</strong>
                </td>
                {modules.map((module, index) => (
                  <td key={module}>
                    {role.startsWith("Data") ? (
                      index === 2 || index === 5 ? (
                        <div className="permission-chips special">
                          {items.map((item) => (
                            <span key={item}>{item}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="no-access">—</span>
                      )
                    ) : (
                      <div className="permission-chips">
                        {items
                          .filter(
                            (_, itemIndex) => itemIndex <= (index % 4) + 1,
                          )
                          .map((item) => (
                            <span key={item}>{item}</span>
                          ))}
                      </div>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function UserDrawer({
  user,
  onClose,
}: {
  user: typeof users[number]
  onClose: () => void
}) {
  const [active, setActive] = useState(user[4] === "Aktif")
  const [roles, setRoles] = useState([user[2]])
  const allRoles = [
    "Manajemen",
    "PJO",
    "PJA",
    "HSE",
    "Pengawas",
    "HR",
    "Service/Maintenance",
    "SCM/Gudang",
    "Karyawan",
    "Auditor",
    "Administrator",
  ]
  return (
    <>
      <button
        className="drawer-backdrop"
        onClick={onClose}
        aria-label="Tutup drawer"
      />
      <aside className="user-drawer">
        <header>
          <div>
            <p className="overline">PENGGUNA</p>
            <h2>{user[0]}</h2>
            <span>{user[1]}</span>
          </div>
          <IconButton label="Tutup" onClick={onClose}>
            <Icon name="x" />
          </IconButton>
        </header>
        <div>
          <section className="drawer-user-identity">
            <span className="profile-photo">
              {user[0]
                .split(" ")
                .map((word) => word[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div>
              <strong>{user[0]}</strong>
              <small>{user[1]}</small>
              <StatusBadge tone={active ? "success" : "neutral"}>
                {active ? "Aktif" : "Nonaktif"}
              </StatusBadge>
            </div>
          </section>
          <fieldset>
            <legend>Peran</legend>
            <div className="drawer-role-grid">
              {allRoles.map((role) => (
                <label key={role}>
                  <input
                    type="checkbox"
                    checked={roles.includes(role)}
                    onChange={() =>
                      setRoles((current) =>
                        current.includes(role)
                          ? current.filter((item) => item !== role)
                          : [...current, role],
                      )
                    }
                  />
                  <span>
                    <Icon name="check" size={12} />
                  </span>
                  {role}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Cakupan Data</legend>
            <label className="select-field">
              <span>Site</span>
              <select>
                <option>Site MIFA</option>
                <option>Semua Site</option>
              </select>
            </label>
            <label className="select-field">
              <span>Section</span>
              <select>
                <option>{user[3].split(" · ")[1]}</option>
                <option>Semua Section</option>
              </select>
            </label>
          </fieldset>
          <div className="deactivate-user">
            <div>
              <Icon name="help" size={17} />
              <p>
                <strong>
                  {active
                    ? "Nonaktifkan pengguna"
                    : "Aktifkan kembali pengguna"}
                </strong>
                <span>Histori transaksi pengguna tetap tersimpan.</span>
              </p>
            </div>
            <Button onClick={() => setActive(!active)}>
              {active ? "Nonaktifkan" : "Aktifkan"}
            </Button>
          </div>
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

const masterData: Record<string, string[][]> = {
  Lokasi: [
    ["LOC-001", "Workshop Service", "01 Jan 2024", "—", "Aktif", "34"],
    ["LOC-002", "Pit Area", "01 Jan 2024", "—", "Aktif", "28"],
    ["LOC-003", "Hauling Road", "01 Jan 2024", "—", "Aktif", "12"],
    ["LOC-004", "Warehouse", "01 Jan 2024", "—", "Aktif", "19"],
    ["LOC-005", "Office GMI", "01 Jan 2024", "—", "Aktif", "22"],
  ],
  Section: [
    ["SEC-HSE", "HSE", "01 Jan 2024", "—", "Aktif", "46"],
    ["SEC-SVC", "Service AC", "01 Jan 2024", "—", "Aktif", "82"],
    ["SEC-PLN", "Planner", "01 Jan 2024", "—", "Aktif", "17"],
    ["SEC-WHS", "Warehouse/SCM", "01 Jan 2024", "—", "Aktif", "29"],
  ],
  "Kategori Kejadian": [
    ["KJD-NM", "Near Miss", "01 Jan 2024", "—", "Aktif", "18"],
    ["KJD-INJ", "Cedera", "01 Jan 2024", "—", "Aktif", "8"],
    ["KJD-PD", "Kerusakan Properti", "01 Jan 2024", "—", "Aktif", "6"],
  ],
  "Kategori Temuan": [
    ["TMN-KO", "Keselamatan Operasional", "01 Jan 2024", "—", "Aktif", "42"],
    ["TMN-LH", "Lingkungan Hidup", "01 Jan 2024", "—", "Aktif", "11"],
  ],
  "Jenis Dokumen": [
    ["DOC-SOP", "SOP", "01 Jan 2024", "—", "Aktif", "18"],
    ["DOC-IK", "Instruksi Kerja", "01 Jan 2024", "—", "Aktif", "14"],
    ["DOC-JSA", "JSA", "01 Jan 2024", "—", "Aktif", "9"],
  ],
  "Unit/Aset": [
    ["H57197", "HD785-7", "01 Jan 2024", "—", "Aktif", "56"],
    ["E51203", "PC1250", "01 Jan 2024", "—", "Aktif", "43"],
    ["G5809", "GD825A", "01 Jan 2024", "—", "Aktif", "39"],
  ],
  Kompetensi: [
    ["KOM-K3U", "K3 Umum", "01 Jan 2024", "—", "Aktif", "28"],
    ["KOM-P3K", "P3K", "01 Jan 2024", "—", "Aktif", "12"],
    ["KOM-AC", "Teknisi Refrigerasi/AC", "01 Jan 2024", "—", "Aktif", "16"],
  ],
  Status: [
    ["STS-OPEN", "Open", "01 Jan 2024", "—", "Aktif", "100"],
    ["STS-PROG", "In Progress", "01 Jan 2024", "—", "Aktif", "87"],
    ["STS-CLOSED", "Closed", "01 Jan 2024", "—", "Aktif", "145"],
  ],
}

function MasterData() {
  const [type, setType] = useState("Lokasi")
  return (
    <section className="page admin-page">
      <AdminHeader
        title="Master Data"
        description="Kelola referensi data yang digunakan di seluruh modul."
        action={
          <Button className="create-button">
            <Icon name="plus" size={15} />
            Tambah {type}
          </Button>
        }
      />
      <div className="master-layout">
        <aside>
          {Object.keys(masterData).map((item) => (
            <button
              key={item}
              className={type === item ? "is-active" : ""}
              onClick={() => setType(item)}
            >
              <Icon
                name={
                  item === "Lokasi"
                    ? "building"
                    : item === "Unit/Aset"
                      ? "tools"
                      : item === "Kompetensi"
                        ? "book"
                        : "clipboard"
                }
                size={16}
              />
              <span>{item}</span>
              <b>{masterData[item].length}</b>
            </button>
          ))}
        </aside>
        <main>
          <header>
            <div>
              <h2>{type}</h2>
              <span>{masterData[type].length} item</span>
            </div>
            <div className="master-search">
              <Icon name="search" size={14} />
              <input placeholder={`Cari ${type.toLowerCase()}…`} />
            </div>
          </header>
          <table>
            <thead>
              <tr>
                <th>Kode</th>
                <th>Nama</th>
                <th>Berlaku Mulai</th>
                <th>Berlaku s.d.</th>
                <th>Status</th>
                <th>Dipakai</th>
                <th>Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {masterData[type].map(
                ([code, name, start, end, status, used]) => (
                  <tr key={code}>
                    <td>
                      <strong>{code}</strong>
                    </td>
                    <td>{name}</td>
                    <td>{start}</td>
                    <td>{end}</td>
                    <td>
                      <StatusBadge tone="success">{status}</StatusBadge>
                    </td>
                    <td>{used} transaksi</td>
                    <td>
                      <div className="master-actions">
                        <button title="Ubah">
                          <Icon name="settings" size={15} />
                        </button>
                        <button
                          disabled={Number(used) > 0}
                          title={
                            Number(used) > 0
                              ? `Dipakai di ${used} transaksi — hanya dapat dinonaktifkan.`
                              : "Hapus"
                          }
                        >
                          <Icon name="x" size={15} />
                        </button>
                        <button title="Nonaktifkan">
                          <Icon name="more" size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </main>
      </div>
    </section>
  )
}

const importSteps = [
  "Pilih Template & Unggah",
  "Pemetaan Kolom",
  "Pratinjau & Validasi",
  "Hasil",
]

function ImportData({ onNavigate }: Pick<Props, "onNavigate">) {
  const [step, setStep] = useState(1)
  const [uploaded, setUploaded] = useState(false)
  return (
    <section className="page admin-page import-page">
      <AdminHeader
        title="Impor Data"
        description="Impor data historis atau periodik menggunakan template terkendali."
      />
      <ol className="import-stepper">
        {importSteps.map((item, index) => (
          <li
            key={item}
            className={
              step === index + 1
                ? "is-active"
                : step > index + 1
                  ? "is-complete"
                  : ""
            }
          >
            <span>
              {step > index + 1 ? <Icon name="check" size={13} /> : index + 1}
            </span>
            <strong>{item}</strong>
          </li>
        ))}
      </ol>
      <div className="import-workspace">
        {step === 1 && (
          <UploadStep uploaded={uploaded} onUpload={() => setUploaded(true)} />
        )}
        {step === 2 && <MappingStep />}
        {step === 3 && <ValidationStep />}
        {step === 4 && <ImportResult onNavigate={onNavigate} />}
        {step < 4 && (
          <footer>
            <Button
              className="back-button"
              disabled={step === 1}
              onClick={() => setStep(step - 1)}
            >
              Kembali
            </Button>
            <Button
              className="primary-button"
              disabled={step === 1 && !uploaded}
              onClick={() => setStep(step + 1)}
            >
              Lanjutkan <Icon name="arrow-right" size={15} />
            </Button>
          </footer>
        )}
      </div>
    </section>
  )
}

function UploadStep({
  uploaded,
  onUpload,
}: {
  uploaded: boolean
  onUpload: () => void
}) {
  return (
    <div className="import-step-content">
      <header>
        <h2>1. Pilih Template & Unggah</h2>
        <p>Pilih jenis data dan unggah file sesuai template.</p>
      </header>
      <div className="import-form-grid">
        <label className="select-field">
          <span>Template *</span>
          <select>
            <option>PS Plan vs Actual</option>
            <option>Statistik K3LH</option>
            <option>Data Manpower</option>
            <option>Material Request</option>
          </select>
        </label>
        <label className="select-field">
          <span>Sheet</span>
          <select disabled={!uploaded}>
            <option>
              {uploaded ? "PS September 2026" : "Unggah file terlebih dahulu"}
            </option>
          </select>
        </label>
      </div>
      <button
        className={`import-dropzone ${uploaded ? "is-uploaded" : ""}`}
        onClick={onUpload}
      >
        {uploaded ? (
          <>
            <Icon name="check" size={28} />
            <strong>PS_September2026.xlsx</strong>
            <span>48,2 KB · 130 baris terdeteksi</span>
            <small>Klik untuk mengganti file</small>
          </>
        ) : (
          <>
            <Icon name="upload" size={28} />
            <strong>Tarik file XLSX/CSV ke sini</strong>
            <span>atau klik untuk memilih file</span>
            <small>XLSX, CSV · maks 20 MB</small>
          </>
        )}
      </button>
    </div>
  )
}

const mappings = [
  ["Unit No.", "Unit", "100%", true],
  ["Service Type", "Tipe Service", "100%", true],
  ["Forecast HM", "Forecast HM", "96%", true],
  ["Actual HM", "HM Aktual", "94%", true],
  ["Plan Date", "Tanggal Rencana", "92%", true],
  ["Actual Date", "Tanggal Aktual", "92%", false],
  ["Remarks", "Catatan", "78%", false],
]

function MappingStep() {
  return (
    <div className="import-step-content">
      <header>
        <h2>2. Pemetaan Kolom</h2>
        <p>
          Cocokkan header Excel dengan field sistem. Kolom bertanda * wajib
          dipetakan.
        </p>
      </header>
      <div className="mapping-table">
        <table>
          <thead>
            <tr>
              <th>Header Excel</th>
              <th>Field Sistem</th>
              <th>Auto-match</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {mappings.map(([excel, field, confidence, required]) => (
              <tr key={excel}>
                <td>
                  <strong>{excel}</strong>
                  {required && <b>*</b>}
                </td>
                <td>
                  <select defaultValue={field}>
                    <option>{field}</option>
                    <option>— Abaikan kolom —</option>
                  </select>
                </td>
                <td>
                  <span
                    className={
                      Number(String(confidence).replace("%", "")) < 90
                        ? "confidence-warning"
                        : ""
                    }
                  >
                    {confidence}
                  </span>
                </td>
                <td>
                  <StatusBadge tone="success">Terpetakan</StatusBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const previewRows = [
  ["1", "H57197", "PS2", "10.500", "10.532", "28 Sep 2026", "Valid"],
  ["2", "E51203", "PS1", "8.000", "8.072", "27 Sep 2026", "Valid"],
  [
    "14",
    "G5809",
    "PS3",
    "14.000",
    "13.968",
    "18 Sep 2026",
    "Duplikat dengan baris 14",
  ],
  ["38", "DA54853", "PS1", "6.500", "—", "31/13/2026", "Tanggal tidak valid"],
  [
    "76",
    "E99999",
    "PS2",
    "9.000",
    "9.040",
    "12 Sep 2026",
    "Unit tidak terdaftar",
  ],
  [
    "102",
    "H57183",
    "PS4",
    "20.000",
    "20.118",
    "08 Sep 2026",
    "NIK tidak ditemukan",
  ],
] as const

function ValidationStep() {
  return (
    <div className="import-step-content">
      <header>
        <div>
          <h2>3. Pratinjau & Validasi</h2>
          <p>Periksa hasil validasi sebelum data diimpor.</p>
        </div>
        <div className="validation-summary">
          <StatusBadge tone="success">125 valid</StatusBadge>
          <StatusBadge tone="danger">3 gagal</StatusBadge>
          <StatusBadge tone="warning">2 duplikat</StatusBadge>
        </div>
      </header>
      <div className="validation-table">
        <table>
          <thead>
            <tr>
              <th>Baris</th>
              <th>Unit</th>
              <th>Service</th>
              <th>Forecast HM</th>
              <th>HM Aktual</th>
              <th>Tanggal Aktual</th>
              <th>Validasi</th>
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row) => (
              <tr
                key={row[0]}
                className={
                  row[6] === "Valid"
                    ? "is-valid"
                    : row[6].startsWith("Duplikat")
                      ? "is-duplicate"
                      : "is-invalid"
                }
              >
                {row.map((cell, index) => (
                  <td key={index}>
                    {index === 6 ? (
                      <span>
                        <Icon
                          name={
                            cell === "Valid"
                              ? "check"
                              : cell.startsWith("Duplikat")
                                ? "help"
                                : "x"
                          }
                          size={13}
                        />
                        {cell}
                      </span>
                    ) : (
                      cell
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ImportResult({ onNavigate }: Pick<Props, "onNavigate">) {
  return (
    <div className="import-result">
      <div className="success-check">
        <Icon name="check" size={30} />
      </div>
      <h2>Impor selesai</h2>
      <p>Data valid telah disimpan. Baris gagal dan duplikat tidak diimpor.</p>
      <div className="import-result-counts">
        <div>
          <strong>125</strong>
          <span>Berhasil</span>
        </div>
        <div className="is-danger">
          <strong>3</strong>
          <span>Gagal</span>
        </div>
        <div className="is-warning">
          <strong>2</strong>
          <span>Duplikat</span>
        </div>
      </div>
      <dl>
        <div>
          <dt>File</dt>
          <dd>PS_September2026.xlsx</dd>
        </div>
        <div>
          <dt>Sheet</dt>
          <dd>PS September 2026</dd>
        </div>
        <div>
          <dt>Waktu</dt>
          <dd>31 Okt 2026, 09:14 WIB</dd>
        </div>
        <div>
          <dt>Pengimpor</dt>
          <dd>Hendra Wijaya</dd>
        </div>
      </dl>
      <div className="import-result-actions">
        <Button className="secondary-button">
          <Icon name="file" size={15} />
          Unduh laporan baris gagal
        </Button>
        <Button
          className="primary-button"
          onClick={() => onNavigate("PS & Backlog")}
        >
          Lihat data yang diimpor
        </Button>
      </div>
    </div>
  )
}

const kpis = [
  [
    "KPI-HSE-001",
    "LTIFR",
    "Kasus/1 juta jam",
    "Bulanan/YTD",
    "HSE",
    "v2",
    "Disahkan",
  ],
  [
    "KPI-HSE-002",
    "LTISR",
    "Hari/1 juta jam",
    "Bulanan/YTD",
    "HSE",
    "v2",
    "Disahkan",
  ],
  [
    "KPI-MNT-001",
    "Physical Availability",
    "%",
    "Bulanan",
    "Planner",
    "v3",
    "Disahkan",
  ],
  ["KPI-MNT-002", "PS Accuracy", "%", "Bulanan", "Planner", "v1", "Draft"],
  ["KPI-MNT-003", "MTBF", "Jam", "Bulanan", "Planner", "v1", "Draft"],
  ["KPI-MNT-004", "MTTR", "Jam", "Bulanan", "Planner", "v1", "Draft"],
  ["KPI-HR-001", "Manpower Fulfillment", "%", "Bulanan", "HR", "v1", "Draft"],
] as const

function KpiDictionary({ onNavigate }: Pick<Props, "onNavigate">) {
  return (
    <section className="page admin-page">
      <AdminHeader
        title="Kamus KPI"
        description="Definisi, formula, sumber, dan versi indikator kinerja."
        action={
          <Button className="create-button">
            <Icon name="plus" size={15} />
            Tambah KPI
          </Button>
        }
      />
      <div className="kpi-dictionary-note">
        <Icon name="help" size={17} />
        KPI berstatus Draft akan menampilkan tag “Rumus belum disahkan” pada
        dashboard dan laporan.
      </div>
      <div className="admin-table-card">
        <header>
          <div>
            <h2>Daftar KPI</h2>
            <span>3 disahkan · 4 draft</span>
          </div>
          <div>
            <button>
              Semua pemilik <Icon name="chevron-down" size={12} />
            </button>
            <button>
              Semua status <Icon name="chevron-down" size={12} />
            </button>
          </div>
        </header>
        <div className="admin-table">
          <table>
            <thead>
              <tr>
                <th>Kode</th>
                <th>Nama KPI</th>
                <th>Satuan</th>
                <th>Periode</th>
                <th>Pemilik</th>
                <th>Versi</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {kpis.map(
                ([code, name, unit, period, owner, version, status]) => (
                  <tr
                    key={code}
                    onClick={() =>
                      (name === "LTIFR" || name === "PS Accuracy") &&
                      onNavigate(`KPI ${name}`)
                    }
                    className={
                      name === "LTIFR" || name === "PS Accuracy"
                        ? "is-clickable"
                        : ""
                    }
                  >
                    <td>
                      <strong>{code}</strong>
                    </td>
                    <td>{name}</td>
                    <td>{unit}</td>
                    <td>{period}</td>
                    <td>{owner}</td>
                    <td>{version}</td>
                    <td>
                      <StatusBadge
                        tone={status === "Disahkan" ? "success" : "neutral"}
                      >
                        {status}
                      </StatusBadge>
                    </td>
                    <td>
                      <Icon name="arrow-right" size={15} />
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

function KpiDetail({ page, onNavigate }: Props) {
  const draft = page === "KPI PS Accuracy"
  return (
    <section className="page kpi-detail-page">
      <button className="record-back" onClick={() => onNavigate("Kamus KPI")}>
        <Icon name="arrow-right" size={14} />
        Kembali ke Kamus KPI
      </button>
      {draft && (
        <div className="kpi-draft-banner">
          <Icon name="help" size={18} />
          <p>
            <strong>Belum disahkan</strong>
            <span>Dashboard menampilkan tag “Rumus belum disahkan”.</span>
          </p>
        </div>
      )}
      <header>
        <div>
          <p className="overline">
            {draft ? "KPI-MNT-002 · V1" : "KPI-HSE-001 · V2"}
          </p>
          <h1>{draft ? "PS Accuracy" : "LTIFR"}</h1>
          <p>
            {draft
              ? "Periodical Service Accuracy"
              : "Lost Time Injury Frequency Rate"}
          </p>
        </div>
        <StatusBadge tone={draft ? "neutral" : "success"}>
          {draft ? "Draft" : "Disahkan"}
        </StatusBadge>
      </header>
      <div className="kpi-detail-grid">
        <main>
          <section>
            <h2>Definisi</h2>
            <p>
              {draft
                ? "Persentase pekerjaan Periodical Service yang dilaksanakan dalam rentang toleransi HM terhadap forecast."
                : "Frekuensi kejadian Lost Time Injury untuk setiap satu juta jam kerja pada periode pengukuran."}
            </p>
          </section>
          <section>
            <h2>Rumus</h2>
            <div className="formula-box">
              <div>
                <span>Pembilang</span>
                <strong>
                  {draft
                    ? "Jumlah PS dalam toleransi"
                    : "Jumlah LTI × 1.000.000"}
                </strong>
              </div>
              <i>÷</i>
              <div>
                <span>Penyebut</span>
                <strong>{draft ? "Total PS aktual" : "Total jam kerja"}</strong>
              </div>
            </div>
          </section>
          <section>
            <h2>Aturan Perhitungan</h2>
            <dl className="kpi-rules">
              <div>
                <dt>Satuan</dt>
                <dd>{draft ? "%" : "Kasus per 1 juta jam"}</dd>
              </div>
              <div>
                <dt>Periode</dt>
                <dd>Bulanan dan YTD</dd>
              </div>
              <div>
                <dt>Pembulatan</dt>
                <dd>2 angka di belakang koma</dd>
              </div>
              <div>
                <dt>Threshold</dt>
                <dd>{draft ? "Target ≥ 90%" : "Target 0,00"}</dd>
              </div>
              <div>
                <dt>Data nihil</dt>
                <dd>Ditampilkan sebagai NIHIL</dd>
              </div>
              <div>
                <dt>Toleransi</dt>
                <dd>{draft ? "±50 HM dari forecast" : "Tidak berlaku"}</dd>
              </div>
            </dl>
          </section>
          <section>
            <h2>Contoh perhitungan</h2>
            <div className="calculation-example">
              <p>
                {draft
                  ? "21 PS akurat ÷ 24 total PS"
                  : "0 LTI × 1.000.000 ÷ 95.106 jam kerja"}
              </p>
              <strong>{draft ? "= 87,50%" : "= NIHIL (0,00)"}</strong>
            </div>
          </section>
        </main>
        <aside>
          <section>
            <h2>Metadata</h2>
            <dl>
              <div>
                <dt>Pemilik</dt>
                <dd>{draft ? "Planner" : "HSE"}</dd>
              </div>
              <div>
                <dt>Sumber data</dt>
                <dd>{draft ? "PS Plan vs Actual" : "Kejadian & Manpower"}</dd>
              </div>
              <div>
                <dt>Versi</dt>
                <dd>{draft ? "v1" : "v2"}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{draft ? "Draft" : "Disahkan"}</dd>
              </div>
            </dl>
          </section>
          <section>
            <h2>Riwayat Versi</h2>
            <div className="kpi-version-history">
              <div className={draft ? "is-current" : ""}>
                <span>{draft ? "v1" : "v2"}</span>
                <p>
                  <strong>
                    {draft ? "Draft awal formula" : "Disahkan oleh PJO"}
                  </strong>
                  <small>
                    {draft
                      ? "28 Okt 2026 · Hendra Wijaya"
                      : "03 Jan 2026 · Budi Santoso"}
                  </small>
                </p>
              </div>
              {!draft && (
                <div>
                  <span>v1</span>
                  <p>
                    <strong>Draft definisi dan formula</strong>
                    <small>20 Des 2025 · Andi Pratama</small>
                  </p>
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>
    </section>
  )
}

const auditRows = [
  [
    "31 Okt 2026, 09:14",
    "Hendra Wijaya",
    "Impor",
    "PS September 2026",
    "—",
    "—",
    "125 record",
    "Impor periodik dari PS_September2026.xlsx",
  ],
  [
    "31 Okt 2026, 08:54",
    "Andi Pratama",
    "Ubah",
    "LAP-PJO-2026-09",
    "Status",
    "Draft",
    "Dalam Review",
    "Diajukan ke pemilik data",
  ],
  [
    "31 Okt 2026, 08:15",
    "Andi Pratama",
    "Login",
    "Sesi pengguna",
    "—",
    "—",
    "Berhasil",
    "Login melalui SSO",
  ],
  [
    "30 Okt 2026, 16:42",
    "Budi Santoso",
    "Setujui",
    "TDK-2026-0145",
    "Status",
    "Menunggu Verifikasi",
    "Closed",
    "Bukti sesuai persyaratan",
  ],
  [
    "30 Okt 2026, 14:10",
    "Budi Santoso",
    "Kembalikan",
    "LAP-PJO-2026-09",
    "Status",
    "Dalam Review",
    "Dikembalikan",
    "Lengkapi bukti TSP 1.2",
  ],
  [
    "29 Okt 2026, 10:22",
    "Rudi Hartono",
    "Buat",
    "KJD-2026-0013",
    "—",
    "—",
    "Open",
    "Laporan melalui aplikasi mobile",
  ],
  [
    "28 Okt 2026, 09:11",
    "Dewi Lestari",
    "Ubah",
    "GMI-0017",
    "Tanggal PKWT",
    "12 Feb 2026",
    "12 Feb 2027",
    "Perpanjangan kontrak",
  ],
  [
    "27 Okt 2026, 17:05",
    "Sari Wulandari",
    "Ekspor",
    "Material Request",
    "Format",
    "—",
    "XLSX",
    "Rekonsiliasi bulanan SCM",
  ],
] as const

function AuditTrail() {
  return (
    <section className="page admin-page">
      <AdminHeader
        title="Audit Trail"
        description="Log aktivitas sistem yang tidak dapat diubah oleh pengguna operasional."
        action={
          <Button className="export-button">
            <Icon name="file" size={14} />
            Ekspor Log
          </Button>
        }
      />
      <div className="audit-readonly-note">
        <Icon name="lock" size={17} />
        <p>
          <strong>Log tidak dapat diubah oleh pengguna operasional.</strong>
          <span>
            Retensi dan akses audit mengikuti kebijakan administrator sistem.
          </span>
        </p>
      </div>
      <div className="audit-filter-bar">
        {["Periode", "Pengguna", "Modul", "Aksi"].map((filter) => (
          <label key={filter}>
            <span>{filter}</span>
            <select>
              <option>
                {filter === "Periode"
                  ? "Oktober 2026"
                  : `Semua ${filter.toLowerCase()}`}
              </option>
            </select>
          </label>
        ))}
      </div>
      <div className="audit-table-card">
        <div className="audit-log-table">
          <table>
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Pengguna</th>
                <th>Aksi</th>
                <th>Objek</th>
                <th>Field</th>
                <th>Nilai Sebelum</th>
                <th>Nilai Sesudah</th>
                <th>Alasan</th>
              </tr>
            </thead>
            <tbody>
              {auditRows.map(
                ([
                  time,
                  user,
                  action,
                  object,
                  field,
                  before,
                  after,
                  reason,
                ]) => (
                  <tr key={time + object}>
                    <td>{time} WIB</td>
                    <td>
                      <div className="employee-cell">
                        <span>
                          {user
                            .split(" ")
                            .map((word) => word[0])
                            .slice(0, 2)
                            .join("")}
                        </span>
                        <strong>{user}</strong>
                      </div>
                    </td>
                    <td>
                      <StatusBadge
                        tone={
                          action === "Setujui"
                            ? "success"
                            : action === "Kembalikan"
                              ? "warning"
                              : action === "Impor" || action === "Ekspor"
                                ? "info"
                                : "neutral"
                        }
                      >
                        {action}
                      </StatusBadge>
                    </td>
                    <td>
                      <button>{object}</button>
                    </td>
                    <td>{field}</td>
                    <td>{before}</td>
                    <td>{after}</td>
                    <td>{reason}</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

export default function AdminManagement({ page, onNavigate }: Props) {
  if (page === "Master Data") return <MasterData />
  if (page === "Impor Data") return <ImportData onNavigate={onNavigate} />
  if (page === "Kamus KPI") return <KpiDictionary onNavigate={onNavigate} />
  if (page === "KPI LTIFR" || page === "KPI PS Accuracy")
    return <KpiDetail page={page} onNavigate={onNavigate} />
  if (page === "Audit Trail") return <AuditTrail />
  return <UsersPage />
}
