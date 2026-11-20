"use client";

// Editor rich text Tiptap (dimuat lewat RichTextEditor = dynamic, ssr:false). Varian "basic"
// (tebal, miring, daftar, link) untuk Feedback; "full" menambah subjudul, kutipan, dan gambar
// (diunggah lewat onUploadImage → disimpan sebagai `path` storage, bukan URL).
import { useRef, useState } from "react";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading2, ImagePlus, Italic, Link2, List, ListOrdered, Loader2, Quote, Redo2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RICH_TEXT_CLASS } from "@/components/rich-text/rich-text-view";
import { safeHref, type RichNode } from "@/lib/rich-text";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const StorageImage = Image.extend({
  addAttributes() {
    return { ...this.parent?.(), path: { default: null } };
  },
});

export type RichTextEditorProps = {
  id?: string;
  value: RichNode;
  onChange: (doc: RichNode) => void;
  placeholder?: string;
  variant?: "basic" | "full";
  /** varian full: unggah gambar → path storage + URL tampilan */
  onUploadImage?: (file: File) => Promise<{ path: string; src: string }>;
  /** file yang ditempel (screenshot) dialihkan ke lampiran, bukan masuk ke isi */
  onPasteFiles?: (files: File[]) => void;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
};

function ToolButton({ label, active, onClick, disabled, children }: { label: string; active?: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()} // jangan curi fokus dari editor
      onClick={onClick}
      className={cn("size-8", active && "bg-muted text-foreground")}
    >
      {children}
    </Button>
  );
}

function LinkButton({ editor, disabled }: { editor: Editor; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const apply = () => {
    const raw = url.trim();
    if (!raw) editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else {
      const href = safeHref(/^[a-z]+:/i.test(raw) ? raw : `https://${raw}`);
      if (!href) return toast.error("Link harus diawali https:// atau mailto:");
      if (editor.state.selection.empty) editor.chain().focus().insertContent({ type: "text", text: raw, marks: [{ type: "link", attrs: { href } }] }).run();
      else editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    }
    setOpen(false);
  };
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setUrl(String(editor.getAttributes("link").href ?? ""));
      }}
    >
      <PopoverTrigger
        render={
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Link" title="Link" disabled={disabled} className={cn("size-8", editor.isActive("link") && "bg-muted")} />
        }
      >
        <Link2 />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 gap-2">
        <Input
          autoFocus
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              apply();
            }
          }}
          placeholder="https://..."
          aria-label="Alamat link"
        />
        <div className="flex justify-end gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => { setUrl(""); }}>
            Kosongkan
          </Button>
          <Button type="button" size="sm" onClick={apply}>
            Pasang
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function RichTextEditorInner({ id, value, onChange, placeholder, variant = "basic", onUploadImage, onPasteFiles, disabled, invalid, className }: RichTextEditorProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const full = variant === "full";

  const uploadAndInsert = async (ed: Editor, file: File) => {
    if (!onUploadImage) return;
    setUploading(true);
    try {
      const { path, src } = await onUploadImage(file);
      ed.chain().focus().setImage({ src, alt: file.name }).updateAttributes("image", { path }).run();
    } catch (e) {
      toast.error("Gambar gagal diunggah", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setUploading(false);
    }
  };

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: full ? { levels: [2, 3] } : false,
        blockquote: full ? {} : false,
        codeBlock: false,
        horizontalRule: full ? {} : false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https", protocols: ["http", "https", "mailto"] },
      }),
      Placeholder.configure({ placeholder: placeholder ?? "Tulis di sini..." }),
      ...(full ? [StorageImage.configure({ inline: false, allowBase64: false })] : []),
    ],
    content: value,
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        class: cn(RICH_TEXT_CLASS, "min-h-32 px-3 py-2 outline-none [&_.is-editor-empty:first-child]:before:pointer-events-none [&_.is-editor-empty:first-child]:before:float-left [&_.is-editor-empty:first-child]:before:h-0 [&_.is-editor-empty:first-child]:before:text-muted-foreground [&_.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]"),
        ...(invalid ? { "aria-invalid": "true" } : {}),
      },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
        if (!files.length) return false;
        if (onPasteFiles) onPasteFiles(files);
        else if (full && onUploadImage && editor) void uploadAndInsert(editor, files[0]);
        else return false;
        return true;
      },
    },
    onUpdate: ({ editor: ed }) => onChange(ed.getJSON() as RichNode),
  });

  return (
    <div
      className={cn(
        "rounded-md border bg-background shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        invalid && "border-destructive",
        disabled && "opacity-60",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-0.5 border-b px-1 py-1">
        {editor ? (
          <>
            <ToolButton label="Tebal (Ctrl+B)" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} disabled={disabled}>
              <Bold />
            </ToolButton>
            <ToolButton label="Miring (Ctrl+I)" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} disabled={disabled}>
              <Italic />
            </ToolButton>
            {full && (
              <ToolButton label="Subjudul" active={editor.isActive("heading")} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} disabled={disabled}>
                <Heading2 />
              </ToolButton>
            )}
            <ToolButton label="Daftar berpoin" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} disabled={disabled}>
              <List />
            </ToolButton>
            <ToolButton label="Daftar bernomor" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} disabled={disabled}>
              <ListOrdered />
            </ToolButton>
            {full && (
              <ToolButton label="Kutipan" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} disabled={disabled}>
                <Quote />
              </ToolButton>
            )}
            <LinkButton editor={editor} disabled={disabled} />
            {full && onUploadImage && (
              <>
                <ToolButton label="Sisipkan gambar" onClick={() => fileRef.current?.click()} disabled={disabled || uploading}>
                  {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
                </ToolButton>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadAndInsert(editor, f);
                    e.target.value = "";
                  }}
                />
              </>
            )}
            <span className="ml-auto flex">
              <ToolButton label="Urungkan" onClick={() => editor.chain().focus().undo().run()} disabled={disabled || !editor.can().undo()}>
                <Undo2 />
              </ToolButton>
              <ToolButton label="Ulangi" onClick={() => editor.chain().focus().redo().run()} disabled={disabled || !editor.can().redo()}>
                <Redo2 />
              </ToolButton>
            </span>
          </>
        ) : (
          <span className="h-8" />
        )}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
