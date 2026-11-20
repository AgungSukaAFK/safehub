// Ekspor Excel standar (frontend-guide §18.3). HANYA server (exceljs berat). Pakai dari route
// handler `app/(app)/<fitur>/ekspor/route.ts` dengan loader yang sama seperti tabel.
import "server-only";
import ExcelJS from "exceljs";
import { APP_NAME } from "@/lib/app-config";
import { formatDateTime } from "@/lib/format";

export type ExcelColumn<Row> = {
  header: string;
  /** text (default) | money (#,##0) | number | date | datetime (WIB, nilai tanggal Excel asli) */
  type?: "text" | "money" | "number" | "date" | "datetime";
  value: (row: Row) => string | number | null | undefined;
};

export type ExcelSheet<Row> = { name: string; columns: ExcelColumn<Row>[]; rows: Row[] };

export type ExcelInfo = {
  title: string;
  /** perusahaan dalam scope, mis. "Semua perusahaan" / "GMI" */
  scope: string;
  filters: string;
  exportedBy: { name: string; email: string };
};

const NAVY = "FF1E3A5F";
const BORDER = { style: "thin" as const, color: { argb: "FFD1D5DB" } };
const ZEBRA = "FFF3F4F6";
const WIB_MS = 7 * 3_600_000;

/** Nama sheet aman: maks 31 karakter, tanpa : \ / ? * [ ] */
export const sheetName = (s: string) => s.replace(/[:\\/?*[\]]/g, "-").slice(0, 31) || "Data";

/** Excel tidak kenal zona waktu: geser ke jam dinding WIB (exceljs menulis Date sebagai UTC). */
function toExcelDate(v: string | number | null | undefined, dateOnly: boolean): Date | null {
  if (v === null || v === undefined || v === "") return null;
  if (dateOnly && typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(`${v}T00:00:00Z`);
  const ms = new Date(v).getTime();
  return Number.isFinite(ms) ? new Date(ms + WIB_MS) : null;
}

function addSheet<Row>(wb: ExcelJS.Workbook, sheet: ExcelSheet<Row>) {
  const ws = wb.addWorksheet(sheetName(sheet.name), { views: [{ state: "frozen", ySplit: 1 }] });
  const widths = sheet.columns.map((c) => c.header.length);
  ws.addRow(sheet.columns.map((c) => c.header));

  sheet.rows.forEach((row) => {
    const values = sheet.columns.map((c, i) => {
      const raw = c.value(row);
      let v: string | number | Date | null;
      if (c.type === "date" || c.type === "datetime") v = toExcelDate(raw, c.type === "date");
      else if (c.type === "money" || c.type === "number") v = raw === null || raw === undefined || raw === "" ? null : Number(raw);
      else v = raw === null || raw === undefined ? "" : String(raw);
      const len = v instanceof Date ? (c.type === "datetime" ? 17 : 11) : String(v ?? "").length;
      widths[i] = Math.max(widths[i], len);
      return v;
    });
    ws.addRow(values);
  });

  sheet.columns.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    col.width = Math.min(45, Math.max(10, widths[i] + 2));
    if (c.type === "money") col.numFmt = "#,##0";
    if (c.type === "number") col.numFmt = "#,##0.###";
    if (c.type === "date") col.numFmt = "dd mmm yyyy";
    if (c.type === "datetime") col.numFmt = "dd mmm yyyy hh:mm";
    if (c.type === "money" || c.type === "number") col.alignment = { horizontal: "right" };
  });

  ws.eachRow((r, n) => {
    r.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
      if (n > 1 && n % 2 === 0) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
    });
  });
  const head = ws.getRow(1);
  head.height = 22;
  head.eachCell((cell) => {
    cell.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
  if (sheet.columns.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columns.length } };
}

/** Workbook berisi sheet data + sheet "Keterangan" (audit). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function buildWorkbook(sheets: ExcelSheet<any>[], info: ExcelInfo): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = APP_NAME;
  wb.created = new Date();
  sheets.forEach((s) => addSheet(wb, s));
  addSheet(wb, {
    name: "Keterangan",
    columns: [
      { header: "Keterangan", value: (r: [string, string]) => r[0] },
      { header: "Nilai", value: (r: [string, string]) => r[1] },
    ],
    rows: [
      ["Aplikasi", APP_NAME],
      ["Data", info.title],
      ["Perusahaan", info.scope],
      ["Filter", info.filters],
      ...sheets.map((s): [string, string] => [`Jumlah baris (${s.name})`, String(s.rows.length)]),
      ["Diekspor oleh", `${info.exportedBy.name} (${info.exportedBy.email})`],
      ["Waktu ekspor", `${formatDateTime(new Date())} WIB`],
    ],
  });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Respons unduhan .xlsx dengan nama file UTF-8. */
export function xlsxResponse(buffer: Buffer, filename: string) {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}

/** `Pengajuan_GMI_2026-11-18.xlsx` (tanggal WIB) */
export function excelFileName(...parts: (string | null | undefined)[]) {
  const today = new Date(Date.now() + WIB_MS).toISOString().slice(0, 10);
  return `${[...parts.filter(Boolean), today].join("_").replace(/[\\/:*?"<>|\s]+/g, "-")}.xlsx`;
}
