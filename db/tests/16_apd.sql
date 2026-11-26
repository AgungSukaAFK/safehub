-- =====================================================================================
-- Uji fase 6: Monitoring APD (docs/spec/fase-6-apd.md). Setelah 01-15 di DB yang sama.
-- =====================================================================================
\set ON_ERROR_STOP on
set client_min_messages = notice;

select id as ho from public.locations where name = 'Kantor Pusat Bekasi' \gset
select id as wh from __APP__.apd_warehouses where name = 'Gudang HO' \gset
select id as site from public.locations where name = 'Site MIFA' \gset
select id as e_rudi from __APP__.employees where code = 'GMI-0017' \gset
select id as e_agus from __APP__.employees where code = 'GMI-0024' \gset
select id as t_shoes from __APP__.apd_types where code = 'safety_shoes' \gset
select id as t_tshirt from __APP__.apd_types where code = 'uniform_tshirt' \gset
select id as i_ss40 from __APP__.apd_items where code = 'SS-01-40' \gset
select id as i_ss41 from __APP__.apd_items where code = 'SS-01-41' \gset
select id as i_ks03 from __APP__.apd_items where code = 'KS-01-03' \gset
select id as i_pdl from __APP__.apd_items where code = 'PDL-01' \gset
select r.id as req_ok, l.id as line_ok from __APP__.apd_requests r join __APP__.apd_request_lines l on l.request_id = r.id
 where r.status = 'approved' and r.employee_id = :'e_rudi' \gset
select id as req_draft from __APP__.apd_requests where status = 'draft' and reason = 'damaged' \gset

select zz_test.check('P1a tabel APD tanpa hak tulis untuk authenticated; RPC bisa dipanggil; helper internal tertutup',
  not exists (select 1 from information_schema.role_table_grants where grantee = 'authenticated' and table_schema = '__APP__'
               and table_name like 'apd\_%' and table_name <> 'apd_warehouses' and privilege_type in ('INSERT', 'UPDATE', 'DELETE'))
  and not has_table_privilege('authenticated', '__APP__.apd_warehouses', 'DELETE')
  and has_function_privilege('authenticated', '__APP__.apd_move_save(jsonb)', 'execute')
  and not has_function_privilege('anon', '__APP__.apd_request_save(uuid, jsonb)', 'execute')
  and not has_function_privilege('authenticated', '__APP__.apd_stock_qty(uuid, uuid)', 'execute')
  and not has_function_privilege('authenticated', '__APP__.apd_request_on_approval(uuid, text)', 'execute'));
select zz_test.check('P1b jenis APD dari Matrix APD: sepatu 365 hr, helm 1095 hr, earplug 91 hr, sarung tangan tidak dilacak',
  (select interval_days from __APP__.apd_types where code = 'safety_shoes') = 365
  and (select interval_days from __APP__.apd_types where code = 'safety_helmet') = 1095
  and (select interval_days from __APP__.apd_types where code = 'earplug') = 91
  and (select not tracked from __APP__.apd_types where code = 'safety_glove')
  and exists (select 1 from __APP__.approval_doc_types where code = 'apd_request'));

-- ---------------------------------------------------------------- baca
select zz_test.login('karyawan@demo.lourdes.test');
set role authenticated;
select zz_test.check('P2a karyawan: hanya mutasi & pengajuan miliknya, master terbaca',
  (select count(*) from __APP__.apd_stock_moves) = (select count(*) from __APP__.apd_stock_moves where employee_id = :'e_rudi')
  and (select count(*) from __APP__.apd_stock_moves) >= 5
  and (select count(*) from __APP__.apd_requests) = 2 and (select count(*) from __APP__.apd_items) >= 14);
select zz_test.check('P2b APD saya: sepatu 330 hari lalu = segera ganti, kaos terakhir 2 hari lalu = aman',
  (select state from __APP__.apd_my_holdings() where type_code = 'safety_shoes') = 'due_soon'
  and (select state from __APP__.apd_my_holdings() where type_code = 'uniform_tshirt') = 'ok'
  and (select last_on from __APP__.apd_my_holdings() where type_code = 'uniform_tshirt') = (now() at time zone 'Asia/Jakarta')::date - 2);
