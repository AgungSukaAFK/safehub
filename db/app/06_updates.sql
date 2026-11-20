-- =====================================================================================
-- 06 UPDATE WEB (Pembaruan / changelog) · backend-guide §11.3
-- =====================================================================================

create table __APP__.updates (
  id              bigint generated always as identity primary key,
  version_major   integer not null check (version_major >= 0),
  version_minor   integer not null check (version_minor >= 0),
  version_patch   integer not null check (version_patch >= 0),
  version         text generated always as (version_major || '.' || version_minor || '.' || version_patch) stored,
  title           text not null check (length(btrim(title)) between 1 and 200),
  thumbnail_path  text check (length(thumbnail_path) <= 500),
  highlights      text[] not null default '{}' check (cardinality(highlights) <= 10),
  content         jsonb not null default '{}'::jsonb,
  created_by      uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (version_major, version_minor, version_patch),
  constraint updates_content_size check (pg_column_size(content) < 262144)
);
comment on table __APP__.updates is 'Post Pembaruan (changelog). Versi harus naik. Ditulis admin app.';
create index updates_created_by_idx on __APP__.updates (created_by);

-- Versi baru harus lebih besar dari versi terbesar yang ada (edit boleh mempertahankan versinya)
create or replace function __APP__.updates_version_guard()
returns trigger language plpgsql set search_path = '' as $$
declare v_max integer[];
begin
  if tg_op = 'UPDATE' and (new.version_major, new.version_minor, new.version_patch)
                          = (old.version_major, old.version_minor, old.version_patch) then
    return new;
  end if;
  select array[version_major, version_minor, version_patch] into v_max
    from __APP__.updates where id is distinct from new.id
   order by version_major desc, version_minor desc, version_patch desc limit 1;
  if v_max is not null and array[new.version_major, new.version_minor, new.version_patch] <= v_max then
    raise exception 'Versi harus lebih besar dari versi terakhir (%).', array_to_string(v_max, '.') using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function __APP__.updates_version_guard() from public, anon, authenticated;
create trigger updates_version_guard before insert or update on __APP__.updates
  for each row execute function __APP__.updates_version_guard();
create trigger updates_set_updated_at before update on __APP__.updates
  for each row execute function public.set_updated_at();

create table __APP__.update_reactions (
  update_id   bigint not null references __APP__.updates(id) on delete cascade,
  user_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  emoji       text not null check (emoji in ('👍', '❤️', '🎉', '😂', '😮', '🙏')),
  created_at  timestamptz not null default now(),
  primary key (update_id, user_id)
);
comment on table __APP__.update_reactions is 'Reaction post Pembaruan (satu emoji aktif per user per post).';
create index update_reactions_user_idx on __APP__.update_reactions (user_id);

create table __APP__.update_comments (
  id          uuid primary key default gen_random_uuid(),
  update_id   bigint not null references __APP__.updates(id) on delete cascade,
  user_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body        text not null check (length(btrim(body)) between 1 and 2000),
  reply_to    uuid references __APP__.update_comments(id) on delete set null,
  created_at  timestamptz not null default now()
);
comment on table __APP__.update_comments is 'Komentar post Pembaruan.';
create index update_comments_update_idx on __APP__.update_comments (update_id, created_at);
create index update_comments_user_idx on __APP__.update_comments (user_id);
create index update_comments_reply_idx on __APP__.update_comments (reply_to);

create table __APP__.update_seen (
  user_id       uuid primary key default auth.uid() references public.profiles(id) on delete cascade,
  last_seen_id  bigint not null default 0,
  seen_at       timestamptz not null default now()
);
comment on table __APP__.update_seen is 'Post Pembaruan terakhir yang sudah dilihat user (per akun, lintas perangkat).';

alter table __APP__.updates enable row level security;
alter table __APP__.update_reactions enable row level security;
alter table __APP__.update_comments enable row level security;
alter table __APP__.update_seen enable row level security;
revoke update on __APP__.update_comments from authenticated;

create policy "updates: viewer read" on __APP__.updates for select to authenticated
  using ((select public.has_app_role('__APP__', 'viewer')));
create policy "updates: admin insert" on __APP__.updates for insert to authenticated
  with check ((select public.has_app_role('__APP__', 'admin')));
create policy "updates: admin update" on __APP__.updates for update to authenticated
  using ((select public.has_app_role('__APP__', 'admin'))) with check ((select public.has_app_role('__APP__', 'admin')));
create policy "updates: admin delete" on __APP__.updates for delete to authenticated
  using ((select public.has_app_role('__APP__', 'admin')));

create policy "update_reactions: viewer read" on __APP__.update_reactions for select to authenticated
  using ((select public.has_app_role('__APP__', 'viewer')));
create policy "update_reactions: own insert" on __APP__.update_reactions for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.has_app_role('__APP__', 'viewer')));
create policy "update_reactions: own update" on __APP__.update_reactions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "update_reactions: own delete" on __APP__.update_reactions for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "update_comments: viewer read" on __APP__.update_comments for select to authenticated
  using ((select public.has_app_role('__APP__', 'viewer')));
create policy "update_comments: own insert" on __APP__.update_comments for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.has_app_role('__APP__', 'viewer')));
create policy "update_comments: own or admin delete" on __APP__.update_comments for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.has_app_role('__APP__', 'admin')));

create policy "update_seen: own read" on __APP__.update_seen for select to authenticated
  using (user_id = (select auth.uid()));
create policy "update_seen: own insert" on __APP__.update_seen for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "update_seen: own update" on __APP__.update_seen for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke delete on __APP__.update_seen from authenticated;
