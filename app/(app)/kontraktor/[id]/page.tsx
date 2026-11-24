import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { ActivityLogDialog } from "@/components/detail/activity-log-dialog";
import { StatusBadge } from "@/components/detail/status-badge";
import { ExpiryChip } from "@/components/expiry-chip";
import { Content } from "@/components/list/content";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireAccess } from "@/lib/auth";
import { formatDate, formatRupiah } from "@/lib/format";
import { getContractorDetail } from "@/lib/kontraktor";
import { CONTRACTOR_KINDS, CSMS_RESULT, DOC_STATUS, KONTRAKTOR_FIELD_LABELS, LEGAL_STATE } from "@/lib/kontraktor-rules";
import { EMPLOYEE_STATUS } from "@/lib/people-rules";
import { createClient } from "@/lib/supabase/server";
import { cn, isUuid } from "@/lib/utils";
import { ContractorSheet, ContractSheet, CsmsSheet, DocumentSheet, KontraktorEvidenceSheet, PermitSheet } from "../kontraktor-sheets";

const TABS = [
  { key: "ringkasan", label: "Ringkasan" },
  { key: "izin", label: "Izin" },
  { key: "kontrak", label: "Kontrak" },
  { key: "personel", label: "Personel" },
  { key: "csms", label: "CSMS" },
  { key: "dokumen", label: "Checklist Dokumen" },
] as const;

export async function generateMetadata({ params }: PageProps<"/kontraktor/[id]">): Promise<Metadata> {
  const { id } = await params;
  if (!isUuid(id)) return { title: "Kontraktor" };
  const supabase = await createClient();
  const { data } = await supabase.from("contractors").select("name").eq("id", id).maybeSingle();
  return { title: data?.name ?? "Kontraktor" };
}

