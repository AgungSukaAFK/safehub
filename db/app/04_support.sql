-- =====================================================================================
-- 04 BANTUAN ADMIN (chat user ↔ admin app) · backend-guide §11.1
-- Semua tulis lewat RPC (memicu notifikasi → mengembalikan notification_ids).
-- =====================================================================================

create table __APP__.support_threads (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  category         text not null check (category in ('akses', 'error', 'cara_pakai', 'data', 'lainnya')),
  subject          text not null check (length(btrim(subject)) between 1 and 200),
  status           text not null default 'menunggu' check (status in ('menunggu', 'dibalas', 'selesai')),
  assigned_to      uuid references public.profiles(id) on delete set null,
  context          jsonb,                                 -- halaman asal, perangkat, tema
  last_message_at  timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint support_threads_context_size check (coalesce(pg_column_size(context), 0) < 4096)
);
comment on table __APP__.support_threads is 'Percakapan Bantuan Admin. Ditulis lewat RPC support_*.';
create index support_threads_user_idx on __APP__.support_threads (user_id, last_message_at desc);
create index support_threads_assigned_idx on __APP__.support_threads (assigned_to);
create index support_threads_status_idx on __APP__.support_threads (status, last_message_at desc);

create table __APP__.support_messages (
  id               uuid primary key default gen_random_uuid(),
  thread_id        uuid not null references __APP__.support_threads(id) on delete cascade,
  sender_id        uuid references public.profiles(id) on delete set null,
  body             text check (length(body) <= 4000),
  attachment_path  text check (length(attachment_path) <= 500),
  read_at          timestamptz,
  created_at       timestamptz not null default now(),
  check (length(btrim(coalesce(body, ''))) > 0 or attachment_path is not null)
);
comment on table __APP__.support_messages is 'Pesan Bantuan Admin. Ditulis lewat support_open/support_send.';
create index support_messages_thread_idx on __APP__.support_messages (thread_id, created_at);
create index support_messages_sender_idx on __APP__.support_messages (sender_id);

create trigger support_threads_set_updated_at before update on __APP__.support_threads
  for each row execute function public.set_updated_at();

alter table __APP__.support_threads enable row level security;
alter table __APP__.support_messages enable row level security;
revoke insert, update on __APP__.support_threads from authenticated;
revoke insert, update, delete on __APP__.support_messages from authenticated;

create policy "support_threads: owner or admin read" on __APP__.support_threads for select to authenticated
  using (user_id = (select auth.uid()) or (select public.has_app_role('__APP__', 'admin')));
create policy "support_threads: admin delete" on __APP__.support_threads for delete to authenticated
  using ((select public.has_app_role('__APP__', 'admin')));
create policy "support_messages: participant read" on __APP__.support_messages for select to authenticated
  using (exists (select 1 from __APP__.support_threads t where t.id = thread_id));   -- ikut RLS thread

alter publication supabase_realtime add table __APP__.support_messages;

-- Lampiran yang ikut terhapus bersama thread → antrian pembersihan file (lihat 08_maintenance)
create table __APP__.storage_cleanup_queue (
  id         bigint generated always as identity primary key,
  bucket     text not null,
  path       text not null,
  reason     text,
  queued_at  timestamptz not null default now()
);
comment on table __APP__.storage_cleanup_queue is 'File storage yang menunggu dihapus lewat Storage API (tombol admin).';
alter table __APP__.storage_cleanup_queue enable row level security;
revoke insert, update on __APP__.storage_cleanup_queue from authenticated;
create policy "storage_cleanup_queue: admin read" on __APP__.storage_cleanup_queue for select to authenticated
  using ((select public.has_app_role('__APP__', 'admin')));
create policy "storage_cleanup_queue: admin delete" on __APP__.storage_cleanup_queue for delete to authenticated
  using ((select public.has_app_role('__APP__', 'admin')));

create or replace function __APP__.support_messages_enqueue_files()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.attachment_path is not null then
    insert into __APP__.storage_cleanup_queue (bucket, path, reason)
    values ('__HOST__-lampiran', old.attachment_path, 'support_message_deleted');
  end if;
  return null;
end $$;
revoke execute on function __APP__.support_messages_enqueue_files() from public, anon, authenticated;
create trigger support_messages_enqueue_files after delete on __APP__.support_messages
  for each row execute function __APP__.support_messages_enqueue_files();

