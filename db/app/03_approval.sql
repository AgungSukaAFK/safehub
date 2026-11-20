-- =====================================================================================
-- 03 APPROVAL ENGINE GENERIK · backend-guide §6
-- Koreksi: K1 (alias pending_for_me), K3 (status dokumen dicek sebelum diajukan),
-- K6 (approval_cancel, approval_override, request_followup, template_save ditulis lengkap).
-- =====================================================================================

-- K3: status ikut di konteks supaya engine bisa menolak pengajuan dari status yang salah
create type __APP__.approval_context as (
  requester_id   uuid,
  company_code   text,
  department_id  uuid,
  amount         numeric,
  code           text,
  status         text
);

create table __APP__.approval_doc_types (
  code         text primary key check (code ~ '^[a-z][a-z0-9_]{1,40}$'),
  label        text not null,                 -- "Pengajuan"
  table_name   text not null,                 -- tabel dokumen di schema app (punya <table>_logs)
  href_prefix  text not null check (href_prefix ~ '^/.*/$'),   -- "/pengajuan/"
  context_fn   regprocedure not null,         -- fn(uuid) returns approval_context
  on_done_fn   regprocedure not null,         -- fn(uuid, text) returns void
  is_active    boolean not null default true
);
comment on table __APP__.approval_doc_types is 'Registry jenis dokumen yang memakai approval engine. Diisi migration, bukan dari app.';

create table __APP__.approval_templates (
  id             uuid primary key default gen_random_uuid(),
  doc_type       text not null references __APP__.approval_doc_types(code),
  name           text not null check (length(btrim(name)) between 1 and 120),
  description    text check (length(description) <= 500),
  company_code   text references public.companies(code),        -- null = semua company
  department_id  uuid references public.departments(id),        -- null = semua departemen
  min_amount     numeric(18,2),
  max_amount     numeric(18,2),
  priority       integer not null default 0,
  is_active      boolean not null default true,
  created_by     uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (min_amount is null or max_amount is null or min_amount <= max_amount)
);
comment on table __APP__.approval_templates is 'Aturan jalur approval. Ditulis lewat approval_template_save() (admin).';
create index approval_templates_doc_type_idx on __APP__.approval_templates (doc_type, is_active);
create index approval_templates_company_idx on __APP__.approval_templates (company_code);
create index approval_templates_department_idx on __APP__.approval_templates (department_id);
create index approval_templates_created_by_idx on __APP__.approval_templates (created_by);

create table __APP__.approval_template_steps (
  id             uuid primary key default gen_random_uuid(),
  template_id    uuid not null references __APP__.approval_templates(id) on delete cascade,
  step_no        integer not null check (step_no between 1 and 20),
  approval_type  text not null check (approval_type in ('mengetahui', 'memeriksa', 'menyetujui')),
  approver_kind  text not null check (approver_kind in ('user', 'department_head')),
  approver_id    uuid references public.profiles(id),
  due_hours      integer check (due_hours between 1 and 720),   -- batas waktu (SLA), opsional
  unique (template_id, step_no),
  check ((approver_kind = 'user') = (approver_id is not null))
);
comment on table __APP__.approval_template_steps is 'Langkah template approval (berurutan).';
create index approval_template_steps_approver_idx on __APP__.approval_template_steps (approver_id);

create table __APP__.department_heads (
  id             uuid not null default gen_random_uuid() unique,  -- untuk log_changes
  department_id  uuid not null references public.departments(id),
  company_code   text not null references public.companies(code),
  user_id        uuid not null references public.profiles(id),
  updated_at     timestamptz not null default now(),
  primary key (department_id, company_code)
);
comment on table __APP__.department_heads is 'Kepala departemen per company untuk approval (diatur admin app).';
create index department_heads_company_idx on __APP__.department_heads (company_code);
create index department_heads_user_idx on __APP__.department_heads (user_id);

create table __APP__.approvals (
  id             uuid primary key default gen_random_uuid(),
  doc_type       text not null references __APP__.approval_doc_types(code),
  record_id      uuid not null,
  round          integer not null default 1,
  step_no        integer not null,
  approval_type  text not null,
  approver_id    uuid not null references public.profiles(id),
  status         text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'skipped')),
  note           text check (length(note) <= 1000),
  decided_at     timestamptz,
  due_hours      integer,
  due_at         timestamptz,
  reminded_at    timestamptz,
  template_id    uuid references __APP__.approval_templates(id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (doc_type, record_id, round, step_no)
);
comment on table __APP__.approvals is 'Langkah approval nyata per dokumen per putaran. Hanya ditulis lewat RPC engine.';
create index approvals_record_idx   on __APP__.approvals (doc_type, record_id, round, step_no);
create index approvals_pending_idx  on __APP__.approvals (approver_id) where status = 'pending';
create index approvals_approver_idx on __APP__.approvals (approver_id, decided_at desc);
create index approvals_template_idx on __APP__.approvals (template_id);
create index approvals_due_idx      on __APP__.approvals (due_at) where status = 'pending' and due_at is not null;

