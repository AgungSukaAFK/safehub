"use client";

import { ExternalLink, FileText } from "lucide-react";
import { BUCKET_LAMPIRAN } from "@/lib/app-config";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/toast";

export function ObservasiFiles({ files }: { files: { path: string; name: string }[] }) {
  if (!files.length) return <p className="text-sm text-muted-foreground">Tidak ada foto.</p>;
  const open = async (path: string) => {
    const { data, error } = await createClient().storage.from(BUCKET_LAMPIRAN).createSignedUrl(path, 300);
    if (error || !data) return toast.error("Foto gagal dibuka.");
    window.open(data.signedUrl, "_blank", "noopener");
  };
  return (
    <ul className="divide-y rounded-lg border">
      {files.map((f) => (
        <li key={f.path} className="flex items-center gap-3 px-3 py-2 text-sm">
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <button type="button" className="min-w-0 flex-1 truncate text-left font-medium hover:underline" onClick={() => open(f.path)}>
            {f.name}
          </button>
          <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
        </li>
      ))}
    </ul>
  );
}
