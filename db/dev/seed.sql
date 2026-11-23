-- =====================================================================================
-- HANYA UNTUK LOKAL/UJI. Data DEMO boilerplate (semua email @demo.lourdes.test,
-- password sama: Demo12345!). Placeholder __APP__ diganti runner.
-- =====================================================================================

-- ---------- master ----------
insert into public.departments (code, name) values
  ('IT', 'IT'), ('PUR', 'Purchasing'), ('FIN', 'Finance'), ('WH', 'Gudang'),
  ('HSE', 'HSE'), ('HRD', 'HR'), ('SRV', 'Service & Maintenance'), ('SCM', 'SCM / Gudang'), ('OPS', 'Operasional')
on conflict (code) do nothing;
insert into public.job_titles (name) values ('Staff'), ('Supervisor'), ('Manager'), ('Direktur'),
  ('Teknisi AC'), ('HSE Officer'), ('HSE Superintendent'), ('Pengawas Service'), ('PJO'), ('PJA'),
  ('HR Officer'), ('Planner Maintenance'), ('Site Manager'), ('Admin Kontraktor'), ('Auditor Internal')
on conflict (name) do nothing;
-- Site = public.locations (D2). Site MIFA dari prototipe + satu site kedua untuk uji multi-site.
insert into public.locations (name) values ('Kantor Pusat Bekasi'), ('Gudang Jatiasih'),
  ('Site MIFA'), ('Site Demo Kalimantan')
on conflict (name) do nothing;

-- ---------- user demo ----------
-- Insert hanya kolom yang ada di tabel (sisanya memakai default kolom)
create or replace function pg_temp.insert_existing(p_schema text, p_table text, p_data jsonb)
returns void language plpgsql as $$
declare v_cols text; v_vals text;
begin
  select string_agg(quote_ident(c.column_name), ', ' order by c.ordinal_position),
         string_agg(format('r.%I', c.column_name), ', ' order by c.ordinal_position)
    into v_cols, v_vals
    from information_schema.columns c
   where c.table_schema = p_schema and c.table_name = p_table and p_data ? c.column_name
     and c.is_generated = 'NEVER';
  execute format('insert into %I.%I (%s) select %s from jsonb_populate_record(null::%I.%I, $1) r',
                 p_schema, p_table, v_cols, v_vals, p_schema, p_table) using p_data;
end $$;

create or replace function pg_temp.demo_user(p_email text, p_name text, p_company text, p_dept text,
  p_job text, p_role text, p_platform_admin boolean default false)
returns uuid language plpgsql as $$
declare v_id uuid;
begin
  select id into v_id from auth.users where email = p_email;
  if v_id is null then
    v_id := gen_random_uuid();
    -- Kolom diisi hanya kalau ada (container uji punya auth.users minimal; GoTrue punya lengkap)
    perform pg_temp.insert_existing('auth', 'users', jsonb_build_object(
      'instance_id', '00000000-0000-0000-0000-000000000000', 'id', v_id, 'aud', 'authenticated',
      'role', 'authenticated', 'email', p_email,
      'encrypted_password', extensions.crypt('Demo12345!', extensions.gen_salt('bf')),
      'email_confirmed_at', now(), 'raw_app_meta_data', '{"provider":"email","providers":["email"]}'::jsonb,
      'raw_user_meta_data', jsonb_build_object('full_name', p_name), 'created_at', now(), 'updated_at', now(),
      'confirmation_token', '', 'recovery_token', '', 'email_change_token_new', '', 'email_change', '',
      'is_sso_user', false, 'is_anonymous', false));
    if to_regclass('auth.identities') is not null then
      perform pg_temp.insert_existing('auth', 'identities', jsonb_build_object(
        'id', gen_random_uuid(), 'user_id', v_id, 'provider_id', v_id::text,
        'identity_data', jsonb_build_object('sub', v_id::text, 'email', p_email, 'email_verified', true),
        'provider', 'email', 'last_sign_in_at', now(), 'created_at', now(), 'updated_at', now()));
    end if;
  end if;

  insert into public.profiles (id, email, full_name, company, department_id, job_title_id, location_id, phone,
    nrp_gmi, nrp_gis)
  values (v_id, p_email, p_name, p_company,
    (select id from public.departments where code = p_dept),
    (select id from public.job_titles where name = p_job),
    (select id from public.locations where name = 'Kantor Pusat Bekasi'),
    '0812' || lpad((abs(hashtext(p_email)) % 100000000)::text, 8, '0'),
    case when p_company = 'GMI' then 'GMI-' || lpad((abs(hashtext(p_email)) % 10000)::text, 4, '0') end,
    case when p_company = 'GIS' then 'GIS-' || lpad((abs(hashtext(p_email)) % 10000)::text, 4, '0') end)
  on conflict (id) do update set full_name = excluded.full_name, company = excluded.company,
    department_id = excluded.department_id, job_title_id = excluded.job_title_id, is_active = true;

  if p_role is not null then
    insert into public.app_access (user_id, app_id, role) values (v_id, '__APP__', p_role)
    on conflict (user_id, app_id) do update set role = excluded.role;
  end if;
  if p_platform_admin then
    insert into public.app_access (user_id, app_id, role) values (v_id, 'platform', 'admin')
    on conflict (user_id, app_id) do update set role = 'admin';
  end if;
  return v_id;
