// Tampilan isi satu Pembaruan. Dipakai dialog detail DAN pratinjau form, supaya pratinjau persis
// seperti yang dilihat user (frontend-guide §20.1).
import { Sparkles } from "lucide-react";
import { RichTextView } from "@/components/rich-text/rich-text-view";
import { formatDateLong } from "@/lib/format";
import type { RichNode } from "@/lib/rich-text";

export function VersionBadge({ version }: { version: string }) {
  return <span className="inline-flex items-center rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary tabular-nums">v{version}</span>;
}

export function UpdateArticle({
  version,
  title,
  highlights,
  thumbnailUrl,
  content,
  date,
  author,
}: {
  version: string;
  title: string;
  highlights: string[];
  thumbnailUrl: string | null;
  content: RichNode | null;
  date: string | null;
  author: string | null;
}) {
  return (
    <article className="space-y-4">
      {thumbnailUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- signed URL / object URL
        <img src={thumbnailUrl} alt="" className="aspect-video w-full rounded-lg border object-cover" />
      )}
      <header className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <VersionBadge version={version} />
          {date && <span>{formatDateLong(date)}</span>}
          {author && <span>· {author}</span>}
        </div>
        <h2 className="text-xl font-semibold tracking-tight text-balance">{title || "Judul pembaruan"}</h2>
      </header>
      {highlights.filter(Boolean).length > 0 && (
        <ul className="space-y-1.5 rounded-lg border bg-muted/30 p-3">
          {highlights.filter(Boolean).map((h, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              {h}
            </li>
          ))}
        </ul>
      )}
      <RichTextView doc={content} />
    </article>
  );
}
