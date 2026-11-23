// Unduh Excel list Kejadian: loader yang SAMA dengan tabel (`all: true`). Data terbatas (cedera, biaya)
// TIDAK ikut diekspor (rancangan §2.7). mode=semua mengabaikan filter (RLS tetap membatasi).
import { getAccess } from "@/lib/auth";
import { cctv } from "@/lib/cctv";
import { buildWorkbook, excelFileName, xlsxResponse } from "@/lib/excel";
import { getAreas, getK3Masters, getK3People } from "@/lib/k3";
import { KEJADIAN_EXPORT_COLUMNS, kejadianFilterText, listKejadian, parseKejadianParams, TooManyRowsError } from "@/lib/kejadian";
import { parseSiteParam } from "@/lib/sites";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const access = await getAccess();
  if (!access) return new Response("Sesi berakhir. Masuk lagi.", { status: 401 });

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") === "semua" ? "semua" : "filter";
  const sp = mode === "semua" ? { site: "semua" } : Object.fromEntries([...url.searchParams.keys()].map((k) => [k, url.searchParams.getAll(k)]));
  const { siteId, label: siteLabel } = await parseSiteParam(sp, access);
  const f = parseKejadianParams(sp, siteId);

  const supabase = await createClient();
  const [areas, masters, people] = await Promise.all([getAreas(supabase), getK3Masters(supabase), getK3People(supabase)]);
  let rows;
  try {
    rows = (await listKejadian(supabase, f, areas, { all: true })).rows;
  } catch (e) {
    if (e instanceof TooManyRowsError) return new Response(e.message, { status: 413 });
    console.error("[ekspor kejadian]", e);
    return new Response("Gagal mengambil data.", { status: 500 });
  }
  if (rows.length === 0) return new Response(null, { status: 204 });

  const filters =
    mode === "semua"
      ? "Semua data (tanpa filter)"
      : kejadianFilterText(
          f,
          {
            categories: masters.incidentCategories.map((c) => ({ value: c.value, label: c.label })),
            areas: areas.map((a) => ({ value: a.value, label: a.label })),
            people: people.map((p) => ({ value: p.value, label: p.label })),
          },
          siteLabel,
        );
  const buffer = await buildWorkbook([{ name: "Kejadian", columns: KEJADIAN_EXPORT_COLUMNS, rows }], {
    title: "Daftar Kejadian & Investigasi",
    scope: mode === "semua" ? "Semua site dalam akses Anda" : siteLabel,
    filters,
    exportedBy: { name: access.profile.fullName, email: access.email },
  });
  await cctv({
    category: "export",
    action: "export.excel",
    summary: `Mengunduh Excel Kejadian (${rows.length} baris)`,
    entity: "incidents",
    metadata: { baris: rows.length, mode, filter: filters },
  });
  return xlsxResponse(buffer, excelFileName("Kejadian", null));
}
