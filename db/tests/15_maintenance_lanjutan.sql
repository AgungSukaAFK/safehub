-- =====================================================================================
-- Uji fase 5 lanjutan: Readiness LIB, Metal Scrap, impor TSP, Maintenance + Isu Terbuka di Laporan Periode. Setelah 01-14.
-- =====================================================================================
\set ON_ERROR_STOP on
set client_min_messages = notice;

select (date_trunc('month', current_date) - interval '1 month')::date as pfrom,
       (date_trunc('month', current_date) - interval '1 day')::date as pto,
       current_date as today \gset

select zz_test.check('L1a tabel LIB/Scrap tanpa hak tulis untuk authenticated; RPC ringkasan terbuka bagi login, tertutup bagi anon; baris impor tertutup',
  not exists (select 1 from information_schema.role_table_grants where grantee = 'authenticated' and table_schema = '__APP__'
               and table_name in ('mnt_lib', 'mnt_scrap') and privilege_type in ('INSERT', 'UPDATE', 'DELETE'))
  and has_function_privilege('authenticated', '__APP__.mnt_extra(uuid, date, date, text)', 'execute')
  and not has_function_privilege('anon', '__APP__.mnt_extra(uuid, date, date, text)', 'execute')
  and not has_function_privilege('authenticated', '__APP__.import_row_mnt_ext(text, text, jsonb, text)', 'execute')
  and not has_function_privilege('authenticated', '__APP__.import_row_tsp(text, jsonb, text)', 'execute')
  and not has_function_privilege('authenticated', '__APP__.mnt_dashboard_for(uuid, date, date, text)', 'execute'));
select zz_test.check('L1b seed: 6 part LIB, 7 baris scrap', (select count(*) from __APP__.mnt_lib) = 6 and (select count(*) from __APP__.mnt_scrap) = 7);

select zz_test.login('karyawan@demo.lourdes.test');
set role authenticated;
select zz_test.check('L2a karyawan tidak melihat LIB/Scrap', (select count(*) from __APP__.mnt_lib) = 0 and (select count(*) from __APP__.mnt_scrap) = 0);
reset role;

select zz_test.login('pengawas@demo.lourdes.test');
set role authenticated;
select __APP__.mnt_extra(null, :'pfrom'::date, :'pto'::date) as ex \gset
select zz_test.check('L3a Readiness LIB: 5 part ber-minimum, 3 siap (stok >= minimum) = 60%, 2 di bawah minimum',
  (:'ex'::jsonb -> 'lib' ->> 'with_min')::int = 5 and (:'ex'::jsonb -> 'lib' ->> 'ready')::int = 3
  and (:'ex'::jsonb -> 'lib' ->> 'readiness_pct')::numeric = 60 and (:'ex'::jsonb -> 'lib' ->> 'below_min')::int = 2);
select zz_test.check('L3b Non-moving: stok > 0 dan > 180 hari / belum pernah bergerak = 3 (seal 400 hari, track 260 hari, bearing tanpa pergerakan); stok 0 tidak dihitung',
  (:'ex'::jsonb -> 'lib' ->> 'non_moving')::int = 3 and (:'ex'::jsonb -> 'lib' -> 'top_non_moving' -> 0 ->> 'code') = 'BRG-0033');
select zz_test.check('L3c Scrap bulan lalu: aktual 4475 kg vs forecast 4320 kg = 104%; forecast bulan berikutnya (= bulan berjalan) 4000 + 200',
  (:'ex'::jsonb -> 'scrap' ->> 'actual_kg')::numeric = 4475 and (:'ex'::jsonb -> 'scrap' ->> 'forecast_kg')::numeric = 4320
  and (:'ex'::jsonb -> 'scrap' ->> 'achievement_pct')::numeric = 104
  and (:'ex'::jsonb -> 'scrap' ->> 'next_forecast_kg')::numeric = 4200 and jsonb_array_length(:'ex'::jsonb -> 'scrap' -> 'by_metal') = 3);
select zz_test.expect_error('L3d periode terbalik ditolak', format($q$select __APP__.mnt_extra(null, %L::date, %L::date)$q$, :'pto', :'pfrom'), 'P0001', '%Periode tidak valid%');
select zz_test.expect_error('L3e pengawas tidak bisa mengimpor LIB',
  $q$select __APP__.import_commit('mnt_lib', 'upsert', 'x.xlsx', null, null, '[{"n":2,"d":{"site":"Site MIFA","kode_part":"X","nama":"X","stok":"1"}}]'::jsonb)$q$, '42501');
reset role;

-- ---------------------------------------------------------------- impor oleh Maintenance
select zz_test.login('maintenance@demo.lourdes.test');
set role authenticated;
select __APP__.import_commit('mnt_lib', 'insert', 'lib.xlsx', null, null, jsonb_build_array(
  jsonb_build_object('n', 2, 'd', jsonb_build_object('site', 'Site MIFA', 'kode_part', 'TST-P1', 'nama', 'Part uji', 'satuan', 'pcs', 'stok', '5', 'minimum', '2', 'terakhir_bergerak', (:'today'::date - 5)::text)),
  jsonb_build_object('n', 3, 'd', jsonb_build_object('site', 'Site MIFA', 'kode_part', 'FLT-0101', 'nama', 'Duplikat', 'stok', '1')),
  jsonb_build_object('n', 4, 'd', jsonb_build_object('site', 'Site MIFA', 'kode_part', 'TST-P2', 'nama', 'Masa depan', 'stok', '1', 'terakhir_bergerak', (:'today'::date + 3)::text)),
  jsonb_build_object('n', 5, 'd', jsonb_build_object('site', 'Site Tidak Ada', 'kode_part', 'TST-P3', 'nama', 'Site salah', 'stok', '1')))) as r1 \gset
