-- =====================================================================================
-- Uji fase 1: Kejadian & Investigasi + Temuan & PICA (docs/spec/fase-1-kejadian-pica.md).
-- Alur inti rancangan §1.3 langkah 1–6 per persona + kasus "tidak boleh". Helper zz_test dari 01.
-- =====================================================================================
\set ON_ERROR_STOP on
set client_min_messages = notice;

select id as site from public.locations where name = 'Site MIFA' \gset
select id as site2 from public.locations where name = 'Site Demo Kalimantan' \gset
select id as area from __APP__.areas where location_id = :'site' and name = 'Workshop Service' \gset
select id as area2 from __APP__.areas where location_id = :'site2' and name = 'Workshop' \gset
select id as u_karyawan from public.profiles where email = 'karyawan@demo.lourdes.test' \gset
select id as u_hse from public.profiles where email = 'hse@demo.lourdes.test' \gset
select id as u_senior from public.profiles where email = 'hse.senior@demo.lourdes.test' \gset
select id as u_pengawas from public.profiles where email = 'pengawas@demo.lourdes.test' \gset
select id as u_pjo from public.profiles where email = 'pjo@demo.lourdes.test' \gset

-- ================================================================ K1. struktur & grant
select zz_test.check('K1a tabel K3 tanpa hak tulis untuk authenticated',
  not exists (select 1 from information_schema.role_table_grants
               where grantee = 'authenticated' and table_schema = '__APP__'
                 and table_name in ('incidents', 'incident_persons', 'incident_restricted', 'incident_costs',
                                    'incident_team', 'incident_investigations', 'incident_reviews', 'incidents_logs',
                                    'findings', 'findings_logs', 'pica_actions', 'pica_evidence', 'pica_actions_logs')
                 and privilege_type in ('INSERT', 'UPDATE', 'DELETE')));
select zz_test.check('K1b RPC bisa dipanggil authenticated, tidak anon',
  has_function_privilege('authenticated', '__APP__.incident_report(jsonb)', 'execute')
  and has_function_privilege('authenticated', '__APP__.pica_verify(uuid, text, text)', 'execute')
  and has_function_privilege('authenticated', '__APP__.finding_save(uuid, jsonb)', 'execute')
  and not has_function_privilege('anon', '__APP__.incident_report(jsonb)', 'execute')
  and not has_function_privilege('anon', '__APP__.k3_badges()', 'execute'));
select zz_test.check('K1c helper internal tidak bisa dipanggil authenticated',
  not has_function_privilege('authenticated', '__APP__.users_with_function(text[], text, uuid)', 'execute')
  and not has_function_privilege('authenticated', '__APP__.k3_incident_try_close(uuid)', 'execute')
  and not has_function_privilege('authenticated', '__APP__.k3_finding_refresh(uuid)', 'execute')
  and not has_function_privilege('authenticated', '__APP__.k3_incident_set_persons(uuid, text, jsonb)', 'execute'));

-- ================================================================ K2. lapor (alur 1)
select zz_test.login('karyawan@demo.lourdes.test');
set role authenticated;
select __APP__.incident_report(jsonb_build_object(
  'location_id', :'site', 'area_id', :'area', 'location_detail', 'Bay 2',
  'occurred_at', (now() - interval '2 hours')::text, 'category', 'injury',
  'unit_code', 'H57197', 'unit_label', 'HD785-7',
  'description', 'Jari terjepit saat pemasangan kompresor AC unit H57197',
  'supervisor_id', :'u_pengawas',
  'persons', jsonb_build_array(
    jsonb_build_object('role', 'involved', 'name', 'Rudi Hartono', 'company_kind', 'internal', 'employment', 'permanent', 'position', 'Teknisi AC'),
    jsonb_build_object('role', 'witness', 'name', 'Dedi Saputra', 'company_kind', 'internal', 'contact', '0812'),
    jsonb_build_object('role', 'witness', 'name', '   ')))) as r \gset
select (:'r'::jsonb ->> 'id') as inc, (:'r'::jsonb ->> 'code') as inc_code \gset
select zz_test.check('K2a nomor KJD-YYYY-NNNN',
  :'inc_code' ~ ('^KJD-' || to_char(now() at time zone 'Asia/Jakarta', 'YYYY') || '-\d{4}$'), :'inc_code');
select zz_test.check('K2b notifikasi ke HSE & PJO (bukan pelapor)',
  jsonb_array_length(:'r'::jsonb -> 'notification_ids') >= 3);
