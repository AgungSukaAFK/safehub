-- =====================================================================================
-- HANYA UNTUK CONTAINER UJI (scripts/db-test.sh). Di Supabase sungguhan tabel ini dibuat
-- storage-api. Tiruan minimal supaya policy storage di db/ bisa diuji.
-- =====================================================================================
create schema if not exists storage;

create table if not exists storage.buckets (
  id                  text primary key,
  name                text not null,
  public              boolean default false,
  file_size_limit     bigint,
  allowed_mime_types  text[],
  created_at          timestamptz default now()
);

create table if not exists storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets(id),
  name       text,
  owner      uuid,
  owner_id   text,
  metadata   jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated, anon;
grant select, insert, update, delete on storage.objects to authenticated;
grant select on storage.objects, storage.buckets to anon;

create or replace function storage.foldername(name text)
returns text[] language plpgsql immutable as $$
declare _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1:array_length(_parts, 1) - 1];
end $$;

-- Container uji: postgres harus bisa membuat policy (di Supabase sungguhan lewat supautils)
alter table storage.objects owner to postgres;
alter table storage.buckets owner to postgres;
