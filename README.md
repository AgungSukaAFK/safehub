# Safe Hub

Starter untuk semua app Lourdes: Next.js 16 + Supabase (RLS, tanpa secret key), shell sidebar + top bar,
kit list/form/detail, approval engine, notifikasi + Web Push, Bantuan Admin, Feedback, Pembaruan,
Dokumentasi, dan PWA offline. Contoh dokumen lengkap: **Pengajuan** (hapus saat app punya dokumen asli).

- Aturan & arsitektur (wajib dibaca sebelum menulis kode): [CLAUDE.md](CLAUDE.md)
- SQL & cara pasang database: [db/README.md](db/README.md)
- Panduan awal (sejarah keputusan; kode di repo ini yang menjadi acuan): [frontend-guide.md](frontend-guide.md),
  [backend-guide.md](backend-guide.md)

## Membuat app baru

```bash
scripts/create-app.sh ga_web "GA Web"                 # → ../ga-web
scripts/create-app.sh ga_web "GA Web" --host ga --dir ~/project/ga --dengan-verifikasi
```

Skrip menyalin boilerplate, mengganti penanda `safehub` / `safehub` / `Safe Hub`,
membuat satu migration gabungan di `db/out/` (belum dijalankan), lalu `git init`. Langkah sesudahnya
ditampilkan di akhir skrip. Kalau penanda itu masih terlihat di app nyata, berarti belum diganti.

## Menjalankan (boilerplate ini atau app hasil salinan)

Butuh Node 22+, Docker, dan stack Supabase lokal `db-lourdes`.

```bash
npm ci
cp .env.example .env.local           # Supabase lokal + VAPID (npx web-push generate-vapid-keys)
npm run db:local -- apply            # stub platform + schema app + seed DEMO ke Supabase lokal
npm run dev                          # http://localhost:3000
```

User DEMO (password `Demo12345!`): `admin@`, `budi@` (editor GMI), `sari@` (editor GIS), `andi@`/`dewi@`
(kepala departemen), `rina@` (Finance), `viewer@`, `noaccess@`, `nonaktif@`, `it@` (admin platform), semuanya
`@demo.lourdes.test`. Rincian: [db/README.md](db/README.md).

## Perintah

| Perintah | Isi |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` / `typecheck` | Wajib lulus sebelum commit |
| `npm run db:test` | Semua SQL + uji keamanan & alur di Postgres sekali pakai (tidak menyentuh DB lokal) |
| `npm run db:local -- apply\|reset` | Pasang / pasang ulang ke Supabase lokal |
| `npm run db:types` | Generate `types/database.ts` dari DB lokal |
| `npm run icons` | Ikon PWA (192, 512, maskable, apple) dari `public/icon.svg` |
| `npm run qa` | QA di Chrome headless terhadap server yang sedang jalan (lihat di bawah) |

## QA otomatis

`scripts/qa/` mengendalikan Chrome sungguhan lewat DevTools Protocol (tanpa dependensi tambahan):

```bash
npm run build && npm start           # QA offline/PWA harus memakai build produksi
QA_BASE=http://localhost:3000 npm run qa
```

Memeriksa: 4 mode tema × 3 aksen, font Sangat Besar, 390/768/1280 px (tanpa scroll horizontal), sidebar
mode ikon, layar sentuh, reduced motion, role viewer/editor/admin, company berbeda, offline + draft +
installable, dan tidak ada exception JavaScript. Tangkapan layar di `scripts/qa/out/` (tidak di-commit).

## Struktur

```
app/(app)/        halaman setelah login (layout membaca akses SEKALI → AppProvider)
app/auth/         login, lupa/ganti password      app/~offline/   fallback service worker
components/       kit: list/, form/, detail/, shell/, topbar/, support/, dashboard/, docs/, pwa/, ui/ (shadcn base-nova)
lib/              loader per domain (server), aturan zod (client+server), util
db/               SQL template (placeholder __APP__/__HOST__/__NAME__) + uji
scripts/          create-app, db-*, icons, qa
```
