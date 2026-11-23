-- =====================================================================================
-- Uji fase 2: Inspeksi & Observasi, jam kerja, Kamus KPI, dashboard K3 (docs/spec/fase-2-inspeksi-dashboard.md).
-- Dijalankan setelah 01–03 di DB yang sama (helper zz_test, data seed).
-- =====================================================================================
\set ON_ERROR_STOP on
set client_min_messages = notice;

select id as site from public.locations where name = 'Site MIFA' \gset
select id as site2 from public.locations where name = 'Site Demo Kalimantan' \gset
select id as area from __APP__.areas where location_id = :'site' and name = 'Workshop Service' \gset
select id as area2 from __APP__.areas where location_id = :'site2' and name = 'Workshop' \gset
select id as u_karyawan from public.profiles where email = 'karyawan@demo.lourdes.test' \gset
select id as u_hse from public.profiles where email = 'hse@demo.lourdes.test' \gset
select id as u_pengawas from public.profiles where email = 'pengawas@demo.lourdes.test' \gset

-- ================================================================ L1. struktur & grant
select zz_test.check('L1a tabel fase 2 tanpa hak tulis untuk authenticated',
  not exists (select 1 from information_schema.role_table_grants
               where grantee = 'authenticated' and table_schema = '__APP__'
                 and table_name in ('inspection_templates', 'inspection_template_items', 'inspections', 'inspection_answers',
                                    'inspections_logs', 'observations', 'observations_logs', 'work_hours', 'work_hours_logs',
                                    'kpi_definitions_logs')
                 and privilege_type in ('INSERT', 'UPDATE', 'DELETE')));
select zz_test.check('L1b RPC fase 2 bisa dipanggil authenticated, tidak anon',
  has_function_privilege('authenticated', '__APP__.inspection_schedule(jsonb)', 'execute')
  and has_function_privilege('authenticated', '__APP__.observation_submit(jsonb)', 'execute')
  and has_function_privilege('authenticated', '__APP__.kpi_safety(date, date, uuid)', 'execute')
  and not has_function_privilege('anon', '__APP__.dashboard_k3(integer, integer, uuid)', 'execute')
  and not has_function_privilege('authenticated', '__APP__.k3_finding_insert(uuid, text, uuid, uuid, text, timestamptz, text, text, text, text, text, text, uuid, date)', 'execute'));
select zz_test.check('L1c kpi_definitions: tidak ada DELETE; seed 8 KPI draf',
  not exists (select 1 from information_schema.role_table_grants where grantee = 'authenticated' and table_schema = '__APP__'
               and table_name = 'kpi_definitions' and privilege_type = 'DELETE')
  and (select count(*) from __APP__.kpi_definitions) >= 8
  and not exists (select 1 from __APP__.kpi_definitions where status = 'approved'));

-- ================================================================ L2. template
select zz_test.login('karyawan@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('L2a karyawan tidak bisa membuat template',
  $q$select __APP__.inspection_template_save(null, '{"type_code":"padlock","name":"UJI Template","items":["Butir satu uji"]}'::jsonb)$q$, '42501');
reset role;
select zz_test.login('hse@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('L2b template tanpa butir ditolak',
  $q$select __APP__.inspection_template_save(null, '{"type_code":"padlock","name":"UJI Template","items":[" "]}'::jsonb)$q$, 'P0001', '%1 sampai 100%');
select (__APP__.inspection_template_save(null, '{"type_code":"padlock","name":"UJI Template Padlock","object_label":"Nomor toolkit","items":["Padlock personal terpasang","Tag LOTO terisi","Kunci disimpan pemilik"]}'::jsonb) ->> 'id') as tpl \gset
select zz_test.check('L2c template tersimpan dengan 3 butir',
  (select count(*) from __APP__.inspection_template_items where template_id = :'tpl') = 3);
select __APP__.inspection_template_save(:'tpl', '{"type_code":"padlock","name":"UJI Template Padlock","items":["Padlock personal terpasang","Tag LOTO terisi","Kunci disimpan pemilik","Area diberi barikade"]}'::jsonb);
select zz_test.check('L2d ubah template mengganti butir',
  (select count(*) from __APP__.inspection_template_items where template_id = :'tpl') = 4);
reset role;

