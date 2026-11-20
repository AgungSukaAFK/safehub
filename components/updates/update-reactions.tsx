"use client";

// Reaction Pembaruan (frontend-guide §20.1): 👍 ❤️ 🎉 😂 😮 🙏, satu aktif per user (klik lain = ganti,
// klik yang sama = hapus), tooltip daftar nama, konfeti emoji saat memberi reaction. Optimistik.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { reactAction } from "@/app/(app)/pembaruan/actions";
import { fireEmojiConfetti } from "@/lib/emoji-confetti";
import { toast } from "@/lib/toast";
import { REACTION_EMOJIS, type ReactionGroup } from "@/lib/update-types";
import { cn } from "@/lib/utils";

function apply(groups: ReactionGroup[], prev: string | null, next: string | null, myName: string) {
  const map = new Map(REACTION_EMOJIS.map((e) => [e as string, { emoji: e as string, count: 0, names: [] as string[], mine: false }]));
  groups.forEach((g) => map.set(g.emoji, { ...g, names: [...g.names] }));
  if (prev) {
    const g = map.get(prev)!;
    g.count--;
    g.mine = false;
    g.names = g.names.filter((n) => n !== myName);
  }
  if (next) {
    const g = map.get(next)!;
    g.count++;
    g.mine = true;
    g.names.push(myName);
  }
  return [...map.values()].filter((g) => g.count > 0);
}

export function UpdateReactions({ updateId, reactions, myReaction, myName }: { updateId: number; reactions: ReactionGroup[]; myReaction: string | null; myName: string }) {
  const router = useRouter();
  const [state, setState] = useState({ groups: reactions, mine: myReaction, base: reactions });
  // data server berubah (refresh) → ikuti (pola adjust-state-during-render)
  if (state.base !== reactions) setState({ groups: reactions, mine: myReaction, base: reactions });
  const [busy, setBusy] = useState(false);

  const click = async (emoji: string) => {
    if (busy) return;
    const prev = state.mine;
    const next = prev === emoji ? null : emoji;
    setState((s) => ({ ...s, groups: apply(s.groups, prev, next, myName), mine: next }));
    if (next) fireEmojiConfetti(next);
    setBusy(true);
    const res = await reactAction(updateId, emoji);
    setBusy(false);
    if (res.status !== "ok") {
      toast.error(res.message);
      setState((s) => ({ ...s, groups: apply(s.groups, next, prev, myName), mine: prev }));
      return;
    }
    router.refresh();
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Reaction">
      {REACTION_EMOJIS.map((e) => {
        const g = state.groups.find((x) => x.emoji === e);
        const active = state.mine === e;
        const button = (
          <button
            type="button"
            onClick={() => void click(e)}
            aria-pressed={active}
            aria-label={`${e} ${g?.count ?? 0}`}
            className={cn(
              "inline-flex h-8 items-center gap-1 rounded-full border px-2 text-sm transition-[transform,background-color] active:scale-90",
              active ? "border-primary bg-primary/10" : "bg-background hover:bg-muted",
              !g && !active && "opacity-60 hover:opacity-100",
            )}
          >
            <span aria-hidden>{e}</span>
            {g && <span className="text-xs font-medium tabular-nums">{g.count}</span>}
          </button>
        );
        return g ? (
          <Tooltip key={e}>
            <TooltipTrigger render={button} />
            <TooltipContent className="max-w-60">
              {g.names.slice(0, 10).join(", ")}
              {g.names.length > 10 ? ` dan ${g.names.length - 10} lainnya` : ""}
            </TooltipContent>
          </Tooltip>
        ) : (
          <span key={e}>{button}</span>
        );
      })}
    </div>
  );
}
