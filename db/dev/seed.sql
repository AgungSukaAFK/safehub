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

-- ---------- data DEMO fase 1: kejadian, temuan, tindakan (dari prototipe) ----------
-- Dibuat lewat RPC sebagai persona (log, notifikasi, nomor wajar), lalu tanggal dimundurkan.
-- Bukti tindakan = baris storage.objects tanpa file (unduhan menampilkan "file tidak tersedia").
create or replace function pg_temp.as_user(p_email text) returns uuid language plpgsql as $$
declare v_id uuid;
begin
  select id into v_id from auth.users where email = p_email;
  perform set_config('request.jwt.claims', json_build_object('sub', v_id, 'role', 'authenticated', 'email', p_email)::text, true);
  perform set_config('request.jwt.claim.sub', v_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  return v_id;
end $$;

create or replace function pg_temp.uid(p_email text) returns uuid language sql as $$
  select id from public.profiles where email = p_email;
$$;

create or replace function pg_temp.lapor(p_email text, p_area text, p_cat text, p_desc text, p_unit text,
  p_unit_label text) returns uuid language plpgsql as $$
declare v_site uuid := (select id from public.locations where name = 'Site MIFA');
begin
  perform pg_temp.as_user(p_email);
  return (__APP__.incident_report(jsonb_build_object(
    'location_id', v_site, 'area_id', (select id from __APP__.areas where location_id = v_site and name = p_area),
    'occurred_at', now()::text, 'category', p_cat, 'description', p_desc, 'unit_code', p_unit,
    'unit_label', p_unit_label, 'supervisor_id', pg_temp.uid('pengawas@demo.lourdes.test'),
    'persons', jsonb_build_array(jsonb_build_object('role', 'involved', 'name', 'Rudi Hartono', 'company_kind', 'internal',
                                                    'employment', 'permanent', 'position', 'Teknisi AC'),
                                 jsonb_build_object('role', 'witness', 'name', 'Dedi Saputra', 'company_kind', 'internal',
                                                    'position', 'Leading Hand Service')))) ->> 'id')::uuid;
end $$;

create or replace function pg_temp.klasifikasi(p_id uuid, p_cat text, p_class text, p_sev text, p_pot text)
returns void language plpgsql as $$
begin
  perform pg_temp.as_user('hse@demo.lourdes.test');
  perform __APP__.incident_classify(p_id, jsonb_build_object('category', p_cat, 'injury_class', p_class,
    'severity', p_sev, 'potential_severity', p_pot,
    'ppe', jsonb_build_object('helmet', true, 'glasses', true, 'gloves', false, 'safety_shoes', true, 'ear_plug', true)));
end $$;

create or replace function pg_temp.investigasi(p_id uuid, p_events text[], p_cause text) returns void language plpgsql as $$
begin
  perform pg_temp.as_user('hse@demo.lourdes.test');
  perform __APP__.incident_set_team(p_id, pg_temp.uid('pengawas@demo.lourdes.test'),
    array[pg_temp.uid('hse@demo.lourdes.test'), pg_temp.uid('pjo@demo.lourdes.test')]);
  perform pg_temp.as_user('pengawas@demo.lourdes.test');
  perform __APP__.incident_save_investigation(p_id, jsonb_build_object(
    'timeline', (select jsonb_agg(jsonb_build_object('time', split_part(e, '|', 1), 'event', split_part(e, '|', 2)))
                   from unnest(p_events) e),
    'causes', jsonb_build_object('unsafe_act', jsonb_build_array(jsonb_build_object('text', p_cause))),
    'recommendations', jsonb_build_array(jsonb_build_object('text', 'Perbarui JSA dan lakukan toolbox meeting'))));
end $$;

-- Tindakan; p_state: open | in_progress | waiting | closed
create or replace function pg_temp.tindakan(p_parent text, p_id uuid, p_title text, p_kind text, p_pic text,
  p_due integer, p_state text) returns uuid language plpgsql as $$
declare v_act uuid; v_round integer;
begin
  perform pg_temp.as_user('hse@demo.lourdes.test');
  v_act := (__APP__.pica_create(jsonb_build_object(p_parent || '_id', p_id, 'title', p_title, 'kind', p_kind,
    'pic_id', pg_temp.uid(p_pic), 'verifier_id', pg_temp.uid('hse@demo.lourdes.test'),
    'due_date', current_date + greatest(p_due, 0), 'required_evidence', 'Foto setelah perbaikan')) ->> 'id')::uuid;
  if p_state = 'open' then return v_act; end if;
  perform pg_temp.as_user(p_pic);
  perform __APP__.pica_start(v_act);
  if p_state = 'in_progress' then return v_act; end if;
  select round into v_round from __APP__.pica_actions where id = v_act;
  insert into storage.objects (bucket_id, name, owner_id)
  values ('__HOST__-lampiran', 'pica/' || v_act || '/r' || v_round || '/contoh-bukti.jpg', pg_temp.uid(p_pic)::text);
  perform __APP__.pica_submit_evidence(v_act, 'Pekerjaan selesai, foto terlampir',
    array['pica/' || v_act || '/r' || v_round || '/contoh-bukti.jpg']);
  if p_state = 'waiting' then return v_act; end if;
  perform pg_temp.as_user('hse@demo.lourdes.test');
  perform __APP__.pica_verify(v_act, 'accept', 'Sesuai persyaratan tindakan');
  return v_act;
end $$;

create or replace function pg_temp.temuan(p_email text, p_area text, p_title text, p_desc text, p_src text,
  p_ref text, p_cat text, p_risk text, p_pic text, p_due integer, p_source uuid default null)
returns uuid language plpgsql as $$
declare v_site uuid := (select id from public.locations where name = 'Site MIFA');
begin
  perform pg_temp.as_user(p_email);
  return (__APP__.finding_save(null, jsonb_build_object(
    'location_id', v_site, 'area_id', (select id from __APP__.areas where location_id = v_site and name = p_area),
    'found_at', now()::text, 'title', p_title, 'description', p_desc, 'source_kind', p_src, 'source_ref', p_ref,
    'source_id', p_source, 'category', p_cat, 'risk_level', p_risk, 'likelihood', 3, 'consequence', 4,
    'root_causes', jsonb_build_array(jsonb_build_object('factor', 'man', 'text', 'Pemahaman prosedur belum konsisten'),
                                     jsonb_build_object('factor', 'method', 'text', 'Checklist belum memuat hold point')),
    'pic_id', pg_temp.uid(p_pic), 'due_date', current_date + greatest(p_due, 0))) ->> 'id')::uuid;
end $$;

-- Mundurkan tanggal satu record beserta lognya (contoh data terlihat tersebar dalam beberapa bulan)
create or replace function pg_temp.mundur(p_table text, p_id uuid, p_days integer) returns void language plpgsql as $$
begin
  if p_table = 'incidents' then
    update __APP__.incidents
       set occurred_at = occurred_at - make_interval(days => p_days, mins => 6),
           reported_at = reported_at - make_interval(days => p_days),
           created_at = created_at - make_interval(days => p_days),
           classified_at = classified_at - make_interval(days => greatest(p_days - 1, 0)),
           closed_at = closed_at - make_interval(days => greatest(p_days - 20, 0))
     where id = p_id;
    update __APP__.incidents_logs set at = at - make_interval(days => p_days) where record_id = p_id;
  else
    update __APP__.findings
       set found_at = found_at - make_interval(days => p_days),
           created_at = created_at - make_interval(days => p_days),
           closed_at = closed_at - make_interval(days => greatest(p_days - 12, 0))
     where id = p_id;
    update __APP__.findings_logs set at = at - make_interval(days => p_days) where record_id = p_id;
  end if;
end $$;

do $$
declare
  k1 uuid; k2 uuid; k3 uuid; k4 uuid; k5 uuid; k6 uuid; k7 uuid; k8 uuid;
  t1 uuid; t2 uuid; t3 uuid; t4 uuid; t5 uuid; t6 uuid; t7 uuid; t8 uuid;
begin
  if exists (select 1 from __APP__.incidents) or (select id from public.locations where name = 'Site MIFA') is null then
    return;
  end if;
  -- kejadian (urut lama → baru supaya nomor naik sesuai tanggal)
  k1 := pg_temp.lapor('karyawan@demo.lourdes.test', 'Bay 3', 'property_damage', 'Kaca unit retak akibat alat kerja terjatuh', 'E5126', 'PC2000');
  perform pg_temp.klasifikasi(k1, 'property_damage', 'none', 'low', 'medium');
  perform pg_temp.investigasi(k1, array['09:10|Alat kerja diletakkan di atas kabin', '09:14|Alat jatuh dan mengenai kaca'], 'Alat kerja tidak diamankan');
  perform pg_temp.tindakan('incident', k1, 'Sediakan tool tray magnetik di kabin', 'corrective', 'maintenance@demo.lourdes.test', 7, 'closed');
  perform pg_temp.as_user('pengawas@demo.lourdes.test');   perform __APP__.incident_submit_review(k1);
  perform pg_temp.as_user('hse.senior@demo.lourdes.test'); perform __APP__.incident_review(k1, 'approve', 'Analisis memadai');
  perform pg_temp.as_user('pjo@demo.lourdes.test');        perform __APP__.incident_review(k1, 'approve');

  k5 := pg_temp.lapor('karyawan@demo.lourdes.test', 'Workshop Service', 'occupational_disease', 'Paparan debu saat pembersihan evaporator', 'E51203', 'PC1250');
  perform pg_temp.klasifikasi(k5, 'occupational_disease', 'none', 'low', 'medium');

  k4 := pg_temp.lapor('pengawas@demo.lourdes.test', 'Pit Area', 'fire', 'Percikan api pada konektor blower kabin', 'H57197', 'HD785-7');
  perform pg_temp.klasifikasi(k4, 'fire', 'none', 'medium', 'high');
  perform pg_temp.investigasi(k4, array['15:20|Blower dinyalakan setelah penggantian konektor', '15:21|Percikan api terlihat di konektor'], 'Konektor tidak sesuai spesifikasi');
  perform pg_temp.tindakan('incident', k4, 'Ganti konektor blower dengan part OEM', 'corrective', 'maintenance@demo.lourdes.test', 10, 'waiting');
  perform pg_temp.as_user('pengawas@demo.lourdes.test');   perform __APP__.incident_submit_review(k4);
  perform pg_temp.as_user('hse.senior@demo.lourdes.test'); perform __APP__.incident_review(k4, 'approve');

  k2 := pg_temp.lapor('pengawas@demo.lourdes.test', 'Bay 3', 'injury', 'Teknisi tersandung kabel ekstensi', null, null);
  perform pg_temp.klasifikasi(k2, 'injury', 'first_aid', 'low', 'medium');
  perform pg_temp.investigasi(k2, array['13:02|Kabel ekstensi melintang di jalur jalan', '13:05|Teknisi tersandung, lutut memar'], 'Kabel tidak dirapikan');
  perform pg_temp.tindakan('incident', k2, 'Pasang cable cover di jalur workshop', 'corrective', 'karyawan@demo.lourdes.test', 5, 'closed');
  perform pg_temp.as_user('pengawas@demo.lourdes.test');   perform __APP__.incident_submit_review(k2);
  perform pg_temp.as_user('hse.senior@demo.lourdes.test'); perform __APP__.incident_review(k2, 'approve');
  perform pg_temp.as_user('manajemen@demo.lourdes.test');  perform __APP__.incident_review(k2, 'approve');

  k3 := pg_temp.lapor('karyawan@demo.lourdes.test', 'Workshop Service', 'environment', 'Tumpahan oli kompresor di area kerja', 'DA54853', 'Mercedes Arocs');
  perform pg_temp.klasifikasi(k3, 'environment', 'none', 'low', 'low');
  perform pg_temp.as_user('pjo@demo.lourdes.test');
  perform __APP__.incident_close_exception(k3, 'Tumpahan kecil, sudah dibersihkan dengan spill kit saat itu juga');

  k6 := pg_temp.lapor('karyawan@demo.lourdes.test', 'Workshop Service', 'near_miss', 'Selang manifold terlepas saat pengisian refrigerant', 'G5809', 'GD825A');
  perform pg_temp.klasifikasi(k6, 'near_miss', 'none', 'low', 'high');
  perform pg_temp.investigasi(k6, array['10:00|Pengisian refrigerant dimulai', '10:06|Selang manifold terlepas dari nipple'], 'Coupling selang aus');
  perform pg_temp.tindakan('incident', k6, 'Ganti set selang manifold', 'corrective', 'maintenance@demo.lourdes.test', 6, 'closed');
  perform pg_temp.tindakan('incident', k6, 'Tambahkan cek coupling di checklist harian', 'preventive', 'pengawas@demo.lourdes.test', 9, 'waiting');
  perform pg_temp.as_user('pengawas@demo.lourdes.test');   perform __APP__.incident_submit_review(k6, 'Analisis selesai');

  k7 := pg_temp.lapor('karyawan@demo.lourdes.test', 'Workshop Service', 'injury',
    'Jari terjepit saat pemasangan kompresor AC unit H57197', 'H57197', 'HD785-7');
  perform pg_temp.as_user('hse@demo.lourdes.test');
  perform __APP__.incident_classify(k7, jsonb_build_object('category', 'injury', 'injury_class', 'first_aid',
    'severity', 'low', 'potential_severity', 'high',
    'damage_description', 'Tidak ada kerusakan unit. Pekerjaan tertunda 2,5 jam untuk penanganan dan pemeriksaan.',
    'estimated_cost', 2750000,
    'ppe', jsonb_build_object('helmet', true, 'glasses', true, 'gloves', false, 'safety_shoes', true, 'ear_plug', true),
    'restricted', jsonb_build_object('injury_type', 'Memar dan luka ringan', 'body_parts', jsonb_build_array('Jari tangan kanan'),
      'treatment', 'first_aid', 'facility', 'Ruang P3K Site MIFA', 'lost_days', 0, 'restricted_days', 2)));
  perform __APP__.incident_set_team(k7, pg_temp.uid('pengawas@demo.lourdes.test'),
    array[pg_temp.uid('hse@demo.lourdes.test'), pg_temp.uid('pjo@demo.lourdes.test')]);
  perform pg_temp.as_user('pengawas@demo.lourdes.test');
  perform __APP__.incident_save_investigation(k7, jsonb_build_object(
    'timeline', jsonb_build_array(
      jsonb_build_object('time', '10:15', 'event', 'Persiapan pemasangan kompresor dan pengecekan bracket.'),
      jsonb_build_object('time', '10:28', 'event', 'Kompresor diangkat manual oleh dua teknisi ke posisi pemasangan.'),
      jsonb_build_object('time', '10:31', 'event', 'Kompresor bergeser saat bracket dikencangkan; jari korban terjepit.'),
      jsonb_build_object('time', '10:33', 'event', 'Pekerjaan dihentikan dan korban dibawa ke ruang P3K.')),
    'reconstruction', 'Rekonstruksi menunjukkan posisi tangan kanan korban berada pada celah antara kompresor dan bracket. Tidak tersedia alat bantu penahan kompresor, sehingga beban ditahan manual selama pengencangan.',
    'causes', jsonb_build_object(
      'unsafe_act', jsonb_build_array(
        jsonb_build_object('text', 'Menempatkan tangan pada titik jepit', 'note', 'Tangan digunakan untuk menahan kompresor selama pengencangan bracket.'),
        jsonb_build_object('text', 'Pengangkatan kompresor tanpa alat bantu')),
      'unsafe_condition', jsonb_build_array(jsonb_build_object('text', 'Bracket tidak memiliki penahan sementara')),
      'job_factor', jsonb_build_array(jsonb_build_object('text', 'JSA belum mencakup risiko titik jepit'),
                                      jsonb_build_object('text', 'Alat bantu angkat tidak tersedia')),
      'personal_factor', jsonb_build_array(jsonb_build_object('text', 'Persepsi risiko titik jepit belum memadai'))),
    'recommendations', jsonb_build_array(
      jsonb_build_object('text', 'Sediakan lifting aid portabel untuk pemasangan kompresor.'),
      jsonb_build_object('text', 'Revisi JSA pekerjaan penggantian kompresor dengan kontrol titik jepit.'),
      jsonb_build_object('text', 'Lakukan refresh training hand safety kepada seluruh teknisi Service AC.'))));
  perform pg_temp.tindakan('incident', k7, 'Sediakan lifting aid portabel untuk kompresor', 'corrective', 'maintenance@demo.lourdes.test', 4, 'in_progress');
  perform pg_temp.tindakan('incident', k7, 'Revisi JSA penggantian kompresor', 'preventive', 'pengawas@demo.lourdes.test', 2, 'waiting');
  perform pg_temp.tindakan('incident', k7, 'Refresh training hand safety', 'preventive', 'pjo@demo.lourdes.test', 1, 'closed');

  k8 := pg_temp.lapor('karyawan@demo.lourdes.test', 'Pit Area', 'near_miss', 'Kebocoran refrigerant saat pemeriksaan unit E51203', 'E51203', 'PC1250');

  -- temuan
  t8 := pg_temp.temuan('pjo@demo.lourdes.test', 'Workshop Service', 'Penerangan area parkir unit kurang memadai',
    'Dua lampu sorot area parkir mati.', 'meeting', 'MOM-2026-09', 'operational_safety', 'medium', 'maintenance@demo.lourdes.test', 20);
  perform pg_temp.tindakan('finding', t8, 'Ganti lampu sorot area parkir', 'corrective', 'maintenance@demo.lourdes.test', 20, 'in_progress');
  t6 := pg_temp.temuan('hse@demo.lourdes.test', 'Pit Area', 'Guard fan kondensor unit G5809 longgar',
    'Baut guard fan kondensor kendor, berpotensi lepas saat unit beroperasi.', 'incident', null, 'equipment_ppe', 'high',
    'maintenance@demo.lourdes.test', 0, k4);
  t7 := pg_temp.temuan('hse@demo.lourdes.test', 'Workshop Service', 'JSA penggantian kompresor belum memuat titik jepit',
    'Ditemukan saat audit CSMS dan dikonfirmasi pada investigasi kejadian jari terjepit.', 'audit', 'Audit CSMS', 'documents', 'critical',
    'pengawas@demo.lourdes.test', 3);
  perform pg_temp.tindakan('finding', t7, 'Revisi JSA dan sosialisasikan', 'corrective', 'pengawas@demo.lourdes.test', 3, 'closed');
  perform pg_temp.as_user('hse@demo.lourdes.test');
  perform __APP__.finding_close(t7, 'JSA revisi sudah disahkan dan disosialisasikan');
  t2 := pg_temp.temuan('hse@demo.lourdes.test', 'Workshop Service', 'APAR workshop belum diinspeksi bulan September',
    'Label inspeksi APAR di workshop terakhir bulan Agustus.', 'inspection', 'INS-2026-0228', 'equipment_ppe', 'high', 'hse@demo.lourdes.test', 0);
  t1 := pg_temp.temuan('hse@demo.lourdes.test', 'Workshop Service', 'Padlock LOTO tidak terpasang saat perbaikan unit E5126',
    'Saat inspeksi pekerjaan perbaikan AC unit E5126 · PC2000, ditemukan teknisi melakukan pekerjaan pada panel kelistrikan tanpa memasang padlock LOTO. Tag informasi sudah tersedia, namun energi belum diamankan menggunakan padlock personal.',
    'inspection', 'INS-2026-0230', 'operational_safety', 'critical', 'pengawas@demo.lourdes.test', 2);
  perform pg_temp.tindakan('finding', t1, 'Pasang padlock LOTO pada seluruh toolkit teknisi', 'corrective', 'pengawas@demo.lourdes.test', 2, 'in_progress');
  perform pg_temp.tindakan('finding', t1, 'Sosialisasi ulang prosedur LOTO kepada tim Service AC', 'preventive', 'pjo@demo.lourdes.test', 4, 'waiting');
  perform pg_temp.tindakan('finding', t1, 'Tambahkan pemeriksaan LOTO pada checklist pengawas', 'preventive', 'pengawas@demo.lourdes.test', 1, 'closed');
  t4 := pg_temp.temuan('hse@demo.lourdes.test', 'Bay 3', 'Housekeeping area penyimpanan refrigerant belum standar',
    'Tabung refrigerant tidak diikat dan tercampur tabung kosong.', 'inspection', 'INS-2026-0222', 'housekeeping', 'medium', 'scm@demo.lourdes.test', 6);
  perform pg_temp.tindakan('finding', t4, 'Pasang rak dan rantai pengaman tabung', 'corrective', 'scm@demo.lourdes.test', 6, 'waiting');
  t3 := pg_temp.temuan('pengawas@demo.lourdes.test', 'Bay 3', 'Kotak P3K kurang perlengkapan',
    'Plester dan kassa steril habis.', 'observation', 'OBS-2026-0518', 'occupational_health', 'medium', 'hr@demo.lourdes.test', 9);
  t5 := pg_temp.temuan('pengawas@demo.lourdes.test', 'Hauling Road', 'Checklist harian unit DA54853 belum ditandatangani',
    'Checklist P2H tiga hari terakhir tanpa tanda tangan pengawas.', 'observation', 'OBS-2026-0509', 'documents', 'low',
    'karyawan@demo.lourdes.test', 11);
  perform pg_temp.tindakan('finding', t5, 'Lengkapi tanda tangan checklist P2H', 'corrective', 'karyawan@demo.lourdes.test', 11, 'open');

  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);

  -- tanggal tersebar beberapa bulan (tanpa log baru)
  alter table __APP__.incidents disable trigger incidents_log;
  alter table __APP__.findings disable trigger findings_log;
  perform pg_temp.mundur('incidents', k1, 124); perform pg_temp.mundur('incidents', k5, 90);
  perform pg_temp.mundur('incidents', k4, 75);  perform pg_temp.mundur('incidents', k2, 67);
  perform pg_temp.mundur('incidents', k3, 56);  perform pg_temp.mundur('incidents', k6, 43);
  perform pg_temp.mundur('incidents', k7, 36);  perform pg_temp.mundur('incidents', k8, 24);
  perform pg_temp.mundur('findings', t8, 25);   perform pg_temp.mundur('findings', t6, 20);
  perform pg_temp.mundur('findings', t7, 18);   perform pg_temp.mundur('findings', t2, 16);
  perform pg_temp.mundur('findings', t1, 13);   perform pg_temp.mundur('findings', t4, 11);
  perform pg_temp.mundur('findings', t3, 9);    perform pg_temp.mundur('findings', t5, 7);
  -- contoh terlambat (overdue)
  update __APP__.findings set due_date = current_date - 5 where id = t1;
  update __APP__.findings set due_date = current_date - 2 where id = t2;
  update __APP__.findings set due_date = current_date - 6 where id = t6;
  alter table __APP__.incidents enable trigger incidents_log;
  alter table __APP__.findings enable trigger findings_log;
  alter table __APP__.pica_actions disable trigger pica_actions_log;
  update __APP__.pica_actions set due_date = current_date - 3 where finding_id = t1 and status = 'in_progress';
  alter table __APP__.pica_actions enable trigger pica_actions_log;