-- ---------------------------------------------------------------- RPC
create or replace function __APP__.support_href(p_thread_id uuid, p_admin boolean)
returns text language sql immutable set search_path = '' as $$
  select case when p_admin then '/bantuan/kelola?t=' else '/bantuan?t=' end || p_thread_id::text;
$$;

create or replace function __APP__.support_open(p_category text, p_subject text, p_body text,
  p_context jsonb default null, p_attachment_path text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid    uuid := (select auth.uid());
  v_id     uuid;
  v_name   text;
  v_notif  uuid[];
begin
  if not public.has_app_role('__APP__', 'viewer') then
    raise exception 'Tidak punya akses ke app ini.' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_subject, ''))) = 0 then
    raise exception 'Subjek wajib diisi.' using errcode = 'P0001';
  end if;
  if length(btrim(coalesce(p_body, ''))) = 0 and p_attachment_path is null then
    raise exception 'Tulis pesan atau lampirkan file.' using errcode = 'P0001';
  end if;

  insert into __APP__.support_threads (user_id, category, subject, context)
  values (v_uid, p_category, left(btrim(p_subject), 200), p_context)
  returning id into v_id;
  insert into __APP__.support_messages (thread_id, sender_id, body, attachment_path)
  values (v_id, v_uid, nullif(btrim(p_body), ''), p_attachment_path);

  select full_name into v_name from public.profiles where id = v_uid;
  v_notif := array(select * from __APP__.notify(__APP__.app_admin_ids(), 'support.new',
    format('Bantuan baru dari %s: %s', coalesce(v_name, 'pengguna'), left(btrim(p_subject), 120)),
    left(btrim(p_body), 200), __APP__.support_href(v_id, true), 'bantuan', 'support_threads', v_id::text));

  return jsonb_build_object('thread_id', v_id, 'notification_ids', to_jsonb(v_notif));
end $$;

