// Template Excel per target impor: header = nama kolom aplikasi + satu baris contoh + sheet Keterangan.
import { getAccess } from "@/lib/auth";
import { buildWorkbook, excelFileName, xlsxResponse, type ExcelColumn } from "@/lib/excel";
import { IMPORT_TARGETS, type ImportTargetId } from "@/lib/import/targets";

export async function GET(request: Request) {
  const access = await getAccess();
  if (!access) return new Response("Sesi berakhir. Masuk lagi.", { status: 401 });
  const isAdmin = access.role === "admin" || access.platformAdmin;
  if (!isAdmin && !access.functions.includes("hr") && !access.functions.includes("hse")) return new Response("Anda tidak punya akses impor data.", { status: 403 });
  const target = IMPORT_TARGETS[new URL(request.url).searchParams.get("target") as ImportTargetId];
  if (!target) return new Response("Target tidak dikenal.", { status: 400 });

  type Row = Record<string, string>;
  const columns: ExcelColumn<Row>[] = target.columns.map((c) => ({ header: c.label, value: (r) => r[c.key] }));
  const example: Row = Object.fromEntries(target.columns.map((c) => [c.key, c.example]));
  const notes: Row[] = target.columns.map((c) => ({ kolom: c.label, wajib: c.required ? "Ya" : "Tidak", petunjuk: c.hint ?? "", contoh: c.example }));
  const buf = await buildWorkbook(
    [
      { name: "Data", columns, rows: [example] },
      {
        name: "Petunjuk Kolom",
        columns: [
          { header: "Kolom", value: (r: Row) => r.kolom },
          { header: "Wajib", value: (r: Row) => r.wajib },
          { header: "Petunjuk", value: (r: Row) => r.petunjuk },
          { header: "Contoh", value: (r: Row) => r.contoh },
        ],
        rows: notes,
      },
    ],
    { title: `Template impor ${target.label}`, scope: "-", filters: "Hapus baris contoh sebelum mengunggah", exportedBy: { name: access.profile.fullName, email: access.email } },
  );
  return xlsxResponse(buf, excelFileName("Template_Impor", target.id));
}
