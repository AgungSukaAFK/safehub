-- =====================================================================================
-- Uji fase 4A: Manpower, Kompetensi/Sertifikat, MCU, Permit Site (docs/spec/fase-4-people-kontraktor-dokumen.md).
-- Setelah 01–08 di DB yang sama.
-- =====================================================================================
\set ON_ERROR_STOP on
set client_min_messages = notice;

select id as site from public.locations where name = 'Site MIFA' \gset
select id as e_rudi from __APP__.employees where code = 'GMI-0017' \gset
select id as e_hendra from __APP__.employees where code = 'GMI-0011' \gset
select id as comp_p3k from __APP__.competencies where code = 'p3k' \gset
select id as comp_bmc from __APP__.competencies where code = 'bmc' \gset
select id as comp_k3 from __APP__.competencies where code = 'k3_umum' \gset

select zz_test.check('R1a tabel people tanpa hak tulis untuk authenticated; RPC bisa dipanggil; mcu_restricted tertutup untuk anon',
  not exists (select 1 from information_schema.role_table_grants where grantee = 'authenticated' and table_schema = '__APP__'
               and table_name in ('employees', 'competencies', 'certificates', 'mcu_records', 'mcu_restricted', 'site_permits', 'position_requirements')
               and privilege_type in ('INSERT', 'UPDATE', 'DELETE'))
  and has_function_privilege('authenticated', '__APP__.employee_save(uuid, jsonb)', 'execute')
  and not has_function_privilege('anon', '__APP__.competency_matrix(uuid)', 'execute'));
select zz_test.check('R1b seed: 8 karyawan, 6 kompetensi, KPI manpower_fulfillment draf',
  (select count(*) from __APP__.employees) = 8 and (select count(*) from __APP__.competencies) = 6
  and (select status from __APP__.kpi_definitions where code = 'manpower_fulfillment') = 'draft');

-- ---------------------------------------------------------------- baca
select zz_test.login('karyawan@demo.lourdes.test');
set role authenticated;
select zz_test.check('R2a karyawan tidak melihat manpower/sertifikat/MCU', (select count(*) from __APP__.employees) = 0
  and (select count(*) from __APP__.certificates) = 0 and (select count(*) from __APP__.mcu_records) = 0);
reset role;
select zz_test.login('pengawas@demo.lourdes.test');
set role authenticated;
select zz_test.check('R2b pengawas melihat manpower dan ringkasan MCU, tapi TIDAK data medis terbatas',
  (select count(*) from __APP__.employees) = 8 and (select count(*) from __APP__.mcu_records) = 5
  and (select count(*) from __APP__.mcu_restricted) = 0);
reset role;
select zz_test.login('pjo@demo.lourdes.test');
set role authenticated;
select zz_test.check('R2c PJO juga tidak melihat diagnosis', (select count(*) from __APP__.mcu_restricted) = 0);
reset role;
select zz_test.login('hse@demo.lourdes.test');
set role authenticated;
select zz_test.check('R2d HSE melihat diagnosis (hanya baris berisi: 5 baris restricted)', (select count(*) from __APP__.mcu_restricted) = 5
  and exists (select 1 from __APP__.mcu_restricted where diagnosis like 'Hipertensi%'));
reset role;
select zz_test.login('hr@demo.lourdes.test');
set role authenticated;
select zz_test.check('R2e HR melihat diagnosis', (select count(*) from __APP__.mcu_restricted) = 5);
reset role;

-- ---------------------------------------------------------------- tulis
select zz_test.login('pengawas@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('R3a pengawas tidak bisa membuat karyawan',
  format($q$select __APP__.employee_save(null, jsonb_build_object('location_id', %L, 'code', 'GMI-0099', 'name', 'Uji', 'job_title', 'Mekanik'))$q$, :'site'), '42501');
select zz_test.expect_error('R3b pengawas tidak bisa mencatat MCU',
  format($q$select __APP__.mcu_save(null, jsonb_build_object('employee_id', %L, 'checked_on', current_date::text, 'valid_until', (current_date + 365)::text, 'result', 'fit'))$q$, :'e_rudi'), '42501');
reset role;
select zz_test.login('hr@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('R3c NIK ganda ditolak',
  format($q$select __APP__.employee_save(null, jsonb_build_object('location_id', %L, 'code', 'GMI-0017', 'name', 'Uji', 'job_title', 'Mekanik'))$q$, :'site'), 'P0001', '%sudah dipakai%');
select (__APP__.employee_save(null, jsonb_build_object('location_id', :'site', 'code', 'GMI-0099', 'name', 'Uji Karyawan', 'job_title', 'Mekanik',
  'department', 'Workshop', 'employment', 'PKWT', 'join_date', '2026-01-05')) ->> 'id') as e_new \gset
