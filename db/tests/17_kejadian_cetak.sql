-- =====================================================================================
-- Uji 26: kolom formulir Laporan Investigasi (GMI.MR.F.013-001) untuk cetak kejadian. Setelah 01-16 di DB yang sama.
-- =====================================================================================
\set ON_ERROR_STOP on
set client_min_messages = notice;

select i.id as inc, i.category, i.injury_class, i.severity, i.potential_severity
  from __APP__.incidents i where i.status = 'investigating' and i.company_code = 'GMI' order by i.reported_at limit 1 \gset
select id as e_rudi from __APP__.employees where code = 'GMI-0017' \gset

select zz_test.login('hse@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('C1a occupational tidak dikenal ditolak',
  format($q$select __APP__.incident_classify(%L, jsonb_build_object('category', %L, 'injury_class', %L, 'severity', %L, 'potential_severity', %L, 'occupational', 'x'))$q$,
         :'inc', :'category', :'injury_class', :'severity', :'potential_severity'), 'P0001', '%occupational%');
select __APP__.incident_classify(:'inc', jsonb_build_object(
  'category', :'category', 'injury_class', :'injury_class', 'severity', :'severity', 'potential_severity', :'potential_severity',
  'ppe', jsonb_build_object('helmet', true), 'shift', 'Shift 1', 'overtime', false, 'activity', 'Mengganti tabung gas CO2',
  'occupational', 'occupational', 'victim_employee_id', :'e_rudi',
  'restricted', jsonb_build_object('injury_type', 'Iritasi', 'body_parts', jsonb_build_array('Mata kanan', ' '),
     'illnesses', jsonb_build_array('Sakit Kepala'), 'injuries', jsonb_build_array('Iritasi Mata'),
     'treatment_items', jsonb_build_array('Eye Wash', 'Dibawa ke Dokter'), 'victim_address', 'Jl. Uji No. 1',
     'victim_phone', '0812000000', 'victim_birth_date', '1990-05-01')));
select zz_test.check('C1b kolom formulir tersimpan (incidents + data terbatas), butir kosong dibuang',
  (select shift = 'Shift 1' and overtime = false and activity like 'Mengganti%' and occupational = 'occupational' and victim_employee_id = :'e_rudi'
     from __APP__.incidents where id = :'inc')
  and (select body_parts = array['Mata kanan'] and illnesses = array['Sakit Kepala'] and treatment_items = array['Eye Wash', 'Dibawa ke Dokter']
            and victim_birth_date = date '1990-05-01' from __APP__.incident_restricted where incident_id = :'inc'));
select __APP__.incident_save_investigation(:'inc', jsonb_build_object(
  'timeline', jsonb_build_array(jsonb_build_object('time', '09:00', 'event', 'Tabung bocor saat diganti')),
  'reconstruction', 'Tutup valve diambil dari tabung lain',
  'facts', 'Tabung tidak memiliki tutup valve bawaan.', 'basic_cause_summary', 'Belum ada checklist inspeksi incoming.',
  'causes', jsonb_build_object('unsafe_condition', jsonb_build_array(jsonb_build_object('text', 'Material, Alat Atau Mesin Yang Rusak', 'note', ''))),
  'recommendations', jsonb_build_array(jsonb_build_object('text', 'Tolak tabung tanpa tutup valve saat incoming'))));
select zz_test.check('C1c analisa fakta & uraian penyebab dasar tersimpan',
  (select facts like 'Tabung%' and basic_cause_summary like 'Belum%' from __APP__.incident_investigations where incident_id = :'inc'));
reset role;

select zz_test.login('karyawan@demo.lourdes.test');
set role authenticated;
select zz_test.check('C2a karyawan tidak membaca data pribadi / cedera korban', not exists (select 1 from __APP__.incident_restricted where incident_id = :'inc'));
reset role;
select zz_test.login('hr@demo.lourdes.test');
set role authenticated;
select zz_test.check('C2b HR membaca data pribadi korban (opsional, data terbatas)',
  exists (select 1 from __APP__.incident_restricted where incident_id = :'inc' and victim_address = 'Jl. Uji No. 1')
  or not exists (select 1 from __APP__.incidents where id = :'inc'));
reset role;
select zz_test.check('C3a fungsi bantu tertutup untuk client', not has_function_privilege('authenticated', '__APP__.k3_text_list(jsonb)', 'execute'));
