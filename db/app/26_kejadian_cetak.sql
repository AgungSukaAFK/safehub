-- =====================================================================================
-- 26 CETAK LAPORAN INVESTIGASI KEJADIAN (Safe Hub)
--   Formulir GMI.MR.F.013-001 "Laporan Investigasi" (Rev 00, efektif 02 Sep 2024; contoh di root repo: "Laporan investigasi
--   nearmiss kebocoran gas CO2 di produksi.pdf"). Kolom formulir yang belum ada di sistem (keputusan user 2026-11-26):
--   - incidents: shift, overtime, aktivitas saat kejadian, occupational, karyawan korban (tautan Manpower)
--   - incident_restricted (HSE/HR): checklist sakit, cidera, treatment; data pribadi korban OPSIONAL (alamat, telp keluarga,
--     tanggal lahir; kosong = diisi tangan setelah dicetak)
--   - incident_investigations: analisa berdasarkan fakta, uraian penyebab dasar
--   Penyebab langsung/dasar memakai checklist baku formulir (label di lib/kejadian-rules.ts CAUSE_OPTIONS); struktur jsonb
--   causes TIDAK berubah (item = {text, note}), jadi data lama tetap valid dan tercetak di "Lain-lain".
-- =====================================================================================

alter table __APP__.incidents
  add column if not exists shift text check (length(shift) <= 40),
  add column if not exists overtime boolean,
  add column if not exists activity text check (length(activity) <= 1000),
  add column if not exists occupational text check (occupational in ('occupational', 're_treatment', 'non_occupational')),
  add column if not exists victim_employee_id uuid references __APP__.employees(id) on delete set null;

alter table __APP__.incident_restricted
  add column if not exists illnesses text[] not null default '{}' check (cardinality(illnesses) <= 30),
  add column if not exists injuries text[] not null default '{}' check (cardinality(injuries) <= 30),
  add column if not exists treatment_items text[] not null default '{}' check (cardinality(treatment_items) <= 30),
  add column if not exists victim_address text check (length(victim_address) <= 300),
  add column if not exists victim_phone text check (length(victim_phone) <= 40),
  add column if not exists victim_birth_date date;

alter table __APP__.incident_investigations
  add column if not exists facts text check (length(facts) <= 4000),
  add column if not exists basic_cause_summary text check (length(basic_cause_summary) <= 4000);

-- Daftar teks dari jsonb array: trim, buang kosong, maks 60 karakter per butir
create or replace function __APP__.k3_text_list(p jsonb)
returns text[] language sql immutable set search_path = '' as $$
  select coalesce(array_agg(left(btrim(x), 60)), '{}') from jsonb_array_elements_text(
    case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end) x where length(btrim(x)) > 0;
$$;
revoke execute on function __APP__.k3_text_list(jsonb) from public, anon, authenticated;

-- incident_classify (11) + kolom formulir. Sisanya sama.
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
  if coalesce(p ->> 'occupational', '') not in ('', 'occupational', 're_treatment', 'non_occupational') then
    raise exception 'Pilihan occupational tidak valid.' using errcode = 'P0001';
  end if;
  if nullif(p ->> 'victim_employee_id', '') is not null and not exists (
       select 1 from __APP__.employees e where e.id = (p ->> 'victim_employee_id')::uuid and e.company_code = r.company_code) then
    raise exception 'Karyawan korban tidak ditemukan di perusahaan kejadian ini.' using errcode = 'P0001';
  end if;

  v_first := r.status = 'reported';

  if p ? 'restricted' and jsonb_typeof(p -> 'restricted') = 'object' then
    insert into __APP__.incident_restricted (incident_id, injury_type, body_parts, treatment, facility,
                                             lost_days, restricted_days, illnesses, injuries, treatment_items,
                                             victim_address, victim_phone, victim_birth_date)
    values (p_id, nullif(btrim(p -> 'restricted' ->> 'injury_type'), ''),
            __APP__.k3_text_list(p -> 'restricted' -> 'body_parts'),
            nullif(p -> 'restricted' ->> 'treatment', ''), nullif(btrim(p -> 'restricted' ->> 'facility'), ''),
            nullif(p -> 'restricted' ->> 'lost_days', '')::integer,
            nullif(p -> 'restricted' ->> 'restricted_days', '')::integer,
            __APP__.k3_text_list(p -> 'restricted' -> 'illnesses'), __APP__.k3_text_list(p -> 'restricted' -> 'injuries'),
            __APP__.k3_text_list(p -> 'restricted' -> 'treatment_items'),
            nullif(btrim(p -> 'restricted' ->> 'victim_address'), ''), nullif(btrim(p -> 'restricted' ->> 'victim_phone'), ''),
            nullif(p -> 'restricted' ->> 'victim_birth_date', '')::date)
    on conflict (incident_id) do update
      set injury_type = excluded.injury_type, body_parts = excluded.body_parts, treatment = excluded.treatment,
          facility = excluded.facility, lost_days = excluded.lost_days, restricted_days = excluded.restricted_days,
          illnesses = excluded.illnesses, injuries = excluded.injuries, treatment_items = excluded.treatment_items,
          victim_address = excluded.victim_address, victim_phone = excluded.victim_phone,
          victim_birth_date = excluded.victim_birth_date, updated_at = now();
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
         shift = nullif(btrim(p ->> 'shift'), ''), overtime = nullif(p ->> 'overtime', '')::boolean,
         activity = nullif(btrim(p ->> 'activity'), ''), occupational = nullif(p ->> 'occupational', ''),
         victim_employee_id = nullif(p ->> 'victim_employee_id', '')::uuid,
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

-- incident_save_investigation (11) + analisa fakta & uraian penyebab dasar. Sisanya sama.
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
                                               facts, basic_cause_summary, updated_by, updated_at)
  values (p_id, v_tl, nullif(btrim(p ->> 'reconstruction'), ''), v_cs, v_rec,
          nullif(left(btrim(p ->> 'facts'), 4000), ''), nullif(left(btrim(p ->> 'basic_cause_summary'), 4000), ''),
          auth.uid(), now())
  on conflict (incident_id) do update
    set timeline = excluded.timeline, reconstruction = excluded.reconstruction, causes = excluded.causes,
        recommendations = excluded.recommendations, facts = excluded.facts,
        basic_cause_summary = excluded.basic_cause_summary, updated_by = excluded.updated_by, updated_at = now();

  perform __APP__.set_log_context('save_investigation', null);
  perform __APP__.set_log_extra(jsonb_build_object('investigasi', format('%s kronologi, %s penyebab, %s rekomendasi',
    jsonb_array_length(v_tl),
    (select count(*) from jsonb_each(v_cs) c, jsonb_array_elements(c.value)), jsonb_array_length(v_rec))));
  update __APP__.incidents set updated_at = now() where id = p_id;
  perform __APP__.set_log_extra(null);
  perform __APP__.set_log_context('', '');
  return jsonb_build_object('id', p_id);
end $$;
