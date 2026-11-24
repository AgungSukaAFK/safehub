#!/usr/bin/env bash
# Gabungkan file db/ menjadi satu SQL dengan placeholder diganti.
# Pakai: scripts/db-build.sh <mode> <app_id> <host> "<nama>"  > out.sql
#   mode: platform | app | migration | app-no-example | verify | dev-stub | dev-storage-stub | seed
# Untuk migration lourdes-db: `migration` (tanpa 09_verify; `app-no-example` setelah contoh dihapus).
# `app` = semua termasuk 09_verify (dipakai uji); `verify` = 09_verify saja (OPSIONAL, butuh izin user:
# membuka satu fungsi untuk anon).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODE="${1:?mode}"; APP="${2:-safehub}"; HOST="${3:-safehub}"; NAME="${4:-Safe Hub}"

if ! [[ "$APP" =~ ^[a-z][a-z0-9_]{1,40}$ ]]; then echo "app_id tidak valid: $APP" >&2; exit 1; fi
if ! [[ "$HOST" =~ ^[a-z][a-z0-9-]{1,40}$ ]]; then echo "host tidak valid: $HOST" >&2; exit 1; fi

case "$MODE" in
  platform)          FILES=(platform/p01_companies.sql platform/p02_cctv.sql platform/p03_maintenance.sql) ;;
  app)               FILES=(app/00_schema.sql app/01_base.sql app/02_notifications.sql app/03_approval.sql
                            app/04_support.sql app/05_feedback.sql app/06_updates.sql app/07_storage.sql
                            app/08_maintenance.sql app/10_fondasi.sql app/11_kejadian_pica.sql app/12_inspeksi_kpi.sql app/13_tsp.sql app/14_pengingat.sql app/15_audit.sql app/16_laporan.sql app/17_people.sql app/example_pengajuan.sql app/09_verify.sql) ;;
  migration)         FILES=(app/00_schema.sql app/01_base.sql app/02_notifications.sql app/03_approval.sql
                            app/04_support.sql app/05_feedback.sql app/06_updates.sql app/07_storage.sql
                            app/08_maintenance.sql app/10_fondasi.sql app/11_kejadian_pica.sql app/12_inspeksi_kpi.sql app/13_tsp.sql app/14_pengingat.sql app/15_audit.sql app/16_laporan.sql app/17_people.sql app/example_pengajuan.sql) ;;
  verify)            FILES=(app/09_verify.sql) ;;
  app-no-example)    FILES=(app/00_schema.sql app/01_base.sql app/02_notifications.sql app/03_approval.sql
                            app/04_support.sql app/05_feedback.sql app/06_updates.sql app/07_storage.sql
                            app/08_maintenance.sql app/10_fondasi.sql app/11_kejadian_pica.sql app/12_inspeksi_kpi.sql app/13_tsp.sql app/14_pengingat.sql app/15_audit.sql app/16_laporan.sql app/17_people.sql) ;;
  dev-stub)          FILES=(dev/00_platform_stub.sql) ;;
  dev-storage-stub)  FILES=(dev/00_storage_stub.sql) ;;
  seed)              FILES=(dev/seed.sql) ;;
  *) echo "mode tidak dikenal: $MODE" >&2; exit 1 ;;
esac

ESC_NAME="${NAME//\'/\'\'}"
for f in "${FILES[@]}"; do
  echo "-- >>> db/$f"
  sed -e "s/__APP__/$APP/g" -e "s/__HOST__/$HOST/g" -e "s/__NAME__/${ESC_NAME//\//\/}/g" "$ROOT/db/$f"
  echo
done