select zz_test.check('K2c status awal reported + pihak terkait tersimpan (baris kosong dibuang)',
  (select status from __APP__.incidents where id = :'inc') = 'reported'
  and (select count(*) from __APP__.incident_persons where incident_id = :'inc') = 2);
select zz_test.expect_error('K2d area site lain ditolak',
  format($q$select __APP__.incident_report(jsonb_build_object('location_id', %L, 'area_id', %L,
    'occurred_at', now()::text, 'category', 'near_miss', 'description', 'x'))$q$, :'site', :'area2'), 'P0001', '%area site%');
select zz_test.expect_error('K2e waktu kejadian di masa depan ditolak',
  format($q$select __APP__.incident_report(jsonb_build_object('location_id', %L, 'area_id', %L,
    'occurred_at', (now() + interval '1 day')::text, 'category', 'near_miss', 'description', 'x'))$q$, :'site', :'area'),
  'P0001', '%melebihi%');
select zz_test.expect_error('K2f karyawan dibatasi Site MIFA tidak bisa lapor di site lain',
  format($q$select __APP__.incident_report(jsonb_build_object('location_id', %L, 'area_id', %L,
    'occurred_at', now()::text, 'category', 'near_miss', 'description', 'x'))$q$, :'site2', :'area2'), 'P0001', '%di luar akses%');
select zz_test.expect_error('K2g insert langsung ke tabel ditolak',
  format($q$insert into __APP__.incidents (code, company_code, location_id, area_id, occurred_at, reported_category, description)
    values ('X', 'GMI', %L, %L, now(), 'near_miss', 'x')$q$, :'site', :'area'), '42501');
-- karyawan tidak bisa membaca data cedera / klasifikasi
select zz_test.expect_error('K2h karyawan tidak bisa klasifikasi',
  format($q$select __APP__.incident_classify(%L, '{}'::jsonb)$q$, :'inc'), '42501');
reset role;

select zz_test.login('auditor@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('K2i auditor tidak bisa melapor',
  format($q$select __APP__.incident_report(jsonb_build_object('location_id', %L, 'area_id', %L,
    'occurred_at', now()::text, 'category', 'near_miss', 'description', 'x'))$q$, :'site', :'area'), '42501');
select zz_test.check('K2j auditor membaca semua kejadian', exists (select 1 from __APP__.incidents where id = :'inc'));
reset role;

-- ================================================================ K3. visibilitas
select zz_test.login('viewer@demo.lourdes.test');      -- tanpa fungsi K3 → hanya miliknya
set role authenticated;
select zz_test.check('K3a user tanpa fungsi K3 tidak melihat laporan orang lain',
  not exists (select 1 from __APP__.incidents where id = :'inc'));
reset role;
select zz_test.login('sari@demo.lourdes.test');         -- company GIS
set role authenticated;
select zz_test.check('K3b company lain tidak melihat', not exists (select 1 from __APP__.incidents where id = :'inc'));
reset role;
select zz_test.login('pengawas@demo.lourdes.test');     -- atasan + fungsi pengawas
set role authenticated;
select zz_test.check('K3c pengawas melihat kejadian', exists (select 1 from __APP__.incidents where id = :'inc'));
reset role;

-- ================================================================ K4. klasifikasi (alur 2)
select zz_test.login('hse@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('K4a keparahan wajib',
  format($q$select __APP__.incident_classify(%L, '{"category":"injury","injury_class":"first_aid"}'::jsonb)$q$, :'inc'),
  'P0001', '%keparahan%');
select __APP__.incident_classify(:'inc', jsonb_build_object(
  'category', 'injury', 'injury_class', 'first_aid', 'severity', 'low', 'potential_severity', 'high',
  'ppe', jsonb_build_object('helmet', true, 'gloves', false),
  'damage_description', 'Pekerjaan tertunda 2,5 jam', 'estimated_cost', 2750000,
  'restricted', jsonb_build_object('injury_type', 'Memar', 'body_parts', jsonb_build_array('Jari telunjuk kanan'),
                                   'treatment', 'first_aid', 'lost_days', 0, 'restricted_days', 2))) as r \gset
select zz_test.check('K4b status classified + pelapor dinotifikasi',
  (select status from __APP__.incidents where id = :'inc') = 'classified'
  and jsonb_array_length(:'r'::jsonb -> 'notification_ids') = 1);