select zz_test.expect_error('P2c karyawan tidak bisa mencatat mutasi',
  format($q$select __APP__.apd_move_save(jsonb_build_object('warehouse_id', %L, 'kind', 'in', 'item_id', %L, 'qty', 1, 'moved_on', current_date::text))$q$, :'wh', :'i_ss40'), '42501');
select zz_test.expect_error('P2d karyawan tidak bisa mengajukan untuk orang lain',
  format($q$select __APP__.apd_request_save(null, jsonb_build_object('employee_id', %L, 'reason', 'periodic', 'lines', jsonb_build_array(jsonb_build_object('type_id', %L, 'qty', 1))))$q$, :'e_agus', :'t_shoes'), '42501');
reset role;

select zz_test.login('pengawas@demo.lourdes.test');
set role authenticated;
select zz_test.check('P2e staf K3 melihat stok: KS-01-03 = 10 SO + 76 IN - 2 - 1 OUT = 83, sisa pengajuan 1',
  (select stock = 83 and outstanding = 1 from __APP__.apd_stock_overview(null) where code = 'KS-01-03'));
select zz_test.check('P2f ringkasan: 1 pengajuan terbuka, sisa 1, ada jatuh tempo',
  (select (s ->> 'requests_open')::int = 1 and (s ->> 'outstanding_qty')::int = 1 and (s ->> 'holdings_due_soon')::int >= 1 from __APP__.apd_summary(null) s));
select zz_test.expect_error('P2g pengawas bukan pengelola stok',
  format($q$select __APP__.apd_move_save(jsonb_build_object('warehouse_id', %L, 'kind', 'in', 'item_id', %L, 'qty', 1, 'moved_on', current_date::text))$q$, :'wh', :'i_ss40'), '42501');
reset role;

-- ---------------------------------------------------------------- stok (SCM/Gudang)
select zz_test.login('scm@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('P3a OUT melebihi stok ditolak (SS-01-40 tersedia 2)',
  format($q$select __APP__.apd_move_save(jsonb_build_object('warehouse_id', %L, 'kind', 'out', 'item_id', %L, 'qty', 3, 'moved_on', current_date::text, 'employee_id', %L))$q$, :'wh', :'i_ss40', :'e_agus'), 'P0001', '%tidak cukup%');
select (__APP__.apd_move_save(jsonb_build_object('warehouse_id', :'wh', 'kind', 'out', 'item_id', :'i_ss40', 'qty', 1, 'moved_on', current_date::text,
  'employee_id', :'e_agus', 'ref_no', 'BAST-UJI-01')) ->> 'id') as mv_out \gset
select zz_test.check('P3b OUT tercatat: penerima & site dari karyawan, stok jadi 1, log stock_out',
  (select recipient_name = 'Agus Setiawan' and dest_location_id = :'site' from __APP__.apd_stock_moves where id = :'mv_out')
  and (select stock from __APP__.apd_stock_overview(:'wh') where code = 'SS-01-40') = 1
  and exists (select 1 from __APP__.apd_stock_moves_logs where record_id = :'mv_out' and action = 'stock_out'));
select zz_test.expect_error('P3c stok awal kedua ditolak',
  format($q$select __APP__.apd_move_save(jsonb_build_object('warehouse_id', %L, 'kind', 'opening', 'item_id', %L, 'qty', 5, 'moved_on', current_date::text))$q$, :'wh', :'i_ss40'), 'P0001', '%sudah dicatat%');
select zz_test.expect_error('P3d penyesuaian tanpa alasan ditolak',
  format($q$select __APP__.apd_move_save(jsonb_build_object('warehouse_id', %L, 'kind', 'adjust', 'item_id', %L, 'qty', -1, 'moved_on', current_date::text))$q$, :'wh', :'i_ss40'), 'P0001', '%beralasan%');
select zz_test.expect_error('P3e OUT ke pengajuan melebihi sisa ditolak',
  format($q$select __APP__.apd_move_save(jsonb_build_object('warehouse_id', %L, 'kind', 'out', 'item_id', %L, 'qty', 2, 'moved_on', current_date::text, 'request_line_id', %L))$q$, :'wh', :'i_ks03', :'line_ok'), 'P0001', '%sisa pengajuan%');
