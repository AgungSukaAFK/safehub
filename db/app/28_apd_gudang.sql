-- =====================================================================================
-- 28 GUDANG APD + ALUR MR (IN) & PENGIRIMAN (OUT) BERBASIS PENGAJUAN (Safe Hub, fase 6 bagian D)
--   spesifikasi docs/spec/fase-6-apd.md (P20-P26, keputusan user 2026-11-26)
--
-- 1) Gudang = data sendiri (apd_warehouses), TERPISAH dari site; lokasi fisik opsional (untuk scope site). Dikelola di
--    Master Data (admin). Stok = buku besar mutasi PER GUDANG (apd_stock_moves.warehouse_id). Data lama dipindahkan
--    otomatis: satu gudang per lokasi yang sudah punya mutasi ("Gudang <nama lokasi>"). location_id mutasi = lokasi gudang.
-- 2) Pengajuan disetujui → "Lengkapi MR" (nomor MR sistem perusahaan) → "Terima MR" = IN per baris ke gudang pilihan
--    (boleh sebagian; mutasi IN menunjuk baris pengajuan) → "Kirim" = OUT per baris dari gudang pilihan (stok berkurang,
--    pemenuhan & jatuh tempo karyawan ikut ter-update lewat tautan OUT → karyawan).
-- 3) OUT tanpa pengajuan (vendor/tim), retur, penyesuaian tetap lewat apd_move_save ("Mutasi lain").
-- =====================================================================================

