-- =====================================================================================
-- Uji fase 5: cermin data maintenance (docs/spec/fase-5-maintenance.md). Setelah 01–13.
-- =====================================================================================
\set ON_ERROR_STOP on
set client_min_messages = notice;

select (date_trunc('month', current_date) - interval '1 month')::date as pfrom,
       (date_trunc('month', current_date) - interval '1 day')::date as pto,
       (date_trunc('month', current_date)::date - (date_trunc('month', current_date) - interval '1 month')::date) as days,
       current_date as today \gset

select zz_test.check('M1a tabel cermin tanpa hak tulis untuk authenticated; RPC dashboard bisa dipanggil; impor baris tertutup',
  not exists (select 1 from information_schema.role_table_grants where grantee = 'authenticated' and table_schema = '__APP__'
               and table_name in ('mnt_units', 'mnt_downtime', 'mnt_ps', 'mnt_backlog', 'mnt_sync_state') and privilege_type in ('INSERT', 'UPDATE', 'DELETE'))
  and has_function_privilege('authenticated', '__APP__.mnt_dashboard(uuid, date, date)', 'execute')
  and not has_function_privilege('anon', '__APP__.mnt_dashboard(uuid, date, date)', 'execute')
  and not has_function_privilege('authenticated', '__APP__.import_row_mnt(text, text, jsonb, text)', 'execute'));
select zz_test.check('M1b seed: 8 unit, 6 downtime, 6 PS, 6 backlog, 5 KPI maintenance draf',
  (select count(*) from __APP__.mnt_units) = 8 and (select count(*) from __APP__.mnt_downtime) = 6
  and (select count(*) from __APP__.mnt_ps) = 6 and (select count(*) from __APP__.mnt_backlog) = 6
  and (select count(*) from __APP__.kpi_definitions where code like 'mnt\_%' and status = 'draft') = 5);

-- ---------------------------------------------------------------- baca
select zz_test.login('karyawan@demo.lourdes.test');
set role authenticated;
select zz_test.check('M2a karyawan tidak melihat data maintenance', (select count(*) from __APP__.mnt_units) = 0 and (select count(*) from __APP__.mnt_downtime) = 0);
reset role;
select zz_test.login('pengawas@demo.lourdes.test');
set role authenticated;
select zz_test.check('M2b staf K3 membaca unit, downtime, PS, backlog', (select count(*) from __APP__.mnt_units) = 8 and (select count(*) from __APP__.mnt_ps) = 6 and (select count(*) from __APP__.mnt_backlog) = 6);
select __APP__.mnt_dashboard(null, :'pfrom'::date, :'pto'::date) as dash \gset
select zz_test.check('M3a PA = (tersedia - breakdown) / tersedia; unit dihentikan tidak dihitung (7 unit operasi, 120 jam breakdown)',
  (:'dash'::jsonb ->> 'pa')::numeric = round(((7 * :days * 24 - 120)::numeric / (7 * :days * 24) * 100), 1)
  and (:'dash'::jsonb -> 'units' ->> 'operating')::int = 7 and (:'dash'::jsonb ->> 'breakdown_hours')::numeric = 120);
select zz_test.check('M3b MTTR = 40 jam; MTBF = jam operasi / 3; downtime terencana dipisah (24 jam)',
  (:'dash'::jsonb ->> 'mttr_hours')::numeric = 40.0 and (:'dash'::jsonb ->> 'breakdown_count')::int = 3
  and (:'dash'::jsonb ->> 'mtbf_hours')::numeric = round(((7 * :days * 24 - 120)::numeric / 3), 1) and (:'dash'::jsonb ->> 'planned_hours')::numeric = 24);
select zz_test.check('M3c PS Accuracy: 4 dari 6 tepat (toleransi 2 hari) = 67%; 1 terlambat belum dikerjakan',
  (:'dash'::jsonb -> 'ps' ->> 'planned')::int = 6 and (:'dash'::jsonb -> 'ps' ->> 'on_time')::int = 4
  and (:'dash'::jsonb -> 'ps' ->> 'accuracy')::numeric = 67 and (:'dash'::jsonb -> 'ps' ->> 'overdue')::int = 1);
