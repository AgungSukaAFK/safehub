-- =====================================================================================
-- Uji fase 4D: Dokumen terkendali, Evaluasi Peraturan, Register KO (docs/spec/fase-4-people-kontraktor-dokumen.md).
-- Setelah 01–11 di DB yang sama.
-- =====================================================================================
\set ON_ERROR_STOP on
set client_min_messages = notice;

select id as site from public.locations where name = 'Site MIFA' \gset
select id as area from __APP__.areas where location_id = :'site' and name = 'Workshop Service' \gset
select id as u_peng from public.profiles where email = 'pengawas@demo.lourdes.test' \gset
select id as e_rudi from __APP__.employees where code = 'GMI-0017' \gset
select id as ev_partial from __APP__.regulation_evaluations where compliance = 'partial' \gset
select id as ev_ok from __APP__.regulation_evaluations where compliance = 'compliant' \gset

select zz_test.check('D1a tabel dokumen tanpa hak tulis untuk authenticated; RPC bisa dipanggil; hook tertutup',
  not exists (select 1 from information_schema.role_table_grants where grantee = 'authenticated' and table_schema = '__APP__'
               and table_name in ('controlled_documents', 'document_revisions', 'document_acknowledgements', 'regulations', 'regulation_evaluations', 'ko_register')
               and privilege_type in ('INSERT', 'UPDATE', 'DELETE'))
  and has_function_privilege('authenticated', '__APP__.document_save(uuid, jsonb)', 'execute')
  and not has_function_privilege('anon', '__APP__.document_overview()', 'execute')
  and not has_function_privilege('authenticated', '__APP__.document_revision_on_approval(uuid, text)', 'execute')
  and exists (select 1 from __APP__.approval_doc_types where code = 'document_revision'));
select zz_test.check('D1b seed: 3 dokumen, 5 revisi, 2 peraturan, 3 evaluasi, 3 item KO',
  (select count(*) from __APP__.controlled_documents) = 3 and (select count(*) from __APP__.document_revisions) = 5
  and (select count(*) from __APP__.regulations) = 2 and (select count(*) from __APP__.regulation_evaluations) = 3
  and (select count(*) from __APP__.ko_register) = 3);

-- ---------------------------------------------------------------- baca
select zz_test.login('karyawan@demo.lourdes.test');
set role authenticated;
select zz_test.check('D2a karyawan membaca dokumen terbit (3) tapi TIDAK draf revisi; tanpa peraturan/KO',
  (select count(*) from __APP__.controlled_documents) = 3 and (select count(*) from __APP__.document_revisions) = 4
  and not exists (select 1 from __APP__.document_revisions where status = 'draft')
  and (select count(*) from __APP__.regulations) = 0 and (select count(*) from __APP__.ko_register) = 0);
select zz_test.check('D2b karyawan hanya melihat pengakuan miliknya', (select count(*) from __APP__.document_acknowledgements where user_id <> (select auth.uid())) = 0
  and (select count(*) from __APP__.document_acknowledgements) = 2);
reset role;
select zz_test.login('pengawas@demo.lourdes.test');
set role authenticated;
select zz_test.check('D2c staf K3 melihat semua revisi (5), peraturan (2), KO (3)',
  (select count(*) from __APP__.document_revisions) = 5 and (select count(*) from __APP__.regulations) = 2 and (select count(*) from __APP__.ko_register) = 3);
select zz_test.expect_error('D2d pengawas tidak bisa membuat dokumen',
  $q$select __APP__.document_save(null, jsonb_build_object('code', 'SOP-X-1', 'title', 'Uji', 'kind', 'sop'))$q$, '42501');
reset role;

-- ---------------------------------------------------------------- dokumen baru + revisi lewat approval engine
select zz_test.login('hse@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('D3a kode ganda ditolak',
  $q$select __APP__.document_save(null, jsonb_build_object('code', 'sop-hse-001', 'title', 'Dobel', 'kind', 'sop'))$q$, 'P0001', '%sudah dipakai%');
