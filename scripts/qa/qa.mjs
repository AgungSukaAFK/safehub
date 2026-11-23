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
import { loginPage } from "./session.mjs";

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

const APP_PAGES = ["/", "/tugas", "/master", "/notifikasi", "/pengajuan", "/pengajuan/baru", "__DETAIL__", "/pengguna", "/approval/template", "/approval/kepala-departemen", "/bantuan", "/bantuan/kelola", "/feedback", "/feedback/kelola", "/pembaruan", "/pembaruan/baru", "/dokumentasi", "/tentang", "/profil"];

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
    detailPath = await page.eval(`(document.querySelector('tbody a[href^="/pengajuan/"]') || {}).getAttribute?.("href") || null`);
    await visit(page, "/pengajuan?perusahaan=GMI");
    gmiDetail = await page.eval(`(document.querySelector('tbody a[href^="/pengajuan/"]') || {}).getAttribute?.("href") || null`);
    check("ada dokumen contoh untuk diuji (detail)", !!detailPath, detailPath);
    check("admin: menu Admin terlihat", (await page.text()).includes("Pengguna & Akses"));

    await loginPage(page, BASE, USER("viewer"));
    await visit(page, "/pengajuan");
    const vt = await page.text();
    check("viewer: tombol Buat Pengajuan tidak tampil", !vt.includes("Buat Pengajuan"));
    check("viewer: menu Admin tidak tampil", !vt.includes("Pengguna & Akses"));
    await visit(page, "/pengguna", 2500);
    check("viewer: /pengguna ditolak (dikembalikan ke beranda)", (await page.eval("location.pathname")) === "/" && !(await page.text()).includes("Tambah Akses"), await page.eval("location.href"));

    await loginPage(page, BASE, USER("budi"));
    await visit(page, "/pengajuan");
    const bt = await page.text();
    check("editor: tombol Buat Pengajuan tampil", bt.includes("Buat Pengajuan"));
    check("editor: menu Admin tidak tampil", !bt.includes("Pengguna & Akses"));
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

  // ------------------------------------------------------------------ 4 mode × 3 aksen
  await run("Tema: 4 mode × 3 aksen", async () => {
    await page.viewport(1280, 900);
    const shots = [];
    const bgs = new Set();
    for (const mode of ["light", "soft-light", "dark", "soft-dark"]) {
      for (const accent of [null, "gmi", "blue"]) {
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
      check("online lagi: fallback muat ulang sendiri", await off.waitText("Pengguna & Akses", 30000));
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
