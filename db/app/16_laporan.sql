-- =====================================================================================
-- 16 LAPORAN PERIODE (Safe Hub, fase 3) · rancangan §2.9, §4.10 · jenis A (approval engine)
--
-- Laporan = site + template + bulan. Angka draf dihitung live (report_build_data); saat disetujui engine menyimpan
-- SNAPSHOT berversi (report_versions) dan status 'published'. Koreksi = versi minor baru lewat approval yang sama.
-- Tulis HANYA lewat RPC / hook engine. Bagian yang modulnya belum ada ditandai 'unavailable' (bukan angka palsu).
-- =====================================================================================

create table __APP__.report_templates (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique check (length(btrim(code)) between 3 and 40),          -- kode form
  name       text not null check (length(btrim(name)) between 3 and 120),
  revision   text not null default '' check (length(revision) <= 20),
  prefix     text not null check (prefix in ('LAP', 'LAP-PJO')),                          -- awalan nomor laporan
  sections   jsonb not null check (jsonb_typeof(sections) = 'array'),
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table __APP__.report_templates is 'Template Laporan Periode. sections: [{key,title,source}] source = kpi|incidents|findings|inspections|tsp|narrative|unavailable.';

create table __APP__.reports (
  id                uuid primary key default gen_random_uuid(),
  code              text not null,
  company_code      text not null references public.companies(code),
  location_id       uuid not null references public.locations(id),
  template_id       uuid not null references __APP__.report_templates(id),
  period            date not null check (period = date_trunc('month', period)::date),
  status            text not null default 'draft' check (status in ('draft', 'pending_approval', 'rejected', 'published')),
  narratives        jsonb not null default '{}' check (jsonb_typeof(narratives) = 'object'),
  submit_note       text check (length(submit_note) <= 1000),          -- alasan mengajukan dengan kekurangan
  current_version   text,                                              -- versi terbit terakhir, mis. 1.0
  correction_reason text check (length(correction_reason) <= 1000),
  search_text       text,
  created_by        uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (company_code, location_id, template_id, period)
);
create index reports_list_idx on __APP__.reports (company_code, location_id, period desc);
create index reports_status_idx on __APP__.reports (status, period desc);

create table __APP__.report_versions (
  id           uuid primary key default gen_random_uuid(),
  report_id    uuid not null references __APP__.reports(id) on delete cascade,
  version      text not null check (version ~ '^[0-9]+\.[0-9]+$'),
  snapshot     jsonb not null,
  reason       text check (length(reason) <= 1000),
  published_at timestamptz not null default now(),
  unique (report_id, version)
);

create table __APP__.reports_logs (
  id         bigint generated always as identity primary key,
  record_id  uuid not null,
  at         timestamptz not null default now(),
  actor_id   uuid references public.profiles(id) on delete set null,
  action     text not null check (action ~ '^[a-z][a-z0-9_]{1,40}$'),
  changes    jsonb,
  note       text check (length(note) <= 2000)
);
create index reports_logs_record_idx on __APP__.reports_logs (record_id, at desc);

create or replace function __APP__.reports_search_text()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.search_text := lower(concat_ws(' ', new.code, to_char(new.period, 'YYYY-MM'), new.current_version));
  return new;
end $$;
revoke execute on function __APP__.reports_search_text() from public, anon, authenticated;

create trigger report_templates_set_updated_at before update on __APP__.report_templates
  for each row execute function public.set_updated_at();
create trigger reports_set_updated_at before update on __APP__.reports
  for each row execute function public.set_updated_at();
create trigger reports_search before insert or update on __APP__.reports
  for each row execute function __APP__.reports_search_text();
create trigger reports_log after insert or update or delete on __APP__.reports
  for each row execute function __APP__.log_changes('important', '/laporan/', 'Laporan');

alter table __APP__.report_templates enable row level security;
alter table __APP__.reports enable row level security;
alter table __APP__.report_versions enable row level security;
alter table __APP__.reports_logs enable row level security;
revoke insert, update, delete on __APP__.report_templates, __APP__.reports, __APP__.report_versions, __APP__.reports_logs from authenticated, anon;

create policy "report_templates: staff read" on __APP__.report_templates for select to authenticated using ((select __APP__.k3_staff()));
create policy "reports: staff read" on __APP__.reports for select to authenticated
  using ((select __APP__.k3_staff())
         and ('*' = any ((select __APP__.my_company_scope())::text[]) or company_code = any ((select __APP__.my_company_scope())::text[]))
         and ('*' = any ((select __APP__.my_location_scope())::text[]) or location_id::text = any ((select __APP__.my_location_scope())::text[])));
create policy "report_versions: read with report" on __APP__.report_versions for select to authenticated
  using (exists (select 1 from __APP__.reports r where r.id = report_id));
create policy "reports_logs: read with report" on __APP__.reports_logs for select to authenticated
  using (exists (select 1 from __APP__.reports r where r.id = record_id) or (select public.has_app_role('__APP__', 'admin')));

-- =====================================================================================
-- DATA LAPORAN (satu sumber untuk draf live dan snapshot terbit)
-- =====================================================================================
create or replace function __APP__.report_visible(p_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from __APP__.reports r
                  where r.id = p_id and __APP__.k3_staff() and __APP__.k3_in_scope(r.company_code, r.location_id));
$$;
revoke execute on function __APP__.report_visible(uuid) from public, anon;

create or replace function __APP__.report_can_edit(p_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from __APP__.reports r
                  where r.id = p_id and __APP__.report_visible(p_id)
                    and (public.has_app_role('__APP__', 'admin') or (__APP__.k3_writer() and __APP__.has_function('hse'))));
$$;
revoke execute on function __APP__.report_can_edit(uuid) from public, anon;

-- Angka laporan. security definer: kpi_safety/tsp memakai scope pemanggil; di sini hanya satu site (milik laporan).
-- Dipanggil juga oleh hook approval (pelaku = approver) untuk snapshot, jadi TIDAK bergantung pada scope pemanggil.
create or replace function __APP__.report_build_data(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  r      __APP__.reports;
  t      __APP__.report_templates;
  v_from date; v_to date; v_f timestamptz; v_te timestamptz;
  v_hours numeric; v_hm integer;
  v_fatal integer; v_lti integer; v_near integer; v_prop integer; v_lost integer;
  v_inc jsonb; v_fnd jsonb; v_ins jsonb; v_tsp jsonb; v_secs jsonb := '[]';
  s jsonb;
begin
  select * into r from __APP__.reports where id = p_id;
  if r.id is null then return null; end if;
  select * into t from __APP__.report_templates where id = r.template_id;
  v_from := r.period; v_to := (r.period + interval '1 month - 1 day')::date;
  v_f := v_from::timestamp at time zone 'Asia/Jakarta'; v_te := (v_to + 1)::timestamp at time zone 'Asia/Jakarta';

  -- kinerja keselamatan (hanya kejadian terklasifikasi HSE)
  select count(*) filter (where i.injury_class = 'fatality'), count(*) filter (where i.injury_class = 'lost_time'),
         count(*) filter (where i.category = 'near_miss'), count(*) filter (where i.category = 'property_damage'),
         coalesce(sum(x.lost_days) filter (where i.injury_class = 'lost_time'), 0)
    into v_fatal, v_lti, v_near, v_prop, v_lost
    from __APP__.incidents i left join __APP__.incident_restricted x on x.incident_id = i.id
   where i.category is not null and i.occurred_at >= v_f and i.occurred_at < v_te and i.location_id = r.location_id and i.company_code = r.company_code;
  select sum(w.hours), count(*) into v_hours, v_hm from __APP__.work_hours w where w.location_id = r.location_id and w.month = v_from;

  select jsonb_build_object(
    'total', count(*), 'unclassified', count(*) filter (where i.category is null),
    'rows', coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'code', i.code, 'date', (i.occurred_at at time zone 'Asia/Jakarta')::date,
              'category', i.category, 'status', i.status) order by i.occurred_at) filter (where true), '[]'))
    into v_inc
    from (select * from __APP__.incidents where location_id = r.location_id and company_code = r.company_code
             and occurred_at >= v_f and occurred_at < v_te order by occurred_at limit 100) i;

  select jsonb_build_object(
    'opened', count(*) filter (where f.found_at >= v_f and f.found_at < v_te),
    'closed', count(*) filter (where f.closed_at >= v_f and f.closed_at < v_te),
    'open_end', count(*) filter (where f.found_at < v_te and (f.closed_at is null or f.closed_at >= v_te)),
    'overdue_now', count(*) filter (where f.status <> 'closed' and f.due_date < __APP__.today_wib()),
    'actions_closed', (select count(*) from __APP__.pica_actions a where a.location_id = r.location_id and a.company_code = r.company_code
                        and a.closed_at >= v_f and a.closed_at < v_te),
    'actions_waiting', (select count(*) from __APP__.pica_actions a where a.location_id = r.location_id and a.company_code = r.company_code
                         and a.status = 'waiting_verification'))
    into v_fnd from __APP__.findings f where f.location_id = r.location_id and f.company_code = r.company_code;

  select coalesce(jsonb_agg(jsonb_build_object('type_code', x.type_code, 'plan', x.plan, 'actual', x.actual) order by x.type_code), '[]')
    into v_ins from __APP__.inspection_plan_actual(extract(year from v_from)::integer, extract(month from v_from)::integer, r.location_id) x;
  v_tsp := __APP__.tsp_summary(extract(year from v_from)::integer, extract(month from v_from)::integer, r.location_id);

  for s in select * from jsonb_array_elements(t.sections) loop
    v_secs := v_secs || jsonb_build_array(s || jsonb_build_object('narrative', r.narratives ->> (s ->> 'key')));
  end loop;
  return jsonb_build_object(
    'report', jsonb_build_object('id', r.id, 'code', r.code, 'period', r.period, 'template', t.code, 'template_name', t.name, 'revision', t.revision),
    'sections', v_secs,
    'kpi', jsonb_build_object('fatality', v_fatal, 'lti', v_lti, 'near_miss', v_near, 'property_damage', v_prop, 'lost_days', v_lost,
        'hours', v_hours, 'hours_months', v_hm,
        'ltifr', case when coalesce(v_hours, 0) > 0 then round(v_lti * 1000000 / v_hours, 2) end,
        'ltisr', case when coalesce(v_hours, 0) > 0 then round(v_lost * 1000000 / v_hours, 2) end),
    'incidents', v_inc, 'findings', v_fnd, 'inspections', v_ins, 'tsp', v_tsp);
