-- =====================================================================================
-- 12 INSPEKSI & OBSERVASI + KAMUS KPI + JAM KERJA + DASHBOARD K3 (Safe Hub, fase 2)
--   rancangan-implementasi §4.3, §4.4, §4.13, §2.8 · spesifikasi docs/spec/fase-2-inspeksi-dashboard.md
--
-- Pola sama dengan 11: tulis HANYA lewat RPC security definer (cek fungsi K3 + visibilitas), tabel tanpa
-- hak tulis untuk authenticated (kecuali kpi_definitions: admin app). Satu aksi = satu baris log.
-- =====================================================================================

-- =====================================================================================
-- TABEL
-- =====================================================================================

-- ---------------------------------------------------------------- template checklist
create table __APP__.inspection_templates (
  id               uuid primary key default gen_random_uuid(),
  type_code        text not null,                         -- kode master inspection_type
  name             text not null check (length(btrim(name)) between 3 and 120),
  object_label     text check (length(object_label) <= 60),   -- mis. "Nomor APAR"
  finding_category text not null default 'operational_safety',  -- kategori temuan otomatis
  is_active        boolean not null default true,
  created_by       uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on table __APP__.inspection_templates is 'Template checklist inspeksi. Perubahan hanya memengaruhi inspeksi baru (jawaban menyimpan teks butir).';
create unique index inspection_templates_name_uq on __APP__.inspection_templates (lower(btrim(name)));
create index inspection_templates_type_idx on __APP__.inspection_templates (type_code, is_active);

create table __APP__.inspection_template_items (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references __APP__.inspection_templates(id) on delete cascade,
  line_no     integer not null check (line_no between 1 and 100),
  text        text not null check (length(btrim(text)) between 3 and 500),
  unique (template_id, line_no)
);

create table __APP__.inspection_templates_logs (
  id         bigint generated always as identity primary key,
  record_id  uuid not null,
  at         timestamptz not null default now(),
  actor_id   uuid references public.profiles(id) on delete set null,
  action     text not null check (action ~ '^[a-z][a-z0-9_]{1,40}$'),
  changes    jsonb,
  note       text check (length(note) <= 2000)
);
create index inspection_templates_logs_record_idx on __APP__.inspection_templates_logs (record_id, at desc);

-- ---------------------------------------------------------------- inspeksi (jadwal = baris status 'scheduled')
create table __APP__.inspections (
  id            uuid primary key default gen_random_uuid(),
  code          text not null,
  company_code  text not null references public.companies(code),
  location_id   uuid not null references public.locations(id),
  area_id       uuid not null references __APP__.areas(id),
  template_id   uuid references __APP__.inspection_templates(id) on delete set null,
  type_code     text not null,
  title         text not null check (length(btrim(title)) between 3 and 120),   -- nama template (snapshot)
  object_text   text check (length(object_text) <= 120),                         -- mis. "APAR #07"
  planned_at    timestamptz not null,
  inspector_id  uuid not null references public.profiles(id),
  status        text not null default 'scheduled'
                check (status in ('scheduled', 'in_progress', 'submitted', 'verified', 'cancelled')),
  started_at    timestamptz,
  submitted_at  timestamptz,
  verified_at   timestamptz,
  verified_by   uuid references public.profiles(id) on delete set null,
  verify_note   text check (length(verify_note) <= 2000),
  cancel_reason text check (length(cancel_reason) <= 1000),
  summary       jsonb,                                  -- {compliant, noncompliant, na, findings}
  search_text   text,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (company_code, code)
);
comment on table __APP__.inspections is 'Inspeksi/audit terjadwal dan pelaksanaannya (jenis B). Ditulis HANYA lewat RPC inspection_*.';
create index inspections_list_idx      on __APP__.inspections (company_code, location_id, planned_at desc);
create index inspections_inspector_idx on __APP__.inspections (inspector_id, status, planned_at);
create index inspections_status_idx    on __APP__.inspections (status, planned_at);
create index inspections_search_idx    on __APP__.inspections using gin (search_text extensions.gin_trgm_ops);

create table __APP__.inspection_answers (
  id            uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references __APP__.inspections(id) on delete cascade,
  line_no       integer not null check (line_no between 1 and 100),
  item_text     text not null,
  answer        text check (answer in ('compliant', 'noncompliant', 'na')),
  comment       text check (length(comment) <= 1000),
  photos        text[] not null default '{}' check (cardinality(photos) <= 5),
  finding_id    uuid references __APP__.findings(id) on delete set null,
  unique (inspection_id, line_no)
);
create index inspection_answers_finding_idx on __APP__.inspection_answers (finding_id) where finding_id is not null;

create table __APP__.inspections_logs (
  id         bigint generated always as identity primary key,
  record_id  uuid not null,
  at         timestamptz not null default now(),
  actor_id   uuid references public.profiles(id) on delete set null,
  action     text not null check (action ~ '^[a-z][a-z0-9_]{1,40}$'),
  changes    jsonb,
  note       text check (length(note) <= 2000)
);
create index inspections_logs_record_idx on __APP__.inspections_logs (record_id, at desc);
create index inspections_logs_at_idx     on __APP__.inspections_logs (at desc);

-- ---------------------------------------------------------------- observasi KTA/TTA
create table __APP__.observations (
  id               uuid primary key default gen_random_uuid(),
  code             text not null,
  company_code     text not null references public.companies(code),
  location_id      uuid not null references public.locations(id),
  area_id          uuid not null references __APP__.areas(id),
  kind             text not null check (kind in ('kta', 'tta')),
  description      text not null check (length(btrim(description)) between 1 and 1000),
  immediate_action text check (length(immediate_action) <= 1000),
  observed_at      timestamptz not null default now(),
  needs_followup   boolean not null default false,
  finding_id       uuid references __APP__.findings(id) on delete set null,
  search_text      text,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now(),
  unique (company_code, code)
);
comment on table __APP__.observations is 'Observasi cepat KTA (kondisi) / TTA (tindakan tidak aman). Tindak lanjut = temuan.';
create index observations_list_idx    on __APP__.observations (company_code, location_id, observed_at desc);
create index observations_creator_idx on __APP__.observations (created_by, observed_at desc);
create index observations_search_idx  on __APP__.observations using gin (search_text extensions.gin_trgm_ops);

create table __APP__.observations_logs (
  id         bigint generated always as identity primary key,
  record_id  uuid not null,
  at         timestamptz not null default now(),
  actor_id   uuid references public.profiles(id) on delete set null,
  action     text not null check (action ~ '^[a-z][a-z0-9_]{1,40}$'),
  changes    jsonb,
  note       text check (length(note) <= 2000)
);
create index observations_logs_record_idx on __APP__.observations_logs (record_id, at desc);

-- ---------------------------------------------------------------- jam kerja (D6: input bulanan per site)
create table __APP__.work_hours (
  id          uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id),
  month       date not null check (month = date_trunc('month', month)::date),
  hours       numeric(12,1) not null check (hours >= 0 and hours <= 100000000),
  note        text check (length(note) <= 500),
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (location_id, month)
);
comment on table __APP__.work_hours is 'Jam kerja bulanan per site: penyebut LTIFR/LTISR (keputusan D6). Diisi HSE/admin lewat work_hours_save.';

create table __APP__.work_hours_logs (
  id         bigint generated always as identity primary key,
  record_id  uuid not null,
  at         timestamptz not null default now(),
  actor_id   uuid references public.profiles(id) on delete set null,
  action     text not null check (action ~ '^[a-z][a-z0-9_]{1,40}$'),
  changes    jsonb,
  note       text check (length(note) <= 2000)
);
create index work_hours_logs_record_idx on __APP__.work_hours_logs (record_id, at desc);

