"use client";

// Dokumen cetak A4 generik (frontend-guide §19.2, port PaginatedPrintDocument). Baris tabel diukur
// di kontainer tersembunyi lalu dipecah per halaman → "Halaman X dari Y" akurat. Semua ukuran
// memakai px (bukan rem) supaya preferensi ukuran font user tidak mengubah hasil ukur.
// Render: <div className="print-only"> di halaman detail; tampil hanya saat cetak.

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { Company } from "@/lib/company-types";
import { cn } from "@/lib/utils";

export type PrintColumn<Row> = { label: string; className?: string; cell: (row: Row, index: number) => ReactNode };
export type PrintSignature = {
  role: string;
  name: string;
  caption?: string | null;
  /** waktu (sudah diformat) tanda tangan digital; null = belum */
  signedAt?: string | null;
  /** default "Disetujui" → "Disetujui secara digital, <waktu>" */
  signedVerb?: string;
};
/** qr = tanda tangan digital + QR · basah = ruang tanda tangan kosong · preview = watermark PRATINJAU */
export type PrintMode = "qr" | "basah" | "preview";

type Props<Row> = {
  company: Company | null;
  title: string;
  code: string;
  date: string;
  /** blok info di halaman pertama (pemohon, departemen, …) */
  meta: ReactNode;
  columns: PrintColumn<Row>[];
  rows: Row[];
  /** ringkasan total di halaman terakhir */
  summary?: ReactNode;
  signatures: PrintSignature[];
  mode: PrintMode;
  /** isi QR (default: URL detail dokumen) */
  qrValue: string;
  qrCaption: string;
  printedBy: string;
  printedAt: string;
};

const PAGE_H = "266mm"; // A4 297mm − margin 2×15mm, sisakan 1mm supaya tidak meluber ke halaman kosong

function Kop({ company, title, code, date }: { company: Company | null; title: string; code: string; date: string }) {
  return (
    <div className="mb-[10px]">
      <div className="flex items-center gap-[12px] border-b-[3px] border-black pb-[8px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={company?.logoUrl ?? "/lourdes-logo.webp"} alt="" className="h-[44px] w-auto object-contain" />
        <div className="min-w-0 leading-tight">
          <p className="text-[15px] font-bold">{company?.name ?? "-"}</p>
          {company?.address && <p className="text-[10px]">{company.address}</p>}
          <p className="text-[10px]">{[company?.phone && `Telp. ${company.phone}`, company?.email].filter(Boolean).join(" · ")}</p>
        </div>
      </div>
      <div className="mt-[8px] flex items-end justify-between">
        <p className="text-[14px] font-bold tracking-wide uppercase">{title}</p>
        <div className="text-right text-[11px] leading-tight">
          <p className="font-mono font-semibold">{code}</p>
          <p>{date}</p>
        </div>
      </div>
    </div>
  );
}

