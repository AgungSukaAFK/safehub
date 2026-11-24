import { notFound, redirect } from "next/navigation";
import { requireAccess } from "@/lib/auth";
import { documentIdOfRevision } from "@/lib/dokumen";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";

// Tautan approval/notifikasi memakai id revisi: arahkan ke halaman dokumennya.
export default async function RevisiRedirect({ params }: PageProps<"/dokumen/revisi/[id]">) {
  await requireAccess("viewer");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const docId = await documentIdOfRevision(await createClient(), id);
  if (!docId) notFound();
  redirect(`/dokumen/${docId}`);
}
