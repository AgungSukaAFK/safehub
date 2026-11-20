-- =====================================================================================
-- [starter-standar] direkonstruksi dari deskripsi lourdes-db/templates/new_app.sql.
-- Saat app dibuat, bagian ini DIGANTI isi templates/new_app.sql asli (schema + grant +
-- registry). Placeholder: __APP__ (app_id), __HOST__ (subdomain), __NAME__ (nama tampil).
-- =====================================================================================

create schema __APP__;
comment on schema __APP__ is 'App __NAME__ (https://__HOST__.lourdes.cloud). Dibuat dari lourdes-boilerplate.';

grant usage on schema __APP__ to authenticated, service_role;

-- Default privileges (backend-guide §3.2): tabel → authenticated boleh CRUD (RLS yang menjaga),
-- fungsi → execute authenticated. Fungsi internal WAJIB di-revoke tepat setelah dibuat.
alter default privileges in schema __APP__ grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema __APP__ grant usage, select on sequences to authenticated;
alter default privileges in schema __APP__ revoke execute on functions from public;
alter default privileges in schema __APP__ grant execute on functions to authenticated;

insert into public.apps (id, name, description, url)
values ('__APP__', '__NAME__', 'Dibuat dari lourdes-boilerplate', 'https://__HOST__.lourdes.cloud')
on conflict (id) do update set name = excluded.name, url = excluded.url;
