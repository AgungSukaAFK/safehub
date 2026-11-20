import { useState } from "react"
import { Button, EmptyState, Icon, Skeleton } from "./ui"

export function NotFound({
  onNavigate,
}: {
  onNavigate: (page: string) => void
}) {
  return (
    <section className="system-message-page">
      <span>404</span>
      <h1>Halaman tidak ditemukan</h1>
      <p>Halaman yang Anda cari tidak tersedia atau sudah dipindahkan.</p>
      <Button
        className="primary-button"
        onClick={() => onNavigate("Dashboard")}
      >
        Kembali ke Dashboard
      </Button>
    </section>
  )
}

export default function SystemStates({
  onNavigate,
}: {
  onNavigate: (page: string) => void
}) {
  const [state, setState] = useState("Kosong")
  const states = [
    "Kosong",
    "Loading Dashboard",
    "Loading Tabel",
    "Error",
    "Akses Ditolak",
    "404",
  ]
  return (
    <section className="page system-states-page">
      <div className="page-heading">
        <div>
          <p className="overline">DESIGN SYSTEM</p>
          <h1>Status Antarmuka</h1>
          <p>
            State standar untuk data kosong, loading, error, akses ditolak, dan
            halaman tidak ditemukan.
          </p>
        </div>
      </div>
      <nav>
        {states.map((item) => (
          <button
            key={item}
            className={state === item ? "is-active" : ""}
            onClick={() => setState(item)}
          >
            {item}
          </button>
        ))}
      </nav>
      <div className="state-stage">
        {state === "Kosong" && (
          <EmptyState
            title="Belum ada temuan untuk filter ini"
            description="Ubah filter atau buat temuan baru untuk mulai menampilkan data."
          />
        )}
        {state === "Loading Dashboard" && (
          <div className="dashboard-loading">
            <Skeleton lines={2} />
            <div>
              {[1, 2, 3, 4].map((item) => (
                <Skeleton key={item} lines={3} />
              ))}
            </div>
            <Skeleton lines={6} />
          </div>
        )}
        {state === "Loading Tabel" && (
          <div className="table-loading">
            <Skeleton lines={1} />
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <Skeleton key={item} lines={2} />
            ))}
          </div>
        )}
        {state === "Error" && (
          <div className="state-message is-error">
            <span>
              <Icon name="x" size={24} />
            </span>
            <h2>Data gagal dimuat. Coba lagi.</h2>
            <p>Periksa koneksi Anda atau muat ulang data.</p>
            <Button className="secondary-button">Coba Lagi</Button>
          </div>
        )}
        {state === "Akses Ditolak" && (
          <div className="state-message">
            <span>
              <Icon name="lock" size={24} />
            </span>
            <h2>Anda tidak memiliki akses ke modul ini.</h2>
            <p>Hubungi administrator untuk meminta akses yang sesuai.</p>
            <Button
              className="secondary-button"
              onClick={() => onNavigate("Dashboard")}
            >
              Kembali
            </Button>
          </div>
        )}
        {state === "404" && <NotFound onNavigate={onNavigate} />}
      </div>
    </section>
  )
}
