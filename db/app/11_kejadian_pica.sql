-- =====================================================================================
-- 11 KEJADIAN & INVESTIGASI + TEMUAN & PICA (Safe Hub, fase 1)
--   rancangan-implementasi §4.1, §4.2 · spesifikasi docs/spec/fase-1-kejadian-pica.md
--
-- Pola tulis: SEMUA perubahan lewat RPC security definer yang memeriksa sendiri fungsi K3 +
-- visibilitas record (k3_incident_visible/…). Tabel tidak punya hak INSERT/UPDATE/DELETE untuk
-- authenticated, jadi status tidak bisa dilompati lewat API tabel. Baca = RLS biasa.
-- Satu aksi = satu UPDATE baris induk (set_log_context + set_log_extra) = satu baris log.
-- =====================================================================================

-- ---------------------------------------------------------------- helper akses K3
-- Lihat semua record dalam scope company+site: admin app, atau punya fungsi K3 selain karyawan.
-- Tanpa fungsi / hanya karyawan → hanya record miliknya (pelapor, atasan, tim, PIC).
create or replace function __APP__.k3_sees_all()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_app_role('__APP__', 'admin')
      or __APP__.my_functions() && array['hse', 'hse_senior', 'manajemen', 'pjo', 'pja', 'pengawas', 'hr',
                                          'maintenance', 'scm', 'kontraktor_admin', 'auditor'];
$$;

-- Boleh menulis apa pun di modul K3: punya akses app dan bukan auditor (auditor = baca saja)
create or replace function __APP__.k3_writer()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_app_role('__APP__', 'viewer') and not ('auditor' = any (__APP__.my_functions()));
$$;

-- Scope company + site satu record (dipakai RPC; policy memakai ekspresi inline supaya initplan)
create or replace function __APP__.k3_in_scope(p_company text, p_location uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_app_role('__APP__', 'viewer')
     and ('*' = any (__APP__.my_company_scope()) or p_company = any (__APP__.my_company_scope()))
     and ('*' = any (__APP__.my_location_scope()) or p_location::text = any (__APP__.my_location_scope()));
$$;

-- Penerima notifikasi: anggota aktif app dengan salah satu fungsi, yang scope company + site-nya
-- mencakup record (company grup / tanpa company = semua company).
create or replace function __APP__.users_with_function(p_functions text[], p_company text, p_location uuid)
returns uuid[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct m.user_id), '{}')
    from __APP__.members m
    join public.profiles p on p.id = m.user_id and p.is_active
    join public.app_access a on a.user_id = m.user_id and a.app_id = '__APP__'
    left join public.companies c on c.code = p.company
   where m.functions && p_functions
     and (m.location_ids is null or p_location is null or p_location = any (m.location_ids))
     and (p_company is null or p.company is null or p.company = p_company or coalesce(c.is_group, false));
$$;

revoke execute on function __APP__.users_with_function(text[], text, uuid) from public, anon, authenticated;

-- Hari ini (WIB) untuk overdue/umur
create or replace function __APP__.today_wib()
returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Jakarta')::date;
$$;

-- Label aksi tambahan (riwayat & CCTV); tetap memuat label bawaan 01_base
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
    when 'start' then 'dikerjakan'       when 'submit_evidence' then 'bukti dikirim'
    when 'accept' then 'diterima'        when 'change_due' then 'due date diubah'
    when 'effectiveness' then 'efektivitas dicatat'
    when 'actions_done' then 'semua tindakan selesai'
    else replace(p_action, '_', ' ') end;
$$;

-- =====================================================================================
-- TABEL
-- =====================================================================================

