"use client";

// Kartu "Peran K3" di /pengguna/[id] (rancangan §2.1, §2.2): fungsi K3 (boleh lebih dari satu) dan
// batas site. Disimpan lewat saveK3RolesAction → members (dijaga members_guard) + CCTV.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HardHat, History, Loader2 } from "lucide-react";
import { ActivityLogDialog } from "@/components/detail/activity-log-dialog";
import { Content } from "@/components/list/content";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FUNCTION_DESCRIPTIONS, FUNCTION_LABELS, FUNCTIONS, type Fn } from "@/lib/functions";
import type { FieldLabel } from "@/lib/person-types";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { saveK3RolesAction } from "../actions";

type SiteOption = { value: string; label: string };

export function K3RolesCard({
  userId,
  memberId,
  initialFunctions,
  initialLocationIds,
  sites,
  hasAccess,
  fieldLabels,
}: {
  userId: string;
  memberId: string | null;
  initialFunctions: Fn[];
  initialLocationIds: string[] | null;
  sites: SiteOption[];
  hasAccess: boolean;
  fieldLabels: Record<string, FieldLabel>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fns, setFns] = useState<Fn[]>(initialFunctions);
  const [limited, setLimited] = useState(initialLocationIds !== null);
  const [siteIds, setSiteIds] = useState<string[]>(initialLocationIds ?? []);
  const [error, setError] = useState<string | null>(null);

  const toggleFn = (f: Fn, on: boolean) => setFns((prev) => (on ? FUNCTIONS.filter((x) => x === f || prev.includes(x)) : prev.filter((x) => x !== f)));
  const toggleSite = (id: string, on: boolean) => setSiteIds((prev) => (on ? [...prev, id] : prev.filter((x) => x !== id)));

  const save = () => {
    setError(null);
    if (limited && siteIds.length === 0) return setError("Pilih minimal satu site, atau pilih Semua site.");
    startTransition(async () => {
      const res = await saveK3RolesAction(userId, { functions: fns, location_ids: limited ? siteIds : null });
      if (res.status !== "ok") {
        setError(res.message ?? "Gagal menyimpan.");
        return void toast.error(res.message ?? "Gagal menyimpan.");
      }
      toast.success(res.message);
      router.refresh();
    });
  };

  return (
    <Content
      size="md"
      title="Peran K3"
      description="Fungsi K3 menentukan aksi per modul dan menu yang tampil. Role app tetap menentukan akses dasar."
      cardAction={
        memberId && (
          <ActivityLogDialog
            entity="members"
            recordId={memberId}
            fieldLabels={fieldLabels}
            trigger={
              <Button variant="outline" size="sm">
                <History /> Riwayat
              </Button>
            }
          />
        )
      }
    >
      {!hasAccess && <p className="mb-3 text-sm text-muted-foreground">Orang ini belum punya akses ke app. Fungsi baru berlaku setelah diberi akses.</p>}

      <fieldset className="space-y-2">
        <legend className="mb-2 flex items-center gap-1.5 text-sm font-medium">
          <HardHat className="size-4 text-muted-foreground" /> Fungsi K3 <span className="font-normal text-muted-foreground">(boleh lebih dari satu)</span>
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {FUNCTIONS.map((f) => {
            const on = fns.includes(f);
            return (
              <Label
                key={f}
                className={cn("flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal transition-colors hover:bg-muted/50", on && "border-primary bg-primary/5")}
              >
                <Checkbox checked={on} onCheckedChange={(c) => toggleFn(f, !!c)} disabled={pending} className="mt-0.5" />
                <span className="space-y-0.5">
                  <span className="block text-sm font-medium">{FUNCTION_LABELS[f]}</span>
                  <span className="block text-xs text-muted-foreground">{FUNCTION_DESCRIPTIONS[f]}</span>
                </span>
              </Label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="mt-5 space-y-2">
        <legend className="mb-2 text-sm font-medium">Site yang boleh dilihat</legend>
        <RadioGroup value={limited ? "terbatas" : "semua"} onValueChange={(v) => setLimited(v === "terbatas")} disabled={pending} className="gap-2">
          <Label className="flex cursor-pointer items-center gap-2 font-normal">
            <RadioGroupItem value="semua" /> Semua site dalam perusahaannya
          </Label>
          <Label className="flex cursor-pointer items-center gap-2 font-normal">
            <RadioGroupItem value="terbatas" /> Hanya site tertentu
          </Label>
        </RadioGroup>
        {limited && (
          <div className="grid gap-1.5 rounded-lg border p-3 sm:grid-cols-2">
            {sites.map((s) => (
              <Label key={s.value} className="flex cursor-pointer items-center gap-2 font-normal">
                <Checkbox checked={siteIds.includes(s.value)} onCheckedChange={(c) => toggleSite(s.value, !!c)} disabled={pending} />
                <span className="truncate">{s.label}</span>
              </Label>
            ))}
          </div>
        )}
      </fieldset>

      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="mt-4 flex justify-end">
        <Button onClick={save} disabled={pending}>
          {pending && <Loader2 className="animate-spin" />} Simpan Peran K3
        </Button>
      </div>
    </Content>
  );
}
