import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, MapPin, User } from "lucide-react";
import { StatusBadge } from "@/components/detail/status-badge";
import { Content } from "@/components/list/content";
import { PageHeader } from "@/components/page-header";
import { UserProfileCard } from "@/components/user/user-profile-card";
import { requireAccess } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { getAreas, getObservationDetail } from "@/lib/inspeksi";
import { OBS_KIND_LABEL } from "@/lib/inspeksi-rules";
import { createClient } from "@/lib/supabase/server";
import { FINDING_STATUS } from "@/lib/temuan-rules";
import { isUuid } from "@/lib/utils";
import { ObservasiFiles } from "./observasi-files";

export async function generateMetadata({ params }: PageProps<"/observasi/[id]">): Promise<Metadata> {
  const { id } = await params;
  if (!isUuid(id)) return { title: "Observasi" };
  const { data } = await (await createClient()).from("observations").select("code").eq("id", id).maybeSingle();
  return { title: data?.code ?? "Observasi" };
}

export default async function ObservasiDetailPage({ params }: PageProps<"/observasi/[id]">) {
  await requireAccess("viewer");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const doc = await getObservationDetail(supabase, id, await getAreas(supabase));
  if (!doc) notFound();
  return (
    <div className="col-span-12 grid grid-cols-12 gap-4 md:gap-6 [&>*]:min-w-0">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{doc.code}</span>
            <span className="rounded-md border px-2 py-0.5 text-xs font-medium">{OBS_KIND_LABEL[doc.kind] ?? doc.kind}</span>
          </span>
        }
        description={`${doc.siteName} · ${doc.areaName}`}
      />
      <div className="col-span-12 flex flex-col gap-4 lg:col-span-8">
        <Content title="Uraian" size="lg">
          <p className="[overflow-wrap:anywhere] whitespace-pre-wrap">{doc.description}</p>
          {doc.immediateAction && (
            <p className="mt-3 text-sm">
              <span className="text-muted-foreground">Tindakan langsung: </span>
              {doc.immediateAction}
            </p>
          )}
        </Content>
        <Content title="Foto" description={doc.files.length ? `${doc.files.length} file` : undefined} size="lg">
          <ObservasiFiles files={doc.files} />
        </Content>
      </div>
      <div className="col-span-12 flex flex-col gap-4 lg:col-span-4">
        <Content title="Ringkasan" size="lg">
          <dl className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <User className="size-4 text-muted-foreground" />
              {doc.reporter ? <UserProfileCard userId={doc.reporter.id} name={doc.reporter.name} avatarUrl={doc.reporter.avatarUrl} size="xs" /> : "-"}
            </div>
            <div className="flex items-center gap-2">
              <CalendarClock className="size-4 text-muted-foreground" />
              {formatDateTime(doc.observedAt)}
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-muted-foreground" />
              {doc.areaName}
            </div>
          </dl>
        </Content>
        <Content title="Tindak Lanjut" size="lg">
          {doc.finding ? (
            <Link href={`/temuan/${doc.finding.id}`} className="flex items-center justify-between gap-2 rounded-lg border p-3 text-sm transition-colors hover:border-primary/40">
              <span className="font-mono font-semibold text-primary">{doc.finding.code}</span>
              <StatusBadge value={doc.finding.status} map={FINDING_STATUS} />
            </Link>
          ) : (
            <p className="text-sm text-muted-foreground">Observasi ini tidak diteruskan sebagai temuan.</p>
          )}
        </Content>
      </div>
    </div>
  );
}
