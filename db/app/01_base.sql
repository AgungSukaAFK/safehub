-- =====================================================================================
-- 01 BASE · scope company, konteks log, riwayat dokumen + jembatan CCTV, penomoran,
-- members. backend-guide §3, §4, §5, §8, §11.4
-- =====================================================================================

-- ---------------------------------------------------------------- scope perusahaan (§4)
-- '{*}' = semua (platform admin, company grup, akun IT tanpa company)
-- '{}'  = tidak ada (profil tidak ditemukan / nonaktif) → aman secara default
create or replace function __APP__.my_company_scope()
returns text[] language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case
      when public.is_platform_admin() or p.company is null or c.is_group then array['*']
      else array[p.company] || coalesce((select array_agg(g.code) from public.companies g where g.is_group), '{}')
    end
    from public.profiles p
    left join public.companies c on c.code = p.company
    where p.id = (select auth.uid()) and p.is_active
  ), '{}');
$$;

-- Koreksi K5: helper yang disebut frontend-guide §16.3. Untuk policy, lebih cepat pola
-- `'*' = any((select my_company_scope())) or company_code = any((select my_company_scope()))`.
create or replace function __APP__.company_visible(p_company text)
returns boolean language sql stable set search_path = '' as $$
  select '*' = any (__APP__.my_company_scope()) or p_company = any (__APP__.my_company_scope());
$$;

-- ---------------------------------------------------------------- konteks log (§3.4)
create or replace function __APP__.set_log_context(p_action text, p_note text)
returns void language sql set search_path = '' as $$
  select set_config('app.log_action', coalesce(p_action, ''), true),
         set_config('app.log_note',   coalesce(p_note, ''),   true);
