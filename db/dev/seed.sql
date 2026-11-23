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
