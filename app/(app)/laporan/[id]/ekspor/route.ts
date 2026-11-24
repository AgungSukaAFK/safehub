// Unduh Excel Laporan Periode: loader SAMA dengan halaman (getReportDetail): terbit = snapshot terkunci, draf = angka live.
// Satu sheet per kelompok angka; narasi di sheet sendiri. Tidak memuat data cedera terbatas (hanya agregat KPI).
import { getAccess } from "@/lib/auth";
import { cctv } from "@/lib/cctv";
import { buildWorkbook, excelFileName, xlsxResponse } from "@/lib/excel";
import { getK3Masters } from "@/lib/k3";
import { getReportDetail } from "@/lib/laporan";
import { monthLabel } from "@/lib/inspeksi-rules";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";

export async function GET(request: Request, ctx: RouteContext<"/laporan/[id]/ekspor">) {
  const access = await getAccess();
  if (!access) return new Response("Sesi berakhir. Masuk lagi.", { status: 401 });
  const { id } = await ctx.params;
  if (!isUuid(id)) return new Response("Laporan tidak valid.", { status: 400 });
  const v = new URL(request.url).searchParams.get("versi");
  const supabase = await createClient();
  const [doc, masters] = await Promise.all([getReportDetail(supabase, id, access.userId, v && /^\d+\.\d+$/.test(v) ? v : null), getK3Masters(supabase)]);
  if (!doc) return new Response("Laporan tidak ditemukan.", { status: 404 });

  const d = doc.data;
  const cat = (c: string | null) => (c ? (masters.incidentCategories.find((x) => x.value === c)?.label ?? c) : "Belum diklasifikasi");
  const insp = (c: string) => masters.inspectionTypes.find((x) => x.value === c)?.label ?? c;
  type KV = { label: string; value: string | number | null };
  const kv = (rows: KV[]) => rows;
  const cols = [
    { header: "Indikator", value: (r: KV) => r.label },
    { header: "Nilai", value: (r: KV) => (r.value === null ? "Belum tersedia" : r.value) },
  ];
  const sheets = [
    {
      name: "Kinerja",
      columns: cols,
      rows: kv([
        { label: "Fatality", value: d.kpi.fatality },
        { label: "LTI", value: d.kpi.lti },
        { label: "LTIFR", value: d.kpi.ltifr },
        { label: "LTISR", value: d.kpi.ltisr },
        { label: "Near Miss", value: d.kpi.near_miss },
        { label: "Property Damage", value: d.kpi.property_damage },
        { label: "Jam kerja", value: d.kpi.hours },
        { label: "Temuan baru", value: d.findings.opened },
        { label: "Temuan ditutup", value: d.findings.closed },
        { label: "Temuan terbuka akhir periode", value: d.findings.open_end },
        { label: "Temuan overdue (saat ini)", value: d.findings.overdue_now },
        { label: "Tindakan ditutup", value: d.findings.actions_closed },
        { label: "Tindakan menunggu verifikasi", value: d.findings.actions_waiting },
        { label: "Capaian TSP (%)", value: d.tsp.achievement },
        { label: "Program TSP sesuai rencana", value: `${d.tsp.programs_met}/${d.tsp.programs_total}` },
      ]),
    },
    {
      name: "Kejadian",
      columns: [
        { header: "No", value: (r: (typeof d.incidents.rows)[number]) => r.code },
        { header: "Tanggal", value: (r: (typeof d.incidents.rows)[number]) => r.date },
        { header: "Kategori final", value: (r: (typeof d.incidents.rows)[number]) => cat(r.category) },
        { header: "Status", value: (r: (typeof d.incidents.rows)[number]) => r.status },
      ],
      rows: d.incidents.rows,
    },
    {
      name: "Inspeksi",
      columns: [
        { header: "Jenis", value: (r: (typeof d.inspections)[number]) => insp(r.type_code) },
        { header: "Rencana", type: "number" as const, value: (r: (typeof d.inspections)[number]) => r.plan },
        { header: "Aktual", type: "number" as const, value: (r: (typeof d.inspections)[number]) => r.actual },
      ],
      rows: d.inspections,
    },
    {
      name: "Narasi",
      columns: [
        { header: "Bagian", value: (r: (typeof d.sections)[number]) => r.title },
        { header: "Isi", value: (r: (typeof d.sections)[number]) => (r.source === "narrative" ? (r.narrative ?? "") : r.source === "unavailable" ? "Belum tersedia" : "(angka di sheet lain)") },
      ],
      rows: d.sections,
    },
  ];
  const buffer = await buildWorkbook(sheets, {
    title: `${doc.templateName} · ${doc.code}${doc.shownVersion ? ` v${doc.shownVersion}` : " (draf)"}`,
    scope: doc.companyCode,
    filters: `Periode ${monthLabel(doc.period)}${doc.fromSnapshot ? " · snapshot terkunci" : " · angka langsung (belum terbit)"}`,
    exportedBy: { name: access.profile.fullName, email: access.email },
  });
  await cctv({
    category: "export",
    action: "export.excel",
    summary: `Mengunduh Excel laporan ${doc.code}${doc.shownVersion ? ` v${doc.shownVersion}` : ""}`,
    entity: "reports",
    recordId: id,
    recordLabel: doc.code,
  });
  return xlsxResponse(buffer, excelFileName(doc.code, doc.shownVersion ? `v${doc.shownVersion}` : "draf"));
}