select zz_test.expect_error('P3f OUT ke pengajuan dengan barang beda jenis ditolak',
  format($q$select __APP__.apd_move_save(jsonb_build_object('warehouse_id', %L, 'kind', 'out', 'item_id', %L, 'qty', 1, 'moved_on', current_date::text, 'request_line_id', %L))$q$, :'wh', :'i_ss41', :'line_ok'), 'P0001', '%tidak sesuai jenis%');
select (__APP__.apd_move_save(jsonb_build_object('warehouse_id', :'wh', 'kind', 'out', 'item_id', :'i_ks03', 'qty', 1, 'moved_on', current_date::text,
  'request_line_id', :'line_ok')) ->> 'id') as mv_line \gset
select zz_test.check('P3g OUT ke pengajuan: penerima dari pengajuan, pengajuan terpenuhi, lead time terhitung',
  (select employee_id = :'e_rudi' from __APP__.apd_stock_moves where id = :'mv_line')
  and (select fulfillment = 'full' and outstanding_total = 0 and lead_days = 4 from __APP__.apd_request_progress where request_id = :'req_ok'));
select __APP__.apd_move_void(:'mv_out', 'Salah catat, sepatu belum dikirim');
select zz_test.check('P3h batal OUT: stok kembali 2, mutasi tetap ada dengan alasan + log void',
  (select stock from __APP__.apd_stock_overview(:'wh') where code = 'SS-01-40') = 2
  and (select voided_at is not null from __APP__.apd_stock_moves where id = :'mv_out')
  and exists (select 1 from __APP__.apd_stock_moves_logs where record_id = :'mv_out' and action = 'void'));
select (__APP__.apd_move_save(jsonb_build_object('warehouse_id', :'wh', 'kind', 'out', 'item_id', :'i_pdl', 'qty', 8, 'moved_on', current_date::text,
  'recipient_name', 'Tim OJT Kalimantan', 'dest_location_id', :'site')) ->> 'id') as mv_pdl \gset
select id as mv_pdl_in from __APP__.apd_stock_moves where item_id = :'i_pdl' and kind = 'in' \gset
select zz_test.expect_error('P3i membatalkan IN yang sudah terpakai (stok jadi minus) ditolak',
  format($q$select __APP__.apd_move_void(%L, 'Uji pembatalan barang masuk')$q$, :'mv_pdl_in'), 'P0001', '%stok minus%');
reset role;

-- ---------------------------------------------------------------- pengajuan + approval (Form Berita Acara)
select zz_test.login('karyawan@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('P4a ajukan rusak tanpa foto bukti ditolak',
  format($q$select __APP__.approval_start('apd_request', %L)$q$, :'req_draft'), 'P0001', '%foto bukti%');
reset role;
insert into storage.objects (bucket_id, name, owner_id) values ('__HOST__-lampiran', 'apd/' || :'req_draft' || '/sepatu.jpg', (select id::text from public.profiles where email = 'karyawan@demo.lourdes.test'));
select zz_test.login('karyawan@demo.lourdes.test');
set role authenticated;
select __APP__.apd_request_save(:'req_draft', jsonb_build_object('employee_id', :'e_rudi', 'reason', 'damaged', 'negligence', true,
  'incident_on', (current_date - 1)::text, 'explanation', 'Sol sepatu lepas saat pekerjaan di area workshop.',
  'lines', jsonb_build_array(jsonb_build_object('type_id', :'t_shoes', 'size', '41', 'qty', 1))));
select zz_test.expect_error('P4b rusak karena kelalaian tanpa pernyataan potong gaji ditolak',
  format($q$select __APP__.approval_start('apd_request', %L)$q$, :'req_draft'), 'P0001', '%potong gaji%');
select __APP__.apd_request_save(:'req_draft', jsonb_build_object('employee_id', :'e_rudi', 'reason', 'damaged', 'negligence', true, 'deduction_ack', true,
  'incident_on', (current_date - 1)::text, 'explanation', 'Sol sepatu lepas saat pekerjaan di area workshop.',
  'lines', jsonb_build_array(jsonb_build_object('type_id', :'t_shoes', 'size', '41', 'qty', 1))));