end $$;

-- ---------- data DEMO fase 2: template checklist, inspeksi, observasi, jam kerja, kejadian LTI ----------
-- Template dari prototipe (butir APAR/P3K asli; jenis lain disusun serupa). Inspeksi lama dimasukkan
-- langsung (seed = superuser) supaya tanggal tersebar beberapa bulan; observasi lewat RPC lalu dimundurkan.
do $$
declare
  v_site uuid := (select id from public.locations where name = 'Site MIFA');
  v_site2 uuid := (select id from public.locations where name = 'Site Demo Kalimantan');
  tpl record;
begin
  if exists (select 1 from __APP__.inspection_templates) or v_site is null then
    return;
  end if;

  for tpl in
    select * from (values
      ('padlock', 'Inspeksi Padlock', 'Nomor toolkit', 'operational_safety', array[
        'Padlock personal tersedia dan dipakai setiap pekerjaan perbaikan.',
        'Tag LOTO terisi lengkap (nama, tanggal, nomor).',
        'Titik isolasi energi diidentifikasi dan dikunci.',
        'Kunci padlock hanya dipegang pemilik.',
        'Papan kontrol LOTO di workshop terpasang dan terbaca.',
        'Pekerja memahami prosedur lepas padlock.']),
      ('lv', 'Inspeksi LV', 'Nomor unit LV', 'equipment_ppe', array[
        'Kondisi ban dan tekanan angin sesuai standar.',
        'Lampu utama, sein, dan rem berfungsi.',
        'Sabuk pengaman semua kursi berfungsi.',
        'Bendera/lampu rotator terpasang dan menyala.',
        'APAR dan P3K unit tersedia dan belum kedaluwarsa.',
        'Wiper, spion, dan kaca dalam kondisi baik.',
        'Tidak ada kebocoran oli, bahan bakar, atau air.',
        'Stiker izin kendaraan (SIMPER unit) masih berlaku.']),
      ('work_equipment', 'Inspeksi Peralatan Kerja', 'Nomor peralatan', 'equipment_ppe', array[
        'Peralatan tangan tidak rusak, bergerigi, atau longgar.',
        'Kabel dan steker alat listrik utuh, tidak terkelupas.',
        'Guard pelindung alat putar terpasang.',
        'Alat angkat (sling, shackle) memiliki tag kalibrasi/inspeksi aktif.',
        'Peralatan disimpan rapi di tempat yang ditentukan.',
        'Peralatan rusak diberi tag "Jangan Dipakai".']),
      ('first_aid_fire', 'Inspeksi Kotak P3K & APAR', 'Nomor APAR / kotak P3K', 'equipment_ppe', array[
        'APAR tersedia pada lokasi yang telah ditentukan dan mudah dijangkau.',
        'Nomor identifikasi APAR sesuai dengan register peralatan.',
        'Pin pengaman dan segel APAR terpasang dalam kondisi baik.',
        'Tekanan pada pressure gauge berada di area hijau.',
        'Selang dan nozzle APAR tidak retak, tersumbat, atau rusak.',
        'Tabung APAR tidak berkarat, penyok, atau mengalami kerusakan fisik.',
        'Label instruksi penggunaan terlihat dan dapat dibaca dengan jelas.',
        'Tanggal inspeksi bulanan sebelumnya telah dicatat pada tag.',
        'Masa berlaku dan jadwal hydrotest APAR masih aktif.',
        'Area di sekitar APAR bebas dari material yang menghalangi akses.',
        'Bracket atau dudukan APAR terpasang kuat.',
        'Rambu lokasi APAR terlihat dari jarak yang memadai.',
        'Kotak P3K tersedia dan mudah diakses.',
        'Daftar isi perlengkapan P3K tersedia dan terbaru.',
        'Obat dan perlengkapan P3K belum melewati tanggal kedaluwarsa.',
        'Jumlah perlengkapan P3K sesuai dengan daftar minimum.',
        'Kotak P3K dalam kondisi bersih dan tidak rusak.',
        'Nama petugas P3K dan nomor darurat terpasang di dekat kotak.']),
      ('maintenance_obs', 'Observasi Maintenance', 'Nomor unit / WO', 'operational_safety', array[
        'JSA/instruksi kerja tersedia di lokasi pekerjaan.',
        'Pekerja memakai APD sesuai JSA.',
        'Area kerja diberi barikade dan rambu.',
        'Prosedur LOTO diterapkan sebelum pekerjaan dimulai.',
        'Limbah B3 ditempatkan di wadah yang sesuai.']),
      ('internal_audit', 'Audit Internal', 'Objek audit', 'documents', array[
        'Dokumen prosedur terkini tersedia dan dikendalikan.',
        'Rekaman inspeksi bulan berjalan lengkap.',
        'Temuan sebelumnya ditindaklanjuti sesuai due date.',
        'Pelatihan wajib pekerja masih berlaku.',
        'Izin kerja khusus (kerja panas, ketinggian) terdokumentasi.',
        'Register APD dan peralatan terbarui.',
        'Rapat K3 dilaksanakan sesuai jadwal.',
        'Tindakan korektif kejadian terdahulu tidak berulang.'])
    ) as t(type_code, name, object_label, cat, items)
  loop
    insert into __APP__.inspection_templates (type_code, name, object_label, finding_category)
    values (tpl.type_code, tpl.name, tpl.object_label, tpl.cat);
    insert into __APP__.inspection_template_items (template_id, line_no, text)
    select t.id, x.ord::integer, x.txt
      from __APP__.inspection_templates t, unnest(tpl.items) with ordinality as x(txt, ord)
     where t.name = tpl.name;
  end loop;

  -- Jam kerja bulanan (Jan sampai bulan lalu): MIFA ~95 ribu YTD, site kedua lebih kecil
  insert into __APP__.work_hours (location_id, month, hours, note)
  select v_site, m::date, 9000 + (extract(month from m)::integer * 397) % 2500, 'Data contoh'
    from generate_series(date_trunc('year', current_date), date_trunc('month', current_date) - interval '1 month', interval '1 month') m
  on conflict (location_id, month) do nothing;
  insert into __APP__.work_hours (location_id, month, hours, note)
  select v_site2, m::date, 3000 + (extract(month from m)::integer * 211) % 900, 'Data contoh'
    from generate_series(date_trunc('year', current_date), date_trunc('month', current_date) - interval '1 month', interval '1 month') m
  on conflict (location_id, month) do nothing;
