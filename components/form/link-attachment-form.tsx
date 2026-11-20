"use client";

// Lampiran berupa link (file besar di Google Drive), port ga-web link-attachment-form.
import { useState } from "react";
import { Link2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizeLinkUrl, type Attachment } from "@/lib/attachments";
import { toast } from "@/lib/toast";

export function LinkAttachmentForm({
  existing = [],
  onAdd,
  disabled,
}: {
  existing?: Attachment[];
  onAdd: (a: Attachment) => void;
  disabled?: boolean;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  const add = () => {
    const n = name.trim();
    const u = normalizeLinkUrl(url);
    if (!n) return toast.warning("Nama file wajib diisi.");
    if (!u) return toast.warning("Link tidak valid. Contoh: https://drive.google.com/...");
    if (existing.some((a) => a.path === u)) return toast.warning("Link ini sudah ditambahkan.");
    onAdd({ path: u, name: n, isLink: true });
    setName("");
    setUrl("");
    toast.success("Link lampiran ditambahkan.");
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        Untuk file yang terlalu besar, unggah ke Google Drive lalu tempel link-nya di sini. Pastikan akses link sudah dibuka.
      </p>
      <Input placeholder="Nama file, mis. Foto kerusakan unit" value={name} onChange={(e) => setName(e.target.value)} disabled={disabled} className="text-base md:text-sm" />
      <Input
        type="url"
        placeholder="https://drive.google.com/..."
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        disabled={disabled}
        className="text-base md:text-sm"
      />
      <Button type="button" variant="outline" onClick={add} disabled={disabled || !name.trim() || !url.trim()}>
        <Plus />
        <Link2 />
        Tambah Link
      </Button>
    </div>
  );
}