function Head<Row>({ columns }: { columns: PrintColumn<Row>[] }) {
  return (
    <thead>
      <tr>
        {columns.map((c) => (
          <th key={c.label} className={cn("border border-black bg-neutral-100 px-[5px] py-[4px] text-left text-[10px] font-semibold", c.className)}>
            {c.label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function BodyRow<Row>({ columns, row, index }: { columns: PrintColumn<Row>[]; row: Row; index: number }) {
  return (
    <tr>
      {columns.map((c) => (
        <td key={c.label} className={cn("border border-black px-[5px] py-[3px] align-top text-[10px]", c.className)}>
          {c.cell(row, index)}
        </td>
      ))}
    </tr>
  );
}

function Tail({ summary, signatures, mode, qrValue, qrCaption }: Pick<Props<unknown>, "summary" | "signatures" | "mode" | "qrValue" | "qrCaption">) {
  return (
    <div className="mt-[10px] space-y-[12px]">
      {summary}
      <div className="grid gap-[8px]" style={{ gridTemplateColumns: `repeat(${Math.max(signatures.length, 1)}, minmax(0, 1fr))` }}>
        {signatures.map((s) => (
          <div key={s.role + s.name} className="flex flex-col items-center text-center text-[10px]">
            <p className="font-semibold">{s.role}</p>
            <div className="flex h-[70px] items-center justify-center">
              {mode === "qr" && s.signedAt ? <QRCodeSVG value={qrValue} size={56} level="M" /> : null}
            </div>
            <p className="w-full border-t border-black pt-[2px] font-semibold">{s.name}</p>
            {s.caption && <p>{s.caption}</p>}
            {mode === "qr" && s.signedAt && <p className="text-[9px] italic">{s.signedVerb ?? "Disetujui"} secara digital, {s.signedAt}</p>}
          </div>
        ))}
      </div>
      {mode === "qr" && <p className="text-center text-[9px] text-neutral-600">{qrCaption}</p>}
    </div>
  );
}

function Footer({ printedBy, printedAt, page, pages }: { printedBy: string; printedAt: string; page: number; pages: number }) {
  return (
    <div className="mt-auto flex justify-between border-t border-neutral-400 pt-[4px] text-[9px] text-neutral-600">
      <span>
        Dicetak oleh {printedBy} · {printedAt}
      </span>
      <span>
        Halaman {page} dari {pages}
      </span>
    </div>
  );
}

export function PrintableDocument<Row>(props: Props<Row>) {
  const { company, title, code, date, meta, columns, rows, mode } = props;
  const measureRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<number[][]>([rows.map((_, i) => i)]);

  useLayoutEffect(() => {
    const root = measureRef.current;
    if (!root) return;
    const h = (sel: string) => root.querySelector<HTMLElement>(sel)?.getBoundingClientRect().height ?? 0;
    const pageH = h("[data-m=page]");
    const first = h("[data-m=first]");
    const other = h("[data-m=other]");
    const thead = h("[data-m=table] thead");
    const tail = h("[data-m=tail]");
    const footer = h("[data-m=footer]");
    const rowHs = Array.from(root.querySelectorAll<HTMLElement>("[data-m=table] tbody tr")).map((r) => r.getBoundingClientRect().height);

    // flow-root di kontainer ukur mencegah margin anak "bocor" (margin collapse) dari hasil ukur;
    // SLACK menyerap pembulatan sub-pixel antar baris
    const SLACK = 6;
    const out: number[][] = [];
    let cur: number[] = [];
    let avail = pageH - footer - first - thead - SLACK;
    rowHs.forEach((rh, i) => {
      if (rh > avail && cur.length) {
        out.push(cur);
        cur = [];
        avail = pageH - footer - other - thead - SLACK;
      }
      cur.push(i);
      avail -= rh;
    });
    if (tail > avail && cur.length) {
      out.push(cur);
      cur = [];
    }
    out.push(cur);
    const raf = requestAnimationFrame(() => setPages(out));
    return () => cancelAnimationFrame(raf);
  }, [rows, columns, props.summary, props.signatures, mode, meta]);

  const tailProps = { summary: props.summary, signatures: props.signatures, mode, qrValue: props.qrValue, qrCaption: props.qrCaption };

  return (
    <>
      {/* kontainer ukur: lebar isi A4, tidak terlihat, tidak ikut tercetak */}
      <div ref={measureRef} aria-hidden className="printable-document no-print pointer-events-none fixed top-0 left-[-10000px] w-[180mm] bg-white text-black invisible">
        <div data-m="page" style={{ height: PAGE_H }} />
        <div data-m="first" className="flow-root">
          <Kop company={company} title={title} code={code} date={date} />
          <div className="mb-[8px]">{meta}</div>
        </div>
        <div data-m="other" className="flow-root">
          <Kop company={company} title={title} code={code} date={date} />
        </div>
        <table data-m="table" className="w-full border-collapse">
          <Head columns={columns} />
          <tbody>
            {rows.map((r, i) => (
              <BodyRow key={i} columns={columns} row={r} index={i} />
            ))}
          </tbody>
        </table>
        <div data-m="tail" className="flow-root">
          <Tail {...tailProps} />
        </div>
        <div data-m="footer" className="flow-root">
          <Footer printedBy={props.printedBy} printedAt={props.printedAt} page={1} pages={1} />
        </div>
      </div>

      <div className="printable-document print-only bg-white text-black">
        {pages.map((idx, p) => {
          const last = p === pages.length - 1;
          return (
            <section key={p} className="relative flex flex-col overflow-hidden" style={{ height: PAGE_H, breakAfter: last ? "auto" : "page" }}>
              {mode === "preview" && (
                <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="-rotate-[35deg] text-[96px] font-black tracking-widest text-neutral-300/60">PRATINJAU</span>
                </div>
              )}
              <Kop company={company} title={title} code={code} date={date} />
              {p === 0 && <div className="mb-[8px]">{meta}</div>}
              {idx.length > 0 && (
                <table className="w-full border-collapse">
                  <Head columns={columns} />
                  <tbody>
                    {idx.map((i) => (
                      <BodyRow key={i} columns={columns} row={rows[i]} index={i} />
                    ))}
                  </tbody>
                </table>
              )}
              {last && <Tail {...tailProps} />}
              <Footer printedBy={props.printedBy} printedAt={props.printedAt} page={p + 1} pages={pages.length} />
            </section>
          );
        })}
      </div>
    </>
  );
}