end $$;

-- Jadwal & pelaksanaan inspeksi (langsung, tersebar per bulan)
create or replace function pg_temp.seed_inspection(p_tpl text, p_planned timestamptz, p_status text, p_inspector text,
  p_object text, p_area text, p_nc integer[]) returns uuid language plpgsql as $$
declare
  v_site uuid := (select id from public.locations where name = 'Site MIFA');
  t __APP__.inspection_templates;
  v_id uuid := gen_random_uuid();
  v_insp uuid := pg_temp.uid(p_inspector);
  v_sum jsonb;
begin
  select * into t from __APP__.inspection_templates where name = p_tpl;
  insert into __APP__.inspections (id, code, company_code, location_id, area_id, template_id, type_code, title, object_text,
    planned_at, inspector_id, status, started_at, submitted_at, verified_at, verified_by, summary, created_by, created_at)
  values (v_id, __APP__.next_doc_number('INS', 'GMI', 'year'), 'GMI', v_site,
    (select id from __APP__.areas where location_id = v_site and name = p_area), t.id, t.type_code, t.name, p_object,
    p_planned, v_insp, p_status,
    case when p_status in ('in_progress', 'submitted', 'verified') then p_planned end,
    case when p_status in ('submitted', 'verified') then p_planned + interval '2 hours' end,
    case when p_status = 'verified' then p_planned + interval '1 day' end,
    case when p_status = 'verified' then pg_temp.uid('hse.senior@demo.lourdes.test') end,
    null, pg_temp.uid('hse@demo.lourdes.test'), p_planned - interval '5 days');
  if p_status in ('in_progress', 'submitted', 'verified') then
    insert into __APP__.inspection_answers (inspection_id, line_no, item_text, answer)
    select v_id, i.line_no, i.text,
           case when p_status = 'in_progress' and i.line_no > 3 then null
                when i.line_no = any (p_nc) then 'noncompliant'
                when i.line_no % 7 = 0 then 'na' else 'compliant' end
      from __APP__.inspection_template_items i where i.template_id = t.id;
    if p_status in ('submitted', 'verified') then
      select jsonb_build_object('compliant', count(*) filter (where answer = 'compliant'),
             'noncompliant', count(*) filter (where answer = 'noncompliant'), 'na', count(*) filter (where answer = 'na'),
             'findings', 0) into v_sum from __APP__.inspection_answers where inspection_id = v_id;
      update __APP__.inspections set summary = v_sum where id = v_id;
    end if;
  end if;
  return v_id;
end $$;

do $$
declare
  m date; k integer; v_status text; v_planned timestamptz;
  names text[] := array['Inspeksi Padlock', 'Inspeksi LV', 'Inspeksi Peralatan Kerja', 'Inspeksi Kotak P3K & APAR',
                        'Observasi Maintenance', 'Audit Internal'];
  objs text[] := array['Toolkit #3', 'LV-07', 'Mesin bubut', 'APAR #07', 'WO-2145', 'Workshop Service'];
  areas text[] := array['Workshop Service', 'Hauling Road', 'Bay 3', 'Workshop Service', 'Pit Area', 'Workshop Service'];
  insp text[] := array['hse@demo.lourdes.test', 'pengawas@demo.lourdes.test'];
  v_today date := current_date;
  cur_first date := date_trunc('month', current_date)::date;
