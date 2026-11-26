// Pembaca workbook "Monitoring APD GMI 2026.xlsx" (HANYA server). Hasil = payload RPC apd_import_legacy (spesifikasi fase 6, U4/P10).
// Memuat: master barang, stok awal (SO sheet Update Stock), IN, OUT, MTR MR → pengajuan data lama. TIDAK memuat Populasi Manpower (U2).
// Aturan pembersihan P10: nama di-trim, "A dan B" (qty genap) dipecah, "Dwi Catur" → "Dwi Catur Guntoro", site huruf besar,
// OUT tanpa tanggal = tanggal baris sebelumnya, IN tanpa tanggal = tanggal OUT pertama barang itu; keduanya diberi catatan.
import "server-only";
import ExcelJS from "exceljs";

export const APD_IMPORT_MAX_BYTES = 1.5 * 1024 * 1024; // < serverActions.bodySizeLimit (2 MB)
export const APD_OPENING_DATE = "2026-10-01"; // P10: tanggal SO tidak tercatat di Excel
const NO_DATE_NOTE = "tanggal tidak tercatat di Excel";

export type ApdImportPayload = {
  opening_date: string;
  items: { code: string; name: string; type: string; brand: string | null; size: string | null; uom: string }[];
  opening: { code: string; qty: number }[];
  ins: { code: string; qty: number; date: string; ref: string | null; pic: string | null; note: string | null }[];
  outs: { code: string; qty: number; date: string; bast: string | null; pic: string | null; site: string; name: string; note: string | null }[];
  requests: { site: string; name: string; mr: string | null; date: string | null; rows: number[]; lines: { code: string; qty: number; supplied: number; note: string | null }[] }[];
};
export type ApdImportSummary = { items: number; opening: number; openingUnits: number; ins: number; inUnits: number; outs: number; outUnits: number; requests: number; mrRows: number; sites: string[]; notes: string[] };

