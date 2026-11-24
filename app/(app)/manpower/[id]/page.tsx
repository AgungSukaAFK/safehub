import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { ActivityLogDialog } from "@/components/detail/activity-log-dialog";
import { StatusBadge } from "@/components/detail/status-badge";
import { ExpiryChip } from "@/components/expiry-chip";
import { Content } from "@/components/list/content";
import { PageHeader } from "@/components/page-header";
import { RestrictedData } from "@/components/restricted-data";
import { Button } from "@/components/ui/button";
import { requireAccess } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { getContractorOptions } from "@/lib/k3";
import { getEmployeeDetail, listCompetencies } from "@/lib/manpower";
import { COMPETENCY_STATE, EMPLOYEE_STATUS, MCU_RESULT, PEOPLE_FIELD_LABELS } from "@/lib/people-rules";
import { createClient } from "@/lib/supabase/server";
import { cn, isUuid } from "@/lib/utils";
import { CertificateSheet, EmployeeSheet, EvidenceSheet, McuSheet, PermitSheet } from "../people-sheets";

const TABS = [
  { key: "ringkasan", label: "Ringkasan" },
  { key: "kompetensi", label: "Kompetensi & Sertifikat" },
  { key: "mcu", label: "MCU" },
  { key: "permit", label: "Permit Site" },
] as const;

export async function generateMetadata({ params }: PageProps<"/manpower/[id]">): Promise<Metadata> {
  const { id } = await params;
  if (!isUuid(id)) return { title: "Karyawan" };
  const supabase = await createClient();
  const { data } = await supabase.from("employees").select("name").eq("id", id).maybeSingle();
  return { title: data?.name ?? "Karyawan" };
}