begin
  if exists (select 1 from __APP__.inspections) then return; end if;
  -- Bulan lalu-lalu (6 bulan ke belakang): 5-6 jadwal per bulan, hampir semua terlaksana
  for m in select (cur_first - (n || ' months')::interval)::date from generate_series(6, 1, -1) n loop
    for k in 1..(5 + (extract(month from m)::integer % 2)) loop
      v_planned := ((m + (k * 4 - 1))::timestamp + time '08:00') at time zone 'Asia/Jakarta';
      v_status := case when k = 3 and extract(month from m)::integer % 3 = 0 then 'scheduled'     -- terlewat (terlambat)
                       when k = 5 and extract(month from m)::integer % 4 = 0 then 'cancelled'
                       when k % 2 = 0 then 'verified' else 'submitted' end;
      perform pg_temp.seed_inspection(names[(k - 1) % 6 + 1], v_planned, v_status, insp[k % 2 + 1], objs[(k - 1) % 6 + 1],
        areas[(k - 1) % 6 + 1], case when k % 3 = 1 then array[2] else array[]::integer[] end);
    end loop;
  end loop;
  -- Bulan berjalan: yang sudah lewat terlaksana, hari ini berjalan, sisanya terjadwal
  for k in 1..6 loop
    v_planned := ((cur_first + (k * 4 - 2))::timestamp + time '08:30') at time zone 'Asia/Jakarta';
    v_status := case when v_planned::date < v_today - 1 and k % 5 <> 0 then (case when k % 2 = 0 then 'verified' else 'submitted' end)
                     when v_planned::date < v_today then 'scheduled'
                     when v_planned::date = v_today then 'in_progress'
                     else 'scheduled' end;
    perform pg_temp.seed_inspection(names[(k - 1) % 6 + 1], v_planned, v_status, insp[k % 2 + 1], objs[(k - 1) % 6 + 1],
      areas[(k - 1) % 6 + 1], case when k = 4 then array[4, 9] else array[]::integer[] end);
  end loop;
  -- Bulan depan: beberapa jadwal (kalender)
  for k in 1..3 loop
    perform pg_temp.seed_inspection(names[k * 2 - 1], (((cur_first + interval '1 month')::date + (k * 7 - 3))::timestamp + time '09:00') at time zone 'Asia/Jakarta',
      'scheduled', insp[k % 2 + 1], objs[k * 2 - 1], areas[k * 2 - 1], array[]::integer[]);
  end loop;
end $$;

-- Observasi KTA/TTA (RPC sebagai persona, lalu dimundurkan) + satu kejadian LTI untuk KPI
do $$
declare
  v_site uuid := (select id from public.locations where name = 'Site MIFA');
  v_obs uuid; i integer; k9 uuid;
  who text[] := array['karyawan@demo.lourdes.test', 'pengawas@demo.lourdes.test', 'hse@demo.lourdes.test', 'karyawan@demo.lourdes.test'];
  descr text[] := array['Kabel ekstensi melintang di jalur pejalan', 'Teknisi bekerja tanpa kacamata pengaman',
    'Tumpahan oli di dekat bay 3 belum dibersihkan', 'Tangga kerja tidak diikat saat dipakai', 'Tabung gas disimpan tanpa rantai pengaman',
    'Pekerja mengangkat beban berat tanpa alat bantu', 'Lampu penerangan area parkir mati', 'Rambu jalur evakuasi terhalang material'];
begin
  if exists (select 1 from __APP__.observations) or v_site is null then return; end if;
  for i in 1..8 loop
    perform pg_temp.as_user(who[(i - 1) % 4 + 1]);
    v_obs := (__APP__.observation_submit(jsonb_build_object('location_id', v_site,
      'area_id', (select id from __APP__.areas where location_id = v_site and name = (array['Workshop Service', 'Bay 3', 'Pit Area', 'Hauling Road'])[(i - 1) % 4 + 1]),
      'kind', case when i % 3 = 0 then 'tta' else 'kta' end, 'description', descr[i],
      'immediate_action', case when i % 2 = 0 then 'Area diamankan sementara' end,
      'followup', i in (3, 6), 'risk_level', 'medium', 'pic_id', pg_temp.uid('pengawas@demo.lourdes.test'),
      'due_date', (current_date + 6)::text)) ->> 'id')::uuid;
    update __APP__.observations set observed_at = observed_at - make_interval(days => i * 8),
           created_at = created_at - make_interval(days => i * 8) where id = v_obs;
  end loop;

  -- Kejadian LTI ±50 hari lalu (3 hari kerja hilang): nilai nyata untuk LTIFR/LTISR
  perform pg_temp.as_user('karyawan@demo.lourdes.test');
  k9 := (__APP__.incident_report(jsonb_build_object('location_id', v_site,
    'area_id', (select id from __APP__.areas where location_id = v_site and name = 'Workshop Service'),
    'occurred_at', now()::text, 'category', 'injury', 'description', 'Pergelangan tangan keseleo saat mengangkat kompresor',
    'unit_code', 'E5126', 'unit_label', 'PC2000')) ->> 'id')::uuid;
  perform pg_temp.as_user('hse@demo.lourdes.test');
  perform __APP__.incident_classify(k9, jsonb_build_object('category', 'injury', 'injury_class', 'lost_time',
    'severity', 'medium', 'potential_severity', 'high',
    'restricted', jsonb_build_object('injury_type', 'Keseleo', 'body_parts', jsonb_build_array('Tangan kanan'),
      'treatment', 'clinic', 'facility', 'Klinik Site MIFA', 'lost_days', 3, 'restricted_days', 5)));
  perform pg_temp.mundur('incidents', k9, 50);
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
end $$;

-- ---------- dokumen contoh Pengajuan (draf) supaya list/QA punya data setelah reset ----------
do $$
declare v_u record; i integer;
begin
  if exists (select 1 from __APP__.pengajuan) then return; end if;
  for v_u in select p.id, p.company, p.department_id, p.email from public.profiles p
              where p.email in ('budi@demo.lourdes.test', 'sari@demo.lourdes.test') loop
    perform pg_temp.as_user(v_u.email);
    for i in 1..3 loop
      perform __APP__.pengajuan_save(null, jsonb_build_object(
        'company_code', v_u.company, 'department_id', v_u.department_id,
        'title', format('Contoh QA %s #%s', split_part(v_u.email, '@', 1), i), 'needed_date', (current_date + 14)::text,
        'items', jsonb_build_array(jsonb_build_object('item_name', 'Sarung tangan', 'qty', 10, 'unit', 'pasang', 'unit_price', 25000))));
    end loop;
  end loop;
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
end $$;

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

-- ---------- data DEMO fase 3: program TSP, realisasi, aktivitas K3 (dari prototipe tsp-management) ----------
-- Dimasukkan langsung (seed = superuser) supaya capaian tersebar beberapa bulan. Tahun = tahun berjalan.
do $$
declare
  v_site uuid := (select id from public.locations where name = 'Site MIFA');
  v_year smallint := extract(year from current_date)::smallint;
  v_hse uuid := (select id from public.profiles where email = 'hse@demo.lourdes.test');
  v_peng uuid := (select id from public.profiles where email = 'pengawas@demo.lourdes.test');
  v_prog uuid;
  p record;
  m integer;
  v_n integer := 0;