-- ================================================================ L3. jadwal
select zz_test.login('karyawan@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('L3a karyawan tidak bisa menjadwalkan',
  format($q$select __APP__.inspection_schedule(jsonb_build_object('template_id', %L, 'location_id', %L, 'area_id', %L,
    'planned_at', (now() + interval '1 day')::text, 'inspector_id', %L))$q$, :'tpl', :'site', :'area', :'u_pengawas'), '42501');
reset role;
select zz_test.login('hse@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('L3b area site lain ditolak',
  format($q$select __APP__.inspection_schedule(jsonb_build_object('template_id', %L, 'location_id', %L, 'area_id', %L,
    'planned_at', (now() + interval '1 day')::text, 'inspector_id', %L))$q$, :'tpl', :'site', :'area2', :'u_pengawas'), 'P0001', '%area site%');
select zz_test.expect_error('L3c tanggal terlalu lampau ditolak',
  format($q$select __APP__.inspection_schedule(jsonb_build_object('template_id', %L, 'location_id', %L, 'area_id', %L,
    'planned_at', (now() - interval '30 days')::text, 'inspector_id', %L))$q$, :'tpl', :'site', :'area', :'u_pengawas'), 'P0001', '%tidak valid%');
select __APP__.inspection_schedule(jsonb_build_object('template_id', :'tpl', 'location_id', :'site', 'area_id', :'area',
  'planned_at', (now() + interval '1 day')::text, 'inspector_id', :'u_pengawas', 'object_text', 'Toolkit #3')) as r \gset
select (:'r'::jsonb ->> 'id') as ins, (:'r'::jsonb ->> 'code') as ins_code \gset
select zz_test.check('L3d nomor INS-YYYY-NNNN, pemeriksa dinotifikasi, status scheduled',
  :'ins_code' ~ ('^INS-' || to_char(now() at time zone 'Asia/Jakarta', 'YYYY') || '-\d{4}$')
  and jsonb_array_length(:'r'::jsonb -> 'notification_ids') = 1
  and (select status from __APP__.inspections where id = :'ins') = 'scheduled', :'ins_code');
select zz_test.expect_error('L3e insert langsung ke tabel ditolak',
  format($q$insert into __APP__.inspections (code, company_code, location_id, area_id, type_code, title, planned_at, inspector_id)
    values ('X', 'GMI', %L, %L, 'padlock', 'xxx', now(), %L)$q$, :'site', :'area', :'u_pengawas'), '42501');
reset role;

-- ================================================================ L4. pelaksanaan
select zz_test.login('hse@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('L4a bukan pemeriksa tidak bisa memulai',
  format($q$select __APP__.inspection_start(%L)$q$, :'ins'), '42501');
reset role;
select zz_test.login('pengawas@demo.lourdes.test');
set role authenticated;
select zz_test.check('L4b Tugas Saya pemeriksa memuat inspeksi terjadwal',
  exists (select 1 from __APP__.my_tasks() where kind = 'inspection_scheduled' and ref_id = :'ins'));
select __APP__.inspection_start(:'ins');
select zz_test.check('L4c mulai → in_progress, 4 butir disalin dari template',
  (select status from __APP__.inspections where id = :'ins') = 'in_progress'
  and (select count(*) from __APP__.inspection_answers where inspection_id = :'ins') = 4);
select zz_test.check('L4d Tugas Saya pindah ke Perlu Tindakan',
  exists (select 1 from __APP__.my_tasks() where kind = 'inspection_do' and ref_id = :'ins')
  and not exists (select 1 from __APP__.my_tasks() where kind = 'inspection_scheduled' and ref_id = :'ins'));
select zz_test.expect_error('L4e foto di luar folder inspeksi ditolak',
  format($q$select __APP__.inspection_save_answers(%L, '[{"line_no":1,"answer":"compliant","photos":["kejadian/x/a.jpg"]}]'::jsonb)$q$, :'ins'), 'P0001', '%folder inspeksi%');
select zz_test.expect_error('L4f jawaban tidak dikenal ditolak',
  format($q$select __APP__.inspection_save_answers(%L, '[{"line_no":1,"answer":"maybe"}]'::jsonb)$q$, :'ins'), 'P0001', '%tidak dikenal%');
