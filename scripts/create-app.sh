#!/usr/bin/env bash
# Buat app Lourdes baru dari boilerplate ini.
#
#   scripts/create-app.sh <app_id> "<Nama App>" [opsi]
#
#   <app_id>     nama schema Postgres & id di public.apps, mis. ga_web   (^[a-z][a-z0-9_]{1,40}$)
#   "<Nama>"     nama tampil, mis. "GA Web"
#   opsi:
#     --host <subdomain>      default: app_id dengan _ → -          (https://<host>.lourdes.cloud)
#     --short "<Nama pendek>" default: Nama dalam huruf besar (maks 12 huruf)
#     --desc "<Deskripsi>"    default: "<Nama>, app Lourdes."
#     --dir <folder>          default: ../<host>
#     --dengan-verifikasi     ikutkan 09_verify (verifikasi QR publik; membuka 1 fungsi untuk anon)
#
# Yang dilakukan:
#   1. menyalin semua file yang dilacak git (tanpa node_modules/.next/.git) ke <dir>;
#   2. mengganti penanda boilerplate (safehub / safehub / Safe Hub) di kode,
#      skrip, package.json, types; db/ tetap memakai placeholder __APP__/__HOST__/__NAME__;
#   3. membuat satu file migration gabungan di <dir>/db/out/ untuk lourdes-db (TIDAK dijalankan);
#   4. git init (tanpa commit) lalu menampilkan langkah berikutnya.
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
die() { echo "create-app: $*" >&2; exit 1; }

[ $# -ge 2 ] || die 'pakai: scripts/create-app.sh <app_id> "<Nama App>" [--host x] [--short x] [--desc x] [--dir x] [--dengan-verifikasi]'
APP="$1"; NAME="$2"; shift 2
HOST="${APP//_/-}"; SHORT=""; DESC=""; DIR=""; VERIFY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --host) HOST="${2:?}"; shift 2 ;;
    --short) SHORT="${2:?}"; shift 2 ;;
    --desc) DESC="${2:?}"; shift 2 ;;
    --dir) DIR="${2:?}"; shift 2 ;;
    --dengan-verifikasi) VERIFY=1; shift ;;
    *) die "opsi tidak dikenal: $1" ;;
  esac
done

[[ "$APP" =~ ^[a-z][a-z0-9_]{1,40}$ ]] || die "app_id tidak valid: $APP (huruf kecil, angka, _)"
[[ "$HOST" =~ ^[a-z][a-z0-9-]{1,40}$ ]] || die "host tidak valid: $HOST (huruf kecil, angka, -)"
[ "$APP" != "safehub" ] || die "app_id masih penanda boilerplate"
[ -n "$(printf '%s' "$NAME" | tr -d '[:space:]')" ] || die "nama app kosong"
case "$NAME$SHORT$DESC" in *'"'*|*'\'*) die 'nama/deskripsi tidak boleh berisi " atau \' ;; esac
[ -n "$SHORT" ] || SHORT="$(printf '%s' "$NAME" | tr '[:lower:]' '[:upper:]' | cut -c1-12)"
[ -n "$DESC" ] || DESC="$NAME, app Lourdes."
[ -n "$DIR" ] || DIR="$(dirname "$SRC")/$HOST"
[ ! -e "$DIR" ] || die "folder tujuan sudah ada: $DIR"

echo "→ app_id=$APP  host=$HOST  nama=\"$NAME\"  pendek=\"$SHORT\""
echo "→ tujuan: $DIR"

# ---------------------------------------------------------------- 1. salin
mkdir -p "$DIR"
( cd "$SRC" && git ls-files -z ) | while IFS= read -r -d '' f; do
  case "$f" in PLAN.md) continue ;; esac            # rencana pembangunan boilerplate, bukan milik app
  mkdir -p "$DIR/$(dirname "$f")"
  cp -p "$SRC/$f" "$DIR/$f"
done

# ---------------------------------------------------------------- 2. ganti penanda
# escape untuk sisi pengganti sed (& / \)
esc() { printf '%s' "$1" | sed -e 's/[&/\]/\\&/g'; }
E_NAME="$(esc "$NAME")"; E_SHORT="$(esc "$SHORT")"; E_DESC="$(esc "$DESC")"