begin
  if v_site is null or v_hse is null or exists (select 1 from __APP__.tsp_programs) then
    return;
  end if;
  alter table __APP__.tsp_programs disable trigger tsp_programs_log;
  alter table __APP__.tsp_realizations disable trigger tsp_realizations_log;
  alter table __APP__.safety_activities disable trigger safety_activities_log;
  for p in
    select * from (values
      ('1.1',  '1. Kebijakan',     'Tinjauan Kebijakan',                 'PJO',            'Kebijakan ditinjau, dibuktikan daftar hadir dan notulen', 'Jadwal Rapat Tinjauan Manajemen', 1,  '{0,0,0,0,0,0,0,0,1,0,0,0}', '{0,0,0,0,0,0,0,0,1,0,0,0}', -1),
      ('1.2',  '1. Kebijakan',     'Komunikasi Kebijakan SMT',           'All Departemen', '1x per bulan saat General Safety Talk',                   'Daftar Hadir dan Dokumentasi',     12, '{1,1,1,1,1,1,1,1,1,1,1,1}', '{1,1,1,1,1,0,1,1,1,0,0,0}', 6),
      ('1.3',  '1. Kebijakan',     'Pemasangan Kebijakan SMT',           'All Departemen', 'Kebijakan terpasang di area kerja dan office',            'Foto Pemasangan',                  12, '{1,1,1,1,1,1,1,1,1,1,1,1}', '{1,1,1,1,1,1,1,1,0,1,0,0}', -1),
      ('2.1',  '2. Perencanaan',   'Review IBPR',                        'All Departemen', 'Review IBPR dilakukan 2x per tahun',                      'IBPR, Daftar Hadir, MOM',          2,  '{0,0,0,1,0,0,0,0,0,1,0,0}', '{0,0,0,1,0,0,0,0,0,0,0,0}', -1),
      ('2.1A', '2. Perencanaan',   'Review Top 10 High Risk Activity',   'All Departemen', 'Top 10 risiko tinggi diperbarui per semester',            'Register Risiko dan MOM',          2,  '{0,0,1,0,0,0,0,0,0,1,0,0}', '{0,0,1,0,0,0,0,0,0,0,0,0}', -1),
      ('2.2',  '2. Perencanaan',   'Komunikasi dan Konsultasi Risiko',   'PJO',            'Konsultasi risiko dengan seluruh bagian',                 'Daftar Hadir, Dokumentasi, MOM',   2,  '{0,0,0,0,1,0,0,0,0,0,1,0}', '{0,0,0,0,1,0,0,0,0,0,0,0}', -1),
      ('3.5',  '3. Implementasi',  'Kampanye K3',                        'HSE',            'Kampanye tematik dilaksanakan per kuartal',               'Materi, Daftar Hadir, Dokumentasi',4,  '{0,0,1,0,0,1,0,0,1,0,0,1}', '{0,0,1,0,0,1,0,0,0,0,0,0}', -1),
      ('3.7',  '3. Implementasi',  'Pelatihan Penggunaan APD',           'HSE',            'Seluruh pekerja mengikuti refresh penggunaan APD',        'Daftar Hadir dan Evaluasi',        2,  '{0,0,0,1,0,0,0,0,0,0,0,1}', '{0,0,0,1,0,0,0,0,0,0,0,0}', 4),
      ('3.8',  '3. Implementasi',  'Program Induksi SMT',                'HSE',            'Induksi diberikan kepada pekerja baru dan visitor',       'Form Induksi dan Dokumentasi',     12, '{1,1,1,1,1,1,1,1,1,1,1,1}', '{1,1,1,1,1,1,1,0,1,1,0,0}', -1)
    ) as t(no, element, name, owner, indicator, evidence, target, plan, actuals, nofile)
  loop
    v_n := v_n + 1;
    insert into __APP__.tsp_programs (company_code, location_id, year, no, element, name, owner_label, indicator,
      evidence_required, annual_target, plan, sort_order, created_by)
    values ('GMI', v_site, v_year, p.no, p.element, p.name, p.owner, p.indicator, p.evidence, p.target,
      p.plan::smallint[], v_n * 10, v_hse)
    returning id into v_prog;
    for m in 1..11 loop
      if (p.actuals::integer[])[m] > 0 then
        insert into __APP__.tsp_realizations (program_id, month, actual, evidence_count, created_by, updated_by)
        values (v_prog, m, (p.actuals::integer[])[m], case when p.nofile = m then 0 else 1 end, v_hse, v_hse);
      end if;
    end loop;
    if p.no = '3.7' then
      update __APP__.tsp_realizations set note = 'Refresh APD gelombang kedua dijadwalkan Desember.' where program_id = v_prog and month = 4;
    end if;
  end loop;
  update __APP__.tsp_realizations r set note = 'Daftar hadir Juni belum dilengkapi.'
    from __APP__.tsp_programs g where g.id = r.program_id and g.no = '1.2' and r.month = 6;

  -- aktivitas K3 (sebagian terhubung ke program; bulan berjalan)
  insert into __APP__.safety_activities (code, company_code, location_id, area_id, type_code, activity_date, leader_id,
    participant_count, program_id, notes, evidence_count, created_by)
  select __APP__.next_doc_number('AKT', 'GMI', 'year'), 'GMI', v_site,
         (select id from __APP__.areas where location_id = v_site and name = x.area limit 1), x.type, current_date - x.ago,
         x.leader, x.peserta,
         (select id from __APP__.tsp_programs where year = v_year and location_id = v_site and no = x.prog), x.catatan, x.ev, x.leader
    from (values
      (1, 'Workshop Service', 'safety_talk',      3,  v_hse,  32, '1.2', 'Safety talk mingguan: LOTO dan pengamanan energi.', 2),
      (2, 'Workshop Service', 'sosialisasi_jsa',  9,  v_hse,  18, '2.2', 'Sosialisasi JSA pekerjaan panel kelistrikan.', 1),
      (3, 'Workshop Service', 'sosialisasi_ik',  14,  v_peng, 21, '3.7', 'Sosialisasi IK penggunaan APD.', 0),
      (4, 'Workshop Service', 'sosialisasi_sop', 20,  v_hse,  14, '3.8', 'Sosialisasi SOP induksi pekerja baru.', 1),
      (5, 'Workshop Service', 'kampanye_k3',     25,  v_hse,  34, '3.5', 'Kampanye tematik keselamatan berkendara.', 3),
      (6, 'Workshop Service', 'inspeksi_bersama',30,  v_peng,  8, '2.1', 'Inspeksi bersama area hauling.', 1)
    ) as x(n, area, type, ago, leader, peserta, prog, catatan, ev);
  alter table __APP__.tsp_programs enable trigger tsp_programs_log;
  alter table __APP__.tsp_realizations enable trigger tsp_realizations_log;
  alter table __APP__.safety_activities enable trigger safety_activities_log;
end $$;

-- ---------- data DEMO fase 3: template approval Laporan Periode (D9: template + approver per langkah) ----------
do $$
declare v_tpl uuid;
begin
  if not exists (select 1 from __APP__.approval_templates where doc_type = 'laporan') then
    insert into __APP__.approval_templates (doc_type, name, description, priority)
    values ('laporan', 'Laporan Periode standar', 'Review pemilik data (HSE Senior) → PJO → Manajemen (DEMO)', 0)
    returning id into v_tpl;
    insert into __APP__.approval_template_steps (template_id, step_no, approval_type, approver_kind, approver_id, due_hours)
    values (v_tpl, 1, 'memeriksa',  'user', (select id from public.profiles where email = 'hse.senior@demo.lourdes.test'), 48),
           (v_tpl, 2, 'menyetujui', 'user', (select id from public.profiles where email = 'pjo@demo.lourdes.test'), 48),
           (v_tpl, 3, 'menyetujui', 'user', (select id from public.profiles where email = 'manajemen@demo.lourdes.test'), 72);
  end if;
end $$;

-- ---------- data DEMO fase 4A: manpower, kompetensi, sertifikat, MCU, permit (dari prototipe people-compliance) ----------
do $$
declare
  v_site uuid := (select id from public.locations where name = 'Site MIFA');
  v_hr uuid := (select id from public.profiles where email = 'hr@demo.lourdes.test');
  e record;
  c record;
begin
  if v_site is null or v_hr is null or exists (select 1 from __APP__.employees) then return; end if;
  alter table __APP__.employees disable trigger employees_log;
  alter table __APP__.certificates disable trigger certificates_log;
  alter table __APP__.mcu_records disable trigger mcu_records_log;
  alter table __APP__.site_permits disable trigger site_permits_log;
  alter table __APP__.competencies disable trigger competencies_log;
  alter table __APP__.position_requirements disable trigger position_requirements_log;

  insert into __APP__.competencies (code, name, job_titles, sort_order) values
    ('k3_umum', 'K3 Umum', array['Teknisi AC', 'Pengawas Service', 'HSE Officer', 'Planner', 'Admin Gudang', 'Mekanik'], 10),
    ('p3k', 'P3K', array['Teknisi AC', 'Pengawas Service', 'HSE Officer', 'Mekanik'], 20),
    ('pemadam', 'Pemadam Kebakaran', array['Teknisi AC', 'Pengawas Service', 'HSE Officer'], 30),
    ('teknisi_refrigerasi', 'Teknisi Refrigerasi/AC', array['Teknisi AC'], 40),
    ('pengawas_pertama', 'Pengawas Operasional Pertama', array['Pengawas Service'], 50),
    ('bmc', 'BMC', array['Teknisi AC', 'Pengawas Service', 'HSE Officer', 'Planner', 'Mekanik'], 60);

  insert into __APP__.position_requirements (company_code, location_id, job_title, required) values
    ('GMI', v_site, 'Teknisi AC', 12), ('GMI', v_site, 'Mekanik', 8), ('GMI', v_site, 'Planner', 3),
    ('GMI', v_site, 'Admin Gudang', 4), ('GMI', v_site, 'HSE Officer', 3), ('GMI', v_site, 'Pengawas Service', 5);

  for e in
    select * from (values
      ('GMI-0017', 'Rudi Hartono',   'Teknisi AC',       'Service AC',     'PKWT',  date '2024-02-12', 'karyawan@demo.lourdes.test'),
      ('GMI-0004', 'Fajar Nugroho',  'Pengawas Service', 'Service AC',     'PKWTT', date '2021-01-03', 'pengawas@demo.lourdes.test'),
      ('GMI-0008', 'Andi Pratama',   'HSE Officer',      'HSE',            'PKWTT', date '2022-03-15', 'hse@demo.lourdes.test'),
      ('GMI-0011', 'Hendra Wijaya',  'Planner',          'Planner',        'PKWTT', date '2022-08-08', 'maintenance@demo.lourdes.test'),
      ('GMI-0021', 'Sari Wulandari', 'Admin Gudang',     'Warehouse/SCM',  'PKWTT', date '2023-05-02', 'scm@demo.lourdes.test'),
      ('GMI-0024', 'Agus Setiawan',  'Teknisi AC',       'Service AC',     'PKWTT', date '2023-09-18', null),
      ('GMI-0030', 'Bayu Kurniawan', 'Mekanik',          'Workshop',       'PKWT',  date '2025-01-06', null),
      ('GMI-0031', 'Dedi Saputra',   'Mekanik',          'Workshop',       'PKWT',  date '2025-01-06', null)
    ) as t(code, name, job, dept, emp, joined, email)
  loop
    insert into __APP__.employees (company_code, location_id, code, name, job_title, department, employment, join_date, profile_id, created_by)
    values ('GMI', v_site, e.code, e.name, e.job, e.dept, e.emp, e.joined, (select id from public.profiles where email = e.email), v_hr);
  end loop;

  for c in
    select * from (values
      ('GMI-0017', 'teknisi_refrigerasi', 'BNSP-TRU-2024-01872', 'BNSP', date '2024-03-15', current_date + 500),
      ('GMI-0017', 'k3_umum', 'K3U/2024/0912', 'Kemnaker RI', date '2024-04-20', current_date + 535),
      ('GMI-0017', 'pemadam', 'DAMKAR-D/2025/027', 'Disnaker Aceh Barat', date '2025-02-10', current_date + 467),
      ('GMI-0017', 'bmc', 'BMC-2025-1182', 'PT MIFA Bersaudara', date '2025-06-05', current_date + 14),
      ('GMI-0004', 'k3_umum', 'K3U/2023/0455', 'Kemnaker RI', date '2023-02-01', current_date + 700),
      ('GMI-0004', 'p3k', 'P3K/2024/118', 'PMI', date '2024-05-01', current_date + 400),
      ('GMI-0004', 'pemadam', 'DAMKAR-D/2024/009', 'Disnaker', date '2024-06-01', current_date + 450),
      ('GMI-0004', 'pengawas_pertama', 'POP/2022/771', 'Kemnaker RI', date '2022-07-01', current_date + 480),
      ('GMI-0004', 'bmc', 'BMC-2025-0990', 'PT MIFA Bersaudara', date '2025-03-01', current_date + 25),
      ('GMI-0008', 'k3_umum', 'K3U/2022/0111', 'Kemnaker RI', date '2022-03-01', current_date + 900),
      ('GMI-0008', 'bmc', 'BMC-2025-0770', 'PT MIFA Bersaudara', date '2025-08-01', current_date + 300),
      ('GMI-0011', 'k3_umum', 'K3U/2021/0600', 'Kemnaker RI', date '2021-03-01', current_date - 30),
      ('GMI-0011', 'bmc', 'BMC-2025-0881', 'PT MIFA Bersaudara', date '2025-09-01', current_date + 330),
      ('GMI-0021', 'k3_umum', 'K3U/2023/0777', 'Kemnaker RI', date '2023-06-01', current_date + 20),
      ('GMI-0024', 'k3_umum', 'K3U/2024/0333', 'Kemnaker RI', date '2024-02-01', current_date + 400),
      ('GMI-0024', 'p3k', 'P3K/2024/200', 'PMI', date '2024-02-01', current_date + 400),
      ('GMI-0024', 'pemadam', 'DAMKAR-D/2024/050', 'Disnaker', date '2024-02-01', current_date + 18),
      ('GMI-0024', 'teknisi_refrigerasi', 'BNSP-TRU-2024-02000', 'BNSP', date '2024-02-01', current_date + 400),
      ('GMI-0024', 'bmc', 'BMC-2025-1000', 'PT MIFA Bersaudara', date '2025-02-01', current_date + 400)
    ) as t(nik, comp, num, issuer, issued, until)
  loop
    insert into __APP__.certificates (employee_id, competency_id, number, issuer, issued_on, valid_until, created_by)
    values ((select id from __APP__.employees where code = c.nik), (select id from __APP__.competencies where code = c.comp), c.num, c.issuer, c.issued, c.until, v_hr);
  end loop;

  for c in
    select * from (values
      ('GMI-0017', current_date - 350, current_date + 18,  'fit',      null),
      ('GMI-0004', current_date - 240, current_date + 125, 'fit',      null),
      ('GMI-0008', current_date - 124, current_date + 241, 'fit',      null),
      ('GMI-0011', current_date - 311, current_date + 54,  'fit_note', 'Hipertensi derajat 1, kontrol rutin'),
      ('GMI-0021', current_date - 400, current_date - 35,  'fit',      null)
    ) as t(nik, checked, until, res, diag)
  loop
    with m as (insert into __APP__.mcu_records (employee_id, checked_on, valid_until, result, created_by)
               values ((select id from __APP__.employees where code = c.nik), c.checked, c.until, c.res, v_hr) returning id)
    insert into __APP__.mcu_restricted (mcu_id, diagnosis) select m.id, c.diag from m;
  end loop;

  insert into __APP__.site_permits (employee_id, name, number, valid_until, created_by)
  select e2.id, 'Izin Masuk Site', 'IMS/' || e2.code,
         current_date + (case e2.code when 'GMI-0017' then 64 when 'GMI-0004' then 21 when 'GMI-0008' then 186 else 90 end), v_hr
    from __APP__.employees e2;

  alter table __APP__.employees enable trigger employees_log;
  alter table __APP__.certificates enable trigger certificates_log;
  alter table __APP__.mcu_records enable trigger mcu_records_log;
  alter table __APP__.site_permits enable trigger site_permits_log;
  alter table __APP__.competencies enable trigger competencies_log;
  alter table __APP__.position_requirements enable trigger position_requirements_log;
