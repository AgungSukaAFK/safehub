-- =====================================================================================
-- HANYA UNTUK UJI LOKAL. JANGAN disalin ke lourdes-db.
-- Tiruan minimal platform Lourdes (lourdes-db): profiles, master, apps, app_access,
-- helper akses, audit. Dibuat dari deskripsi frontend/backend-guide karena repo
-- lourdes-db tidak tersedia saat boilerplate dibuat. Idempoten (aman dijalankan ulang).
-- =====================================================================================

create extension if not exists pg_trgm with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------- helper umum ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor_id    uuid,
  table_name  text not null,
  record_id   text,
  action      text not null,
  old_data    jsonb,
  new_data    jsonb
);
comment on table public.audit_log is '[STUB] Audit perubahan data platform.';
alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;

create or replace function public.audit_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into public.audit_log (actor_id, table_name, record_id, action, old_data, new_data)
  values ((select auth.uid()), tg_table_name, coalesce(v_row ->> 'id', v_row ->> 'code', v_row ->> 'user_id'),
          lower(tg_op),
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return null;
end $$;
revoke execute on function public.audit_row() from public, anon, authenticated;

-- ---------- master ----------
create table if not exists public.departments (
  id         uuid primary key default gen_random_uuid(),
  code       text unique,
  name       text not null,
  is_active  boolean not null default true
);
create table if not exists public.job_titles (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  is_active  boolean not null default true
);
create table if not exists public.locations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  is_active  boolean not null default true
);

-- ---------- profiles ----------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text,
  full_name     text not null,
  avatar_url    text,
  company       text constraint profiles_company_check check (company in ('GMI', 'GIS', 'LOURDES')),
  nrp_gmi       text,
  nrp_gis       text,
  phone         text,
  department_id uuid references public.departments(id),
  job_title_id  uuid references public.job_titles(id),
  location_id   uuid references public.locations(id),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table public.profiles is '[STUB] Profil karyawan (dikelola konsol monitoring).';
create index if not exists profiles_department_idx on public.profiles (department_id);
create index if not exists profiles_job_title_idx on public.profiles (job_title_id);
create index if not exists profiles_location_idx on public.profiles (location_id);

-- ---------- apps & akses ----------
create table if not exists public.apps (
  id           text primary key,
  name         text not null,
  description  text,
  url          text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);
create table if not exists public.app_access (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  app_id      text not null references public.apps(id) on delete cascade,
  role        text not null check (role in ('viewer', 'editor', 'admin')),
  granted_by  uuid references public.profiles(id) on delete set null,
  granted_at  timestamptz not null default now(),
  primary key (user_id, app_id)
);
create index if not exists app_access_app_idx on public.app_access (app_id, role);
create index if not exists app_access_granted_by_idx on public.app_access (granted_by);

insert into public.apps (id, name, description, url)
values ('platform', 'Platform Lourdes', 'Konsol monitoring & akun', 'https://monitoring.lourdes.cloud')
on conflict (id) do nothing;

create or replace function public.role_rank(p_role text)
returns integer language sql immutable set search_path = '' as $$
  select case p_role when 'admin' then 3 when 'editor' then 2 when 'viewer' then 1 else 0 end;
$$;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.app_access a join public.profiles p on p.id = a.user_id
     where a.user_id = (select auth.uid()) and p.is_active and a.app_id = 'platform' and a.role = 'admin');
$$;

create or replace function public.has_app_role(p_app text, p_role text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.app_access a join public.profiles p on p.id = a.user_id
     where a.user_id = (select auth.uid()) and p.is_active
       and ((a.app_id = p_app and public.role_rank(a.role) >= public.role_rank(p_role))
            or (a.app_id = 'platform' and a.role = 'admin')));
$$;

