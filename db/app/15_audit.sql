-- =====================================================================================
-- 15 AUDIT TRAIL (Safe Hub, fase 3) · rancangan §4.13
-- View gabungan semua <entitas>_logs. Hanya admin app dan Auditor; mengikuti RLS log masing-masing
-- (security invoker). Event keamanan tetap di CCTV platform. Entitas baru = tambah satu cabang di sini.
-- =====================================================================================
create or replace function __APP__.audit_trail(
  p_entities text[] default null, p_actor uuid default null, p_action text default null,
  p_from timestamptz default null, p_to timestamptz default null, p_before timestamptz default null,
  p_limit integer default 50)
returns table (entity text, id bigint, record_id uuid, at timestamptz, actor_id uuid, action text, note text, changes jsonb)
language plpgsql stable security invoker set search_path = '' as $$
begin
  if not (public.has_app_role('__APP__', 'admin') or 'auditor' = any (__APP__.my_functions())) then
    raise exception 'Audit Trail hanya untuk admin dan Auditor.' using errcode = '42501';
  end if;
  p_from := coalesce(p_from, '-infinity'); p_to := coalesce(p_to, 'infinity');
  return query
  select u.entity, u.id, u.record_id, u.at, u.actor_id, u.action, u.note, u.changes from (
    (select 'approval_templates'::text as entity, l.id, l.record_id, l.at, l.actor_id, l.action, l.note, l.changes
       from __APP__.approval_templates_logs l
      where (p_entities is null or 'approval_templates' = any (p_entities)) and l.at >= p_from and l.at < p_to
        and (p_actor is null or l.actor_id = p_actor) and (p_action is null or l.action = p_action)
        and (p_before is null or l.at < p_before)
      order by l.at desc, l.id desc limit least(greatest(p_limit, 1), 200) + 1)
    union all
    (select 'areas'::text as entity, l.id, l.record_id, l.at, l.actor_id, l.action, l.note, l.changes
       from __APP__.areas_logs l
      where (p_entities is null or 'areas' = any (p_entities)) and l.at >= p_from and l.at < p_to
        and (p_actor is null or l.actor_id = p_actor) and (p_action is null or l.action = p_action)
        and (p_before is null or l.at < p_before)
      order by l.at desc, l.id desc limit least(greatest(p_limit, 1), 200) + 1)
    union all
    (select 'contractors'::text as entity, l.id, l.record_id, l.at, l.actor_id, l.action, l.note, l.changes
       from __APP__.contractors_logs l
      where (p_entities is null or 'contractors' = any (p_entities)) and l.at >= p_from and l.at < p_to
        and (p_actor is null or l.actor_id = p_actor) and (p_action is null or l.action = p_action)
        and (p_before is null or l.at < p_before)
      order by l.at desc, l.id desc limit least(greatest(p_limit, 1), 200) + 1)
    union all
    (select 'department_heads'::text as entity, l.id, l.record_id, l.at, l.actor_id, l.action, l.note, l.changes
       from __APP__.department_heads_logs l
      where (p_entities is null or 'department_heads' = any (p_entities)) and l.at >= p_from and l.at < p_to
        and (p_actor is null or l.actor_id = p_actor) and (p_action is null or l.action = p_action)
        and (p_before is null or l.at < p_before)
      order by l.at desc, l.id desc limit least(greatest(p_limit, 1), 200) + 1)
    union all
    (select 'findings'::text as entity, l.id, l.record_id, l.at, l.actor_id, l.action, l.note, l.changes
       from __APP__.findings_logs l
      where (p_entities is null or 'findings' = any (p_entities)) and l.at >= p_from and l.at < p_to
        and (p_actor is null or l.actor_id = p_actor) and (p_action is null or l.action = p_action)
        and (p_before is null or l.at < p_before)
      order by l.at desc, l.id desc limit least(greatest(p_limit, 1), 200) + 1)
    union all
    (select 'incidents'::text as entity, l.id, l.record_id, l.at, l.actor_id, l.action, l.note, l.changes
       from __APP__.incidents_logs l
      where (p_entities is null or 'incidents' = any (p_entities)) and l.at >= p_from and l.at < p_to
        and (p_actor is null or l.actor_id = p_actor) and (p_action is null or l.action = p_action)
        and (p_before is null or l.at < p_before)
      order by l.at desc, l.id desc limit least(greatest(p_limit, 1), 200) + 1)
    union all
    (select 'inspection_templates'::text as entity, l.id, l.record_id, l.at, l.actor_id, l.action, l.note, l.changes
       from __APP__.inspection_templates_logs l
      where (p_entities is null or 'inspection_templates' = any (p_entities)) and l.at >= p_from and l.at < p_to
        and (p_actor is null or l.actor_id = p_actor) and (p_action is null or l.action = p_action)
        and (p_before is null or l.at < p_before)
      order by l.at desc, l.id desc limit least(greatest(p_limit, 1), 200) + 1)
    union all
    (select 'inspections'::text as entity, l.id, l.record_id, l.at, l.actor_id, l.action, l.note, l.changes
       from __APP__.inspections_logs l
      where (p_entities is null or 'inspections' = any (p_entities)) and l.at >= p_from and l.at < p_to
        and (p_actor is null or l.actor_id = p_actor) and (p_action is null or l.action = p_action)
        and (p_before is null or l.at < p_before)
      order by l.at desc, l.id desc limit least(greatest(p_limit, 1), 200) + 1)
    union all
    (select 'kpi_definitions'::text as entity, l.id, l.record_id, l.at, l.actor_id, l.action, l.note, l.changes
       from __APP__.kpi_definitions_logs l
      where (p_entities is null or 'kpi_definitions' = any (p_entities)) and l.at >= p_from and l.at < p_to
        and (p_actor is null or l.actor_id = p_actor) and (p_action is null or l.action = p_action)
        and (p_before is null or l.at < p_before)
      order by l.at desc, l.id desc limit least(greatest(p_limit, 1), 200) + 1)
    union all
    (select 'master_items'::text as entity, l.id, l.record_id, l.at, l.actor_id, l.action, l.note, l.changes
       from __APP__.master_items_logs l
      where (p_entities is null or 'master_items' = any (p_entities)) and l.at >= p_from and l.at < p_to
        and (p_actor is null or l.actor_id = p_actor) and (p_action is null or l.action = p_action)
        and (p_before is null or l.at < p_before)
      order by l.at desc, l.id desc limit least(greatest(p_limit, 1), 200) + 1)
    union all
    (select 'members'::text as entity, l.id, l.record_id, l.at, l.actor_id, l.action, l.note, l.changes
       from __APP__.members_logs l
      where (p_entities is null or 'members' = any (p_entities)) and l.at >= p_from and l.at < p_to
        and (p_actor is null or l.actor_id = p_actor) and (p_action is null or l.action = p_action)
        and (p_before is null or l.at < p_before)
      order by l.at desc, l.id desc limit least(greatest(p_limit, 1), 200) + 1)
    union all
    (select 'observations'::text as entity, l.id, l.record_id, l.at, l.actor_id, l.action, l.note, l.changes
       from __APP__.observations_logs l
      where (p_entities is null or 'observations' = any (p_entities)) and l.at >= p_from and l.at < p_to
        and (p_actor is null or l.actor_id = p_actor) and (p_action is null or l.action = p_action)
        and (p_before is null or l.at < p_before)
      order by l.at desc, l.id desc limit least(greatest(p_limit, 1), 200) + 1)
    union all
    (select 'pengajuan'::text as entity, l.id, l.record_id, l.at, l.actor_id, l.action, l.note, l.changes
       from __APP__.pengajuan_logs l
      where (p_entities is null or 'pengajuan' = any (p_entities)) and l.at >= p_from and l.at < p_to
        and (p_actor is null or l.actor_id = p_actor) and (p_action is null or l.action = p_action)
        and (p_before is null or l.at < p_before)
      order by l.at desc, l.id desc limit least(greatest(p_limit, 1), 200) + 1)
    union all
    (select 'pica_actions'::text as entity, l.id, l.record_id, l.at, l.actor_id, l.action, l.note, l.changes
       from __APP__.pica_actions_logs l
      where (p_entities is null or 'pica_actions' = any (p_entities)) and l.at >= p_from and l.at < p_to
        and (p_actor is null or l.actor_id = p_actor) and (p_action is null or l.action = p_action)
        and (p_before is null or l.at < p_before)
      order by l.at desc, l.id desc limit least(greatest(p_limit, 1), 200) + 1)
    union all
    (select 'reminder_rules'::text as entity, l.id, l.record_id, l.at, l.actor_id, l.action, l.note, l.changes
       from __APP__.reminder_rules_logs l
      where (p_entities is null or 'reminder_rules' = any (p_entities)) and l.at >= p_from and l.at < p_to
        and (p_actor is null or l.actor_id = p_actor) and (p_action is null or l.action = p_action)
        and (p_before is null or l.at < p_before)
      order by l.at desc, l.id desc limit least(greatest(p_limit, 1), 200) + 1)
    union all
    (select 'safety_activities'::text as entity, l.id, l.record_id, l.at, l.actor_id, l.action, l.note, l.changes
       from __APP__.safety_activities_logs l
      where (p_entities is null or 'safety_activities' = any (p_entities)) and l.at >= p_from and l.at < p_to
        and (p_actor is null or l.actor_id = p_actor) and (p_action is null or l.action = p_action)
        and (p_before is null or l.at < p_before)
      order by l.at desc, l.id desc limit least(greatest(p_limit, 1), 200) + 1)
    union all
    (select 'tsp_evaluations'::text as entity, l.id, l.record_id, l.at, l.actor_id, l.action, l.note, l.changes
       from __APP__.tsp_evaluations_logs l
      where (p_entities is null or 'tsp_evaluations' = any (p_entities)) and l.at >= p_from and l.at < p_to
        and (p_actor is null or l.actor_id = p_actor) and (p_action is null or l.action = p_action)
        and (p_before is null or l.at < p_before)
      order by l.at desc, l.id desc limit least(greatest(p_limit, 1), 200) + 1)
    union all
    (select 'tsp_programs'::text as entity, l.id, l.record_id, l.at, l.actor_id, l.action, l.note, l.changes
       from __APP__.tsp_programs_logs l
      where (p_entities is null or 'tsp_programs' = any (p_entities)) and l.at >= p_from and l.at < p_to
        and (p_actor is null or l.actor_id = p_actor) and (p_action is null or l.action = p_action)
        and (p_before is null or l.at < p_before)
      order by l.at desc, l.id desc limit least(greatest(p_limit, 1), 200) + 1)
    union all
    (select 'tsp_realizations'::text as entity, l.id, l.record_id, l.at, l.actor_id, l.action, l.note, l.changes
       from __APP__.tsp_realizations_logs l
      where (p_entities is null or 'tsp_realizations' = any (p_entities)) and l.at >= p_from and l.at < p_to
        and (p_actor is null or l.actor_id = p_actor) and (p_action is null or l.action = p_action)
        and (p_before is null or l.at < p_before)
      order by l.at desc, l.id desc limit least(greatest(p_limit, 1), 200) + 1)
    union all
    (select 'work_hours'::text as entity, l.id, l.record_id, l.at, l.actor_id, l.action, l.note, l.changes
       from __APP__.work_hours_logs l
      where (p_entities is null or 'work_hours' = any (p_entities)) and l.at >= p_from and l.at < p_to
        and (p_actor is null or l.actor_id = p_actor) and (p_action is null or l.action = p_action)
        and (p_before is null or l.at < p_before)
      order by l.at desc, l.id desc limit least(greatest(p_limit, 1), 200) + 1)
    union all
    (select 'reports'::text as entity, l.id, l.record_id, l.at, l.actor_id, l.action, l.note, l.changes
       from __APP__.reports_logs l
      where (p_entities is null or 'reports' = any (p_entities)) and l.at >= p_from and l.at < p_to
        and (p_actor is null or l.actor_id = p_actor) and (p_action is null or l.action = p_action)
        and (p_before is null or l.at < p_before)
      order by l.at desc, l.id desc limit least(greatest(p_limit, 1), 200) + 1)
    union all
    (select 'employees'::text as entity, l.id, l.record_id, l.at, l.actor_id, l.action, l.note, l.changes
       from __APP__.employees_logs l
      where (p_entities is null or 'employees' = any (p_entities)) and l.at >= p_from and l.at < p_to
        and (p_actor is null or l.actor_id = p_actor) and (p_action is null or l.action = p_action)
        and (p_before is null or l.at < p_before)
      order by l.at desc, l.id desc limit least(greatest(p_limit, 1), 200) + 1)
    union all
    (select 'position_requirements'::text as entity, l.id, l.record_id, l.at, l.actor_id, l.action, l.note, l.changes
       from __APP__.position_requirements_logs l
      where (p_entities is null or 'position_requirements' = any (p_entities)) and l.at >= p_from and l.at < p_to
        and (p_actor is null or l.actor_id = p_actor) and (p_action is null or l.action = p_action)
        and (p_before is null or l.at < p_before)
      order by l.at desc, l.id desc limit least(greatest(p_limit, 1), 200) + 1)
    union all
    (select 'competencies'::text as entity, l.id, l.record_id, l.at, l.actor_id, l.action, l.note, l.changes
       from __APP__.competencies_logs l
      where (p_entities is null or 'competencies' = any (p_entities)) and l.at >= p_from and l.at < p_to
        and (p_actor is null or l.actor_id = p_actor) and (p_action is null or l.action = p_action)
        and (p_before is null or l.at < p_before)
      order by l.at desc, l.id desc limit least(greatest(p_limit, 1), 200) + 1)
    union all
    (select 'certificates'::text as entity, l.id, l.record_id, l.at, l.actor_id, l.action, l.note, l.changes
       from __APP__.certificates_logs l
      where (p_entities is null or 'certificates' = any (p_entities)) and l.at >= p_from and l.at < p_to
        and (p_actor is null or l.actor_id = p_actor) and (p_action is null or l.action = p_action)
        and (p_before is null or l.at < p_before)
      order by l.at desc, l.id desc limit least(greatest(p_limit, 1), 200) + 1)
    union all
    (select 'mcu_records'::text as entity, l.id, l.record_id, l.at, l.actor_id, l.action, l.note, l.changes
       from __APP__.mcu_records_logs l
      where (p_entities is null or 'mcu_records' = any (p_entities)) and l.at >= p_from and l.at < p_to
        and (p_actor is null or l.actor_id = p_actor) and (p_action is null or l.action = p_action)
        and (p_before is null or l.at < p_before)
      order by l.at desc, l.id desc limit least(greatest(p_limit, 1), 200) + 1)
    union all
    (select 'site_permits'::text as entity, l.id, l.record_id, l.at, l.actor_id, l.action, l.note, l.changes
       from __APP__.site_permits_logs l
      where (p_entities is null or 'site_permits' = any (p_entities)) and l.at >= p_from and l.at < p_to
        and (p_actor is null or l.actor_id = p_actor) and (p_action is null or l.action = p_action)
        and (p_before is null or l.at < p_before)
      order by l.at desc, l.id desc limit least(greatest(p_limit, 1), 200) + 1)
    union all
    (select 'trainings'::text as entity, l.id, l.record_id, l.at, l.actor_id, l.action, l.note, l.changes
       from __APP__.trainings_logs l
      where (p_entities is null or 'trainings' = any (p_entities)) and l.at >= p_from and l.at < p_to
        and (p_actor is null or l.actor_id = p_actor) and (p_action is null or l.action = p_action)
        and (p_before is null or l.at < p_before)
      order by l.at desc, l.id desc limit least(greatest(p_limit, 1), 200) + 1)
    union all
    (select 'contractor_permits'::text as entity, l.id, l.record_id, l.at, l.actor_id, l.action, l.note, l.changes
       from __APP__.contractor_permits_logs l
      where (p_entities is null or 'contractor_permits' = any (p_entities)) and l.at >= p_from and l.at < p_to
        and (p_actor is null or l.actor_id = p_actor) and (p_action is null or l.action = p_action)
        and (p_before is null or l.at < p_before)
      order by l.at desc, l.id desc limit least(greatest(p_limit, 1), 200) + 1)
    union all
    (select 'contractor_contracts'::text as entity, l.id, l.record_id, l.at, l.actor_id, l.action, l.note, l.changes
       from __APP__.contractor_contracts_logs l
      where (p_entities is null or 'contractor_contracts' = any (p_entities)) and l.at >= p_from and l.at < p_to
        and (p_actor is null or l.actor_id = p_actor) and (p_action is null or l.action = p_action)
        and (p_before is null or l.at < p_before)
      order by l.at desc, l.id desc limit least(greatest(p_limit, 1), 200) + 1)
    union all
    (select 'csms_assessments'::text as entity, l.id, l.record_id, l.at, l.actor_id, l.action, l.note, l.changes
       from __APP__.csms_assessments_logs l
      where (p_entities is null or 'csms_assessments' = any (p_entities)) and l.at >= p_from and l.at < p_to
        and (p_actor is null or l.actor_id = p_actor) and (p_action is null or l.action = p_action)
        and (p_before is null or l.at < p_before)
      order by l.at desc, l.id desc limit least(greatest(p_limit, 1), 200) + 1)
    union all
    (select 'contractor_documents'::text as entity, l.id, l.record_id, l.at, l.actor_id, l.action, l.note, l.changes
       from __APP__.contractor_documents_logs l
      where (p_entities is null or 'contractor_documents' = any (p_entities)) and l.at >= p_from and l.at < p_to
        and (p_actor is null or l.actor_id = p_actor) and (p_action is null or l.action = p_action)
        and (p_before is null or l.at < p_before)
      order by l.at desc, l.id desc limit least(greatest(p_limit, 1), 200) + 1)
    union all
    (select 'pjo_pja_appointments'::text as entity, l.id, l.record_id, l.at, l.actor_id, l.action, l.note, l.changes
       from __APP__.pjo_pja_appointments_logs l
      where (p_entities is null or 'pjo_pja_appointments' = any (p_entities)) and l.at >= p_from and l.at < p_to
        and (p_actor is null or l.actor_id = p_actor) and (p_action is null or l.action = p_action)
        and (p_before is null or l.at < p_before)
      order by l.at desc, l.id desc limit least(greatest(p_limit, 1), 200) + 1)
  ) u
  order by u.at desc, u.id desc
  limit least(greatest(p_limit, 1), 200) + 1;
end $$;
revoke execute on function __APP__.audit_trail(text[], uuid, text, timestamptz, timestamptz, timestamptz, integer) from public, anon;
