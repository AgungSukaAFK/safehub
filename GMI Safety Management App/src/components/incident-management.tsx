import { useState, type ReactNode } from "react"
import {
  Button,
  Field,
  Icon,
  IconButton,
  RestrictedData,
  StatusBadge,
} from "./ui"

type Props = {
  role: string
  page: string
  onNavigate: (page: string) => void
}

const incidents = [
  [
    "KJD-2026-0013",
    "Kebocoran refrigerant saat pemeriksaan unit E51203",
    "Near Miss",
    "30 Okt 2026",
    "Pit Area",
    "E51203 · PC1250",
    "Rudi Hartono",
    "Open",
    "0/2",
    "1",
  ],
  [
    "KJD-2026-0012",
    "Jari terjepit saat pemasangan kompresor AC unit H57197",
    "Cedera · First Aid",
    "18 Okt 2026",
    "Workshop Service",
    "H57197 · HD785-7",
    "Rudi Hartono",
    "In Progress",
    "1/3",
    "13",
  ],
  [
    "KJD-2026-0011",
    "Selang manifold terlepas saat pengisian refrigerant",
    "Near Miss",
    "11 Okt 2026",
    "Workshop Service",
    "G5809 · GD825A",
    "Agus Setiawan",
    "Menunggu Verifikasi",
    "2/2",
    "20",
  ],
  [
    "KJD-2026-0010",
    "Kerusakan bracket kondensor setelah unit beroperasi",
    "Kerusakan Properti",
    "03 Okt 2026",
    "Pit Area",
    "E5126 · PC2000",
    "Dedi Irawan",
    "In Progress",
    "2/4",
    "28",
  ],
  [
    "KJD-2026-0009",
    "Tumpahan oli kompresor di area kerja",
    "Lingkungan",
    "28 Sep 2026",
    "Workshop Service",
    "DA54853 · Mercedes Arocs",
    "Ari Wibowo",
    "Closed",
    "3/3",
    "33",
  ],
  [
    "KJD-2026-0008",
    "Teknisi tersandung kabel ekstensi",
    "Cedera · First Aid",
    "17 Sep 2026",
    "Warehouse",
    "—",
    "Rian Saputra",
    "Closed",
    "2/2",
    "44",
  ],
  [
    "KJD-2026-0007",
    "Percikan api pada konektor blower kabin",
    "Kebakaran",
    "09 Sep 2026",
    "Pit Area",
    "H57197 · HD785-7",
    "Fajar Nugroho",
    "Closed",
    "4/4",
    "52",
  ],
  [
    "KJD-2026-0006",
    "Paparan debu saat pembersihan evaporator",
    "Penyakit Akibat Kerja",
    "25 Agu 2026",
    "Workshop Service",
    "E51203 · PC1250",
    "Rudi Hartono",
    "Menunggu Verifikasi",
    "3/3",
    "67",
  ],
  [
    "KJD-2026-0005",
    "Tangga kerja bergeser saat akses kabin",
    "Near Miss",
    "10 Agu 2026",
    "Hauling Road",
    "G5809 · GD825A",
    "Yusuf Maulana",
    "Closed",
    "2/2",
    "82",
  ],
  [
    "KJD-2026-0004",
    "Kaca unit retak akibat alat kerja terjatuh",
    "Kerusakan Properti",
    "22 Jul 2026",
    "Workshop Service",
    "E5126 · PC2000",
    "Agus Setiawan",
    "Closed",
    "3/3",
    "101",
  ],
] as const

const toneFor = (status: string) =>
  status === "Closed"
    ? "success"
    : status === "Menunggu Verifikasi"
      ? "verification"
      : status === "In Progress"
        ? "warning"
        : "info"

