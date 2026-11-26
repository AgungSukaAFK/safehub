-- =====================================================================================
-- Uji fase 4E: Impor Data + pengingat kedaluwarsa (docs/spec/fase-4-people-kontraktor-dokumen.md). Setelah 01–12.
-- =====================================================================================
\set ON_ERROR_STOP on
set client_min_messages = notice;

select id as site from public.locations where name = 'Site MIFA' \gset
select (now() at time zone 'Asia/Jakarta')::date as today \gset

select zz_test.check('E1a import_jobs tanpa hak tulis; import_commit bisa dipanggil authenticated; import_row & run_expiry_reminders tertutup',
  not exists (select 1 from information_schema.role_table_grants where grantee = 'authenticated' and table_schema = '__APP__'
               and table_name = 'import_jobs' and privilege_type in ('INSERT', 'UPDATE', 'DELETE'))
  and has_function_privilege('authenticated', '__APP__.import_commit(text, text, text, uuid, text, jsonb)', 'execute')
  and not has_function_privilege('authenticated', '__APP__.import_row(text, text, jsonb, uuid, text)', 'execute')
  and not has_function_privilege('authenticated', '__APP__.run_expiry_reminders(date)', 'execute')
  and not has_function_privilege('authenticated', '__APP__.run_reminders(date)', 'execute'));

-- ---------------------------------------------------------------- hak
select zz_test.login('pengawas@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('E2a pengawas tidak bisa mengimpor',
  format($q$select __APP__.import_commit('employees', 'insert', 'x.xlsx', %L, null, '[{"n":2,"d":{"nik":"GMI-0200","nama":"X","jabatan":"Mekanik"}}]'::jsonb)$q$, :'site'), '42501');
reset role;

-- ---------------------------------------------------------------- impor karyawan
select zz_test.login('hr@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('E3a target tidak dikenal ditolak',
  format($q$select __APP__.import_commit('kejadian', 'insert', 'x.xlsx', %L, null, '[{"n":2,"d":{}}]'::jsonb)$q$, :'site'), 'P0001', '%Target impor%');
select zz_test.expect_error('E3b lebih dari 1000 baris / kosong ditolak',
  format($q$select __APP__.import_commit('employees', 'insert', 'x.xlsx', %L, null, '[]'::jsonb)$q$, :'site'), 'P0001', '%1 sampai 1000%');
select __APP__.import_commit('employees', 'insert', 'manpower.xlsx', :'site', null, jsonb_build_array(
  jsonb_build_object('n', 2, 'd', jsonb_build_object('nik', 'GMI-0100', 'nama', 'Impor Satu', 'jabatan', 'Mekanik', 'hubungan_kerja', 'PKWT', 'tanggal_mulai', '2026-01-05')),
  jsonb_build_object('n', 3, 'd', jsonb_build_object('nik', 'GMI-0101', 'nama', 'Impor Dua', 'jabatan', 'Planner')),
  jsonb_build_object('n', 4, 'd', jsonb_build_object('nik', 'GMI-0017', 'nama', 'Duplikat', 'jabatan', 'Mekanik')),
  jsonb_build_object('n', 5, 'd', jsonb_build_object('nik', 'GMI-0102', 'nama', 'Mitra Salah', 'jabatan', 'Mekanik', 'mitra', 'PT Tidak Ada')),
  jsonb_build_object('n', 6, 'd', jsonb_build_object('nik', 'GMI-0103', 'nama', 'Tanpa Jabatan', 'jabatan', '')))) as res \gset
select zz_test.check('E3c impor karyawan: 5 baris, 2 berhasil, 3 gagal; baris gagal tidak membatalkan yang lain',
  (:'res'::jsonb ->> 'total')::int = 5 and (:'res'::jsonb ->> 'ok')::int = 2 and (:'res'::jsonb ->> 'failed')::int = 3
  and exists (select 1 from __APP__.employees where code = 'GMI-0100' and name = 'Impor Satu' and employment = 'PKWT')
  and exists (select 1 from __APP__.employees where code = 'GMI-0101')
  and not exists (select 1 from __APP__.employees where code in ('GMI-0102', 'GMI-0103')));
