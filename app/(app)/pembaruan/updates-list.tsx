"use client";

// Daftar Pembaruan: kartu (thumbnail, versi, highlights, reaction) + dialog detail dengan komentar.
// Membuka halaman ini menandai post terbaru sudah dilihat (per akun) dan menyinkronkan badge ke tab
// lain lewat storage `update-seen`.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, MessageSquare, MoreHorizontal, Pencil, Send, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useApp } from "@/components/providers/app-context";
import { UpdateArticle, VersionBadge } from "@/components/updates/update-article";
import { UpdateReactions } from "@/components/updates/update-reactions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user/user-avatar";
import { formatDate, timeAgo } from "@/lib/format";
import type { RichNode } from "@/lib/rich-text";
import { writeStorage } from "@/lib/storage";
import { toast } from "@/lib/toast";
import { UPDATE_SEEN_KEY, type UpdateComment, type UpdatePost } from "@/lib/update-types";
import { addCommentAction, deleteCommentAction, deleteUpdateAction, loadUpdateDetailAction, markUpdatesSeenAction } from "./actions";

export function UpdatesList({ posts, isAdmin, openId }: { posts: UpdatePost[]; isAdmin: boolean; openId: number | null }) {
  const router = useRouter();
  const { access, setBadge } = useApp();
  const [open, setOpen] = useState<UpdatePost | null>(() => posts.find((p) => p.id === openId) ?? null);
  const [toDelete, setToDelete] = useState<UpdatePost | null>(null);
  const latest = posts[0]?.id ?? 0;

  // tandai sudah dilihat → badge hilang di tab ini & tab lain
  useEffect(() => {
    if (!latest) return;
    void markUpdatesSeenAction(latest).then(() => {
      setBadge("updates", 0);
      writeStorage(UPDATE_SEEN_KEY, latest);
    });
  }, [latest, setBadge]);

  if (!posts.length)
    return (
      <div className="col-span-12 rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        Belum ada pembaruan.{isAdmin && " Tulis yang pertama lewat tombol Tulis Pembaruan."}
      </div>
    );

  return (
    <>
      <div className="col-span-12 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {posts.map((p) => (
          <article key={p.id} className="flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
            <button type="button" onClick={() => setOpen(p)} className="group block text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
              {p.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- signed URL
                <img src={p.thumbnailUrl} alt="" loading="lazy" className="aspect-video w-full border-b object-cover transition-opacity group-hover:opacity-90" />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center border-b bg-gradient-to-br from-primary/15 to-primary/5 text-3xl font-semibold text-primary/70">v{p.version}</div>
              )}
              <div className="space-y-2 p-4 pb-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <VersionBadge version={p.version} />
                  {p.isNew && <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold text-white">BARU</span>}
                  <span>{formatDate(p.createdAt)}</span>
                </div>
                <h3 className="line-clamp-2 font-semibold group-hover:underline">{p.title}</h3>
                {p.highlights.length > 0 && (
                  <ul className="list-disc space-y-0.5 pl-4 text-sm text-muted-foreground">
                    {p.highlights.slice(0, 3).map((h, i) => (
                      <li key={i} className="line-clamp-1">
                        {h}
                      </li>
                    ))}
                    {p.highlights.length > 3 && <li className="list-none text-xs">+{p.highlights.length - 3} poin lagi</li>}
                  </ul>
                )}
              </div>
            </button>
            <div className="mt-auto space-y-3 p-4 pt-2">
              <UpdateReactions updateId={p.id} reactions={p.reactions} myReaction={p.myReaction} myName={access.profile.fullName} />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <button type="button" onClick={() => setOpen(p)} className="inline-flex items-center gap-1 hover:text-foreground">
                  <MessageSquare className="size-3.5" /> {p.comments ? `${p.comments} komentar` : "Komentari"}
                </button>
                {isAdmin && (
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Aksi pembaruan ${p.version}`} />}>
                      <MoreHorizontal />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem render={<Link href={`/pembaruan/${p.id}/ubah`} />}>
                        <Pencil /> Ubah
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onClick={() => setToDelete(p)}>
                        <Trash2 /> Hapus
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      {open && <UpdateDetailDialog post={open} isAdmin={isAdmin} onClose={() => setOpen(null)} />}
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Hapus pembaruan v${toDelete?.version}?`}
        description="Post, reaction, komentar, dan gambarnya dihapus permanen."
        confirmText="Hapus"
        destructive
        onConfirm={async () => {
          const res = await deleteUpdateAction(toDelete!.id);
          if (res.status !== "ok") {
            toast.error(res.message);
            throw new Error(res.message);
          }
          toast.success(res.message);
          router.refresh();
        }}
      />
    </>
  );
}

function UpdateDetailDialog({ post, isAdmin, onClose }: { post: UpdatePost; isAdmin: boolean; onClose: () => void }) {
  const { access } = useApp();
  const [detail, setDetail] = useState<{ content: RichNode | null; comments: UpdateComment[] } | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const load = () => loadUpdateDetailAction(post.id).then(setDetail);
  useEffect(() => {
    let alive = true;
    void loadUpdateDetailAction(post.id).then((d) => alive && setDetail(d));
    return () => {
      alive = false;
    };
  }, [post.id]);

  const send = async () => {
    setSending(true);
    const res = await addCommentAction(post.id, body);
    setSending(false);
    if (res.status !== "ok") return toast.error(res.message);
    setBody("");
    await load();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogTitle className="sr-only">{post.title}</DialogTitle>
        <UpdateArticle version={post.version} title={post.title} highlights={post.highlights} thumbnailUrl={post.thumbnailUrl} content={detail?.content ?? null} date={post.createdAt} author={post.author?.name ?? null} />
        {!detail && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Memuat isi...
          </p>
        )}
        <div className="border-t pt-4">
          <UpdateReactions updateId={post.id} reactions={post.reactions} myReaction={post.myReaction} myName={access.profile.fullName} />
        </div>
        <section className="space-y-3 border-t pt-4" aria-label="Komentar">
          <h3 className="text-sm font-semibold">Komentar {detail?.comments.length ? `(${detail.comments.length})` : ""}</h3>
          {detail?.comments.map((c) => (
            <div key={c.id} className="group flex gap-2.5">
              <UserAvatar name={c.user?.name} src={c.user?.avatarUrl} className="size-7 text-[11px]" />
              <div className="min-w-0 flex-1 rounded-lg bg-muted/50 px-3 py-2">
                <p className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium">{c.user?.name ?? "Pengguna"}</span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    {timeAgo(c.createdAt)}
                    {(c.mine || isAdmin) && (
                      <button
                        type="button"
                        aria-label="Hapus komentar"
                        className="opacity-0 group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100 pointer-coarse:opacity-100"
                        onClick={async () => {
                          const res = await deleteCommentAction(c.id);
                          if (res.status !== "ok") return toast.error(res.message);
                          await load();
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </span>
                </p>
                <p className="text-sm whitespace-pre-wrap [overflow-wrap:anywhere]">{c.body}</p>
              </div>
            </div>
          ))}
          <div className="flex items-end gap-2">
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={1} maxLength={2000} placeholder="Tulis komentar..." aria-label="Tulis komentar" className="min-h-10 resize-none" />
            <Button size="icon" onClick={send} disabled={sending || !body.trim()} aria-label="Kirim komentar">
              {sending ? <Loader2 className="animate-spin" /> : <Send />}
            </Button>
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}
