// Parser file impor (HANYA server): .xlsx sheet pertama → header + baris (semua string). Tanggal sel → YYYY-MM-DD.
import "server-only";
import ExcelJS from "exceljs";
import { MAX_IMPORT_ROWS } from "@/lib/import/targets";

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export type ParsedSheet = { sheetName: string; headers: string[]; rows: string[][]; truncated: boolean };

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return new Date(v.getTime()).toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("result" in v) return cellText(v.result as ExcelJS.CellValue);
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("text" in v) return String(v.text ?? "");
    if ("error" in v) return "";
  }
  return String(v).trim();
}

/** Baris pertama yang tidak kosong = header. Baris kosong di bawahnya dilewati. */
export async function parseXlsx(buffer: ArrayBuffer): Promise<ParsedSheet> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("File tidak memuat sheet.");
  const lines: string[][] = [];
  const width = Math.min(ws.columnCount, 60);
  ws.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    for (let c = 1; c <= width; c++) cells.push(cellText(row.getCell(c).value));
    if (cells.some((x) => x !== "")) lines.push(cells);
  });
  if (lines.length === 0) throw new Error("Sheet kosong.");
  const headers = lines[0].map((h, i) => h || `Kolom ${i + 1}`);
  const rows = lines.slice(1);
  return { sheetName: ws.name, headers, rows: rows.slice(0, MAX_IMPORT_ROWS), truncated: rows.length > MAX_IMPORT_ROWS };
}