select zz_test.check('K4c HSE membaca data cedera & biaya',
  exists (select 1 from __APP__.incident_restricted where incident_id = :'inc' and restricted_days = 2)
  and exists (select 1 from __APP__.incident_costs where incident_id = :'inc' and estimated_cost = 2750000));
select zz_test.check('K4d log klasifikasi satu baris', (select count(*) from __APP__.incidents_logs
  where record_id = :'inc' and action = 'classify') = 1);
reset role;

select zz_test.login('pjo@demo.lourdes.test');
set role authenticated;
select zz_test.check('K4e PJO tidak membaca data cedera, tetapi membaca biaya',
  not exists (select 1 from __APP__.incident_restricted where incident_id = :'inc')
  and exists (select 1 from __APP__.incident_costs where incident_id = :'inc'));
reset role;
select zz_test.login('hr@demo.lourdes.test');
set role authenticated;
select zz_test.check('K4f HR membaca data cedera, tidak membaca biaya',
  exists (select 1 from __APP__.incident_restricted where incident_id = :'inc')
  and not exists (select 1 from __APP__.incident_costs where incident_id = :'inc'));
reset role;
select zz_test.login('karyawan@demo.lourdes.test');
set role authenticated;
select zz_test.check('K4g pelapor (karyawan) tidak membaca data cedera',
  not exists (select 1 from __APP__.incident_restricted where incident_id = :'inc'));
reset role;

-- ================================================================ K5. investigasi (alur 3)
select zz_test.login('hse@demo.lourdes.test');
set role authenticated;
select __APP__.incident_set_team(:'inc', :'u_pengawas', array[:'u_hse'::uuid]) as r \gset
select zz_test.check('K5a tim ditetapkan → investigating, ketua dinotifikasi',
  (select status from __APP__.incidents where id = :'inc') = 'investigating'
  and (select count(*) from __APP__.incident_team where incident_id = :'inc') = 2
  and jsonb_array_length(:'r'::jsonb -> 'notification_ids') = 1);
reset role;

select zz_test.login('karyawan@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('K5b pelapor (bukan tim) tidak bisa mengubah investigasi',
  format($q$select __APP__.incident_save_investigation(%L, '{}'::jsonb)$q$, :'inc'), '42501');
reset role;

select zz_test.login('pengawas@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('K5c kirim review tanpa kronologi ditolak',
  format($q$select __APP__.incident_submit_review(%L)$q$, :'inc'), 'P0001', '%kronologi%');
select __APP__.incident_save_investigation(:'inc', jsonb_build_object(
  'timeline', jsonb_build_array(jsonb_build_object('time', '10:31', 'event', 'Kompresor bergeser, jari terjepit'),
                                jsonb_build_object('time', '', 'event', '')),
  'reconstruction', 'Tangan menahan kompresor tanpa alat bantu',
  'causes', jsonb_build_object('unsafe_act', jsonb_build_array(jsonb_build_object('text', 'Tangan di titik jepit', 'note', 'Menahan kompresor')),
                               'job_factor', jsonb_build_array(jsonb_build_object('text', 'JSA belum memuat titik jepit'))),
  'recommendations', jsonb_build_array(jsonb_build_object('text', 'Sediakan lifting aid'))));
select zz_test.check('K5d investigasi tersimpan (baris kosong dibuang) + satu log',
  (select jsonb_array_length(timeline) from __APP__.incident_investigations where incident_id = :'inc') = 1
  and (select count(*) from __APP__.incidents_logs where record_id = :'inc' and action = 'save_investigation') = 1);
reset role;

-- tindakan kejadian dibuat sebelum review (alur 3 → 4)
select zz_test.login('hse@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('K5e verifikator = PIC ditolak',
  format($q$select __APP__.pica_create(jsonb_build_object('incident_id', %L, 'title', 'Lifting aid', 'kind', 'corrective',
    'pic_id', %L, 'verifier_id', %L, 'due_date', current_date + 7))$q$, :'inc', :'u_pengawas', :'u_pengawas'), 'P0001', '%Verifikator%');
select __APP__.pica_create(jsonb_build_object('incident_id', :'inc', 'title', 'Sediakan lifting aid portabel',
  'kind', 'corrective', 'pic_id', :'u_pengawas', 'verifier_id', :'u_hse', 'due_date', current_date + 7,
  'required_evidence', 'Foto lifting aid', 'cause_ref', 'Tangan di titik jepit')) as r \gset
