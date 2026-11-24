-- =====================================================================================
-- Uji fase 4C: Kontraktor & PJO/PJA (docs/spec/fase-4-people-kontraktor-dokumen.md). Setelah 01–10 di DB yang sama.
-- =====================================================================================
\set ON_ERROR_STOP on
set client_min_messages = notice;

select id as c_sinar from __APP__.contractors where name = 'PT Sinar Teknik Mandiri' \gset
select id as c_cipta from __APP__.contractors where name = 'PT Cipta Lingkungan Aceh' \gset
select id as c_bara from __APP__.contractors where name = 'PT Bara Safety Indonesia' \gset
select id as e_andi from __APP__.employees where code = 'GMI-0008' \gset
select id as e_fajar from __APP__.employees where code = 'GMI-0004' \gset
select id as t_nib from __APP__.contractor_doc_types where code = 'nib' \gset
select id as k_sinar from __APP__.contractor_contracts where number = 'KTR/GMI/2025/014' \gset

select zz_test.check('Z1a tabel kontraktor tanpa hak tulis untuk authenticated; RPC bisa dipanggil; anon tidak',
  not exists (select 1 from information_schema.role_table_grants where grantee = 'authenticated' and table_schema = '__APP__'
               and table_name in ('contractor_permits', 'contractor_contracts', 'contractor_contract_values', 'csms_assessments', 'contractor_documents', 'pjo_pja_appointments', 'contractor_doc_types')
               and privilege_type in ('INSERT', 'UPDATE', 'DELETE'))
  and has_function_privilege('authenticated', '__APP__.contractor_save(uuid, jsonb)', 'execute')
  and not has_function_privilege('anon', '__APP__.contractor_overview()', 'execute'));
select zz_test.check('Z1b seed: 7 izin? (5), 2 kontrak, 2 CSMS, 12 baris checklist, 2 penunjukan, 6 jenis dokumen',
  (select count(*) from __APP__.contractor_permits) = 5 and (select count(*) from __APP__.contractor_contracts) = 2
  and (select count(*) from __APP__.csms_assessments) = 2 and (select count(*) from __APP__.contractor_documents) = 12
  and (select count(*) from __APP__.pjo_pja_appointments) = 2 and (select count(*) from __APP__.contractor_doc_types) = 6);

-- ---------------------------------------------------------------- baca
select zz_test.login('karyawan@demo.lourdes.test');
set role authenticated;
select zz_test.check('Z2a karyawan tidak melihat izin/kontrak/CSMS/penunjukan',
  (select count(*) from __APP__.contractor_permits) = 0 and (select count(*) from __APP__.contractor_contracts) = 0
  and (select count(*) from __APP__.csms_assessments) = 0 and (select count(*) from __APP__.pjo_pja_appointments) = 0);
reset role;
select zz_test.login('pengawas@demo.lourdes.test');
set role authenticated;
select zz_test.check('Z2b staf K3 melihat kontrak tapi TIDAK nilai komersial', (select count(*) from __APP__.contractor_contracts) = 2
  and (select count(*) from __APP__.contractor_contract_values) = 0);
select zz_test.expect_error('Z2c pengawas tidak bisa membuat kontraktor',
  $q$select __APP__.contractor_save(null, jsonb_build_object('name', 'PT Uji', 'kind', 'vendor'))$q$, '42501');
reset role;
select zz_test.login('manajemen@demo.lourdes.test');
set role authenticated;
select zz_test.check('Z2d manajemen melihat nilai kontrak', (select count(*) from __APP__.contractor_contract_values) = 2);
select zz_test.expect_error('Z2e manajemen (bukan pengelola) tidak bisa menulis kontrak',
  format($q$select __APP__.contractor_contract_save(null, jsonb_build_object('contractor_id', %L, 'number', 'X-1', 'title', 'Uji', 'starts_on', current_date::text, 'ends_on', current_date::text))$q$, :'c_sinar'), '42501');
