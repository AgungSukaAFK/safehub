-- =====================================================================================
-- Uji fase 3: Laporan Periode (docs/spec/fase-3-tsp-laporan.md bagian 4). Setelah 01–07 di DB yang sama.
-- =====================================================================================
\set ON_ERROR_STOP on
set client_min_messages = notice;

select id as site from public.locations where name = 'Site MIFA' \gset
select id as tpl_hse from __APP__.report_templates where code = 'F-MAC-HSE-09-002' \gset
select id as tpl_pjo from __APP__.report_templates where code = 'F-MAC-IMS-08-015' \gset
select to_char(date_trunc('month', (now() at time zone 'Asia/Jakarta')::date), 'YYYY-MM') as cur \gset
select to_char(date_trunc('month', (now() at time zone 'Asia/Jakarta')::date) - interval '1 month', 'YYYY-MM') as prev \gset
select to_char(date_trunc('month', (now() at time zone 'Asia/Jakarta')::date) + interval '1 month', 'YYYY-MM') as nxt \gset

select zz_test.check('Q1a tabel laporan tanpa hak tulis; RPC bisa dipanggil authenticated; builder tertutup',
  not exists (select 1 from information_schema.role_table_grants where grantee = 'authenticated' and table_schema = '__APP__'
               and table_name in ('reports', 'report_versions', 'report_templates', 'reports_logs') and privilege_type in ('INSERT', 'UPDATE', 'DELETE'))
  and has_function_privilege('authenticated', '__APP__.report_create(jsonb)', 'execute')
  and not has_function_privilege('authenticated', '__APP__.report_build_data(uuid)', 'execute')
  and (select count(*) from __APP__.report_templates) = 2
  and exists (select 1 from __APP__.approval_doc_types where code = 'laporan'));

-- ---------------------------------------------------------------- buat
select zz_test.login('karyawan@demo.lourdes.test');
set role authenticated;
select zz_test.check('Q2a karyawan tidak melihat template/laporan', (select count(*) from __APP__.report_templates) = 0 and (select count(*) from __APP__.reports) = 0);
reset role;
select zz_test.login('pengawas@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('Q2b pengawas tidak bisa membuat laporan',
  format($q$select __APP__.report_create(jsonb_build_object('template_id', %L, 'location_id', %L, 'period', %L))$q$, :'tpl_hse', :'site', :'cur'), '42501');
reset role;
select zz_test.login('hse@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('Q2c periode bulan depan ditolak',
  format($q$select __APP__.report_create(jsonb_build_object('template_id', %L, 'location_id', %L, 'period', %L))$q$, :'tpl_hse', :'site', :'nxt'), 'P0001', '%tidak valid%');
select (__APP__.report_create(jsonb_build_object('template_id', :'tpl_hse', 'location_id', :'site', 'period', :'cur')) ->> 'id') as rep \gset
select zz_test.check('Q2d laporan dibuat: kode LAP-YYYY-MM, draf', (select code = 'LAP-' || :'cur' and status = 'draft' from __APP__.reports where id = :'rep'));
select zz_test.expect_error('Q2e duplikat ditolak',
  format($q$select __APP__.report_create(jsonb_build_object('template_id', %L, 'location_id', %L, 'period', %L))$q$, :'tpl_hse', :'site', :'cur'), 'P0001', '%sudah ada%');
select (__APP__.report_create(jsonb_build_object('template_id', :'tpl_pjo', 'location_id', :'site', 'period', :'cur')) ->> 'code') as code_pjo \gset
select zz_test.check('Q2f template PJO: LAP-PJO-YYYY-MM', :'code_pjo' = 'LAP-PJO-' || :'cur');

-- ---------------------------------------------------------------- data & kelengkapan
select zz_test.check('Q3a report_data memuat kpi, incidents, findings, inspections, tsp, sections',
  (select d ?& array['kpi', 'incidents', 'findings', 'inspections', 'tsp', 'sections'] from (select __APP__.report_data(:'rep') d) x));
select zz_test.check('Q3b kelengkapan: narasi belum terisi = gagal wajib',
  exists (select 1 from jsonb_array_elements(__APP__.report_completeness(:'rep')) c where c ->> 'key' = 'narratives' and not (c ->> 'ok')::boolean and (c ->> 'required')::boolean));
select zz_test.expect_error('Q3c narasi bagian non-narasi ditolak',
  format($q$select __APP__.report_save_narratives(%L, '{"kinerja":"x"}'::jsonb)$q$, :'rep'), 'P0001', '%tidak punya narasi%');
select zz_test.expect_error('Q3d ajukan tanpa lengkap & tanpa alasan ditolak',
  format($q$select __APP__.approval_start('laporan', %L)$q$, :'rep'), 'P0001', '%belum lengkap%');
select __APP__.report_save_narratives(:'rep', '{"ringkasan":"Ringkasan uji periode ini.","catatan":"Rencana bulan depan uji."}'::jsonb, 'Jam kerja menunggu data payroll.');
select __APP__.approval_start('laporan', :'rep');
select zz_test.check('Q3e diajukan dengan alasan kekurangan: pending_approval, 3 langkah',
  (select status from __APP__.reports where id = :'rep') = 'pending_approval'
  and (select count(*) from __APP__.approvals where doc_type = 'laporan' and record_id = :'rep') = 3);