-- ---------------------------------------------------------------- Kamus KPI (rancangan §2.8)
create table __APP__.kpi_definitions (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique check (code ~ '^[a-z][a-z0-9_]{1,40}$'),
  name          text not null check (length(btrim(name)) between 1 and 120),
  definition    text not null check (length(definition) <= 1000),
  formula       text not null check (length(formula) <= 500),
  rule_text     text check (length(rule_text) <= 2000),     -- aturan perhitungan
  example       text check (length(example) <= 1000),
  source        text check (length(source) <= 300),
  owner         text check (length(owner) <= 120),
  unit          text check (length(unit) <= 40),
  direction     text not null default 'neutral' check (direction in ('lower_better', 'higher_better', 'neutral')),
  thresholds    jsonb check (thresholds is null or jsonb_typeof(thresholds) = 'object'),   -- {warn_gte, danger_gte}
  status        text not null default 'draft' check (status in ('draft', 'approved')),
  version       integer not null default 1 check (version >= 1),
  approved_by   uuid references public.profiles(id) on delete set null,
  approved_at   timestamptz,
  approval_note text check (length(approval_note) <= 1000),
  sort_order    integer not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table __APP__.kpi_definitions is 'Kamus KPI. Mengubah definisi/rumus membuat versi baru dan mengembalikan status ke draft; mengesahkan = admin (kpi_approve).';

create table __APP__.kpi_definitions_logs (
  id         bigint generated always as identity primary key,
  record_id  uuid not null,
  at         timestamptz not null default now(),
  actor_id   uuid references public.profiles(id) on delete set null,
  action     text not null check (action ~ '^[a-z][a-z0-9_]{1,40}$'),
  changes    jsonb,
  note       text check (length(note) <= 2000)
);
create index kpi_definitions_logs_record_idx on __APP__.kpi_definitions_logs (record_id, at desc);

-- =====================================================================================
-- TRIGGER
-- =====================================================================================
create or replace function __APP__.inspections_search_text()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.search_text := lower(concat_ws(' ', new.code, new.title, new.object_text));
  return new;
end $$;
create or replace function __APP__.observations_search_text()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.search_text := lower(concat_ws(' ', new.code, new.description, new.immediate_action));
  return new;
end $$;
revoke execute on function __APP__.inspections_search_text(), __APP__.observations_search_text() from public, anon, authenticated;

-- Definisi/rumus berubah → versi baru + kembali draft; status hanya berubah lewat kpi_approve
create or replace function __APP__.kpi_definitions_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.code is distinct from old.code then
    raise exception 'Kode KPI tidak bisa diubah.' using errcode = 'P0001';
  end if;
  if coalesce(current_setting('app.log_action', true), '') = 'approve' then
    return new;
  end if;
  new.status := old.status;
  new.approved_by := old.approved_by; new.approved_at := old.approved_at; new.approval_note := old.approval_note;
  if (new.definition, new.formula, new.rule_text, new.example, new.source, new.owner, new.unit, new.direction, new.thresholds)
     is distinct from
     (old.definition, old.formula, old.rule_text, old.example, old.source, old.owner, old.unit, old.direction, old.thresholds) then
    new.version := old.version + 1;
    new.status := 'draft';
    new.approved_by := null; new.approved_at := null; new.approval_note := null;
  else
    new.version := old.version;
  end if;
  return new;
end $$;
revoke execute on function __APP__.kpi_definitions_guard() from public, anon, authenticated;

create trigger inspection_templates_set_updated_at before update on __APP__.inspection_templates
  for each row execute function public.set_updated_at();
create trigger inspection_templates_log after insert or update or delete on __APP__.inspection_templates
  for each row execute function __APP__.log_changes('config', '', 'Template inspeksi');

create trigger inspections_set_updated_at before update on __APP__.inspections
  for each row execute function public.set_updated_at();
create trigger inspections_search before insert or update on __APP__.inspections
  for each row execute function __APP__.inspections_search_text();
create trigger inspections_log after insert or update or delete on __APP__.inspections
  for each row execute function __APP__.log_changes('important', '/inspeksi/', 'Inspeksi');

create trigger observations_search before insert or update on __APP__.observations
  for each row execute function __APP__.observations_search_text();
create trigger observations_log after insert or update or delete on __APP__.observations
  for each row execute function __APP__.log_changes('important', '/observasi/', 'Observasi');

create trigger work_hours_set_updated_at before update on __APP__.work_hours
  for each row execute function public.set_updated_at();
create trigger work_hours_log after insert or update or delete on __APP__.work_hours
  for each row execute function __APP__.log_changes('config', '', 'Jam kerja');

create trigger kpi_definitions_guard before update on __APP__.kpi_definitions
  for each row execute function __APP__.kpi_definitions_guard();
create trigger kpi_definitions_set_updated_at before update on __APP__.kpi_definitions
  for each row execute function public.set_updated_at();
create trigger kpi_definitions_log after insert or update or delete on __APP__.kpi_definitions
  for each row execute function __APP__.log_changes('config', '/kpi/', 'KPI');

-- =====================================================================================
-- RLS (baca saja; tulis lewat RPC, kecuali kpi_definitions oleh admin app)
-- =====================================================================================
alter table __APP__.inspection_templates enable row level security;
alter table __APP__.inspection_template_items enable row level security;
alter table __APP__.inspection_templates_logs enable row level security;
alter table __APP__.inspections enable row level security;
alter table __APP__.inspection_answers enable row level security;
alter table __APP__.inspections_logs enable row level security;
alter table __APP__.observations enable row level security;
alter table __APP__.observations_logs enable row level security;
alter table __APP__.work_hours enable row level security;
alter table __APP__.work_hours_logs enable row level security;
alter table __APP__.kpi_definitions enable row level security;
alter table __APP__.kpi_definitions_logs enable row level security;

revoke insert, update, delete on __APP__.inspection_templates, __APP__.inspection_template_items,
  __APP__.inspection_templates_logs, __APP__.inspections, __APP__.inspection_answers, __APP__.inspections_logs,
  __APP__.observations, __APP__.observations_logs, __APP__.work_hours, __APP__.work_hours_logs,
  __APP__.kpi_definitions_logs from authenticated, anon;
revoke delete on __APP__.kpi_definitions from authenticated;

create policy "inspection_templates: viewer read" on __APP__.inspection_templates for select to authenticated
  using ((select public.has_app_role('__APP__', 'viewer')));
create policy "inspection_template_items: viewer read" on __APP__.inspection_template_items for select to authenticated
  using ((select public.has_app_role('__APP__', 'viewer')));
create policy "inspection_templates_logs: admin read" on __APP__.inspection_templates_logs for select to authenticated
  using ((select public.has_app_role('__APP__', 'admin')) or (select __APP__.has_function('hse')));

-- anti rekursi: inspections <-> answers tidak saling merujuk di policy, jadi cukup exists biasa
create policy "inspections: read" on __APP__.inspections for select to authenticated
  using ((select public.has_app_role('__APP__', 'viewer'))
         and ('*' = any ((select __APP__.my_company_scope())::text[])
              or company_code = any ((select __APP__.my_company_scope())::text[]))
         and ('*' = any ((select __APP__.my_location_scope())::text[])
              or location_id::text = any ((select __APP__.my_location_scope())::text[]))
         and ((select __APP__.k3_sees_all())
              or inspector_id = (select auth.uid())
              or created_by = (select auth.uid())));
create policy "inspection_answers: read with inspection" on __APP__.inspection_answers for select to authenticated
  using (exists (select 1 from __APP__.inspections i where i.id = inspection_id));
create policy "inspections_logs: read with inspection" on __APP__.inspections_logs for select to authenticated
  using (exists (select 1 from __APP__.inspections i where i.id = record_id)
         or (select public.has_app_role('__APP__', 'admin')));

create policy "observations: read" on __APP__.observations for select to authenticated
  using ((select public.has_app_role('__APP__', 'viewer'))
         and ('*' = any ((select __APP__.my_company_scope())::text[])
              or company_code = any ((select __APP__.my_company_scope())::text[]))
         and ('*' = any ((select __APP__.my_location_scope())::text[])
              or location_id::text = any ((select __APP__.my_location_scope())::text[]))
         and ((select __APP__.k3_sees_all()) or created_by = (select auth.uid())));
create policy "observations_logs: read with observation" on __APP__.observations_logs for select to authenticated
  using (exists (select 1 from __APP__.observations o where o.id = record_id)
         or (select public.has_app_role('__APP__', 'admin')));

create policy "work_hours: viewer read" on __APP__.work_hours for select to authenticated
  using ((select public.has_app_role('__APP__', 'viewer'))
         and ('*' = any ((select __APP__.my_location_scope())::text[])
              or location_id::text = any ((select __APP__.my_location_scope())::text[])));
create policy "work_hours_logs: hse/admin read" on __APP__.work_hours_logs for select to authenticated
  using ((select public.has_app_role('__APP__', 'admin')) or (select __APP__.has_function('hse')));

create policy "kpi_definitions: viewer read" on __APP__.kpi_definitions for select to authenticated
  using ((select public.has_app_role('__APP__', 'viewer')));
create policy "kpi_definitions: admin insert" on __APP__.kpi_definitions for insert to authenticated
  with check ((select public.has_app_role('__APP__', 'admin')));
create policy "kpi_definitions: admin update" on __APP__.kpi_definitions for update to authenticated
  using ((select public.has_app_role('__APP__', 'admin')))
  with check ((select public.has_app_role('__APP__', 'admin')));
create policy "kpi_definitions_logs: viewer read" on __APP__.kpi_definitions_logs for select to authenticated
  using ((select public.has_app_role('__APP__', 'viewer')));

-- =====================================================================================
-- HELPER
-- =====================================================================================
create or replace function __APP__.k3_inspection_visible(p_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from __APP__.inspections i
     where i.id = p_id
       and __APP__.k3_in_scope(i.company_code, i.location_id)
       and (__APP__.k3_sees_all() or i.inspector_id = auth.uid() or i.created_by = auth.uid()));
$$;
create or replace function __APP__.k3_observation_visible(p_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from __APP__.observations o
     where o.id = p_id
       and __APP__.k3_in_scope(o.company_code, o.location_id)
       and (__APP__.k3_sees_all() or o.created_by = auth.uid()));
$$;
revoke execute on function __APP__.k3_inspection_visible(uuid), __APP__.k3_observation_visible(uuid) from public, anon;

-- Sisipkan temuan (INTERNAL, dipakai inspection_submit & observation_submit). Pemanggil sudah memeriksa
-- hak dan memvalidasi master/PIC; di sini hanya nomor + insert + notifikasi dikembalikan pemanggil.
create or replace function __APP__.k3_finding_insert(
  p_creator uuid, p_company text, p_location uuid, p_area uuid, p_detail text, p_found_at timestamptz,
  p_title text, p_description text, p_source_kind text, p_source_ref text, p_category text, p_risk text,
  p_pic uuid, p_due date)
returns table (id uuid, code text) language plpgsql security definer set search_path = '' as $$
declare v_code text := __APP__.next_doc_number('TMN', p_company, 'year'); v_id uuid;
begin
  perform __APP__.set_log_context('create', null);
  insert into __APP__.findings (code, company_code, location_id, area_id, location_detail, found_at, title,
    description, source_kind, source_ref, category, risk_level, pic_id, due_date, created_by)
  values (v_code, p_company, p_location, p_area, nullif(btrim(p_detail), ''), p_found_at,
    left(btrim(p_title), 200), left(btrim(p_description), 4000), p_source_kind, p_source_ref, p_category,
    p_risk, p_pic, p_due, p_creator)
  returning findings.id into v_id;
  perform __APP__.set_log_context('', '');
  return query select v_id, v_code;
end $$;
revoke execute on function __APP__.k3_finding_insert(uuid, text, uuid, uuid, text, timestamptz, text, text, text, text, text, text, uuid, date)
  from public, anon, authenticated;

-- =====================================================================================
-- RPC TEMPLATE
-- =====================================================================================
-- p: {type_code, name, object_label?, finding_category, is_active?, items: [text, ...]} (p_id null = baru)
create or replace function __APP__.inspection_template_save(p_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_id    uuid := p_id;
  v_items jsonb := coalesce(p -> 'items', '[]');
  v_n     integer;
begin
  if not (public.has_app_role('__APP__', 'admin') or (__APP__.k3_writer() and __APP__.has_function('hse'))) then
    raise exception 'Hanya HSE atau admin yang bisa mengelola template inspeksi.' using errcode = '42501';
  end if;
  if not __APP__.k3_master_ok('inspection_type', p ->> 'type_code') then
    raise exception 'Jenis inspeksi wajib dipilih.' using errcode = 'P0001';
  end if;
  if not __APP__.k3_master_ok('finding_category', coalesce(p ->> 'finding_category', 'operational_safety')) then
    raise exception 'Kategori temuan otomatis tidak valid.' using errcode = 'P0001';
  end if;
  if length(btrim(coalesce(p ->> 'name', ''))) < 3 then
    raise exception 'Nama template minimal 3 karakter.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(v_items) <> 'array' then
    raise exception 'Daftar butir tidak valid.' using errcode = 'P0001';
  end if;
  select count(*) into v_n from jsonb_array_elements_text(v_items) e where length(btrim(e)) > 0;
  if v_n < 1 or v_n > 100 then
    raise exception 'Template harus memuat 1 sampai 100 butir.' using errcode = 'P0001';
  end if;

  if v_id is null then
    insert into __APP__.inspection_templates (type_code, name, object_label, finding_category, is_active)
    values (p ->> 'type_code', btrim(p ->> 'name'), nullif(btrim(p ->> 'object_label'), ''),
            coalesce(p ->> 'finding_category', 'operational_safety'), coalesce((p ->> 'is_active')::boolean, true))
    returning id into v_id;
  else
    perform 1 from __APP__.inspection_templates where id = v_id for update;
    if not found then raise exception 'Template tidak ditemukan.' using errcode = 'P0001'; end if;
    perform __APP__.set_log_extra(jsonb_build_object('butir', format('%s butir', v_n)));
    update __APP__.inspection_templates
       set type_code = p ->> 'type_code', name = btrim(p ->> 'name'), object_label = nullif(btrim(p ->> 'object_label'), ''),
           finding_category = coalesce(p ->> 'finding_category', 'operational_safety'),
           is_active = coalesce((p ->> 'is_active')::boolean, true), updated_at = now()
     where id = v_id;
    perform __APP__.set_log_extra(null);
    delete from __APP__.inspection_template_items where template_id = v_id;
  end if;
  insert into __APP__.inspection_template_items (template_id, line_no, text)
  select v_id, row_number() over (order by ord)::integer, left(btrim(e), 500)
    from jsonb_array_elements_text(v_items) with ordinality as x(e, ord)
   where length(btrim(e)) > 0;
  return jsonb_build_object('id', v_id);
end $$;

-- =====================================================================================
-- RPC INSPEKSI
-- =====================================================================================
-- Jadwal. p: {template_id, location_id, area_id, planned_at, inspector_id, object_text?, company_code?}
create or replace function __APP__.inspection_schedule(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid      uuid := auth.uid();
  t          __APP__.inspection_templates;
  v_company  text;
  v_location uuid := nullif(p ->> 'location_id', '')::uuid;
  v_area     uuid := nullif(p ->> 'area_id', '')::uuid;
  v_planned  timestamptz := nullif(p ->> 'planned_at', '')::timestamptz;
  v_insp     uuid := nullif(p ->> 'inspector_id', '')::uuid;
  v_id       uuid;
  v_code     text;
  v_notif    uuid[];
begin
  if not (__APP__.k3_writer() and __APP__.has_any_function(array['hse', 'pengawas', 'pjo'])) then
    raise exception 'Hanya HSE, Pengawas, atau PJO yang bisa menjadwalkan inspeksi.' using errcode = '42501';
  end if;
  select * into t from __APP__.inspection_templates where id = nullif(p ->> 'template_id', '')::uuid and is_active;
  if t.id is null then raise exception 'Pilih jenis inspeksi (template aktif).' using errcode = 'P0001'; end if;
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
  if v_planned is null or v_planned < now() - interval '2 days' or v_planned > now() + interval '2 years' then
    raise exception 'Tanggal rencana tidak valid (tidak boleh lebih dari 2 hari lalu).' using errcode = 'P0001';
  end if;
  if v_insp is null or not __APP__.k3_user_ok(v_insp) then
    raise exception 'Pemeriksa wajib dipilih.' using errcode = 'P0001';
  end if;

  v_code := __APP__.next_doc_number('INS', v_company, 'year');
  perform __APP__.set_log_context('schedule', null);
  insert into __APP__.inspections (code, company_code, location_id, area_id, template_id, type_code, title, object_text,
    planned_at, inspector_id, created_by)
  values (v_code, v_company, v_location, v_area, t.id, t.type_code, t.name, nullif(left(btrim(coalesce(p ->> 'object_text', '')), 120), ''),
    v_planned, v_insp, v_uid)
  returning id into v_id;
  perform __APP__.set_log_context('', '');

  select array_agg(n) into v_notif from __APP__.notify(array[v_insp], 'inspection.scheduled',
    'Inspeksi dijadwalkan: ' || t.name, v_code || ' · ' || to_char(v_planned at time zone 'Asia/Jakarta', 'DD-MM-YYYY HH24:MI'),
    '/inspeksi/' || v_id, 'inspeksi', 'inspections', v_id::text) n;
  return jsonb_build_object('id', v_id, 'code', v_code, 'notification_ids', coalesce(v_notif, '{}'));
end $$;

-- Mulai (pemeriksa): salin butir template ke jawaban
create or replace function __APP__.inspection_start(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r __APP__.inspections;
begin
  select * into r from __APP__.inspections where id = p_id for update;
  if r.id is null or not __APP__.k3_inspection_visible(p_id) then
    raise exception 'Inspeksi tidak ditemukan.' using errcode = 'P0001';
  end if;
  if not __APP__.k3_writer() or r.inspector_id <> auth.uid() then
    raise exception 'Hanya pemeriksa yang ditugaskan yang bisa memulai inspeksi.' using errcode = '42501';
  end if;
  if r.status <> 'scheduled' then
    raise exception 'Inspeksi sudah dimulai atau selesai.' using errcode = 'P0001';
  end if;
  if r.template_id is null or not exists (select 1 from __APP__.inspection_template_items where template_id = r.template_id) then
    raise exception 'Template inspeksi tidak punya butir. Hubungi HSE.' using errcode = 'P0001';
  end if;
  insert into __APP__.inspection_answers (inspection_id, line_no, item_text)
  select p_id, i.line_no, i.text from __APP__.inspection_template_items i where i.template_id = r.template_id order by i.line_no;
  perform __APP__.set_log_context('start', null);
  update __APP__.inspections set status = 'in_progress', started_at = now() where id = p_id;
  perform __APP__.set_log_context('', '');
  return jsonb_build_object('id', p_id);
end $$;

-- Simpan jawaban (draf di server). p: [{line_no, answer, comment, photos: [path]}]
create or replace function __APP__.inspection_save_answers(p_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r __APP__.inspections; v_n integer;
begin
  select * into r from __APP__.inspections where id = p_id for update;
  if r.id is null or not __APP__.k3_inspection_visible(p_id) then
    raise exception 'Inspeksi tidak ditemukan.' using errcode = 'P0001';
  end if;
  if not __APP__.k3_writer() or r.inspector_id <> auth.uid() then
    raise exception 'Hanya pemeriksa yang bisa mengisi checklist.' using errcode = '42501';
  end if;
  if r.status <> 'in_progress' then
    raise exception 'Checklist hanya bisa diisi saat inspeksi berjalan.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p) <> 'array' or jsonb_array_length(p) > 100 then
    raise exception 'Jawaban tidak valid.' using errcode = 'P0001';
  end if;
  if exists (select 1 from jsonb_array_elements(p) e
              where coalesce(e ->> 'answer', '') not in ('', 'compliant', 'noncompliant', 'na')) then
    raise exception 'Jawaban tidak dikenal.' using errcode = 'P0001';
  end if;
  if exists (select 1 from jsonb_array_elements(p) e, jsonb_array_elements_text(coalesce(e -> 'photos', '[]')) f
              where left(f, length('inspeksi/' || p_id || '/')) <> 'inspeksi/' || p_id || '/') then
    raise exception 'Foto harus berada di folder inspeksi ini.' using errcode = 'P0001';
  end if;
  update __APP__.inspection_answers a
     set answer = nullif(e ->> 'answer', ''), comment = nullif(left(btrim(coalesce(e ->> 'comment', '')), 1000), ''),
         photos = coalesce((select array_agg(f) from jsonb_array_elements_text(coalesce(e -> 'photos', '[]')) f), '{}')
    from jsonb_array_elements(p) e
   where a.inspection_id = p_id and a.line_no = (e ->> 'line_no')::integer;
  get diagnostics v_n = row_count;
  return jsonb_build_object('saved', v_n);
end $$;

-- Kirim. p_findings: [{line_no, description, risk_level, pic_id, due_date}] untuk butir tidak sesuai
create or replace function __APP__.inspection_submit(p_id uuid, p_findings jsonb default '[]')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r        __APP__.inspections;
  t        __APP__.inspection_templates;
  f        record;
  a        __APP__.inspection_answers;
  v_new    record;
  v_notif  uuid[] := '{}';
  v_more   uuid[];
  v_codes  text[] := '{}';
  v_sum    jsonb;
begin
  select * into r from __APP__.inspections where id = p_id for update;
  if r.id is null or not __APP__.k3_inspection_visible(p_id) then
    raise exception 'Inspeksi tidak ditemukan.' using errcode = 'P0001';
  end if;
  if not __APP__.k3_writer() or r.inspector_id <> auth.uid() then
    raise exception 'Hanya pemeriksa yang bisa mengirim inspeksi.' using errcode = '42501';
  end if;
  if r.status <> 'in_progress' then
    raise exception 'Inspeksi tidak sedang berjalan.' using errcode = 'P0001';
  end if;
  if exists (select 1 from __APP__.inspection_answers where inspection_id = p_id and answer is null) then
    raise exception 'Masih ada butir yang belum dijawab.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(coalesce(p_findings, '[]')) <> 'array' or jsonb_array_length(coalesce(p_findings, '[]')) > 100 then
    raise exception 'Daftar temuan tidak valid.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(coalesce(p_findings, '[]')) > 0
     and not __APP__.has_any_function(array['hse', 'pengawas', 'pjo']) then
    raise exception 'Hanya HSE, Pengawas, atau PJO yang bisa membuat temuan dari inspeksi.' using errcode = '42501';
  end if;
  select * into t from __APP__.inspection_templates where id = r.template_id;

  perform __APP__.set_log_context('submit', null);
  for f in select (e ->> 'line_no')::integer as line_no, nullif(btrim(e ->> 'description'), '') as descr,
                  e ->> 'risk_level' as risk, nullif(e ->> 'pic_id', '')::uuid as pic, nullif(e ->> 'due_date', '')::date as due
             from jsonb_array_elements(coalesce(p_findings, '[]')) e loop
    select * into a from __APP__.inspection_answers where inspection_id = p_id and line_no = f.line_no;
    if a.id is null or a.answer <> 'noncompliant' then
      raise exception 'Temuan hanya untuk butir yang dijawab Tidak Sesuai (butir %).', f.line_no using errcode = 'P0001';
    end if;
    if not __APP__.k3_master_ok('risk_level', f.risk) then
      raise exception 'Prioritas temuan butir % wajib dipilih.', f.line_no using errcode = 'P0001';
    end if;
    if f.pic is null or not __APP__.k3_user_ok(f.pic) then
      raise exception 'PIC temuan butir % wajib dipilih.', f.line_no using errcode = 'P0001';
    end if;
    if f.due is null or f.due < __APP__.today_wib() then
      raise exception 'Due date temuan butir % wajib diisi dan tidak boleh sebelum hari ini.', f.line_no using errcode = 'P0001';
    end if;
    select * into v_new from __APP__.k3_finding_insert(auth.uid(), r.company_code, r.location_id, r.area_id, r.object_text,
      now(), 'Ketidaksesuaian ' || r.title || ': ' || left(a.item_text, 120),
      coalesce(f.descr, 'Ketidaksesuaian pada ' || coalesce(r.object_text, r.title) || ': ' || a.item_text),
      'inspection', r.code, coalesce(t.finding_category, 'operational_safety'), f.risk, f.pic, f.due);
    update __APP__.inspection_answers set finding_id = v_new.id where id = a.id;
    v_codes := v_codes || v_new.code;
    select array_agg(n) into v_more from __APP__.notify(array[f.pic], 'finding.assigned',
      'Temuan ' || v_new.code || ' ditugaskan kepada Anda', left(coalesce(f.descr, a.item_text), 200),
      '/temuan/' || v_new.id, 'pica', 'findings', v_new.id::text) n;
    v_notif := v_notif || coalesce(v_more, '{}');
  end loop;

  select jsonb_build_object(
           'compliant', count(*) filter (where answer = 'compliant'),
           'noncompliant', count(*) filter (where answer = 'noncompliant'),
           'na', count(*) filter (where answer = 'na'),
           'findings', count(*) filter (where finding_id is not null))
    into v_sum from __APP__.inspection_answers where inspection_id = p_id;
  -- k3_finding_insert mengosongkan konteks log: setel ulang tepat sebelum update induk
  perform __APP__.set_log_context('submit', null);
  perform __APP__.set_log_extra(jsonb_build_object('hasil', v_sum));
  update __APP__.inspections set status = 'submitted', submitted_at = now(), summary = v_sum where id = p_id;
  perform __APP__.set_log_extra(null);
  perform __APP__.set_log_context('', '');

  select array_agg(n) into v_more from __APP__.notify(
    array(select u from unnest(__APP__.users_with_function(array['hse'], r.company_code, r.location_id)) u
           where u is distinct from r.inspector_id),
    'inspection.submitted', 'Verifikasi inspeksi ' || r.code, r.title || ' · ' || (v_sum ->> 'noncompliant') || ' tidak sesuai',
    '/inspeksi/' || p_id, 'inspeksi', 'inspections', p_id::text) n;
  v_notif := v_notif || coalesce(v_more, '{}');
  return jsonb_build_object('id', p_id, 'summary', v_sum, 'finding_codes', to_jsonb(v_codes), 'notification_ids', v_notif);
end $$;

-- Verifikasi (HSE, bukan pemeriksa)
create or replace function __APP__.inspection_verify(p_id uuid, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r __APP__.inspections; v_notif uuid[];
begin
  select * into r from __APP__.inspections where id = p_id for update;
  if r.id is null or not __APP__.k3_inspection_visible(p_id) then
    raise exception 'Inspeksi tidak ditemukan.' using errcode = 'P0001';
  end if;
  if not (__APP__.k3_writer() and __APP__.has_function('hse')) then
    raise exception 'Hanya HSE yang bisa memverifikasi inspeksi.' using errcode = '42501';
  end if;
  if r.inspector_id = auth.uid() then
    raise exception 'Pemeriksa tidak dapat memverifikasi inspeksinya sendiri.' using errcode = '42501';
  end if;
  if r.status <> 'submitted' then
    raise exception 'Inspeksi tidak sedang menunggu verifikasi.' using errcode = 'P0001';
  end if;
  perform __APP__.set_log_context('verify', nullif(btrim(p_note), ''));
  update __APP__.inspections set status = 'verified', verified_at = now(), verified_by = auth.uid(), verify_note = nullif(btrim(p_note), '')
   where id = p_id;
  perform __APP__.set_log_context('', '');
  select array_agg(n) into v_notif from __APP__.notify(array[r.inspector_id], 'inspection.verified',
    'Inspeksi ' || r.code || ' diverifikasi', null, '/inspeksi/' || p_id, 'inspeksi', 'inspections', p_id::text) n;
  return jsonb_build_object('id', p_id, 'notification_ids', coalesce(v_notif, '{}'));
end $$;

-- Batalkan jadwal/inspeksi berjalan (HSE atau pembuat jadwal), alasan wajib
create or replace function __APP__.inspection_cancel(p_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r __APP__.inspections; v_notif uuid[];
begin
  select * into r from __APP__.inspections where id = p_id for update;
  if r.id is null or not __APP__.k3_inspection_visible(p_id) then
    raise exception 'Inspeksi tidak ditemukan.' using errcode = 'P0001';
  end if;
  if not (__APP__.k3_writer() and (__APP__.has_function('hse') or r.created_by = auth.uid())) then
    raise exception 'Hanya HSE atau pembuat jadwal yang bisa membatalkan.' using errcode = '42501';
  end if;
  if r.status not in ('scheduled', 'in_progress') then
    raise exception 'Hanya jadwal atau inspeksi berjalan yang bisa dibatalkan.' using errcode = 'P0001';
  end if;
  if length(btrim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Alasan pembatalan wajib diisi.' using errcode = 'P0001';
  end if;
  perform __APP__.set_log_context('cancel', btrim(p_reason));
  update __APP__.inspections set status = 'cancelled', cancel_reason = btrim(p_reason) where id = p_id;
  perform __APP__.set_log_context('', '');
  select array_agg(n) into v_notif from __APP__.notify(array[r.inspector_id], 'inspection.cancelled',
    'Inspeksi ' || r.code || ' dibatalkan', left(btrim(p_reason), 200), '/inspeksi/' || p_id, 'inspeksi', 'inspections', p_id::text) n;
  return jsonb_build_object('id', p_id, 'notification_ids', coalesce(v_notif, '{}'));
end $$;

-- =====================================================================================
-- RPC OBSERVASI
-- =====================================================================================
-- p: {location_id, area_id, kind, description, immediate_action?, observed_at?, followup?, risk_level?, pic_id?, due_date?}
create or replace function __APP__.observation_submit(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid      uuid := auth.uid();
  v_company  text;
  v_location uuid := nullif(p ->> 'location_id', '')::uuid;
  v_area     uuid := nullif(p ->> 'area_id', '')::uuid;
  v_follow   boolean := coalesce((p ->> 'followup')::boolean, false);
  v_observed timestamptz := coalesce(nullif(p ->> 'observed_at', '')::timestamptz, now());
  v_id       uuid;
  v_code     text;
  v_pic      uuid := nullif(p ->> 'pic_id', '')::uuid;
  v_due      date := coalesce(nullif(p ->> 'due_date', '')::date, __APP__.today_wib() + 7);
  v_f        record;
  v_fid      uuid;
  v_fcode    text;
  v_notif    uuid[];
begin
  if not __APP__.k3_writer() then
    raise exception 'Anda tidak punya akses untuk mencatat observasi.' using errcode = '42501';
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
  if coalesce(p ->> 'kind', '') not in ('kta', 'tta') then
    raise exception 'Pilih KTA atau TTA.' using errcode = 'P0001';
  end if;
  if length(btrim(coalesce(p ->> 'description', ''))) = 0 then
    raise exception 'Uraian wajib diisi.' using errcode = 'P0001';
  end if;
  if v_observed > now() + interval '5 minutes' then
    raise exception 'Waktu observasi tidak boleh di masa depan.' using errcode = 'P0001';
  end if;
  if v_follow then
    if not __APP__.k3_master_ok('risk_level', p ->> 'risk_level') then
      raise exception 'Prioritas tindak lanjut wajib dipilih.' using errcode = 'P0001';
    end if;
    if v_pic is null or not __APP__.k3_user_ok(v_pic) then
      raise exception 'PIC tindak lanjut wajib dipilih.' using errcode = 'P0001';
    end if;
    if v_due < __APP__.today_wib() then
      raise exception 'Due date tidak boleh sebelum hari ini.' using errcode = 'P0001';
    end if;
  end if;

  v_code := __APP__.next_doc_number('OBS', v_company, 'year');
  perform __APP__.set_log_context('create', null);
  insert into __APP__.observations (code, company_code, location_id, area_id, kind, description, immediate_action,
    observed_at, needs_followup, created_by)
  values (v_code, v_company, v_location, v_area, p ->> 'kind', btrim(p ->> 'description'),
    nullif(btrim(p ->> 'immediate_action'), ''), v_observed, v_follow, v_uid)
  returning id into v_id;
  perform __APP__.set_log_context('', '');

  if v_follow then
    select * into v_f from __APP__.k3_finding_insert(v_uid, v_company, v_location, v_area, null, v_observed,
      (case p ->> 'kind' when 'kta' then 'KTA: ' else 'TTA: ' end) || left(btrim(p ->> 'description'), 150),
      btrim(p ->> 'description') || coalesce(E'\n\nTindakan langsung: ' || nullif(btrim(p ->> 'immediate_action'), ''), ''),
      'observation', v_code, 'operational_safety', p ->> 'risk_level', v_pic, v_due);
    v_fid := v_f.id; v_fcode := v_f.code;
    update __APP__.observations set finding_id = v_fid where id = v_id;
    select array_agg(n) into v_notif from __APP__.notify(array[v_pic], 'finding.assigned',
      'Temuan ' || v_fcode || ' ditugaskan kepada Anda', left(btrim(p ->> 'description'), 200), '/temuan/' || v_fid,
      'pica', 'findings', v_fid::text) n;
  end if;
  return jsonb_build_object('id', v_id, 'code', v_code, 'finding_id', v_fid, 'finding_code', v_fcode,
                            'notification_ids', coalesce(v_notif, '{}'));
end $$;

-- =====================================================================================
-- JAM KERJA & KAMUS KPI
-- =====================================================================================
create or replace function __APP__.work_hours_save(p_location uuid, p_month date, p_hours numeric, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_month date := date_trunc('month', p_month)::date; v_id uuid;
begin
  if not (public.has_app_role('__APP__', 'admin') or (__APP__.k3_writer() and __APP__.has_function('hse'))) then
    raise exception 'Hanya HSE atau admin yang bisa mengisi jam kerja.' using errcode = '42501';
  end if;
  if p_location is null or not exists (select 1 from public.locations where id = p_location and is_active)
     or not __APP__.location_visible(p_location) then
    raise exception 'Site tidak valid atau di luar akses Anda.' using errcode = 'P0001';
  end if;
  if v_month is null or v_month > date_trunc('month', __APP__.today_wib())::date then
    raise exception 'Bulan tidak valid (tidak boleh bulan depan).' using errcode = 'P0001';
  end if;
  if p_hours is null or p_hours < 0 then
    raise exception 'Jam kerja tidak valid.' using errcode = 'P0001';
  end if;
  insert into __APP__.work_hours (location_id, month, hours, note, created_by)
  values (p_location, v_month, p_hours, nullif(btrim(p_note), ''), auth.uid())
  on conflict (location_id, month) do update set hours = excluded.hours, note = excluded.note
  returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;

create or replace function __APP__.kpi_approve(p_code text, p_note text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare k __APP__.kpi_definitions;
begin
  if not public.has_app_role('__APP__', 'admin') then
    raise exception 'Hanya admin yang bisa mengesahkan rumus KPI.' using errcode = '42501';
  end if;
  select * into k from __APP__.kpi_definitions where code = p_code for update;
  if k.id is null then raise exception 'KPI tidak ditemukan.' using errcode = 'P0001'; end if;
  if k.status = 'approved' then raise exception 'Versi ini sudah disahkan.' using errcode = 'P0001'; end if;
  if length(btrim(coalesce(p_note, ''))) < 5 then
    raise exception 'Catatan pengesahan wajib diisi (minimal 5 karakter).' using errcode = 'P0001';
  end if;
  perform __APP__.set_log_context('approve', btrim(p_note));
  update __APP__.kpi_definitions
     set status = 'approved', approved_by = auth.uid(), approved_at = now(), approval_note = btrim(p_note)
   where id = k.id;
  perform __APP__.set_log_context('', '');
  return jsonb_build_object('code', p_code, 'version', k.version);
end $$;

-- =====================================================================================
-- KPI KESELAMATAN & DASHBOARD K3
-- =====================================================================================
-- Hanya klasifikasi HSE (category tidak null) yang dihitung (rancangan §4.1). security definer karena hari
-- kerja hilang ada di tabel terbatas; scope company + site dan fungsi (k3_sees_all) diperiksa di sini.
create or replace function __APP__.kpi_safety(p_from date, p_to date, p_location uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_f      timestamptz := p_from::timestamp at time zone 'Asia/Jakarta';
  v_t      timestamptz := (p_to + 1)::timestamp at time zone 'Asia/Jakarta';
  v_fatal  integer; v_lti integer; v_near integer; v_prop integer; v_lost integer;
  v_hours  numeric; v_hmonths integer;
begin
  if not (public.has_app_role('__APP__', 'viewer') and __APP__.k3_sees_all()) then
    return null;
  end if;
  select count(*) filter (where i.injury_class = 'fatality'),
         count(*) filter (where i.injury_class = 'lost_time'),
         count(*) filter (where i.category = 'near_miss'),
         count(*) filter (where i.category = 'property_damage'),
         coalesce(sum(r.lost_days) filter (where i.injury_class = 'lost_time'), 0)
    into v_fatal, v_lti, v_near, v_prop, v_lost
    from __APP__.incidents i
    left join __APP__.incident_restricted r on r.incident_id = i.id
   where i.category is not null and i.occurred_at >= v_f and i.occurred_at < v_t
     and (p_location is null or i.location_id = p_location)
     and ('*' = any (__APP__.my_company_scope()) or i.company_code = any (__APP__.my_company_scope()))
     and ('*' = any (__APP__.my_location_scope()) or i.location_id::text = any (__APP__.my_location_scope()));
  select sum(w.hours), count(*) into v_hours, v_hmonths
    from __APP__.work_hours w
   where w.month between date_trunc('month', p_from)::date and date_trunc('month', p_to)::date
     and (p_location is null or w.location_id = p_location)
     and ('*' = any (__APP__.my_location_scope()) or w.location_id::text = any (__APP__.my_location_scope()));
  return jsonb_build_object(
    'fatality', v_fatal, 'lti', v_lti, 'near_miss', v_near, 'property_damage', v_prop, 'lost_days', v_lost,
    'hours', v_hours, 'hours_months', v_hmonths,
    'ltifr', case when coalesce(v_hours, 0) > 0 then round(v_lti * 1000000 / v_hours, 2) end,
    'ltisr', case when coalesce(v_hours, 0) > 0 then round(v_lost * 1000000 / v_hours, 2) end);
end $$;
revoke execute on function __APP__.kpi_safety(date, date, uuid) from public, anon;

-- Rencana vs aktual per jenis inspeksi dalam satu bulan (ikut RLS)
create or replace function __APP__.inspection_plan_actual(p_year integer, p_month integer, p_location uuid default null)
returns table (type_code text, plan integer, actual integer)
language sql stable security invoker set search_path = '' as $$
  select i.type_code,
         count(*)::integer,
         (count(*) filter (where i.status in ('submitted', 'verified')))::integer
    from __APP__.inspections i
   where i.status <> 'cancelled'
     and (i.planned_at at time zone 'Asia/Jakarta') >= make_date(p_year, p_month, 1)
     and (i.planned_at at time zone 'Asia/Jakarta') < (make_date(p_year, p_month, 1) + interval '1 month')
     and (p_location is null or i.location_id = p_location)
   group by i.type_code
   order by i.type_code;
$$;
revoke execute on function __APP__.inspection_plan_actual(integer, integer, uuid) from public, anon;

-- Semua angka Beranda K3 dalam satu round trip (rancangan §4.4). Ikut RLS (invoker), kecuali kpi_safety.
create or replace function __APP__.dashboard_k3(p_year integer, p_month integer, p_location uuid default null)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  v_first date := make_date(p_year, p_month, 1);
  v_last  date := (make_date(p_year, p_month, 1) + interval '1 month - 1 day')::date;
  v_today date := (select __APP__.today_wib());
  v_out   jsonb;
begin
  select jsonb_build_object(
    'month',  (select __APP__.kpi_safety(v_first, v_last, p_location)),
    'ytd',    (select __APP__.kpi_safety(make_date(p_year, 1, 1), v_last, p_location)),
    'hours_series', coalesce((select jsonb_agg(jsonb_build_object('month', to_char(m, 'YYYY-MM'), 'hours', h.hours) order by m)
        from generate_series(make_date(p_year, 1, 1), v_first, interval '1 month') m
        join (select w.month, sum(w.hours) hours from __APP__.work_hours w
               where p_location is null or w.location_id = p_location group by w.month) h on h.month = m::date), '[]'),
    'findings', jsonb_build_object(
      'open',    (select count(*) from __APP__.findings f where f.status <> 'closed' and (p_location is null or f.location_id = p_location)),
      'overdue', (select count(*) from __APP__.findings f where f.status <> 'closed' and f.due_date < v_today and (p_location is null or f.location_id = p_location)),
      'age', jsonb_build_object(
        'd0_7',   (select count(*) from __APP__.findings f where f.status <> 'closed' and (p_location is null or f.location_id = p_location)
                    and v_today - (f.found_at at time zone 'Asia/Jakarta')::date <= 7),
        'd8_14',  (select count(*) from __APP__.findings f where f.status <> 'closed' and (p_location is null or f.location_id = p_location)
                    and v_today - (f.found_at at time zone 'Asia/Jakarta')::date between 8 and 14),
        'd15_30', (select count(*) from __APP__.findings f where f.status <> 'closed' and (p_location is null or f.location_id = p_location)
                    and v_today - (f.found_at at time zone 'Asia/Jakarta')::date between 15 and 30),
        'd31p',   (select count(*) from __APP__.findings f where f.status <> 'closed' and (p_location is null or f.location_id = p_location)
                    and v_today - (f.found_at at time zone 'Asia/Jakarta')::date > 30))),
    'pica', jsonb_build_object(
      'open',                 (select count(*) from __APP__.pica_actions a where a.status = 'open' and a.due_date >= v_today and (p_location is null or a.location_id = p_location)),
      'in_progress',          (select count(*) from __APP__.pica_actions a where a.status = 'in_progress' and a.due_date >= v_today and (p_location is null or a.location_id = p_location)),
      'waiting_verification', (select count(*) from __APP__.pica_actions a where a.status = 'waiting_verification' and (p_location is null or a.location_id = p_location)),
      'overdue',              (select count(*) from __APP__.pica_actions a where a.status in ('open', 'in_progress') and a.due_date < v_today and (p_location is null or a.location_id = p_location)),
      'closed',               (select count(*) from __APP__.pica_actions a where a.status = 'closed' and (p_location is null or a.location_id = p_location))),
    'leading', coalesce((select jsonb_agg(jsonb_build_object('month', to_char(m, 'YYYY-MM'),
        'plan',   (select count(*) from __APP__.inspections i where i.status <> 'cancelled' and (p_location is null or i.location_id = p_location)
                    and date_trunc('month', i.planned_at at time zone 'Asia/Jakarta') = m),
        'actual', (select count(*) from __APP__.inspections i where i.status in ('submitted', 'verified') and (p_location is null or i.location_id = p_location)
                    and date_trunc('month', i.planned_at at time zone 'Asia/Jakarta') = m),
        'observations', (select count(*) from __APP__.observations o where (p_location is null or o.location_id = p_location)
                    and date_trunc('month', o.observed_at at time zone 'Asia/Jakarta') = m)) order by m)
        from generate_series(make_date(p_year, 1, 1), v_first, interval '1 month') m), '[]'),
    'incidents_open', (select count(*) from __APP__.incidents i where i.status <> 'closed' and (p_location is null or i.location_id = p_location)),
    'incidents_to_classify', (select count(*) from __APP__.incidents i where i.status = 'reported' and (p_location is null or i.location_id = p_location)),
    'inspections_late', (select count(*) from __APP__.inspections i where i.status in ('scheduled', 'in_progress')
                          and (i.planned_at at time zone 'Asia/Jakarta')::date < v_today and (p_location is null or i.location_id = p_location))
  ) into v_out;
  return v_out;
end $$;
revoke execute on function __APP__.dashboard_k3(integer, integer, uuid) from public, anon;

-- =====================================================================================
-- STORAGE, TUGAS SAYA, PENCARIAN (didefinisikan ulang dengan modul baru)
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
      -- foto checklist: hanya pemeriksa, saat inspeksi berjalan
      when 'inspeksi' then (select __APP__.k3_writer()) and exists (
                             select 1 from __APP__.inspections i
                              where i.id::text = (storage.foldername(name))[2] and i.status = 'in_progress'
                                and i.inspector_id = (select auth.uid()))
      -- foto observasi: pembuat observasi (diunggah setelah observasi tersimpan)
      when 'observasi' then (select __APP__.k3_writer()) and exists (
                             select 1 from __APP__.observations o
                              where o.id::text = (storage.foldername(name))[2] and o.created_by = (select auth.uid()))
      else (select public.has_app_role('__APP__', 'editor'))
    end));

-- Tugas Saya: seluruh cabang sebelumnya + inspeksi
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
  ) t (kind, task_group, ref_type, ref_id, code, title, status, due_at, waiting_since, href, meta)
  order by t.due_at asc nulls last, t.waiting_since asc
  limit least(greatest(p_limit, 1), 500);
$$;
revoke execute on function __APP__.my_tasks(integer) from public, anon;

-- Pencarian K3: kejadian, temuan, tindakan (dari 11) + inspeksi + observasi
create or replace function __APP__.global_search_k3(p_q text, p_limit integer default 5)
returns table (kind text, id text, title text, subtitle text, status text, amount numeric,
               href text, is_exact boolean)
language sql stable security invoker set search_path = '' as $$
  select * from __APP__.global_search_k3_core(p_q, p_limit)
  union all
  (select 'inspeksi'::text, i.id::text, i.code, i.title || coalesce(' · ' || i.object_text, ''), i.status, null::numeric,
          '/inspeksi/' || i.id, lower(i.code) = lower(btrim(p_q))
     from __APP__.inspections i
    where length(btrim(p_q)) >= 3 and i.search_text like '%' || lower(btrim(p_q)) || '%'
    order by (lower(i.code) = lower(btrim(p_q))) desc, i.planned_at desc
    limit least(greatest(p_limit, 1), 10))
  union all
  (select 'observasi'::text, o.id::text, o.code, left(o.description, 120), o.kind, null::numeric,
          '/observasi/' || o.id, lower(o.code) = lower(btrim(p_q))
     from __APP__.observations o
    where length(btrim(p_q)) >= 3 and o.search_text like '%' || lower(btrim(p_q)) || '%'
    order by (lower(o.code) = lower(btrim(p_q))) desc, o.observed_at desc
    limit least(greatest(p_limit, 1), 10))
$$;
revoke execute on function __APP__.global_search_k3(text, integer) from public, anon;

-- Feed aktivitas Beranda: log semua modul K3 (ikut RLS log masing-masing). example_pengajuan.sql (bila dipasang)
-- mendefinisikan ulang activity_feed dengan tambahan log Pengajuan.
create or replace function __APP__.activity_feed_k3(p_limit integer default 20, p_before timestamptz default null)
returns table (id bigint, entity text, record_id uuid, at timestamptz, actor_id uuid, action text, note text,
               label text, href text)
language sql stable security invoker set search_path = '' as $$
  select f.* from (
    (select l.id, 'kejadian'::text, l.record_id, l.at, l.actor_id, l.action, l.note, coalesce(i.code, 'Kejadian'), '/kejadian/' || l.record_id
       from __APP__.incidents_logs l left join __APP__.incidents i on i.id = l.record_id
      where (p_before is null or l.at < p_before) order by l.at desc limit 100)
    union all
    (select l.id, 'temuan', l.record_id, l.at, l.actor_id, l.action, l.note, coalesce(x.code, 'Temuan'), '/temuan/' || l.record_id
       from __APP__.findings_logs l left join __APP__.findings x on x.id = l.record_id
      where (p_before is null or l.at < p_before) order by l.at desc limit 100)
    union all
    (select l.id, 'tindakan', l.record_id, l.at, l.actor_id, l.action, l.note, coalesce(a.code, 'Tindakan'),
            coalesce(__APP__.k3_action_href(a), '/temuan')
       from __APP__.pica_actions_logs l left join __APP__.pica_actions a on a.id = l.record_id
      where (p_before is null or l.at < p_before) order by l.at desc limit 100)
    union all
    (select l.id, 'inspeksi', l.record_id, l.at, l.actor_id, l.action, l.note, coalesce(x.code, 'Inspeksi'), '/inspeksi/' || l.record_id
       from __APP__.inspections_logs l left join __APP__.inspections x on x.id = l.record_id
      where (p_before is null or l.at < p_before) order by l.at desc limit 100)
    union all
    (select l.id, 'observasi', l.record_id, l.at, l.actor_id, l.action, l.note, coalesce(x.code, 'Observasi'), '/observasi/' || l.record_id
       from __APP__.observations_logs l left join __APP__.observations x on x.id = l.record_id
      where (p_before is null or l.at < p_before) order by l.at desc limit 100)
  ) f
  order by f.at desc
  limit least(greatest(p_limit, 1), 100);
$$;
revoke execute on function __APP__.activity_feed_k3(integer, timestamptz) from public, anon;

-- Pembungkus (contoh Pengajuan mendefinisikan ulang dengan log Pengajuan)
create or replace function __APP__.activity_feed(p_limit integer default 20, p_before timestamptz default null)
returns table (id bigint, entity text, record_id uuid, at timestamptz, actor_id uuid, action text, note text,
               label text, href text)
language sql stable security invoker set search_path = '' as $$
  select * from __APP__.activity_feed_k3(p_limit, p_before);
$$;
revoke execute on function __APP__.activity_feed(integer, timestamptz) from public, anon;

-- Label aksi tambahan untuk riwayat
create or replace function __APP__.action_label(p_action text)
returns text language sql immutable set search_path = '' as $$
  select case p_action
    when 'create' then 'dibuat'          when 'update' then 'diubah'
    when 'delete' then 'dihapus'         when 'submit' then 'diajukan'
    when 'approve' then 'disetujui'      when 'reject' then 'ditolak'
    when 'cancel' then 'ditarik'         when 'followup' then 'di-follow-up'
    when 'override' then 'approval diubah admin'
    when 'admin_edit' then 'diedit admin'
    when 'report' then 'dilaporkan'      when 'classify' then 'diklasifikasi'
    when 'start_investigation' then 'investigasi dimulai'
    when 'save_investigation' then 'investigasi diperbarui'
    when 'submit_review' then 'dikirim ke review'
    when 'approve_ehs' then 'disetujui EHS'
    when 'approve_mgmt' then 'disetujui manajemen'
    when 'return' then 'dikembalikan'    when 'close' then 'ditutup'
    when 'close_exception' then 'ditutup dengan pengecualian'
    when 'start' then 'dimulai'          when 'submit_evidence' then 'bukti dikirim'
    when 'accept' then 'diterima'        when 'change_due' then 'due date diubah'
    when 'effectiveness' then 'efektivitas dicatat'
    when 'actions_done' then 'semua tindakan selesai'
    when 'schedule' then 'dijadwalkan'   when 'verify' then 'diverifikasi'
    else replace(p_action, '_', ' ') end;
$$;

revoke execute on function __APP__.inspection_template_save(uuid, jsonb), __APP__.inspection_schedule(jsonb),
  __APP__.inspection_start(uuid), __APP__.inspection_save_answers(uuid, jsonb), __APP__.inspection_submit(uuid, jsonb),
  __APP__.inspection_verify(uuid, text), __APP__.inspection_cancel(uuid, text), __APP__.observation_submit(jsonb),
  __APP__.work_hours_save(uuid, date, numeric, text), __APP__.kpi_approve(text, text) from public, anon;

-- =====================================================================================
-- DATA AWAL: Kamus KPI (semua draf sampai disahkan admin; rancangan §2.8)
-- =====================================================================================
insert into __APP__.kpi_definitions (code, name, definition, formula, rule_text, example, source, owner, unit, direction, thresholds, sort_order) values
  ('fatality', 'Fatality', 'Jumlah kejadian dengan korban meninggal dunia.', 'Σ kejadian berkelas cedera Fatality',
   'Hanya kejadian yang sudah diklasifikasi HSE. Periode = tanggal kejadian (WIB). Site mengikuti pemilih site.',
   '1 kejadian fatal di Okt 2026 = 1 kasus.', 'Kejadian & Investigasi (klasifikasi HSE)', 'HSE', 'kasus', 'lower_better', '{"danger_gte": 1}', 10),
  ('lti', 'Lost Time Injury (LTI)', 'Cedera yang menyebabkan korban kehilangan hari kerja.', 'Σ kejadian berkelas cedera Lost Time',
   'Hanya kejadian terklasifikasi. Fatality dihitung terpisah dan tidak ikut LTI.', '2 kejadian Lost Time di Q3 = 2 kasus.',
   'Kejadian & Investigasi (klasifikasi HSE)', 'HSE', 'kasus', 'lower_better', '{"danger_gte": 1}', 20),
  ('ltifr', 'LTIFR', 'Frekuensi LTI per satu juta jam kerja.', 'LTI × 1.000.000 ÷ jam kerja',
   'Jam kerja = jumlah input bulanan per site pada periode. Tanpa input jam kerja, nilai tidak ditampilkan. Lintas site: pembilang dan penyebut dijumlahkan, bukan merata-rata persentase.',
   '1 LTI, 95.106 jam kerja → 10,51.', 'Kejadian & jam kerja bulanan (Kamus KPI → Jam Kerja)', 'HSE', 'per 1 juta jam', 'lower_better', null, 30),
  ('ltisr', 'LTISR', 'Tingkat keparahan LTI per satu juta jam kerja.', 'Σ hari kerja hilang × 1.000.000 ÷ jam kerja',
   'Hari kerja hilang dari data cedera terbatas kejadian berkelas Lost Time. Jam kerja seperti LTIFR.',
   '10 hari hilang, 95.106 jam kerja → 105,15.', 'Kejadian & jam kerja bulanan', 'HSE', 'per 1 juta jam', 'lower_better', null, 40),
  ('near_miss', 'Near Miss', 'Kejadian nyaris celaka (tanpa cedera atau kerusakan).', 'Σ kejadian berkategori final Near Miss',
   'Hanya kategori final HSE, bukan kategori dari pelapor.', '3 near miss di Okt 2026 = 3 kasus.', 'Kejadian & Investigasi', 'HSE', 'kasus', 'neutral', null, 50),
  ('property_damage', 'Property Damage', 'Kejadian yang merusak properti atau peralatan.', 'Σ kejadian berkategori final Kerusakan Properti',
   'Hanya kategori final HSE.', '1 kejadian kaca unit retak = 1 kasus.', 'Kejadian & Investigasi', 'HSE', 'kasus', 'lower_better', null, 60),
  ('inspection_achievement', 'Pencapaian Inspeksi', 'Persentase inspeksi terjadwal yang sudah dilaksanakan dan dikirim.', 'Inspeksi terkirim ÷ inspeksi direncanakan × 100',
   'Jadwal yang dibatalkan tidak dihitung. Dihitung per bulan rencana (tanggal rencana, WIB).', '27 dari 32 rencana → 84%.',
   'Inspeksi & Observasi', 'HSE', '%', 'higher_better', null, 70),
  ('finding_overdue', 'Temuan Overdue', 'Temuan terbuka yang melewati due date.', 'Σ temuan belum Closed dengan due date < hari ini',
   'Hari ini = tanggal WIB. Status overdue dihitung, tidak disimpan.', '4 temuan melewati due date = 4.', 'Temuan & PICA', 'HSE', 'temuan', 'lower_better', '{"danger_gte": 1}', 80)
on conflict (code) do nothing;
