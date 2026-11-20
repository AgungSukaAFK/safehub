"use client";

// Kotak unggah file (frontend-guide §9.4, port ga-web): klik / seret / tempel (Ctrl+V saat fokus).
import { useState } from "react";
import { Loader2, UploadCloud } from "lucide-react";
import { useFileDrop } from "@/hooks/use-file-drop";
import { MAX_FILE_BYTES } from "@/lib/attachments";
import { useOnline } from "@/lib/offline/use-online";
import { formatBytes } from "@/lib/format";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

export function FileDropzone({
  onFiles,
  id,
  multiple,
  accept,
  maxBytes = MAX_FILE_BYTES,
  disabled,
  loading,
  title = "Seret & lepas file, klik, atau tempel (Ctrl+V)",
  hint,
  className,
}: {
  onFiles: (files: File[]) => void;
  id?: string;
  multiple?: boolean;
  accept?: string;
  maxBytes?: number;
  disabled?: boolean;
  /** Sedang mengunggah: kotak terkunci + spinner */
  loading?: boolean;
  title?: string;
  hint?: string;
  className?: string;
}) {
  const online = useOnline();
  const locked = disabled || loading || !online;
  const [focused, setFocused] = useState(false);

  const accept_ = (files: File[]) => {
    const tooBig = files.filter((f) => f.size > maxBytes);
    if (tooBig.length) {
      toast.error("File terlalu besar", {
        description: `${tooBig.map((f) => f.name).join(", ")} melebihi ${formatBytes(maxBytes)}. Pakai lampiran link (Google Drive).`,
      });
    }
    const ok = files.filter((f) => f.size <= maxBytes);
    if (ok.length) onFiles(multiple ? ok : ok.slice(0, 1));
  };

  const { isDragging, dropProps } = useFileDrop({ onFiles: accept_, multiple, accept, disabled: locked });

  return (
    <label
      {...dropProps}
      tabIndex={-1}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPaste={(e) => {
        if (locked) return;
        const files = Array.from(e.clipboardData.files);
        if (files.length) {
          e.preventDefault();
          accept_(files);
        }
      }}
      className={cn(
        "relative flex items-center gap-3 rounded-lg border-2 border-dashed px-4 py-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
        locked ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25",
        !locked && !isDragging && "hover:border-primary/50 hover:bg-muted/40",
        className,
      )}
    >
      <input
        id={id}
        type="file"
        multiple={multiple}
        accept={accept}
        disabled={locked}
        className="sr-only"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = ""; // supaya file yang sama bisa dipilih lagi
          if (files.length) accept_(files);
        }}
      />
      {loading ? <Loader2 className="size-5 shrink-0 animate-spin text-primary" /> : <UploadCloud className="size-5 shrink-0 text-primary" />}
      <div className="min-w-0 text-sm">
        <p className="font-medium">{loading ? "Mengunggah..." : isDragging ? "Lepaskan file di sini" : title}</p>
        <p className="text-xs text-muted-foreground">
          {focused && !locked ? "Tekan Ctrl+V untuk menempel gambar dari clipboard. " : ""}
          {!online ? "Unggah butuh koneksi internet." : (hint ?? `Maks. ${formatBytes(maxBytes)} per file.`)}
        </p>
      </div>
    </label>
  );
}