create table __APP__.followups (
  id            uuid primary key default gen_random_uuid(),
  approval_id   uuid not null references __APP__.approvals(id) on delete cascade,
  requested_by  uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  requested_at  timestamptz not null default now()
);
comment on table __APP__.followups is 'Permintaan follow-up ke approver yang sedang giliran (jeda 1 jam).';
create index followups_approval_idx on __APP__.followups (approval_id, requested_at desc);
create index followups_requested_by_idx on __APP__.followups (requested_by);

-- Log konfigurasi (CCTV kategori config)
create table __APP__.approval_templates_logs (
  id         bigint generated always as identity primary key,
  record_id  uuid not null,
  at         timestamptz not null default now(),
  actor_id   uuid references public.profiles(id) on delete set null,
  action     text not null check (action ~ '^[a-z][a-z0-9_]{1,40}$'),
  changes    jsonb,
  note       text check (length(note) <= 2000)
);
comment on table __APP__.approval_templates_logs is 'Riwayat perubahan template approval.';
create index approval_templates_logs_record_idx on __APP__.approval_templates_logs (record_id, at desc);
create index approval_templates_logs_actor_idx on __APP__.approval_templates_logs (actor_id);

create table __APP__.department_heads_logs (
  id         bigint generated always as identity primary key,
  record_id  uuid not null,
  at         timestamptz not null default now(),
  actor_id   uuid references public.profiles(id) on delete set null,
  action     text not null check (action ~ '^[a-z][a-z0-9_]{1,40}$'),
  changes    jsonb,
  note       text check (length(note) <= 2000)
);
comment on table __APP__.department_heads_logs is 'Riwayat perubahan kepala departemen.';
create index department_heads_logs_record_idx on __APP__.department_heads_logs (record_id, at desc);
create index department_heads_logs_actor_idx on __APP__.department_heads_logs (actor_id);

create trigger approval_templates_set_updated_at before update on __APP__.approval_templates
  for each row execute function public.set_updated_at();
create trigger approval_templates_log after insert or update or delete on __APP__.approval_templates
  for each row execute function __APP__.log_changes('config', '/approval/template/', 'Template approval');
create trigger department_heads_set_updated_at before update on __APP__.department_heads
  for each row execute function public.set_updated_at();
create trigger department_heads_log after insert or update or delete on __APP__.department_heads
  for each row execute function __APP__.log_changes('config', null, 'Kepala departemen');

-- ---------------------------------------------------------------- RLS
alter table __APP__.approval_doc_types enable row level security;
alter table __APP__.approval_templates enable row level security;
alter table __APP__.approval_template_steps enable row level security;
alter table __APP__.department_heads enable row level security;
alter table __APP__.approvals enable row level security;
alter table __APP__.followups enable row level security;
alter table __APP__.approval_templates_logs enable row level security;
alter table __APP__.department_heads_logs enable row level security;

revoke insert, update, delete on __APP__.approval_doc_types, __APP__.approval_templates,
  __APP__.approval_template_steps, __APP__.approvals, __APP__.followups,
  __APP__.approval_templates_logs, __APP__.department_heads_logs from authenticated;

create policy "approval_doc_types: viewer read" on __APP__.approval_doc_types for select to authenticated
  using ((select public.has_app_role('__APP__', 'viewer')));
create policy "approval_templates: viewer read" on __APP__.approval_templates for select to authenticated
  using ((select public.has_app_role('__APP__', 'viewer')));
create policy "approval_template_steps: viewer read" on __APP__.approval_template_steps for select to authenticated
  using ((select public.has_app_role('__APP__', 'viewer')));
create policy "approvals: viewer read" on __APP__.approvals for select to authenticated
  using ((select public.has_app_role('__APP__', 'viewer')));
create policy "followups: viewer read" on __APP__.followups for select to authenticated
  using ((select public.has_app_role('__APP__', 'viewer')));
create policy "approval_templates_logs: admin read" on __APP__.approval_templates_logs for select to authenticated
  using ((select public.has_app_role('__APP__', 'admin')));
create policy "department_heads_logs: admin read" on __APP__.department_heads_logs for select to authenticated
  using ((select public.has_app_role('__APP__', 'admin')));

create policy "department_heads: viewer read" on __APP__.department_heads for select to authenticated
  using ((select public.has_app_role('__APP__', 'viewer')));
