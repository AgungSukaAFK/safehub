-- =====================================================================================
-- 21 IMPOR DATA + PENGINGAT KEDALUWARSA (Safe Hub, fase 4 - bagian E)
--   rancangan-implementasi §2.12 (impor), §4.12 (pengingat) · spesifikasi docs/spec/fase-4-people-kontraktor-dokumen.md (V-series E1-E8)
--
-- 1) Pengingat kedaluwarsa: jenis baru di reminder_rules (MCU, sertifikat, permit site, izin kontraktor, review dokumen, KO)
--    + run_expiry_reminders(). run_reminders (14) di-wrap supaya run_maintenance memanggil keduanya tanpa didefinisikan ulang.
-- 2) Impor Data: import_jobs + import_commit (satu RPC batch; tiap baris di sub-transaksi, baris gagal tidak
--    menggagalkan baris lain). Validasi bentuk di aplikasi (zod); DB memvalidasi ulang lewat RPC simpan yang sudah ada.
-- =====================================================================================

-- ---------------------------------------------------------------- 1. jenis pengingat baru
alter table __APP__.reminder_rules drop constraint reminder_rules_kind_check;
alter table __APP__.reminder_rules add constraint reminder_rules_kind_check check (kind in (
  'pica_due', 'inspection_due', 'tsp_evaluation',
  'mcu_expiry', 'certificate_expiry', 'permit_expiry', 'contractor_permit_expiry', 'document_review', 'ko_expiry'));

insert into __APP__.reminder_rules (kind, name, offsets, notify_assignee, notify_functions) values
  ('mcu_expiry', 'MCU akan berakhir', '{30,14,7}', true, '{hr}'),
  ('certificate_expiry', 'Sertifikat kompetensi akan berakhir', '{30,14,7}', true, '{hr}'),
  ('permit_expiry', 'Permit site akan berakhir', '{14,7,1}', true, '{hr}'),
  ('contractor_permit_expiry', 'Izin kontraktor akan berakhir', '{30,14,7}', false, '{kontraktor_admin}'),
  ('document_review', 'Jadwal review dokumen mendekat', '{30,14,7}', true, '{hse}'),
  ('ko_expiry', 'Item Register KO akan berakhir', '{30,14,7}', true, '{hse}')
on conflict (kind) do nothing;