select zz_test.check('M3d Backlog open per akhir periode: 5 (2 high, 1 medium, 2 low); yang ditutup bulan ini masih terhitung open di bulan lalu',
  (:'dash'::jsonb -> 'backlog' ->> 'total')::int = 5 and (:'dash'::jsonb -> 'backlog' ->> 'high')::int = 2
  and (:'dash'::jsonb -> 'backlog' ->> 'medium')::int = 1 and (:'dash'::jsonb -> 'backlog' ->> 'low')::int = 2);
select zz_test.check('M3e top breakdown: DZ-101 (50 jam) teratas; unit dihentikan tidak muncul; sumber sinkron terbaca',
  (:'dash'::jsonb -> 'top_breakdown' -> 0 ->> 'code') = 'DZ-101' and not (:'dash'::jsonb -> 'top_breakdown')::text like '%CMP-04%'
  and (:'dash'::jsonb -> 'sync' -> 'mnt_units' ->> 'rows')::int = 8);
select zz_test.expect_error('M3f periode terbalik ditolak', format($q$select __APP__.mnt_dashboard(null, %L::date, %L::date)$q$, :'pto', :'pfrom'), 'P0001', '%Periode tidak valid%');
select zz_test.expect_error('M3g pengawas tidak bisa mengimpor data maintenance',
  $q$select __APP__.import_commit('mnt_units', 'upsert', 'x.xlsx', null, null, '[{"n":2,"d":{"kode":"X-1","site":"Site MIFA","status":"active"}}]'::jsonb)$q$, '42501');
reset role;

-- ---------------------------------------------------------------- impor oleh Service/Maintenance
select zz_test.login('hr@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('M4a HR (bukan maintenance/HSE) tidak bisa mengimpor data maintenance',
  $q$select __APP__.import_commit('mnt_units', 'upsert', 'x.xlsx', null, null, '[{"n":2,"d":{"kode":"X-1","site":"Site MIFA","status":"active"}}]'::jsonb)$q$, '42501');
reset role;
select zz_test.login('maintenance@demo.lourdes.test');
set role authenticated;
select __APP__.import_commit('mnt_units', 'insert', 'unit.xlsx', null, null, jsonb_build_array(
  jsonb_build_object('n', 2, 'd', jsonb_build_object('kode', 'TST-1', 'model', 'Uji Unit', 'site', 'Site MIFA', 'status', 'active')),
  jsonb_build_object('n', 3, 'd', jsonb_build_object('kode', 'EX-201', 'site', 'Site MIFA', 'status', 'active')),
  jsonb_build_object('n', 4, 'd', jsonb_build_object('kode', 'TST-2', 'site', 'Site Tidak Ada', 'status', 'active')))) as r1 \gset
select zz_test.check('M4b impor unit: 1 baru, 1 duplikat (mode Tambah baru), 1 site tak dikenal; sinkron tercatat',
  (:'r1'::jsonb ->> 'ok')::int = 1 and (:'r1'::jsonb ->> 'failed')::int = 2
  and exists (select 1 from __APP__.mnt_units where code = 'TST-1' and model = 'Uji Unit')
  and (:'r1'::jsonb -> 'errors' -> 0 ->> 'message') like '%sudah ada%' and (:'r1'::jsonb -> 'errors' -> 1 ->> 'message') like '%Site%tidak ditemukan%'
  and exists (select 1 from __APP__.mnt_sync_state where target = 'mnt_units' and filename = 'unit.xlsx' and row_count = 1));
select __APP__.import_commit('mnt_downtime', 'upsert', 'dt.xlsx', null, null, jsonb_build_array(
  jsonb_build_object('n', 2, 'd', jsonb_build_object('unit', 'TST-1', 'tanggal', (:'today'::date - 3)::text, 'jam', '12.5', 'jenis', 'breakdown', 'keterangan', 'Uji', 'id_sumber', 'SRC-1')),
  jsonb_build_object('n', 3, 'd', jsonb_build_object('unit', 'TST-1', 'tanggal', (:'today'::date + 5)::text, 'jam', '2', 'jenis', 'breakdown')),
  jsonb_build_object('n', 4, 'd', jsonb_build_object('unit', 'ZZZ-9', 'tanggal', (:'today'::date - 1)::text, 'jam', '2', 'jenis', 'breakdown')),
  jsonb_build_object('n', 5, 'd', jsonb_build_object('unit', 'TST-1', 'tanggal', (:'today'::date - 1)::text, 'jam', '900', 'jenis', 'breakdown')))) as r2 \gset