select zz_test.expect_error('Q3f narasi tidak bisa diubah saat menunggu',
  format($q$select __APP__.report_save_narratives(%L, '{"ringkasan":"ubah"}'::jsonb)$q$, :'rep'), 'P0001', '%draf atau dikembalikan%');
reset role;

-- ---------------------------------------------------------------- approval 3 langkah → terbit
select id as ap1 from __APP__.approvals where doc_type = 'laporan' and record_id = :'rep' and step_no = 1 \gset
select id as ap2 from __APP__.approvals where doc_type = 'laporan' and record_id = :'rep' and step_no = 2 \gset
select id as ap3 from __APP__.approvals where doc_type = 'laporan' and record_id = :'rep' and step_no = 3 \gset
select zz_test.login('hse.senior@demo.lourdes.test');
set role authenticated;
select __APP__.approval_decide(:'ap1', 'approved', 'Data dicek');
reset role;
select zz_test.login('pjo@demo.lourdes.test');
set role authenticated;
select __APP__.approval_decide(:'ap2', 'approved', null);
select zz_test.check('Q4a belum terbit sebelum langkah terakhir', (select status from __APP__.reports where id = :'rep') = 'pending_approval');
reset role;
select zz_test.login('manajemen@demo.lourdes.test');
set role authenticated;
select __APP__.approval_decide(:'ap3', 'approved', null);
select zz_test.check('Q4b terbit: status published, versi 1.0, snapshot tersimpan',
  (select status = 'published' and current_version = '1.0' from __APP__.reports where id = :'rep')
  and (select snapshot ? 'kpi' and snapshot -> 'report' ->> 'code' = 'LAP-' || :'cur' from __APP__.report_versions where report_id = :'rep' and version = '1.0'));
reset role;

-- ---------------------------------------------------------------- koreksi → 1.1
select zz_test.login('hse@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('Q5a koreksi tanpa alasan memadai ditolak', format($q$select __APP__.report_start_correction(%L, 'singkat')$q$, :'rep'), 'P0001', '%minimal 10%');
select __APP__.report_start_correction(:'rep', 'Koreksi angka near miss setelah klasifikasi ulang.');
select zz_test.check('Q5b koreksi: kembali draf, versi 1.0 tetap ada', (select status = 'draft' from __APP__.reports where id = :'rep')
  and exists (select 1 from __APP__.report_versions where report_id = :'rep' and version = '1.0'));
select __APP__.report_save_narratives(:'rep', '{}'::jsonb, 'Kejadian periode masih menunggu klasifikasi HSE.');
select __APP__.approval_start('laporan', :'rep');
reset role;
select id as bp1 from __APP__.approvals where doc_type = 'laporan' and record_id = :'rep' and round = 2 and step_no = 1 \gset
select id as bp2 from __APP__.approvals where doc_type = 'laporan' and record_id = :'rep' and round = 2 and step_no = 2 \gset
select id as bp3 from __APP__.approvals where doc_type = 'laporan' and record_id = :'rep' and round = 2 and step_no = 3 \gset
select zz_test.login('hse.senior@demo.lourdes.test');
set role authenticated;
select __APP__.approval_decide(:'bp1', 'approved', null);
reset role;
select zz_test.login('pjo@demo.lourdes.test');
set role authenticated;
select __APP__.approval_decide(:'bp2', 'approved', null);
reset role;
select zz_test.login('manajemen@demo.lourdes.test');
set role authenticated;
select __APP__.approval_decide(:'bp3', 'approved', null);
select zz_test.check('Q5c koreksi terbit sebagai 1.1 dengan alasan; 1.0 tidak berubah',
  (select current_version = '1.1' and status = 'published' from __APP__.reports where id = :'rep')
  and (select count(*) from __APP__.report_versions where report_id = :'rep') = 2
  and (select reason like 'Koreksi angka%' from __APP__.report_versions where report_id = :'rep' and version = '1.1')
  and (select reason is null from __APP__.report_versions where report_id = :'rep' and version = '1.0'));
reset role;

-- ---------------------------------------------------------------- ditolak → dikembalikan
select zz_test.login('hse@demo.lourdes.test');
set role authenticated;
select (__APP__.report_create(jsonb_build_object('template_id', :'tpl_pjo', 'location_id', :'site', 'period', :'prev')) ->> 'id') as rep2 \gset
select __APP__.report_save_narratives(:'rep2', '{"ringkasan":"Ringkasan uji.","tindak_lanjut":"Tindak lanjut uji."}'::jsonb, 'Jam kerja belum tersedia dari payroll.');
select __APP__.approval_start('laporan', :'rep2');
reset role;
select id as rp1 from __APP__.approvals where doc_type = 'laporan' and record_id = :'rep2' and step_no = 1 \gset
select zz_test.login('hse.senior@demo.lourdes.test');
set role authenticated;
select __APP__.approval_decide(:'rp1', 'rejected', 'Angka belum sesuai sumber.');
select zz_test.check('Q6a ditolak: status rejected', (select status from __APP__.reports where id = :'rep2') = 'rejected');
reset role;
select zz_test.login('hse@demo.lourdes.test');
set role authenticated;
select __APP__.report_save_narratives(:'rep2', '{"ringkasan":"Ringkasan diperbaiki."}'::jsonb, 'Jam kerja belum tersedia dari payroll.');
select zz_test.check('Q6b narasi dikembalikan bisa diubah', (select narratives ->> 'ringkasan' from __APP__.reports where id = :'rep2') = 'Ringkasan diperbaiki.');
reset role;