end $$;

-- ---------- data DEMO fase 4B: pelatihan (dari prototipe people-compliance) ----------
do $$
declare
  v_site uuid := (select id from public.locations where name = 'Site MIFA');
  v_hr uuid := (select id from public.profiles where email = 'hr@demo.lourdes.test');
  v_id uuid;
  r record;
begin
  if v_site is null or v_hr is null or exists (select 1 from __APP__.trainings) then return; end if;
  alter table __APP__.trainings disable trigger trainings_log;
  for r in
    select * from (values
      ('BMC Refresh Batch 2', 'bmc', 'PT MIFA Bersaudara', 'Ruang Training MIFA', current_date + 12, current_date + 12, 'planned', array['GMI-0017', 'GMI-0004', 'GMI-0024']),
      ('P3K & Pemadam Dasar', 'p3k', 'PMI Aceh Barat', 'Aula Site', current_date + 30, current_date + 31, 'planned', array['GMI-0017', 'GMI-0030', 'GMI-0031']),
      ('K3 Umum Kemnaker', 'k3_umum', 'Kemnaker RI', 'Online', current_date - 20, current_date - 18, 'done', array['GMI-0011', 'GMI-0021'])
    ) as t(title, comp, provider, venue, s, e, st, niks)
  loop
    v_id := gen_random_uuid();
    insert into __APP__.trainings (id, company_code, location_id, code, title, competency_id, provider, venue, starts_on, ends_on, capacity, status, created_by)
    values (v_id, 'GMI', v_site, __APP__.next_doc_number('TRN', 'GMI', 'year'), r.title, (select id from __APP__.competencies where code = r.comp),
            r.provider, r.venue, r.s, r.e, 20, r.st, v_hr);
    insert into __APP__.training_participants (training_id, employee_id, attendance)
    select v_id, e.id, case when r.st = 'done' then 'present' else 'registered' end from __APP__.employees e where e.code = any (r.niks);
  end loop;
  alter table __APP__.trainings enable trigger trainings_log;
end $$;

-- ---------- data DEMO fase 4C: kontraktor (izin, kontrak, CSMS, checklist), PJO/PJA ----------
do $$
declare
  v_hr uuid := (select id from public.profiles where email = 'hr@demo.lourdes.test');
  v_site uuid := (select id from public.locations where name = 'Site MIFA');
  c record; v_c uuid;
begin
  if v_hr is null or v_site is null or exists (select 1 from __APP__.contractor_permits) then return; end if;
  alter table __APP__.contractor_permits disable trigger contractor_permits_log;
  alter table __APP__.contractor_contracts disable trigger contractor_contracts_log;
  alter table __APP__.csms_assessments disable trigger csms_assessments_log;
  alter table __APP__.contractor_documents disable trigger contractor_documents_log;
  alter table __APP__.pjo_pja_appointments disable trigger pjo_pja_appointments_log;

  update __APP__.contractors set pic_name = 'Budi Santoso', pic_contact = '0812-0000-0001' where name = 'PT Sinar Teknik Mandiri';
  update __APP__.contractors set pic_name = 'Rina Marlina', pic_contact = '0812-0000-0002' where name = 'PT Cipta Lingkungan Aceh';

  for c in
    select * from (values
      ('PT Sinar Teknik Mandiri', 'NIB', 'NIB-8120001', 'OSS RBA', current_date + 400),
      ('PT Sinar Teknik Mandiri', 'SBU Jasa Konstruksi', 'SBU-0021/2025', 'LPJK', current_date + 20),
      ('PT Cipta Lingkungan Aceh', 'NIB', 'NIB-8120077', 'OSS RBA', current_date + 600),
      ('PT Cipta Lingkungan Aceh', 'Izin Pengelolaan Limbah', 'IPL-114/2024', 'DLH Aceh', current_date - 12),
      ('PT Bara Safety Indonesia', 'NIB', 'NIB-8120123', 'OSS RBA', current_date + 300)
    ) as t(mitra, name, num, issuer, until)
  loop
    insert into __APP__.contractor_permits (contractor_id, name, number, issuer, valid_until, created_by)
    values ((select id from __APP__.contractors where name = c.mitra), c.name, c.num, c.issuer, c.until, v_hr);
  end loop;

  for c in
    select * from (values
      ('PT Sinar Teknik Mandiri', 'KTR/GMI/2025/014', 'Jasa Perawatan Unit AC Site MIFA', current_date - 200, current_date + 165, 480000000),
      ('PT Cipta Lingkungan Aceh', 'KTR/GMI/2025/021', 'Pengelolaan Limbah B3', current_date - 100, current_date + 265, 215000000)
    ) as t(mitra, num, title, s, e, amount)
  loop
    insert into __APP__.contractor_contracts (contractor_id, number, title, starts_on, ends_on, created_by)
    values ((select id from __APP__.contractors where name = c.mitra), c.num, c.title, c.s, c.e, v_hr);
    insert into __APP__.contractor_contract_values (contract_id, amount)
    select k.id, c.amount from __APP__.contractor_contracts k where k.number = c.num;
  end loop;

  insert into __APP__.csms_assessments (contractor_id, assessed_on, score, result, valid_until, note, created_by) values
    ((select id from __APP__.contractors where name = 'PT Sinar Teknik Mandiri'), current_date - 90, 86, 'pass', current_date + 275, null, v_hr),
    ((select id from __APP__.contractors where name = 'PT Cipta Lingkungan Aceh'), current_date - 60, 67, 'conditional', current_date + 305, 'Perlu perbaikan prosedur tanggap darurat', v_hr);

  for c in select id, name from __APP__.contractors where name in ('PT Sinar Teknik Mandiri', 'PT Cipta Lingkungan Aceh') loop
    insert into __APP__.contractor_documents (contractor_id, type_id, status)
    select c.id, t.id, case when t.code in ('akta', 'nib', 'npwp') or c.name like '%Sinar%' then 'received' else 'pending' end
      from __APP__.contractor_doc_types t;
  end loop;

  insert into __APP__.pjo_pja_appointments (company_code, location_id, employee_id, role, scope, sk_number, starts_on, valid_until, created_by) values
    ('GMI', v_site, (select id from __APP__.employees where code = 'GMI-0004'), 'pja', 'Area Workshop Service', 'SK/GMI/K3/2025/011', current_date - 120, current_date + 245, v_hr),
    ('GMI', v_site, (select id from __APP__.employees where code = 'GMI-0008'), 'pjo', 'Operasional Site MIFA', 'SK/GMI/K3/2025/003', current_date - 300, current_date + 25, v_hr);

  alter table __APP__.contractor_permits enable trigger contractor_permits_log;
  alter table __APP__.contractor_contracts enable trigger contractor_contracts_log;
  alter table __APP__.csms_assessments enable trigger csms_assessments_log;
  alter table __APP__.contractor_documents enable trigger contractor_documents_log;
  alter table __APP__.pjo_pja_appointments enable trigger pjo_pja_appointments_log;
end $$;

-- ---------- data DEMO fase 4D: dokumen terkendali, peraturan, register KO ----------
do $$
declare
  v_hse uuid := (select id from public.profiles where email = 'hse@demo.lourdes.test');
  v_site uuid := (select id from public.locations where name = 'Site MIFA');
  v_tpl uuid; d record; v_doc uuid; v_rev uuid;
