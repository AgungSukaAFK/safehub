"use client";

// Isi menu akun (dipakai NavUser di sidebar & TopbarProfile): kepala (avatar, nama, email, role),
// Profil Saya, Lihat Foto, Keluar (merah, dengan konfirmasi).

import { useState, type ReactElement } from "react";
import Link from "next/link";
import { ImageIcon, LogOut, SquareUserRound } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useApp } from "@/components/providers/app-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AvatarViewerDialog } from "@/components/user/avatar-viewer-dialog";
import { UserAvatar } from "@/components/user/user-avatar";
import { ROLE_LABELS } from "@/lib/roles";
import { signOutEverywhereLocal } from "@/lib/signout";
import { toast } from "@/lib/toast";

/** Dialog konfirmasi Keluar (dipakai menu akun & aksi cepat global search). */
export function LogoutConfirm({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { access } = useApp();
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Keluar dari app?"
      description="Draft form dan data offline di perangkat ini ikut dihapus."
      confirmText="Keluar"
      destructive
      offlineOk
      onConfirm={async () => {
        toast.loading("Keluar...", { id: "logout" });
        await signOutEverywhereLocal(access.userId);
      }}
    />
  );
}

export function AccountMenu({
  trigger,
  align = "end",
  side = "bottom",
}: {
  trigger: ReactElement;
  align?: "start" | "end" | "center";
  side?: "top" | "bottom" | "right" | "left";
}) {
  const { access, avatarUrl } = useApp();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const name = access.profile.fullName;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={trigger} />
        <DropdownMenuContent
          align={align}
          side={side}
          sideOffset={8}
          collisionPadding={8}
          className="w-[min(16rem,calc(100vw-1rem))] rounded-lg"
        >
          <DropdownMenuGroup>
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <UserAvatar name={name} src={avatarUrl} shape="rounded" className="size-9" />
                <div className="grid flex-1 leading-tight">
                  <span className="truncate font-medium text-foreground">{name}</span>
                  <span className="truncate text-xs text-muted-foreground">{access.email}</span>
                  <span className="truncate text-[11px] text-muted-foreground">
                    {ROLE_LABELS[access.role]}
                    {access.profile.departmentName ? ` · ${access.profile.departmentName}` : ""}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem render={<Link href="/profil" />}>
              <SquareUserRound />
              Profil Saya
            </DropdownMenuItem>
            {avatarUrl && (
              <DropdownMenuItem onClick={() => setViewerOpen(true)}>
                <ImageIcon />
                Lihat Foto
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setLogoutOpen(true)}>
            <LogOut />
            Keluar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <LogoutConfirm open={logoutOpen} onOpenChange={setLogoutOpen} />
      {avatarUrl && <AvatarViewerDialog open={viewerOpen} onOpenChange={setViewerOpen} src={avatarUrl} name={name} />}
    </>
  );
}
