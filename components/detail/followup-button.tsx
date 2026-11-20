"use client";

// "Colek" approver yang sedang giliran (frontend-guide §10.3). Hanya dirender untuk pemohon/editor,
// bukan approver itu sendiri. Server Action → RPC request_followup (jeda 1 jam, log, CCTV, notif, push).
import { TimeAgo } from "@/components/time-ago";
import { useState } from "react";
import { BellRing } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/form-state";
import { timeAgo } from "@/lib/format";
import { useOnline } from "@/lib/offline/use-online";
import { toast } from "@/lib/toast";

export function FollowupButton({
  approvalId,
  approverName,
  docLabel,
  myLastFollowupAt,
  action,
}: {
  approvalId: string;
  approverName: string;
  /** "pengajuan PJ/GMI/2611/0042" */
  docLabel: string;
  myLastFollowupAt: string | null;
  action: (approvalId: string) => Promise<FormState>;
}) {
  const [open, setOpen] = useState(false);
  const online = useOnline();

  return (
    <div className="flex flex-col items-end gap-1">
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        trigger={
          <Button type="button" variant="outline" size="sm" disabled={!online} title={!online ? "Butuh koneksi internet" : undefined}>
            <BellRing /> Follow-up
          </Button>
        }
        title="Follow-up approval"
        description={
          myLastFollowupAt ? (
            <>
              Anda sudah meminta follow-up ke <strong>{approverName}</strong> {timeAgo(myLastFollowupAt)}. Ajukan lagi untuk {docLabel}?
            </>
          ) : (
            <>
              Kirim notifikasi follow-up ke <strong>{approverName}</strong> supaya segera memproses approval {docLabel}?
            </>
          )
        }
        confirmText="Ya, kirim follow-up"
        onConfirm={async () => {
          const id = toast.loading("Mengirim follow-up...");
          const res = await action(approvalId);
          if (res.status === "ok") toast.success(res.message ?? `Follow-up terkirim ke ${approverName}.`, { id });
          else {
            toast.error("Gagal mengirim follow-up", { id, description: res.message });
            throw new Error(res.message);
          }
        }}
      />
      {myLastFollowupAt && <span className="text-[11px] text-muted-foreground">Terakhir di-follow-up <TimeAgo at={myLastFollowupAt} /></span>}
    </div>
  );
}
