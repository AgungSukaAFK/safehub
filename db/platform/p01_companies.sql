-- =====================================================================================
-- PLATFORM (sekali untuk seluruh Lourdes) · backend-guide §2.1
-- Ditulis di lourdes-db sebagai <ts>_platform_companies.sql. Dry-run + konfirmasi user.
-- =====================================================================================

create table public.companies (
  code                text primary key check (code ~ '^[A-Z][A-Z0-9_]{1,15}$'),
  name                text not null check (length(btrim(name)) between 1 and 200),
  short_name          text not null check (length(btrim(short_name)) between 1 and 30),
  address             text check (length(address) <= 500),
  phone               text check (length(phone) <= 50),
  email               text check (length(email) <= 200),
  logo_url            text,
  logo_landscape_url  text,
  accent              text not null default 'zinc' check (accent ~ '^[a-z][a-z0-9-]{1,30}$'),
  is_group            boolean not null default false,   -- true = mencakup semua anak perusahaan (LOURDES)
  sort_order          integer not null default 0,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
comment on table public.companies is
  'Master perusahaan grup Lourdes. Dikelola platform admin (konsol monitoring); nonaktifkan, jangan hapus.';

insert into public.companies (code, name, short_name, address, phone, email, logo_url, logo_landscape_url, accent, is_group, sort_order) values
  ('GMI', 'PT. Garuda Mart Indonesia', 'GMI', 'Sakura Regency Blok J5-8A, Jatiasih, Bekasi 17423 - Indonesia',
   '(021) 824-073-09', 'info@garudamart.com', '/gmi-logo.webp', '/gmi-landscape-stroke.webp', 'gmi', false, 1),
  ('GIS', 'PT. Global Inti Sejati', 'GIS', 'Jl. Wibawa Mukti II No.88, RT.003/RW.001, Jatiluhur, Kec. Jatiasih, Kota Bks, Jawa Barat 17425',
   '(021) 82-741-900', 'info@globalinti.com', '/gis-logo.webp', '/gis-landscape.webp', 'gis', false, 2),
  ('LOURDES', 'Lourdes Auto Parts', 'Lourdes', 'Sakura Regency J5-8A, Jati Asih, Bekasi 17423',
   '(+021) 82407309', 'info@garudamart.com', '/lourdes-logo.webp', '/lourdes-logo.webp', 'zinc', true, 0);

create trigger companies_set_updated_at before update on public.companies
  for each row execute function public.set_updated_at();
create trigger audit_companies after insert or update or delete on public.companies
  for each row execute function public.audit_row();

alter table public.companies enable row level security;
revoke all on public.companies from anon;
grant select, insert, update on public.companies to authenticated;
create policy "companies: staff read" on public.companies
  for select to authenticated using (true);
create policy "companies: platform admin insert" on public.companies
  for insert to authenticated with check ((select public.is_platform_admin()));
create policy "companies: platform admin update" on public.companies
  for update to authenticated
  using ((select public.is_platform_admin())) with check ((select public.is_platform_admin()));

-- Tahap 1: profiles.company menjadi FK (check constraint lama dilepas di tahap 2, §2.1)
alter table public.profiles add constraint profiles_company_fkey
  foreign key (company) references public.companies(code);
create index if not exists profiles_company_idx on public.profiles (company);