select (:'r'::jsonb ->> 'id') as act, (:'r'::jsonb ->> 'code') as act_code \gset
select zz_test.check('K5f tindakan PCA dibuat + PIC dinotifikasi',
  :'act_code' like 'PCA-____-____' and jsonb_array_length(:'r'::jsonb -> 'notification_ids') = 1);
reset role;

select zz_test.login('pengawas@demo.lourdes.test');
set role authenticated;
select __APP__.incident_submit_review(:'inc', 'Investigasi lengkap') as r \gset
select zz_test.check('K5g dikirim ke review EHS + hse_senior dinotifikasi',
  (select status from __APP__.incidents where id = :'inc') = 'review_ehs'
  and jsonb_array_length(:'r'::jsonb -> 'notification_ids') >= 1);
select zz_test.expect_error('K5h investigasi terkunci saat review',
  format($q$select __APP__.incident_save_investigation(%L, '{}'::jsonb)$q$, :'inc'), 'P0001', '%tahap Investigasi%');
reset role;

-- ================================================================ K6. review (alur 6, termasuk kembali)
select zz_test.login('hse@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('K6a HSE biasa bukan peninjau EHS',
  format($q$select __APP__.incident_review(%L, 'approve')$q$, :'inc'), '42501');
reset role;
select zz_test.login('hse.senior@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('K6b kembalikan tanpa catatan ditolak',
  format($q$select __APP__.incident_review(%L, 'return', ' ')$q$, :'inc'), 'P0001', '%Catatan%');
select __APP__.incident_review(:'inc', 'return', 'Lengkapi rekonstruksi foto');
select zz_test.check('K6c dikembalikan → investigating + catatan',
  (select status = 'investigating' and return_note is not null from __APP__.incidents where id = :'inc'));
reset role;
select zz_test.login('pengawas@demo.lourdes.test');
set role authenticated;
select __APP__.incident_submit_review(:'inc');
select zz_test.check('K6d kirim ulang menghapus catatan kembali',
  (select status = 'review_ehs' and return_note is null from __APP__.incidents where id = :'inc'));
reset role;
select zz_test.login('hse.senior@demo.lourdes.test');
set role authenticated;
select __APP__.incident_review(:'inc', 'approve', 'OK');
select zz_test.check('K6e EHS setuju → review_mgmt',
  (select status from __APP__.incidents where id = :'inc') = 'review_mgmt');
reset role;
select zz_test.login('manajemen@demo.lourdes.test');
set role authenticated;
select __APP__.incident_review(:'inc', 'approve');
select zz_test.check('K6f manajemen setuju, tindakan belum selesai → actions',
  (select status from __APP__.incidents where id = :'inc') = 'actions');
select zz_test.check('K6g syarat penutupan: tindakan belum terverifikasi',
  (select bool_and((e ->> 'ok')::boolean) filter (where e ->> 'key' <> 'actions')
          and not bool_or((e ->> 'ok')::boolean) filter (where e ->> 'key' = 'actions')
     from jsonb_array_elements(__APP__.incident_close_check(:'inc')) e));
reset role;

-- pemisahan tugas: pelapor yang juga peninjau tidak boleh meninjau laporannya sendiri
select zz_test.login('hse.senior@demo.lourdes.test');
set role authenticated;
select (__APP__.incident_report(jsonb_build_object('location_id', :'site', 'area_id', :'area',
  'occurred_at', now()::text, 'category', 'near_miss', 'description', 'Laporan peninjau sendiri')) ->> 'id') as inc_sod \gset
select __APP__.incident_classify(:'inc_sod', '{"category":"near_miss","injury_class":"none","severity":"low","potential_severity":"medium"}'::jsonb);
select __APP__.incident_set_team(:'inc_sod', :'u_senior', null);
select __APP__.incident_save_investigation(:'inc_sod', '{"timeline":[{"time":"08:00","event":"x"}],"causes":{"unsafe_condition":[{"text":"Lantai licin"}]}}'::jsonb);
select __APP__.incident_submit_review(:'inc_sod');
select zz_test.expect_error('K6h pembuat laporan tidak boleh meninjau laporannya sendiri',
  format($q$select __APP__.incident_review(%L, 'approve')$q$, :'inc_sod'), '42501', '%sendiri%');
reset role;