select (__APP__.document_save(null, jsonb_build_object('code', 'SOP-UJI-001', 'title', 'Prosedur Uji Distribusi', 'kind', 'sop', 'review_months', 6,
  'distribute_titles', jsonb_build_array('Planner', 'Admin Gudang'), 'distribute_employees', jsonb_build_array(:'e_rudi'))) ->> 'id') as d_new \gset
select id as r1 from __APP__.document_revisions where document_id = :'d_new' and rev_no = 1 \gset
select zz_test.check('D3b dokumen baru + revisi 1 draf', (select status from __APP__.document_revisions where id = :'r1') = 'draft');
select zz_test.expect_error('D3c ajukan tanpa file ditolak',
  format($q$select __APP__.approval_start('document_revision', %L)$q$, :'r1'), 'P0001', '%Unggah file%');
reset role;
insert into storage.objects (bucket_id, name, owner_id) values ('__HOST__-lampiran', 'dokumen/' || :'r1' || '/uji.pdf', (select id::text from public.profiles where email = 'hse@demo.lourdes.test'));
select zz_test.login('hse@demo.lourdes.test');
set role authenticated;
select __APP__.approval_start('document_revision', :'r1');
select zz_test.check('D3d diajukan: pending_approval, 2 langkah, file terhitung',
  (select status = 'pending_approval' and evidence_count = 1 from __APP__.document_revisions where id = :'r1')
  and (select count(*) from __APP__.approvals where doc_type = 'document_revision' and record_id = :'r1') = 2);
select zz_test.expect_error('D3e revisi baru saat ada yang berjalan ditolak',
  format($q$select __APP__.document_revision_start(%L, 'Perubahan baru')$q$, :'d_new'), 'P0001', '%belum selesai%');
reset role;
select id as ap1 from __APP__.approvals where doc_type = 'document_revision' and record_id = :'r1' and step_no = 1 \gset
select id as ap2 from __APP__.approvals where doc_type = 'document_revision' and record_id = :'r1' and step_no = 2 \gset
select zz_test.login('hse.senior@demo.lourdes.test');
set role authenticated;
select __APP__.approval_decide(:'ap1', 'approved', null);
reset role;
select zz_test.login('pjo@demo.lourdes.test');
set role authenticated;
select __APP__.approval_decide(:'ap2', 'approved', null);
reset role;
select zz_test.check('D4a disetujui: revisi 1 approved, efektif hari ini, review sesuai interval 6 bulan',
  (select status = 'approved' and effective_on = (now() at time zone 'Asia/Jakarta')::date
          and review_due_on = ((now() at time zone 'Asia/Jakarta')::date + interval '6 months')::date from __APP__.document_revisions where id = :'r1'));
select zz_test.check('D4b pengakuan dibuat untuk jabatan + orang tujuan (Rudi, Hendra, Sari = 3)',
  (select count(*) from __APP__.document_acknowledgements where revision_id = :'r1') = 3
  and exists (select 1 from __APP__.document_acknowledgements a join public.profiles p on p.id = a.user_id where a.revision_id = :'r1' and p.email = 'karyawan@demo.lourdes.test'));
select zz_test.check('D4c penerima diberi notifikasi baca dokumen',
  (select count(*) from __APP__.notifications where type = 'document_ack' and record_id = :'r1'::text) = 3);

-- ---------------------------------------------------------------- pengakuan baca
select zz_test.login('karyawan@demo.lourdes.test');
set role authenticated;
select __APP__.document_acknowledge(:'r1');
select zz_test.check('D5a karyawan mengakui sudah membaca', (select acknowledged_at is not null from __APP__.document_acknowledgements where revision_id = :'r1' and user_id = (select auth.uid())));
reset role;
select zz_test.login('pengawas@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('D5b pengakuan oleh pihak yang tidak dituju ditolak',
  format($q$select __APP__.document_acknowledge(%L)$q$, :'r1'), 'P0001', '%tidak ditujukan%');