select __APP__.inspection_save_answers(:'ins', '[{"line_no":1,"answer":"compliant"},{"line_no":2,"answer":"noncompliant","comment":"Tag kosong"},{"line_no":3,"answer":"na"}]'::jsonb);
select zz_test.expect_error('L4g kirim dengan butir belum dijawab ditolak',
  format($q$select __APP__.inspection_submit(%L, '[]'::jsonb)$q$, :'ins'), 'P0001', '%belum dijawab%');
select __APP__.inspection_save_answers(:'ins', '[{"line_no":4,"answer":"noncompliant"}]'::jsonb);
select zz_test.expect_error('L4h temuan untuk butir yang sesuai ditolak',
  format($q$select __APP__.inspection_submit(%L, jsonb_build_array(jsonb_build_object('line_no', 1, 'risk_level', 'high',
    'pic_id', %L, 'due_date', (current_date + 3)::text)))$q$, :'ins', :'u_pengawas'), 'P0001', '%Tidak Sesuai%');
select zz_test.expect_error('L4i temuan tanpa prioritas ditolak',
  format($q$select __APP__.inspection_submit(%L, jsonb_build_array(jsonb_build_object('line_no', 2, 'pic_id', %L,
    'due_date', (current_date + 3)::text)))$q$, :'ins', :'u_pengawas'), 'P0001', '%Prioritas%');
select __APP__.inspection_submit(:'ins', jsonb_build_array(
  jsonb_build_object('line_no', 2, 'description', 'Tag LOTO kosong pada toolkit #3', 'risk_level', 'high', 'pic_id', :'u_karyawan', 'due_date', (current_date + 5)::text))) as r \gset
select zz_test.check('L4j kirim → submitted, ringkasan 1/2/1, satu temuan dibuat',
  (select status from __APP__.inspections where id = :'ins') = 'submitted'
  and (select summary from __APP__.inspections where id = :'ins') = '{"compliant":1,"noncompliant":2,"na":1,"findings":1}'::jsonb
  and jsonb_array_length(:'r'::jsonb -> 'finding_codes') = 1, (select summary::text from __APP__.inspections where id = :'ins'));
select zz_test.check('L4k temuan bersumber inspeksi, nomor TMN, PIC & HSE dinotifikasi',
  exists (select 1 from __APP__.findings f join __APP__.inspection_answers a on a.finding_id = f.id
           where a.inspection_id = :'ins' and f.source_kind = 'inspection' and f.source_ref = :'ins_code' and f.code like 'TMN-____-____'
             and f.pic_id = :'u_karyawan')
  and jsonb_array_length(:'r'::jsonb -> 'notification_ids') >= 2);
select zz_test.expect_error('L4l jawaban terkunci setelah dikirim',
  format($q$select __APP__.inspection_save_answers(%L, '[{"line_no":1,"answer":"na"}]'::jsonb)$q$, :'ins'), 'P0001', '%berjalan%');
select zz_test.expect_error('L4m pemeriksa tidak bisa memverifikasi sendiri',
  format($q$select __APP__.inspection_verify(%L, 'ok')$q$, :'ins'), '42501');
reset role;

-- ================================================================ L5. verifikasi & batal
select zz_test.login('hse@demo.lourdes.test');
set role authenticated;
select zz_test.check('L5a Tugas Saya HSE memuat verifikasi inspeksi',
  exists (select 1 from __APP__.my_tasks() where kind = 'inspection_verify' and ref_id = :'ins'));
select __APP__.inspection_verify(:'ins', 'Hasil sesuai');
select zz_test.check('L5b diverifikasi HSE lain', (select status = 'verified' and verified_by = :'u_hse' from __APP__.inspections where id = :'ins'));
select __APP__.inspection_schedule(jsonb_build_object('template_id', :'tpl', 'location_id', :'site', 'area_id', :'area',
  'planned_at', (now() + interval '3 days')::text, 'inspector_id', :'u_pengawas')) ->> 'id' as ins2 \gset
select zz_test.expect_error('L5c batal tanpa alasan ditolak',
  format($q$select __APP__.inspection_cancel(%L, ' ')$q$, :'ins2'), 'P0001', '%Alasan%');
