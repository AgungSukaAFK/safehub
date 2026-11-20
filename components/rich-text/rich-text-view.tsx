// Tampilkan dokumen rich text (JSON hasil sanitizeDoc) tanpa Tiptap: aman (tidak ada HTML mentah),
// ringan, dan bisa dirender di server. Link dibuka di tab baru.
import type { ReactNode } from "react";
import { safeHref, type RichNode } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

function renderText(n: RichNode, key: number): ReactNode {
  let el: ReactNode = n.text;
  for (const m of n.marks ?? []) {
    if (m.type === "bold") el = <strong>{el}</strong>;
    else if (m.type === "italic") el = <em>{el}</em>;
    else if (m.type === "strike") el = <s>{el}</s>;
    else if (m.type === "underline") el = <u>{el}</u>;
    else if (m.type === "code") el = <code className="rounded bg-muted px-1 py-0.5 text-[0.9em]">{el}</code>;
    else if (m.type === "link") {
      const href = safeHref(m.attrs?.href);
      if (href)
        el = (
          <a href={href} target="_blank" rel="noopener noreferrer nofollow" data-pwa-new-window className="font-medium text-primary underline underline-offset-2">
            {el}
          </a>
        );
    }
  }
  return <span key={key}>{el}</span>;
}

function render(n: RichNode, key: number): ReactNode {
  const kids = n.content?.map(render);
  switch (n.type) {
    case "text":
      return renderText(n, key);
    case "paragraph":
      return <p key={key}>{kids?.length ? kids : <br />}</p>;
    case "heading":
      return n.attrs?.level === 3 ? <h4 key={key}>{kids}</h4> : <h3 key={key}>{kids}</h3>;
    case "bulletList":
      return <ul key={key}>{kids}</ul>;
    case "orderedList":
      return (
        <ol key={key} start={Number(n.attrs?.start) || undefined}>
          {kids}
        </ol>
      );
    case "listItem":
      return <li key={key}>{kids}</li>;
    case "blockquote":
      return <blockquote key={key}>{kids}</blockquote>;
    case "codeBlock":
      return (
        <pre key={key}>
          <code>{kids}</code>
        </pre>
      );
    case "hardBreak":
      return <br key={key} />;
    case "horizontalRule":
      return <hr key={key} />;
    case "image":
      return typeof n.attrs?.src === "string" ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed URL storage
        <img key={key} src={n.attrs.src} alt={String(n.attrs.alt ?? "")} loading="lazy" className="rounded-lg border" />
      ) : null;
    default:
      return kids ? <span key={key}>{kids}</span> : null;
  }
}

/** Kelas tipografi bersama editor & tampilan (tanpa plugin typography). */
export const RICH_TEXT_CLASS =
  "text-sm leading-relaxed break-words [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_h3]:mt-4 [&_h3]:mb-1 [&_h3]:text-base [&_h3]:font-semibold [&_h4]:mt-3 [&_h4]:font-semibold [&_hr]:my-4 [&_img]:my-3 [&_img]:max-h-[480px] [&_img]:w-auto [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1.5 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:text-xs [&_ul]:list-disc [&_ul]:pl-5";

export function RichTextView({ doc, className }: { doc: RichNode | null | undefined; className?: string }) {
  if (!doc?.content?.length) return null;
  return <div className={cn(RICH_TEXT_CLASS, className)}>{doc.content.map(render)}</div>;
}