// Profil kontraktor (rancangan §4.7): ringkasan, izin, kontrak (nilai = data komersial), personel, CSMS, checklist dokumen.
export default async function KontraktorDetailPage({ params, searchParams }: PageProps<"/kontraktor/[id]">) {
  const access = await requireAccess("viewer");
  const isAdmin = access.role === "admin" || access.platformAdmin;
  if (!isAdmin && !access.functions.some((f) => f !== "karyawan")) redirect("/");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.tab)?.key ?? "ringkasan";
  const canCommercial = isAdmin || access.functions.includes("manajemen") || access.functions.includes("kontraktor_admin");
  const canManage = isAdmin || (!access.functions.includes("auditor") && (access.functions.includes("kontraktor_admin") || access.functions.includes("hse")));
  const supabase = await createClient();
  const c = await getContractorDetail(supabase, id, canCommercial);
  if (!c) notFound();
  const o = c.overview;
  const kind = CONTRACTOR_KINDS.find((k) => k.value === c.kind)?.label ?? c.kind;

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {c.name}
            <StatusBadge value={o.legalState} map={LEGAL_STATE} />
            {!c.isActive && <StatusBadge value="inactive" map={EMPLOYEE_STATUS} />}
          </span>
        }
        description={`${kind} · ${c.companyCode}${c.picName ? ` · PIC ${c.picName}` : ""}`}
        actions={
          <>
            {canManage && <ContractorSheet trigger={<Button variant="outline"><Pencil /> Ubah</Button>} contractor={{ id: c.id, name: c.name, kind: c.kind, picName: c.picName, picContact: c.picContact, notes: c.notes, isActive: c.isActive }} />}
            <ActivityLogDialog entity="contractors" recordId={c.id} fieldLabels={KONTRAKTOR_FIELD_LABELS} />
          </>
        }
      />
      <nav className="col-span-12 flex flex-wrap gap-1 border-b" aria-label="Tab profil kontraktor">
        {TABS.map((t) => (
          <Link key={t.key} href={`/kontraktor/${c.id}?tab=${t.key}`} aria-current={tab === t.key ? "page" : undefined} className={cn("-mb-px border-b-2 px-3 py-2 text-sm", tab === t.key ? "border-primary font-medium text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "ringkasan" && (
        <>
          <Content title="Data Kontraktor" size="md">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              {[
                ["Jenis", kind],
                ["Perusahaan", c.companyCode],
                ["PIC", c.picName ?? "-"],
                ["Kontak PIC", c.picContact ?? "-"],
              ].map(([k, v]) => (
                <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>
              ))}
              {c.notes && <div className="col-span-2"><dt className="text-xs text-muted-foreground">Catatan</dt><dd>{c.notes}</dd></div>}
            </dl>
          </Content>
          <Content title="Status Kepatuhan" size="md">
            <ul className="space-y-2 text-sm">
              <li className="flex items-center justify-between gap-2"><span>Izin terdekat berakhir</span>{o.permitCount === 0 ? <StatusBadge value="none" map={LEGAL_STATE} /> : <ExpiryChip expiry={o.nearest} />}</li>
              <li className="flex items-center justify-between gap-2"><span>Dokumen wajib</span><strong className="tabular-nums">{o.docsOk}/{o.docsTotal} lengkap</strong></li>
              <li className="flex items-center justify-between gap-2"><span>CSMS terakhir</span>{o.csmsResult ? <StatusBadge value={o.csmsResult} map={CSMS_RESULT} /> : <span className="text-muted-foreground">Belum dinilai</span>}</li>
              <li className="flex items-center justify-between gap-2"><span>Kontrak berjalan</span><strong className="tabular-nums">{o.activeContracts}</strong></li>
              <li className="flex items-center justify-between gap-2"><span>Personel aktif</span><strong className="tabular-nums">{o.personnel}</strong></li>
            </ul>
          </Content>
        </>
      )}

      {tab === "izin" && (
        <Content title="Izin & Legalitas" description="Izin terbaru per nama dipakai untuk status legalitas" cardAction={canManage ? <PermitSheet trigger={<Button size="sm"><Plus /> Tambah Izin</Button>} contractorId={c.id} /> : undefined}>
          {c.permits.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada izin tercatat.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground"><tr>{["Izin", "Nomor", "Penerbit", "Masa berlaku", "Bukti", ""].map((h, i) => <th key={i} scope="col" className="px-3 py-2 text-left font-medium">{h}</th>)}</tr></thead>
                <tbody>
                  {c.permits.map((x) => (
                    <tr key={x.id} className={cn("border-t", x.superseded && "text-muted-foreground")}>
                      <td className="px-3 py-2 font-medium">{x.name}{x.superseded && <small className="ml-2 text-xs font-normal">(riwayat)</small>}</td>
                      <td className="px-3 py-2">{x.number ?? "-"}</td>
                      <td className="px-3 py-2">{x.issuer ?? "-"}</td>
                      <td className="px-3 py-2">{x.superseded ? formatDate(x.validUntil) : <ExpiryChip expiry={x.expiry} />}</td>
                      <td className="px-3 py-2"><KontraktorEvidenceSheet kind="izin" recordId={x.id} contractorId={c.id} count={x.evidence} label={x.name} canUpload={canManage} /></td>
                      <td className="px-3 py-2">{canManage && <PermitSheet trigger={<Button variant="ghost" size="icon-sm" aria-label={`Ubah izin ${x.name}`}><Pencil /></Button>} contractorId={c.id} permit={{ id: x.id, name: x.name, number: x.number, issuer: x.issuer, validUntil: x.validUntil }} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Content>
      )}

      {tab === "kontrak" && (
        <Content title="Kontrak" description={c.canSeeCommercial ? undefined : "Nilai kontrak hanya terlihat oleh Manajemen dan Pengelola Kontraktor."} cardAction={canManage ? <ContractSheet trigger={<Button size="sm"><Plus /> Tambah Kontrak</Button>} contractorId={c.id} canSeeCommercial={c.canSeeCommercial} /> : undefined}>
          {c.contracts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada kontrak.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground"><tr>{["Nomor", "Judul", "Periode", "Status", "Nilai", ""].map((h, i) => <th key={i} scope="col" className="px-3 py-2 text-left font-medium">{h}</th>)}</tr></thead>
                <tbody>
                  {c.contracts.map((k) => (
                    <tr key={k.id} className="border-t">
                      <td className="px-3 py-2 tabular-nums whitespace-nowrap">{k.number}</td>
                      <td className="px-3 py-2 font-medium">{k.title}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(k.startsOn)} – {formatDate(k.endsOn)}</td>
                      <td className="px-3 py-2">{k.expiry.state === "expired" ? <span className="text-muted-foreground">Berakhir</span> : <ExpiryChip expiry={k.expiry} />}</td>
                      <td className="px-3 py-2 tabular-nums whitespace-nowrap">{c.canSeeCommercial ? (k.amount !== null ? formatRupiah(k.amount) : "-") : <span className="text-muted-foreground">Terbatas</span>}</td>
                      <td className="px-3 py-2">{canManage && <ContractSheet trigger={<Button variant="ghost" size="icon-sm" aria-label={`Ubah kontrak ${k.number}`}><Pencil /></Button>} contractorId={c.id} canSeeCommercial={c.canSeeCommercial} contract={{ id: k.id, number: k.number, title: k.title, startsOn: k.startsOn, endsOn: k.endsOn, amount: k.amount }} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Content>
      )}

      {tab === "personel" && (
        <Content title="Personel Mitra" description={`${c.personnel.length} orang · data karyawan bertanda mitra ini`}>
          {c.personnel.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada personel. Tambahkan lewat Manpower dengan memilih mitra ini.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {c.personnel.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <span><Link href={`/manpower/${e.id}`} className="font-medium underline underline-offset-2">{e.name}</Link><small className="ml-2 text-muted-foreground">{e.code} · {e.jobTitle}</small></span>
                  <StatusBadge value={e.status} map={EMPLOYEE_STATUS} />
                </li>
              ))}
            </ul>
          )}
        </Content>
      )}

      {tab === "csms" && (
        <Content title="Penilaian CSMS" description="Hasil: 80+ lulus · 60-79 bersyarat · di bawah 60 gagal" cardAction={canManage ? <CsmsSheet trigger={<Button size="sm"><Plus /> Catat Penilaian</Button>} contractorId={c.id} /> : undefined}>
          {c.csms.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum pernah dinilai.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {c.csms.map((a, i) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <span>
                    <strong className="tabular-nums">{formatDate(a.assessedOn)}</strong>
                    <span className="ml-2 tabular-nums">Skor {a.score}</span>
                    {a.note && <small className="block text-xs text-muted-foreground">{a.note}</small>}
                  </span>
                  <span className="flex items-center gap-2">
                    <StatusBadge value={a.result} map={CSMS_RESULT} />
                    {i === 0 ? <ExpiryChip expiry={a.expiry} /> : <small className="text-xs text-muted-foreground">riwayat</small>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Content>
      )}

      {tab === "dokumen" && (
        <Content title="Checklist Dokumen Wajib" description={`${o.docsOk} dari ${o.docsTotal} dokumen lengkap`}>
          <ul className="divide-y rounded-lg border">
            {c.documents.map((d) => (
              <li key={d.typeId} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <span>
                  <strong className="font-medium">{d.typeName}</strong>
                  {d.note && <small className="block text-xs text-muted-foreground">{d.note}</small>}
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <StatusBadge value={d.status} map={DOC_STATUS} />
                  {d.status === "received" && d.validUntil && <ExpiryChip expiry={d.expiry} />}
                  {d.id && <KontraktorEvidenceSheet kind="kdok" recordId={d.id} contractorId={c.id} count={d.evidence} label={d.typeName} canUpload={canManage} />}
                  {canManage && (
                    <DocumentSheet trigger={<Button variant="ghost" size="icon-sm" aria-label={`Ubah ${d.typeName}`}><Pencil /></Button>} contractorId={c.id} typeId={d.typeId} typeName={d.typeName} doc={{ status: d.status, validUntil: d.validUntil, note: d.note }} />
                  )}
                </span>
              </li>
            ))}
          </ul>
          {canManage && <p className="mt-2 text-xs text-muted-foreground">Unggah file bukti tersedia setelah status dokumen pertama kali disimpan.</p>}
        </Content>
      )}
    </>
  );
}
