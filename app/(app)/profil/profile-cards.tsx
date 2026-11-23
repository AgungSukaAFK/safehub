"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Building2, Camera, ExternalLink, IdCard, ImageIcon, Mail, MapPin, Trash2, Users } from "lucide-react";
import { AccentPanel, FontPanel, ThemeModePanel } from "@/components/appearance/appearance-panels";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { InfoItem } from "@/components/detail/info-item";
import { SubmitButton } from "@/components/form/submit-button";
import { Field, fieldError, useActionToast, useFormAction } from "@/components/form-bits";
import { Content } from "@/components/list/content";
import { NotificationSettings } from "@/components/notifications/notification-settings";
import { AVATAR_UPDATED_EVENT, useApp } from "@/components/providers/app-context";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { AvatarViewerDialog } from "@/components/user/avatar-viewer-dialog";
import { ImageCropDialog } from "@/components/user/image-crop-dialog";
import { UserAvatar } from "@/components/user/user-avatar";
import { forgetPersonCard } from "@/components/user/user-profile-card";
import { APP_ID } from "@/lib/app-config";
import { uploadAvatarFile } from "@/lib/avatar-upload";
import { formatRupiah } from "@/lib/format";
import { isRole, ROLE_LABELS } from "@/lib/roles";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { discardAvatarUploadAction, setAvatarAction, updatePhoneAction } from "./actions";

const IT_HINT = "Diubah oleh tim IT";

function announceAvatar(userId: string, url: string | null) {
  forgetPersonCard(userId);
  window.dispatchEvent(new CustomEvent(AVATAR_UPDATED_EVENT, { detail: url }));
}

// ---------------------------------------------------------------- 1. Data Profil

export function ProfileDataCard({ nrp }: { nrp: string | null }) {
  const router = useRouter();
  const { access, avatarUrl, companies } = useApp();
  const p = access.profile;
  const [cropOpen, setCropOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const company = companies.find((c) => c.code === p.company);

  const { state, pending, onSubmit } = useFormAction(updatePhoneAction);
  useActionToast(state, { onSuccess: () => forgetPersonCard(access.userId) });

  const saveAvatar = async (blob: Blob) => {
    const path = await uploadAvatarFile(access.userId, blob);
    let res;
    try {
      res = await setAvatarAction(path);
    } catch (e) {
      void discardAvatarUploadAction(path);
      throw e;
    }
    if (res.status !== "ok") throw new Error(res.message);
    announceAvatar(access.userId, (res.data?.url as string) ?? null);
    toast.success(res.message);
    router.refresh();
  };

  const removeAvatar = async () => {
    const res = await setAvatarAction(null);
    if (res.status !== "ok") {
      toast.error(res.message);
      throw new Error(res.message);
    }
    announceAvatar(access.userId, null);
    toast.success(res.message);
    router.refresh();
  };

  const face = (
    <>
      <UserAvatar name={p.fullName} src={avatarUrl} className="size-24 border text-2xl" />
      <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100 pointer-coarse:hidden">
        <Camera className="size-6" />
      </span>
      {/* layar sentuh tidak bisa hover → penanda "bisa diganti" selalu tampil */}
      <span className="absolute right-0 bottom-0 hidden size-8 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background pointer-coarse:flex">
        <Camera className="size-4" />
      </span>
    </>
  );
  const faceCls = "group relative shrink-0 cursor-pointer rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none";

  return (
    <Content size="md" title="Data Profil" description="Nama, perusahaan, dan jabatan dikelola tim IT. Anda bisa mengubah foto dan No HP.">
      <div className="mb-6 flex flex-col items-center gap-4 sm:flex-row">
        {avatarUrl ? (
          <DropdownMenu>
            <DropdownMenuTrigger render={<button type="button" className={faceCls} aria-label="Foto profil" />}>{face}</DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => setViewerOpen(true)}>
                <ImageIcon /> Lihat foto
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCropOpen(true)}>
                <Camera /> Ganti foto
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <button type="button" onClick={() => setCropOpen(true)} className={faceCls} aria-label="Unggah foto profil">
            {face}
          </button>
        )}
        <div className="flex flex-col items-center gap-2 sm:items-start">
          <div className="text-center sm:text-left">
            <p className="font-semibold">{p.fullName}</p>
            <p className="text-xs text-muted-foreground">JPG, PNG, atau WebP sampai 10 MB. Disimpan sebagai foto persegi kecil.</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setCropOpen(true)}>
              <Camera /> {avatarUrl ? "Ganti Foto" : "Unggah Foto"}
            </Button>
            {avatarUrl && (
              <Button size="sm" variant="outline" onClick={() => setRemoveOpen(true)}>
                <Trash2 /> Hapus
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2.5">
        <InfoItem icon={Mail} label="Email" value={access.email} />
        <InfoItem icon={Building2} label="Perusahaan" value={company?.name ?? p.company ?? "Akun IT (semua perusahaan)"} />
        <InfoItem icon={IdCard} label="NRP" value={nrp} />
        <InfoItem icon={Users} label="Departemen" value={p.departmentName} />
        <InfoItem icon={Briefcase} label="Jabatan" value={p.jobTitleName} />
        <InfoItem icon={MapPin} label="Lokasi" value={p.locationName} />
        <p className="text-xs text-muted-foreground">Ada data yang salah? {IT_HINT}; hubungi atasan atau tim IT.</p>
      </div>

      <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-end">
        <Field label="No HP" htmlFor="phone" error={fieldError(state, "phone")} hint="Dipakai rekan kerja untuk menghubungi Anda lewat WhatsApp." className="flex-1">
          <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={p.phone ?? ""} placeholder="0812 3456 7890" maxLength={20} />
        </Field>
        <SubmitButton pending={pending} className="sm:mb-5">
          Simpan No HP
        </SubmitButton>
      </form>

      <ImageCropDialog
        open={cropOpen}
        onOpenChange={setCropOpen}
        onSave={saveAvatar}
        aspect={1}
        outputWidth={512}
        maxBytes={300 * 1024}
        guide="circle"
        allowCamera
        title="Ganti Foto Profil"
        editTitle="Sesuaikan Foto"
        pickDescription="Pilih gambar maksimal 10 MB. Hasil akhir berbentuk persegi 1:1."
        saveLabel="Simpan Foto"
        errorTitle="Gagal menyimpan foto profil"
      />
      {avatarUrl && <AvatarViewerDialog open={viewerOpen} onOpenChange={setViewerOpen} src={avatarUrl} name={p.fullName} />}
      <ConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title="Hapus foto profil?"
        description="Foto diganti inisial nama Anda di semua tempat."
        confirmText="Hapus foto"
        destructive
        onConfirm={removeAvatar}
      />
    </Content>
  );
}

