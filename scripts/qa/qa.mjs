#!/usr/bin/env node
// QA otomatis (frontend-guide §28) di Chrome headless sungguhan, terhadap server yang SEDANG jalan.
//   QA_BASE=http://localhost:3000 npm run qa            (default http://localhost:3000)
//   npm run qa -- --tanpa-offline                       (lewati bagian offline; wajib build produksi)
//   npm run qa -- --tanpa-perf                          (lewati pengukuran performa)
// Butuh: Supabase lokal + seed DEMO, .env.local, Chrome. Hasil: scripts/qa/out/ (report.json, PNG, lembar kontak).
// Exit code 1 kalau ada cek yang gagal.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { launch, sleep } from "./cdp.mjs";
import { asUser, loginPage } from "./session.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const OUT = path.join(import.meta.dirname, "out");
const BASE = (process.env.QA_BASE || "http://localhost:3000").replace(/\/$/, "");
const ARGS = new Set(process.argv.slice(2));
const APP_ID = fs.readFileSync(path.join(ROOT, "lib/app-config.ts"), "utf8").match(/APP_ID = "([^"]+)"/)[1];
const USER = (u) => `${u}@demo.lourdes.test`;

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const results = [];
let section = "";
function check(name, ok, detail) {
  results.push({ section, name, ok: !!ok, detail });
  const d = detail === undefined ? "" : " " + (typeof detail === "string" ? detail : JSON.stringify(detail)).slice(0, 300);
  console.log(`${ok ? "  LULUS" : "  GAGAL"} ${name}${ok ? "" : d}`);
}
const warnings = [];
/** Peringatan: dilaporkan, tidak menggagalkan QA (pengukuran yang terlalu bising untuk gerbang). */
function warn(name, ok, detail) {
  if (ok) return check(name, true);
  warnings.push({ section, name, detail });
  console.log(`  PERINGATAN ${name} ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
}
async function run(name, fn) {
  section = name;
  console.log(`\n■ ${name}`);
  try {
    await fn();
  } catch (e) {
    check(`bagian "${name}" selesai tanpa error`, false, e.message);
  }
}

const slug = (s) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "beranda";
const noHScroll = (page) => page.eval("Math.max(0, document.documentElement.scrollWidth - window.innerWidth)");

async function setAppearance(page, { mode = "light", accent = null, size = "md" }) {
  await page.goto(BASE + "/~offline"); // halaman ringan di origin yang sama
  await page.eval(`(() => {
    localStorage.setItem(${JSON.stringify(APP_ID + ":theme")}, ${JSON.stringify(mode)});
    ${accent ? `localStorage.setItem(${JSON.stringify(APP_ID + ":accent")}, ${JSON.stringify(JSON.stringify(accent))});` : `localStorage.removeItem(${JSON.stringify(APP_ID + ":accent")});`}
    localStorage.setItem(${JSON.stringify(APP_ID + ":font-size")}, ${JSON.stringify(JSON.stringify(size))});
    return true; })()`);
}

const errorPlaces = [];
async function visit(page, p, settle = 1200) {
  const before = page.errors.length;
  await page.goto(BASE + p);
  await sleep(settle); // Suspense / data client
  // catat di mana exception muncul (bagian + halaman) supaya mudah dilacak
  for (const e of page.errors.slice(before)) errorPlaces.push(`[${section}] ${p}: ${e.slice(0, 120)}`);
}

/** Lembar kontak: grid gambar + label, untuk ditinjau sekilas. */
async function contactSheet(file, items, { cols = 4, width = 420 } = {}) {
  const tiles = await Promise.all(
    items.map(async ({ img, label }) => {
      const resized = await sharp(img).resize({ width }).png().toBuffer();
      const meta = await sharp(resized).metadata();
      const svg = Buffer.from(
        `<svg width="${width}" height="22"><rect width="100%" height="100%" fill="#111"/><text x="6" y="15" font-family="Arial" font-size="12" fill="#fff">${label.replace(/[<&>]/g, "")}</text></svg>`,
      );
      return { buf: await sharp({ create: { width, height: meta.height + 22, channels: 3, background: "#fff" } }).composite([{ input: svg, top: 0, left: 0 }, { input: resized, top: 22, left: 0 }]).png().toBuffer(), h: meta.height + 22 };
    }),
  );
  const rows = Math.ceil(tiles.length / cols);
  const rowH = Array.from({ length: rows }, (_, r) => Math.max(...tiles.slice(r * cols, r * cols + cols).map((t) => t.h)));
  const comp = [];
  let top = 0;
  for (let r = 0; r < rows; r++) {
    tiles.slice(r * cols, r * cols + cols).forEach((t, c) => comp.push({ input: t.buf, top, left: c * (width + 6) }));
    top += rowH[r] + 6;
  }
  await sharp({ create: { width: cols * (width + 6), height: top, channels: 3, background: "#888" } }).composite(comp).png().toFile(file);
  return file;
}

const APP_PAGES = ["/", "/tugas", "/kejadian", "/kejadian/lapor", "/temuan", "/temuan/baru", "/inspeksi", "/inspeksi/template", "/observasi", "/observasi/baru", "/kpi", "/kpi/jam-kerja", "/tsp", "/master", "/notifikasi", "/pengajuan", "/pengajuan/baru", "__DETAIL__", "/pengguna", "/approval/template", "/approval/kepala-departemen", "/bantuan", "/bantuan/kelola", "/feedback", "/feedback/kelola", "/pembaruan", "/pembaruan/baru", "/dokumentasi", "/tentang", "/profil"];

const chrome = await launch();
const page = await chrome.newPage();
let detailPath = null;
let gmiDetail = null;
// isi kolom "Perusahaan" di tabel list (bukan seluruh baris: nama pemohon bisa memuat kode company)
const COMPANY_CELLS = `(() => { const i = [...document.querySelectorAll('thead th')].findIndex(th => th.innerText.trim() === "Perusahaan"); return i < 0 ? [] : [...document.querySelectorAll('tbody tr')].map(r => r.children[i]?.innerText.trim()).filter(Boolean); })()`;

try {
  // ------------------------------------------------------------------ peran & company
  await run("Peran & company", async () => {
    await loginPage(page, BASE, USER("admin"));
    await visit(page, "/pengajuan");
    detailPath = await page.eval(`(document.querySelector('tbody a[href^="/pengajuan/"]:not([href="/pengajuan/baru"])') || {}).getAttribute?.("href") || null`);
    await visit(page, "/pengajuan?perusahaan=GMI");
    gmiDetail = await page.eval(`(document.querySelector('tbody a[href^="/pengajuan/"]:not([href="/pengajuan/baru"])') || {}).getAttribute?.("href") || null`);
    check("ada dokumen contoh untuk diuji (detail)", !!detailPath, detailPath);
    check("admin: menu Admin terlihat", (await page.text()).includes("Pengguna & Peran"));

    await loginPage(page, BASE, USER("viewer"));
    await visit(page, "/pengajuan");
    const vt = await page.text();
    check("viewer: tombol Buat Pengajuan tidak tampil", !vt.includes("Buat Pengajuan"));
    check("viewer: menu Admin tidak tampil", !vt.includes("Pengguna & Peran"));
    await visit(page, "/pengguna", 2500);
    check("viewer: /pengguna ditolak (dikembalikan ke beranda)", (await page.eval("location.pathname")) === "/" && !(await page.text()).includes("Tambah Akses"), await page.eval("location.href"));

    await loginPage(page, BASE, USER("budi"));
    await visit(page, "/pengajuan");
    const bt = await page.text();
    check("editor: tombol Buat Pengajuan tampil", bt.includes("Buat Pengajuan"));
    check("editor: menu Admin tidak tampil", !bt.includes("Pengguna & Peran"));
    const budiCo = await page.eval(COMPANY_CELLS);
    check("company GMI: list hanya GMI + grup (tanpa GIS)", budiCo.length > 0 && !budiCo.includes("GIS"), [...new Set(budiCo)]);

    await loginPage(page, BASE, USER("sari"));
    await visit(page, "/pengajuan");
    const sariCo = await page.eval(COMPANY_CELLS);
    check("company GIS: list hanya GIS + grup (tanpa GMI)", sariCo.length > 0 && !sariCo.includes("GMI"), [...new Set(sariCo)]);
    if (gmiDetail) {
      await visit(page, gmiDetail);
      check("company GIS: detail dokumen GMI = tidak ditemukan", /tidak ditemukan/i.test(await page.text()), gmiDetail);
    }
  });

  // ------------------------------------------------------------------ semua halaman: responsif & error
  await loginPage(page, BASE, USER("admin"));
  const pages = APP_PAGES.map((p) => (p === "__DETAIL__" ? detailPath : p)).filter(Boolean);
  const mobileShots = [];
  for (const [w, label] of [
    [390, "HP 390"],
    [768, "tablet 768"],
    [1280, "desktop 1280"],
  ]) {
    await run(`Responsif ${label}`, async () => {
      await setAppearance(page, { mode: "light" });
      await page.viewport(w, w === 390 ? 844 : 900, { mobile: w === 390, touch: w === 390 });
      const over = [];
      for (const p of pages) {
        await visit(page, p);
        const x = await noHScroll(page);
        if (x > 1) over.push(`${p} (+${x}px)`);
        if (w === 390) mobileShots.push({ img: await page.screenshot(path.join(OUT, "390", slug(p) + ".png")), label: p });
      }
      check(`tanpa scroll horizontal di ${pages.length} halaman`, over.length === 0, over);
    });
  }
  if (mobileShots.length) await contactSheet(path.join(OUT, "lembar-390.png"), mobileShots, { cols: 6, width: 260 });

  // ------------------------------------------------------------------ fondasi K3 (rancangan §4.0)
  await run("Fondasi K3: fungsi, site, Tugas Saya, Master", async () => {
    await page.viewport(1280, 900);
    await setAppearance(page, { mode: "light" });
    await loginPage(page, BASE, USER("karyawan"));
    await visit(page, "/");
    const kt = await page.text();
    check("karyawan: menu Tugas Saya tampil", kt.includes("Tugas Saya"));
    check("karyawan: menu Admin tidak tampil", !kt.includes("Master Data") && !kt.includes("Pengguna & Peran"));
    check("karyawan (dibatasi 1 site): label Site MIFA", kt.includes("Site MIFA"));
    const accent = await page.eval("document.documentElement.className");
    check("aksen default app = GMI K3", accent.includes("theme-gmi-k3"), accent);
    await visit(page, "/approval", 2000);
    check("/approval dialihkan ke /tugas", (await page.eval("location.pathname")) === "/tugas", await page.eval("location.href"));

    await loginPage(page, BASE, USER("hse"));
    await visit(page, "/");
    const ht = await page.text();
    check("hse: pemilih site default = site profil", ht.includes("Site MIFA"));

    await loginPage(page, BASE, USER("admin"));
    await visit(page, "/master");
    const mt = await page.text();
    check("master: area per site tampil", mt.includes("Workshop Service") && mt.includes("Site MIFA"));
    await visit(page, "/master?jenis=tingkat-risiko");
    check("master: tingkat risiko dari seed", (await page.text()).includes("Kritis"));
    await visit(page, "/master?jenis=site");
    check("master: site baca saja (tanpa tombol Tambah)", !(await page.text()).includes("Tambah"));
    await visit(page, "/pengguna?fungsi=hse_senior");
    const pt = await page.text();
    check("pengguna: filter fungsi K3", pt.includes("Yusuf Ramadhan") && !pt.includes("Rudi Hartono"));

    // top bar HP: pemilih site, tombol cari, dan aksi tidak saling tumpuk (scroll horizontal tidak menangkapnya)
    for (const w of [360, 390]) {
      await page.viewport(w, 844, { mobile: true, touch: true });
      await visit(page, "/");
      const overlap = await page.eval(`(() => {
        const bar = document.querySelector('[data-app-topbar] > div');
        const els = [...bar.querySelectorAll('button, a')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; });
        const hits = [];
        for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
          if (els[i].contains(els[j]) || els[j].contains(els[i])) continue;
          const a = els[i].getBoundingClientRect(), b = els[j].getBoundingClientRect();
          const x = Math.min(a.right, b.right) - Math.max(a.left, b.left), y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (x > 1 && y > 1) hits.push((els[i].getAttribute('aria-label') || els[i].innerText || els[i].tagName).trim().slice(0, 30) + ' × ' + (els[j].getAttribute('aria-label') || els[j].innerText || els[j].tagName).trim().slice(0, 30));
        }
        return hits; })()`);
      check(`top bar @${w}: kontrol tidak bertumpuk`, overlap.length === 0, overlap);
    }
    // < sm: Bantuan & Tampilan ada di menu profil, nama site terbaca (bukan hanya "K…")
    const siteW = await page.eval(`Math.round(document.querySelector('[data-app-topbar] [aria-label^="Site:"] .truncate')?.getBoundingClientRect().width ?? 0)`);
    check("top bar @390: label site cukup lebar (≥ 60 px)", siteW >= 60, siteW);
    const mp = await page.eval(`(() => { const r = document.querySelector('[aria-label="Menu profil"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
    for (const type of ["mousePressed", "mouseReleased"]) await page.send("Input.dispatchMouseEvent", { type, x: mp.x, y: mp.y, button: "left", clickCount: 1 });
    await sleep(400);
    const menu = await page.eval(`[...document.querySelectorAll('[role="menuitem"]')].map(e => e.innerText.trim())`);
    check("menu profil HP: Bantuan Admin & Tampilan", menu.some((t) => t.startsWith("Bantuan Admin")) && menu.includes("Tampilan"), menu);
    await page.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await page.viewport(1280, 900);
  });

  // ------------------------------------------------------------------ 4 mode × 3 aksen
  // ------------------------------------------------------------------ fase 1: Kejadian & Temuan
  await run("Fase 1: Kejadian & Temuan", async () => {
    await page.viewport(1280, 900);
    await setAppearance(page, { mode: "light" });
    const firstLink = (list) => page.eval(`(document.querySelector('tbody a[href^="${list}/"]') || {}).getAttribute?.("href") || ""`);
    const find = async (list, q) => {
      await visit(page, `${list}?q=${encodeURIComponent(q)}`, 1800);
      return firstLink(list);
    };

    await loginPage(page, BASE, USER("hse"));
    await visit(page, "/kejadian", 1800);
    const kt = await page.text();
    check("kejadian: daftar memuat nomor KJD- dan tab Perlu Klasifikasi", kt.includes("KJD-") && kt.includes("Perlu Klasifikasi"), kt.slice(0, 120));
    const kjd = await find("/kejadian", "jari terjepit");
    check("kejadian: kejadian contoh ditemukan (cari)", !!kjd, kjd);
    if (kjd) {
      await visit(page, `${kjd}?tab=klasifikasi`, 1800);
      const ct = await page.text();
      check("kejadian HSE: data cedera terbaca", ct.includes("Memar dan luka ringan") && ct.includes("Rp 2.750.000"), ct.slice(0, 120));
      await visit(page, `${kjd}?tab=tindakan`, 1800);
      check("kejadian: tab Tindakan memuat kartu tindakan PCA-", (await page.text()).includes("PCA-"));
      check("kejadian: halaman detail ber-NoOffline untuk HSE (data cedera)", await page.eval(`!!document.querySelector('meta[name="x-no-offline"]')`));

      await loginPage(page, BASE, USER("karyawan"));
      await visit(page, `${kjd}?tab=klasifikasi`, 1800);
      const kr = await page.text();
      check("kejadian karyawan: data cedera & biaya terbatas", kr.includes("Hanya HSE dan HR") && !kr.includes("Memar") && !kr.includes("2.750.000"), kr.slice(0, 120));

      await loginPage(page, BASE, USER("pjo"));
      await visit(page, `${kjd}?tab=klasifikasi`, 1800);
      const pr = await page.text();
      check("kejadian PJO: biaya terbaca, cedera tetap terbatas", pr.includes("Rp 2.750.000") && pr.includes("Hanya HSE dan HR") && !pr.includes("Memar"), pr.slice(0, 120));
      await loginPage(page, BASE, USER("hr"));
      await visit(page, `${kjd}?tab=klasifikasi`, 1800);
      const hr = await page.text();
      check("kejadian HR: cedera terbaca, biaya terbatas", hr.includes("Memar") && !hr.includes("2.750.000"), hr.slice(0, 120));
    }

    await loginPage(page, BASE, USER("hse"));
    await visit(page, "/temuan", 1800);
    const tt = await page.text();
    check("temuan: strip angka, widget, dan daftar", tt.includes("Overdue per PIC") && tt.includes("Temuan per Sumber") && tt.includes("TMN-"), tt.slice(0, 120));
    await visit(page, "/temuan?mode=kanban", 1800);
    check("temuan: kanban memuat kolom status", (await page.text()).includes("Menunggu Verifikasi") && (await noHScroll(page)) <= 1);
    const tmn = await find("/temuan", "Padlock");
    if (tmn) {
      await visit(page, tmn, 1800);
      const dt = await page.text();
      check("temuan: detail memuat rencana tindakan & sumber", dt.includes("Rencana Tindakan") && dt.includes("INS-2026-0230"), dt.slice(0, 120));
      await loginPage(page, BASE, USER("pengawas"));
      await visit(page, tmn, 1800);
      check("temuan: PIC melihat tombol Unggah Bukti", (await page.text()).includes("Unggah Bukti"));
    } else check("temuan: temuan contoh ditemukan", false, tmn);

    await loginPage(page, BASE, USER("auditor"));
    await visit(page, "/kejadian/lapor", 2500);
    check("auditor: /kejadian/lapor dialihkan ke daftar", (await page.eval("location.pathname")) === "/kejadian", await page.eval("location.href"));
    check("auditor: menu Lapor Kejadian tidak tampil", !(await page.text()).includes("Lapor Kejadian"));

    // wizard lapor di HP: validasi langkah 1 (klik asli)
    await loginPage(page, BASE, USER("karyawan"));
    await page.viewport(390, 844, { mobile: true, touch: true });
    await visit(page, "/kejadian/lapor", 1500);
    const btn = await page.eval(`(() => { const b = [...document.querySelectorAll('button')].find(x => x.innerText.trim().startsWith('Lanjutkan')); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
    if (btn) for (const type of ["mousePressed", "mouseReleased"]) await page.send("Input.dispatchMouseEvent", { type, x: btn.x, y: btn.y, button: "left", clickCount: 1 });
    await sleep(500);
    const wt = await page.text();
    check("wizard lapor: validasi langkah 1 (lokasi & kategori wajib)", wt.includes("Lokasi kejadian wajib dipilih") && wt.includes("Kategori kejadian wajib dipilih"), wt.slice(0, 160));
    check("wizard lapor @390: tanpa scroll horizontal", (await noHScroll(page)) <= 1);
    await page.screenshot(path.join(OUT, "lapor-390.png"));
    await page.viewport(1280, 900);
    // bagian berikutnya (Tema, Cetak, ...) mengandalkan sesi admin
    await loginPage(page, BASE, USER("admin"));
  });

  // ------------------------------------------------------------------ fase 2: Inspeksi, Observasi, KPI, Beranda
  await run("Fase 2: Inspeksi, KPI & Beranda", async () => {
    await page.viewport(1280, 900);
    await setAppearance(page, { mode: "light" });
    // Klik asli di tengah elemen; tunggu (maks. 6 dtk) sampai elemen itu yang paling atas di titiknya
    // (toast di kanan bawah bisa menutupi tombol bar kirim beberapa detik).
    const clickEl = async (expr) => {
      for (let i = 0; i < 20; i++) {
        const pt = await page.eval(`(() => { const el = ${expr}; if (!el) return null; el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect(); const x = r.x + r.width / 2, y = r.y + r.height / 2; const top = document.elementFromPoint(x, y); return { x, y, ok: !!top && (el === top || el.contains(top)) }; })()`);
        if (!pt) return false;
        if (pt.ok || i === 19) {
          for (const type of ["mousePressed", "mouseReleased"]) await page.send("Input.dispatchMouseEvent", { type, x: pt.x, y: pt.y, button: "left", clickCount: 1 });
          return true;
        }
        await sleep(300);
      }
      return false;
    };
    const btnByText = (t, exact = true) => `[...document.querySelectorAll('button')].find(b => ${exact ? `b.innerText.trim() === ${JSON.stringify(t)}` : `b.innerText.trim().includes(${JSON.stringify(t)})`} && !b.disabled)`;

    // ---- Beranda
    await loginPage(page, BASE, USER("hse"));
    await visit(page, "/", 2500);
    const ht = await page.text();
    check("beranda HSE: kinerja keselamatan, leading indicator, status PICA", ht.includes("Kinerja Keselamatan") && ht.includes("Leading Indicator") && ht.includes("Status PICA") && ht.includes("Umur Temuan"), ht.slice(0, 120));
    check("beranda: KPI draf berbadge 'Rumus belum disahkan' (dari data Kamus KPI)", ht.includes("Rumus belum disahkan"));
    check("beranda: LTIFR bulan ini tanpa jam kerja = 'Belum tersedia' (bukan 0)", ht.includes("Belum tersedia"));
    await loginPage(page, BASE, USER("karyawan"));
    await visit(page, "/", 2000);
    const kt = await page.text();
    check("beranda karyawan: tombol Lapor besar, tanpa blok KPI", kt.includes("Lapor Kejadian") && kt.includes("Observasi KTA/TTA") && !kt.includes("Kinerja Keselamatan"), kt.slice(0, 120));

    // ---- Kamus KPI & jam kerja
    await loginPage(page, BASE, USER("hse"));
    await visit(page, "/kpi/ltifr", 1500);
    const kp = await page.text();
    check("kamus KPI: detail memuat definisi, rumus, metadata", kp.includes("Rumus") && kp.includes("LTI × 1.000.000") && kp.includes("Metadata"), kp.slice(0, 120));
    check("kamus KPI: HSE (bukan admin) tidak melihat tombol Sahkan", !kp.includes("Sahkan Rumus"));
    await visit(page, "/kpi/jam-kerja", 1500);
    check("jam kerja: grid memuat input untuk HSE", (await page.eval(`document.querySelectorAll('input[aria-label^="Jam kerja"]').length`)) > 0);
    await loginPage(page, BASE, USER("admin"));
    await visit(page, "/kpi/ltifr", 1500);
    check("kamus KPI: admin melihat tombol Sahkan Rumus", (await page.text()).includes("Sahkan Rumus"));

    // ---- Inspeksi: kalender, daftar, template
    await loginPage(page, BASE, USER("hse"));
    await visit(page, "/inspeksi", 2000);
    const it = await page.text();
    check("inspeksi: kalender + panel rencana vs aktual + tombol jadwal", it.includes("Rencana vs Aktual") && it.includes("Jadwalkan Inspeksi") && it.includes("Sen") && it.includes("Min"), it.slice(0, 120));
    await visit(page, "/inspeksi?tampilan=daftar", 1500);
    check("inspeksi: mode daftar memuat nomor INS-", (await page.text()).includes("INS-"));
    await visit(page, "/inspeksi/template", 1500);
    check("template inspeksi: daftar template HSE", (await page.text()).includes("Inspeksi Kotak P3K & APAR"));
    await loginPage(page, BASE, USER("karyawan"));
    await visit(page, "/inspeksi/template", 2500);
    check("template inspeksi: karyawan dialihkan", (await page.eval("location.pathname")) === "/inspeksi", await page.eval("location.href"));

    // ---- TSP & Aktivitas: matriks, aktivitas, evaluasi
    await loginPage(page, BASE, USER("hse"));
    await visit(page, "/tsp", 2500);
    const tsp = await page.text();
    check("tsp: matriks program, capaian, aktivitas, evaluasi", tsp.includes("Monitoring Matrix TSP") && tsp.includes("Komunikasi Kebijakan SMT") && tsp.includes("Aktivitas K3") && tsp.includes("Evaluasi Bulanan") && tsp.includes("Rumus belum disahkan"), tsp.slice(0, 160));
    check("tsp: HSE melihat Tambah Program + Catat Aktivitas", tsp.includes("Tambah Program") && tsp.includes("Catat Aktivitas"));
    check("tsp: sel matriks punya label aksesibel (aktual/rencana)", (await page.eval(`document.querySelectorAll('button[aria-label*="aktual"][aria-label*="rencana"]').length`)) > 20);
    await loginPage(page, BASE, USER("karyawan"));
    await visit(page, "/tsp", 2500);
    check("tsp: karyawan dialihkan ke Beranda", (await page.eval("location.pathname")) === "/", await page.eval("location.href"));

    // ---- Alur nyata: jadwal (RPC, HSE) → pemeriksa (UI) isi & kirim → HSE verifikasi (UI)
    const hseDb = await asUser(USER("hse"), APP_ID);
    const { data: tpl } = await hseDb.from("inspection_templates").select("id").eq("name", "Inspeksi Padlock").maybeSingle();
    const { data: site } = await hseDb.schema("public").from("locations").select("id").eq("name", "Site MIFA").maybeSingle();
    const { data: area } = await hseDb.from("areas").select("id").eq("location_id", site?.id).eq("name", "Workshop Service").maybeSingle();
    const { data: me } = await hseDb.schema("public").from("profiles").select("id").eq("email", USER("pengawas")).maybeSingle();
    const { data: sched, error: schedErr } = await hseDb.rpc("inspection_schedule", {
      p: { template_id: tpl?.id, location_id: site?.id, area_id: area?.id, planned_at: new Date(Date.now() + 86_400_000).toISOString(), inspector_id: me?.id, object_text: "QA Toolkit" },
    });
    check("inspeksi QA: jadwal dibuat lewat RPC", !!sched?.id && !schedErr, schedErr?.message);
    if (sched?.id) {
      const path = `/inspeksi/${sched.id}`;
      await loginPage(page, BASE, USER("pengawas"));
      await visit(page, path, 1800);
      check("inspeksi QA: pemeriksa melihat tombol Mulai Inspeksi", (await page.text()).includes("Mulai Inspeksi"));
      await clickEl(btnByText("Mulai Inspeksi", false));
      const started = await page.waitText("Progres checklist", 8000);
      // toast "Inspeksi dimulai." menutupi bar kirim beberapa detik: tunggu hilang sebelum mengeklik
      for (let i = 0; i < 30 && (await page.eval(`!!document.querySelector('[data-sonner-toast]')`)); i++) await sleep(300);
      check("inspeksi QA: mulai → checklist 6 butir tampil", started && (await page.eval(`document.querySelectorAll('[role="radiogroup"]').length`)) === 6);
      const submitBtn = btnByText("Selesai & Kirim", false);
      check("inspeksi QA: kirim dinonaktifkan sebelum semua butir dijawab", await page.eval(`!!(() => { const b = [...document.querySelectorAll('button')].find(x => x.innerText.includes('Selesai & Kirim')); return b && b.disabled; })()`));
      for (let i = 0; i < 6; i++) await clickEl(`[...document.querySelectorAll('[role="radio"]')].filter(b => b.innerText.trim() === "Sesuai")[${i}]`);
      await sleep(400);
      await clickEl(submitBtn);
      await sleep(500);
      await clickEl(btnByText("Kirim Inspeksi"));
      const sent = await page.waitText("Inspeksi berhasil dikirim", 10000);
      check("inspeksi QA: pemeriksa mengirim → layar sukses", sent);

      await loginPage(page, BASE, USER("hse"));
      await visit(page, path, 1800);
      const dt = await page.text();
      check("inspeksi QA: HSE melihat hasil & tombol Verifikasi", dt.includes("Menunggu Verifikasi") && dt.includes("Hasil Checklist"), dt.slice(0, 120));
      await clickEl(btnByText("Verifikasi"));
      await sleep(500);
      await clickEl(`[...document.querySelectorAll('[role="alertdialog"] button')].find(b => b.innerText.trim() === "Verifikasi")`);
      await sleep(1800);
      await visit(page, path, 1500);
      check("inspeksi QA: HSE memverifikasi → Terverifikasi", (await page.text()).includes("Terverifikasi"));
    }

    // ---- Observasi
    await loginPage(page, BASE, USER("karyawan"));
    await page.viewport(390, 844, { mobile: true, touch: true });
    await visit(page, "/observasi/baru", 1500);
    const ot = await page.text();
    check("observasi: form cepat KTA/TTA tampil di HP, tanpa scroll horizontal", ot.includes("KTA") && ot.includes("TTA") && ot.includes("Perlu tindak lanjut?") && (await noHScroll(page)) <= 1, ot.slice(0, 120));
    await page.screenshot(path.join(OUT, "observasi-390.png"));
    await page.viewport(1280, 900);
    await visit(page, "/observasi", 1500);
    check("observasi: daftar memuat OBS-", (await page.text()).includes("OBS-"));
    await loginPage(page, BASE, USER("admin"));
  });

  await run("Tema: 4 mode × 3 aksen", async () => {
    await page.viewport(1280, 900);
    const shots = [];
    const bgs = new Set();
    for (const mode of ["light", "soft-light", "dark", "soft-dark"]) {
      for (const accent of [null, "zinc", "blue"]) {
        await setAppearance(page, { mode, accent });
        await visit(page, detailPath || "/pengajuan", 1500);
        const st = await page.eval(`(() => { const d = document.documentElement; return { cls: d.className, bg: getComputedStyle(document.body).backgroundColor, primary: getComputedStyle(d).getPropertyValue("--primary").trim() }; })()`);
        bgs.add(st.bg);
        check(`${mode} × ${accent ?? "default"}: kelas tema terpasang`, st.cls.includes(mode) || (mode === "light" && !/dark|soft/.test(st.cls)), st.cls);
        shots.push({ img: await page.screenshot(path.join(OUT, "tema", `${mode}-${accent ?? "default"}.png`)), label: `${mode} · ${accent ?? "default"}` });
      }
    }
    check("4 mode menghasilkan 4 warna latar berbeda", bgs.size === 4, [...bgs]);
    await contactSheet(path.join(OUT, "lembar-tema.png"), shots, { cols: 3, width: 520 });
  });

  // ------------------------------------------------------------------ font Sangat Besar, sidebar ikon, sentuh, reduced motion
  await run("Font Sangat Besar (390 & desktop)", async () => {
    await setAppearance(page, { mode: "light", size: "xl" });
    const shots = [];
    for (const w of [390, 1280]) {
      await page.viewport(w, w === 390 ? 844 : 900, { mobile: w === 390, touch: w === 390 });
      const over = [];
      for (const p of ["/", "/pengajuan", "/pengajuan/baru", detailPath, "/profil", "/dokumentasi"].filter(Boolean)) {
        await visit(page, p);
        const x = await noHScroll(page);
        if (x > 1) over.push(`${p} (+${x}px)`);
        if (w === 390) shots.push({ img: await page.screenshot(path.join(OUT, "font-xl", slug(p) + ".png")), label: p });
      }
      check(`font xl @${w}: tanpa scroll horizontal`, over.length === 0, over);
    }
    check("font xl: ukuran root 125%", (await page.eval("getComputedStyle(document.documentElement).fontSize")) === "20px", await page.eval("getComputedStyle(document.documentElement).fontSize"));
    await contactSheet(path.join(OUT, "lembar-font-xl.png"), shots, { cols: 6, width: 260 });
  });

  await run("Sidebar mode ikon", async () => {
    await setAppearance(page, { mode: "light" });
    await page.viewport(1280, 900);
    await page.send("Network.setCookie", { name: "sidebar_state", value: "false", url: BASE, path: "/" });
    await visit(page, "/pengajuan");
    const st = await page.eval(`(() => { const s = document.querySelector('[data-slot="sidebar"]'); return { state: s?.getAttribute("data-state"), w: Math.round(document.querySelector('[data-slot="sidebar-gap"]')?.getBoundingClientRect().width ?? -1) }; })()`);
    check("sidebar tertutup ke mode ikon", st.state === "collapsed" && st.w > 0 && st.w < 80, st);
    check("tanpa scroll horizontal", (await noHScroll(page)) <= 1);
    // header tabel tetap sejajar dengan kolom saat sidebar ikon
    const align = await page.eval(`(() => { const th = document.querySelector('thead th:nth-child(2)'); const td = document.querySelector('tbody tr td:nth-child(2)'); return th && td ? Math.abs(th.getBoundingClientRect().left - td.getBoundingClientRect().left) : -1; })()`);
    check("header tabel sejajar kolom", align >= 0 && align <= 1, align);
    await page.screenshot(path.join(OUT, "sidebar-ikon.png"));
    await page.send("Network.setCookie", { name: "sidebar_state", value: "true", url: BASE, path: "/" });
  });

  await run("Layar sentuh", async () => {
    await page.viewport(390, 844, { mobile: true, touch: true });
    await visit(page, "/profil");
    check("media (pointer: coarse) aktif", await page.eval("matchMedia('(pointer: coarse)').matches"));
    const badge = await page.eval(`(() => { const b = [...document.querySelectorAll('span')].find(s => s.className.includes('pointer-coarse:flex')); return b ? getComputedStyle(b).display : 'tidak ada'; })()`);
    check("badge kamera foto profil selalu tampil di layar sentuh", badge === "flex", badge);
    await page.screenshot(path.join(OUT, "sentuh-profil.png"));
  });

  await run("prefers-reduced-motion", async () => {
    await page.viewport(1280, 900);
    await page.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await visit(page, "/dokumentasi");
    const anim = await page.eval(`(() => { const r = document.querySelector('.docs-ring'); const f = document.querySelector('.docs-fade-up'); return { ring: r ? getComputedStyle(r).animationName : null, fade: f ? getComputedStyle(f).animationDuration : null }; })()`);
    check("animasi berulang dimatikan (docs-ring)", anim.ring === "none", anim);
    check("animasi masuk dipersingkat (docs-fade-up)", anim.fade === "1e-05s" || anim.fade === "0.00001s" || anim.fade === "0s", anim);
    await page.send("Emulation.setEmulatedMedia", { features: [] });
  });

  await run("Cetak", async () => {
    if (!detailPath) return check("ada dokumen untuk dicetak", false);
    await page.viewport(1280, 900);
    await visit(page, detailPath);
    await page.send("Emulation.setEmulatedMedia", { media: "print" });
    const st = await page.eval(`(() => ({ topbar: getComputedStyle(document.querySelector('[data-app-topbar]')).display, doc: getComputedStyle(document.querySelector('.printable-document.print-only')).display }))()`);
    check("no-print tersembunyi & dokumen cetak tampil", st.topbar === "none" && st.doc !== "none", st);
    await page.send("Emulation.setEmulatedMedia", { media: "" });
  });

  // ------------------------------------------------------------------ halaman auth (tanpa login)
  await run("Halaman auth", async () => {
    await page.send("Network.clearBrowserCookies");
    for (const w of [390, 1280]) {
      await page.viewport(w, w === 390 ? 844 : 900, { mobile: w === 390, touch: w === 390 });
      await visit(page, "/auth/login");
      check(`login @${w}: tanpa scroll horizontal`, (await noHScroll(page)) <= 1);
      await page.screenshot(path.join(OUT, `login-${w}.png`));
    }
  });

  // ------------------------------------------------------------------ performa (perkiraan; bukan Lighthouse)
  if (!ARGS.has("--tanpa-perf"))
    await run("Performa HP (CPU 4×, jaringan lambat)", async () => {
      await loginPage(page, BASE, USER("admin"));
      await page.viewport(390, 844, { mobile: true, touch: true });
      await page.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await page.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
      await page.send("Page.addScriptToEvaluateOnNewDocument", {
        source: `window.__qa={lcp:0,cls:0,inp:0};
          new PerformanceObserver(l=>{for(const e of l.getEntries())__qa.lcp=e.startTime}).observe({type:"largest-contentful-paint",buffered:true});
          new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)__qa.cls+=e.value}).observe({type:"layout-shift",buffered:true});
          new PerformanceObserver(l=>{for(const e of l.getEntries())__qa.inp=Math.max(__qa.inp,e.duration)}).observe({type:"event",buffered:true,durationThreshold:16});`,
      });
      const rows = [];
      for (const p of ["/auth/login", "/", "/pengajuan"]) {
        if (p === "/auth/login") await page.send("Network.clearBrowserCookies");
        else if (rows.length === 1) await loginPage(page, BASE, USER("admin"));
        await page.goto(BASE + p, 120000);
        await sleep(4000);
        // LCP & CLS dibaca SEBELUM interaksi (klik bisa memunculkan elemen besar baru)
        const before = await page.eval("({ lcp: window.__qa.lcp, cls: window.__qa.cls })");
        // INP perkiraan: satu klik ASLI (Input.dispatchMouseEvent) pada tombol toggle sidebar / tema
        const pt = await page.eval(`(() => { const b = document.querySelector('[data-sidebar="trigger"]') || [...document.querySelectorAll('button')].find(x => x.offsetParent && !x.disabled); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
        if (pt) {
          for (const type of ["mousePressed", "mouseReleased"]) await page.send("Input.dispatchMouseEvent", { type, x: pt.x, y: pt.y, button: "left", clickCount: 1 });
          await sleep(1500);
        }
        const inp = await page.eval("window.__qa.inp");
        rows.push({ halaman: p, lcp_ms: Math.round(before.lcp), cls: Number(before.cls.toFixed(3)), inp_ms: Math.round(inp) });
      }
      console.table(rows);
      fs.writeFileSync(path.join(OUT, "performa.json"), JSON.stringify(rows, null, 2));
      for (const r of rows) {
        check(`${r.halaman}: CLS < 0,1`, r.cls < 0.1, r.cls);
        check(`${r.halaman}: LCP < 4 s (simulasi HP lambat)`, r.lcp_ms < 4000, r.lcp_ms);
        // INP sintetis di bawah throttle CPU sangat bising di mesin bersama → peringatan, bukan gerbang
        warn(`${r.halaman}: INP perkiraan (buka menu) < 200 ms`, r.inp_ms < 200, `${r.inp_ms} ms`);
      }
      await page.send("Emulation.setCPUThrottlingRate", { rate: 1 });
      await page.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    });

  // ------------------------------------------------------------------ offline & PWA (build produksi)
  if (!ARGS.has("--tanpa-offline"))
    await run("Offline & PWA (butuh build produksi)", async () => {
      const off = await chrome.newPage();
      await loginPage(off, BASE, USER("admin"));
      await off.goto(BASE + "/pengajuan");
      await off.eval("navigator.serviceWorker.ready.then(() => true)", 30000);
      for (let i = 0; i < 40 && !(await off.eval(`caches.open("sw-meta").then(c => c.match("/__sw-user")).then(r => !!r)`)); i++) await sleep(250);
      await off.goto(BASE + "/pengajuan");
      await off.goto(BASE + "/pengguna");
      await sleep(1500);
      const errs = (await off.send("Page.getInstallabilityErrors")).installabilityErrors;
      check("installable", errs.length === 0, errs);
      await chrome.setOffline(off, true);
      await off.goto(BASE + "/pengajuan");
      check("offline: halaman pernah dibuka tampil + banner", await off.waitText("menampilkan data per", 10000));
      await off.goto(BASE + "/pengguna");
      check("offline: halaman x-no-offline → fallback", await off.waitText("belum pernah dibuka", 5000));
      await chrome.setOffline(off, false);
      check("online lagi: fallback muat ulang sendiri", await off.waitText("Pengguna & Peran", 30000));
      check("tidak ada exception JavaScript (tab offline)", off.errors.length === 0, off.errors.slice(0, 3));
    });

  section = "Umum";
  check("tidak ada exception JavaScript di seluruh QA", page.errors.length === 0, errorPlaces.length ? errorPlaces.slice(0, 5) : [...new Set(page.errors)].slice(0, 5));
} finally {
  await chrome.close();
}

const failed = results.filter((r) => !r.ok);
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ base: BASE, at: new Date().toISOString(), total: results.length, failed: failed.length, results, warnings }, null, 2));
console.log(`\n${results.length - failed.length}/${results.length} cek lulus, ${warnings.length} peringatan. Laporan & gambar: ${path.relative(ROOT, OUT)}`);
warnings.forEach((w) => console.log(`  ! [${w.section}] ${w.name}: ${typeof w.detail === "string" ? w.detail : JSON.stringify(w.detail)}`));
if (failed.length) {
  console.log("Gagal:");
  failed.forEach((f) => console.log(`  - [${f.section}] ${f.name}`));
  process.exitCode = 1;
}
