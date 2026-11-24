-- =====================================================================================
-- 20 DOKUMEN: Prosedur & Dokumen terkendali, Evaluasi Peraturan, Register KO (Safe Hub, fase 4 - bagian D)
--   rancangan-implementasi §4.8 · spesifikasi docs/spec/fase-4-people-kontraktor-dokumen.md (W-series: V1-V7 di bawah)
--
-- Dokumen terkendali: kode manual, jenis SOP/IK/Form, pemilik, jadwal review. Yang disetujui engine adalah REVISI
-- (jenis A, doc_type 'document_revision'): draft > pending_approval > approved | rejected; revisi disetujui sebelumnya
-- otomatis 'obsolete' dan pengakuan baca dibuat untuk jabatan/orang tujuan distribusi. Tulis HANYA lewat RPC/hook.
-- =====================================================================================

-- ---------------------------------------------------------------- helper
-- Mengelola dokumen, peraturan, register KO: HSE, HSE Senior, admin (bukan auditor)
create or replace function __APP__.document_manager()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_app_role('__APP__', 'admin')
      or (__APP__.k3_writer() and __APP__.has_any_function(array['hse', 'hse_senior']));
$$;
revoke execute on function __APP__.document_manager() from public, anon;

-- =====================================================================================
-- TABEL
-- =====================================================================================
create table __APP__.controlled_documents (
  id                    uuid primary key default gen_random_uuid(),
  company_code          text not null references public.companies(code),
  code                  text not null check (length(btrim(code)) between 3 and 40),     -- kode manual, mis. SOP-HSE-001
  title                 text not null check (length(btrim(title)) between 3 and 200),
  kind                  text not null check (kind in ('sop', 'ik', 'form')),
  owner_id              uuid references public.profiles(id) on delete set null,
  review_months         smallint not null default 12 check (review_months between 1 and 60),
  distribute_titles     text[] not null default '{}',                                   -- jabatan tujuan pengakuan
  distribute_employees  uuid[] not null default '{}',                                   -- karyawan tujuan (orang)
  is_active             boolean not null default true,                                  -- false = ditarik (obsolete)
  withdraw_reason       text check (length(withdraw_reason) <= 1000),
  search_text           text,
  created_by            uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (company_code, code)
);
create index controlled_documents_idx on __APP__.controlled_documents (company_code, kind, code);
create index controlled_documents_search_idx on __APP__.controlled_documents using gin (search_text extensions.gin_trgm_ops);

create table __APP__.document_revisions (
  id             uuid primary key default gen_random_uuid(),
  document_id    uuid not null references __APP__.controlled_documents(id) on delete cascade,
  rev_no         integer not null check (rev_no >= 1),
  change_summary text not null check (length(btrim(change_summary)) between 5 and 2000),
  status         text not null default 'draft' check (status in ('draft', 'pending_approval', 'rejected', 'approved', 'obsolete')),
  effective_on   date,
  review_due_on  date,
  evidence_count integer not null default 0 check (evidence_count >= 0),
  created_by     uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (document_id, rev_no)
);
-- satu revisi terbuka per dokumen
create unique index document_revisions_open_uq on __APP__.document_revisions (document_id) where status in ('draft', 'pending_approval', 'rejected');
create unique index document_revisions_current_uq on __APP__.document_revisions (document_id) where status = 'approved';

