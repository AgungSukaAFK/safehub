#!/usr/bin/env bash
# Pasang schema boilerplate ke Supabase lokal db-lourdes (container supabase_db_db-lourdes).
#   scripts/db-local.sh apply   → stub platform + platform + app + seed (sekali; gagal kalau sudah ada)
#   scripts/db-local.sh reset   → HAPUS schema app + policy storage app + akses app, lalu apply (user demo tetap)
#   scripts/db-local.sh expose  → tambahkan schema app ke pgrst.db_schemas (tanpa menghapus app lain) + reload
# HANYA untuk lokal. Di VPS memakai alur lourdes-db (dry-run → konfirmasi → push).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB="${DB_CONTAINER:-supabase_db_db-lourdes}"
APP=safehub; HOST=safehub; NAME="Safe Hub"
psqlc() { docker exec -i "$DB" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X "$@"; }

expose() {
  # Tambahkan schema app ke daftar PostgREST yang SUDAH ada (DB lokal dipakai beberapa app)
  psqlc <<SQL
do \$\$
declare v_cur text;
begin
  select split_part(c, '=', 2) into v_cur
    from pg_roles r, unnest(r.rolconfig) c where r.rolname = 'authenticator' and c like 'pgrst.db_schemas=%';
  v_cur := coalesce(nullif(v_cur, ''), 'public, graphql_public');
  if not ('$APP' = any (string_to_array(replace(v_cur, ' ', ''), ','))) then
    v_cur := v_cur || ', $APP';
  end if;
  execute format('alter role authenticator set pgrst.db_schemas = %L', v_cur);
end \$\$;
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
  # Hanya objek app ini. TIDAK menghapus user demo (dipakai app lain di DB lokal yang sama) dan TIDAK
  # menghapus isi storage (Supabase melarang delete langsung; bucket dibuat ulang dengan on conflict).
  psqlc <<SQL
drop schema if exists $APP cascade;
do \$\$ declare p record; begin
  for p in select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects'
             and policyname like '$HOST-%' loop
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;
end \$\$;
delete from public.app_access where app_id = '$APP';
SQL
  echo "schema $APP dihapus (user demo & file storage dipertahankan)"
  apply
}

case "${1:-apply}" in
  apply) apply ;;
  reset) reset ;;
  expose) expose ;;
  *) echo "pakai: apply | reset | expose" >&2; exit 1 ;;
esac
