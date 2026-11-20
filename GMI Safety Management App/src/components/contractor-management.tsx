import { useState, type ReactNode } from "react"
import {
  Button,
  ExpiryChip,
  Icon,
  IconButton,
  RestrictedData,
  StatusBadge,
} from "./ui"

type Props = { page: string role: string onNavigate: (page: string) => void }

const contractors = [
  [
    "PT Sinar Teknik Mandiri",
    "Subkontraktor",
    "Jasa Teknik Mekanikal",
    "Perawatan dan perbaikan unit AC",
    "Arif Rahman · 0812 4455 9081",
    42,
    54,
    "Menunggu definisi proses",
    "Aktif",
  ],
  [
    "PT Bara Safety Indonesia",
    "Kontraktor",
    "Keselamatan Kerja",
    "Inspeksi dan kalibrasi alat keselamatan",
    "Rizky Ananda · 0813 7721 0890",
    214,
    190,
    "Terdaftar",
    "Aktif",
  ],
  [
    "CV Aceh Mandiri Supply",
    "Subkontraktor",
    "Pengadaan Barang",
    "Penyediaan refrigerant dan material AC",
    "Nadia Putri · 0852 1180 4432",
    88,
    35,
    "Menunggu definisi proses",
    "Aktif",
  ],
  [
    "PT Lintas Energi Servis",
    "Kontraktor",
    "Jasa Kelistrikan",
    "Perawatan sistem kelistrikan workshop",
    "Dimas Prakoso · 0811 9055 2274",
    167,
    140,
    "Terverifikasi",
    "Aktif",
  ],
  [
    "PT Cipta Lingkungan Aceh",
    "Kontraktor",
    "Pengelolaan Lingkungan",
    "Pengangkutan limbah B3",
    "Maya Sari · 0823 6091 4481",
    25,
    96,
    "Terdaftar",
    "Aktif",
  ],
  [
    "CV Meulaboh Calibration",
    "Subkontraktor",
    "Kalibrasi",
    "Kalibrasi manifold dan alat ukur",
    "Zulfikar Ali · 0853 7702 1198",
    310,
    275,
    "Menunggu definisi proses",
    "Aktif",
  ],
  [
    "PT Samudra Karya Abadi",
    "Kontraktor",
    "Konstruksi",
    "Renovasi area office GMI",
    "Irfan Hakim · 0812 9034 1220",
    -65,
    -30,
    "Belum Ada",
    "Tidak Aktif",
  ],
  [
    "CV Karya Teknik Barat",
    "Subkontraktor",
    "Jasa Teknik",
    "Bantuan mekanik workshop",
    "M. Iqbal · 0852 8891 2260",
    -90,
    -74,
    "Belum Ada",
    "Tidak Aktif",
  ],
] as const

