-- =====================================================================================
-- 24 MONITORING APD (Safe Hub, fase 6)
--   spesifikasi docs/spec/fase-6-apd.md (U1-U4, P1-P12) · sumber: folder "Monitoring APD/" (Excel + 2 form)
--
-- Jenis APD (masa periodik, U1/P1) ≠ barang (kode SS-01-40, P2). Stok = buku besar mutasi (P3), tidak disimpan.
-- Pengajuan APD = dokumen jenis A (doc_type 'apd_request', P4/P5); pemenuhan = OUT yang ditautkan ke baris (P6).
-- Riwayat & jatuh tempo per karyawan per jenis = turunan dari OUT + riwayat awal (P9).
-- Pola 17-20: tulis HANYA lewat RPC security definer; baca = RLS.
-- =====================================================================================

-- ---------------------------------------------------------------- helper
-- Kelola barang, stok, mutasi: HSE, HSE Senior, SCM/Gudang, admin (bukan auditor) (P8)
create or replace function __APP__.apd_manager()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_app_role('__APP__', 'admin')
      or (__APP__.k3_writer() and __APP__.has_any_function(array['hse', 'hse_senior', 'scm']));
$$;
-- Ubah masa periodik (kebijakan HSE): HSE, HSE Senior, admin
create or replace function __APP__.apd_policy_editor()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_app_role('__APP__', 'admin')
      or (__APP__.k3_writer() and __APP__.has_any_function(array['hse', 'hse_senior']));
$$;
-- Karyawan yang terhubung ke akun pemanggil (untuk "APD saya" dan pengajuan milik sendiri)
create or replace function __APP__.my_employee_ids()
returns uuid[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(e.id), '{}') from __APP__.employees e where e.profile_id = auth.uid();
$$;
revoke execute on function __APP__.apd_manager(), __APP__.apd_policy_editor(), __APP__.my_employee_ids() from public, anon;

-- =====================================================================================
-- TABEL
-- =====================================================================================
-- Jenis APD + masa periodik (P1). interval_days null = tanpa periodik (mis. padlock); tracked = lacak jatuh tempo.
create table __APP__.apd_types (
  id             uuid primary key default gen_random_uuid(),
  code           text not null unique check (code ~ '^[a-z][a-z0-9_]{1,40}$'),
  name           text not null check (length(btrim(name)) between 2 and 80),
  spec           text check (length(spec) <= 200),                    -- standar, mis. ANSI Z41
  interval_days  smallint check (interval_days is null or interval_days between 1 and 3650),
  interval_label text check (length(interval_label) <= 60),           -- label asli Matrix APD, mis. "2x setahun"
  warn_days      smallint not null default 30 check (warn_days between 0 and 365),
  tracked        boolean not null default true,
  size_kind      text not null default 'none' check (size_kind in ('none', 'clothing', 'shoe', 'waist', 'color')),
  note           text check (length(note) <= 500),
  sort_order     integer not null default 0,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (not tracked or interval_days is not null)
);
comment on table __APP__.apd_types is 'Jenis APD + masa periodik (nilai awal = Matrix APD, 24 Feb 2026). Ditulis lewat apd_type_save.';

