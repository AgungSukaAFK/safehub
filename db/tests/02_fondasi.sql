-- =====================================================================================
-- Uji fondasi K3 (rancangan-implementasi §2.1, §2.2, §2.6, §2.11, §4.0). Memakai helper zz_test
-- dari 01_security_flow.sql (dijalankan lebih dulu di DB yang sama).
-- =====================================================================================
\set ON_ERROR_STOP on
set client_min_messages = notice;

-- ================================================================ F1. struktur
select zz_test.check('F1a guard master tidak bisa di-execute authenticated',
  not has_function_privilege('authenticated', '__APP__.master_items_guard()', 'execute'));
select zz_test.check('F1b next_doc_number tidak bisa di-execute authenticated',
  not has_function_privilege('authenticated', '__APP__.next_doc_number(text, text, text)', 'execute'));
select zz_test.check('F1c helper scope bisa di-execute authenticated',
  has_function_privilege('authenticated', '__APP__.my_functions()', 'execute')
  and has_function_privilege('authenticated', '__APP__.my_location_scope()', 'execute')
  and has_function_privilege('authenticated', '__APP__.my_tasks(integer)', 'execute')
  and not has_function_privilege('anon', '__APP__.my_tasks(integer)', 'execute'));
select zz_test.check('F1d tabel log fondasi hanya SELECT',
  not exists (select 1 from information_schema.role_table_grants
               where grantee = 'authenticated' and table_schema = '__APP__'
                 and table_name in ('areas_logs', 'master_items_logs', 'contractors_logs')
                 and privilege_type <> 'SELECT'));
select zz_test.check('F1e master/area/mitra tidak bisa DELETE (nonaktifkan saja)',
  not exists (select 1 from information_schema.role_table_grants
               where grantee = 'authenticated' and table_schema = '__APP__'
                 and table_name in ('areas', 'master_items', 'contractors') and privilege_type = 'DELETE'));

-- ================================================================ F2. penomoran (D3)
select __APP__.next_doc_number('ZZK', 'GMI', 'year') as n1 \gset
select __APP__.next_doc_number('ZZK', 'GMI', 'year') as n2 \gset
select __APP__.next_doc_number('ZZK', 'GIS', 'year') as n3 \gset
select __APP__.next_doc_number('ZZK', 'GMI') as n4 \gset
select zz_test.check('F2a format tahunan <PREFIX>-<YYYY>-<NNNN>',
  :'n1' = 'ZZK-' || to_char(now() at time zone 'Asia/Jakarta', 'YYYY') || '-0001'
  and :'n2' like 'ZZK-____-0002', :'n1' || ' / ' || :'n2');
select zz_test.check('F2b counter per company', :'n3' like 'ZZK-____-0001', :'n3');
select zz_test.check('F2c mode bulanan tetap format lama dan counter terpisah',
  :'n4' = 'ZZK/GMI/' || to_char(now() at time zone 'Asia/Jakarta', 'YYMM') || '/0001', :'n4');
select zz_test.expect_error('F2d mode reset tidak dikenal ditolak',
  $q$select __APP__.next_doc_number('ZZK', 'GMI', 'week')$q$, '22023');
delete from __APP__.doc_sequences where prefix = 'ZZK';

-- ================================================================ F3. fungsi K3 (D1)
select zz_test.login('hse.senior@demo.lourdes.test');
set role authenticated;
select zz_test.check('F3a fungsi user terbaca',
  __APP__.my_functions() @> array['hse', 'hse_senior'] and __APP__.has_function('hse_senior')
  and not __APP__.has_function('pjo') and __APP__.has_any_function(array['pjo', 'hse']));
-- user biasa tidak bisa memberi dirinya fungsi
select zz_test.expect_error('F3b user mengubah fungsi sendiri ditolak guard',
  $q$update __APP__.members set functions = array['pjo'] where user_id = auth.uid()$q$, 'P0001', '%hanya bisa diubah admin%');
select zz_test.expect_error('F3c user mengubah batas site sendiri ditolak guard',
  $q$update __APP__.members set location_ids = array[gen_random_uuid()] where user_id = auth.uid()$q$, 'P0001', '%hanya bisa diubah admin%');
reset role;

-- insert baris members oleh user non-admin: fungsi & batas site dikosongkan guard
select zz_test.login('viewer@demo.lourdes.test');
set role authenticated;
insert into __APP__.members (user_id, functions, location_ids)
values (auth.uid(), array['hse'], array[gen_random_uuid()])
on conflict (user_id) do nothing;
select zz_test.check('F3d insert sendiri: fungsi & site dinormalkan',
  (select functions = '{}' and location_ids is null from __APP__.members where user_id = auth.uid()));
select zz_test.check('F3e tanpa fungsi → my_functions kosong', __APP__.my_functions() = '{}');
reset role;

-- fungsi tidak dikenal ditolak constraint
select zz_test.login('admin@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('F3f fungsi tidak dikenal ditolak',
  format('update __APP__.members set functions = array[%L] where user_id = %L', 'superman',
         (select id from public.profiles where email = 'hse@demo.lourdes.test')), '23514');
-- admin boleh mengatur fungsi → log + CCTV
update __APP__.members set functions = array['hse', 'pengawas']
 where user_id = (select id from public.profiles where email = 'hse@demo.lourdes.test');
reset role;
select zz_test.check('F3g perubahan fungsi oleh admin tercatat log',
  exists (select 1 from __APP__.members_logs l join __APP__.members m on m.id = l.record_id
           join public.profiles p on p.id = m.user_id
          where p.email = 'hse@demo.lourdes.test' and l.changes ? 'functions'));
