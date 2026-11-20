import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getUpdateForEdit, latestVersion } from "@/lib/updates";
import { UpdateForm } from "../../update-form";

export const metadata: Metadata = { title: "Ubah Pembaruan" };

export default async function PembaruanUbahPage({ params }: PageProps<"/pembaruan/[id]/ubah">) {
  const access = await requireAccess("admin");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const supabase = await createClient();
  const [post, latest] = await Promise.all([getUpdateForEdit(supabase, id), latestVersion(supabase, id)]);
  if (!post) notFound();
  return (
    <UpdateForm
      id={post.id}
      initial={{
        major: String(post.major),
        minor: String(post.minor),
        patch: String(post.patch),
        title: post.title,
        highlights: post.highlights.length ? post.highlights : [""],
        thumbnailPath: post.thumbnailPath,
        content: post.content,
      }}
      initialThumbUrl={post.thumbnailUrl}
      latest={latest}
      userId={access.userId}
      authorName={access.profile.fullName}
      version={post.updatedAt}
    />
  );
}