function ContractorList({ onNavigate }: Pick<Props, "onNavigate">) {
  return (
    <section className="page contractor-page">
      <div className="page-heading">
        <div>
          <p className="overline">PEOPLE & COMPLIANCE</p>
          <h1>Kontraktor & Legalitas</h1>
          <p>
            Pantau perusahaan mitra, izin usaha, kontrak, dan kepatuhan dokumen.
          </p>
        </div>
        <Button className="create-button">
          <Icon name="plus" size={15} />
          Tambah Kontraktor
        </Button>
      </div>
      <div className="contractor-kpis">
        <button>
          <StatusBadge tone="success">Aktif</StatusBadge>
          <strong>6</strong>
        </button>
        <button>
          <StatusBadge> Tidak Aktif</StatusBadge>
          <strong>2</strong>
        </button>
        <button>
          <StatusBadge tone="warning">Dokumen kurang</StatusBadge>
          <strong>3</strong>
        </button>
        <button>
          <StatusBadge tone="danger">Berakhir ≤ 60 hari</StatusBadge>
          <strong>2</strong>
        </button>
      </div>
      <div className="contractor-table-card">
        <header>
          <div>
            <h2>Daftar Perusahaan Mitra</h2>
            <span>8 perusahaan terdaftar</span>
          </div>
          <div className="contractor-filters">
            <button>
              Semua hubungan <Icon name="chevron-down" size={13} />
            </button>
            <button>
              Semua status <Icon name="chevron-down" size={13} />
            </button>
            <Button className="export-button">
              <Icon name="file" size={14} />
              Ekspor
            </Button>
          </div>
        </header>
        <div className="contractor-table">
          <table>
            <thead>
              <tr>
                <th>Nama Perusahaan</th>
                <th>Hubungan</th>
                <th>Jenis Usaha</th>
                <th>Kegiatan di Site</th>
                <th>PIC & Kontak</th>
                <th>Izin Usaha</th>
                <th>Kontrak</th>
                <th>Status CSMS</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {contractors.map(
                ([
                  name,
                  relation,
                  business,
                  activity,
                  pic,
                  permit,
                  contract,
                  csms,
                  status,
                ]) => (
                  <tr
                    key={name}
                    className={
                      name === "PT Sinar Teknik Mandiri" ? "is-clickable" : ""
                    }
                    onClick={() =>
                      name === "PT Sinar Teknik Mandiri" &&
                      onNavigate("PT Sinar Teknik Mandiri")
                    }
                  >
                    <td>
                      <div className="company-cell">
                        <span>
                          <Icon name="building" size={17} />
                        </span>
                        <strong>{name}</strong>
                      </div>
                    </td>
                    <td>{relation}</td>
                    <td>{business}</td>
                    <td>{activity}</td>
                    <td>{pic}</td>
                    <td>
                      <ExpiryChip days={Number(permit)} />
                    </td>
                    <td>
                      <ExpiryChip days={Number(contract)} />
                    </td>
                    <td>
                      {csms === "Menunggu definisi proses" ? (
                        <StatusBadge icon="help">{csms}</StatusBadge>
                      ) : (
                        <StatusBadge
                          tone={
                            csms === "Terverifikasi"
                              ? "success"
                              : csms === "Terdaftar"
                                ? "info"
                                : "neutral"
                          }
                        >
                          {csms}
                        </StatusBadge>
                      )}
                    </td>
                    <td>
                      <StatusBadge
                        tone={status === "Aktif" ? "success" : "neutral"}
                      >
                        {status}
                      </StatusBadge>
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
          <span>1–8 dari 8 perusahaan</span>
        </footer>
      </div>
    </section>
  )
}

const permits = [
  [
    "Nomor Induk Berusaha (NIB)",
    "NIB-1210000456721",
    "Jasa reparasi mesin dan peralatan",
    "12 Jan 2023",
    "12 Jan 2028",
    438,
  ],
  [
    "Izin Usaha Jasa Pertambangan",
    "IUJP-545/12/DPMPTSP/2024",
    "Jasa pertambangan bidang mekanikal",
    "08 Mar 2024",
    "12 Des 2026",
    42,
  ],
  [
    "Sertifikat Badan Usaha",
    "SBU-ME-2024-0198",
    "Instalasi mekanikal dan tata udara",
    "20 Feb 2024",
    "20 Feb 2027",
    112,
  ],
  [
    "Izin Operasional Site MIFA",
    "MIFA-OPS-STM-2026-011",
    "Maintenance AC alat berat",
    "03 Jan 2026",
    "03 Jan 2027",
    64,
  ],
] as const

function ProfileSection({
  title,
  children,
  action,
}: {
  title: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <section className="contractor-profile-section">
      <header>
        <h2>{title}</h2>
        {action}
      </header>
      <div>{children}</div>
    </section>
  )
}

function ContractorProfile({ role, onNavigate }: Omit<Props, "page">) {
  const [tab, setTab] = useState("Profil")
  const commercial = [
    "Manajemen",
    "PJO",
    "SCM/Gudang",
    "Administrator",
  ].includes(role)
  const tabs = [
    "Profil",
    "Legalitas & Izin",
    "Kontrak",
    "Personel",
    "PJO/PJA",
    "CSMS",
    "Dokumen",
    "Riwayat",
  ]
  return (
    <section className="page contractor-profile-page">
      <button
        className="record-back"
        onClick={() => onNavigate("Kontraktor & Legalitas")}
      >
        <Icon name="arrow-right" size={15} />
        Kembali ke daftar kontraktor
      </button>
      <header className="contractor-profile-header">
        <span>
          <Icon name="building" size={30} />
        </span>
        <div>
          <p className="overline">SUBKONTRAKTOR · STM-2026-006</p>
          <h1>PT Sinar Teknik Mandiri</h1>
          <p>Jasa Teknik Mekanikal · Maintenance AC alat berat</p>
          <div>
            <StatusBadge tone="success">Aktif</StatusBadge>
            <ExpiryChip days={42} />
            <StatusBadge icon="help">
              CSMS · Menunggu definisi proses
            </StatusBadge>
          </div>
        </div>
        <Button className="export-button">Ubah Profil</Button>
      </header>
      <nav className="record-tabs contractor-tabs">
        {tabs.map((item) => (
          <button
            key={item}
            className={tab === item ? "is-active" : ""}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </nav>
      <main className="contractor-profile-content">
        {tab === "Profil" && <ProfileOverview />}
        {tab === "Legalitas & Izin" && <PermitCards />}
        {tab === "Kontrak" && <ContractTab commercial={commercial} />}
        {tab === "Personel" && <PersonnelTab />}
        {tab === "PJO/PJA" && <CompanyPjo />}
        {tab === "CSMS" && <CsmsTab />}
        {tab === "Dokumen" && <DocumentChecklist />}
        {tab === "Riwayat" && <ContractorHistory />}
      </main>
    </section>
  )
}

function ProfileOverview() {
  return (
    <>
      <div className="contractor-overview-grid">
        <ProfileSection title="Informasi Perusahaan">
          <dl className="company-details">
            <div>
              <dt>Nama legal</dt>
              <dd>PT Sinar Teknik Mandiri</dd>
            </div>
            <div>
              <dt>Hubungan</dt>
              <dd>Subkontraktor GMI</dd>
            </div>
            <div>
              <dt>Jenis usaha</dt>
              <dd>Jasa Teknik Mekanikal</dd>
            </div>
            <div>
              <dt>NPWP</dt>
              <dd>82.135.771.2-101.000</dd>
            </div>
            <div>
              <dt>Alamat</dt>
              <dd>Jl. Nasional Meulaboh–Tapaktuan KM 8, Aceh Barat</dd>
            </div>
            <div>
              <dt>PIC</dt>
              <dd>Arif Rahman · 0812 4455 9081</dd>
            </div>
          </dl>
        </ProfileSection>
        <ProfileSection title="Status Kepatuhan">
          <div className="company-compliance">
            <div>
              <span>Legalitas & Izin</span>
              <StatusBadge tone="warning">1 akan berakhir</StatusBadge>
            </div>
            <div>
              <span>Kontrak</span>
              <ExpiryChip days={54} />
            </div>
            <div>
              <span>Personel aktif</span>
              <StatusBadge tone="success">8 orang</StatusBadge>
            </div>
            <div>
              <span>Dokumen wajib</span>
              <StatusBadge tone="warning">8/10 lengkap</StatusBadge>
            </div>
          </div>
        </ProfileSection>
      </div>
      <DocumentChecklist />
    </>
  )
}

function PermitCards() {
  return (
    <ProfileSection
      title="Legalitas & Izin"
      action={
        <Button className="create-button">
          <Icon name="plus" size={14} />
          Tambah Izin
        </Button>
      }
    >
      <div className="permit-grid">
        {permits.map(([name, number, field, issued, expiry, days]) => (
          <article key={name}>
            <header>
              <span>
                <Icon name="file" size={20} />
              </span>
              <div>
                <strong>{name}</strong>
                <small>{number}</small>
              </div>
              <ExpiryChip days={Number(days)} />
            </header>
            <dl>
              <div>
                <dt>Bidang usaha</dt>
                <dd>{field}</dd>
              </div>
              <div>
                <dt>Tanggal terbit</dt>
                <dd>{issued}</dd>
              </div>
              <div>
                <dt>Berlaku s.d.</dt>
                <dd>{expiry}</dd>
              </div>
            </dl>
            <button>
              <Icon name="file" size={14} />
              Lihat file PDF
            </button>
          </article>
        ))}
      </div>
    </ProfileSection>
  )
}

function ContractTab({ commercial }: { commercial: boolean }) {
  return (
    <ProfileSection title="Kontrak Aktif">
      <div className="contract-detail">
        <div>
          <span>Nomor kontrak</span>
          <strong>GMI-STM/CTR/2026/014</strong>
        </div>
        <div className="wide">
          <span>Ruang lingkup</span>
          <strong>
            Penyediaan tenaga teknis untuk pekerjaan perawatan, perbaikan, dan
            instalasi sistem AC alat berat Site MIFA.
          </strong>
        </div>
        <div>
          <span>Tanggal mulai</span>
          <strong>01 Jan 2026</strong>
        </div>
        <div>
          <span>Berakhir</span>
          <strong>24 Des 2026</strong>
          <ExpiryChip days={54} />
        </div>
        <div>
          <span>Status</span>
          <StatusBadge tone="success">Berlaku</StatusBadge>
        </div>
      </div>
      {commercial ? (
        <div className="contract-value">
          <span>Nilai kontrak</span>
          <strong>Rp1.850.000.000</strong>
          <small>Belum termasuk PPN · akses komersial</small>
        </div>
      ) : (
        <RestrictedData />
      )}
    </ProfileSection>
  )
}

const personnel = [
  ["STM-001", "Arif Rahman", "Site Coordinator", "6/6 terpenuhi", 184],
  ["STM-004", "Dani Firmansyah", "Teknisi AC Senior", "5/5 terpenuhi", 38],
  ["STM-006", "Reza Fahlevi", "Teknisi AC", "4/5 terpenuhi", 22],
  ["STM-007", "Muhammad Rizal", "Teknisi AC", "3/5 terpenuhi", 107],
  ["STM-009", "Ilham Akbar", "Helper", "2/3 terpenuhi", 61],
] as const

function PersonnelTab() {
  return (
    <ProfileSection
      title="Personel Terdaftar"
      action={
        <Button className="export-button">
          <Icon name="plus" size={14} />
          Tambah Personel
        </Button>
      }
    >
      <div className="company-personnel">
        <table>
          <thead>
            <tr>
              <th>NIK</th>
              <th>Nama</th>
              <th>Jabatan</th>
              <th>Kompetensi</th>
              <th>Permit Site</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {personnel.map(([nik, name, position, competence, permit]) => (
              <tr key={nik}>
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
                <td>
                  <StatusBadge
                    tone={
                      String(competence).startsWith("6/6") ||
                      String(competence).startsWith("5/5")
                        ? "success"
                        : "warning"
                    }
                  >
                    {competence}
                  </StatusBadge>
                </td>
                <td>
                  <ExpiryChip days={Number(permit)} />
                </td>
                <td>
                  <StatusBadge tone="success">Aktif</StatusBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ProfileSection>
  )
}

function CompanyPjo() {
  return (
    <ProfileSection title="PJO/PJA Perusahaan">
      <div className="company-pjo-card">
        <span className="profile-photo small">AR</span>
        <div>
          <p className="overline">PJA</p>
          <strong>Arif Rahman</strong>
          <small>Site Coordinator · SK PJA/STM/2026/004</small>
        </div>
        <div>
          <span>Berlaku s.d.</span>
          <strong>31 Des 2026</strong>
        </div>
        <StatusBadge tone="success">Berlaku</StatusBadge>
      </div>
    </ProfileSection>
  )
}

function CsmsTab() {
  return (
    <ProfileSection title="Contractor Safety Management System">
      <div className="csms-placeholder">
        <span>
          <Icon name="shield" size={27} />
        </span>
        <StatusBadge icon="help">Menunggu definisi proses</StatusBadge>
        <h3>Alur CSMS belum disahkan</h3>
        <p>
          Tahapan pra-kualifikasi, penilaian risiko, dan evaluasi kinerja
          kontraktor akan ditampilkan setelah proses disepakati oleh GMI dan
          Site MIFA.
        </p>
      </div>
    </ProfileSection>
  )
}

const requiredDocs = [
  ["Akta Pendirian & Perubahan", true],
  ["Nomor Induk Berusaha", true],
  ["IUJP", true],
  ["Sertifikat Badan Usaha", true],
  ["NPWP Perusahaan", true],
  ["Struktur Organisasi Site", true],
  ["Daftar Personel & Kompetensi", true],
  ["Program K3 Kontraktor", true],
  ["Laporan Kinerja K3 12 Bulan", false],
  ["Surat Pernyataan Kepatuhan CSMS", false],
] as const

function DocumentChecklist() {
  return (
    <ProfileSection title="Kelengkapan Dokumen">
      <div className="document-completeness">
        <header>
          <div>
            <span>Dokumen wajib</span>
            <strong>8/10 lengkap</strong>
          </div>
          <i>
            <b style={{ width: "80%" }} />
          </i>
          <StatusBadge tone="warning">2 dokumen belum ada</StatusBadge>
        </header>
        <div>
          {requiredDocs.map(([doc, complete]) => (
            <article
              className={complete ? "is-complete" : "is-missing"}
              key={doc}
            >
              <span>
                {complete ? (
                  <Icon name="check" size={14} />
                ) : (
                  <Icon name="x" size={14} />
                )}
              </span>
              <strong>{doc}</strong>
              {complete ? (
                <button>
                  <Icon name="file" size={14} />
                  Lihat file
                </button>
              ) : (
                <StatusBadge dashed>Belum Ada</StatusBadge>
              )}
            </article>
          ))}
        </div>
      </div>
    </ProfileSection>
  )
}

function ContractorHistory() {
  return (
    <ProfileSection title="Riwayat">
      <div className="audit-timeline">
        {[
          [
            "28 Okt 2026",
            "Dewi Lestari memperbarui tanggal berlaku IUJP",
            "12 Sep 2026 → 12 Des 2026",
          ],
          [
            "15 Okt 2026",
            "Arif Rahman menambahkan personel",
            "Reza Fahlevi · Teknisi AC",
          ],
          [
            "03 Jan 2026",
            "Budi Santoso mengaktifkan kontraktor",
            "Draft → Aktif",
          ],
          [
            "20 Des 2025",
            "Sari Wulandari membuat profil perusahaan",
            "PT Sinar Teknik Mandiri",
          ],
        ].map(([date, action, change]) => (
          <div key={date + action}>
            <i />
            <span>{date}</span>
            <strong>{action}</strong>
            <p>{change}</p>
          </div>
        ))}
      </div>
    </ProfileSection>
  )
}

const pjoRows = [
  [
    "Budi Santoso",
    "PJO",
    "PT Garuda Mart Indonesia",
    "SK-MIFA/PJO/2026/014",
    "03 Jan 2026",
    "03 Jan 2027",
    "Seluruh kegiatan GMI Site MIFA · 32 pekerja",
    "POM",
    64,
    "Berlaku",
  ],
  [
    "Fajar Nugroho",
    "PJA",
    "PT Garuda Mart Indonesia",
    "SK-GMI/PJA/2026/008",
    "10 Jan 2026",
    "10 Jan 2027",
    "Service AC · 18 pekerja",
    "POP",
    71,
    "Berlaku",
  ],
  [
    "Arif Rahman",
    "PJA",
    "PT Sinar Teknik Mandiri",
    "SK-PJA/STM/2026/004",
    "05 Jan 2026",
    "31 Des 2026",
    "Personel STM · 8 pekerja",
    "POP",
    61,
    "Berlaku",
  ],
  [
    "Rizky Ananda",
    "PJA",
    "PT Bara Safety Indonesia",
    "SK-PJA/BSI/2026/002",
    "12 Feb 2026",
    "12 Feb 2027",
    "Tim inspeksi keselamatan · 4 pekerja",
    "POP",
    104,
    "Berlaku",
  ],
  [
    "Maya Sari",
    "PJA",
    "PT Cipta Lingkungan Aceh",
    "SK-PJA/CLA/2025/019",
    "20 Nov 2025",
    "20 Nov 2026",
    "Tim pengelola limbah B3 · 5 pekerja",
    "POP",
    20,
    "Berlaku",
  ],
] as const

function PjoRegister() {
  const [selected, setSelected] = useState<typeof pjoRows[number] | null>(null)
  return (
    <section className="page pjo-page">
      <div className="page-heading">
        <div>
          <p className="overline">PEOPLE & COMPLIANCE</p>
          <h1>Register PJO/PJA</h1>
          <p>Daftar penanggung jawab operasional dan pengawas area kerja.</p>
        </div>
        <Button className="create-button">
          <Icon name="plus" size={15} />
          Tambah PJO/PJA
        </Button>
      </div>
      <div className="pjo-summary">
        <div>
          <span>PJO aktif</span>
          <strong>1</strong>
        </div>
        <div>
          <span>PJA aktif</span>
          <strong>4</strong>
        </div>
        <div>
          <span>Akan kedaluwarsa ≤ 60 hari</span>
          <strong>2</strong>
        </div>
      </div>
      <div className="pjo-table-card">
        <header>
          <h2>Daftar PJO/PJA</h2>
          <Button className="export-button">
            <Icon name="file" size={14} />
            Ekspor
          </Button>
        </header>
        <div className="pjo-table">
          <table>
            <thead>
              <tr>
                <th>Nama</th>
                <th>Jabatan</th>
                <th>Perusahaan</th>
                <th>No. SK Pengesahan</th>
                <th>Tanggal SK</th>
                <th>Berlaku s.d.</th>
                <th>Area/Pekerja yang Diawasi</th>
                <th>Kompetensi</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pjoRows.map((row) => (
                <tr key={row[3]} onClick={() => setSelected(row)}>
                  <td>
                    <div className="employee-cell">
                      <span>
                        {row[0]
                          .split(" ")
                          .map((word) => word[0])
                          .slice(0, 2)
                          .join("")}
                      </span>
                      <strong>{row[0]}</strong>
                    </div>
                  </td>
                  <td>
                    <StatusBadge tone="info">{row[1]}</StatusBadge>
                  </td>
                  <td>{row[2]}</td>
                  <td>
                    <button>{row[3]}</button>
                  </td>
                  <td>{row[4]}</td>
                  <td>{row[5]}</td>
                  <td>{row[6]}</td>
                  <td>
                    <StatusBadge tone="success">{row[7]}</StatusBadge>
                  </td>
                  <td>
                    <ExpiryChip days={Number(row[8])} />
                  </td>
                  <td>
                    <Icon name="arrow-right" size={15} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {selected && (
        <PjoDrawer data={selected} onClose={() => setSelected(null)} />
      )}
    </section>
  )
}

function PjoDrawer({
  data,
  onClose,
}: {
  data: typeof pjoRows[number]
  onClose: () => void
}) {
  return (
    <>
      <button
        className="drawer-backdrop"
        onClick={onClose}
        aria-label="Tutup detail"
      />
      <aside className="pjo-drawer">
        <header>
          <div>
            <p className="overline">
              {data[1]} · {data[2]}
            </p>
            <h2>{data[0]}</h2>
          </div>
          <IconButton label="Tutup" onClick={onClose}>
            <Icon name="x" />
          </IconButton>
        </header>
        <div>
          <section className="sk-preview">
            <div>
              <span>PT MIFA BERSAUDARA</span>
              <h3>SURAT KEPUTUSAN PENGESAHAN</h3>
              <strong>{data[3]}</strong>
              <p>
                Penetapan {data[0]} sebagai {data[1]} untuk pengawasan kegiatan
                operasional di Site MIFA.
              </p>
              <i>Dokumen contoh · Halaman 1 dari 2</i>
            </div>
            <button>
              <Icon name="file" size={15} />
              Buka dokumen lengkap
            </button>
          </section>
          <dl className="pjo-detail-list">
            <div>
              <dt>Nomor SK</dt>
              <dd>{data[3]}</dd>
            </div>
            <div>
              <dt>Tanggal SK</dt>
              <dd>{data[4]}</dd>
            </div>
            <div>
              <dt>Berlaku s.d.</dt>
              <dd>{data[5]}</dd>
            </div>
            <div>
              <dt>Area/Pekerja</dt>
              <dd>{data[6]}</dd>
            </div>
            <div>
              <dt>Kompetensi</dt>
              <dd>{data[7]}</dd>
            </div>
          </dl>
          <section className="mini-audit">
            <h3>Riwayat</h3>
            <div>
              <i />
              <p>
                <strong>SK diverifikasi oleh Andi Pratama</strong>
                <span>05 Jan 2026, 10:20 WIB</span>
              </p>
            </div>
            <div>
              <i />
              <p>
                <strong>Data PJO/PJA ditambahkan</strong>
                <span>03 Jan 2026, 09:05 WIB</span>
              </p>
            </div>
          </section>
        </div>
      </aside>
    </>
  )
}

export default function ContractorManagement({
  page,
  role,
  onNavigate,
}: Props) {
  if (page === "PJO/PJA") return <PjoRegister />
  if (page === "PT Sinar Teknik Mandiri")
    return <ContractorProfile role={role} onNavigate={onNavigate} />
  return <ContractorList onNavigate={onNavigate} />
}
