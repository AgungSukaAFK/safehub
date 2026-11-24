-- =====================================================================================
-- 17 PEOPLE & COMPLIANCE: Manpower, Kompetensi/Sertifikat, MCU, Permit Site (Safe Hub, fase 4 - bagian A)
--   rancangan-implementasi §4.6 · spesifikasi docs/spec/fase-4-people-kontraktor-dokumen.md
--
-- Pola 11-16: tulis HANYA lewat RPC security definer; data medis (diagnosis) di tabel terpisah dengan RLS fungsi
-- (rancangan §2.7). Status masa berlaku = TURUNAN (rancangan §2.4), dihitung di fungsi baca, tidak disimpan.
-- Pelatihan menyusul di 18_pelatihan.sql.
-- =====================================================================================

-- ---------------------------------------------------------------- helper
-- Mengelola data people: HR, HSE, admin app (bukan auditor)
create or replace function __APP__.people_manager()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_app_role('__APP__', 'admin')
      or (__APP__.k3_writer() and __APP__.has_any_function(array['hr', 'hse']));
$$;
-- Membaca data medis terbatas: HR dan HSE saja (rancangan §2.7)
create or replace function __APP__.medical_viewer()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_app_role('__APP__', 'viewer') and __APP__.my_functions() && array['hr', 'hse'];
$$;
revoke execute on function __APP__.people_manager(), __APP__.medical_viewer() from public, anon;

-- =====================================================================================
-- TABEL
-- =====================================================================================
create table __APP__.employees (
  id            uuid primary key default gen_random_uuid(),
  company_code  text not null references public.companies(code),
  location_id   uuid not null references public.locations(id),
  code          text not null check (length(btrim(code)) between 2 and 30),        -- NIK, mis. GMI-0017
  name          text not null check (length(btrim(name)) between 2 and 120),
  job_title     text not null check (length(btrim(job_title)) between 2 and 80),
  department    text check (length(department) <= 80),                              -- section
  employment    text not null default 'PKWTT' check (employment in ('PKWTT', 'PKWT', 'Harian', 'Magang', 'Mitra')),
  join_date     date,
  status        text not null default 'active' check (status in ('active', 'inactive')),
  contractor_id uuid references __APP__.contractors(id) on delete set null,         -- tenaga mitra
  profile_id    uuid references public.profiles(id) on delete set null,             -- bila punya akun
  search_text   text,
  created_by    uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (company_code, code)
);
comment on table __APP__.employees is 'Manpower per site (karyawan + tenaga mitra). Ditulis HANYA lewat employee_save; diisi massal lewat Impor Data (bagian C).';
create index employees_list_idx on __APP__.employees (company_code, location_id, status, name);
create index employees_profile_idx on __APP__.employees (profile_id) where profile_id is not null;
create index employees_search_idx on __APP__.employees using gin (search_text extensions.gin_trgm_ops);