select zz_test.check('R3d karyawan baru tersimpan + log', exists (select 1 from __APP__.employees where id = :'e_new' and status = 'active')
  and exists (select 1 from __APP__.employees_logs where record_id = :'e_new' and action = 'create'));
select zz_test.expect_error('R3e MCU: tanggal pemeriksaan masa depan ditolak',
  format($q$select __APP__.mcu_save(null, jsonb_build_object('employee_id', %L, 'checked_on', (current_date + 2)::text, 'valid_until', (current_date + 365)::text, 'result', 'fit'))$q$, :'e_new'), 'P0001', '%tidak valid%');
select (__APP__.mcu_save(null, jsonb_build_object('employee_id', :'e_new', 'checked_on', current_date::text, 'valid_until', (current_date + 365)::text,
  'result', 'fit_note', 'diagnosis', 'Uji diagnosis rahasia')) ->> 'id') as mcu_new \gset
select zz_test.check('R3f MCU tersimpan; diagnosis di tabel terbatas, TIDAK masuk log', exists (select 1 from __APP__.mcu_restricted where mcu_id = :'mcu_new' and diagnosis = 'Uji diagnosis rahasia')
  and not exists (select 1 from __APP__.mcu_records_logs where record_id = :'mcu_new' and changes::text like '%rahasia%'));
select zz_test.expect_error('R3g sertifikat: berlaku sampai sebelum terbit ditolak',
  format($q$select __APP__.certificate_save(null, jsonb_build_object('employee_id', %L, 'competency_id', %L, 'issued_on', '2026-05-01', 'valid_until', '2026-04-01'))$q$, :'e_new', :'comp_k3'), 'P0001', '%sebelum tanggal terbit%');
select __APP__.certificate_save(null, jsonb_build_object('employee_id', :'e_new', 'competency_id', :'comp_k3', 'number', 'UJI-1', 'issued_on', '2026-01-01', 'valid_until', (current_date + 10)::text));
select __APP__.site_permit_save(null, jsonb_build_object('employee_id', :'e_new', 'name', 'Izin Masuk Site', 'valid_until', (current_date + 5)::text));
reset role;

-- ---------------------------------------------------------------- turunan: matriks, ringkasan
select zz_test.login('hse@demo.lourdes.test');
set role authenticated;
select zz_test.check('R4a matriks: sertifikat habis = expired; ≤30 hari = expiring; wajib tanpa sertifikat = missing; tidak wajib = na',
  (select state from __APP__.competency_matrix(:'site') where employee_id = :'e_hendra' and competency_id = :'comp_k3') = 'expired'
  and (select state from __APP__.competency_matrix(:'site') where employee_id = :'e_rudi' and competency_id = :'comp_bmc') = 'expiring'
  and (select state from __APP__.competency_matrix(:'site') where employee_id = :'e_rudi' and competency_id = :'comp_p3k') = 'missing'
  and (select state from __APP__.competency_matrix(:'site') where employee_id = :'e_hendra' and competency_id = :'comp_p3k') = 'na');
select zz_test.check('R4b ringkasan karyawan: Rudi MCU ada, kompetensi terpenuhi < wajib, permit terisi',
  (select mcu_until is not null and comp_ok < comp_required and permit_until is not null from __APP__.employee_overview(:'site') where employee_id = :'e_rudi'));
select zz_test.check('R4c manpower_summary: Teknisi AC kebutuhan 12, tersedia 2; Mekanik tersedia 3 (2 + karyawan uji)',
  (select required = 12 and available = 2 from __APP__.manpower_summary(:'site') where job_title = 'Teknisi AC')
  and (select available = 3 from __APP__.manpower_summary(:'site') where job_title = 'Mekanik'));
select zz_test.check('R4d expiry_state tepat di batas', __APP__.expiry_state(current_date, current_date) = 'expiring'
  and __APP__.expiry_state(current_date - 1, current_date) = 'expired' and __APP__.expiry_state(current_date + 31, current_date) = 'valid'
  and __APP__.expiry_state(null) = 'none');
reset role;

-- ---------------------------------------------------------------- nonaktif tidak dihitung
select zz_test.login('hr@demo.lourdes.test');
set role authenticated;
select __APP__.employee_save(:'e_new', jsonb_build_object('location_id', :'site', 'code', 'GMI-0099', 'name', 'Uji Karyawan', 'job_title', 'Mekanik', 'status', 'inactive'));
select zz_test.check('R5a karyawan nonaktif keluar dari ringkasan & matriks',
  (select available = 2 from __APP__.manpower_summary(:'site') where job_title = 'Mekanik')
  and not exists (select 1 from __APP__.competency_matrix(:'site') where employee_id = :'e_new'));
reset role;
