"use client";

// Satu percakapan Bantuan Admin: header + tindakan, info perangkat, gelembung pesan, composer.
// Realtime HANYA untuk thread yang sedang dibuka (frontend-guide §14): pesan masuk → refresh server.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, CheckCheck, FileText, Info, Loader2, MoreVertical, Paperclip, RotateCcw, Send, Trash2, UserCheck, Users, X } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { StatusBadge } from "@/components/detail/status-badge";
import { useApp } from "@/components/providers/app-context";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user/user-avatar";
import { assignThreadAction, deleteThreadAction, markThreadReadAction, sendMessageAction, setThreadStatusAction } from "@/app/(app)/bantuan/actions";
import { refreshBadgesAction } from "@/lib/actions/notifications";
import { APP_ID, BUCKET_LAMPIRAN } from "@/lib/app-config";
import { compressImage, MAX_FILE_BYTES, safeStorageName } from "@/lib/attachments";
import { CONTEXT_LABELS } from "@/lib/client-context";
import { formatBytes, formatDateTime, formatTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { SUPPORT_STATUS, supportCategoryLabel, type SupportMessage, type SupportThreadDetail } from "@/lib/support-types";
import { toast } from "@/lib/toast";
import { cn, randomUUID } from "@/lib/utils";

export function SupportThread({
  thread,
  asAdmin,
  basePath,
  admins,
}: {
  thread: SupportThreadDetail;
  asAdmin: boolean;
  basePath: string;
  admins: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { access, setBadge } = useApp();
  const me = access.userId;
  const [pending, setPending] = useState<(SupportMessage & { serverId?: string })[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const shown = [...thread.messages, ...pending.filter((p) => !thread.messages.some((m) => m.id === p.serverId))];

  // tandai dibaca saat dibuka / ada pesan baru dari lawan bicara
  const unreadFromOther = thread.messages.some((m) => !m.mine && !m.readAt);
  useEffect(() => {
    if (!unreadFromOther) return;
    void markThreadReadAction(thread.id).then(async (n) => {
      if (!n) return;
      const b = await refreshBadgesAction();
      if (b) setBadge("support", b.support);
    });
  }, [thread.id, unreadFromOther, thread.messages.length, setBadge]);

  // realtime: pesan baru di thread ini (RLS realtime = RLS tabel)
  useEffect(() => {
    const supabase = createClient();
    let channel: RealtimeChannel | null = null;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      if (cancelled) return;
      channel = supabase
        .channel(`support:${thread.id}`)
        .on("postgres_changes", { event: "INSERT", schema: APP_ID, table: "support_messages", filter: `thread_id=eq.${thread.id}` }, (payload) => {
          if ((payload.new as { sender_id?: string }).sender_id !== me) router.refresh();
        })
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [thread.id, me, router]);

  // gulir ke pesan terakhir
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [shown.length]);

  const run = async (p: Promise<{ status: string; message?: string }>, refresh = true) => {
    const res = await p;
    if (res.status === "ok") {
      toast.success(res.message ?? "Tersimpan.");
      if (refresh) router.refresh();
    } else toast.error(res.message ?? "Gagal.");
    return res;
  };

  const send = async (body: string, file: File | null) => {
    const tempId = randomUUID();
    setPending((p) => [
      ...p,
      { id: tempId, body: body || null, createdAt: new Date().toISOString(), readAt: null, mine: true, sender: null, pending: true, attachment: file ? { path: "", name: file.name, url: null } : null },
    ]);
    let path: string | null = null;
    try {
      if (file) {
        path = `support/${thread.id}/${safeStorageName(file.name)}`;
        const { error } = await createClient().storage.from(BUCKET_LAMPIRAN).upload(path, file, { contentType: file.type });
        if (error) throw new Error("Lampiran gagal diunggah.");
      }
      const res = await sendMessageAction(thread.id, body, path);
      if (res.status !== "ok") throw new Error(res.message);
      setPending((p) => p.map((m) => (m.id === tempId ? { ...m, serverId: String(res.data?.id) } : m)));
      router.refresh();
      return true;
    } catch (e) {
      setPending((p) => p.filter((m) => m.id !== tempId));
      toast.error(e instanceof Error ? e.message : "Pesan gagal terkirim.");
      return false;
    }
  };

  const ctx = thread.context as Record<string, string | null> | null;
  const closed = thread.status === "selesai";
  const mineAssigned = thread.assignedTo?.id === me;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-start gap-2 border-b px-3 py-3 sm:px-4">
        <Link href={basePath} className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "md:hidden")} aria-label="Kembali ke daftar">
          <ArrowLeft />
        </Link>
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="truncate font-semibold">{thread.subject}</h2>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <StatusBadge value={thread.status} map={SUPPORT_STATUS} />
            <span>{supportCategoryLabel(thread.category)}</span>
            {asAdmin && thread.user && <span>· dari {thread.user.name}</span>}
            <span>· {thread.assignedTo ? `ditangani ${thread.assignedTo.id === me ? "Anda" : thread.assignedTo.name}` : "belum ada yang menangani"}</span>
          </p>
        </div>
        {asAdmin ? (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Tindakan percakapan" />}>
              <MoreVertical />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {!mineAssigned && (
                <DropdownMenuItem onClick={() => run(assignThreadAction(thread.id, me))}>
                  <UserCheck /> Ambil percakapan
                </DropdownMenuItem>
              )}
              {admins.filter((a) => a.id !== thread.assignedTo?.id && a.id !== me).length > 0 && (
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="flex items-center gap-1.5">
                    <Users className="size-3.5" /> Alihkan ke
                  </DropdownMenuLabel>
                  {admins
                    .filter((a) => a.id !== thread.assignedTo?.id && a.id !== me)
                    .map((a) => (
                      <DropdownMenuItem key={a.id} onClick={() => run(assignThreadAction(thread.id, a.id))}>
                        {a.name}
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuGroup>
              )}
              <DropdownMenuSeparator />
              {closed ? (
                <DropdownMenuItem onClick={() => run(setThreadStatusAction(thread.id, "menunggu"))}>
                  <RotateCcw /> Buka kembali
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => run(setThreadStatusAction(thread.id, "selesai"))}>
                  <CheckCheck /> Tandai selesai
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 /> Hapus percakapan
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          !closed && (
            <Button variant="outline" size="sm" onClick={() => run(setThreadStatusAction(thread.id, "selesai"))}>
              <CheckCheck /> Selesai
            </Button>
          )
        )}
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4 sm:px-4">
        {ctx && Object.values(ctx).some(Boolean) && (
          <details className="mx-auto max-w-md rounded-md border bg-muted/40 px-3 py-2 text-xs">
            <summary className="flex cursor-pointer items-center gap-1.5 text-muted-foreground">
              <Info className="size-3.5" /> Info perangkat saat percakapan dibuat
            </summary>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              {Object.entries(ctx).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted-foreground">{CONTEXT_LABELS[k as keyof typeof CONTEXT_LABELS] ?? k}</dt>
                  <dd className="break-all">{v ?? "-"}</dd>
                </div>
              ))}
            </dl>
          </details>
        )}
        {shown.map((m) => (
          <Bubble key={m.id} m={m} />
        ))}
        {closed && <p className="py-2 text-center text-xs text-muted-foreground">Percakapan ditandai selesai. Kirim pesan untuk membukanya kembali.</p>}
      </div>

      <Composer onSend={send} />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Hapus percakapan "${thread.subject}"?`}
        description="Semua pesan & lampirannya dihapus permanen untuk kedua pihak."
        confirmText="Hapus"
        destructive
        onConfirm={async () => {
          const res = await deleteThreadAction(thread.id);
          if (res.status !== "ok") {
            toast.error(res.message);
            throw new Error(res.message);
          }
          toast.success(res.message);
          router.replace(basePath);
        }}
      />
    </div>
  );
}

function Bubble({ m }: { m: SupportMessage }) {
  const isImage = m.attachment && /\.(png|jpe?g|webp|gif)$/i.test(m.attachment.name);
  return (
    <div className={cn("flex items-end gap-2", m.mine && "flex-row-reverse")}>
      {!m.mine && <UserAvatar name={m.sender?.name ?? "Sistem"} src={m.sender?.avatarUrl} className="size-7 text-[11px]" />}
      <div className={cn("max-w-[80%] space-y-1", m.mine && "items-end text-right")}>
        {!m.mine && <p className="text-[11px] text-muted-foreground">{m.sender?.name ?? "Sistem"}</p>}
        <div
          className={cn(
            "inline-block rounded-2xl px-3 py-2 text-left text-sm whitespace-pre-wrap [overflow-wrap:anywhere]",
            m.mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted",
            m.pending && "opacity-70",
          )}
        >
          {m.attachment &&
            (m.attachment.url && isImage ? (
              <a href={m.attachment.url} target="_blank" rel="noopener noreferrer" className="mb-1 block">
                {/* eslint-disable-next-line @next/next/no-img-element -- signed URL */}
                <img src={m.attachment.url} alt={m.attachment.name} className="max-h-60 rounded-lg" />
              </a>
            ) : (
              <a
                href={m.attachment.url ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                className={cn("mb-1 flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs", m.mine ? "border-primary-foreground/30" : "bg-background")}
              >
                <FileText className="size-3.5 shrink-0" /> <span className="truncate">{m.attachment.name}</span>
              </a>
            ))}
          {m.body}
        </div>
        <p className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground" title={formatDateTime(m.createdAt)}>
          {m.pending ? <Loader2 className="size-3 animate-spin" /> : formatTime(m.createdAt)}
          {m.mine && !m.pending && (m.readAt ? <CheckCheck className="size-3 text-primary" aria-label="Dibaca" /> : <Check className="size-3" aria-label="Terkirim" />)}
        </p>
      </div>
    </div>
  );
}

function Composer({ onSend }: { onSend: (body: string, file: File | null) => Promise<boolean> }) {
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) return toast.error(`File maksimal ${formatBytes(MAX_FILE_BYTES)}.`);
    setFile(await compressImage(f));
  };
  const submit = async () => {
    if (busy || (!body.trim() && !file)) return;
    setBusy(true);
    const [b, f] = [body.trim(), file];
    setBody("");
    setFile(null);
    const okSent = await onSend(b, f);
    if (!okSent) {
      setBody(b);
      setFile(f);
    }
    setBusy(false);
  };

  return (
    <div className="border-t p-2 sm:p-3">
      {file && (
        <div className="mb-2 flex items-center gap-1 text-xs">
          <span className="flex min-w-0 items-center gap-1 rounded border px-2 py-0.5">
            <Paperclip className="size-3" /> <span className="truncate">{file.name}</span> ({formatBytes(file.size)})
            <button type="button" onClick={() => setFile(null)} aria-label="Hapus lampiran" className="text-muted-foreground hover:text-foreground">
              <X className="size-3.5" />
            </button>
          </span>
        </div>
      )}
      <div className="flex items-end gap-2">
        <label className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "shrink-0 cursor-pointer")} aria-label="Lampirkan file" title="Lampirkan file (atau tempel)">
          <Paperclip />
          <input type="file" className="hidden" accept="image/*,.pdf,.xlsx,.docx" onChange={(e) => void pick(e.target.files?.[0])} />
        </label>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onPaste={(e) => {
            const f = Array.from(e.clipboardData.files)[0];
            if (f) {
              e.preventDefault();
              void pick(f);
            }
          }}
          onKeyDown={(e) => {
            // Enter kirim, Shift+Enter baris baru; di layar sentuh Enter = baris baru
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !window.matchMedia("(pointer: coarse)").matches) {
              e.preventDefault();
              void submit();
            }
          }}
          rows={1}
          maxLength={4000}
          placeholder="Tulis pesan..."
          aria-label="Tulis pesan"
          className="max-h-40 min-h-10 resize-none"
        />
        <Button size="icon" onClick={submit} disabled={busy || (!body.trim() && !file)} aria-label="Kirim">
          {busy ? <Loader2 className="animate-spin" /> : <Send />}
        </Button>
      </div>
    </div>
  );
}