update __APP__.members set functions = array['hse']
 where user_id = (select id from public.profiles where email = 'hse@demo.lourdes.test');

-- user nonaktif / tanpa akses → tidak punya fungsi
update __APP__.members set functions = array['hse']
 where user_id = (select id from public.profiles where email = 'nonaktif@demo.lourdes.test');
select zz_test.login('nonaktif@demo.lourdes.test');
set role authenticated;
select zz_test.check('F3h akun nonaktif tidak punya fungsi', __APP__.my_functions() = '{}');
reset role;

-- ================================================================ F4. scope site (D2, D13)
select id as mifa from public.locations where name = 'Site MIFA' \gset
select id as kal from public.locations where name = 'Site Demo Kalimantan' \gset

select zz_test.login('karyawan@demo.lourdes.test');
set role authenticated;
select zz_test.check('F4a user dibatasi: scope = satu site',
  __APP__.my_location_scope() = array[:'mifa'::text]
  and __APP__.location_visible(:'mifa') and not __APP__.location_visible(:'kal'));
select zz_test.check('F4b my_sites hanya site dalam scope',
  (select array_agg(name) from __APP__.my_sites()) = array['Site MIFA']);
select zz_test.check('F4c area site lain tidak terbaca',
  (select count(*) from __APP__.areas where location_id = :'kal') = 0
  and (select count(*) from __APP__.areas where location_id = :'mifa') >= 4);
reset role;

select zz_test.login('hse@demo.lourdes.test');
set role authenticated;
select zz_test.check('F4d tanpa batas: semua site',
  __APP__.my_location_scope() = array['*'] and __APP__.location_visible(:'kal')
  and (select count(*) from __APP__.my_sites() where name in ('Site MIFA', 'Site Demo Kalimantan')) = 2);
reset role;

select zz_test.login(null);
select zz_test.check('F4e tamu: scope kosong', __APP__.my_location_scope() = '{}' and __APP__.my_functions() = '{}');

-- ================================================================ F5. master & mitra
select zz_test.login('hse@demo.lourdes.test');
set role authenticated;
select zz_test.check('F5a viewer membaca master', (select count(*) from __APP__.master_items where kind = 'risk_level') = 4);
select zz_test.expect_error('F5b non-admin menambah area ditolak RLS',
  format('insert into __APP__.areas (location_id, name) values (%L, %L)', :'mifa', 'UJI Area'), '42501');
update __APP__.master_items set name = 'UJI diubah' where code = 'low';
select zz_test.check('F5c non-admin mengubah master: 0 baris', (select name from __APP__.master_items where code = 'low') = 'Rendah');
select zz_test.expect_error('F5d non-admin menghapus master ditolak',
  $q$delete from __APP__.master_items where code = 'low'$q$, '42501');
reset role;

select zz_test.login('admin@demo.lourdes.test');
set role authenticated;
insert into __APP__.areas (location_id, name) values (:'mifa', 'UJI Area Admin') returning id as area_id \gset
select zz_test.expect_error('F5e nama area kembar di site sama ditolak',
  format('insert into __APP__.areas (location_id, name) values (%L, %L)', :'mifa', 'uji area admin '), '23505');
select zz_test.expect_error('F5f kode master tidak bisa diubah',
  $q$update __APP__.master_items set code = 'rendah' where code = 'low'$q$, 'P0001', '%tidak bisa diubah%');
update __APP__.master_items set name = 'Rendah (uji)' where code = 'low' and kind = 'risk_level';
select zz_test.expect_error('F5g admin pun tidak bisa menghapus area',
  format('delete from __APP__.areas where id = %L', :'area_id'), '42501');
reset role;
select zz_test.check('F5h perubahan master tercatat CCTV config',
  exists (select 1 from public.cctv_events where category = 'config' and entity = 'master_items'));
update __APP__.master_items set name = 'Rendah' where code = 'low' and kind = 'risk_level';
delete from __APP__.areas where id = :'area_id';

-- mitra: scope company
select zz_test.login('sari@demo.lourdes.test');
set role authenticated;
select zz_test.check('F5i user GIS tidak melihat mitra GMI', (select count(*) from __APP__.contractors where company_code = 'GMI') = 0);
reset role;
select zz_test.login('hse@demo.lourdes.test');
set role authenticated;
select zz_test.check('F5j user GMI melihat mitra GMI', (select count(*) from __APP__.contractors where company_code = 'GMI') >= 5);
reset role;

-- ================================================================ F6. Tugas Saya
-- andi (kepala departemen GMI) punya approval tertunda dari uji 01 → muncul di my_tasks
select zz_test.login('andi@demo.lourdes.test');
set role authenticated;
select zz_test.check('F6a my_tasks = antrian approval',
  (select count(*) from __APP__.my_tasks() where kind = 'approval')
  = (select count(*) from __APP__.pending_for_me(200)));
select zz_test.check('F6b baris approval lengkap (href, meta.approval_id)',
  not exists (select 1 from __APP__.my_tasks() where href is null or meta ->> 'approval_id' is null));
reset role;
select zz_test.login('karyawan@demo.lourdes.test');
set role authenticated;
select zz_test.check('F6c tugas orang lain tidak terlihat',
  not exists (select 1 from __APP__.my_tasks() where kind = 'approval')
  and not exists (select 1 from __APP__.my_tasks() t join __APP__.pica_actions a on a.id = t.ref_id
                   where t.ref_type = 'pica_actions' and a.pic_id <> auth.uid() and a.verifier_id <> auth.uid()));
reset role;

\echo 'Uji fondasi selesai.'
