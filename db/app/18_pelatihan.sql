-- =====================================================================================
-- 18 PELATIHAN (Safe Hub, fase 4 - bagian B)
--   rancangan-implementasi §4.6 · spesifikasi docs/spec/fase-4-people-kontraktor-dokumen.md (Y1-Y5)
--
-- Rencana pelatihan per site (TRN-YYYY-NNNN), peserta, kehadiran, bukti (Storage pelatihan/<id>/).
-- Pola 17: tulis HANYA lewat RPC security definer; baca = RLS staf K3 (company + site).
-- Status: planned > done | cancelled. Selesai hanya setelah tanggal mulai; hadir/tidak hadir dicatat per peserta.
-- Peserta yang dinyatakan hadir pada pelatihan selesai TIDAK otomatis menerbitkan sertifikat (Y3): HR/HSE
-- menerbitkannya di profil karyawan, supaya nomor & masa berlaku asli yang tercatat.
-- =====================================================================================

create table __APP__.trainings (
  id             uuid primary key default gen_random_uuid(),
  company_code   text not null references public.companies(code),
  location_id    uuid not null references public.locations(id),
  code           text not null,                                           -- TRN-2026-0001
  title          text not null check (length(btrim(title)) between 3 and 160),
  competency_id  uuid references __APP__.competencies(id) on delete set null,
  provider       text check (length(provider) <= 120),
  venue          text check (length(venue) <= 120),
  starts_on      date not null,
  ends_on        date not null,
  capacity       smallint check (capacity is null or capacity between 1 and 1000),
  status         text not null default 'planned' check (status in ('planned', 'done', 'cancelled')),
  notes          text check (length(notes) <= 2000),
  evidence_count integer not null default 0 check (evidence_count >= 0),
  created_by     uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (ends_on >= starts_on),
  unique (company_code, code)
);
create index trainings_list_idx on __APP__.trainings (company_code, location_id, starts_on desc);

create table __APP__.training_participants (
  training_id uuid not null references __APP__.trainings(id) on delete cascade,
  employee_id uuid not null references __APP__.employees(id) on delete cascade,
  attendance  text not null default 'registered' check (attendance in ('registered', 'present', 'absent')),
  note        text check (length(note) <= 500),
  updated_at  timestamptz not null default now(),
  primary key (training_id, employee_id)
);
create index training_participants_employee_idx on __APP__.training_participants (employee_id);

