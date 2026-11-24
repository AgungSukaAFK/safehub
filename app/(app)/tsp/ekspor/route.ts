// Unduh Excel monitoring TSP: loader yang SAMA dengan halaman (getTspMatrix), sehingga isi file = isi matriks.
// Tidak memuat catatan internal; bukti hanya dihitung jumlahnya.
import { getAccess } from "@/lib/auth";
import { cctv } from "@/lib/cctv";
import { buildWorkbook, excelFileName, xlsxResponse, type ExcelColumn } from "@/lib/excel";
import { getTspMatrix, parseTspParams, type TspRow } from "@/lib/tsp";
import { MONTHS_SHORT } from "@/lib/tsp-rules";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";

export async function GET(request: Request) {
  const access = await getAccess();
  if (!access) return new Response("Sesi berakhir. Masuk lagi.", { status: 401 });
  if (!access.functions.some((f) => f !== "karyawan") && access.role !== "admin" && !access.platformAdmin) {
    return new Response("Anda tidak punya akses ke data TSP.", { status: 403 });
  }
  const url = new URL(request.url);
  const sp = Object.fromEntries([...url.searchParams.keys()].map((k) => [k, url.searchParams.getAll(k)]));
  const site = url.searchParams.get("site");
  const p = parseTspParams(sp, site && isUuid(site) ? site : null);

  const supabase = await createClient();
  let rows: TspRow[];
  try {
    rows = await getTspMatrix(supabase, p);
  } catch (e) {
    console.error("[ekspor tsp]", e);
    return new Response("Gagal mengambil data.", { status: 500 });
  }
  if (rows.length === 0) return new Response(null, { status: 204 });

  const columns: ExcelColumn<TspRow>[] = [
    { header: "No", value: (r) => r.no },
    { header: "Elemen", value: (r) => r.element },
    { header: "Program", value: (r) => r.name },
    { header: "Penanggung Jawab", value: (r) => r.owner },
    { header: "Indikator", value: (r) => r.indicator },
    { header: "Bukti Wajib", value: (r) => r.evidenceRequired },
    { header: "Target/Tahun", type: "number", value: (r) => r.target },
    ...MONTHS_SHORT.map((m, i): ExcelColumn<TspRow> => ({ header: `${m} (aktual/rencana)`, value: (r) => `${r.actual[i]}/${r.plan[i]}` })),
    { header: "Total Aktual", type: "number", value: (r) => r.totalActual },
    { header: `Capaian s.d. bulan ${p.bulan} (%)`, type: "number", value: (r) => r.pct },
  ];
  const buffer = await buildWorkbook([{ name: `TSP ${p.tahun}`, columns, rows }], {
    title: `Monitoring TSP ${p.tahun}`,
    scope: p.site ? "Satu site" : "Semua site dalam akses",
    filters: `Tahun ${p.tahun}, capaian s.d. bulan ${p.bulan}`,
    exportedBy: { name: access.profile.fullName, email: access.email },
  });
  await cctv({
    category: "export",
    action: "export.excel",
    summary: `Mengunduh Excel TSP ${p.tahun} (${rows.length} program)`,
    entity: "tsp_programs",
    metadata: { baris: rows.length, tahun: p.tahun },
  });
  return xlsxResponse(buffer, excelFileName("TSP", String(p.tahun)));
}
