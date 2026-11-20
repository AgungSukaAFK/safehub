"use client";

// Ajakan aktifkan notifikasi (frontend-guide §17): tampil hanya kalau perangkat mendukung, Web Push
// dikonfigurasi, belum berlangganan, izin tidak diblokir, dan belum ditutup user (per perangkat).
import { useEffect, useState } from "react";
import { BellRing, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notificationPermission } from "@/lib/notifications/browser";
import { currentPushSubscription, enablePush, pushConfigured, pushSupported } from "@/lib/notifications/push-client";
import { useStoredState } from "@/lib/storage";
import { toast } from "@/lib/toast";

export function NotificationCta() {
  const [dismissed, setDismissed, ready] = useStoredState("dashboard-push-cta-dismissed", false);
  const [eligible, setEligible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pushSupported() || !pushConfigured() || notificationPermission() === "denied") return;
    let alive = true;
    void currentPushSubscription().then((s) => alive && setEligible(!s));
    return () => {
      alive = false;
    };
  }, []);

  if (!ready || dismissed || !eligible) return null;

  const enable = async () => {
    setBusy(true);
    const err = await enablePush();
    setBusy(false);
    if (err) return toast.error(err);
    toast.success("Notifikasi HP aktif di perangkat ini.");
    setEligible(false);
  };

  return (
    <div className="col-span-12 flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center">
      <BellRing className="size-5 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">Aktifkan notifikasi di perangkat ini</p>
        <p className="text-muted-foreground">Dapat kabar saat ada dokumen menunggu persetujuan Anda, meski tab app sedang ditutup.</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" onClick={enable} disabled={busy}>
          {busy && <Loader2 className="animate-spin" />} Aktifkan
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={() => setDismissed(true)} aria-label="Tutup ajakan notifikasi">
          <X />
        </Button>
      </div>
    </div>
  );
}
