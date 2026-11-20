-- =====================================================================================
-- 07 STORAGE · backend-guide §13. Bucket: __HOST__-lampiran, __HOST__-media (private).
-- Path lampiran:
--   <record_id>/<nama>               lampiran dokumen (editor tulis)
--   support/<thread_id>/<nama>       Bantuan Admin (peserta thread)
--   feedback/<user_id>/<nama>        lampiran feedback (pemilik + admin)
-- Path media: updates/<id>/<nama> (admin tulis)
-- =====================================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('__HOST__-lampiran', '__HOST__-lampiran', false, 20971520,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
       ('__HOST__-media', '__HOST__-media', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

-- ---------- lampiran ----------
create policy "__HOST__-lampiran: read" on storage.objects for select to authenticated
  using (bucket_id = '__HOST__-lampiran' and (select public.has_app_role('__APP__', 'viewer')) and (
    case (storage.foldername(name))[1]
      when 'support'  then exists (select 1 from __APP__.support_threads t
                                    where t.id::text = (storage.foldername(name))[2])     -- ikut RLS thread
                           -- K9: lampiran pesan pertama diunggah sebelum thread ada (support/new-<uid>/)
                           or (storage.foldername(name))[2] = 'new-' || (select auth.uid())::text
                           or ((storage.foldername(name))[2] like 'new-%' and (select public.has_app_role('__APP__', 'admin')))
      when 'feedback' then (storage.foldername(name))[2] = (select auth.uid())::text
                           or (select public.has_app_role('__APP__', 'admin'))
      else true
    end));

create policy "__HOST__-lampiran: insert" on storage.objects for insert to authenticated
  with check (bucket_id = '__HOST__-lampiran' and (
    case (storage.foldername(name))[1]
      when 'support'  then exists (select 1 from __APP__.support_threads t
                                    where t.id::text = (storage.foldername(name))[2])
                           -- unggah sebelum thread dibuat: folder support/new-<uid>/
                           or (storage.foldername(name))[2] = 'new-' || (select auth.uid())::text
      when 'feedback' then (storage.foldername(name))[2] = (select auth.uid())::text
                           and (select public.has_app_role('__APP__', 'viewer'))
      else (select public.has_app_role('__APP__', 'editor'))
    end));

create policy "__HOST__-lampiran: update" on storage.objects for update to authenticated
  using (bucket_id = '__HOST__-lampiran' and (select public.has_app_role('__APP__', 'editor')));

create policy "__HOST__-lampiran: delete" on storage.objects for delete to authenticated
  using (bucket_id = '__HOST__-lampiran' and (
    (select public.has_app_role('__APP__', 'admin')) or owner_id = (select auth.uid())::text));

-- ---------- media ----------
create policy "__HOST__-media: viewer read" on storage.objects for select to authenticated
  using (bucket_id = '__HOST__-media' and (select public.has_app_role('__APP__', 'viewer')));
create policy "__HOST__-media: admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = '__HOST__-media' and (select public.has_app_role('__APP__', 'admin')));
create policy "__HOST__-media: admin update" on storage.objects for update to authenticated
  using (bucket_id = '__HOST__-media' and (select public.has_app_role('__APP__', 'admin')));
create policy "__HOST__-media: admin delete" on storage.objects for delete to authenticated
  using (bucket_id = '__HOST__-media' and (select public.has_app_role('__APP__', 'admin')));
