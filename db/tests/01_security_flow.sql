-- =====================================================================================
-- Uji keamanan & alur (backend-guide §14 + koreksi K1-K8). Dijalankan scripts/db-test.sh
-- di container sekali pakai. Setiap kegagalan = raise exception errcode T0001.
-- =====================================================================================
\set ON_ERROR_STOP on
set client_min_messages = notice;

-- ---------------------------------------------------------------- helper uji
create schema if not exists zz_test;
grant usage on schema zz_test to authenticated, anon;

create or replace function zz_test.login(p_email text) returns void language plpgsql as $$
declare v_claims text;
begin
  -- isi format baru (request.jwt.claims) DAN lama (request.jwt.claim.*): auth.uid() berbeda per versi image
  if p_email is null then
    perform set_config('request.jwt.claims', '{"role":"anon"}', false);
    perform set_config('request.jwt.claim.sub', '', false);
    perform set_config('request.jwt.claim.role', 'anon', false);
    return;
  end if;
  select json_build_object('sub', id, 'role', 'authenticated', 'email', email)::text into v_claims
    from auth.users where email = p_email;
  if v_claims is null then raise exception 'user uji % tidak ada', p_email using errcode = 'T0001'; end if;
  perform set_config('request.jwt.claims', v_claims, false);
  perform set_config('request.jwt.claim.sub', v_claims::jsonb ->> 'sub', false);
  perform set_config('request.jwt.claim.role', 'authenticated', false);
end $$;

create or replace function zz_test.expect_error(p_label text, p_sql text, p_state text, p_like text default null)
returns void language plpgsql as $$
declare v_state text; v_msg text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
    if v_state = 'T0001' or v_state <> p_state or (p_like is not null and v_msg not like p_like) then
      raise exception 'TEST GAGAL [%]: dapat % "%"', p_label, v_state, v_msg using errcode = 'T0001';
    end if;
    raise notice 'ok  %', p_label;
    return;
  end;
  raise exception 'TEST GAGAL [%]: tidak ada error', p_label using errcode = 'T0001';
end $$;

create or replace function zz_test.check(p_label text, p_ok boolean, p_detail text default null)
returns void language plpgsql as $$
begin
  if p_ok is distinct from true then
    raise exception 'TEST GAGAL [%] %', p_label, coalesce(p_detail, '') using errcode = 'T0001';
  end if;
  raise notice 'ok  %', p_label;
end $$;
grant execute on all functions in schema zz_test to authenticated, anon;

-- app lain untuk uji pemalsuan event CCTV
insert into public.apps (id, name) values ('app_x', 'App X (uji)') on conflict do nothing;

-- ================================================================ A. struktur & grant
select zz_test.check('A1 semua tabel app RLS aktif',
  not exists (select 1 from pg_class where relnamespace = '__APP__'::regnamespace and relkind = 'r' and not relrowsecurity),
  (select string_agg(relname, ', ') from pg_class where relnamespace = '__APP__'::regnamespace and relkind = 'r' and not relrowsecurity));

select zz_test.check('A2 fungsi internal tidak bisa di-execute authenticated',
  not exists (select 1 from pg_proc p where p.pronamespace = '__APP__'::regnamespace
               and p.proname in ('notify', 'write_log', 'log_changes', 'set_log_context', 'set_log_extra',
                                 'next_doc_number', 'run_maintenance', 'app_admin_ids', 'approval_ctx',
                                 'approval_type_of', 'approval_activate', 'approval_call_done',
                                 'pengajuan_approval_context', 'pengajuan_on_approval', 'pengajuan_guard',
                                 'support_href', 'members_guard')
               and has_function_privilege('authenticated', p.oid, 'execute')),
  (select string_agg(p.proname, ', ') from pg_proc p where p.pronamespace = '__APP__'::regnamespace
     and p.proname in ('notify', 'write_log', 'log_changes', 'set_log_context', 'next_doc_number', 'run_maintenance')
     and has_function_privilege('authenticated', p.oid, 'execute')));

