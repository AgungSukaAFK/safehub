#!/usr/bin/env node
// Buat ikon PWA dari public/icon.svg (frontend-guide Lampiran B): icons/icon-192.png, icon-512.png,
// icon-maskable-512.png (ikon di zona aman 80% + latar penuh), apple-touch-icon 180. App nyata cukup
// mengganti public/icon.svg lalu menjalankan `npm run icons`.
// Opsi --slides: kompres ulang slide auth yang > 200 KB (WebP q70, lebar maks 1920).
import { readFile, stat, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const pub = path.join(root, "public");
const svg = await readFile(path.join(pub, "icon.svg"));
await mkdir(path.join(pub, "icons"), { recursive: true });

// warna latar maskable = warna isi rect pertama di SVG (fallback gelap)
const bg = (svg.toString().match(/<rect[^>]*fill="(#[0-9a-fA-F]{3,8})"/) || [])[1] || "#18181b";

const out = async (name, buf) => {
  await writeFile(path.join(pub, "icons", name), buf);
  console.log(`icons/${name}  ${(buf.length / 1024).toFixed(1)} KB`);
};

for (const size of [192, 512]) await out(`icon-${size}.png`, await sharp(svg, { density: 384 }).resize(size, size).png().toBuffer());
await out("apple-touch-icon.png", await sharp(svg, { density: 384 }).resize(180, 180).flatten({ background: bg }).png().toBuffer());

// maskable: ikon diperkecil ke 80% di atas latar penuh supaya tidak terpotong bentuk masker launcher
const inner = await sharp(svg, { density: 384 }).resize(410, 410).png().toBuffer();
await out(
  "icon-maskable-512.png",
  await sharp({ create: { width: 512, height: 512, channels: 4, background: bg } }).composite([{ input: inner, gravity: "center" }]).png().toBuffer(),
);

if (process.argv.includes("--slides")) {
  for (const f of ["slide.webp", "slide2.webp", "slide3.webp", "slide4.webp", "slide5.webp", "slide6.webp"]) {
    const p = path.join(pub, f);
    const before = (await stat(p)).size;
    if (before <= 200 * 1024) continue;
    const buf = await sharp(await readFile(p)).resize({ width: 1920, withoutEnlargement: true }).webp({ quality: 70 }).toBuffer();
    if (buf.length < before) {
      await writeFile(p, buf);
      console.log(`${f}  ${(before / 1024).toFixed(0)} KB → ${(buf.length / 1024).toFixed(0)} KB`);
    }
  }
}