select __APP__.approval_start('apd_request', :'req_draft');
select zz_test.check('P4c diajukan: pending_approval, 3 langkah, foto terhitung',
  (select status = 'pending_approval' and evidence_count = 1 and requested_on is not null from __APP__.apd_requests where id = :'req_draft')
  and (select count(*) from __APP__.approvals where doc_type = 'apd_request' and record_id = :'req_draft') = 3);
select zz_test.expect_error('P4d pengajuan berjalan tidak bisa diubah',
  format($q$select __APP__.apd_request_save(%L, jsonb_build_object('employee_id', %L, 'reason', 'periodic', 'lines', jsonb_build_array(jsonb_build_object('type_id', %L, 'qty', 1))))$q$, :'req_draft', :'e_rudi', :'t_shoes'), 'P0001', '%Draf atau Ditolak%');
reset role;
select id as a1 from __APP__.approvals where doc_type = 'apd_request' and record_id = :'req_draft' and step_no = 1 \gset
select id as a2 from __APP__.approvals where doc_type = 'apd_request' and record_id = :'req_draft' and step_no = 2 \gset
select id as a3 from __APP__.approvals where doc_type = 'apd_request' and record_id = :'req_draft' and step_no = 3 \gset
select zz_test.login('hse@demo.lourdes.test');
set role authenticated;
select __APP__.approval_decide(:'a1', 'approved', null);
reset role;
select zz_test.login('hr@demo.lourdes.test');
set role authenticated;
select zz_test.check('P4e approver (HR) bisa membaca pengajuan', exists (select 1 from __APP__.apd_requests where id = :'req_draft'));
select __APP__.approval_decide(:'a2', 'approved', null);
reset role;
select zz_test.login('hse.senior@demo.lourdes.test');
set role authenticated;
select __APP__.approval_decide(:'a3', 'approved', null);
reset role;
select zz_test.check('P4f disetujui: approved hari ini, belum terkirim, gudang (SCM) diberi tahu',
  (select status = 'approved' and approved_on = (now() at time zone 'Asia/Jakarta')::date from __APP__.apd_requests where id = :'req_draft')
  and (select fulfillment = 'none' and outstanding_total = 1 from __APP__.apd_request_progress where request_id = :'req_draft')
  and exists (select 1 from __APP__.notifications n join public.profiles p on p.id = n.user_id
               where p.email = 'scm@demo.lourdes.test' and n.type = 'apd_approved' and n.record_id = :'req_draft'::text)
  and exists (select 1 from __APP__.apd_requests_logs where record_id = :'req_draft' and action = 'approve'));
select zz_test.login('karyawan@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('P4g karyawan tidak bisa membatalkan pengajuan disetujui',
  format($q$select __APP__.apd_request_cancel(%L, 'Tidak jadi dibutuhkan lagi')$q$, :'req_draft'), '42501');
select (__APP__.apd_request_save(null, jsonb_build_object('employee_id', :'e_rudi', 'reason', 'periodic',
  'lines', jsonb_build_array(jsonb_build_object('type_id', :'t_tshirt', 'size', 'L', 'qty', 2)))) ->> 'id') as req_new \gset
select zz_test.check('P4h pengajuan baru bernomor APD-tahun-urut, snapshot nama & jabatan',
  (select code ~ '^APD-[0-9]{4}-[0-9]{4}$' and recipient_name = 'Rudi Hartono' and job_title = 'Teknisi AC' and status = 'draft'
     from __APP__.apd_requests where id = :'req_new'));
select __APP__.apd_request_cancel(:'req_new', 'Salah pilih jenis APD');
select zz_test.check('P4i draf dibatalkan pembuatnya', (select status = 'cancelled' from __APP__.apd_requests where id = :'req_new'));
reset role;

-- ---------------------------------------------------------------- pengingat jatuh tempo (P9)
-- sesi terakhir = karyawan; notify() tidak menotifikasi pemanggil sendiri → jalankan sebagai admin (di produksi: tanpa user)
select zz_test.login('admin@demo.lourdes.test');
-- seed: sepatu Rudi dikirim current_date - 330, masa 365 hari → jatuh tempo current_date + 35; dijalankan 14 hari sebelumnya
select (__APP__.run_apd_reminders(current_date + 21) ->> 'apd_due')::int as rem1 \gset
select (__APP__.run_apd_reminders(current_date + 21) ->> 'apd_due')::int as rem2 \gset
select zz_test.check('P5a pengingat apd_due: sepatu Rudi jatuh tempo 14 hari lagi diberi tahu ke karyawan + HSE, idempoten',
  :rem1 >= 1 and :rem2 = 0
  and exists (select 1 from __APP__.notifications n join public.profiles p on p.id = n.user_id
               where p.email = 'karyawan@demo.lourdes.test' and n.type = 'reminder.apd_due')
  and exists (select 1 from __APP__.notifications n join public.profiles p on p.id = n.user_id
               where p.email = 'hse@demo.lourdes.test' and n.type = 'reminder.apd_due'));
