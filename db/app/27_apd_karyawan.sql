-- =====================================================================================
-- 27 DATA KARYAWAN APD dari sheet Populasi Manpower + tautan riwayat lama (Safe Hub, fase 6 bagian C)
--   spesifikasi docs/spec/fase-6-apd.md (U2 diubah 2026-11-26: impor Populasi dengan NIK sementara; P16-P19)
--
-- apd_import_population: buat/cocokkan karyawan (nama + site), ukuran APD, riwayat terakhir terima per jenis.
--   Boleh diulang (idempoten): karyawan dicocokkan nama + site, riwayat yang sama tidak dobel, ukuran diperbarui.
--   Karyawan baru diberi NIK sementara APD-NNNN (penanda "belum ada NRP"; HR menggantinya di Manpower).
-- apd_autolink: tautkan mutasi OUT & pengajuan data lama (hanya nama) ke karyawan bila nama + site cocok TEPAT satu.
-- apd_unlinked + apd_link_recipient: sisa yang tidak cocok dipilih manual (usulan = nama termirip di site yang sama).
-- =====================================================================================

create or replace function __APP__.apd_norm_name(p text)
returns text language sql immutable set search_path = '' as $$
  select lower(regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g'));
$$;

-- Tautkan otomatis (dipanggil impor; juga bisa dipanggil ulang lewat RPC). Hanya baris data lama tanpa karyawan.
create or replace function __APP__.apd_autolink(p_company text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_moves integer; v_reqs integer;
begin
  if not (__APP__.apd_manager() or __APP__.people_manager()) then
    raise exception 'Hanya HR, HSE, SCM/Gudang, atau admin yang bisa menautkan data APD.' using errcode = '42501';
  end if;
  perform __APP__.set_log_context('update', 'Ditautkan ke karyawan (nama + site cocok)');
  with c as (
    select e.location_id, __APP__.apd_norm_name(e.name) as n, (array_agg(e.id))[1] as id
      from __APP__.employees e where e.company_code = p_company and e.status = 'active'
     group by e.location_id, __APP__.apd_norm_name(e.name) having count(*) = 1)
  update __APP__.apd_stock_moves m set employee_id = c.id
    from c where m.company_code = p_company and m.source = 'import' and m.kind = 'out' and m.employee_id is null
     and m.dest_location_id = c.location_id and __APP__.apd_norm_name(m.recipient_name) = c.n;
  get diagnostics v_moves = row_count;
  with c as (
    select e.location_id, __APP__.apd_norm_name(e.name) as n, (array_agg(e.id))[1] as id, (array_agg(e.job_title))[1] as job
      from __APP__.employees e where e.company_code = p_company and e.status = 'active'
     group by e.location_id, __APP__.apd_norm_name(e.name) having count(*) = 1)
  update __APP__.apd_requests r set employee_id = c.id, job_title = coalesce(r.job_title, c.job)
    from c where r.company_code = p_company and r.source = 'import' and r.employee_id is null
     and r.location_id = c.location_id and __APP__.apd_norm_name(r.recipient_name) = c.n;
  get diagnostics v_reqs = row_count;
  perform __APP__.set_log_context('', '');
  return jsonb_build_object('linked_moves', v_moves, 'linked_requests', v_reqs);
end $$;

-- p_sites = { "<kode site>": "<locations.id>" }
-- p = { people: [{ name, site, job_title, sizes: { <type_code>: <size> }, issues: [{ type, date, qty?, size? }] }] }
create or replace function __APP__.apd_import_population(p_company text, p_sites jsonb, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  x jsonb; i jsonb; v_loc uuid; v_emp uuid; v_name text; v_job text; v_n integer; v_next integer;
  n_created integer := 0; n_matched integer := 0; n_sizes integer := 0; n_issues integer := 0; v_skipped jsonb := '[]'; v_bad text; v_link jsonb;
begin
  if not __APP__.people_manager() then
    raise exception 'Hanya HR, HSE, atau admin yang bisa mengimpor data karyawan.' using errcode = '42501';
  end if;
  if p_company is null or not exists (select 1 from public.companies where code = p_company and not is_group)
     or not ('*' = any (__APP__.my_company_scope()) or p_company = any (__APP__.my_company_scope())) then
    raise exception 'Perusahaan tidak valid atau di luar akses Anda.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p -> 'people') <> 'array' or jsonb_array_length(p -> 'people') = 0 then
    raise exception 'Tidak ada data karyawan di file.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p -> 'people') > 2000 then raise exception 'Maksimal 2000 karyawan per impor.' using errcode = 'P0001'; end if;
  select string_agg(distinct pp ->> 'site', ', ') into v_bad from jsonb_array_elements(p -> 'people') pp
   where not exists (select 1 from public.locations l where l.id::text = coalesce(p_sites ->> (pp ->> 'site'), ''));
  if v_bad is not null then raise exception 'Pilih lokasi untuk site: %.', v_bad using errcode = 'P0001'; end if;

  perform pg_advisory_xact_lock(hashtext('apd_import_population:' || p_company));
  select coalesce(max(substring(code from '^APD-(\d+)$')::integer), 0) into v_next
    from __APP__.employees where company_code = p_company and code ~ '^APD-\d+$';

  alter table __APP__.employees disable trigger employees_log;
  for x in select * from jsonb_array_elements(p -> 'people') loop
    v_loc := (p_sites ->> (x ->> 'site'))::uuid;
    v_name := left(regexp_replace(btrim(coalesce(x ->> 'name', '')), '\s+', ' ', 'g'), 120);
    v_job := left(coalesce(nullif(btrim(x ->> 'job_title'), ''), 'Belum diisi'), 80);
    if length(v_name) < 2 then continue; end if;
    select count(*), (array_agg(e.id))[1] into v_n, v_emp from __APP__.employees e
     where e.company_code = p_company and e.location_id = v_loc and __APP__.apd_norm_name(e.name) = __APP__.apd_norm_name(v_name);
    if v_n > 1 then
      v_skipped := v_skipped || jsonb_build_object('name', v_name, 'site', x ->> 'site', 'reason', 'lebih dari satu karyawan bernama sama di site ini');
      continue;
    elsif v_n = 0 then
      v_next := v_next + 1;
      insert into __APP__.employees (company_code, location_id, code, name, job_title, employment, status)
      values (p_company, v_loc, 'APD-' || lpad(v_next::text, 4, '0'), v_name, v_job, 'PKWTT', 'active')
      returning id into v_emp;
      n_created := n_created + 1;
    else
      n_matched := n_matched + 1;
    end if;

    insert into __APP__.apd_employee_sizes (employee_id, type_id, size)
    select v_emp, t.id, left(btrim(s.value), 20) from jsonb_each_text(coalesce(x -> 'sizes', '{}')) s
      join __APP__.apd_types t on t.code = s.key where length(btrim(s.value)) > 0
    on conflict (employee_id, type_id) do update set size = excluded.size, updated_by = auth.uid(), updated_at = now();
    get diagnostics v_n = row_count; n_sizes := n_sizes + v_n;

    for i in select * from jsonb_array_elements(coalesce(x -> 'issues', '[]')) loop
      insert into __APP__.apd_issue_history (employee_id, type_id, issued_on, qty, size, note)
      select v_emp, t.id, (i ->> 'date')::date, nullif(i ->> 'qty', '')::integer, nullif(left(btrim(coalesce(i ->> 'size', '')), 20), ''),
             'Populasi Manpower (Excel Monitoring APD)'
        from __APP__.apd_types t
       where t.code = i ->> 'type' and (i ->> 'date') ~ '^\d{4}-\d{2}-\d{2}$' and (i ->> 'date')::date <= __APP__.today_wib()
         and not exists (select 1 from __APP__.apd_issue_history h where h.employee_id = v_emp and h.type_id = t.id and h.issued_on = (i ->> 'date')::date);
      get diagnostics v_n = row_count; n_issues := n_issues + v_n;
    end loop;
  end loop;
  alter table __APP__.employees enable trigger employees_log;

  v_link := __APP__.apd_autolink(p_company);
  return jsonb_build_object('created', n_created, 'matched', n_matched, 'sizes', n_sizes, 'issues', n_issues, 'skipped', v_skipped) || v_link;
end $$;

-- Sisa nama data lama yang belum tertaut + usulan karyawan termirip di site yang sama (invoker: ikut RLS staf).
create or replace function __APP__.apd_unlinked(p_company text default null)
returns table (name text, location_id uuid, moves integer, requests integer, suggest_id uuid, suggest_name text, suggest_score real)
language sql stable security invoker set search_path = '' as $$
  with u as (
    select __APP__.apd_norm_name(m.recipient_name) as n, min(m.recipient_name) as name, m.dest_location_id as loc, count(*)::integer as moves, 0 as requests
      from __APP__.apd_stock_moves m
     where m.source = 'import' and m.kind = 'out' and m.employee_id is null and m.voided_at is null and (p_company is null or m.company_code = p_company)
     group by 1, 3
    union all
    select __APP__.apd_norm_name(r.recipient_name), min(r.recipient_name), r.location_id, 0, count(*)::integer
      from __APP__.apd_requests r
     where r.source = 'import' and r.employee_id is null and r.status <> 'cancelled' and (p_company is null or r.company_code = p_company)
     group by 1, 3),
  g as (select n, min(name) as name, loc, sum(moves)::integer as moves, sum(requests)::integer as requests from u group by n, loc)
  select g.name, g.loc, g.moves, g.requests, s.id, s.name, s.score
    from g left join lateral (
      select e.id, e.name, extensions.similarity(__APP__.apd_norm_name(e.name), g.n) as score
        from __APP__.employees e
       where e.location_id = g.loc and e.status = 'active' and extensions.similarity(__APP__.apd_norm_name(e.name), g.n) >= 0.3
       order by 3 desc limit 1) s on true
   order by g.loc, g.name;
$$;

-- Tautkan satu nama (data lama, site tertentu) ke karyawan. Mutasi OUT + pengajuan dengan nama & site itu ikut.
create or replace function __APP__.apd_link_recipient(p_name text, p_location uuid, p_employee uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare e __APP__.employees; v_moves integer; v_reqs integer;
begin
  if not (__APP__.apd_manager() or __APP__.people_manager()) then
    raise exception 'Hanya HR, HSE, SCM/Gudang, atau admin yang bisa menautkan data APD.' using errcode = '42501';
  end if;
  select * into e from __APP__.employees where id = p_employee and status = 'active';
  if e.id is null or not __APP__.k3_in_scope(e.company_code, e.location_id) then raise exception 'Karyawan tidak ditemukan.' using errcode = 'P0001'; end if;
  perform __APP__.set_log_context('update', 'Ditautkan manual ke karyawan ' || e.code);
  update __APP__.apd_stock_moves set employee_id = e.id
   where source = 'import' and kind = 'out' and employee_id is null and company_code = e.company_code
     and dest_location_id = p_location and __APP__.apd_norm_name(recipient_name) = __APP__.apd_norm_name(p_name);
  get diagnostics v_moves = row_count;
  update __APP__.apd_requests set employee_id = e.id, job_title = coalesce(job_title, e.job_title)
   where source = 'import' and employee_id is null and company_code = e.company_code
     and location_id = p_location and __APP__.apd_norm_name(recipient_name) = __APP__.apd_norm_name(p_name);
  get diagnostics v_reqs = row_count;
  perform __APP__.set_log_context('', '');
  if v_moves + v_reqs = 0 then raise exception 'Tidak ada data lama atas nama itu di site ini.' using errcode = 'P0001'; end if;
  return jsonb_build_object('linked_moves', v_moves, 'linked_requests', v_reqs);
end $$;

revoke execute on function __APP__.apd_norm_name(text) from public, anon;
revoke execute on function __APP__.apd_autolink(text), __APP__.apd_import_population(text, jsonb, jsonb),
  __APP__.apd_unlinked(text), __APP__.apd_link_recipient(text, uuid, uuid) from public, anon;