-- Penerima: penanggung jawab (bila diminta) + fungsi pilihan. Idempoten lewat reminder_sent (rule, ref, offset, jatuh tempo).
create or replace function __APP__.run_expiry_reminders(p_today date default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_today date := coalesce(p_today, __APP__.today_wib());
  rule __APP__.reminder_rules; o integer; r record; v_to uuid[]; v_n integer; v_count integer; v_res jsonb := '{}'; v_when text;
begin
  for rule in select * from __APP__.reminder_rules
               where is_active and kind in ('mcu_expiry', 'certificate_expiry', 'permit_expiry', 'contractor_permit_expiry', 'document_review', 'ko_expiry') loop
    v_count := 0;
    foreach o in array rule.offsets loop
      v_when := case o when 0 then 'berakhir hari ini' when 1 then 'berakhir besok' else format('berakhir %s hari lagi', o) end;

      if rule.kind = 'mcu_expiry' then
        for r in select m.id, m.valid_until as due, e.id as emp_id, e.name, e.company_code, e.location_id, e.profile_id
                   from __APP__.mcu_records m join __APP__.employees e on e.id = m.employee_id
                  where e.status = 'active' and m.valid_until = v_today + o
                    and not exists (select 1 from __APP__.mcu_records n where n.employee_id = m.employee_id and n.valid_until > m.valid_until) loop
          insert into __APP__.reminder_sent (rule_id, ref_id, offset_days, due_on) values (rule.id, r.id, o, r.due) on conflict do nothing;
          get diagnostics v_n = row_count; if v_n = 0 then continue; end if;
          v_to := (case when rule.notify_assignee and r.profile_id is not null then array[r.profile_id] else '{}'::uuid[] end)
                  || __APP__.users_with_function(rule.notify_functions, r.company_code, r.location_id);
          perform __APP__.notify(v_to, 'reminder.mcu_expiry', format('MCU %s %s', r.name, v_when), 'Jadwalkan MCU ulang sebelum berakhir.',
                                 '/manpower/' || r.emp_id || '?tab=mcu', 'compliance', 'mcu_records', r.id::text);
          v_count := v_count + 1;
        end loop;

      elsif rule.kind = 'certificate_expiry' then
        for r in select c.id, c.valid_until as due, e.id as emp_id, e.name, e.company_code, e.location_id, e.profile_id, k.name as comp
                   from __APP__.certificates c join __APP__.employees e on e.id = c.employee_id join __APP__.competencies k on k.id = c.competency_id
                  where e.status = 'active' and k.is_active and c.valid_until = v_today + o
                    and not exists (select 1 from __APP__.certificates n where n.employee_id = c.employee_id and n.competency_id = c.competency_id
                                      and (n.valid_until is null or n.valid_until > c.valid_until)) loop
          insert into __APP__.reminder_sent (rule_id, ref_id, offset_days, due_on) values (rule.id, r.id, o, r.due) on conflict do nothing;
          get diagnostics v_n = row_count; if v_n = 0 then continue; end if;
          v_to := (case when rule.notify_assignee and r.profile_id is not null then array[r.profile_id] else '{}'::uuid[] end)
                  || __APP__.users_with_function(rule.notify_functions, r.company_code, r.location_id);
          perform __APP__.notify(v_to, 'reminder.certificate_expiry', format('Sertifikat %s (%s) %s', r.comp, r.name, v_when), 'Siapkan pelatihan atau perpanjangan sertifikat.',
                                 '/manpower/' || r.emp_id || '?tab=kompetensi', 'compliance', 'certificates', r.id::text);
          v_count := v_count + 1;
        end loop;

      elsif rule.kind = 'permit_expiry' then
        for r in select p.id, p.valid_until as due, p.name as permit, e.id as emp_id, e.name, e.company_code, e.location_id, e.profile_id
                   from __APP__.site_permits p join __APP__.employees e on e.id = p.employee_id
                  where e.status = 'active' and p.valid_until = v_today + o
                    and not exists (select 1 from __APP__.site_permits n where n.employee_id = p.employee_id and n.name = p.name and n.valid_until > p.valid_until) loop
          insert into __APP__.reminder_sent (rule_id, ref_id, offset_days, due_on) values (rule.id, r.id, o, r.due) on conflict do nothing;
          get diagnostics v_n = row_count; if v_n = 0 then continue; end if;
          v_to := (case when rule.notify_assignee and r.profile_id is not null then array[r.profile_id] else '{}'::uuid[] end)
                  || __APP__.users_with_function(rule.notify_functions, r.company_code, r.location_id);
          perform __APP__.notify(v_to, 'reminder.permit_expiry', format('%s %s %s', r.permit, r.name, v_when), 'Perpanjang permit site.',
                                 '/manpower/' || r.emp_id || '?tab=permit', 'compliance', 'site_permits', r.id::text);
          v_count := v_count + 1;
        end loop;

      elsif rule.kind = 'contractor_permit_expiry' then
        for r in select p.id, p.valid_until as due, p.name as permit, c.id as con_id, c.name, c.company_code
                   from __APP__.contractor_permits p join __APP__.contractors c on c.id = p.contractor_id
                  where c.is_active and p.valid_until = v_today + o
                    and not exists (select 1 from __APP__.contractor_permits n where n.contractor_id = p.contractor_id and n.name = p.name and n.valid_until > p.valid_until) loop
          insert into __APP__.reminder_sent (rule_id, ref_id, offset_days, due_on) values (rule.id, r.id, o, r.due) on conflict do nothing;
          get diagnostics v_n = row_count; if v_n = 0 then continue; end if;
          v_to := __APP__.users_with_function(case when cardinality(rule.notify_functions) > 0 then rule.notify_functions else array['kontraktor_admin'] end, r.company_code, null);
          perform __APP__.notify(v_to, 'reminder.contractor_permit_expiry', format('Izin %s %s %s', r.permit, r.name, v_when), 'Minta mitra memperpanjang izin dan unggah buktinya.',
                                 '/kontraktor/' || r.con_id || '?tab=izin', 'compliance', 'contractor_permits', r.id::text);
          v_count := v_count + 1;
        end loop;

      elsif rule.kind = 'document_review' then
        for r in select v.id, v.review_due_on as due, d.id as doc_id, d.code, d.title, d.company_code, d.owner_id
                   from __APP__.document_revisions v join __APP__.controlled_documents d on d.id = v.document_id
                  where v.status = 'approved' and d.is_active and v.review_due_on = v_today + o loop
          insert into __APP__.reminder_sent (rule_id, ref_id, offset_days, due_on) values (rule.id, r.id, o, r.due) on conflict do nothing;
          get diagnostics v_n = row_count; if v_n = 0 then continue; end if;
          v_to := (case when rule.notify_assignee and r.owner_id is not null then array[r.owner_id] else '{}'::uuid[] end)
                  || __APP__.users_with_function(rule.notify_functions, r.company_code, null);
          perform __APP__.notify(v_to, 'reminder.document_review', format('Review dokumen %s jatuh tempo %s', r.code, case o when 0 then 'hari ini' when 1 then 'besok' else format('%s hari lagi', o) end),
                                 left(r.title, 200), '/dokumen/' || r.doc_id, 'dokumen', 'controlled_documents', r.doc_id::text);
          v_count := v_count + 1;
        end loop;

      elsif rule.kind = 'ko_expiry' then
        for r in select k.id, k.valid_until as due, k.code, k.title, k.company_code, k.location_id, k.owner_id
                   from __APP__.ko_register k where k.is_active and k.valid_until = v_today + o loop
          insert into __APP__.reminder_sent (rule_id, ref_id, offset_days, due_on) values (rule.id, r.id, o, r.due) on conflict do nothing;
          get diagnostics v_n = row_count; if v_n = 0 then continue; end if;
          v_to := (case when rule.notify_assignee and r.owner_id is not null then array[r.owner_id] else '{}'::uuid[] end)
                  || __APP__.users_with_function(rule.notify_functions, r.company_code, r.location_id);
          perform __APP__.notify(v_to, 'reminder.ko_expiry', format('%s %s', r.code, v_when), left(r.title, 200), '/ko', 'compliance', 'ko_register', r.id::text);
          v_count := v_count + 1;
        end loop;
      end if;
    end loop;
    v_res := v_res || jsonb_build_object(rule.kind, v_count);
  end loop;
  return v_res;
end $$;
revoke execute on function __APP__.run_expiry_reminders(date) from public, anon, authenticated;

-- run_reminders (14) menjadi inti; pembungkus baru memanggil inti + pengingat kedaluwarsa (run_maintenance tidak berubah)
alter function __APP__.run_reminders(date) rename to run_reminders_core;
create or replace function __APP__.run_reminders(p_today date default null)
returns jsonb language sql security definer set search_path = '' as $$
  select __APP__.run_reminders_core(p_today) || __APP__.run_expiry_reminders(p_today);
$$;
revoke execute on function __APP__.run_reminders(date), __APP__.run_reminders_core(date) from public, anon, authenticated;

-- ---------------------------------------------------------------- 2. impor data
create table __APP__.import_jobs (
  id            uuid primary key default gen_random_uuid(),
  target        text not null check (target in ('employees', 'certificates', 'mcu', 'site_permits')),
  mode          text not null check (mode in ('insert', 'upsert')),
  filename      text check (length(filename) <= 200),
  location_id   uuid references public.locations(id) on delete set null,
  total         integer not null check (total >= 0),
  ok_count      integer not null check (ok_count >= 0),
  failed_count  integer not null check (failed_count >= 0),
  errors        jsonb not null default '[]'::jsonb,        -- maks. 100 pertama: [{row, message}]
  created_by    uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now()
);
create index import_jobs_idx on __APP__.import_jobs (created_by, created_at desc);
alter table __APP__.import_jobs enable row level security;
revoke insert, update, delete on __APP__.import_jobs from authenticated, anon;
create policy "import_jobs: own or admin read" on __APP__.import_jobs for select to authenticated
  using (created_by = (select auth.uid()) or (select public.has_app_role('__APP__', 'admin')));

-- NIK -> id karyawan (company yang sama); error berbahasa Indonesia bila tidak ada
create or replace function __APP__.import_employee_id(p_company text, p_nik text)
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v uuid;
begin
  if length(btrim(coalesce(p_nik, ''))) = 0 then raise exception 'NIK kosong.' using errcode = 'P0001'; end if;
  select id into v from __APP__.employees where company_code = p_company and code = btrim(p_nik);
  if v is null then raise exception 'NIK % tidak ditemukan.', btrim(p_nik) using errcode = 'P0001'; end if;
  return v;
end $$;
revoke execute on function __APP__.import_employee_id(text, text) from public, anon, authenticated;

-- Satu baris. d memakai kunci alami (nik, kompetensi, ...), bukan id. Memanggil RPC simpan yang sudah ada,
-- jadi semua aturan (scope, tanggal, hak) tetap berlaku.
create or replace function __APP__.import_row(p_target text, p_mode text, d jsonb, p_location uuid, p_company text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_emp uuid; v_id uuid; v_comp uuid; v_con uuid; e __APP__.employees; v_num text; v_dx text; v_note text;
begin
  if p_target = 'employees' then
    select * into e from __APP__.employees where company_code = p_company and code = btrim(coalesce(d ->> 'nik', ''));
    if e.id is not null and p_mode = 'insert' then raise exception 'NIK % sudah ada (mode Tambah baru).', e.code using errcode = 'P0001'; end if;
    if length(btrim(coalesce(d ->> 'mitra', ''))) > 0 then
      select id into v_con from __APP__.contractors where company_code = p_company and lower(name) = lower(btrim(d ->> 'mitra'));
      if v_con is null then raise exception 'Mitra "%" tidak ditemukan.', btrim(d ->> 'mitra') using errcode = 'P0001'; end if;
    end if;
    perform __APP__.employee_save(e.id, jsonb_build_object(
      'company_code', p_company, 'location_id', p_location, 'code', d ->> 'nik', 'name', d ->> 'nama', 'job_title', d ->> 'jabatan',
      'department', coalesce(nullif(d ->> 'section', ''), e.department), 'employment', coalesce(nullif(d ->> 'hubungan_kerja', ''), e.employment, 'PKWTT'),
      'join_date', coalesce(nullif(d ->> 'tanggal_mulai', ''), e.join_date::text), 'status', coalesce(nullif(d ->> 'status', ''), e.status, 'active'),
      'contractor_id', coalesce(v_con, e.contractor_id), 'profile_id', e.profile_id));

  elsif p_target = 'certificates' then
    v_emp := __APP__.import_employee_id(p_company, d ->> 'nik');
    select id into v_comp from __APP__.competencies
     where is_active and (code = lower(btrim(coalesce(d ->> 'kompetensi', ''))) or lower(name) = lower(btrim(coalesce(d ->> 'kompetensi', ''))));
    if v_comp is null then raise exception 'Kompetensi "%" tidak ditemukan.', coalesce(d ->> 'kompetensi', '') using errcode = 'P0001'; end if;
    v_num := nullif(btrim(coalesce(d ->> 'nomor', '')), '');
    select id into v_id from __APP__.certificates where employee_id = v_emp and competency_id = v_comp and number is not distinct from v_num;
    if v_id is not null and p_mode = 'insert' then raise exception 'Sertifikat dengan nomor yang sama sudah ada (mode Tambah baru).' using errcode = 'P0001'; end if;
    perform __APP__.certificate_save(v_id, jsonb_build_object('employee_id', v_emp, 'competency_id', v_comp, 'number', v_num,
      'issuer', d ->> 'penerbit', 'issued_on', d ->> 'tanggal_terbit', 'valid_until', d ->> 'berlaku_sampai'));

  elsif p_target = 'mcu' then
    v_emp := __APP__.import_employee_id(p_company, d ->> 'nik');
    select m.id into v_id from __APP__.mcu_records m where m.employee_id = v_emp and m.checked_on = nullif(d ->> 'tanggal', '')::date;
    if v_id is not null and p_mode = 'insert' then raise exception 'MCU pada tanggal itu sudah ada (mode Tambah baru).' using errcode = 'P0001'; end if;
    -- diagnosis/catatan medis TIDAK diimpor; yang sudah ada dipertahankan saat memperbarui
    if v_id is not null then select r.diagnosis, r.note into v_dx, v_note from __APP__.mcu_restricted r where r.mcu_id = v_id; end if;
    perform __APP__.mcu_save(v_id, jsonb_build_object('employee_id', v_emp, 'checked_on', d ->> 'tanggal', 'valid_until', d ->> 'berlaku_sampai',
      'result', d ->> 'hasil', 'diagnosis', v_dx, 'note', v_note));

  elsif p_target = 'site_permits' then
    v_emp := __APP__.import_employee_id(p_company, d ->> 'nik');
    v_num := nullif(btrim(coalesce(d ->> 'nomor', '')), '');
    select id into v_id from __APP__.site_permits where employee_id = v_emp and lower(name) = lower(btrim(coalesce(d ->> 'permit', ''))) and number is not distinct from v_num;
    if v_id is not null and p_mode = 'insert' then raise exception 'Permit dengan nama dan nomor yang sama sudah ada (mode Tambah baru).' using errcode = 'P0001'; end if;
    perform __APP__.site_permit_save(v_id, jsonb_build_object('employee_id', v_emp, 'name', d ->> 'permit', 'number', v_num, 'valid_until', d ->> 'berlaku_sampai'));
  else
    raise exception 'Target impor tidak dikenal.' using errcode = 'P0001';
  end if;
end $$;
revoke execute on function __APP__.import_row(text, text, jsonb, uuid, text) from public, anon, authenticated;

-- Commit batch. p_rows: [{n: nomor baris di file, d: {...}}] maks. 1000. Hasil per baris di sub-transaksi.
-- p_company opsional (default company profil). p_location wajib untuk target employees; target lain memakai site karyawan.
create or replace function __APP__.import_commit(p_target text, p_mode text, p_filename text, p_location uuid, p_company text, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_company text; el jsonb; v_ok integer := 0; v_fail integer := 0; v_errors jsonb := '[]'; v_total integer; v_job uuid;
begin
  if not __APP__.people_manager() then raise exception 'Hanya HR, HSE, atau admin yang bisa mengimpor data.' using errcode = '42501'; end if;
  if p_target not in ('employees', 'certificates', 'mcu', 'site_permits') then raise exception 'Target impor tidak dikenal.' using errcode = 'P0001'; end if;
  if p_mode not in ('insert', 'upsert') then raise exception 'Mode impor tidak valid.' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) not between 1 and 1000 then raise exception 'Impor memuat 1 sampai 1000 baris.' using errcode = 'P0001'; end if;
  if p_target = 'employees' and (p_location is null or not exists (select 1 from public.locations where id = p_location)) then raise exception 'Pilih site tujuan.' using errcode = 'P0001'; end if;
  v_company := __APP__.people_company(jsonb_build_object('company_code', p_company));
  v_total := jsonb_array_length(p_rows);
  for el in select * from jsonb_array_elements(p_rows) loop
    begin
      perform __APP__.import_row(p_target, p_mode, coalesce(el -> 'd', '{}'::jsonb), p_location, v_company);
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
  return jsonb_build_object('job_id', v_job, 'total', v_total, 'ok', v_ok, 'failed', v_fail, 'errors', v_errors);
end $$;
revoke execute on function __APP__.import_commit(text, text, text, uuid, text, jsonb) from public, anon;
