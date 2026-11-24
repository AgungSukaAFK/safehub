-- =====================================================================================
-- 13 TSP & AKTIVITAS K3 (Safe Hub, fase 3)
--   rancangan-implementasi §4.5 · spesifikasi docs/spec/fase-3-tsp-laporan.md
--
-- Pola sama dengan 11/12: tulis HANYA lewat RPC security definer (cek fungsi K3 + scope), tabel tanpa hak
-- tulis untuk authenticated. Satu aksi = satu baris log. Bukti = Storage `<host>-lampiran`:
--   tsp/<program_id>/<YYYY-MM>/<nama>   (realisasi program x bulan)
--   aktivitas/<activity_id>/<nama>      (aktivitas K3)
-- =====================================================================================

-- =====================================================================================
-- TABEL
-- =====================================================================================
create table __APP__.tsp_programs (
  id                uuid primary key default gen_random_uuid(),
  company_code      text not null references public.companies(code),
  location_id       uuid not null references public.locations(id),
  year              smallint not null check (year between 2020 and 2100),
  no                text not null check (length(btrim(no)) between 1 and 12),
  element           text not null check (length(btrim(element)) between 1 and 80),   -- mis. "1. Kebijakan"
  name              text not null check (length(btrim(name)) between 3 and 160),
  owner_label       text not null check (length(btrim(owner_label)) between 1 and 60),  -- PJO / HSE / All Departemen
  indicator         text not null check (length(btrim(indicator)) between 1 and 300),
  evidence_required text not null default '' check (length(evidence_required) <= 300),
  annual_target     smallint not null check (annual_target between 1 and 366),
  plan              smallint[] not null check (cardinality(plan) = 12 and 0 <= all (plan)),   -- rencana per bulan (Jan..Des)
  is_active         boolean not null default true,
  sort_order        integer not null default 0,
  created_by        uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (company_code, location_id, year, no)
);
comment on table __APP__.tsp_programs is 'Program TSP tahunan per site (rancangan §4.5). Rencana per bulan = kolom plan. Ditulis HANYA lewat tsp_program_save.';
create index tsp_programs_list_idx on __APP__.tsp_programs (company_code, location_id, year, sort_order, no);

create table __APP__.tsp_programs_logs (
  id         bigint generated always as identity primary key,
  record_id  uuid not null,
  at         timestamptz not null default now(),
  actor_id   uuid references public.profiles(id) on delete set null,
  action     text not null check (action ~ '^[a-z][a-z0-9_]{1,40}$'),
  changes    jsonb,
  note       text check (length(note) <= 2000)
);
create index tsp_programs_logs_record_idx on __APP__.tsp_programs_logs (record_id, at desc);

-- realisasi manual program x bulan (aktual efektif = terbesar antara ini dan jumlah aktivitas terkait)
create table __APP__.tsp_realizations (
  id             uuid primary key default gen_random_uuid(),
  program_id     uuid not null references __APP__.tsp_programs(id) on delete cascade,
  month          smallint not null check (month between 1 and 12),
  actual         smallint not null default 0 check (actual between 0 and 366),
  note           text check (length(note) <= 1000),
  evidence_count integer not null default 0 check (evidence_count >= 0),
  created_by     uuid references public.profiles(id) on delete set null default auth.uid(),
  updated_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (program_id, month)
);
create table __APP__.tsp_realizations_logs (
  id         bigint generated always as identity primary key,
  record_id  uuid not null,
  at         timestamptz not null default now(),
  actor_id   uuid references public.profiles(id) on delete set null,
  action     text not null check (action ~ '^[a-z][a-z0-9_]{1,40}$'),
  changes    jsonb,
  note       text check (length(note) <= 2000)
);
create index tsp_realizations_logs_record_idx on __APP__.tsp_realizations_logs (record_id, at desc);

-- aktivitas K3 (safety talk, sosialisasi, kampanye, ...) yang menjadi realisasi TSP dan leading indicator
create table __APP__.safety_activities (
  id               uuid primary key default gen_random_uuid(),
  code             text not null,
  company_code     text not null references public.companies(code),
  location_id      uuid not null references public.locations(id),
  area_id          uuid not null references __APP__.areas(id),
  type_code        text not null check (type_code in ('safety_talk', 'sosialisasi_jsa', 'sosialisasi_ik', 'sosialisasi_sop',
                                                       'kampanye_k3', 'inspeksi_bersama', 'lainnya')),
  activity_date    date not null,
  leader_id        uuid not null references public.profiles(id),
  participant_count integer not null default 0 check (participant_count between 0 and 100000),
  program_id       uuid references __APP__.tsp_programs(id) on delete set null,
  notes            text check (length(notes) <= 2000),
  evidence_count   integer not null default 0 check (evidence_count >= 0),
  search_text      text,
  created_by       uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (company_code, code)
);
comment on table __APP__.safety_activities is 'Aktivitas K3. Bila program_id terisi, ikut menghitung aktual program di bulan aktivitas. Ditulis lewat safety_activity_save.';
create index safety_activities_list_idx    on __APP__.safety_activities (company_code, location_id, activity_date desc);
create index safety_activities_program_idx on __APP__.safety_activities (program_id, activity_date) where program_id is not null;
create index safety_activities_search_idx  on __APP__.safety_activities using gin (search_text extensions.gin_trgm_ops);

create table __APP__.safety_activities_logs (
  id         bigint generated always as identity primary key,
  record_id  uuid not null,
  at         timestamptz not null default now(),
  actor_id   uuid references public.profiles(id) on delete set null,
  action     text not null check (action ~ '^[a-z][a-z0-9_]{1,40}$'),
  changes    jsonb,
  note       text check (length(note) <= 2000)
);
create index safety_activities_logs_record_idx on __APP__.safety_activities_logs (record_id, at desc);

