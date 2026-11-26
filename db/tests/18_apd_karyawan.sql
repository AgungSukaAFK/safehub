-- =====================================================================================
-- Uji 27: impor karyawan dari Populasi Manpower + tautan riwayat lama. Setelah 16_apd (data impor "Pekerja Uji" di Site MIFA).
-- =====================================================================================
\set ON_ERROR_STOP on
set client_min_messages = notice;

select id as site from public.locations where name = 'Site MIFA' \gset
\set pop '{"people":[{"name":"Pekerja  Uji","site":"MIFA","job_title":"Mekanik","sizes":{"uniform_tshirt":"L","safety_shoes":"41"},"issues":[{"type":"uniform_tshirt","date":"2026-07-16","qty":3,"size":"L"},{"type":"safety_shoes","date":"2026-08-12","size":"41"}]},{"name":"Rudi Hartono","site":"MIFA","job_title":"Teknisi AC","sizes":{"safety_helmet":"Kuning"},"issues":[]},{"name":"Karyawan Baru Populasi","site":"MIFA","job_title":"","sizes":{},"issues":[{"type":"earplug","date":"2025-11-05"}]}]}'

select zz_test.login('pengawas@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('E1a pengawas tidak bisa mengimpor karyawan',
  format($q$select __APP__.apd_import_population('GMI', jsonb_build_object('MIFA', %L), %L::jsonb)$q$, :'site', :'pop'), '42501');
reset role;

select zz_test.login('hr@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('E1b site belum dipetakan ditolak',
  format($q$select __APP__.apd_import_population('GMI', '{}'::jsonb, %L::jsonb)$q$, :'pop'), 'P0001', '%MIFA%');
select __APP__.apd_import_population('GMI', jsonb_build_object('MIFA', :'site'), :'pop'::jsonb) as r1 \gset
reset role;
select zz_test.check('E2a dua karyawan baru (NIK sementara APD-NNNN, jabatan kosong = Belum diisi), Rudi dicocokkan',
  (:'r1'::jsonb ->> 'created')::int = 2 and (:'r1'::jsonb ->> 'matched')::int = 1
  and (select count(*) from __APP__.employees where code ~ '^APD-\d{4}$') = 2
  and exists (select 1 from __APP__.employees where name = 'Karyawan Baru Populasi' and job_title = 'Belum diisi')
  and exists (select 1 from __APP__.employees where name = 'Pekerja Uji'));
select zz_test.check('E2b ukuran & riwayat awal tersimpan; jatuh tempo karyawan baru terhitung dari riwayat',
  (select size = 'L' from __APP__.apd_employee_sizes s join __APP__.employees e on e.id = s.employee_id join __APP__.apd_types t on t.id = s.type_id
    where e.name = 'Pekerja Uji' and t.code = 'uniform_tshirt')
  and (:'r1'::jsonb ->> 'issues')::int = 3
  and (select last_on = date '2026-08-12' from __APP__.apd_holdings(null, (select id from __APP__.employees where name = 'Pekerja Uji')) where type_code = 'safety_shoes'));
select zz_test.check('E2c tautan otomatis: OUT & pengajuan data lama atas nama "Pekerja Uji" di MIFA tertaut',
  (:'r1'::jsonb ->> 'linked_moves')::int = 1 and (:'r1'::jsonb ->> 'linked_requests')::int = 1
  and not exists (select 1 from __APP__.apd_stock_moves where source = 'import' and recipient_name = 'Pekerja Uji' and employee_id is null)
  and (select job_title = 'Mekanik' from __APP__.apd_requests where source = 'import' and recipient_name = 'Pekerja Uji'));

select zz_test.login('hr@demo.lourdes.test');
set role authenticated;
select __APP__.apd_import_population('GMI', jsonb_build_object('MIFA', :'site'), :'pop'::jsonb) as r2 \gset
select zz_test.check('E3a impor ulang idempoten: tidak ada karyawan/riwayat baru',
  (:'r2'::jsonb ->> 'created')::int = 0 and (:'r2'::jsonb ->> 'matched')::int = 3 and (:'r2'::jsonb ->> 'issues')::int = 0
  and (select count(*) from __APP__.employees where code ~ '^APD-\d{4}$') = 2);
select zz_test.check('E3b tidak ada sisa nama data lama yang belum tertaut', not exists (select 1 from __APP__.apd_unlinked('GMI')));
select zz_test.expect_error('E3c tautan manual tanpa data lama ditolak',
  format($q$select __APP__.apd_link_recipient('Orang Lain', %L, (select id from __APP__.employees where name = 'Rudi Hartono'))$q$, :'site'), 'P0001', '%Tidak ada data lama%');
reset role;