type Cell = ExcelJS.Cell | undefined;
const val = (c: Cell): unknown => {
  const v = c?.value;
  if (v && typeof v === "object" && !(v instanceof Date)) {
    if ("result" in v) return v.result;
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("text" in v) return v.text;
    if ("error" in v) return null;
  }
  return v ?? null;
};
const str = (c: Cell): string | null => {
  const v = val(c);
  if (v == null) return null;
  const s = String(v).replace(/\s+/g, " ").trim();
  return s === "" ? null : s;
};
const num = (c: Cell): number | null => {
  const v = val(c);
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const day = (c: Cell): string | null => {
  const v = val(c);
  return v instanceof Date ? v.toISOString().slice(0, 10) : null; // tanggal Excel = UTC tengah malam
};

const NAME_FIX: Record<string, string> = { "dwi catur": "Dwi Catur Guntoro" };
const cleanName = (s: string) => {
  const t = s.replace(/\s+/g, " ").trim();
  return NAME_FIX[t.toLowerCase()] ?? t;
};
const siteKey = (s: string | null) => (s ? s.trim().toUpperCase() : null);

/** Jenis APD per prefix kode barang (P2). */
function typeOf(code: string): string {
  if (code.startsWith("SS-")) return "safety_shoes";
  if (code.startsWith("KM-")) return "uniform_shirt";
  if (code.startsWith("KS-")) return "uniform_tshirt";
  if (code.startsWith("SG-")) return "safety_glass";
  if (code.startsWith("RMP-")) return "safety_vest";
  if (code.startsWith("GSRT-")) return "glove_hanger";
  if (code.startsWith("SRT-")) return "safety_glove";
  if (code.startsWith("MSK-")) return "mask_carbon";
  if (code.startsWith("PDL-")) return "padlock";
  if (code === "EPL-02") return "earmuff";
  if (code.startsWith("EPL-")) return "earplug";
  if (code.startsWith("HLM-")) return "safety_helmet";
  throw new Error(`Jenis APD untuk kode ${code} belum dikenal (prefix baru di Master Barang APD).`);
}
const COLOR: Record<string, string> = { yellow: "Kuning", blue: "Biru", orange: "Oranye", white: "Putih", red: "Merah", neon: "Neon", clear: "Clear" };
function sizeOf(name: string): string | null {
  const uk = name.match(/\bUk\s+([0-9A-Z]+)\b/i);
  if (uk) return uk[1].toUpperCase();
  const c = Object.keys(COLOR).find((k) => new RegExp(`\\b${k}\\b`, "i").test(name));
  return c ? COLOR[c] : null;
}
const uomOf = (type: string) => (type === "safety_shoes" || type === "earplug" ? "Pasang" : "Pcs");

export async function parseApdWorkbook(buffer: ArrayBuffer): Promise<{ payload: ApdImportPayload; summary: ApdImportSummary }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheet = (name: string) => {
    const ws = wb.worksheets.find((w) => w.name.trim().toLowerCase() === name.toLowerCase());
    if (!ws) throw new Error(`Sheet "${name}" tidak ditemukan. Gunakan file Monitoring APD dengan sheet Master Barang APD, Update Stock, IN, OUT, dan MTR MR.`);
    return ws;
  };
  const rows = (ws: ExcelJS.Worksheet, from: number) => {
    const out: { n: number; row: ExcelJS.Row }[] = [];
    for (let r = from; r <= ws.rowCount; r++) out.push({ n: r, row: ws.getRow(r) });
    return out;
  };
  const notes: string[] = [];

  const items: ApdImportPayload["items"] = [];
  for (const { row } of rows(sheet("Master Barang APD"), 3)) {
    const code = str(row.getCell(2));
    if (!code) continue;
    const name = str(row.getCell(3)) ?? code;
    const type = typeOf(code);
    items.push({ code, name, brand: str(row.getCell(4)), type, size: sizeOf(name), uom: uomOf(type) });
  }
  const codes = new Set(items.map((i) => i.code));
  const need = (code: string, where: string) => {
    if (!codes.has(code)) throw new Error(`${where}: kode ${code} tidak ada di Master Barang APD.`);
  };

  const opening: ApdImportPayload["opening"] = [];
  for (const { row } of rows(sheet("Update Stock"), 3)) {
    const code = str(row.getCell(3));
    const so = num(row.getCell(6));
    if (code && so && so > 0) {
      need(code, "Update Stock");
      opening.push({ code, qty: so });
    }
  }

  const outs: ApdImportPayload["outs"] = [];
  let prev: string | null = null;
  for (const { n, row } of rows(sheet("OUT"), 3)) {
    const code = str(row.getCell(4));
    if (!code) continue;
    need(code, `OUT baris ${n}`);
    let date = day(row.getCell(2));
    const ns = [str(row.getCell(11))];
    if (!date) {
      if (!prev) throw new Error(`OUT baris ${n}: tanggal kosong dan tidak ada baris sebelumnya.`);
      date = prev;
      ns.push(NO_DATE_NOTE);
      notes.push(`OUT baris ${n}: tanggal kosong, diisi ${date}.`);
    }
    prev = date;
    const qty = num(row.getCell(6)) ?? 0;
    const site = siteKey(str(row.getCell(9)));
    if (!site) throw new Error(`OUT baris ${n}: site kosong.`);
    const raw = str(row.getCell(10)) ?? "Tanpa nama";
    const names = raw.split(/\s+dan\s+/i).map(cleanName);
    const base = { date, bast: str(row.getCell(3)), code, pic: str(row.getCell(8)), site };
    if (names.length > 1 && qty % names.length === 0) {
      notes.push(`OUT baris ${n}: "${raw}" dipecah per orang.`);
      for (const nm of names) outs.push({ ...base, qty: qty / names.length, name: nm, note: [...ns, `dipecah dari "${raw}"`].filter(Boolean).join("; ") });
    } else {
      outs.push({ ...base, qty, name: names.join(" dan "), note: ns.filter(Boolean).join("; ") || null });
    }
  }

  const ins: ApdImportPayload["ins"] = [];
  prev = null;
  for (const { n, row } of rows(sheet("IN"), 3)) {
    const code = str(row.getCell(4));
    if (!code) continue;
    need(code, `IN baris ${n}`);
    let date = day(row.getCell(2));
    const ns = [str(row.getCell(9))];
    if (!date) {
      date = outs.filter((o) => o.code === code).map((o) => o.date).sort()[0] ?? prev;
      if (!date) throw new Error(`IN baris ${n}: tanggal kosong dan tidak bisa diturunkan.`);
      ns.push(NO_DATE_NOTE);
      notes.push(`IN baris ${n} (${code}): tanggal kosong, diisi ${date}.`);
    }
    prev = date;
    ins.push({ date, ref: str(row.getCell(3)), code, qty: num(row.getCell(6)) ?? 0, pic: str(row.getCell(8)), note: ns.filter(Boolean).join("; ") || null });
  }

  const groups = new Map<string, ApdImportPayload["requests"][number]>();
  let mrRows = 0;
  for (const { n, row } of rows(sheet("MTR MR"), 5)) {
    const code = str(row.getCell(4));
    if (!code) continue;
    need(code, `MTR MR baris ${n}`);
    mrRows++;
    const site = siteKey(str(row.getCell(9)));
    if (!site) throw new Error(`MTR MR baris ${n}: site kosong.`);
    const name = cleanName(str(row.getCell(10)) ?? "Tanpa nama");
    const mr = str(row.getCell(3));
    const key = `${site}|${name.toLowerCase()}|${mr ?? ""}`;
    if (!groups.has(key)) groups.set(key, { site, name, mr, date: day(row.getCell(2)), lines: [], rows: [] });
    const g = groups.get(key)!;
    const qty = num(row.getCell(6)) ?? 0;
    const sup = Math.min(num(row.getCell(12)) ?? 0, qty);
    const same = g.lines.find((l) => l.code === code);
    if (same) {
      same.qty += qty;
      same.supplied += sup;
    } else g.lines.push({ code, qty, supplied: sup, note: str(row.getCell(16)) });
    g.rows.push(n);
  }
  const requests = [...groups.values()];
  const undated = requests.filter((r) => !r.date).length;
  if (undated) notes.push(`${undated} pengajuan dari MR tanpa tanggal: lead time "tidak tercatat".`);

  const sum = <T,>(a: T[], f: (x: T) => number) => a.reduce((s, x) => s + f(x), 0);
  const sites = [...new Set(["HO", ...outs.map((o) => o.site), ...requests.map((r) => r.site)])].sort();
  return {
    payload: { opening_date: APD_OPENING_DATE, items, opening, ins, outs, requests },
    summary: {
      items: items.length,
      opening: opening.length,
      openingUnits: sum(opening, (o) => o.qty),
      ins: ins.length,
      inUnits: sum(ins, (i) => i.qty),
      outs: outs.length,
      outUnits: sum(outs, (o) => o.qty),
      requests: requests.length,
      mrRows,
      sites,
      notes,
    },
  };
}