create policy "department_heads: admin insert" on __APP__.department_heads for insert to authenticated
  with check ((select public.has_app_role('__APP__', 'admin')));
create policy "department_heads: admin update" on __APP__.department_heads for update to authenticated
  using ((select public.has_app_role('__APP__', 'admin'))) with check ((select public.has_app_role('__APP__', 'admin')));
create policy "department_heads: admin delete" on __APP__.department_heads for delete to authenticated
  using ((select public.has_app_role('__APP__', 'admin')));

-- ---------------------------------------------------------------- helper internal
create or replace function __APP__.approval_type_of(p_doc_type text)
returns __APP__.approval_doc_types language plpgsql stable security definer set search_path = '' as $$
declare v __APP__.approval_doc_types;
begin
  select * into v from __APP__.approval_doc_types where code = p_doc_type;
  if not found then raise exception 'Jenis dokumen tidak dikenal.' using errcode = 'P0001'; end if;
  return v;
end $$;
revoke execute on function __APP__.approval_type_of(text) from public, anon, authenticated;

create or replace function __APP__.approval_ctx(p_type __APP__.approval_doc_types, p_record_id uuid)
returns __APP__.approval_context language plpgsql stable security definer set search_path = '' as $$
declare v __APP__.approval_context;
begin
  execute format('select * from %s($1)', p_type.context_fn::regproc) into v using p_record_id;
  if v.requester_id is null then raise exception 'Dokumen tidak ditemukan.' using errcode = 'P0001'; end if;
  return v;
end $$;
revoke execute on function __APP__.approval_ctx(__APP__.approval_doc_types, uuid) from public, anon, authenticated;

