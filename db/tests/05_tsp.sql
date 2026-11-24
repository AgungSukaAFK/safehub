-- =====================================================================================
-- Uji fase 3: TSP & Aktivitas K3 (docs/spec/fase-3-tsp-laporan.md). Dijalankan setelah 01–04 di DB yang sama.
-- =====================================================================================
\set ON_ERROR_STOP on
set client_min_messages = notice;

select id as site from public.locations where name = 'Site MIFA' \gset
select id as area from __APP__.areas where location_id = :'site' and name = 'Workshop Service' \gset
select id as u_hse from public.profiles where email = 'hse@demo.lourdes.test' \gset
select id as u_peng from public.profiles where email = 'pengawas@demo.lourdes.test' \gset
select extract(year from now() at time zone 'Asia/Jakarta')::integer as yr, extract(month from now() at time zone 'Asia/Jakarta')::integer as mo \gset
select id as prog_b from __APP__.tsp_programs where no = '3.5' and year = :yr \gset

-- ================================================================ M1. struktur & grant
select zz_test.check('M1a tabel TSP tanpa hak tulis untuk authenticated',
  not exists (select 1 from information_schema.role_table_grants
               where grantee = 'authenticated' and table_schema = '__APP__'
                 and table_name in ('tsp_programs', 'tsp_realizations', 'safety_activities', 'tsp_evaluations', 'tsp_programs_logs')
                 and privilege_type in ('INSERT', 'UPDATE', 'DELETE')));
select zz_test.check('M1b RPC bisa dipanggil authenticated, tidak anon; helper storage tertutup',
  has_function_privilege('authenticated', '__APP__.tsp_program_save(uuid, jsonb)', 'execute')
  and has_function_privilege('authenticated', '__APP__.tsp_matrix(integer, uuid)', 'execute')
  and not has_function_privilege('anon', '__APP__.tsp_summary(integer, integer, uuid)', 'execute')
  and not has_function_privilege('authenticated', '__APP__.tsp_count_files(text)', 'execute'));
select zz_test.check('M1c seed: 9 program, KPI tsp_achievement draf',
  (select count(*) from __APP__.tsp_programs where year = :yr) = 9
  and (select status from __APP__.kpi_definitions where code = 'tsp_achievement') = 'draft');

-- ================================================================ M2. baca (RLS)
select zz_test.login('karyawan@demo.lourdes.test');
set role authenticated;
select zz_test.check('M2a karyawan tidak melihat program/aktivitas', (select count(*) from __APP__.tsp_programs) = 0
  and (select count(*) from __APP__.safety_activities) = 0);
reset role;
select zz_test.login('pengawas@demo.lourdes.test');
set role authenticated;
select zz_test.check('M2b pengawas melihat program + matriks 9 baris', (select count(*) from __APP__.tsp_programs) = 9
  and (select count(*) from __APP__.tsp_matrix(:yr, :'site')) = 9);
reset role;

-- ================================================================ M3. program
select zz_test.login('pengawas@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('M3a pengawas tidak bisa membuat program',
  format($q$select __APP__.tsp_program_save(null, jsonb_build_object('location_id', %L, 'year', %s, 'no', '9.9', 'element', '9. Uji',
    'name', 'Program Uji', 'owner_label', 'HSE', 'indicator', 'x', 'annual_target', 1, 'plan', '[0,0,0,0,0,0,0,0,0,0,0,1]'::jsonb))$q$, :'site', :yr), '42501');
reset role;
select zz_test.login('hse@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('M3b rencana wajib 12 bulan',
  format($q$select __APP__.tsp_program_save(null, jsonb_build_object('location_id', %L, 'year', %s, 'no', '9.9', 'element', '9. Uji',
    'name', 'Program Uji', 'owner_label', 'HSE', 'indicator', 'x', 'annual_target', 1, 'plan', '[1,2]'::jsonb))$q$, :'site', :yr), 'P0001', '%12 bulan%');