select __APP__.inspection_cancel(:'ins2', 'Unit tidak tersedia');
select zz_test.check('L5d dibatalkan dengan alasan', (select status = 'cancelled' and cancel_reason = 'Unit tidak tersedia' from __APP__.inspections where id = :'ins2'));
select zz_test.expect_error('L5e inspeksi terverifikasi tidak bisa dibatalkan',
  format($q$select __APP__.inspection_cancel(%L, 'x')$q$, :'ins'), 'P0001', '%dibatalkan%');
select zz_test.check('L5f riwayat inspeksi: schedule, start, submit, verify tiap satu baris',
  (select string_agg(action, ',' order by id) from __APP__.inspections_logs where record_id = :'ins') like 'schedule,start,submit,verify%',
  (select string_agg(action, ',' order by id) from __APP__.inspections_logs where record_id = :'ins'));
reset role;

-- visibilitas & storage
select zz_test.login('karyawan@demo.lourdes.test');
set role authenticated;
select zz_test.check('L5g karyawan (bukan pemeriksa) tidak melihat inspeksi', not exists (select 1 from __APP__.inspections where id = :'ins'));
reset role;
insert into storage.objects (bucket_id, name, owner_id) values ('__HOST__-lampiran', 'inspeksi/' || :'ins' || '/foto.jpg', :'u_pengawas');
select zz_test.login('hse@demo.lourdes.test');
set role authenticated;
select zz_test.check('L5h HSE membaca foto inspeksi', exists (select 1 from storage.objects where name = 'inspeksi/' || :'ins' || '/foto.jpg'));
select zz_test.expect_error('L5i unggah foto ke inspeksi yang bukan miliknya ditolak',
  format($q$insert into storage.objects (bucket_id, name, owner_id) values ('__HOST__-lampiran', 'inspeksi/%s/x.jpg', auth.uid()::text)$q$, :'ins'), '42501');
reset role;

-- ================================================================ L6. observasi
select zz_test.login('karyawan@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('L6a uraian wajib',
  format($q$select __APP__.observation_submit(jsonb_build_object('location_id', %L, 'area_id', %L, 'kind', 'kta', 'description', ' '))$q$, :'site', :'area'), 'P0001', '%Uraian%');
select zz_test.expect_error('L6b tindak lanjut tanpa PIC ditolak',
  format($q$select __APP__.observation_submit(jsonb_build_object('location_id', %L, 'area_id', %L, 'kind', 'tta', 'description', 'x',
    'followup', true, 'risk_level', 'medium'))$q$, :'site', :'area'), 'P0001', '%PIC%');
select __APP__.observation_submit(jsonb_build_object('location_id', :'site', 'area_id', :'area', 'kind', 'kta',
  'description', 'Kabel ekstensi melintang di jalur pejalan', 'immediate_action', 'Dipasang cable cover')) as r \gset
select (:'r'::jsonb ->> 'id') as obs, (:'r'::jsonb ->> 'code') as obs_code \gset
select zz_test.check('L6c observasi OBS-YYYY-NNNN tanpa temuan', :'obs_code' like 'OBS-____-____' and (:'r'::jsonb ->> 'finding_id') is null);
select __APP__.observation_submit(jsonb_build_object('location_id', :'site', 'area_id', :'area', 'kind', 'tta',
  'description', 'Teknisi bekerja tanpa kacamata', 'followup', true, 'risk_level', 'medium', 'pic_id', :'u_pengawas')) as r2 \gset
select zz_test.check('L6d karyawan (tanpa fungsi temuan) tetap bisa meminta tindak lanjut → temuan bersumber observasi',
  (:'r2'::jsonb ->> 'finding_code') like 'TMN-____-____'
  and exists (select 1 from __APP__.findings f where f.code = (:'r2'::jsonb ->> 'finding_code') and f.source_kind = 'observation'
               and f.source_ref = (select code from __APP__.observations where id = (:'r2'::jsonb ->> 'id')::uuid)
               and f.pic_id = :'u_pengawas'));
select zz_test.check('L6e pembuat membaca observasinya', exists (select 1 from __APP__.observations where id = :'obs'));
reset role;
select zz_test.login('hse@demo.lourdes.test');
set role authenticated;
select zz_test.check('L6f HSE membaca observasi & temuan tindak lanjut',
  exists (select 1 from __APP__.observations where id = :'obs')
  and exists (select 1 from __APP__.findings where code = (:'r2'::jsonb ->> 'finding_code')));
