import { useState } from "react"
import { Button, ExpiryChip, Icon, IconButton, StatusBadge } from "./ui"

type Props = { page: string onNavigate: (page: string) => void }

const documents = [
  [
    "GMI-SOP-HSE-014",
    "Pelaporan dan Investigasi Kejadian",
    "SOP",
    "HSE",
    "Rev 3",
    "Berlaku",
    "01 Okt 2026",
    335,
    "Seluruh Karyawan",
  ],
  [
    "GMI-IK-SVC-021",
    "Penggantian Kompresor AC Alat Berat",
    "IK",
    "Service AC",
    "Rev 2",
    "Dalam Review",
    "—",
    0,
    "Teknisi AC",
  ],
  [
    "GMI-JSA-SVC-008",
    "JSA Perawatan Sistem AC Unit HD785-7",
    "JSA",
    "Service AC",
    "Rev 4",
    "Berlaku",
    "15 Sep 2026",
    289,
    "Service AC · HSE",
  ],
  [
    "GMI-FRM-HSE-006",
    "Formulir Inspeksi Kotak P3K dan APAR",
    "Formulir",
    "HSE",
    "Rev 1",
    "Berlaku",
    "03 Jan 2026",
    64,
    "HSE · Pengawas",
  ],
  [
    "GMI-POL-HSE-001",
    "Kebijakan Keselamatan Pertambangan",
    "Kebijakan",
    "PJO",
    "Rev 2",
    "Berlaku",
    "02 Jan 2026",
    63,
    "Seluruh Karyawan",
  ],
  [
    "GMI-SOP-OPS-011",
    "Pengendalian Energi Berbahaya LOTO",
    "SOP",
    "HSE",
    "Rev 2",
    "Berlaku",
    "18 Feb 2026",
    110,
    "Service · Maintenance",
  ],
  [
    "GMI-IK-OPS-009",
    "Pemasangan Padlock LOTO Versi Lama",
    "IK",
    "Service AC",
    "Rev 3",
    "Obsolete",
    "12 Mei 2024",
    -175,
    "Ditarik",
  ],
  [
    "GMI-SOP-HR-004",
    "Pengelolaan Kompetensi dan Pelatihan",
    "SOP",
    "Admin & HR",
    "Rev 1",
    "Draft",
    "—",
    0,
    "HR · HSE",
  ],
  [
    "GMI-JSA-WHS-003",
    "JSA Penanganan Refrigerant di Warehouse",
    "JSA",
    "Warehouse/SCM",
    "Rev 2",
    "Berlaku",
    "10 Mar 2026",
    130,
    "Warehouse · Service",
  ],
  [
    "GMI-FRM-OPS-017",
    "Checklist Harian Peralatan Kerja",
    "Formulir",
    "Pengawas Service",
    "Rev 5",
    "Berlaku",
    "02 Agu 2026",
    244,
    "Service AC",
  ],
] as const

const docTone = (status: string) =>
  status === "Berlaku"
    ? "success"
    : status === "Dalam Review"
      ? "verification"
      : status === "Draft"
        ? "neutral"
        : "danger"