$$;
revoke execute on function __APP__.set_log_context(text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------- riwayat + CCTV (§8.2)
create or replace function __APP__.action_label(p_action text)
returns text language sql immutable set search_path = '' as $$
  select case p_action
    when 'create' then 'dibuat'          when 'update' then 'diubah'
    when 'delete' then 'dihapus'         when 'submit' then 'diajukan'
    when 'approve' then 'disetujui'      when 'reject' then 'ditolak'
    when 'cancel' then 'ditarik'         when 'followup' then 'di-follow-up'
    when 'override' then 'approval diubah admin'
    when 'admin_edit' then 'diedit admin'
    else replace(p_action, '_', ' ') end;
$$;

-- Buang kolom sensitif sebelum dikirim ke CCTV (§9.1): *_token, nrp*, phone, search_text
create or replace function __APP__.cctv_redact(p jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select case when p is null or jsonb_typeof(p) <> 'object' then p else
    coalesce((select jsonb_object_agg(k, v) from jsonb_each(p) as e(k, v)
               where k !~ '(_token$|^nrp|^phone$|^search_text$)'), '{}'::jsonb) end;
$$;

-- p_category null = otomatis (approval/data). 'config' untuk tabel konfigurasi.
create or replace function __APP__.write_log(
  p_table text, p_record_id uuid, p_action text, p_changes jsonb, p_note text,
  p_label text, p_company text, p_href text, p_entity_label text, p_cctv boolean,
  p_category text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_changes jsonb := __APP__.cctv_redact(p_changes);
begin
  execute format('insert into %I.%I (record_id, action, changes, note, actor_id) values ($1, $2, $3, $4, $5)',
                 '__APP__', p_table || '_logs')
    using p_record_id, p_action, p_changes - 'search_text', left(p_note, 2000), (select auth.uid());

  if p_cctv then
    perform public.cctv_log(
      p_app          => '__APP__',
      p_category     => coalesce(p_category,
                          case when p_action in ('submit', 'approve', 'reject', 'cancel', 'followup', 'override')
                               then 'approval' else 'data' end),
      p_action       => p_table || '.' || p_action,
      p_summary      => format('%s %s %s', p_entity_label, coalesce(p_label, left(p_record_id::text, 8)),
                               __APP__.action_label(p_action)),
      p_severity     => case when p_action in ('delete', 'override') then 'warning'
                             when p_action in ('reject', 'admin_edit', 'cancel') or p_category = 'config' then 'notice'
                             else 'info' end,
      p_entity       => p_table,
      p_record_id    => p_record_id::text,
      p_record_label => p_label,
      p_company_code => p_company,
      p_url          => case when p_href is null or p_action = 'delete' then null
                             else 'https://__HOST__.lourdes.cloud' || p_href || p_record_id end,
      p_changes      => case when pg_column_size(v_changes) > 12000 then jsonb_build_object('ringkas', 'perubahan terlalu besar') else v_changes end,
      p_metadata     => case when p_note is null then null else jsonb_build_object('catatan', left(p_note, 500)) end);
  end if;
end $$;
revoke execute on function __APP__.write_log(text, uuid, text, jsonb, text, text, text, text, text, boolean, text)
  from public, anon, authenticated;

-- Trigger generik. Argumen: (mode_cctv, href_prefix, label_entitas)
--   mode_cctv: 'important' (semua kecuali edit biasa) | 'all' | 'none' | 'config' (semua, kategori config)
-- Tambahan boilerplate: setting `app.log_extra` (jsonb) digabung ke changes, dipakai RPC penyimpan
-- dokumen untuk menulis ringkasan perubahan item di baris log yang sama (satu aksi = satu baris).
create or replace function __APP__.log_changes()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_mode    text  := coalesce(tg_argv[0], 'important');
  v_href    text  := nullif(tg_argv[1], '');
  v_elabel  text  := coalesce(tg_argv[2], tg_table_name);
  v_row     jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_action  text  := nullif(current_setting('app.log_action', true), '');
  v_note    text  := nullif(current_setting('app.log_note', true), '');
  v_extra   jsonb := nullif(current_setting('app.log_extra', true), '')::jsonb;
  v_owner   uuid  := (v_row ->> 'created_by')::uuid;
  v_changes jsonb;
begin
  if tg_op = 'INSERT' then
    v_action := coalesce(v_action, 'create');
  elsif tg_op = 'DELETE' then
    v_action := coalesce(v_action, 'delete');
    v_changes := v_row - 'search_text' - 'verify_token';      -- salinan terakhir
  else
    select jsonb_object_agg(n.key, jsonb_build_object('old', o.value, 'new', n.value))
      into v_changes
      from jsonb_each(to_jsonb(new)) n
      join jsonb_each(to_jsonb(old)) o using (key)
     where n.key not in ('updated_at', 'search_text', 'verify_token') and n.value is distinct from o.value;
    if v_extra is not null then
      v_changes := coalesce(v_changes, '{}'::jsonb) || v_extra;
    end if;
    if v_changes is null or v_changes = '{}'::jsonb then return null; end if;   -- tidak ada yang berubah
    v_action := coalesce(v_action,
      case when v_owner is not null and v_owner is distinct from (select auth.uid()) then 'admin_edit' else 'update' end);
  end if;

  perform __APP__.write_log(tg_table_name, (v_row ->> 'id')::uuid, v_action, v_changes, v_note,
    coalesce(v_row ->> 'code', v_row ->> 'name'), v_row ->> 'company_code', v_href, v_elabel,
    case v_mode when 'all' then true when 'config' then true when 'none' then false else v_action <> 'update' end,
    case when v_mode = 'config' then 'config' end);
  return null;
end $$;
revoke execute on function __APP__.log_changes() from public, anon, authenticated;

-- Setel ringkasan tambahan untuk baris log berikutnya (dipanggil RPC penyimpan dokumen)
create or replace function __APP__.set_log_extra(p_extra jsonb)
returns void language sql set search_path = '' as $$
  select set_config('app.log_extra', coalesce(p_extra::text, ''), true);
$$;
revoke execute on function __APP__.set_log_extra(jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------- penomoran (§5)
create table __APP__.doc_sequences (
  prefix        text not null,
  company_code  text not null,
  period        text not null,               -- YYMM (WIB)
  last_no       integer not null default 0,
  primary key (prefix, company_code, period)
);
comment on table __APP__.doc_sequences is 'Counter nomor dokumen; hanya ditulis next_doc_number().';
alter table __APP__.doc_sequences enable row level security;
revoke insert, update, delete on __APP__.doc_sequences from authenticated;
create policy "doc_sequences: admin read" on __APP__.doc_sequences for select to authenticated
  using ((select public.has_app_role('__APP__', 'admin')));

create or replace function __APP__.next_doc_number(p_prefix text, p_company text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_period text := to_char(now() at time zone 'Asia/Jakarta', 'YYMM');
  v_no     integer;
begin
  insert into __APP__.doc_sequences as s (prefix, company_code, period, last_no)
  values (p_prefix, p_company, v_period, 1)
  on conflict (prefix, company_code, period) do update set last_no = s.last_no + 1
  returning last_no into v_no;
  return format('%s/%s/%s/%s', p_prefix, p_company, v_period, lpad(v_no::text, 4, '0'));
end $$;
revoke execute on function __APP__.next_doc_number(text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------- members (§11.4)
-- Data user khusus app. Kolom "milik admin" (team, approval_limit, admin_note) dijaga guard.
create table __APP__.members (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null unique references public.profiles(id) on delete cascade,
  team            text check (length(team) <= 100),
  approval_limit  numeric(18,2) check (approval_limit is null or approval_limit >= 0),
  admin_note      text check (length(admin_note) <= 1000),
  preferences     jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
comment on table __APP__.members is 'Data user khusus app (bukan profil platform). Kolom admin dijaga members_guard.';

create table __APP__.members_logs (
  id         bigint generated always as identity primary key,
  record_id  uuid not null,
  at         timestamptz not null default now(),
  actor_id   uuid references public.profiles(id) on delete set null,
  action     text not null check (action ~ '^[a-z][a-z0-9_]{1,40}$'),
  changes    jsonb,
  note       text check (length(note) <= 2000)
);
comment on table __APP__.members_logs is 'Riwayat perubahan members (trigger log_changes).';
create index members_logs_record_idx on __APP__.members_logs (record_id, at desc);
create index members_logs_actor_idx on __APP__.members_logs (actor_id, at desc);

create or replace function __APP__.members_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if coalesce((select auth.role()), '') = 'authenticated' and not public.has_app_role('__APP__', 'admin') then
    if tg_op = 'INSERT' then
      new.team := null; new.approval_limit := null; new.admin_note := null;
    elsif new.team is distinct from old.team or new.approval_limit is distinct from old.approval_limit
          or new.admin_note is distinct from old.admin_note or new.user_id is distinct from old.user_id then
      raise exception 'Kolom ini hanya bisa diubah admin app.' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
revoke execute on function __APP__.members_guard() from public, anon, authenticated;

create trigger members_guard before insert or update on __APP__.members
  for each row execute function __APP__.members_guard();
create trigger members_set_updated_at before update on __APP__.members
  for each row execute function public.set_updated_at();
create trigger members_log after insert or update or delete on __APP__.members
  for each row execute function __APP__.log_changes('all', '/pengguna/', 'Data anggota');

alter table __APP__.members enable row level security;
alter table __APP__.members_logs enable row level security;
revoke insert, update, delete on __APP__.members_logs from authenticated;

create policy "members: viewer read" on __APP__.members for select to authenticated
  using ((select public.has_app_role('__APP__', 'viewer')));
create policy "members: own or admin insert" on __APP__.members for insert to authenticated
  with check ((select public.has_app_role('__APP__', 'viewer'))
              and (user_id = (select auth.uid()) or (select public.has_app_role('__APP__', 'admin'))));
create policy "members: own or admin update" on __APP__.members for update to authenticated
  using (user_id = (select auth.uid()) or (select public.has_app_role('__APP__', 'admin')))
  with check (user_id = (select auth.uid()) or (select public.has_app_role('__APP__', 'admin')));
create policy "members: admin delete" on __APP__.members for delete to authenticated
  using ((select public.has_app_role('__APP__', 'admin')));
create policy "members_logs: admin read" on __APP__.members_logs for select to authenticated
  using ((select public.has_app_role('__APP__', 'admin')));