reset role;

-- ---------------------------------------------------------------- tulis (Pengelola Kontraktor)
select zz_test.login('kontraktor@demo.lourdes.test');
set role authenticated;
select zz_test.check('Z3a pengelola melihat nilai kontrak', (select count(*) from __APP__.contractor_contract_values) = 2);
select (__APP__.contractor_save(null, jsonb_build_object('company_code', 'GMI', 'name', 'PT Uji Kontraktor', 'kind', 'vendor', 'pic_name', 'Uji')) ->> 'id') as c_new \gset
reset role;
select zz_test.check('Z3b kontraktor baru tersimpan + log', exists (select 1 from __APP__.contractors where id = :'c_new' and pic_name = 'Uji')
  and exists (select 1 from __APP__.contractors_logs where record_id = :'c_new' and action = 'create'));
select zz_test.login('kontraktor@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('Z3c nama kontraktor ganda ditolak',
  $q$select __APP__.contractor_save(null, jsonb_build_object('company_code', 'GMI', 'name', 'pt uji kontraktor', 'kind', 'vendor'))$q$, 'P0001', '%sudah ada%');
select zz_test.check('Z3d tanpa izin = legalitas none', (select legal_state from __APP__.contractor_overview() where contractor_id = :'c_new') = 'none');
select __APP__.contractor_permit_save(null, jsonb_build_object('contractor_id', :'c_new', 'name', 'NIB', 'valid_until', (current_date + 10)::text));
select __APP__.contractor_permit_save(null, jsonb_build_object('contractor_id', :'c_new', 'name', 'SBU', 'valid_until', (current_date - 1)::text));
select zz_test.check('Z3e satu izin kedaluwarsa = legalitas expired', (select legal_state from __APP__.contractor_overview() where contractor_id = :'c_new') = 'expired');
select zz_test.check('Z3f seed: Sinar expiring (SBU 20 hari), Cipta expired (izin limbah), Bara valid',
  (select legal_state from __APP__.contractor_overview() where contractor_id = :'c_sinar') = 'expiring'
  and (select legal_state from __APP__.contractor_overview() where contractor_id = :'c_cipta') = 'expired'
  and (select legal_state from __APP__.contractor_overview() where contractor_id = :'c_bara') = 'valid');
select zz_test.expect_error('Z3g kontrak: berakhir sebelum mulai ditolak',
  format($q$select __APP__.contractor_contract_save(null, jsonb_build_object('contractor_id', %L, 'number', 'Z-9', 'title', 'Uji kontrak', 'starts_on', current_date::text, 'ends_on', (current_date - 1)::text))$q$, :'c_new'), 'P0001', '%tidak valid%');
select __APP__.contractor_contract_save(null, jsonb_build_object('contractor_id', :'c_new', 'number', 'Z-1', 'title', 'Uji kontrak', 'starts_on', current_date::text, 'ends_on', (current_date + 30)::text, 'amount', '125000000'));
select zz_test.check('Z3h kontrak + nilai tersimpan; nilai TIDAK masuk log',
  exists (select 1 from __APP__.contractor_contract_values v join __APP__.contractor_contracts k on k.id = v.contract_id where k.number = 'Z-1' and v.amount = 125000000)
  and not exists (select 1 from __APP__.contractor_contracts_logs l join __APP__.contractor_contracts k on k.id = l.record_id where k.number = 'Z-1' and l.changes::text like '%125000000%'));
select zz_test.expect_error('Z3i nomor kontrak ganda ditolak',
  format($q$select __APP__.contractor_contract_save(null, jsonb_build_object('contractor_id', %L, 'number', 'Z-1', 'title', 'Dobel', 'starts_on', current_date::text, 'ends_on', (current_date + 5)::text))$q$, :'c_new'), 'P0001', '%sudah dipakai%');