// ---------------------------------------------------------------- sheet Populasi Manpower (fase 6 bagian C, P16-P19)
export type ApdPopulationPayload = {
  people: { name: string; site: string; job_title: string; sizes: Record<string, string>; issues: { type: string; date: string; qty: number | null; size: string | null }[] }[];
};
export type ApdPopulationSummary = { people: number; bySite: Record<string, number>; sizes: number; issues: number; sites: string[]; notes: string[] };

/** Kolom sheet Populasi (baris header 5, data mulai baris 6): grup APD → jenis APD sistem (P17). */
const POP_COLUMNS: { type: string; size?: number; qty?: number; supply: number; label: string }[] = [
  { type: "uniform_shirt", size: 5, qty: 6, supply: 7, label: "Kemeja Safety" },
  { type: "uniform_tshirt", size: 11, qty: 12, supply: 13, label: "Kaos Safety" },
  { type: "safety_shoes", size: 17, supply: 18, label: "Sepatu" },
  { type: "safety_helmet", size: 22, supply: 23, label: "Helm" },
  { type: "uniform_pants", size: 27, qty: 28, supply: 29, label: "Jeans" },
  { type: "safety_glass", supply: 33, label: "Kacamata" },
  { type: "mask_carbon", supply: 34, label: "Safety Mask" },
  { type: "earplug", supply: 35, label: "Earplug" },
  { type: "earmuff", supply: 36, label: "Ear Muff" },
  { type: "padlock", supply: 37, label: "Padlock" },
  { type: "safety_glove", supply: 38, label: "Safety Gloves" },
  { type: "safety_vest", size: 39, supply: 40, label: "Vest" },
  { type: "face_shield", qty: 41, supply: 42, label: "Kedok Las" },
  { type: "uniform_pants", size: 43, qty: 44, supply: 45, label: "Seragam Jeans" },
  { type: "uniform_shirt", size: 46, qty: 47, supply: 48, label: "Seragam Two Tone" },
  { type: "uniform_tshirt", size: 49, qty: 50, supply: 51, label: "Kaos Polo" },
];
/** "KUNING" → "Kuning", "PRODUKSI" → "Produksi"; teks campuran dibiarkan. */
const tidyCase = (s: string) =>
  s === s.toUpperCase() && /[A-Z]{4}/.test(s)
    ? s.replace(/\p{L}+/gu, (w) => (w.length <= 3 ? w : w[0] + w.slice(1).toLowerCase())) // singkatan <= 3 huruf (PJO, GL, WHS) tetap
    : s;
