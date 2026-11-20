-- =====================================================================================
-- 05 FEEDBACK · backend-guide §11.2
-- Koreksi K7: guide memakai view security_invoker untuk menyembunyikan admin_note, padahal
-- pelapor tetap bisa SELECT admin_note langsung dari tabel. Di sini tabel hanya bisa dibaca
-- admin; pelapor membaca lewat view feedback_mine (owner-rights, difilter auth.uid()).
-- =====================================================================================

create table __APP__.feedback (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  category        text not null check (category in ('bug', 'fitur', 'tampilan', 'performa', 'pertanyaan', 'lainnya')),
  category_other  text check (length(category_other) <= 100),
  content         jsonb not null,                       -- dokumen Tiptap
  content_text    text not null check (length(content_text) between 1 and 10000),   -- teks polos (list, cari)
  attachments     text[] not null default '{}' check (cardinality(attachments) <= 5),
  context         jsonb,                                -- halaman asal, versi, perangkat, tema
  status          text not null default 'baru' check (status in ('baru', 'diproses', 'selesai')),
  admin_note      text check (length(admin_note) <= 2000),
  handled_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint feedback_size check (pg_column_size(content) < 65536 and coalesce(pg_column_size(context), 0) < 4096)
);
comment on table __APP__.feedback is 'Feedback pengguna. Tabel hanya dibaca admin; pelapor lewat view feedback_mine.';
create index feedback_user_idx on __APP__.feedback (user_id, created_at desc);
create index feedback_status_idx on __APP__.feedback (status, created_at desc);
create index feedback_handled_by_idx on __APP__.feedback (handled_by);

create trigger feedback_set_updated_at before update on __APP__.feedback
  for each row execute function public.set_updated_at();

alter table __APP__.feedback enable row level security;
revoke insert, update, delete on __APP__.feedback from authenticated;
create policy "feedback: admin read" on __APP__.feedback for select to authenticated
  using ((select public.has_app_role('__APP__', 'admin')));
create policy "feedback: admin delete" on __APP__.feedback for delete to authenticated
  using ((select public.has_app_role('__APP__', 'admin')));
grant delete on __APP__.feedback to authenticated;

-- View pelapor: tanpa admin_note & handled_by. Owner-rights (bukan security_invoker) + filter uid.
create view __APP__.feedback_mine as
  select id, category, category_other, content, content_text, attachments, status, created_at, updated_at
    from __APP__.feedback
   where user_id = (select auth.uid());
comment on view __APP__.feedback_mine is 'Feedback milik user yang login (tanpa catatan internal admin).';
revoke all on __APP__.feedback_mine from anon, public;
grant select on __APP__.feedback_mine to authenticated;

create or replace function __APP__.feedback_submit(p_category text, p_category_other text, p_content jsonb,
  p_content_text text, p_attachments text[] default '{}', p_context jsonb default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := (select auth.uid());
  v_id    uuid;
  v_name  text;
  v_notif uuid[];
begin
  if not public.has_app_role('__APP__', 'viewer') then
    raise exception 'Tidak punya akses ke app ini.' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_content_text, ''))) = 0 then
    raise exception 'Isi feedback wajib diisi.' using errcode = 'P0001';
  end if;
  insert into __APP__.feedback (user_id, category, category_other, content, content_text, attachments, context)
  values (v_uid, p_category, nullif(btrim(p_category_other), ''), p_content, btrim(p_content_text),
          coalesce(p_attachments, '{}'), p_context)
  returning id into v_id;

  select full_name into v_name from public.profiles where id = v_uid;
  v_notif := array(select * from __APP__.notify(__APP__.app_admin_ids(), 'feedback.new',
    format('Feedback baru dari %s', coalesce(v_name, 'pengguna')), left(btrim(p_content_text), 200),
    '/feedback/kelola?id=' || v_id, 'feedback', 'feedback', v_id::text));
  return jsonb_build_object('id', v_id, 'notification_ids', to_jsonb(v_notif));
end $$;

create or replace function __APP__.feedback_set_status(p_id uuid, p_status text, p_admin_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_old   __APP__.feedback;
  v_notif uuid[] := '{}';
  v_label text;
begin
  if not public.has_app_role('__APP__', 'admin') then
    raise exception 'Hanya admin app yang bisa mengubah status feedback.' using errcode = 'P0001';
  end if;
  if p_status not in ('baru', 'diproses', 'selesai') then
    raise exception 'Status tidak valid.' using errcode = 'P0001';
  end if;
  select * into v_old from __APP__.feedback where id = p_id for update;
  if not found then raise exception 'Feedback tidak ditemukan.' using errcode = 'P0001'; end if;

  update __APP__.feedback
     set status = p_status, admin_note = nullif(btrim(p_admin_note), ''), handled_by = (select auth.uid())
   where id = p_id;

  if p_status is distinct from v_old.status then
    v_label := case p_status when 'diproses' then 'sedang diproses' when 'selesai' then 'selesai ditangani' else 'dibuka kembali' end;
    v_notif := array(select * from __APP__.notify(array[v_old.user_id], 'feedback.status',
      format('Feedback Anda %s', v_label), null, '/feedback', 'feedback', 'feedback', p_id::text));
  end if;
  return jsonb_build_object('notification_ids', to_jsonb(v_notif));
end $$;

revoke execute on function __APP__.feedback_submit(text, text, jsonb, text, text[], jsonb),
  __APP__.feedback_set_status(uuid, text, text) from public, anon;
