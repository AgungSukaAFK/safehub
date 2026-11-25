// Landing publik (tanpa login). Tidak membaca data apa pun.
import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight, ClipboardList, FileBarChart, FileText, HardHat, Users2, Wrench, type LucideIcon } from "lucide-react";
import { APP_NAME, APP_URL } from "@/lib/app-config";
import { CHAPTERS, MODULES, PRINCIPLES } from "./content";
import { GlowCards } from "./glow-cards";
import { MorphCanvas } from "./morph-canvas";
import { RoleSwitcher } from "./role-switcher";
import "./landing.css";

const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-landing", display: "swap" });

const TITLE = `${APP_NAME}: Aplikasi Manajemen K3, Inspeksi & PICA`;
const DESCRIPTION =
  "Aplikasi manajemen K3 (HSE) untuk lapor kejadian, inspeksi, observasi KTA/TTA, temuan PICA, kompetensi, MCU, kontraktor, dan laporan K3 dalam satu sistem.";
const URL_PATH = "/selamat-datang";

// Satu-satunya halaman yang boleh diindeks (layout akar = noindex). Gambar berbagi: opengraph-image.png.
export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: URL_PATH },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  openGraph: { type: "website", locale: "id_ID", siteName: APP_NAME, url: URL_PATH, title: TITLE, description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Organization", "@id": `${APP_URL}/#org`, name: "Lourdes Auto Parts", logo: `${APP_URL}/lourdes-logo.webp` },
    { "@type": "WebSite", "@id": `${APP_URL}/#site`, name: APP_NAME, url: `${APP_URL}/`, inLanguage: "id", publisher: { "@id": `${APP_URL}/#org` } },
    { "@type": "WebPage", "@id": `${APP_URL}${URL_PATH}`, url: `${APP_URL}${URL_PATH}`, name: TITLE, description: DESCRIPTION, inLanguage: "id", isPartOf: { "@id": `${APP_URL}/#site` }, about: { "@id": `${APP_URL}/#app` } },
    {
      "@type": "WebApplication",
      "@id": `${APP_URL}/#app`,
      name: APP_NAME,
      url: `${APP_URL}${URL_PATH}`,
      description: DESCRIPTION,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      inLanguage: "id",
      featureList: MODULES.flatMap((m) => m.items),
      publisher: { "@id": `${APP_URL}/#org` },
    },
  ],
};

const ICONS: Record<(typeof MODULES)[number]["key"], LucideIcon> = {
  k3lh: ClipboardList,
  people: Users2,
  kontraktor: HardHat,
  dokumen: FileText,
  maintenance: Wrench,
  laporan: FileBarChart,
};

function LoginLink() {
  return (
    <Link href="/auth/login" prefetch={false} className="lp-btn">
      Masuk ke {APP_NAME}
      <ArrowRight aria-hidden="true" />
    </Link>
  );
}

export default function LandingPage() {
  return (
    <div className={`lp ${archivo.variable}`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD).replace(/</g, "\u003c") }} />
      <a href="#isi" className="lp-skip">
        Langsung ke isi
      </a>
      <header className="lp-nav lp-glass">
        <a href="#isi" className="lp-brand">
          <Image src="/icon.svg" alt="" width={32} height={32} unoptimized />
          <span>{APP_NAME}</span>
        </a>
        <nav aria-label="Bagian halaman">
          <a href="#alur">Alur</a>
          <a href="#modul">Modul</a>
          <a href="#peran">Peran</a>
        </nav>
        <Link href="/auth/login" prefetch={false} className="lp-nav-login">
          Masuk
        </Link>
      </header>

      <main id="isi" tabIndex={-1}>
        <div className="lp-stage">
          <div className="lp-sticky" aria-hidden="true">
            <div className="lp-orb lp-orb-a" />
            <div className="lp-orb lp-orb-b" />
            <MorphCanvas />
          </div>

          <section className="lp-hero" data-shape>
            <div className="lp-hero-copy">
              <h1>
                <span>Berangkat kerja.</span> <span>Pulang selamat.</span>
              </h1>
              <p>
                {APP_NAME} adalah aplikasi manajemen K3 yang menyatukan kejadian, temuan, inspeksi, kompetensi, dan laporan K3 setiap site, dari laporan pertama sampai tindakan terakhir ditutup.
              </p>
              <div className="lp-actions">
                <LoginLink />
                <a href="#alur" className="lp-btn lp-btn-ghost">
                  Lihat alurnya
                  <ArrowDown aria-hidden="true" />
                </a>
              </div>
            </div>
          </section>

          <div id="alur">
            {CHAPTERS.map((c, i) => (
              <section key={c.stage} className="lp-chapter" data-shape>
                <div className="lp-glass lp-chapter-card">
                  <ol className="lp-steps" aria-label={`Tahap ${i + 1} dari ${CHAPTERS.length}: ${c.stage}`}>
                    {CHAPTERS.map((s, j) => (
                      <li key={s.stage} data-on={j <= i || undefined} aria-current={j === i ? "step" : undefined}>
                        {s.stage}
                      </li>
                    ))}
                  </ol>
                  <h2>{c.title}</h2>
                  <p>{c.body}</p>
                  <div className="lp-sample">
                    <span className="lp-sample-tag">Contoh</span>
                    <code>{c.sample.code}</code>
                    <span>{c.sample.text}</span>
                    <strong>{c.sample.status}</strong>
                  </div>
                </div>
              </section>
            ))}
          </div>

          {/* Jenjang tambang terbuka: peralihan ke siang */}
          <div className="lp-pit" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>

        <section id="modul" className="lp-day">
          <div className="lp-wrap">
            <h2 className="lp-h2 lp-rise">Enam area kerja, satu sumber angka.</h2>
            <GlowCards className="lp-bento">
              {MODULES.map((m) => {
                const Icon = ICONS[m.key];
                return (
                  <article key={m.key} className={`lp-card lp-rise lp-card-${m.key}`} data-glow>
                    <div className="lp-shape" aria-hidden="true">
                      <Icon />
                    </div>
                    <h3>{m.name}</h3>
                    <p>{m.line}</p>
                    <ul>
                      {m.items.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </GlowCards>
          </div>
        </section>

        <section id="peran" className="lp-day lp-day-roles">
          <div className="lp-wrap">
            <h2 className="lp-h2 lp-rise">Tampilan berubah mengikuti tanggung jawab.</h2>
            <RoleSwitcher />
          </div>
        </section>

        <section className="lp-dusk">
          <div className="lp-wrap">
            <dl className="lp-principles">
              {PRINCIPLES.map((p) => (
                <div key={p.title} className="lp-rise">
                  <dt>{p.title}</dt>
                  <dd>{p.body}</dd>
                </div>
              ))}
            </dl>
            <div className="lp-glass lp-closing lp-grow">
              <h2>Mulai shift dengan daftar tugas yang jelas.</h2>
              <p>Gunakan akun Lourdes Anda. Belum punya akses? Bantuannya ada di halaman masuk.</p>
              <LoginLink />
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-wrap">
          <div className="lp-logos">
            <Image src="/lourdes-logo.webp" alt="Lourdes Auto Parts" width={1024} height={392} sizes="140px" />
            <Image src="/gmi-landscape-stroke.webp" alt="PT. Garuda Mart Indonesia" width={1098} height={148} sizes="220px" />
            <Image src="/gis-landscape.webp" alt="PT. Global Inti Sejati" width={1080} height={261} sizes="180px" />
          </div>
          <p>© Lourdes Auto Parts · {APP_NAME}</p>
        </div>
      </footer>
    </div>
  );
}