function IncidentList({ onNavigate }: Pick<Props, "onNavigate">) {
  const [view, setView] = useState("Semua")
  const [filtersOpen, setFiltersOpen] = useState(true)
  const views = [
    "Semua",
    "Perlu Klasifikasi",
    "Investigasi",
    "Menunggu Review",
    "Closed",
  ]
  return (
    <section className="page incident-list-page">
      <div className="page-heading incident-list-heading">
        <div>
          <p className="overline">K3LH</p>
          <h1>Kejadian & Investigasi</h1>
          <p>Kelola laporan kejadian dari klasifikasi hingga penutupan.</p>
        </div>
        <Button
          className="create-button"
          onClick={() => onNavigate("Lapor Kejadian")}
        >
          <Icon name="plus" size={17} />
          Lapor Kejadian
        </Button>
      </div>
      <div className="incident-table-card">
        <div className="saved-view-tabs">
          {views.map((item) => (
            <button
              key={item}
              className={view === item ? "is-active" : ""}
              onClick={() => setView(item)}
            >
              {item}
              {item === "Perlu Klasifikasi" && <i>2</i>}
              {item === "Investigasi" && <i>4</i>}
            </button>
          ))}
        </div>
        <div className="incident-filter-bar">
          <button
            className="filter-toggle"
            onClick={() => setFiltersOpen(!filtersOpen)}
          >
            <Icon name="settings" size={16} />
            Filter
          </button>
          {filtersOpen && (
            <div className="incident-filters">
              {["Periode", "Kategori", "Lokasi", "Status", "Pelapor"].map(
                (filter) => (
                  <label key={filter}>
                    <span>{filter}</span>
                    <select>
                      <option>
                        {filter === "Periode"
                          ? "Jan–Okt 2026"
                          : `Semua ${filter.toLowerCase()}`}
                      </option>
                    </select>
                  </label>
                ),
              )}
            </div>
          )}
          <Button className="export-button">
            <Icon name="file" size={15} />
            Ekspor
          </Button>
        </div>
        <div className="incident-data-table">
          <table>
            <thead>
              <tr>
                <th>
                  <input type="checkbox" aria-label="Pilih semua" />
                </th>
                <th>ID ↕</th>
                <th>Judul</th>
                <th>Kategori</th>
                <th>Tanggal Kejadian</th>
                <th>Lokasi</th>
                <th>Unit</th>
                <th>Pelapor</th>
                <th>Status</th>
                <th>Tindakan</th>
                <th>Umur</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {incidents.map(
                ([
                  id,
                  title,
                  category,
                  date,
                  location,
                  unit,
                  reporter,
                  status,
                  action,
                  age,
                ]) => (
                  <tr
                    key={id}
                    onClick={() =>
                      ["KJD-2026-0012", "KJD-2026-0013"].includes(id) &&
                      onNavigate(id)
                    }
                    className={
                      ["KJD-2026-0012", "KJD-2026-0013"].includes(id)
                        ? "is-clickable"
                        : ""
                    }
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
                    <td>{category}</td>
                    <td>{date}</td>
                    <td>{location}</td>
                    <td>{unit}</td>
                    <td>{reporter}</td>
                    <td>
                      <StatusBadge tone={toneFor(status)}>{status}</StatusBadge>
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
                    <td>{age} hari</td>
                    <td>
                      <Icon name="more" size={17} />
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
        <footer className="table-pagination">
          <span>Menampilkan 1–10 dari 24 kejadian</span>
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

const tabs = [
  "Ringkasan",
  "Klasifikasi & Dampak",
  "Investigasi",
  "Analisis Penyebab",
  "Tindakan (3)",
  "Review & Persetujuan",
  "Lampiran (6)",
  "Riwayat",
]
const photo1 =
  "https://images.unsplash.com/photo-1622645916455-aa13b87438ec?auto=format&fit=crop&w=1000&q=85"
const photo2 =
  "https://images.unsplash.com/photo-1653202293335-92f6ace9943f?auto=format&fit=crop&w=1000&q=85"

function Section({
  title,
  children,
  action,
}: {
  title: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <section className="record-section">
      <header>
        <h2>{title}</h2>
        {action}
      </header>
      <div className="record-section__body">{children}</div>
    </section>
  )
}

function SummaryTab() {
  return (
    <>
      <Section title="Laporan Awal">
        <div className="report-narrative">
          <p>
            Saat pemasangan kompresor AC pada unit H57197, tangan kanan teknisi
            menahan posisi kompresor sementara teknisi lain mengencangkan
            bracket. Kompresor bergeser dan jari telunjuk kanan terjepit di
            antara kompresor dan bracket.
          </p>
          <dl>
            <div>
              <dt>Tindakan awal</dt>
              <dd>
                Pekerjaan dihentikan, korban dibawa ke ruang P3K dan area
                diamankan.
              </dd>
            </div>
            <div>
              <dt>Kondisi terakhir</dt>
              <dd>Korban telah kembali bekerja dengan pembatasan sementara.</dd>
            </div>
          </dl>
        </div>
      </Section>
      <Section
        title="Dokumentasi Kejadian"
        action={<button className="text-link">Lihat semua foto</button>}
      >
        <div className="incident-gallery">
          <figure>
            <img src={photo1} alt="Teknisi di dekat unit alat berat" />
            <figcaption>
              Area pemasangan kompresor · 18 Okt 2026, 10:32 WIB
            </figcaption>
          </figure>
          <figure>
            <img src={photo2} alt="Deretan unit alat berat di area kerja" />
            <figcaption>Unit H57197 setelah area diamankan</figcaption>
          </figure>
          <button>
            <Icon name="plus" size={20} />
            <span>4 foto lainnya</span>
          </button>
        </div>
      </Section>
      <div className="record-two-col">
        <Section title="Pihak Terlibat">
          <div className="person-list">
            <div>
              <span className="avatar">RH</span>
              <p>
                <strong>Rudi Hartono</strong>
                <small>Teknisi AC · GMI</small>
              </p>
              <StatusBadge tone="warning">Terlibat</StatusBadge>
            </div>
            <div>
              <span className="avatar">AS</span>
              <p>
                <strong>Agus Setiawan</strong>
                <small>Teknisi AC · GMI</small>
              </p>
              <StatusBadge tone="neutral">Rekan kerja</StatusBadge>
            </div>
          </div>
        </Section>
        <Section title="Saksi">
          <div className="person-list">
            <div>
              <span className="avatar">DS</span>
              <p>
                <strong>Dedi Saputra</strong>
                <small>Leading Hand Service</small>
              </p>
              <StatusBadge tone="info">Saksi</StatusBadge>
            </div>
          </div>
        </Section>
      </div>
    </>
  )
}

function BodyDiagram() {
  return (
    <div className="body-diagram">
      <div className="body-view">
        <span>DEPAN</span>
        <svg viewBox="0 0 100 210">
          <circle cx="50" cy="20" r="13" />
          <path d="M40 38h20l8 58-12 35v58H44v-58L32 96zM35 50 16 108M65 50l19 58" />
          <circle className="affected" cx="84" cy="108" r="7" />
        </svg>
      </div>
      <div className="body-view">
        <span>BELAKANG</span>
        <svg viewBox="0 0 100 210">
          <circle cx="50" cy="20" r="13" />
          <path d="M40 38h20l8 58-12 35v58H44v-58L32 96zM35 50 16 108M65 50l19 58" />
        </svg>
      </div>
      <p>
        <i />
        Jari telunjuk kanan
      </p>
    </div>
  )
}

function ImpactTab({ role }: { role: string }) {
  const medicalAccess = role === "HSE" || role === "HR"
  const commercialAccess = [
    "Manajemen",
    "PJO",
    "SCM/Gudang",
    "Administrator",
  ].includes(role)
  return (
    <>
      <Section title="Klasifikasi Dampak">
        <div className="detail-grid">
          <div>
            <span>Jenis dampak</span>
            <strong>Cedera – First Aid</strong>
          </div>
          <div>
            <span>Tingkat keparahan</span>
            <StatusBadge tone="warning">Ringan</StatusBadge>
          </div>
          <div>
            <span>Potensi keparahan</span>
            <StatusBadge tone="danger">Tinggi</StatusBadge>
          </div>
          <div>
            <span>Klasifikasi</span>
            <strong>Recordable First Aid</strong>
          </div>
        </div>
      </Section>
      <Section title="Cedera & Perawatan">
        {medicalAccess ? (
          <div className="medical-layout">
            <BodyDiagram />
            <div className="detail-grid">
              <div>
                <span>Jenis cedera</span>
                <strong>Memar dan luka ringan</strong>
              </div>
              <div>
                <span>Bagian tubuh</span>
                <strong>Jari telunjuk kanan</strong>
              </div>
              <div>
                <span>Perawatan</span>
                <strong>P3K</strong>
              </div>
              <div>
                <span>Fasilitas</span>
                <strong>Ruang P3K Site MIFA</strong>
              </div>
              <div>
                <span>Hari kerja hilang</span>
                <strong>0 hari</strong>
              </div>
              <div>
                <span>Hari kerja terbatas</span>
                <strong>2 hari</strong>
              </div>
            </div>
          </div>
        ) : (
          <RestrictedData />
        )}
      </Section>
      <Section title="Kerusakan / Kerugian">
        {commercialAccess ? (
          <div className="detail-grid">
            <div className="wide">
              <span>Deskripsi</span>
              <strong>
                Tidak ada kerusakan unit. Pekerjaan tertunda 2,5 jam untuk
                penanganan dan pemeriksaan.
              </strong>
            </div>
            <div>
              <span>Estimasi biaya</span>
              <strong>Rp2.750.000</strong>
            </div>
          </div>
        ) : (
          <RestrictedData />
        )}
      </Section>
      <Section title="APD yang Dipakai">
        <div className="ppe-grid">
          {[
            ["hard-hat", "Helm", true],
            ["eye", "Kacamata", true],
            ["tools", "Sarung tangan", false],
            ["shield", "Sepatu safety", true],
            ["bell", "Ear plug", true],
          ].map(([icon, label, checked]) => (
            <div className={checked ? "is-used" : ""} key={String(label)}>
              <Icon name={icon as "shield"} size={22} />
              <span>{label}</span>
              <b>{checked ? "✓ Dipakai" : "✕ Tidak dipakai"}</b>
            </div>
          ))}
        </div>
      </Section>
    </>
  )
}

function InvestigationTab() {
  const [timeline, setTimeline] = useState([
    ["10:15", "Persiapan pemasangan kompresor dan pengecekan bracket."],
    [
      "10:28",
      "Kompresor diangkat manual oleh dua teknisi ke posisi pemasangan.",
    ],
    [
      "10:31",
      "Kompresor bergeser saat bracket dikencangkan; jari korban terjepit.",
    ],
    ["10:33", "Pekerjaan dihentikan dan korban dibawa ke ruang P3K."],
  ])
  return (
    <>
      <Section title="Tim Investigasi">
        <div className="investigation-team">
          <div>
            <span className="avatar">FN</span>
            <p>
              <strong>Fajar Nugroho</strong>
              <small>Pengawas Service</small>
            </p>
            <StatusBadge tone="info">Ketua</StatusBadge>
          </div>
          <div>
            <span className="avatar">AP</span>
            <p>
              <strong>Andi Pratama</strong>
              <small>HSE Officer</small>
            </p>
            <StatusBadge>Anggota</StatusBadge>
          </div>
          <div>
            <span className="avatar">BS</span>
            <p>
              <strong>Budi Santoso</strong>
              <small>PJO</small>
            </p>
            <StatusBadge>Anggota</StatusBadge>
          </div>
        </div>
      </Section>
      <Section
        title="Kronologi Kejadian"
        action={
          <button
            className="text-link"
            onClick={() => setTimeline((current) => [...current, ["", ""]])}
          >
            <Icon name="plus" size={14} />
            Tambah baris
          </button>
        }
      >
        <div className="editable-timeline">
          {timeline.map(([time, event], index) => (
            <div key={index}>
              <i />
              <input
                value={time}
                placeholder="Waktu"
                onChange={(e) =>
                  setTimeline((current) =>
                    current.map((item, i) =>
                      i === index ? [e.target.value, item[1]] : item,
                    ),
                  )
                }
              />
              <textarea
                value={event}
                placeholder="Jelaskan peristiwa"
                onChange={(e) =>
                  setTimeline((current) =>
                    current.map((item, i) =>
                      i === index ? [item[0], e.target.value] : item,
                    ),
                  )
                }
              />
            </div>
          ))}
        </div>
      </Section>
      <Section title="Rekonstruksi">
        <div className="reconstruction">
          <p>
            Rekonstruksi menunjukkan posisi tangan kanan korban berada pada
            celah antara kompresor dan bracket. Tidak tersedia alat bantu
            penahan kompresor, sehingga beban ditahan manual selama
            pengencangan.
          </p>
          <div>
            <img src={photo1} alt="Rekonstruksi posisi teknisi" />
            <img src={photo2} alt="Area unit alat berat" />
          </div>
        </div>
      </Section>
    </>
  )
}

const causeGroups = [
  [
    "Tindakan Tidak Aman",
    [
      "Menempatkan tangan pada titik jepit",
      "Pengangkatan kompresor tanpa alat bantu",
    ],
  ],
  [
    "Kondisi Tidak Aman",
    ["Ruang kerja sempit", "Bracket tidak memiliki penahan sementara"],
  ],
  [
    "Faktor Pekerjaan",
    [
      "JSA belum mencakup risiko titik jepit",
      "Alat bantu angkat tidak tersedia",
    ],
  ],
  ["Faktor Personal", ["Persepsi risiko titik jepit belum memadai"]],
]

function CauseTab({ onAction }: { onAction: () => void }) {
  return (
    <>
      <Section title="Penyebab Langsung">
        <CauseGroups groups={causeGroups.slice(0, 2)} />
      </Section>
      <Section title="Penyebab Dasar">
        <CauseGroups groups={causeGroups.slice(2)} />
      </Section>
      <Section title="Rekomendasi">
        <div className="recommendation-list">
          {[
            "Sediakan lifting aid portabel untuk pemasangan kompresor.",
            "Revisi JSA pekerjaan penggantian kompresor dengan kontrol titik jepit.",
            "Lakukan refresh training hand safety kepada seluruh teknisi Service AC.",
          ].map((item, index) => (
            <div key={item}>
              <span>{index + 1}</span>
              <p>{item}</p>
              <Button onClick={onAction}>Jadikan Tindakan</Button>
            </div>
          ))}
        </div>
      </Section>
    </>
  )
}

function CauseGroups({ groups }: { groups: typeof causeGroups }) {
  const [selected, setSelected] = useState<string[]>([
    "Menempatkan tangan pada titik jepit",
    "JSA belum mencakup risiko titik jepit",
  ])
  return (
    <div className="cause-groups">
      {groups.map(([group, items]) => (
        <fieldset key={group}>
          <legend>{group}</legend>
          {items.map((item) => (
            <div key={item}>
              <label>
                <input
                  type="checkbox"
                  checked={selected.includes(item)}
                  onChange={() =>
                    setSelected((current) =>
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
              {selected.includes(item) && (
                <input
                  placeholder="Jelaskan temuan atau bukti pendukung"
                  defaultValue={
                    item.includes("tangan")
                      ? "Tangan digunakan untuk menahan kompresor selama pengencangan bracket."
                      : ""
                  }
                />
              )}
            </div>
          ))}
        </fieldset>
      ))}
    </div>
  )
}

function ActionsTab({
  onDrawer,
  onReason,
}: {
  onDrawer: () => void
  onReason: () => void
}) {
  const actions = [
    [
      "TDK-2026-0143",
      "Sediakan lifting aid portabel untuk kompresor",
      "Korektif",
      "Hendra Wijaya",
      "22 Okt 2026",
      "In Progress",
      "1",
      "Andi Pratama",
    ],
    [
      "TDK-2026-0144",
      "Revisi JSA penggantian kompresor",
      "Preventif",
      "Fajar Nugroho",
      "20 Okt 2026",
      "Menunggu Verifikasi",
      "2",
      "Andi Pratama",
    ],
    [
      "TDK-2026-0145",
      "Refresh training hand safety",
      "Preventif",
      "Andi Pratama",
      "19 Okt 2026",
      "Closed",
      "3",
      "Budi Santoso",
    ],
  ] as const
  return (
    <Section
      title="Tindakan Perbaikan"
      action={
        <Button className="create-button" onClick={onDrawer}>
          <Icon name="plus" size={15} />
          Tambah Tindakan
        </Button>
      }
    >
      <div className="actions-table">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Deskripsi</th>
              <th>Jenis</th>
              <th>PIC</th>
              <th>Due Date</th>
              <th>Status</th>
              <th>Bukti</th>
              <th>Verifikator</th>
            </tr>
          </thead>
          <tbody>
            {actions.map(
              ([
                id,
                description,
                type,
                pic,
                due,
                status,
                evidence,
                verifier,
              ]) => (
                <tr key={id}>
                  <td>{id}</td>
                  <td>{description}</td>
                  <td>{type}</td>
                  <td>{pic}</td>
                  <td>
                    <button className="date-change" onClick={onReason}>
                      {due}
                    </button>
                  </td>
                  <td>
                    <button onClick={onReason}>
                      <StatusBadge tone={toneFor(status)}>{status}</StatusBadge>
                    </button>
                  </td>
                  <td>{evidence} file</td>
                  <td>{verifier}</td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </Section>
  )
}

function ReviewTab({ role, onReturn }: { role: string onReturn: () => void }) {
  const creator = role === "Karyawan"
  return (
    <Section title="Alur Persetujuan">
      <div className="approval-flow">
        <div className="is-done">
          <i>
            <Icon name="check" size={16} />
          </i>
          <div>
            <span>1 · Investigator</span>
            <strong>Fajar Nugroho</strong>
            <small>Disetujui · 20 Okt 2026, 14:30 WIB</small>
            <p>Investigasi dan analisis penyebab telah lengkap.</p>
          </div>
          <StatusBadge tone="success">Disetujui</StatusBadge>
        </div>
        <div className="is-current">
          <i>2</i>
          <div>
            <span>2 · Review EHS</span>
            <strong>Andi Pratama</strong>
            <small>Sedang menunggu keputusan</small>
            <div className="approval-actions">
              <Button
                className="approve-button"
                disabled={creator}
                title={
                  creator
                    ? "Pembuat laporan tidak dapat menyetujui laporannya sendiri."
                    : ""
                }
              >
                Setujui
              </Button>
              <Button className="return-button" onClick={onReturn}>
                Kembalikan dengan Catatan
              </Button>
            </div>
            {creator && (
              <p className="sod-note">
                <Icon name="help" size={14} />
                Pembuat laporan tidak dapat menyetujui laporannya sendiri.
              </p>
            )}
          </div>
          <StatusBadge tone="verification">Dalam Review</StatusBadge>
        </div>
        <div>
          <i>3</i>
          <div>
            <span>3 · Review Manajemen</span>
            <strong>Budi Santoso · PJO</strong>
            <small>Menunggu Review EHS selesai</small>
          </div>
          <StatusBadge>Pending</StatusBadge>
        </div>
      </div>
    </Section>
  )
}

function AttachmentsTab() {
  const files = [
    ["Foto_area_kejadian_01.jpg", "Rudi Hartono", "18 Okt 2026", "Terbatas"],
    ["Foto_unit_H57197.jpg", "Rudi Hartono", "18 Okt 2026", "Internal"],
    ["Hasil_P3K.pdf", "Andi Pratama", "18 Okt 2026", "Terbatas"],
    [
      "JSA_penggantian_kompresor.pdf",
      "Fajar Nugroho",
      "19 Okt 2026",
      "Internal",
    ],
    ["Rekonstruksi_01.jpg", "Andi Pratama", "19 Okt 2026", "Internal"],
    [
      "Berita_acara_investigasi.pdf",
      "Fajar Nugroho",
      "20 Okt 2026",
      "Internal",
    ],
  ]
  return (
    <Section
      title="Lampiran (6)"
      action={
        <Button className="export-button">
          <Icon name="plus" size={15} />
          Unggah File
        </Button>
      }
    >
      <div className="attachment-grid">
        {files.map(([name, uploader, date, access]) => (
          <article key={name}>
            <span>
              <Icon
                name={name.endsWith(".pdf") ? "file" : "camera"}
                size={25}
              />
            </span>
            <strong>{name}</strong>
            <small>
              {uploader} · {date}
            </small>
            <StatusBadge
              tone={access === "Terbatas" ? "warning" : "neutral"}
              icon={access === "Terbatas" ? "lock" : undefined}
            >
              {access}
            </StatusBadge>
          </article>
        ))}
      </div>
    </Section>
  )
}

function HistoryTab() {
  const events = [
    [
      "22 Okt 2026 · 09:14 WIB",
      "Andi Pratama mengubah Due Date TDK-2026-0143",
      "15 Okt 2026 → 22 Okt 2026",
      "Alasan: menunggu part kompresor",
    ],
    [
      "20 Okt 2026 · 14:30 WIB",
      "Fajar Nugroho menyelesaikan tahap Investigasi",
      "Investigasi → Review EHS",
      "Catatan: analisis penyebab dan rekomendasi telah dilengkapi",
    ],
    [
      "19 Okt 2026 · 11:05 WIB",
      "Andi Pratama menambahkan anggota tim investigasi",
      "— → Budi Santoso",
      "Peran: Anggota",
    ],
    [
      "18 Okt 2026 · 10:48 WIB",
      "Andi Pratama mengklasifikasikan kejadian",
      "Open → In Progress",
      "Kategori: Cedera · First Aid",
    ],
    [
      "18 Okt 2026 · 10:36 WIB",
      "Rudi Hartono membuat laporan kejadian",
      "— → KJD-2026-0012",
      "Sumber: Aplikasi mobile",
    ],
  ]
  return (
    <Section title="Riwayat Aktivitas">
      <div className="audit-timeline">
        {events.map(([time, action, change, reason]) => (
          <div key={time}>
            <i />
            <span>{time}</span>
            <strong>{action}</strong>
            <p>{change}</p>
            <small>{reason}</small>
          </div>
        ))}
      </div>
    </Section>
  )
}

function SummaryAside() {
  return (
    <aside className="record-aside">
      <h2>Ringkasan</h2>
      <dl>
        <div>
          <dt>Lokasi</dt>
          <dd>Workshop Service</dd>
        </div>
        <div>
          <dt>Unit</dt>
          <dd>
            <button>H57197 · HD785-7</button>
          </dd>
        </div>
        <div>
          <dt>Pelapor</dt>
          <dd>Rudi Hartono</dd>
        </div>
        <div>
          <dt>Tanggal kejadian</dt>
          <dd>18 Okt 2026, 10:31 WIB</dd>
        </div>
        <div>
          <dt>Tanggal dilaporkan</dt>
          <dd>18 Okt 2026, 10:36 WIB</dd>
        </div>
        <div>
          <dt>Klasifikasi</dt>
          <dd>Cedera · First Aid</dd>
        </div>
        <div>
          <dt>Ketua investigasi</dt>
          <dd>Fajar Nugroho</dd>
        </div>
      </dl>
      <section>
        <h3>Terkait</h3>
        <button className="related-record">
          <Icon name="clipboard" size={17} />
          <span>
            <strong>TMN-2026-0091</strong>
            <small>Pengadaan lifting aid kompresor</small>
          </span>
        </button>
      </section>
      <section>
        <h3>Pengikut · 4</h3>
        <div className="followers">
          <span>AP</span>
          <span>FN</span>
          <span>BS</span>
          <span>+1</span>
        </div>
      </section>
    </aside>
  )
}

function ActionDrawer({ onClose }: { onClose: () => void }) {
  return (
    <>
      <button
        className="drawer-backdrop"
        onClick={onClose}
        aria-label="Tutup drawer"
      />
      <aside className="action-drawer">
        <header>
          <div>
            <span>TINDAKAN PICA</span>
            <h2>Tambah Tindakan</h2>
          </div>
          <IconButton label="Tutup" onClick={onClose}>
            <Icon name="x" />
          </IconButton>
        </header>
        <div className="drawer-form">
          <label className="textarea-field">
            <span>Deskripsi *</span>
            <textarea placeholder="Jelaskan tindakan yang harus dilakukan" />
          </label>
          <label className="select-field">
            <span>Jenis *</span>
            <select>
              <option>Korektif</option>
              <option>Preventif</option>
            </select>
          </label>
          <label className="select-field">
            <span>PIC *</span>
            <select>
              <option>Pilih penanggung jawab</option>
              <option>Hendra Wijaya</option>
              <option>Fajar Nugroho</option>
            </select>
          </label>
          <label className="native-field">
            <span>Due Date *</span>
            <input type="date" />
          </label>
          <Field
            label="Bukti yang diwajibkan"
            placeholder="Contoh: foto lifting aid dan BA penerimaan"
          />
          <label className="select-field">
            <span>Verifikator *</span>
            <select>
              <option>Andi Pratama · HSE</option>
              <option>Budi Santoso · PJO</option>
            </select>
          </label>
        </div>
        <footer>
          <Button className="back-button" onClick={onClose}>
            Batal
          </Button>
          <Button className="primary-button" onClick={onClose}>
            Simpan Tindakan
          </Button>
        </footer>
      </aside>
    </>
  )
}

function ReasonModal({
  title,
  returnMode,
  onClose,
}: {
  title: string
  returnMode?: boolean
  onClose: () => void
}) {
  const [reason, setReason] = useState("")
  return (
    <div className="modal-layer">
      <button
        className="modal-backdrop"
        onClick={onClose}
        aria-label="Tutup modal"
      />
      <section className="reason-modal">
        <header>
          <span>
            <Icon name={returnMode ? "arrow-right" : "clipboard"} size={20} />
          </span>
          <div>
            <h2>{title}</h2>
            <p>
              {returnMode
                ? "Catatan wajib diisi agar investigator memahami perbaikan yang diperlukan."
                : "Perubahan ini akan dicatat pada Riwayat dan audit trail."}
            </p>
          </div>
        </header>
        <label className="textarea-field">
          <span>Alasan *</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Tuliskan alasan secara jelas dan spesifik"
          />
        </label>
        <footer>
          <Button className="back-button" onClick={onClose}>
            Batal
          </Button>
          <Button
            className="primary-button"
            disabled={!reason.trim()}
            onClick={onClose}
          >
            {returnMode ? "Kembalikan" : "Konfirmasi Perubahan"}
          </Button>
        </footer>
      </section>
    </div>
  )
}

function IncidentDetail({
  role,
  onNavigate,
  recordId = "KJD-2026-0012",
}: Omit<Props, "page"> & { recordId?: string }) {
  const isDemoIncident = recordId === "KJD-2026-0013"
  const [tab, setTab] = useState("Ringkasan")
  const [closeOpen, setCloseOpen] = useState(false)
  const [overflow, setOverflow] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const [modal, setModal] = useState<"" | "reason" | "exception" | "return">("")
  const workflow = [
    ["Dilaporkan", "18 Okt · Rudi"],
    ["Klasifikasi HSE", "18 Okt · Andi"],
    ["Investigasi", ""],
    ["Review EHS", ""],
    ["Review Manajemen", ""],
    ["Tindakan & Verifikasi", ""],
    ["Closed", ""],
  ]
  return (
    <section className="page record-page">
      <button
        className="record-back"
        onClick={() => onNavigate("Kejadian & Investigasi")}
      >
        <Icon name="arrow-right" size={15} />
        Kembali ke daftar kejadian
      </button>
      <header className="record-header">
        <div>
          <div className="record-id">
            <strong>{recordId}</strong>
            <StatusBadge tone={isDemoIncident ? "info" : "warning"}>
              {isDemoIncident ? "Near Miss" : "Cedera · First Aid"}
            </StatusBadge>
            <StatusBadge tone="warning">In Progress</StatusBadge>
          </div>
          <h1>
            {isDemoIncident
              ? "Kebocoran refrigerant saat pemeriksaan unit E51203"
              : "Jari terjepit saat pemasangan kompresor AC unit H57197"}
          </h1>
          <p>
            {isDemoIncident
              ? "Pit Area · Kejadian 30 Okt 2026, 08:31 WIB"
              : "Workshop Service · Kejadian 18 Okt 2026, 10:31 WIB"}
          </p>
        </div>
        <div className="record-actions">
          <Button className="export-button">Ubah</Button>
          <Button className="export-button" onClick={() => setDrawer(true)}>
            <Icon name="plus" size={15} />
            Tambah Tindakan
          </Button>
          <div className="close-wrap">
            <Button
              className="disabled-close"
              onClick={() => setCloseOpen(!closeOpen)}
            >
              Tutup Kejadian
            </Button>
            {closeOpen && (
              <div className="closure-popover">
                <strong>Syarat penutupan</strong>
                <p className="is-done">✓ Investigasi lengkap</p>
                <p>✕ Review manajemen belum selesai</p>
                <p>✕ 2 dari 3 tindakan belum terverifikasi</p>
                {role === "PJO" && (
                  <button
                    onClick={() => {
                      setCloseOpen(false)
                      setModal("exception")
                    }}
                  >
                    Tutup dengan pengecualian →
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="more-wrap">
            <IconButton
              label="Tindakan lainnya"
              className="more-button"
              onClick={() => setOverflow(!overflow)}
            >
              <Icon name="more" />
            </IconButton>
            {overflow && (
              <div className="record-menu">
                <button>Cetak</button>
                <button>Ekspor PDF</button>
              </div>
            )}
          </div>
        </div>
      </header>
      <ol className="workflow-stepper">
        {workflow.map(([label, meta], index) => (
          <li
            key={label}
            className={
              index < 2 ? "is-complete" : index === 2 ? "is-current" : ""
            }
            title={meta || undefined}
          >
            <span>
              {index < 2 ? <Icon name="check" size={13} /> : index + 1}
            </span>
            <strong>{label}</strong>
            {meta && <small>{meta}</small>}
          </li>
        ))}
      </ol>
      <div className="record-tabs">
        {tabs.map((item) => (
          <button
            key={item}
            className={tab === item ? "is-active" : ""}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="record-layout">
        <main className="record-main">
          {tab === "Ringkasan" && <SummaryTab />}
          {tab === "Klasifikasi & Dampak" && <ImpactTab role={role} />}
          {tab === "Investigasi" && <InvestigationTab />}
          {tab === "Analisis Penyebab" && (
            <CauseTab onAction={() => setDrawer(true)} />
          )}
          {tab === "Tindakan (3)" && (
            <ActionsTab
              onDrawer={() => setDrawer(true)}
              onReason={() => setModal("reason")}
            />
          )}
          {tab === "Review & Persetujuan" && (
            <ReviewTab role={role} onReturn={() => setModal("return")} />
          )}
          {tab === "Lampiran (6)" && <AttachmentsTab />}
          {tab === "Riwayat" && <HistoryTab />}
        </main>
        <SummaryAside />
      </div>
      {drawer && <ActionDrawer onClose={() => setDrawer(false)} />}
      {modal && (
        <ReasonModal
          title={
            modal === "exception"
              ? "Tutup dengan pengecualian"
              : modal === "return"
                ? "Kembalikan dengan Catatan"
                : "Konfirmasi Perubahan"
          }
          returnMode={modal === "return"}
          onClose={() => setModal("")}
        />
      )}
    </section>
  )
}

export default function IncidentManagement({ role, page, onNavigate }: Props) {
  return page === "KJD-2026-0012" || page === "KJD-2026-0013" ? (
    <IncidentDetail role={role} recordId={page} onNavigate={onNavigate} />
  ) : (
    <IncidentList onNavigate={onNavigate} />
  )
}
