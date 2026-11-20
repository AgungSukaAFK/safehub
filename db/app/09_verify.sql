-- =====================================================================================
-- 09 VERIFIKASI PUBLIK (OPSIONAL) · backend-guide §11.6, frontend-guide §19.4
-- Aktifkan hanya kalau dokumen cetak dipakai pihak luar, dengan IZIN USER, dan catat di
-- CLAUDE.md app. Membuka schema app untuk anon (usage) + SATU fungsi; tidak ada grant tabel.
-- Contoh ini untuk dokumen "pengajuan" (butuh example_pengajuan.sql).
-- =====================================================================================

grant usage on schema __APP__ to anon;

create or replace function __APP__.verify_document(p_token uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v jsonb;
begin
  select jsonb_build_object(
           'jenis', 'Pengajuan', 'kode', d.code, 'perusahaan', c.name, 'company_code', c.code,
           'logo', c.logo_url, 'tanggal', d.created_at, 'status', d.status,
           'disetujui', (select jsonb_agg(jsonb_build_object('nama', p.full_name, 'waktu', a.decided_at,
                                                             'tipe', a.approval_type) order by a.step_no)
                           from __APP__.approvals a join public.profiles p on p.id = a.approver_id
                          where a.doc_type = 'pengajuan' and a.record_id = d.id and a.status = 'approved'
                            and a.round = (select max(round) from __APP__.approvals x
                                            where x.doc_type = 'pengajuan' and x.record_id = d.id)))
    into v
    from __APP__.pengajuan d join public.companies c on c.code = d.company_code
   where d.verify_token = p_token and d.status not in ('draft', 'cancelled');

  perform public.cctv_log('__APP__', 'public', 'public.verify_document',
    case when v is null then 'Verifikasi dokumen gagal (token tidak dikenal)'
         else format('Dokumen %s diverifikasi lewat QR', v ->> 'kode') end,
    case when v is null then 'warning' else 'info' end, 'pengajuan', null, v ->> 'kode');
  return v;   -- null = tidak ditemukan
end $$;
revoke execute on function __APP__.verify_document(uuid) from public;
grant  execute on function __APP__.verify_document(uuid) to anon, authenticated;

-- Admin membuat token baru (dokumen dicetak ulang setelah revisi) → QR lama tidak berlaku
create or replace function __APP__.pengajuan_rotate_verify_token(p_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v   uuid := gen_random_uuid();
  v_d __APP__.pengajuan;
begin
  if not public.has_app_role('__APP__', 'admin') then
    raise exception 'Hanya admin app yang bisa membuat ulang QR verifikasi.' using errcode = 'P0001';
  end if;
  -- verify_token tidak ikut riwayat (log_changes mengabaikannya); catat aksinya secara eksplisit
  update __APP__.pengajuan set verify_token = v where id = p_id returning * into v_d;
  if not found then raise exception 'Dokumen tidak ditemukan.' using errcode = 'P0001'; end if;
  perform __APP__.write_log('pengajuan', p_id, 'admin_edit',
    jsonb_build_object('qr_verifikasi', jsonb_build_object('old', 'lama', 'new', 'dibuat ulang')),
    'QR verifikasi dibuat ulang; QR lama tidak berlaku', v_d.code, v_d.company_code, '/pengajuan/', 'Pengajuan', true);
  return v;
end $$;
revoke execute on function __APP__.pengajuan_rotate_verify_token(uuid) from public, anon;