reset role;
select zz_test.login('viewer@demo.lourdes.test');
set role authenticated;
select zz_test.check('L6g user tanpa fungsi K3 tidak melihat observasi orang lain', not exists (select 1 from __APP__.observations where id = :'obs'));
reset role;
select zz_test.login('auditor@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('L6h auditor tidak bisa mencatat observasi',
  format($q$select __APP__.observation_submit(jsonb_build_object('location_id', %L, 'area_id', %L, 'kind', 'kta', 'description', 'x'))$q$, :'site', :'area'), '42501');
reset role;

-- ================================================================ L7. jam kerja & KPI
select zz_test.login('karyawan@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('L7a karyawan tidak bisa mengisi jam kerja',
  format($q$select __APP__.work_hours_save(%L, date_trunc('month', current_date)::date, 1000)$q$, :'site'), '42501');
select zz_test.check('L7b karyawan tidak mendapat KPI (null)', __APP__.kpi_safety(current_date - 365, current_date) is null);
reset role;
select zz_test.login('hse@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('L7c bulan depan ditolak',
  format($q$select __APP__.work_hours_save(%L, (date_trunc('month', current_date) + interval '1 month')::date, 1000)$q$, :'site'), 'P0001', '%bulan depan%');
select zz_test.expect_error('L7d site di luar akses ditolak',
  $q$select __APP__.work_hours_save(gen_random_uuid(), date_trunc('month', current_date)::date, 1000)$q$, 'P0001', '%Site tidak valid%');
reset role;
insert into public.locations (name) values ('Site Uji Tanpa Jam Kerja') on conflict do nothing;
select id as site_nohours from public.locations where name = 'Site Uji Tanpa Jam Kerja' \gset
set role authenticated;
select coalesce((__APP__.kpi_safety(date_trunc('year', current_date)::date, current_date, :'site_nohours') ->> 'ltifr'), 'null') as ltifr_before \gset
select zz_test.check('L7e site tanpa jam kerja: LTIFR tidak dihitung (bukan 0)', :'ltifr_before' = 'null', :'ltifr_before');
select __APP__.work_hours_save(:'site', date_trunc('month', current_date)::date, 8000.5, 'Uji');
select __APP__.work_hours_save(:'site', date_trunc('month', current_date)::date, 10000, 'Uji ubah');
select zz_test.check('L7f jam kerja upsert (satu baris per site-bulan)',
  (select count(*) from __APP__.work_hours where location_id = :'site' and month = date_trunc('month', current_date)::date) = 1
  and (select hours from __APP__.work_hours where location_id = :'site' and month = date_trunc('month', current_date)::date) = 10000);
select (__APP__.kpi_safety(date_trunc('month', current_date)::date, current_date, :'site')) as k \gset
select zz_test.check('L7g LTIFR = LTI × 1.000.000 ÷ jam kerja (tepat)',
  (:'k'::jsonb ->> 'hours')::numeric = 10000
  and (:'k'::jsonb ->> 'ltifr')::numeric = round(((:'k'::jsonb ->> 'lti')::numeric * 1000000) / 10000, 2));
select zz_test.check('L7h KPI hanya menghitung kejadian terklasifikasi HSE',
  (__APP__.kpi_safety(date_trunc('year', current_date)::date, current_date, :'site') ->> 'near_miss')::integer
  = (select count(*) from __APP__.incidents where location_id = :'site' and category = 'near_miss'
       and occurred_at >= date_trunc('year', current_date) and occurred_at < current_date + 1));
reset role;

-- ================================================================ L8. Kamus KPI
select zz_test.login('hse@demo.lourdes.test');
set role authenticated;
select zz_test.check('L8a HSE membaca Kamus KPI', (select count(*) from __APP__.kpi_definitions) >= 8);
update __APP__.kpi_definitions set formula = 'DIBAJAK' where code = 'ltifr';
select zz_test.check('L8b non-admin tidak bisa mengubah KPI (0 baris)', (select formula <> 'DIBAJAK' from __APP__.kpi_definitions where code = 'ltifr'));
reset role;
select zz_test.login('admin@demo.lourdes.test');
set role authenticated;
update __APP__.kpi_definitions set unit = 'per 1 juta jam kerja' where code = 'ltifr';
select zz_test.check('L8c admin mengubah definisi → versi 2, tetap draft',
  (select version = 2 and status = 'draft' from __APP__.kpi_definitions where code = 'ltifr'));
