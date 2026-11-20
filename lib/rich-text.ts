// Dokumen rich text (JSON Tiptap) yang disimpan di DB (feedback.content, updates.content).
// Aman client + server. Semua dokumen dari client WAJIB lewat sanitizeDoc sebelum disimpan:
// hanya node/mark yang dikenal, link hanya http(s)/mailto, gambar hanya `path` storage (src dibuang).

export type RichNode = {
  type: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: RichNode[];
  text?: string;
};

export const EMPTY_DOC: RichNode = { type: "doc", content: [{ type: "paragraph" }] };

const BLOCKS = new Set(["doc", "paragraph", "heading", "bulletList", "orderedList", "listItem", "blockquote", "hardBreak", "horizontalRule", "codeBlock", "image", "text"]);
const MARKS = new Set(["bold", "italic", "strike", "underline", "code", "link"]);

export function safeHref(href: unknown): string | null {
  if (typeof href !== "string") return null;
  try {
    const u = new URL(href);
    return ["http:", "https:", "mailto:"].includes(u.protocol) ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Bersihkan dokumen dari client. `imagePrefix` = awalan path storage yang boleh dipakai gambar
 * (mis. "updates/"); tanpa itu gambar dibuang. Mengembalikan null kalau bukan dokumen.
 */
export function sanitizeDoc(input: unknown, opts: { imagePrefix?: string; maxNodes?: number } = {}): RichNode | null {
  let budget = opts.maxNodes ?? 5000;
  const walk = (n: unknown, depth: number): RichNode | null => {
    if (!n || typeof n !== "object" || depth > 20 || --budget < 0) return null;
    const node = n as RichNode;
    if (!BLOCKS.has(node.type)) return null;
    if (node.type === "text") {
      if (typeof node.text !== "string" || !node.text) return null;
      const marks = (node.marks ?? [])
        .filter((m) => MARKS.has(m?.type))
        .map((m) => (m.type === "link" ? (safeHref(m.attrs?.href) ? { type: "link", attrs: { href: safeHref(m.attrs?.href) } } : null) : { type: m.type }))
        .filter((m): m is NonNullable<typeof m> => !!m);
      return { type: "text", text: node.text.slice(0, 20000), ...(marks.length ? { marks } : {}) };
    }
    if (node.type === "image") {
      const path = node.attrs?.path;
      if (!opts.imagePrefix || typeof path !== "string" || !path.startsWith(opts.imagePrefix) || path.includes("..")) return null;
      return { type: "image", attrs: { path, alt: typeof node.attrs?.alt === "string" ? node.attrs.alt.slice(0, 200) : null } };
    }
    const out: RichNode = { type: node.type };
    if (node.type === "heading") out.attrs = { level: [2, 3].includes(Number(node.attrs?.level)) ? Number(node.attrs?.level) : 2 };
    if (node.type === "orderedList" && Number(node.attrs?.start) > 1) out.attrs = { start: Math.min(9999, Number(node.attrs?.start)) };
    if (Array.isArray(node.content)) out.content = node.content.map((c) => walk(c, depth + 1)).filter((c): c is RichNode => !!c);
    return out;
  };
  const doc = walk(input, 0);
  return doc?.type === "doc" ? doc : null;
}

/** Teks polos (untuk pencarian, ringkasan notifikasi, validasi "isi wajib"). */
export function docToText(doc: RichNode | null | undefined): string {
  if (!doc) return "";
  const parts: string[] = [];
  const walk = (n: RichNode) => {
    if (n.type === "text") parts.push(n.text ?? "");
    else if (n.type === "hardBreak") parts.push("\n");
    n.content?.forEach(walk);
    if (["paragraph", "heading", "listItem", "blockquote", "codeBlock"].includes(n.type)) parts.push("\n");
  };
  walk(doc);
  return parts.join("").replace(/\n{3,}/g, "\n\n").trim();
}

/** Path gambar di dokumen (untuk signed URL). */
export function docImagePaths(doc: RichNode | null | undefined): string[] {
  const out: string[] = [];
  const walk = (n: RichNode) => {
    if (n.type === "image" && typeof n.attrs?.path === "string") out.push(n.attrs.path);
    n.content?.forEach(walk);
  };
  if (doc) walk(doc);
  return out;
}

/** Isi `src` gambar dari peta path → URL (signed URL dibuat server). */
export function withImageUrls(doc: RichNode, urls: Record<string, string>): RichNode {
  const walk = (n: RichNode): RichNode =>
    n.type === "image" && typeof n.attrs?.path === "string"
      ? { ...n, attrs: { ...n.attrs, src: urls[n.attrs.path] ?? null } }
      : n.content
        ? { ...n, content: n.content.map(walk) }
        : n;
  return walk(doc);
}
