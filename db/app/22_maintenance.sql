-- =====================================================================================
-- 22 MAINTENANCE: cermin data sistem maintenance, HANYA BACA (Safe Hub, fase 5 - inti)
--   rancangan-implementasi §4.9 · keputusan D12 (2026-11-24): sumber = impor Excel ke tabel cermin `mnt_*`
--   spesifikasi docs/spec/fase-5-maintenance.md (M-series)
--
-- Sistem maintenance tetap satu-satunya sumber kebenaran. Tabel cermin hanya ditulis oleh import_commit (kit Impor Data)
-- dan tidak punya form di UI. Tiap tabel punya source_key (id di sistem sumber) supaya impor ulang idempoten.
-- Rumus KPI didefinisikan di Kamus KPI Safe Hub (draf, belum disahkan).
-- =====================================================================================

create or replace function __APP__.mnt_manager()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_app_role('__APP__', 'admin')
      or (__APP__.k3_writer() and __APP__.has_any_function(array['maintenance', 'hse']));
$$;
revoke execute on function __APP__.mnt_manager() from public, anon;

create table __APP__.mnt_units (
  id           uuid primary key default gen_random_uuid(),
  company_code text not null references public.companies(code),
  location_id  uuid not null references public.locations(id),
  code         text not null check (length(btrim(code)) between 1 and 40),            -- kode unit di sistem sumber
  model        text check (length(model) <= 120),
  status       text not null default 'active' check (status in ('active', 'standby', 'breakdown', 'retired')),
  synced_at    timestamptz not null default now(),
  unique (company_code, code)
);
create index mnt_units_site_idx on __APP__.mnt_units (company_code, location_id, status);

create table __APP__.mnt_downtime (
  id          uuid primary key default gen_random_uuid(),
  unit_id     uuid not null references __APP__.mnt_units(id) on delete cascade,
  event_date  date not null,
  hours       numeric(8, 2) not null check (hours >= 0 and hours <= 744),
  kind        text not null check (kind in ('breakdown', 'planned')),
  note        text check (length(note) <= 500),
  source_key  text not null check (length(source_key) <= 80),
  synced_at   timestamptz not null default now(),
  unique (unit_id, source_key)
);
create index mnt_downtime_idx on __APP__.mnt_downtime (unit_id, event_date);

create table __APP__.mnt_ps (
  id          uuid primary key default gen_random_uuid(),
  unit_id     uuid not null references __APP__.mnt_units(id) on delete cascade,
  name        text not null check (length(btrim(name)) between 1 and 160),           -- jenis PS, mis. PS 250 jam
  planned_on  date not null,
  done_on     date,
  source_key  text not null check (length(source_key) <= 80),
  synced_at   timestamptz not null default now(),
  unique (unit_id, source_key)
);
create index mnt_ps_idx on __APP__.mnt_ps (unit_id, planned_on);

create table __APP__.mnt_backlog (
  id          uuid primary key default gen_random_uuid(),
  unit_id     uuid not null references __APP__.mnt_units(id) on delete cascade,
  title       text not null check (length(btrim(title)) between 1 and 200),
  priority    text not null check (priority in ('high', 'medium', 'low')),
  status      text not null check (status in ('open', 'done')),
  opened_on   date not null,
  closed_on   date,
  source_key  text not null check (length(source_key) <= 80),
  synced_at   timestamptz not null default now(),
  unique (unit_id, source_key),
  check ((status = 'done') = (closed_on is not null)),
  check (closed_on is null or closed_on >= opened_on)
);
create index mnt_backlog_idx on __APP__.mnt_backlog (unit_id, status, opened_on);

-- impor terakhir per target (untuk "Sumber … diperbarui …")
create table __APP__.mnt_sync_state (
  company_code text not null references public.companies(code),
  target       text not null check (target in ('mnt_units', 'mnt_downtime', 'mnt_ps', 'mnt_backlog')),
  synced_at    timestamptz not null default now(),
  row_count    integer not null default 0,
  filename     text check (length(filename) <= 200),
  primary key (company_code, target)
);

