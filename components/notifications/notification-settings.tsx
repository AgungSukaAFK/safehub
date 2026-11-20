"use client";

// Pengaturan notifikasi per perangkat (frontend-guide §13.5): suara, notifikasi browser, Notifikasi HP
// (Web Push). Dipakai di dialog /notifikasi dan halaman Profil (F7).
import { useEffect, useState } from "react";
import { BellRing, Download, Loader2, Smartphone, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/hooks/use-hydrated";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { notificationPermission, requestNotificationPermission, showBrowserNotification } from "@/lib/notifications/browser";
import { currentPushSubscription, disablePush, enablePush, pushConfigured, pushSupported } from "@/lib/notifications/push-client";
import { TONE_LABELS, useNotificationSettings, type Tone } from "@/lib/notifications/settings";
import { playNotificationSound } from "@/lib/notifications/sound";
import { useInstallPrompt } from "@/lib/pwa/use-install-prompt";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const PERMISSION_TEXT: Record<string, string> = {
  granted: "Diizinkan",
  denied: "Diblokir (ubah dari pengaturan situs di browser)",
  default: "Belum diminta",
  unsupported: "Tidak didukung browser ini",
};

function Row({ icon: Icon, title, desc, children }: { icon: typeof Volume2; title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex gap-3">
        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="space-y-0.5">
          <p className="text-sm font-medium">{title}</p>
          {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 pl-7 sm:pl-0">{children}</div>
    </div>
  );
}

export function NotificationSettings() {
  const hydrated = useHydrated();
  const { settings, update } = useNotificationSettings();
  const [permission, setPermission] = useState<string>("default");
  const [push, setPush] = useState<"loading" | "on" | "off">("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void currentPushSubscription().then((s) => {
      if (!alive) return;
      setPermission(notificationPermission());
      setPush(s ? "on" : "off");
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="divide-y">
      <Row icon={Volume2} title="Suara notifikasi" desc="Bunyi singkat saat notifikasi baru masuk (berlaku di perangkat ini).">
        <Switch checked={settings.sound} onCheckedChange={(v) => update({ sound: v })} aria-label="Suara notifikasi" />
      </Row>
      {settings.sound && (
        <div className="space-y-3 py-4 pl-7">
          <div className="flex items-center gap-3">
            <span className="w-14 text-xs text-muted-foreground">Volume</span>
            <Slider
              className="max-w-56"
              min={0}
              max={100}
              value={[Math.round(settings.volume * 100)]}
              onValueChange={(v) => update({ volume: (Array.isArray(v) ? v[0] : v) / 100 })}
              aria-label="Volume"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-14 text-xs text-muted-foreground">Nada</span>
            {(Object.keys(TONE_LABELS) as Tone[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  update({ tone: t });
                  playNotificationSound(t, settings.volume);
                }}
                className={cn("rounded-full border px-2.5 py-1 text-xs", settings.tone === t ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent")}
              >
                {TONE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
      )}
      <Row icon={BellRing} title="Notifikasi browser" desc={`Muncul saat tab app tidak sedang dilihat. Izin: ${PERMISSION_TEXT[permission]}.`}>
        <Switch checked={settings.browser} onCheckedChange={(v) => update({ browser: v })} aria-label="Notifikasi browser" />
        {permission === "default" && (
          <Button size="sm" variant="outline" onClick={async () => setPermission(await requestNotificationPermission())}>
            Izinkan
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          disabled={permission !== "granted"}
          onClick={() => void showBrowserNotification({ title: "Uji notifikasi", body: "Notifikasi browser berfungsi.", url: "/notifikasi", tag: "uji" })}
        >
          Uji notifikasi
        </Button>
      </Row>
      <Row
        icon={Smartphone}
        title="Notifikasi HP (Web Push)"
        desc={
          !pushConfigured()
            ? "Belum dikonfigurasi di server (VAPID key kosong)."
            : hydrated && !pushSupported() // server tidak tahu kemampuan browser → cek setelah hydrate
              ? "Browser ini tidak mendukung. Di iPhone, pasang app ke Layar Utama dulu."
              : "Tetap masuk walau tab atau browser ditutup. Dimatikan otomatis saat Keluar."
        }
      >
        {push === "loading" ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        ) : (
          <Button
            size="sm"
            variant={push === "on" ? "outline" : "default"}
            disabled={busy || !pushConfigured() || (hydrated && !pushSupported())}
            onClick={async () => {
              setBusy(true);
              try {
                if (push === "on") {
                  await disablePush();
                  setPush("off");
                  toast.success("Notifikasi HP dimatikan di perangkat ini.");
                } else {
                  const err = await enablePush();
                  setPermission(notificationPermission());
                  if (err) toast.error(err);
                  else {
                    setPush("on");
                    toast.success("Notifikasi HP aktif di perangkat ini.");
                  }
                }
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Loader2 className="animate-spin" />}
            {push === "on" ? "Matikan di perangkat ini" : "Aktifkan"}
          </Button>
        )}
      </Row>
      <InstallRow />
    </div>
  );
}

/** Pasang app (PWA) di perangkat ini (frontend-guide §13.5). */
function InstallRow() {
  const { state, install } = useInstallPrompt();
  if (state === "unsupported") return null;
  return (
    <Row
      icon={Download}
      title="Pasang app"
      desc={
        state === "installed"
          ? "App sudah terpasang di perangkat ini."
          : state === "ios"
            ? "Di iPhone/iPad: ketuk Bagikan lalu Tambah ke Layar Utama. Diperlukan juga untuk Notifikasi HP."
            : "Buka app langsung dari layar utama / desktop, tanpa bilah alamat browser."
      }
    >
      {state === "available" && (
        <Button size="sm" onClick={async () => (await install()) && toast.success("App terpasang.")}>
          Pasang
        </Button>
      )}
    </Row>
  );
}
