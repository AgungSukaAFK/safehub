-- =====================================================================================
-- PLATFORM · CCTV: jejak aksi penting semua app (append-only) · backend-guide §2.2
-- Koreksi K2: batas ukuran memakai coalesce (pg_column_size(null) = null meloloskan check).
-- =====================================================================================

create table public.cctv_events (
  id            bigint generated always as identity primary key,
  at            timestamptz not null default now(),
  app_id        text not null references public.apps(id),
  actor_id      uuid references public.profiles(id) on delete set null,   -- null = sistem / publik
  actor_name    text,                                                     -- salinan nama saat kejadian
  category      text not null check (category in
                  ('auth', 'access', 'approval', 'data', 'export', 'security', 'config', 'public')),
  action        text not null check (action ~ '^[a-z][a-z0-9_.]{1,80}$'),
  severity      text not null default 'info' check (severity in ('info', 'notice', 'warning', 'critical')),
  entity        text,
  record_id     text,
  record_label  text,
  company_code  text,
  summary       text not null check (length(summary) between 1 and 500),
  url           text check (url is null or url ~ '^https://'),
  changes       jsonb,
  metadata      jsonb,
  client        jsonb,
  constraint cctv_events_size check (
    coalesce(pg_column_size(changes), 0) + coalesce(pg_column_size(metadata), 0) + coalesce(pg_column_size(client), 0) < 16384)
);
comment on table public.cctv_events is
  'CCTV: jejak aksi penting semua app (append-only). Ditulis lewat public.cctv_log(); dibaca konsol monitoring. Retensi 5 tahun.';

create index cctv_events_at_idx       on public.cctv_events (at desc);
create index cctv_events_app_idx      on public.cctv_events (app_id, at desc);
create index cctv_events_actor_idx    on public.cctv_events (actor_id, at desc);
create index cctv_events_record_idx   on public.cctv_events (app_id, entity, record_id, at desc);
create index cctv_events_severity_idx on public.cctv_events (severity, at desc) where severity in ('warning', 'critical');

alter table public.cctv_events enable row level security;
revoke all on public.cctv_events from anon, authenticated;
grant select on public.cctv_events to authenticated;
create policy "cctv_events: platform admin or app admin read" on public.cctv_events
  for select to authenticated
  using ((select public.is_platform_admin()) or public.has_app_role(app_id, 'admin'));

-- Append-only: tidak ada yang boleh mengubah/menghapus, kecuali job retensi (§2.3).
create or replace function public.cctv_events_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and current_setting('lourdes.retention', true) = 'on' then
    return old;
  end if;
  raise exception 'Rekaman CCTV tidak boleh diubah atau dihapus' using errcode = '42501';
end $$;
revoke execute on function public.cctv_events_immutable() from public, anon, authenticated;
create trigger cctv_events_immutable before update or delete on public.cctv_events
  for each row execute function public.cctv_events_immutable();

-- Satu-satunya pintu tulis
create or replace function public.cctv_log(
  p_app          text,
  p_category     text,
  p_action       text,
  p_summary      text,
  p_severity     text  default 'info',
  p_entity       text  default null,
  p_record_id    text  default null,
  p_record_label text  default null,
  p_company_code text  default null,
  p_url          text  default null,
  p_changes      jsonb default null,
  p_metadata     jsonb default null,
  p_client       jsonb default null
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := (select auth.uid());
  v_name text;
  v_id   bigint;
begin
  -- User login wajib punya akses ke app yang dilaporkan (tidak bisa memalsukan event app lain).
  -- auth.uid() null = fungsi internal/job atau halaman publik lewat fungsi definer.
  if v_uid is not null and not public.has_app_role(p_app, 'viewer') then
    raise exception 'Tidak punya akses ke app %', p_app using errcode = '42501';
  end if;
  if v_uid is not null then
    select full_name into v_name from public.profiles where id = v_uid;
  end if;

  insert into public.cctv_events (app_id, actor_id, actor_name, category, action, severity, entity,
    record_id, record_label, company_code, summary, url, changes, metadata, client)
  values (p_app, v_uid, v_name, p_category, p_action, p_severity, p_entity,
    p_record_id, left(p_record_label, 100), p_company_code, left(p_summary, 500), p_url, p_changes, p_metadata,
    case when p_client is null then null else jsonb_build_object(
      'ip', left(p_client ->> 'ip', 64), 'user_agent', left(p_client ->> 'user_agent', 300), 'path', left(p_client ->> 'path', 300)) end)
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.cctv_log(text, text, text, text, text, text, text, text, text, text, jsonb, jsonb, jsonb) from public, anon;
grant  execute on function public.cctv_log(text, text, text, text, text, text, text, text, text, text, jsonb, jsonb, jsonb) to authenticated, service_role;
