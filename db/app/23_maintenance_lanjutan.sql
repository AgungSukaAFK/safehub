-- =====================================================================================
-- 23 MAINTENANCE LANJUTAN (fase 5): Readiness LIB (part non-moving), Metal Scrap, impor TSP, Maintenance + Isu Terbuka di Laporan Periode
--   spesifikasi docs/spec/fase-5-maintenance.md (L-series). Material Request = "segera hadir" (tidak ada tabel).
--
-- Sama seperti 22: tabel cermin HANYA ditulis import_commit; rumus ditandai "belum disahkan".
-- =====================================================================================

-- ---------------------------------------------------------------- tabel cermin
create table __APP__.mnt_lib (
  id            uuid primary key default gen_random_uuid(),
  company_code  text not null references public.companies(code),
  location_id   uuid not null references public.locations(id),
  part_code     text not null check (length(btrim(part_code)) between 1 and 60),
  name          text not null check (length(btrim(name)) between 1 and 160),
  uom           text check (length(uom) <= 20),
  qty           numeric(12, 2) not null check (qty >= 0),
  min_qty       numeric(12, 2) not null default 0 check (min_qty >= 0),
  last_moved_on date,                                   -- null = belum pernah bergerak
  synced_at     timestamptz not null default now(),
  unique (company_code, location_id, part_code)
);
create index mnt_lib_site_idx on __APP__.mnt_lib (company_code, location_id);

create table __APP__.mnt_scrap (
  id            uuid primary key default gen_random_uuid(),
  company_code  text not null references public.companies(code),
  location_id   uuid not null references public.locations(id),
  month         date not null check (month = date_trunc('month', month)::date),
  metal         text not null check (length(btrim(metal)) between 1 and 60),
  actual_kg     numeric(14, 1) check (actual_kg >= 0),
  forecast_kg   numeric(14, 1) check (forecast_kg >= 0),
  synced_at     timestamptz not null default now(),
  unique (company_code, location_id, month, metal),
  check (actual_kg is not null or forecast_kg is not null)
);
create index mnt_scrap_site_idx on __APP__.mnt_scrap (company_code, location_id, month);

alter table __APP__.mnt_lib enable row level security;
alter table __APP__.mnt_scrap enable row level security;
revoke insert, update, delete on __APP__.mnt_lib, __APP__.mnt_scrap from authenticated, anon;

create policy "mnt_lib: staff read" on __APP__.mnt_lib for select to authenticated
  using ((select __APP__.k3_staff())
         and ('*' = any ((select __APP__.my_company_scope())::text[]) or company_code = any ((select __APP__.my_company_scope())::text[]))
         and ('*' = any ((select __APP__.my_location_scope())::text[]) or location_id::text = any ((select __APP__.my_location_scope())::text[])));
create policy "mnt_scrap: staff read" on __APP__.mnt_scrap for select to authenticated
  using ((select __APP__.k3_staff())
         and ('*' = any ((select __APP__.my_company_scope())::text[]) or company_code = any ((select __APP__.my_company_scope())::text[]))
         and ('*' = any ((select __APP__.my_location_scope())::text[]) or location_id::text = any ((select __APP__.my_location_scope())::text[])));

alter table __APP__.mnt_sync_state drop constraint mnt_sync_state_target_check;
alter table __APP__.mnt_sync_state add constraint mnt_sync_state_target_check check (target in (
  'mnt_units', 'mnt_downtime', 'mnt_ps', 'mnt_backlog', 'mnt_lib', 'mnt_scrap'));

-- ---------------------------------------------------------------- impor
alter table __APP__.import_jobs drop constraint import_jobs_target_check;
alter table __APP__.import_jobs add constraint import_jobs_target_check check (target in (
  'employees', 'certificates', 'mcu', 'site_permits', 'mnt_units', 'mnt_downtime', 'mnt_ps', 'mnt_backlog', 'mnt_lib', 'mnt_scrap', 'tsp_realizations'));