create table __APP__.position_requirements (
  id          uuid primary key default gen_random_uuid(),
  company_code text not null references public.companies(code),
  location_id uuid not null references public.locations(id),
  job_title   text not null check (length(btrim(job_title)) between 2 and 80),
  required    smallint not null check (required between 0 and 1000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (company_code, location_id, job_title)
);

create table __APP__.competencies (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique check (code ~ '^[a-z][a-z0-9_]{1,40}$'),
  name            text not null check (length(btrim(name)) between 2 and 120),
  job_titles      text[] not null default '{}',     -- jabatan yang WAJIB memilikinya (kosong = tidak wajib untuk siapa pun)
  sort_order      integer not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index competencies_name_uq on __APP__.competencies (lower(btrim(name)));

create table __APP__.certificates (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid not null references __APP__.employees(id) on delete cascade,
  competency_id  uuid not null references __APP__.competencies(id),
  number         text check (length(number) <= 80),
  issuer         text check (length(issuer) <= 120),
  issued_on      date,
  valid_until    date,                                -- null = seumur hidup
  evidence_count integer not null default 0 check (evidence_count >= 0),
  created_by     uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (valid_until is null or issued_on is null or valid_until >= issued_on)
);
create index certificates_employee_idx on __APP__.certificates (employee_id, competency_id, valid_until desc nulls first);

create table __APP__.mcu_records (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid not null references __APP__.employees(id) on delete cascade,
  checked_on     date not null,
  valid_until    date not null,
  result         text not null check (result in ('fit', 'fit_note', 'unfit')),    -- ringkasan aman
  evidence_count integer not null default 0 check (evidence_count >= 0),
  created_by     uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (valid_until >= checked_on)
);
create index mcu_records_employee_idx on __APP__.mcu_records (employee_id, valid_until desc);

-- diagnosis & catatan medis: HANYA HR/HSE (rancangan §2.7), tidak masuk ekspor/log umum
create table __APP__.mcu_restricted (
  mcu_id    uuid primary key references __APP__.mcu_records(id) on delete cascade,
  diagnosis text check (length(diagnosis) <= 2000),
  note      text check (length(note) <= 2000)
);

create table __APP__.site_permits (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references __APP__.employees(id) on delete cascade,
  name        text not null check (length(btrim(name)) between 2 and 120),     -- mis. Izin Masuk Site, SIMPER
  number      text check (length(number) <= 80),
  valid_until date not null,
  created_by  uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index site_permits_employee_idx on __APP__.site_permits (employee_id, valid_until desc);

-- log (tanpa FK, K4). mcu_restricted TIDAK dilog (isi medis).
do $$
declare t text;
begin
  foreach t in array array['employees', 'position_requirements', 'competencies', 'certificates', 'mcu_records', 'site_permits'] loop
    execute format($f$create table __APP__.%I (
      id bigint generated always as identity primary key,
      record_id uuid not null,
      at timestamptz not null default now(),
      actor_id uuid references public.profiles(id) on delete set null,
      action text not null check (action ~ '^[a-z][a-z0-9_]{1,40}$'),
      changes jsonb,
      note text check (length(note) <= 2000))$f$, t || '_logs');
    execute format('create index %I on __APP__.%I (record_id, at desc)', t || '_logs_record_idx', t || '_logs');
    execute format('create trigger %I before update on __APP__.%I for each row execute function public.set_updated_at()', t || '_set_updated_at', t);
  end loop;
end $$;

create or replace function __APP__.employees_search_text()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.search_text := lower(concat_ws(' ', new.code, new.name, new.job_title, new.department));
  return new;
end $$;
revoke execute on function __APP__.employees_search_text() from public, anon, authenticated;
create trigger employees_search before insert or update on __APP__.employees for each row execute function __APP__.employees_search_text();

create trigger employees_log after insert or update or delete on __APP__.employees
  for each row execute function __APP__.log_changes('important', '/manpower/', 'Karyawan');
create trigger position_requirements_log after insert or update or delete on __APP__.position_requirements
  for each row execute function __APP__.log_changes('config', '/manpower#', 'Kebutuhan manpower');
create trigger competencies_log after insert or update or delete on __APP__.competencies
  for each row execute function __APP__.log_changes('config', '/kompetensi#', 'Kompetensi');
create trigger certificates_log after insert or update or delete on __APP__.certificates
  for each row execute function __APP__.log_changes('important', '/kompetensi#', 'Sertifikat');
create trigger mcu_records_log after insert or update or delete on __APP__.mcu_records
  for each row execute function __APP__.log_changes('important', '/mcu#', 'MCU');
create trigger site_permits_log after insert or update or delete on __APP__.site_permits
  for each row execute function __APP__.log_changes('important', '/manpower#', 'Permit site');

-- =====================================================================================
-- RLS: baca = staf K3 dalam scope company + site; tulis hanya lewat RPC
-- =====================================================================================
alter table __APP__.employees enable row level security;
alter table __APP__.position_requirements enable row level security;
alter table __APP__.competencies enable row level security;
alter table __APP__.certificates enable row level security;
alter table __APP__.mcu_records enable row level security;
alter table __APP__.mcu_restricted enable row level security;
alter table __APP__.site_permits enable row level security;
alter table __APP__.employees_logs enable row level security;
alter table __APP__.position_requirements_logs enable row level security;
alter table __APP__.competencies_logs enable row level security;
alter table __APP__.certificates_logs enable row level security;
alter table __APP__.mcu_records_logs enable row level security;
alter table __APP__.site_permits_logs enable row level security;
revoke insert, update, delete on __APP__.employees, __APP__.position_requirements, __APP__.competencies, __APP__.certificates,
  __APP__.mcu_records, __APP__.mcu_restricted, __APP__.site_permits, __APP__.employees_logs, __APP__.position_requirements_logs,
  __APP__.competencies_logs, __APP__.certificates_logs, __APP__.mcu_records_logs, __APP__.site_permits_logs from authenticated, anon;

create policy "employees: staff read" on __APP__.employees for select to authenticated
  using ((select __APP__.k3_staff())
         and ('*' = any ((select __APP__.my_company_scope())::text[]) or company_code = any ((select __APP__.my_company_scope())::text[]))
         and ('*' = any ((select __APP__.my_location_scope())::text[]) or location_id::text = any ((select __APP__.my_location_scope())::text[])));
create policy "position_requirements: staff read" on __APP__.position_requirements for select to authenticated
  using ((select __APP__.k3_staff())
         and ('*' = any ((select __APP__.my_company_scope())::text[]) or company_code = any ((select __APP__.my_company_scope())::text[]))
         and ('*' = any ((select __APP__.my_location_scope())::text[]) or location_id::text = any ((select __APP__.my_location_scope())::text[])));
create policy "competencies: staff read" on __APP__.competencies for select to authenticated using ((select __APP__.k3_staff()));
create policy "certificates: read with employee" on __APP__.certificates for select to authenticated
  using (exists (select 1 from __APP__.employees e where e.id = employee_id));
create policy "mcu_records: read with employee" on __APP__.mcu_records for select to authenticated
  using (exists (select 1 from __APP__.employees e where e.id = employee_id));
create policy "mcu_restricted: hr/hse read" on __APP__.mcu_restricted for select to authenticated
  using ((select __APP__.medical_viewer()) and exists (select 1 from __APP__.mcu_records m where m.id = mcu_id));
create policy "site_permits: read with employee" on __APP__.site_permits for select to authenticated
  using (exists (select 1 from __APP__.employees e where e.id = employee_id));
create policy "employees_logs: read with record" on __APP__.employees_logs for select to authenticated
  using (exists (select 1 from __APP__.employees e where e.id = record_id) or (select public.has_app_role('__APP__', 'admin')));
create policy "position_requirements_logs: admin/hr read" on __APP__.position_requirements_logs for select to authenticated
  using ((select __APP__.people_manager()));
create policy "competencies_logs: admin/hr read" on __APP__.competencies_logs for select to authenticated
  using ((select __APP__.people_manager()));
create policy "certificates_logs: read with record" on __APP__.certificates_logs for select to authenticated
  using (exists (select 1 from __APP__.certificates c where c.id = record_id) or (select public.has_app_role('__APP__', 'admin')));
create policy "mcu_records_logs: hr/hse read" on __APP__.mcu_records_logs for select to authenticated
  using ((select __APP__.medical_viewer()) or (select public.has_app_role('__APP__', 'admin')));
create policy "site_permits_logs: read with record" on __APP__.site_permits_logs for select to authenticated
  using (exists (select 1 from __APP__.site_permits p where p.id = record_id) or (select public.has_app_role('__APP__', 'admin')));

-- =====================================================================================
-- RPC
-- =====================================================================================
create or replace function __APP__.people_company(p jsonb)
returns text language plpgsql stable security definer set search_path = '' as $$
declare v text;
begin
  select coalesce(nullif(p ->> 'company_code', ''), pr.company) into v from public.profiles pr where pr.id = auth.uid();
  if v is null or not exists (select 1 from public.companies where code = v and not is_group) then
    raise exception 'Pilih perusahaan.' using errcode = 'P0001';
  end if;
  return v;
end $$;
revoke execute on function __APP__.people_company(jsonb) from public, anon, authenticated;

-- p: {company_code?, location_id, code, name, job_title, department?, employment, join_date?, status?, contractor_id?, profile_id?}
create or replace function __APP__.employee_save(p_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_company text; v_location uuid := nullif(p ->> 'location_id', '')::uuid; v_id uuid := p_id;
  v_contr uuid := nullif(p ->> 'contractor_id', '')::uuid; v_prof uuid := nullif(p ->> 'profile_id', '')::uuid;
begin
  if not __APP__.people_manager() then
    raise exception 'Hanya HR, HSE, atau admin yang bisa mengelola data manpower.' using errcode = '42501';
  end if;
  v_company := __APP__.people_company(p);
  if v_location is null or not __APP__.k3_in_scope(v_company, v_location) then
    raise exception 'Site tidak valid atau di luar akses Anda.' using errcode = 'P0001';
  end if;
  if length(btrim(coalesce(p ->> 'code', ''))) < 2 or length(btrim(coalesce(p ->> 'name', ''))) < 2 or length(btrim(coalesce(p ->> 'job_title', ''))) < 2 then
    raise exception 'NIK, nama, dan jabatan wajib diisi.' using errcode = 'P0001';
  end if;
  if v_contr is not null and not exists (select 1 from __APP__.contractors where id = v_contr and company_code = v_company) then
    raise exception 'Mitra tidak ditemukan.' using errcode = 'P0001';
  end if;
  if v_prof is not null and not __APP__.k3_user_ok(v_prof) then
    raise exception 'Akun pengguna tidak valid.' using errcode = 'P0001';
  end if;
  if exists (select 1 from __APP__.employees e where e.company_code = v_company and e.code = btrim(p ->> 'code') and e.id is distinct from v_id) then
    raise exception 'NIK % sudah dipakai.', btrim(p ->> 'code') using errcode = 'P0001';
  end if;
  if v_id is null then
    insert into __APP__.employees (company_code, location_id, code, name, job_title, department, employment, join_date, status, contractor_id, profile_id)
    values (v_company, v_location, btrim(p ->> 'code'), btrim(p ->> 'name'), btrim(p ->> 'job_title'), nullif(btrim(p ->> 'department'), ''),
            coalesce(nullif(p ->> 'employment', ''), 'PKWTT'), nullif(p ->> 'join_date', '')::date, coalesce(nullif(p ->> 'status', ''), 'active'), v_contr, v_prof)
    returning id into v_id;
  else
    update __APP__.employees
       set location_id = v_location, code = btrim(p ->> 'code'), name = btrim(p ->> 'name'), job_title = btrim(p ->> 'job_title'),
           department = nullif(btrim(p ->> 'department'), ''), employment = coalesce(nullif(p ->> 'employment', ''), 'PKWTT'),
           join_date = nullif(p ->> 'join_date', '')::date, status = coalesce(nullif(p ->> 'status', ''), 'active'),
           contractor_id = v_contr, profile_id = v_prof
     where id = v_id and company_code = v_company and __APP__.k3_in_scope(company_code, location_id);
    if not found then raise exception 'Karyawan tidak ditemukan.' using errcode = 'P0001'; end if;
  end if;
  return jsonb_build_object('id', v_id);
end $$;

-- p: {location_id, company_code?, job_title, required}
create or replace function __APP__.position_requirement_save(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_company text; v_location uuid := nullif(p ->> 'location_id', '')::uuid; v_id uuid;
begin
  if not __APP__.people_manager() then raise exception 'Hanya HR, HSE, atau admin yang bisa mengatur kebutuhan manpower.' using errcode = '42501'; end if;
  v_company := __APP__.people_company(p);
  if v_location is null or not __APP__.k3_in_scope(v_company, v_location) then raise exception 'Site tidak valid atau di luar akses Anda.' using errcode = 'P0001'; end if;
  if length(btrim(coalesce(p ->> 'job_title', ''))) < 2 or coalesce((p ->> 'required')::integer, -1) not between 0 and 1000 then
    raise exception 'Jabatan dan jumlah kebutuhan (0-1000) wajib diisi.' using errcode = 'P0001';
  end if;
  insert into __APP__.position_requirements (company_code, location_id, job_title, required)
  values (v_company, v_location, btrim(p ->> 'job_title'), (p ->> 'required')::smallint)
  on conflict (company_code, location_id, job_title) do update set required = excluded.required
  returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;

-- p: {code, name, job_titles: [text], is_active?}
create or replace function __APP__.competency_save(p_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := p_id; v_titles text[];
begin
  if not __APP__.people_manager() then raise exception 'Hanya HR, HSE, atau admin yang bisa mengelola kompetensi.' using errcode = '42501'; end if;
  if coalesce(p ->> 'code', '') !~ '^[a-z][a-z0-9_]{1,40}$' or length(btrim(coalesce(p ->> 'name', ''))) < 2 then
    raise exception 'Kode (huruf kecil/angka/garis bawah) dan nama kompetensi wajib diisi.' using errcode = 'P0001';
  end if;
  select coalesce(array_agg(distinct btrim(x)) filter (where length(btrim(x)) > 0), '{}') into v_titles from jsonb_array_elements_text(coalesce(p -> 'job_titles', '[]')) x;
  if v_id is null then
    insert into __APP__.competencies (code, name, job_titles, is_active, sort_order)
    values (p ->> 'code', btrim(p ->> 'name'), v_titles, coalesce((p ->> 'is_active')::boolean, true), coalesce((p ->> 'sort_order')::integer, 0))
    returning id into v_id;
  else
    update __APP__.competencies set name = btrim(p ->> 'name'), job_titles = v_titles, is_active = coalesce((p ->> 'is_active')::boolean, true),
           sort_order = coalesce((p ->> 'sort_order')::integer, sort_order) where id = v_id;
    if not found then raise exception 'Kompetensi tidak ditemukan.' using errcode = 'P0001'; end if;
  end if;
  return jsonb_build_object('id', v_id);
end $$;

-- Bukti dihitung dari Storage sertifikat/<id>/ (unggah ke folder id yang sudah ada, lalu panggil lagi)
create or replace function __APP__.employee_visible(p_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from __APP__.employees e where e.id = p_id and __APP__.k3_staff() and __APP__.k3_in_scope(e.company_code, e.location_id));
$$;
revoke execute on function __APP__.employee_visible(uuid) from public, anon;

-- p: {employee_id, competency_id, number?, issuer?, issued_on?, valid_until?}
create or replace function __APP__.certificate_save(p_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := p_id; v_emp uuid := nullif(p ->> 'employee_id', '')::uuid; v_comp uuid := nullif(p ->> 'competency_id', '')::uuid; v_ev integer := 0;
begin
  if not __APP__.people_manager() then raise exception 'Hanya HR, HSE, atau admin yang bisa mengelola sertifikat.' using errcode = '42501'; end if;
  if v_emp is null or not __APP__.employee_visible(v_emp) then raise exception 'Karyawan tidak ditemukan.' using errcode = 'P0001'; end if;
  if v_comp is null or not exists (select 1 from __APP__.competencies where id = v_comp and is_active) then raise exception 'Pilih kompetensi.' using errcode = 'P0001'; end if;
  if nullif(p ->> 'valid_until', '') is not null and nullif(p ->> 'issued_on', '') is not null and (p ->> 'valid_until')::date < (p ->> 'issued_on')::date then
    raise exception 'Berlaku sampai tidak boleh sebelum tanggal terbit.' using errcode = 'P0001';
  end if;
  if v_id is null then
    insert into __APP__.certificates (employee_id, competency_id, number, issuer, issued_on, valid_until)
    values (v_emp, v_comp, nullif(btrim(p ->> 'number'), ''), nullif(btrim(p ->> 'issuer'), ''), nullif(p ->> 'issued_on', '')::date, nullif(p ->> 'valid_until', '')::date)
    returning id into v_id;
  else
    v_ev := __APP__.tsp_count_files('sertifikat/' || v_id || '/');
    update __APP__.certificates set competency_id = v_comp, number = nullif(btrim(p ->> 'number'), ''), issuer = nullif(btrim(p ->> 'issuer'), ''),
           issued_on = nullif(p ->> 'issued_on', '')::date, valid_until = nullif(p ->> 'valid_until', '')::date, evidence_count = v_ev
     where id = v_id and employee_id = v_emp;
    if not found then raise exception 'Sertifikat tidak ditemukan.' using errcode = 'P0001'; end if;
  end if;
  return jsonb_build_object('id', v_id, 'evidence_count', v_ev);
end $$;

-- p: {employee_id, checked_on, valid_until, result, diagnosis?, note?}   diagnosis/note hanya diterima dari HR/HSE
create or replace function __APP__.mcu_save(p_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := p_id; v_emp uuid := nullif(p ->> 'employee_id', '')::uuid; v_ev integer := 0;
begin
  if not (__APP__.people_manager() and __APP__.medical_viewer()) and not public.has_app_role('__APP__', 'admin') then
    raise exception 'Hanya HR atau HSE yang bisa mencatat MCU.' using errcode = '42501';
  end if;
  if v_emp is null or not __APP__.employee_visible(v_emp) then raise exception 'Karyawan tidak ditemukan.' using errcode = 'P0001'; end if;
  if coalesce(p ->> 'result', '') not in ('fit', 'fit_note', 'unfit') then raise exception 'Hasil MCU wajib dipilih.' using errcode = 'P0001'; end if;
  if nullif(p ->> 'checked_on', '') is null or nullif(p ->> 'valid_until', '') is null
     or (p ->> 'valid_until')::date < (p ->> 'checked_on')::date or (p ->> 'checked_on')::date > __APP__.today_wib() then
    raise exception 'Tanggal MCU tidak valid (pemeriksaan tidak boleh di masa depan; berlaku sampai tidak boleh sebelum tanggal pemeriksaan).' using errcode = 'P0001';
  end if;
  if v_id is null then
    insert into __APP__.mcu_records (employee_id, checked_on, valid_until, result)
    values (v_emp, (p ->> 'checked_on')::date, (p ->> 'valid_until')::date, p ->> 'result') returning id into v_id;
  else
    v_ev := __APP__.tsp_count_files('mcu/' || v_id || '/');
    update __APP__.mcu_records set checked_on = (p ->> 'checked_on')::date, valid_until = (p ->> 'valid_until')::date, result = p ->> 'result', evidence_count = v_ev
     where id = v_id and employee_id = v_emp;
    if not found then raise exception 'Data MCU tidak ditemukan.' using errcode = 'P0001'; end if;
  end if;
  insert into __APP__.mcu_restricted (mcu_id, diagnosis, note)
  values (v_id, nullif(btrim(p ->> 'diagnosis'), ''), nullif(btrim(p ->> 'note'), ''))
  on conflict (mcu_id) do update set diagnosis = excluded.diagnosis, note = excluded.note;
  return jsonb_build_object('id', v_id, 'evidence_count', v_ev);
end $$;

-- p: {employee_id, name, number?, valid_until}
create or replace function __APP__.site_permit_save(p_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := p_id; v_emp uuid := nullif(p ->> 'employee_id', '')::uuid;
begin
  if not __APP__.people_manager() then raise exception 'Hanya HR, HSE, atau admin yang bisa mengelola permit site.' using errcode = '42501'; end if;
  if v_emp is null or not __APP__.employee_visible(v_emp) then raise exception 'Karyawan tidak ditemukan.' using errcode = 'P0001'; end if;
  if length(btrim(coalesce(p ->> 'name', ''))) < 2 or nullif(p ->> 'valid_until', '') is null then
    raise exception 'Nama permit dan tanggal berlaku wajib diisi.' using errcode = 'P0001';
  end if;
  if v_id is null then
    insert into __APP__.site_permits (employee_id, name, number, valid_until)
    values (v_emp, btrim(p ->> 'name'), nullif(btrim(p ->> 'number'), ''), (p ->> 'valid_until')::date) returning id into v_id;
  else
    update __APP__.site_permits set name = btrim(p ->> 'name'), number = nullif(btrim(p ->> 'number'), ''), valid_until = (p ->> 'valid_until')::date
     where id = v_id and employee_id = v_emp;
    if not found then raise exception 'Permit tidak ditemukan.' using errcode = 'P0001'; end if;
  end if;
  return jsonb_build_object('id', v_id);
end $$;
revoke execute on function __APP__.employee_save(uuid, jsonb), __APP__.position_requirement_save(jsonb), __APP__.competency_save(uuid, jsonb),
  __APP__.certificate_save(uuid, jsonb), __APP__.mcu_save(uuid, jsonb), __APP__.site_permit_save(uuid, jsonb) from public, anon;

-- =====================================================================================
-- FUNGSI BACA (invoker: ikut RLS). Status masa berlaku = turunan; ambang 30 hari (DEFAULT_EXPIRY_WARN_DAYS).
-- =====================================================================================
-- Status kedaluwarsa: none | valid | expiring | expired
create or replace function __APP__.expiry_state(p_until date, p_today date default null, p_warn integer default 30)
returns text language sql immutable set search_path = '' as $$
  select case when p_until is null then 'none'
              when p_until < coalesce(p_today, (now() at time zone 'Asia/Jakarta')::date) then 'expired'
              when p_until <= coalesce(p_today, (now() at time zone 'Asia/Jakarta')::date) + p_warn then 'expiring'
              else 'valid' end;
$$;

-- Ringkasan per karyawan untuk daftar manpower
create or replace function __APP__.employee_overview(p_location uuid default null)
returns table (employee_id uuid, mcu_until date, mcu_result text, comp_required integer, comp_ok integer, permit_until date)
language sql stable security invoker set search_path = '' as $$
  select e.id,
         (select m.valid_until from __APP__.mcu_records m where m.employee_id = e.id order by m.valid_until desc limit 1),
         (select m.result from __APP__.mcu_records m where m.employee_id = e.id order by m.valid_until desc limit 1),
         (select count(*)::integer from __APP__.competencies c where c.is_active and e.job_title = any (c.job_titles)),
         (select count(*)::integer from __APP__.competencies c
           where c.is_active and e.job_title = any (c.job_titles)
             and exists (select 1 from __APP__.certificates x where x.employee_id = e.id and x.competency_id = c.id
                          and (x.valid_until is null or x.valid_until >= (now() at time zone 'Asia/Jakarta')::date))),
         (select min(pm.valid_until) from __APP__.site_permits pm where pm.employee_id = e.id
           and pm.valid_until = (select max(z.valid_until) from __APP__.site_permits z where z.employee_id = e.id and z.name = pm.name))
    from __APP__.employees e
   where (p_location is null or e.location_id = p_location);
$$;

-- Matriks kompetensi: karyawan aktif x kompetensi aktif. state: valid|expiring|expired|missing|na
create or replace function __APP__.competency_matrix(p_location uuid default null)
returns table (employee_id uuid, competency_id uuid, state text, valid_until date, certificate_id uuid)
language sql stable security invoker set search_path = '' as $$
  select e.id, c.id,
         case when cert.id is null then (case when e.job_title = any (c.job_titles) then 'missing' else 'na' end)
              else (case __APP__.expiry_state(cert.valid_until) when 'none' then 'valid' else __APP__.expiry_state(cert.valid_until) end) end,
         cert.valid_until, cert.id
    from __APP__.employees e
    cross join __APP__.competencies c
    left join lateral (select x.id, x.valid_until from __APP__.certificates x
                        where x.employee_id = e.id and x.competency_id = c.id
                        order by x.valid_until desc nulls first limit 1) cert on true
   where e.status = 'active' and c.is_active and (p_location is null or e.location_id = p_location);
$$;

-- Kebutuhan vs tersedia per jabatan (karyawan + mitra aktif)
create or replace function __APP__.manpower_summary(p_location uuid default null)
returns table (job_title text, required integer, available integer)
language sql stable security invoker set search_path = '' as $$
  select t.job_title, coalesce(r.req, 0)::integer, coalesce(a.n, 0)::integer
    from (select job_title from __APP__.position_requirements where p_location is null or location_id = p_location
          union select job_title from __APP__.employees where status = 'active' and (p_location is null or location_id = p_location)) t
    left join (select job_title, sum(required) req from __APP__.position_requirements
                where p_location is null or location_id = p_location group by 1) r on r.job_title = t.job_title
    left join (select job_title, count(*) n from __APP__.employees
                where status = 'active' and (p_location is null or location_id = p_location) group by 1) a on a.job_title = t.job_title
   order by t.job_title;
$$;
revoke execute on function __APP__.employee_overview(uuid), __APP__.competency_matrix(uuid), __APP__.manpower_summary(uuid),
  __APP__.expiry_state(date, date, integer) from public, anon;

-- =====================================================================================
-- STORAGE: policy lampiran + sertifikat/ + mcu/ (MCU hanya HR/HSE)
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
      -- sertifikat: HR/HSE/admin pada sertifikat yang terlihat; MCU: HR/HSE pada catatan MCU yang terlihat
      when 'sertifikat' then (select __APP__.people_manager()) and exists (select 1 from __APP__.certificates c where c.id::text = (storage.foldername(name))[2])
      when 'mcu'      then (select __APP__.people_manager()) and (select __APP__.medical_viewer()) and exists (select 1 from __APP__.mcu_records m where m.id::text = (storage.foldername(name))[2])
      else (select public.has_app_role('__APP__', 'editor'))
    end));


-- =====================================================================================
-- KAMUS KPI: pemenuhan manpower (draf; definisi kebutuhan menunggu pengesahan, rancangan §4.6)
-- =====================================================================================
insert into __APP__.kpi_definitions (code, name, definition, formula, rule_text, example, source, owner, unit, direction, thresholds, sort_order) values
  ('manpower_fulfillment', 'Pemenuhan Manpower', 'Persentase kebutuhan manpower per jabatan yang terisi tenaga aktif.',
   'Σ min(tersedia, kebutuhan) per jabatan ÷ Σ kebutuhan × 100',
   'Hanya jabatan dengan kebutuhan > 0. Tenaga aktif = karyawan dan tenaga mitra berstatus aktif di site. Kelebihan di satu jabatan tidak menutup kekurangan jabatan lain.',
   '32 terisi dari 35 kebutuhan → 91%.', 'Manpower', 'HR', '%', 'higher_better', null, 100)
on conflict (code) do nothing;

-- Hitung ulang jumlah bukti dari Storage setelah unggah. p_kind: 'sertifikat' | 'mcu'
create or replace function __APP__.people_sync_evidence(p_kind text, p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_n integer; v_emp uuid;
begin
  if not __APP__.people_manager() then raise exception 'Hanya HR, HSE, atau admin yang bisa memperbarui bukti.' using errcode = '42501'; end if;
  if p_kind = 'sertifikat' then
    select employee_id into v_emp from __APP__.certificates where id = p_id;
    if v_emp is null or not __APP__.employee_visible(v_emp) then raise exception 'Sertifikat tidak ditemukan.' using errcode = 'P0001'; end if;
    v_n := __APP__.tsp_count_files('sertifikat/' || p_id || '/');
    update __APP__.certificates set evidence_count = v_n where id = p_id;
  elsif p_kind = 'mcu' then
    if not __APP__.medical_viewer() then raise exception 'Hanya HR atau HSE yang bisa memperbarui bukti MCU.' using errcode = '42501'; end if;
    select employee_id into v_emp from __APP__.mcu_records where id = p_id;
    if v_emp is null or not __APP__.employee_visible(v_emp) then raise exception 'Data MCU tidak ditemukan.' using errcode = 'P0001'; end if;
    v_n := __APP__.tsp_count_files('mcu/' || p_id || '/');
    update __APP__.mcu_records set evidence_count = v_n where id = p_id;
  else
    raise exception 'Jenis bukti tidak dikenal.' using errcode = 'P0001';
  end if;
  return jsonb_build_object('evidence_count', v_n);
end $$;
revoke execute on function __APP__.people_sync_evidence(text, uuid) from public, anon;