select zz_test.check('D5c staf K3 melihat progres: 1 dari 3 selesai', (select ack_total = 3 and ack_done = 1 from __APP__.document_overview() where document_id = :'d_new'));
reset role;

-- ---------------------------------------------------------------- revisi 2: revisi lama menjadi obsolete
select zz_test.login('hse@demo.lourdes.test');
set role authenticated;
select (__APP__.document_revision_start(:'d_new', 'Tambah langkah verifikasi dan batas waktu') ->> 'revision_id') as r2 \gset
reset role;
insert into storage.objects (bucket_id, name, owner_id) values ('__HOST__-lampiran', 'dokumen/' || :'r2' || '/uji2.pdf', (select id::text from public.profiles where email = 'hse@demo.lourdes.test'));
select zz_test.login('hse@demo.lourdes.test');
set role authenticated;
select __APP__.approval_start('document_revision', :'r2');
reset role;
select id as bp1 from __APP__.approvals where doc_type = 'document_revision' and record_id = :'r2' and step_no = 1 \gset
select id as bp2 from __APP__.approvals where doc_type = 'document_revision' and record_id = :'r2' and step_no = 2 \gset
select zz_test.login('hse.senior@demo.lourdes.test');
set role authenticated;
select __APP__.approval_decide(:'bp1', 'rejected', 'Perlu penjelasan batas waktu');
reset role;
select zz_test.check('D6a ditolak: revisi 2 rejected, revisi 1 tetap berlaku',
  (select status from __APP__.document_revisions where id = :'r2') = 'rejected' and (select status from __APP__.document_revisions where id = :'r1') = 'approved');
select zz_test.login('hse@demo.lourdes.test');
set role authenticated;
select __APP__.approval_start('document_revision', :'r2');
reset role;
select id as cp1 from __APP__.approvals where doc_type = 'document_revision' and record_id = :'r2' and round = 2 and step_no = 1 \gset
select id as cp2 from __APP__.approvals where doc_type = 'document_revision' and record_id = :'r2' and round = 2 and step_no = 2 \gset
select zz_test.login('hse.senior@demo.lourdes.test');
set role authenticated;
select __APP__.approval_decide(:'cp1', 'approved', null);
reset role;
select zz_test.login('pjo@demo.lourdes.test');
set role authenticated;
select __APP__.approval_decide(:'cp2', 'approved', null);
reset role;
select zz_test.check('D6b diajukan ulang dan disetujui: revisi 2 approved, revisi 1 obsolete (hanya satu terbit)',
  (select status from __APP__.document_revisions where id = :'r2') = 'approved' and (select status from __APP__.document_revisions where id = :'r1') = 'obsolete'
  and (select count(*) from __APP__.document_revisions where document_id = :'d_new' and status = 'approved') = 1);
select zz_test.check('D6c pengakuan baru dibuat untuk revisi 2 (3 orang, belum ada yang mengakui)',
  (select count(*) from __APP__.document_acknowledgements where revision_id = :'r2' and acknowledged_at is null) = 3);

-- ---------------------------------------------------------------- tarik dokumen
select zz_test.login('hse@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('D7a alasan penarikan singkat ditolak',
  format($q$select __APP__.document_withdraw(%L, 'singkat')$q$, :'d_new'), 'P0001', '%minimal 10%');
select __APP__.document_withdraw(:'d_new', 'Digantikan oleh SOP gabungan baru');
select zz_test.check('D7b ditarik: nonaktif, revisi terbit menjadi obsolete, ada log withdraw',
  not (select is_active from __APP__.controlled_documents where id = :'d_new')
  and (select count(*) from __APP__.document_revisions where document_id = :'d_new' and status = 'approved') = 0
  and exists (select 1 from __APP__.controlled_documents_logs where record_id = :'d_new' and action = 'withdraw'));
select zz_test.expect_error('D7c dokumen ditarik tidak bisa direvisi',
  format($q$select __APP__.document_revision_start(%L, 'Tidak boleh bisa')$q$, :'d_new'), 'P0001', '%sudah ditarik%');
