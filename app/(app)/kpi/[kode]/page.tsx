import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ActivityLogDialog } from "@/components/detail/activity-log-dialog";
import { StatusBadge } from "@/components/detail/status-badge";
import { Content } from "@/components/list/content";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { requireAccess } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { getKpi } from "@/lib/kpi";
import { KPI_DIRECTION_LABEL, KPI_FIELD_LABELS, KPI_STATUS_MAP } from "@/lib/kpi-rules";
import { createClient } from "@/lib/supabase/server";
import { KpiAdmin } from "./kpi-admin";

export async function generateMetadata({ params }: PageProps<"/kpi/[kode]">): Promise<Metadata> {
  const { kode } = await params;
  const k = /^[a-z][a-z0-9_]{1,40}$/.test(kode) ? await getKpi(await createClient(), kode) : null;
  return { title: k ? k.name : "KPI" };
}

export default async function KpiDetailPage({ params }: PageProps<"/kpi/[kode]">) {
  const access = await requireAccess("viewer");
  const { kode } = await params;
  if (!/^[a-z][a-z0-9_]{1,40}$/.test(kode)) notFound();
  const k = await getKpi(await createClient(), kode);
  if (!k) notFound();
  const isAdmin = access.role === "admin" || access.platformAdmin;
  const t = k.thresholds;

  return (
    <div className="col-span-12 grid grid-cols-12 gap-4 md:gap-6 [&>*]:min-w-0">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {k.name}
            <StatusBadge value={k.status} map={KPI_STATUS_MAP} tone="solid" />
            <span className="text-sm font-normal text-muted-foreground">Versi {k.version}</span>
          </span>
        }
        description={k.definition}
        actions={
          <>
            <Link href="/kpi" className={buttonVariants({ variant: "outline", size: "sm" })}>
              <ArrowLeft /> Semua KPI
            </Link>
            <ActivityLogDialog
              entity="kpi_definitions"
              recordId={k.id}
              fieldLabels={KPI_FIELD_LABELS}
              trigger={
                <button type="button" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Riwayat Versi
                </button>
              }
            />
          </>
        }
      />

      <div className="col-span-12 flex flex-col gap-4 lg:col-span-8">
        <Content title="Definisi" size="lg">
          <p className="[overflow-wrap:anywhere] whitespace-pre-wrap">{k.definition}</p>
        </Content>
        <Content title="Rumus" size="lg">
          <code className="block rounded-md bg-muted px-3 py-2 text-sm [overflow-wrap:anywhere]">{k.formula}</code>
        </Content>
        {k.ruleText && (
          <Content title="Aturan Perhitungan" size="lg">
            <p className="[overflow-wrap:anywhere] whitespace-pre-wrap">{k.ruleText}</p>
          </Content>
        )}
        {k.example && (
          <Content title="Contoh" size="lg">
            <p className="[overflow-wrap:anywhere] whitespace-pre-wrap">{k.example}</p>
          </Content>
        )}
      </div>

      <div className="col-span-12 flex flex-col gap-4 lg:col-span-4">
        <Content title="Metadata" size="lg">
          <dl className="space-y-2 text-sm">
            <Item label="Sumber data" value={k.source} />
            <Item label="Pemilik" value={k.owner} />
            <Item label="Satuan" value={k.unit} />
            <Item label="Arah" value={KPI_DIRECTION_LABEL[k.direction]} />
            <Item label="Ambang" value={t && (t.warn_gte != null || t.danger_gte != null) ? [t.warn_gte != null && `Peringatan ≥ ${t.warn_gte}`, t.danger_gte != null && `Bahaya ≥ ${t.danger_gte}`].filter(Boolean).join(" · ") : "Belum ditetapkan"} />
          </dl>
        </Content>
        <Content title="Pengesahan" size="lg">
          {k.status === "approved" ? (
            <div className="space-y-1 text-sm">
              <p className="font-medium text-green-700 dark:text-green-400">Disahkan {k.approvedByName ? `oleh ${k.approvedByName}` : ""}</p>
              {k.approvedAt && <p className="text-muted-foreground">{formatDateTime(k.approvedAt)}</p>}
              {k.approvalNote && <p className="text-muted-foreground [overflow-wrap:anywhere]">{k.approvalNote}</p>}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Rumus versi {k.version} belum disahkan. Angka KPI ini tampil dengan badge &quot;Rumus belum disahkan&quot; sampai admin mengesahkannya.</p>
          )}
          {isAdmin && <KpiAdmin kpi={k} />}
        </Content>
      </div>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium [overflow-wrap:anywhere]">{value || "-"}</dd>
    </div>
  );
}