create table __APP__.document_acknowledgements (
  revision_id     uuid not null references __APP__.document_revisions(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  employee_id     uuid references __APP__.employees(id) on delete set null,
  acknowledged_at timestamptz,
  created_at      timestamptz not null default now(),
  primary key (revision_id, user_id)
);
create index document_acknowledgements_user_idx on __APP__.document_acknowledgements (user_id) where acknowledged_at is null;

create table __APP__.regulations (
  id           uuid primary key default gen_random_uuid(),
  company_code text not null references public.companies(code),
  code         text not null check (length(btrim(code)) between 3 and 80),            -- mis. Kepmen ESDM 1827 K/30/MEM/2018
  title        text not null check (length(btrim(title)) between 3 and 300),
  issuer       text check (length(issuer) <= 120),
  issued_on    date,
  is_active    boolean not null default true,
  created_by   uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (company_code, code)
);

create table __APP__.regulation_evaluations (
  id             uuid primary key default gen_random_uuid(),
  regulation_id  uuid not null references __APP__.regulations(id) on delete cascade,
  location_id    uuid not null references public.locations(id),
  clause         text not null check (length(btrim(clause)) between 1 and 120),      -- pasal / ayat
  requirement    text not null check (length(btrim(requirement)) between 3 and 2000),
  compliance     text not null check (compliance in ('compliant', 'partial', 'non_compliant', 'na')),
  evaluated_on   date not null,
  evaluator_id   uuid references public.profiles(id) on delete set null default auth.uid(),
  follow_up      text check (length(follow_up) <= 2000),
  next_review_on date,
  finding_id     uuid references __APP__.findings(id) on delete set null,           -- temuan hasil tindak lanjut
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index regulation_evaluations_idx on __APP__.regulation_evaluations (regulation_id, evaluated_on desc);

create table __APP__.ko_register (
  id             uuid primary key default gen_random_uuid(),
  company_code   text not null references public.companies(code),
  location_id    uuid not null references public.locations(id),
  code           text not null,                                                       -- KO-2026-0001
  title          text not null check (length(btrim(title)) between 3 and 200),
  kind           text not null check (kind in ('izin_operasi', 'sertifikasi_alat', 'sarana_prasarana', 'dokumen_teknis')),
  number         text check (length(number) <= 80),
  owner_id       uuid references public.profiles(id) on delete set null,
  valid_until    date not null,
  is_active      boolean not null default true,
  notes          text check (length(notes) <= 2000),
  evidence_count integer not null default 0 check (evidence_count >= 0),
  created_by     uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (company_code, code)
);
create index ko_register_idx on __APP__.ko_register (company_code, location_id, valid_until);

-- log (tanpa FK, K4)
do $$
declare t text;
begin
  foreach t in array array['controlled_documents', 'document_revisions', 'regulations', 'regulation_evaluations', 'ko_register'] loop
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
alter table __APP__.document_acknowledgements enable row level security;
revoke insert, update, delete on __APP__.document_acknowledgements from authenticated, anon;

create or replace function __APP__.controlled_documents_search_text()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.search_text := lower(concat_ws(' ', new.code, new.title));
  return new;
end $$;
revoke execute on function __APP__.controlled_documents_search_text() from public, anon, authenticated;
create trigger controlled_documents_search before insert or update on __APP__.controlled_documents
  for each row execute function __APP__.controlled_documents_search_text();

create trigger controlled_documents_log after insert or update or delete on __APP__.controlled_documents
  for each row execute function __APP__.log_changes('important', '/dokumen/', 'Dokumen');
create trigger document_revisions_log after insert or update or delete on __APP__.document_revisions
  for each row execute function __APP__.log_changes('important', '/dokumen/revisi/', 'Revisi dokumen');
create trigger regulations_log after insert or update or delete on __APP__.regulations
  for each row execute function __APP__.log_changes('config', '/peraturan#', 'Peraturan');
create trigger regulation_evaluations_log after insert or update or delete on __APP__.regulation_evaluations
  for each row execute function __APP__.log_changes('important', '/peraturan#', 'Evaluasi peraturan');
create trigger ko_register_log after insert or update or delete on __APP__.ko_register
  for each row execute function __APP__.log_changes('important', '/ko#', 'Register KO');

-- cek scope company dokumen tanpa memicu RLS (hindari rekursi kebijakan dokumen <-> revisi)
create or replace function __APP__.document_in_scope(p_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from __APP__.controlled_documents d
                  where d.id = p_id and ('*' = any (__APP__.my_company_scope()::text[]) or d.company_code = any (__APP__.my_company_scope()::text[])));
$$;
revoke execute on function __APP__.document_in_scope(uuid) from public, anon;

-- =====================================================================================
-- RLS
--   dokumen: semua pengguna app dalam scope company boleh MEMBACA dokumen yang punya revisi terbit (distribusi sampai ke
--   karyawan); draf/review/ditolak hanya staf K3. Peraturan & KO: staf K3 (company + site).
-- =====================================================================================
create policy "controlled_documents: read" on __APP__.controlled_documents for select to authenticated
  using ((select public.has_app_role('__APP__', 'viewer'))
         and ('*' = any ((select __APP__.my_company_scope())::text[]) or company_code = any ((select __APP__.my_company_scope())::text[]))
         and ((select __APP__.k3_staff())
              or exists (select 1 from __APP__.document_revisions r where r.document_id = controlled_documents.id and r.status in ('approved', 'obsolete'))));
create policy "document_revisions: read" on __APP__.document_revisions for select to authenticated
  using ((select __APP__.document_in_scope(document_id))
         and ((select __APP__.k3_staff()) or status in ('approved', 'obsolete')));
create policy "document_acknowledgements: own or staff read" on __APP__.document_acknowledgements for select to authenticated
  using (user_id = (select auth.uid())
         or ((select __APP__.k3_staff()) and exists (select 1 from __APP__.document_revisions r where r.id = revision_id)));
create policy "regulations: staff read" on __APP__.regulations for select to authenticated
  using ((select __APP__.k3_staff())
         and ('*' = any ((select __APP__.my_company_scope())::text[]) or company_code = any ((select __APP__.my_company_scope())::text[])));
create policy "regulation_evaluations: staff read" on __APP__.regulation_evaluations for select to authenticated
  using ((select __APP__.k3_staff()) and exists (select 1 from __APP__.regulations g where g.id = regulation_id)
         and ('*' = any ((select __APP__.my_location_scope())::text[]) or location_id::text = any ((select __APP__.my_location_scope())::text[])));
create policy "ko_register: staff read" on __APP__.ko_register for select to authenticated
  using ((select __APP__.k3_staff())
         and ('*' = any ((select __APP__.my_company_scope())::text[]) or company_code = any ((select __APP__.my_company_scope())::text[]))
         and ('*' = any ((select __APP__.my_location_scope())::text[]) or location_id::text = any ((select __APP__.my_location_scope())::text[])));
create policy "controlled_documents_logs: read with record" on __APP__.controlled_documents_logs for select to authenticated
  using (exists (select 1 from __APP__.controlled_documents d where d.id = record_id) or (select public.has_app_role('__APP__', 'admin')));
create policy "document_revisions_logs: staff read" on __APP__.document_revisions_logs for select to authenticated
  using (((select __APP__.k3_staff()) and exists (select 1 from __APP__.document_revisions d where d.id = record_id)) or (select public.has_app_role('__APP__', 'admin')));
create policy "regulations_logs: read with record" on __APP__.regulations_logs for select to authenticated
  using (exists (select 1 from __APP__.regulations d where d.id = record_id) or (select public.has_app_role('__APP__', 'admin')));
create policy "regulation_evaluations_logs: read with record" on __APP__.regulation_evaluations_logs for select to authenticated
  using (exists (select 1 from __APP__.regulation_evaluations d where d.id = record_id) or (select public.has_app_role('__APP__', 'admin')));
create policy "ko_register_logs: read with record" on __APP__.ko_register_logs for select to authenticated
  using (exists (select 1 from __APP__.ko_register d where d.id = record_id) or (select public.has_app_role('__APP__', 'admin')));

-- =====================================================================================
-- RPC DOKUMEN
-- =====================================================================================

-- Dokumen baru + revisi 1 (draf). p: {company_code?, code, title, kind, owner_id?, review_months?, distribute_titles[], distribute_employees[], change_summary?}
-- Ubah (p_id): metadata saja (kode tetap).
create or replace function __APP__.document_save(p_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := p_id; v_rev uuid; v_company text; v_owner uuid := nullif(p ->> 'owner_id', '')::uuid;
  v_months smallint := coalesce(nullif(p ->> 'review_months', '')::smallint, 12);
  v_titles text[]; v_emps uuid[];
begin
  if not __APP__.document_manager() then raise exception 'Hanya HSE atau admin yang bisa mengelola dokumen.' using errcode = '42501'; end if;
  if length(btrim(coalesce(p ->> 'title', ''))) < 3 then raise exception 'Judul dokumen wajib diisi.' using errcode = 'P0001'; end if;
  if coalesce(p ->> 'kind', '') not in ('sop', 'ik', 'form') then raise exception 'Pilih jenis dokumen (SOP, IK, atau Form).' using errcode = 'P0001'; end if;
  if v_months not between 1 and 60 then raise exception 'Interval review 1 sampai 60 bulan.' using errcode = 'P0001'; end if;
  if v_owner is not null and not __APP__.k3_user_ok(v_owner) then raise exception 'Pemilik dokumen tidak valid.' using errcode = 'P0001'; end if;
  select coalesce(array_agg(distinct btrim(x)) filter (where length(btrim(x)) > 0), '{}') into v_titles from jsonb_array_elements_text(coalesce(p -> 'distribute_titles', '[]')) x;
  select coalesce(array_agg(distinct x::uuid), '{}') into v_emps from jsonb_array_elements_text(coalesce(p -> 'distribute_employees', '[]')) x;
  if v_id is null then
    v_company := __APP__.people_company(p);
    if not ('*' = any (__APP__.my_company_scope()::text[]) or v_company = any (__APP__.my_company_scope()::text[])) then
      raise exception 'Perusahaan di luar akses Anda.' using errcode = 'P0001';
    end if;
    if length(btrim(coalesce(p ->> 'code', ''))) < 3 then raise exception 'Kode dokumen wajib diisi (minimal 3 karakter).' using errcode = 'P0001'; end if;
    if exists (select 1 from __APP__.controlled_documents where company_code = v_company and lower(code) = lower(btrim(p ->> 'code'))) then
      raise exception 'Kode % sudah dipakai.', btrim(p ->> 'code') using errcode = 'P0001';
    end if;
    insert into __APP__.controlled_documents (company_code, code, title, kind, owner_id, review_months, distribute_titles, distribute_employees)
    values (v_company, btrim(p ->> 'code'), btrim(p ->> 'title'), p ->> 'kind', coalesce(v_owner, auth.uid()), v_months, v_titles, v_emps) returning id into v_id;
    insert into __APP__.document_revisions (document_id, rev_no, change_summary)
    values (v_id, 1, coalesce(nullif(btrim(p ->> 'change_summary'), ''), 'Penerbitan awal')) returning id into v_rev;
  else
    if not __APP__.document_in_scope(v_id) then raise exception 'Dokumen tidak ditemukan.' using errcode = 'P0001'; end if;
    update __APP__.controlled_documents set title = btrim(p ->> 'title'), kind = p ->> 'kind', owner_id = v_owner, review_months = v_months,
           distribute_titles = v_titles, distribute_employees = v_emps where id = v_id and is_active;
    if not found then raise exception 'Dokumen tidak ditemukan atau sudah ditarik.' using errcode = 'P0001'; end if;
    select id into v_rev from __APP__.document_revisions where document_id = v_id order by rev_no desc limit 1;
  end if;
  return jsonb_build_object('id', v_id, 'revision_id', v_rev);
end $$;

-- Mulai revisi baru (draf). Hanya bila tidak ada revisi terbuka dan dokumen masih aktif.
create or replace function __APP__.document_revision_start(p_doc uuid, p_summary text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_rev uuid; v_no integer;
begin
  if not __APP__.document_manager() then raise exception 'Hanya HSE atau admin yang bisa merevisi dokumen.' using errcode = '42501'; end if;
  if not __APP__.document_in_scope(p_doc) then raise exception 'Dokumen tidak ditemukan.' using errcode = 'P0001'; end if;
  if not exists (select 1 from __APP__.controlled_documents where id = p_doc and is_active) then raise exception 'Dokumen sudah ditarik.' using errcode = 'P0001'; end if;
  if length(btrim(coalesce(p_summary, ''))) < 5 then raise exception 'Ringkasan perubahan minimal 5 karakter.' using errcode = 'P0001'; end if;
  if exists (select 1 from __APP__.document_revisions where document_id = p_doc and status in ('draft', 'pending_approval', 'rejected')) then
    raise exception 'Masih ada revisi yang belum selesai untuk dokumen ini.' using errcode = 'P0001';
  end if;
  select coalesce(max(rev_no), 0) + 1 into v_no from __APP__.document_revisions where document_id = p_doc;
  insert into __APP__.document_revisions (document_id, rev_no, change_summary) values (p_doc, v_no, btrim(p_summary)) returning id into v_rev;
  return jsonb_build_object('revision_id', v_rev, 'rev_no', v_no);
end $$;

-- Ubah ringkasan revisi (draf/ditolak) sekaligus menghitung ulang file dari Storage dokumen/<revisi>/
create or replace function __APP__.document_revision_save(p_id uuid, p_summary text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r __APP__.document_revisions; v_n integer;
begin
  if not __APP__.document_manager() then raise exception 'Hanya HSE atau admin yang bisa mengubah revisi.' using errcode = '42501'; end if;
  select * into r from __APP__.document_revisions where id = p_id;
  if r.id is null or not __APP__.document_in_scope(r.document_id) then raise exception 'Revisi tidak ditemukan.' using errcode = 'P0001'; end if;
  if r.status not in ('draft', 'rejected') then raise exception 'Revisi ini tidak bisa diubah lagi.' using errcode = 'P0001'; end if;
  if length(btrim(coalesce(p_summary, ''))) < 5 then raise exception 'Ringkasan perubahan minimal 5 karakter.' using errcode = 'P0001'; end if;
  v_n := __APP__.tsp_count_files('dokumen/' || p_id || '/');
  update __APP__.document_revisions set change_summary = btrim(p_summary), evidence_count = v_n where id = p_id;
  return jsonb_build_object('evidence_count', v_n);
end $$;

-- Tarik dokumen (obsolete): alasan >= 10 karakter. Revisi terbit menjadi obsolete.
create or replace function __APP__.document_withdraw(p_doc uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_n integer;
begin
  if not __APP__.document_manager() then raise exception 'Hanya HSE atau admin yang bisa menarik dokumen.' using errcode = '42501'; end if;
  if not __APP__.document_in_scope(p_doc) then raise exception 'Dokumen tidak ditemukan.' using errcode = 'P0001'; end if;
  if length(btrim(coalesce(p_reason, ''))) < 10 then raise exception 'Alasan penarikan minimal 10 karakter.' using errcode = 'P0001'; end if;
  if exists (select 1 from __APP__.document_revisions where document_id = p_doc and status = 'pending_approval') then
    raise exception 'Tarik pengajuan revisi yang sedang berjalan lebih dulu.' using errcode = 'P0001';
  end if;
  perform __APP__.set_log_context('withdraw', btrim(p_reason));
  update __APP__.controlled_documents set is_active = false, withdraw_reason = btrim(p_reason) where id = p_doc and is_active;
  get diagnostics v_n = row_count;
  perform __APP__.set_log_context('', '');
  if v_n = 0 then raise exception 'Dokumen sudah ditarik.' using errcode = 'P0001'; end if;
  update __APP__.document_revisions set status = 'obsolete' where document_id = p_doc and status = 'approved';
  delete from __APP__.document_revisions where document_id = p_doc and status in ('draft', 'rejected');
end $$;

-- Pengakuan "sudah membaca" oleh pengguna itu sendiri (hanya revisi terbit)
create or replace function __APP__.document_acknowledge(p_revision uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from __APP__.document_revisions where id = p_revision and status = 'approved') then
    raise exception 'Revisi ini sudah tidak berlaku atau belum terbit.' using errcode = 'P0001';
  end if;
  update __APP__.document_acknowledgements set acknowledged_at = coalesce(acknowledged_at, now())
   where revision_id = p_revision and user_id = auth.uid();
  if not found then raise exception 'Dokumen ini tidak ditujukan kepada Anda.' using errcode = 'P0001'; end if;
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function __APP__.document_save(uuid, jsonb), __APP__.document_revision_start(uuid, text), __APP__.document_revision_save(uuid, text),
  __APP__.document_withdraw(uuid, text), __APP__.document_acknowledge(uuid) from public, anon;

-- =====================================================================================
-- HOOK APPROVAL (doc_type 'document_revision')
-- =====================================================================================
create or replace function __APP__.document_revision_context(p_id uuid)
returns __APP__.approval_context language sql stable security definer set search_path = '' as $$
  select r.created_by, d.company_code, null::uuid, 0::numeric, d.code || ' Rev ' || r.rev_no, r.status
    from __APP__.document_revisions r join __APP__.controlled_documents d on d.id = r.document_id where r.id = p_id;
$$;

create or replace function __APP__.document_revision_on_approval(p_id uuid, p_outcome text)
returns void language plpgsql security definer set search_path = '' as $$
declare r __APP__.document_revisions; d __APP__.controlled_documents; v_n integer; v_users uuid[];
begin
  select * into r from __APP__.document_revisions where id = p_id for update;
  select * into d from __APP__.controlled_documents where id = r.document_id;
  if p_outcome = 'submitted' then
    v_n := __APP__.tsp_count_files('dokumen/' || p_id || '/');
    if v_n < 1 then raise exception 'Unggah file dokumen (PDF) sebelum mengajukan revisi.' using errcode = 'P0001'; end if;
    update __APP__.document_revisions set status = 'pending_approval', evidence_count = v_n where id = p_id;
  elsif p_outcome = 'approved' then
    update __APP__.document_revisions set status = 'obsolete' where document_id = r.document_id and status = 'approved' and id <> p_id;
    update __APP__.document_revisions
       set status = 'approved', effective_on = __APP__.today_wib(),
           review_due_on = (__APP__.today_wib() + make_interval(months => d.review_months))::date
     where id = p_id;
    insert into __APP__.document_acknowledgements (revision_id, user_id, employee_id)
    select p_id, e.profile_id, e.id from __APP__.employees e
     where e.status = 'active' and e.profile_id is not null and e.company_code = d.company_code
       and (e.job_title = any (d.distribute_titles) or e.id = any (d.distribute_employees))
    on conflict do nothing;
    select coalesce(array_agg(user_id), '{}') into v_users from __APP__.document_acknowledgements where revision_id = p_id;
    perform __APP__.notify(v_users, 'document_ack', 'Baca dokumen: ' || d.code || ' Rev ' || r.rev_no, d.title, '/dokumen/' || d.id, 'dokumen', 'document_revisions', p_id::text);
  elsif p_outcome = 'rejected' then
    update __APP__.document_revisions set status = 'rejected' where id = p_id;
  elsif p_outcome = 'cancelled' then
    update __APP__.document_revisions set status = 'draft' where id = p_id;
  end if;
end $$;
revoke execute on function __APP__.document_revision_context(uuid), __APP__.document_revision_on_approval(uuid, text) from public, anon, authenticated;

insert into __APP__.approval_doc_types (code, label, table_name, href_prefix, context_fn, on_done_fn)
values ('document_revision', 'Revisi Dokumen', 'document_revisions', '/dokumen/revisi/',
        '__APP__.document_revision_context(uuid)', '__APP__.document_revision_on_approval(uuid,text)')
on conflict (code) do nothing;

-- =====================================================================================
-- BACA (invoker: ikut RLS)
-- =====================================================================================
create or replace function __APP__.document_overview()
returns table (document_id uuid, current_id uuid, current_rev integer, effective_on date, review_due_on date,
               open_id uuid, open_rev integer, open_status text, ack_total integer, ack_done integer, my_ack_pending boolean)
language sql stable security invoker set search_path = '' as $$
  select d.id, cur.id, cur.rev_no, cur.effective_on, cur.review_due_on, opn.id, opn.rev_no, opn.status,
         coalesce(a.total, 0)::integer, coalesce(a.done, 0)::integer,
         exists (select 1 from __APP__.document_acknowledgements m where m.revision_id = cur.id and m.user_id = auth.uid() and m.acknowledged_at is null)
    from __APP__.controlled_documents d
    left join lateral (select r.id, r.rev_no, r.effective_on, r.review_due_on from __APP__.document_revisions r where r.document_id = d.id and r.status = 'approved') cur on true
    left join lateral (select r.id, r.rev_no, r.status from __APP__.document_revisions r where r.document_id = d.id and r.status in ('draft', 'pending_approval', 'rejected')) opn on true
    left join lateral (select count(*) total, count(*) filter (where x.acknowledged_at is not null) done
                         from __APP__.document_acknowledgements x where x.revision_id = cur.id) a on true;
$$;

-- Kepatuhan dokumen (KPI turunan): pengakuan baca + review tepat waktu, hanya dokumen aktif ber-revisi terbit
create or replace function __APP__.document_compliance()
returns table (docs_total integer, review_ok integer, ack_total integer, ack_done integer)
language sql stable security invoker set search_path = '' as $$
  select count(*)::integer,
         count(*) filter (where o.review_due_on >= __APP__.today_wib())::integer,
         coalesce(sum(o.ack_total), 0)::integer, coalesce(sum(o.ack_done), 0)::integer
    from __APP__.document_overview() o join __APP__.controlled_documents d on d.id = o.document_id
   where d.is_active and o.current_id is not null;
$$;
revoke execute on function __APP__.document_overview(), __APP__.document_compliance() from public, anon;

insert into __APP__.kpi_definitions (code, name, definition, formula, rule_text, example, source, owner, unit, direction, thresholds, sort_order) values
  ('document_compliance', 'Kepatuhan Dokumen', 'Gabungan pengakuan baca dokumen terbit dan review dokumen yang tepat waktu.',
   '(pengakuan selesai ÷ pengakuan diminta + dokumen aktif belum lewat jadwal review ÷ dokumen aktif) ÷ 2 × 100',
   'Hanya dokumen aktif dengan revisi terbit. Pengakuan = karyawan berakun pada jabatan/orang tujuan distribusi. Bobot kedua komponen sama (usulan, belum disahkan).',
   '18 dari 20 pengakuan + 7 dari 8 dokumen tepat review → 89%.', 'Dokumen', 'HSE', '%', 'higher_better', null, 110)
on conflict (code) do nothing;

-- =====================================================================================
-- RPC PERATURAN & KO
-- =====================================================================================
-- p: {company_code?, code, title, issuer?, issued_on?, is_active?}
create or replace function __APP__.regulation_save(p_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := p_id; v_company text;
begin
  if not __APP__.document_manager() then raise exception 'Hanya HSE atau admin yang bisa mengelola peraturan.' using errcode = '42501'; end if;
  if length(btrim(coalesce(p ->> 'code', ''))) < 3 or length(btrim(coalesce(p ->> 'title', ''))) < 3 then raise exception 'Nomor dan judul peraturan wajib diisi.' using errcode = 'P0001'; end if;
  if v_id is null then
    v_company := __APP__.people_company(p);
    if not ('*' = any (__APP__.my_company_scope()::text[]) or v_company = any (__APP__.my_company_scope()::text[])) then raise exception 'Perusahaan di luar akses Anda.' using errcode = 'P0001'; end if;
    if exists (select 1 from __APP__.regulations where company_code = v_company and lower(code) = lower(btrim(p ->> 'code'))) then raise exception 'Peraturan % sudah terdaftar.', btrim(p ->> 'code') using errcode = 'P0001'; end if;
    insert into __APP__.regulations (company_code, code, title, issuer, issued_on) values (v_company, btrim(p ->> 'code'), btrim(p ->> 'title'),
      nullif(btrim(p ->> 'issuer'), ''), nullif(p ->> 'issued_on', '')::date) returning id into v_id;
  else
    update __APP__.regulations set title = btrim(p ->> 'title'), issuer = nullif(btrim(p ->> 'issuer'), ''), issued_on = nullif(p ->> 'issued_on', '')::date,
           is_active = coalesce((p ->> 'is_active')::boolean, is_active)
     where id = v_id and ('*' = any (__APP__.my_company_scope()::text[]) or company_code = any (__APP__.my_company_scope()::text[]));
    if not found then raise exception 'Peraturan tidak ditemukan.' using errcode = 'P0001'; end if;
  end if;
  return jsonb_build_object('id', v_id);
end $$;

-- p: {regulation_id, location_id, clause, requirement, compliance, evaluated_on, follow_up?, next_review_on?}
create or replace function __APP__.regulation_evaluation_save(p_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := p_id; v_reg uuid := nullif(p ->> 'regulation_id', '')::uuid; v_loc uuid := nullif(p ->> 'location_id', '')::uuid; v_company text; v_on date := nullif(p ->> 'evaluated_on', '')::date;
begin
  if not __APP__.document_manager() then raise exception 'Hanya HSE atau admin yang bisa mengevaluasi peraturan.' using errcode = '42501'; end if;
  select company_code into v_company from __APP__.regulations where id = v_reg;
  if v_company is null or not ('*' = any (__APP__.my_company_scope()::text[]) or v_company = any (__APP__.my_company_scope()::text[])) then raise exception 'Peraturan tidak ditemukan.' using errcode = 'P0001'; end if;
  if v_loc is null or not __APP__.k3_in_scope(v_company, v_loc) then raise exception 'Site tidak valid atau di luar akses Anda.' using errcode = 'P0001'; end if;
  if length(btrim(coalesce(p ->> 'clause', ''))) < 1 or length(btrim(coalesce(p ->> 'requirement', ''))) < 3 then raise exception 'Pasal dan persyaratan wajib diisi.' using errcode = 'P0001'; end if;
  if coalesce(p ->> 'compliance', '') not in ('compliant', 'partial', 'non_compliant', 'na') then raise exception 'Pilih tingkat kesesuaian.' using errcode = 'P0001'; end if;
  if v_on is null or v_on > __APP__.today_wib() then raise exception 'Tanggal evaluasi tidak valid (tidak boleh di masa depan).' using errcode = 'P0001'; end if;
  if (p ->> 'compliance') in ('partial', 'non_compliant') and length(btrim(coalesce(p ->> 'follow_up', ''))) < 5 then
    raise exception 'Tindak lanjut wajib diisi untuk hasil Sebagian atau Tidak Sesuai.' using errcode = 'P0001';
  end if;
  if nullif(p ->> 'next_review_on', '') is not null and (p ->> 'next_review_on')::date < v_on then raise exception 'Jadwal evaluasi berikutnya tidak boleh sebelum tanggal evaluasi.' using errcode = 'P0001'; end if;
  if v_id is null then
    insert into __APP__.regulation_evaluations (regulation_id, location_id, clause, requirement, compliance, evaluated_on, follow_up, next_review_on)
    values (v_reg, v_loc, btrim(p ->> 'clause'), btrim(p ->> 'requirement'), p ->> 'compliance', v_on, nullif(btrim(p ->> 'follow_up'), ''), nullif(p ->> 'next_review_on', '')::date)
    returning id into v_id;
  else
    update __APP__.regulation_evaluations set location_id = v_loc, clause = btrim(p ->> 'clause'), requirement = btrim(p ->> 'requirement'), compliance = p ->> 'compliance',
           evaluated_on = v_on, follow_up = nullif(btrim(p ->> 'follow_up'), ''), next_review_on = nullif(p ->> 'next_review_on', '')::date
     where id = v_id and regulation_id = v_reg;
    if not found then raise exception 'Evaluasi tidak ditemukan.' using errcode = 'P0001'; end if;
  end if;
  return jsonb_build_object('id', v_id);
end $$;

-- Jadikan temuan (tindak lanjut ketidaksesuaian). p: {area_id, pic_id, due_date, risk_level}. Sekali per evaluasi.
create or replace function __APP__.regulation_make_finding(p_eval uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare e __APP__.regulation_evaluations; g __APP__.regulations; v_area uuid := nullif(p ->> 'area_id', '')::uuid; v_pic uuid := nullif(p ->> 'pic_id', '')::uuid;
        v_due date := nullif(p ->> 'due_date', '')::date; v_new record;
begin
  if not (__APP__.document_manager() and __APP__.has_any_function(array['hse', 'hse_senior']) or public.has_app_role('__APP__', 'admin')) then
    raise exception 'Hanya HSE atau admin yang bisa menjadikan evaluasi sebagai temuan.' using errcode = '42501';
  end if;
  select * into e from __APP__.regulation_evaluations where id = p_eval;
  select * into g from __APP__.regulations where id = e.regulation_id;
  if e.id is null or not __APP__.k3_in_scope(g.company_code, e.location_id) then raise exception 'Evaluasi tidak ditemukan.' using errcode = 'P0001'; end if;
  if e.finding_id is not null then raise exception 'Evaluasi ini sudah dijadikan temuan.' using errcode = 'P0001'; end if;
  if e.compliance not in ('partial', 'non_compliant') then raise exception 'Hanya evaluasi Sebagian atau Tidak Sesuai yang bisa dijadikan temuan.' using errcode = 'P0001'; end if;
  if v_area is null or not exists (select 1 from __APP__.areas a where a.id = v_area and a.location_id = e.location_id and a.is_active) then raise exception 'Pilih area di site evaluasi.' using errcode = 'P0001'; end if;
  if v_pic is null or not __APP__.k3_user_ok(v_pic) then raise exception 'Pilih PIC yang valid.' using errcode = 'P0001'; end if;
  if v_due is null or v_due < __APP__.today_wib() then raise exception 'Tenggat tidak boleh di masa lalu.' using errcode = 'P0001'; end if;
  if not __APP__.k3_master_ok('risk_level', coalesce(p ->> 'risk_level', '')) then raise exception 'Pilih tingkat risiko.' using errcode = 'P0001'; end if;
  select * into v_new from __APP__.k3_finding_insert(auth.uid(), g.company_code, e.location_id, v_area, null, now(),
    'Ketidaksesuaian ' || g.code || ' ' || e.clause, e.requirement || E'\n\nTindak lanjut: ' || coalesce(e.follow_up, '-'),
    'audit', left(g.code || ' ' || e.clause, 60), 'documents', p ->> 'risk_level', v_pic, v_due);
  update __APP__.regulation_evaluations set finding_id = v_new.id where id = p_eval;
  return jsonb_build_object('finding_id', v_new.id, 'code', v_new.code);
end $$;

-- p: {company_code?, location_id, title, kind, number?, owner_id?, valid_until, is_active?, notes?}
create or replace function __APP__.ko_save(p_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := p_id; v_company text; v_loc uuid := nullif(p ->> 'location_id', '')::uuid; v_owner uuid := nullif(p ->> 'owner_id', '')::uuid; v_code text; v_ev integer := 0;
begin
  if not __APP__.document_manager() then raise exception 'Hanya HSE atau admin yang bisa mengelola register KO.' using errcode = '42501'; end if;
  v_company := __APP__.people_company(p);
  if v_loc is null or not __APP__.k3_in_scope(v_company, v_loc) then raise exception 'Site tidak valid atau di luar akses Anda.' using errcode = 'P0001'; end if;
  if length(btrim(coalesce(p ->> 'title', ''))) < 3 then raise exception 'Judul wajib diisi.' using errcode = 'P0001'; end if;
  if coalesce(p ->> 'kind', '') not in ('izin_operasi', 'sertifikasi_alat', 'sarana_prasarana', 'dokumen_teknis') then raise exception 'Pilih jenis item KO.' using errcode = 'P0001'; end if;
  if nullif(p ->> 'valid_until', '') is null then raise exception 'Masa berlaku wajib diisi.' using errcode = 'P0001'; end if;
  if v_owner is not null and not __APP__.k3_user_ok(v_owner) then raise exception 'Penanggung jawab tidak valid.' using errcode = 'P0001'; end if;
  if v_id is null then
    v_code := __APP__.next_doc_number('KO', v_company, 'year');
    insert into __APP__.ko_register (company_code, location_id, code, title, kind, number, owner_id, valid_until, notes)
    values (v_company, v_loc, v_code, btrim(p ->> 'title'), p ->> 'kind', nullif(btrim(p ->> 'number'), ''), v_owner, (p ->> 'valid_until')::date, nullif(btrim(p ->> 'notes'), ''))
    returning id into v_id;
  else
    v_ev := __APP__.tsp_count_files('ko/' || v_id || '/');
    update __APP__.ko_register set location_id = v_loc, title = btrim(p ->> 'title'), kind = p ->> 'kind', number = nullif(btrim(p ->> 'number'), ''), owner_id = v_owner,
           valid_until = (p ->> 'valid_until')::date, is_active = coalesce((p ->> 'is_active')::boolean, is_active), notes = nullif(btrim(p ->> 'notes'), ''), evidence_count = v_ev
     where id = v_id and company_code = v_company and __APP__.k3_in_scope(company_code, location_id);
    if not found then raise exception 'Item KO tidak ditemukan.' using errcode = 'P0001'; end if;
  end if;
  return jsonb_build_object('id', v_id);
end $$;

-- Hitung ulang bukti dari Storage. p_kind: 'dokumen' (revisi) | 'ko'
create or replace function __APP__.dokumen_sync_evidence(p_kind text, p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_n integer;
begin
  if not __APP__.document_manager() then raise exception 'Hanya HSE atau admin yang bisa memperbarui file.' using errcode = '42501'; end if;
  v_n := __APP__.tsp_count_files(p_kind || '/' || p_id || '/');
  if p_kind = 'dokumen' then
    update __APP__.document_revisions set evidence_count = v_n
     where id = p_id and status in ('draft', 'rejected') and __APP__.document_in_scope(document_id);
  elsif p_kind = 'ko' then
    update __APP__.ko_register set evidence_count = v_n where id = p_id and __APP__.k3_in_scope(company_code, location_id);
  else
    raise exception 'Jenis file tidak dikenal.' using errcode = 'P0001';
  end if;
  if not found then raise exception 'Data tidak ditemukan atau tidak bisa diubah.' using errcode = 'P0001'; end if;
  return jsonb_build_object('evidence_count', v_n);
end $$;
revoke execute on function __APP__.regulation_save(uuid, jsonb), __APP__.regulation_evaluation_save(uuid, jsonb), __APP__.regulation_make_finding(uuid, jsonb),
  __APP__.ko_save(uuid, jsonb), __APP__.dokumen_sync_evidence(text, uuid) from public, anon;

-- =====================================================================================
-- STORAGE: policy lampiran + dokumen/ ko/
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
      when 'dokumen'  then exists (select 1 from __APP__.document_revisions r where r.id::text = (storage.foldername(name))[2])
      when 'ko'       then exists (select 1 from __APP__.ko_register k where k.id::text = (storage.foldername(name))[2])
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
      -- file revisi: HSE/admin pada revisi yang masih bisa diubah (draf / ditolak)
      when 'dokumen'  then (select __APP__.document_manager()) and exists (select 1 from __APP__.document_revisions r where r.id::text = (storage.foldername(name))[2] and r.status in ('draft', 'rejected'))
      when 'ko'       then (select __APP__.document_manager()) and exists (select 1 from __APP__.ko_register k where k.id::text = (storage.foldername(name))[2])
      else (select public.has_app_role('__APP__', 'editor'))
    end));
