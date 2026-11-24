import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Pencil, UserPlus } from "lucide-react";
import { ActivityLogDialog } from "@/components/detail/activity-log-dialog";
import { StatusBadge } from "@/components/detail/status-badge";
import { Content } from "@/components/list/content";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireAccess } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { listCompetencies } from "@/lib/manpower";
import { getTrainingDetail, listTrainingCandidates } from "@/lib/pelatihan";
import { ATTENDANCE, TRAINING_FIELD_LABELS, TRAINING_STATUS } from "@/lib/pelatihan-rules";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";
import { AttendanceControl, ParticipantsSheet, StatusActions, TrainingEvidenceSheet, TrainingSheet } from "../training-sheets";

export async function generateMetadata({ params }: PageProps<"/pelatihan/[id]">): Promise<Metadata> {
  const { id } = await params;
  if (!isUuid(id)) return { title: "Pelatihan" };
  const supabase = await createClient();
  const { data } = await supabase.from("trainings").select("code").eq("id", id).maybeSingle();
  return { title: data?.code ?? "Pelatihan" };
}

// Detail pelatihan (rancangan §4.6): info, peserta + kehadiran, bukti, riwayat perubahan.
export default async function PelatihanDetailPage({ params }: PageProps<"/pelatihan/[id]">) {
  const access = await requireAccess("viewer");
  const isAdmin = access.role === "admin" || access.platformAdmin;
  if (!isAdmin && !access.functions.some((f) => f !== "karyawan")) redirect("/");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const t = await getTrainingDetail(supabase, id);
  if (!t) notFound();
  const canManage = isAdmin || (!access.functions.includes("auditor") && (access.functions.includes("hr") || access.functions.includes("hse")));
  const planned = t.status === "planned";
  const [candidates, comps] = await Promise.all([canManage && planned ? listTrainingCandidates(supabase, t.siteId) : Promise.resolve([]), canManage && planned ? listCompetencies(supabase) : Promise.resolve([])]);
  const pending = t.attendees.filter((a) => a.attendance === "registered").length;

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {t.title}
            <StatusBadge value={t.status} map={TRAINING_STATUS} />
          </span>
        }
        description={`${t.code} · ${formatDate(t.startsOn)}${t.endsOn !== t.startsOn ? ` – ${formatDate(t.endsOn)}` : ""}${t.venue ? ` · ${t.venue}` : ""}`}
        actions={
          <>
            {canManage && planned && (
              <>
                <TrainingSheet
                  trigger={<Button variant="outline"><Pencil /> Ubah</Button>}
                  siteId={t.siteId}
                  companyCode={t.companyCode}
                  competencies={comps.filter((c) => c.isActive).map((c) => ({ value: c.id, label: c.name }))}
                  training={{ id: t.id, title: t.title, competencyId: t.competencyId, provider: t.provider, venue: t.venue, startsOn: t.startsOn, endsOn: t.endsOn, capacity: t.capacity, notes: t.notes }}
                />
                <StatusActions trainingId={t.id} code={t.code} />
              </>
            )}
            <ActivityLogDialog entity="trainings" recordId={t.id} fieldLabels={TRAINING_FIELD_LABELS} />
          </>
        }
      />
      <Content title="Informasi" size="md">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          {[
            ["Kompetensi terkait", t.competencyName ?? "-"],
            ["Penyelenggara", t.provider ?? "-"],
            ["Tempat", t.venue ?? "-"],
            ["Kapasitas", t.capacity ? `${t.capacity} orang` : "Tanpa batas"],
          ].map(([k, v]) => (
            <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>
          ))}
          {t.notes && <div className="col-span-2"><dt className="text-xs text-muted-foreground">Catatan</dt><dd>{t.notes}</dd></div>}
        </dl>
      </Content>
      <Content title="Bukti" size="md" description="Daftar hadir, foto kegiatan, sertifikat kolektif">
        <TrainingEvidenceSheet trainingId={t.id} count={t.evidence} canUpload={canManage && t.status !== "cancelled"} />
        {t.competencyName && t.status === "done" && (
          <p className="mt-3 text-xs text-muted-foreground">
            Sertifikat peserta belum diterbitkan otomatis. Catat nomor &amp; masa berlaku asli di tab Kompetensi profil karyawan.
          </p>
        )}
      </Content>
      <Content
        title="Peserta & Kehadiran"
        description={`${t.participants} peserta${t.status !== "planned" || t.started ? ` · ${t.present} hadir` : ""}${planned && t.started && pending > 0 ? ` · ${pending} belum dicatat` : ""}`}
        cardAction={
          canManage && planned ? (
            <ParticipantsSheet trigger={<Button size="sm" variant="outline"><UserPlus /> Atur Peserta</Button>} trainingId={t.id} candidates={candidates} selected={t.attendees.map((a) => a.employeeId)} capacity={t.capacity} />
          ) : undefined
        }
      >
        {t.attendees.length === 0 ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Belum ada peserta.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>{["NIK", "Nama", "Jabatan", "Kehadiran", canManage && t.status !== "cancelled" ? "Catat" : ""].map((h, i) => <th key={i} scope="col" className="px-3 py-2 text-left font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {t.attendees.map((a) => (
                  <tr key={a.employeeId} className="border-t">
                    <td className="px-3 py-2 tabular-nums">{a.code}</td>
                    <td className="px-3 py-2 font-medium"><Link href={`/manpower/${a.employeeId}?tab=pelatihan`} className="underline underline-offset-2">{a.name}</Link></td>
                    <td className="px-3 py-2">{a.jobTitle}</td>
                    <td className="px-3 py-2"><StatusBadge value={a.attendance} map={ATTENDANCE} /></td>
                    <td className="px-3 py-2">
                      {canManage && t.status !== "cancelled" && (
                        planned || t.status === "done" ? <AttendanceControl trainingId={t.id} employeeId={a.employeeId} name={a.name} value={a.attendance} disabled={!t.started || t.status === "done"} /> : null
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {planned && !t.started && canManage && <p className="mt-2 text-xs text-muted-foreground">Kehadiran bisa dicatat mulai {formatDate(t.startsOn)}.</p>}
      </Content>
    </>
  );
}