-- ---------------------------------------------------------------- 1. gudang
create table if not exists __APP__.apd_warehouses (
  id           uuid primary key default gen_random_uuid(),
  company_code text not null references public.companies(code),
  name         text not null check (length(btrim(name)) between 2 and 100),
  location_id  uuid references public.locations(id),                     -- lokasi fisik (opsional)
  description  text check (length(description) <= 500),                  -- alamat / keterangan
  sort_order   integer not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (company_code, name)
);
comment on table __APP__.apd_warehouses is 'Gudang APD (terpisah dari site). Dikelola admin di Master Data; stok APD dihitung per gudang.';
create table if not exists __APP__.apd_warehouses_logs (
  id bigint generated always as identity primary key,
  record_id uuid not null,
  at timestamptz not null default now(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (action ~ '^[a-z][a-z0-9_]{1,40}$'),
  changes jsonb,
  note text check (length(note) <= 2000)
);
create index if not exists apd_warehouses_logs_record_idx on __APP__.apd_warehouses_logs (record_id, at desc);
drop trigger if exists apd_warehouses_set_updated_at on __APP__.apd_warehouses;
create trigger apd_warehouses_set_updated_at before update on __APP__.apd_warehouses for each row execute function public.set_updated_at();
drop trigger if exists apd_warehouses_log on __APP__.apd_warehouses;
create trigger apd_warehouses_log after insert or update or delete on __APP__.apd_warehouses
  for each row execute function __APP__.log_changes('config', '', 'Gudang APD');

alter table __APP__.apd_warehouses enable row level security;
alter table __APP__.apd_warehouses_logs enable row level security;
revoke delete on __APP__.apd_warehouses from authenticated, anon;
revoke insert, update, delete on __APP__.apd_warehouses_logs from authenticated, anon;
drop policy if exists "apd_warehouses: viewer read" on __APP__.apd_warehouses;
drop policy if exists "apd_warehouses: admin insert" on __APP__.apd_warehouses;
drop policy if exists "apd_warehouses: admin update" on __APP__.apd_warehouses;
drop policy if exists "apd_warehouses_logs: admin read" on __APP__.apd_warehouses_logs;
create policy "apd_warehouses: viewer read" on __APP__.apd_warehouses for select to authenticated
  using ((select public.has_app_role('__APP__', 'viewer')));
create policy "apd_warehouses: admin insert" on __APP__.apd_warehouses for insert to authenticated
  with check ((select public.has_app_role('__APP__', 'admin')));
create policy "apd_warehouses: admin update" on __APP__.apd_warehouses for update to authenticated
  using ((select public.has_app_role('__APP__', 'admin'))) with check ((select public.has_app_role('__APP__', 'admin')));
create policy "apd_warehouses_logs: admin read" on __APP__.apd_warehouses_logs for select to authenticated
  using ((select public.has_app_role('__APP__', 'admin')));

-- ---------------------------------------------------------------- 2. mutasi → gudang (pindahkan data lama)
alter table __APP__.apd_stock_moves add column if not exists warehouse_id uuid references __APP__.apd_warehouses(id);

insert into __APP__.apd_warehouses (company_code, name, location_id, description)
select distinct on (m.company_code, m.location_id) m.company_code, left('Gudang ' || l.name, 100), m.location_id, 'Dibuat otomatis dari lokasi mutasi lama'
  from __APP__.apd_stock_moves m join public.locations l on l.id = m.location_id
 where m.warehouse_id is null and m.location_id is not null
on conflict (company_code, name) do nothing;
update __APP__.apd_stock_moves m set warehouse_id = w.id
  from __APP__.apd_warehouses w
 where m.warehouse_id is null and w.company_code = m.company_code and w.location_id = m.location_id;

alter table __APP__.apd_stock_moves alter column warehouse_id set not null;
alter table __APP__.apd_stock_moves alter column location_id drop not null;   -- = lokasi gudang (opsional)
drop index if exists __APP__.apd_stock_moves_opening_uq;
drop index if exists __APP__.apd_stock_moves_item_idx;
create unique index apd_stock_moves_opening_uq on __APP__.apd_stock_moves (warehouse_id, item_id) where kind = 'opening' and voided_at is null;
create index apd_stock_moves_item_idx on __APP__.apd_stock_moves (warehouse_id, item_id) where voided_at is null;

-- baca mutasi: staf dalam scope company; scope site = lokasi gudang ATAU site tujuan (gudang tanpa lokasi = semua staf)
drop policy if exists "apd_stock_moves: read" on __APP__.apd_stock_moves;
create policy "apd_stock_moves: read" on __APP__.apd_stock_moves for select to authenticated
  using ((select public.has_app_role('__APP__', 'viewer')) and (
    employee_id = any ((select __APP__.my_employee_ids())::uuid[])
    or ((select __APP__.k3_staff())
        and ('*' = any ((select __APP__.my_company_scope())::text[]) or company_code = any ((select __APP__.my_company_scope())::text[]))
        and ('*' = any ((select __APP__.my_location_scope())::text[]) or location_id is null
             or location_id::text = any ((select __APP__.my_location_scope())::text[])
             or dest_location_id::text = any ((select __APP__.my_location_scope())::text[])))));

-- MR: jejak waktu & pengisi nomor MR
alter table __APP__.apd_requests add column if not exists mr_set_at timestamptz;

-- ---------------------------------------------------------------- 3. stok & mutasi per gudang
-- Stok satu barang di satu gudang (mutasi tidak dibatalkan). Internal. (parameter pertama = gudang sejak 28)
drop function if exists __APP__.apd_stock_qty(uuid, uuid);
create function __APP__.apd_stock_qty(p_warehouse uuid, p_item uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select coalesce(sum(case when kind = 'out' then -qty else qty end), 0)::integer
    from __APP__.apd_stock_moves where warehouse_id = p_warehouse and item_id = p_item and voided_at is null;
$$;
revoke execute on function __APP__.apd_stock_qty(uuid, uuid) from public, anon, authenticated;

-- Diterima per baris (IN tertaut = penerimaan MR)
create or replace function __APP__.apd_line_received(p_line uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select coalesce(sum(m.qty), 0)::integer from __APP__.apd_stock_moves m
   where m.request_line_id = p_line and m.kind = 'in' and m.voided_at is null;
$$;
revoke execute on function __APP__.apd_line_received(uuid) from public, anon, authenticated;

-- Gudang aktif yang boleh dipakai pemanggil (company + scope site bila gudang punya lokasi)
create or replace function __APP__.apd_warehouse_ok(p_warehouse uuid)
returns __APP__.apd_warehouses language plpgsql stable security definer set search_path = '' as $$
declare w __APP__.apd_warehouses;
begin
  select * into w from __APP__.apd_warehouses where id = p_warehouse;
  if w.id is null or not w.is_active then raise exception 'Pilih gudang yang aktif.' using errcode = 'P0001'; end if;
  if not ('*' = any (__APP__.my_company_scope()) or w.company_code = any (__APP__.my_company_scope()))
     or (w.location_id is not null and not __APP__.k3_in_scope(w.company_code, w.location_id)) then
    raise exception 'Gudang di luar akses Anda.' using errcode = 'P0001';
  end if;
  return w;
end $$;
revoke execute on function __APP__.apd_warehouse_ok(uuid) from public, anon, authenticated;

-- p: {warehouse_id, kind, item_id, qty, moved_on, ref_no?, pic?, dest_location_id?, employee_id?, recipient_name?, request_line_id?,
--     note?, silent?}
-- IN + request_line_id = penerimaan MR (pengajuan disetujui, MR terisi, qty <= sisa diterima). OUT + request_line_id = pemenuhan.
-- Stok tidak boleh minus per gudang. silent = tanpa notifikasi per baris (dipakai apd_fulfill: satu notifikasi gabungan).
drop function if exists __APP__.apd_move_save(jsonb);
create function __APP__.apd_move_save(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  w __APP__.apd_warehouses; v_kind text := p ->> 'kind';
  v_item __APP__.apd_items; v_qty integer := nullif(p ->> 'qty', '')::integer; v_on date := nullif(p ->> 'moved_on', '')::date;
  v_dest uuid := nullif(p ->> 'dest_location_id', '')::uuid; v_emp uuid := nullif(p ->> 'employee_id', '')::uuid;
  v_name text := nullif(btrim(p ->> 'recipient_name'), ''); v_line uuid := nullif(p ->> 'request_line_id', '')::uuid;
  v_note text := nullif(btrim(p ->> 'note'), ''); v_ref text := nullif(btrim(p ->> 'ref_no'), '');
  e __APP__.employees; r __APP__.apd_requests; l __APP__.apd_request_lines;
  v_stock integer; v_left integer; v_id uuid; v_notif jsonb := '[]';
begin
  if not __APP__.apd_manager() then raise exception 'Hanya HSE, SCM/Gudang, atau admin yang bisa mencatat mutasi APD.' using errcode = '42501'; end if;
  w := __APP__.apd_warehouse_ok(nullif(p ->> 'warehouse_id', '')::uuid);
  if coalesce(v_kind, '') not in ('opening', 'in', 'out', 'return', 'adjust') then raise exception 'Jenis mutasi tidak valid.' using errcode = 'P0001'; end if;
  select * into v_item from __APP__.apd_items where id = nullif(p ->> 'item_id', '')::uuid;
  if v_item.id is null or not v_item.is_active then raise exception 'Pilih barang APD yang aktif.' using errcode = 'P0001'; end if;
  if v_qty is null or v_qty = 0 or (v_kind <> 'adjust' and v_qty < 0) then raise exception 'Jumlah harus lebih dari 0.' using errcode = 'P0001'; end if;
  if v_on is null or v_on > __APP__.today_wib() then raise exception 'Tanggal tidak valid (tidak boleh di masa depan).' using errcode = 'P0001'; end if;
  if v_kind = 'adjust' and length(coalesce(v_note, '')) < 10 then raise exception 'Penyesuaian stok wajib beralasan minimal 10 karakter.' using errcode = 'P0001'; end if;
  if v_kind = 'opening' and exists (select 1 from __APP__.apd_stock_moves where warehouse_id = w.id and item_id = v_item.id and kind = 'opening' and voided_at is null) then
    raise exception 'Stok awal barang ini di gudang ini sudah dicatat. Gunakan Penyesuaian untuk hasil stock opname berikutnya.' using errcode = 'P0001';
  end if;

  if v_line is not null and v_kind in ('in', 'out') then
    select * into l from __APP__.apd_request_lines where id = v_line;
    select * into r from __APP__.apd_requests where id = l.request_id;
    if r.id is null or r.company_code <> w.company_code then raise exception 'Baris pengajuan tidak ditemukan (atau beda perusahaan dengan gudang).' using errcode = 'P0001'; end if;
    if r.status <> 'approved' then raise exception 'Pengajuan % belum disetujui.', r.code using errcode = 'P0001'; end if;
    if l.type_id <> v_item.type_id then raise exception 'Barang tidak sesuai jenis APD yang diajukan.' using errcode = 'P0001'; end if;
    perform pg_advisory_xact_lock(hashtext('apd_line:' || v_line));
  elsif v_kind not in ('in', 'out') then
    v_line := null;
  end if;

  if v_kind = 'in' then
    if v_line is not null then
      if r.mr_no is null then raise exception 'Lengkapi nomor MR pengajuan % sebelum menerima barang.', r.code using errcode = 'P0001'; end if;
      v_left := l.qty - __APP__.apd_line_received(v_line);
      if v_qty > v_left then raise exception 'Jumlah melebihi sisa MR yang belum diterima (sisa %).', greatest(v_left, 0) using errcode = 'P0001'; end if;
      v_ref := coalesce(v_ref, r.mr_no);
    end if;
    v_dest := null; v_emp := null; v_name := null;
  elsif v_kind = 'out' then
    if v_line is not null then
      v_left := l.qty - __APP__.apd_line_supplied(v_line);
      if v_qty > v_left then raise exception 'Jumlah melebihi sisa pengajuan (sisa %).', greatest(v_left, 0) using errcode = 'P0001'; end if;
      v_emp := r.employee_id; v_name := r.recipient_name; v_dest := coalesce(v_dest, r.location_id);
    elsif v_emp is not null then
      select * into e from __APP__.employees where id = v_emp;
      if e.id is null or e.company_code <> w.company_code then raise exception 'Karyawan tidak ditemukan.' using errcode = 'P0001'; end if;
      v_name := e.name; v_dest := coalesce(v_dest, e.location_id);
    end if;
    if v_name is null or length(v_name) < 2 then raise exception 'Isi penerima (karyawan atau nama).' using errcode = 'P0001'; end if;
    if v_dest is null or not exists (select 1 from public.locations where id = v_dest) then raise exception 'Pilih site tujuan.' using errcode = 'P0001'; end if;
  elsif v_kind = 'return' then
    if v_emp is not null then
      select * into e from __APP__.employees where id = v_emp;
      if e.id is null or e.company_code <> w.company_code then raise exception 'Karyawan tidak ditemukan.' using errcode = 'P0001'; end if;
      v_name := e.name;
    end if;
    v_dest := null;
  else
    v_dest := null; v_emp := null; v_name := null;
  end if;

  if v_kind = 'out' or (v_kind = 'adjust' and v_qty < 0) then
    perform pg_advisory_xact_lock(hashtext('apd_stock:' || w.id || ':' || v_item.id));
    v_stock := __APP__.apd_stock_qty(w.id, v_item.id);
    if v_stock < abs(v_qty) then raise exception 'Stok % di % tidak cukup (tersedia %).', v_item.code, w.name, v_stock using errcode = 'P0001'; end if;
  end if;

  perform __APP__.set_log_context('stock_' || v_kind, v_note);
  insert into __APP__.apd_stock_moves (company_code, warehouse_id, location_id, kind, item_id, qty, moved_on, ref_no, pic, dest_location_id, employee_id,
                                       recipient_name, request_line_id, note)
  values (w.company_code, w.id, w.location_id, v_kind, v_item.id, v_qty, v_on, v_ref, nullif(btrim(p ->> 'pic'), ''), v_dest, v_emp,
          v_name, v_line, v_note)
  returning id into v_id;
  perform __APP__.set_log_context('', '');

  if v_kind = 'out' and v_emp is not null and not coalesce((p ->> 'silent')::boolean, false) then
    select coalesce(jsonb_agg(n), '[]') into v_notif from __APP__.notify(
      (select coalesce(array_agg(profile_id), '{}') from __APP__.employees where id = v_emp and profile_id is not null),
      'apd_issued', 'APD dikirim: ' || v_item.name || ' (' || v_qty || ' ' || v_item.uom || ')',
      case when r.id is not null then 'Untuk pengajuan ' || r.code end,
      case when r.id is not null then '/apd/pengajuan/' || r.id else '/apd/saya' end, 'apd', 'apd_stock_moves', v_id::text) n;
  end if;
  return jsonb_build_object('id', v_id, 'stock', __APP__.apd_stock_qty(w.id, v_item.id), 'notification_ids', v_notif);
end $$;

create or replace function __APP__.apd_move_void(p_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare m __APP__.apd_stock_moves; v_stock integer; v_delta integer;
begin
  if not __APP__.apd_manager() then raise exception 'Hanya HSE, SCM/Gudang, atau admin yang bisa membatalkan mutasi.' using errcode = '42501'; end if;
  select * into m from __APP__.apd_stock_moves where id = p_id;
  if m.id is null or not ('*' = any (__APP__.my_company_scope()) or m.company_code = any (__APP__.my_company_scope()))
     or (m.location_id is not null and not __APP__.k3_in_scope(m.company_code, m.location_id)) then
    raise exception 'Mutasi tidak ditemukan.' using errcode = 'P0001';
  end if;
  if m.voided_at is not null then raise exception 'Mutasi sudah dibatalkan.' using errcode = 'P0001'; end if;
  if length(btrim(coalesce(p_reason, ''))) < 10 then raise exception 'Alasan pembatalan minimal 10 karakter.' using errcode = 'P0001'; end if;
  v_delta := case when m.kind = 'out' then m.qty else -m.qty end;
  if v_delta < 0 then
    perform pg_advisory_xact_lock(hashtext('apd_stock:' || m.warehouse_id || ':' || m.item_id));
    v_stock := __APP__.apd_stock_qty(m.warehouse_id, m.item_id);
    if v_stock + v_delta < 0 then raise exception 'Pembatalan membuat stok minus (tersedia %). Batalkan dulu pengeluaran sesudahnya.', v_stock using errcode = 'P0001'; end if;
  end if;
  perform __APP__.set_log_context('void', btrim(p_reason));
  update __APP__.apd_stock_moves set voided_at = now(), void_reason = btrim(p_reason) where id = p_id;
  perform __APP__.set_log_context('', '');
  return jsonb_build_object('ok', true, 'stock', __APP__.apd_stock_qty(m.warehouse_id, m.item_id));
end $$;
revoke execute on function __APP__.apd_move_save(jsonb), __APP__.apd_move_void(uuid, text) from public, anon;

-- ---------------------------------------------------------------- 4. MR & pemenuhan per pengajuan
-- Lengkapi / ubah nomor MR (sistem perusahaan) pada pengajuan disetujui. Kosong = hapus (hanya bila belum ada penerimaan).
create or replace function __APP__.apd_request_set_mr(p_id uuid, p_mr_no text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r __APP__.apd_requests; v_mr text := nullif(left(btrim(coalesce(p_mr_no, '')), 60), '');
begin
  if not __APP__.apd_manager() then raise exception 'Hanya HSE, SCM/Gudang, atau admin yang bisa melengkapi MR.' using errcode = '42501'; end if;
  select * into r from __APP__.apd_requests where id = p_id for update;
  if r.id is null or not __APP__.apd_request_visible(p_id) then raise exception 'Pengajuan tidak ditemukan.' using errcode = 'P0001'; end if;
  if r.status <> 'approved' then raise exception 'MR hanya bisa dilengkapi pada pengajuan yang sudah disetujui.' using errcode = 'P0001'; end if;
  if v_mr is null and exists (select 1 from __APP__.apd_request_lines l where l.request_id = p_id and __APP__.apd_line_received(l.id) > 0) then
    raise exception 'MR sudah ada penerimaan; nomor MR tidak bisa dikosongkan.' using errcode = 'P0001';
  end if;
  perform __APP__.set_log_context('set_mr', v_mr);
  update __APP__.apd_requests set mr_no = v_mr, mr_set_at = case when v_mr is null then null else now() end where id = p_id;
  perform __APP__.set_log_context('', '');
  return jsonb_build_object('mr_no', v_mr);
end $$;

-- p: {request_id, warehouse_id, moved_on, ref_no?, pic?, note?, lines: [{line_id, item_id, qty}]}
-- Banyak baris sekaligus; tiap baris lewat apd_move_save (semua pemeriksaan sama). Gagal satu = batal semua.
create or replace function __APP__.apd_request_moves(p_kind text, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r __APP__.apd_requests; el jsonb; v_res jsonb; v_n integer := 0; v_units integer := 0; v_ids jsonb := '[]'; v_notif jsonb := '[]';
begin
  if p_kind not in ('in', 'out') then raise exception 'Jenis tidak valid.' using errcode = 'P0001'; end if;
  select * into r from __APP__.apd_requests where id = nullif(p ->> 'request_id', '')::uuid;
  if r.id is null or not __APP__.apd_request_visible(r.id) then raise exception 'Pengajuan tidak ditemukan.' using errcode = 'P0001'; end if;
  if jsonb_typeof(p -> 'lines') <> 'array' then raise exception 'Isi barang yang %.', case p_kind when 'in' then 'diterima' else 'dikirim' end using errcode = 'P0001'; end if;
  for el in select * from jsonb_array_elements(p -> 'lines') loop
    if coalesce(nullif(el ->> 'qty', '')::integer, 0) <= 0 then continue; end if;
    if not exists (select 1 from __APP__.apd_request_lines where id = nullif(el ->> 'line_id', '')::uuid and request_id = r.id) then
      raise exception 'Baris tidak termasuk pengajuan %.', r.code using errcode = 'P0001';
    end if;
    v_res := __APP__.apd_move_save(jsonb_build_object(
      'warehouse_id', p ->> 'warehouse_id', 'kind', p_kind, 'item_id', el ->> 'item_id', 'qty', el ->> 'qty', 'moved_on', p ->> 'moved_on',
      'ref_no', p ->> 'ref_no', 'pic', p ->> 'pic', 'note', p ->> 'note', 'request_line_id', el ->> 'line_id', 'silent', true));
    v_ids := v_ids || to_jsonb(v_res ->> 'id');
    v_n := v_n + 1; v_units := v_units + (el ->> 'qty')::integer;
  end loop;
  if v_n = 0 then raise exception 'Isi jumlah minimal satu barang.' using errcode = 'P0001'; end if;
  -- satu notifikasi gabungan untuk penerima berakun (OUT)
  if p_kind = 'out' and r.employee_id is not null then
    select coalesce(jsonb_agg(n), '[]') into v_notif from __APP__.notify(
      (select coalesce(array_agg(profile_id), '{}') from __APP__.employees where id = r.employee_id and profile_id is not null),
      'apd_issued', 'APD dikirim untuk pengajuan ' || r.code, v_units || ' unit dari gudang', '/apd/pengajuan/' || r.id, 'apd', 'apd_requests', r.id::text) n;
  end if;
  return jsonb_build_object('moves', v_ids, 'count', v_n, 'units', v_units, 'notification_ids', v_notif);
end $$;
revoke execute on function __APP__.apd_request_set_mr(uuid, text), __APP__.apd_request_moves(text, jsonb) from public, anon;

-- ---------------------------------------------------------------- 5. baca
-- Kemajuan per baris + diterima (IN tertaut MR). Kolom baru di akhir (create or replace view).
create or replace view __APP__.apd_request_line_progress with (security_invoker = true) as
select l.id as line_id, l.request_id, l.line_no, l.type_id, l.item_id, l.size, l.qty,
       (coalesce(s.qty, 0) + l.legacy_supplied)::integer as supplied,
       greatest(l.qty - coalesce(s.qty, 0) - l.legacy_supplied, 0)::integer as outstanding,
       s.last_on as last_supply_on,
       coalesce(rc.qty, 0)::integer as received
  from __APP__.apd_request_lines l
  left join lateral (select sum(m.qty) as qty, max(m.moved_on) as last_on from __APP__.apd_stock_moves m
                      where m.request_line_id = l.id and m.kind = 'out' and m.voided_at is null) s on true
  left join lateral (select sum(m.qty) as qty from __APP__.apd_stock_moves m
                      where m.request_line_id = l.id and m.kind = 'in' and m.voided_at is null) rc on true;
revoke insert, update, delete on __APP__.apd_request_line_progress from authenticated, anon;

-- Stok per barang (p_warehouse null = semua gudang yang terlihat).
drop function if exists __APP__.apd_stock_overview(uuid);
create function __APP__.apd_stock_overview(p_warehouse uuid default null)
returns table (item_id uuid, code text, name text, type_id uuid, type_name text, brand text, size text, uom text, min_stock integer, is_active boolean,
               opening integer, in_qty integer, out_qty integer, return_qty integer, adjust_qty integer, stock integer, outstanding integer, last_move_on date)
language sql stable security invoker set search_path = '' as $$
  with mv as (
    select m.item_id,
           sum(m.qty) filter (where m.kind = 'opening') as opening, sum(m.qty) filter (where m.kind = 'in') as in_qty,
           sum(m.qty) filter (where m.kind = 'out') as out_qty, sum(m.qty) filter (where m.kind = 'return') as return_qty,
           sum(m.qty) filter (where m.kind = 'adjust') as adjust_qty, max(m.moved_on) as last_on
      from __APP__.apd_stock_moves m
     where m.voided_at is null and (p_warehouse is null or m.warehouse_id = p_warehouse)
     group by m.item_id),
  os as (
    select p.item_id, sum(p.outstanding) as qty
      from __APP__.apd_request_line_progress p join __APP__.apd_requests r on r.id = p.request_id
     where r.status = 'approved' and p.item_id is not null
     group by p.item_id)
  select i.id, i.code, i.name, t.id, t.name, i.brand, i.size, i.uom, i.min_stock, i.is_active,
         coalesce(mv.opening, 0)::integer, coalesce(mv.in_qty, 0)::integer, coalesce(mv.out_qty, 0)::integer,
         coalesce(mv.return_qty, 0)::integer, coalesce(mv.adjust_qty, 0)::integer,
         (coalesce(mv.opening, 0) + coalesce(mv.in_qty, 0) - coalesce(mv.out_qty, 0) + coalesce(mv.return_qty, 0) + coalesce(mv.adjust_qty, 0))::integer,
         coalesce(os.qty, 0)::integer, mv.last_on
    from __APP__.apd_items i join __APP__.apd_types t on t.id = i.type_id
    left join mv on mv.item_id = i.id left join os on os.item_id = i.id
   where i.is_active or mv.item_id is not null
   order by t.sort_order, i.code;
$$;

-- Stok per gudang per barang (pilihan gudang & ketersediaan di form IN/OUT). Hanya yang pernah bergerak.
create or replace function __APP__.apd_stock_by_warehouse()
returns table (warehouse_id uuid, item_id uuid, stock integer)
language sql stable security invoker set search_path = '' as $$
  select m.warehouse_id, m.item_id, sum(case when m.kind = 'out' then -m.qty else m.qty end)::integer
    from __APP__.apd_stock_moves m where m.voided_at is null group by m.warehouse_id, m.item_id;
$$;
revoke execute on function __APP__.apd_stock_overview(uuid), __APP__.apd_stock_by_warehouse() from public, anon;

-- ---------------------------------------------------------------- 6. impor data lama: gudang dipilih (bukan lokasi HO)
drop function if exists __APP__.apd_import_legacy(text, jsonb, jsonb);
create or replace function __APP__.apd_import_legacy(p_company text, p_sites jsonb, p jsonb, p_warehouse uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  w __APP__.apd_warehouses; v_bad text; g jsonb; v_id uuid;
  n_items integer; n_open integer; n_in integer; n_out integer; n_req integer := 0; n_lines integer := 0; v_n integer;
begin
  if not __APP__.apd_manager() then
    raise exception 'Hanya HSE, SCM/Gudang, atau admin yang bisa mengimpor data APD.' using errcode = '42501';
  end if;
  if p_company is null or not exists (select 1 from public.companies where code = p_company and not is_group)
     or not ('*' = any (__APP__.my_company_scope()) or p_company = any (__APP__.my_company_scope())) then
    raise exception 'Perusahaan tidak valid atau di luar akses Anda.' using errcode = 'P0001';
  end if;
  w := __APP__.apd_warehouse_ok(p_warehouse);
  if w.company_code <> p_company then raise exception 'Gudang bukan milik perusahaan %.', p_company using errcode = 'P0001'; end if;
  if jsonb_typeof(p -> 'items') <> 'array' or jsonb_typeof(p -> 'outs') <> 'array' or jsonb_typeof(p -> 'requests') <> 'array'
     or jsonb_typeof(p -> 'ins') <> 'array' or jsonb_typeof(p -> 'opening') <> 'array' then
    raise exception 'Data impor tidak lengkap.' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext('apd_import_legacy'));
  if exists (select 1 from __APP__.apd_stock_moves where source = 'import') or exists (select 1 from __APP__.apd_requests where source = 'import') then
    raise exception 'Data lama Monitoring APD sudah pernah diimpor.' using errcode = 'P0001';
  end if;

  -- kode site yang dipakai pengiriman & pengajuan (site karyawan) harus dipetakan ke lokasi
  select string_agg(u.s, ', ' order by u.s) into v_bad from (
    select x ->> 'site' as s from jsonb_array_elements(p -> 'outs') x
    union select x ->> 'site' from jsonb_array_elements(p -> 'requests') x) u
   where not exists (select 1 from public.locations l where l.id::text = coalesce(p_sites ->> u.s, ''));
  if v_bad is not null then raise exception 'Pilih lokasi untuk site: %.', v_bad using errcode = 'P0001'; end if;

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

  insert into __APP__.apd_stock_moves (company_code, warehouse_id, location_id, kind, item_id, qty, moved_on, ref_no, note, source)
  select p_company, w.id, w.location_id, 'opening', i.id, (x ->> 'qty')::integer, (p ->> 'opening_date')::date, 'SO Excel', 'Stok awal (kolom SO sheet Update Stock)', 'import'
    from jsonb_array_elements(p -> 'opening') x join __APP__.apd_items i on i.code = x ->> 'code';
  get diagnostics n_open = row_count;

  insert into __APP__.apd_stock_moves (company_code, warehouse_id, location_id, kind, item_id, qty, moved_on, ref_no, pic, note, source)
  select p_company, w.id, w.location_id, 'in', i.id, (x ->> 'qty')::integer, (x ->> 'date')::date, x ->> 'ref', x ->> 'pic', x ->> 'note', 'import'
    from jsonb_array_elements(p -> 'ins') x join __APP__.apd_items i on i.code = x ->> 'code';
  get diagnostics n_in = row_count;

  insert into __APP__.apd_stock_moves (company_code, warehouse_id, location_id, kind, item_id, qty, moved_on, ref_no, pic, dest_location_id, recipient_name, note, source)
  select p_company, w.id, w.location_id, 'out', i.id, (x ->> 'qty')::integer, (x ->> 'date')::date, x ->> 'bast', x ->> 'pic', (p_sites ->> (x ->> 'site'))::uuid,
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
revoke execute on function __APP__.apd_import_legacy(text, jsonb, jsonb, uuid) from public, anon;

-- label aksi riwayat
create or replace function __APP__.action_label(p_action text)
returns text language sql immutable set search_path = '' as $$
  select case p_action
    when 'create' then 'dibuat'          when 'update' then 'diubah'
    when 'delete' then 'dihapus'         when 'submit' then 'diajukan'
    when 'approve' then 'disetujui'      when 'reject' then 'ditolak'
    when 'cancel' then 'ditarik'         when 'followup' then 'di-follow-up'
    when 'override' then 'approval diubah admin'
    when 'admin_edit' then 'diedit admin'
    when 'report' then 'dilaporkan'      when 'classify' then 'diklasifikasi'
    when 'start_investigation' then 'investigasi dimulai'
    when 'save_investigation' then 'investigasi diperbarui'
    when 'submit_review' then 'dikirim ke review'
    when 'approve_ehs' then 'disetujui EHS'
    when 'approve_mgmt' then 'disetujui manajemen'
    when 'return' then 'dikembalikan'    when 'close' then 'ditutup'
    when 'close_exception' then 'ditutup dengan pengecualian'
    when 'start' then 'dimulai'          when 'submit_evidence' then 'bukti dikirim'
    when 'accept' then 'diterima'        when 'change_due' then 'due date diubah'
    when 'effectiveness' then 'efektivitas dicatat'
    when 'actions_done' then 'semua tindakan selesai'
    when 'schedule' then 'dijadwalkan'   when 'verify' then 'diverifikasi'
    when 'stock_opening' then 'stok awal dicatat'   when 'stock_in' then 'barang masuk dicatat'
    when 'stock_out' then 'APD dikirim'             when 'stock_return' then 'APD kembali ke gudang'
    when 'stock_adjust' then 'stok disesuaikan'     when 'void' then 'dibatalkan'
    when 'set_mr' then 'nomor MR dilengkapi'
    else replace(p_action, '_', ' ') end;
$$;
