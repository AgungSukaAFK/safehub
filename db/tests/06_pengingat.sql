-- =====================================================================================
-- Uji fase 3: Pengaturan Pengingat (docs/spec/fase-3-tsp-laporan.md bagian 2). Setelah 01–05 di DB yang sama.
-- =====================================================================================
\set ON_ERROR_STOP on
set client_min_messages = notice;

select id as r_pica from __APP__.reminder_rules where kind = 'pica_due' \gset
select id as r_ins from __APP__.reminder_rules where kind = 'inspection_due' \gset

select zz_test.check('N1a seed 9 aturan bawaan aktif; tabel tanpa hak tulis; run_reminders tertutup',
  (select count(*) from __APP__.reminder_rules where is_active) = 9
  and not exists (select 1 from information_schema.role_table_grants where grantee = 'authenticated' and table_schema = '__APP__'
                   and table_name in ('reminder_rules', 'reminder_sent') and privilege_type in ('INSERT', 'UPDATE', 'DELETE'))
  and not has_function_privilege('authenticated', '__APP__.run_reminders(date)', 'execute'));

-- ---------------------------------------------------------------- ubah aturan
select zz_test.login('hse@demo.lourdes.test');
set role authenticated;
select zz_test.check('N2a staf K3 membaca aturan', (select count(*) from __APP__.reminder_rules) = 9);
select zz_test.expect_error('N2b HSE (bukan admin) tidak bisa mengubah',
  format($q$select __APP__.reminder_rule_save(%L, '{"offsets":[1],"notify_assignee":true}'::jsonb)$q$, :'r_pica'), '42501');
reset role;
select zz_test.login('karyawan@demo.lourdes.test');
set role authenticated;
select zz_test.check('N2c karyawan tidak membaca aturan', (select count(*) from __APP__.reminder_rules) = 0);
reset role;
select zz_test.login('admin@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('N2d offset di luar rentang ditolak',
  format($q$select __APP__.reminder_rule_save(%L, '{"offsets":[99],"notify_assignee":true}'::jsonb)$q$, :'r_pica'), 'P0001', '%0 dan 60%');
select zz_test.expect_error('N2e tanpa penerima ditolak',
  format($q$select __APP__.reminder_rule_save(%L, '{"offsets":[1],"notify_assignee":false,"notify_functions":[]}'::jsonb)$q$, :'r_pica'), 'P0001', '%penerima%');
select __APP__.reminder_rule_save(:'r_pica', '{"offsets":[3,1,0,3],"notify_assignee":true,"notify_functions":["hse"],"is_active":true}'::jsonb);
select zz_test.check('N2f offset diurutkan unik; log config tercatat',
  (select offsets = array[0,1,3] and notify_functions = array['hse'] from __APP__.reminder_rules where id = :'r_pica')
  and exists (select 1 from __APP__.reminder_rules_logs where record_id = :'r_pica'));
reset role;

-- ---------------------------------------------------------------- eksekusi (superuser; trigger guard dilewati untuk menyetel tanggal)
select id as act, pic_id as act_pic from __APP__.pica_actions where status in ('open', 'in_progress') order by code limit 1 \gset
select id as ins, inspector_id as ins_user from __APP__.inspections where status = 'scheduled' order by code limit 1 \gset
select (now() at time zone 'Asia/Jakarta')::date as today \gset
set session_replication_role = replica;
update __APP__.pica_actions set due_date = :'today'::date + 3 where id = :'act';
update __APP__.inspections set planned_at = ((:'today'::date + 1)::text || ' 09:00+07')::timestamptz where id = :'ins';
reset session_replication_role;
delete from __APP__.notifications where type like 'reminder.%';

select __APP__.run_reminders(:'today'::date) as res \gset
select zz_test.check('N3a pengingat PICA (H-3) terkirim ke PIC dan HSE; inspeksi (H-1) ke pemeriksa',
  exists (select 1 from __APP__.notifications where type = 'reminder.pica_due' and record_id = :'act' and user_id = :'act_pic')
  and exists (select 1 from __APP__.notifications n join __APP__.members m on m.user_id = n.user_id
               where n.type = 'reminder.pica_due' and n.record_id = :'act' and 'hse' = any (m.functions))
  and exists (select 1 from __APP__.notifications where type = 'reminder.inspection_due' and record_id = :'ins' and user_id = :'ins_user'),
  :'res');
select count(*) as n1 from __APP__.notifications where type like 'reminder.%' \gset
select __APP__.run_reminders(:'today'::date);
select zz_test.check('N3b dijalankan ulang = idempoten (tanpa notifikasi ganda)',
  (select count(*) from __APP__.notifications where type like 'reminder.%') = :n1);

update __APP__.reminder_rules set is_active = false where id = :'r_pica';
set session_replication_role = replica;
update __APP__.pica_actions set due_date = :'today'::date + 1 where id = :'act';
reset session_replication_role;
delete from __APP__.notifications where type = 'reminder.pica_due';
select __APP__.run_reminders(:'today'::date);
select zz_test.check('N3c aturan nonaktif tidak mengirim',
  not exists (select 1 from __APP__.notifications where type = 'reminder.pica_due'));
update __APP__.reminder_rules set is_active = true where id = :'r_pica';

-- evaluasi TSP: tanggal 3 bulan ini (offset bawaan 3) dan evaluasi bulan lalu belum diajukan → HSE diingatkan sekali
select (date_trunc('month', :'today'::date)::date + 2) as day3, extract(month from :'today'::date)::integer as cur_month \gset
delete from __APP__.notifications where type = 'reminder.tsp_evaluation';
select __APP__.run_reminders(:'day3'::date);
select count(*) as n_tsp from __APP__.notifications where type = 'reminder.tsp_evaluation' \gset
select __APP__.run_reminders(:'day3'::date);
select zz_test.check('N3e pengingat evaluasi TSP terkirim ke HSE sekali (Januari: tanpa program tahun lalu)',
  (:cur_month = 1 or :n_tsp > 0) and (select count(*) from __APP__.notifications where type = 'reminder.tsp_evaluation') = :n_tsp);
select zz_test.check('N3d run_maintenance menjalankan pengingat dan mencatat hasilnya',
  (select (__APP__.run_maintenance() ? 'pengingat_k3')));
reset role;