end $$;

select pg_temp.demo_user('it@demo.lourdes.test',       'Tim IT (Demo)',          null,      'IT',  'Staff',      null,     true);
select pg_temp.demo_user('admin@demo.lourdes.test',    'Admin Demo',             'LOURDES', 'IT',  'Supervisor', 'admin');
select pg_temp.demo_user('budi@demo.lourdes.test',     'Budi Santoso (GMI)',     'GMI',     'PUR', 'Staff',      'editor');
select pg_temp.demo_user('sari@demo.lourdes.test',     'Sari Wulandari (GIS)',   'GIS',     'PUR', 'Staff',      'editor');
select pg_temp.demo_user('andi@demo.lourdes.test',     'Andi Pratama (Kadep)',   'GMI',     'PUR', 'Manager',    'viewer');
select pg_temp.demo_user('dewi@demo.lourdes.test',     'Dewi Lestari (Kadep)',   'GIS',     'PUR', 'Manager',    'viewer');
select pg_temp.demo_user('rina@demo.lourdes.test',     'Rina Kartika (Finance)', 'LOURDES', 'FIN', 'Manager',    'viewer');
select pg_temp.demo_user('viewer@demo.lourdes.test',   'Vina Viewer (GMI)',      'GMI',     'WH',  'Staff',      'viewer');
select pg_temp.demo_user('noaccess@demo.lourdes.test', 'Nora Tanpa Akses',       'GMI',     'WH',  'Staff',      null);
-- Pernah punya akses lalu akunnya dinonaktifkan tim IT (uji kolom/filter status di Pengguna & Akses)
select pg_temp.demo_user('nonaktif@demo.lourdes.test', 'Tono Nonaktif (GIS)',    'GIS',     'WH',  'Staff',      'viewer');
update public.profiles set is_active = false where email = 'nonaktif@demo.lourdes.test';

-- ---------- persona K3 (rancangan §4.0 butir 7): satu user per fungsi, company GMI, Site MIFA ----------
select pg_temp.demo_user('karyawan@demo.lourdes.test',   'Rudi Hartono (Karyawan)',       'GMI', 'SRV', 'Teknisi AC',          'viewer');
select pg_temp.demo_user('hse@demo.lourdes.test',        'Andi Pratama (HSE)',            'GMI', 'HSE', 'HSE Officer',         'editor');
select pg_temp.demo_user('hse.senior@demo.lourdes.test', 'Yusuf Ramadhan (HSE Senior)',   'GMI', 'HSE', 'HSE Superintendent',  'editor');
select pg_temp.demo_user('pengawas@demo.lourdes.test',   'Fajar Nugroho (Pengawas)',      'GMI', 'SRV', 'Pengawas Service',    'editor');
select pg_temp.demo_user('pjo@demo.lourdes.test',        'Budi Santoso (PJO)',            'GMI', 'OPS', 'PJO',                 'editor');
select pg_temp.demo_user('pja@demo.lourdes.test',        'Agus Salim (PJA)',              'GMI', 'OPS', 'PJA',                 'editor');
select pg_temp.demo_user('manajemen@demo.lourdes.test',  'Bambang Sutrisno (Manajemen)',  'GMI', 'OPS', 'Site Manager',        'editor');
select pg_temp.demo_user('hr@demo.lourdes.test',         'Dewi Lestari (HR)',             'GMI', 'HRD', 'HR Officer',          'editor');
select pg_temp.demo_user('maintenance@demo.lourdes.test','Hendra Wijaya (Maintenance)',   'GMI', 'SRV', 'Planner Maintenance', 'editor');
select pg_temp.demo_user('scm@demo.lourdes.test',        'Sari Wulandari (SCM)',          'GMI', 'SCM', 'Staff',               'editor');
select pg_temp.demo_user('kontraktor@demo.lourdes.test', 'Joko Susilo (Admin Kontraktor)','GMI', 'HSE', 'Admin Kontraktor',    'editor');
select pg_temp.demo_user('auditor@demo.lourdes.test',    'Lina Marlina (Auditor)',        'GMI', 'FIN', 'Auditor Internal',    'viewer');

