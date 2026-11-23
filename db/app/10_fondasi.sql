-- =====================================================================================
-- 10 FONDASI K3 (Safe Hub, fase 0) · rancangan-implementasi.md §2.1, §2.2, §2.11, §4.0
--   fungsi K3 (members.functions) · scope site (members.location_ids) · area per site ·
--   master app (kategori kejadian, tingkat risiko) · perusahaan mitra · my_tasks()
-- Penomoran tahunan ada di 01_base (next_doc_number(..., 'year')).
-- =====================================================================================

-- ---------------------------------------------------------------- fungsi K3 (§2.1)
-- Fungsi K3 user aktif yang punya akses app. '{}' kalau tidak ada / nonaktif / tanpa akses.
-- Untuk policy: `'hse' = any ((select __APP__.my_functions())::text[])` (K8, initplan sekali).
create or replace function __APP__.my_functions()
returns text[] language sql stable security definer set search_path = '' as $$
  select coalesce((
    select m.functions
      from __APP__.members m
      join public.profiles p on p.id = m.user_id and p.is_active
     where m.user_id = (select auth.uid())
       and public.has_app_role('__APP__', 'viewer')
  ), '{}');
$$;

create or replace function __APP__.has_function(p_function text)
returns boolean language sql stable set search_path = '' as $$
  select p_function = any (__APP__.my_functions());
$$;

create or replace function __APP__.has_any_function(p_functions text[])
returns boolean language sql stable set search_path = '' as $$
  select __APP__.my_functions() && p_functions;
$$;

-- ---------------------------------------------------------------- scope site (§2.2)
-- '{*}' = semua site (admin platform, atau members.location_ids null / belum ada baris members)
-- '{}'  = tidak ada (profil tidak ditemukan / nonaktif)
-- selain itu = id site (text) yang boleh dilihat.
create or replace function __APP__.my_location_scope()
returns text[] language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case
      when public.is_platform_admin() or m.location_ids is null then array['*']
      else (select coalesce(array_agg(x::text), '{}') from unnest(m.location_ids) as x)
    end
    from public.profiles p
    left join __APP__.members m on m.user_id = p.id
    where p.id = (select auth.uid()) and p.is_active
  ), '{}');
$$;

create or replace function __APP__.location_visible(p_location uuid)
returns boolean language sql stable set search_path = '' as $$
  select '*' = any (__APP__.my_location_scope()) or p_location::text = any (__APP__.my_location_scope());
$$;

-- Site aktif yang boleh dilihat user (opsi pemilih site di top bar)
create or replace function __APP__.my_sites()
returns table (id uuid, name text)
language sql stable security invoker set search_path = '' as $$
  select l.id, l.name
    from public.locations l
   where l.is_active
     and ('*' = any ((select __APP__.my_location_scope())::text[])
          or l.id::text = any ((select __APP__.my_location_scope())::text[]))
   order by l.name;
$$;
revoke execute on function __APP__.my_sites() from public, anon;

-- ---------------------------------------------------------------- area per site (§2.2)
create table __APP__.areas (
  id           uuid primary key default gen_random_uuid(),
  location_id  uuid not null references public.locations(id),
  name         text not null check (length(btrim(name)) between 2 and 100),
  sort_order   integer not null default 0,
  is_active    boolean not null default true,
  created_by   uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on table __APP__.areas is 'Area di dalam site (public.locations): Workshop, Pit, Hauling Road. Dinonaktifkan, tidak dihapus.';
create unique index areas_name_uq on __APP__.areas (location_id, lower(btrim(name)));
create index areas_location_idx on __APP__.areas (location_id, is_active, sort_order);

create table __APP__.areas_logs (
  id         bigint generated always as identity primary key,
  record_id  uuid not null,
  at         timestamptz not null default now(),
  actor_id   uuid references public.profiles(id) on delete set null,
  action     text not null check (action ~ '^[a-z][a-z0-9_]{1,40}$'),
  changes    jsonb,
  note       text check (length(note) <= 2000)
);
create index areas_logs_record_idx on __APP__.areas_logs (record_id, at desc);

create trigger areas_set_updated_at before update on __APP__.areas
  for each row execute function public.set_updated_at();
create trigger areas_log after insert or update or delete on __APP__.areas
  for each row execute function __APP__.log_changes('config', '', 'Area');

alter table __APP__.areas enable row level security;
alter table __APP__.areas_logs enable row level security;
revoke insert, update, delete on __APP__.areas_logs from authenticated;
revoke delete on __APP__.areas from authenticated;
create policy "areas: viewer read" on __APP__.areas for select to authenticated
  using ((select public.has_app_role('__APP__', 'viewer'))
         and ('*' = any ((select __APP__.my_location_scope())::text[])
              or location_id::text = any ((select __APP__.my_location_scope())::text[])));
create policy "areas: admin insert" on __APP__.areas for insert to authenticated
  with check ((select public.has_app_role('__APP__', 'admin')));
create policy "areas: admin update" on __APP__.areas for update to authenticated
  using ((select public.has_app_role('__APP__', 'admin')))
  with check ((select public.has_app_role('__APP__', 'admin')));
create policy "areas_logs: admin read" on __APP__.areas_logs for select to authenticated
  using ((select public.has_app_role('__APP__', 'admin')));

-- ---------------------------------------------------------------- master app (§4.13)
-- Lookup kecil berkode. `code` dipakai logika (mis. KPI) → tidak bisa diubah setelah dibuat;
-- label, urutan, warna, status aktif boleh diubah admin. Tidak dihapus (nonaktifkan).
create table __APP__.master_items (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('incident_category', 'risk_level', 'finding_category', 'inspection_type')),
  code         text not null check (code ~ '^[a-z][a-z0-9_]{1,40}$'),
  name         text not null check (length(btrim(name)) between 1 and 100),
  description  text check (length(description) <= 500),
  color        text check (color in ('gray', 'blue', 'amber', 'violet', 'green', 'red', 'orange', 'sky')),
  sort_order   integer not null default 0,
  is_active    boolean not null default true,
  created_by   uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (kind, code)
);
comment on table __APP__.master_items is 'Master app berkode: kategori kejadian & temuan, tingkat risiko. Kode tetap; label boleh diubah.';
create unique index master_items_name_uq on __APP__.master_items (kind, lower(btrim(name)));