select zz_test.expect_error('Z3j CSMS: skor di luar 0-100 ditolak',
  format($q$select __APP__.csms_save(null, jsonb_build_object('contractor_id', %L, 'assessed_on', current_date::text, 'score', '120'))$q$, :'c_new'), 'P0001', '%0 sampai 100%');
select (__APP__.csms_save(null, jsonb_build_object('contractor_id', :'c_new', 'assessed_on', current_date::text, 'score', '85')) ->> 'result') as r85 \gset
select (__APP__.csms_save(null, jsonb_build_object('contractor_id', :'c_new', 'assessed_on', current_date::text, 'score', '70')) ->> 'result') as r70 \gset
select (__APP__.csms_save(null, jsonb_build_object('contractor_id', :'c_new', 'assessed_on', current_date::text, 'score', '40')) ->> 'result') as r40 \gset
select zz_test.check('Z3k CSMS: 85 lulus, 70 bersyarat, 40 gagal; masa berlaku default +1 tahun',
  :'r85' = 'pass' and :'r70' = 'conditional' and :'r40' = 'fail'
  and exists (select 1 from __APP__.csms_assessments where contractor_id = :'c_new' and valid_until = (current_date + interval '1 year')::date));
select __APP__.contractor_document_set(jsonb_build_object('contractor_id', :'c_new', 'type_id', :'t_nib', 'status', 'received'));
select zz_test.check('Z3l checklist: 1 dokumen diterima dari 6 jenis', (select docs_ok from __APP__.contractor_overview() where contractor_id = :'c_new') = 1
  and (select docs_total from __APP__.contractor_overview() where contractor_id = :'c_new') = 6);
reset role;

-- ---------------------------------------------------------------- PJO/PJA
select zz_test.login('kontraktor@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('Z4a penunjukan: berlaku sampai sebelum mulai ditolak',
  format($q$select __APP__.pjo_pja_save(null, jsonb_build_object('employee_id', %L, 'role', 'pja', 'scope', 'Pit Area', 'sk_number', 'SK-1', 'starts_on', current_date::text, 'valid_until', (current_date - 1)::text))$q$, :'e_fajar'), 'P0001', '%tidak valid%');
select zz_test.expect_error('Z4b peran harus pjo/pja',
  format($q$select __APP__.pjo_pja_save(null, jsonb_build_object('employee_id', %L, 'role', 'boss', 'scope', 'Pit Area', 'sk_number', 'SK-1', 'starts_on', current_date::text, 'valid_until', (current_date + 5)::text))$q$, :'e_fajar'), 'P0001', '%PJO atau PJA%');
select (__APP__.pjo_pja_save(null, jsonb_build_object('employee_id', :'e_fajar', 'role', 'pja', 'scope', 'Pit Area', 'sk_number', 'SK-UJI-1', 'starts_on', current_date::text, 'valid_until', (current_date + 90)::text)) ->> 'id') as a_new \gset
select zz_test.check('Z4c penunjukan tersimpan, site mengikuti karyawan, ada log',
  exists (select 1 from __APP__.pjo_pja_appointments a join __APP__.employees e on e.id = a.employee_id where a.id = :'a_new' and a.location_id = e.location_id)
  and exists (select 1 from __APP__.pjo_pja_appointments_logs where record_id = :'a_new' and action = 'create'));
reset role;
select zz_test.login('pengawas@demo.lourdes.test');
set role authenticated;
select zz_test.check('Z4d staf K3 melihat register PJO/PJA', (select count(*) from __APP__.pjo_pja_appointments) = 3);
select zz_test.expect_error('Z4e pengawas tidak bisa menetapkan PJO/PJA',
  format($q$select __APP__.pjo_pja_save(null, jsonb_build_object('employee_id', %L, 'role', 'pjo', 'scope', 'X', 'sk_number', 'SK-2', 'starts_on', current_date::text, 'valid_until', (current_date + 5)::text))$q$, :'e_andi'), '42501');
reset role;