-- ================================================================ K7. PICA: bukti & verifikasi (alur 4–5)
select zz_test.login('pengawas@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('K7a kirim bukti tanpa file ditolak',
  format($q$select __APP__.pica_submit_evidence(%L, 'x', '{}')$q$, :'act'), 'P0001', '%minimal satu%');
select zz_test.expect_error('K7b file di luar folder putaran ditolak',
  format($q$select __APP__.pica_submit_evidence(%L, 'x', array['kejadian/%s/a.jpg'])$q$, :'act', :'inc'), 'P0001', '%tidak ditemukan%');
reset role;
-- file bukti "diunggah" (storage stub): putaran 1
insert into storage.objects (bucket_id, name, owner_id) values ('__HOST__-lampiran', 'pica/' || :'act' || '/r1/foto.jpg', :'u_pengawas');
select zz_test.login('pengawas@demo.lourdes.test');
set role authenticated;
select __APP__.pica_start(:'act');
select __APP__.pica_submit_evidence(:'act', 'Lifting aid terpasang', array['pica/' || :'act' || '/r1/foto.jpg']) as r \gset
select zz_test.check('K7c bukti terkirim → waiting_verification + verifikator dinotifikasi',
  (select status from __APP__.pica_actions where id = :'act') = 'waiting_verification'
  and jsonb_array_length(:'r'::jsonb -> 'notification_ids') = 1);
select zz_test.expect_error('K7d PIC tidak bisa memverifikasi sendiri',
  format($q$select __APP__.pica_verify(%L, 'accept', 'ok')$q$, :'act'), '42501');
reset role;
select zz_test.login('hse@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('K7e komentar verifikator wajib',
  format($q$select __APP__.pica_verify(%L, 'accept', '')$q$, :'act'), 'P0001', '%Komentar%');
select __APP__.pica_verify(:'act', 'return', 'Foto kurang jelas');
select zz_test.check('K7f dikembalikan → in_progress, putaran 2, returned',
  (select status = 'in_progress' and round = 2 and returned from __APP__.pica_actions where id = :'act'));
reset role;
insert into storage.objects (bucket_id, name, owner_id) values ('__HOST__-lampiran', 'pica/' || :'act' || '/r2/foto2.jpg', :'u_pengawas');
select zz_test.login('pengawas@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('K7g file putaran lama tidak berlaku',
  format($q$select __APP__.pica_submit_evidence(%L, 'x', array['pica/%s/r1/foto.jpg'])$q$, :'act', :'act'), 'P0001');
select __APP__.pica_submit_evidence(:'act', 'Foto ulang', array['pica/' || :'act' || '/r2/foto2.jpg']);
reset role;
select zz_test.login('hse@demo.lourdes.test');
set role authenticated;
select __APP__.pica_verify(:'act', 'accept', 'Sesuai') as r \gset
select zz_test.check('K7h diterima → Closed; kejadian (tahap actions) tertutup otomatis',
  (select status from __APP__.pica_actions where id = :'act') = 'closed'
  and (select status from __APP__.incidents where id = :'inc') = 'closed'
  and (select count(*) from __APP__.pica_evidence where action_id = :'act') = 2);
select zz_test.expect_error('K7i tindakan tidak bisa ditambah ke kejadian Closed',
  format($q$select __APP__.pica_create(jsonb_build_object('incident_id', %L, 'title', 'abc', 'kind', 'corrective',
    'pic_id', %L, 'verifier_id', %L, 'due_date', current_date + 7))$q$, :'inc', :'u_pengawas', :'u_hse'), 'P0001');
select zz_test.check('K7j log tindakan: satu baris per aksi',
  (select count(*) from __APP__.pica_actions_logs where record_id = :'act') = 6);  -- create, start, submit, return, submit, accept
reset role;

-- ================================================================ K8. temuan
select zz_test.login('karyawan@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('K8a karyawan tidak bisa membuat temuan',
  format($q$select __APP__.finding_save(null, '{}'::jsonb)$q$), '42501');
reset role;
select zz_test.login('pengawas@demo.lourdes.test');
set role authenticated;
select __APP__.finding_save(null, jsonb_build_object(
  'location_id', :'site', 'area_id', :'area', 'found_at', now()::text,
  'title', 'Padlock LOTO tidak terpasang', 'description', 'Panel kelistrikan tanpa padlock',
  'source_kind', 'inspection', 'source_ref', 'INS-2026-0230', 'category', 'operational_safety',
  'risk_level', 'critical', 'likelihood', 3, 'consequence', 4,
  'root_causes', jsonb_build_array(jsonb_build_object('factor', 'man', 'text', 'Pemahaman LOTO belum konsisten'),
                                   jsonb_build_object('factor', 'xxx', 'text', 'dibuang')),
  'pic_id', :'u_karyawan', 'due_date', current_date + 3)) as r \gset