-- ---------------------------------------------------------------- kejadian
create table __APP__.incidents (
  id                   uuid primary key default gen_random_uuid(),
  code                 text not null,
  company_code         text not null references public.companies(code),
  location_id          uuid not null references public.locations(id),
  area_id              uuid not null references __APP__.areas(id),
  location_detail      text check (length(location_detail) <= 200),
  occurred_at          timestamptz not null,
  reported_at          timestamptz not null default now(),
  reported_category    text not null,                    -- kode master incident_category dari pelapor
  category             text,                             -- kode final dari HSE (dipakai KPI)
  injury_class         text check (injury_class in ('none', 'first_aid', 'medical_treatment',
                                                    'restricted_work', 'lost_time', 'fatality')),
  severity             text,                             -- kode master risk_level (aktual)
  potential_severity   text,                             -- kode master risk_level (potensi)
  unit_code            text check (length(unit_code) <= 40),
  unit_label           text check (length(unit_label) <= 120),
  description          text not null check (length(btrim(description)) between 1 and 1000),
  is_emergency         boolean not null default false,
  supervisor_id        uuid references public.profiles(id) on delete set null,
  ppe                  jsonb not null default '{}'::jsonb check (jsonb_typeof(ppe) = 'object'),
  damage_description   text check (length(damage_description) <= 1000),
  status               text not null default 'reported'
                       check (status in ('reported', 'classified', 'investigating', 'review_ehs',
                                         'review_mgmt', 'actions', 'closed')),
  return_note          text check (length(return_note) <= 2000),
  returned_at          timestamptz,
  lead_investigator_id uuid references public.profiles(id) on delete set null,
  classified_at        timestamptz,
  classified_by        uuid references public.profiles(id) on delete set null,
  closed_at            timestamptz,
  close_note           text check (length(close_note) <= 2000),
  closed_exception     boolean not null default false,
  search_text          text,
  created_by           uuid references public.profiles(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (company_code, code),
  check (occurred_at <= reported_at + interval '5 minutes')
);
comment on table __APP__.incidents is 'Kejadian K3 (jenis B). Ditulis HANYA lewat RPC incident_*; status = tahap workflow.';
create index incidents_list_idx     on __APP__.incidents (company_code, location_id, occurred_at desc);
create index incidents_status_idx   on __APP__.incidents (status, reported_at desc);
create index incidents_reporter_idx on __APP__.incidents (created_by, reported_at desc);
create index incidents_lead_idx     on __APP__.incidents (lead_investigator_id) where status not in ('closed');
create index incidents_area_idx     on __APP__.incidents (area_id);
create index incidents_search_idx   on __APP__.incidents using gin (search_text extensions.gin_trgm_ops);

create table __APP__.incident_persons (
  id            uuid primary key default gen_random_uuid(),
  incident_id   uuid not null references __APP__.incidents(id) on delete cascade,
  role          text not null check (role in ('involved', 'witness')),
  line_no       integer not null check (line_no between 1 and 50),
  name          text not null check (length(btrim(name)) between 1 and 120),
  company_kind  text not null default 'internal' check (company_kind in ('internal', 'contractor', 'visitor')),
  contractor_id uuid references __APP__.contractors(id),
  employment    text check (employment in ('permanent', 'contract', 'daily', 'visitor')),
  position      text check (length(position) <= 100),
  contact       text check (length(contact) <= 40),
  unique (incident_id, role, line_no)
);
create index incident_persons_incident_idx on __APP__.incident_persons (incident_id);

-- Data cedera terbatas (rancangan §2.7): hanya HSE & HR
create table __APP__.incident_restricted (
  incident_id     uuid primary key references __APP__.incidents(id) on delete cascade,
  injury_type     text check (length(injury_type) <= 200),
  body_parts      text[] not null default '{}' check (cardinality(body_parts) <= 30),
  treatment       text check (treatment in ('none', 'first_aid', 'clinic', 'hospital', 'other')),
  facility        text check (length(facility) <= 200),
  lost_days       integer check (lost_days between 0 and 3650),
  restricted_days integer check (restricted_days between 0 and 3650),
  updated_at      timestamptz not null default now()
);
comment on table __APP__.incident_restricted is 'Data cedera terbatas (HSE/HR). 1:1 dengan incidents.';

-- Nilai kerugian (komersial): HSE (isi), PJO, Manajemen, SCM, admin
create table __APP__.incident_costs (
  incident_id    uuid primary key references __APP__.incidents(id) on delete cascade,
  estimated_cost numeric(18,2) check (estimated_cost >= 0),
  updated_at     timestamptz not null default now()
);

create table __APP__.incident_team (
  incident_id uuid not null references __APP__.incidents(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role        text not null check (role in ('lead', 'member')),
  added_at    timestamptz not null default now(),
  primary key (incident_id, user_id)
);
create index incident_team_user_idx on __APP__.incident_team (user_id);

-- Investigasi 1:1 (S6): kronologi, rekonstruksi, analisis penyebab, rekomendasi
create table __APP__.incident_investigations (
  incident_id     uuid primary key references __APP__.incidents(id) on delete cascade,
  timeline        jsonb not null default '[]'::jsonb check (jsonb_typeof(timeline) = 'array'),
  reconstruction  text check (length(reconstruction) <= 4000),
  causes          jsonb not null default '{}'::jsonb check (jsonb_typeof(causes) = 'object'),
  recommendations jsonb not null default '[]'::jsonb check (jsonb_typeof(recommendations) = 'array'),
  updated_by      uuid references public.profiles(id) on delete set null,
  updated_at      timestamptz not null default now()
);

-- Jejak keputusan alur review (kirim/setujui/kembalikan)
create table __APP__.incident_reviews (
  id          bigint generated always as identity primary key,
  incident_id uuid not null references __APP__.incidents(id) on delete cascade,
  stage       text not null check (stage in ('investigation', 'ehs', 'mgmt')),
  decision    text not null check (decision in ('submit', 'approve', 'return')),
  note        text check (length(note) <= 2000),
  actor_id    uuid references public.profiles(id) on delete set null,
  at          timestamptz not null default now()
);
create index incident_reviews_incident_idx on __APP__.incident_reviews (incident_id, at);

create table __APP__.incidents_logs (
  id         bigint generated always as identity primary key,
  record_id  uuid not null,                     -- tanpa FK (K4)
  at         timestamptz not null default now(),
  actor_id   uuid references public.profiles(id) on delete set null,
  action     text not null check (action ~ '^[a-z][a-z0-9_]{1,40}$'),
  changes    jsonb,
  note       text check (length(note) <= 2000)
);
create index incidents_logs_record_idx on __APP__.incidents_logs (record_id, at desc);
create index incidents_logs_at_idx     on __APP__.incidents_logs (at desc);

-- ---------------------------------------------------------------- temuan
create table __APP__.findings (
  id              uuid primary key default gen_random_uuid(),
  code            text not null,
  company_code    text not null references public.companies(code),
  location_id     uuid not null references public.locations(id),
  area_id         uuid not null references __APP__.areas(id),
  location_detail text check (length(location_detail) <= 200),
  found_at        timestamptz not null,
  title           text not null check (length(btrim(title)) between 3 and 200),
  description     text not null check (length(btrim(description)) between 1 and 4000),
  source_kind     text not null check (source_kind in ('inspection', 'observation', 'audit', 'incident',
                                                       'meeting', 'other')),
  source_ref      text check (length(source_ref) <= 60),
  source_id       uuid references __APP__.incidents(id) on delete set null,
  category        text not null,                -- kode master finding_category
  risk_level      text not null,                -- kode master risk_level (prioritas)
  likelihood      smallint check (likelihood between 1 and 5),
  consequence     smallint check (consequence between 1 and 5),
  root_causes     jsonb not null default '[]'::jsonb check (jsonb_typeof(root_causes) = 'array'),
  pic_id          uuid not null references public.profiles(id),
  due_date        date not null,
  status          text not null default 'open'
                  check (status in ('open', 'in_progress', 'waiting_verification', 'closed')),
  closed_at       timestamptz,
  closed_by       uuid references public.profiles(id) on delete set null,
  close_note      text check (length(close_note) <= 2000),
  search_text     text,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (company_code, code),
  check ((source_kind = 'incident') = (source_id is not null))
);
comment on table __APP__.findings is 'Temuan K3. status = cache turunan dari tindakan (finding_refresh_status); overdue dihitung.';
create index findings_list_idx   on __APP__.findings (company_code, location_id, found_at desc);
create index findings_status_idx on __APP__.findings (status, due_date);
create index findings_pic_idx    on __APP__.findings (pic_id, status);
create index findings_source_idx on __APP__.findings (source_id) where source_id is not null;
create index findings_search_idx on __APP__.findings using gin (search_text extensions.gin_trgm_ops);

create table __APP__.findings_logs (
  id         bigint generated always as identity primary key,
  record_id  uuid not null,
  at         timestamptz not null default now(),
  actor_id   uuid references public.profiles(id) on delete set null,
  action     text not null check (action ~ '^[a-z][a-z0-9_]{1,40}$'),
  changes    jsonb,
  note       text check (length(note) <= 2000)
);
create index findings_logs_record_idx on __APP__.findings_logs (record_id, at desc);
create index findings_logs_at_idx     on __APP__.findings_logs (at desc);

-- ---------------------------------------------------------------- tindakan PICA
create table __APP__.pica_actions (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null,
  company_code       text not null references public.companies(code),
  location_id        uuid not null references public.locations(id),
  finding_id         uuid references __APP__.findings(id) on delete cascade,
  incident_id        uuid references __APP__.incidents(id) on delete cascade,
  title              text not null check (length(btrim(title)) between 3 and 500),
  kind               text not null check (kind in ('corrective', 'preventive')),
  pic_id             uuid not null references public.profiles(id),
  verifier_id        uuid not null references public.profiles(id),
  due_date           date not null,
  required_evidence  text check (length(required_evidence) <= 500),
  cause_ref          text check (length(cause_ref) <= 500),
  status             text not null default 'open'
                     check (status in ('open', 'in_progress', 'waiting_verification', 'closed')),
  round              integer not null default 1 check (round between 1 and 50),
  returned           boolean not null default false,
  closed_at          timestamptz,
  effectiveness_date date,
  effectiveness_note text check (length(effectiveness_note) <= 1000),
  search_text        text,
  created_by         uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (company_code, code),
  check ((finding_id is null) <> (incident_id is null)),
  check (pic_id <> verifier_id)
);
comment on table __APP__.pica_actions is 'Tindakan PICA milik temuan ATAU kejadian. Status hanya lewat RPC pica_*.';
create index pica_actions_finding_idx  on __APP__.pica_actions (finding_id) where finding_id is not null;
create index pica_actions_incident_idx on __APP__.pica_actions (incident_id) where incident_id is not null;
create index pica_actions_pic_idx      on __APP__.pica_actions (pic_id, status);
create index pica_actions_verifier_idx on __APP__.pica_actions (verifier_id, status);
create index pica_actions_due_idx      on __APP__.pica_actions (status, due_date);
create index pica_actions_search_idx   on __APP__.pica_actions using gin (search_text extensions.gin_trgm_ops);

create table __APP__.pica_evidence (
  id            uuid primary key default gen_random_uuid(),
  action_id     uuid not null references __APP__.pica_actions(id) on delete cascade,
  round         integer not null,
  note          text check (length(note) <= 2000),
  files         text[] not null check (cardinality(files) between 1 and 20),
  submitted_by  uuid references public.profiles(id) on delete set null,
  submitted_at  timestamptz not null default now(),
  decision      text check (decision in ('accepted', 'returned')),
  decision_note text check (length(decision_note) <= 2000),
  decided_by    uuid references public.profiles(id) on delete set null,
  decided_at    timestamptz,
  unique (action_id, round)
);
create index pica_evidence_action_idx on __APP__.pica_evidence (action_id, round);

create table __APP__.pica_actions_logs (
  id         bigint generated always as identity primary key,
  record_id  uuid not null,
  at         timestamptz not null default now(),
  actor_id   uuid references public.profiles(id) on delete set null,
  action     text not null check (action ~ '^[a-z][a-z0-9_]{1,40}$'),
  changes    jsonb,
  note       text check (length(note) <= 2000)
);
create index pica_actions_logs_record_idx on __APP__.pica_actions_logs (record_id, at desc);
create index pica_actions_logs_at_idx     on __APP__.pica_actions_logs (at desc);

-- =====================================================================================
-- TRIGGER (search_text, updated_at, log)
-- =====================================================================================
create or replace function __APP__.incidents_search_text()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.search_text := lower(concat_ws(' ', new.code, new.description, new.unit_code, new.unit_label,
                                     new.location_detail));
  return new;
end $$;

create or replace function __APP__.findings_search_text()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.search_text := lower(concat_ws(' ', new.code, new.title, new.description, new.source_ref, new.location_detail));
  return new;
end $$;

create or replace function __APP__.pica_actions_search_text()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.search_text := lower(concat_ws(' ', new.code, new.title, new.required_evidence));
  return new;
end $$;
revoke execute on function __APP__.incidents_search_text(), __APP__.findings_search_text(),
  __APP__.pica_actions_search_text() from public, anon, authenticated;

create trigger incidents_set_updated_at before update on __APP__.incidents
  for each row execute function public.set_updated_at();
create trigger incidents_search before insert or update on __APP__.incidents
  for each row execute function __APP__.incidents_search_text();
create trigger incidents_log after insert or update or delete on __APP__.incidents
  for each row execute function __APP__.log_changes('important', '/kejadian/', 'Kejadian');

create trigger findings_set_updated_at before update on __APP__.findings
  for each row execute function public.set_updated_at();
create trigger findings_search before insert or update on __APP__.findings
  for each row execute function __APP__.findings_search_text();
create trigger findings_log after insert or update or delete on __APP__.findings
  for each row when (coalesce(current_setting('app.log_skip', true), '') <> 'on')
  execute function __APP__.log_changes('important', '/temuan/', 'Temuan');

create trigger pica_actions_set_updated_at before update on __APP__.pica_actions
  for each row execute function public.set_updated_at();
create trigger pica_actions_search before insert or update on __APP__.pica_actions
  for each row execute function __APP__.pica_actions_search_text();
create trigger pica_actions_log after insert or update or delete on __APP__.pica_actions
  for each row execute function __APP__.log_changes('important', '', 'Tindakan PICA');

-- =====================================================================================
-- RLS (baca saja; tulis lewat RPC)
-- =====================================================================================
alter table __APP__.incidents enable row level security;
alter table __APP__.incident_persons enable row level security;
alter table __APP__.incident_restricted enable row level security;
alter table __APP__.incident_costs enable row level security;
alter table __APP__.incident_team enable row level security;
alter table __APP__.incident_investigations enable row level security;
alter table __APP__.incident_reviews enable row level security;
alter table __APP__.incidents_logs enable row level security;
alter table __APP__.findings enable row level security;
alter table __APP__.findings_logs enable row level security;
alter table __APP__.pica_actions enable row level security;
alter table __APP__.pica_evidence enable row level security;
alter table __APP__.pica_actions_logs enable row level security;

revoke insert, update, delete on __APP__.incidents, __APP__.incident_persons, __APP__.incident_restricted,
  __APP__.incident_costs, __APP__.incident_team, __APP__.incident_investigations, __APP__.incident_reviews,
  __APP__.incidents_logs, __APP__.findings, __APP__.findings_logs, __APP__.pica_actions,
  __APP__.pica_evidence, __APP__.pica_actions_logs from authenticated, anon;

-- Anti rekursi RLS: incidents ↔ incident_team dan findings ↔ pica_actions saling merujuk. Policy
-- memakai daftar id dari helper definer (dievaluasi sekali per query sebagai initplan).
create or replace function __APP__.k3_my_team_incidents()
returns uuid[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(incident_id), '{}') from __APP__.incident_team where user_id = auth.uid();
$$;
create or replace function __APP__.k3_my_action_findings()
returns uuid[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct finding_id), '{}') from __APP__.pica_actions
   where finding_id is not null and (pic_id = auth.uid() or verifier_id = auth.uid());
$$;

-- Kejadian: scope company + site; tanpa fungsi K3 (selain karyawan) hanya miliknya / atasan / tim
create policy "incidents: read" on __APP__.incidents for select to authenticated
  using ((select public.has_app_role('__APP__', 'viewer'))
         and ('*' = any ((select __APP__.my_company_scope())::text[])
              or company_code = any ((select __APP__.my_company_scope())::text[]))
         and ('*' = any ((select __APP__.my_location_scope())::text[])
              or location_id::text = any ((select __APP__.my_location_scope())::text[]))
         and ((select __APP__.k3_sees_all())
              or created_by = (select auth.uid())
              or supervisor_id = (select auth.uid())
              or id = any ((select __APP__.k3_my_team_incidents())::uuid[])));

create policy "incident_persons: read with incident" on __APP__.incident_persons for select to authenticated
  using (exists (select 1 from __APP__.incidents i where i.id = incident_id));
create policy "incident_team: read with incident" on __APP__.incident_team for select to authenticated
  using (exists (select 1 from __APP__.incidents i where i.id = incident_id));
create policy "incident_investigations: read with incident" on __APP__.incident_investigations for select to authenticated
  using (exists (select 1 from __APP__.incidents i where i.id = incident_id));
create policy "incident_reviews: read with incident" on __APP__.incident_reviews for select to authenticated
  using (exists (select 1 from __APP__.incidents i where i.id = incident_id));
create policy "incident_restricted: hse/hr" on __APP__.incident_restricted for select to authenticated
  using ((select __APP__.has_any_function(array['hse', 'hr']))
         and exists (select 1 from __APP__.incidents i where i.id = incident_id));
create policy "incident_costs: komersial" on __APP__.incident_costs for select to authenticated
  using (((select __APP__.has_any_function(array['hse', 'pjo', 'manajemen', 'scm']))
          or (select public.has_app_role('__APP__', 'admin')))
         and exists (select 1 from __APP__.incidents i where i.id = incident_id));
create policy "incidents_logs: read with incident" on __APP__.incidents_logs for select to authenticated
  using (exists (select 1 from __APP__.incidents i where i.id = record_id)
         or (select public.has_app_role('__APP__', 'admin')));

-- Temuan: scope company + site; tanpa fungsi K3 → yang dibuat / ditugaskan kepadanya
create policy "findings: read" on __APP__.findings for select to authenticated
  using ((select public.has_app_role('__APP__', 'viewer'))
         and ('*' = any ((select __APP__.my_company_scope())::text[])
              or company_code = any ((select __APP__.my_company_scope())::text[]))
         and ('*' = any ((select __APP__.my_location_scope())::text[])
              or location_id::text = any ((select __APP__.my_location_scope())::text[]))
         and ((select __APP__.k3_sees_all())
              or created_by = (select auth.uid())
              or pic_id = (select auth.uid())
              or id = any ((select __APP__.k3_my_action_findings())::uuid[])));
create policy "findings_logs: read with finding" on __APP__.findings_logs for select to authenticated
  using (exists (select 1 from __APP__.findings f where f.id = record_id)
         or (select public.has_app_role('__APP__', 'admin')));

-- Tindakan: induk terbaca, atau PIC / verifikator tindakan itu
create policy "pica_actions: read" on __APP__.pica_actions for select to authenticated
  using ((select public.has_app_role('__APP__', 'viewer'))
         and (pic_id = (select auth.uid()) or verifier_id = (select auth.uid())
              or exists (select 1 from __APP__.findings f where f.id = finding_id)
              or exists (select 1 from __APP__.incidents i where i.id = incident_id)));
create policy "pica_evidence: read with action" on __APP__.pica_evidence for select to authenticated
  using (exists (select 1 from __APP__.pica_actions a where a.id = action_id));
create policy "pica_actions_logs: read with action" on __APP__.pica_actions_logs for select to authenticated
  using (exists (select 1 from __APP__.pica_actions a where a.id = record_id)
         or (select public.has_app_role('__APP__', 'admin')));

-- Visibilitas record untuk RPC definer (cermin policy di atas)
create or replace function __APP__.k3_incident_visible(p_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from __APP__.incidents i
     where i.id = p_id
       and __APP__.k3_in_scope(i.company_code, i.location_id)
       and (__APP__.k3_sees_all() or i.created_by = auth.uid() or i.supervisor_id = auth.uid()
            or exists (select 1 from __APP__.incident_team t where t.incident_id = i.id and t.user_id = auth.uid())));
$$;

create or replace function __APP__.k3_finding_visible(p_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from __APP__.findings f
     where f.id = p_id
       and __APP__.k3_in_scope(f.company_code, f.location_id)
       and (__APP__.k3_sees_all() or f.created_by = auth.uid() or f.pic_id = auth.uid()
            or exists (select 1 from __APP__.pica_actions a where a.finding_id = f.id
                        and (a.pic_id = auth.uid() or a.verifier_id = auth.uid()))));
$$;

create or replace function __APP__.k3_action_visible(p_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from __APP__.pica_actions a
     where a.id = p_id
       and public.has_app_role('__APP__', 'viewer')
       and (a.pic_id = auth.uid() or a.verifier_id = auth.uid()
            or (a.finding_id is not null and __APP__.k3_finding_visible(a.finding_id))
            or (a.incident_id is not null and __APP__.k3_incident_visible(a.incident_id))));
$$;

-- =====================================================================================
-- STORAGE: folder kejadian/<id>/, temuan/<id>/, pica/<action_id>/r<round>/ (ikut hak baca record)
-- Policy lampiran 07_storage dibuat ulang di sini karena merujuk tabel modul ini.
-- =====================================================================================
update storage.buckets
   set allowed_mime_types = array(select distinct unnest(allowed_mime_types || array['video/mp4']))
 where id = '__HOST__-lampiran';

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
      -- kejadian: pelapor, HSE, atau tim investigasi; kejadian belum ditutup
      when 'kejadian' then (select __APP__.k3_writer()) and exists (
                             select 1 from __APP__.incidents i
                              where i.id::text = (storage.foldername(name))[2] and i.status <> 'closed'
                                and (i.created_by = (select auth.uid()) or (select __APP__.has_function('hse'))
                                     or exists (select 1 from __APP__.incident_team t
                                                 where t.incident_id = i.id and t.user_id = (select auth.uid()))))
      -- temuan: pembuat, PIC temuan, HSE
      when 'temuan'   then (select __APP__.k3_writer()) and exists (
                             select 1 from __APP__.findings f
                              where f.id::text = (storage.foldername(name))[2] and f.status <> 'closed'
                                and (f.created_by = (select auth.uid()) or f.pic_id = (select auth.uid())
                                     or (select __APP__.has_function('hse'))))
      -- bukti tindakan: hanya PIC, ke folder putaran yang sedang berjalan
      when 'pica'     then exists (
                             select 1 from __APP__.pica_actions a
                              where a.id::text = (storage.foldername(name))[2]
                                and a.pic_id = (select auth.uid())
                                and a.status in ('open', 'in_progress')
                                and (storage.foldername(name))[3] = 'r' || a.round)
      else (select public.has_app_role('__APP__', 'editor'))
    end));

