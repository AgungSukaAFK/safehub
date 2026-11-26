-- =====================================================================================
-- Uji 28: gudang APD (terpisah dari site) + Lengkapi MR → Terima MR (IN) → Kirim (OUT) per pengajuan. Setelah 16-18.
-- Pengajuan uji: req_draft dari 16 (rusak, Rudi, Safety Shoes uk 41 x1) yang sudah disetujui di P4.
-- =====================================================================================
\set ON_ERROR_STOP on
set client_min_messages = notice;

select id as site from public.locations where name = 'Site MIFA' \gset
select id as wh_ho from __APP__.apd_warehouses where name = 'Gudang HO' \gset
select id as i_ss41 from __APP__.apd_items where code = 'SS-01-41' \gset
select r.id as req, l.id as line from __APP__.apd_requests r join __APP__.apd_request_lines l on l.request_id = r.id
 where r.reason = 'damaged' and r.status = 'approved' and r.source = 'app' order by r.created_at limit 1 \gset
select id as e_rudi from __APP__.employees where code = 'GMI-0017' \gset

select zz_test.check('G1a semua mutasi punya gudang; mutasi demo ada di Gudang HO',
  not exists (select 1 from __APP__.apd_stock_moves where warehouse_id is null)
  and exists (select 1 from __APP__.apd_stock_moves where warehouse_id = :'wh_ho'));

-- ---------------------------------------------------------------- master gudang (admin)
select zz_test.login('hse@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('G2a non-admin tidak bisa menambah gudang (RLS)',
  $q$insert into __APP__.apd_warehouses (company_code, name) values ('GMI', 'Gudang Liar')$q$, '42501');
reset role;
select zz_test.login('admin@demo.lourdes.test');
set role authenticated;
insert into __APP__.apd_warehouses (company_code, name, location_id) values ('GMI', 'Gudang Site MIFA', :'site') returning id as wh_mifa \gset
insert into __APP__.apd_warehouses (company_code, name, location_id, is_active) values ('GMI', 'Gudang Lama', null, false) returning id as wh_off \gset
reset role;
select zz_test.check('G2b admin menambah gudang (terpisah dari site; lokasi opsional) + log config',
  exists (select 1 from __APP__.apd_warehouses_logs where record_id = :'wh_mifa' and action = 'create'));

-- ---------------------------------------------------------------- MR → IN
select zz_test.login('scm@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('G3a terima MR sebelum nomor MR dilengkapi ditolak',
  format($q$select __APP__.apd_request_moves('in', jsonb_build_object('request_id', %L, 'warehouse_id', %L, 'moved_on', current_date::text,
    'lines', jsonb_build_array(jsonb_build_object('line_id', %L, 'item_id', %L, 'qty', 1))))$q$, :'req', :'wh_mifa', :'line', :'i_ss41'), 'P0001', '%Lengkapi nomor MR%');
select __APP__.apd_request_set_mr(:'req', 'GMI/MR/XI/26/MFA/900');
select zz_test.check('G3b nomor MR tersimpan + log set_mr',
  (select mr_no = 'GMI/MR/XI/26/MFA/900' and mr_set_at is not null from __APP__.apd_requests where id = :'req')
  and exists (select 1 from __APP__.apd_requests_logs where record_id = :'req' and action = 'set_mr'));
select zz_test.expect_error('G3c gudang nonaktif ditolak',
  format($q$select __APP__.apd_request_moves('in', jsonb_build_object('request_id', %L, 'warehouse_id', %L, 'moved_on', current_date::text,
    'lines', jsonb_build_array(jsonb_build_object('line_id', %L, 'item_id', %L, 'qty', 1))))$q$, :'req', :'wh_off', :'line', :'i_ss41'), 'P0001', '%gudang yang aktif%');
select zz_test.expect_error('G3d terima melebihi qty MR ditolak',
  format($q$select __APP__.apd_request_moves('in', jsonb_build_object('request_id', %L, 'warehouse_id', %L, 'moved_on', current_date::text,
    'lines', jsonb_build_array(jsonb_build_object('line_id', %L, 'item_id', %L, 'qty', 2))))$q$, :'req', :'wh_mifa', :'line', :'i_ss41'), 'P0001', '%sisa MR%');
select __APP__.apd_request_moves('in', jsonb_build_object('request_id', :'req', 'warehouse_id', :'wh_mifa', 'moved_on', current_date::text, 'pic', 'Gudang MIFA',
  'lines', jsonb_build_array(jsonb_build_object('line_id', :'line', 'item_id', :'i_ss41', 'qty', 1))));
select zz_test.check('G3e MR diterima ke Gudang Site MIFA: stok gudang itu +1 (gudang lain tidak), no ref = nomor MR, baris tercatat diterima',
  (select stock = 1 from __APP__.apd_stock_overview(:'wh_mifa') where code = 'SS-01-41')
  and (select received = 1 and outstanding = 1 from __APP__.apd_request_line_progress where line_id = :'line')
  and exists (select 1 from __APP__.apd_stock_moves where request_line_id = :'line' and kind = 'in' and ref_no = 'GMI/MR/XI/26/MFA/900' and warehouse_id = :'wh_mifa'));

-- ---------------------------------------------------------------- OUT dari pengajuan
select zz_test.expect_error('G4a kirim dari gudang yang stoknya kosong ditolak (stok per gudang)',
  format($q$select __APP__.apd_request_moves('out', jsonb_build_object('request_id', %L, 'warehouse_id', %L, 'moved_on', current_date::text,
    'lines', jsonb_build_array(jsonb_build_object('line_id', %L, 'item_id', %L, 'qty', 1))))$q$, :'req', :'wh_ho', :'line', :'i_ss41'), 'P0001', '%tidak cukup%');
select __APP__.apd_request_moves('out', jsonb_build_object('request_id', :'req', 'warehouse_id', :'wh_mifa', 'moved_on', current_date::text, 'ref_no', 'BAST-UJI-9',
  'lines', jsonb_build_array(jsonb_build_object('line_id', :'line', 'item_id', :'i_ss41', 'qty', 1)))) as fo \gset
reset role;
select zz_test.check('G4b kirim: stok Gudang MIFA kembali 0, pengajuan terpenuhi, jatuh tempo sepatu Rudi mulai hari ini, satu notifikasi gabungan',
  (select stock = 0 from __APP__.apd_stock_overview(:'wh_mifa') where code = 'SS-01-41')
  and (select fulfillment = 'full' from __APP__.apd_request_progress where request_id = :'req')
  and (select last_on = (now() at time zone 'Asia/Jakarta')::date and state = 'ok' from __APP__.apd_holdings(null, :'e_rudi') where type_code = 'safety_shoes')
  and jsonb_array_length(:'fo'::jsonb -> 'notification_ids') = 1);
select zz_test.check('G4c stok per gudang: Gudang MIFA tercatat terpisah', exists (select 1 from __APP__.apd_stock_by_warehouse() where warehouse_id = :'wh_mifa' and item_id = :'i_ss41' and stock = 0));
select zz_test.login('karyawan@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('G4d karyawan tidak bisa melengkapi MR', format($q$select __APP__.apd_request_set_mr(%L, 'X')$q$, :'req'), '42501');
reset role;