alter table __APP__.mnt_units enable row level security;
alter table __APP__.mnt_downtime enable row level security;
alter table __APP__.mnt_ps enable row level security;
alter table __APP__.mnt_backlog enable row level security;
alter table __APP__.mnt_sync_state enable row level security;
revoke insert, update, delete on __APP__.mnt_units, __APP__.mnt_downtime, __APP__.mnt_ps, __APP__.mnt_backlog, __APP__.mnt_sync_state from authenticated, anon;

create policy "mnt_units: staff read" on __APP__.mnt_units for select to authenticated
  using ((select __APP__.k3_staff())
         and ('*' = any ((select __APP__.my_company_scope())::text[]) or company_code = any ((select __APP__.my_company_scope())::text[]))
         and ('*' = any ((select __APP__.my_location_scope())::text[]) or location_id::text = any ((select __APP__.my_location_scope())::text[])));
create policy "mnt_downtime: read with unit" on __APP__.mnt_downtime for select to authenticated using (exists (select 1 from __APP__.mnt_units u where u.id = unit_id));
create policy "mnt_ps: read with unit" on __APP__.mnt_ps for select to authenticated using (exists (select 1 from __APP__.mnt_units u where u.id = unit_id));
create policy "mnt_backlog: read with unit" on __APP__.mnt_backlog for select to authenticated using (exists (select 1 from __APP__.mnt_units u where u.id = unit_id));
create policy "mnt_sync_state: staff read" on __APP__.mnt_sync_state for select to authenticated
  using ((select __APP__.k3_staff())
         and ('*' = any ((select __APP__.my_company_scope())::text[]) or company_code = any ((select __APP__.my_company_scope())::text[])));

-- =====================================================================================
-- IMPOR: target mnt_* masuk lewat import_commit (kit Impor Data, 21)
-- =====================================================================================
alter table __APP__.import_jobs drop constraint import_jobs_target_check;
alter table __APP__.import_jobs add constraint import_jobs_target_check check (target in (
  'employees', 'certificates', 'mcu', 'site_permits', 'mnt_units', 'mnt_downtime', 'mnt_ps', 'mnt_backlog'));