-- =====================================================================================
-- VALIDASI MASTER
-- =====================================================================================
create or replace function __APP__.k3_master_ok(p_kind text, p_code text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from __APP__.master_items where kind = p_kind and code = p_code and is_active);
$$;

create or replace function __APP__.k3_user_ok(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p join public.app_access a on a.user_id = p.id
                  where p.id = p_user and p.is_active and a.app_id = '__APP__');
$$;

-- =====================================================================================
-- RPC KEJADIAN
-- =====================================================================================

-- Simpan orang terkait (ganti seluruhnya). p_persons: [{role, name, company_kind, contractor_id?,
-- employment?, position?, contact?}]
create or replace function __APP__.k3_incident_set_persons(p_id uuid, p_company text, p_persons jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if jsonb_typeof(coalesce(p_persons, '[]')) <> 'array' or jsonb_array_length(coalesce(p_persons, '[]')) > 60 then
    raise exception 'Daftar pihak terkait tidak valid (maksimal 60 orang).' using errcode = 'P0001';
  end if;
  delete from __APP__.incident_persons where incident_id = p_id;
  insert into __APP__.incident_persons (incident_id, role, line_no, name, company_kind, contractor_id,
                                        employment, position, contact)
  select p_id, e ->> 'role',
         row_number() over (partition by e ->> 'role' order by ord)::integer,
         btrim(e ->> 'name'), coalesce(nullif(e ->> 'company_kind', ''), 'internal'),
         (select c.id from __APP__.contractors c
           where c.id = nullif(e ->> 'contractor_id', '')::uuid and c.company_code = p_company),
         nullif(e ->> 'employment', ''), nullif(btrim(e ->> 'position'), ''), nullif(btrim(e ->> 'contact'), '')
    from jsonb_array_elements(coalesce(p_persons, '[]')) with ordinality as x(e, ord)
   where length(btrim(coalesce(e ->> 'name', ''))) > 0;
end $$;
revoke execute on function __APP__.k3_incident_set_persons(uuid, text, jsonb) from public, anon, authenticated;

-- Lapor kejadian. p: {company_code?, location_id, area_id, location_detail?, occurred_at, category,
--   unit_code?, unit_label?, description, is_emergency?, supervisor_id?, persons?: [...]}
-- Hasil: {id, code, notification_ids}
create or replace function __APP__.incident_report(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid      uuid := auth.uid();
  v_company  text;
  v_location uuid := nullif(p ->> 'location_id', '')::uuid;
  v_area     uuid := nullif(p ->> 'area_id', '')::uuid;
  v_occurred timestamptz := nullif(p ->> 'occurred_at', '')::timestamptz;
  v_id       uuid;
  v_code     text;
  v_emerg    boolean := coalesce((p ->> 'is_emergency')::boolean, false);
  v_notif    uuid[];
begin
  if not __APP__.k3_writer() then
    raise exception 'Anda tidak punya akses untuk melapor kejadian.' using errcode = '42501';
  end if;
  select coalesce(nullif(p ->> 'company_code', ''), pr.company) into v_company
    from public.profiles pr where pr.id = v_uid;
  if v_company is null or not exists (select 1 from public.companies where code = v_company and not is_group) then
    raise exception 'Pilih perusahaan.' using errcode = 'P0001';
  end if;
  if v_location is null or not __APP__.k3_in_scope(v_company, v_location)
     or not exists (select 1 from public.locations where id = v_location and is_active) then
    raise exception 'Site tidak valid atau di luar akses Anda.' using errcode = 'P0001';
  end if;
  if v_area is null or not exists (select 1 from __APP__.areas where id = v_area and location_id = v_location and is_active) then
    raise exception 'Lokasi kejadian wajib dipilih dari area site ini.' using errcode = 'P0001';
  end if;
  if v_occurred is null then
    raise exception 'Tanggal kejadian wajib diisi.' using errcode = 'P0001';
  end if;
  if v_occurred > now() + interval '5 minutes' then
    raise exception 'Tanggal kejadian tidak boleh melebihi waktu laporan.' using errcode = 'P0001';
  end if;
  if not __APP__.k3_master_ok('incident_category', p ->> 'category') then
    raise exception 'Kategori kejadian wajib dipilih.' using errcode = 'P0001';
  end if;
  if length(btrim(coalesce(p ->> 'description', ''))) = 0 then
    raise exception 'Uraian kejadian wajib diisi.' using errcode = 'P0001';
  end if;
  if nullif(p ->> 'supervisor_id', '') is not null and not __APP__.k3_user_ok((p ->> 'supervisor_id')::uuid) then
    raise exception 'Atasan langsung tidak ditemukan.' using errcode = 'P0001';
  end if;

  v_code := __APP__.next_doc_number('KJD', v_company, 'year');
  perform __APP__.set_log_context('report', case when v_emerg then 'Butuh penanganan darurat' end);
  insert into __APP__.incidents (code, company_code, location_id, area_id, location_detail, occurred_at,
    reported_category, unit_code, unit_label, description, is_emergency, supervisor_id, created_by)
  values (v_code, v_company, v_location, v_area, nullif(btrim(p ->> 'location_detail'), ''), v_occurred,
    p ->> 'category', nullif(btrim(p ->> 'unit_code'), ''), nullif(btrim(p ->> 'unit_label'), ''),
    btrim(p ->> 'description'), v_emerg, nullif(p ->> 'supervisor_id', '')::uuid, v_uid)
  returning id into v_id;
  perform __APP__.set_log_context('', '');
  perform __APP__.k3_incident_set_persons(v_id, v_company, p -> 'persons');

  select array_agg(n) into v_notif from __APP__.notify(
    __APP__.users_with_function(array['hse', 'pjo'], v_company, v_location),
    'incident.reported',
    case when v_emerg then 'DARURAT: kejadian ' else 'Kejadian baru ' end || v_code,
    left(btrim(p ->> 'description'), 200), '/kejadian/' || v_id, 'kejadian', 'incidents', v_id::text) n;

  return jsonb_build_object('id', v_id, 'code', v_code, 'notification_ids', coalesce(v_notif, '{}'));
end $$;

-- Klasifikasi & dampak (HSE). Boleh diulang selama belum ditutup.
-- p: {category, injury_class, severity, potential_severity, ppe: {kode: bool}, damage_description?,
--     restricted?: {injury_type, body_parts[], treatment, facility, lost_days, restricted_days},
--     estimated_cost?}
create or replace function __APP__.incident_classify(p_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r       __APP__.incidents;
  v_first boolean;
  v_notif uuid[];
begin
  select * into r from __APP__.incidents where id = p_id for update;
  if r.id is null or not __APP__.k3_incident_visible(p_id) then
    raise exception 'Kejadian tidak ditemukan.' using errcode = 'P0001';
  end if;
  if not (__APP__.k3_writer() and __APP__.has_function('hse')) then
    raise exception 'Hanya HSE yang bisa mengklasifikasi kejadian.' using errcode = '42501';
  end if;
  if r.status = 'closed' then
    raise exception 'Kejadian sudah ditutup.' using errcode = 'P0001';
  end if;
  if not __APP__.k3_master_ok('incident_category', p ->> 'category') then
    raise exception 'Kategori final wajib dipilih.' using errcode = 'P0001';
  end if;
  if not __APP__.k3_master_ok('risk_level', p ->> 'severity')
     or not __APP__.k3_master_ok('risk_level', p ->> 'potential_severity') then
    raise exception 'Tingkat keparahan aktual dan potensi wajib dipilih.' using errcode = 'P0001';
  end if;
  if coalesce(p ->> 'injury_class', '') not in ('none', 'first_aid', 'medical_treatment', 'restricted_work',
                                                'lost_time', 'fatality') then
    raise exception 'Kelas cedera wajib dipilih.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(coalesce(p -> 'ppe', '{}')) <> 'object' then
    raise exception 'Data APD tidak valid.' using errcode = 'P0001';
  end if;

  v_first := r.status = 'reported';

  if p ? 'restricted' and jsonb_typeof(p -> 'restricted') = 'object' then
    insert into __APP__.incident_restricted (incident_id, injury_type, body_parts, treatment, facility,
                                             lost_days, restricted_days)
    values (p_id, nullif(btrim(p -> 'restricted' ->> 'injury_type'), ''),
            coalesce((select array_agg(btrim(x)) from jsonb_array_elements_text(p -> 'restricted' -> 'body_parts') x
                       where length(btrim(x)) > 0), '{}'),
            nullif(p -> 'restricted' ->> 'treatment', ''), nullif(btrim(p -> 'restricted' ->> 'facility'), ''),
            nullif(p -> 'restricted' ->> 'lost_days', '')::integer,
            nullif(p -> 'restricted' ->> 'restricted_days', '')::integer)
    on conflict (incident_id) do update
      set injury_type = excluded.injury_type, body_parts = excluded.body_parts, treatment = excluded.treatment,
          facility = excluded.facility, lost_days = excluded.lost_days, restricted_days = excluded.restricted_days,
          updated_at = now();
  end if;
  if p ? 'estimated_cost' then
    insert into __APP__.incident_costs (incident_id, estimated_cost)
    values (p_id, nullif(p ->> 'estimated_cost', '')::numeric)
    on conflict (incident_id) do update set estimated_cost = excluded.estimated_cost, updated_at = now();
  end if;

  perform __APP__.set_log_context(case when v_first then 'classify' else 'update' end, null);
  perform __APP__.set_log_extra(case when p ? 'restricted' then jsonb_build_object('data_terbatas', 'diperbarui') end);
  update __APP__.incidents
     set category = p ->> 'category', injury_class = p ->> 'injury_class', severity = p ->> 'severity',
         potential_severity = p ->> 'potential_severity', ppe = coalesce(p -> 'ppe', '{}'),
         damage_description = nullif(btrim(p ->> 'damage_description'), ''),
         status = case when v_first then 'classified' else status end,
         classified_at = coalesce(classified_at, now()), classified_by = coalesce(classified_by, auth.uid())
   where id = p_id;
  perform __APP__.set_log_extra(null);
  perform __APP__.set_log_context('', '');

  if v_first then
    select array_agg(n) into v_notif from __APP__.notify(array[r.created_by], 'incident.classified',
      'Kejadian ' || r.code || ' diklasifikasi HSE', null, '/kejadian/' || p_id, 'kejadian', 'incidents', p_id::text) n;
  end if;
  return jsonb_build_object('id', p_id, 'notification_ids', coalesce(v_notif, '{}'));
end $$;

-- Mulai investigasi / ubah tim (HSE). Ketua wajib; anggota opsional.
create or replace function __APP__.incident_set_team(p_id uuid, p_lead uuid, p_members uuid[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r       __APP__.incidents;
  v_new   uuid[];
  v_notif uuid[];
  v_first boolean;
begin
  select * into r from __APP__.incidents where id = p_id for update;
  if r.id is null or not __APP__.k3_incident_visible(p_id) then
    raise exception 'Kejadian tidak ditemukan.' using errcode = 'P0001';
  end if;
  if not (__APP__.k3_writer() and __APP__.has_function('hse')) then
    raise exception 'Hanya HSE yang bisa menetapkan tim investigasi.' using errcode = '42501';
  end if;
  if r.status not in ('classified', 'investigating') then
    raise exception 'Tim investigasi hanya bisa ditetapkan setelah klasifikasi dan sebelum review.' using errcode = 'P0001';
  end if;
  if p_lead is null or not __APP__.k3_user_ok(p_lead) then
    raise exception 'Ketua investigasi wajib dipilih.' using errcode = 'P0001';
  end if;
  if exists (select 1 from unnest(coalesce(p_members, '{}')) m where not __APP__.k3_user_ok(m)) then
    raise exception 'Anggota tim tidak ditemukan.' using errcode = 'P0001';
  end if;
  if cardinality(coalesce(p_members, '{}')) > 20 then
    raise exception 'Maksimal 20 anggota tim.' using errcode = 'P0001';
  end if;

  v_first := r.status = 'classified';
  select coalesce(array_agg(u), '{}') into v_new
    from (select p_lead as u union select unnest(coalesce(p_members, '{}'))) x
   where u not in (select user_id from __APP__.incident_team where incident_id = p_id);

  delete from __APP__.incident_team where incident_id = p_id;
  insert into __APP__.incident_team (incident_id, user_id, role)
  select p_id, u, case when u = p_lead then 'lead' else 'member' end
    from (select p_lead as u union select unnest(coalesce(p_members, '{}'))) x;
  insert into __APP__.incident_investigations (incident_id) values (p_id) on conflict do nothing;

  perform __APP__.set_log_context(case when v_first then 'start_investigation' else 'update' end, null);
  perform __APP__.set_log_extra(jsonb_build_object('tim', (
    select string_agg(pr.full_name || case when t.role = 'lead' then ' (ketua)' else '' end, ', ' order by t.role, pr.full_name)
      from __APP__.incident_team t join public.profiles pr on pr.id = t.user_id where t.incident_id = p_id)));
  update __APP__.incidents
     set lead_investigator_id = p_lead, status = 'investigating'
   where id = p_id;
  perform __APP__.set_log_extra(null);
  perform __APP__.set_log_context('', '');

  select array_agg(n) into v_notif from __APP__.notify(v_new, 'incident.team',
    'Anda ditugaskan dalam investigasi ' || r.code, left(r.description, 200), '/kejadian/' || p_id || '?tab=investigasi',
    'kejadian', 'incidents', p_id::text) n;
  return jsonb_build_object('id', p_id, 'notification_ids', coalesce(v_notif, '{}'));
end $$;

-- Simpan investigasi & analisis (HSE atau tim). p: {timeline:[{time,event}], reconstruction,
--   causes:{unsafe_act:[{text,note}], unsafe_condition:[...], job_factor:[...], personal_factor:[...]},
--   recommendations:[{text}]}
create or replace function __APP__.incident_save_investigation(p_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r      __APP__.incidents;
  v_tl   jsonb;
  v_cs   jsonb;
  v_rec  jsonb;
  v_key  text;
begin
  select * into r from __APP__.incidents where id = p_id for update;
  if r.id is null or not __APP__.k3_incident_visible(p_id) then
    raise exception 'Kejadian tidak ditemukan.' using errcode = 'P0001';
  end if;
  if not __APP__.k3_writer() or not (__APP__.has_function('hse')
     or exists (select 1 from __APP__.incident_team where incident_id = p_id and user_id = auth.uid())) then
    raise exception 'Hanya HSE atau tim investigasi yang bisa mengubah investigasi.' using errcode = '42501';
  end if;
  if r.status <> 'investigating' then
    raise exception 'Investigasi hanya bisa diubah pada tahap Investigasi.' using errcode = 'P0001';
  end if;

  -- normalisasi: buang baris kosong, batasi panjang
  select coalesce(jsonb_agg(jsonb_build_object('time', left(btrim(coalesce(e ->> 'time', '')), 20),
                                               'event', left(btrim(e ->> 'event'), 1000)) order by ord), '[]')
    into v_tl
    from jsonb_array_elements(coalesce(p -> 'timeline', '[]')) with ordinality x(e, ord)
   where length(btrim(coalesce(e ->> 'event', ''))) > 0;
  v_cs := '{}';
  foreach v_key in array array['unsafe_act', 'unsafe_condition', 'job_factor', 'personal_factor'] loop
    v_cs := v_cs || jsonb_build_object(v_key, (
      select coalesce(jsonb_agg(jsonb_build_object('text', left(btrim(e ->> 'text'), 300),
                                                   'note', left(btrim(coalesce(e ->> 'note', '')), 1000)) order by ord), '[]')
        from jsonb_array_elements(case when jsonb_typeof(p -> 'causes' -> v_key) = 'array'
                                       then p -> 'causes' -> v_key else '[]' end) with ordinality x(e, ord)
       where length(btrim(coalesce(e ->> 'text', ''))) > 0));
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('text', left(btrim(e ->> 'text'), 500)) order by ord), '[]')
    into v_rec
    from jsonb_array_elements(coalesce(p -> 'recommendations', '[]')) with ordinality x(e, ord)
   where length(btrim(coalesce(e ->> 'text', ''))) > 0;
  if jsonb_array_length(v_tl) > 100 or jsonb_array_length(v_rec) > 50 then
    raise exception 'Isian investigasi terlalu banyak.' using errcode = 'P0001';
  end if;

  insert into __APP__.incident_investigations (incident_id, timeline, reconstruction, causes, recommendations,
                                               updated_by, updated_at)
  values (p_id, v_tl, nullif(btrim(p ->> 'reconstruction'), ''), v_cs, v_rec, auth.uid(), now())
  on conflict (incident_id) do update
    set timeline = excluded.timeline, reconstruction = excluded.reconstruction, causes = excluded.causes,
        recommendations = excluded.recommendations, updated_by = excluded.updated_by, updated_at = now();

  perform __APP__.set_log_context('save_investigation', null);
  perform __APP__.set_log_extra(jsonb_build_object('investigasi', format('%s kronologi, %s penyebab, %s rekomendasi',
    jsonb_array_length(v_tl),
    (select count(*) from jsonb_each(v_cs) c, jsonb_array_elements(c.value)), jsonb_array_length(v_rec))));
  update __APP__.incidents set updated_at = now() where id = p_id;
  perform __APP__.set_log_extra(null);
  perform __APP__.set_log_context('', '');
  return jsonb_build_object('id', p_id);
end $$;

-- Kirim investigasi ke Review EHS (HSE atau ketua tim)
create or replace function __APP__.incident_submit_review(p_id uuid, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r       __APP__.incidents;
  v_inv   __APP__.incident_investigations;
  v_notif uuid[];
begin
  select * into r from __APP__.incidents where id = p_id for update;
  if r.id is null or not __APP__.k3_incident_visible(p_id) then
    raise exception 'Kejadian tidak ditemukan.' using errcode = 'P0001';
  end if;
  if not __APP__.k3_writer() or not (__APP__.has_function('hse') or r.lead_investigator_id = auth.uid()) then
    raise exception 'Hanya HSE atau ketua investigasi yang bisa mengirim ke review.' using errcode = '42501';
  end if;
  if r.status <> 'investigating' then
    raise exception 'Kejadian tidak sedang dalam tahap Investigasi.' using errcode = 'P0001';
  end if;
  select * into v_inv from __APP__.incident_investigations where incident_id = p_id;
  if v_inv.incident_id is null or jsonb_array_length(v_inv.timeline) = 0 then
    raise exception 'Lengkapi kronologi kejadian sebelum mengirim ke review.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from jsonb_each(v_inv.causes) c, jsonb_array_elements(c.value)) then
    raise exception 'Isi minimal satu penyebab di Analisis Penyebab.' using errcode = 'P0001';
  end if;

  insert into __APP__.incident_reviews (incident_id, stage, decision, note, actor_id)
  values (p_id, 'investigation', 'submit', nullif(btrim(p_note), ''), auth.uid());
  perform __APP__.set_log_context('submit_review', nullif(btrim(p_note), ''));
  update __APP__.incidents set status = 'review_ehs', return_note = null, returned_at = null where id = p_id;
  perform __APP__.set_log_context('', '');

  select array_agg(n) into v_notif from __APP__.notify(
    array(select u from unnest(__APP__.users_with_function(array['hse_senior'], r.company_code, r.location_id)) u
           where u is distinct from r.created_by),
    'incident.review_ehs', 'Review EHS: ' || r.code, left(r.description, 200),
    '/kejadian/' || p_id || '?tab=review', 'kejadian', 'incidents', p_id::text) n;
  return jsonb_build_object('id', p_id, 'notification_ids', coalesce(v_notif, '{}'));
end $$;

-- Syarat penutupan (popover "Tutup Kejadian"). Hasil: [{key, label, ok}]
create or replace function __APP__.incident_close_check(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  r        __APP__.incidents;
  v_total  integer;
  v_open   integer;
begin
  select * into r from __APP__.incidents where id = p_id;
  if r.id is null or not __APP__.k3_incident_visible(p_id) then
    raise exception 'Kejadian tidak ditemukan.' using errcode = 'P0001';
  end if;
  select count(*), count(*) filter (where status <> 'closed') into v_total, v_open
    from __APP__.pica_actions where incident_id = p_id;
  return jsonb_build_array(
    jsonb_build_object('key', 'classified', 'label', 'Klasifikasi HSE selesai', 'ok', r.category is not null),
    jsonb_build_object('key', 'investigation', 'label', 'Investigasi lengkap & dikirim',
                       'ok', r.status in ('review_ehs', 'review_mgmt', 'actions', 'closed')),
    jsonb_build_object('key', 'review', 'label', 'Review EHS & manajemen disetujui',
                       'ok', r.status in ('actions', 'closed')),
    jsonb_build_object('key', 'actions',
                       'label', case when v_open = 0 then 'Semua tindakan terverifikasi'
                                     else format('%s dari %s tindakan belum terverifikasi', v_open, v_total) end,
                       'ok', v_open = 0));
end $$;

-- Tutup otomatis (S4): dipanggil setelah review manajemen & setelah tindakan Closed
create or replace function __APP__.k3_incident_try_close(p_id uuid)
returns uuid[] language plpgsql security definer set search_path = '' as $$
declare
  r       __APP__.incidents;
  v_notif uuid[];
begin
  select * into r from __APP__.incidents where id = p_id for update;
  if r.status <> 'actions'
     or exists (select 1 from __APP__.pica_actions where incident_id = p_id and status <> 'closed') then
    return '{}';
  end if;
  perform __APP__.set_log_context('close', 'Semua tindakan terverifikasi');
  update __APP__.incidents set status = 'closed', closed_at = now() where id = p_id;
  perform __APP__.set_log_context('', '');
  select array_agg(n) into v_notif from __APP__.notify(array[r.created_by, r.lead_investigator_id],
    'incident.closed', 'Kejadian ' || r.code || ' ditutup', null, '/kejadian/' || p_id, 'kejadian', 'incidents', p_id::text) n;
  return coalesce(v_notif, '{}');
end $$;
revoke execute on function __APP__.k3_incident_try_close(uuid) from public, anon, authenticated;

-- Keputusan review. Tahap dari status: review_ehs → hse_senior; review_mgmt → pjo/manajemen.
-- p_decision: approve | return (catatan wajib). Pelapor tidak boleh menyetujui laporannya sendiri.
create or replace function __APP__.incident_review(p_id uuid, p_decision text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r        __APP__.incidents;
  v_stage  text;
  v_notif  uuid[] := '{}';
  v_more   uuid[];
  v_next   text;
begin
  select * into r from __APP__.incidents where id = p_id for update;
  if r.id is null or not __APP__.k3_incident_visible(p_id) then
    raise exception 'Kejadian tidak ditemukan.' using errcode = 'P0001';
  end if;
  if r.status not in ('review_ehs', 'review_mgmt') then
    raise exception 'Kejadian tidak sedang menunggu review.' using errcode = 'P0001';
  end if;
  v_stage := case r.status when 'review_ehs' then 'ehs' else 'mgmt' end;
  if not __APP__.k3_writer()
     or (v_stage = 'ehs' and not __APP__.has_function('hse_senior'))
     or (v_stage = 'mgmt' and not __APP__.has_any_function(array['pjo', 'manajemen'])) then
    raise exception 'Anda bukan peninjau untuk tahap ini.' using errcode = '42501';
  end if;
  if r.created_by = auth.uid() then
    raise exception 'Pembuat laporan tidak dapat meninjau laporannya sendiri.' using errcode = '42501';
  end if;
  if p_decision not in ('approve', 'return') then
    raise exception 'Keputusan tidak dikenal.' using errcode = '22023';
  end if;
  if p_decision = 'return' and length(btrim(coalesce(p_note, ''))) = 0 then
    raise exception 'Catatan wajib diisi saat mengembalikan.' using errcode = 'P0001';
  end if;

  insert into __APP__.incident_reviews (incident_id, stage, decision, note, actor_id)
  values (p_id, v_stage, p_decision, nullif(btrim(p_note), ''), auth.uid());

  if p_decision = 'return' then
    perform __APP__.set_log_context('return', btrim(p_note));
    update __APP__.incidents set status = 'investigating', return_note = btrim(p_note), returned_at = now()
     where id = p_id;
    perform __APP__.set_log_context('', '');
    select array_agg(n) into v_notif from __APP__.notify(array[r.lead_investigator_id, r.classified_by],
      'incident.returned', 'Investigasi ' || r.code || ' dikembalikan', left(btrim(p_note), 200),
      '/kejadian/' || p_id || '?tab=review', 'kejadian', 'incidents', p_id::text) n;
  elsif v_stage = 'ehs' then
    perform __APP__.set_log_context('approve_ehs', nullif(btrim(p_note), ''));
    update __APP__.incidents set status = 'review_mgmt' where id = p_id;
    perform __APP__.set_log_context('', '');
    select array_agg(n) into v_notif from __APP__.notify(
      array(select u from unnest(__APP__.users_with_function(array['pjo', 'manajemen'], r.company_code, r.location_id)) u
             where u is distinct from r.created_by),
      'incident.review_mgmt', 'Review manajemen: ' || r.code, left(r.description, 200),
      '/kejadian/' || p_id || '?tab=review', 'kejadian', 'incidents', p_id::text) n;
  else
    v_next := 'actions';
    perform __APP__.set_log_context('approve_mgmt', nullif(btrim(p_note), ''));
    update __APP__.incidents set status = v_next where id = p_id;
    perform __APP__.set_log_context('', '');
    select array_agg(n) into v_notif from __APP__.notify(array[r.created_by, r.lead_investigator_id],
      'incident.approved', 'Kejadian ' || r.code || ' disetujui manajemen', null,
      '/kejadian/' || p_id, 'kejadian', 'incidents', p_id::text) n;
    v_more := __APP__.k3_incident_try_close(p_id);
    v_notif := coalesce(v_notif, '{}') || coalesce(v_more, '{}');
  end if;
  return jsonb_build_object('id', p_id, 'notification_ids', coalesce(v_notif, '{}'));
end $$;

-- Tutup dengan pengecualian (PJO, alasan wajib)
create or replace function __APP__.incident_close_exception(p_id uuid, p_note text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r       __APP__.incidents;
  v_notif uuid[];
begin
  select * into r from __APP__.incidents where id = p_id for update;
  if r.id is null or not __APP__.k3_incident_visible(p_id) then
    raise exception 'Kejadian tidak ditemukan.' using errcode = 'P0001';
  end if;
  if not (__APP__.k3_writer() and __APP__.has_function('pjo')) then
    raise exception 'Hanya PJO yang bisa menutup dengan pengecualian.' using errcode = '42501';
  end if;
  if r.status = 'closed' then
    raise exception 'Kejadian sudah ditutup.' using errcode = 'P0001';
  end if;
  if length(btrim(coalesce(p_note, ''))) < 10 then
    raise exception 'Alasan penutupan wajib diisi (minimal 10 karakter).' using errcode = 'P0001';
  end if;
  perform __APP__.set_log_context('close_exception', btrim(p_note));
  update __APP__.incidents
     set status = 'closed', closed_at = now(), close_note = btrim(p_note), closed_exception = true
   where id = p_id;
  perform __APP__.set_log_context('', '');
  select array_agg(n) into v_notif from __APP__.notify(array[r.created_by, r.lead_investigator_id, r.classified_by],
    'incident.closed', 'Kejadian ' || r.code || ' ditutup dengan pengecualian', left(btrim(p_note), 200),
    '/kejadian/' || p_id, 'kejadian', 'incidents', p_id::text) n;
  return jsonb_build_object('id', p_id, 'notification_ids', coalesce(v_notif, '{}'));
end $$;

-- =====================================================================================
-- RPC TEMUAN
-- =====================================================================================

-- Status temuan (cache turunan §3.3 spesifikasi). Tidak menulis log (tidak memakai log context).
create or replace function __APP__.k3_finding_refresh(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_status text;
begin
  select case
           when f.closed_at is not null then 'closed'
           when not exists (select 1 from __APP__.pica_actions a where a.finding_id = f.id and a.status <> 'open')
             then 'open'
           when not exists (select 1 from __APP__.pica_actions a where a.finding_id = f.id
                             and a.status not in ('closed', 'waiting_verification'))
                and exists (select 1 from __APP__.pica_actions a where a.finding_id = f.id
                             and a.status = 'waiting_verification')
             then 'waiting_verification'
           else 'in_progress'
         end
    into v_status
    from __APP__.findings f where f.id = p_id;
  -- tanpa log: status cache bukan aksi user (aksi sudah tercatat di log tindakan); trigger log
  -- findings dilewati saat app.log_skip = 'on'
  perform set_config('app.log_skip', 'on', true);
  update __APP__.findings set status = v_status where id = p_id and status is distinct from v_status;
  perform set_config('app.log_skip', '', true);
end $$;
revoke execute on function __APP__.k3_finding_refresh(uuid) from public, anon, authenticated;

-- Simpan temuan (baru: p_id null). Pembuat: hse/pengawas/pjo. Ubah: pembuat atau HSE, belum ditutup.
-- p: {company_code?, location_id, area_id, location_detail?, found_at, title, description, source_kind,
--     source_ref?, source_id?, category, risk_level, likelihood?, consequence?, root_causes:[{factor,text}],
--     pic_id, due_date}
create or replace function __APP__.finding_save(p_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r          __APP__.findings;
  v_uid      uuid := auth.uid();
  v_company  text;
  v_location uuid := nullif(p ->> 'location_id', '')::uuid;
  v_area     uuid := nullif(p ->> 'area_id', '')::uuid;
  v_found    timestamptz := nullif(p ->> 'found_at', '')::timestamptz;
  v_src      uuid := nullif(p ->> 'source_id', '')::uuid;
  v_pic      uuid := nullif(p ->> 'pic_id', '')::uuid;
  v_due      date := nullif(p ->> 'due_date', '')::date;
  v_roots    jsonb;
  v_id       uuid;
  v_code     text;
  v_notif    uuid[];
begin
  if not __APP__.k3_writer() then
    raise exception 'Anda tidak punya akses untuk menulis temuan.' using errcode = '42501';
  end if;
  if p_id is null then
    if not __APP__.has_any_function(array['hse', 'pengawas', 'pjo']) then
      raise exception 'Hanya HSE, Pengawas, atau PJO yang bisa membuat temuan.' using errcode = '42501';
    end if;
    select coalesce(nullif(p ->> 'company_code', ''), pr.company) into v_company
      from public.profiles pr where pr.id = v_uid;
  else
    select * into r from __APP__.findings where id = p_id for update;
    if r.id is null or not __APP__.k3_finding_visible(p_id) then
      raise exception 'Temuan tidak ditemukan.' using errcode = 'P0001';
    end if;
    if not (r.created_by = v_uid or __APP__.has_function('hse')) then
      raise exception 'Hanya pembuat temuan atau HSE yang bisa mengubah temuan.' using errcode = '42501';
    end if;
    if r.status = 'closed' then
      raise exception 'Temuan sudah ditutup.' using errcode = 'P0001';
    end if;
    v_company := r.company_code;      -- company tidak berubah setelah dibuat (nomor per company)
  end if;

  if v_company is null or not exists (select 1 from public.companies where code = v_company and not is_group) then
    raise exception 'Pilih perusahaan.' using errcode = 'P0001';
  end if;
  if v_location is null or not __APP__.k3_in_scope(v_company, v_location) then
    raise exception 'Site tidak valid atau di luar akses Anda.' using errcode = 'P0001';
  end if;
  if v_area is null or not exists (select 1 from __APP__.areas where id = v_area and location_id = v_location
                                     and (is_active or v_area = r.area_id)) then
    raise exception 'Lokasi temuan wajib dipilih dari area site ini.' using errcode = 'P0001';
  end if;
  if v_found is null or v_found > now() + interval '5 minutes' then
    raise exception 'Waktu ditemukan wajib diisi dan tidak boleh di masa depan.' using errcode = 'P0001';
  end if;
  if length(btrim(coalesce(p ->> 'title', ''))) < 3 or length(btrim(coalesce(p ->> 'description', ''))) = 0 then
    raise exception 'Judul dan uraian temuan wajib diisi.' using errcode = 'P0001';
  end if;
  if coalesce(p ->> 'source_kind', '') not in ('inspection', 'observation', 'audit', 'incident', 'meeting', 'other') then
    raise exception 'Sumber temuan wajib dipilih.' using errcode = 'P0001';
  end if;
  if (p ->> 'source_kind' = 'incident') and (v_src is null or not __APP__.k3_incident_visible(v_src)) then
    raise exception 'Pilih kejadian sumber temuan.' using errcode = 'P0001';
  end if;
  if p ->> 'source_kind' <> 'incident' then v_src := null; end if;
  if not __APP__.k3_master_ok('finding_category', p ->> 'category')
     and not (p_id is not null and p ->> 'category' = r.category) then
    raise exception 'Kategori temuan wajib dipilih.' using errcode = 'P0001';
  end if;
  if not __APP__.k3_master_ok('risk_level', p ->> 'risk_level')
     and not (p_id is not null and p ->> 'risk_level' = r.risk_level) then
    raise exception 'Prioritas wajib dipilih.' using errcode = 'P0001';
  end if;
  if v_pic is null or not __APP__.k3_user_ok(v_pic) then
    raise exception 'PIC temuan wajib dipilih.' using errcode = 'P0001';
  end if;
  if v_due is null then
    raise exception 'Due date wajib diisi.' using errcode = 'P0001';
  end if;
  if p_id is null and v_due < __APP__.today_wib() then
    raise exception 'Due date tidak boleh sebelum hari ini.' using errcode = 'P0001';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('factor', e ->> 'factor', 'text', left(btrim(e ->> 'text'), 1000))
                            order by ord), '[]')
    into v_roots
    from jsonb_array_elements(case when jsonb_typeof(p -> 'root_causes') = 'array' then p -> 'root_causes' else '[]' end)
         with ordinality x(e, ord)
   where e ->> 'factor' in ('man', 'method', 'machine', 'material', 'environment', 'management')
     and length(btrim(coalesce(e ->> 'text', ''))) > 0;

  if p_id is null then
    v_code := __APP__.next_doc_number('TMN', v_company, 'year');
    insert into __APP__.findings (code, company_code, location_id, area_id, location_detail, found_at, title,
      description, source_kind, source_ref, source_id, category, risk_level, likelihood, consequence, root_causes,
      pic_id, due_date, created_by)
    values (v_code, v_company, v_location, v_area, nullif(btrim(p ->> 'location_detail'), ''), v_found,
      btrim(p ->> 'title'), btrim(p ->> 'description'), p ->> 'source_kind', nullif(btrim(p ->> 'source_ref'), ''),
      v_src, p ->> 'category', p ->> 'risk_level', nullif(p ->> 'likelihood', '')::smallint,
      nullif(p ->> 'consequence', '')::smallint, v_roots, v_pic, v_due, v_uid)
    returning id into v_id;
    select array_agg(n) into v_notif from __APP__.notify(array[v_pic], 'finding.assigned',
      'Temuan ' || v_code || ' ditugaskan kepada Anda', btrim(p ->> 'title'), '/temuan/' || v_id,
      'pica', 'findings', v_id::text) n;
  else
    v_id := p_id;
    if r.due_date is distinct from v_due and length(btrim(coalesce(p ->> 'change_reason', ''))) = 0 then
      raise exception 'Alasan perubahan due date wajib diisi.' using errcode = 'P0001';
    end if;
    perform __APP__.set_log_context('update', nullif(btrim(p ->> 'change_reason'), ''));
    update __APP__.findings
       set location_id = v_location, area_id = v_area, location_detail = nullif(btrim(p ->> 'location_detail'), ''),
           found_at = v_found, title = btrim(p ->> 'title'), description = btrim(p ->> 'description'),
           source_kind = p ->> 'source_kind', source_ref = nullif(btrim(p ->> 'source_ref'), ''), source_id = v_src,
           category = p ->> 'category', risk_level = p ->> 'risk_level',
           likelihood = nullif(p ->> 'likelihood', '')::smallint, consequence = nullif(p ->> 'consequence', '')::smallint,
           root_causes = v_roots, pic_id = v_pic, due_date = v_due
     where id = p_id;
    perform __APP__.set_log_context('', '');
    if v_pic is distinct from r.pic_id then
      select array_agg(n) into v_notif from __APP__.notify(array[v_pic], 'finding.assigned',
        'Temuan ' || r.code || ' ditugaskan kepada Anda', btrim(p ->> 'title'), '/temuan/' || p_id,
        'pica', 'findings', p_id::text) n;
    end if;
  end if;
  return jsonb_build_object('id', v_id, 'code', coalesce(v_code, r.code), 'notification_ids', coalesce(v_notif, '{}'));
end $$;

-- Tutup temuan (HSE): semua tindakan Closed (minimal satu), alasan wajib
create or replace function __APP__.finding_close(p_id uuid, p_note text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r       __APP__.findings;
  v_notif uuid[];
begin
  select * into r from __APP__.findings where id = p_id for update;
  if r.id is null or not __APP__.k3_finding_visible(p_id) then
    raise exception 'Temuan tidak ditemukan.' using errcode = 'P0001';
  end if;
  if not (__APP__.k3_writer() and __APP__.has_function('hse')) then
    raise exception 'Hanya HSE yang bisa menutup temuan.' using errcode = '42501';
  end if;
  if r.status = 'closed' then
    raise exception 'Temuan sudah ditutup.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from __APP__.pica_actions where finding_id = p_id) then
    raise exception 'Tambahkan minimal satu tindakan sebelum menutup temuan.' using errcode = 'P0001';
  end if;
  if exists (select 1 from __APP__.pica_actions where finding_id = p_id and status <> 'closed') then
    raise exception 'Masih ada tindakan yang belum Closed.' using errcode = 'P0001';
  end if;
  if length(btrim(coalesce(p_note, ''))) = 0 then
    raise exception 'Alasan penutupan wajib diisi.' using errcode = 'P0001';
  end if;
  perform __APP__.set_log_context('close', btrim(p_note));
  update __APP__.findings set status = 'closed', closed_at = now(), closed_by = auth.uid(), close_note = btrim(p_note)
   where id = p_id;
  perform __APP__.set_log_context('', '');
  select array_agg(n) into v_notif from __APP__.notify(array[r.pic_id, r.created_by], 'finding.closed',
    'Temuan ' || r.code || ' ditutup', null, '/temuan/' || p_id, 'pica', 'findings', p_id::text) n;
  return jsonb_build_object('id', p_id, 'notification_ids', coalesce(v_notif, '{}'));
end $$;

-- =====================================================================================
-- RPC TINDAKAN PICA
-- =====================================================================================
create or replace function __APP__.k3_action_href(a __APP__.pica_actions)
returns text language sql stable set search_path = '' as $$
  select case when a.finding_id is not null then '/temuan/' || a.finding_id || '?tindakan=' || a.code
              else '/kejadian/' || a.incident_id || '?tab=tindakan&tindakan=' || a.code end;
$$;

-- Tambah tindakan. p: {finding_id | incident_id, title, kind, pic_id, verifier_id, due_date,
--   required_evidence?, cause_ref?}
create or replace function __APP__.pica_create(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid     uuid := auth.uid();
  v_find    __APP__.findings;
  v_inc     __APP__.incidents;
  v_pic     uuid := nullif(p ->> 'pic_id', '')::uuid;
  v_ver     uuid := nullif(p ->> 'verifier_id', '')::uuid;
  v_due     date := nullif(p ->> 'due_date', '')::date;
  v_company text;
  v_loc     uuid;
  v_id      uuid;
  v_code    text;
  v_notif   uuid[];
  a         __APP__.pica_actions;
begin
  if not __APP__.k3_writer() then
    raise exception 'Anda tidak punya akses untuk menambah tindakan.' using errcode = '42501';
  end if;
  if nullif(p ->> 'finding_id', '') is not null then
    select * into v_find from __APP__.findings where id = (p ->> 'finding_id')::uuid for update;
    if v_find.id is null or not __APP__.k3_finding_visible(v_find.id) then
      raise exception 'Temuan tidak ditemukan.' using errcode = 'P0001';
    end if;
    if not (v_find.created_by = v_uid or __APP__.has_any_function(array['hse', 'pjo'])) then
      raise exception 'Hanya pembuat temuan, HSE, atau PJO yang bisa menambah tindakan.' using errcode = '42501';
    end if;
    if v_find.status = 'closed' then
      raise exception 'Temuan sudah ditutup.' using errcode = 'P0001';
    end if;
    v_company := v_find.company_code; v_loc := v_find.location_id;
  elsif nullif(p ->> 'incident_id', '') is not null then
    select * into v_inc from __APP__.incidents where id = (p ->> 'incident_id')::uuid for update;
    if v_inc.id is null or not __APP__.k3_incident_visible(v_inc.id) then
      raise exception 'Kejadian tidak ditemukan.' using errcode = 'P0001';
    end if;
    if not __APP__.has_function('hse') then
      raise exception 'Hanya HSE yang bisa menambah tindakan kejadian.' using errcode = '42501';
    end if;
    if v_inc.status in ('reported', 'closed') then
      raise exception 'Tindakan bisa ditambahkan setelah klasifikasi dan sebelum kejadian ditutup.' using errcode = 'P0001';
    end if;
    v_company := v_inc.company_code; v_loc := v_inc.location_id;
  else
    raise exception 'Tindakan harus milik temuan atau kejadian.' using errcode = 'P0001';
  end if;

  if length(btrim(coalesce(p ->> 'title', ''))) < 3 then
    raise exception 'Deskripsi tindakan wajib diisi.' using errcode = 'P0001';
  end if;
  if coalesce(p ->> 'kind', '') not in ('corrective', 'preventive') then
    raise exception 'Jenis tindakan wajib dipilih.' using errcode = 'P0001';
  end if;
  if v_pic is null or not __APP__.k3_user_ok(v_pic) then
    raise exception 'PIC wajib dipilih.' using errcode = 'P0001';
  end if;
  if v_ver is null or not __APP__.k3_user_ok(v_ver) then
    raise exception 'Verifikator wajib dipilih.' using errcode = 'P0001';
  end if;
  if v_ver = v_pic then
    raise exception 'Verifikator tidak boleh sama dengan PIC.' using errcode = 'P0001';
  end if;
  if v_due is null or v_due < __APP__.today_wib() then
    raise exception 'Due date wajib diisi dan tidak boleh sebelum hari ini.' using errcode = 'P0001';
  end if;

  v_code := __APP__.next_doc_number('PCA', v_company, 'year');
  insert into __APP__.pica_actions (code, company_code, location_id, finding_id, incident_id, title, kind, pic_id,
    verifier_id, due_date, required_evidence, cause_ref, created_by)
  values (v_code, v_company, v_loc, v_find.id, v_inc.id, btrim(p ->> 'title'), p ->> 'kind', v_pic, v_ver, v_due,
    nullif(btrim(p ->> 'required_evidence'), ''), nullif(btrim(p ->> 'cause_ref'), ''), v_uid)
  returning * into a;
  v_id := a.id;

  if v_find.id is not null then
    perform __APP__.k3_finding_refresh(v_find.id);
  end if;
  -- kejadian yang sudah lewat review & tinggal tindakan: tetap 'actions' (tindakan baru harus selesai dulu)

  select array_agg(n) into v_notif from __APP__.notify(array[v_pic], 'pica.assigned',
    'Tindakan ' || v_code || ' ditugaskan kepada Anda', btrim(p ->> 'title'), __APP__.k3_action_href(a),
    'pica', 'pica_actions', v_id::text) n;
  return jsonb_build_object('id', v_id, 'code', v_code, 'notification_ids', coalesce(v_notif, '{}'));
end $$;

-- PIC mulai mengerjakan (open → in_progress)
create or replace function __APP__.pica_start(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a __APP__.pica_actions;
begin
  select * into a from __APP__.pica_actions where id = p_id for update;
  if a.id is null or not __APP__.k3_action_visible(p_id) then
    raise exception 'Tindakan tidak ditemukan.' using errcode = 'P0001';
  end if;
  if not __APP__.k3_writer() or a.pic_id <> auth.uid() then
    raise exception 'Hanya PIC yang bisa memulai tindakan.' using errcode = '42501';
  end if;
  if a.status <> 'open' then
    raise exception 'Tindakan sudah berjalan.' using errcode = 'P0001';
  end if;
  perform __APP__.set_log_context('start', null);
  update __APP__.pica_actions set status = 'in_progress' where id = p_id;
  perform __APP__.set_log_context('', '');
  if a.finding_id is not null then perform __APP__.k3_finding_refresh(a.finding_id); end if;
  return jsonb_build_object('id', p_id);
end $$;

-- PIC mengirim bukti (min. 1 file di pica/<id>/r<round>/) → Menunggu Verifikasi
create or replace function __APP__.pica_submit_evidence(p_id uuid, p_note text, p_files text[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a       __APP__.pica_actions;
  v_pfx   text;
  v_notif uuid[];
begin
  select * into a from __APP__.pica_actions where id = p_id for update;
  if a.id is null or not __APP__.k3_action_visible(p_id) then
    raise exception 'Tindakan tidak ditemukan.' using errcode = 'P0001';
  end if;
  if not __APP__.k3_writer() or a.pic_id <> auth.uid() then
    raise exception 'Hanya PIC yang bisa mengirim bukti.' using errcode = '42501';
  end if;
  if a.status not in ('open', 'in_progress') then
    raise exception 'Bukti sudah dikirim atau tindakan sudah ditutup.' using errcode = 'P0001';
  end if;
  v_pfx := 'pica/' || p_id || '/r' || a.round || '/';
  if cardinality(coalesce(p_files, '{}')) = 0 then
    raise exception 'Unggah minimal satu file bukti.' using errcode = 'P0001';
  end if;
  if exists (select 1 from unnest(p_files) f where left(f, length(v_pfx)) <> v_pfx)
     or exists (select 1 from unnest(p_files) f
                 where not exists (select 1 from storage.objects o
                                    where o.bucket_id = '__HOST__-lampiran' and o.name = f)) then
    raise exception 'File bukti tidak ditemukan. Unggah ulang.' using errcode = 'P0001';
  end if;

  insert into __APP__.pica_evidence (action_id, round, note, files, submitted_by)
  values (p_id, a.round, nullif(btrim(p_note), ''), p_files, auth.uid())
  on conflict (action_id, round) do update
    set note = excluded.note, files = excluded.files, submitted_by = excluded.submitted_by, submitted_at = now(),
        decision = null, decision_note = null, decided_by = null, decided_at = null;
  perform __APP__.set_log_context('submit_evidence', nullif(btrim(p_note), ''));
  perform __APP__.set_log_extra(jsonb_build_object('bukti', format('%s file (putaran %s)', cardinality(p_files), a.round)));
  update __APP__.pica_actions set status = 'waiting_verification' where id = p_id;
  perform __APP__.set_log_extra(null);
  perform __APP__.set_log_context('', '');
  if a.finding_id is not null then perform __APP__.k3_finding_refresh(a.finding_id); end if;

  select array_agg(n) into v_notif from __APP__.notify(array[a.verifier_id], 'pica.evidence',
    'Verifikasi bukti ' || a.code, a.title, __APP__.k3_action_href(a), 'pica', 'pica_actions', p_id::text) n;
  return jsonb_build_object('id', p_id, 'notification_ids', coalesce(v_notif, '{}'));
end $$;

-- Verifikator: accept → Closed; return → In Progress (Dikembalikan, putaran + 1). Komentar wajib.
create or replace function __APP__.pica_verify(p_id uuid, p_decision text, p_note text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a       __APP__.pica_actions;
  v_notif uuid[];
  v_more  uuid[];
begin
  select * into a from __APP__.pica_actions where id = p_id for update;
  if a.id is null or not __APP__.k3_action_visible(p_id) then
    raise exception 'Tindakan tidak ditemukan.' using errcode = 'P0001';
  end if;
  if not __APP__.k3_writer() or a.verifier_id <> auth.uid() then
    raise exception 'Hanya verifikator tindakan ini yang bisa memverifikasi.' using errcode = '42501';
  end if;
  if a.status <> 'waiting_verification' then
    raise exception 'Tindakan tidak sedang menunggu verifikasi.' using errcode = 'P0001';
  end if;
  if p_decision not in ('accept', 'return') then
    raise exception 'Keputusan tidak dikenal.' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_note, ''))) = 0 then
    raise exception 'Komentar verifikator wajib diisi.' using errcode = 'P0001';
  end if;

  update __APP__.pica_evidence
     set decision = case p_decision when 'accept' then 'accepted' else 'returned' end,
         decision_note = btrim(p_note), decided_by = auth.uid(), decided_at = now()
   where action_id = p_id and round = a.round;
  perform __APP__.set_log_context(p_decision, btrim(p_note));
  if p_decision = 'accept' then
    update __APP__.pica_actions set status = 'closed', closed_at = now(), returned = false where id = p_id;
  else
    update __APP__.pica_actions set status = 'in_progress', round = round + 1, returned = true where id = p_id;
  end if;
  perform __APP__.set_log_context('', '');

  select array_agg(n) into v_notif from __APP__.notify(array[a.pic_id],
    case p_decision when 'accept' then 'pica.accepted' else 'pica.returned' end,
    case p_decision when 'accept' then 'Bukti ' || a.code || ' diterima' else 'Tindakan ' || a.code || ' dikembalikan' end,
    left(btrim(p_note), 200), __APP__.k3_action_href(a), 'pica', 'pica_actions', p_id::text) n;

  if a.finding_id is not null then perform __APP__.k3_finding_refresh(a.finding_id); end if;
  if a.incident_id is not null and p_decision = 'accept' then
    v_more := __APP__.k3_incident_try_close(a.incident_id);
    v_notif := coalesce(v_notif, '{}') || coalesce(v_more, '{}');
  end if;
  return jsonb_build_object('id', p_id, 'notification_ids', coalesce(v_notif, '{}'));
end $$;

-- Ubah due date (alasan wajib): pembuat temuan/HSE/PJO (tindakan temuan) atau HSE (tindakan kejadian)
create or replace function __APP__.pica_change_due(p_id uuid, p_due date, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  a       __APP__.pica_actions;
  v_owner uuid;
  v_notif uuid[];
begin
  select * into a from __APP__.pica_actions where id = p_id for update;
  if a.id is null or not __APP__.k3_action_visible(p_id) then
    raise exception 'Tindakan tidak ditemukan.' using errcode = 'P0001';
  end if;
  select created_by into v_owner from __APP__.findings where id = a.finding_id;
  if not __APP__.k3_writer()
     or not (__APP__.has_function('hse')
             or (a.finding_id is not null and (v_owner = auth.uid() or __APP__.has_function('pjo')))) then
    raise exception 'Anda tidak bisa mengubah due date tindakan ini.' using errcode = '42501';
  end if;
  if a.status = 'closed' then
    raise exception 'Tindakan sudah Closed.' using errcode = 'P0001';
  end if;
  if p_due is null or p_due < __APP__.today_wib() then
    raise exception 'Due date baru tidak boleh sebelum hari ini.' using errcode = 'P0001';
  end if;
  if p_due = a.due_date then
    raise exception 'Due date tidak berubah.' using errcode = 'P0001';
  end if;
  if length(btrim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Alasan perubahan wajib diisi.' using errcode = 'P0001';
  end if;
  perform __APP__.set_log_context('change_due', btrim(p_reason));
  update __APP__.pica_actions set due_date = p_due where id = p_id;
  perform __APP__.set_log_context('', '');
  select array_agg(n) into v_notif from __APP__.notify(array[a.pic_id], 'pica.due_changed',
    'Due date ' || a.code || ' diubah', to_char(a.due_date, 'DD-MM-YYYY') || ' → ' || to_char(p_due, 'DD-MM-YYYY')
    || ' · ' || left(btrim(p_reason), 150), __APP__.k3_action_href(a), 'pica', 'pica_actions', p_id::text) n;
  return jsonb_build_object('id', p_id, 'notification_ids', coalesce(v_notif, '{}'));
end $$;

-- Verifikasi efektivitas (opsional, setelah Closed): verifikator atau HSE
create or replace function __APP__.pica_set_effectiveness(p_id uuid, p_date date, p_note text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a __APP__.pica_actions;
begin
  select * into a from __APP__.pica_actions where id = p_id for update;
  if a.id is null or not __APP__.k3_action_visible(p_id) then
    raise exception 'Tindakan tidak ditemukan.' using errcode = 'P0001';
  end if;
  if not __APP__.k3_writer() or not (a.verifier_id = auth.uid() or __APP__.has_function('hse')) then
    raise exception 'Hanya verifikator atau HSE yang bisa mencatat efektivitas.' using errcode = '42501';
  end if;
  if a.status <> 'closed' then
    raise exception 'Efektivitas dicatat setelah tindakan Closed.' using errcode = 'P0001';
  end if;
  if p_date is null then
    raise exception 'Tanggal verifikasi efektivitas wajib diisi.' using errcode = 'P0001';
  end if;
  perform __APP__.set_log_context('effectiveness', nullif(btrim(p_note), ''));
  update __APP__.pica_actions set effectiveness_date = p_date, effectiveness_note = nullif(btrim(p_note), '')
   where id = p_id;
  perform __APP__.set_log_context('', '');
  return jsonb_build_object('id', p_id);
end $$;

revoke execute on function __APP__.incident_report(jsonb), __APP__.incident_classify(uuid, jsonb),
  __APP__.incident_set_team(uuid, uuid, uuid[]), __APP__.incident_save_investigation(uuid, jsonb),
  __APP__.incident_submit_review(uuid, text), __APP__.incident_close_check(uuid),
  __APP__.incident_review(uuid, text, text), __APP__.incident_close_exception(uuid, text),
  __APP__.finding_save(uuid, jsonb), __APP__.finding_close(uuid, text),
  __APP__.pica_create(jsonb), __APP__.pica_start(uuid), __APP__.pica_submit_evidence(uuid, text, text[]),
  __APP__.pica_verify(uuid, text, text), __APP__.pica_change_due(uuid, date, text),
  __APP__.pica_set_effectiveness(uuid, date, text),
  __APP__.k3_incident_visible(uuid), __APP__.k3_finding_visible(uuid), __APP__.k3_action_visible(uuid),
  __APP__.k3_master_ok(text, text), __APP__.k3_user_ok(uuid), __APP__.k3_in_scope(text, uuid),
  __APP__.k3_my_team_incidents(), __APP__.k3_my_action_findings()
  from public, anon;

-- Pilihan orang di form K3 (PIC, verifikator, atasan, tim). app_access hanya terbaca admin, jadi
-- daftar user app disajikan lewat helper ini: user aktif ber-akses app dalam scope company pemanggil.
-- Hanya nama/jabatan/departemen/fungsi (tanpa email, NRP, HP).
create or replace function __APP__.k3_user_options(p_function text default null)
returns table (id uuid, name text, job_title text, department text, company text, functions text[])
language sql stable security definer set search_path = '' as $$
  select p.id, p.full_name, jt.name, d.name, p.company, coalesce(m.functions, '{}')
    from public.app_access a
    join public.profiles p on p.id = a.user_id and p.is_active
    left join __APP__.members m on m.user_id = p.id
    left join public.job_titles jt on jt.id = p.job_title_id
    left join public.departments d on d.id = p.department_id
   where a.app_id = '__APP__'
     and public.has_app_role('__APP__', 'viewer')
     and ('*' = any (__APP__.my_company_scope()) or p.company is null or p.company = any (__APP__.my_company_scope()))
     and (p_function is null or p_function = any (coalesce(m.functions, '{}')))
   order by p.full_name
   limit 1000;
$$;
revoke execute on function __APP__.k3_user_options(text) from public, anon;

-- =====================================================================================
-- RINGKASAN & BADGE
-- =====================================================================================
-- Hitungan menu (layout, sekali per request; ikut RLS):
--   incidents_to_classify (HSE saja), findings_overdue, actions_mine (PIC/verifikator menunggu)
create or replace function __APP__.k3_badges()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'incidents_to_classify', case when (select __APP__.has_function('hse'))
                                  then (select count(*) from __APP__.incidents where status = 'reported') else 0 end,
    'findings_overdue', (select count(*) from __APP__.findings
                          where status <> 'closed' and due_date < (select __APP__.today_wib())));
$$;
revoke execute on function __APP__.k3_badges() from public, anon;

-- Ringkasan /temuan (strip angka + widget), filter company + site sama dengan list (ikut RLS)
create or replace function __APP__.finding_stats(p_company text default null, p_location uuid default null)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with f as (
    select x.* from __APP__.findings x
     where (p_company is null or x.company_code = p_company)
       and (p_location is null or x.location_id = p_location)
  ), t as (select __APP__.today_wib() as d)
  select jsonb_build_object(
    'open',                 (select count(*) from f where status = 'open'),
    'in_progress',          (select count(*) from f where status = 'in_progress'),
    'waiting_verification', (select count(*) from f where status = 'waiting_verification'),
    'overdue',              (select count(*) from f, t where status <> 'closed' and due_date < t.d),
    'closed_this_month',    (select count(*) from f, t where status = 'closed'
                               and (closed_at at time zone 'Asia/Jakarta')::date >= date_trunc('month', t.d)::date),
    'avg_age_days',         (select round(avg(t.d - (found_at at time zone 'Asia/Jakarta')::date))
                               from f, t where status <> 'closed'),
    'by_source',            coalesce((select jsonb_object_agg(source_kind, n) from
                               (select source_kind, count(*) n from f group by 1) s), '{}'),
    'overdue_by_pic',       coalesce((select jsonb_agg(jsonb_build_object('pic_id', pic_id, 'name', name, 'n', n) order by n desc, name)
                               from (select f.pic_id, p.full_name as name, count(*) n
                                       from f join public.profiles p on p.id = f.pic_id, t
                                      where f.status <> 'closed' and f.due_date < t.d
                                      group by 1, 2 order by 3 desc, 2 limit 5) s), '[]'),
    'trend',                coalesce((select jsonb_agg(jsonb_build_object('month', to_char(m, 'YYYY-MM'),
                                 'opened', (select count(*) from f where date_trunc('month', found_at at time zone 'Asia/Jakarta') = m),
                                 'closed', (select count(*) from f where date_trunc('month', closed_at at time zone 'Asia/Jakarta') = m))
                                 order by m)
                               from generate_series(date_trunc('month', (select d from t)) - interval '5 months',
                                                    date_trunc('month', (select d from t)), interval '1 month') m), '[]'));
$$;
revoke execute on function __APP__.finding_stats(text, uuid) from public, anon;

-- =====================================================================================
-- TUGAS SAYA (redefinisi 10_fondasi + cabang K3) & PENCARIAN GLOBAL
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
    -- kejadian perlu klasifikasi (HSE)
    select 'incident_classify', 'action', 'incidents', i.id, i.code, left(i.description, 200), i.status,
           null::timestamptz, i.reported_at, '/kejadian/' || i.id || '?tab=klasifikasi',
           jsonb_build_object('emergency', i.is_emergency)
      from __APP__.incidents i
     where i.status = 'reported' and (select __APP__.has_function('hse'))
    union all
    -- investigasi: ketua tim, atau HSE bila belum ada ketua
    select 'incident_investigate', 'action', 'incidents', i.id, i.code, left(i.description, 200), i.status,
           null, coalesce(i.returned_at, i.classified_at, i.reported_at),
           '/kejadian/' || i.id || '?tab=investigasi', jsonb_build_object('returned', i.return_note is not null)
      from __APP__.incidents i
     where i.status in ('classified', 'investigating')
       and (i.lead_investigator_id = (select auth.uid())
            or (i.lead_investigator_id is null and (select __APP__.has_function('hse'))))
    union all
    -- review EHS / manajemen (bukan laporan sendiri)
    select 'incident_review', 'approval', 'incidents', i.id, i.code, left(i.description, 200), i.status,
           null, i.updated_at, '/kejadian/' || i.id || '?tab=review', '{}'::jsonb
      from __APP__.incidents i
     where i.created_by is distinct from (select auth.uid())
       and ((i.status = 'review_ehs' and (select __APP__.has_function('hse_senior')))
            or (i.status = 'review_mgmt' and (select __APP__.has_any_function(array['pjo', 'manajemen']))))
    union all
    -- tindakan saya (PIC)
    select 'pica_do', 'action', 'pica_actions', a.id, a.code, a.title, a.status,
           (a.due_date::timestamp at time zone 'Asia/Jakarta') + interval '1 day' - interval '1 second',
           a.created_at, __APP__.k3_action_href(a), jsonb_build_object('returned', a.returned)
      from __APP__.pica_actions a
     where a.pic_id = (select auth.uid()) and a.status in ('open', 'in_progress')
    union all
    -- bukti menunggu verifikasi saya
    select 'pica_verify', 'verification', 'pica_actions', a.id, a.code, a.title, a.status,
           null, a.updated_at, __APP__.k3_action_href(a), '{}'::jsonb
      from __APP__.pica_actions a
     where a.verifier_id = (select auth.uid()) and a.status = 'waiting_verification'
  ) t (kind, task_group, ref_type, ref_id, code, title, status, due_at, waiting_since, href, meta)
  order by t.due_at asc nulls last, t.waiting_since asc
  limit least(greatest(p_limit, 1), 500);
$$;
revoke execute on function __APP__.my_tasks(integer) from public, anon;

-- Pencarian global modul K3. example_pengajuan.sql (bila dipasang) mendefinisikan ulang dengan
-- tambahan Pengajuan; saat contoh dihapus, versi ini yang berlaku.
create or replace function __APP__.global_search_k3_core(p_q text, p_limit integer default 5)
returns table (kind text, id text, title text, subtitle text, status text, amount numeric,
               href text, is_exact boolean)
language sql stable security invoker set search_path = '' as $$
  with q as (select lower(btrim(p_q)) as t)
  (select 'kejadian'::text, i.id::text, i.code, left(i.description, 120), i.status, null::numeric,
          '/kejadian/' || i.id, lower(i.code) = q.t
     from __APP__.incidents i, q
    where length(q.t) >= 3 and i.search_text like '%' || q.t || '%'
    order by (lower(i.code) = q.t) desc, i.reported_at desc
    limit least(greatest(p_limit, 1), 10))
  union all
  (select 'temuan', f.id::text, f.code, f.title, f.status, null, '/temuan/' || f.id, lower(f.code) = q.t
     from __APP__.findings f, q
    where length(q.t) >= 3 and f.search_text like '%' || q.t || '%'
    order by (lower(f.code) = q.t) desc, f.found_at desc
    limit least(greatest(p_limit, 1), 10))
  union all
  (select 'tindakan', a.id::text, a.code, a.title, a.status, null, __APP__.k3_action_href(a), lower(a.code) = q.t
     from __APP__.pica_actions a, q
    where length(q.t) >= 3 and a.search_text like '%' || q.t || '%'
    order by (lower(a.code) = q.t) desc, a.created_at desc
    limit least(greatest(p_limit, 1), 10))
$$;
revoke execute on function __APP__.global_search_k3_core(text, integer) from public, anon;

-- Dasar pencarian K3; 12_inspeksi_kpi.sql mendefinisikan ulang global_search_k3 dengan inspeksi + observasi.
create or replace function __APP__.global_search_k3(p_q text, p_limit integer default 5)
returns table (kind text, id text, title text, subtitle text, status text, amount numeric,
               href text, is_exact boolean)
language sql stable security invoker set search_path = '' as $$
  select * from __APP__.global_search_k3_core(p_q, p_limit);
$$;
revoke execute on function __APP__.global_search_k3(text, integer) from public, anon;

-- Pembungkus: example_pengajuan.sql (bila dipasang) mendefinisikan ulang dengan tambahan Pengajuan.
create or replace function __APP__.global_search(p_q text, p_limit integer default 5)
returns table (kind text, id text, title text, subtitle text, status text, amount numeric,
               href text, is_exact boolean)
language sql stable security invoker set search_path = '' as $$
  select * from __APP__.global_search_k3(p_q, p_limit);
$$;
revoke execute on function __APP__.global_search(text, integer) from public, anon;
