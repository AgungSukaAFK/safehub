-- =====================================================================================
-- 02 NOTIFIKASI & WEB PUSH · backend-guide §7
-- =====================================================================================

create table __APP__.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  actor_id    uuid references public.profiles(id) on delete set null,
  type        text not null check (type ~ '^[a-z][a-z0-9_.]{1,60}$'),
  category    text not null default 'umum' check (category ~ '^[a-z][a-z0-9_]{1,30}$'),
  title       text not null check (length(btrim(title)) between 1 and 200),
  body        text check (length(body) <= 1000),
  href        text check (href is null or href ~ '^/'),
  entity      text,
  record_id   text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
comment on table __APP__.notifications is 'Notifikasi in-app. Hanya dibuat lewat notify() dari RPC domain; user hanya membaca & menandai miliknya.';
create index notifications_user_idx    on __APP__.notifications (user_id, created_at desc);
create index notifications_unread_idx  on __APP__.notifications (user_id) where read_at is null;
create index notifications_created_idx on __APP__.notifications (created_at);
create index notifications_actor_idx   on __APP__.notifications (actor_id, created_at desc);

alter table __APP__.notifications enable row level security;
revoke insert, update, delete on __APP__.notifications from authenticated;
grant update (read_at) on __APP__.notifications to authenticated;        -- hanya kolom read_at
create policy "notifications: own read" on __APP__.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy "notifications: own mark read" on __APP__.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter publication supabase_realtime add table __APP__.notifications;

-- notify(): INTERNAL. Tidak bisa dipanggil app; notifikasi hanya lahir dari RPC domain.
create or replace function __APP__.notify(
  p_user_ids uuid[], p_type text, p_title text, p_body text default null, p_href text default null,
  p_category text default 'umum', p_entity text default null, p_record_id text default null)
returns setof uuid language plpgsql security definer set search_path = '' as $$
begin
  return query
  insert into __APP__.notifications (user_id, actor_id, type, category, title, body, href, entity, record_id)
  select distinct u, (select auth.uid()), p_type, p_category, left(p_title, 200), left(p_body, 1000),
         p_href, p_entity, p_record_id
    from unnest(p_user_ids) as u
   where u is not null
     and u is distinct from (select auth.uid())                       -- tidak menotifikasi diri sendiri
     and exists (select 1 from public.app_access a join public.profiles p on p.id = a.user_id
                  where a.user_id = u and p.is_active
                    and (a.app_id = '__APP__' or (a.app_id = 'platform' and a.role = 'admin')))
  returning id;
end $$;
revoke execute on function __APP__.notify(uuid[], text, text, text, text, text, text, text) from public, anon, authenticated;

-- Daftar admin app (penerima notifikasi modul admin: Bantuan, Feedback)
create or replace function __APP__.app_admin_ids()
returns uuid[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(a.user_id), '{}')
    from public.app_access a join public.profiles p on p.id = a.user_id
   where a.app_id = '__APP__' and a.role = 'admin' and p.is_active;
$$;
revoke execute on function __APP__.app_admin_ids() from public, anon, authenticated;

-- ---------------------------------------------------------------- Web Push (§7.3)
create table __APP__.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  endpoint      text not null unique check (endpoint ~ '^https://' and length(endpoint) <= 1000),
  p256dh        text not null check (length(p256dh) <= 200),
  auth          text not null check (length(auth) <= 100),
  user_agent    text check (length(user_agent) <= 300),
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz not null default now()
);
comment on table __APP__.push_subscriptions is 'Langganan Web Push per perangkat. Ditulis lewat push_subscribe(); dihapus saat Keluar.';
create index push_subscriptions_user_idx on __APP__.push_subscriptions (user_id);
alter table __APP__.push_subscriptions enable row level security;
revoke insert, update on __APP__.push_subscriptions from authenticated;
create policy "push_subscriptions: own read" on __APP__.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "push_subscriptions: own delete" on __APP__.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));

-- Simpan langganan perangkat ini untuk user sekarang (HP dipakai bergantian → baris lama diganti)
create or replace function __APP__.push_subscribe(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_app_role('__APP__', 'viewer') then
    raise exception 'Tidak punya akses ke app ini.' using errcode = '42501';
  end if;
  insert into __APP__.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values ((select auth.uid()), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
     set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
         user_agent = excluded.user_agent, last_used_at = now();
end $$;

-- Target push HANYA untuk notifikasi yang dibuat pemanggil ≤ 2 menit terakhir
create or replace function __APP__.push_targets(p_notification_ids uuid[])
returns table (notification_id uuid, endpoint text, p256dh text, auth text,
               title text, body text, href text, tag text)
language sql stable security definer set search_path = '' as $$
  select n.id, s.endpoint, s.p256dh, s.auth, n.title, n.body, n.href,
         coalesce(n.entity || ':' || n.record_id, n.type)
    from __APP__.notifications n
    join __APP__.push_subscriptions s on s.user_id = n.user_id
   where n.id = any (p_notification_ids)
     and n.actor_id = (select auth.uid())
     and n.created_at > now() - interval '2 minutes';
$$;

-- Hapus endpoint mati (404/410), hanya milik penerima notifikasi pemanggil 5 menit terakhir
create or replace function __APP__.push_prune(p_endpoints text[])
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  delete from __APP__.push_subscriptions s
   where s.endpoint = any (p_endpoints)
     and exists (select 1 from __APP__.notifications x
                  where x.user_id = s.user_id and x.actor_id = (select auth.uid())
                    and x.created_at > now() - interval '5 minutes');
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function __APP__.push_subscribe(text, text, text, text), __APP__.push_targets(uuid[]),
  __APP__.push_prune(text[]) from public, anon;