create table __APP__.trainings_logs (
  id bigint generated always as identity primary key,
  record_id uuid not null,
  at timestamptz not null default now(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (action ~ '^[a-z][a-z0-9_]{1,40}$'),
  changes jsonb,
  note text check (length(note) <= 2000)
);
create index trainings_logs_record_idx on __APP__.trainings_logs (record_id, at desc);
create trigger trainings_set_updated_at before update on __APP__.trainings for each row execute function public.set_updated_at();
create trigger training_participants_set_updated_at before update on __APP__.training_participants for each row execute function public.set_updated_at();
create trigger trainings_log after insert or update or delete on __APP__.trainings
  for each row execute function __APP__.log_changes('important', '/pelatihan/', 'Pelatihan');

alter table __APP__.trainings enable row level security;
alter table __APP__.training_participants enable row level security;
alter table __APP__.trainings_logs enable row level security;
revoke insert, update, delete on __APP__.trainings, __APP__.training_participants, __APP__.trainings_logs from authenticated, anon;

create policy "trainings: staff read" on __APP__.trainings for select to authenticated
  using ((select __APP__.k3_staff())
         and ('*' = any ((select __APP__.my_company_scope())::text[]) or company_code = any ((select __APP__.my_company_scope())::text[]))
         and ('*' = any ((select __APP__.my_location_scope())::text[]) or location_id::text = any ((select __APP__.my_location_scope())::text[])));
create policy "training_participants: read with training" on __APP__.training_participants for select to authenticated
  using (exists (select 1 from __APP__.trainings t where t.id = training_id));
create policy "trainings_logs: read with record" on __APP__.trainings_logs for select to authenticated
  using (exists (select 1 from __APP__.trainings t where t.id = record_id) or (select public.has_app_role('__APP__', 'admin')));

-- =====================================================================================
-- RPC
-- =====================================================================================
create or replace function __APP__.training_visible(p_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from __APP__.trainings t where t.id = p_id and __APP__.k3_staff() and __APP__.k3_in_scope(t.company_code, t.location_id));
$$;
revoke execute on function __APP__.training_visible(uuid) from public, anon;

create or replace function __APP__.training_log(p_id uuid, p_action text, p_note text)
returns void language sql security definer set search_path = '' as $$
  insert into __APP__.trainings_logs (record_id, actor_id, action, note) values (p_id, auth.uid(), p_action, left(p_note, 2000));
$$;
revoke execute on function __APP__.training_log(uuid, text, text) from public, anon, authenticated;

-- p: {company_code?, location_id, title, competency_id?, provider?, venue?, starts_on, ends_on, capacity?, notes?}
-- Pelatihan selesai/dibatalkan tidak bisa diubah.
create or replace function __APP__.training_save(p_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_company text; v_location uuid := nullif(p ->> 'location_id', '')::uuid; v_id uuid := p_id; v_code text;
  v_comp uuid := nullif(p ->> 'competency_id', '')::uuid;
  v_from date := nullif(p ->> 'starts_on', '')::date; v_to date := nullif(p ->> 'ends_on', '')::date;
  v_cap smallint := nullif(p ->> 'capacity', '')::smallint; t __APP__.trainings;
begin
  if not __APP__.people_manager() then raise exception 'Hanya HR, HSE, atau admin yang bisa mengelola pelatihan.' using errcode = '42501'; end if;
  v_company := __APP__.people_company(p);
  if v_location is null or not __APP__.k3_in_scope(v_company, v_location) then raise exception 'Site tidak valid atau di luar akses Anda.' using errcode = 'P0001'; end if;
  if length(btrim(coalesce(p ->> 'title', ''))) < 3 then raise exception 'Judul pelatihan wajib diisi.' using errcode = 'P0001'; end if;
  if v_from is null or v_to is null or v_to < v_from then raise exception 'Tanggal pelatihan tidak valid (selesai tidak boleh sebelum mulai).' using errcode = 'P0001'; end if;
  if v_cap is not null and v_cap < 1 then raise exception 'Kapasitas minimal 1.' using errcode = 'P0001'; end if;
  if v_comp is not null and not exists (select 1 from __APP__.competencies where id = v_comp and is_active) then raise exception 'Kompetensi tidak ditemukan.' using errcode = 'P0001'; end if;
  if v_id is null then
    v_code := __APP__.next_doc_number('TRN', v_company, 'year');
    perform __APP__.set_log_context('create', null);
    insert into __APP__.trainings (company_code, location_id, code, title, competency_id, provider, venue, starts_on, ends_on, capacity, notes)
    values (v_company, v_location, v_code, btrim(p ->> 'title'), v_comp, nullif(btrim(p ->> 'provider'), ''), nullif(btrim(p ->> 'venue'), ''),
            v_from, v_to, v_cap, nullif(btrim(p ->> 'notes'), ''))
    returning id into v_id;
    perform __APP__.set_log_context('', '');
  else
    select * into t from __APP__.trainings where id = v_id and company_code = v_company and __APP__.k3_in_scope(company_code, location_id);
    if t.id is null then raise exception 'Pelatihan tidak ditemukan.' using errcode = 'P0001'; end if;
    if t.status <> 'planned' then raise exception 'Pelatihan yang sudah selesai atau dibatalkan tidak bisa diubah.' using errcode = 'P0001'; end if;
    if v_cap is not null and (select count(*) from __APP__.training_participants where training_id = v_id) > v_cap then
      raise exception 'Kapasitas lebih kecil dari jumlah peserta terdaftar.' using errcode = 'P0001';
    end if;
    update __APP__.trainings set location_id = v_location, title = btrim(p ->> 'title'), competency_id = v_comp,
           provider = nullif(btrim(p ->> 'provider'), ''), venue = nullif(btrim(p ->> 'venue'), ''), starts_on = v_from, ends_on = v_to,
           capacity = v_cap, notes = nullif(btrim(p ->> 'notes'), '')
     where id = v_id;
    v_code := t.code;
  end if;
  return jsonb_build_object('id', v_id, 'code', v_code);
end $$;

-- Ganti daftar peserta (hanya saat planned). Peserta yang sudah punya catatan kehadiran dipertahankan.
-- Karyawan harus aktif, terlihat, dan di site pelatihan. Peserta berakun diberi tahu.
create or replace function __APP__.training_participants_set(p_id uuid, p_employee_ids uuid[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare t __APP__.trainings; v_ids uuid[]; v_notified uuid[]; v_n integer;
begin
  if not __APP__.people_manager() then raise exception 'Hanya HR, HSE, atau admin yang bisa mengatur peserta.' using errcode = '42501'; end if;
  select * into t from __APP__.trainings where id = p_id;
  if t.id is null or not __APP__.training_visible(p_id) then raise exception 'Pelatihan tidak ditemukan.' using errcode = 'P0001'; end if;
  if t.status <> 'planned' then raise exception 'Peserta hanya bisa diubah selama pelatihan berstatus Direncanakan.' using errcode = 'P0001'; end if;
  select coalesce(array_agg(distinct x), '{}') into v_ids from unnest(coalesce(p_employee_ids, '{}')) x;
  if exists (select 1 from unnest(v_ids) x where not exists (
       select 1 from __APP__.employees e where e.id = x and e.status = 'active' and e.location_id = t.location_id and e.company_code = t.company_code)) then
    raise exception 'Ada peserta yang tidak aktif atau bukan karyawan site ini.' using errcode = 'P0001';
  end if;
  if t.capacity is not null and cardinality(v_ids) > t.capacity then
    raise exception 'Jumlah peserta (%) melebihi kapasitas (%).', cardinality(v_ids), t.capacity using errcode = 'P0001';
  end if;
  select coalesce(array_agg(e.profile_id), '{}') into v_notified from __APP__.employees e
   where e.id = any (v_ids) and e.profile_id is not null
     and not exists (select 1 from __APP__.training_participants pp where pp.training_id = p_id and pp.employee_id = e.id);
  delete from __APP__.training_participants where training_id = p_id and not (employee_id = any (v_ids));
  insert into __APP__.training_participants (training_id, employee_id)
  select p_id, x from unnest(v_ids) x on conflict do nothing;
  v_n := cardinality(v_ids);
  perform __APP__.training_log(p_id, 'participants', 'Peserta terdaftar: ' || v_n);
  return jsonb_build_object('count', v_n, 'notification_ids', coalesce((
    select jsonb_agg(n) from __APP__.notify(v_notified, 'training_invited', 'Anda didaftarkan pelatihan ' || t.code,
      t.title || ' · ' || to_char(t.starts_on, 'DD Mon YYYY'), '/pelatihan/' || p_id, 'pelatihan', 'trainings', p_id::text) n), '[]'::jsonb));
end $$;

-- Kehadiran per peserta. Hanya setelah tanggal mulai, selama bukan dibatalkan.
create or replace function __APP__.training_attendance_set(p_id uuid, p_employee uuid, p_attendance text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare t __APP__.trainings;
begin
  if not __APP__.people_manager() then raise exception 'Hanya HR, HSE, atau admin yang bisa mencatat kehadiran.' using errcode = '42501'; end if;
  select * into t from __APP__.trainings where id = p_id;
  if t.id is null or not __APP__.training_visible(p_id) then raise exception 'Pelatihan tidak ditemukan.' using errcode = 'P0001'; end if;
  if t.status = 'cancelled' then raise exception 'Pelatihan sudah dibatalkan.' using errcode = 'P0001'; end if;
  if t.starts_on > __APP__.today_wib() then raise exception 'Kehadiran baru bisa dicatat mulai tanggal pelatihan.' using errcode = 'P0001'; end if;
  if coalesce(p_attendance, '') not in ('registered', 'present', 'absent') then raise exception 'Kehadiran tidak valid.' using errcode = 'P0001'; end if;
  update __APP__.training_participants set attendance = p_attendance, note = nullif(left(btrim(coalesce(p_note, '')), 500), '')
   where training_id = p_id and employee_id = p_employee;
  if not found then raise exception 'Peserta tidak terdaftar.' using errcode = 'P0001'; end if;
  perform __APP__.training_log(p_id, 'attendance', (select e.name from __APP__.employees e where e.id = p_employee) || ': ' || p_attendance);
  return jsonb_build_object('ok', true);
end $$;

-- Transisi status. Selesai: setelah tanggal mulai, minimal satu peserta, semua kehadiran sudah dicatat.
-- Batal: catatan >= 10 karakter. Peserta berakun diberi tahu.
create or replace function __APP__.training_set_status(p_id uuid, p_status text, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare t __APP__.trainings; v_users uuid[];
begin
  if not __APP__.people_manager() then raise exception 'Hanya HR, HSE, atau admin yang bisa mengubah status pelatihan.' using errcode = '42501'; end if;
  select * into t from __APP__.trainings where id = p_id;
  if t.id is null or not __APP__.training_visible(p_id) then raise exception 'Pelatihan tidak ditemukan.' using errcode = 'P0001'; end if;
  if t.status <> 'planned' then raise exception 'Pelatihan sudah selesai atau dibatalkan.' using errcode = 'P0001'; end if;
  if p_status = 'done' then
    if t.starts_on > __APP__.today_wib() then raise exception 'Pelatihan belum dimulai.' using errcode = 'P0001'; end if;
    if not exists (select 1 from __APP__.training_participants where training_id = p_id) then raise exception 'Belum ada peserta.' using errcode = 'P0001'; end if;
    if exists (select 1 from __APP__.training_participants where training_id = p_id and attendance = 'registered') then
      raise exception 'Catat kehadiran semua peserta (hadir / tidak hadir) sebelum menyelesaikan.' using errcode = 'P0001';
    end if;
  elsif p_status = 'cancelled' then
    if length(btrim(coalesce(p_note, ''))) < 10 then raise exception 'Alasan pembatalan minimal 10 karakter.' using errcode = 'P0001'; end if;
  else
    raise exception 'Status tidak valid.' using errcode = 'P0001';
  end if;
  perform __APP__.set_log_context(case p_status when 'done' then 'complete' else 'cancel' end, nullif(btrim(coalesce(p_note, '')), ''));
  update __APP__.trainings set status = p_status where id = p_id;
  perform __APP__.set_log_context('', '');
  select coalesce(array_agg(e.profile_id), '{}') into v_users from __APP__.training_participants pp
    join __APP__.employees e on e.id = pp.employee_id where pp.training_id = p_id and e.profile_id is not null;
  return jsonb_build_object('status', p_status, 'notification_ids', coalesce((
    select jsonb_agg(n) from __APP__.notify(v_users, 'training_' || p_status,
      case p_status when 'done' then 'Pelatihan ' || t.code || ' selesai' else 'Pelatihan ' || t.code || ' dibatalkan' end,
      t.title, '/pelatihan/' || p_id, 'pelatihan', 'trainings', p_id::text) n), '[]'::jsonb));
end $$;

create or replace function __APP__.training_sync_evidence(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_n integer;
begin
  if not __APP__.people_manager() then raise exception 'Hanya HR, HSE, atau admin yang bisa memperbarui bukti.' using errcode = '42501'; end if;
  if not __APP__.training_visible(p_id) then raise exception 'Pelatihan tidak ditemukan.' using errcode = 'P0001'; end if;
  v_n := __APP__.tsp_count_files('pelatihan/' || p_id || '/');
  update __APP__.trainings set evidence_count = v_n where id = p_id;
  return jsonb_build_object('evidence_count', v_n);
end $$;
revoke execute on function __APP__.training_save(uuid, jsonb), __APP__.training_participants_set(uuid, uuid[]),
  __APP__.training_attendance_set(uuid, uuid, text, text), __APP__.training_set_status(uuid, text, text), __APP__.training_sync_evidence(uuid) from public, anon;

-- Pelatihan per karyawan (riwayat di profil): invoker, ikut RLS
create or replace function __APP__.employee_trainings(p_employee uuid)
returns table (training_id uuid, code text, title text, starts_on date, ends_on date, status text, attendance text)
language sql stable security invoker set search_path = '' as $$
  select t.id, t.code, t.title, t.starts_on, t.ends_on, t.status, pp.attendance
    from __APP__.training_participants pp join __APP__.trainings t on t.id = pp.training_id
   where pp.employee_id = p_employee
   order by t.starts_on desc;
$$;
revoke execute on function __APP__.employee_trainings(uuid) from public, anon;

-- =====================================================================================
-- STORAGE: policy lampiran + pelatihan/ (baca = pelatihan terlihat; unggah = HR/HSE/admin)
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
      when 'sertifikat' then exists (select 1 from __APP__.certificates c where c.id::text = (storage.foldername(name))[2])
      when 'mcu'      then (select __APP__.medical_viewer()) and exists (select 1 from __APP__.mcu_records m where m.id::text = (storage.foldername(name))[2])
      when 'pelatihan' then exists (select 1 from __APP__.trainings t where t.id::text = (storage.foldername(name))[2])
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
      when 'tsp'      then (select __APP__.tsp_recorder()) and (storage.foldername(name))[3] ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
                           and exists (select 1 from __APP__.tsp_programs p where p.id::text = (storage.foldername(name))[2])
      when 'aktivitas' then (select __APP__.tsp_recorder()) and exists (
                             select 1 from __APP__.safety_activities a
                              where a.id::text = (storage.foldername(name))[2]
                                and (a.created_by = (select auth.uid()) or (select __APP__.has_function('hse'))))
      when 'sertifikat' then (select __APP__.people_manager()) and exists (select 1 from __APP__.certificates c where c.id::text = (storage.foldername(name))[2])
      when 'mcu'      then (select __APP__.people_manager()) and (select __APP__.medical_viewer()) and exists (select 1 from __APP__.mcu_records m where m.id::text = (storage.foldername(name))[2])
      when 'pelatihan' then (select __APP__.people_manager()) and exists (select 1 from __APP__.trainings t where t.id::text = (storage.foldername(name))[2])
      else (select public.has_app_role('__APP__', 'editor'))
    end));
