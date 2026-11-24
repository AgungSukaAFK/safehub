-- =====================================================================================
-- 19 KONTRAKTOR & PJO/PJA (Safe Hub, fase 4 - bagian C)
--   rancangan-implementasi §4.7 · spesifikasi docs/spec/fase-4-people-kontraktor-dokumen.md (Z1-Z7)
--
-- Memperluas `contractors` (10_fondasi) dengan PIC; izin + masa berlaku, kontrak (nilai = data KOMERSIAL terbatas),
-- penilaian CSMS, checklist dokumen wajib, dan penunjukan PJO/PJA. Pola 17: tulis HANYA lewat RPC security definer;
-- status masa berlaku turunan (expiry_state, 17). Personel mitra = employees.contractor_id (tanpa tabel baru).
-- =====================================================================================

alter table __APP__.contractors
  add column pic_name    text check (length(pic_name) <= 120),
  add column pic_contact text check (length(pic_contact) <= 120),
  add column notes       text check (length(notes) <= 2000);

-- ---------------------------------------------------------------- helper
-- Mengelola data kontraktor: Pengelola Kontraktor, HSE, admin app (bukan auditor)
create or replace function __APP__.contractor_manager()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_app_role('__APP__', 'admin')
      or (__APP__.k3_writer() and __APP__.has_any_function(array['kontraktor_admin', 'hse']));
$$;
-- Melihat nilai kontrak (komersial): Manajemen, Pengelola Kontraktor, admin app
create or replace function __APP__.commercial_viewer()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_app_role('__APP__', 'admin')
      or (public.has_app_role('__APP__', 'viewer') and __APP__.my_functions() && array['manajemen', 'kontraktor_admin']);
$$;
create or replace function __APP__.contractor_visible(p_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from __APP__.contractors c
                  where c.id = p_id and __APP__.k3_staff()
                    and ('*' = any (__APP__.my_company_scope()::text[]) or c.company_code = any (__APP__.my_company_scope()::text[])));
$$;
revoke execute on function __APP__.contractor_manager(), __APP__.commercial_viewer(), __APP__.contractor_visible(uuid) from public, anon;

