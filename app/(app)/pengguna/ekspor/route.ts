// Unduh Excel daftar akses: loader yang SAMA dengan tabel (`all: true`). mode=semua mengabaikan filter.
import { getAccess } from "@/lib/auth";
import { cctv } from "@/lib/cctv";
import { getCompanies } from "@/lib/companies";
import { buildWorkbook, excelFileName, xlsxResponse } from "@/lib/excel";
import { getDirectoryMasters, listPengguna, parsePenggunaParams, penggunaFilterText, PENGGUNA_EXPORT_COLUMNS, TooManyRowsError } from "@/lib/pengguna";
import { roleAtLeast } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const access = await getAccess();
  if (!access) return new Response("Sesi berakhir. Masuk lagi.", { status: 401 });
  if (!roleAtLeast(access.role, "admin")) return new Response("Anda tidak punya izin untuk aksi ini.", { status: 403 });

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") === "semua" ? "semua" : "filter";
  const sp = mode === "semua" ? {} : Object.fromEntries([...url.searchParams.keys()].map((k) => [k, url.searchParams.getAll(k)]));
  const supabase = await createClient();
  const [companies, masters] = await Promise.all([getCompanies(), getDirectoryMasters(supabase)]);
  const f = parsePenggunaParams(sp, {
    companies: companies.map((c) => c.code),
    departments: masters.departments.map((d) => d.value),
    locations: masters.locations.map((l) => l.value),
  });

  let rows;
  try {
    rows = (await listPengguna(supabase, f, { all: true })).rows;
  } catch (e) {
    if (e instanceof TooManyRowsError) return new Response(e.message, { status: 413 });
    console.error("[ekspor pengguna]", e);
    return new Response("Gagal mengambil data.", { status: 500 });
  }
  if (rows.length === 0) return new Response(null, { status: 204 });

  const filters = mode === "semua" ? "Semua data (tanpa filter)" : penggunaFilterText(f, masters);
  const buffer = await buildWorkbook([{ name: "Pengguna & Peran", columns: PENGGUNA_EXPORT_COLUMNS, rows }], {
    title: "Daftar Pengguna & Peran",
    scope: "Semua perusahaan",
    filters,
    exportedBy: { name: access.profile.fullName, email: access.email },
  });

  await cctv({
    category: "export",
    action: "export.excel",
    summary: `Mengunduh Excel Pengguna & Peran (${rows.length} baris)`,
    entity: "app_access",
    metadata: { baris: rows.length, mode, filter: filters },
  });
  return xlsxResponse(buffer, excelFileName("Pengguna-Akses", f.companies.length === 1 ? f.companies[0] : null));
}
