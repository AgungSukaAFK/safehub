-- =====================================================================================
-- PLATFORM · pemicu maintenance harian semua app · backend-guide §2.3
-- Dipanggil systemd timer di VPS (infra/lourdes-maintenance.*), 03:00 WIB.
-- =====================================================================================

create table public.maintenance_runs (
  id       bigint generated always as identity primary key,
  ran_at   timestamptz not null default now(),
  result   jsonb not null
);
comment on table public.maintenance_runs is 'Hasil run_maintenance_all() harian (dibaca konsol monitoring).';
alter table public.maintenance_runs enable row level security;
revoke all on public.maintenance_runs from anon, authenticated;
grant select on public.maintenance_runs to authenticated;
create policy "maintenance_runs: platform admin read" on public.maintenance_runs
  for select to authenticated using ((select public.is_platform_admin()));

create or replace function public.run_maintenance_all()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r      record;
  v_res  jsonb;
  v_all  jsonb := '{}';
  v_cctv integer;
begin
  -- Setiap app aktif yang punya fungsi <app>.run_maintenance()
  for r in
    select a.id from public.apps a
    where a.is_active
      and exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = a.id and p.proname = 'run_maintenance')
  loop
    begin
      execute format('select %I.run_maintenance()', r.id) into v_res;
      v_all := v_all || jsonb_build_object(r.id, v_res);
    exception when others then
      v_all := v_all || jsonb_build_object(r.id, jsonb_build_object('error', sqlerrm));
    end;
  end loop;

  -- Retensi CCTV: 5 tahun
  perform set_config('lourdes.retention', 'on', true);
  delete from public.cctv_events where at < now() - interval '5 years';
  get diagnostics v_cctv = row_count;
  perform set_config('lourdes.retention', '', true);

  v_all := v_all || jsonb_build_object('cctv_deleted', v_cctv);
  insert into public.maintenance_runs (result) values (v_all);
  delete from public.maintenance_runs where ran_at < now() - interval '1 year';
  return v_all;
end $$;
revoke execute on function public.run_maintenance_all() from public, anon, authenticated;