-- Baris LIB / Scrap (site lewat NAMA persis seperti di Safe Hub, M7). Mode insert menolak kunci yang sudah ada.
create or replace function __APP__.import_row_mnt_ext(p_target text, p_mode text, d jsonb, p_company text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_loc uuid; v_id uuid; v_month date; v_today date := __APP__.today_wib(); v_moved date; v_act numeric; v_fc numeric;
begin
  select id into v_loc from public.locations where lower(name) = lower(btrim(coalesce(d ->> 'site', '')));
  if v_loc is null or not __APP__.k3_in_scope(p_company, v_loc) then
    raise exception 'Site "%" tidak ditemukan atau di luar akses Anda.', coalesce(d ->> 'site', '') using errcode = 'P0001';
  end if;

  if p_target = 'mnt_lib' then
    if length(btrim(coalesce(d ->> 'kode_part', ''))) = 0 or length(btrim(coalesce(d ->> 'nama', ''))) = 0 then
      raise exception 'Kode part dan nama part wajib diisi.' using errcode = 'P0001';
    end if;
    v_moved := nullif(d ->> 'terakhir_bergerak', '')::date;
    if v_moved is not null and v_moved > v_today then raise exception 'Tanggal pergerakan terakhir tidak boleh di masa depan.' using errcode = 'P0001'; end if;
    if (d ->> 'stok')::numeric is null or (d ->> 'stok')::numeric < 0 then raise exception 'Stok harus 0 atau lebih.' using errcode = 'P0001'; end if;
    if coalesce((nullif(d ->> 'minimum', ''))::numeric, 0) < 0 then raise exception 'Stok minimum harus 0 atau lebih.' using errcode = 'P0001'; end if;
    select id into v_id from __APP__.mnt_lib where company_code = p_company and location_id = v_loc and part_code = btrim(d ->> 'kode_part');
    if v_id is not null and p_mode = 'insert' then raise exception 'Part % sudah ada (mode Tambah baru).', btrim(d ->> 'kode_part') using errcode = 'P0001'; end if;
    insert into __APP__.mnt_lib (company_code, location_id, part_code, name, uom, qty, min_qty, last_moved_on)
    values (p_company, v_loc, btrim(d ->> 'kode_part'), left(btrim(d ->> 'nama'), 160), nullif(left(btrim(coalesce(d ->> 'satuan', '')), 20), ''),
            (d ->> 'stok')::numeric, coalesce((nullif(d ->> 'minimum', ''))::numeric, 0), v_moved)
    on conflict (company_code, location_id, part_code) do update
      set name = excluded.name, uom = excluded.uom, qty = excluded.qty, min_qty = excluded.min_qty, last_moved_on = excluded.last_moved_on, synced_at = now();

  elsif p_target = 'mnt_scrap' then
    v_month := date_trunc('month', (d ->> 'bulan')::date)::date;
    v_act := nullif(d ->> 'aktual_kg', '')::numeric; v_fc := nullif(d ->> 'forecast_kg', '')::numeric;
    if v_month is null then raise exception 'Bulan wajib diisi.' using errcode = 'P0001'; end if;
    if length(btrim(coalesce(d ->> 'logam', ''))) = 0 then raise exception 'Jenis logam wajib diisi.' using errcode = 'P0001'; end if;
    if v_act is null and v_fc is null then raise exception 'Isi aktual atau forecast (kg).' using errcode = 'P0001'; end if;
    if coalesce(v_act, 0) < 0 or coalesce(v_fc, 0) < 0 then raise exception 'Berat tidak boleh negatif.' using errcode = 'P0001'; end if;
    if v_act is not null and v_month > date_trunc('month', v_today)::date then raise exception 'Aktual scrap bulan yang belum berjalan tidak bisa diimpor.' using errcode = 'P0001'; end if;
    select id into v_id from __APP__.mnt_scrap where company_code = p_company and location_id = v_loc and month = v_month and lower(metal) = lower(btrim(d ->> 'logam'));
    if v_id is not null and p_mode = 'insert' then raise exception 'Data scrap % bulan % sudah ada (mode Tambah baru).', btrim(d ->> 'logam'), to_char(v_month, 'YYYY-MM') using errcode = 'P0001'; end if;
    if v_id is not null then
      update __APP__.mnt_scrap set metal = left(btrim(d ->> 'logam'), 60), actual_kg = v_act, forecast_kg = v_fc, synced_at = now() where id = v_id;
    else
      insert into __APP__.mnt_scrap (company_code, location_id, month, metal, actual_kg, forecast_kg)
      values (p_company, v_loc, v_month, left(btrim(d ->> 'logam'), 60), v_act, v_fc);
    end if;
  else
    raise exception 'Target impor tidak dikenal.' using errcode = 'P0001';
  end if;
end $$;
revoke execute on function __APP__.import_row_mnt_ext(text, text, jsonb, text) from public, anon, authenticated;

-- Realisasi TSP: program dicari lewat site + tahun + no program; ditulis lewat RPC tsp_realization_save (hak tsp_recorder, evaluasi terkunci tetap dihormati).
create or replace function __APP__.import_row_tsp(p_mode text, d jsonb, p_company text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_loc uuid; v_prog uuid; v_year integer := (d ->> 'tahun')::integer; v_month integer := (d ->> 'bulan')::integer; v_exists boolean;
begin
  select id into v_loc from public.locations where lower(name) = lower(btrim(coalesce(d ->> 'site', '')));
  if v_loc is null or not __APP__.k3_in_scope(p_company, v_loc) then
    raise exception 'Site "%" tidak ditemukan atau di luar akses Anda.', coalesce(d ->> 'site', '') using errcode = 'P0001';
  end if;
  select id into v_prog from __APP__.tsp_programs
   where company_code = p_company and location_id = v_loc and year = v_year and lower(no) = lower(btrim(coalesce(d ->> 'no_program', '')));
  if v_prog is null then raise exception 'Program TSP % tahun % di site ini tidak ditemukan.', coalesce(d ->> 'no_program', ''), v_year using errcode = 'P0001'; end if;
  select exists (select 1 from __APP__.tsp_realizations where program_id = v_prog and month = v_month) into v_exists;
  if v_exists and p_mode = 'insert' then raise exception 'Realisasi bulan % sudah ada (mode Tambah baru).', v_month using errcode = 'P0001'; end if;
  perform __APP__.tsp_realization_save(v_prog, v_month, (d ->> 'aktual')::integer, nullif(d ->> 'catatan', ''));
end $$;
revoke execute on function __APP__.import_row_tsp(text, jsonb, text) from public, anon, authenticated;

-- import_commit (22) diperluas: mnt_lib/mnt_scrap (hak mnt_manager) dan tsp_realizations (hak tsp_recorder).
create or replace function __APP__.import_commit(p_target text, p_mode text, p_filename text, p_location uuid, p_company text, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_company text; el jsonb; v_ok integer := 0; v_fail integer := 0; v_errors jsonb := '[]'; v_total integer; v_job uuid;
  v_mnt boolean := p_target like 'mnt\_%';
  v_tsp boolean := p_target = 'tsp_realizations';
begin
  if p_target not in ('employees', 'certificates', 'mcu', 'site_permits', 'mnt_units', 'mnt_downtime', 'mnt_ps', 'mnt_backlog', 'mnt_lib', 'mnt_scrap', 'tsp_realizations') then
    raise exception 'Target impor tidak dikenal.' using errcode = 'P0001';
  end if;
  if v_mnt and not __APP__.mnt_manager() then raise exception 'Hanya Service/Maintenance, HSE, atau admin yang bisa mengimpor data maintenance.' using errcode = '42501'; end if;
  if v_tsp and not __APP__.tsp_recorder() then
    raise exception 'Hanya HSE, Pengawas, atau PJO yang bisa mengimpor realisasi TSP.' using errcode = '42501';
  end if;
  if not v_mnt and not v_tsp and not __APP__.people_manager() then raise exception 'Hanya HR, HSE, atau admin yang bisa mengimpor data.' using errcode = '42501'; end if;
  if p_mode not in ('insert', 'upsert') then raise exception 'Mode impor tidak valid.' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) not between 1 and 1000 then raise exception 'Impor memuat 1 sampai 1000 baris.' using errcode = 'P0001'; end if;
  if p_target = 'employees' and (p_location is null or not exists (select 1 from public.locations where id = p_location)) then raise exception 'Pilih site tujuan.' using errcode = 'P0001'; end if;
  v_company := __APP__.people_company(jsonb_build_object('company_code', p_company));
  v_total := jsonb_array_length(p_rows);
  for el in select * from jsonb_array_elements(p_rows) loop
    begin
      if p_target in ('mnt_lib', 'mnt_scrap') then
        perform __APP__.import_row_mnt_ext(p_target, p_mode, coalesce(el -> 'd', '{}'::jsonb), v_company);
      elsif v_mnt then
        perform __APP__.import_row_mnt(p_target, p_mode, coalesce(el -> 'd', '{}'::jsonb), v_company);
      elsif v_tsp then
        perform __APP__.import_row_tsp(p_mode, coalesce(el -> 'd', '{}'::jsonb), v_company);
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
-- RINGKASAN LIB + SCRAP (invoker: ikut RLS). SATU sumber: halaman /maintenance, blok Beranda, Laporan Periode.
--   L1 Non-moving = stok > 0 dan (belum pernah bergerak atau pergerakan terakhir > 180 hari lalu). Snapshot stok saat ini (bukan per periode).
--   L2 Readiness LIB = part ber-minimum (min > 0) yang stoknya >= minimum ÷ part ber-minimum. Tanpa part ber-minimum = "Belum tersedia".
--   L3 Scrap: aktual = jumlah kg bulan-bulan dalam periode; forecast bulan yang sama; forecast bulan berikutnya terpisah.
-- =====================================================================================
create or replace function __APP__.mnt_extra(p_location uuid, p_from date, p_to date, p_company text default null)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  v_today date := __APP__.today_wib(); v_days integer := 180;
  v_total integer; v_min_total integer; v_ready integer; v_below integer; v_non integer; v_top jsonb; v_lib_sync timestamptz;
  v_m1 date := date_trunc('month', p_from)::date; v_m2 date := date_trunc('month', p_to)::date;
  v_by jsonb; v_act numeric; v_fc numeric; v_next numeric; v_sc_sync timestamptz;
begin
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 400 then raise exception 'Periode tidak valid.' using errcode = 'P0001'; end if;
  select count(*), count(*) filter (where min_qty > 0), count(*) filter (where min_qty > 0 and qty >= min_qty),
         count(*) filter (where min_qty > 0 and qty < min_qty),
         count(*) filter (where qty > 0 and (last_moved_on is null or last_moved_on < v_today - v_days)), max(synced_at)
    into v_total, v_min_total, v_ready, v_below, v_non, v_lib_sync
    from __APP__.mnt_lib where (p_location is null or location_id = p_location) and (p_company is null or company_code = p_company);
  select coalesce(jsonb_agg(t order by (t ->> 'days')::int desc nulls first), '[]') into v_top from (
    select jsonb_build_object('code', part_code, 'name', name, 'qty', qty, 'uom', uom, 'last_moved_on', last_moved_on,
             'days', case when last_moved_on is null then null else v_today - last_moved_on end) t
      from __APP__.mnt_lib
     where qty > 0 and (last_moved_on is null or last_moved_on < v_today - v_days)
       and (p_location is null or location_id = p_location) and (p_company is null or company_code = p_company)
     order by last_moved_on nulls first, qty desc limit 5) x;

  select coalesce(jsonb_agg(jsonb_build_object('metal', metal, 'actual_kg', a, 'forecast_kg', f) order by metal), '[]'),
         sum(a), sum(f), max(s)
    into v_by, v_act, v_fc, v_sc_sync
    from (select metal, sum(actual_kg) a, sum(forecast_kg) f, max(synced_at) s from __APP__.mnt_scrap
           where month between v_m1 and v_m2 and (p_location is null or location_id = p_location) and (p_company is null or company_code = p_company)
           group by metal) m;
  select sum(forecast_kg) into v_next from __APP__.mnt_scrap
   where month = (v_m2 + interval '1 month')::date and (p_location is null or location_id = p_location) and (p_company is null or company_code = p_company);

  return jsonb_build_object(
    'lib', jsonb_build_object('total', v_total, 'with_min', v_min_total, 'ready', v_ready, 'below_min', v_below, 'non_moving', v_non, 'non_moving_days', v_days,
             'readiness_pct', case when v_min_total > 0 then round(v_ready * 100.0 / v_min_total, 0) end, 'top_non_moving', v_top, 'synced_at', v_lib_sync),
    'scrap', jsonb_build_object('actual_kg', v_act, 'forecast_kg', v_fc, 'next_forecast_kg', v_next, 'by_metal', v_by,
             'achievement_pct', case when coalesce(v_fc, 0) > 0 and v_act is not null then round(v_act * 100.0 / v_fc, 0) end, 'synced_at', v_sc_sync));
end $$;
revoke execute on function __APP__.mnt_extra(uuid, date, date, text) from public, anon;

-- =====================================================================================
-- LAPORAN PERIODE: bagian Maintenance + Isu Terbuka
--   Isu Terbuka (D8) = temuan bersumber 'meeting' (Rapat/MOM) yang belum ditutup pada akhir periode.
--   report_build_data dipanggil juga oleh hook approval (pelaku = approver), jadi memakai satu site + company milik laporan.
-- =====================================================================================
create or replace function __APP__.mnt_dashboard_for(p_location uuid, p_from date, p_to date, p_company text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_today date := __APP__.today_wib(); v_days integer := greatest(p_to - p_from + 1, 1);
  v_ops integer; v_avail numeric; v_bd_h numeric; v_bd_n integer; v_ps_plan integer; v_ps_ok integer; v_ps_late integer; v_bl jsonb;
begin
  -- Rumus SAMA dengan mnt_dashboard (22), dibatasi satu site + company dan dihitung tanpa bergantung scope pemanggil.
  select count(*) filter (where status <> 'retired') into v_ops from __APP__.mnt_units where location_id = p_location and company_code = p_company;
  v_avail := v_ops * v_days * 24;
  select coalesce(sum(d.hours) filter (where d.kind = 'breakdown'), 0), count(*) filter (where d.kind = 'breakdown') into v_bd_h, v_bd_n
    from __APP__.mnt_downtime d join __APP__.mnt_units u on u.id = d.unit_id
   where d.event_date between p_from and p_to and u.status <> 'retired' and u.location_id = p_location and u.company_code = p_company;
  select count(*), count(*) filter (where s.done_on is not null and s.done_on <= s.planned_on + 2), count(*) filter (where s.done_on is null and s.planned_on < v_today)
    into v_ps_plan, v_ps_ok, v_ps_late
    from __APP__.mnt_ps s join __APP__.mnt_units u on u.id = s.unit_id
   where s.planned_on between p_from and p_to and u.location_id = p_location and u.company_code = p_company;
  select jsonb_build_object('total', count(*), 'high', count(*) filter (where b.priority = 'high'), 'oldest_days', coalesce(max(v_today - b.opened_on), 0))
    into v_bl from __APP__.mnt_backlog b join __APP__.mnt_units u on u.id = b.unit_id
   where b.opened_on <= p_to and (b.closed_on is null or b.closed_on > p_to) and u.location_id = p_location and u.company_code = p_company;
  return jsonb_build_object(
    'has_data', exists (select 1 from __APP__.mnt_units where location_id = p_location and company_code = p_company),
    'units_operating', v_ops,
    'pa', case when v_avail > 0 then round(((v_avail - v_bd_h) / v_avail * 100)::numeric, 1) end,
    'mtbf_hours', case when v_bd_n > 0 and v_avail > 0 then round(((v_avail - v_bd_h) / v_bd_n)::numeric, 1) end,
    'mttr_hours', case when v_bd_n > 0 then round((v_bd_h / v_bd_n)::numeric, 1) end,
    'breakdown_count', v_bd_n, 'breakdown_hours', v_bd_h,
    'ps', jsonb_build_object('planned', v_ps_plan, 'on_time', v_ps_ok, 'overdue', v_ps_late,
                             'accuracy', case when v_ps_plan > 0 then round((v_ps_ok * 100.0 / v_ps_plan)::numeric, 0) end),
    'backlog', v_bl,
    'last_sync', (select max(synced_at) from __APP__.mnt_sync_state where company_code = p_company));
end $$;
revoke execute on function __APP__.mnt_dashboard_for(uuid, date, date, text) from public, anon, authenticated;

-- Versi report_build_data dari 16 + kunci 'maintenance' dan 'issues'.
create or replace function __APP__.report_build_data(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  r      __APP__.reports;
  t      __APP__.report_templates;
  v_from date; v_to date; v_f timestamptz; v_te timestamptz;
  v_hours numeric; v_hm integer;
  v_fatal integer; v_lti integer; v_near integer; v_prop integer; v_lost integer;
  v_inc jsonb; v_fnd jsonb; v_ins jsonb; v_tsp jsonb; v_mnt jsonb; v_lib jsonb; v_iss jsonb; v_secs jsonb := '[]';
  s jsonb;
begin
  select * into r from __APP__.reports where id = p_id;
  if r.id is null then return null; end if;
  select * into t from __APP__.report_templates where id = r.template_id;
  v_from := r.period; v_to := (r.period + interval '1 month - 1 day')::date;
  v_f := v_from::timestamp at time zone 'Asia/Jakarta'; v_te := (v_to + 1)::timestamp at time zone 'Asia/Jakarta';

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

  -- Maintenance: angka inti + LIB + Scrap (mnt_extra invoker; di sini berjalan sebagai pemilik, jadi dibatasi site + company laporan)
  v_mnt := __APP__.mnt_dashboard_for(r.location_id, v_from, least(v_to, __APP__.today_wib()), r.company_code);
  v_lib := __APP__.mnt_extra(r.location_id, v_from, v_to, r.company_code);

  -- Isu Terbuka (D8): temuan bersumber rapat yang belum ditutup pada akhir periode
  select jsonb_build_object(
    'open_end', count(*) filter (where f.found_at < v_te and (f.closed_at is null or f.closed_at >= v_te)),
    'opened', count(*) filter (where f.found_at >= v_f and f.found_at < v_te),
    'closed', count(*) filter (where f.closed_at >= v_f and f.closed_at < v_te),
    'overdue_now', count(*) filter (where f.status <> 'closed' and f.due_date < __APP__.today_wib()),
    'rows', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'code', x.code, 'title', x.title, 'due_date', x.due_date, 'status', x.status) order by x.due_date)
                        from (select * from __APP__.findings g where g.location_id = r.location_id and g.company_code = r.company_code and g.source_kind = 'meeting'
                                 and g.found_at < v_te and (g.closed_at is null or g.closed_at >= v_te) order by g.due_date limit 20) x), '[]'))
    into v_iss from __APP__.findings f
   where f.location_id = r.location_id and f.company_code = r.company_code and f.source_kind = 'meeting';

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
    'incidents', v_inc, 'findings', v_fnd, 'inspections', v_ins, 'tsp', v_tsp,
    'maintenance', v_mnt || jsonb_build_object('lib', v_lib -> 'lib', 'scrap', v_lib -> 'scrap'), 'issues', v_iss);
end $$;
revoke execute on function __APP__.report_build_data(uuid) from public, anon, authenticated;

-- Template PJO: Maintenance + Isu Terbuka sekarang punya sumber (laporan yang sudah terbit tetap memakai snapshot-nya).
update __APP__.report_templates
   set sections = (select jsonb_agg(case when s ->> 'key' = 'maintenance' then s || '{"source":"maintenance"}'::jsonb
                                         when s ->> 'key' = 'isu' then s || '{"source":"issues"}'::jsonb else s end order by o)
                     from jsonb_array_elements(sections) with ordinality as e(s, o))
 where code = 'F-MAC-IMS-08-015' and sections @> '[{"key":"maintenance"}]'::jsonb;