select zz_test.check('E3d galat per baris memuat nomor baris dan pesan Indonesia',
  (:'res'::jsonb -> 'errors' -> 0 ->> 'row') = '4' and (:'res'::jsonb -> 'errors' -> 0 ->> 'message') like '%sudah ada%'
  and (:'res'::jsonb -> 'errors' -> 1 ->> 'message') like '%Mitra%tidak ditemukan%');
select zz_test.check('E3e import_jobs mencatat hasil (milik sendiri)', exists (select 1 from __APP__.import_jobs where target = 'employees' and total = 5 and ok_count = 2 and failed_count = 3 and filename = 'manpower.xlsx'));

-- upsert: perbarui, bukan duplikat; tautan akun & mitra yang sudah ada tidak hilang
select __APP__.import_commit('employees', 'upsert', 'manpower2.xlsx', :'site', null, jsonb_build_array(
  jsonb_build_object('n', 2, 'd', jsonb_build_object('nik', 'GMI-0100', 'nama', 'Impor Satu Revisi', 'jabatan', 'Mekanik')),
  jsonb_build_object('n', 3, 'd', jsonb_build_object('nik', 'GMI-0017', 'nama', 'Rudi Hartono', 'jabatan', 'Teknisi AC')))) as res2 \gset
select zz_test.check('E4a upsert memperbarui karyawan yang ada tanpa menghapus akun tertaut dan data yang tidak diisi',
  (:'res2'::jsonb ->> 'ok')::int = 2
  and exists (select 1 from __APP__.employees where code = 'GMI-0100' and name = 'Impor Satu Revisi' and employment = 'PKWT' and join_date = date '2026-01-05')
  and exists (select 1 from __APP__.employees where code = 'GMI-0017' and profile_id is not null and department = 'Service AC')
  and (select count(*) from __APP__.employees where code = 'GMI-0100') = 1);

-- ---------------------------------------------------------------- impor sertifikat
select __APP__.import_commit('certificates', 'insert', 'sertifikat.xlsx', null, null, jsonb_build_array(
  jsonb_build_object('n', 2, 'd', jsonb_build_object('nik', 'GMI-0100', 'kompetensi', 'k3_umum', 'nomor', 'IMP-1', 'tanggal_terbit', '2026-01-01', 'berlaku_sampai', (:'today'::date + 365)::text)),
  jsonb_build_object('n', 3, 'd', jsonb_build_object('nik', 'GMI-0100', 'kompetensi', 'P3K', 'nomor', 'IMP-2', 'berlaku_sampai', (:'today'::date + 200)::text)),
  jsonb_build_object('n', 4, 'd', jsonb_build_object('nik', 'GMI-0100', 'kompetensi', 'Tidak Ada', 'nomor', 'IMP-3')),
  jsonb_build_object('n', 5, 'd', jsonb_build_object('nik', 'GMI-9999', 'kompetensi', 'bmc')))) as res3 \gset
select zz_test.check('E5a sertifikat: kompetensi dicari lewat kode ATAU nama; NIK/kompetensi tak dikenal gagal',
  (:'res3'::jsonb ->> 'ok')::int = 2 and (:'res3'::jsonb ->> 'failed')::int = 2
  and (select count(*) from __APP__.certificates c join __APP__.employees e on e.id = c.employee_id where e.code = 'GMI-0100') = 2
  and (:'res3'::jsonb -> 'errors' -> 0 ->> 'message') like '%Kompetensi%tidak ditemukan%'
  and (:'res3'::jsonb -> 'errors' -> 1 ->> 'message') like '%NIK GMI-9999 tidak ditemukan%');