end $$;
revoke execute on function __APP__.report_build_data(uuid) from public, anon, authenticated;

-- Versi yang boleh dipanggil client: cek visibilitas lalu hitung
create or replace function __APP__.report_data(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not __APP__.report_visible(p_id) then return null; end if;
  return __APP__.report_build_data(p_id);
end $$;
revoke execute on function __APP__.report_data(uuid) from public, anon;

-- Pemeriksaan kelengkapan: [{key,label,ok,required,detail,href}]
create or replace function __APP__.report_completeness(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  r __APP__.reports; t __APP__.report_templates; d jsonb;
  v_out jsonb := '[]'; v_n integer; s jsonb; v_empty text[] := '{}';
begin
  if not __APP__.report_visible(p_id) then return null; end if;
  select * into r from __APP__.reports where id = p_id;
  select * into t from __APP__.report_templates where id = r.template_id;
  d := __APP__.report_build_data(p_id);

  v_out := v_out || jsonb_build_array(jsonb_build_object('key', 'work_hours', 'label', 'Jam kerja bulan ini terisi',
    'ok', (d -> 'kpi' ->> 'hours') is not null, 'required', true,
    'detail', case when (d -> 'kpi' ->> 'hours') is null then 'LTIFR dan LTISR belum bisa dihitung' end, 'href', '/kpi/jam-kerja'));
  v_n := coalesce((d -> 'incidents' ->> 'unclassified')::integer, 0);
  v_out := v_out || jsonb_build_array(jsonb_build_object('key', 'incidents_classified', 'label', 'Semua kejadian periode sudah diklasifikasi HSE',
    'ok', v_n = 0, 'required', true, 'detail', case when v_n > 0 then format('%s kejadian belum diklasifikasi', v_n) end, 'href', '/kejadian?status=reported'));
  v_n := coalesce((d -> 'findings' ->> 'actions_waiting')::integer, 0);
  v_out := v_out || jsonb_build_array(jsonb_build_object('key', 'pica_verified', 'label', 'Bukti PICA sudah diverifikasi',
    'ok', v_n = 0, 'required', false, 'detail', case when v_n > 0 then format('%s tindakan menunggu verifikasi', v_n) end, 'href', '/temuan'));
  v_out := v_out || jsonb_build_array(jsonb_build_object('key', 'tsp_evaluated', 'label', 'Evaluasi TSP bulan ini disetujui',
    'ok', exists (select 1 from __APP__.tsp_evaluations e where e.company_code = r.company_code and e.location_id = r.location_id
                   and e.year = extract(year from r.period) and e.month = extract(month from r.period) and e.status = 'approved'),
    'required', false, 'detail', 'Evaluasi TSP belum disetujui PJO', 'href', '/tsp'));
  for s in select * from jsonb_array_elements(t.sections) where value ->> 'source' = 'narrative' loop
    if length(btrim(coalesce(r.narratives ->> (s ->> 'key'), ''))) = 0 then v_empty := v_empty || (s ->> 'title'); end if;
  end loop;
  v_out := v_out || jsonb_build_array(jsonb_build_object('key', 'narratives', 'label', 'Narasi bagian terisi',
    'ok', cardinality(v_empty) = 0, 'required', true,
    'detail', case when cardinality(v_empty) > 0 then 'Belum diisi: ' || array_to_string(v_empty, ', ') end, 'href', null));
  return v_out;
end $$;
revoke execute on function __APP__.report_completeness(uuid) from public, anon;

-- =====================================================================================
-- RPC
-- =====================================================================================
-- p: {template_id, location_id, period: 'YYYY-MM', company_code?}
create or replace function __APP__.report_create(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid(); t __APP__.report_templates; v_company text;
  v_location uuid := nullif(p ->> 'location_id', '')::uuid; v_period date; v_id uuid; v_code text;
begin
  if not (public.has_app_role('__APP__', 'admin') or (__APP__.k3_writer() and __APP__.has_function('hse'))) then
    raise exception 'Hanya HSE atau admin yang bisa membuat laporan periode.' using errcode = '42501';
  end if;
  select * into t from __APP__.report_templates where id = nullif(p ->> 'template_id', '')::uuid and is_active;
  if t.id is null then raise exception 'Pilih template laporan.' using errcode = 'P0001'; end if;
  select coalesce(nullif(p ->> 'company_code', ''), pr.company) into v_company from public.profiles pr where pr.id = v_uid;
  if v_company is null or not exists (select 1 from public.companies where code = v_company and not is_group) then
    raise exception 'Pilih perusahaan.' using errcode = 'P0001';
  end if;
  if v_location is null or not __APP__.k3_in_scope(v_company, v_location) then
    raise exception 'Site tidak valid atau di luar akses Anda.' using errcode = 'P0001';
  end if;
  begin v_period := (p ->> 'period' || '-01')::date; exception when others then v_period := null; end;
  if v_period is null or v_period > date_trunc('month', __APP__.today_wib())::date or v_period < date '2020-01-01' then
    raise exception 'Periode tidak valid (tidak boleh bulan depan).' using errcode = 'P0001';
  end if;
  v_code := t.prefix || '-' || to_char(v_period, 'YYYY-MM');
  if exists (select 1 from __APP__.reports where company_code = v_company and location_id = v_location and template_id = t.id and period = v_period) then
    raise exception 'Laporan % untuk site dan periode ini sudah ada.', v_code using errcode = 'P0001';
  end if;
  perform __APP__.set_log_context('create', null);
  insert into __APP__.reports (code, company_code, location_id, template_id, period, created_by)
  values (v_code, v_company, v_location, t.id, v_period, v_uid) returning id into v_id;
  perform __APP__.set_log_context('', '');
  return jsonb_build_object('id', v_id, 'code', v_code);
end $$;

-- Narasi per bagian (hanya bagian bersumber narrative) + alasan kekurangan. p: {key: text}
create or replace function __APP__.report_save_narratives(p_id uuid, p jsonb, p_submit_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r __APP__.reports; t __APP__.report_templates; v_keys text[]; v_new jsonb := '{}'; k text;
begin
  select * into r from __APP__.reports where id = p_id for update;
  if r.id is null or not __APP__.report_can_edit(p_id) then
    raise exception 'Hanya HSE atau admin yang bisa mengubah laporan ini.' using errcode = '42501';
  end if;
  if r.status not in ('draft', 'rejected') then
    raise exception 'Laporan hanya bisa diubah saat draf atau dikembalikan.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p) <> 'object' then raise exception 'Isian tidak valid.' using errcode = 'P0001'; end if;
  select * into t from __APP__.report_templates where id = r.template_id;
  select array_agg(s ->> 'key') into v_keys from jsonb_array_elements(t.sections) s where s ->> 'source' = 'narrative';
  for k in select jsonb_object_keys(p) loop
    if not (k = any (coalesce(v_keys, '{}'))) then raise exception 'Bagian % tidak punya narasi.', k using errcode = 'P0001'; end if;
    if length(coalesce(p ->> k, '')) > 4000 then raise exception 'Narasi maksimal 4000 karakter.' using errcode = 'P0001'; end if;
    v_new := v_new || jsonb_build_object(k, left(btrim(coalesce(p ->> k, '')), 4000));
  end loop;
  perform __APP__.set_log_context('update', null);
  update __APP__.reports set narratives = r.narratives || v_new, submit_note = nullif(left(btrim(coalesce(p_submit_note, '')), 1000), '') where id = p_id;
  perform __APP__.set_log_context('', '');
  return jsonb_build_object('id', p_id);
end $$;

-- Mulai koreksi laporan terbit → draf (versi terbit tetap bisa dibuka)
create or replace function __APP__.report_start_correction(p_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r __APP__.reports;
begin
  select * into r from __APP__.reports where id = p_id for update;
  if r.id is null or not __APP__.report_can_edit(p_id) then
    raise exception 'Hanya HSE atau admin yang bisa membuat koreksi.' using errcode = '42501';
  end if;
  if r.status <> 'published' then raise exception 'Hanya laporan terbit yang bisa dikoreksi.' using errcode = 'P0001'; end if;
  if length(btrim(coalesce(p_reason, ''))) < 10 then raise exception 'Alasan koreksi wajib (minimal 10 karakter).' using errcode = 'P0001'; end if;
  perform __APP__.set_log_context('start_correction', btrim(p_reason));
  update __APP__.reports set status = 'draft', correction_reason = btrim(p_reason) where id = p_id;
  perform __APP__.set_log_context('', '');
  return jsonb_build_object('id', p_id);
end $$;
revoke execute on function __APP__.report_create(jsonb), __APP__.report_save_narratives(uuid, jsonb, text), __APP__.report_start_correction(uuid, text) from public, anon;

-- =====================================================================================
-- HOOK APPROVAL (doc_type 'laporan')
-- =====================================================================================
create or replace function __APP__.report_approval_context(p_id uuid)
returns __APP__.approval_context language sql stable security definer set search_path = '' as $$
  select created_by, company_code, null::uuid, 0::numeric, code, status from __APP__.reports where id = p_id;
$$;

create or replace function __APP__.report_on_approval(p_id uuid, p_outcome text)
returns void language plpgsql security definer set search_path = '' as $$
declare r __APP__.reports; v_chk jsonb; v_bad text; v_version text; v_reason text;
begin
  select * into r from __APP__.reports where id = p_id for update;
  if p_outcome = 'submitted' then
    -- pemeriksaan kelengkapan: kekurangan wajib hanya boleh dengan catatan (submit_note >= 10 karakter)
    select string_agg(c ->> 'label', '; ') into v_bad
      from jsonb_array_elements(__APP__.report_completeness(p_id)) c where (c ->> 'required')::boolean and not (c ->> 'ok')::boolean;
    if v_bad is not null and length(btrim(coalesce(r.submit_note, ''))) < 10 then
      raise exception 'Laporan belum lengkap: %. Lengkapi, atau isi alasan mengajukan dengan kekurangan (minimal 10 karakter).', v_bad using errcode = 'P0001';
    end if;
    update __APP__.reports set status = 'pending_approval' where id = p_id;
  elsif p_outcome = 'approved' then
    select case when r.current_version is null then '1.0'
                else split_part(r.current_version, '.', 1) || '.' || (split_part(r.current_version, '.', 2)::integer + 1) end
      into v_version;
    v_reason := r.correction_reason;
    insert into __APP__.report_versions (report_id, version, snapshot, reason)
    values (p_id, v_version, __APP__.report_build_data(p_id), v_reason);
    update __APP__.reports set status = 'published', current_version = v_version, correction_reason = null, submit_note = null where id = p_id;
  elsif p_outcome = 'rejected' then
    update __APP__.reports set status = 'rejected' where id = p_id;
  elsif p_outcome = 'cancelled' then
    update __APP__.reports set status = case when r.current_version is not null and r.correction_reason is null then 'published' else 'draft' end where id = p_id;
  end if;
end $$;
revoke execute on function __APP__.report_approval_context(uuid), __APP__.report_on_approval(uuid, text) from public, anon, authenticated;

insert into __APP__.approval_doc_types (code, label, table_name, href_prefix, context_fn, on_done_fn)
values ('laporan', 'Laporan Periode', 'reports', '/laporan/',
        '__APP__.report_approval_context(uuid)', '__APP__.report_on_approval(uuid,text)')
on conflict (code) do nothing;

-- =====================================================================================
-- DATA AWAL: template dari prototipe
-- =====================================================================================
insert into __APP__.report_templates (code, name, revision, prefix, sections) values
  ('F-MAC-HSE-09-002', 'Laporan Bulanan Keselamatan Pertambangan', 'Rev 4.0', 'LAP', '[
     {"key":"ringkasan","title":"Ringkasan Eksekutif","source":"narrative"},
     {"key":"kinerja","title":"Kinerja Keselamatan","source":"kpi"},
     {"key":"kejadian","title":"Kejadian & Investigasi","source":"incidents"},
     {"key":"temuan","title":"Temuan & PICA","source":"findings"},
     {"key":"inspeksi","title":"Inspeksi & Observasi","source":"inspections"},
     {"key":"tsp","title":"Pencapaian TSP","source":"tsp"},
     {"key":"manpower","title":"Manpower & Kompetensi","source":"unavailable"},
     {"key":"kesehatan","title":"Kesehatan Kerja","source":"unavailable"},
     {"key":"catatan","title":"Catatan & Rencana Bulan Depan","source":"narrative"}]'::jsonb),
  ('F-MAC-IMS-08-015', 'Evaluasi Monthly PJO', 'Rev 8.0', 'LAP-PJO', '[
     {"key":"ringkasan","title":"Ringkasan Evaluasi","source":"narrative"},
     {"key":"kinerja","title":"Kinerja Keselamatan","source":"kpi"},
     {"key":"kejadian","title":"Kejadian & Investigasi","source":"incidents"},
     {"key":"temuan","title":"Temuan & PICA","source":"findings"},
     {"key":"tsp","title":"Pencapaian TSP","source":"tsp"},
     {"key":"maintenance","title":"Ringkasan Maintenance","source":"unavailable"},
     {"key":"isu","title":"Isu Terbuka","source":"unavailable"},
     {"key":"tindak_lanjut","title":"Tindak Lanjut & Keputusan","source":"narrative"}]'::jsonb)
on conflict (code) do nothing;