select (:'r'::jsonb ->> 'id') as fnd \gset
select zz_test.check('K8b temuan TMN dibuat, status open, akar penyebab valid saja',
  (:'r'::jsonb ->> 'code') like 'TMN-____-____'
  and (select status = 'open' and jsonb_array_length(root_causes) = 1 from __APP__.findings where id = :'fnd'));
select zz_test.expect_error('K8c sumber kejadian wajib menunjuk kejadian',
  format($q$select __APP__.finding_save(null, jsonb_build_object('location_id', %L, 'area_id', %L, 'found_at', now()::text,
    'title', 'abc', 'description', 'x', 'source_kind', 'incident', 'category', 'housekeeping', 'risk_level', 'low',
    'pic_id', %L, 'due_date', current_date))$q$, :'site', :'area', :'u_karyawan'), 'P0001', '%kejadian sumber%');
select __APP__.pica_create(jsonb_build_object('finding_id', :'fnd', 'title', 'Pasang padlock LOTO',
  'kind', 'corrective', 'pic_id', :'u_karyawan', 'verifier_id', :'u_hse', 'due_date', current_date + 3)) ->> 'id' as fact \gset
select zz_test.check('K8d pembuat temuan bisa menambah tindakan', :'fact' is not null);
reset role;

select zz_test.login('karyawan@demo.lourdes.test');
set role authenticated;
select zz_test.check('K8e PIC (karyawan) membaca temuan & tindakannya',
  exists (select 1 from __APP__.findings where id = :'fnd') and exists (select 1 from __APP__.pica_actions where id = :'fact'));
select zz_test.check('K8f Tugas Saya PIC memuat tindakan',
  exists (select 1 from __APP__.my_tasks() where kind = 'pica_do' and ref_id = :'fact'));
select __APP__.pica_start(:'fact');
reset role;
select zz_test.check('K8g status temuan ikut tindakan (in_progress) tanpa log tambahan',
  (select status from __APP__.findings where id = :'fnd') = 'in_progress'
  and (select count(*) from __APP__.findings_logs where record_id = :'fnd') = 1);

select zz_test.login('hse@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('K8h temuan tidak bisa ditutup bila tindakan belum Closed',
  format($q$select __APP__.finding_close(%L, 'selesai')$q$, :'fnd'), 'P0001', '%belum Closed%');
select zz_test.expect_error('K8i ubah due date tanpa alasan ditolak',
  format($q$select __APP__.pica_change_due(%L, current_date + 10, '')$q$, :'fact'), 'P0001', '%Alasan%');
select __APP__.pica_change_due(:'fact', current_date + 10, 'Menunggu pengadaan padlock');
select zz_test.check('K8j perubahan due date tercatat dengan alasan',
  exists (select 1 from __APP__.pica_actions_logs where record_id = :'fact' and action = 'change_due'
           and note = 'Menunggu pengadaan padlock'));
reset role;

insert into storage.objects (bucket_id, name, owner_id) values ('__HOST__-lampiran', 'pica/' || :'fact' || '/r1/padlock.jpg', :'u_karyawan');
select zz_test.login('karyawan@demo.lourdes.test');
set role authenticated;
select __APP__.pica_submit_evidence(:'fact', null, array['pica/' || :'fact' || '/r1/padlock.jpg']);
reset role;
select zz_test.check('K8k semua tindakan menunggu verifikasi → temuan waiting_verification',
  (select status from __APP__.findings where id = :'fnd') = 'waiting_verification');
select zz_test.login('hse@demo.lourdes.test');
set role authenticated;
select zz_test.check('K8l Tugas Saya verifikator memuat verifikasi',
  exists (select 1 from __APP__.my_tasks() where kind = 'pica_verify' and ref_id = :'fact'));
select __APP__.pica_verify(:'fact', 'accept', 'Padlock terpasang');
select __APP__.pica_set_effectiveness(:'fact', current_date, 'Tidak berulang');
select __APP__.finding_close(:'fnd', 'Semua tindakan terverifikasi');
select zz_test.check('K8m temuan Closed',
  (select status = 'closed' and closed_at is not null from __APP__.findings where id = :'fnd'));