function DocumentRegister({ onNavigate }: Pick<Props, "onNavigate">) {
  return (
    <section className="page documents-page">
      <div className="page-heading">
        <div>
          <p className="overline">DOKUMEN</p>
          <h1>Prosedur & Dokumen</h1>
          <p>Register dokumen terkendali, revisi, dan distribusi Site MIFA.</p>
        </div>
        <Button className="create-button">
          <Icon name="plus" size={15} />
          Dokumen Baru
        </Button>
      </div>
      <div className="document-kpis">
        <div>
          <span>Dokumen berlaku</span>
          <strong>42</strong>
        </div>
        <div>
          <span>Dalam review</span>
          <strong>5</strong>
        </div>
        <div>
          <span>Review ≤ 30 hari</span>
          <strong>3</strong>
        </div>
        <div className="is-danger">
          <span>Review terlewat</span>
          <strong>2</strong>
        </div>
      </div>
      <div className="document-register-card">
        <header>
          <div className="document-filters">
            {["Jenis", "Pemilik", "Status"].map((filter) => (
              <label key={filter}>
                <span>{filter}</span>
                <select>
                  <option>Semua {filter.toLowerCase()}</option>
                  {filter === "Jenis" && (
                    <>
                      <option>Kebijakan</option>
                      <option>SOP</option>
                      <option>IK</option>
                      <option>JSA</option>
                      <option>Formulir</option>
                    </>
                  )}
                </select>
              </label>
            ))}
          </div>
          <Button className="export-button">
            <Icon name="file" size={14} />
            Ekspor
          </Button>
        </header>
        <div className="document-table">
          <table>
            <thead>
              <tr>
                <th>Nomor</th>
                <th>Judul</th>
                <th>Jenis</th>
                <th>Pemilik</th>
                <th>Revisi</th>
                <th>Status</th>
                <th>Tanggal Efektif</th>
                <th>Review Berikutnya</th>
                <th>Distribusi</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {documents.map(
                ([
                  number,
                  title,
                  type,
                  owner,
                  revision,
                  status,
                  effective,
                  review,
                  distribution,
                ]) => (
                  <tr
                    key={number}
                    className={
                      number === "GMI-SOP-HSE-014" ||
                      number === "GMI-IK-OPS-009"
                        ? "is-clickable"
                        : ""
                    }
                    onClick={() =>
                      (number === "GMI-SOP-HSE-014" ||
                        number === "GMI-IK-OPS-009") &&
                      onNavigate(number)
                    }
                  >
                    <td>
                      <button>{number}</button>
                    </td>
                    <td>
                      <strong>{title}</strong>
                    </td>
                    <td>
                      <StatusBadge>{type}</StatusBadge>
                    </td>
                    <td>{owner}</td>
                    <td>{revision}</td>
                    <td>
                      <StatusBadge
                        tone={docTone(status)}
                        outlined={status === "Obsolete"}
                      >
                        {status}
                      </StatusBadge>
                    </td>
                    <td>{effective}</td>
                    <td>
                      {status === "Obsolete" ? (
                        <StatusBadge tone="danger">Kedaluwarsa</StatusBadge>
                      ) : status === "Draft" || status === "Dalam Review" ? (
                        "—"
                      ) : (
                        <ExpiryChip days={Number(review)} />
                      )}
                    </td>
                    <td>{distribution}</td>
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
          <span>1–10 dari 52 dokumen</span>
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

function PdfPreview({ obsolete }: { obsolete: boolean }) {
  return (
    <div className="pdf-preview-pane">
      <header>
        <div>
          <Icon name="file" size={17} />
          <span>
            {obsolete ? "GMI-IK-OPS-009_Rev3.pdf" : "GMI-SOP-HSE-014_Rev3.pdf"}
          </span>
        </div>
        <div>
          <button>−</button>
          <span>85%</span>
          <button>+</button>
          <IconButton label="Unduh PDF">
            <Icon name="upload" size={16} />
          </IconButton>
        </div>
      </header>
      <main>
        <div className="pdf-page">
          <div className="pdf-brand">
            <span>GMI</span>
            <p>
              <strong>PT GARUDA MART INDONESIA</strong>
              <small>SITE MIFA</small>
            </p>
          </div>
          <div className="pdf-doc-head">
            <span>
              {obsolete ? "INSTRUKSI KERJA" : "STANDAR OPERASIONAL PROSEDUR"}
            </span>
            <h2>
              {obsolete
                ? "PEMASANGAN PADLOCK LOTO"
                : "PELAPORAN DAN INVESTIGASI KEJADIAN"}
            </h2>
            <dl>
              <div>
                <dt>Nomor</dt>
                <dd>{obsolete ? "GMI-IK-OPS-009" : "GMI-SOP-HSE-014"}</dd>
              </div>
              <div>
                <dt>Revisi</dt>
                <dd>{obsolete ? "03" : "03"}</dd>
              </div>
              <div>
                <dt>Tanggal</dt>
                <dd>{obsolete ? "12 Mei 2024" : "01 Okt 2026"}</dd>
              </div>
            </dl>
          </div>
          <section>
            <h3>1. TUJUAN</h3>
            <p>
              Menetapkan tata cara yang terstruktur dan terdokumentasi untuk
              memastikan seluruh proses dilaksanakan sesuai standar keselamatan
              dan ketentuan perusahaan.
            </p>
            <h3>2. RUANG LINGKUP</h3>
            <p>
              Prosedur ini berlaku bagi seluruh pekerja PT Garuda Mart Indonesia
              dan mitra kerja yang melakukan aktivitas di Site MIFA.
            </p>
            <h3>3. TANGGUNG JAWAB</h3>
            <p>
              PJO, HSE, pengawas, dan seluruh karyawan bertanggung jawab
              menjalankan ketentuan sesuai peran masing-masing.
            </p>
            <h3>4. PROSEDUR</h3>
            {[1, 2, 3, 4, 5].map((item) => (
              <p key={item}>
                {item}. Pekerja wajib memastikan seluruh persyaratan, bukti, dan
                persetujuan telah dilengkapi sebelum aktivitas dilanjutkan.
              </p>
            ))}
          </section>
          <footer>Dokumen terkendali · Halaman 1 dari 8</footer>
        </div>
      </main>
    </div>
  )
}

function DocumentDetail({ page, onNavigate }: Props) {
  const obsolete = page === "GMI-IK-OPS-009"
  return (
    <section className="page document-detail-page">
      <button
        className="record-back"
        onClick={() => onNavigate("Prosedur & Dokumen")}
      >
        <Icon name="arrow-right" size={15} />
        Kembali ke register dokumen
      </button>
      {obsolete && (
        <div className="obsolete-banner">
          <Icon name="help" size={18} />
          <p>
            <strong>Dokumen ini sudah tidak berlaku.</strong>
            <span>Gunakan Rev 4.</span>
          </p>
          <button>Buka Rev 4 →</button>
        </div>
      )}
      <header className="document-detail-header">
        <div>
          <p className="overline">
            {obsolete ? "GMI-IK-OPS-009" : "GMI-SOP-HSE-014"}
          </p>
          <h1>
            {obsolete
              ? "Pemasangan Padlock LOTO Versi Lama"
              : "Pelaporan dan Investigasi Kejadian"}
          </h1>
          <div>
            <StatusBadge>{obsolete ? "IK" : "SOP"}</StatusBadge>
            <StatusBadge
              tone={obsolete ? "danger" : "success"}
              outlined={obsolete}
            >
              {obsolete ? "Obsolete" : "Berlaku"}
            </StatusBadge>
            <span>
              {obsolete ? "Rev 3 · Kedaluwarsa" : "Rev 3 · Efektif 01 Okt 2026"}
            </span>
          </div>
        </div>
        <Button className="export-button">
          <Icon name="file" size={14} />
          Unduh PDF
        </Button>
      </header>
      <div className="document-detail-layout">
        <PdfPreview obsolete={obsolete} />
        <aside className="document-metadata">
          <MetadataCard obsolete={obsolete} />
          <RevisionHistory obsolete={obsolete} />
          <ApprovalWorkflow obsolete={obsolete} />
          <Distribution />
        </aside>
      </div>
    </section>
  )
}

function MetadataCard({ obsolete }: { obsolete: boolean }) {
  return (
    <section>
      <header>
        <h2>Metadata Dokumen</h2>
      </header>
      <dl>
        <div>
          <dt>Jenis</dt>
          <dd>{obsolete ? "Instruksi Kerja" : "SOP"}</dd>
        </div>
        <div>
          <dt>Pemilik</dt>
          <dd>{obsolete ? "Service AC" : "HSE"}</dd>
        </div>
        <div>
          <dt>Revisi</dt>
          <dd>Rev 3</dd>
        </div>
        <div>
          <dt>Tanggal efektif</dt>
          <dd>{obsolete ? "12 Mei 2024" : "01 Okt 2026"}</dd>
        </div>
        <div>
          <dt>Review berikutnya</dt>
          <dd>
            {obsolete ? (
              <StatusBadge tone="danger">Kedaluwarsa</StatusBadge>
            ) : (
              "01 Okt 2027"
            )}
          </dd>
        </div>
        <div>
          <dt>Klasifikasi</dt>
          <dd>Internal · Terkendali</dd>
        </div>
      </dl>
    </section>
  )
}

function RevisionHistory({ obsolete }: { obsolete: boolean }) {
  return (
    <section>
      <header>
        <h2>Riwayat Revisi</h2>
      </header>
      <div className="revision-list">
        {[
          [
            "Rev 3",
            obsolete
              ? "Digantikan Rev 4 karena perubahan prosedur LOTO."
              : "Menambahkan alur laporan mobile dan matriks klasifikasi.",
            "Budi Santoso · 28 Sep 2026",
          ],
          [
            "Rev 2",
            "Penyesuaian peran reviewer dan waktu pelaporan.",
            "Andi Pratama · 12 Feb 2025",
          ],
          ["Rev 1", "Penerbitan awal dokumen.", "Budi Santoso · 03 Jan 2024"],
        ].map(([rev, note, approver]) => (
          <div key={rev}>
            <span>{rev}</span>
            <p>
              <strong>{note}</strong>
              <small>{approver}</small>
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

function ApprovalWorkflow({ obsolete }: { obsolete: boolean }) {
  return (
    <section>
      <header>
        <h2>Alur Persetujuan</h2>
      </header>
      <div className="doc-approval">
        {[
          ["Penyusun", "Andi Pratama", "26 Sep 2026"],
          ["Reviewer", "Fajar Nugroho", "27 Sep 2026"],
          ["Pengesah", "Budi Santoso", "28 Sep 2026"],
        ].map(([role, name, date]) => (
          <div key={role}>
            <span>
              <Icon name="check" size={13} />
            </span>
            <p>
              <strong>
                {role} · {name}
              </strong>
              <small>
                {obsolete ? "Riwayat versi lama" : `Disetujui · ${date}`}
              </small>
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

function Distribution() {
  return (
    <section>
      <header>
        <h2>Distribusi & Pengakuan</h2>
      </header>
      <div className="distribution-list">
        {[
          ["HSE", "8/8 membaca"],
          ["Service AC", "14/18 membaca"],
          ["Pengawas", "4/4 membaca"],
          ["PJO/PJA", "3/3 membaca"],
        ].map(([group, status], index) => (
          <div key={group}>
            <span>{group}</span>
            <strong className={index === 1 ? "is-pending" : ""}>
              {status}
            </strong>
          </div>
        ))}
      </div>
    </section>
  )
}

const regulations = [
  [
    "Kepmen ESDM No. 1827 K/30/MEM/2018",
    "Lampiran III · Pengelolaan keselamatan pertambangan",
    "Relevan",
    "SMKP_GMI_2026.pdf",
    "Memenuhi",
    "Andi Pratama",
    "31 Des 2026",
    "—",
  ],
  [
    "Permen ESDM No. 26 Tahun 2018",
    "Pasal 14 · Kaidah pertambangan yang baik",
    "Relevan",
    "SOP_Keselamatan.pdf",
    "Sebagian",
    "Budi Santoso",
    "30 Nov 2026",
    "TMN-2026-0098",
  ],
  [
    "PP No. 50 Tahun 2012",
    "Pasal 5 · Penerapan SMK3",
    "Relevan",
    "Audit_SMK3_2026.pdf",
    "Memenuhi",
    "Andi Pratama",
    "31 Des 2026",
    "—",
  ],
  [
    "UU No. 1 Tahun 1970",
    "Pasal 9 · Pembinaan tenaga kerja",
    "Relevan",
    "Matriks_Pelatihan.xlsx",
    "Sebagian",
    "Dewi Lestari",
    "15 Nov 2026",
    "TMN-2026-0096",
  ],
  [
    "Permenaker No. 5 Tahun 2018",
    "Lampiran · Nilai ambang batas lingkungan kerja",
    "Relevan",
    "Hasil_Pengukuran_LK.pdf",
    "Belum Memenuhi",
    "Andi Pratama",
    "10 Nov 2026",
    "TMN-2026-0095",
  ],
  [
    "Permenaker No. 8 Tahun 2010",
    "Pasal 2 · Alat pelindung diri",
    "Relevan",
    "Register_APD_2026.pdf",
    "Memenuhi",
    "Fajar Nugroho",
    "31 Des 2026",
    "—",
  ],
  [
    "PP No. 22 Tahun 2021",
    "Pengelolaan limbah non-B3 kegiatan industri",
    "Tidak Relevan",
    "Kajian_Relevansi.pdf",
    "Tidak Relevan",
    "Andi Pratama",
    "—",
    "—",
  ],
] as const

function RegulationPage({ onNavigate }: Pick<Props, "onNavigate">) {
  const summary = [
    ["Memenuhi", 18, "success"],
    ["Sebagian", 5, "warning"],
    ["Belum Memenuhi", 2, "danger"],
    ["Tidak Relevan", 4, "neutral"],
  ] as const
  return (
    <section className="page regulation-page">
      <div className="page-heading">
        <div>
          <p className="overline">DOKUMEN</p>
          <h1>Evaluasi Peraturan KPLH</h1>
          <p>
            Evaluasi kepatuhan terhadap persyaratan hukum dan regulasi terkait.
          </p>
        </div>
        <Button className="create-button">
          <Icon name="plus" size={15} />
          Tambah Peraturan
        </Button>
      </div>
      <div className="regulation-summary">
        {summary.map(([label, count, tone]) => (
          <button key={label}>
            <StatusBadge tone={tone}>{label}</StatusBadge>
            <strong>{count}</strong>
          </button>
        ))}
      </div>
      <div className="regulation-table-card">
        <header>
          <div className="regulation-filters">
            <button>
              Semua relevansi <Icon name="chevron-down" size={13} />
            </button>
            <button>
              Semua status <Icon name="chevron-down" size={13} />
            </button>
            <button>
              Semua pemilik <Icon name="chevron-down" size={13} />
            </button>
          </div>
          <Button className="export-button">
            <Icon name="file" size={14} />
            Ekspor
          </Button>
        </header>
        <div className="regulation-table">
          <table>
            <thead>
              <tr>
                <th>Referensi Peraturan</th>
                <th>Pasal/Persyaratan</th>
                <th>Relevansi</th>
                <th>Bukti Pemenuhan</th>
                <th>Status</th>
                <th>Pemilik</th>
                <th>Tenggat</th>
                <th>Tindak Lanjut</th>
              </tr>
            </thead>
            <tbody>
              {regulations.map(
                ([
                  reference,
                  requirement,
                  relevance,
                  evidence,
                  status,
                  owner,
                  due,
                  followup,
                ]) => (
                  <tr key={reference + requirement}>
                    <td>
                      <strong>{reference}</strong>
                    </td>
                    <td>{requirement}</td>
                    <td>
                      <StatusBadge
                        tone={relevance === "Relevan" ? "info" : "neutral"}
                      >
                        {relevance}
                      </StatusBadge>
                    </td>
                    <td>
                      <button className="file-link">
                        <Icon name="file" size={13} />
                        {evidence}
                      </button>
                    </td>
                    <td>
                      <StatusBadge
                        tone={
                          status === "Memenuhi"
                            ? "success"
                            : status === "Sebagian"
                              ? "warning"
                              : status === "Belum Memenuhi"
                                ? "danger"
                                : "neutral"
                        }
                      >
                        {status}
                      </StatusBadge>
                    </td>
                    <td>{owner}</td>
                    <td>{due}</td>
                    <td>
                      {followup !== "—" ? (
                        <button
                          className="pica-link"
                          onClick={() => onNavigate("Temuan & PICA")}
                        >
                          <Icon name="arrow-right" size={12} />
                          {followup}
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
    </section>
  )
}

const koData: Record<string, string[][]> = {
  "Pengelolaan KO": [
    [
      "Inspeksi keselamatan workshop",
      "Inspeksi area dan aktivitas kerja",
      "Bulanan",
      "29 Sep 2026",
      "29 Okt 2026",
      "BA_Inspeksi.pdf",
      "Fajar Nugroho",
      "Selesai",
    ],
    [
      "Review program Keselamatan Operasi",
      "Evaluasi program dan capaian KPI",
      "Triwulan",
      "30 Sep 2026",
      "31 Des 2026",
      "MOM_Review_Q3.pdf",
      "Budi Santoso",
      "Berlaku",
    ],
    [
      "Audit internal KO",
      "Audit kesesuaian terhadap register KO",
      "Semester",
      "15 Jul 2026",
      "15 Jan 2027",
      "Laporan_Audit.pdf",
      "Andi Pratama",
      "Berlaku",
    ],
  ],
  "Pengamanan Instalasi": [
    [
      "Pemeriksaan instalasi listrik workshop",
      "Memastikan panel dan grounding aman",
      "Triwulan",
      "02 Sep 2026",
      "02 Des 2026",
      "Checklist_Listrik.pdf",
      "Hendra Wijaya",
      "Berlaku",
    ],
    [
      "Inspeksi sistem LOTO",
      "Verifikasi padlock dan prosedur isolasi",
      "Bulanan",
      "18 Okt 2026",
      "18 Nov 2026",
      "Inspeksi_LOTO.pdf",
      "Fajar Nugroho",
      "Berlaku",
    ],
    [
      "Pemeriksaan sistem proteksi kebakaran",
      "APAR, alarm, dan jalur evakuasi",
      "Bulanan",
      "05 Okt 2026",
      "05 Nov 2026",
      "Checklist_APAR.pdf",
      "Andi Pratama",
      "Akan Jatuh Tempo",
    ],
  ],
  "Pengujian & Kelayakan": [
    [
      "Kalibrasi manifold gauge",
      "Kalibrasi alat ukur refrigerant",
      "Tahunan",
      "12 Des 2025",
      "12 Des 2026",
      "Sertifikat_Kalibrasi.pdf",
      "Hendra Wijaya",
      "Berlaku",
    ],
    [
      "Uji kelayakan lifting aid",
      "Uji beban dan pemeriksaan visual",
      "6 Bulan",
      "20 Mei 2026",
      "20 Nov 2026",
      "Sertifikat_Lifting.pdf",
      "Fajar Nugroho",
      "Akan Jatuh Tempo",
    ],
    [
      "Pemeriksaan tabung refrigerant",
      "Visual, valve, dan masa hydrotest",
      "Bulanan",
      "01 Okt 2026",
      "01 Nov 2026",
      "Register_Tabung.xlsx",
      "Sari Wulandari",
      "Overdue",
    ],
  ],
  "Kajian Teknis": [
    [
      "Kajian modifikasi bracket kompresor",
      "Penilaian teknis perubahan desain bracket",
      "Sesuai kebutuhan",
      "10 Sep 2026",
      "—",
      "Kajian_Bracket.pdf",
      "Hendra Wijaya",
      "Closed",
    ],
    [
      "Kajian ventilasi Workshop Service",
      "Evaluasi pertukaran udara area kerja",
      "Tahunan",
      "15 Jan 2026",
      "15 Jan 2027",
      "Kajian_Ventilasi.pdf",
      "Andi Pratama",
      "Berlaku",
    ],
    [
      "Kajian penggunaan refrigerant R134a",
      "Evaluasi aspek teknis dan lingkungan",
      "2 Tahun",
      "02 Feb 2025",
      "02 Feb 2027",
      "Kajian_Refrigerant.pdf",
      "Andi Pratama",
      "Berlaku",
    ],
  ],
}

function KoRegister() {
  const [tab, setTab] = useState("Pengelolaan KO")
  const [search, setSearch] = useState("")
  const rows = koData[tab].filter((row) =>
    row.join(" ").toLowerCase().includes(search.toLowerCase()),
  )
  return (
    <section className="page ko-page">
      <div className="page-heading">
        <div>
          <p className="overline">DOKUMEN</p>
          <h1>Register Keselamatan Operasi</h1>
          <p>Pemantauan kewajiban, pengamanan, pengujian, dan kajian teknis.</p>
        </div>
        <Button className="create-button">
          <Icon name="plus" size={15} />
          Tambah Register
        </Button>
      </div>
      <nav className="ko-tabs">
        {Object.keys(koData).map((item) => (
          <button
            key={item}
            className={tab === item ? "is-active" : ""}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </nav>
      <div className="ko-register-card">
        <header>
          <div className="ko-search">
            <Icon name="search" size={15} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kegiatan, objek, PIC, atau bukti…"
            />
          </div>
          <div>
            <button>
              Semua status <Icon name="chevron-down" size={12} />
            </button>
            <Button className="export-button">
              <Icon name="file" size={14} />
              Ekspor
            </Button>
          </div>
        </header>
        <div className="ko-table">
          <table>
            <thead>
              <tr>
                <th>Kegiatan/Objek</th>
                <th>Kewajiban</th>
                <th>Frekuensi</th>
                <th>Terakhir Dilakukan</th>
                <th>Jatuh Tempo Berikutnya</th>
                <th>Bukti</th>
                <th>PIC</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(
                ([
                  activity,
                  obligation,
                  frequency,
                  last,
                  due,
                  evidence,
                  pic,
                  status,
                ]) => (
                  <tr key={activity}>
                    <td>
                      <strong>{activity}</strong>
                    </td>
                    <td>{obligation}</td>
                    <td>{frequency}</td>
                    <td>{last}</td>
                    <td>
                      {due === "—" ? (
                        "—"
                      ) : (
                        <ExpiryChip
                          days={
                            status === "Overdue"
                              ? -1
                              : status === "Akan Jatuh Tempo"
                                ? 18
                                : 90
                          }
                        />
                      )}
                    </td>
                    <td>
                      <button className="file-link">
                        <Icon name="file" size={13} />
                        {evidence}
                      </button>
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
                    <td>
                      <StatusBadge
                        tone={
                          status === "Overdue"
                            ? "danger"
                            : status === "Akan Jatuh Tempo"
                              ? "warning"
                              : status === "Closed"
                                ? "success"
                                : "info"
                        }
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
    </section>
  )
}

export default function DocumentsManagement({ page, onNavigate }: Props) {
  if (page === "GMI-SOP-HSE-014" || page === "GMI-IK-OPS-009")
    return <DocumentDetail page={page} onNavigate={onNavigate} />
  if (page === "Evaluasi Peraturan")
    return <RegulationPage onNavigate={onNavigate} />
  if (page === "Register Keselamatan Operasi") return <KoRegister />
  return <DocumentRegister onNavigate={onNavigate} />
}