select zz_test.check('P5b run_reminders memuat apd_due', (__APP__.run_reminders() ? 'apd_due'));

-- ---------------------------------------------------------------- audit trail
select zz_test.login('admin@demo.lourdes.test');
set role authenticated;
select zz_test.check('P6a audit trail memuat mutasi & pengajuan APD',
  exists (select 1 from __APP__.audit_trail(array['apd_stock_moves']) where record_id = :'mv_out')
  and exists (select 1 from __APP__.audit_trail(array['apd_requests']) where record_id = :'req_draft'));
reset role;

-- ---------------------------------------------------------------- impor data lama lewat app (25_apd_impor)
\set apd_payload '{"opening_date":"2026-10-01","items":[{"code":"TST-01","name":"Uji Sarung Tangan","type":"safety_glove","brand":null,"size":null,"uom":"Pasang"},{"code":"SS-01-40","name":"Krusher Safety Shoes Uk 40","type":"safety_shoes","brand":"Krusher","size":"40","uom":"Pasang"}],"opening":[{"code":"TST-01","qty":10}],"ins":[{"code":"TST-01","qty":5,"date":"2026-10-05","ref":"MR-UJI","pic":"Gudang","note":null}],"outs":[{"code":"TST-01","qty":2,"date":"2026-10-06","bast":null,"pic":"Gudang","site":"MIFA","name":"Pekerja Uji","note":"uji impor"}],"requests":[{"site":"MIFA","name":"Pekerja Uji","mr":null,"date":null,"rows":[5,6],"lines":[{"code":"TST-01","qty":3,"supplied":2,"note":null}]}]}'
select zz_test.login('pengawas@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('P7a pengawas tidak bisa mengimpor',
  format($q$select __APP__.apd_import_legacy('GMI', jsonb_build_object('MIFA', %L), %L::jsonb, %L)$q$, :'site', :'apd_payload', :'wh'), '42501');
reset role;
select zz_test.login('scm@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('P7b site tanpa lokasi ditolak (sebut kodenya)',
  format($q$select __APP__.apd_import_legacy('GMI', '{}'::jsonb, %L::jsonb, %L)$q$, :'apd_payload', :'wh'), 'P0001', '%MIFA%');
select __APP__.apd_import_legacy('GMI', jsonb_build_object('MIFA', :'site'), :'apd_payload'::jsonb, :'wh') as imp \gset
reset role;
select zz_test.check('P7c impor: barang baru saja (kode lama dipertahankan), SO/IN/OUT di gudang HO, pengajuan disetujui dengan OS dari qty supply',
  (:'imp'::jsonb ->> 'items')::int = 1 and (:'imp'::jsonb ->> 'out')::int = 1 and (:'imp'::jsonb ->> 'requests')::int = 1
  and (select stock = 13 from __APP__.apd_stock_overview(:'wh') where code = 'TST-01')
  and (select dest_location_id = :'site' and recipient_name = 'Pekerja Uji' from __APP__.apd_stock_moves where source = 'import' and kind = 'out')
  and (select r.status = 'approved' and p.outstanding_total = 1 from __APP__.apd_requests r join __APP__.apd_request_progress p on p.request_id = r.id where r.source = 'import')
  and not exists (select 1 from __APP__.apd_stock_moves_logs l join __APP__.apd_stock_moves m on m.id = l.record_id where m.source = 'import'));
select zz_test.login('scm@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('P7d impor kedua ditolak',
  format($q$select __APP__.apd_import_legacy('GMI', jsonb_build_object('MIFA', %L), %L::jsonb, %L)$q$, :'site', :'apd_payload', :'wh'), 'P0001', '%sudah pernah%');
reset role;
