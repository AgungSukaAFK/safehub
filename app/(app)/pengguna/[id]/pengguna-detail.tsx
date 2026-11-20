"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Briefcase, Building2, Calendar, FileText, History, IdCard, KeyRound, Mail, MapPin, Phone, ShieldCheck, UserMinus, UserPlus, Users } from "lucide-react";
import { ActivityLogDialog } from "@/components/detail/activity-log-dialog";
import { InfoItem } from "@/components/detail/info-item";
import { StatusBadge } from "@/components/detail/status-badge";
import { CurrencyInput } from "@/components/form/currency-input";
import { SubmitButton } from "@/components/form/submit-button";
import { Field, fieldError, useActionToast, useFormAction } from "@/components/form-bits";
import { Content } from "@/components/list/content";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user/user-avatar";
import { useGoBack } from "@/hooks/use-go-back";
import { formatDate, formatDateTime } from "@/lib/format";
import type { PengajuanBrief } from "@/lib/pengajuan";
import type { PenggunaDetail } from "@/lib/pengguna";
import { MEMBER_FIELD_LABELS } from "@/lib/pengguna-rules";
import { DOCUMENT_STATUS } from "@/lib/status";
import { ChangeRoleDialog, GrantAccessDialog, RevokeAccessDialog, type AccessTarget } from "../access-dialogs";
import { saveMemberAction } from "../actions";
import { ActiveBadge, RoleBadge } from "../pengguna-table";

export function PenggunaDetailView({
  detail,
  docs,
  currentUserId,
}: {
  detail: PenggunaDetail;
  docs: { total: number; rows: PengajuanBrief[] };
  currentUserId: string;
}) {
  const { person, access, member } = detail;
  const goBack = useGoBack("/pengguna");
  const [roleTarget, setRoleTarget] = useState<AccessTarget | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<AccessTarget | null>(null);
  const [grantOpen, setGrantOpen] = useState(false);
  const target: AccessTarget | null = access ? { userId: person.id, name: person.name, role: access.role } : null;

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={goBack} aria-label="Kembali" className="-ml-2 no-print">
              <ArrowLeft />
            </Button>
            {person.name}
          </span>
        }
        description={person.email ?? undefined}
        actions={
          access ? (
            <>
              <Button variant="outline" onClick={() => setRoleTarget(target)}>
                <KeyRound /> Ubah role
              </Button>
              <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setRevokeTarget(target)}>
                <UserMinus /> Cabut akses
              </Button>
            </>
          ) : (
            <Button onClick={() => setGrantOpen(true)} disabled={!person.isActive}>
              <UserPlus /> Beri akses
            </Button>
          )
        }
      />

      <Content size="md" title="Profil" description="Data dari direktori karyawan. Diubah oleh tim IT di konsol platform.">
        <div className="mb-4 flex items-center gap-4">
          <UserAvatar name={person.name} src={person.avatarUrl} className="size-16 text-lg" />
          <div className="min-w-0 space-y-1">
            <p className="truncate font-semibold">{person.name}</p>
            <ActiveBadge active={person.isActive} />
          </div>
        </div>
        <div className="space-y-2.5">
          <InfoItem icon={Mail} label="Email" value={person.email} />
          <InfoItem icon={Building2} label="Perusahaan" value={person.company ?? "Akun IT (semua perusahaan)"} />
          <InfoItem icon={IdCard} label="NRP" value={person.nrp} />
          <InfoItem icon={Users} label="Departemen" value={person.department} />
          <InfoItem icon={Briefcase} label="Jabatan" value={person.jobTitle} />
          <InfoItem icon={MapPin} label="Lokasi" value={person.location} />
          <InfoItem icon={Phone} label="No HP" value={person.phone} />
        </div>
      </Content>

      <Content size="md" title="Akses di app ini">
        {access ? (
          <div className="space-y-2.5">
            <InfoItem icon={ShieldCheck} label="Role" value={<RoleBadge role={access.role} />} />
            <InfoItem icon={Calendar} label="Diberikan" value={formatDateTime(access.grantedAt)} />
            <InfoItem icon={UserPlus} label="Oleh" value={access.grantedBy?.name ?? "Sistem / tim IT"} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {person.isActive ? "Orang ini belum punya akses ke app ini." : "Akun ini nonaktif dan tidak punya akses ke app ini."}
          </p>
        )}
      </Content>

      <MemberCard userId={person.id} member={member} />

      <Content
        size="md"
        title="Dokumen"
        description={docs.total ? `${docs.total} pengajuan dibuat orang ini (yang terlihat oleh Anda).` : undefined}
      >
        {docs.rows.length ? (
          <ul className="divide-y">
            {docs.rows.map((d) => (
              <li key={d.id}>
                <Link href={`/pengajuan/${d.id}`} className="flex items-center gap-3 py-2.5 hover:bg-muted/40">
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{d.code ?? "Draft"}</span>
                    <span className="block truncate text-xs text-muted-foreground">{d.title}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <StatusBadge value={d.status} map={DOCUMENT_STATUS} />
                    <span className="text-[11px] text-muted-foreground">{formatDate(d.createdAt)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Belum ada dokumen.</p>
        )}
      </Content>

      <GrantAccessDialog open={grantOpen} onOpenChange={setGrantOpen} />
      <ChangeRoleDialog target={roleTarget} currentUserId={currentUserId} onOpenChange={(o) => !o && setRoleTarget(null)} />
      <RevokeAccessDialog target={revokeTarget} currentUserId={currentUserId} onOpenChange={(o) => !o && setRevokeTarget(null)} />
    </>
  );
}

function MemberCard({ userId, member }: { userId: string; member: PenggunaDetail["member"] }) {
  const { state, pending, onSubmit } = useFormAction(saveMemberAction);
  useActionToast(state);
  const [limit, setLimit] = useState(member?.approvalLimit !== null && member?.approvalLimit !== undefined ? String(member.approvalLimit) : "");

  return (
    <Content
      size="md"
      title="Data Anggota"
      description="Data khusus app ini, diatur admin. Perubahan tercatat di riwayat."
      cardAction={
        member && (
          <ActivityLogDialog
            entity="members"
            recordId={member.id}
            fieldLabels={MEMBER_FIELD_LABELS}
            trigger={
              <Button variant="outline" size="sm">
                <History /> Riwayat
              </Button>
            }
          />
        )
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <input type="hidden" name="user_id" value={userId} />
        <Field label="Tim" htmlFor="team" error={fieldError(state, "team")} hint="Mis. Tim Pengadaan Bekasi.">
          <Input id="team" name="team" defaultValue={member?.team ?? ""} maxLength={100} />
        </Field>
        <Field label="Batas approval" htmlFor="approval_limit" error={fieldError(state, "approval_limit")} hint="Kosongkan kalau tidak ada batas.">
          <CurrencyInput id="approval_limit" name="approval_limit" value={limit} onValueChange={setLimit} />
        </Field>
        <Field label="Catatan admin" htmlFor="admin_note" error={fieldError(state, "admin_note")} hint="Catatan internal. Tidak ditampilkan di halaman Profil orang ini.">
          <Textarea id="admin_note" name="admin_note" defaultValue={member?.adminNote ?? ""} maxLength={1000} rows={3} />
        </Field>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">{member ? `Terakhir diubah ${formatDateTime(member.updatedAt)}` : "Belum pernah diisi."}</span>
          <SubmitButton pending={pending}>Simpan</SubmitButton>
        </div>
      </form>
    </Content>
  );
}