select zz_test.check('L4a impor LIB: 1 masuk; duplikat (Tambah baru), tanggal depan, site tak dikenal ditolak',
  (:'r1'::jsonb ->> 'ok')::int = 1 and (:'r1'::jsonb ->> 'failed')::int = 3
  and exists (select 1 from __APP__.mnt_lib where part_code = 'TST-P1' and qty = 5 and min_qty = 2)
  and exists (select 1 from __APP__.mnt_sync_state where target = 'mnt_lib' and filename = 'lib.xlsx'));
select __APP__.import_commit('mnt_scrap', 'upsert', 'scrap.xlsx', null, null, jsonb_build_array(
  jsonb_build_object('n', 2, 'd', jsonb_build_object('site', 'Site MIFA', 'bulan', (:'pfrom'::date + 9)::text, 'logam', 'Besi/baja', 'aktual_kg', '5000', 'forecast_kg', '4000')),
  jsonb_build_object('n', 3, 'd', jsonb_build_object('site', 'Site MIFA', 'bulan', (:'pfrom'::date)::text, 'logam', 'Kuningan', 'aktual_kg', '', 'forecast_kg', '')),
  jsonb_build_object('n', 4, 'd', jsonb_build_object('site', 'Site MIFA', 'bulan', ((date_trunc('month', :'today'::date) + interval '2 month')::date)::text, 'logam', 'Besi/baja', 'aktual_kg', '10')))) as r2 \gset
select zz_test.check('L4b impor scrap: bulan memakai tanggal berapa pun di bulan itu; upsert memperbarui (bukan ganda); tanpa angka dan aktual bulan depan ditolak',
  (:'r2'::jsonb ->> 'ok')::int = 1 and (:'r2'::jsonb ->> 'failed')::int = 2
  and (select actual_kg from __APP__.mnt_scrap where month = :'pfrom'::date and metal = 'Besi/baja') = 5000
  and (select count(*) from __APP__.mnt_scrap where month = :'pfrom'::date and metal = 'Besi/baja') = 1);
reset role;

-- ---------------------------------------------------------------- impor realisasi TSP
select zz_test.login('hr@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('L5a HR tidak bisa mengimpor realisasi TSP',
  $q$select __APP__.import_commit('tsp_realizations', 'upsert', 't.xlsx', null, null, '[{"n":2,"d":{"site":"Site MIFA","tahun":"2026","no_program":"3.5","bulan":"1","aktual":"1"}}]'::jsonb)$q$, '42501');
reset role;
select zz_test.login('hse@demo.lourdes.test');
set role authenticated;
select extract(year from now() at time zone 'Asia/Jakarta')::int as yr, extract(month from now() at time zone 'Asia/Jakarta')::int as mo \gset
select __APP__.import_commit('tsp_realizations', 'upsert', 'tsp.xlsx', null, null, jsonb_build_array(
  jsonb_build_object('n', 2, 'd', jsonb_build_object('site', 'Site MIFA', 'tahun', :'yr'::text, 'no_program', '3.5', 'bulan', :'mo'::text, 'aktual', '2', 'catatan', 'Impor uji')),
  jsonb_build_object('n', 3, 'd', jsonb_build_object('site', 'Site MIFA', 'tahun', :'yr'::text, 'no_program', 'ZZ-0', 'bulan', :'mo'::text, 'aktual', '1')),
  jsonb_build_object('n', 4, 'd', jsonb_build_object('site', 'Site MIFA', 'tahun', :'yr'::text, 'no_program', '3.5', 'bulan', (:'mo'::int + 1)::text, 'aktual', '1')))) as r3 \gset
select zz_test.check('L5b impor TSP: bulan berjalan tersimpan lewat RPC realisasi; program tak dikenal dan bulan depan (belum berjalan) ditolak',
  (:'r3'::jsonb ->> 'ok')::int = 1 and (:'r3'::jsonb ->> 'failed')::int = 2
  and exists (select 1 from __APP__.tsp_realizations r join __APP__.tsp_programs p on p.id = r.program_id where p.no = '3.5' and p.year = :yr and r.month = :mo and r.actual = 2)
  and exists (select 1 from jsonb_array_elements(:'r3'::jsonb -> 'errors') e where e ->> 'message' like '%ZZ-0%tidak ditemukan%'));
reset role;

-- ---------------------------------------------------------------- Laporan Periode
select zz_test.check('L6a template PJO: Maintenance dan Isu Terbuka punya sumber (bukan unavailable)',
  exists (select 1 from __APP__.report_templates t, jsonb_array_elements(t.sections) s where t.code = 'F-MAC-IMS-08-015' and s ->> 'key' = 'maintenance' and s ->> 'source' = 'maintenance')
  and exists (select 1 from __APP__.report_templates t, jsonb_array_elements(t.sections) s where t.code = 'F-MAC-IMS-08-015' and s ->> 'key' = 'isu' and s ->> 'source' = 'issues'));
select r.id as rep from __APP__.reports r limit 1 \gset
select __APP__.report_build_data(:'rep') as rd \gset
select zz_test.check('L6b report_build_data memuat kunci maintenance (inti + LIB + scrap) dan issues',
  (:'rd'::jsonb ? 'maintenance') and (:'rd'::jsonb ? 'issues')
  and (:'rd'::jsonb -> 'maintenance' ? 'lib') and (:'rd'::jsonb -> 'maintenance' ? 'scrap') and (:'rd'::jsonb -> 'issues' ? 'open_end'));