select zz_test.expect_error('M3c nomor ganda ditolak',
  format($q$select __APP__.tsp_program_save(null, jsonb_build_object('location_id', %L, 'year', %s, 'no', '1.2', 'element', '1. Kebijakan',
    'name', 'Program Ganda', 'owner_label', 'HSE', 'indicator', 'x', 'annual_target', 1, 'plan', '[0,0,0,0,0,0,0,0,0,0,0,1]'::jsonb))$q$, :'site', :yr), 'P0001', '%sudah dipakai%');
select (__APP__.tsp_program_save(null, jsonb_build_object('location_id', :'site', 'year', :yr, 'no', '9.9', 'element', '9. Uji',
  'name', 'Program Uji', 'owner_label', 'HSE', 'indicator', 'Uji indikator', 'annual_target', 2, 'plan', '[1,0,0,0,0,0,1,0,0,0,0,0]'::jsonb)) ->> 'id') as prog_new \gset
select zz_test.check('M3d program baru tersimpan, log dibuat',
  (select plan = array[1,0,0,0,0,0,1,0,0,0,0,0]::smallint[] from __APP__.tsp_programs where id = :'prog_new')
  and exists (select 1 from __APP__.tsp_programs_logs where record_id = :'prog_new' and action = 'create'));
reset role;

-- ================================================================ M4. realisasi
select zz_test.login('hse@demo.lourdes.test');
set role authenticated;
select __APP__.tsp_realization_save(:'prog_new', 1, 1, 'Terlaksana Januari');
select zz_test.check('M4a matriks: aktual bulan 1 = 1, bukti 0 (belum ada file), catatan terbaca',
  (select actual[1] = 1 and evidence[1] = 0 and notes[1] = 'Terlaksana Januari' from __APP__.tsp_matrix(:yr, :'site') where id = :'prog_new'));
select __APP__.tsp_realization_save(:'prog_new', 1, 2, null);
select zz_test.check('M4b simpan ulang = upsert, bukan baris ganda',
  (select count(*) from __APP__.tsp_realizations where program_id = :'prog_new' and month = 1) = 1
  and (select actual from __APP__.tsp_realizations where program_id = :'prog_new' and month = 1) = 2);
reset role;

-- ================================================================ M5. aktivitas (menambah aktual program)
select zz_test.login('karyawan@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('M5a karyawan tidak bisa mencatat aktivitas',
  format($q$select __APP__.safety_activity_save(jsonb_build_object('location_id', %L, 'area_id', %L, 'type_code', 'safety_talk',
    'activity_date', current_date::text, 'leader_id', %L))$q$, :'site', :'area', :'u_hse'), '42501');
reset role;
select zz_test.login('pengawas@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('M5b tanggal masa depan ditolak',
  format($q$select __APP__.safety_activity_save(jsonb_build_object('location_id', %L, 'area_id', %L, 'type_code', 'safety_talk',
    'activity_date', (current_date + 3)::text, 'leader_id', %L))$q$, :'site', :'area', :'u_peng'), 'P0001', '%masa depan%');
select zz_test.expect_error('M5c program beda tahun ditolak',
  format($q$select __APP__.safety_activity_save(jsonb_build_object('location_id', %L, 'area_id', %L, 'type_code', 'safety_talk',
    'activity_date', (current_date - 380)::text, 'leader_id', %L, 'program_id', %L))$q$, :'site', :'area', :'u_peng', :'prog_b'), 'P0001');
select count(*) as before_n from __APP__.safety_activities \gset
select (__APP__.safety_activity_save(jsonb_build_object('location_id', :'site', 'area_id', :'area', 'type_code', 'safety_talk',
  'activity_date', current_date::text, 'leader_id', :'u_peng', 'participant_count', 25, 'program_id', :'prog_new')) ->> 'code') as act_code \gset
select zz_test.check('M5d nomor AKT-YYYY-NNNN; aktivitas menambah aktual program bulan ini',
  :'act_code' ~ '^AKT-\d{4}-\d{4}$'
  and (select count(*) from __APP__.safety_activities) = :before_n + 1
  and (select actual[:mo] >= 1 from __APP__.tsp_matrix(:yr, :'site') where id = :'prog_new'), :'act_code');