cfg="$DIR/lib/app-config.ts"
sed -i \
  -e "s/^export const APP_ID = \".*\";/export const APP_ID = \"$APP\";/" \
  -e "s/^export const APP_HOST = \".*\";/export const APP_HOST = \"$HOST\";/" \
  -e "s/^export const APP_NAME = \".*\";/export const APP_NAME = \"$E_NAME\";/" \
  -e "s/^export const APP_SHORT_NAME = \".*\";/export const APP_SHORT_NAME = \"$E_SHORT\";/" \
  -e "s/^export const APP_DESCRIPTION = \".*\";/export const APP_DESCRIPTION = \"$E_DESC\";/" \
  "$cfg"

# sisa penanda di kode/skrip/tipe (db/ & guide sengaja tidak disentuh)
grep -rlI --exclude-dir=db --exclude-dir=node_modules -e safehub -e safehub -e "Safe Hub" "$DIR" \
  | grep -v -e "frontend-guide.md" -e "backend-guide.md" \
  | while IFS= read -r f; do
      sed -i -e "s/safehub/$APP/g" -e "s/safehub/$HOST/g" -e "s/Safe Hub/$E_NAME/g" "$f"
    done
sed -i "s/\"name\": \"lourdes-boilerplate\"/\"name\": \"$HOST\"/" "$DIR/package.json"

# CLAUDE.md & README: judul + catatan asal
TODAY="$(date +%Y-%m-%d)"
sed -i -e "1s/.*/# CLAUDE.md: $E_NAME ($APP)/" "$DIR/CLAUDE.md"
sed -i -e "s#Rencana \& progres: \[PLAN.md\](PLAN.md)\. #Dibuat dari lourdes-boilerplate pada $TODAY. #" "$DIR/CLAUDE.md"
sed -i -e "1s/.*/# $E_NAME/" "$DIR/README.md"

# ---------------------------------------------------------------- 3. migration gabungan
mkdir -p "$DIR/db/out"
MIG="$DIR/db/out/$(date +%Y%m%d%H%M%S)_${APP}_init.sql"
{
  echo "-- Migration awal $APP ($NAME), dibuat scripts/create-app.sh $TODAY dari lourdes-boilerplate."
  echo "-- Alur lourdes-db: salin ke supabase/migrations → dry-run → konfirmasi user → push."
  echo "-- Platform (public.companies, cctv_events) dipasang SEKALI untuk seluruh platform: db/platform/."
  "$DIR/scripts/db-build.sh" migration "$APP" "$HOST" "$NAME"
  if [ "$VERIFY" = 1 ]; then "$DIR/scripts/db-build.sh" verify "$APP" "$HOST" "$NAME"; fi
} > "$MIG"
grep -q "__APP__\|__HOST__\|__NAME__" "$MIG" && die "placeholder tersisa di migration: $MIG"

# ---------------------------------------------------------------- 4. git init + laporan
( cd "$DIR" && git init -q && git add -A >/dev/null )

LEFT="$(grep -rlI --exclude-dir=node_modules --exclude-dir=.git -e safehub -e safehub -e "Safe Hub" "$DIR" | grep -v -e "/db/" -e "guide.md" || true)"
if [ -n "$LEFT" ]; then
  echo "PERINGATAN: penanda boilerplate masih ada di:" >&2
  echo "$LEFT" >&2
fi

cat <<EOF

Selesai: $DIR
  migration : ${MIG#$DIR/}  (belum dijalankan$( [ "$VERIFY" = 1 ] && echo ", termasuk 09_verify" ))

Langkah berikutnya:
  1. cd "$DIR" && npm ci
  2. cp .env.example .env.local   (isi Supabase + VAPID: npx web-push generate-vapid-keys)
  3. Ganti public/icon.svg dengan ikon app, lalu: npm run icons
  4. Isi lib/about.ts dan lib/docs/content.ts; ganti contoh Pengajuan dengan dokumen asli
  5. Uji SQL: npm run db:test   |   pasang lokal: npm run db:local -- apply && npm run db:types
  6. Daftarkan app di public.apps lewat konsol platform, lalu migration lewat alur lourdes-db
  7. Commit pertama: git commit -m "Init $APP dari lourdes-boilerplate"
EOF