reset role;

-- ---------------------------------------------------------------- evaluasi peraturan
select zz_test.login('pengawas@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('D8a pengawas tidak bisa mengevaluasi peraturan',
  format($q$select __APP__.regulation_evaluation_save(null, jsonb_build_object('regulation_id', (select regulation_id from __APP__.regulation_evaluations limit 1), 'location_id', %L, 'clause', 'Ps 1', 'requirement', 'Uji persyaratan', 'compliance', 'compliant', 'evaluated_on', current_date::text))$q$, :'site'), '42501');
reset role;
select zz_test.login('hse@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('D8b tidak sesuai tanpa tindak lanjut ditolak',
  format($q$select __APP__.regulation_evaluation_save(null, jsonb_build_object('regulation_id', (select regulation_id from __APP__.regulation_evaluations limit 1), 'location_id', %L, 'clause', 'Ps 9', 'requirement', 'Uji persyaratan', 'compliance', 'non_compliant', 'evaluated_on', current_date::text))$q$, :'site'), 'P0001', '%Tindak lanjut wajib%');
select zz_test.expect_error('D8c hanya Sebagian/Tidak Sesuai yang bisa jadi temuan',
  format($q$select __APP__.regulation_make_finding(%L, jsonb_build_object('area_id', %L, 'pic_id', %L, 'due_date', (current_date + 14)::text, 'risk_level', 'medium'))$q$, :'ev_ok', :'area', :'u_peng'), 'P0001', '%Sebagian atau Tidak Sesuai%');
select (__APP__.regulation_make_finding(:'ev_partial', jsonb_build_object('area_id', :'area', 'pic_id', :'u_peng', 'due_date', (current_date + 14)::text, 'risk_level', 'high')) ->> 'finding_id') as f_new \gset
select zz_test.check('D8d temuan terbentuk (sumber audit, kategori Dokumen & Prosedur) dan tertaut ke evaluasi',
  exists (select 1 from __APP__.findings where id = :'f_new' and source_kind = 'audit' and category = 'documents' and pic_id = :'u_peng')
  and (select finding_id from __APP__.regulation_evaluations where id = :'ev_partial') = :'f_new');
select zz_test.expect_error('D8e satu evaluasi hanya sekali jadi temuan',
  format($q$select __APP__.regulation_make_finding(%L, jsonb_build_object('area_id', %L, 'pic_id', %L, 'due_date', (current_date + 14)::text, 'risk_level', 'high'))$q$, :'ev_partial', :'area', :'u_peng'), 'P0001', '%sudah dijadikan temuan%');
reset role;

-- ---------------------------------------------------------------- register KO
select zz_test.login('pengawas@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('D9a pengawas tidak bisa menulis register KO',
  format($q$select __APP__.ko_save(null, jsonb_build_object('location_id', %L, 'title', 'Uji', 'kind', 'izin_operasi', 'valid_until', (current_date + 30)::text))$q$, :'site'), '42501');
reset role;
select zz_test.login('hse@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('D9b jenis item KO tidak valid ditolak',
  format($q$select __APP__.ko_save(null, jsonb_build_object('location_id', %L, 'title', 'Uji', 'kind', 'lain', 'valid_until', (current_date + 30)::text))$q$, :'site'), 'P0001', '%jenis item KO%');
select (__APP__.ko_save(null, jsonb_build_object('location_id', :'site', 'title', 'Uji Tangki BBM', 'kind', 'sertifikasi_alat', 'valid_until', (current_date + 90)::text)) ->> 'id') as ko_new \gset
select zz_test.check('D9c item KO tersimpan dengan nomor KO-tahun-urut', exists (select 1 from __APP__.ko_register where id = :'ko_new' and code ~ '^KO-[0-9]{4}-[0-9]{4}$'));
reset role;
select zz_test.check('D9d KPI Kepatuhan Dokumen terdaftar sebagai draf', (select status from __APP__.kpi_definitions where code = 'document_compliance') = 'draft');
