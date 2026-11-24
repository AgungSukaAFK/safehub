-- =====================================================================================
-- 14 PENGATURAN PENGINGAT (Safe Hub, fase 3)
--   rancangan-implementasi §2.11, §4.12 · spesifikasi docs/spec/fase-3-tsp-laporan.md bagian 2
--
-- Aturan pengingat dikelola admin; eksekusi harian di run_maintenance() (03:00 WIB) → run_reminders().
-- Idempoten lewat reminder_sent (aturan, record, offset, jatuh tempo). Kanal: in-app (notifications); push tidak
-- dikirim dari DB (run_maintenance tidak punya akses server app), tab terbuka tetap menerima via realtime.
-- Jenis yang tersedia sekarang = sumber datanya sudah ada; jenis fase 4-5 (MCU, sertifikat, izin, dokumen)
-- ditambahkan bersama modulnya (ubah check constraint kind).
-- =====================================================================================

create table __APP__.reminder_rules (
  id               uuid primary key default gen_random_uuid(),
  kind             text not null unique check (kind in ('pica_due', 'inspection_due', 'tsp_evaluation')),
  name             text not null check (length(btrim(name)) between 3 and 80),
  -- pica_due / inspection_due: hari SEBELUM jatuh tempo (0 = hari H). tsp_evaluation: hari SETELAH akhir bulan.
  offsets          integer[] not null check (cardinality(offsets) between 1 and 8 and 0 <= all (offsets) and 60 >= all (offsets)),
  notify_assignee  boolean not null default true,       -- PIC / pemeriksa
  notify_functions text[] not null default '{}',        -- fungsi K3 tambahan (mis. hse)
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on table __APP__.reminder_rules is 'Aturan pengingat (rancangan §4.12). Satu baris per jenis; admin mengubah lewat reminder_rule_save.';

create table __APP__.reminder_rules_logs (
  id         bigint generated always as identity primary key,
  record_id  uuid not null,
  at         timestamptz not null default now(),
  actor_id   uuid references public.profiles(id) on delete set null,
  action     text not null check (action ~ '^[a-z][a-z0-9_]{1,40}$'),
  changes    jsonb,
  note       text check (length(note) <= 2000)
);
create index reminder_rules_logs_record_idx on __APP__.reminder_rules_logs (record_id, at desc);

create table __APP__.reminder_sent (
  rule_id     uuid not null references __APP__.reminder_rules(id) on delete cascade,
  ref_id      uuid not null,
  offset_days integer not null,
  due_on      date not null,
  sent_at     timestamptz not null default now(),
  primary key (rule_id, ref_id, offset_days, due_on)
);
alter table __APP__.reminder_rules enable row level security;
alter table __APP__.reminder_rules_logs enable row level security;
alter table __APP__.reminder_sent enable row level security;
revoke insert, update, delete on __APP__.reminder_rules, __APP__.reminder_rules_logs, __APP__.reminder_sent from authenticated, anon;
revoke all on __APP__.reminder_sent from authenticated, anon;

create policy "reminder_rules: staff read" on __APP__.reminder_rules for select to authenticated using ((select __APP__.k3_staff()));
create policy "reminder_rules_logs: admin read" on __APP__.reminder_rules_logs for select to authenticated
  using ((select public.has_app_role('__APP__', 'admin')));

create trigger reminder_rules_set_updated_at before update on __APP__.reminder_rules
  for each row execute function public.set_updated_at();
create trigger reminder_rules_log after insert or update or delete on __APP__.reminder_rules
  for each row execute function __APP__.log_changes('config', '/pengingat#', 'Aturan pengingat');

-- Ubah aturan (admin). p: {offsets: [int], notify_assignee, notify_functions: [fn], is_active}
create or replace function __APP__.reminder_rule_save(p_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_offsets integer[]; v_fns text[];
begin
  if not public.has_app_role('__APP__', 'admin') then
    raise exception 'Hanya admin yang bisa mengubah aturan pengingat.' using errcode = '42501';
  end if;
  if jsonb_typeof(p -> 'offsets') <> 'array' or jsonb_array_length(p -> 'offsets') not between 1 and 8 then
    raise exception 'Isi 1 sampai 8 angka hari.' using errcode = 'P0001';
  end if;
  select array_agg(distinct x::integer order by x::integer) into v_offsets from jsonb_array_elements_text(p -> 'offsets') x;
  if exists (select 1 from unnest(v_offsets) o where o < 0 or o > 60) then
    raise exception 'Angka hari harus antara 0 dan 60.' using errcode = 'P0001';
  end if;
  select coalesce(array_agg(distinct x), '{}') into v_fns from jsonb_array_elements_text(coalesce(p -> 'notify_functions', '[]')) x;
  if exists (select 1 from unnest(v_fns) f where f not in ('hse', 'hse_senior', 'manajemen', 'pjo', 'pja', 'pengawas', 'hr',
                                                           'maintenance', 'scm', 'kontraktor_admin', 'auditor', 'karyawan')) then
    raise exception 'Fungsi penerima tidak dikenal.' using errcode = 'P0001';
  end if;
  if not coalesce((p ->> 'notify_assignee')::boolean, true) and cardinality(v_fns) = 0 then
    raise exception 'Pilih minimal satu penerima.' using errcode = 'P0001';
  end if;
  update __APP__.reminder_rules
     set offsets = v_offsets, notify_assignee = coalesce((p ->> 'notify_assignee')::boolean, true),
         notify_functions = v_fns, is_active = coalesce((p ->> 'is_active')::boolean, true)
   where id = p_id;
  if not found then raise exception 'Aturan tidak ditemukan.' using errcode = 'P0001'; end if;
  return jsonb_build_object('id', p_id);
end $$;
revoke execute on function __APP__.reminder_rule_save(uuid, jsonb) from public, anon;

-- Eksekusi harian. Mengirim hanya yang belum pernah dikirim (reminder_sent). Mengembalikan jumlah per jenis.
create or replace function __APP__.run_reminders(p_today date default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_today  date := coalesce(p_today, __APP__.today_wib());
  rule     __APP__.reminder_rules;
  o        integer;
  r        record;
  v_to     uuid[];
  v_n      integer;
  v_count  integer;
  v_res    jsonb := '{}';
  v_when   text;
  v_prev   date;
  v_end    date;
begin
  for rule in select * from __APP__.reminder_rules where is_active loop
    v_count := 0;
    foreach o in array rule.offsets loop
      if rule.kind = 'pica_due' then
        for r in select a.id, a.code, a.title, a.pic_id, a.company_code, a.location_id, a.due_date, __APP__.k3_action_href(a) as href
                   from __APP__.pica_actions a
                  where a.status in ('open', 'in_progress') and a.due_date = v_today + o loop
          insert into __APP__.reminder_sent (rule_id, ref_id, offset_days, due_on) values (rule.id, r.id, o, r.due_date)
            on conflict do nothing;
          get diagnostics v_n = row_count;
          if v_n = 0 then continue; end if;
          v_to := (case when rule.notify_assignee then array[r.pic_id] else '{}'::uuid[] end)
                  || __APP__.users_with_function(rule.notify_functions, r.company_code, r.location_id);
          v_when := case o when 0 then 'jatuh tempo hari ini' when 1 then 'jatuh tempo besok' else format('jatuh tempo %s hari lagi', o) end;
          perform __APP__.notify(v_to, 'reminder.pica_due', format('Tindakan %s %s', r.code, v_when), left(r.title, 200), r.href, 'pica', 'pica_actions', r.id::text);
          v_count := v_count + 1;
        end loop;
      elsif rule.kind = 'inspection_due' then
        for r in select i.id, i.code, i.title, i.object_text, i.inspector_id, i.company_code, i.location_id,
                        (i.planned_at at time zone 'Asia/Jakarta')::date as due
                   from __APP__.inspections i
                  where i.status = 'scheduled' and (i.planned_at at time zone 'Asia/Jakarta')::date = v_today + o loop
          insert into __APP__.reminder_sent (rule_id, ref_id, offset_days, due_on) values (rule.id, r.id, o, r.due)
            on conflict do nothing;
          get diagnostics v_n = row_count;
          if v_n = 0 then continue; end if;
          v_to := (case when rule.notify_assignee then array[r.inspector_id] else '{}'::uuid[] end)
                  || __APP__.users_with_function(rule.notify_functions, r.company_code, r.location_id);
          v_when := case o when 0 then 'dijadwalkan hari ini' when 1 then 'dijadwalkan besok' else format('dijadwalkan %s hari lagi', o) end;
          perform __APP__.notify(v_to, 'reminder.inspection_due', format('Inspeksi %s %s', r.code, v_when),
            r.title || coalesce(' · ' || r.object_text, ''), '/inspeksi/' || r.id, 'inspeksi', 'inspections', r.id::text);
          v_count := v_count + 1;
        end loop;
      elsif rule.kind = 'tsp_evaluation' then
        -- o hari setelah akhir bulan lalu: evaluasi bulan lalu belum diajukan/disetujui per site yang punya program aktif
        v_end := date_trunc('month', v_today)::date - 1;
        if v_today - v_end = o then
          for r in select p.company_code, p.location_id, extract(year from v_end)::integer as yr, extract(month from v_end)::integer as mo
                     from __APP__.tsp_programs p
                    where p.is_active and p.year = extract(year from v_end)::integer
                      and not exists (select 1 from __APP__.tsp_evaluations e
                                       where e.company_code = p.company_code and e.location_id = p.location_id
                                         and e.year = p.year and e.month = extract(month from v_end)::integer
                                         and e.status in ('submitted', 'approved'))
                    group by p.company_code, p.location_id loop
            insert into __APP__.reminder_sent (rule_id, ref_id, offset_days, due_on)
              values (rule.id, md5(r.company_code || r.location_id::text || r.yr || '-' || r.mo)::uuid, o, v_end)
              on conflict do nothing;
            get diagnostics v_n = row_count;
            if v_n = 0 then continue; end if;
            v_to := __APP__.users_with_function(case when cardinality(rule.notify_functions) > 0 then rule.notify_functions else array['hse'] end,
                                                r.company_code, r.location_id);
            perform __APP__.notify(v_to, 'reminder.tsp_evaluation', format('Evaluasi TSP %s/%s belum diajukan', lpad(r.mo::text, 2, '0'), r.yr),
              'Susun dan ajukan evaluasi bulanan ke PJO.', '/tsp?tahun=' || r.yr || '&bulan=' || r.mo, 'tsp', 'tsp_evaluations', null);
            v_count := v_count + 1;
          end loop;
        end if;
      end if;
    end loop;
    v_res := v_res || jsonb_build_object(rule.kind, v_count);
  end loop;
  return v_res;
end $$;
revoke execute on function __APP__.run_reminders(date) from public, anon, authenticated;

-- Data awal: aturan bawaan (nilai dari prototipe; admin dapat mengubah)
insert into __APP__.reminder_rules (kind, name, offsets, notify_assignee, notify_functions) values
  ('pica_due', 'Tindakan PICA mendekati jatuh tempo', '{7,3,1,0}', true, '{}'),
  ('inspection_due', 'Inspeksi terjadwal', '{1,0}', true, '{}'),
  ('tsp_evaluation', 'Evaluasi TSP bulanan belum diajukan', '{3,7}', false, '{hse}')
on conflict (kind) do nothing;

-- run_maintenance (08) + langkah pengingat terjadwal
create or replace function __APP__.run_maintenance()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_res     jsonb := '{}';
  n         integer;
  r         record;
  v_archive text;
  v_moved   integer := 0;
begin
  -- 0. Pengingat terjadwal (aturan di reminder_rules, fase 3)
  v_res := v_res || jsonb_build_object('pengingat_k3', __APP__.run_reminders());

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