create or replace function __APP__.approval_call_done(p_type __APP__.approval_doc_types, p_record_id uuid, p_outcome text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  execute format('select %s($1, $2)', p_type.on_done_fn::regproc) using p_record_id, p_outcome;
end $$;
revoke execute on function __APP__.approval_call_done(__APP__.approval_doc_types, uuid, text) from public, anon, authenticated;

-- Aktifkan langkah berikutnya (set due_at + notifikasi). Mengembalikan id notifikasi.
create or replace function __APP__.approval_activate(p_type __APP__.approval_doc_types, p_ctx __APP__.approval_context,
  p_step __APP__.approvals)
returns uuid[] language plpgsql security definer set search_path = '' as $$
begin
  update __APP__.approvals set due_at = now() + make_interval(hours => due_hours)
   where id = p_step.id and due_hours is not null;
  return array(select * from __APP__.notify(
    array[p_step.approver_id], 'approval.request',
    format('Menunggu persetujuan Anda: %s %s', p_type.label, coalesce(p_ctx.code, '')), null,
    p_type.href_prefix || p_step.record_id, 'approval', p_step.doc_type, p_step.record_id::text));
end $$;
revoke execute on function __APP__.approval_activate(__APP__.approval_doc_types, __APP__.approval_context, __APP__.approvals)
  from public, anon, authenticated;

-- ---------------------------------------------------------------- approval_start
create or replace function __APP__.approval_start(p_doc_type text, p_record_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid    uuid := (select auth.uid());
  v_type   __APP__.approval_doc_types;
  v_ctx    __APP__.approval_context;
  v_tpl    uuid;
  v_round  integer;
  v_first  __APP__.approvals;
  v_notif  uuid[] := '{}';
begin
  select * into v_type from __APP__.approval_doc_types where code = p_doc_type and is_active;
  if not found then raise exception 'Jenis dokumen tidak dikenal.' using errcode = 'P0001'; end if;

  -- cegah klik ganda / dua tab mengajukan bersamaan
  perform pg_advisory_xact_lock(hashtext('approval:' || p_doc_type || ':' || p_record_id));

  v_ctx := __APP__.approval_ctx(v_type, p_record_id);
  if v_ctx.requester_id is distinct from v_uid and not public.has_app_role('__APP__', 'editor') then
    raise exception 'Hanya pemohon atau editor yang bisa mengajukan dokumen ini.' using errcode = 'P0001';
  end if;
  if not public.has_app_role('__APP__', 'viewer') then
    raise exception 'Tidak punya akses ke app ini.' using errcode = '42501';
  end if;
  if not ('*' = any (__APP__.my_company_scope()) or v_ctx.company_code = any (__APP__.my_company_scope())) then
    raise exception 'Dokumen tidak ditemukan.' using errcode = 'P0001';
  end if;
  if exists (select 1 from __APP__.approvals
             where doc_type = p_doc_type and record_id = p_record_id and status = 'pending') then
    raise exception 'Dokumen ini sedang dalam proses approval.' using errcode = 'P0001';
  end if;
  -- K3
  if coalesce(v_ctx.status, 'draft') not in ('draft', 'rejected') then
    raise exception 'Dokumen dengan status ini tidak bisa diajukan.' using errcode = 'P0001';
  end if;

  select t.id into v_tpl
    from __APP__.approval_templates t
   where t.doc_type = p_doc_type and t.is_active
     and (t.company_code  is null or t.company_code  = v_ctx.company_code)
     and (t.department_id is null or t.department_id = v_ctx.department_id)
     and (t.min_amount is null or v_ctx.amount >= t.min_amount)
     and (t.max_amount is null or v_ctx.amount <= t.max_amount)
     and exists (select 1 from __APP__.approval_template_steps s where s.template_id = t.id)
   order by t.priority desc, (t.company_code is not null) desc, (t.department_id is not null) desc, t.created_at
   limit 1;
  if v_tpl is null then
    raise exception 'Belum ada template approval yang cocok untuk dokumen ini. Hubungi admin app.' using errcode = 'P0001';
  end if;

  if exists (select 1 from __APP__.approval_template_steps s
             where s.template_id = v_tpl and s.approver_kind = 'department_head'
               and not exists (select 1 from __APP__.department_heads h
                               where h.department_id = v_ctx.department_id and h.company_code = v_ctx.company_code)) then
    raise exception 'Kepala departemen untuk dokumen ini belum diatur. Hubungi admin app.' using errcode = 'P0001';
  end if;

  select coalesce(max(round), 0) + 1 into v_round
    from __APP__.approvals where doc_type = p_doc_type and record_id = p_record_id;

  insert into __APP__.approvals (doc_type, record_id, round, step_no, approval_type, approver_id, status, note, due_hours, template_id)
  select p_doc_type, p_record_id, v_round, s.step_no, s.approval_type, x.approver_id,
         case when x.approver_id = v_ctx.requester_id then 'skipped' else 'pending' end,
         case when x.approver_id = v_ctx.requester_id then 'Dilewati: approver adalah pemohon' end,
         s.due_hours, v_tpl
    from __APP__.approval_template_steps s
    cross join lateral (
      select case s.approver_kind
               when 'user' then s.approver_id
               else (select h.user_id from __APP__.department_heads h
                      where h.department_id = v_ctx.department_id and h.company_code = v_ctx.company_code)
             end as approver_id) x
   where s.template_id = v_tpl;

  update __APP__.approvals set decided_at = now()
   where doc_type = p_doc_type and record_id = p_record_id and round = v_round and status = 'skipped';

  select * into v_first from __APP__.approvals
   where doc_type = p_doc_type and record_id = p_record_id and round = v_round and status = 'pending'
   order by step_no limit 1;

  perform __APP__.set_log_context('submit', null);
  perform __APP__.approval_call_done(v_type, p_record_id, 'submitted');

  if v_first.id is null then
    -- semua langkah dilewati → langsung disetujui
    perform __APP__.set_log_context('approve', 'Semua langkah approval dilewati');
    perform __APP__.approval_call_done(v_type, p_record_id, 'approved');
  else
    -- nomor dokumen baru ada setelah 'submitted'
    v_ctx := __APP__.approval_ctx(v_type, p_record_id);
    v_notif := __APP__.approval_activate(v_type, v_ctx, v_first);
  end if;
  perform __APP__.set_log_context(null, null);

  return jsonb_build_object('round', v_round, 'notification_ids', to_jsonb(v_notif));
end $$;

-- ---------------------------------------------------------------- approval_decide
create or replace function __APP__.approval_decide(p_approval_id uuid, p_decision text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := (select auth.uid());
  v_a     __APP__.approvals;
  v_type  __APP__.approval_doc_types;
  v_ctx   __APP__.approval_context;
  v_next  __APP__.approvals;
  v_href  text;
  v_notif uuid[] := '{}';
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Keputusan tidak valid.' using errcode = 'P0001';
  end if;

  select * into v_a from __APP__.approvals where id = p_approval_id for update;   -- anti klik ganda
  if not found or v_a.status <> 'pending' then
    raise exception 'Approval ini sudah diproses. Muat ulang halaman.' using errcode = 'P0001';
  end if;
  if v_a.approver_id is distinct from v_uid then
    raise exception 'Bukan giliran Anda untuk memproses dokumen ini.' using errcode = 'P0001';
  end if;
  if not public.has_app_role('__APP__', 'viewer') then
    raise exception 'Tidak punya akses ke app ini.' using errcode = '42501';
  end if;
  if exists (select 1 from __APP__.approvals
             where doc_type = v_a.doc_type and record_id = v_a.record_id and round = v_a.round
               and step_no < v_a.step_no and status = 'pending') then
    raise exception 'Masih menunggu approver sebelumnya.' using errcode = 'P0001';
  end if;
  if p_decision = 'rejected' and length(btrim(coalesce(p_note, ''))) < 5 then
    raise exception 'Alasan penolakan wajib diisi (minimal 5 karakter).' using errcode = 'P0001';
  end if;

  v_type := __APP__.approval_type_of(v_a.doc_type);
  v_ctx := __APP__.approval_ctx(v_type, v_a.record_id);
  v_href := v_type.href_prefix || v_a.record_id;

  update __APP__.approvals set status = p_decision, decided_at = now(), note = nullif(btrim(p_note), '')
   where id = v_a.id;

  if p_decision = 'rejected' then
    update __APP__.approvals set status = 'skipped', note = 'Dihentikan: dokumen ditolak', decided_at = now()
     where doc_type = v_a.doc_type and record_id = v_a.record_id and round = v_a.round and status = 'pending';
    perform __APP__.set_log_context('reject', p_note);
    perform __APP__.approval_call_done(v_type, v_a.record_id, 'rejected');
    v_notif := array(select * from __APP__.notify(array[v_ctx.requester_id], 'approval.rejected',
      format('%s %s ditolak', v_type.label, v_ctx.code), p_note, v_href, 'approval', v_a.doc_type, v_a.record_id::text));
  else
    select * into v_next from __APP__.approvals
     where doc_type = v_a.doc_type and record_id = v_a.record_id and round = v_a.round and status = 'pending'
     order by step_no limit 1;
    if found then
      -- langkah tengah: dokumen tidak berubah, log ditulis langsung
      perform __APP__.write_log(v_type.table_name, v_a.record_id, 'approve',
        jsonb_build_object('langkah', jsonb_build_object('old', null, 'new', v_a.step_no)), p_note,
        v_ctx.code, v_ctx.company_code, v_type.href_prefix, v_type.label, true);
      v_notif := __APP__.approval_activate(v_type, v_ctx, v_next);
    else
      perform __APP__.set_log_context('approve', p_note);
      perform __APP__.approval_call_done(v_type, v_a.record_id, 'approved');
      v_notif := array(select * from __APP__.notify(array[v_ctx.requester_id], 'approval.approved',
        format('%s %s disetujui', v_type.label, v_ctx.code), null, v_href, 'approval', v_a.doc_type, v_a.record_id::text));
    end if;
  end if;
  perform __APP__.set_log_context(null, null);

  return jsonb_build_object('status', p_decision, 'notification_ids', to_jsonb(v_notif));
end $$;

-- ---------------------------------------------------------------- approval_cancel (pemohon menarik)
create or replace function __APP__.approval_cancel(p_doc_type text, p_record_id uuid, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid    uuid := (select auth.uid());
  v_type   __APP__.approval_doc_types;
  v_ctx    __APP__.approval_context;
  v_turn   __APP__.approvals;
  v_notif  uuid[] := '{}';
begin
  perform pg_advisory_xact_lock(hashtext('approval:' || p_doc_type || ':' || p_record_id));
  v_type := __APP__.approval_type_of(p_doc_type);
  v_ctx := __APP__.approval_ctx(v_type, p_record_id);

  if v_ctx.requester_id is distinct from v_uid and not public.has_app_role('__APP__', 'admin') then
    raise exception 'Hanya pemohon yang bisa menarik pengajuan ini.' using errcode = 'P0001';
  end if;

  select * into v_turn from __APP__.approvals
   where doc_type = p_doc_type and record_id = p_record_id and status = 'pending'
   order by round desc, step_no limit 1;
  if not found then
    raise exception 'Pengajuan ini tidak sedang menunggu approval.' using errcode = 'P0001';
  end if;

  update __APP__.approvals set status = 'skipped', decided_at = now(),
         note = left('Ditarik pemohon' || coalesce(': ' || nullif(btrim(p_note), ''), ''), 1000)
   where doc_type = p_doc_type and record_id = p_record_id and round = v_turn.round and status = 'pending';

  perform __APP__.set_log_context('cancel', nullif(btrim(p_note), ''));
  perform __APP__.approval_call_done(v_type, p_record_id, 'cancelled');
  perform __APP__.set_log_context(null, null);

  v_notif := array(select * from __APP__.notify(array[v_turn.approver_id], 'approval.cancelled',
    format('%s %s ditarik pemohon', v_type.label, v_ctx.code), nullif(btrim(p_note), ''),
    v_type.href_prefix || p_record_id, 'approval', p_doc_type, p_record_id::text));

  return jsonb_build_object('status', 'cancelled', 'notification_ids', to_jsonb(v_notif));
end $$;

-- ---------------------------------------------------------------- approval_override (admin)
-- p_mode: 'reassign' (ganti approver langkah pending) | 'skip' (lewati langkah pending)
create or replace function __APP__.approval_override(p_approval_id uuid, p_mode text, p_new_approver uuid default null,
  p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_a       __APP__.approvals;
  v_type    __APP__.approval_doc_types;
  v_ctx     __APP__.approval_context;
  v_is_turn boolean;
  v_next    __APP__.approvals;
  v_notif   uuid[] := '{}';
  v_old     text;
  v_new     text;
begin
  if not public.has_app_role('__APP__', 'admin') then
    raise exception 'Hanya admin app yang bisa mengubah approval.' using errcode = 'P0001';
  end if;
  if p_mode not in ('reassign', 'skip') then
    raise exception 'Mode tidak valid.' using errcode = 'P0001';
  end if;
  if length(btrim(coalesce(p_note, ''))) < 5 then
    raise exception 'Alasan wajib diisi (minimal 5 karakter).' using errcode = 'P0001';
  end if;

  select * into v_a from __APP__.approvals where id = p_approval_id for update;
  if not found or v_a.status <> 'pending' then
    raise exception 'Langkah ini sudah diproses. Muat ulang halaman.' using errcode = 'P0001';
  end if;
  v_type := __APP__.approval_type_of(v_a.doc_type);
  v_ctx := __APP__.approval_ctx(v_type, v_a.record_id);
  v_is_turn := not exists (select 1 from __APP__.approvals
                            where doc_type = v_a.doc_type and record_id = v_a.record_id and round = v_a.round
                              and step_no < v_a.step_no and status = 'pending');
  select full_name into v_old from public.profiles where id = v_a.approver_id;

  if p_mode = 'reassign' then
    if p_new_approver is null or p_new_approver = v_a.approver_id then
      raise exception 'Pilih approver pengganti yang berbeda.' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.app_access x join public.profiles p on p.id = x.user_id
                    where x.user_id = p_new_approver and p.is_active
                      and (x.app_id = '__APP__' or (x.app_id = 'platform' and x.role = 'admin'))) then
      raise exception 'Approver pengganti belum punya akses ke app ini.' using errcode = 'P0001';
    end if;
    select full_name into v_new from public.profiles where id = p_new_approver;
    update __APP__.approvals set approver_id = p_new_approver, reminded_at = null where id = v_a.id;
    perform __APP__.write_log(v_type.table_name, v_a.record_id, 'override',
      jsonb_build_object('langkah', v_a.step_no, 'approver', jsonb_build_object('old', v_old, 'new', v_new)),
      p_note, v_ctx.code, v_ctx.company_code, v_type.href_prefix, v_type.label, true);
    if v_is_turn then
      select * into v_next from __APP__.approvals where id = v_a.id;
      v_notif := __APP__.approval_activate(v_type, v_ctx, v_next);
    end if;
  else
    update __APP__.approvals set status = 'skipped', decided_at = now(),
           note = left('Dilewati admin: ' || btrim(p_note), 1000)
     where id = v_a.id;
    perform __APP__.write_log(v_type.table_name, v_a.record_id, 'override',
      jsonb_build_object('langkah', v_a.step_no, 'dilewati', jsonb_build_object('old', v_old, 'new', null)),
      p_note, v_ctx.code, v_ctx.company_code, v_type.href_prefix, v_type.label, true);
    if v_is_turn then
      select * into v_next from __APP__.approvals
       where doc_type = v_a.doc_type and record_id = v_a.record_id and round = v_a.round and status = 'pending'
       order by step_no limit 1;
      if found then
        v_notif := __APP__.approval_activate(v_type, v_ctx, v_next);
      else
        perform __APP__.set_log_context('approve', 'Langkah terakhir dilewati admin');
        perform __APP__.approval_call_done(v_type, v_a.record_id, 'approved');
        perform __APP__.set_log_context(null, null);
        v_notif := array(select * from __APP__.notify(array[v_ctx.requester_id], 'approval.approved',
          format('%s %s disetujui', v_type.label, v_ctx.code), null, v_type.href_prefix || v_a.record_id,
          'approval', v_a.doc_type, v_a.record_id::text));
      end if;
    end if;
  end if;

  return jsonb_build_object('mode', p_mode, 'notification_ids', to_jsonb(v_notif));
end $$;

-- ---------------------------------------------------------------- request_followup
create or replace function __APP__.request_followup(p_approval_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := (select auth.uid());
  v_a     __APP__.approvals;
  v_type  __APP__.approval_doc_types;
  v_ctx   __APP__.approval_context;
  v_last  timestamptz;
  v_name  text;
  v_notif uuid[] := '{}';
begin
  select * into v_a from __APP__.approvals where id = p_approval_id for update;
  if not found or v_a.status <> 'pending' then
    raise exception 'Langkah ini sudah diproses. Muat ulang halaman.' using errcode = 'P0001';
  end if;
  if exists (select 1 from __APP__.approvals
             where doc_type = v_a.doc_type and record_id = v_a.record_id and round = v_a.round
               and step_no < v_a.step_no and status = 'pending') then
    raise exception 'Langkah ini belum giliran. Follow-up hanya untuk approver yang sedang giliran.' using errcode = 'P0001';
  end if;
  v_type := __APP__.approval_type_of(v_a.doc_type);
  v_ctx := __APP__.approval_ctx(v_type, v_a.record_id);

  if v_a.approver_id = v_uid then
    raise exception 'Anda sendiri approver langkah ini.' using errcode = 'P0001';
  end if;
  if v_ctx.requester_id is distinct from v_uid and not public.has_app_role('__APP__', 'editor') then
    raise exception 'Hanya pemohon atau editor yang bisa meminta follow-up.' using errcode = 'P0001';
  end if;

  select full_name into v_name from public.profiles where id = v_a.approver_id;
  select max(requested_at) into v_last from __APP__.followups
   where approval_id = v_a.id and requested_by = v_uid;
  if v_last is not null and v_last > now() - interval '1 hour' then
    raise exception 'Follow-up ke % sudah dikirim % menit lalu. Coba lagi setelah 1 jam.',
      coalesce(v_name, 'approver'), greatest(1, floor(extract(epoch from now() - v_last) / 60)::integer)
      using errcode = 'P0001';
  end if;

  insert into __APP__.followups (approval_id, requested_by) values (v_a.id, v_uid);
  perform __APP__.write_log(v_type.table_name, v_a.record_id, 'followup',
    jsonb_build_object('approver', jsonb_build_object('old', null, 'new', v_name)), null,
    v_ctx.code, v_ctx.company_code, v_type.href_prefix, v_type.label, true);
  v_notif := array(select * from __APP__.notify(array[v_a.approver_id], 'approval.followup',
    format('Follow-up: mohon proses %s %s', v_type.label, v_ctx.code), null,
    v_type.href_prefix || v_a.record_id, 'approval', v_a.doc_type, v_a.record_id::text));

  return jsonb_build_object('approver_name', v_name, 'notification_ids', to_jsonb(v_notif));
end $$;

-- ---------------------------------------------------------------- pending_for_me (K1)
create or replace function __APP__.pending_for_me(p_limit integer default 50)
returns table (approval_id uuid, doc_type text, doc_label text, record_id uuid, step_no integer,
               approval_type text, waiting_since timestamptz, due_at timestamptz, href text,
               followup_count integer, last_followup_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select q.* from (
    select a.id as approval_id, a.doc_type, t.label as doc_label, a.record_id, a.step_no, a.approval_type,
           coalesce((select max(p.decided_at) from __APP__.approvals p
                      where p.doc_type = a.doc_type and p.record_id = a.record_id
                        and p.round = a.round and p.step_no < a.step_no), a.created_at) as waiting_since,
           a.due_at, t.href_prefix || a.record_id as href,
           (select count(*)::integer from __APP__.followups f where f.approval_id = a.id) as followup_count,
           (select max(f.requested_at) from __APP__.followups f where f.approval_id = a.id) as last_followup_at
      from __APP__.approvals a
      join __APP__.approval_doc_types t on t.code = a.doc_type
     where a.approver_id = (select auth.uid()) and a.status = 'pending'
       and not exists (select 1 from __APP__.approvals b
                        where b.doc_type = a.doc_type and b.record_id = a.record_id and b.round = a.round
                          and b.step_no < a.step_no and b.status = 'pending')
  ) q
  order by q.followup_count desc, q.waiting_since asc
  limit least(greatest(p_limit, 1), 200);
$$;

-- ---------------------------------------------------------------- template builder (admin)
-- p jsonb: {id?, doc_type, name, description?, company_code?, department_id?, min_amount?,
--           max_amount?, priority?, is_active?, steps: [{approval_type, approver_kind, approver_id?, due_hours?}]}
create or replace function __APP__.approval_template_save(p jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id        uuid := nullif(p ->> 'id', '')::uuid;
  v_steps     jsonb := coalesce(p -> 'steps', '[]'::jsonb);
  v_old_steps jsonb;
  v_new_steps jsonb;
  s           jsonb;
  i           integer := 0;
begin
  if not public.has_app_role('__APP__', 'admin') then
    raise exception 'Hanya admin app yang bisa mengubah template approval.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(v_steps) <> 'array' or jsonb_array_length(v_steps) = 0 then
    raise exception 'Template wajib punya minimal 1 langkah.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(v_steps) > 20 then
    raise exception 'Maksimal 20 langkah per template.' using errcode = 'P0001';
  end if;
  for s in select * from jsonb_array_elements(v_steps) loop
    if s ->> 'approver_kind' = 'user' and not exists (
         select 1 from public.app_access x join public.profiles pr on pr.id = x.user_id
          where x.user_id = nullif(s ->> 'approver_id', '')::uuid and pr.is_active
            and (x.app_id = '__APP__' or (x.app_id = 'platform' and x.role = 'admin'))) then
      raise exception 'Approver di langkah % belum punya akses ke app ini.', i + 1 using errcode = 'P0001';
    end if;
    i := i + 1;
  end loop;

  if v_id is null then
    insert into __APP__.approval_templates (doc_type, name, description, company_code, department_id,
      min_amount, max_amount, priority, is_active)
    values (p ->> 'doc_type', btrim(p ->> 'name'), nullif(btrim(p ->> 'description'), ''),
      nullif(p ->> 'company_code', ''), nullif(p ->> 'department_id', '')::uuid,
      nullif(p ->> 'min_amount', '')::numeric, nullif(p ->> 'max_amount', '')::numeric,
      coalesce(nullif(p ->> 'priority', '')::integer, 0), coalesce((p ->> 'is_active')::boolean, true))
    returning id into v_id;
    v_old_steps := '[]'::jsonb;
  else
    select coalesce(jsonb_agg(jsonb_build_object('no', step_no, 'tipe', approval_type, 'jenis', approver_kind,
             'approver', approver_id, 'jam', due_hours) order by step_no), '[]')
      into v_old_steps from __APP__.approval_template_steps where template_id = v_id;
    update __APP__.approval_templates set
      doc_type = p ->> 'doc_type', name = btrim(p ->> 'name'), description = nullif(btrim(p ->> 'description'), ''),
      company_code = nullif(p ->> 'company_code', ''), department_id = nullif(p ->> 'department_id', '')::uuid,
      min_amount = nullif(p ->> 'min_amount', '')::numeric, max_amount = nullif(p ->> 'max_amount', '')::numeric,
      priority = coalesce(nullif(p ->> 'priority', '')::integer, 0), is_active = coalesce((p ->> 'is_active')::boolean, true)
    where id = v_id;
    if not found then raise exception 'Template tidak ditemukan.' using errcode = 'P0001'; end if;
  end if;

  delete from __APP__.approval_template_steps where template_id = v_id;
  insert into __APP__.approval_template_steps (template_id, step_no, approval_type, approver_kind, approver_id, due_hours)
  select v_id, e.ord::integer, e.v ->> 'approval_type', e.v ->> 'approver_kind',
         case when e.v ->> 'approver_kind' = 'user' then nullif(e.v ->> 'approver_id', '')::uuid end,
         nullif(e.v ->> 'due_hours', '')::integer
    from jsonb_array_elements(v_steps) with ordinality as e(v, ord);

  select coalesce(jsonb_agg(jsonb_build_object('no', step_no, 'tipe', approval_type, 'jenis', approver_kind,
           'approver', approver_id, 'jam', due_hours) order by step_no), '[]')
    into v_new_steps from __APP__.approval_template_steps where template_id = v_id;
  if v_new_steps is distinct from v_old_steps then
    perform __APP__.write_log('approval_templates', v_id, 'update',
      jsonb_build_object('langkah', jsonb_build_object('old', v_old_steps, 'new', v_new_steps)), null,
      btrim(p ->> 'name'), nullif(p ->> 'company_code', ''), '/approval/template/', 'Template approval', true, 'config');
  end if;
  return v_id;
end $$;

create or replace function __APP__.approval_template_delete(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_app_role('__APP__', 'admin') then
    raise exception 'Hanya admin app yang bisa menghapus template approval.' using errcode = 'P0001';
  end if;
  delete from __APP__.approval_templates where id = p_id;
  if not found then raise exception 'Template tidak ditemukan.' using errcode = 'P0001'; end if;
end $$;

-- ---------------------------------------------------------------- grant (§6.4)
revoke execute on function __APP__.approval_start(text, uuid), __APP__.approval_decide(uuid, text, text),
  __APP__.approval_cancel(text, uuid, text), __APP__.approval_override(uuid, text, uuid, text),
  __APP__.request_followup(uuid), __APP__.pending_for_me(integer),
  __APP__.approval_template_save(jsonb), __APP__.approval_template_delete(uuid) from public, anon;
-- tetap execute untuk authenticated (default privileges); fungsi mengecek akses sendiri
