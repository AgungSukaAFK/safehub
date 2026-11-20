import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react"
import { Button, Field, Icon, IconButton, StatusBadge } from "./ui"

type Props = { onNavigate: (page: string) => void reporter?: string }
type Attachment = { name: string url: string type: string caption: string }

const categories = [
  ["Near Miss", "shield"],
  ["Cedera", "user"],
  ["Kerusakan Properti", "tools"],
  ["Kebakaran", "bell"],
  ["Penyakit Akibat Kerja", "hard-hat"],
  ["Lingkungan", "building"],
  ["Lainnya", "more"],
] as const

const steps = [
  ["Informasi Kejadian", "Waktu, lokasi, dan kategori"],
  ["Pihak Terkait", "Pelapor, pekerja, dan saksi"],
  ["Bukti", "Foto, video, dan dokumen"],
  ["Tinjau & Kirim", "Periksa sebelum dikirim"],
]

function SelectField({
  label,
  value,
  onChange,
  children,
  required,
  error,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
  required?: boolean
  error?: string
}) {
  return (
    <label className="select-field">
      <span>
        {label} {required && <b>*</b>}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={!!error}
      >
        {children}
      </select>
      {error && <small>{error}</small>}
    </label>
  )
}

function Success({ onNavigate }: Pick<Props, "onNavigate">) {
  return (
    <section className="incident-success">
      <div className="success-check">
        <Icon name="check" size={34} />
      </div>
      <p className="overline">LAPORAN KEJADIAN</p>
      <h1>Laporan terkirim</h1>
      <strong>KJD-2026-0013</strong>
      <p>
        Notifikasi telah dikirim ke HSE dan PJO. Anda dapat memantau statusnya
        di Laporan Saya.
      </p>
      <div>
        <Button
          className="primary-button"
          onClick={() => onNavigate("Kejadian & Investigasi")}
        >
          Lihat Laporan
        </Button>
        <Button
          className="secondary-button"
          onClick={() => onNavigate("Dashboard")}
        >
          Kembali ke Dashboard
        </Button>
      </div>
    </section>
  )
}

