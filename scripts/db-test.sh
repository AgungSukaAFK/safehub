#!/usr/bin/env bash
# Uji SEMUA SQL db/ di container Postgres Supabase SEKALI PAKAI (tidak menyentuh db-lourdes):
# stub storage → stub platform → platform → app (+contoh) → seed → db/tests/*.sql
# Setiap tahap = satu transaksi (seperti migration). Gagal di mana pun = exit != 0.
# Container dihapus di akhir (KEEP=1 untuk menyimpannya, mis. untuk debug).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IMAGE="${IMAGE:-public.ecr.aws/supabase/postgres:17.11.0.004}"
NAME="lb-pgtest-$$"
APP=safehub; HOST=safehub

cleanup() {
  if [ "${KEEP:-0}" = 1 ]; then echo "container disimpan: $NAME"; else docker rm -f "$NAME" >/dev/null 2>&1 || true; fi
}
trap cleanup EXIT

docker run -d --name "$NAME" -e POSTGRES_PASSWORD=postgres "$IMAGE" >/dev/null
for _ in $(seq 1 60); do docker exec "$NAME" pg_isready -U postgres -h localhost >/dev/null 2>&1 && break; sleep 2; done
# init image menjalankan beberapa restart; tunggu sampai auth.uid() tersedia
for _ in $(seq 1 30); do
  docker exec "$NAME" psql -U postgres -h localhost -Atc "select to_regprocedure('auth.uid()')" 2>/dev/null | grep -q uid && break
  sleep 2
done
sleep 3

# $1 = label, $2 = user (default postgres), stdin = sql
run() {
  echo "== $1"
  local out
  if ! out=$(docker exec -i "$NAME" psql -U "${2:-postgres}" -h localhost -d postgres -1 \
      -v ON_ERROR_STOP=1 -v VERBOSITY=default -q -X 2>&1 >/dev/null); then
    echo "$out" | grep -v '^NOTICE' >&2
    echo "GAGAL di tahap: $1" >&2
    exit 1
  fi
}

"$ROOT/scripts/db-build.sh" dev-storage-stub "$APP" "$HOST" | run "stub storage" supabase_admin
"$ROOT/scripts/db-build.sh" dev-stub "$APP" "$HOST" | run "stub platform"
"$ROOT/scripts/db-build.sh" platform "$APP" "$HOST" | run "platform"
"$ROOT/scripts/db-build.sh" app "$APP" "$HOST" | run "app"
"$ROOT/scripts/db-build.sh" seed "$APP" "$HOST" | run "seed"
# stub platform & seed harus idempoten
"$ROOT/scripts/db-build.sh" dev-stub "$APP" "$HOST" | run "stub platform (ulang)"
"$ROOT/scripts/db-build.sh" seed "$APP" "$HOST" | run "seed (ulang)"

for t in "$ROOT"/db/tests/*.sql; do
  echo "== test $(basename "$t")"
  # stdout (hasil select) dibuang; NOTICE "ok ..." dan ERROR tampil
  set +e
  out=$(sed -e "s/__APP__/$APP/g" -e "s/__HOST__/$HOST/g" "$t" \
    | docker exec -i "$NAME" psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -q -X -o /dev/null 2>&1)
  status=$?
  set -e
  echo "$out" | sed -e 's/^NOTICE:  //' | grep -v '^\(trigger\|policy\) .* skipping$' || true
  if [ "$status" != 0 ]; then echo "GAGAL: $(basename "$t")" >&2; exit 1; fi
done
echo "SEMUA UJI LULUS"
