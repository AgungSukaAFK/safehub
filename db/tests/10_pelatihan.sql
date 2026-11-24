-- =====================================================================================
-- Uji fase 4B: Pelatihan (docs/spec/fase-4-people-kontraktor-dokumen.md). Setelah 01–09 di DB yang sama.
-- =====================================================================================
\set ON_ERROR_STOP on
set client_min_messages = notice;

select id as site from public.locations where name = 'Site MIFA' \gset
select id as e_rudi from __APP__.employees where code = 'GMI-0017' \gset
select id as e_agus from __APP__.employees where code = 'GMI-0024' \gset
select id as e_bayu from __APP__.employees where code = 'GMI-0030' \gset
select id as comp_bmc from __APP__.competencies where code = 'bmc' \gset
select id as trn_plan from __APP__.trainings where title = 'BMC Refresh Batch 2' \gset
select id as trn_done from __APP__.trainings where title = 'K3 Umum Kemnaker' \gset

select zz_test.check('Y1a tabel pelatihan tanpa hak tulis untuk authenticated; RPC bisa dipanggil; log fungsi internal tertutup',
  not exists (select 1 from information_schema.role_table_grants where grantee = 'authenticated' and table_schema = '__APP__'
               and table_name in ('trainings', 'training_participants', 'trainings_logs') and privilege_type in ('INSERT', 'UPDATE', 'DELETE'))
  and has_function_privilege('authenticated', '__APP__.training_save(uuid, jsonb)', 'execute')
  and not has_function_privilege('anon', '__APP__.training_set_status(uuid, text, text)', 'execute')
  and not has_function_privilege('authenticated', '__APP__.training_log(uuid, text, text)', 'execute'));
select zz_test.check('Y1b seed: 3 pelatihan bernomor TRN-tahun-urut, 1 selesai',
  (select count(*) from __APP__.trainings) = 3 and (select count(*) from __APP__.trainings where code ~ '^TRN-[0-9]{4}-[0-9]{4}$') = 3
  and (select count(*) from __APP__.trainings where status = 'done') = 1);

-- ---------------------------------------------------------------- baca
select zz_test.login('karyawan@demo.lourdes.test');
set role authenticated;
select zz_test.check('Y2a karyawan tidak melihat pelatihan', (select count(*) from __APP__.trainings) = 0 and (select count(*) from __APP__.training_participants) = 0);
reset role;
select zz_test.login('pengawas@demo.lourdes.test');
set role authenticated;
select zz_test.check('Y2b staf K3 melihat pelatihan dan pesertanya', (select count(*) from __APP__.trainings) = 3 and (select count(*) from __APP__.training_participants) >= 8);
select zz_test.expect_error('Y2c pengawas tidak bisa membuat pelatihan',
  format($q$select __APP__.training_save(null, jsonb_build_object('location_id', %L, 'title', 'Uji', 'starts_on', current_date::text, 'ends_on', current_date::text))$q$, :'site'), '42501');
reset role;

-- ---------------------------------------------------------------- tulis (HR)
select zz_test.login('hr@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('Y3a tanggal selesai sebelum mulai ditolak',
  format($q$select __APP__.training_save(null, jsonb_build_object('location_id', %L, 'title', 'Uji Pelatihan', 'starts_on', (current_date + 5)::text, 'ends_on', (current_date + 4)::text))$q$, :'site'), 'P0001', '%Tanggal pelatihan tidak valid%');
select (__APP__.training_save(null, jsonb_build_object('location_id', :'site', 'title', 'Uji Pelatihan', 'competency_id', :'comp_bmc',
  'starts_on', (current_date + 5)::text, 'ends_on', (current_date + 5)::text, 'capacity', 2)) ->> 'id') as trn_new \gset
select zz_test.check('Y3b pelatihan baru tersimpan, bernomor, ada log create',
  exists (select 1 from __APP__.trainings where id = :'trn_new' and status = 'planned' and code ~ '^TRN-[0-9]{4}-[0-9]{4}$')
  and exists (select 1 from __APP__.trainings_logs where record_id = :'trn_new' and action = 'create'));
select zz_test.expect_error('Y3c peserta melebihi kapasitas ditolak',
  format($q$select __APP__.training_participants_set(%L, array[%L, %L, %L]::uuid[])$q$, :'trn_new', :'e_rudi', :'e_agus', :'e_bayu'), 'P0001', '%melebihi kapasitas%');