-- Satu baris cermin. d memakai kunci alami (unit, site, ...). Mode insert menolak source_key yang sudah ada; upsert memperbarui.
create or replace function __APP__.import_row_mnt(p_target text, p_mode text, d jsonb, p_company text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_unit uuid; v_loc uuid; v_key text; v_today date := __APP__.today_wib(); v_id uuid; v_date date; v_hours numeric; v_close date; v_open date; v_name text;
begin
  if p_target = 'mnt_units' then
    if length(btrim(coalesce(d ->> 'kode', ''))) = 0 then raise exception 'Kode unit kosong.' using errcode = 'P0001'; end if;
    select id into v_loc from public.locations where lower(name) = lower(btrim(coalesce(d ->> 'site', '')));
    if v_loc is null or not __APP__.k3_in_scope(p_company, v_loc) then raise exception 'Site "%" tidak ditemukan atau di luar akses Anda.', coalesce(d ->> 'site', '') using errcode = 'P0001'; end if;
    if coalesce(d ->> 'status', '') not in ('active', 'standby', 'breakdown', 'retired') then raise exception 'Status unit tidak valid.' using errcode = 'P0001'; end if;
    select id into v_id from __APP__.mnt_units where company_code = p_company and code = btrim(d ->> 'kode');
    if v_id is not null and p_mode = 'insert' then raise exception 'Unit % sudah ada (mode Tambah baru).', btrim(d ->> 'kode') using errcode = 'P0001'; end if;
    insert into __APP__.mnt_units (company_code, location_id, code, model, status)
    values (p_company, v_loc, btrim(d ->> 'kode'), nullif(btrim(coalesce(d ->> 'model', '')), ''), d ->> 'status')
    on conflict (company_code, code) do update set location_id = excluded.location_id, model = excluded.model, status = excluded.status, synced_at = now();
    return;
  end if;

  select u.id into v_unit from __APP__.mnt_units u
   where u.company_code = p_company and u.code = btrim(coalesce(d ->> 'unit', '')) and __APP__.k3_in_scope(u.company_code, u.location_id);
  if v_unit is null then raise exception 'Unit "%" tidak ditemukan. Impor data Unit lebih dulu.', coalesce(d ->> 'unit', '') using errcode = 'P0001'; end if;

  if p_target = 'mnt_downtime' then
    v_date := (d ->> 'tanggal')::date; v_hours := (d ->> 'jam')::numeric;
    if v_date is null or v_date > v_today then raise exception 'Tanggal downtime tidak valid (tidak boleh di masa depan).' using errcode = 'P0001'; end if;
    if v_hours is null or v_hours < 0 or v_hours > 744 then raise exception 'Jam downtime harus 0 sampai 744.' using errcode = 'P0001'; end if;
    if coalesce(d ->> 'jenis', '') not in ('breakdown', 'planned') then raise exception 'Jenis downtime harus breakdown atau planned.' using errcode = 'P0001'; end if;
    v_key := coalesce(nullif(btrim(coalesce(d ->> 'id_sumber', '')), ''), md5(v_unit::text || '|' || v_date || '|' || (d ->> 'jenis') || '|' || coalesce(d ->> 'keterangan', '')));
    select id into v_id from __APP__.mnt_downtime where unit_id = v_unit and source_key = v_key;
    if v_id is not null and p_mode = 'insert' then raise exception 'Data downtime ini sudah ada (mode Tambah baru).' using errcode = 'P0001'; end if;
    insert into __APP__.mnt_downtime (unit_id, event_date, hours, kind, note, source_key)
    values (v_unit, v_date, v_hours, d ->> 'jenis', nullif(left(btrim(coalesce(d ->> 'keterangan', '')), 500), ''), v_key)
    on conflict (unit_id, source_key) do update set event_date = excluded.event_date, hours = excluded.hours, kind = excluded.kind, note = excluded.note, synced_at = now();

  elsif p_target = 'mnt_ps' then
    v_open := (d ->> 'rencana')::date; v_close := nullif(d ->> 'aktual', '')::date; v_name := btrim(coalesce(d ->> 'jenis_ps', ''));
    if v_open is null or length(v_name) = 0 then raise exception 'Jenis PS dan tanggal rencana wajib diisi.' using errcode = 'P0001'; end if;
    if v_close is not null and v_close > v_today then raise exception 'Tanggal aktual PS tidak boleh di masa depan.' using errcode = 'P0001'; end if;
    v_key := coalesce(nullif(btrim(coalesce(d ->> 'id_sumber', '')), ''), md5(v_unit::text || '|' || v_name || '|' || v_open));
    select id into v_id from __APP__.mnt_ps where unit_id = v_unit and source_key = v_key;
    if v_id is not null and p_mode = 'insert' then raise exception 'Data PS ini sudah ada (mode Tambah baru).' using errcode = 'P0001'; end if;
    insert into __APP__.mnt_ps (unit_id, name, planned_on, done_on, source_key) values (v_unit, left(v_name, 160), v_open, v_close, v_key)
    on conflict (unit_id, source_key) do update set name = excluded.name, planned_on = excluded.planned_on, done_on = excluded.done_on, synced_at = now();

  elsif p_target = 'mnt_backlog' then
    v_open := (d ->> 'dibuka')::date; v_close := nullif(d ->> 'ditutup', '')::date; v_name := btrim(coalesce(d ->> 'judul', ''));
    if v_open is null or length(v_name) = 0 then raise exception 'Judul backlog dan tanggal dibuka wajib diisi.' using errcode = 'P0001'; end if;
    if v_open > v_today then raise exception 'Tanggal dibuka tidak boleh di masa depan.' using errcode = 'P0001'; end if;
    if coalesce(d ->> 'prioritas', '') not in ('high', 'medium', 'low') then raise exception 'Prioritas harus high, medium, atau low.' using errcode = 'P0001'; end if;
    if coalesce(d ->> 'status', '') not in ('open', 'done') then raise exception 'Status backlog harus open atau done.' using errcode = 'P0001'; end if;
    if (d ->> 'status') = 'done' and v_close is null then raise exception 'Backlog selesai wajib punya tanggal ditutup.' using errcode = 'P0001'; end if;
    if (d ->> 'status') = 'open' and v_close is not null then raise exception 'Backlog open tidak boleh punya tanggal ditutup.' using errcode = 'P0001'; end if;
    if v_close is not null and v_close < v_open then raise exception 'Tanggal ditutup tidak boleh sebelum dibuka.' using errcode = 'P0001'; end if;
    v_key := coalesce(nullif(btrim(coalesce(d ->> 'id_sumber', '')), ''), md5(v_unit::text || '|' || v_name || '|' || v_open));
    select id into v_id from __APP__.mnt_backlog where unit_id = v_unit and source_key = v_key;
    if v_id is not null and p_mode = 'insert' then raise exception 'Data backlog ini sudah ada (mode Tambah baru).' using errcode = 'P0001'; end if;
    insert into __APP__.mnt_backlog (unit_id, title, priority, status, opened_on, closed_on, source_key)
    values (v_unit, left(v_name, 200), d ->> 'prioritas', d ->> 'status', v_open, v_close, v_key)
    on conflict (unit_id, source_key) do update set title = excluded.title, priority = excluded.priority, status = excluded.status,
      opened_on = excluded.opened_on, closed_on = excluded.closed_on, synced_at = now();
  else
    raise exception 'Target impor tidak dikenal.' using errcode = 'P0001';
  end if;
end $$;
revoke execute on function __APP__.import_row_mnt(text, text, jsonb, text) from public, anon, authenticated;

-- import_commit (21) diperluas: target mnt_* memakai mnt_manager() dan memperbarui mnt_sync_state; target people tetap people_manager().
create or replace function __APP__.import_commit(p_target text, p_mode text, p_filename text, p_location uuid, p_company text, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_company text; el jsonb; v_ok integer := 0; v_fail integer := 0; v_errors jsonb := '[]'; v_total integer; v_job uuid;
  v_mnt boolean := p_target like 'mnt\_%';
begin
  if p_target not in ('employees', 'certificates', 'mcu', 'site_permits', 'mnt_units', 'mnt_downtime', 'mnt_ps', 'mnt_backlog') then
    raise exception 'Target impor tidak dikenal.' using errcode = 'P0001';
  end if;
  if v_mnt and not __APP__.mnt_manager() then raise exception 'Hanya Service/Maintenance, HSE, atau admin yang bisa mengimpor data maintenance.' using errcode = '42501'; end if;
  if not v_mnt and not __APP__.people_manager() then raise exception 'Hanya HR, HSE, atau admin yang bisa mengimpor data.' using errcode = '42501'; end if;
  if p_mode not in ('insert', 'upsert') then raise exception 'Mode impor tidak valid.' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) not between 1 and 1000 then raise exception 'Impor memuat 1 sampai 1000 baris.' using errcode = 'P0001'; end if;
  if p_target = 'employees' and (p_location is null or not exists (select 1 from public.locations where id = p_location)) then raise exception 'Pilih site tujuan.' using errcode = 'P0001'; end if;
  v_company := __APP__.people_company(jsonb_build_object('company_code', p_company));
  v_total := jsonb_array_length(p_rows);
  for el in select * from jsonb_array_elements(p_rows) loop
    begin
      if v_mnt then
        perform __APP__.import_row_mnt(p_target, p_mode, coalesce(el -> 'd', '{}'::jsonb), v_company);
      else
        perform __APP__.import_row(p_target, p_mode, coalesce(el -> 'd', '{}'::jsonb), p_location, v_company);
      end if;
      v_ok := v_ok + 1;
    exception when others then
      v_fail := v_fail + 1;
      if jsonb_array_length(v_errors) < 100 then
        v_errors := v_errors || jsonb_build_object('row', el -> 'n', 'message', sqlerrm);
      end if;
    end;
  end loop;
  insert into __APP__.import_jobs (target, mode, filename, location_id, total, ok_count, failed_count, errors)
  values (p_target, p_mode, left(p_filename, 200), p_location, v_total, v_ok, v_fail, v_errors) returning id into v_job;
  if v_mnt and v_ok > 0 then
    insert into __APP__.mnt_sync_state (company_code, target, row_count, filename) values (v_company, p_target, v_ok, left(p_filename, 200))
    on conflict (company_code, target) do update set synced_at = now(), row_count = excluded.row_count, filename = excluded.filename;
  end if;
  return jsonb_build_object('job_id', v_job, 'total', v_total, 'ok', v_ok, 'failed', v_fail, 'errors', v_errors);
end $$;
revoke execute on function __APP__.import_commit(text, text, text, uuid, text, jsonb) from public, anon;

-- =====================================================================================
-- DASHBOARD (SATU sumber: halaman /maintenance, blok Beranda, laporan nanti). Invoker: ikut RLS (company + site).
--   Jam tersedia = unit tidak 'retired' × hari periode × 24 (ASUMSI, rumus belum disahkan; jam operasi per unit tidak ada di sumber).
--   PA = (tersedia - jam breakdown) / tersedia · MTBF = (tersedia - jam breakdown) / jumlah breakdown · MTTR = jam breakdown / jumlah breakdown
--   PS Accuracy = PS direncanakan di periode yang selesai paling lambat 2 hari setelah rencana / PS direncanakan di periode
--   Backlog Open = open per akhir periode (dibuka <= akhir periode dan belum ditutup sampai akhir periode)
-- =====================================================================================
create or replace function __APP__.mnt_dashboard(p_location uuid, p_from date, p_to date)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  v_today date := __APP__.today_wib(); v_days integer := greatest(p_to - p_from + 1, 1);
  v_units integer; v_ops integer; v_by_status jsonb; v_avail numeric; v_bd_h numeric; v_bd_n integer; v_plan_h numeric;
  v_ps_plan integer; v_ps_ok integer; v_ps_late integer; v_bl jsonb; v_top jsonb; v_sync jsonb;
begin
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then raise exception 'Periode tidak valid.' using errcode = 'P0001'; end if;
  select count(*), count(*) filter (where status <> 'retired') into v_units, v_ops
    from __APP__.mnt_units where p_location is null or location_id = p_location;
  select coalesce(jsonb_object_agg(status, n), '{}') into v_by_status
    from (select status, count(*) n from __APP__.mnt_units where p_location is null or location_id = p_location group by status) s;
  v_avail := v_ops * v_days * 24;
  select coalesce(sum(d.hours) filter (where d.kind = 'breakdown'), 0), count(*) filter (where d.kind = 'breakdown'), coalesce(sum(d.hours) filter (where d.kind = 'planned'), 0)
    into v_bd_h, v_bd_n, v_plan_h
    from __APP__.mnt_downtime d join __APP__.mnt_units u on u.id = d.unit_id
   where d.event_date between p_from and p_to and u.status <> 'retired' and (p_location is null or u.location_id = p_location);
  select count(*), count(*) filter (where s.done_on is not null and s.done_on <= s.planned_on + 2),
         count(*) filter (where s.done_on is null and s.planned_on < v_today)
    into v_ps_plan, v_ps_ok, v_ps_late
    from __APP__.mnt_ps s join __APP__.mnt_units u on u.id = s.unit_id
   where s.planned_on between p_from and p_to and (p_location is null or u.location_id = p_location);
  select jsonb_build_object('total', count(*), 'high', count(*) filter (where b.priority = 'high'), 'medium', count(*) filter (where b.priority = 'medium'),
           'low', count(*) filter (where b.priority = 'low'), 'avg_age_days', round(coalesce(avg(v_today - b.opened_on), 0)::numeric, 0),
           'oldest_days', coalesce(max(v_today - b.opened_on), 0))
    into v_bl
    from __APP__.mnt_backlog b join __APP__.mnt_units u on u.id = b.unit_id
   where b.opened_on <= p_to and (b.closed_on is null or b.closed_on > p_to) and (p_location is null or u.location_id = p_location);
  select coalesce(jsonb_agg(t order by (t ->> 'hours')::numeric desc), '[]') into v_top from (
    select jsonb_build_object('unit_id', u.id, 'code', u.code, 'model', u.model, 'hours', sum(d.hours), 'count', count(*)) t
      from __APP__.mnt_downtime d join __APP__.mnt_units u on u.id = d.unit_id
     where d.kind = 'breakdown' and d.event_date between p_from and p_to and u.status <> 'retired' and (p_location is null or u.location_id = p_location)
     group by u.id, u.code, u.model order by sum(d.hours) desc limit 5) x;
  select coalesce(jsonb_object_agg(target, jsonb_build_object('synced_at', synced_at, 'rows', row_count, 'filename', filename)), '{}') into v_sync from __APP__.mnt_sync_state;
  return jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to, 'days', v_days),
    'units', jsonb_build_object('total', v_units, 'operating', v_ops, 'by_status', v_by_status),
    'pa', case when v_avail > 0 then round(((v_avail - v_bd_h) / v_avail * 100)::numeric, 1) end,
    'mtbf_hours', case when v_bd_n > 0 and v_avail > 0 then round(((v_avail - v_bd_h) / v_bd_n)::numeric, 1) end,
    'mttr_hours', case when v_bd_n > 0 then round((v_bd_h / v_bd_n)::numeric, 1) end,
    'breakdown_count', v_bd_n, 'breakdown_hours', v_bd_h, 'planned_hours', v_plan_h,
    'ps', jsonb_build_object('planned', v_ps_plan, 'on_time', v_ps_ok, 'overdue', v_ps_late,
                             'accuracy', case when v_ps_plan > 0 then round((v_ps_ok * 100.0 / v_ps_plan)::numeric, 0) end),
    'backlog', v_bl, 'top_breakdown', v_top, 'sync', v_sync);