create table __APP__.master_items_logs (
  id         bigint generated always as identity primary key,
  record_id  uuid not null,
  at         timestamptz not null default now(),
  actor_id   uuid references public.profiles(id) on delete set null,
  action     text not null check (action ~ '^[a-z][a-z0-9_]{1,40}$'),
  changes    jsonb,
  note       text check (length(note) <= 2000)
);
create index master_items_logs_record_idx on __APP__.master_items_logs (record_id, at desc);

create or replace function __APP__.master_items_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.code is distinct from old.code or new.kind is distinct from old.kind then
    raise exception 'Kode dan jenis master tidak bisa diubah. Buat entri baru lalu nonaktifkan yang lama.'
      using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function __APP__.master_items_guard() from public, anon, authenticated;

create trigger master_items_guard before update on __APP__.master_items
  for each row execute function __APP__.master_items_guard();
create trigger master_items_set_updated_at before update on __APP__.master_items
  for each row execute function public.set_updated_at();
create trigger master_items_log after insert or update or delete on __APP__.master_items
  for each row execute function __APP__.log_changes('config', '', 'Master data');

alter table __APP__.master_items enable row level security;
alter table __APP__.master_items_logs enable row level security;
revoke insert, update, delete on __APP__.master_items_logs from authenticated;
revoke delete on __APP__.master_items from authenticated;
create policy "master_items: viewer read" on __APP__.master_items for select to authenticated
  using ((select public.has_app_role('__APP__', 'viewer')));
create policy "master_items: admin insert" on __APP__.master_items for insert to authenticated
  with check ((select public.has_app_role('__APP__', 'admin')));
create policy "master_items: admin update" on __APP__.master_items for update to authenticated
  using ((select public.has_app_role('__APP__', 'admin')))
  with check ((select public.has_app_role('__APP__', 'admin')));
create policy "master_items_logs: admin read" on __APP__.master_items_logs for select to authenticated
  using ((select public.has_app_role('__APP__', 'admin')));

-- Nilai awal dari prototipe (data referensi app, bukan data DEMO)
insert into __APP__.master_items (kind, code, name, color, sort_order) values
  ('incident_category', 'near_miss',            'Near Miss',              null, 10),
  ('incident_category', 'injury',               'Cedera',                 null, 20),
  ('incident_category', 'property_damage',      'Kerusakan Properti',     null, 30),
  ('incident_category', 'fire',                 'Kebakaran',              null, 40),
  ('incident_category', 'occupational_disease', 'Penyakit Akibat Kerja',  null, 50),
  ('incident_category', 'environment',          'Lingkungan',             null, 60),
  ('incident_category', 'other',                'Lainnya',                null, 99),
  ('risk_level',        'low',                  'Rendah',                 'green', 10),
  ('risk_level',        'medium',               'Sedang',                 'amber', 20),
  ('risk_level',        'high',                 'Tinggi',                 'orange', 30),
  ('risk_level',        'critical',             'Kritis',                 'red',   40),
  ('finding_category',  'operational_safety',   'Keselamatan Operasional', null, 10),
  ('finding_category',  'occupational_health',  'Kesehatan Kerja',        null, 20),
  ('finding_category',  'environment',          'Lingkungan',             null, 30),
  ('finding_category',  'housekeeping',         'Housekeeping',           null, 40),
  ('finding_category',  'equipment_ppe',        'Peralatan & APD',        null, 50),
  ('finding_category',  'documents',            'Dokumen & Prosedur',     null, 60),
  ('inspection_type',   'padlock',              'Inspeksi Padlock',               'blue',   10),
  ('inspection_type',   'lv',                   'Inspeksi LV',                    'sky',    20),
  ('inspection_type',   'work_equipment',       'Inspeksi Peralatan Kerja',       'amber',  30),
  ('inspection_type',   'first_aid_fire',       'Inspeksi Kotak P3K & APAR',      'violet', 40),
  ('inspection_type',   'maintenance_obs',      'Observasi Maintenance',          'gray',   50),
  ('inspection_type',   'internal_audit',       'Audit Internal',                 'red',    60)