// Profil karyawan (rancangan §4.6): ringkasan, sertifikat, MCU (diagnosis = data terbatas), permit site, riwayat.
export default async function EmployeePage({ params, searchParams }: PageProps<"/manpower/[id]">) {
  const access = await requireAccess("viewer");
  const isAdmin = access.role === "admin" || access.platformAdmin;
  if (!isAdmin && !access.functions.some((f) => f !== "karyawan")) redirect("/");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.tab)?.key ?? "ringkasan";
  const canMedical = access.functions.includes("hr") || access.functions.includes("hse");
  const supabase = await createClient();
  const [e, comps, contractors, jt] = await Promise.all([
    getEmployeeDetail(supabase, id, canMedical),
    listCompetencies(supabase),
    getContractorOptions(supabase),
    supabase.from("position_requirements").select("job_title"),
  ]);
  if (!e) notFound();
  const canManage = isAdmin || (!access.functions.includes("auditor") && (access.functions.includes("hr") || access.functions.includes("hse")));
  const canWriteMedical = canMedical && !access.functions.includes("auditor");
  const jobTitles = [...new Set([e.jobTitle, ...(jt.data ?? []).map((x) => x.job_title)])];
  const compOptions = comps.filter((c) => c.isActive).map((c) => ({ value: c.id, label: c.name }));
  const ok = e.required.filter((r) => r.state === "valid" || r.state === "expiring").length;

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {e.name}
            <StatusBadge value={e.status} map={EMPLOYEE_STATUS} />
          </span>
        }
        description={`${e.code} · ${e.jobTitle}${e.department ? ` · ${e.department}` : ""}${e.contractorName ? ` · ${e.contractorName}` : ""}`}
        actions={
          <>
            {canManage && (
              <EmployeeSheet
                trigger={<Button variant="outline"><Pencil /> Ubah</Button>}
                siteId={e.siteId}
                companyCode={e.companyCode}
                employee={{ id: e.id, code: e.code, name: e.name, jobTitle: e.jobTitle, department: e.department, employment: e.employment, joinDate: e.joinDate, status: e.status, contractorId: e.contractorId }}
                contractors={contractors}
                jobTitles={jobTitles}
              />
            )}
            <ActivityLogDialog entity="employees" recordId={e.id} fieldLabels={PEOPLE_FIELD_LABELS} />
          </>
        }
      />
      <nav className="col-span-12 flex flex-wrap gap-1 border-b" aria-label="Tab profil">
        {TABS.map((t) => (
          <Link key={t.key} href={`/manpower/${e.id}?tab=${t.key}`} aria-current={tab === t.key ? "page" : undefined} className={cn("-mb-px border-b-2 px-3 py-2 text-sm", tab === t.key ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "ringkasan" && (
        <>
          <Content title="Data Karyawan" size="md">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              {[
                ["NIK", e.code],
                ["Jabatan", e.jobTitle],
                ["Section", e.department ?? "-"],
                ["Hubungan kerja", e.employment],
                ["Tanggal mulai", e.joinDate ? formatDate(e.joinDate) : "-"],
                ["Perusahaan", e.contractorName ?? e.companyCode],
              ].map(([k, v]) => (
                <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>
              ))}
            </dl>
          </Content>
          <Content title="Status Kepatuhan" size="md" description={`${ok} dari ${e.required.length} kompetensi wajib terpenuhi`}>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center justify-between gap-2"><span>MCU terakhir</span>{e.mcu[0] ? <ExpiryChip expiry={e.mcu[0].expiry} showDate={false} /> : <ExpiryChip expiry={{ state: "none", validUntil: null, daysLeft: null }} />}</li>
              <li className="flex items-center justify-between gap-2"><span>Permit site</span>{e.permits[0] ? <ExpiryChip expiry={e.permits[0].expiry} showDate={false} /> : <ExpiryChip expiry={{ state: "none", validUntil: null, daysLeft: null }} />}</li>
              {e.required.filter((r) => r.state !== "valid").map((r) => (
                <li key={r.competencyId} className="flex items-center justify-between gap-2"><span>{r.name}</span><StatusBadge value={r.state} map={COMPETENCY_STATE} /></li>
              ))}
            </ul>
          </Content>
        </>
      )}

      {tab === "kompetensi" && (
        <Content
          title="Kompetensi & Sertifikat"
          cardAction={canManage ? <CertificateSheet trigger={<Button size="sm"><Plus /> Tambah Sertifikat</Button>} employeeId={e.id} competencies={compOptions} /> : undefined}
        >
          {e.certificates.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada sertifikat.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground"><tr>{["Kompetensi", "Penerbit", "Nomor", "Terbit", "Masa berlaku", "Bukti", ""].map((h) => <th key={h} scope="col" className="px-3 py-2 text-left font-medium">{h}</th>)}</tr></thead>
                <tbody>
                  {e.certificates.map((c) => (
                    <tr key={c.id} className="border-t">
                      <td className="px-3 py-2 font-medium">{c.competencyName}</td>
                      <td className="px-3 py-2">{c.issuer ?? "-"}</td>
                      <td className="px-3 py-2">{c.number ?? "-"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{c.issuedOn ? formatDate(c.issuedOn) : "-"}</td>
                      <td className="px-3 py-2">{c.validUntil ? <ExpiryChip expiry={c.expiry} /> : <span className="text-muted-foreground">Seumur hidup</span>}</td>
                      <td className="px-3 py-2">{canManage ? <EvidenceSheet kind="sertifikat" recordId={c.id} employeeId={e.id} count={c.evidence} label={c.competencyName} /> : <span className="text-xs">{c.evidence} file</span>}</td>
                      <td className="px-3 py-2">{canManage && <CertificateSheet trigger={<Button variant="ghost" size="icon-sm" aria-label={`Ubah sertifikat ${c.competencyName}`}><Pencil /></Button>} employeeId={e.id} competencies={compOptions} cert={{ id: c.id, competencyId: c.competencyId, number: c.number, issuer: c.issuer, issuedOn: c.issuedOn, validUntil: c.validUntil }} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Content>
      )}

      {tab === "mcu" && (
        <Content
          title="Medical Check Up"
          cardAction={canWriteMedical ? <McuSheet trigger={<Button size="sm"><Plus /> Catat MCU</Button>} employeeId={e.id} canWriteMedical={canWriteMedical} /> : undefined}
        >
          {e.mcu.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada catatan MCU.</p>
          ) : (
            <ul className="space-y-3">
              {e.mcu.map((m) => (
                <li key={m.id} className="space-y-2 rounded-lg border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{formatDate(m.checkedOn)}</strong>
                    <StatusBadge value={m.result} map={MCU_RESULT} />
                    <ExpiryChip expiry={m.expiry} />
                    {canWriteMedical && (
                      <span className="ml-auto flex items-center gap-1">
                        <EvidenceSheet kind="mcu" recordId={m.id} employeeId={e.id} count={m.evidence} label="MCU" />
                        <McuSheet trigger={<Button variant="ghost" size="icon-sm" aria-label="Ubah MCU"><Pencil /></Button>} employeeId={e.id} canWriteMedical mcu={{ id: m.id, checkedOn: m.checkedOn, validUntil: m.validUntil, result: m.result, diagnosis: m.diagnosis, note: m.note }} />
                      </span>
                    )}
                  </div>
                  <RestrictedData functions={["hr", "hse"]} restricted={e.mcuRestricted} title="Diagnosis & catatan medis">
                    <p className="text-sm">{m.diagnosis ?? <span className="text-muted-foreground">Tidak ada diagnosis tercatat.</span>}</p>
                    {m.note && <p className="mt-1 text-sm text-muted-foreground">{m.note}</p>}
                  </RestrictedData>
                </li>
              ))}
            </ul>
          )}
        </Content>
      )}

      {tab === "permit" && (
        <Content title="Permit Site" cardAction={canManage ? <PermitSheet trigger={<Button size="sm"><Plus /> Tambah Permit</Button>} employeeId={e.id} /> : undefined}>
          {e.permits.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada permit.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {e.permits.map((x) => (
                <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <span><strong>{x.name}</strong>{x.number && <small className="ml-2 text-muted-foreground">{x.number}</small>}</span>
                  <span className="flex items-center gap-2">
                    <ExpiryChip expiry={x.expiry} />
                    {canManage && <PermitSheet trigger={<Button variant="ghost" size="icon-sm" aria-label={`Ubah permit ${x.name}`}><Pencil /></Button>} employeeId={e.id} permit={{ id: x.id, name: x.name, number: x.number, validUntil: x.validUntil }} />}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Content>
      )}
    </>
  );
}
