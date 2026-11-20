// CONTOH boilerplate. Unduh Excel list Pengajuan: loader yang SAMA dengan tabel (`all: true`),
// sehingga isi file = isi tabel. mode=semua mengabaikan filter.
import { getAccess } from "@/lib/auth";
import { cctv } from "@/lib/cctv";
import { getCompanies, getCompanyScope } from "@/lib/companies";
import { getDirectoryMasters } from "@/lib/masters";
import { buildWorkbook, excelFileName, xlsxResponse } from "@/lib/excel";
import { listPengajuan, parsePengajuanParams, pengajuanFilterText, PENGAJUAN_EXPORT_COLUMNS, TooManyRowsError } from "@/lib/pengajuan";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const access = await getAccess();
  if (!access) return new Response("Sesi berakhir. Masuk lagi.", { status: 401 });

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") === "semua" ? "semua" : "filter";
  const sp = mode === "semua" ? {} : Object.fromEntries([...url.searchParams.keys()].map((k) => [k, url.searchParams.getAll(k)]));
  const companies = await getCompanies();
  const f = parsePengajuanParams(sp, companies.map((c) => c.code));

  const supabase = await createClient();
  let rows;
  try {
    rows = (await listPengajuan(supabase, f, { all: true })).rows;
  } catch (e) {
    if (e instanceof TooManyRowsError) return new Response(e.message, { status: 413 });
    console.error("[ekspor pengajuan]", e);
    return new Response("Gagal mengambil data.", { status: 500 });
  }
  if (rows.length === 0) return new Response(null, { status: 204 });

  const scope = await getCompanyScope({ company: access.profile.company, platformAdmin: access.platformAdmin });
  const scopeText = scope === "ALL" ? "Semua perusahaan" : scope.join(", ");
  const { departments } = await getDirectoryMasters(supabase);
  const filters = mode === "semua" ? "Semua data (tanpa filter)" : pengajuanFilterText(f, departments);
  const buffer = await buildWorkbook([{ name: "Pengajuan", columns: PENGAJUAN_EXPORT_COLUMNS, rows }], {
    title: "Daftar Pengajuan",
    scope: scopeText,
    filters,
    exportedBy: { name: access.profile.fullName, email: access.email },
  });

  await cctv({
    category: "export",
    action: "export.excel",
    summary: `Mengunduh Excel Pengajuan (${rows.length} baris)`,
    entity: "pengajuan",
    metadata: { baris: rows.length, mode, filter: filters },
  });
  const companyPart = f.companies.length === 1 ? f.companies[0] : scope !== "ALL" && scope.length === 1 ? scope[0] : null;
  return xlsxResponse(buffer, excelFileName("Pengajuan", companyPart));
}