on conflict (kind, code) do nothing;

-- ---------------------------------------------------------------- perusahaan mitra (§4.0, §4.7)
-- Versi awal: daftar mitra per company. Legalitas, izin, kontrak, CSMS ditambah di fase 4.
create table __APP__.contractors (
  id            uuid primary key default gen_random_uuid(),
  company_code  text not null references public.companies(code),
  name          text not null check (length(btrim(name)) between 2 and 200),
  kind          text not null default 'subkontraktor' check (kind in ('subkontraktor', 'vendor')),
  is_active     boolean not null default true,
  created_by    uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table __APP__.contractors is 'Perusahaan mitra (subkontraktor/vendor) per company. Diperluas di modul Kontraktor (fase 4).';
create unique index contractors_name_uq on __APP__.contractors (company_code, lower(btrim(name)));
create index contractors_company_idx on __APP__.contractors (company_code, is_active, name);

create table __APP__.contractors_logs (
  id         bigint generated always as identity primary key,
  record_id  uuid not null,
  at         timestamptz not null default now(),
  actor_id   uuid references public.profiles(id) on delete set null,
  action     text not null check (action ~ '^[a-z][a-z0-9_]{1,40}$'),
  changes    jsonb,
  note       text check (length(note) <= 2000)
);
create index contractors_logs_record_idx on __APP__.contractors_logs (record_id, at desc);

create trigger contractors_set_updated_at before update on __APP__.contractors
  for each row execute function public.set_updated_at();
create trigger contractors_log after insert or update or delete on __APP__.contractors
  for each row execute function __APP__.log_changes('config', '', 'Mitra');

alter table __APP__.contractors enable row level security;
alter table __APP__.contractors_logs enable row level security;
revoke insert, update, delete on __APP__.contractors_logs from authenticated;
revoke delete on __APP__.contractors from authenticated;
create policy "contractors: viewer read" on __APP__.contractors for select to authenticated
  using ((select public.has_app_role('__APP__', 'viewer'))
         and ('*' = any ((select __APP__.my_company_scope())::text[])
              or company_code = any ((select __APP__.my_company_scope())::text[])));
create policy "contractors: admin insert" on __APP__.contractors for insert to authenticated
  with check ((select public.has_app_role('__APP__', 'admin'))
              and ('*' = any ((select __APP__.my_company_scope())::text[])
                   or company_code = any ((select __APP__.my_company_scope())::text[])));
create policy "contractors: admin update" on __APP__.contractors for update to authenticated
  using ((select public.has_app_role('__APP__', 'admin'))
         and ('*' = any ((select __APP__.my_company_scope())::text[])
              or company_code = any ((select __APP__.my_company_scope())::text[])))
  with check ('*' = any ((select __APP__.my_company_scope())::text[])
              or company_code = any ((select __APP__.my_company_scope())::text[]));
create policy "contractors_logs: admin read" on __APP__.contractors_logs for select to authenticated
  using ((select public.has_app_role('__APP__', 'admin')));

-- ---------------------------------------------------------------- Tugas Saya (§2.11)
-- SATU sumber /tugas dan badge menu. Setiap modul menambah cabang `union all` di sini.
--   task_group: action (Perlu Tindakan) | verification (Menunggu Verifikasi) | approval | scheduled
--   ref_type  : doc_type approval atau nama entitas workflow; code/title boleh null (approval:
--               diperkaya di lib/approval.ts lewat DOC_SUMMARY).
create or replace function __APP__.my_tasks(p_limit integer default 200)
returns table (kind text, task_group text, ref_type text, ref_id uuid, code text, title text, status text,
               due_at timestamptz, waiting_since timestamptz, href text, meta jsonb)
language sql stable security invoker set search_path = '' as $$
  select t.* from (
    select 'approval'::text, 'approval'::text, q.doc_type, q.record_id, null::text, q.doc_label,
           q.approval_type, q.due_at, q.waiting_since, q.href,
           jsonb_build_object('approval_id', q.approval_id, 'step_no', q.step_no,
                              'followup_count', q.followup_count, 'last_followup_at', q.last_followup_at)
      from __APP__.pending_for_me(200) q
  ) t (kind, task_group, ref_type, ref_id, code, title, status, due_at, waiting_since, href, meta)
  order by t.due_at asc nulls last, t.waiting_since asc
  limit least(greatest(p_limit, 1), 500);
$$;
revoke execute on function __APP__.my_tasks(integer) from public, anon;