create or replace function public.my_apps()
returns table (id text, name text, description text, url text, role text)
language sql stable security definer set search_path = '' as $$
  select ap.id, ap.name, ap.description, ap.url, a.role
    from public.app_access a
    join public.apps ap on ap.id = a.app_id
    join public.profiles p on p.id = a.user_id
   where a.user_id = (select auth.uid()) and p.is_active and ap.is_active
   order by ap.name;
$$;

-- User biasa hanya boleh mengubah phone & avatar_url miliknya (pola profiles_guard)
create or replace function public.profiles_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if coalesce((select auth.role()), '') = 'authenticated' and not public.is_platform_admin() then
    if new.id is distinct from (select auth.uid()) then
      raise exception 'Tidak boleh mengubah profil orang lain' using errcode = '42501';
    end if;
    if (to_jsonb(new) - array['phone', 'avatar_url', 'updated_at'])
       is distinct from (to_jsonb(old) - array['phone', 'avatar_url', 'updated_at']) then
      raise exception 'Hanya No HP dan foto yang bisa diubah sendiri' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles for each row execute function public.profiles_guard();
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists audit_app_access on public.app_access;
create trigger audit_app_access after insert or update or delete on public.app_access
  for each row execute function public.audit_row();

-- ---------- RLS ----------
alter table public.departments enable row level security;
alter table public.job_titles enable row level security;
alter table public.locations enable row level security;
alter table public.profiles enable row level security;
alter table public.apps enable row level security;
alter table public.app_access enable row level security;

revoke all on public.departments, public.job_titles, public.locations, public.profiles, public.apps, public.app_access from anon;
grant select on public.departments, public.job_titles, public.locations, public.profiles, public.apps to authenticated;
grant update (phone, avatar_url) on public.profiles to authenticated;
grant select, insert, update, delete on public.app_access to authenticated;

drop policy if exists "departments: staff read" on public.departments;
create policy "departments: staff read" on public.departments for select to authenticated using (true);
drop policy if exists "job_titles: staff read" on public.job_titles;
create policy "job_titles: staff read" on public.job_titles for select to authenticated using (true);
drop policy if exists "locations: staff read" on public.locations;
create policy "locations: staff read" on public.locations for select to authenticated using (true);
drop policy if exists "apps: staff read" on public.apps;
create policy "apps: staff read" on public.apps for select to authenticated using (true);
drop policy if exists "profiles: staff read" on public.profiles;
create policy "profiles: staff read" on public.profiles for select to authenticated using (true);
drop policy if exists "profiles: own update" on public.profiles;
create policy "profiles: own update" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists "app_access: own or app admin read" on public.app_access;
create policy "app_access: own or app admin read" on public.app_access for select to authenticated
  using (user_id = (select auth.uid()) or public.has_app_role(app_id, 'admin'));
drop policy if exists "app_access: app admin insert" on public.app_access;
create policy "app_access: app admin insert" on public.app_access for insert to authenticated
  with check (public.has_app_role(app_id, 'admin') and (app_id <> 'platform' or (select public.is_platform_admin())));
drop policy if exists "app_access: app admin update" on public.app_access;
create policy "app_access: app admin update" on public.app_access for update to authenticated
  using (public.has_app_role(app_id, 'admin') and (app_id <> 'platform' or (select public.is_platform_admin())))
  with check (public.has_app_role(app_id, 'admin') and (app_id <> 'platform' or (select public.is_platform_admin())));
drop policy if exists "app_access: app admin delete" on public.app_access;
create policy "app_access: app admin delete" on public.app_access for delete to authenticated
  using (public.has_app_role(app_id, 'admin') and (app_id <> 'platform' or (select public.is_platform_admin())));

-- ---------- bucket avatars (platform) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "avatars: public read" on storage.objects;
create policy "avatars: public read" on storage.objects for select to authenticated, anon
  using (bucket_id = 'avatars');
drop policy if exists "avatars: own insert" on storage.objects;
create policy "avatars: own insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "avatars: own update" on storage.objects;
create policy "avatars: own update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "avatars: own delete" on storage.objects;
create policy "avatars: own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