select zz_test.check('A3 tabel tulis-RPC hanya SELECT (+UPDATE read_at)',
  not exists (select 1 from information_schema.role_table_grants
               where grantee = 'authenticated' and table_schema = '__APP__'
                 and table_name in ('approvals', 'notifications', 'followups', 'pengajuan_logs', 'doc_sequences',
                                    'approval_templates', 'approval_template_steps', 'support_messages', 'members_logs')
                 and privilege_type <> 'SELECT'),
  (select string_agg(table_name || ':' || privilege_type, ', ') from information_schema.role_table_grants
    where grantee = 'authenticated' and table_schema = '__APP__'
      and table_name in ('approvals', 'notifications', 'followups', 'pengajuan_logs', 'doc_sequences')
      and privilege_type <> 'SELECT'));

select zz_test.check('A4 anon tidak punya grant tabel app',
  not exists (select 1 from information_schema.role_table_grants where grantee = 'anon' and table_schema = '__APP__'));

select zz_test.check('A5 public.run_maintenance_all tidak bisa dipanggil user',
  not has_function_privilege('authenticated', 'public.run_maintenance_all()', 'execute'));

-- ================================================================ B. data uji
select zz_test.login('budi@demo.lourdes.test');
set role authenticated;
select __APP__.pengajuan_save(null, ('{"company_code":"GMI","title":"UJI Pompa hidrolik",
  "department_id":"' || (select department_id from public.profiles where email = 'budi@demo.lourdes.test') || '",
  "items":[{"item_name":"Pompa hidrolik","part_number":"PH-01","qty":2,"unit":"pcs","unit_price":1500000}]}')::jsonb) as pj_gmi \gset
reset role;

select zz_test.login('sari@demo.lourdes.test');
set role authenticated;
select __APP__.pengajuan_save(null, ('{"company_code":"GIS","title":"UJI Ban forklift",
  "department_id":"' || (select department_id from public.profiles where email = 'sari@demo.lourdes.test') || '",
  "items":[{"item_name":"Ban forklift","qty":4,"unit_price":800000}]}')::jsonb) as pj_gis \gset
-- user GIS tidak bisa membuat dokumen GMI
select zz_test.expect_error('B1 user GIS membuat dokumen GMI ditolak RLS',
  $q$select __APP__.pengajuan_save(null, '{"company_code":"GMI","title":"UJI salah company","items":[]}')$q$, '42501');
reset role;

select zz_test.check('B2 dokumen tersimpan dengan total & search_text',
  (select total_amount = 3000000 and status = 'draft' and code is null and search_text like '%ph-01%'
     from __APP__.pengajuan where id = :'pj_gmi'));

-- ================================================================ C. skenario wajib §14
-- C1 User GMI membaca dokumen GIS → 0 baris
select zz_test.login('budi@demo.lourdes.test');
set role authenticated;
select zz_test.check('C1 user GMI tidak melihat dokumen GIS',
  (select count(*) = 0 from __APP__.pengajuan where id = :'pj_gis')
  and (select count(*) = 1 from __APP__.pengajuan where id = :'pj_gmi'));

-- C2 ubah status lewat update langsung → ditolak guard
select zz_test.expect_error('C2 ubah status langsung ditolak guard',
  format('update __APP__.pengajuan set status = %L where id = %L', 'approved', :'pj_gmi'), 'P0001', '%hanya bisa diubah lewat proses approval%');
-- insert langsung dengan status/kode palsu dinormalkan guard
insert into __APP__.pengajuan (company_code, title, status, code) values ('GMI', 'UJI palsu', 'approved', 'PALSU/1');
select zz_test.check('C2b insert langsung status/kode palsu dinormalkan',
  (select status = 'draft' and code is null from __APP__.pengajuan where title = 'UJI palsu'));
delete from __APP__.pengajuan where title = 'UJI palsu';
reset role;

-- viewer (tanpa editor) tidak bisa mengubah apa pun (0 baris)
select zz_test.login('viewer@demo.lourdes.test');
set role authenticated;
update __APP__.pengajuan set title = 'UJI dibajak' where id = :'pj_gmi';
reset role;
select zz_test.check('C2c viewer tidak bisa update dokumen', (select title <> 'UJI dibajak' from __APP__.pengajuan where id = :'pj_gmi'));

-- ajukan
select zz_test.login('budi@demo.lourdes.test');
set role authenticated;
select __APP__.approval_start('pengajuan', :'pj_gmi') as start_res \gset
select zz_test.check('C3a ajukan → nomor dokumen dibuat DB',
  (select code ~ '^PJ/GMI/\d{4}/0001$' and status = 'pending_approval' from __APP__.pengajuan where id = :'pj_gmi'));
select zz_test.check('C3b notification_ids dikembalikan', jsonb_array_length((:'start_res'::jsonb) -> 'notification_ids') = 1);
select zz_test.expect_error('C3c ajukan dua kali ditolak',
  format('select __APP__.approval_start(%L, %L)', 'pengajuan', :'pj_gmi'), 'P0001', '%sedang dalam proses approval%');
-- dokumen terkunci saat diproses
select zz_test.expect_error('C3d dokumen pending tidak bisa diubah',
  format('select __APP__.pengajuan_save(%L, %L)', :'pj_gmi', '{"company_code":"GMI","title":"UJI ubah","items":[{"item_name":"x","qty":1}]}'),
  'P0001', '%tidak bisa diubah%');
reset role;

select id as step1 from __APP__.approvals where record_id = :'pj_gmi' and step_no = 1 \gset
select id as step2 from __APP__.approvals where record_id = :'pj_gmi' and step_no = 2 \gset

-- C4 approver langkah 2 menyetujui sebelum langkah 1
select zz_test.login('rina@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('C4 langkah 2 sebelum langkah 1',
  format('select __APP__.approval_decide(%L, %L)', :'step2', 'approved'), 'P0001', 'Masih menunggu approver sebelumnya.');
-- K1: antrian rina kosong (belum giliran), antrian andi berisi 1
select zz_test.check('K1a pending_for_me rina kosong saat belum giliran', (select count(*) = 0 from __APP__.pending_for_me(10)));
reset role;

select zz_test.login('andi@demo.lourdes.test');
set role authenticated;
select zz_test.check('K1b pending_for_me andi berisi dokumen (alias kolom benar)',
  (select count(*) = 1 and bool_and(followup_count = 0 and href = '/pengajuan/' || :'pj_gmi') from __APP__.pending_for_me(10)));
-- bukan giliran orang lain
reset role;

select zz_test.login('budi@demo.lourdes.test');
set role authenticated;
-- C6 follow-up 2x dalam 1 jam
select zz_test.check('C6a follow-up pertama terkirim',
  (select jsonb_array_length(__APP__.request_followup(:'step1') -> 'notification_ids') = 1));
select zz_test.expect_error('C6b follow-up kedua dalam 1 jam ditolak',
  format('select __APP__.request_followup(%L)', :'step1'), 'P0001', 'Follow-up ke % sudah dikirim % menit lalu.%');
-- C7 notify langsung
select zz_test.expect_error('C7 notify() langsung dari user ditolak',
  $q$select __APP__.notify(array[auth.uid()], 'x.y', 'palsu')$q$, '42501');
-- C10 event CCTV app lain
select zz_test.expect_error('C10 cctv_log untuk app tanpa akses',
  $q$select public.cctv_log('app_x', 'data', 'x.palsu', 'palsu')$q$, '42501');
reset role;

select zz_test.login('andi@demo.lourdes.test');
set role authenticated;
-- C5 tolak tanpa alasan
select zz_test.expect_error('C5 tolak tanpa alasan',
  format('select __APP__.approval_decide(%L, %L, %L)', :'step1', 'rejected', 'x'), 'P0001', 'Alasan penolakan wajib diisi%');
select zz_test.check('K1c follow-up terhitung di antrian', (select followup_count = 1 from __APP__.pending_for_me(10)));
-- setujui langkah 1
select __APP__.approval_decide(:'step1', 'approved', 'Sudah dicek') as d1 \gset
-- C4b klik ganda
select zz_test.expect_error('C4b klik ganda: keputusan kedua ditolak',
  format('select __APP__.approval_decide(%L, %L)', :'step1', 'approved'), 'P0001', 'Approval ini sudah diproses.%');
-- C8 push_targets notifikasi orang lain (notifikasi yang dibuat budi) → 0 baris
select zz_test.check('C8 push_targets hanya notifikasi buatan sendiri',
  (select count(*) = 0 from __APP__.push_targets(array(select id from __APP__.notifications))));
reset role;

select zz_test.login('rina@demo.lourdes.test');
set role authenticated;
select __APP__.approval_decide(:'step2', 'approved') as d2 \gset
reset role;
select zz_test.check('C11a dokumen disetujui setelah langkah terakhir',
  (select status = 'approved' from __APP__.pengajuan where id = :'pj_gmi'));
select zz_test.check('C11b riwayat lengkap (create, submit, approve x2, followup)',
  (select array_agg(action order by id) = array['create', 'submit', 'followup', 'approve', 'approve']
     from __APP__.pengajuan_logs where record_id = :'pj_gmi'),
  (select array_agg(action order by id)::text from __APP__.pengajuan_logs where record_id = :'pj_gmi'));
select zz_test.check('C11c CCTV mencatat aksi approval dengan url',
  (select count(*) >= 4 and bool_and(url like 'https://__HOST__.lourdes.cloud/pengajuan/%')
     from public.cctv_events where record_id = :'pj_gmi' and category = 'approval'));
select zz_test.check('C11d pemohon dapat notifikasi disetujui',
  exists (select 1 from __APP__.notifications n join public.profiles p on p.id = n.user_id
           where p.email = 'budi@demo.lourdes.test' and n.type = 'approval.approved'));

-- K3 dokumen approved tidak bisa diajukan lagi
select zz_test.login('budi@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('K3 dokumen approved tidak bisa diajukan ulang',
  format('select __APP__.approval_start(%L, %L)', 'pengajuan', :'pj_gmi'), 'P0001', '%tidak bisa diajukan%');
reset role;

-- C9 CCTV append-only (bahkan untuk owner)
select zz_test.expect_error('C9a update cctv_events ditolak', 'update public.cctv_events set summary = ''x''', '42501');
select zz_test.expect_error('C9b delete cctv_events ditolak', 'delete from public.cctv_events', '42501');

-- K2 batas ukuran CCTV berlaku walau kolom lain null
select zz_test.expect_error('K2 metadata CCTV raksasa ditolak',
  $q$select public.cctv_log('__APP__', 'data', 'x.besar', 'besar', 'info', null, null, null, null, null, null,
       jsonb_build_object('isi', (select string_agg(md5(i::text), '') from generate_series(1, 2000) i)))$q$, '23514');

-- ================================================================ D. tolak → ajukan ulang (round 2), tarik, override
select zz_test.login('sari@demo.lourdes.test');
set role authenticated;
select __APP__.approval_start('pengajuan', :'pj_gis') \gset
reset role;
select id as gis1 from __APP__.approvals where record_id = :'pj_gis' and round = 1 and step_no = 1 \gset
select zz_test.login('dewi@demo.lourdes.test');
set role authenticated;
select __APP__.approval_decide(:'gis1', 'rejected', 'Harga terlalu tinggi, minta pembanding') \gset
reset role;
select zz_test.check('D1 ditolak → status rejected, sisa langkah skipped',
  (select status = 'rejected' from __APP__.pengajuan where id = :'pj_gis')
  and (select bool_and(status in ('rejected', 'skipped')) from __APP__.approvals where record_id = :'pj_gis'));

select zz_test.login('sari@demo.lourdes.test');
set role authenticated;
select __APP__.pengajuan_save(:'pj_gis', ('{"company_code":"GIS","title":"UJI Ban forklift (revisi)",
  "department_id":"' || (select department_id from public.profiles where email = 'sari@demo.lourdes.test') || '",
  "items":[{"item_name":"Ban forklift","qty":4,"unit_price":700000},{"item_name":"Velg","qty":2,"unit_price":300000}]}')::jsonb) \gset
select zz_test.check('D2 ubah dokumen ditolak = satu baris log update berisi ringkasan item',
  (select count(*) = 1 and bool_and(changes ? 'items' and changes ? 'title' and changes ? 'total_amount' and not changes ? 'department_id'
                                    and changes -> 'items' -> 'old' ->> 0 like '%× Rp 800.000)')
     from __APP__.pengajuan_logs where record_id = :'pj_gis' and action = 'update'));
select __APP__.approval_start('pengajuan', :'pj_gis') \gset
select zz_test.check('D3 ajukan ulang = round 2, nomor tetap',
  (select max(round) = 2 from __APP__.approvals where record_id = :'pj_gis')
  and (select code like 'PJ/GIS/%/0001' from __APP__.pengajuan where id = :'pj_gis'));
-- tarik pengajuan
select __APP__.approval_cancel('pengajuan', :'pj_gis', 'Salah lampiran') \gset
select zz_test.check('D4 tarik pengajuan → draft, langkah skipped',
  (select status = 'draft' from __APP__.pengajuan where id = :'pj_gis')
  and not exists (select 1 from __APP__.approvals where record_id = :'pj_gis' and status = 'pending'));
select __APP__.approval_start('pengajuan', :'pj_gis') \gset
reset role;

select id as gis_r3s1 from __APP__.approvals where record_id = :'pj_gis' and round = 3 and step_no = 1 \gset
-- override: viewer tidak boleh; admin boleh skip langkah 1 → giliran rina
select zz_test.login('dewi@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('D5 non-admin tidak bisa override',
  format('select __APP__.approval_override(%L, %L, null, %L)', :'gis_r3s1', 'skip', 'alasan panjang'), 'P0001', 'Hanya admin%');
reset role;
select zz_test.login('admin@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('D6 override tanpa alasan ditolak',
  format('select __APP__.approval_override(%L, %L)', :'gis_r3s1', 'skip'), 'P0001', 'Alasan wajib diisi%');
select __APP__.approval_override(:'gis_r3s1', 'skip', null, 'Kadep sedang cuti panjang') \gset
reset role;
select zz_test.check('D7 override skip → langkah berikutnya aktif + CCTV warning',
  exists (select 1 from __APP__.approvals a join public.profiles p on p.id = a.approver_id
           where a.record_id = :'pj_gis' and a.round = 3 and a.step_no = 2 and a.status = 'pending'
             and p.email = 'rina@demo.lourdes.test')
  and exists (select 1 from public.cctv_events where record_id = :'pj_gis' and action = 'pengajuan.override' and severity = 'warning'));

-- ================================================================ E. hapus dokumen → log tetap ada
select zz_test.login('budi@demo.lourdes.test');
set role authenticated;
select __APP__.pengajuan_save(null, '{"company_code":"GMI","title":"UJI akan dihapus","items":[]}') as pj_del \gset
delete from __APP__.pengajuan where id = :'pj_del';
reset role;
select zz_test.check('E1 hapus dokumen: log tetap ada + CCTV warning',
  exists (select 1 from __APP__.pengajuan_logs where record_id = :'pj_del' and action = 'delete')
  and exists (select 1 from public.cctv_events where record_id = :'pj_del' and action = 'pengajuan.delete' and severity = 'warning'));
-- dokumen approved tidak bisa dihapus pemilik
select zz_test.login('budi@demo.lourdes.test');
set role authenticated;
delete from __APP__.pengajuan where id = :'pj_gmi';
reset role;
select zz_test.check('E2 pemilik tidak bisa menghapus dokumen yang sudah diproses',
  exists (select 1 from __APP__.pengajuan where id = :'pj_gmi'));

-- ================================================================ F. modul pendukung
-- Bantuan
select zz_test.login('viewer@demo.lourdes.test');
set role authenticated;
select (__APP__.support_open('akses', 'UJI Tidak bisa membuka menu', 'Menu pengguna kosong',
  '{"halaman":"/pengguna"}') ->> 'thread_id') as thread \gset
reset role;
select zz_test.check('F1 support_open → notifikasi ke admin app',
  exists (select 1 from __APP__.notifications n join public.profiles p on p.id = n.user_id
           where p.email = 'admin@demo.lourdes.test' and n.type = 'support.new'));
select zz_test.login('budi@demo.lourdes.test');
set role authenticated;
select zz_test.check('F2 user lain tidak melihat thread', (select count(*) = 0 from __APP__.support_threads where id = :'thread'));
select zz_test.expect_error('F3 user lain tidak bisa membalas',
  format('select __APP__.support_send(%L, %L)', :'thread', 'halo'), 'P0001', 'Percakapan tidak ditemukan.');
reset role;
select zz_test.login('admin@demo.lourdes.test');
set role authenticated;
select __APP__.support_send(:'thread', 'Akses sudah kami perbaiki, silakan coba lagi.') \gset
reset role;
select zz_test.check('F4 balasan admin → status dibalas, ditugaskan ke admin',
  (select status = 'dibalas' and assigned_to is not null from __APP__.support_threads where id = :'thread'));

-- Feedback (K7)
select zz_test.login('viewer@demo.lourdes.test');
set role authenticated;
select (__APP__.feedback_submit('bug', null, '{"type":"doc"}', 'UJI tombol simpan tidak merespon') ->> 'id') as fb \gset
reset role;
select zz_test.login('admin@demo.lourdes.test');
set role authenticated;
select __APP__.feedback_set_status(:'fb', 'diproses', 'CATATAN INTERNAL rahasia') \gset
reset role;
select zz_test.login('viewer@demo.lourdes.test');
set role authenticated;
select zz_test.check('K7a pelapor tidak bisa membaca tabel feedback (catatan admin)',
  (select count(*) = 0 from __APP__.feedback));
select zz_test.check('K7b pelapor melihat feedback lewat feedback_mine tanpa admin_note',
  (select count(*) = 1 and bool_and(status = 'diproses') from __APP__.feedback_mine)
  and not exists (select 1 from information_schema.columns where table_schema = '__APP__'
                   and table_name = 'feedback_mine' and column_name = 'admin_note'));
reset role;
select zz_test.login('budi@demo.lourdes.test');
set role authenticated;
select zz_test.check('K7c user lain tidak melihat feedback orang', (select count(*) = 0 from __APP__.feedback_mine));
reset role;

-- Update Web: versi harus naik
select zz_test.login('admin@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('F5 versi Pembaruan harus naik',
  $q$insert into __APP__.updates (version_major, version_minor, version_patch, title) values (0, 0, 9, 'UJI turun')$q$,
  'P0001', 'Versi harus lebih besar%');
insert into __APP__.updates (version_major, version_minor, version_patch, title) values (0, 2, 0, 'UJI naik');
reset role;
select zz_test.login('viewer@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('F6 viewer tidak bisa membuat post Pembaruan',
  $q$insert into __APP__.updates (version_major, version_minor, version_patch, title) values (9, 0, 0, 'UJI')$q$, '42501');
insert into __APP__.update_reactions (update_id, emoji) select max(id), '🎉' from __APP__.updates;
reset role;

-- members guard
select zz_test.login('viewer@demo.lourdes.test');
set role authenticated;
insert into __APP__.members (user_id, team, preferences) values (auth.uid(), 'Tim palsu', '{"a":1}');
select zz_test.check('F7 user biasa tidak bisa mengisi kolom admin members',
  (select team is null from __APP__.members where user_id = auth.uid()));
reset role;

-- Storage
select zz_test.login('viewer@demo.lourdes.test');
set role authenticated;
select zz_test.expect_error('F8 viewer tidak bisa unggah lampiran dokumen',
  format('insert into storage.objects (bucket_id, name, owner_id) values (%L, %L, auth.uid()::text)',
         '__HOST__-lampiran', :'pj_gmi' || '/surat.pdf'), '42501');
insert into storage.objects (bucket_id, name, owner_id)
values ('__HOST__-lampiran', 'support/' || :'thread' || '/screenshot.png', auth.uid()::text);
insert into storage.objects (bucket_id, name, owner_id)
values ('__HOST__-lampiran', 'support/new-' || auth.uid()::text || '/awal.png', auth.uid()::text);
select zz_test.check('F9b K9 pemilik bisa membaca lampiran pesan pertama (support/new-<uid>/)',
  (select count(*) = 1 from storage.objects where name like 'support/new-%'));
reset role;
select zz_test.login('budi@demo.lourdes.test');
set role authenticated;
select zz_test.check('F9 user lain tidak bisa membaca lampiran bantuan orang',
  (select count(*) = 0 from storage.objects where name like 'support/%'));
reset role;
select zz_test.login('admin@demo.lourdes.test');
set role authenticated;
select zz_test.check('F9c K9 admin app bisa membaca lampiran pesan pertama',
  (select count(*) = 1 from storage.objects where name like 'support/new-%'));
reset role;

-- ================================================================ G. pencarian, dashboard, verifikasi, maintenance
select zz_test.login('sari@demo.lourdes.test');
set role authenticated;
select zz_test.check('G1 global_search ikut scope company (GIS tidak menemukan dokumen GMI)',
  (select count(*) = 0 from __APP__.global_search('pompa'))
  and (select count(*) >= 1 from __APP__.global_search('forklift')));
select zz_test.check('G2 dashboard_summary jalan',
  (select (__APP__.dashboard_summary(current_date - 30, current_date) ->> 'total')::integer >= 1));
select zz_test.check('G2b dashboard_by_department = total dashboard_summary (scope sama)',
  (select coalesce(sum(total), 0) from __APP__.dashboard_by_department(current_date - 30, current_date))
  = (select (__APP__.dashboard_summary(current_date - 30, current_date) ->> 'total')::integer));
reset role;

select verify_token as vt from __APP__.pengajuan where id = :'pj_gmi' \gset
select zz_test.login(null);
set role anon;
select zz_test.check('G3 verifikasi publik (anon): token benar → data minimal',
  (select v ->> 'status' = 'approved' and v ? 'kode' and not (v ? 'items') and jsonb_array_length(v -> 'disetujui') = 2
     from (select __APP__.verify_document(:'vt') as v) x));
select zz_test.check('G4 verifikasi publik: token salah → null',
  __APP__.verify_document(gen_random_uuid()) is null);
select zz_test.expect_error('G5 anon tidak bisa membaca tabel', 'select * from __APP__.pengajuan', '42501');
reset role;

update __APP__.approvals set due_at = now() - interval '1 hour' where record_id = :'pj_gis' and status = 'pending';
select zz_test.check('G6 run_maintenance mengirim pengingat terlambat',
  (select (public.run_maintenance_all() -> '__APP__' ->> 'reminders')::integer = 1));
select zz_test.check('G7 pengingat tidak dobel dalam 24 jam',
  (select (__APP__.run_maintenance() ->> 'reminders')::integer = 0));

-- ================================================================ H. template builder
select zz_test.login('admin@demo.lourdes.test');
set role authenticated;
select __APP__.approval_template_save(jsonb_build_object(
  'doc_type', 'pengajuan', 'name', 'UJI Template besar', 'min_amount', 10000000, 'priority', 10,
  'steps', jsonb_build_array(
    jsonb_build_object('approval_type', 'mengetahui', 'approver_kind', 'department_head'),
    jsonb_build_object('approval_type', 'menyetujui', 'approver_kind', 'user',
      'approver_id', (select id from public.profiles where email = 'rina@demo.lourdes.test'), 'due_hours', 24)))) as tpl \gset
select zz_test.expect_error('H1 approver tanpa akses app ditolak',
  format('select __APP__.approval_template_save(%L)', jsonb_build_object('doc_type', 'pengajuan', 'name', 'UJI', 'steps',
    jsonb_build_array(jsonb_build_object('approval_type', 'menyetujui', 'approver_kind', 'user',
      'approver_id', (select id from public.profiles where email = 'noaccess@demo.lourdes.test'))))),
  'P0001', '%belum punya akses%');
reset role;
select zz_test.check('H2 perubahan template tercatat CCTV config',
  exists (select 1 from public.cctv_events where category = 'config' and record_id = :'tpl'));

\echo 'Uji keamanan & alur selesai.'
