-- =====================================================================================
-- 25 IMPOR DATA LAMA MONITORING APD lewat app (Safe Hub, fase 6)
--   spesifikasi docs/spec/fase-6-apd.md U4 (diubah 2026-11-26: data masuk lewat app, bukan psql; aturan lourdes-db melarang
--   tulis data manual di produksi). Workbook dibaca server (lib/apd-excel.ts) → SATU RPC ini, sekali saja.
--
-- p_sites = { "<kode site Excel>": "<locations.id>" } (dipilih admin di /apd/impor; HO = gudang APD pusat).
-- p = { opening_date, items[], opening[], ins[], outs[], requests[] } (bentuk = ApdImportPayload).
-- Log per baris TIDAK ditulis (150+ baris); jejak = source 'import' di tiap baris + satu CCTV import dari Server Action.
-- =====================================================================================

create or replace function __APP__.apd_import_legacy(p_company text, p_sites jsonb, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_wh uuid; v_bad text; g jsonb; v_id uuid;
  n_items integer; n_open integer; n_in integer; n_out integer; n_req integer := 0; n_lines integer := 0; v_n integer;
begin
  if not __APP__.apd_manager() then
    raise exception 'Hanya HSE, SCM/Gudang, atau admin yang bisa mengimpor data APD.' using errcode = '42501';
  end if;
  if p_company is null or not exists (select 1 from public.companies where code = p_company and not is_group)
     or not ('*' = any (__APP__.my_company_scope()) or p_company = any (__APP__.my_company_scope())) then
    raise exception 'Perusahaan tidak valid atau di luar akses Anda.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p -> 'items') <> 'array' or jsonb_typeof(p -> 'outs') <> 'array' or jsonb_typeof(p -> 'requests') <> 'array'
     or jsonb_typeof(p -> 'ins') <> 'array' or jsonb_typeof(p -> 'opening') <> 'array' then
    raise exception 'Data impor tidak lengkap.' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext('apd_import_legacy'));
  if exists (select 1 from __APP__.apd_stock_moves where source = 'import') or exists (select 1 from __APP__.apd_requests where source = 'import') then
    raise exception 'Data lama Monitoring APD sudah pernah diimpor.' using errcode = 'P0001';
  end if;

  -- setiap kode site yang dipakai (termasuk HO = gudang) harus dipetakan ke lokasi yang ada
  select string_agg(u.s, ', ' order by u.s) into v_bad from (
    select 'HO' as s
    union select x ->> 'site' from jsonb_array_elements(p -> 'outs') x
    union select x ->> 'site' from jsonb_array_elements(p -> 'requests') x) u
   where not exists (select 1 from public.locations l where l.id::text = coalesce(p_sites ->> u.s, ''));
  if v_bad is not null then raise exception 'Pilih lokasi untuk site: %.', v_bad using errcode = 'P0001'; end if;
  v_wh := (p_sites ->> 'HO')::uuid;

  select string_agg(distinct x ->> 'type', ', ') into v_bad from jsonb_array_elements(p -> 'items') x
   where not exists (select 1 from __APP__.apd_types t where t.code = x ->> 'type');
  if v_bad is not null then raise exception 'Jenis APD tidak dikenal: %.', v_bad using errcode = 'P0001'; end if;

  alter table __APP__.apd_items disable trigger apd_items_log;
  alter table __APP__.apd_stock_moves disable trigger apd_stock_moves_log;
  alter table __APP__.apd_requests disable trigger apd_requests_log;

  insert into __APP__.apd_items (code, name, type_id, brand, size, uom)
  select x ->> 'code', x ->> 'name', t.id, x ->> 'brand', x ->> 'size', coalesce(x ->> 'uom', 'Pcs')
    from jsonb_array_elements(p -> 'items') x join __APP__.apd_types t on t.code = x ->> 'type'
  on conflict (code) do nothing;
  get diagnostics n_items = row_count;

  insert into __APP__.apd_stock_moves (company_code, location_id, kind, item_id, qty, moved_on, ref_no, note, source)
  select p_company, v_wh, 'opening', i.id, (x ->> 'qty')::integer, (p ->> 'opening_date')::date, 'SO Excel', 'Stok awal (kolom SO sheet Update Stock)', 'import'
    from jsonb_array_elements(p -> 'opening') x join __APP__.apd_items i on i.code = x ->> 'code';
  get diagnostics n_open = row_count;

  insert into __APP__.apd_stock_moves (company_code, location_id, kind, item_id, qty, moved_on, ref_no, pic, note, source)
  select p_company, v_wh, 'in', i.id, (x ->> 'qty')::integer, (x ->> 'date')::date, x ->> 'ref', x ->> 'pic', x ->> 'note', 'import'
    from jsonb_array_elements(p -> 'ins') x join __APP__.apd_items i on i.code = x ->> 'code';
  get diagnostics n_in = row_count;

  insert into __APP__.apd_stock_moves (company_code, location_id, kind, item_id, qty, moved_on, ref_no, pic, dest_location_id, recipient_name, note, source)
  select p_company, v_wh, 'out', i.id, (x ->> 'qty')::integer, (x ->> 'date')::date, x ->> 'bast', x ->> 'pic', (p_sites ->> (x ->> 'site'))::uuid,
         left(x ->> 'name', 120), x ->> 'note', 'import'
    from jsonb_array_elements(p -> 'outs') x join __APP__.apd_items i on i.code = x ->> 'code';
  get diagnostics n_out = row_count;

  for g in select * from jsonb_array_elements(p -> 'requests') loop
    insert into __APP__.apd_requests (company_code, location_id, code, recipient_name, reason, mr_no, requested_on, status, source, explanation)
    values (p_company, (p_sites ->> (g ->> 'site'))::uuid, __APP__.next_doc_number('APD', p_company, 'year'), left(g ->> 'name', 120), 'periodic',
            g ->> 'mr', nullif(g ->> 'date', '')::date, 'approved', 'import',
            'Data lama sheet MTR MR (baris ' || (select string_agg(x, ', ') from jsonb_array_elements_text(g -> 'rows') x) || ')')
    returning id into v_id;
    insert into __APP__.apd_request_lines (request_id, line_no, type_id, item_id, size, qty, legacy_supplied, note)
    select v_id, l.ord, i.type_id, i.id, i.size, (l.v ->> 'qty')::integer, (l.v ->> 'supplied')::integer, l.v ->> 'note'
      from jsonb_array_elements(g -> 'lines') with ordinality as l(v, ord) join __APP__.apd_items i on i.code = l.v ->> 'code';
    get diagnostics v_n = row_count;
    n_lines := n_lines + v_n;
    n_req := n_req + 1;
  end loop;

  alter table __APP__.apd_items enable trigger apd_items_log;
  alter table __APP__.apd_stock_moves enable trigger apd_stock_moves_log;
  alter table __APP__.apd_requests enable trigger apd_requests_log;

  return jsonb_build_object('items', n_items, 'opening', n_open, 'in', n_in, 'out', n_out, 'requests', n_req, 'request_lines', n_lines);
end $$;
revoke execute on function __APP__.apd_import_legacy(text, jsonb, jsonb) from public, anon;
