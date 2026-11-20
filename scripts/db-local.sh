#!/usr/bin/env bash
# Pasang schema boilerplate ke Supabase lokal db-lourdes (container supabase_db_db-lourdes).
#   scripts/db-local.sh apply   → stub platform + platform + app + seed (sekali; gagal kalau sudah ada)
#   scripts/db-local.sh reset   → HAPUS schema app + objek platform buatan boilerplate + user demo, lalu apply
#   scripts/db-local.sh expose  → buka schema app ke PostgREST (pgrst.db_schemas) + reload
# HANYA untuk lokal. Di VPS memakai alur lourdes-db (dry-run → konfirmasi → push).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB="${DB_CONTAINER:-supabase_db_db-lourdes}"
APP=safehub; HOST=safehub; NAME="Safe Hub"
psqlc() { docker exec -i "$DB" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X "$@"; }

expose() {
  psqlc <<SQL
alter role authenticator set pgrst.db_schemas = 'public, graphql_public, $APP';
notify pgrst, 'reload config';
notify pgrst, 'reload schema';
SQL
  echo "schema $APP dibuka untuk PostgREST"
}

apply() {
  "$ROOT/scripts/db-build.sh" dev-stub "$APP" "$HOST" | psqlc
  if [ "$(psqlc -Atc "select to_regclass('public.companies') is not null")" = "f" ]; then
    "$ROOT/scripts/db-build.sh" platform "$APP" "$HOST" | psqlc
  fi
  "$ROOT/scripts/db-build.sh" app "$APP" "$HOST" "$NAME" | psqlc
  "$ROOT/scripts/db-build.sh" seed "$APP" "$HOST" "$NAME" | psqlc
  expose
}

reset() {
  psqlc <<SQL
drop schema if exists $APP cascade;
delete from storage.objects where bucket_id in ('$HOST-lampiran', '$HOST-media');
delete from storage.buckets where id in ('$HOST-lampiran', '$HOST-media');
do \$\$ declare p record; begin
  for p in select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects'
             and policyname like '$HOST-%' loop
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;
end \$\$;
delete from public.app_access where app_id = '$APP';
delete from public.apps where id = '$APP';
delete from auth.users where email like '%@demo.lourdes.test';
SQL
  echo "schema $APP & user demo dihapus"
  apply
}

case "${1:-apply}" in
  apply) apply ;;
  reset) reset ;;
  expose) expose ;;
  *) echo "pakai: apply | reset | expose" >&2; exit 1 ;;
esac
