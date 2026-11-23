-- =====================================================================================
-- CONTOH DOKUMEN "PENGAJUAN" (boilerplate). Pola lengkap satu jenis dokumen dengan approval:
-- tabel + item + log + pencarian + guard + hook approval + registry + RPC simpan + global
-- search + dashboard summary. HAPUS file ini (dan halaman /pengajuan) saat app punya dokumen asli.
-- =====================================================================================

create table __APP__.pengajuan (
  id            uuid primary key default gen_random_uuid(),
  code          text unique,                                  -- diisi saat diajukan (next_doc_number)
  company_code  text not null references public.companies(code),
  department_id uuid references public.departments(id),
  status        text not null default 'draft'
                check (status in ('draft', 'pending_approval', 'approved', 'rejected', 'cancelled', 'completed')),
  title         text not null check (length(btrim(title)) between 1 and 200),
  description   text check (length(description) <= 4000),
  needed_date   date,
  total_amount  numeric(18,2) not null default 0 check (total_amount >= 0),
  search_text   text,                                         -- diisi trigger (pencarian)
  verify_token  uuid unique default gen_random_uuid(),        -- modul verifikasi publik (09_verify)
  created_by    uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table __APP__.pengajuan is 'CONTOH boilerplate: pengajuan dengan approval. Status hanya berubah lewat engine.';
create index pengajuan_company_idx    on __APP__.pengajuan (company_code, created_at desc);
create index pengajuan_department_idx on __APP__.pengajuan (department_id);
create index pengajuan_status_idx     on __APP__.pengajuan (status, created_at desc);
create index pengajuan_created_by_idx on __APP__.pengajuan (created_by, created_at desc);
create index pengajuan_created_at_idx on __APP__.pengajuan (created_at desc, id);
create index pengajuan_search_idx     on __APP__.pengajuan using gin (search_text extensions.gin_trgm_ops);

create table __APP__.pengajuan_items (
  id            uuid primary key default gen_random_uuid(),
  pengajuan_id  uuid not null references __APP__.pengajuan(id) on delete cascade,
  line_no       integer not null check (line_no between 1 and 500),
  item_name     text not null check (length(btrim(item_name)) between 1 and 200),
  part_number   text check (length(part_number) <= 100),
  qty           numeric(14,3) not null check (qty > 0),
  unit          text not null default 'pcs' check (length(unit) between 1 and 20),
  unit_price    numeric(18,2) not null default 0 check (unit_price >= 0),
  subtotal      numeric(18,2) generated always as (round(qty * unit_price, 2)) stored,
  note          text check (length(note) <= 500),
  unique (pengajuan_id, line_no)
);
comment on table __APP__.pengajuan_items is 'CONTOH boilerplate: item pengajuan. Ditulis lewat pengajuan_save().';

create table __APP__.pengajuan_logs (
  id         bigint generated always as identity primary key,
  record_id  uuid not null,                     -- sengaja tanpa FK: log tetap ada walau dokumen dihapus
  at         timestamptz not null default now(),
  actor_id   uuid references public.profiles(id) on delete set null,
  action     text not null check (action ~ '^[a-z][a-z0-9_]{1,40}$'),
  changes    jsonb,
  note       text check (length(note) <= 2000)
);
comment on table __APP__.pengajuan_logs is 'Riwayat aktivitas pengajuan (trigger + RPC engine).';
create index pengajuan_logs_record_idx on __APP__.pengajuan_logs (record_id, at desc);
create index pengajuan_logs_actor_idx  on __APP__.pengajuan_logs (actor_id, at desc);
create index pengajuan_logs_at_idx     on __APP__.pengajuan_logs (at desc);

-- ---------------------------------------------------------------- trigger
create or replace function __APP__.pengajuan_search_text()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.search_text := lower(concat_ws(' ', new.code, new.title, new.description,
    (select string_agg(i.item_name || ' ' || coalesce(i.part_number, ''), ' ')
       from __APP__.pengajuan_items i where i.pengajuan_id = new.id)));
  return new;
end $$;
revoke execute on function __APP__.pengajuan_search_text() from public, anon, authenticated;

-- Status & nomor hanya berubah lewat engine; dokumen yang sedang/selesai diproses terkunci (§6.6)
create or replace function __APP__.pengajuan_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if coalesce((select auth.role()), '') = 'authenticated'
     and nullif(current_setting('app.log_action', true), '') is null then
    if tg_op = 'INSERT' then
      new.status := 'draft';
      new.code := null;
      new.created_by := (select auth.uid());
      new.verify_token := gen_random_uuid();
      return new;
    end if;
    if new.status is distinct from old.status or new.code is distinct from old.code then
      raise exception 'Status dan nomor dokumen hanya bisa diubah lewat proses approval.' using errcode = 'P0001';
    end if;
    if new.created_by is distinct from old.created_by or new.verify_token is distinct from old.verify_token then
      raise exception 'Kolom ini tidak bisa diubah.' using errcode = 'P0001';
    end if;
    if old.status not in ('draft', 'rejected') then
      raise exception 'Dokumen yang sedang diproses atau sudah selesai tidak bisa diubah.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
revoke execute on function __APP__.pengajuan_guard() from public, anon, authenticated;

create or replace function __APP__.pengajuan_items_guard()
returns trigger language plpgsql set search_path = '' as $$
declare v_status text;
begin
  if coalesce((select auth.role()), '') = 'authenticated'
     and nullif(current_setting('app.log_action', true), '') is null then
    select status into v_status from __APP__.pengajuan
     where id = case when tg_op = 'DELETE' then old.pengajuan_id else new.pengajuan_id end;
    if v_status is not null and v_status not in ('draft', 'rejected') then
      raise exception 'Item dokumen yang sedang diproses atau sudah selesai tidak bisa diubah.' using errcode = 'P0001';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke execute on function __APP__.pengajuan_items_guard() from public, anon, authenticated;

create trigger pengajuan_guard before insert or update on __APP__.pengajuan
  for each row execute function __APP__.pengajuan_guard();
create trigger pengajuan_set_updated_at before update on __APP__.pengajuan
  for each row execute function public.set_updated_at();
create trigger pengajuan_search before insert or update on __APP__.pengajuan
  for each row execute function __APP__.pengajuan_search_text();
create trigger pengajuan_log after insert or update or delete on __APP__.pengajuan
  for each row execute function __APP__.log_changes('important', '/pengajuan/', 'Pengajuan');
create trigger pengajuan_items_guard before insert or update or delete on __APP__.pengajuan_items
  for each row execute function __APP__.pengajuan_items_guard();

-- ---------------------------------------------------------------- RLS (scope company §4)
alter table __APP__.pengajuan enable row level security;
alter table __APP__.pengajuan_items enable row level security;
alter table __APP__.pengajuan_logs enable row level security;
revoke insert, update, delete on __APP__.pengajuan_logs from authenticated;

create policy "pengajuan: viewer read" on __APP__.pengajuan for select to authenticated
  using ((select public.has_app_role('__APP__', 'viewer'))
         and ('*' = any ((select __APP__.my_company_scope())::text[])
              or company_code = any ((select __APP__.my_company_scope())::text[])));
create policy "pengajuan: editor insert" on __APP__.pengajuan for insert to authenticated
  with check ((select public.has_app_role('__APP__', 'editor'))
              and ('*' = any ((select __APP__.my_company_scope())::text[])
                   or company_code = any ((select __APP__.my_company_scope())::text[])));
create policy "pengajuan: owner editor or admin update" on __APP__.pengajuan for update to authenticated
  using (((created_by = (select auth.uid()) and (select public.has_app_role('__APP__', 'editor')))
          or (select public.has_app_role('__APP__', 'admin')))
         and ('*' = any ((select __APP__.my_company_scope())::text[])
              or company_code = any ((select __APP__.my_company_scope())::text[])))
  with check ('*' = any ((select __APP__.my_company_scope())::text[])
              or company_code = any ((select __APP__.my_company_scope())::text[]));
create policy "pengajuan: owner draft or admin delete" on __APP__.pengajuan for delete to authenticated
  using ((created_by = (select auth.uid()) and status = 'draft' and (select public.has_app_role('__APP__', 'editor')))
         or ((select public.has_app_role('__APP__', 'admin'))
             and ('*' = any ((select __APP__.my_company_scope())::text[])
                  or company_code = any ((select __APP__.my_company_scope())::text[]))));

create policy "pengajuan_items: read with document" on __APP__.pengajuan_items for select to authenticated
  using (exists (select 1 from __APP__.pengajuan d where d.id = pengajuan_id));
create policy "pengajuan_items: insert with document" on __APP__.pengajuan_items for insert to authenticated
  with check (exists (select 1 from __APP__.pengajuan d where d.id = pengajuan_id
                      and (d.created_by = (select auth.uid()) or (select public.has_app_role('__APP__', 'admin'))))
              and (select public.has_app_role('__APP__', 'editor')));
create policy "pengajuan_items: update with document" on __APP__.pengajuan_items for update to authenticated
  using (exists (select 1 from __APP__.pengajuan d where d.id = pengajuan_id
                 and (d.created_by = (select auth.uid()) or (select public.has_app_role('__APP__', 'admin'))))
         and (select public.has_app_role('__APP__', 'editor')));
create policy "pengajuan_items: delete with document" on __APP__.pengajuan_items for delete to authenticated
  using (exists (select 1 from __APP__.pengajuan d where d.id = pengajuan_id
                 and (d.created_by = (select auth.uid()) or (select public.has_app_role('__APP__', 'admin'))))
         and (select public.has_app_role('__APP__', 'editor')));

-- Log mengikuti hak baca dokumen; log dokumen yang sudah dihapus hanya untuk admin
create policy "pengajuan_logs: read with document" on __APP__.pengajuan_logs for select to authenticated
  using (exists (select 1 from __APP__.pengajuan d where d.id = record_id)
         or (select public.has_app_role('__APP__', 'admin')));

-- ---------------------------------------------------------------- hook approval (§6.5)
create or replace function __APP__.pengajuan_approval_context(p_id uuid)
returns __APP__.approval_context language sql stable security definer set search_path = '' as $$
  select created_by, company_code, department_id, total_amount, code, status
    from __APP__.pengajuan where id = p_id;
$$;

-- WAJIB meng-update baris dokumen (trigger log membaca konteks aksi dari set_log_context)
create or replace function __APP__.pengajuan_on_approval(p_id uuid, p_outcome text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_outcome = 'submitted' and not exists (select 1 from __APP__.pengajuan_items where pengajuan_id = p_id) then
    raise exception 'Tambahkan minimal 1 barang sebelum mengajukan.' using errcode = 'P0001';
  end if;
  update __APP__.pengajuan
     set status = case p_outcome
                    when 'submitted' then 'pending_approval'
                    when 'approved'  then 'approved'
                    when 'rejected'  then 'rejected'
                    when 'cancelled' then 'draft'
                  end,
         code = case when p_outcome = 'submitted'
                     then coalesce(code, __APP__.next_doc_number('PJ', company_code)) else code end
   where id = p_id;
end $$;

revoke execute on function __APP__.pengajuan_approval_context(uuid), __APP__.pengajuan_on_approval(uuid, text)
  from public, anon, authenticated;

insert into __APP__.approval_doc_types (code, label, table_name, href_prefix, context_fn, on_done_fn)
values ('pengajuan', 'Pengajuan', 'pengajuan', '/pengajuan/',
        '__APP__.pengajuan_approval_context(uuid)', '__APP__.pengajuan_on_approval(uuid,text)');

-- Ringkasan satu item untuk riwayat: "Ban forklift (4 pcs × Rp 650.000)"
create or replace function __APP__.pengajuan_item_label(p_name text, p_qty numeric, p_unit text, p_price numeric)
returns text language sql immutable set search_path = '' as $$
  select format('%s (%s %s × Rp %s)', p_name, trim_scale(p_qty), p_unit,
                replace(to_char(coalesce(p_price, 0), 'FM999,999,999,999,990'), ',', '.'));
$$;

-- ---------------------------------------------------------------- simpan dokumen + item
-- p: {company_code, department_id?, title, description?, needed_date?,
--     items: [{item_name, part_number?, qty, unit?, unit_price?, note?}]}
-- security INVOKER: RLS + guard yang menjaga. Satu aksi = satu baris log (ringkasan item via
-- set_log_extra). Mengembalikan id dokumen.
create or replace function __APP__.pengajuan_save(p_id uuid, p jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_id        uuid := p_id;
  v_items     jsonb := coalesce(p -> 'items', '[]'::jsonb);
  v_total     numeric(18,2);
  v_old_items jsonb;
  v_new_items jsonb;
begin
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) > 500 then
    raise exception 'Daftar barang tidak valid (maksimal 500 baris).' using errcode = 'P0001';
  end if;
  select coalesce(sum(round((e ->> 'qty')::numeric * coalesce(nullif(e ->> 'unit_price', '')::numeric, 0), 2)), 0)
    into v_total from jsonb_array_elements(v_items) e;

  select coalesce(jsonb_agg(__APP__.pengajuan_item_label(e ->> 'item_name', (e ->> 'qty')::numeric,
           coalesce(nullif(e ->> 'unit', ''), 'pcs'), coalesce(nullif(e ->> 'unit_price', '')::numeric, 0)) order by ord), '[]')
    into v_new_items from jsonb_array_elements(v_items) with ordinality as x(e, ord);

  if v_id is null then
    insert into __APP__.pengajuan (company_code, department_id, title, description, needed_date, total_amount)
    values (p ->> 'company_code', nullif(p ->> 'department_id', '')::uuid, btrim(p ->> 'title'),
            nullif(btrim(p ->> 'description'), ''), nullif(p ->> 'needed_date', '')::date, v_total)
    returning id into v_id;
    v_old_items := null;
  else
    select coalesce(jsonb_agg(__APP__.pengajuan_item_label(item_name, qty, unit, unit_price) order by line_no), '[]')
      into v_old_items from __APP__.pengajuan_items where pengajuan_id = v_id;
    if not exists (select 1 from __APP__.pengajuan where id = v_id) then
      raise exception 'Dokumen tidak ditemukan.' using errcode = 'P0001';
    end if;
    delete from __APP__.pengajuan_items where pengajuan_id = v_id;
  end if;

  insert into __APP__.pengajuan_items (pengajuan_id, line_no, item_name, part_number, qty, unit, unit_price, note)
  select v_id, ord::integer, btrim(e ->> 'item_name'), nullif(btrim(e ->> 'part_number'), ''),
         (e ->> 'qty')::numeric, coalesce(nullif(btrim(e ->> 'unit'), ''), 'pcs'),
         coalesce(nullif(e ->> 'unit_price', '')::numeric, 0), nullif(btrim(e ->> 'note'), '')
    from jsonb_array_elements(v_items) with ordinality as x(e, ord);

  -- satu update header: memicu search_text (item terbaru) + satu baris log
  if v_old_items is not null and v_old_items is distinct from v_new_items then
    perform set_config('app.log_extra',
      jsonb_build_object('items', jsonb_build_object('old', v_old_items, 'new', v_new_items))::text, true);
  end if;
  if p_id is null then
    update __APP__.pengajuan set updated_at = now() where id = v_id;   -- segarkan search_text (tanpa log)
  else
    update __APP__.pengajuan
       set company_code = p ->> 'company_code', department_id = nullif(p ->> 'department_id', '')::uuid,
           title = btrim(p ->> 'title'), description = nullif(btrim(p ->> 'description'), ''),
           needed_date = nullif(p ->> 'needed_date', '')::date, total_amount = v_total
     where id = v_id;
    if not found then raise exception 'Dokumen tidak bisa diubah.' using errcode = 'P0001'; end if;
  end if;
  perform set_config('app.log_extra', '', true);
  return v_id;
end $$;
revoke execute on function __APP__.pengajuan_save(uuid, jsonb) from public, anon;

-- ---------------------------------------------------------------- global search (§10.3)
-- security INVOKER: RLS + scope company berlaku. Mendefinisikan ulang versi 11_kejadian_pica (modul K3)
-- dengan tambahan Pengajuan. Saat contoh dihapus, versi di 11_kejadian_pica yang berlaku.
create or replace function __APP__.global_search(p_q text, p_limit integer default 5)
returns table (kind text, id text, title text, subtitle text, status text, amount numeric,
               href text, is_exact boolean)
language sql stable security invoker set search_path = '' as $$
  with q as (select lower(btrim(p_q)) as t)
  (select 'pengajuan'::text, d.id::text, coalesce(d.code, 'Draft'), d.title, d.status, d.total_amount,
          '/pengajuan/' || d.id, lower(coalesce(d.code, '')) = q.t
     from __APP__.pengajuan d, q
    where length(q.t) >= 3 and d.search_text like '%' || q.t || '%'
    order by (lower(coalesce(d.code, '')) = q.t) desc, d.created_at desc
    limit least(greatest(p_limit, 1), 10))
  union all
  select * from __APP__.global_search_k3(p_q, p_limit)
$$;
revoke execute on function __APP__.global_search(text, integer) from public, anon;

-- ---------------------------------------------------------------- dashboard (§10.4)
-- Semua angka stat card + periode sebelumnya dalam satu round trip. p_company null = semua scope.
create or replace function __APP__.dashboard_summary(p_from date, p_to date, p_company text default null)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with bounds as (
    select (p_from::timestamp at time zone 'Asia/Jakarta') as f,
           ((p_to + 1)::timestamp at time zone 'Asia/Jakarta') as t,
           ((p_from - (p_to - p_from + 1))::timestamp at time zone 'Asia/Jakarta') as pf
  ),
  d as (
    select x.status, x.total_amount, x.created_at >= b.f as cur
      from __APP__.pengajuan x, bounds b
     where x.created_at >= b.pf and x.created_at < b.t
       and (p_company is null or x.company_code = p_company)
  )
  select jsonb_build_object(
    'total',           count(*) filter (where cur),
    'draft',           count(*) filter (where cur and status = 'draft'),
    'pending',         count(*) filter (where cur and status = 'pending_approval'),
    'approved',        count(*) filter (where cur and status = 'approved'),
    'rejected',        count(*) filter (where cur and status = 'rejected'),
    'amount_approved', coalesce(sum(total_amount) filter (where cur and status = 'approved'), 0),
    'prev', jsonb_build_object(
      'total',           count(*) filter (where not cur),
      'pending',         count(*) filter (where not cur and status = 'pending_approval'),
      'approved',        count(*) filter (where not cur and status = 'approved'),
      'rejected',        count(*) filter (where not cur and status = 'rejected'),
      'amount_approved', coalesce(sum(total_amount) filter (where not cur and status = 'approved'), 0)),
    'all_pending',     (select count(*) from __APP__.pengajuan y
                         where y.status = 'pending_approval' and (p_company is null or y.company_code = p_company))
  ) from d;
$$;

-- Tren harian (grafik): jumlah dibuat & disetujui per hari WIB
create or replace function __APP__.dashboard_daily(p_from date, p_to date, p_company text default null)
returns table (day date, created integer, approved integer, amount numeric)
language sql stable security invoker set search_path = '' as $$
  select g.day::date,
         count(x.id) filter (where x.id is not null)::integer,
         count(x.id) filter (where x.status = 'approved')::integer,
         coalesce(sum(x.total_amount) filter (where x.status = 'approved'), 0)
    from generate_series(p_from, p_to, interval '1 day') as g(day)
    left join __APP__.pengajuan x
      on (x.created_at at time zone 'Asia/Jakarta')::date = g.day::date
     and (p_company is null or x.company_code = p_company)
   group by g.day
   order by g.day;
$$;

-- Distribusi per departemen (grafik bar): jumlah & nilai pengajuan yang dibuat di periode
create or replace function __APP__.dashboard_by_department(p_from date, p_to date, p_company text default null)
returns table (department_id uuid, department text, total integer, amount numeric)
language sql stable security invoker set search_path = '' as $$
  select x.department_id, coalesce(d.name, 'Tanpa departemen'), count(*)::integer, coalesce(sum(x.total_amount), 0)
    from __APP__.pengajuan x
    left join public.departments d on d.id = x.department_id
   where x.created_at >= (p_from::timestamp at time zone 'Asia/Jakarta')
     and x.created_at < ((p_to + 1)::timestamp at time zone 'Asia/Jakarta')
     and (p_company is null or x.company_code = p_company)
   group by x.department_id, d.name
   order by count(*) desc, 2;
$$;

-- Feed aktivitas: log semua dokumen (ikut RLS log) untuk dashboard
create or replace function __APP__.activity_feed(p_limit integer default 20, p_before timestamptz default null)
returns table (id bigint, entity text, record_id uuid, at timestamptz, actor_id uuid, action text, note text,
               label text, href text)
language sql stable security invoker set search_path = '' as $$
  select f.* from (
    (select l.id, 'pengajuan'::text, l.record_id, l.at, l.actor_id, l.action, l.note,
            coalesce(d.code, d.title, 'Pengajuan'), '/pengajuan/' || l.record_id
       from __APP__.pengajuan_logs l
       left join __APP__.pengajuan d on d.id = l.record_id
      where (p_before is null or l.at < p_before)
      order by l.at desc
      limit 100)
    union all
    select * from __APP__.activity_feed_k3(100, p_before)
  ) f
  order by f.at desc
  limit least(greatest(p_limit, 1), 100);
$$;

revoke execute on function __APP__.dashboard_summary(date, date, text), __APP__.dashboard_daily(date, date, text),
  __APP__.dashboard_by_department(date, date, text),
  __APP__.activity_feed(integer, timestamptz) from public, anon;