begin
  if v_hse is null or v_site is null or exists (select 1 from __APP__.controlled_documents) then return; end if;
  alter table __APP__.controlled_documents disable trigger controlled_documents_log;
  alter table __APP__.document_revisions disable trigger document_revisions_log;
  alter table __APP__.regulations disable trigger regulations_log;
  alter table __APP__.regulation_evaluations disable trigger regulation_evaluations_log;
  alter table __APP__.ko_register disable trigger ko_register_log;

  if not exists (select 1 from __APP__.approval_templates where doc_type = 'document_revision') then
    insert into __APP__.approval_templates (doc_type, name, description, priority)
    values ('document_revision', 'Revisi dokumen standar', 'HSE Senior memeriksa → PJO menyetujui (DEMO)', 0) returning id into v_tpl;
    insert into __APP__.approval_template_steps (template_id, step_no, approval_type, approver_kind, approver_id, due_hours)
    values (v_tpl, 1, 'memeriksa',  'user', (select id from public.profiles where email = 'hse.senior@demo.lourdes.test'), 48),
           (v_tpl, 2, 'menyetujui', 'user', (select id from public.profiles where email = 'pjo@demo.lourdes.test'), 48);
  end if;

  for d in
    select * from (values
      ('SOP-HSE-001', 'Pelaporan dan Investigasi Kejadian', 'sop', array['Teknisi AC', 'Pengawas Service', 'HSE Officer', 'Mekanik']),
      ('IK-HSE-014', 'Penguncian Energi (LOTO)', 'ik', array['Teknisi AC', 'Mekanik']),
      ('FRM-HSE-009', 'Form Izin Kerja Panas', 'form', array[]::text[])
    ) as t(code, title, kind, titles)
  loop
    insert into __APP__.controlled_documents (company_code, code, title, kind, owner_id, distribute_titles, created_by)
    values ('GMI', d.code, d.title, d.kind, v_hse, d.titles, v_hse) returning id into v_doc;
    if d.code = 'SOP-HSE-001' then
      insert into __APP__.document_revisions (document_id, rev_no, change_summary, status, effective_on, review_due_on, created_by) values
        (v_doc, 1, 'Penerbitan awal', 'obsolete', current_date - 400, current_date - 35, v_hse);
      insert into __APP__.document_revisions (document_id, rev_no, change_summary, status, effective_on, review_due_on, created_by)
      values (v_doc, 2, 'Penambahan batas waktu pelaporan 2 jam dan klasifikasi awal oleh HSE.', 'approved', current_date - 120, current_date + 245, v_hse) returning id into v_rev;
    elsif d.code = 'IK-HSE-014' then
      insert into __APP__.document_revisions (document_id, rev_no, change_summary, status, effective_on, review_due_on, created_by)
      values (v_doc, 1, 'Penerbitan awal', 'approved', current_date - 400, current_date - 35, v_hse) returning id into v_rev;
    else
      insert into __APP__.document_revisions (document_id, rev_no, change_summary, status, effective_on, review_due_on, created_by)
      values (v_doc, 1, 'Penerbitan awal', 'approved', current_date - 200, current_date + 165, v_hse) returning id into v_rev;
      insert into __APP__.document_revisions (document_id, rev_no, change_summary, created_by)
      values (v_doc, 2, 'Tambah kolom pemeriksaan APAR di lokasi kerja.', v_hse);
    end if;
    insert into __APP__.document_acknowledgements (revision_id, user_id, employee_id, acknowledged_at)
    select v_rev, e.profile_id, e.id,
           case when e.code in ('GMI-0004', 'GMI-0008') or d.code = 'IK-HSE-014' then now() - interval '30 days' end
      from __APP__.employees e
     where e.status = 'active' and e.profile_id is not null and e.job_title = any (d.titles);
  end loop;

  insert into __APP__.regulations (company_code, code, title, issuer, issued_on, created_by) values
    ('GMI', 'Kepmen ESDM 1827 K/30/MEM/2018', 'Pedoman Pelaksanaan Kaidah Teknik Pertambangan yang Baik', 'Kementerian ESDM', date '2018-05-07', v_hse),
    ('GMI', 'PP 50 Tahun 2012', 'Penerapan Sistem Manajemen Keselamatan dan Kesehatan Kerja', 'Pemerintah RI', date '2012-04-12', v_hse);
  insert into __APP__.regulation_evaluations (regulation_id, location_id, clause, requirement, compliance, evaluated_on, follow_up, next_review_on, evaluator_id) values
    ((select id from __APP__.regulations where code like 'Kepmen%'), v_site, 'Lampiran IV.2', 'Pemeriksaan berkala peralatan angkat dan angkut oleh tenaga bersertifikat.', 'partial', current_date - 20, 'Lengkapi sertifikat operator crane workshop dan jadwalkan uji ulang.', current_date + 70, v_hse),
    ((select id from __APP__.regulations where code like 'Kepmen%'), v_site, 'Lampiran IV.5', 'Penyediaan kotak P3K dan APAR sesuai jumlah pekerja di setiap area.', 'compliant', current_date - 20, null, current_date + 160, v_hse),
    ((select id from __APP__.regulations where code like 'PP 50%'), v_site, 'Pasal 12', 'Pelaksanaan audit internal SMK3 minimal satu kali setahun.', 'non_compliant', current_date - 45, 'Susun jadwal audit internal dan tunjuk auditor internal bersertifikat.', current_date + 30, v_hse);

  insert into __APP__.ko_register (company_code, location_id, code, title, kind, number, owner_id, valid_until, created_by) values
    ('GMI', v_site, __APP__.next_doc_number('KO', 'GMI', 'year'), 'Izin Operasi Workshop Service', 'izin_operasi', 'IO/GMI/2025/007', v_hse, current_date + 200, v_hse),
    ('GMI', v_site, __APP__.next_doc_number('KO', 'GMI', 'year'), 'Sertifikasi Layak Operasi Crane Workshop', 'sertifikasi_alat', 'SLO-CR-0412', v_hse, current_date + 25, v_hse),
    ('GMI', v_site, __APP__.next_doc_number('KO', 'GMI', 'year'), 'Uji Instalasi Penyalur Petir', 'sertifikasi_alat', 'IPP-2024-118', v_hse, current_date - 10, v_hse);

  alter table __APP__.controlled_documents enable trigger controlled_documents_log;
  alter table __APP__.document_revisions enable trigger document_revisions_log;
  alter table __APP__.regulations enable trigger regulations_log;
  alter table __APP__.regulation_evaluations enable trigger regulation_evaluations_log;
  alter table __APP__.ko_register enable trigger ko_register_log;
end $$;

-- ---------- data DEMO fase 5: cermin data maintenance (unit, downtime, PS, backlog) ----------
-- Periode inti = BULAN LALU (selalu penuh) + sedikit bulan ini. Kunci sumber 'seed-*' (impor ulang idempoten).
do $$
declare
  v_site uuid := (select id from public.locations where name = 'Site MIFA');
  v_p date := (date_trunc('month', current_date) - interval '1 month')::date;
  v_cur date := date_trunc('month', current_date)::date;
begin
  if v_site is null or exists (select 1 from __APP__.mnt_units) then return; end if;
  insert into __APP__.mnt_units (company_code, location_id, code, model, status) values
    ('GMI', v_site, 'EX-201', 'Excavator PC400', 'active'),
    ('GMI', v_site, 'HD-301', 'Dump Truck HD785', 'active'),
    ('GMI', v_site, 'DZ-101', 'Dozer D85', 'breakdown'),
    ('GMI', v_site, 'LV-12', 'Light Vehicle Hilux', 'active'),
    ('GMI', v_site, 'GS-05', 'Genset 500 kVA', 'standby'),
    ('GMI', v_site, 'CR-02', 'Crane Workshop 10T', 'active'),
    ('GMI', v_site, 'WL-07', 'Wheel Loader WA470', 'active'),
    ('GMI', v_site, 'CMP-04', 'Compressor Atlas', 'retired');

  insert into __APP__.mnt_downtime (unit_id, event_date, hours, kind, note, source_key)
  select u.id, d.dt, d.h, d.k, d.note, 'seed-dt-' || d.n
    from (values
      (1, 'EX-201', v_p + 4, 40, 'breakdown', 'Hydraulic pump bocor'),
      (2, 'HD-301', v_p + 9, 30, 'breakdown', 'Turbo charger'),
      (3, 'DZ-101', v_p + 15, 50, 'breakdown', 'Final drive'),
      (4, 'GS-05', v_p + 6, 24, 'planned', 'Overhaul terjadwal'),
      (5, 'CMP-04', v_p + 11, 10, 'breakdown', 'Unit sudah dihentikan (tidak dihitung)'),
      (6, 'DZ-101', v_cur, 6, 'breakdown', 'Lanjutan perbaikan final drive')
    ) as d(n, code, dt, h, k, note) join __APP__.mnt_units u on u.company_code = 'GMI' and u.code = d.code;

  insert into __APP__.mnt_ps (unit_id, name, planned_on, done_on, source_key)
  select u.id, p.name, p.planned, p.done, 'seed-ps-' || p.n
    from (values
      (1, 'EX-201', 'PS 500 jam', v_p + 3, v_p + 3),
      (2, 'HD-301', 'PS 250 jam', v_p + 5, v_p + 5),
      (3, 'LV-12', 'PS 10.000 km', v_p + 8, v_p + 9),
      (4, 'CR-02', 'PS tahunan crane', v_p + 12, v_p + 17),
      (5, 'WL-07', 'PS 250 jam', v_p + 14, null::date),
      (6, 'DZ-101', 'PS 1000 jam', v_p + 20, v_p + 18)
    ) as p(n, code, name, planned, done) join __APP__.mnt_units u on u.company_code = 'GMI' and u.code = p.code;

  insert into __APP__.mnt_backlog (unit_id, title, priority, status, opened_on, closed_on, source_key)
  select u.id, b.title, b.pr, b.st, b.op, b.cl, 'seed-bl-' || b.n
    from (values
      (1, 'DZ-101', 'Ganti final drive', 'high', 'open', v_p - 10, null::date),
      (2, 'HD-301', 'Perbaikan AC kabin', 'medium', 'open', v_p - 20, null::date),
      (3, 'EX-201', 'Ganti bucket teeth', 'high', 'open', v_p + 2, null::date),
      (4, 'LV-12', 'Ganti wiper', 'low', 'open', v_p + 7, null::date),
      (5, 'WL-07', 'Seal hydraulic rembes', 'low', 'done', v_p - 5, v_p + 3),
      (6, 'CR-02', 'Kalibrasi limit switch', 'low', 'done', v_p + 10, v_cur + 0)
    ) as b(n, code, title, pr, st, op, cl) join __APP__.mnt_units u on u.company_code = 'GMI' and u.code = b.code;

  insert into __APP__.mnt_sync_state (company_code, target, synced_at, row_count, filename) values
    ('GMI', 'mnt_units', now() - interval '1 day', 8, 'unit.xlsx'), ('GMI', 'mnt_downtime', now() - interval '1 day', 6, 'downtime.xlsx'),
    ('GMI', 'mnt_ps', now() - interval '1 day', 6, 'ps.xlsx'), ('GMI', 'mnt_backlog', now() - interval '1 day', 6, 'backlog.xlsx');
end $$;

-- ---------- data DEMO fase 5 (lanjutan): Readiness LIB + Metal Scrap ----------
do $$
declare
  v_site uuid := (select id from public.locations where name = 'Site MIFA');
  v_p date := (date_trunc('month', current_date) - interval '1 month')::date;
  v_cur date := date_trunc('month', current_date)::date;