select __APP__.import_commit('certificates', 'insert', 'sertifikat.xlsx', null, null, jsonb_build_array(
  jsonb_build_object('n', 2, 'd', jsonb_build_object('nik', 'GMI-0100', 'kompetensi', 'k3_umum', 'nomor', 'IMP-1', 'berlaku_sampai', (:'today'::date + 365)::text)))) as res4 \gset
select zz_test.check('E5b mode Tambah baru menolak sertifikat yang sama; mode Perbarui menerima',
  (:'res4'::jsonb ->> 'failed')::int = 1
  and ((select __APP__.import_commit('certificates', 'upsert', 'sertifikat.xlsx', null, null, jsonb_build_array(
        jsonb_build_object('n', 2, 'd', jsonb_build_object('nik', 'GMI-0100', 'kompetensi', 'k3_umum', 'nomor', 'IMP-1', 'berlaku_sampai', (:'today'::date + 400)::text))))) ->> 'ok')::int = 1);

-- ---------------------------------------------------------------- impor MCU (diagnosis tidak ikut; yang ada dipertahankan)
select zz_test.check('E6a MCU: baris baru berhasil; MCU yang ada diperbarui tanpa menghapus diagnosis',
  ((select __APP__.import_commit('mcu', 'upsert', 'mcu.xlsx', null, null, jsonb_build_array(
      jsonb_build_object('n', 2, 'd', jsonb_build_object('nik', 'GMI-0100', 'tanggal', :'today', 'berlaku_sampai', (:'today'::date + 365)::text, 'hasil', 'fit')),
      jsonb_build_object('n', 3, 'd', jsonb_build_object('nik', 'GMI-0011', 'tanggal', (select checked_on::text from __APP__.mcu_records m join __APP__.employees e on e.id = m.employee_id where e.code = 'GMI-0011'),
        'berlaku_sampai', (:'today'::date + 90)::text, 'hasil', 'fit_note'))))) ->> 'ok')::int = 2);
select zz_test.check('E6b diagnosis lama tetap ada setelah impor; MCU baru tanpa diagnosis',
  exists (select 1 from __APP__.mcu_restricted r join __APP__.mcu_records m on m.id = r.mcu_id join __APP__.employees e on e.id = m.employee_id
           where e.code = 'GMI-0011' and r.diagnosis like 'Hipertensi%' and m.valid_until = :'today'::date + 90)
  and exists (select 1 from __APP__.mcu_records m join __APP__.employees e on e.id = m.employee_id where e.code = 'GMI-0100' and m.result = 'fit'));
select zz_test.check('E7a permit: impor baru berhasil',
  ((select __APP__.import_commit('site_permits', 'insert', 'permit.xlsx', null, null, jsonb_build_array(
      jsonb_build_object('n', 2, 'd', jsonb_build_object('nik', 'GMI-0100', 'permit', 'Izin Masuk Site', 'nomor', 'P-1', 'berlaku_sampai', (:'today'::date + 30)::text))))) ->> 'ok')::int = 1);
select zz_test.check('E7b HR hanya melihat riwayat impor miliknya (7 impor)', (select count(*) from __APP__.import_jobs) = 7);
reset role;
select zz_test.login('karyawan@demo.lourdes.test');
set role authenticated;
select zz_test.check('E7c karyawan tidak melihat riwayat impor', (select count(*) from __APP__.import_jobs) = 0);
reset role;

