-- =====================================================================================
-- Uji fase 3: Audit Trail. Setelah 01–06 di DB yang sama.
-- =====================================================================================
\set ON_ERROR_STOP on
set client_min_messages = notice;

select zz_test.check('P1a RPC audit_trail bisa dipanggil authenticated, tidak anon',
  has_function_privilege('authenticated', '__APP__.audit_trail(text[], uuid, text, timestamptz, timestamptz, timestamptz, integer)', 'execute')
  and not has_function_privilege('anon', '__APP__.audit_trail(text[], uuid, text, timestamptz, timestamptz, timestamptz, integer)', 'execute'));

select zz_test.login('hse@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('P2a HSE (bukan admin/auditor) ditolak', $q$select * from __APP__.audit_trail()$q$, '42501');
reset role;
select zz_test.login('karyawan@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('P2b karyawan ditolak', $q$select * from __APP__.audit_trail()$q$, '42501');
reset role;

select zz_test.login('admin@demo.lourdes.test');
set role authenticated;
select zz_test.check('P3a admin: gabungan beberapa entitas, terurut menurun',
  (select count(distinct entity) from __APP__.audit_trail(null, null, null, null, null, null, 200)) >= 4
  and (select bool_and(at <= lag_at) from (select at, lag(at) over (order by ord) as lag_at from
        (select at, row_number() over () as ord from __APP__.audit_trail(null, null, null, null, null, null, 100)) x) y where lag_at is not null));
select zz_test.check('P3b filter entitas hanya mengembalikan entitas itu',
  (select count(*) from __APP__.audit_trail(array['incidents'], null, null, null, null, null, 50)) > 0
  and not exists (select 1 from __APP__.audit_trail(array['incidents'], null, null, null, null, null, 50) where entity <> 'incidents'));
select zz_test.check('P3c filter aksi dan periode bekerja',
  not exists (select 1 from __APP__.audit_trail(null, null, 'create', null, null, null, 50) where action <> 'create')
  and (select count(*) from __APP__.audit_trail(null, null, null, now() + interval '1 day', null, null, 50)) = 0);
select zz_test.check('P3d limit: maksimum limit + 1 baris (penanda halaman berikutnya)',
  (select count(*) from __APP__.audit_trail(null, null, null, null, null, null, 5)) = 6);
reset role;
select zz_test.login('auditor@demo.lourdes.test');
set role authenticated;
select zz_test.check('P4a auditor boleh membaca audit trail', (select count(*) from __APP__.audit_trail(null, null, null, null, null, null, 10)) > 0);
reset role;