export default function IncidentReport({
  onNavigate,
  reporter = "Andi Pratama",
}: Props) {
  const [step, setStep] = useState(1)
  const [submitted, setSubmitted] = useState(false)
  const [incidentAt, setIncidentAt] = useState("")
  const [location, setLocation] = useState("")
  const [locationDetail, setLocationDetail] = useState("")
  const [category, setCategory] = useState("")
  const [unit, setUnit] = useState("")
  const [description, setDescription] = useState("")
  const [emergency, setEmergency] = useState(false)
  const [supervisor, setSupervisor] = useState("Fajar Nugroho")
  const [workers, setWorkers] = useState([
    { name: "", company: "GMI", status: "Karyawan Tetap", position: "" },
  ])
  const [witnesses, setWitnesses] = useState([
    { name: "", company: "GMI", contact: "" },
  ])
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [declared, setDeclared] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const fileInput = useRef<HTMLInputElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)
  const reportedAt = "2026-10-31T08:42"
  const completed = useMemo(
    () => [
      !!incidentAt && !!location && !!category && !!description,
      true,
      true,
      declared,
    ],
    [incidentAt, location, category, description, declared],
  )

  function validateStepOne() {
    const next: Record<string, string> = {}
    if (!incidentAt) next.incidentAt = "Tanggal kejadian wajib diisi"
    if (incidentAt && incidentAt > reportedAt)
      next.incidentAt = "Tanggal kejadian tidak boleh melebihi tanggal laporan"
    if (!location) next.location = "Lokasi kejadian wajib dipilih"
    if (!category) next.category = "Kategori kejadian wajib dipilih"
    if (!description.trim()) next.description = "Uraian kejadian wajib diisi"
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function nextStep() {
    if (step === 1 && !validateStepOne()) return
    setStep((current) => Math.min(4, current + 1))
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function submit() {
    const valid = validateStepOne()
    if (!declared)
      setErrors((current) => ({
        ...current,
        declared: "Pernyataan kebenaran informasi wajib disetujui",
      }))
    if (!valid || !declared) {
      setStep(!valid ? 1 : 4)
      return
    }
    setSubmitted(true)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || [])
    setAttachments((current) => [
      ...current,
      ...files.map((file) => ({
        name: file.name,
        url: file.type.startsWith("image/") ? URL.createObjectURL(file) : "",
        type: file.type,
        caption: "",
      })),
    ])
    event.target.value = ""
  }

  if (submitted) return <Success onNavigate={onNavigate} />

  return (
    <section className="page incident-page">
      <div className="incident-heading">
        <div>
          <button onClick={() => onNavigate("Dashboard")}>
            Dashboard <span>/</span> Lapor Kejadian
          </button>
          <h1>Lapor Kejadian</h1>
          <p>Catat informasi awal kejadian secara lengkap dan akurat.</p>
        </div>
        <span className="autosave">
          <i />
          Draf tersimpan otomatis · 08:42
        </span>
      </div>

      <ol className="incident-stepper">
        {steps.map(([label, helper], index) => {
          const number = index + 1
          return (
            <li
              key={label}
              className={`${step === number ? "is-active" : ""} ${
                step > number || completed[index] ? "is-complete" : ""
              }`}
            >
              <button onClick={() => number < step && setStep(number)}>
                <span>
                  {step > number ? <Icon name="check" size={15} /> : number}
                </span>
                <div>
                  <strong>{label}</strong>
                  <small>{helper}</small>
                </div>
              </button>
            </li>
          )
        })}
      </ol>

      <div className="incident-form-shell">
        <div className={`incident-step ${step === 1 ? "is-current" : ""}`}>
          <header>
            <span>1</span>
            <div>
              <h2>Informasi Kejadian</h2>
              <p>Isi waktu, lokasi, dan gambaran awal kejadian.</p>
            </div>
          </header>
          <div className="incident-fields">
            <label className="native-field">
              <span>Tanggal & jam kejadian *</span>
              <div className={errors.incidentAt ? "has-error" : ""}>
                <input
                  type="datetime-local"
                  value={incidentAt}
                  max={reportedAt}
                  onChange={(event) => {
                    setIncidentAt(event.target.value)
                    setErrors((current) => ({ ...current, incidentAt: "" }))
                  }}
                />
                <button
                  type="button"
                  className="now-shortcut"
                  onClick={() => setIncidentAt(reportedAt)}
                >
                  Sekarang
                </button>
              </div>
              {errors.incidentAt && <small>{errors.incidentAt}</small>}
            </label>
            <label className="native-field">
              <span>Tanggal & jam dilaporkan</span>
              <input type="datetime-local" value={reportedAt} readOnly />
              <em>Dicatat terpisah dari waktu kejadian</em>
            </label>
            <SelectField
              label="Lokasi"
              required
              value={location}
              onChange={(value) => {
                setLocation(value)
                setErrors((current) => ({ ...current, location: "" }))
              }}
              error={errors.location}
            >
              <option value="">Cari atau pilih lokasi</option>
              <option>Workshop Service</option>
              <option>Pit Area</option>
              <option>Hauling Road</option>
              <option>Warehouse</option>
              <option>Office GMI</option>
            </SelectField>
            <Field
              label="Detail lokasi"
              value={locationDetail}
              placeholder="Contoh: Bay 2, sisi kiri unit"
              onChange={(event) => setLocationDetail(event.target.value)}
            />
            <fieldset className="category-field">
              <legend>Kategori kejadian *</legend>
              <div>
                {categories.map(([label, icon]) => (
                  <button
                    type="button"
                    key={label}
                    className={category === label ? "is-selected" : ""}
                    onClick={() => {
                      setCategory(label)
                      setErrors((current) => ({ ...current, category: "" }))
                    }}
                  >
                    <Icon name={icon} size={19} />
                    {label}
                    {category === label && <Icon name="check" size={14} />}
                  </button>
                ))}
              </div>
              {errors.category && <small>{errors.category}</small>}
            </fieldset>
            <SelectField
              label="Unit/peralatan terkait"
              value={unit}
              onChange={setUnit}
            >
              <option value="">Cari unit atau peralatan</option>
              <option>H57197 · HD785-7</option>
              <option>E51203 · PC1250</option>
              <option>G5809 · GD825A</option>
              <option>DA54853 · Mercedes Arocs</option>
              <option>E5126 · PC2000</option>
            </SelectField>
            <label className="textarea-field">
              <span>Uraian singkat kejadian *</span>
              <textarea
                value={description}
                maxLength={1000}
                placeholder="Jelaskan apa yang terjadi, kondisi sebelum kejadian, dan tindakan awal yang dilakukan."
                onChange={(event) => {
                  setDescription(event.target.value)
                  setErrors((current) => ({ ...current, description: "" }))
                }}
              />
              <small className={errors.description ? "is-error" : ""}>
                {errors.description || `${description.length}/1000`}
              </small>
            </label>
            <label className="emergency-toggle">
              <span>
                <strong>Butuh penanganan darurat?</strong>
                <small>
                  Aktifkan jika kondisi masih berbahaya atau memerlukan bantuan
                  segera.
                </small>
              </span>
              <input
                type="checkbox"
                checked={emergency}
                onChange={(event) => setEmergency(event.target.checked)}
              />
              <i />
            </label>
            {emergency && (
              <div className="emergency-callout">
                <Icon name="bell" size={22} />
                <p>
                  <strong>Segera hubungi tim tanggap darurat.</strong>
                  <span>Laporan ini akan langsung dikirim ke HSE dan PJO.</span>
                </p>
                <Button
                  className="emergency-button"
                  onClick={() =>
                    window.alert("Menghubungi tim tanggap darurat Site MIFA.")
                  }
                >
                  <Icon name="phone" size={16} />
                  Hubungi sekarang
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className={`incident-step ${step === 2 ? "is-current" : ""}`}>
          <header>
            <span>2</span>
            <div>
              <h2>Pihak Terkait</h2>
              <p>Tambahkan pekerja, saksi, dan penanggung jawab terkait.</p>
            </div>
          </header>
          <div className="incident-fields">
            <div className="reporter-card">
              <span className="avatar">
                {reporter === "Rudi Hartono" ? "RH" : "AP"}
              </span>
              <div>
                <small>Pelapor</small>
                <strong>{reporter}</strong>
                <span>
                  {reporter === "Rudi Hartono"
                    ? "Teknisi AC · Service AC"
                    : "HSE Officer · HSE"}
                </span>
              </div>
              <StatusBadge tone="info">Otomatis</StatusBadge>
            </div>
            <details className="optional-mobile">
              <summary>Tambah detail (opsional)</summary>
              <div className="repeatable-section">
                <div className="subsection-heading">
                  <div>
                    <h3>Pekerja yang terlibat</h3>
                    <p>Tambahkan semua pekerja yang terlibat langsung.</p>
                  </div>
                  <Button
                    className="add-row-button"
                    onClick={() =>
                      setWorkers((current) => [
                        ...current,
                        {
                          name: "",
                          company: "GMI",
                          status: "Karyawan Tetap",
                          position: "",
                        },
                      ])
                    }
                  >
                    <Icon name="plus" size={15} />
                    Tambah pekerja
                  </Button>
                </div>
                {workers.map((worker, index) => (
                  <div className="repeatable-row" key={index}>
                    <span className="row-number">{index + 1}</span>
                    <Field
                      label="Nama"
                      value={worker.name}
                      placeholder="Cari nama atau masukkan manual"
                      onChange={(e) =>
                        setWorkers((current) =>
                          current.map((item, i) =>
                            i === index
                              ? { ...item, name: e.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                    <SelectField
                      label="Perusahaan"
                      value={worker.company}
                      onChange={(value) =>
                        setWorkers((current) =>
                          current.map((item, i) =>
                            i === index ? { ...item, company: value } : item,
                          ),
                        )
                      }
                    >
                      <option>GMI</option>
                      <option>Kontraktor</option>
                      <option>Visitor</option>
                    </SelectField>
                    <SelectField
                      label="Status kerja"
                      value={worker.status}
                      onChange={(value) =>
                        setWorkers((current) =>
                          current.map((item, i) =>
                            i === index ? { ...item, status: value } : item,
                          ),
                        )
                      }
                    >
                      <option>Karyawan Tetap</option>
                      <option>Kontrak</option>
                      <option>Harian</option>
                      <option>Visitor</option>
                    </SelectField>
                    <Field
                      label="Jabatan"
                      value={worker.position}
                      placeholder="Contoh: Teknisi AC"
                      onChange={(e) =>
                        setWorkers((current) =>
                          current.map((item, i) =>
                            i === index
                              ? { ...item, position: e.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                    {workers.length > 1 && (
                      <IconButton
                        label="Hapus pekerja"
                        className="remove-row"
                        onClick={() =>
                          setWorkers((current) =>
                            current.filter((_, i) => i !== index),
                          )
                        }
                      >
                        <Icon name="x" size={16} />
                      </IconButton>
                    )}
                  </div>
                ))}
              </div>
              <div className="repeatable-section">
                <div className="subsection-heading">
                  <div>
                    <h3>Saksi</h3>
                    <p>
                      Tambahkan saksi yang melihat atau mengetahui kejadian.
                    </p>
                  </div>
                  <Button
                    className="add-row-button"
                    onClick={() =>
                      setWitnesses((current) => [
                        ...current,
                        { name: "", company: "GMI", contact: "" },
                      ])
                    }
                  >
                    <Icon name="plus" size={15} />
                    Tambah saksi
                  </Button>
                </div>
                {witnesses.map((witness, index) => (
                  <div className="repeatable-row witness-row" key={index}>
                    <span className="row-number">{index + 1}</span>
                    <Field
                      label="Nama"
                      value={witness.name}
                      placeholder="Nama saksi"
                      onChange={(e) =>
                        setWitnesses((current) =>
                          current.map((item, i) =>
                            i === index
                              ? { ...item, name: e.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                    <SelectField
                      label="Perusahaan"
                      value={witness.company}
                      onChange={(value) =>
                        setWitnesses((current) =>
                          current.map((item, i) =>
                            i === index ? { ...item, company: value } : item,
                          ),
                        )
                      }
                    >
                      <option>GMI</option>
                      <option>Kontraktor</option>
                      <option>Visitor</option>
                    </SelectField>
                    <Field
                      label="Kontak"
                      value={witness.contact}
                      placeholder="Nomor telepon"
                      onChange={(e) =>
                        setWitnesses((current) =>
                          current.map((item, i) =>
                            i === index
                              ? { ...item, contact: e.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  </div>
                ))}
              </div>
              <SelectField
                label="Atasan langsung"
                value={supervisor}
                onChange={setSupervisor}
              >
                <option>Fajar Nugroho</option>
                <option>Budi Santoso</option>
                <option>Andi Pratama</option>
              </SelectField>
            </details>
          </div>
        </div>

        <div className={`incident-step ${step === 3 ? "is-current" : ""}`}>
          <header>
            <span>3</span>
            <div>
              <h2>Bukti</h2>
              <p>Tambahkan dokumentasi untuk membantu proses review.</p>
            </div>
          </header>
          <div className="incident-fields">
            <input
              ref={fileInput}
              className="hidden-file-input"
              type="file"
              multiple
              accept="image/jpeg,image/png,application/pdf,video/mp4"
              onChange={addFiles}
            />
            <input
              ref={cameraInput}
              className="hidden-file-input"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={addFiles}
            />
            <button
              type="button"
              className="camera-button"
              onClick={() => cameraInput.current?.click()}
            >
              <Icon name="camera" size={25} />
              <span>
                <strong>Ambil Foto</strong>
                <small>Gunakan kamera perangkat</small>
              </span>
            </button>
            <button
              type="button"
              className="file-dropzone"
              onClick={() => fileInput.current?.click()}
            >
              <span>
                <Icon name="upload" size={24} />
              </span>
              <strong>Tarik dan lepas file di sini</strong>
              <p>atau klik untuk memilih file</p>
              <small>JPG, PNG, PDF, MP4 · maks 10 MB</small>
            </button>
            {attachments.length > 0 && (
              <div className="attachment-list">
                {attachments.map((file, index) => (
                  <article key={`${file.name}-${index}`}>
                    {file.url ? (
                      <img src={file.url} alt="" />
                    ) : (
                      <span className="file-preview">
                        <Icon name="file" size={24} />
                      </span>
                    )}
                    <div>
                      <strong>{file.name}</strong>
                      <small>{file.type || "Dokumen"}</small>
                      <input
                        value={file.caption}
                        placeholder="Tambahkan keterangan file"
                        onChange={(e) =>
                          setAttachments((current) =>
                            current.map((item, i) =>
                              i === index
                                ? { ...item, caption: e.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                    </div>
                    <IconButton
                      label="Hapus lampiran"
                      onClick={() =>
                        setAttachments((current) =>
                          current.filter((_, i) => i !== index),
                        )
                      }
                    >
                      <Icon name="x" size={16} />
                    </IconButton>
                  </article>
                ))}
              </div>
            )}
            <div className="privacy-note">
              <Icon name="lock" size={17} />
              Lampiran hanya dapat dilihat oleh pihak berwenang.
            </div>
          </div>
        </div>

        <div className={`incident-step ${step === 4 ? "is-current" : ""}`}>
          <header>
            <span>4</span>
            <div>
              <h2>Tinjau & Kirim</h2>
              <p>Pastikan seluruh informasi sudah benar sebelum dikirim.</p>
            </div>
          </header>
          <div className="incident-fields review-content">
            <section>
              <header>
                <h3>Informasi Kejadian</h3>
                <button onClick={() => setStep(1)}>Ubah</button>
              </header>
              <dl>
                <div>
                  <dt>Waktu kejadian</dt>
                  <dd>
                    {incidentAt ? "31 Okt 2026, 08:42 WIB" : "Belum diisi"}
                  </dd>
                </div>
                <div>
                  <dt>Lokasi</dt>
                  <dd>
                    {location || "Belum dipilih"}
                    {locationDetail && ` · ${locationDetail}`}
                  </dd>
                </div>
                <div>
                  <dt>Kategori</dt>
                  <dd>{category || "Belum dipilih"}</dd>
                </div>
                <div>
                  <dt>Unit/peralatan</dt>
                  <dd>{unit || "Tidak ada"}</dd>
                </div>
                <div className="full">
                  <dt>Uraian</dt>
                  <dd>{description || "Belum diisi"}</dd>
                </div>
              </dl>
            </section>
            <section>
              <header>
                <h3>Pihak Terkait</h3>
                <button onClick={() => setStep(2)}>Ubah</button>
              </header>
              <dl>
                <div>
                  <dt>Pelapor</dt>
                  <dd>{reporter}</dd>
                </div>
                <div>
                  <dt>Atasan langsung</dt>
                  <dd>{supervisor}</dd>
                </div>
                <div>
                  <dt>Pekerja terlibat</dt>
                  <dd>
                    {workers.filter((item) => item.name).length || "Tidak ada"}
                  </dd>
                </div>
                <div>
                  <dt>Saksi</dt>
                  <dd>
                    {witnesses.filter((item) => item.name).length ||
                      "Tidak ada"}
                  </dd>
                </div>
              </dl>
            </section>
            <section>
              <header>
                <h3>Bukti</h3>
                <button onClick={() => setStep(3)}>Ubah</button>
              </header>
              <p>
                {attachments.length
                  ? `${attachments.length} lampiran ditambahkan`
                  : "Belum ada lampiran"}
              </p>
            </section>
            <label className="declaration">
              <input
                type="checkbox"
                checked={declared}
                onChange={(e) => {
                  setDeclared(e.target.checked)
                  setErrors((current) => ({ ...current, declared: "" }))
                }}
              />
              <span>
                <Icon name="check" size={14} />
              </span>
              <p>Informasi yang saya laporkan benar sesuai pengetahuan saya</p>
            </label>
            {errors.declared && (
              <p className="declaration-error">{errors.declared}</p>
            )}
          </div>
        </div>

        <footer className="incident-form-footer">
          <Button
            className="draft-button"
            onClick={() => window.alert("Draf laporan berhasil disimpan.")}
          >
            Simpan Draf
          </Button>
          <div>
            {step > 1 && (
              <Button
                className="back-button"
                onClick={() => setStep((current) => current - 1)}
              >
                Kembali
              </Button>
            )}
            {step < 4 ? (
              <Button className="primary-button" onClick={nextStep}>
                Lanjutkan <Icon name="arrow-right" size={17} />
              </Button>
            ) : (
              <Button className="primary-button" onClick={submit}>
                Kirim Laporan <Icon name="arrow-right" size={17} />
              </Button>
            )}
          </div>
        </footer>
      </div>
      <div className="mobile-submit-bar">
        <Button
          className="draft-button"
          onClick={() => window.alert("Draf laporan berhasil disimpan.")}
        >
          Simpan Draf
        </Button>
        <Button className="primary-button" onClick={submit}>
          Kirim
        </Button>
      </div>
    </section>
  )
}