-- =====================================================================================
-- TABEL
-- =====================================================================================
create table __APP__.contractor_permits (
  id             uuid primary key default gen_random_uuid(),
  contractor_id  uuid not null references __APP__.contractors(id) on delete cascade,
  name           text not null check (length(btrim(name)) between 2 and 120),       -- NIB, SIUJK, SBU, SKT Migas, ...
  number         text check (length(number) <= 80),
  issuer         text check (length(issuer) <= 120),
  valid_until    date not null,
  evidence_count integer not null default 0 check (evidence_count >= 0),
  created_by     uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index contractor_permits_idx on __APP__.contractor_permits (contractor_id, valid_until desc);

create table __APP__.contractor_contracts (
  id             uuid primary key default gen_random_uuid(),
  contractor_id  uuid not null references __APP__.contractors(id) on delete cascade,
  number         text not null check (length(btrim(number)) between 2 and 80),
  title          text not null check (length(btrim(title)) between 3 and 200),
  starts_on      date not null,
  ends_on        date not null,
  created_by     uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (ends_on >= starts_on),
  unique (contractor_id, number)
);
-- nilai kontrak = data komersial: tabel terpisah, RLS fungsi, TIDAK dilog, tidak masuk ekspor
create table __APP__.contractor_contract_values (
  contract_id uuid primary key references __APP__.contractor_contracts(id) on delete cascade,
  amount      numeric(18, 2) not null check (amount >= 0)
);

create table __APP__.csms_assessments (
  id             uuid primary key default gen_random_uuid(),
  contractor_id  uuid not null references __APP__.contractors(id) on delete cascade,
  assessed_on    date not null,
  score          smallint not null check (score between 0 and 100),
  result         text not null check (result in ('pass', 'conditional', 'fail')),   -- turunan skor, disimpan sebagai snapshot
  valid_until    date not null,
  note           text check (length(note) <= 2000),
  created_by     uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (valid_until >= assessed_on)
);
create index csms_assessments_idx on __APP__.csms_assessments (contractor_id, assessed_on desc);

create table __APP__.contractor_doc_types (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique check (code ~ '^[a-z][a-z0-9_]{1,40}$'),
  name       text not null check (length(btrim(name)) between 2 and 120),
  sort_order integer not null default 0,
  is_active  boolean not null default true
);

create table __APP__.contractor_documents (
  id             uuid primary key default gen_random_uuid(),
  contractor_id  uuid not null references __APP__.contractors(id) on delete cascade,
  type_id        uuid not null references __APP__.contractor_doc_types(id),
  status         text not null default 'pending' check (status in ('pending', 'received', 'rejected')),
  valid_until    date,
  note           text check (length(note) <= 500),
  evidence_count integer not null default 0 check (evidence_count >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (contractor_id, type_id)
);

create table __APP__.pjo_pja_appointments (
  id             uuid primary key default gen_random_uuid(),
  company_code   text not null references public.companies(code),
  location_id    uuid not null references public.locations(id),
  employee_id    uuid not null references __APP__.employees(id) on delete cascade,
  role           text not null check (role in ('pjo', 'pja')),
  scope          text not null check (length(btrim(scope)) between 2 and 200),     -- lingkup wilayah/kegiatan
  sk_number      text not null check (length(btrim(sk_number)) between 2 and 80),
  starts_on      date not null,
  valid_until    date not null,
  evidence_count integer not null default 0 check (evidence_count >= 0),
  created_by     uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (valid_until >= starts_on)
);
create index pjo_pja_idx on __APP__.pjo_pja_appointments (company_code, location_id, role, valid_until desc);

-- log (tanpa FK, K4). Nilai kontrak TIDAK dilog.
do $$
declare t text;
begin
  foreach t in array array['contractor_permits', 'contractor_contracts', 'csms_assessments', 'contractor_documents', 'pjo_pja_appointments'] loop
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
    execute format('alter table __APP__.%I enable row level security', t);
    execute format('alter table __APP__.%I enable row level security', t || '_logs');
    execute format('revoke insert, update, delete on __APP__.%I, __APP__.%I from authenticated, anon', t, t || '_logs');
  end loop;
end $$;

create trigger contractor_permits_log after insert or update or delete on __APP__.contractor_permits
  for each row execute function __APP__.log_changes('important', '/kontraktor#', 'Izin kontraktor');
create trigger contractor_contracts_log after insert or update or delete on __APP__.contractor_contracts
  for each row execute function __APP__.log_changes('important', '/kontraktor#', 'Kontrak kontraktor');
create trigger csms_assessments_log after insert or update or delete on __APP__.csms_assessments
  for each row execute function __APP__.log_changes('important', '/kontraktor#', 'Penilaian CSMS');
create trigger contractor_documents_log after insert or update or delete on __APP__.contractor_documents
  for each row execute function __APP__.log_changes('config', '/kontraktor#', 'Dokumen kontraktor');
create trigger pjo_pja_appointments_log after insert or update or delete on __APP__.pjo_pja_appointments
  for each row execute function __APP__.log_changes('important', '/pjo-pja#', 'Penunjukan PJO/PJA');
alter table __APP__.contractor_contract_values enable row level security;
alter table __APP__.contractor_doc_types enable row level security;
revoke insert, update, delete on __APP__.contractor_contract_values, __APP__.contractor_doc_types from authenticated, anon;

insert into __APP__.contractor_doc_types (code, name, sort_order) values
  ('akta', 'Akta Pendirian & Perubahan', 10), ('nib', 'NIB / SIUP', 20), ('npwp', 'NPWP & SPT', 30),
  ('sbu', 'SBU / Izin Usaha Jasa', 40), ('bpjs', 'Kepesertaan BPJS Ketenagakerjaan', 50), ('smk3', 'Sertifikat SMK3 / Sistem K3', 60)
on conflict (code) do nothing;

-- =====================================================================================
-- RLS: baca = staf K3 pada kontraktor yang terlihat; tulis hanya lewat RPC
-- =====================================================================================
create policy "contractor_permits: read with contractor" on __APP__.contractor_permits for select to authenticated
  using ((select __APP__.contractor_visible(contractor_id)));
create policy "contractor_contracts: read with contractor" on __APP__.contractor_contracts for select to authenticated
  using ((select __APP__.contractor_visible(contractor_id)));
create policy "contractor_contract_values: commercial read" on __APP__.contractor_contract_values for select to authenticated
  using ((select __APP__.commercial_viewer()) and exists (select 1 from __APP__.contractor_contracts c where c.id = contract_id));
create policy "csms_assessments: read with contractor" on __APP__.csms_assessments for select to authenticated
  using ((select __APP__.contractor_visible(contractor_id)));
create policy "contractor_doc_types: staff read" on __APP__.contractor_doc_types for select to authenticated using ((select __APP__.k3_staff()));
create policy "contractor_documents: read with contractor" on __APP__.contractor_documents for select to authenticated
  using ((select __APP__.contractor_visible(contractor_id)));
create policy "pjo_pja_appointments: staff read" on __APP__.pjo_pja_appointments for select to authenticated
  using ((select __APP__.k3_staff())
         and ('*' = any ((select __APP__.my_company_scope())::text[]) or company_code = any ((select __APP__.my_company_scope())::text[]))
         and ('*' = any ((select __APP__.my_location_scope())::text[]) or location_id::text = any ((select __APP__.my_location_scope())::text[])));
create policy "contractor_permits_logs: read with record" on __APP__.contractor_permits_logs for select to authenticated
  using (exists (select 1 from __APP__.contractor_permits p where p.id = record_id) or (select public.has_app_role('__APP__', 'admin')));
create policy "contractor_contracts_logs: read with record" on __APP__.contractor_contracts_logs for select to authenticated
  using (exists (select 1 from __APP__.contractor_contracts p where p.id = record_id) or (select public.has_app_role('__APP__', 'admin')));
create policy "csms_assessments_logs: read with record" on __APP__.csms_assessments_logs for select to authenticated
  using (exists (select 1 from __APP__.csms_assessments p where p.id = record_id) or (select public.has_app_role('__APP__', 'admin')));
create policy "contractor_documents_logs: read with record" on __APP__.contractor_documents_logs for select to authenticated
  using (exists (select 1 from __APP__.contractor_documents p where p.id = record_id) or (select public.has_app_role('__APP__', 'admin')));
create policy "pjo_pja_appointments_logs: read with record" on __APP__.pjo_pja_appointments_logs for select to authenticated
  using (exists (select 1 from __APP__.pjo_pja_appointments p where p.id = record_id) or (select public.has_app_role('__APP__', 'admin')));

-- Daftar mitra untuk staf K3 (policy lama hanya viewer; staf K3 sudah viewer, jadi tidak perlu diubah)

-- =====================================================================================
-- RPC
-- =====================================================================================
-- p: {company_code?, name, kind, pic_name?, pic_contact?, notes?, is_active?}
create or replace function __APP__.contractor_save(p_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := p_id; v_company text;
begin
  if not __APP__.contractor_manager() then raise exception 'Hanya Pengelola Kontraktor, HSE, atau admin yang bisa mengelola kontraktor.' using errcode = '42501'; end if;
  if length(btrim(coalesce(p ->> 'name', ''))) < 2 then raise exception 'Nama perusahaan wajib diisi.' using errcode = 'P0001'; end if;
  if coalesce(p ->> 'kind', '') not in ('subkontraktor', 'vendor') then raise exception 'Pilih jenis kontraktor.' using errcode = 'P0001'; end if;
  if v_id is null then
    v_company := __APP__.people_company(p);
    if not ('*' = any (__APP__.my_company_scope()::text[]) or v_company = any (__APP__.my_company_scope()::text[])) then
      raise exception 'Perusahaan di luar akses Anda.' using errcode = 'P0001';
    end if;
    if exists (select 1 from __APP__.contractors where company_code = v_company and lower(btrim(name)) = lower(btrim(p ->> 'name'))) then
      raise exception 'Kontraktor dengan nama itu sudah ada.' using errcode = 'P0001';
    end if;
    insert into __APP__.contractors (company_code, name, kind, pic_name, pic_contact, notes)
    values (v_company, btrim(p ->> 'name'), p ->> 'kind', nullif(btrim(p ->> 'pic_name'), ''), nullif(btrim(p ->> 'pic_contact'), ''), nullif(btrim(p ->> 'notes'), ''))
    returning id into v_id;
  else
    if not __APP__.contractor_visible(v_id) then raise exception 'Kontraktor tidak ditemukan.' using errcode = 'P0001'; end if;
    if exists (select 1 from __APP__.contractors c, __APP__.contractors o where o.id = v_id and c.company_code = o.company_code
                and c.id <> v_id and lower(btrim(c.name)) = lower(btrim(p ->> 'name'))) then
      raise exception 'Kontraktor dengan nama itu sudah ada.' using errcode = 'P0001';
    end if;
    update __APP__.contractors set name = btrim(p ->> 'name'), kind = p ->> 'kind', pic_name = nullif(btrim(p ->> 'pic_name'), ''),
           pic_contact = nullif(btrim(p ->> 'pic_contact'), ''), notes = nullif(btrim(p ->> 'notes'), ''),
           is_active = coalesce((p ->> 'is_active')::boolean, is_active)
     where id = v_id;
  end if;
  return jsonb_build_object('id', v_id);
end $$;

-- p: {contractor_id, name, number?, issuer?, valid_until}
create or replace function __APP__.contractor_permit_save(p_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := p_id; v_c uuid := nullif(p ->> 'contractor_id', '')::uuid; v_ev integer := 0;
begin
  if not __APP__.contractor_manager() then raise exception 'Hanya Pengelola Kontraktor, HSE, atau admin yang bisa mengelola izin.' using errcode = '42501'; end if;
  if v_c is null or not __APP__.contractor_visible(v_c) then raise exception 'Kontraktor tidak ditemukan.' using errcode = 'P0001'; end if;
  if length(btrim(coalesce(p ->> 'name', ''))) < 2 or nullif(p ->> 'valid_until', '') is null then raise exception 'Nama izin dan masa berlaku wajib diisi.' using errcode = 'P0001'; end if;
  if v_id is null then
    insert into __APP__.contractor_permits (contractor_id, name, number, issuer, valid_until)
    values (v_c, btrim(p ->> 'name'), nullif(btrim(p ->> 'number'), ''), nullif(btrim(p ->> 'issuer'), ''), (p ->> 'valid_until')::date) returning id into v_id;
  else
    v_ev := __APP__.tsp_count_files('izin/' || v_id || '/');
    update __APP__.contractor_permits set name = btrim(p ->> 'name'), number = nullif(btrim(p ->> 'number'), ''), issuer = nullif(btrim(p ->> 'issuer'), ''),
           valid_until = (p ->> 'valid_until')::date, evidence_count = v_ev where id = v_id and contractor_id = v_c;
    if not found then raise exception 'Izin tidak ditemukan.' using errcode = 'P0001'; end if;
  end if;
  return jsonb_build_object('id', v_id);
end $$;

-- p: {contractor_id, number, title, starts_on, ends_on, amount?}  amount hanya diterima dari Manajemen/Pengelola Kontraktor/admin
create or replace function __APP__.contractor_contract_save(p_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := p_id; v_c uuid := nullif(p ->> 'contractor_id', '')::uuid; v_amount numeric := nullif(p ->> 'amount', '')::numeric;
begin
  if not __APP__.contractor_manager() then raise exception 'Hanya Pengelola Kontraktor, HSE, atau admin yang bisa mengelola kontrak.' using errcode = '42501'; end if;
  if v_c is null or not __APP__.contractor_visible(v_c) then raise exception 'Kontraktor tidak ditemukan.' using errcode = 'P0001'; end if;
  if length(btrim(coalesce(p ->> 'number', ''))) < 2 or length(btrim(coalesce(p ->> 'title', ''))) < 3 then raise exception 'Nomor dan judul kontrak wajib diisi.' using errcode = 'P0001'; end if;
  if nullif(p ->> 'starts_on', '') is null or nullif(p ->> 'ends_on', '') is null or (p ->> 'ends_on')::date < (p ->> 'starts_on')::date then
    raise exception 'Tanggal kontrak tidak valid (berakhir tidak boleh sebelum mulai).' using errcode = 'P0001';
  end if;
  if v_amount is not null and v_amount < 0 then raise exception 'Nilai kontrak tidak boleh negatif.' using errcode = 'P0001'; end if;
  if exists (select 1 from __APP__.contractor_contracts where contractor_id = v_c and number = btrim(p ->> 'number') and id is distinct from v_id) then
    raise exception 'Nomor kontrak % sudah dipakai kontraktor ini.', btrim(p ->> 'number') using errcode = 'P0001';
  end if;
  if v_id is null then
    insert into __APP__.contractor_contracts (contractor_id, number, title, starts_on, ends_on)
    values (v_c, btrim(p ->> 'number'), btrim(p ->> 'title'), (p ->> 'starts_on')::date, (p ->> 'ends_on')::date) returning id into v_id;
  else
    update __APP__.contractor_contracts set number = btrim(p ->> 'number'), title = btrim(p ->> 'title'),
           starts_on = (p ->> 'starts_on')::date, ends_on = (p ->> 'ends_on')::date where id = v_id and contractor_id = v_c;
    if not found then raise exception 'Kontrak tidak ditemukan.' using errcode = 'P0001'; end if;
  end if;
  if __APP__.commercial_viewer() then
    if v_amount is null then delete from __APP__.contractor_contract_values where contract_id = v_id;
    else insert into __APP__.contractor_contract_values (contract_id, amount) values (v_id, v_amount)
         on conflict (contract_id) do update set amount = excluded.amount; end if;
  end if;
  return jsonb_build_object('id', v_id);
end $$;

-- p: {contractor_id, assessed_on, score, valid_until?, note?}. Hasil: >= 80 lulus, 60-79 bersyarat, < 60 gagal.
create or replace function __APP__.csms_save(p_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := p_id; v_c uuid := nullif(p ->> 'contractor_id', '')::uuid; v_on date := nullif(p ->> 'assessed_on', '')::date;
        v_score integer := nullif(p ->> 'score', '')::integer; v_until date; v_result text;
begin
  if not __APP__.contractor_manager() then raise exception 'Hanya Pengelola Kontraktor, HSE, atau admin yang bisa mencatat CSMS.' using errcode = '42501'; end if;
  if v_c is null or not __APP__.contractor_visible(v_c) then raise exception 'Kontraktor tidak ditemukan.' using errcode = 'P0001'; end if;
  if v_on is null or v_on > __APP__.today_wib() then raise exception 'Tanggal penilaian tidak valid (tidak boleh di masa depan).' using errcode = 'P0001'; end if;
  if v_score is null or v_score not between 0 and 100 then raise exception 'Skor harus 0 sampai 100.' using errcode = 'P0001'; end if;
  v_until := coalesce(nullif(p ->> 'valid_until', '')::date, (v_on + interval '1 year')::date);
  if v_until < v_on then raise exception 'Berlaku sampai tidak boleh sebelum tanggal penilaian.' using errcode = 'P0001'; end if;
  v_result := case when v_score >= 80 then 'pass' when v_score >= 60 then 'conditional' else 'fail' end;
  if v_id is null then
    insert into __APP__.csms_assessments (contractor_id, assessed_on, score, result, valid_until, note)
    values (v_c, v_on, v_score, v_result, v_until, nullif(btrim(p ->> 'note'), '')) returning id into v_id;
  else
    update __APP__.csms_assessments set assessed_on = v_on, score = v_score, result = v_result, valid_until = v_until, note = nullif(btrim(p ->> 'note'), '')
     where id = v_id and contractor_id = v_c;
    if not found then raise exception 'Penilaian tidak ditemukan.' using errcode = 'P0001'; end if;
  end if;
  return jsonb_build_object('id', v_id, 'result', v_result);
end $$;

-- Checklist dokumen wajib: satu baris per (kontraktor, jenis). p: {contractor_id, type_id, status, valid_until?, note?}
create or replace function __APP__.contractor_document_set(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_c uuid := nullif(p ->> 'contractor_id', '')::uuid; v_t uuid := nullif(p ->> 'type_id', '')::uuid; v_id uuid; v_ev integer := 0;
begin
  if not __APP__.contractor_manager() then raise exception 'Hanya Pengelola Kontraktor, HSE, atau admin yang bisa mengelola checklist dokumen.' using errcode = '42501'; end if;
  if v_c is null or not __APP__.contractor_visible(v_c) then raise exception 'Kontraktor tidak ditemukan.' using errcode = 'P0001'; end if;
  if v_t is null or not exists (select 1 from __APP__.contractor_doc_types where id = v_t and is_active) then raise exception 'Jenis dokumen tidak ditemukan.' using errcode = 'P0001'; end if;
  if coalesce(p ->> 'status', '') not in ('pending', 'received', 'rejected') then raise exception 'Status dokumen tidak valid.' using errcode = 'P0001'; end if;
  select id into v_id from __APP__.contractor_documents where contractor_id = v_c and type_id = v_t;
  if v_id is null then
    insert into __APP__.contractor_documents (contractor_id, type_id, status, valid_until, note)
    values (v_c, v_t, p ->> 'status', nullif(p ->> 'valid_until', '')::date, nullif(btrim(p ->> 'note'), '')) returning id into v_id;
  else
    v_ev := __APP__.tsp_count_files('kdok/' || v_id || '/');
    update __APP__.contractor_documents set status = p ->> 'status', valid_until = nullif(p ->> 'valid_until', '')::date,
           note = nullif(btrim(p ->> 'note'), ''), evidence_count = v_ev where id = v_id;
  end if;
  return jsonb_build_object('id', v_id);
end $$;

-- p: {employee_id, role, scope, sk_number, starts_on, valid_until}. Pelaku harus karyawan aktif yang terlihat.
create or replace function __APP__.pjo_pja_save(p_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := p_id; v_emp uuid := nullif(p ->> 'employee_id', '')::uuid; e __APP__.employees;
begin
  if not __APP__.contractor_manager() then raise exception 'Hanya Pengelola Kontraktor, HSE, atau admin yang bisa menetapkan PJO/PJA.' using errcode = '42501'; end if;
  select * into e from __APP__.employees where id = v_emp;
  if e.id is null or not __APP__.employee_visible(v_emp) then raise exception 'Karyawan tidak ditemukan.' using errcode = 'P0001'; end if;
  if e.status <> 'active' then raise exception 'Karyawan nonaktif tidak bisa ditunjuk.' using errcode = 'P0001'; end if;
  if coalesce(p ->> 'role', '') not in ('pjo', 'pja') then raise exception 'Pilih peran PJO atau PJA.' using errcode = 'P0001'; end if;
  if length(btrim(coalesce(p ->> 'scope', ''))) < 2 or length(btrim(coalesce(p ->> 'sk_number', ''))) < 2 then raise exception 'Lingkup dan nomor SK wajib diisi.' using errcode = 'P0001'; end if;
  if nullif(p ->> 'starts_on', '') is null or nullif(p ->> 'valid_until', '') is null or (p ->> 'valid_until')::date < (p ->> 'starts_on')::date then
    raise exception 'Tanggal penunjukan tidak valid (berlaku sampai tidak boleh sebelum mulai).' using errcode = 'P0001';
  end if;
  if v_id is null then
    insert into __APP__.pjo_pja_appointments (company_code, location_id, employee_id, role, scope, sk_number, starts_on, valid_until)
    values (e.company_code, e.location_id, v_emp, p ->> 'role', btrim(p ->> 'scope'), btrim(p ->> 'sk_number'), (p ->> 'starts_on')::date, (p ->> 'valid_until')::date)
    returning id into v_id;
  else
    update __APP__.pjo_pja_appointments set employee_id = v_emp, company_code = e.company_code, location_id = e.location_id, role = p ->> 'role',
           scope = btrim(p ->> 'scope'), sk_number = btrim(p ->> 'sk_number'), starts_on = (p ->> 'starts_on')::date, valid_until = (p ->> 'valid_until')::date,
           evidence_count = __APP__.tsp_count_files('pjo/' || v_id || '/')
     where id = v_id and __APP__.k3_in_scope(company_code, location_id);
    if not found then raise exception 'Penunjukan tidak ditemukan.' using errcode = 'P0001'; end if;
  end if;
  return jsonb_build_object('id', v_id);
end $$;

-- Hitung ulang bukti dari Storage. p_kind: 'izin' | 'kdok' | 'pjo'
create or replace function __APP__.kontraktor_sync_evidence(p_kind text, p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_n integer; v_ok boolean;
begin
  if not __APP__.contractor_manager() then raise exception 'Hanya Pengelola Kontraktor, HSE, atau admin yang bisa memperbarui bukti.' using errcode = '42501'; end if;
  v_n := __APP__.tsp_count_files(p_kind || '/' || p_id || '/');
  if p_kind = 'izin' then
    select __APP__.contractor_visible(contractor_id) into v_ok from __APP__.contractor_permits where id = p_id;
    if coalesce(v_ok, false) then update __APP__.contractor_permits set evidence_count = v_n where id = p_id; end if;
  elsif p_kind = 'kdok' then
    select __APP__.contractor_visible(contractor_id) into v_ok from __APP__.contractor_documents where id = p_id;
    if coalesce(v_ok, false) then update __APP__.contractor_documents set evidence_count = v_n where id = p_id; end if;
  elsif p_kind = 'pjo' then
    select __APP__.employee_visible(employee_id) into v_ok from __APP__.pjo_pja_appointments where id = p_id;
    if coalesce(v_ok, false) then update __APP__.pjo_pja_appointments set evidence_count = v_n where id = p_id; end if;
  else
    raise exception 'Jenis bukti tidak dikenal.' using errcode = 'P0001';
  end if;
  if not coalesce(v_ok, false) then raise exception 'Data tidak ditemukan.' using errcode = 'P0001'; end if;
  return jsonb_build_object('evidence_count', v_n);
end $$;
revoke execute on function __APP__.contractor_save(uuid, jsonb), __APP__.contractor_permit_save(uuid, jsonb), __APP__.contractor_contract_save(uuid, jsonb),
  __APP__.csms_save(uuid, jsonb), __APP__.contractor_document_set(jsonb), __APP__.pjo_pja_save(uuid, jsonb), __APP__.kontraktor_sync_evidence(text, uuid) from public, anon;

-- =====================================================================================
-- FUNGSI BACA (invoker: ikut RLS). Status legalitas = turunan dari izin TERBARU per nama izin.
-- legal_state: none (belum ada izin) | valid | expiring | expired
-- =====================================================================================
create or replace function __APP__.contractor_overview()
returns table (contractor_id uuid, permit_count integer, permit_nearest date, legal_state text,
               docs_total integer, docs_ok integer, csms_result text, csms_until date, active_contracts integer, personnel integer)
language sql stable security invoker set search_path = '' as $$
  select c.id,
         (select count(*)::integer from (select distinct name from __APP__.contractor_permits where contractor_id = c.id) x),
         (select min(l.valid_until) from (select distinct on (name) valid_until from __APP__.contractor_permits
                                            where contractor_id = c.id order by name, valid_until desc) l),
         (select case when count(*) = 0 then 'none'
                      when bool_or(__APP__.expiry_state(l.valid_until) = 'expired') then 'expired'
                      when bool_or(__APP__.expiry_state(l.valid_until) = 'expiring') then 'expiring'
                      else 'valid' end
            from (select distinct on (name) valid_until from __APP__.contractor_permits where contractor_id = c.id order by name, valid_until desc) l),
         (select count(*)::integer from __APP__.contractor_doc_types t where t.is_active),
         (select count(*)::integer from __APP__.contractor_documents d join __APP__.contractor_doc_types t on t.id = d.type_id
           where d.contractor_id = c.id and t.is_active and d.status = 'received'
             and (d.valid_until is null or d.valid_until >= (now() at time zone 'Asia/Jakarta')::date)),
         (select a.result from __APP__.csms_assessments a where a.contractor_id = c.id order by a.assessed_on desc, a.created_at desc limit 1),
         (select a.valid_until from __APP__.csms_assessments a where a.contractor_id = c.id order by a.assessed_on desc, a.created_at desc limit 1),
         (select count(*)::integer from __APP__.contractor_contracts k
           where k.contractor_id = c.id and (now() at time zone 'Asia/Jakarta')::date between k.starts_on and k.ends_on),
         (select count(*)::integer from __APP__.employees e where e.contractor_id = c.id and e.status = 'active')
    from __APP__.contractors c;
$$;
revoke execute on function __APP__.contractor_overview() from public, anon;

-- =====================================================================================
-- STORAGE: policy lampiran + izin/ kdok/ pjo/
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
      when 'izin'     then exists (select 1 from __APP__.contractor_permits p where p.id::text = (storage.foldername(name))[2])
      when 'kdok'     then exists (select 1 from __APP__.contractor_documents d where d.id::text = (storage.foldername(name))[2])
      when 'pjo'      then exists (select 1 from __APP__.pjo_pja_appointments a where a.id::text = (storage.foldername(name))[2])
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
      when 'izin'     then (select __APP__.contractor_manager()) and exists (select 1 from __APP__.contractor_permits p where p.id::text = (storage.foldername(name))[2])
      when 'kdok'     then (select __APP__.contractor_manager()) and exists (select 1 from __APP__.contractor_documents d where d.id::text = (storage.foldername(name))[2])
      when 'pjo'      then (select __APP__.contractor_manager()) and exists (select 1 from __APP__.pjo_pja_appointments a where a.id::text = (storage.foldername(name))[2])
      else (select public.has_app_role('__APP__', 'editor'))
    end));
