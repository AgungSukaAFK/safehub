// Unduh Excel list Temuan: loader yang SAMA dengan tabel (`all: true`), sehingga isi file = isi tabel.
// mode=semua mengabaikan filter. Kolom data terbatas tidak ada di modul ini.
import { getAccess } from "@/lib/auth";
import { cctv } from "@/lib/cctv";
import { excelFileName, buildWorkbook, xlsxResponse } from "@/lib/excel";
import { getAreas, getK3Masters, getK3People } from "@/lib/k3";
import { parseSiteParam } from "@/lib/sites";
import { createClient } from "@/lib/supabase/server";
import { listTemuan, parseTemuanParams, TEMUAN_EXPORT_COLUMNS, temuanFilterText, TooManyRowsError } from "@/lib/temuan";

export async function GET(request: Request) {
  const access = await getAccess();
  if (!access) return new Response("Sesi berakhir. Masuk lagi.", { status: 401 });

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") === "semua" ? "semua" : "filter";
  const sp = mode === "semua" ? { site: "semua" } : Object.fromEntries([...url.searchParams.keys()].map((k) => [k, url.searchParams.getAll(k)]));
  const { siteId, label: siteLabel } = await parseSiteParam(sp, access);
  const f = parseTemuanParams(sp, siteId);

  const supabase = await createClient();
  const [areas, masters, people] = await Promise.all([getAreas(supabase), getK3Masters(supabase), getK3People(supabase)]);
  let rows;
  try {
    rows = (await listTemuan(supabase, f, access.userId, areas, { all: true })).rows;
  } catch (e) {
    if (e instanceof TooManyRowsError) return new Response(e.message, { status: 413 });
    console.error("[ekspor temuan]", e);
    return new Response("Gagal mengambil data.", { status: 500 });
  }
  if (rows.length === 0) return new Response(null, { status: 204 });

  const opts = {
    categories: masters.findingCategories.map((c) => ({ value: c.value, label: c.label })),
    risks: masters.riskLevels.map((c) => ({ value: c.value, label: c.label })),
    areas: areas.map((a) => ({ value: a.value, label: a.label })),
    people: people.map((p) => ({ value: p.value, label: p.label })),
  };
  const filters = mode === "semua" ? "Semua data (tanpa filter)" : temuanFilterText(f, opts, siteLabel);
  const buffer = await buildWorkbook([{ name: "Temuan", columns: TEMUAN_EXPORT_COLUMNS, rows }], {
    title: "Daftar Temuan & PICA",
    scope: mode === "semua" ? "Semua site dalam akses Anda" : siteLabel,
    filters,
    exportedBy: { name: access.profile.fullName, email: access.email },
  });
  await cctv({
    category: "export",
    action: "export.excel",
    summary: `Mengunduh Excel Temuan (${rows.length} baris)`,
    entity: "findings",
    metadata: { baris: rows.length, mode, filter: filters },
  });
  return xlsxResponse(buffer, excelFileName("Temuan", null));
}