-- evaluasi bulanan (HSE menyusun, PJO menyetujui)
create table __APP__.tsp_evaluations (
  id           uuid primary key default gen_random_uuid(),
  company_code text not null references public.companies(code),
  location_id  uuid not null references public.locations(id),
  year         smallint not null check (year between 2020 and 2100),
  month        smallint not null check (month between 1 and 12),
  status       text not null default 'draft' check (status in ('draft', 'submitted', 'approved', 'returned')),
  summary      jsonb,                                   -- snapshot saat diajukan
  prepared_by  uuid references public.profiles(id) on delete set null,
  submitted_at timestamptz,
  decided_by   uuid references public.profiles(id) on delete set null,
  decided_at   timestamptz,
  decision_note text check (length(decision_note) <= 2000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (company_code, location_id, year, month)
);
create table __APP__.tsp_evaluations_logs (
  id         bigint generated always as identity primary key,
  record_id  uuid not null,
  at         timestamptz not null default now(),
  actor_id   uuid references public.profiles(id) on delete set null,
  action     text not null check (action ~ '^[a-z][a-z0-9_]{1,40}$'),
  changes    jsonb,
  note       text check (length(note) <= 2000)
);
create index tsp_evaluations_logs_record_idx on __APP__.tsp_evaluations_logs (record_id, at desc);

-- =====================================================================================
-- TRIGGER
-- =====================================================================================
create or replace function __APP__.safety_activities_search_text()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.search_text := lower(concat_ws(' ', new.code, replace(new.type_code, '_', ' '), new.notes));
  return new;
end $$;
revoke execute on function __APP__.safety_activities_search_text() from public, anon, authenticated;

create trigger tsp_programs_set_updated_at before update on __APP__.tsp_programs
  for each row execute function public.set_updated_at();
create trigger tsp_programs_log after insert or update or delete on __APP__.tsp_programs
  for each row execute function __APP__.log_changes('config', '/tsp#', 'Program TSP');

create trigger tsp_realizations_set_updated_at before update on __APP__.tsp_realizations
  for each row execute function public.set_updated_at();
create trigger tsp_realizations_log after insert or update or delete on __APP__.tsp_realizations
  for each row execute function __APP__.log_changes('important', '/tsp#', 'Realisasi TSP');

create trigger safety_activities_set_updated_at before update on __APP__.safety_activities
  for each row execute function public.set_updated_at();
create trigger safety_activities_search before insert or update on __APP__.safety_activities
  for each row execute function __APP__.safety_activities_search_text();
create trigger safety_activities_log after insert or update or delete on __APP__.safety_activities
  for each row execute function __APP__.log_changes('important', '/tsp/aktivitas#', 'Aktivitas K3');

create trigger tsp_evaluations_set_updated_at before update on __APP__.tsp_evaluations
  for each row execute function public.set_updated_at();
create trigger tsp_evaluations_log after insert or update or delete on __APP__.tsp_evaluations
  for each row execute function __APP__.log_changes('important', '/tsp#', 'Evaluasi TSP');

-- =====================================================================================
-- RLS: baca = staf K3 (bukan Karyawan) dalam scope company + site; tulis hanya lewat RPC
-- =====================================================================================
create or replace function __APP__.k3_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_app_role('__APP__', 'admin')
      or (public.has_app_role('__APP__', 'viewer') and __APP__.my_functions() && array['hse', 'hse_senior', 'manajemen', 'pjo', 'pja',
          'pengawas', 'hr', 'maintenance', 'scm', 'kontraktor_admin', 'auditor']);
$$;
revoke execute on function __APP__.k3_staff() from public, anon;

alter table __APP__.tsp_programs enable row level security;
alter table __APP__.tsp_programs_logs enable row level security;
alter table __APP__.tsp_realizations enable row level security;
alter table __APP__.tsp_realizations_logs enable row level security;
alter table __APP__.safety_activities enable row level security;
alter table __APP__.safety_activities_logs enable row level security;
alter table __APP__.tsp_evaluations enable row level security;
alter table __APP__.tsp_evaluations_logs enable row level security;

revoke insert, update, delete on __APP__.tsp_programs, __APP__.tsp_programs_logs, __APP__.tsp_realizations,
  __APP__.tsp_realizations_logs, __APP__.safety_activities, __APP__.safety_activities_logs, __APP__.tsp_evaluations,
  __APP__.tsp_evaluations_logs from authenticated, anon;

create policy "tsp_programs: staff read" on __APP__.tsp_programs for select to authenticated
  using ((select __APP__.k3_staff())
         and ('*' = any ((select __APP__.my_company_scope())::text[]) or company_code = any ((select __APP__.my_company_scope())::text[]))
         and ('*' = any ((select __APP__.my_location_scope())::text[]) or location_id::text = any ((select __APP__.my_location_scope())::text[])));
create policy "tsp_realizations: read with program" on __APP__.tsp_realizations for select to authenticated
  using (exists (select 1 from __APP__.tsp_programs p where p.id = program_id));
create policy "safety_activities: staff read" on __APP__.safety_activities for select to authenticated
  using ((select __APP__.k3_staff())
         and ('*' = any ((select __APP__.my_company_scope())::text[]) or company_code = any ((select __APP__.my_company_scope())::text[]))
         and ('*' = any ((select __APP__.my_location_scope())::text[]) or location_id::text = any ((select __APP__.my_location_scope())::text[])));
create policy "tsp_evaluations: staff read" on __APP__.tsp_evaluations for select to authenticated
  using ((select __APP__.k3_staff())
         and ('*' = any ((select __APP__.my_company_scope())::text[]) or company_code = any ((select __APP__.my_company_scope())::text[]))
         and ('*' = any ((select __APP__.my_location_scope())::text[]) or location_id::text = any ((select __APP__.my_location_scope())::text[])));
create policy "tsp_programs_logs: read with record" on __APP__.tsp_programs_logs for select to authenticated
  using (exists (select 1 from __APP__.tsp_programs p where p.id = record_id) or (select public.has_app_role('__APP__', 'admin')));
create policy "tsp_realizations_logs: read with record" on __APP__.tsp_realizations_logs for select to authenticated
  using (exists (select 1 from __APP__.tsp_realizations r where r.id = record_id) or (select public.has_app_role('__APP__', 'admin')));
create policy "safety_activities_logs: read with record" on __APP__.safety_activities_logs for select to authenticated
  using (exists (select 1 from __APP__.safety_activities a where a.id = record_id) or (select public.has_app_role('__APP__', 'admin')));
create policy "tsp_evaluations_logs: read with record" on __APP__.tsp_evaluations_logs for select to authenticated
  using (exists (select 1 from __APP__.tsp_evaluations e where e.id = record_id) or (select public.has_app_role('__APP__', 'admin')));

-- =====================================================================================
-- HELPER
-- =====================================================================================
-- hak mencatat realisasi / aktivitas: HSE, Pengawas, PJO (bukan auditor)
create or replace function __APP__.tsp_recorder()
returns boolean language sql stable security definer set search_path = '' as $$
  select __APP__.k3_writer() and __APP__.has_any_function(array['hse', 'pengawas', 'pjo']);
$$;
revoke execute on function __APP__.tsp_recorder() from public, anon;

create or replace function __APP__.tsp_program_visible(p_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from __APP__.tsp_programs p
                  where p.id = p_id and __APP__.k3_staff() and __APP__.k3_in_scope(p.company_code, p.location_id));
$$;
revoke execute on function __APP__.tsp_program_visible(uuid) from public, anon;

-- jumlah file di Storage untuk satu prefix folder
create or replace function __APP__.tsp_count_files(p_prefix text)
returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::integer from storage.objects o
   where o.bucket_id = '__HOST__-lampiran' and left(o.name, length(p_prefix)) = p_prefix;
$$;
revoke execute on function __APP__.tsp_count_files(text) from public, anon, authenticated;

-- =====================================================================================
-- RPC PROGRAM
-- =====================================================================================
-- p: {company_code?, location_id, year, no, element, name, owner_label, indicator, evidence_required?,
--     annual_target, plan: [12 angka], is_active?, sort_order?}  (p_id null = baru)
create or replace function __APP__.tsp_program_save(p_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid      uuid := auth.uid();
  v_id       uuid := p_id;
  v_company  text;
  v_location uuid := nullif(p ->> 'location_id', '')::uuid;
  v_year     smallint := nullif(p ->> 'year', '')::smallint;
  v_plan     smallint[];
  v_target   smallint := nullif(p ->> 'annual_target', '')::smallint;
begin
  if not (public.has_app_role('__APP__', 'admin') or (__APP__.k3_writer() and __APP__.has_function('hse'))) then
    raise exception 'Hanya HSE atau admin yang bisa mengelola program TSP.' using errcode = '42501';
  end if;
  select coalesce(nullif(p ->> 'company_code', ''), pr.company) into v_company from public.profiles pr where pr.id = v_uid;
  if v_company is null or not exists (select 1 from public.companies where code = v_company and not is_group) then
    raise exception 'Pilih perusahaan.' using errcode = 'P0001';
  end if;
  if v_location is null or not __APP__.k3_in_scope(v_company, v_location) then
    raise exception 'Site tidak valid atau di luar akses Anda.' using errcode = 'P0001';
  end if;
  if v_year is null or v_year < 2020 or v_year > 2100 then raise exception 'Tahun tidak valid.' using errcode = 'P0001'; end if;
  if jsonb_typeof(p -> 'plan') <> 'array' or jsonb_array_length(p -> 'plan') <> 12 then
    raise exception 'Rencana harus berisi 12 bulan.' using errcode = 'P0001';
  end if;
  select array_agg(least(greatest(x::integer, 0), 366)::smallint order by ord) into v_plan
    from jsonb_array_elements_text(p -> 'plan') with ordinality as t(x, ord);
  if v_target is null or v_target < 1 then raise exception 'Target tahunan wajib diisi (minimal 1).' using errcode = 'P0001'; end if;
  if length(btrim(coalesce(p ->> 'no', ''))) = 0 or length(btrim(coalesce(p ->> 'name', ''))) < 3
     or length(btrim(coalesce(p ->> 'element', ''))) = 0 or length(btrim(coalesce(p ->> 'owner_label', ''))) = 0
     or length(btrim(coalesce(p ->> 'indicator', ''))) = 0 then
    raise exception 'Nomor, elemen, nama program, penanggung jawab, dan indikator wajib diisi.' using errcode = 'P0001';
  end if;
  if exists (select 1 from __APP__.tsp_programs x
              where x.company_code = v_company and x.location_id = v_location and x.year = v_year
                and x.no = btrim(p ->> 'no') and x.id is distinct from v_id) then
    raise exception 'Nomor program % sudah dipakai di tahun dan site ini.', btrim(p ->> 'no') using errcode = 'P0001';
  end if;

  if v_id is null then
    insert into __APP__.tsp_programs (company_code, location_id, year, no, element, name, owner_label, indicator,
      evidence_required, annual_target, plan, is_active, sort_order)
    values (v_company, v_location, v_year, btrim(p ->> 'no'), btrim(p ->> 'element'), btrim(p ->> 'name'),
      btrim(p ->> 'owner_label'), btrim(p ->> 'indicator'), btrim(coalesce(p ->> 'evidence_required', '')), v_target, v_plan,
      coalesce((p ->> 'is_active')::boolean, true), coalesce((p ->> 'sort_order')::integer, 0))
    returning id into v_id;
  else
    perform 1 from __APP__.tsp_programs where id = v_id and __APP__.k3_in_scope(company_code, location_id) for update;
    if not found then raise exception 'Program tidak ditemukan.' using errcode = 'P0001'; end if;
    update __APP__.tsp_programs
       set company_code = v_company, location_id = v_location, year = v_year, no = btrim(p ->> 'no'),
           element = btrim(p ->> 'element'), name = btrim(p ->> 'name'), owner_label = btrim(p ->> 'owner_label'),
           indicator = btrim(p ->> 'indicator'), evidence_required = btrim(coalesce(p ->> 'evidence_required', '')),
           annual_target = v_target, plan = v_plan, is_active = coalesce((p ->> 'is_active')::boolean, true),
           sort_order = coalesce((p ->> 'sort_order')::integer, 0)
     where id = v_id;
  end if;
  return jsonb_build_object('id', v_id);
end $$;

-- =====================================================================================
-- RPC REALISASI & AKTIVITAS
-- =====================================================================================
-- Catat realisasi program x bulan. Bukti dihitung dari Storage tsp/<program>/<YYYY-MM>/ (unggah dulu, lalu simpan).
create or replace function __APP__.tsp_realization_save(p_program uuid, p_month integer, p_actual integer, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  pr       __APP__.tsp_programs;
  v_prefix text;
  v_ev     integer;
  v_id     uuid;
begin
  select * into pr from __APP__.tsp_programs where id = p_program;
  if pr.id is null or not __APP__.tsp_program_visible(p_program) then
    raise exception 'Program tidak ditemukan.' using errcode = 'P0001';
  end if;
  if not __APP__.tsp_recorder() then
    raise exception 'Hanya HSE, Pengawas, atau PJO yang bisa mencatat realisasi.' using errcode = '42501';
  end if;
  if p_month is null or p_month < 1 or p_month > 12 then raise exception 'Bulan tidak valid.' using errcode = 'P0001'; end if;
  if make_date(pr.year, p_month, 1) > date_trunc('month', __APP__.today_wib())::date then
    raise exception 'Realisasi bulan yang belum berjalan tidak bisa dicatat.' using errcode = 'P0001';
  end if;
  if p_actual is null or p_actual < 0 or p_actual > 366 then raise exception 'Aktual tidak valid.' using errcode = 'P0001'; end if;
  if exists (select 1 from __APP__.tsp_evaluations e
              where e.company_code = pr.company_code and e.location_id = pr.location_id and e.year = pr.year
                and e.month = p_month and e.status = 'approved') then
    raise exception 'Evaluasi bulan ini sudah disetujui; realisasi dikunci.' using errcode = 'P0001';
  end if;
  v_prefix := 'tsp/' || p_program || '/' || pr.year || '-' || lpad(p_month::text, 2, '0') || '/';
  v_ev := __APP__.tsp_count_files(v_prefix);
  insert into __APP__.tsp_realizations (program_id, month, actual, note, evidence_count, updated_by)
  values (p_program, p_month, p_actual, nullif(left(btrim(coalesce(p_note, '')), 1000), ''), v_ev, auth.uid())
  on conflict (program_id, month) do update
    set actual = excluded.actual, note = excluded.note, evidence_count = excluded.evidence_count, updated_by = auth.uid()
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'evidence_count', v_ev);
end $$;

-- Catat aktivitas. p: {location_id, area_id, type_code, activity_date, leader_id, participant_count?, program_id?, notes?, company_code?}
create or replace function __APP__.safety_activity_save(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid      uuid := auth.uid();
  v_company  text;
  v_location uuid := nullif(p ->> 'location_id', '')::uuid;
  v_area     uuid := nullif(p ->> 'area_id', '')::uuid;
  v_date     date := nullif(p ->> 'activity_date', '')::date;
  v_leader   uuid := nullif(p ->> 'leader_id', '')::uuid;
  v_program  uuid := nullif(p ->> 'program_id', '')::uuid;
  v_id       uuid;
  v_code     text;
begin
  if not __APP__.tsp_recorder() then
    raise exception 'Hanya HSE, Pengawas, atau PJO yang bisa mencatat aktivitas K3.' using errcode = '42501';
  end if;
  select coalesce(nullif(p ->> 'company_code', ''), pr.company) into v_company from public.profiles pr where pr.id = v_uid;
  if v_company is null or not exists (select 1 from public.companies where code = v_company and not is_group) then
    raise exception 'Pilih perusahaan.' using errcode = 'P0001';
  end if;
  if v_location is null or not __APP__.k3_in_scope(v_company, v_location) then
    raise exception 'Site tidak valid atau di luar akses Anda.' using errcode = 'P0001';
  end if;
  if v_area is null or not exists (select 1 from __APP__.areas where id = v_area and location_id = v_location and is_active) then
    raise exception 'Lokasi wajib dipilih dari area site ini.' using errcode = 'P0001';
  end if;
  if coalesce(p ->> 'type_code', '') not in ('safety_talk', 'sosialisasi_jsa', 'sosialisasi_ik', 'sosialisasi_sop',
                                              'kampanye_k3', 'inspeksi_bersama', 'lainnya') then
    raise exception 'Jenis aktivitas wajib dipilih.' using errcode = 'P0001';
  end if;
  if v_date is null or v_date > __APP__.today_wib() or v_date < __APP__.today_wib() - 400 then
    raise exception 'Tanggal aktivitas tidak valid (tidak boleh di masa depan).' using errcode = 'P0001';
  end if;
  if v_leader is null or not __APP__.k3_user_ok(v_leader) then
    raise exception 'Pelaksana wajib dipilih.' using errcode = 'P0001';
  end if;
  if v_program is not null and not exists (
       select 1 from __APP__.tsp_programs t
        where t.id = v_program and t.location_id = v_location and t.company_code = v_company
          and t.year = extract(year from v_date)::smallint and t.is_active) then
    raise exception 'Program TSP tidak cocok dengan site dan tahun aktivitas.' using errcode = 'P0001';
  end if;

  v_code := __APP__.next_doc_number('AKT', v_company, 'year');
  perform __APP__.set_log_context('create', null);
  insert into __APP__.safety_activities (code, company_code, location_id, area_id, type_code, activity_date, leader_id,
    participant_count, program_id, notes, created_by)
  values (v_code, v_company, v_location, v_area, p ->> 'type_code', v_date, v_leader,
    coalesce((p ->> 'participant_count')::integer, 0), v_program, nullif(left(btrim(coalesce(p ->> 'notes', '')), 2000), ''), v_uid)
  returning id into v_id;
  perform __APP__.set_log_context('', '');
  return jsonb_build_object('id', v_id, 'code', v_code);
end $$;

-- Hitung ulang bukti aktivitas dari Storage (dipanggil setelah unggah; hanya pembuat/HSE)
create or replace function __APP__.safety_activity_sync_evidence(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a __APP__.safety_activities; v_n integer;
begin
  select * into a from __APP__.safety_activities where id = p_id;
  if a.id is null or not __APP__.k3_in_scope(a.company_code, a.location_id) or not __APP__.k3_staff() then
    raise exception 'Aktivitas tidak ditemukan.' using errcode = 'P0001';
  end if;
  if not (__APP__.tsp_recorder() and (a.created_by = auth.uid() or __APP__.has_function('hse'))) then
    raise exception 'Hanya pembuat aktivitas atau HSE yang bisa memperbarui bukti.' using errcode = '42501';
  end if;
  v_n := __APP__.tsp_count_files('aktivitas/' || p_id || '/');
  update __APP__.safety_activities set evidence_count = v_n where id = p_id;
  return jsonb_build_object('evidence_count', v_n);
end $$;

-- =====================================================================================
-- MATRIKS & RINGKASAN (SATU sumber angka untuk halaman, evaluasi, ekspor, dan Beranda)
-- =====================================================================================
create or replace function __APP__.tsp_matrix(p_year integer, p_location uuid default null)
returns table (id uuid, location_id uuid, no text, element text, name text, owner_label text, indicator text,
               evidence_required text, annual_target integer, plan integer[], actual integer[], evidence integer[],
               notes text[], is_active boolean, sort_order integer)
language sql stable security invoker set search_path = '' as $$
  with progs as (
    select p.* from __APP__.tsp_programs p
     where p.year = p_year and (p_location is null or p.location_id = p_location)
  ), act as (
    select a.program_id, extract(month from a.activity_date)::integer as mo, count(*)::integer as n,
           coalesce(sum(a.evidence_count), 0)::integer as ev
      from __APP__.safety_activities a
     where a.program_id in (select id from progs)
     group by 1, 2
  )
  select p.id, p.location_id, p.no, p.element, p.name, p.owner_label, p.indicator, p.evidence_required,
         p.annual_target::integer, p.plan::integer[],
         array(select greatest(coalesce(r.actual, 0), coalesce(a.n, 0))::integer
                 from generate_series(1, 12) m
                 left join __APP__.tsp_realizations r on r.program_id = p.id and r.month = m
                 left join act a on a.program_id = p.id and a.mo = m order by m),
         array(select (coalesce(r.evidence_count, 0) + coalesce(a.ev, 0))::integer
                 from generate_series(1, 12) m
                 left join __APP__.tsp_realizations r on r.program_id = p.id and r.month = m
                 left join act a on a.program_id = p.id and a.mo = m order by m),
         array(select coalesce(r.note, '')
                 from generate_series(1, 12) m
                 left join __APP__.tsp_realizations r on r.program_id = p.id and r.month = m order by m),
         p.is_active, p.sort_order
    from progs p
   order by p.sort_order, p.no;
$$;
revoke execute on function __APP__.tsp_matrix(integer, uuid) from public, anon;

-- Ringkasan kumulatif s.d. bulan p_month: capaian = Σ min(aktual, rencana) per bulan ÷ Σ rencana.
-- Program tertinggal = capaian s.d. bulan < rencana s.d. bulan. Bukti lengkap = bulan beraktual > 0 yang punya bukti.
create or replace function __APP__.tsp_summary(p_year integer, p_month integer, p_location uuid default null)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  r          record;
  m          integer;
  v_plan     integer := 0;
  v_done     integer := 0;
  v_progs    integer := 0;
  v_met      integer := 0;
  v_months   integer := 0;
  v_with_ev  integer := 0;
  v_p        integer;
  v_d        integer;
  v_lag      jsonb := '[]';
  v_reason   text;
begin
  p_month := least(greatest(coalesce(p_month, 12), 1), 12);
  for r in select * from __APP__.tsp_matrix(p_year, p_location) x where x.is_active loop
    v_p := 0; v_d := 0; v_reason := null;
    for m in 1..p_month loop
      v_p := v_p + r.plan[m];
      v_d := v_d + least(r.actual[m], r.plan[m]);
      if r.actual[m] > 0 then
        v_months := v_months + 1;
        if r.evidence[m] > 0 then v_with_ev := v_with_ev + 1; end if;
      end if;
      if r.notes[m] <> '' then v_reason := r.notes[m]; end if;
    end loop;
    if v_p > 0 then
      v_progs := v_progs + 1; v_plan := v_plan + v_p; v_done := v_done + v_d;
      if v_d >= v_p then v_met := v_met + 1;
      else
        v_lag := v_lag || jsonb_build_array(jsonb_build_object('program_id', r.id, 'no', r.no, 'name', r.name,
                   'plan', v_p, 'actual', v_d, 'reason', v_reason));
      end if;
    end if;
  end loop;
  return jsonb_build_object(
    'year', p_year, 'month', p_month,
    'achievement', case when v_plan > 0 then round(v_done * 100.0 / v_plan) end,
    'programs_total', v_progs, 'programs_met', v_met,
    'evidence_pct', case when v_months > 0 then round(v_with_ev * 100.0 / v_months) end,
    'evidence_missing', v_months - v_with_ev,
    'lagging', v_lag);
end $$;
revoke execute on function __APP__.tsp_summary(integer, integer, uuid) from public, anon;

-- =====================================================================================
-- EVALUASI BULANAN (HSE menyusun → PJO menyetujui/mengembalikan)
-- =====================================================================================
create or replace function __APP__.tsp_evaluation_submit(p_year integer, p_month integer, p_location uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_company text;
  e         __APP__.tsp_evaluations;
  v_sum     jsonb;
  v_notif   uuid[];
begin
  if not (__APP__.k3_writer() and __APP__.has_function('hse')) then
    raise exception 'Hanya HSE yang bisa mengajukan evaluasi TSP.' using errcode = '42501';
  end if;
  select pr.company into v_company from public.profiles pr where pr.id = auth.uid();
  if p_location is null or v_company is null or not __APP__.k3_in_scope(v_company, p_location) then
    raise exception 'Site tidak valid atau di luar akses Anda.' using errcode = 'P0001';
  end if;
  if p_month < 1 or p_month > 12 or make_date(p_year, p_month, 1) > date_trunc('month', __APP__.today_wib())::date then
    raise exception 'Bulan evaluasi tidak valid.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from __APP__.tsp_programs where year = p_year and location_id = p_location and company_code = v_company and is_active) then
    raise exception 'Belum ada program TSP untuk site dan tahun ini.' using errcode = 'P0001';
  end if;
  v_sum := __APP__.tsp_summary(p_year, p_month, p_location);

  select * into e from __APP__.tsp_evaluations
   where company_code = v_company and location_id = p_location and year = p_year and month = p_month for update;
  if e.id is not null and e.status in ('submitted', 'approved') then
    raise exception 'Evaluasi bulan ini sudah diajukan atau disetujui.' using errcode = 'P0001';
  end if;
  perform __APP__.set_log_context('submit', null);
  if e.id is null then
    insert into __APP__.tsp_evaluations (company_code, location_id, year, month, status, summary, prepared_by, submitted_at)
    values (v_company, p_location, p_year, p_month, 'submitted', v_sum, auth.uid(), now()) returning * into e;
  else
    update __APP__.tsp_evaluations set status = 'submitted', summary = v_sum, prepared_by = auth.uid(), submitted_at = now(),
           decided_by = null, decided_at = null where id = e.id returning * into e;
  end if;
  perform __APP__.set_log_context('', '');
  select array_agg(n) into v_notif from __APP__.notify(__APP__.users_with_function(array['pjo'], v_company, p_location),
    'tsp.evaluation_submitted', format('Evaluasi TSP %s/%s menunggu persetujuan', lpad(p_month::text, 2, '0'), p_year),
    format('Capaian %s%%', coalesce(v_sum ->> 'achievement', '-')), '/tsp?tahun=' || p_year || '&bulan=' || p_month,
    'tsp', 'tsp_evaluations', e.id::text) n;
  return jsonb_build_object('id', e.id, 'notification_ids', coalesce(v_notif, '{}'));
end $$;

create or replace function __APP__.tsp_evaluation_decide(p_id uuid, p_approve boolean, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare e __APP__.tsp_evaluations; v_notif uuid[];
begin
  select * into e from __APP__.tsp_evaluations where id = p_id for update;
  if e.id is null or not (__APP__.k3_staff() and __APP__.k3_in_scope(e.company_code, e.location_id)) then
    raise exception 'Evaluasi tidak ditemukan.' using errcode = 'P0001';
  end if;
  if not (__APP__.k3_writer() and __APP__.has_function('pjo')) then
    raise exception 'Hanya PJO yang bisa menyetujui evaluasi TSP.' using errcode = '42501';
  end if;
  if e.status <> 'submitted' then raise exception 'Evaluasi tidak sedang menunggu persetujuan.' using errcode = 'P0001'; end if;
  if e.prepared_by = auth.uid() then
    raise exception 'Penyusun tidak dapat menyetujui evaluasinya sendiri.' using errcode = '42501';
  end if;
  if not p_approve and length(btrim(coalesce(p_note, ''))) = 0 then
    raise exception 'Alasan pengembalian wajib diisi.' using errcode = 'P0001';
  end if;
  perform __APP__.set_log_context(case when p_approve then 'approve' else 'return' end, nullif(btrim(p_note), ''));
  update __APP__.tsp_evaluations
     set status = case when p_approve then 'approved' else 'returned' end, decided_by = auth.uid(), decided_at = now(),
         decision_note = nullif(btrim(p_note), '')
   where id = p_id;
  perform __APP__.set_log_context('', '');
  select array_agg(n) into v_notif from __APP__.notify(array[e.prepared_by], 'tsp.evaluation_decided',
    format('Evaluasi TSP %s/%s %s', lpad(e.month::text, 2, '0'), e.year, case when p_approve then 'disetujui' else 'dikembalikan' end),
    left(btrim(p_note), 200), '/tsp?tahun=' || e.year || '&bulan=' || e.month, 'tsp', 'tsp_evaluations', p_id::text) n;
  return jsonb_build_object('id', p_id, 'notification_ids', coalesce(v_notif, '{}'));
end $$;

revoke execute on function __APP__.tsp_program_save(uuid, jsonb), __APP__.tsp_realization_save(uuid, integer, integer, text),
  __APP__.safety_activity_save(jsonb), __APP__.safety_activity_sync_evidence(uuid),
  __APP__.tsp_evaluation_submit(integer, integer, uuid), __APP__.tsp_evaluation_decide(uuid, boolean, text) from public, anon;

-- =====================================================================================
-- STORAGE (policy lampiran didefinisikan ulang dengan tsp/ dan aktivitas/)
-- =====================================================================================
drop policy if exists "__HOST__-lampiran: read" on storage.objects;
drop policy if exists "__HOST__-lampiran: insert" on storage.objects;

create policy "__HOST__-lampiran: read" on storage.objects for select to authenticated
  using (bucket_id = '__HOST__-lampiran' and (select public.has_app_role('__APP__', 'viewer')) and (
    case (storage.foldername(name))[1]
      when 'support'  then exists (select 1 from __APP__.support_threads t
                                    where t.id::text = (storage.foldername(name))[2])
                           or (storage.foldername(name))[2] = 'new-' || (select auth.uid())::text
                           or ((storage.foldername(name))[2] like 'new-%' and (select public.has_app_role('__APP__', 'admin')))
      when 'feedback' then (storage.foldername(name))[2] = (select auth.uid())::text
                           or (select public.has_app_role('__APP__', 'admin'))
      when 'kejadian' then exists (select 1 from __APP__.incidents i where i.id::text = (storage.foldername(name))[2])
      when 'temuan'   then exists (select 1 from __APP__.findings f where f.id::text = (storage.foldername(name))[2])
      when 'pica'     then exists (select 1 from __APP__.pica_actions a where a.id::text = (storage.foldername(name))[2])
      when 'inspeksi' then exists (select 1 from __APP__.inspections i where i.id::text = (storage.foldername(name))[2])
      when 'observasi' then exists (select 1 from __APP__.observations o where o.id::text = (storage.foldername(name))[2])
      when 'tsp'      then exists (select 1 from __APP__.tsp_programs p where p.id::text = (storage.foldername(name))[2])
      when 'aktivitas' then exists (select 1 from __APP__.safety_activities a where a.id::text = (storage.foldername(name))[2])
      else true
    end));

create policy "__HOST__-lampiran: insert" on storage.objects for insert to authenticated
  with check (bucket_id = '__HOST__-lampiran' and (
    case (storage.foldername(name))[1]
      when 'support'  then exists (select 1 from __APP__.support_threads t
                                    where t.id::text = (storage.foldername(name))[2])
                           or (storage.foldername(name))[2] = 'new-' || (select auth.uid())::text
      when 'feedback' then (storage.foldername(name))[2] = (select auth.uid())::text
                           and (select public.has_app_role('__APP__', 'viewer'))
      when 'kejadian' then (select __APP__.k3_writer()) and exists (
                             select 1 from __APP__.incidents i
                              where i.id::text = (storage.foldername(name))[2] and i.status <> 'closed'
                                and (i.created_by = (select auth.uid()) or (select __APP__.has_function('hse'))
                                     or exists (select 1 from __APP__.incident_team t
                                                 where t.incident_id = i.id and t.user_id = (select auth.uid()))))
      when 'temuan'   then (select __APP__.k3_writer()) and exists (
                             select 1 from __APP__.findings f
                              where f.id::text = (storage.foldername(name))[2] and f.status <> 'closed'
                                and (f.created_by = (select auth.uid()) or f.pic_id = (select auth.uid())
                                     or (select __APP__.has_function('hse'))))
      when 'pica'     then exists (
                             select 1 from __APP__.pica_actions a
                              where a.id::text = (storage.foldername(name))[2]
                                and a.pic_id = (select auth.uid())
                                and a.status in ('open', 'in_progress')
                                and (storage.foldername(name))[3] = 'r' || a.round)
      when 'inspeksi' then (select __APP__.k3_writer()) and exists (
                             select 1 from __APP__.inspections i
                              where i.id::text = (storage.foldername(name))[2] and i.status = 'in_progress'
                                and i.inspector_id = (select auth.uid()))
      when 'observasi' then (select __APP__.k3_writer()) and exists (
                             select 1 from __APP__.observations o
                              where o.id::text = (storage.foldername(name))[2] and o.created_by = (select auth.uid()))
      -- bukti realisasi TSP: HSE/Pengawas/PJO pada program yang terlihat; folder bulan = YYYY-MM
      when 'tsp'      then (select __APP__.tsp_recorder()) and (storage.foldername(name))[3] ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
                           and exists (select 1 from __APP__.tsp_programs p where p.id::text = (storage.foldername(name))[2])
      -- bukti aktivitas: pembuat aktivitas atau HSE
      when 'aktivitas' then (select __APP__.tsp_recorder()) and exists (
                             select 1 from __APP__.safety_activities a
                              where a.id::text = (storage.foldername(name))[2]
                                and (a.created_by = (select auth.uid()) or (select __APP__.has_function('hse'))))
      else (select public.has_app_role('__APP__', 'editor'))
    end));

-- =====================================================================================
-- KAMUS KPI: capaian TSP (draf sampai disahkan admin)
-- =====================================================================================
insert into __APP__.kpi_definitions (code, name, definition, formula, rule_text, example, source, owner, unit, direction, thresholds, sort_order) values
  ('tsp_achievement', 'Capaian TSP', 'Persentase realisasi program TSP terhadap rencana sampai bulan berjalan.',
   'Σ min(aktual, rencana) per program per bulan ÷ Σ rencana × 100',
   'Hanya program aktif. Aktual per bulan = terbesar antara realisasi manual dan jumlah aktivitas K3 yang terhubung ke program. Realisasi melebihi rencana di satu bulan tidak menutupi bulan lain yang kurang.',
   '18 dari 22 rencana terpenuhi s.d. September → 82%.', 'TSP & Aktivitas', 'HSE', '%', 'higher_better', null, 90)
on conflict (code) do nothing;

-- =====================================================================================
-- TUGAS SAYA: seluruh cabang sebelumnya + evaluasi TSP
-- =====================================================================================
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
    union all
    select 'incident_classify', 'action', 'incidents', i.id, i.code, left(i.description, 200), i.status,
           null::timestamptz, i.reported_at, '/kejadian/' || i.id || '?tab=klasifikasi',
           jsonb_build_object('emergency', i.is_emergency)
      from __APP__.incidents i
     where i.status = 'reported' and (select __APP__.has_function('hse'))
    union all
    select 'incident_investigate', 'action', 'incidents', i.id, i.code, left(i.description, 200), i.status,
           null, coalesce(i.returned_at, i.classified_at, i.reported_at),
           '/kejadian/' || i.id || '?tab=investigasi', jsonb_build_object('returned', i.return_note is not null)
      from __APP__.incidents i
     where i.status in ('classified', 'investigating')
       and (i.lead_investigator_id = (select auth.uid())
            or (i.lead_investigator_id is null and (select __APP__.has_function('hse'))))
    union all
    select 'incident_review', 'approval', 'incidents', i.id, i.code, left(i.description, 200), i.status,
           null, i.updated_at, '/kejadian/' || i.id || '?tab=review', '{}'::jsonb
      from __APP__.incidents i
     where i.created_by is distinct from (select auth.uid())
       and ((i.status = 'review_ehs' and (select __APP__.has_function('hse_senior')))
            or (i.status = 'review_mgmt' and (select __APP__.has_any_function(array['pjo', 'manajemen']))))
    union all
    select 'pica_do', 'action', 'pica_actions', a.id, a.code, a.title, a.status,
           (a.due_date::timestamp at time zone 'Asia/Jakarta') + interval '1 day' - interval '1 second',
           a.created_at, __APP__.k3_action_href(a), jsonb_build_object('returned', a.returned)
      from __APP__.pica_actions a
     where a.pic_id = (select auth.uid()) and a.status in ('open', 'in_progress')
    union all
    select 'pica_verify', 'verification', 'pica_actions', a.id, a.code, a.title, a.status,
           null, a.updated_at, __APP__.k3_action_href(a), '{}'::jsonb
      from __APP__.pica_actions a
     where a.verifier_id = (select auth.uid()) and a.status = 'waiting_verification'
    union all
    -- inspeksi saya: terjadwal (7 hari ke depan atau terlambat) = terjadwal; berjalan = perlu tindakan
    select 'inspection_scheduled', 'scheduled', 'inspections', i.id, i.code, i.title || coalesce(' · ' || i.object_text, ''), i.status,
           i.planned_at, i.created_at, '/inspeksi/' || i.id, '{}'::jsonb
      from __APP__.inspections i
     where i.inspector_id = (select auth.uid()) and i.status = 'scheduled' and i.planned_at < now() + interval '7 days'
    union all
    select 'inspection_do', 'action', 'inspections', i.id, i.code, i.title || coalesce(' · ' || i.object_text, ''), i.status,
           i.planned_at, coalesce(i.started_at, i.created_at), '/inspeksi/' || i.id, '{}'::jsonb
      from __APP__.inspections i
     where i.inspector_id = (select auth.uid()) and i.status = 'in_progress'
    union all
    select 'inspection_verify', 'verification', 'inspections', i.id, i.code, i.title || coalesce(' · ' || i.object_text, ''), i.status,
           null, i.submitted_at, '/inspeksi/' || i.id,
           jsonb_build_object('noncompliant', coalesce((i.summary ->> 'noncompliant')::integer, 0))
      from __APP__.inspections i
     where i.status = 'submitted' and i.inspector_id <> (select auth.uid()) and (select __APP__.has_function('hse'))
    union all
    -- evaluasi TSP bulanan menunggu persetujuan PJO (bukan penyusunnya)
    select 'tsp_approve', 'approval', 'tsp_evaluations', e.id, null::text,
           'Evaluasi TSP ' || lpad(e.month::text, 2, '0') || '/' || e.year, e.status,
           null, e.submitted_at, '/tsp?tahun=' || e.year || '&bulan=' || e.month,
           jsonb_build_object('achievement', e.summary ->> 'achievement')
      from __APP__.tsp_evaluations e
     where e.status = 'submitted' and e.prepared_by is distinct from (select auth.uid()) and (select __APP__.has_function('pjo'))
  ) t (kind, task_group, ref_type, ref_id, code, title, status, due_at, waiting_since, href, meta)
  order by t.due_at asc nulls last, t.waiting_since asc
  limit least(greatest(p_limit, 1), 500);
$$;
revoke execute on function __APP__.my_tasks(integer) from public, anon;
