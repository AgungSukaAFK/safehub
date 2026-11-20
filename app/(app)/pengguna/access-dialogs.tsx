"use client";

// Dialog Pengguna & Akses: Tambah Akses (cari orang di direktori → pilih role) dan Ubah role,
// plus konfirmasi Cabut akses. Dipakai di list dan halaman /pengguna/[id].
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SearchableSelect, type SelectOption } from "@/components/form/searchable-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ROLE_HINTS } from "@/lib/pengguna-rules";
import { ROLE_LABELS, ROLES, type Role } from "@/lib/roles";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { changeRoleAction, grantAccessAction, revokeAccessAction, searchDirectoryAction } from "./actions";

function RolePicker({ value, onChange, disabled }: { value: Role | null; onChange: (r: Role) => void; disabled?: boolean }) {
  return (
    <RadioGroup value={value ?? ""} onValueChange={(v) => onChange(v as Role)} disabled={disabled} aria-label="Role" className="gap-2">
      {ROLES.map((r) => (
        <Label
          key={r}
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal transition-colors hover:bg-muted/50",
            value === r && "border-primary bg-primary/5",
          )}
        >
          <RadioGroupItem value={r} className="mt-0.5" />
          <span className="space-y-0.5">
            <span className="block text-sm font-medium">{ROLE_LABELS[r]}</span>
            <span className="block text-xs text-muted-foreground">{ROLE_HINTS[r]}</span>
          </span>
        </Label>
      ))}
    </RadioGroup>
  );
}

export function GrantAccessDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [person, setPerson] = useState<SelectOption | null>(null);
  const [role, setRole] = useState<Role | null>("viewer");
  const [saving, setSaving] = useState(false);

  const close = (o: boolean) => {
    if (saving) return;
    onOpenChange(o);
    if (!o) {
      setPerson(null);
      setRole("viewer");
    }
  };

  const save = async () => {
    if (!person || !role) return;
    setSaving(true);
    const res = await grantAccessAction(person.value, role);
    setSaving(false);
    if (res.status !== "ok") return toast.error(res.message);
    toast.success(res.message);
    close(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah Akses</DialogTitle>
          <DialogDescription>Pilih karyawan dari direktori lalu tentukan role-nya di app ini.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-1.5">
            <Label htmlFor="grant-person">Karyawan</Label>
            <SearchableSelect
              id="grant-person"
              value={person?.value ?? null}
              selectedOption={person}
              onValueChange={(_, opt) => setPerson(opt)}
              loadOptions={searchDirectoryAction}
              placeholder="Cari nama, email, atau NRP..."
              emptyText="Tidak ditemukan, atau sudah punya akses."
              disabled={saving}
            />
            <p className="text-xs text-muted-foreground">Hanya akun aktif yang belum punya akses. Akun baru dibuat tim IT di konsol platform.</p>
          </div>
          <div className="grid gap-1.5">
            <Label>Role</Label>
            <RolePicker value={role} onChange={setRole} disabled={saving} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={saving}>
            Batal
          </Button>
          <Button onClick={save} disabled={!person || !role || saving}>
            {saving ? <Loader2 className="animate-spin" /> : <UserPlus />} Beri Akses
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type AccessTarget = { userId: string; name: string; role: Role };

/** Setelah mengubah akses diri sendiri, halaman admin bisa tidak boleh dibuka lagi. */
function afterSelfChange(router: ReturnType<typeof useRouter>, revoked: boolean, newRole?: Role) {
  if (revoked) router.replace("/no-access");
  else if (newRole !== "admin") router.replace("/");
}

export function ChangeRoleDialog({
  target,
  currentUserId,
  onOpenChange,
}: {
  target: AccessTarget | null;
  currentUserId: string;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(target?.role ?? null);
  const [saving, setSaving] = useState(false);
  const [lastTarget, setLastTarget] = useState(target);
  // reset pilihan saat target berganti (pola "adjust state during render", tanpa effect)
  if (target !== lastTarget) {
    setLastTarget(target);
    setRole(target?.role ?? null);
  }
  const self = target?.userId === currentUserId;

  const save = async () => {
    if (!target || !role) return;
    setSaving(true);
    const res = await changeRoleAction(target.userId, role);
    setSaving(false);
    if (res.status !== "ok") return toast.error(res.message);
    toast.success(res.message);
    onOpenChange(false);
    if (res.data?.self) afterSelfChange(router, false, role);
    else router.refresh();
  };

  return (
    <Dialog open={!!target} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ubah role {target?.name}</DialogTitle>
          <DialogDescription>Berlaku saat orang ini membuka halaman berikutnya.</DialogDescription>
        </DialogHeader>
        <RolePicker value={role} onChange={setRole} disabled={saving} />
        {self && role !== "admin" && (
          <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            Ini akun Anda sendiri. Setelah disimpan, Anda tidak bisa membuka menu Admin lagi.
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Batal
          </Button>
          <Button onClick={save} disabled={!role || role === target?.role || saving}>
            {saving && <Loader2 className="animate-spin" />} Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RevokeAccessDialog({
  target,
  currentUserId,
  onOpenChange,
  onDone,
}: {
  target: AccessTarget | null;
  currentUserId: string;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}) {
  const router = useRouter();
  const self = target?.userId === currentUserId;
  return (
    <ConfirmDialog
      open={!!target}
      onOpenChange={onOpenChange}
      title={`Cabut akses ${target?.name ?? ""}?`}
      description={
        self
          ? "Ini akun Anda sendiri. Anda langsung keluar dari app ini dan perlu admin lain untuk memberi akses lagi."
          : "Orang ini tidak bisa membuka app ini lagi. Dokumen dan riwayatnya tetap tersimpan."
      }
      confirmText="Cabut akses"
      destructive
      onConfirm={async () => {
        const res = await revokeAccessAction(target!.userId);
        if (res.status !== "ok") {
          toast.error(res.message);
          throw new Error(res.message);
        }
        toast.success(res.message);
        if (res.data?.self) return afterSelfChange(router, true);
        onDone?.();
        router.refresh();
      }}
    />
  );
}