update __APP__.kpi_definitions set status = 'approved' where code = 'near_miss';
select zz_test.check('L8d status tidak bisa diubah lewat update langsung',
  (select status = 'draft' from __APP__.kpi_definitions where code = 'near_miss'));
select zz_test.expect_error('L8e catatan pengesahan wajib',
  $q$select __APP__.kpi_approve('near_miss', 'x')$q$, 'P0001', '%Catatan%');
select __APP__.kpi_approve('near_miss', 'Disahkan oleh HSE Manager (uji)');
select zz_test.check('L8f disahkan: approved, versi tetap, pengesah tercatat',
  (select status = 'approved' and version = 1 and approved_by is not null and approved_at is not null from __APP__.kpi_definitions where code = 'near_miss'));
update __APP__.kpi_definitions set rule_text = 'Aturan baru uji' where code = 'near_miss';
select zz_test.check('L8g mengubah KPI yang sudah disahkan → versi baru + kembali draft',
  (select status = 'draft' and version = 2 and approved_by is null from __APP__.kpi_definitions where code = 'near_miss'));
reset role;
select zz_test.login('hse@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('L8h HSE (bukan admin) tidak bisa mengesahkan',
  $q$select __APP__.kpi_approve('ltifr', 'Percobaan mengesahkan')$q$, '42501');
reset role;

-- ================================================================ L9. dashboard & pencarian
select zz_test.login('hse@demo.lourdes.test');
set role authenticated;
select __APP__.dashboard_k3(extract(year from current_date)::integer, extract(month from current_date)::integer, :'site') as d \gset
select zz_test.check('L9a dashboard_k3 memuat blok kpi, temuan, pica, leading',
  :'d'::jsonb ? 'month' and :'d'::jsonb ? 'ytd' and :'d'::jsonb ? 'findings' and :'d'::jsonb ? 'pica' and :'d'::jsonb ? 'leading'
  and jsonb_array_length(:'d'::jsonb -> 'leading') = extract(month from current_date)::integer);
select zz_test.check('L9b angka temuan overdue dashboard = daftar temuan overdue (satu sumber)',
  (:'d'::jsonb -> 'findings' ->> 'overdue')::integer
  = (select count(*) from __APP__.findings where status <> 'closed' and due_date < __APP__.today_wib() and location_id = :'site'));
select zz_test.check('L9c status PICA dashboard menjumlah semua tindakan di site',
  (select sum(v::integer) from jsonb_each_text(:'d'::jsonb -> 'pica') e(k, v))
  = (select count(*) from __APP__.pica_actions where location_id = :'site'));
select zz_test.check('L9d umur temuan terbuka menjumlah temuan terbuka',
  (select sum(v::integer) from jsonb_each_text(:'d'::jsonb -> 'findings' -> 'age') e(k, v))
  = (:'d'::jsonb -> 'findings' ->> 'open')::integer);
select zz_test.check('L9e rencana vs aktual per jenis konsisten dengan inspeksi',
  (select coalesce(sum(plan), 0) from __APP__.inspection_plan_actual(extract(year from current_date)::integer, extract(month from current_date)::integer, :'site'))
  = (select count(*) from __APP__.inspections where status <> 'cancelled' and location_id = :'site'
       and date_trunc('month', planned_at at time zone 'Asia/Jakarta') = date_trunc('month', current_date)));
select zz_test.check('L9f pencarian global menemukan inspeksi & observasi',
  exists (select 1 from __APP__.global_search(lower(:'ins_code')) where kind = 'inspeksi')
  and exists (select 1 from __APP__.global_search(lower(:'obs_code')) where kind = 'observasi'));
select zz_test.check('L9g feed Beranda memuat log kejadian, temuan, tindakan, inspeksi, observasi',
  (select count(distinct entity) from __APP__.activity_feed(100)) >= 5
  and not exists (select 1 from __APP__.activity_feed(100) where href is null),
  (select string_agg(distinct entity, ',') from __APP__.activity_feed(100)));
reset role;

do $$ begin raise notice 'Uji inspeksi & KPI selesai.'; end $$;