select __APP__.training_participants_set(:'trn_new', array[:'e_rudi', :'e_agus']::uuid[]);
select zz_test.check('Y3d 2 peserta terdaftar + log peserta', (select count(*) from __APP__.training_participants where training_id = :'trn_new') = 2
  and exists (select 1 from __APP__.trainings_logs where record_id = :'trn_new' and action = 'participants'));
reset role;
select zz_test.check('Y3e peserta berakun (Rudi) diberi tahu lewat notifikasi',
  exists (select 1 from __APP__.notifications n join public.profiles p on p.id = n.user_id
           where p.email = 'karyawan@demo.lourdes.test' and n.type = 'training_invited' and n.record_id = :'trn_new'::text));
set role authenticated;
select zz_test.expect_error('Y3f kehadiran sebelum tanggal pelatihan ditolak',
  format($q$select __APP__.training_attendance_set(%L, %L, 'present')$q$, :'trn_new', :'e_rudi'), 'P0001', '%mulai tanggal pelatihan%');
select zz_test.expect_error('Y3g selesai sebelum tanggal mulai ditolak',
  format($q$select __APP__.training_set_status(%L, 'done')$q$, :'trn_new'), 'P0001', '%belum dimulai%');
select zz_test.expect_error('Y3h batal tanpa alasan memadai ditolak',
  format($q$select __APP__.training_set_status(%L, 'cancelled', 'singkat')$q$, :'trn_new'), 'P0001', '%minimal 10%');
select __APP__.training_set_status(:'trn_new', 'cancelled', 'Instruktur berhalangan, dijadwalkan ulang bulan depan');
select zz_test.check('Y3i dibatalkan: status + log cancel; tidak bisa diubah lagi',
  (select status from __APP__.trainings where id = :'trn_new') = 'cancelled'
  and exists (select 1 from __APP__.trainings_logs where record_id = :'trn_new' and action = 'cancel'));
select zz_test.expect_error('Y3j pelatihan dibatalkan tidak bisa diubah',
  format($q$select __APP__.training_save(%L, jsonb_build_object('location_id', %L, 'title', 'Ubah', 'starts_on', current_date::text, 'ends_on', current_date::text))$q$, :'trn_new', :'site'), 'P0001', '%tidak bisa diubah%');
reset role;

-- ---------------------------------------------------------------- selesai: kehadiran wajib lengkap
select zz_test.login('hr@demo.lourdes.test');
set role authenticated;
select (__APP__.training_save(null, jsonb_build_object('location_id', :'site', 'title', 'Uji Berjalan',
  'starts_on', current_date::text, 'ends_on', current_date::text)) ->> 'id') as trn_run \gset
select zz_test.expect_error('Y4a selesai tanpa peserta ditolak',
  format($q$select __APP__.training_set_status(%L, 'done')$q$, :'trn_run'), 'P0001', '%Belum ada peserta%');
select __APP__.training_participants_set(:'trn_run', array[:'e_rudi', :'e_agus']::uuid[]);
select zz_test.expect_error('Y4b selesai sebelum semua kehadiran dicatat ditolak',
  format($q$select __APP__.training_set_status(%L, 'done')$q$, :'trn_run'), 'P0001', '%kehadiran semua peserta%');
select __APP__.training_attendance_set(:'trn_run', :'e_rudi', 'present');
select __APP__.training_attendance_set(:'trn_run', :'e_agus', 'absent', 'Sakit');
select __APP__.training_set_status(:'trn_run', 'done');
select zz_test.check('Y4c selesai: status done, kehadiran tercatat, log complete',
  (select status from __APP__.trainings where id = :'trn_run') = 'done'
  and (select attendance from __APP__.training_participants where training_id = :'trn_run' and employee_id = :'e_agus') = 'absent'
  and exists (select 1 from __APP__.trainings_logs where record_id = :'trn_run' and action = 'complete'));
select zz_test.expect_error('Y4d peserta pelatihan selesai tidak bisa diubah',
  format($q$select __APP__.training_participants_set(%L, array[%L]::uuid[])$q$, :'trn_run', :'e_rudi'), 'P0001', '%Direncanakan%');
select zz_test.check('Y4e riwayat pelatihan karyawan (invoker)', (select count(*) from __APP__.employee_trainings(:'e_rudi')) >= 2);
reset role;