const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, mei: 4, jun: 5, jul: 6, aug: 7, agu: 7, agt: 7, sep: 8, oct: 9, okt: 9, nov: 10, dec: 11, des: 11 };
/** "23 December 2025" / "23 Desember 2025" → "2025-12-23" (tanggal yang diketik sebagai teks di Excel). */
function textDate(v: unknown): string | null {
  const m = typeof v === "string" ? v.trim().match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/) : null;
  const mon = m ? MONTHS[m[2].slice(0, 3).toLowerCase()] : undefined;
  return m && mon !== undefined ? new Date(Date.UTC(Number(m[3]), mon, Number(m[1]))).toISOString().slice(0, 10) : null;
}
/** "2+1" → 3, angka → angka, lainnya null. */
const qtyOf = (c: Cell): number | null => {
  const v = val(c);
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v) : null;
  if (typeof v === "string" && /^\s*\d+(\s*\+\s*\d+)*\s*$/.test(v)) return v.split("+").reduce((s, x) => s + Number(x), 0);
  return null;
};

export async function parseApdPopulation(buffer: ArrayBuffer): Promise<{ payload: ApdPopulationPayload; summary: ApdPopulationSummary }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets.find((w) => w.name.trim().toLowerCase() === "populasi manpower");
  if (!ws) throw new Error('Sheet "Populasi Manpower" tidak ditemukan di file ini.');
  const notes: string[] = [];
  const people: ApdPopulationPayload["people"] = [];
  const seen = new Set<string>();
  for (let r = 6; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const rawName = str(row.getCell(2));
    if (!rawName) continue;
    const site = siteKey(str(row.getCell(3)));
    if (!site) {
      notes.push(`Baris ${r} (${rawName}): site kosong, dilewati.`);
      continue;
    }
    const name = tidyCase(cleanName(rawName));
    const key = `${site}|${name.toLowerCase()}`;
    if (seen.has(key)) {
      notes.push(`Baris ${r}: ${name} (${site}) muncul dua kali, baris kedua dilewati.`);
      continue;
    }
    seen.add(key);
    const job = str(row.getCell(4));
    if (!job) notes.push(`Baris ${r} (${name}): jabatan kosong → "Belum diisi".`);
    const sizes: Record<string, string> = {};
    const issues: ApdPopulationPayload["people"][number]["issues"] = [];
    for (const col of POP_COLUMNS) {
      const size = col.size ? str(row.getCell(col.size)) : null;
      if (size && !sizes[col.type]) sizes[col.type] = tidyCase(size);
      const sv = val(row.getCell(col.supply));
      const date = sv instanceof Date ? sv.toISOString().slice(0, 10) : textDate(sv);
      if (date) {
        issues.push({ type: col.type, date, qty: col.qty ? qtyOf(row.getCell(col.qty)) : null, size: size ? tidyCase(size) : null });
      } else if (sv != null && String(sv).trim() !== "") {
        notes.push(`Baris ${r} (${name}) ${col.label}: tanggal supply "${String(sv).trim()}" bukan tanggal, dilewati.`);
      }
    }
    people.push({ name, site, job_title: job ? tidyCase(job) : "", sizes, issues });
  }
  if (people.length === 0) throw new Error("Sheet Populasi Manpower tidak berisi karyawan.");
  const bySite: Record<string, number> = {};
  people.forEach((p) => (bySite[p.site] = (bySite[p.site] ?? 0) + 1));
  return {
    payload: { people },
    summary: {
      people: people.length,
      bySite,
      sizes: people.reduce((s, p) => s + Object.keys(p.sizes).length, 0),
      issues: people.reduce((s, p) => s + p.issues.length, 0),
      sites: Object.keys(bySite).sort(),
      notes,
    },
  };
}