-- Barang (kode gudang). Tanpa harga (P11).
create table __APP__.apd_items (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique check (code ~ '^[A-Z0-9][A-Z0-9-]{1,29}$'),
  name       text not null check (length(btrim(name)) between 2 and 120),
  type_id    uuid not null references __APP__.apd_types(id),
  brand      text check (length(brand) <= 60),
  size       text check (length(size) <= 20),                        -- ukuran / warna
  uom        text not null default 'Pcs' check (length(btrim(uom)) between 1 and 20),
  min_stock  integer not null default 0 check (min_stock between 0 and 100000),
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index apd_items_type_idx on __APP__.apd_items (type_id, is_active);

-- Pengajuan APD (jenis A). employee_id kosong hanya untuk data lama (P7).
create table __APP__.apd_requests (
  id               uuid primary key default gen_random_uuid(),
  company_code     text not null references public.companies(code),
  location_id      uuid not null references public.locations(id),          -- site karyawan
  code             text not null,                                          -- APD-2026-0001
  employee_id      uuid references __APP__.employees(id) on delete set null,
  recipient_name   text not null check (length(btrim(recipient_name)) between 2 and 120),
  job_title        text check (length(job_title) <= 80),
  reason           text not null check (reason in ('new_hire', 'periodic', 'damaged', 'lost')),
  negligence       boolean not null default false,                         -- rusak karena kelalaian
  incident_on      date,                                                   -- tgl kehilangan / kerusakan
  last_received_on date,                                                   -- terakhir dapat APD (isian pemohon)
  explanation      text check (length(explanation) <= 2000),
  deduction_ack    boolean not null default false,                         -- pernyataan potong gaji
  mr_no            text check (length(mr_no) <= 60),                       -- nomor MR sistem perusahaan
  requested_on     date,                                                   -- tanggal diajukan (data lama: tanggal MR, boleh kosong)
  approved_on      date,
  status           text not null default 'draft' check (status in ('draft', 'pending_approval', 'rejected', 'approved', 'cancelled')),
  source           text not null default 'app' check (source in ('app', 'import')),
  evidence_count   integer not null default 0 check (evidence_count >= 0),
  cancel_note      text check (length(cancel_note) <= 1000),
  search_text      text,
  created_by       uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (source = 'import' or employee_id is not null),
  unique (company_code, code)
);
create index apd_requests_list_idx on __APP__.apd_requests (company_code, location_id, status, created_at desc);
create index apd_requests_employee_idx on __APP__.apd_requests (employee_id) where employee_id is not null;
create index apd_requests_search_idx on __APP__.apd_requests using gin (search_text extensions.gin_trgm_ops);

create table __APP__.apd_request_lines (
  id              uuid primary key default gen_random_uuid(),
  request_id      uuid not null references __APP__.apd_requests(id) on delete cascade,
  line_no         smallint not null check (line_no between 1 and 50),
  type_id         uuid not null references __APP__.apd_types(id),
  item_id         uuid references __APP__.apd_items(id),                  -- barang spesifik (opsional)
  size            text check (length(size) <= 20),
  qty             integer not null check (qty between 1 and 500),
  legacy_supplied integer not null default 0 check (legacy_supplied >= 0),  -- "qty supply" sheet MR lama (P6)
  note            text check (length(note) <= 500),
  unique (request_id, line_no)
);
create index apd_request_lines_item_idx on __APP__.apd_request_lines (item_id) where item_id is not null;

-- Buku besar stok (P3). qty selalu positif kecuali adjust (+/-). Batal = voided_at (tidak dihapus).
create table __APP__.apd_stock_moves (
  id               uuid primary key default gen_random_uuid(),
  company_code     text not null references public.companies(code),
  location_id      uuid not null references public.locations(id),          -- gudang
  kind             text not null check (kind in ('opening', 'in', 'out', 'return', 'adjust')),
  item_id          uuid not null references __APP__.apd_items(id),
  qty              integer not null check (qty <> 0 and qty between -100000 and 100000),
  moved_on         date not null,
  ref_no           text check (length(ref_no) <= 60),                      -- no PR/MR (IN), no BAST (OUT)
  pic              text check (length(pic) <= 120),                        -- PIC penerimaan / pengiriman
  dest_location_id uuid references public.locations(id),                   -- site tujuan (OUT)
  employee_id      uuid references __APP__.employees(id) on delete set null,
  recipient_name   text check (length(recipient_name) <= 120),
  request_line_id  uuid references __APP__.apd_request_lines(id) on delete set null,
  note             text check (length(note) <= 500),
  source           text not null default 'app' check (source in ('app', 'import')),
  voided_at        timestamptz,
  void_reason      text check (length(void_reason) <= 1000),
  created_by       uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (kind = 'adjust' or qty > 0),
  check (kind <> 'out' or (dest_location_id is not null and recipient_name is not null))
);
create index apd_stock_moves_item_idx on __APP__.apd_stock_moves (location_id, item_id) where voided_at is null;
create index apd_stock_moves_list_idx on __APP__.apd_stock_moves (company_code, moved_on desc, created_at desc);
create index apd_stock_moves_employee_idx on __APP__.apd_stock_moves (employee_id, moved_on desc) where employee_id is not null and voided_at is null;
create index apd_stock_moves_line_idx on __APP__.apd_stock_moves (request_line_id) where request_line_id is not null and voided_at is null;
-- satu stok awal (SO) per barang per gudang; opname berikutnya = adjust
create unique index apd_stock_moves_opening_uq on __APP__.apd_stock_moves (location_id, item_id) where kind = 'opening' and voided_at is null;

-- Ukuran APD per karyawan per jenis (dari Form Request / Populasi Manpower). Tidak dilog (bukan data sensitif).
create table __APP__.apd_employee_sizes (
  employee_id uuid not null references __APP__.employees(id) on delete cascade,
  type_id     uuid not null references __APP__.apd_types(id),
  size        text not null check (length(btrim(size)) between 1 and 20),
  updated_by  uuid references public.profiles(id) on delete set null default auth.uid(),
  updated_at  timestamptz not null default now(),
  primary key (employee_id, type_id)
);

-- Riwayat penerimaan SEBELUM sistem (sheet Populasi Manpower; U2: dimuat setelah daftar NRP). Hanya dari migration data.
create table __APP__.apd_issue_history (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references __APP__.employees(id) on delete cascade,
  type_id     uuid not null references __APP__.apd_types(id),
  issued_on   date not null,
  qty         integer check (qty is null or qty between 1 and 100),
  size        text check (length(size) <= 20),
  note        text check (length(note) <= 500),
  created_at  timestamptz not null default now()
);
create index apd_issue_history_idx on __APP__.apd_issue_history (employee_id, type_id, issued_on desc);

-- log (tanpa FK, K4)
do $$
declare t text;
begin
  foreach t in array array['apd_types', 'apd_items', 'apd_requests', 'apd_stock_moves'] loop
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
create trigger apd_types_log after insert or update or delete on __APP__.apd_types
  for each row execute function __APP__.log_changes('config', '/apd?tab=periodik&jenis=', 'Jenis APD');
create trigger apd_items_log after insert or update or delete on __APP__.apd_items
  for each row execute function __APP__.log_changes('config', '/apd?tab=barang&barang=', 'Barang APD');
create trigger apd_requests_log after insert or update or delete on __APP__.apd_requests
  for each row execute function __APP__.log_changes('important', '/apd/pengajuan/', 'Pengajuan APD');
create trigger apd_stock_moves_log after insert or update or delete on __APP__.apd_stock_moves
  for each row execute function __APP__.log_changes('important', '/apd?tab=mutasi&mutasi=', 'Mutasi APD');

create or replace function __APP__.apd_requests_search()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.search_text := lower(concat_ws(' ', new.code, new.recipient_name, new.job_title, new.mr_no, new.explanation));
  return new;
end $$;
create trigger apd_requests_search before insert or update on __APP__.apd_requests
  for each row execute function __APP__.apd_requests_search();

-- ---------------------------------------------------------------- RLS
alter table __APP__.apd_types enable row level security;
alter table __APP__.apd_items enable row level security;
alter table __APP__.apd_requests enable row level security;
alter table __APP__.apd_request_lines enable row level security;
alter table __APP__.apd_stock_moves enable row level security;
alter table __APP__.apd_employee_sizes enable row level security;
alter table __APP__.apd_issue_history enable row level security;
alter table __APP__.apd_types_logs enable row level security;
alter table __APP__.apd_items_logs enable row level security;
alter table __APP__.apd_requests_logs enable row level security;
alter table __APP__.apd_stock_moves_logs enable row level security;
revoke insert, update, delete on __APP__.apd_types, __APP__.apd_items, __APP__.apd_requests, __APP__.apd_request_lines,
  __APP__.apd_stock_moves, __APP__.apd_employee_sizes, __APP__.apd_issue_history,
  __APP__.apd_types_logs, __APP__.apd_items_logs, __APP__.apd_requests_logs, __APP__.apd_stock_moves_logs from authenticated, anon;

-- master: semua pengguna app (Karyawan perlu nama jenis/barang untuk pengajuannya)
create policy "apd_types: viewer read" on __APP__.apd_types for select to authenticated
  using ((select public.has_app_role('__APP__', 'viewer')));
create policy "apd_items: viewer read" on __APP__.apd_items for select to authenticated
  using ((select public.has_app_role('__APP__', 'viewer')));

-- pengajuan: pemohon, karyawan ybs, approver, staf K3 dalam scope (P8)
create policy "apd_requests: read" on __APP__.apd_requests for select to authenticated
  using ((select public.has_app_role('__APP__', 'viewer')) and (
    created_by = (select auth.uid())
    or employee_id = any ((select __APP__.my_employee_ids())::uuid[])
    or exists (select 1 from __APP__.approvals a where a.doc_type = 'apd_request' and a.record_id = id and a.approver_id = (select auth.uid()))
    or ((select __APP__.k3_staff())
        and ('*' = any ((select __APP__.my_company_scope())::text[]) or company_code = any ((select __APP__.my_company_scope())::text[]))
        and ('*' = any ((select __APP__.my_location_scope())::text[]) or location_id::text = any ((select __APP__.my_location_scope())::text[])))));
create policy "apd_request_lines: read with request" on __APP__.apd_request_lines for select to authenticated
  using (exists (select 1 from __APP__.apd_requests r where r.id = request_id));

-- mutasi: staf K3 dalam scope gudang ATAU site tujuan; karyawan melihat penerimaan miliknya
create policy "apd_stock_moves: read" on __APP__.apd_stock_moves for select to authenticated
  using ((select public.has_app_role('__APP__', 'viewer')) and (
    employee_id = any ((select __APP__.my_employee_ids())::uuid[])
    or ((select __APP__.k3_staff())
        and ('*' = any ((select __APP__.my_company_scope())::text[]) or company_code = any ((select __APP__.my_company_scope())::text[]))
        and ('*' = any ((select __APP__.my_location_scope())::text[]) or location_id::text = any ((select __APP__.my_location_scope())::text[])
             or dest_location_id::text = any ((select __APP__.my_location_scope())::text[])))));

create policy "apd_employee_sizes: read with employee" on __APP__.apd_employee_sizes for select to authenticated
  using (employee_id = any ((select __APP__.my_employee_ids())::uuid[]) or exists (select 1 from __APP__.employees e where e.id = employee_id));
create policy "apd_issue_history: read with employee" on __APP__.apd_issue_history for select to authenticated
  using (employee_id = any ((select __APP__.my_employee_ids())::uuid[]) or exists (select 1 from __APP__.employees e where e.id = employee_id));

create policy "apd_types_logs: staff read" on __APP__.apd_types_logs for select to authenticated using ((select __APP__.k3_staff()));
create policy "apd_items_logs: staff read" on __APP__.apd_items_logs for select to authenticated using ((select __APP__.k3_staff()));
create policy "apd_requests_logs: read with record" on __APP__.apd_requests_logs for select to authenticated
  using (exists (select 1 from __APP__.apd_requests r where r.id = record_id) or (select public.has_app_role('__APP__', 'admin')));
create policy "apd_stock_moves_logs: read with record" on __APP__.apd_stock_moves_logs for select to authenticated
  using (exists (select 1 from __APP__.apd_stock_moves m where m.id = record_id) or (select public.has_app_role('__APP__', 'admin')));

-- =====================================================================================
-- DATA ACUAN: jenis APD dari Matrix APD (U1, P1, P2). Bagian dari migration (bukan data demo).
-- =====================================================================================
insert into __APP__.apd_types (code, name, spec, interval_days, interval_label, warn_days, tracked, size_kind, note, sort_order) values
  ('safety_shoes',   'Safety Shoes',          'ANSI Z41-1991/1999',                 365,  '1x per 1 tahun', 60, true,  'shoe',
   'Tergantung pemakaian (terutama tim site); rusak sebelum waktunya diganti dengan form + evidence.', 10),
  ('safety_helmet',  'Safety Helmet',         'ANSI Z89.1 (Top Guard)',             1095, '1x per 3 tahun', 90, true,  'color',
   'Tergantung pemakaian, terutama chin strap; rusak sebelum waktunya diganti dengan form + evidence.', 20),
  ('safety_glass',   'Safety Glass',          'ANSI Z87.1',                         91,   '4x setahun',     14, true,  'color', null, 30),
  ('safety_vest',    'Safety Vest (Rompi)',   null,                                 365,  '1x setahun',     60, true,  'color',
   'Untuk beberapa site yang menggunakan rompi.', 40),
  ('uniform_shirt',  'Kemeja Safety',         null,                                 182,  '2x setahun',     30, true,  'clothing',
   'Uniform/Wearpack. Tergantung pemakaian; rusak sebelum waktunya diganti dengan form + evidence.', 50),
  ('uniform_tshirt', 'Kaos Safety',           null,                                 182,  '2x setahun',     30, true,  'clothing',
   'Uniform/Wearpack.', 60),
  ('uniform_pants',  'Celana / Jeans Kerja',  null,                                 182,  '2x setahun',     30, true,  'waist',
   'Uniform/Wearpack & Celana.', 70),
  ('safety_glove',   'Safety Glove',          null,                                 7,    '1x seminggu',    0,  false, 'none',
   'Habis pakai: jatuh tempo tidak dilacak.', 80),
  ('welding_glove',  'Safety Welding Glove',  null,                                 182,  '2x setahun',     30, true,  'none', null, 90),
  ('mask_carbon',    'Masker Carbon / Respirator', 'ANSI Z88.2, MSHA',              182,  '2x setahun',     30, true,  'none', null, 100),
  ('earplug',        'Ear Plug',              'ANSI S3.19-1974, ANSI S12.6',        91,   '4x setahun',     14, true,  'none', null, 110),
  ('earmuff',        'Ear Muff',              'ANSI S3.19-1974, ANSI S12.6',        182,  '2x setahun',     30, true,  'none',
   'Yang diganti hanya bantalan telinga.', 120),
  ('welding_cap',    'Cap Las',               null,                                 730,  '1x per 2 tahun', 90, true,  'none', null, 130),
  ('apron',          'Apron',                 null,                                 182,  '2x setahun',     30, true,  'none', null, 140),
  ('face_shield',    'Face Shield',           null,                                 182,  '2x setahun',     30, true,  'none', null, 150),
  ('body_harness',   'Body Harness',          null,                                 1095, 'Per 3 tahun',    90, true,  'none',
   'Tergantung kekuatan sling-nya.', 160),
  ('padlock',        'Padlock (LOTO)',        'LOTO',                               null, null,             0,  false, 'color', null, 170),
  ('glove_hanger',   'Gantungan Sarung Tangan', null,                               null, null,             0,  false, 'none', null, 180)
on conflict (code) do nothing;

-- =====================================================================================
-- RPC MASTER
-- =====================================================================================
-- p: {code?, name, spec?, interval_days?, interval_label?, warn_days, tracked, size_kind, note?, sort_order?, is_active?}
-- Kode tetap setelah dibuat.
create or replace function __APP__.apd_type_save(p_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := p_id; v_int smallint := nullif(p ->> 'interval_days', '')::smallint; v_tracked boolean := coalesce((p ->> 'tracked')::boolean, true);
begin
  if not __APP__.apd_policy_editor() then raise exception 'Hanya HSE, HSE Senior, atau admin yang bisa mengubah masa periodik APD.' using errcode = '42501'; end if;
  if length(btrim(coalesce(p ->> 'name', ''))) < 2 then raise exception 'Nama jenis APD wajib diisi.' using errcode = 'P0001'; end if;
  if v_tracked and v_int is null then raise exception 'Isi masa periodik (hari) untuk jenis yang dilacak jatuh temponya.' using errcode = 'P0001'; end if;
  if v_id is null then
    if coalesce(p ->> 'code', '') !~ '^[a-z][a-z0-9_]{1,40}$' then raise exception 'Kode jenis: huruf kecil, angka, garis bawah.' using errcode = 'P0001'; end if;
    insert into __APP__.apd_types (code, name, spec, interval_days, interval_label, warn_days, tracked, size_kind, note, sort_order)
    values (p ->> 'code', btrim(p ->> 'name'), nullif(btrim(p ->> 'spec'), ''), v_int, nullif(btrim(p ->> 'interval_label'), ''),
            coalesce(nullif(p ->> 'warn_days', '')::smallint, 30), v_tracked, coalesce(nullif(p ->> 'size_kind', ''), 'none'),
            nullif(btrim(p ->> 'note'), ''), coalesce(nullif(p ->> 'sort_order', '')::integer, 0))
    returning id into v_id;
  else
    update __APP__.apd_types set name = btrim(p ->> 'name'), spec = nullif(btrim(p ->> 'spec'), ''), interval_days = v_int,
           interval_label = nullif(btrim(p ->> 'interval_label'), ''), warn_days = coalesce(nullif(p ->> 'warn_days', '')::smallint, warn_days),
           tracked = v_tracked, size_kind = coalesce(nullif(p ->> 'size_kind', ''), size_kind), note = nullif(btrim(p ->> 'note'), ''),
           sort_order = coalesce(nullif(p ->> 'sort_order', '')::integer, sort_order), is_active = coalesce((p ->> 'is_active')::boolean, is_active)
     where id = v_id;
    if not found then raise exception 'Jenis APD tidak ditemukan.' using errcode = 'P0001'; end if;
  end if;
  return jsonb_build_object('id', v_id);
end $$;

-- p: {code, name, type_id, brand?, size?, uom?, min_stock?, is_active?}. Kode tetap setelah dibuat.
create or replace function __APP__.apd_item_save(p_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id uuid := p_id; v_type uuid := nullif(p ->> 'type_id', '')::uuid; v_code text := upper(btrim(coalesce(p ->> 'code', '')));
begin
  if not __APP__.apd_manager() then raise exception 'Hanya HSE, SCM/Gudang, atau admin yang bisa mengelola barang APD.' using errcode = '42501'; end if;
  if length(btrim(coalesce(p ->> 'name', ''))) < 2 then raise exception 'Nama barang wajib diisi.' using errcode = 'P0001'; end if;
  if v_type is null or not exists (select 1 from __APP__.apd_types where id = v_type and is_active) then raise exception 'Pilih jenis APD.' using errcode = 'P0001'; end if;
  if v_id is null then
    if v_code !~ '^[A-Z0-9][A-Z0-9-]{1,29}$' then raise exception 'Kode barang: huruf besar, angka, tanda minus (mis. SS-01-40).' using errcode = 'P0001'; end if;
    if exists (select 1 from __APP__.apd_items where code = v_code) then raise exception 'Kode barang % sudah dipakai.', v_code using errcode = 'P0001'; end if;
    insert into __APP__.apd_items (code, name, type_id, brand, size, uom, min_stock)
    values (v_code, btrim(p ->> 'name'), v_type, nullif(btrim(p ->> 'brand'), ''), nullif(btrim(p ->> 'size'), ''),
            coalesce(nullif(btrim(p ->> 'uom'), ''), 'Pcs'), coalesce(nullif(p ->> 'min_stock', '')::integer, 0))
    returning id into v_id;
  else
    update __APP__.apd_items set name = btrim(p ->> 'name'), type_id = v_type, brand = nullif(btrim(p ->> 'brand'), ''),
           size = nullif(btrim(p ->> 'size'), ''), uom = coalesce(nullif(btrim(p ->> 'uom'), ''), uom),
           min_stock = coalesce(nullif(p ->> 'min_stock', '')::integer, min_stock), is_active = coalesce((p ->> 'is_active')::boolean, is_active)
     where id = v_id;
    if not found then raise exception 'Barang tidak ditemukan.' using errcode = 'P0001'; end if;
  end if;
  return jsonb_build_object('id', v_id);
end $$;

-- Ukuran per karyawan per jenis. size kosong = hapus.
create or replace function __APP__.apd_size_set(p_employee uuid, p_type uuid, p_size text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare e __APP__.employees;
begin
  if not (__APP__.apd_manager() or __APP__.people_manager()) then raise exception 'Hanya HR, HSE, SCM/Gudang, atau admin yang bisa mengubah ukuran APD.' using errcode = '42501'; end if;
  select * into e from __APP__.employees where id = p_employee;
  if e.id is null or not __APP__.k3_in_scope(e.company_code, e.location_id) then raise exception 'Karyawan tidak ditemukan.' using errcode = 'P0001'; end if;
  if not exists (select 1 from __APP__.apd_types where id = p_type) then raise exception 'Jenis APD tidak ditemukan.' using errcode = 'P0001'; end if;
  if nullif(btrim(coalesce(p_size, '')), '') is null then
    delete from __APP__.apd_employee_sizes where employee_id = p_employee and type_id = p_type;
  else
    insert into __APP__.apd_employee_sizes (employee_id, type_id, size) values (p_employee, p_type, left(btrim(p_size), 20))
    on conflict (employee_id, type_id) do update set size = excluded.size, updated_by = auth.uid(), updated_at = now();
  end if;
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function __APP__.apd_type_save(uuid, jsonb), __APP__.apd_item_save(uuid, jsonb), __APP__.apd_size_set(uuid, uuid, text) from public, anon;

-- =====================================================================================
-- STOK
-- =====================================================================================
-- Stok satu barang di satu gudang (mutasi tidak dibatalkan). Internal.
create or replace function __APP__.apd_stock_qty(p_location uuid, p_item uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select coalesce(sum(case when kind = 'out' then -qty else qty end), 0)::integer
    from __APP__.apd_stock_moves where location_id = p_location and item_id = p_item and voided_at is null;
$$;
revoke execute on function __APP__.apd_stock_qty(uuid, uuid) from public, anon, authenticated;

-- Terkirim per baris pengajuan (OUT tertaut + qty supply data lama)
create or replace function __APP__.apd_line_supplied(p_line uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select coalesce((select sum(m.qty) from __APP__.apd_stock_moves m where m.request_line_id = p_line and m.kind = 'out' and m.voided_at is null), 0)::integer
       + coalesce((select l.legacy_supplied from __APP__.apd_request_lines l where l.id = p_line), 0);
$$;
revoke execute on function __APP__.apd_line_supplied(uuid) from public, anon, authenticated;

-- p: {company_code?, location_id, kind, item_id, qty, moved_on, ref_no?, pic?, dest_location_id?, employee_id?, recipient_name?,
--     request_line_id?, note?}
-- OUT/adjust minus ditolak bila stok kurang (P3). OUT dengan request_line_id: pengajuan disetujui, jenis sama, qty <= sisa (P6).
create or replace function __APP__.apd_move_save(p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_company text; v_loc uuid := nullif(p ->> 'location_id', '')::uuid; v_kind text := p ->> 'kind';
  v_item __APP__.apd_items; v_qty integer := nullif(p ->> 'qty', '')::integer; v_on date := nullif(p ->> 'moved_on', '')::date;
  v_dest uuid := nullif(p ->> 'dest_location_id', '')::uuid; v_emp uuid := nullif(p ->> 'employee_id', '')::uuid;
  v_name text := nullif(btrim(p ->> 'recipient_name'), ''); v_line uuid := nullif(p ->> 'request_line_id', '')::uuid;
  v_note text := nullif(btrim(p ->> 'note'), ''); e __APP__.employees; r __APP__.apd_requests; l __APP__.apd_request_lines;
  v_stock integer; v_os integer; v_id uuid; v_notif jsonb := '[]';
begin
  if not __APP__.apd_manager() then raise exception 'Hanya HSE, SCM/Gudang, atau admin yang bisa mencatat mutasi APD.' using errcode = '42501'; end if;
  v_company := __APP__.people_company(p);
  if v_loc is null or not __APP__.k3_in_scope(v_company, v_loc) then raise exception 'Gudang tidak valid atau di luar akses Anda.' using errcode = 'P0001'; end if;
  if coalesce(v_kind, '') not in ('opening', 'in', 'out', 'return', 'adjust') then raise exception 'Jenis mutasi tidak valid.' using errcode = 'P0001'; end if;
  select * into v_item from __APP__.apd_items where id = nullif(p ->> 'item_id', '')::uuid;
  if v_item.id is null or not v_item.is_active then raise exception 'Pilih barang APD yang aktif.' using errcode = 'P0001'; end if;
  if v_qty is null or v_qty = 0 or (v_kind <> 'adjust' and v_qty < 0) then raise exception 'Jumlah harus lebih dari 0.' using errcode = 'P0001'; end if;
  if v_on is null or v_on > __APP__.today_wib() then raise exception 'Tanggal tidak valid (tidak boleh di masa depan).' using errcode = 'P0001'; end if;
  if v_kind = 'adjust' and length(coalesce(v_note, '')) < 10 then raise exception 'Penyesuaian stok wajib beralasan minimal 10 karakter.' using errcode = 'P0001'; end if;
  if v_kind = 'opening' and exists (select 1 from __APP__.apd_stock_moves where location_id = v_loc and item_id = v_item.id and kind = 'opening' and voided_at is null) then
    raise exception 'Stok awal barang ini sudah dicatat. Gunakan Penyesuaian untuk hasil stock opname berikutnya.' using errcode = 'P0001';
  end if;

  if v_kind = 'out' then
    if v_line is not null then
      select * into l from __APP__.apd_request_lines where id = v_line;
      select * into r from __APP__.apd_requests where id = l.request_id;
      if r.id is null or r.company_code <> v_company then raise exception 'Baris pengajuan tidak ditemukan.' using errcode = 'P0001'; end if;
      if r.status <> 'approved' then raise exception 'Pengajuan % belum disetujui.', r.code using errcode = 'P0001'; end if;
      if l.type_id <> v_item.type_id then raise exception 'Barang tidak sesuai jenis APD yang diajukan.' using errcode = 'P0001'; end if;
      perform pg_advisory_xact_lock(hashtext('apd_line:' || v_line));
      v_os := l.qty - __APP__.apd_line_supplied(v_line);
      if v_qty > v_os then raise exception 'Jumlah melebihi sisa pengajuan (sisa %).', greatest(v_os, 0) using errcode = 'P0001'; end if;
      v_emp := r.employee_id; v_name := r.recipient_name; v_dest := coalesce(v_dest, r.location_id);
    elsif v_emp is not null then
      select * into e from __APP__.employees where id = v_emp;
      if e.id is null or e.company_code <> v_company then raise exception 'Karyawan tidak ditemukan.' using errcode = 'P0001'; end if;
      v_name := e.name; v_dest := coalesce(v_dest, e.location_id);
    end if;
    if v_name is null or length(v_name) < 2 then raise exception 'Isi penerima (karyawan atau nama).' using errcode = 'P0001'; end if;
    if v_dest is null or not exists (select 1 from public.locations where id = v_dest) then raise exception 'Pilih site tujuan.' using errcode = 'P0001'; end if;
  elsif v_kind = 'return' then
    if v_emp is not null then
      select * into e from __APP__.employees where id = v_emp;
      if e.id is null or e.company_code <> v_company then raise exception 'Karyawan tidak ditemukan.' using errcode = 'P0001'; end if;
      v_name := e.name;
    end if;
    v_dest := null; v_line := null;
  else
    v_dest := null; v_emp := null; v_line := null; v_name := null;
  end if;

  if v_kind = 'out' or (v_kind = 'adjust' and v_qty < 0) then
    perform pg_advisory_xact_lock(hashtext('apd_stock:' || v_loc || ':' || v_item.id));
    v_stock := __APP__.apd_stock_qty(v_loc, v_item.id);
    if v_stock < abs(v_qty) then raise exception 'Stok % tidak cukup (tersedia %).', v_item.code, v_stock using errcode = 'P0001'; end if;
  end if;

  perform __APP__.set_log_context('stock_' || v_kind, v_note);
  insert into __APP__.apd_stock_moves (company_code, location_id, kind, item_id, qty, moved_on, ref_no, pic, dest_location_id, employee_id,
                                       recipient_name, request_line_id, note)
  values (v_company, v_loc, v_kind, v_item.id, v_qty, v_on, nullif(btrim(p ->> 'ref_no'), ''), nullif(btrim(p ->> 'pic'), ''), v_dest, v_emp,
          v_name, v_line, v_note)
  returning id into v_id;
  perform __APP__.set_log_context('', '');

  -- penerima berakun diberi tahu APD dikirim
  if v_kind = 'out' and v_emp is not null then
    select coalesce(jsonb_agg(n), '[]') into v_notif from __APP__.notify(
      (select coalesce(array_agg(profile_id), '{}') from __APP__.employees where id = v_emp and profile_id is not null),
      'apd_issued', 'APD dikirim: ' || v_item.name || ' (' || v_qty || ' ' || v_item.uom || ')',
      case when r.id is not null then 'Untuk pengajuan ' || r.code end,
      case when r.id is not null then '/apd/pengajuan/' || r.id else '/apd/saya' end, 'apd', 'apd_stock_moves', v_id::text) n;
  end if;
  return jsonb_build_object('id', v_id, 'stock', __APP__.apd_stock_qty(v_loc, v_item.id), 'notification_ids', v_notif);
end $$;

-- Batalkan mutasi yang salah catat (tidak dihapus). Stok tidak boleh jadi minus karena pembatalan.
create or replace function __APP__.apd_move_void(p_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare m __APP__.apd_stock_moves; v_stock integer; v_delta integer;
begin
  if not __APP__.apd_manager() then raise exception 'Hanya HSE, SCM/Gudang, atau admin yang bisa membatalkan mutasi.' using errcode = '42501'; end if;
  select * into m from __APP__.apd_stock_moves where id = p_id;
  if m.id is null or not __APP__.k3_in_scope(m.company_code, m.location_id) then raise exception 'Mutasi tidak ditemukan.' using errcode = 'P0001'; end if;
  if m.voided_at is not null then raise exception 'Mutasi sudah dibatalkan.' using errcode = 'P0001'; end if;
  if length(btrim(coalesce(p_reason, ''))) < 10 then raise exception 'Alasan pembatalan minimal 10 karakter.' using errcode = 'P0001'; end if;
  v_delta := case when m.kind = 'out' then m.qty else -m.qty end;          -- efek pembatalan ke stok
  if v_delta < 0 then
    perform pg_advisory_xact_lock(hashtext('apd_stock:' || m.location_id || ':' || m.item_id));
    v_stock := __APP__.apd_stock_qty(m.location_id, m.item_id);
    if v_stock + v_delta < 0 then raise exception 'Pembatalan membuat stok minus (tersedia %). Batalkan dulu pengeluaran sesudahnya.', v_stock using errcode = 'P0001'; end if;
  end if;
  perform __APP__.set_log_context('void', btrim(p_reason));
  update __APP__.apd_stock_moves set voided_at = now(), void_reason = btrim(p_reason) where id = p_id;
  perform __APP__.set_log_context('', '');
  return jsonb_build_object('ok', true, 'stock', __APP__.apd_stock_qty(m.location_id, m.item_id));
end $$;
revoke execute on function __APP__.apd_move_save(jsonb), __APP__.apd_move_void(uuid, text) from public, anon;

-- =====================================================================================
-- PENGAJUAN (jenis A, doc_type apd_request)
-- =====================================================================================
create or replace function __APP__.apd_request_visible(p_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from __APP__.apd_requests r
     where r.id = p_id and public.has_app_role('__APP__', 'viewer') and (
       r.created_by = auth.uid() or r.employee_id = any (__APP__.my_employee_ids())
       or exists (select 1 from __APP__.approvals a where a.doc_type = 'apd_request' and a.record_id = r.id and a.approver_id = auth.uid())
       or (__APP__.k3_staff() and __APP__.k3_in_scope(r.company_code, r.location_id))));
$$;
revoke execute on function __APP__.apd_request_visible(uuid) from public, anon;

-- p: {employee_id, reason, negligence?, incident_on?, last_received_on?, explanation?, deduction_ack?, mr_no?,
--     lines: [{type_id, item_id?, size?, qty, note?}]}
-- Karyawan (tanpa fungsi staf) hanya untuk dirinya sendiri. Kelengkapan (foto, pernyataan) dicek saat diajukan.
create or replace function __APP__.apd_request_save(p_id uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  e __APP__.employees; r __APP__.apd_requests; v_id uuid := p_id; v_code text; v_reason text := p ->> 'reason';
  v_lines jsonb := coalesce(p -> 'lines', '[]'); el jsonb; v_n integer := 0; v_type uuid; v_item uuid; v_qty integer;
  v_inc date := nullif(p ->> 'incident_on', '')::date; v_last date := nullif(p ->> 'last_received_on', '')::date;
begin
  if not __APP__.k3_writer() then raise exception 'Tidak punya akses untuk membuat pengajuan APD.' using errcode = '42501'; end if;
  select * into e from __APP__.employees where id = nullif(p ->> 'employee_id', '')::uuid;
  if e.id is null or e.status <> 'active' then raise exception 'Pilih karyawan aktif.' using errcode = 'P0001'; end if;
  if not (e.id = any (__APP__.my_employee_ids()) or (__APP__.k3_staff() and __APP__.k3_in_scope(e.company_code, e.location_id))) then
    raise exception 'Anda hanya bisa mengajukan APD untuk diri sendiri.' using errcode = '42501';
  end if;
  if coalesce(v_reason, '') not in ('new_hire', 'periodic', 'damaged', 'lost') then raise exception 'Pilih alasan pengajuan.' using errcode = 'P0001'; end if;
  if v_inc is not null and v_inc > __APP__.today_wib() then raise exception 'Tanggal kehilangan/kerusakan tidak boleh di masa depan.' using errcode = 'P0001'; end if;
  if v_last is not null and v_last > __APP__.today_wib() then raise exception 'Tanggal terakhir menerima APD tidak boleh di masa depan.' using errcode = 'P0001'; end if;
  if jsonb_typeof(v_lines) <> 'array' or jsonb_array_length(v_lines) = 0 then raise exception 'Tambahkan minimal satu APD yang diminta.' using errcode = 'P0001'; end if;
  if jsonb_array_length(v_lines) > 30 then raise exception 'Maksimal 30 baris APD per pengajuan.' using errcode = 'P0001'; end if;
  for el in select * from jsonb_array_elements(v_lines) loop
    v_type := nullif(el ->> 'type_id', '')::uuid; v_item := nullif(el ->> 'item_id', '')::uuid; v_qty := nullif(el ->> 'qty', '')::integer;
    if v_type is null or not exists (select 1 from __APP__.apd_types where id = v_type and is_active) then raise exception 'Jenis APD tidak valid.' using errcode = 'P0001'; end if;
    if v_item is not null and not exists (select 1 from __APP__.apd_items where id = v_item and type_id = v_type) then raise exception 'Barang tidak sesuai jenis APD.' using errcode = 'P0001'; end if;
    if v_qty is null or v_qty < 1 or v_qty > 500 then raise exception 'Jumlah APD 1-500.' using errcode = 'P0001'; end if;
  end loop;
  if (select count(distinct (x ->> 'type_id', coalesce(x ->> 'item_id', ''), coalesce(btrim(x ->> 'size'), ''))) from jsonb_array_elements(v_lines) x) <> jsonb_array_length(v_lines) then
    raise exception 'Ada baris APD ganda (jenis & ukuran sama). Gabungkan jumlahnya.' using errcode = 'P0001';
  end if;

  perform __APP__.set_log_extra(jsonb_build_object('apd', (select jsonb_agg(concat_ws(' ', t.name, nullif(btrim(x ->> 'size'), ''), 'x' || (x ->> 'qty')))
    from jsonb_array_elements(v_lines) x join __APP__.apd_types t on t.id = (x ->> 'type_id')::uuid)));
  if v_id is null then
    v_code := __APP__.next_doc_number('APD', e.company_code, 'year');
    perform __APP__.set_log_context('create', null);
    insert into __APP__.apd_requests (company_code, location_id, code, employee_id, recipient_name, job_title, reason, negligence, incident_on,
                                      last_received_on, explanation, deduction_ack, mr_no)
    values (e.company_code, e.location_id, v_code, e.id, e.name, e.job_title, v_reason, coalesce((p ->> 'negligence')::boolean, false), v_inc,
            v_last, nullif(btrim(p ->> 'explanation'), ''), coalesce((p ->> 'deduction_ack')::boolean, false), nullif(btrim(p ->> 'mr_no'), ''))
    returning id into v_id;
  else
    select * into r from __APP__.apd_requests where id = v_id for update;
    if r.id is null or not __APP__.apd_request_visible(v_id) then raise exception 'Pengajuan tidak ditemukan.' using errcode = 'P0001'; end if;
    if r.status not in ('draft', 'rejected') then raise exception 'Pengajuan hanya bisa diubah saat Draf atau Ditolak.' using errcode = 'P0001'; end if;
    if r.created_by is distinct from auth.uid() and not __APP__.apd_manager() then raise exception 'Hanya pembuat pengajuan yang bisa mengubahnya.' using errcode = '42501'; end if;
    perform __APP__.set_log_context('update', null);
    update __APP__.apd_requests set company_code = e.company_code, location_id = e.location_id, employee_id = e.id, recipient_name = e.name,
           job_title = e.job_title, reason = v_reason, negligence = coalesce((p ->> 'negligence')::boolean, false), incident_on = v_inc,
           last_received_on = v_last, explanation = nullif(btrim(p ->> 'explanation'), ''),
           deduction_ack = coalesce((p ->> 'deduction_ack')::boolean, false), mr_no = nullif(btrim(p ->> 'mr_no'), '')
     where id = v_id;
    v_code := r.code;
    delete from __APP__.apd_request_lines where request_id = v_id;
  end if;
  insert into __APP__.apd_request_lines (request_id, line_no, type_id, item_id, size, qty, note)
  select v_id, x.ord, (x.v ->> 'type_id')::uuid, nullif(x.v ->> 'item_id', '')::uuid, nullif(btrim(x.v ->> 'size'), ''),
         (x.v ->> 'qty')::integer, nullif(btrim(x.v ->> 'note'), '')
    from jsonb_array_elements(v_lines) with ordinality as x(v, ord);
  perform __APP__.set_log_context('', '');
  perform __APP__.set_log_extra(null);
  return jsonb_build_object('id', v_id, 'code', v_code);
end $$;

-- Batalkan draf/ditolak (alasan >= 10). Pengajuan disetujui yang belum terkirim sama sekali juga boleh dibatalkan pengelola APD.
create or replace function __APP__.apd_request_cancel(p_id uuid, p_note text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r __APP__.apd_requests;
begin
  select * into r from __APP__.apd_requests where id = p_id for update;
  if r.id is null or not __APP__.apd_request_visible(p_id) then raise exception 'Pengajuan tidak ditemukan.' using errcode = 'P0001'; end if;
  if length(btrim(coalesce(p_note, ''))) < 10 then raise exception 'Alasan pembatalan minimal 10 karakter.' using errcode = 'P0001'; end if;
  if r.status in ('draft', 'rejected') then
    if r.created_by is distinct from auth.uid() and not __APP__.apd_manager() then raise exception 'Hanya pembuat pengajuan yang bisa membatalkannya.' using errcode = '42501'; end if;
  elsif r.status = 'approved' then
    if not __APP__.apd_manager() then raise exception 'Hanya HSE, SCM/Gudang, atau admin yang bisa membatalkan pengajuan yang sudah disetujui.' using errcode = '42501'; end if;
    if exists (select 1 from __APP__.apd_request_lines l where l.request_id = p_id and __APP__.apd_line_supplied(l.id) > 0) then
      raise exception 'Sebagian APD sudah dikirim; pengajuan tidak bisa dibatalkan.' using errcode = 'P0001';
    end if;
  else
    raise exception 'Pengajuan dengan status ini tidak bisa dibatalkan.' using errcode = 'P0001';
  end if;
  perform __APP__.set_log_context('cancel', btrim(p_note));
  update __APP__.apd_requests set status = 'cancelled', cancel_note = btrim(p_note) where id = p_id;
  perform __APP__.set_log_context('', '');
  return jsonb_build_object('ok', true);
end $$;

create or replace function __APP__.apd_request_sync_evidence(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_n integer;
begin
  if not __APP__.apd_request_visible(p_id) then raise exception 'Pengajuan tidak ditemukan.' using errcode = 'P0001'; end if;
  v_n := __APP__.tsp_count_files('apd/' || p_id || '/');
  update __APP__.apd_requests set evidence_count = v_n where id = p_id and evidence_count is distinct from v_n;
  return jsonb_build_object('evidence_count', v_n);
end $$;
revoke execute on function __APP__.apd_request_save(uuid, jsonb), __APP__.apd_request_cancel(uuid, text), __APP__.apd_request_sync_evidence(uuid) from public, anon;

-- ---------------------------------------------------------------- hook approval
create or replace function __APP__.apd_request_context(p_id uuid)
returns __APP__.approval_context language sql stable security definer set search_path = '' as $$
  select r.created_by, r.company_code, null::uuid, 0::numeric, r.code || ' · ' || r.recipient_name, r.status
    from __APP__.apd_requests r where r.id = p_id;
$$;

-- submitted = cek kelengkapan Form Berita Acara + Matrix (P4); approved = siap dipenuhi gudang
create or replace function __APP__.apd_request_on_approval(p_id uuid, p_outcome text)
returns void language plpgsql security definer set search_path = '' as $$
declare r __APP__.apd_requests; v_n integer; v_to uuid[];
begin
  select * into r from __APP__.apd_requests where id = p_id for update;
  if p_outcome = 'submitted' then
    if r.source <> 'app' then raise exception 'Data lama tidak melalui approval.' using errcode = 'P0001'; end if;
    if not exists (select 1 from __APP__.apd_request_lines where request_id = p_id) then raise exception 'Tambahkan APD yang diminta.' using errcode = 'P0001'; end if;
    if r.reason in ('damaged', 'lost') then
      if r.incident_on is null then raise exception 'Isi tanggal kerusakan/kehilangan.' using errcode = 'P0001'; end if;
      if length(coalesce(r.explanation, '')) < 10 then raise exception 'Isi penjelasan pergantian APD minimal 10 karakter.' using errcode = 'P0001'; end if;
    end if;
    v_n := __APP__.tsp_count_files('apd/' || p_id || '/');
    if r.reason = 'damaged' and v_n < 1 then raise exception 'Unggah foto bukti APD yang rusak sebelum mengajukan.' using errcode = 'P0001'; end if;
    if (r.reason = 'lost' or (r.reason = 'damaged' and r.negligence)) and not r.deduction_ack then
      raise exception 'Centang pernyataan bersedia dipotong gaji untuk APD yang hilang/rusak karena kelalaian.' using errcode = 'P0001';
    end if;
    update __APP__.apd_requests set status = 'pending_approval', evidence_count = v_n, requested_on = __APP__.today_wib() where id = p_id;
  elsif p_outcome = 'approved' then
    update __APP__.apd_requests set status = 'approved', approved_on = __APP__.today_wib() where id = p_id;
    v_to := __APP__.users_with_function(array['hse', 'scm'], r.company_code, r.location_id)
            || coalesce((select array_agg(e.profile_id) from __APP__.employees e where e.id = r.employee_id and e.profile_id is not null), '{}');
    perform __APP__.notify(v_to, 'apd_approved', 'Pengajuan APD ' || r.code || ' disetujui', r.recipient_name || ' · siap dikirim dari gudang',
                           '/apd/pengajuan/' || p_id, 'apd', 'apd_requests', p_id::text);
  elsif p_outcome = 'rejected' then
    update __APP__.apd_requests set status = 'rejected' where id = p_id;
  elsif p_outcome = 'cancelled' then
    update __APP__.apd_requests set status = 'draft' where id = p_id;
  end if;
end $$;
revoke execute on function __APP__.apd_request_context(uuid), __APP__.apd_request_on_approval(uuid, text) from public, anon, authenticated;

insert into __APP__.approval_doc_types (code, label, table_name, href_prefix, context_fn, on_done_fn)
values ('apd_request', 'Pengajuan APD', 'apd_requests', '/apd/pengajuan/',
        '__APP__.apd_request_context(uuid)', '__APP__.apd_request_on_approval(uuid,text)')
on conflict (code) do nothing;

-- =====================================================================================
-- BACA (invoker: ikut RLS) - SATU sumber angka untuk halaman, ekspor, Beranda
-- =====================================================================================
-- Kemajuan per baris pengajuan (P6)
create or replace view __APP__.apd_request_line_progress with (security_invoker = true) as
select l.id as line_id, l.request_id, l.line_no, l.type_id, l.item_id, l.size, l.qty,
       (coalesce(s.qty, 0) + l.legacy_supplied)::integer as supplied,
       greatest(l.qty - coalesce(s.qty, 0) - l.legacy_supplied, 0)::integer as outstanding,
       s.last_on as last_supply_on
  from __APP__.apd_request_lines l
  left join lateral (select sum(m.qty) as qty, max(m.moved_on) as last_on from __APP__.apd_stock_moves m
                      where m.request_line_id = l.id and m.kind = 'out' and m.voided_at is null) s on true;

-- Ringkasan per pengajuan: fulfillment none|partial|full (hanya bermakna saat approved), lead time hari
create or replace view __APP__.apd_request_progress with (security_invoker = true) as
select r.id as request_id,
       sum(p.qty)::integer as qty_total, sum(p.supplied)::integer as supplied_total, sum(p.outstanding)::integer as outstanding_total,
       case when sum(p.outstanding) = 0 then 'full' when sum(p.supplied) > 0 then 'partial' else 'none' end as fulfillment,
       max(p.last_supply_on) as last_supply_on,
       case when sum(p.outstanding) = 0 and max(p.last_supply_on) is not null and coalesce(r.approved_on, r.requested_on) is not null
            then max(p.last_supply_on) - coalesce(r.approved_on, r.requested_on) end as lead_days
  from __APP__.apd_requests r join __APP__.apd_request_line_progress p on p.request_id = r.id
 group by r.id, r.approved_on, r.requested_on;
revoke insert, update, delete on __APP__.apd_request_line_progress, __APP__.apd_request_progress from authenticated, anon;

-- Stok per barang (p_location null = semua gudang yang terlihat). os = sisa pengajuan disetujui yang menunjuk barang ini.
create or replace function __APP__.apd_stock_overview(p_location uuid default null)
returns table (item_id uuid, code text, name text, type_id uuid, type_name text, brand text, size text, uom text, min_stock integer, is_active boolean,
               opening integer, in_qty integer, out_qty integer, return_qty integer, adjust_qty integer, stock integer, outstanding integer, last_move_on date)
language sql stable security invoker set search_path = '' as $$
  with mv as (
    select m.item_id,
           sum(m.qty) filter (where m.kind = 'opening') as opening, sum(m.qty) filter (where m.kind = 'in') as in_qty,
           sum(m.qty) filter (where m.kind = 'out') as out_qty, sum(m.qty) filter (where m.kind = 'return') as return_qty,
           sum(m.qty) filter (where m.kind = 'adjust') as adjust_qty, max(m.moved_on) as last_on
      from __APP__.apd_stock_moves m
     where m.voided_at is null and (p_location is null or m.location_id = p_location)
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

-- Riwayat & jatuh tempo per karyawan per jenis yang dilacak (P9). Hanya jenis yang pernah diterima.
-- state: expired | due_soon | ok. Dipakai halaman, pengingat (definer, tanpa RLS), dan APD saya.
create or replace function __APP__.apd_holdings(p_location uuid default null, p_employee uuid default null)
returns table (employee_id uuid, employee_name text, employee_code text, job_title text, location_id uuid, type_id uuid, type_code text, type_name text,
               last_on date, last_qty integer, last_item text, size text, next_due date, days_left integer, state text)
language sql stable security invoker set search_path = '' as $$
  with ev as (
    select m.employee_id, i.type_id, m.moved_on as on_date, m.qty, i.code || ' ' || i.name as item, 1 as pri
      from __APP__.apd_stock_moves m join __APP__.apd_items i on i.id = m.item_id
     where m.kind = 'out' and m.voided_at is null and m.employee_id is not null
       and (p_employee is null or m.employee_id = p_employee)
    union all
    select h.employee_id, h.type_id, h.issued_on, h.qty, 'Riwayat awal' || coalesce(' uk ' || h.size, ''), 0
      from __APP__.apd_issue_history h where p_employee is null or h.employee_id = p_employee),
  last as (
    select distinct on (ev.employee_id, ev.type_id) ev.*
      from ev order by ev.employee_id, ev.type_id, ev.on_date desc, ev.pri desc)
  select e.id, e.name, e.code, e.job_title, e.location_id, t.id, t.code, t.name, l.on_date, l.qty, l.item, sz.size,
         (l.on_date + t.interval_days)::date, ((l.on_date + t.interval_days) - __APP__.today_wib())::integer,
         case when l.on_date + t.interval_days < __APP__.today_wib() then 'expired'
              when (l.on_date + t.interval_days) - __APP__.today_wib() <= t.warn_days then 'due_soon' else 'ok' end
    from last l
    join __APP__.employees e on e.id = l.employee_id and e.status = 'active'
    join __APP__.apd_types t on t.id = l.type_id and t.tracked and t.is_active
    left join __APP__.apd_employee_sizes sz on sz.employee_id = e.id and sz.type_id = t.id
   where (p_location is null or e.location_id = p_location)
   order by e.name, t.sort_order;
$$;

-- APD milik pemanggil (Karyawan tidak bisa membaca employees lewat RLS): definer, dibatasi my_employee_ids()
create or replace function __APP__.apd_my_holdings()
returns table (employee_id uuid, employee_name text, employee_code text, job_title text, location_id uuid, type_id uuid, type_code text, type_name text,
               last_on date, last_qty integer, last_item text, size text, next_due date, days_left integer, state text)
language sql stable security definer set search_path = '' as $$
  select h.* from unnest(__APP__.my_employee_ids()) x(id) cross join lateral __APP__.apd_holdings(null, x.id) h;
$$;

-- Karyawan milik akun pemanggil (form pengajuan untuk Karyawan yang tidak bisa membaca employees)
create or replace function __APP__.apd_my_employees()
returns table (id uuid, code text, name text, job_title text, location_id uuid, company_code text)
language sql stable security definer set search_path = '' as $$
  select e.id, e.code, e.name, e.job_title, e.location_id, e.company_code from __APP__.employees e
   where e.id = any (__APP__.my_employee_ids()) and e.status = 'active' order by e.name;
$$;
revoke execute on function __APP__.apd_my_employees() from public, anon;

-- Ringkasan untuk /apd dan Beranda (satu sumber). Stok = semua gudang yang terlihat (gudang APD terpusat);
-- p_location = site karyawan untuk pengajuan, jatuh tempo, dan APD keluar 30 hari.
create or replace function __APP__.apd_summary(p_location uuid default null)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'items_active', (select count(*) from __APP__.apd_stock_overview(null) s where s.is_active),
    'items_empty', (select count(*) from __APP__.apd_stock_overview(null) s where s.is_active and s.stock <= 0),
    'items_negative', (select count(*) from __APP__.apd_stock_overview(null) s where s.stock < 0),
    'items_below_min', (select count(*) from __APP__.apd_stock_overview(null) s where s.is_active and s.min_stock > 0 and s.stock < s.min_stock),
    'stock_total', (select coalesce(sum(greatest(s.stock, 0)), 0) from __APP__.apd_stock_overview(null) s),
    'requests_pending', (select count(*) from __APP__.apd_requests r where r.status = 'pending_approval' and (p_location is null or r.location_id = p_location)),
    'requests_open', (select count(*) from __APP__.apd_requests r join __APP__.apd_request_progress p on p.request_id = r.id
                       where r.status = 'approved' and p.outstanding_total > 0 and (p_location is null or r.location_id = p_location)),
    'outstanding_qty', (select coalesce(sum(p.outstanding_total), 0) from __APP__.apd_requests r join __APP__.apd_request_progress p on p.request_id = r.id
                         where r.status = 'approved' and (p_location is null or r.location_id = p_location)),
    'lead_days_avg', (select round(avg(p.lead_days), 1) from __APP__.apd_requests r join __APP__.apd_request_progress p on p.request_id = r.id
                       where r.status = 'approved' and p.lead_days is not null and p.last_supply_on >= __APP__.today_wib() - 90
                         and (p_location is null or r.location_id = p_location)),
    'holdings_expired', (select count(*) from __APP__.apd_holdings(p_location, null) h where h.state = 'expired'),
    'holdings_due_soon', (select count(*) from __APP__.apd_holdings(p_location, null) h where h.state = 'due_soon'),
    'out_30d', (select coalesce(sum(m.qty), 0) from __APP__.apd_stock_moves m where m.kind = 'out' and m.voided_at is null
                 and m.moved_on > __APP__.today_wib() - 30 and (p_location is null or m.dest_location_id = p_location)));
$$;
revoke execute on function __APP__.apd_stock_overview(uuid), __APP__.apd_holdings(uuid, uuid), __APP__.apd_my_holdings(),
  __APP__.apd_summary(uuid) from public, anon;

-- =====================================================================================
-- PENGINGAT jatuh tempo (P9): jenis apd_due; run_reminders (21) dibungkus lagi
-- =====================================================================================
alter table __APP__.reminder_rules drop constraint reminder_rules_kind_check;
alter table __APP__.reminder_rules add constraint reminder_rules_kind_check check (kind in (
  'pica_due', 'inspection_due', 'tsp_evaluation',
  'mcu_expiry', 'certificate_expiry', 'permit_expiry', 'contractor_permit_expiry', 'document_review', 'ko_expiry',
  'apd_due'));
insert into __APP__.reminder_rules (kind, name, offsets, notify_assignee, notify_functions) values
  ('apd_due', 'APD jatuh tempo penggantian', '{14,0}', true, '{hse}')
on conflict (kind) do nothing;

create or replace function __APP__.run_apd_reminders(p_today date default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_today date := coalesce(p_today, __APP__.today_wib());
  rule __APP__.reminder_rules; o integer; r record; v_to uuid[]; v_n integer; v_count integer := 0;
begin
  select * into rule from __APP__.reminder_rules where kind = 'apd_due' and is_active;
  if rule.id is null then return '{}'::jsonb; end if;
  foreach o in array rule.offsets loop
    for r in select h.*, e.company_code, e.profile_id from __APP__.apd_holdings(null, null) h join __APP__.employees e on e.id = h.employee_id
              where h.next_due = v_today + o loop
      insert into __APP__.reminder_sent (rule_id, ref_id, offset_days, due_on)
      values (rule.id, md5(r.employee_id::text || ':' || r.type_code)::uuid, o, r.next_due) on conflict do nothing;
      get diagnostics v_n = row_count; if v_n = 0 then continue; end if;
      v_to := (case when rule.notify_assignee and r.profile_id is not null then array[r.profile_id] else '{}'::uuid[] end)
              || __APP__.users_with_function(rule.notify_functions, r.company_code, r.location_id);
      perform __APP__.notify(v_to, 'reminder.apd_due',
        format('%s %s jatuh tempo %s', r.type_name, r.employee_name, case o when 0 then 'hari ini' else format('%s hari lagi', o) end),
        'Ajukan penggantian berkala lewat Pengajuan APD.', '/apd?tab=karyawan&q=' || r.employee_code, 'apd', 'employees', r.employee_id::text);
      v_count := v_count + 1;
    end loop;
  end loop;
  return jsonb_build_object('apd_due', v_count);
end $$;

create or replace function __APP__.run_reminders(p_today date default null)
returns jsonb language sql security definer set search_path = '' as $$
  select __APP__.run_reminders_core(p_today) || __APP__.run_expiry_reminders(p_today) || __APP__.run_apd_reminders(p_today);
$$;
revoke execute on function __APP__.run_reminders(date), __APP__.run_apd_reminders(date) from public, anon, authenticated;

-- =====================================================================================
-- STORAGE: policy lampiran (20) + apd/<pengajuan>/ (baca = pengajuan terlihat; unggah = pembuat/pengelola, saat draf/ditolak)
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
      when 'apd'      then exists (select 1 from __APP__.apd_requests r where r.id::text = (storage.foldername(name))[2])
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
      -- foto bukti pengajuan APD: pembuat / pengelola APD selama draf atau ditolak
      when 'apd'      then exists (select 1 from __APP__.apd_requests r where r.id::text = (storage.foldername(name))[2]
                                     and r.status in ('draft', 'rejected')
                                     and (r.created_by = (select auth.uid()) or (select __APP__.apd_manager())))
      else (select public.has_app_role('__APP__', 'editor'))
    end));

-- label aksi riwayat/CCTV (12) + aksi mutasi APD
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
    else replace(p_action, '_', ' ') end;
$$;