-- ---------------------------------------------------------------- pengingat kedaluwarsa
-- pelaku = sistem (bukan sesi karyawan terakhir), supaya notify() tidak mengecualikan penerima yang kebetulan sama dengan sesi
select set_config('request.jwt.claims', '', false), set_config('request.jwt.claim.sub', '', false);
select zz_test.check('P1a 10 aturan aktif (3 lama + 6 kedaluwarsa + apd_due)', (select count(*) from __APP__.reminder_rules where is_active) = 10);
set session_replication_role = replica;
update __APP__.mcu_records set valid_until = :'today'::date + 14 where employee_id = (select id from __APP__.employees where code = 'GMI-0017');
update __APP__.certificates set valid_until = :'today'::date + 7 where employee_id = (select id from __APP__.employees where code = 'GMI-0017') and competency_id = (select id from __APP__.competencies where code = 'bmc');
update __APP__.site_permits set valid_until = :'today'::date + 1 where employee_id = (select id from __APP__.employees where code = 'GMI-0017');
update __APP__.contractor_permits set valid_until = :'today'::date + 30 where name = 'SBU Jasa Konstruksi';
update __APP__.document_revisions set review_due_on = :'today'::date + 14 where status = 'approved' and document_id = (select id from __APP__.controlled_documents where code = 'SOP-HSE-001');
update __APP__.ko_register set valid_until = :'today'::date + 30 where title like 'Sertifikasi Layak Operasi Crane%';
reset session_replication_role;
delete from __APP__.notifications where type like 'reminder.%';
delete from __APP__.reminder_sent;

select __APP__.run_reminders(:'today'::date) as rr \gset
select zz_test.check('P2a hasil pengingat: masing-masing satu per jenis kedaluwarsa',
  (:'rr'::jsonb ->> 'mcu_expiry')::int = 1 and (:'rr'::jsonb ->> 'certificate_expiry')::int = 1 and (:'rr'::jsonb ->> 'permit_expiry')::int = 1
  and (:'rr'::jsonb ->> 'contractor_permit_expiry')::int = 1 and (:'rr'::jsonb ->> 'document_review')::int = 1 and (:'rr'::jsonb ->> 'ko_expiry')::int = 1);
select zz_test.check('P2b MCU: karyawan (Rudi) dan HR menerima; sertifikat: karyawan dan HR; kontraktor: pengelola kontraktor',
  exists (select 1 from __APP__.notifications n join public.profiles p on p.id = n.user_id where p.email = 'karyawan@demo.lourdes.test' and n.type = 'reminder.mcu_expiry')
  and exists (select 1 from __APP__.notifications n join public.profiles p on p.id = n.user_id where p.email = 'hr@demo.lourdes.test' and n.type = 'reminder.mcu_expiry')
  and exists (select 1 from __APP__.notifications n join public.profiles p on p.id = n.user_id where p.email = 'karyawan@demo.lourdes.test' and n.type = 'reminder.certificate_expiry')
  and exists (select 1 from __APP__.notifications n join public.profiles p on p.id = n.user_id where p.email = 'kontraktor@demo.lourdes.test' and n.type = 'reminder.contractor_permit_expiry'));
select zz_test.check('P2c review dokumen: pemilik (HSE) menerima; KO: pemilik menerima',
  exists (select 1 from __APP__.notifications n join public.profiles p on p.id = n.user_id where p.email = 'hse@demo.lourdes.test' and n.type = 'reminder.document_review')
  and exists (select 1 from __APP__.notifications n join public.profiles p on p.id = n.user_id where p.email = 'hse@demo.lourdes.test' and n.type = 'reminder.ko_expiry'));
select count(*) as n_before from __APP__.notifications where type like 'reminder.%' \gset
select __APP__.run_reminders(:'today'::date);
select zz_test.check('P3a idempoten: menjalankan ulang tidak mengirim ganda', (select count(*) from __APP__.notifications where type like 'reminder.%') = :n_before);
-- MCU lama yang sudah digantikan MCU baru tidak diingatkan
set session_replication_role = replica;
insert into __APP__.mcu_records (employee_id, checked_on, valid_until, result)
select id, :'today'::date, :'today'::date + 365, 'fit' from __APP__.employees where code = 'GMI-0017';
reset session_replication_role;
delete from __APP__.reminder_sent; delete from __APP__.notifications where type = 'reminder.mcu_expiry';
select (__APP__.run_reminders(:'today'::date) ->> 'mcu_expiry')::int as mcu_after \gset
select zz_test.check('P3b MCU yang sudah punya penerus lebih baru tidak diingatkan', :mcu_after = 0);