begin
  if v_site is null or exists (select 1 from __APP__.mnt_lib) then return; end if;
  insert into __APP__.mnt_lib (company_code, location_id, part_code, name, uom, qty, min_qty, last_moved_on) values
    ('GMI', v_site, 'FLT-0101', 'Filter oli engine PC400', 'pcs', 12, 6, current_date - 20),
    ('GMI', v_site, 'FLT-0215', 'Filter hydraulic HD785', 'pcs', 3, 8, current_date - 35),
    ('GMI', v_site, 'SEL-0442', 'Seal kit boom cylinder', 'set', 2, 2, current_date - 400),
    ('GMI', v_site, 'TRK-0910', 'Track shoe D85', 'pcs', 6, 0, current_date - 260),
    ('GMI', v_site, 'BRG-0033', 'Bearing swing circle', 'pcs', 1, 1, null),
    ('GMI', v_site, 'LMP-0007', 'Lampu sorot LED 60W', 'pcs', 0, 4, current_date - 15);
  insert into __APP__.mnt_scrap (company_code, location_id, month, metal, actual_kg, forecast_kg) values
    ('GMI', v_site, v_p, 'Besi/baja', 4200, 4000), ('GMI', v_site, v_p, 'Tembaga', 180, 200), ('GMI', v_site, v_p, 'Aluminium', 95, 120),
    ('GMI', v_site, v_cur, 'Besi/baja', 1500, 4000), ('GMI', v_site, v_cur, 'Tembaga', null, 200),
    ('GMI', v_site, (v_cur + interval '1 month')::date, 'Besi/baja', null, 3800), ('GMI', v_site, (v_cur + interval '1 month')::date, 'Tembaga', null, 220);
  insert into __APP__.mnt_sync_state (company_code, target, synced_at, row_count, filename) values
    ('GMI', 'mnt_lib', now() - interval '1 day', 6, 'lib.xlsx'), ('GMI', 'mnt_scrap', now() - interval '1 day', 7, 'scrap.xlsx')
  on conflict (company_code, target) do nothing;
end $$;

-- ---------- data DEMO fase 6: Monitoring APD (master dari Excel Monitoring APD GMI 2026; transaksi rekaan) ----------
do $$
declare
  v_ho uuid := (select id from public.locations where name = 'Kantor Pusat Bekasi');
  v_site uuid := (select id from public.locations where name = 'Site MIFA');
  v_hse uuid := (select id from public.profiles where email = 'hse@demo.lourdes.test');
  v_kar uuid := (select id from public.profiles where email = 'karyawan@demo.lourdes.test');
  v_rudi uuid := (select id from __APP__.employees where code = 'GMI-0017');
  v_agus uuid := (select id from __APP__.employees where code = 'GMI-0024');
  v_req uuid; v_line uuid; v_tpl uuid; v_wh uuid;
begin
  if v_ho is null or v_site is null or v_rudi is null or exists (select 1 from __APP__.apd_items) then return; end if;
  alter table __APP__.apd_items disable trigger apd_items_log;
  alter table __APP__.apd_stock_moves disable trigger apd_stock_moves_log;
  alter table __APP__.apd_requests disable trigger apd_requests_log;
  insert into __APP__.apd_warehouses (company_code, name, location_id, description)
  values ('GMI', 'Gudang HO', v_ho, 'Gudang APD pusat (DEMO)') returning id into v_wh;

  insert into __APP__.apd_items (code, name, type_id, brand, size, uom, min_stock)
  select x.code, x.name, t.id, x.brand, x.size, x.uom, x.min_stock
    from (values
      ('SS-01-40', 'Krusher Safety Shoes Uk 40', 'safety_shoes', 'Krusher', '40', 'Pasang', 2),
      ('SS-01-41', 'Krusher Safety Shoes Uk 41', 'safety_shoes', 'Krusher', '41', 'Pasang', 2),
      ('SS-01-42', 'Krusher Safety Shoes Uk 42', 'safety_shoes', 'Krusher', '42', 'Pasang', 2),
      ('KM-01-03', 'Kemeja Mekanik Uk L', 'uniform_shirt', 'Lourdes', 'L', 'Pcs', 10),
      ('KM-01-04', 'Kemeja Mekanik Uk XL', 'uniform_shirt', 'Lourdes', 'XL', 'Pcs', 10),
      ('KS-01-03', 'Kaos Mekanik Uk L', 'uniform_tshirt', 'Lourdes', 'L', 'Pcs', 10),
      ('KS-01-04', 'Kaos Mekanik Uk XL', 'uniform_tshirt', 'Lourdes', 'XL', 'Pcs', 10),
      ('SG-01', 'Safety Glasses Clear', 'safety_glass', 'Kings', 'Clear', 'Pcs', 5),
      ('HLM-01', 'Helm Yellow', 'safety_helmet', 'Lourdes', 'Kuning', 'Pcs', 3),
      ('HLM-04', 'Helm White', 'safety_helmet', 'Lourdes', 'Putih', 'Pcs', 2),
      ('EPL-01', 'Earplug', 'earplug', 'Lourdes', null, 'Pasang', 10),
      ('MSK-01', 'Masker Carbon', 'mask_carbon', 'Lourdes', null, 'Pcs', 5),
      ('SRT-02', 'Sarung Tangan', 'safety_glove', 'Lourdes', null, 'Pasang', 20),
      ('PDL-01', 'Padlock Red', 'padlock', 'Lourdes', 'Merah', 'Pcs', 0)
    ) as x(code, name, type, brand, size, uom, min_stock) join __APP__.apd_types t on t.code = x.type;

  -- stok awal (SO) di gudang HO + barang masuk
  insert into __APP__.apd_stock_moves (company_code, warehouse_id, location_id, kind, item_id, qty, moved_on, ref_no, pic, created_by)
  select 'GMI', v_wh, v_ho, 'opening', i.id, x.qty, current_date - 60, 'SO-2026', 'Gudang HO', v_hse
    from (values ('SS-01-40', 2), ('SS-01-41', 1), ('SS-01-42', 1), ('KM-01-03', 5), ('KM-01-04', 4), ('KS-01-03', 10), ('KS-01-04', 4),
                 ('SG-01', 5), ('HLM-01', 11), ('HLM-04', 4), ('MSK-01', 17), ('SRT-02', 75)) x(code, qty)
    join __APP__.apd_items i on i.code = x.code;
  insert into __APP__.apd_stock_moves (company_code, warehouse_id, location_id, kind, item_id, qty, moved_on, ref_no, pic, created_by)
  select 'GMI', v_wh, v_ho, 'in', i.id, x.qty, current_date - 20, 'GMI/MR/X/26/HSE/707', 'Gudang HO', v_hse
    from (values ('KM-01-03', 42), ('KS-01-03', 76), ('PDL-01', 8)) x(code, qty) join __APP__.apd_items i on i.code = x.code;

  -- riwayat penerimaan karyawan demo (OUT tanpa pengajuan, sebelum sistem)
  insert into __APP__.apd_stock_moves (company_code, warehouse_id, location_id, kind, item_id, qty, moved_on, pic, dest_location_id, employee_id, recipient_name, created_by)
  select 'GMI', v_wh, v_ho, 'out', i.id, x.qty, current_date - x.ago, 'Gudang HO', v_site, x.emp, e.name, v_hse
    from (values ('SS-01-41', 1, 330, v_rudi), ('HLM-01', 1, 200, v_rudi), ('KS-01-03', 2, 190, v_rudi), ('SG-01', 1, 60, v_rudi),
                 ('SS-01-42', 1, 30, v_agus), ('KM-01-04', 2, 100, v_agus)) x(code, qty, ago, emp)
    join __APP__.apd_items i on i.code = x.code join __APP__.employees e on e.id = x.emp;
  insert into __APP__.apd_employee_sizes (employee_id, type_id, size, updated_by)
  select v_rudi, t.id, x.size, v_hse
    from (values ('safety_shoes', '41'), ('uniform_tshirt', 'L'), ('uniform_shirt', 'L'), ('safety_helmet', 'Kuning')) x(type, size)
    join __APP__.apd_types t on t.code = x.type;

  -- pengajuan disetujui (berkala, Rudi): kaos L x2, sudah terkirim 1
  insert into __APP__.apd_requests (company_code, location_id, code, employee_id, recipient_name, job_title, reason, requested_on, approved_on,
                                    status, created_by, created_at)
  values ('GMI', v_site, __APP__.next_doc_number('APD', 'GMI', 'year'), v_rudi, 'Rudi Hartono', 'Teknisi AC', 'periodic', current_date - 6,
          current_date - 4, 'approved', v_kar, now() - interval '6 days')
  returning id into v_req;
  insert into __APP__.apd_request_lines (request_id, line_no, type_id, item_id, size, qty)
  select v_req, 1, t.id, i.id, 'L', 2 from __APP__.apd_types t join __APP__.apd_items i on i.code = 'KS-01-03' where t.code = 'uniform_tshirt'
  returning id into v_line;
  insert into __APP__.apd_stock_moves (company_code, warehouse_id, location_id, kind, item_id, qty, moved_on, ref_no, pic, dest_location_id, employee_id,
                                       recipient_name, request_line_id, created_by)
  select 'GMI', v_wh, v_ho, 'out', i.id, 1, current_date - 2, 'BAST-DEMO-01', 'Gudang HO', v_site, v_rudi, 'Rudi Hartono', v_line, v_hse
    from __APP__.apd_items i where i.code = 'KS-01-03';

  -- draf (rusak, Rudi): belum ada foto bukti
  insert into __APP__.apd_requests (company_code, location_id, code, employee_id, recipient_name, job_title, reason, negligence, incident_on,
                                    explanation, status, created_by)
  values ('GMI', v_site, __APP__.next_doc_number('APD', 'GMI', 'year'), v_rudi, 'Rudi Hartono', 'Teknisi AC', 'damaged', false, current_date - 1,
          'Sol sepatu lepas saat pekerjaan di area workshop.', 'draft', v_kar)
  returning id into v_req;
  insert into __APP__.apd_request_lines (request_id, line_no, type_id, size, qty)
  select v_req, 1, t.id, '41', 1 from __APP__.apd_types t where t.code = 'safety_shoes';

  alter table __APP__.apd_items enable trigger apd_items_log;
  alter table __APP__.apd_stock_moves enable trigger apd_stock_moves_log;
  alter table __APP__.apd_requests enable trigger apd_requests_log;

  -- template approval (P5): HSE Staff memeriksa, HR Manager mengetahui, HSE Dept Head menyetujui
  if not exists (select 1 from __APP__.approval_templates where doc_type = 'apd_request') then
    insert into __APP__.approval_templates (doc_type, name, description, priority)
    values ('apd_request', 'Pengajuan APD standar', 'HSE Staff > HR Manager > HSE Dept Head (Form Berita Acara APD, DEMO)', 0)
    returning id into v_tpl;
    insert into __APP__.approval_template_steps (template_id, step_no, approval_type, approver_kind, approver_id, due_hours)
    values (v_tpl, 1, 'memeriksa',  'user', v_hse, 24),
           (v_tpl, 2, 'mengetahui', 'user', (select id from public.profiles where email = 'hr@demo.lourdes.test'), 48),
           (v_tpl, 3, 'menyetujui', 'user', (select id from public.profiles where email = 'hse.senior@demo.lourdes.test'), 48);
  end if;
end $$;