select zz_test.expect_error('K8n tindakan tidak bisa ditambah ke temuan Closed',
  format($q$select __APP__.pica_create(jsonb_build_object('finding_id', %L, 'title', 'abc', 'kind', 'corrective',
    'pic_id', %L, 'verifier_id', %L, 'due_date', current_date + 7))$q$, :'fnd', :'u_pengawas', :'u_hse'), 'P0001', '%ditutup%');
reset role;

-- ================================================================ K9. tutup dengan pengecualian, badge, cari, storage
select zz_test.login('hse.senior@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('K9a hanya PJO menutup dengan pengecualian',
  format($q$select __APP__.incident_close_exception(%L, 'alasan cukup panjang')$q$, :'inc_sod'), '42501');
reset role;
select zz_test.login('pjo@demo.lourdes.test');
set role authenticated;
select zz_test.check('K9b PJO belum mendapat tugas review saat tahap masih EHS',
  not exists (select 1 from __APP__.my_tasks() where kind = 'incident_review' and ref_id = :'inc_sod'));
select zz_test.expect_error('K9c alasan pengecualian minimal 10 karakter',
  format($q$select __APP__.incident_close_exception(%L, 'pendek')$q$, :'inc_sod'), 'P0001', '%minimal 10%');
select __APP__.incident_close_exception(:'inc_sod', 'Duplikat laporan, sudah ditangani di KJD lain');
select zz_test.check('K9d ditutup dengan pengecualian',
  (select status = 'closed' and closed_exception from __APP__.incidents where id = :'inc_sod'));
select zz_test.check('K9e pencarian global menemukan kejadian, temuan, tindakan',
  (select count(distinct kind) from __APP__.global_search(lower(:'inc_code'))) >= 1
  and exists (select 1 from __APP__.global_search('padlock') where kind = 'temuan')
  and exists (select 1 from __APP__.global_search('padlock') where kind = 'tindakan'));
reset role;

select zz_test.login('hse@demo.lourdes.test');
set role authenticated;
select (__APP__.incident_report(jsonb_build_object('location_id', :'site', 'area_id', :'area',
  'occurred_at', now()::text, 'category', 'near_miss', 'description', 'Badge uji')) ->> 'id') as inc_b \gset
select zz_test.check('K9f badge HSE: kejadian perlu klasifikasi', (__APP__.k3_badges() ->> 'incidents_to_classify')::int >= 1);
select zz_test.check('K9g Tugas Saya HSE: klasifikasi', exists (select 1 from __APP__.my_tasks()
  where kind = 'incident_classify' and ref_id = :'inc_b'));
reset role;
select zz_test.login('pjo@demo.lourdes.test');
set role authenticated;
select zz_test.check('K9h badge non-HSE: klasifikasi 0', (__APP__.k3_badges() ->> 'incidents_to_classify')::int = 0);
reset role;

-- storage: lampiran kejadian ikut hak baca kejadian
insert into storage.objects (bucket_id, name, owner_id) values ('__HOST__-lampiran', 'kejadian/' || :'inc' || '/foto.jpg', :'u_karyawan');
select zz_test.login('karyawan@demo.lourdes.test');
set role authenticated;
select zz_test.check('K9i pelapor membaca lampiran kejadiannya',
  exists (select 1 from storage.objects where name = 'kejadian/' || :'inc' || '/foto.jpg'));
select zz_test.check('K9j karyawan tidak membaca lampiran kejadian orang lain',
  not exists (select 1 from storage.objects where name like 'kejadian/' || :'inc_b' || '/%')
  and not exists (select 1 from __APP__.incidents where id = :'inc_b'));
reset role;
select zz_test.login('viewer@demo.lourdes.test');
set role authenticated;
select zz_test.check('K9k user tanpa hak baca kejadian tidak membaca lampirannya',
  not exists (select 1 from storage.objects where name = 'kejadian/' || :'inc' || '/foto.jpg'));
select zz_test.expect_error('K9l user tanpa hak tidak bisa mengunggah ke folder kejadian',
  format($q$insert into storage.objects (bucket_id, name, owner_id) values ('__HOST__-lampiran', 'kejadian/%s/x.jpg', auth.uid()::text)$q$, :'inc'),
  '42501');
reset role;

do $$ begin raise notice 'Uji kejadian & PICA selesai.'; end $$;