end $$;
revoke execute on function __APP__.mnt_dashboard(uuid, date, date) from public, anon;

insert into __APP__.kpi_definitions (code, name, definition, formula, rule_text, example, source, owner, unit, direction, thresholds, sort_order) values
  ('mnt_pa', 'Physical Availability (PA)', 'Persentase jam tersedia unit yang tidak terpakai breakdown.',
   '(jam tersedia − jam breakdown) ÷ jam tersedia × 100', 'Jam tersedia = unit tidak berstatus Dihentikan × hari periode × 24 (asumsi; belum disahkan). Hanya downtime jenis breakdown; downtime terencana tidak mengurangi.',
   '20 unit × 30 hari × 24 jam = 14.400 jam tersedia; 720 jam breakdown → 95%.', 'Sistem maintenance (impor Excel)', 'Service/Maintenance', '%', 'higher_better', null, 200),
  ('mnt_mtbf', 'MTBF', 'Rata-rata jam operasi antar breakdown.',
   '(jam tersedia − jam breakdown) ÷ jumlah breakdown', 'Tanpa breakdown di periode = "Belum tersedia", bukan 0 atau tak hingga.', '13.680 jam operasi ÷ 12 breakdown → 1.140 jam.', 'Sistem maintenance (impor Excel)', 'Service/Maintenance', 'jam', 'higher_better', null, 210),
  ('mnt_mttr', 'MTTR', 'Rata-rata lama perbaikan per breakdown.',
   'jam breakdown ÷ jumlah breakdown', 'Satu baris downtime jenis breakdown dihitung satu kejadian.', '720 jam ÷ 12 breakdown → 60 jam.', 'Sistem maintenance (impor Excel)', 'Service/Maintenance', 'jam', 'lower_better', null, 220),
  ('mnt_ps_accuracy', 'PS Accuracy', 'Ketepatan pelaksanaan Planned Service terhadap rencana.',
   'PS selesai ≤ rencana + 2 hari ÷ PS direncanakan di periode × 100', 'Toleransi 2 hari adalah usulan, belum disahkan. PS belum dikerjakan dan lewat tanggal rencana dihitung tidak tepat.', '18 dari 20 PS tepat → 90%.', 'Sistem maintenance (impor Excel)', 'Service/Maintenance', '%', 'higher_better', null, 230),
  ('mnt_backlog_open', 'Backlog Open', 'Jumlah backlog pekerjaan yang belum ditutup pada akhir periode.',
   'backlog dibuka ≤ akhir periode dan belum ditutup', 'Umur dihitung dari tanggal dibuka sampai hari ini (WIB).', '37 backlog open, 6 prioritas tinggi.', 'Sistem maintenance (impor Excel)', 'Service/Maintenance', 'item', 'lower_better', null, 240)
on conflict (code) do nothing;