// ---------------------------------------------------------------- 2. Tampilan

export function AppearanceCard() {
  return (
    <Content title="Tampilan" description="Berlaku di perangkat ini saja.">
      {/* target /profil#tampilan dari menu profil HP */}
      <div id="tampilan" className="scroll-mt-24 space-y-5">
        <div>
          <ThemeModePanel />
        </div>
        <div>
          <AccentPanel />
        </div>
        <div>
          <FontPanel />
        </div>
      </div>
    </Content>
  );
}

// ---------------------------------------------------------------- 3. Notifikasi

export function NotificationCard() {
  return (
    <Content size="md" title="Notifikasi" description="Suara, notifikasi browser, dan Notifikasi HP untuk perangkat ini.">
      <NotificationSettings />
    </Content>
  );
}

// ---------------------------------------------------------------- 4. Akses Saya

export function AccessCard() {
  const { myApps: apps, access } = useApp();
  return (
    <Content title="Akses Saya" description="App Lourdes yang bisa Anda buka dan role Anda di sana.">
      {access.platformAdmin && <p className="mb-3 text-xs text-muted-foreground">Anda admin platform: otomatis Admin di semua app.</p>}
      {apps.length ? (
        <ul className="divide-y rounded-lg border">
          {apps.map((a) => {
            const current = a.id === APP_ID;
            return (
              <li key={a.id} className={cn("flex items-center gap-3 px-3 py-2.5", current && "bg-primary/5")}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {a.name}
                    {current && <span className="ml-2 text-xs font-normal text-primary">(app ini)</span>}
                  </p>
                  {a.description && <p className="truncate text-xs text-muted-foreground">{a.description}</p>}
                </div>
                <span className="shrink-0 rounded border px-1.5 py-0.5 text-[11px] font-medium">{isRole(a.role) ? ROLE_LABELS[a.role] : a.role}</span>
                {a.url && !current && (
                  <a href={a.url} target="_blank" rel="noopener noreferrer" data-pwa-new-window aria-label={`Buka ${a.name}`} className="shrink-0 text-muted-foreground hover:text-foreground">
                    <ExternalLink className="size-4" />
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Akses Anda ke app ini berasal dari peran admin platform.</p>
      )}
    </Content>
  );
}

// ---------------------------------------------------------------- 5. Data di app ini (members)

export function MemberInfoCard({ member }: { member: { team: string | null; approvalLimit: number | null } | null }) {
  return (
    <Content size="md" title="Data di App Ini" description="Diatur admin app.">
      {member && (member.team || member.approvalLimit !== null) ? (
        <div className="space-y-2.5">
          <InfoItem icon={Users} label="Tim" value={member.team} />
          <InfoItem icon={IdCard} label="Batas approval" value={member.approvalLimit !== null ? formatRupiah(member.approvalLimit) : "Tidak ada batas"} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Belum ada data khusus app untuk Anda.</p>
      )}
    </Content>
  );
}
