import type { Metadata } from "next";
import { requireAccess } from "@/lib/auth";
import { EMPTY_DOC } from "@/lib/rich-text";
import { createClient } from "@/lib/supabase/server";
import { latestVersion } from "@/lib/updates";
import { UpdateForm } from "../update-form";

export const metadata: Metadata = { title: "Tulis Pembaruan" };

export default async function PembaruanBaruPage() {
  const access = await requireAccess("admin");
  const latest = await latestVersion(await createClient());
  // usulan awal: naikkan minor dari versi terakhir
  const next = latest ? [latest[0], latest[1] + 1, 0] : [1, 0, 0];
  return (
    <UpdateForm
      id={null}
      initial={{ major: String(next[0]), minor: String(next[1]), patch: String(next[2]), title: "", highlights: [""], thumbnailPath: null, content: EMPTY_DOC }}
      initialThumbUrl={null}
      latest={latest}
      userId={access.userId}
      authorName={access.profile.fullName}
      version={null}
    />
  );
}
