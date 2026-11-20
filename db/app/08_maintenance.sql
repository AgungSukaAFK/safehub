-- =====================================================================================
-- 08 MAINTENANCE PER APP · backend-guide §12. Dipanggil public.run_maintenance_all() 03:00 WIB.
-- Batas hari = konstanta di sini; app dengan kewajiban arsip lebih panjang menaikkannya di
-- migration-nya sendiri.
-- =====================================================================================

create table __APP__.maintenance_runs (
  id      bigint generated always as identity primary key,
  ran_at  timestamptz not null default now(),
  result  jsonb not null
);
comment on table __APP__.maintenance_runs is 'Hasil run_maintenance() harian app ini.';
alter table __APP__.maintenance_runs enable row level security;
revoke insert, update, delete on __APP__.maintenance_runs from authenticated;
create policy "maintenance_runs: admin read" on __APP__.maintenance_runs for select to authenticated
  using ((select public.has_app_role('__APP__', 'admin')));

create or replace function __APP__.run_maintenance()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_res     jsonb := '{}';
  n         integer;
  r         record;
  v_archive text;
  v_moved   integer := 0;
begin
  -- 1. Pengingat approval terlambat (maks. 1x per 24 jam per langkah, tanpa push)
  with due as (
    update __APP__.approvals a set reminded_at = now()
     where a.status = 'pending' and a.due_at < now()
       and (a.reminded_at is null or a.reminded_at < now() - interval '24 hours')
       and not exists (select 1 from __APP__.approvals b
                        where b.doc_type = a.doc_type and b.record_id = a.record_id and b.round = a.round
                          and b.step_no < a.step_no and b.status = 'pending')
    returning a.approver_id, a.doc_type, a.record_id)
  insert into __APP__.notifications (user_id, type, category, title, href, entity, record_id)
  select d.approver_id, 'approval.overdue', 'approval',
         format('Approval %s melewati batas waktu', t.label), t.href_prefix || d.record_id, d.doc_type, d.record_id::text
    from due d join __APP__.approval_doc_types t on t.code = d.doc_type;
  get diagnostics n = row_count; v_res := v_res || jsonb_build_object('reminders', n);

  -- 2. Retensi
  delete from __APP__.notifications
   where (read_at is not null and created_at < now() - interval '90 days')
      or (read_at is null and created_at < now() - interval '180 days');
  get diagnostics n = row_count; v_res := v_res || jsonb_build_object('notifications', n);

  delete from __APP__.push_subscriptions where last_used_at < now() - interval '90 days';
  get diagnostics n = row_count; v_res := v_res || jsonb_build_object('push_subscriptions', n);

  delete from __APP__.followups f using __APP__.approvals a
   where a.id = f.approval_id and a.status <> 'pending' and f.requested_at < now() - interval '180 days';
  get diagnostics n = row_count; v_res := v_res || jsonb_build_object('followups', n);

  -- lampiran pesan yang ikut terhapus masuk storage_cleanup_queue (trigger di 04_support)
  delete from __APP__.support_threads where status = 'selesai' and updated_at < now() - interval '1 year';
  get diagnostics n = row_count; v_res := v_res || jsonb_build_object('support_threads', n);

  -- 3. Arsip log > 5 tahun: pindah ke <tabel>_archive (dibuat otomatis), TIDAK dihapus
  for r in
    select c.relname from pg_class c
     where c.relnamespace = '__APP__'::regnamespace and c.relkind = 'r' and c.relname like '%\_logs'
  loop
    v_archive := r.relname || '_archive';
    if to_regclass(format('%I.%I', '__APP__', v_archive)) is null then
      execute format('create table %I.%I (like %I.%I including defaults including constraints)',
                     '__APP__', v_archive, '__APP__', r.relname);
      execute format('alter table %I.%I enable row level security', '__APP__', v_archive);
      execute format('revoke all on %I.%I from authenticated, anon', '__APP__', v_archive);
      execute format('comment on table %I.%I is %L', '__APP__', v_archive, 'Arsip log > 5 tahun (run_maintenance).');
    end if;
    execute format('with moved as (delete from %I.%I where at < now() - interval ''5 years'' returning *)
                    insert into %I.%I select * from moved', '__APP__', r.relname, '__APP__', v_archive);
    get diagnostics n = row_count;
    v_moved := v_moved + n;
  end loop;
  v_res := v_res || jsonb_build_object('logs_archived', v_moved);

  insert into __APP__.maintenance_runs (result) values (v_res);
  delete from __APP__.maintenance_runs where ran_at < now() - interval '1 year';
  return v_res;
end $$;
revoke execute on function __APP__.run_maintenance() from public, anon, authenticated;