update public.profiles set location_id = (select id from public.locations where name = 'Site MIFA')
 where email in ('karyawan@demo.lourdes.test', 'hse@demo.lourdes.test', 'hse.senior@demo.lourdes.test',
                 'pengawas@demo.lourdes.test', 'pjo@demo.lourdes.test', 'pja@demo.lourdes.test',
                 'manajemen@demo.lourdes.test', 'hr@demo.lourdes.test', 'maintenance@demo.lourdes.test',
                 'scm@demo.lourdes.test', 'kontraktor@demo.lourdes.test');

-- Fungsi K3 + batas site. Karyawan dibatasi ke Site MIFA (uji my_location_scope, D13).
insert into __APP__.members (user_id, functions, location_ids)
select p.id, f.functions,
       case when f.mifa_only then array[(select id from public.locations where name = 'Site MIFA')] end
  from (values
    ('karyawan@demo.lourdes.test',    array['karyawan'],              true),
    ('hse@demo.lourdes.test',         array['hse'],                   false),
    ('hse.senior@demo.lourdes.test',  array['hse', 'hse_senior'],     false),
    ('pengawas@demo.lourdes.test',    array['pengawas'],              false),
    ('pjo@demo.lourdes.test',         array['pjo'],                   false),
    ('pja@demo.lourdes.test',         array['pja'],                   false),
    ('manajemen@demo.lourdes.test',   array['manajemen'],             false),
    ('hr@demo.lourdes.test',          array['hr'],                    false),
    ('maintenance@demo.lourdes.test', array['maintenance'],           false),
    ('scm@demo.lourdes.test',         array['scm'],                   false),
    ('kontraktor@demo.lourdes.test',  array['kontraktor_admin'],      false),
    ('auditor@demo.lourdes.test',     array['auditor'],               false)
  ) as f(email, functions, mifa_only)
  join public.profiles p on p.email = f.email
on conflict (user_id) do update set functions = excluded.functions, location_ids = excluded.location_ids;

-- Area per site (dari prototipe) + mitra GMI
insert into __APP__.areas (location_id, name, sort_order)
select l.id, a.name, a.ord
  from (values ('Site MIFA', 'Workshop Service', 10), ('Site MIFA', 'Pit Area', 20),
               ('Site MIFA', 'Hauling Road', 30), ('Site MIFA', 'Bay 3', 40),
               ('Site Demo Kalimantan', 'Workshop', 10), ('Site Demo Kalimantan', 'Pit Utara', 20)) as a(site, name, ord)
  join public.locations l on l.name = a.site
on conflict (location_id, lower(btrim(name))) do nothing;

insert into __APP__.contractors (company_code, name, kind)
values ('GMI', 'PT Sinar Teknik Mandiri', 'subkontraktor'), ('GMI', 'PT Cipta Lingkungan Aceh', 'subkontraktor'),
       ('GMI', 'PT Bara Safety Indonesia', 'vendor'), ('GMI', 'PT Samudra Karya Abadi', 'subkontraktor'),
       ('GMI', 'PT Lintas Energi Servis', 'vendor')
on conflict (company_code, lower(btrim(name))) do nothing;

-- ---------- konfigurasi approval (tanpa auth.uid → log/CCTV tercatat sebagai sistem) ----------
insert into __APP__.department_heads (department_id, company_code, user_id)
select d.id, c.code, p.id
  from public.departments d
  cross join (values ('GMI', 'andi@demo.lourdes.test'), ('GIS', 'dewi@demo.lourdes.test')) as c(code, email)
  join public.profiles p on p.email = c.email
 where d.code = 'PUR'
on conflict (department_id, company_code) do update set user_id = excluded.user_id;

do $$
declare v_tpl uuid;
begin
  if not exists (select 1 from __APP__.approval_templates where doc_type = 'pengajuan') then
    insert into __APP__.approval_templates (doc_type, name, description, priority)
    values ('pengajuan', 'Pengajuan standar', 'Kepala departemen memeriksa, Finance menyetujui (DEMO)', 0)
    returning id into v_tpl;
    insert into __APP__.approval_template_steps (template_id, step_no, approval_type, approver_kind, approver_id, due_hours)
    values (v_tpl, 1, 'memeriksa', 'department_head', null, 24),
           (v_tpl, 2, 'menyetujui', 'user', (select id from public.profiles where email = 'rina@demo.lourdes.test'), 48);
  end if;
end $$;

-- ---------- pembaruan pertama ----------
insert into __APP__.updates (version_major, version_minor, version_patch, title, highlights, content, created_by)
select 0, 1, 0, 'Rilis awal __NAME__',
       array['App shell, tema 4 mode, dan global search', 'Contoh Pengajuan dengan approval engine', 'Notifikasi, Bantuan Admin, Feedback'],
       '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Ini post contoh dari boilerplate. Ganti atau hapus saat app nyata dibuat."}]}]}'::jsonb,
       (select id from public.profiles where email = 'admin@demo.lourdes.test')
 where not exists (select 1 from __APP__.updates);