select zz_test.check('M4c impor downtime: hanya baris valid masuk (tanggal depan, unit tak dikenal, jam > 744 ditolak)',
  (:'r2'::jsonb ->> 'ok')::int = 1 and (:'r2'::jsonb ->> 'failed')::int = 3
  and exists (select 1 from __APP__.mnt_downtime d join __APP__.mnt_units u on u.id = d.unit_id where u.code = 'TST-1' and d.hours = 12.5 and d.source_key = 'SRC-1')
  and (:'r2'::jsonb -> 'errors' -> 1 ->> 'message') like '%Unit "ZZZ-9" tidak ditemukan%');
-- impor ulang: idempoten (kunci sumber sama → diperbarui, bukan dobel)
select __APP__.import_commit('mnt_downtime', 'upsert', 'dt.xlsx', null, null, jsonb_build_array(
  jsonb_build_object('n', 2, 'd', jsonb_build_object('unit', 'TST-1', 'tanggal', (:'today'::date - 3)::text, 'jam', '20', 'jenis', 'breakdown', 'id_sumber', 'SRC-1')))) as r3 \gset
select zz_test.check('M4d impor ulang idempoten: kunci sumber sama diperbarui (20 jam), tidak ganda; mode Tambah baru menolak',
  (select count(*) from __APP__.mnt_downtime d join __APP__.mnt_units u on u.id = d.unit_id where u.code = 'TST-1') = 1
  and (select hours from __APP__.mnt_downtime d join __APP__.mnt_units u on u.id = d.unit_id where u.code = 'TST-1') = 20
  and ((select __APP__.import_commit('mnt_downtime', 'insert', 'dt.xlsx', null, null, jsonb_build_array(
        jsonb_build_object('n', 2, 'd', jsonb_build_object('unit', 'TST-1', 'tanggal', (:'today'::date - 3)::text, 'jam', '20', 'jenis', 'breakdown', 'id_sumber', 'SRC-1'))))) ->> 'failed')::int = 1);
select __APP__.import_commit('mnt_ps', 'upsert', 'ps.xlsx', null, null, jsonb_build_array(
  jsonb_build_object('n', 2, 'd', jsonb_build_object('unit', 'TST-1', 'jenis_ps', 'PS 250 jam', 'rencana', (:'today'::date - 10)::text, 'aktual', (:'today'::date - 9)::text)),
  jsonb_build_object('n', 3, 'd', jsonb_build_object('unit', 'TST-1', 'jenis_ps', 'PS 500 jam', 'rencana', (:'today'::date + 20)::text, 'aktual', (:'today'::date + 1)::text)))) as r4 \gset
select zz_test.check('M5a impor PS: aktual di masa depan ditolak', (:'r4'::jsonb ->> 'ok')::int = 1 and (:'r4'::jsonb ->> 'failed')::int = 1);
select __APP__.import_commit('mnt_backlog', 'upsert', 'bl.xlsx', null, null, jsonb_build_array(
  jsonb_build_object('n', 2, 'd', jsonb_build_object('unit', 'TST-1', 'judul', 'Uji backlog', 'prioritas', 'high', 'status', 'open', 'dibuka', (:'today'::date - 30)::text)),
  jsonb_build_object('n', 3, 'd', jsonb_build_object('unit', 'TST-1', 'judul', 'Selesai tanpa tanggal', 'prioritas', 'low', 'status', 'done', 'dibuka', (:'today'::date - 30)::text)),
  jsonb_build_object('n', 4, 'd', jsonb_build_object('unit', 'TST-1', 'judul', 'Open tapi ditutup', 'prioritas', 'low', 'status', 'open', 'dibuka', (:'today'::date - 30)::text, 'ditutup', (:'today'::date - 1)::text)))) as r5 \gset
select zz_test.check('M5b impor backlog: status/tanggal tidak konsisten ditolak', (:'r5'::jsonb ->> 'ok')::int = 1 and (:'r5'::jsonb ->> 'failed')::int = 2
  and (:'r5'::jsonb -> 'errors' -> 0 ->> 'message') like '%wajib punya tanggal ditutup%');
reset role;