reset role;

-- ================================================================ M6. ringkasan & evaluasi
select zz_test.login('hse@demo.lourdes.test');
set role authenticated;
select zz_test.check('M6a ringkasan: capaian 0..100, program tertinggal berupa array',
  (select (s ->> 'achievement')::numeric between 0 and 100 and jsonb_typeof(s -> 'lagging') = 'array'
     and (s ->> 'programs_total')::integer >= 9 from (select __APP__.tsp_summary(:yr, :mo, :'site') s) x));
select zz_test.expect_error('M6b evaluasi bulan depan ditolak',
  format($q$select __APP__.tsp_evaluation_submit(%s, 1, %L)$q$, :yr + 1, :'site'), 'P0001', '%tidak valid%');
select (__APP__.tsp_evaluation_submit(:yr, 1, :'site') ->> 'id') as ev \gset
select zz_test.check('M6c evaluasi diajukan + snapshot tersimpan',
  (select status = 'submitted' and summary is not null from __APP__.tsp_evaluations where id = :'ev'));
select zz_test.expect_error('M6d ajukan ulang saat menunggu ditolak',
  format($q$select __APP__.tsp_evaluation_submit(%s, 1, %L)$q$, :yr, :'site'), 'P0001', '%sudah diajukan%');
select zz_test.expect_error('M6e HSE tidak bisa menyetujui',
  format($q$select __APP__.tsp_evaluation_decide(%L, true, null)$q$, :'ev'), '42501');
reset role;
select zz_test.login('pjo@demo.lourdes.test');
set role authenticated;
select zz_test.check('M6f PJO melihat tugas persetujuan evaluasi',
  exists (select 1 from __APP__.my_tasks() where kind = 'tsp_approve' and ref_id = :'ev'));
select zz_test.expect_error('M6g kembalikan tanpa alasan ditolak',
  format($q$select __APP__.tsp_evaluation_decide(%L, false, ' ')$q$, :'ev'), 'P0001', '%Alasan%');
select __APP__.tsp_evaluation_decide(:'ev', true, 'Disetujui');
select zz_test.check('M6h disetujui', (select status from __APP__.tsp_evaluations where id = :'ev') = 'approved');
reset role;
select zz_test.login('hse@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('M6i realisasi bulan yang disetujui terkunci',
  format($q$select __APP__.tsp_realization_save(%L, 1, 3, null)$q$, :'prog_new'), 'P0001', '%dikunci%');
reset role;

-- ================================================================ M7. salin program antar tahun
select zz_test.login('pengawas@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('M7a pengawas tidak bisa menyalin',
  format($q$select __APP__.tsp_programs_copy(%s, %s, %L)$q$, :yr, :yr + 1, :'site'), '42501');
reset role;
select zz_test.login('hse@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('M7b tahun sama ditolak',
  format($q$select __APP__.tsp_programs_copy(%s, %s, %L)$q$, :yr, :yr, :'site'), 'P0001', '%berbeda%');
select zz_test.expect_error('M7c tahun asal kosong ditolak',
  format($q$select __APP__.tsp_programs_copy(%s, %s, %L)$q$, :yr + 5, :yr + 6, :'site'), 'P0001', '%Tidak ada program%');
select (__APP__.tsp_programs_copy(:yr, :yr + 1, :'site') ->> 'copied')::integer as copied \gset
select zz_test.check('M7d program aktif tahun asal tersalin tanpa realisasi; salin ulang ditolak (nomor sudah ada)',
  :copied >= 9
  and (select count(*) from __APP__.tsp_programs where year = :yr + 1) = :copied
  and not exists (select 1 from __APP__.tsp_realizations r join __APP__.tsp_programs p on p.id = r.program_id where p.year = :yr + 1));
select zz_test.expect_error('M7e salin ulang tidak menggandakan',
  format($q$select __APP__.tsp_programs_copy(%s, %s, %L)$q$, :yr, :yr + 1, :'site'), 'P0001', '%Tidak ada program%');
reset role;