create or replace function __APP__.support_send(p_thread_id uuid, p_body text, p_attachment_path text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid    uuid := (select auth.uid());
  v_t      __APP__.support_threads;
  v_admin  boolean := public.has_app_role('__APP__', 'admin');
  v_owner  boolean;
  v_name   text;
  v_to     uuid[];
  v_notif  uuid[];
  v_msg    uuid;
begin
  select * into v_t from __APP__.support_threads where id = p_thread_id for update;
  if not found then raise exception 'Percakapan tidak ditemukan.' using errcode = 'P0001'; end if;
  v_owner := v_t.user_id = v_uid;
  if not v_owner and not v_admin then
    raise exception 'Percakapan tidak ditemukan.' using errcode = 'P0001';
  end if;
  if length(btrim(coalesce(p_body, ''))) = 0 and p_attachment_path is null then
    raise exception 'Tulis pesan atau lampirkan file.' using errcode = 'P0001';
  end if;

  insert into __APP__.support_messages (thread_id, sender_id, body, attachment_path)
  values (p_thread_id, v_uid, nullif(btrim(p_body), ''), p_attachment_path)
  returning id into v_msg;

  update __APP__.support_threads
     set last_message_at = now(),
         status = case when v_owner then 'menunggu' else 'dibalas' end,
         assigned_to = case when not v_owner and assigned_to is null then v_uid else assigned_to end
   where id = p_thread_id;

  select full_name into v_name from public.profiles where id = v_uid;
  if v_owner then
    v_to := case when v_t.assigned_to is not null then array[v_t.assigned_to] else __APP__.app_admin_ids() end;
    v_notif := array(select * from __APP__.notify(v_to, 'support.message',
      format('Pesan baru dari %s: %s', coalesce(v_name, 'pengguna'), v_t.subject),
      left(btrim(p_body), 200), __APP__.support_href(p_thread_id, true), 'bantuan', 'support_threads', p_thread_id::text));
  else
    v_notif := array(select * from __APP__.notify(array[v_t.user_id], 'support.message',
      format('Admin membalas: %s', v_t.subject),
      left(btrim(p_body), 200), __APP__.support_href(p_thread_id, false), 'bantuan', 'support_threads', p_thread_id::text));
  end if;

  return jsonb_build_object('message_id', v_msg, 'notification_ids', to_jsonb(v_notif));
end $$;

create or replace function __APP__.support_assign(p_thread_id uuid, p_admin_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_t     __APP__.support_threads;
  v_notif uuid[] := '{}';
begin
  if not public.has_app_role('__APP__', 'admin') then
    raise exception 'Hanya admin app yang bisa mengambil percakapan.' using errcode = 'P0001';
  end if;
  if p_admin_id is not null and not (p_admin_id = any (__APP__.app_admin_ids())) then
    raise exception 'Pengguna ini bukan admin app.' using errcode = 'P0001';
  end if;
  update __APP__.support_threads set assigned_to = p_admin_id where id = p_thread_id returning * into v_t;
  if not found then raise exception 'Percakapan tidak ditemukan.' using errcode = 'P0001'; end if;
  if p_admin_id is not null then
    v_notif := array(select * from __APP__.notify(array[p_admin_id], 'support.assigned',
      format('Percakapan dialihkan ke Anda: %s', v_t.subject), null,
      __APP__.support_href(p_thread_id, true), 'bantuan', 'support_threads', p_thread_id::text));
  end if;
  return jsonb_build_object('notification_ids', to_jsonb(v_notif));
end $$;

create or replace function __APP__.support_set_status(p_thread_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := (select auth.uid());
  v_t     __APP__.support_threads;
  v_admin boolean := public.has_app_role('__APP__', 'admin');
  v_notif uuid[] := '{}';
begin
  if p_status not in ('menunggu', 'dibalas', 'selesai') then
    raise exception 'Status tidak valid.' using errcode = 'P0001';
  end if;
  select * into v_t from __APP__.support_threads where id = p_thread_id for update;
  if not found or (v_t.user_id <> v_uid and not v_admin) then
    raise exception 'Percakapan tidak ditemukan.' using errcode = 'P0001';
  end if;
  if not v_admin and p_status <> 'selesai' then
    raise exception 'Anda hanya bisa menandai percakapan selesai.' using errcode = 'P0001';
  end if;
  update __APP__.support_threads set status = p_status where id = p_thread_id;
  if v_admin and v_t.user_id <> v_uid and p_status = 'selesai' and v_t.status <> 'selesai' then
    v_notif := array(select * from __APP__.notify(array[v_t.user_id], 'support.closed',
      format('Percakapan ditandai selesai: %s', v_t.subject), null,
      __APP__.support_href(p_thread_id, false), 'bantuan', 'support_threads', p_thread_id::text));
  end if;
  return jsonb_build_object('notification_ids', to_jsonb(v_notif));
end $$;

-- Tandai pesan lawan bicara sudah dibaca
create or replace function __APP__.support_mark_read(p_thread_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  n     integer;
begin
  if not exists (select 1 from __APP__.support_threads t where t.id = p_thread_id
                  and (t.user_id = v_uid or public.has_app_role('__APP__', 'admin'))) then
    return 0;
  end if;
  update __APP__.support_messages set read_at = now()
   where thread_id = p_thread_id and read_at is null and sender_id is distinct from v_uid;
  get diagnostics n = row_count;
  return n;
end $$;

-- Jumlah percakapan yang menunggu perhatian (badge)
create or replace function __APP__.support_badge()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'mine_unread', (select count(distinct m.thread_id) from __APP__.support_messages m
                      join __APP__.support_threads t on t.id = m.thread_id
                     where t.user_id = (select auth.uid()) and m.read_at is null
                       and m.sender_id is distinct from (select auth.uid())),
    'admin_waiting', case when public.has_app_role('__APP__', 'admin') then
                       (select count(*) from __APP__.support_threads where status = 'menunggu') else 0 end,
    'admin_mine', case when public.has_app_role('__APP__', 'admin') then
                    (select count(*) from __APP__.support_threads
                      where status = 'menunggu' and assigned_to = (select auth.uid())) else 0 end);
$$;

revoke execute on function __APP__.support_href(uuid, boolean) from public, anon, authenticated;
revoke execute on function __APP__.support_open(text, text, text, jsonb, text), __APP__.support_send(uuid, text, text),
  __APP__.support_assign(uuid, uuid), __APP__.support_set_status(uuid, text), __APP__.support_mark_read(uuid),
  __APP__.support_badge() from public, anon;
