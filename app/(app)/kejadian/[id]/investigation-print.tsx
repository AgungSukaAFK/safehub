"use client";

// Cetak "Laporan Investigasi" sesuai formulir GMI.MR.F.013-001 Rev 00 (contoh: Laporan investigasi nearmiss kebocoran gas CO2).
// Halaman: 1 data kejadian & korban, 2 kronologis + rekonstruksi, 3 analisa/penyebab/tindakan/review, 4 lampiran foto (bila ada).
// Ukuran px (bukan rem) supaya preferensi ukuran font user tidak mengubah hasil. Data terbatas (cedera, data pribadi, biaya)
// hanya tercetak bagi yang berhak; selain itu tercetak "Terbatas". Kolom kosong = ruang untuk diisi tangan.
import { useEffect, useState, type ReactNode } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Company } from "@/lib/company-types";
import { formatDate, formatDateTime, formatRupiah } from "@/lib/format";
import type { KejadianDetail } from "@/lib/kejadian";
import {
  CAUSE_OPTIONS,
  FORM_BODY_PARTS,
  ILLNESSES,
  INJURIES,
  INVESTIGATION_FORM,
  isStandardCause,
  PPE_ITEMS,
  TREATMENT_ITEMS,
  TREATMENT_REFERRALS,
  victimStatus,
  type CauseKey,
} from "@/lib/kejadian-rules";
import { printWithFileName } from "@/lib/print";
import { cn } from "@/lib/utils";
import { logIncidentPrintAction } from "../actions";

export type PrintMode = "digital" | "basah";
type Photo = { url: string; name: string };

const PRINT_ROOT = "investigation-print";
const MODE_EVENT = "incident-print-mode";

/** Tombol cetak (di header detail). Dokumen dirender terpisah oleh InvestigationPrint. */
export function InvestigationPrintButton({ id, code }: { id: string; code: string }) {
  const run = async (m: PrintMode) => {
    window.dispatchEvent(new CustomEvent(MODE_EVENT, { detail: m }));
    void logIncidentPrintAction(id, code, m).catch(() => undefined);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await printWithFileName(`Laporan-Investigasi-${code}`, document.getElementById(PRINT_ROOT) ?? undefined);
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline"><Printer /> Cetak</Button>} />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => void run("digital")}>Laporan Investigasi (tanda tangan digital)</DropdownMenuItem>
        <DropdownMenuItem onClick={() => void run("basah")}>Laporan Investigasi (tanda tangan basah)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------- bagian kecil
const Box = ({ on, children, className }: { on: boolean; children: ReactNode; className?: string }) => (
  <span className={cn("inline-flex items-start gap-[3px] leading-tight", className)}>
    <span className="mt-[1px] inline-flex size-[9px] shrink-0 items-center justify-center border border-black text-[8px] leading-none">{on ? "✕" : ""}</span>
    <span>{children}</span>
  </span>
);
const Cell = ({ label, children, className }: { label: string; children?: ReactNode; className?: string }) => (
  <div className={cn("border-r border-b border-black px-[5px] py-[3px]", className)}>
    <p className="text-[8px] font-semibold uppercase">{label}</p>
    <div className="min-h-[13px] text-[9.5px]">{children}</div>
  </div>
);
const SideLabel = ({ children }: { children: string }) => (
  <div className="flex w-[18px] shrink-0 items-center justify-center border-r border-black">
    <span className="rotate-180 text-[8px] font-bold whitespace-nowrap [writing-mode:vertical-rl]">{children}</span>
  </div>
);
const Restricted = () => <span className="italic">Terbatas</span>;
const blank = (v: string | null | undefined) => (v && v.trim() ? v : "");

function Sheet({ company, page, total, children, last, printedBy }: { company: Company | null; page: number; total: number; children: ReactNode; last?: boolean; printedBy?: string }) {
  return (
    <section className={cn("flex min-h-[266mm] flex-col text-black", !last && "break-after-page")}>
      <header className="mb-[10px] grid grid-cols-[150px_1fr_110px] border border-black">
        <div className="flex flex-col items-center justify-center gap-[4px] border-r border-black p-[6px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={company?.logoUrl ?? "/gmi-logo.webp"} alt="" className="h-[52px] w-auto object-contain" />
          <p className="text-center text-[10px] font-bold">{company?.name ?? "PT. Garuda Mart Indonesia"}</p>
        </div>
        <div className="flex items-center justify-center text-[22px] font-bold tracking-wide">LAPORAN INVESTIGASI</div>
        <div className="flex items-center justify-center border-l border-black p-[6px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/print/k3-logo.png" alt="" className="h-[62px] w-auto" />
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <table className="mt-[10px] w-full border-collapse text-[10px]">
        <tbody>
          {[
            [["No. Dokumen", INVESTIGATION_FORM.docNo], ["Tgl Efektif", INVESTIGATION_FORM.effective]],
            [["Revisi", INVESTIGATION_FORM.revision], ["Halaman", `${page} / ${total}`]],
          ].map((row) => (
            <tr key={row[0][0]}>
              {row.flatMap(([k, v]) => [
                <th key={k} className="w-1/5 border border-black px-[6px] py-[3px] text-center font-bold">{k}</th>,
                <td key={`${k}-v`} className="w-[30%] border border-black px-[6px] py-[3px] text-center">{v}</td>,
              ])}
            </tr>
          ))}
        </tbody>
      </table>
      {last && printedBy && <p className="mt-[2px] text-right text-[7px] text-neutral-500">Dicetak dari Safe Hub oleh {printedBy}</p>}
    </section>
  );
}

// ---------------------------------------------------------------- dokumen
export function InvestigationPrint({
  doc,
  company,
  categoryLabel,
  photos,
  printedBy,
}: {
  doc: KejadianDetail;
  company: Company | null;
  categoryLabel: string;
  photos: Photo[];
  printedBy: string;
}) {
  const [mode, setMode] = useState<PrintMode>("digital");
  // mode dipilih tombol cetak (komponen saudara di header, tanpa state bersama) lewat event window
  useEffect(() => {
    const h = (e: Event) => setMode((e as CustomEvent<PrintMode>).detail);
    window.addEventListener(MODE_EVENT, h);
    return () => window.removeEventListener(MODE_EVENT, h);
  }, []);

  const r = doc.restricted;
  const canR = doc.canSeeRestricted;
  const involved = doc.persons.filter((p) => p.role === "involved");
  const victimPerson = involved[0] ?? null;
  const witnesses = doc.persons.filter((p) => p.role === "witness").map((p) => p.name);
  const victimName = doc.victim?.name ?? victimPerson?.name ?? "";
  const status = victimStatus(victimPerson ? { companyKind: victimPerson.companyKind, employment: victimPerson.employment } : null);
  const occurred = new Date(doc.occurredAt);
  const time = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(occurred).replace(":", ".");
  const tenure = doc.victim?.joinDate ? tenureText(doc.victim.joinDate, doc.occurredAt) : "";
  const injuryKind: Record<string, string> = { first_aid: "FIRST-AID", medical_treatment: "MEDICAL", fatality: "FATALITY", lost_time: "LOST TIME", restricted_work: "RESTRICTED DUTY" };
  const kind = doc.injuryClass ? injuryKind[doc.injuryClass] : undefined;
  const sig = (name: string | null | undefined, at: string | null | undefined) => (mode === "digital" && name && at ? `Ditandatangani digital · ${formatDateTime(at)}` : "");
  const last = (stage: "investigation" | "ehs" | "mgmt", decisions: string[]) => doc.reviews.filter((x) => x.stage === stage && decisions.includes(x.decision)).at(-1);
  const invSubmit = last("investigation", ["submit"]);
  const ehs = last("ehs", ["approve", "return"]);
  const mgmt = last("mgmt", ["approve", "return"]);
  const lead = doc.team.find((t) => t.role === "lead")?.user ?? null;
  const timeline = doc.investigation.timeline;
  const hasPhotos = photos.length > 0;
  const total = hasPhotos ? 4 : 3;

  // bagian tubuh formulir: cocokkan nama sistem (dengan sisi kanan/kiri) ke kotak formulir
  const parts = canR && r ? r.bodyParts : [];
  const partHit = (match: readonly string[]) => parts.filter((p) => match.some((m) => p.toLowerCase().startsWith(m.toLowerCase())));
  const usedParts = new Set(FORM_BODY_PARTS.flatMap((f) => partHit(f.match)));
  const otherParts = parts.filter((p) => !usedParts.has(p));
  const has = (list: string[] | undefined, v: string) => !!list?.some((x) => x.toLowerCase() === v.toLowerCase());
  const otherOf = (list: string[] | undefined, std: readonly string[]) => (list ?? []).filter((x) => !std.some((s) => s.toLowerCase() === x.toLowerCase()));

  return (
    <div id={PRINT_ROOT} className="printable-document print-only bg-white font-sans text-black">
      {/* ---------------- halaman 1 ---------------- */}
      <Sheet company={company} page={1} total={total}>
        <div className="border-t border-l border-black">
          <div className="grid grid-cols-[1fr_120px_200px] border-b border-black bg-neutral-100">
            <p className="border-r border-black px-[6px] py-[5px] text-center text-[13px] font-bold">ACCIDENT INVESTIGATION REPORT</p>
            <Cell label="No. Laporan" className="border-b-0 bg-white">{doc.code}</Cell>
            <Cell label="Jenis Kejadian" className="border-b-0 bg-white">{categoryLabel}</Cell>
          </div>
          <div className="flex">
            <SideLabel>EMPLOYEE DATA</SideLabel>
            <div className="min-w-0 flex-1">
              <div className="grid grid-cols-[1.1fr_0.9fr_1fr_1fr_0.7fr_1fr]">
                <Cell label="Tanggal Kejadian">{formatDate(doc.occurredAt)}</Cell>
                <Cell label="Waktu Kejadian">{time} WIB</Cell>
                <Cell label="Tanggal Dilaporkan">{formatDate(doc.reportedAt)}</Cell>
                <Cell label="Dilaporkan Kepada"><b>Dept HSE</b></Cell>
                <Cell label="Shift">{doc.shift ?? "-"}</Cell>
                <Cell label="Overtime">
                  <Box on={doc.overtime === true}>Ya</Box> <Box on={doc.overtime === false} className="ml-[8px]">Tidak</Box>
                </Cell>
              </div>
              <div className="grid grid-cols-[3fr_1fr]">
                <Cell label="Lokasi Kejadian">{[doc.siteName, doc.areaName, doc.locationDetail].filter(Boolean).join(" · ")}</Cell>
                <Cell label="Departemen">{doc.victim?.department ?? "-"}</Cell>
              </div>
              <div className="grid grid-cols-[2fr_1.6fr_1fr_1fr]">
                <Cell label="Nama Karyawan"><i>{victimName}</i></Cell>
                <Cell label="No. Karyawan">{doc.victim?.code ?? ""}</Cell>
                <Cell label="Tanggal Lahir">{canR ? (r?.victimBirthDate ? formatDate(r.victimBirthDate) : "") : <Restricted />}</Cell>
                <Cell label="Tanggal Masuk">{doc.victim?.joinDate ? formatDate(doc.victim.joinDate) : ""}</Cell>
              </div>
              <div className="grid grid-cols-[2fr_1.6fr_2fr]">
                <Cell label="Alamat Karyawan" className="min-h-[44px]">{canR ? blank(r?.victimAddress) : <Restricted />}</Cell>
                <Cell label="No. Telepon Rumah/Keluarga">{canR ? blank(r?.victimPhone) : <Restricted />}</Cell>
                <div>
                  <Cell label="Jabatan/Posisi">{doc.victim?.jobTitle ?? victimPerson?.position ?? ""}</Cell>
                  <Cell label="Lama Bekerja Pada Posisi Tersebut">{tenure}</Cell>
                </div>
              </div>
              <div className="grid grid-cols-[2fr_1.6fr_2fr]">
                <Cell label="Saksi">{witnesses.join(", ")}</Cell>
                <Cell label="Jumlah Hari Dengan Keterbatasan Kerja?">{canR ? (r?.restrictedDays ? `${r.restrictedDays} hari` : r ? "Tidak Ada" : "") : <Restricted />}</Cell>
                <Cell label="Berapa Hari Kerja Hilang?">{canR ? (r?.lostDays ? `${r.lostDays} hari` : r ? "Tidak Ada" : "") : <Restricted />}</Cell>
              </div>
              <div className="grid grid-cols-[2fr_2fr]">
                <Cell label="Apa yang anda lakukan saat kejadian?" className="min-h-[90px] whitespace-pre-wrap">{blank(doc.activity)}</Cell>
                <Cell label="Apa alat pelindung diri yang anda gunakan saat kejadian?">
                  <ul className="mt-[2px] grid grid-cols-2 gap-x-[6px] gap-y-[2px]">
                    {PPE_ITEMS.map((p) => (
                      <li key={p.value}><Box on={!!doc.ppe[p.value]}>{p.label}</Box></li>
                    ))}
                  </ul>
                </Cell>
              </div>
              <div className="flex flex-wrap items-center gap-x-[14px] border-r border-b border-black px-[5px] py-[4px] text-[9px]">
                <b>STATUS KORBAN :</b>
                {["PERMANEN", "PART TIME", "KONTRAK", "SUBKONTRAKTOR", "OTHER"].map((s) => <Box key={s} on={status === s}>{s}</Box>)}
              </div>
            </div>
          </div>
          <div className="flex">
            <SideLabel>INJURY & ILLNESS DESCRIPTION</SideLabel>
            {canR ? (
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-[12px] border-r border-b border-black px-[5px] py-[3px] text-[9px]">
                  <Box on={doc.occupational === "occupational"}>OCCUPATIONAL</Box>
                  <Box on={doc.occupational === "re_treatment"}>RE-TREATMENT</Box>
                  <Box on={doc.occupational === "non_occupational"}>NON-OCCUPATIONAL</Box>
                  <span className="ml-auto flex flex-wrap gap-x-[8px]">
                    JENIS:
                    {["FIRST-AID", "MEDICAL", "FATALITY", "LOST TIME", "RESTRICTED DUTY"].map((k) => <Box key={k} on={kind === k}>{k}</Box>)}
                  </span>
                </div>
                <div className="grid grid-cols-[1fr_1fr_1.6fr_1.3fr] text-[8.5px]">
                  <Col title="SAKIT" items={ILLNESSES.map((x) => [x, has(r?.illnesses, x)] as const)} other={otherOf(r?.illnesses, ILLNESSES).join(", ")} />
                  <Col title="CIDERA" items={INJURIES.map((x) => [x, has(r?.injuries, x)] as const)} other={[...otherOf(r?.injuries, INJURIES), r?.injuryType].filter(Boolean).join(", ")} />
                  <div className="border-r border-b border-black px-[4px] py-[3px]">
                    <p className="text-center font-semibold">BAGIAN TUBUH</p>
                    <div className="grid grid-cols-[1fr_1fr_90px] gap-x-[3px]">
                      <ul className="col-span-2 grid grid-cols-2 gap-y-[1px]">
                        {FORM_BODY_PARTS.map((f) => {
                          const hit = partHit(f.match);
                          return <li key={f.label}><Box on={hit.length > 0}>{f.label.toUpperCase()}{hit.length > 0 && f.label.endsWith("*") ? ` (${sides(hit)})` : ""}</Box></li>;
                        })}
                        <li className="col-span-2"><Box on={otherParts.length > 0}>LAIN2**{otherParts.length ? `: ${otherParts.join(", ")}` : ""}</Box></li>
                      </ul>
                      <div className="flex items-end justify-center gap-[2px]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/print/body-front.png" alt="Tubuh depan" className="h-[96px] w-auto" />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/print/body-back.png" alt="Tubuh belakang" className="h-[96px] w-auto" />
                      </div>
                    </div>
                    <p className="text-[7.5px]">*Khusus kanan/kiri</p>
                  </div>
                  <div className="border-r border-b border-black px-[4px] py-[3px]">
                    <p className="text-center font-semibold">TREATMENT</p>
                    <div className="grid grid-cols-2 gap-x-[3px]">
                      <ul className="space-y-[1px]">{TREATMENT_ITEMS.map((x) => <li key={x}><Box on={has(r?.treatmentItems, x)}>{x.toUpperCase()}</Box></li>)}</ul>
                      <ul className="space-y-[1px]">
                        <li className="font-semibold">LAIN2:</li>
                        {TREATMENT_REFERRALS.map((x) => <li key={x}><Box on={has(r?.treatmentItems, x)}>{x.toUpperCase()}</Box></li>)}
                        {r?.facility && <li>{r.facility}</li>}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="min-h-[150px] flex-1 border-r border-b border-black p-[8px] text-[10px] italic">Data cedera terbatas (hanya HSE/HR). Minta HSE mencetak laporan lengkap.</div>
            )}
          </div>
          <div className="flex">
            <SideLabel>LOSS</SideLabel>
            <div className="grid min-w-0 flex-1 grid-cols-2">
              <Cell label="Kerusakan Property">{blank(doc.damageDescription) || "Tidak Ada"}</Cell>
              <Cell label="Kerusakan Lain">-</Cell>
              <Cell label="Kisaran Kerugian" className="col-span-2">{doc.canSeeCost ? (doc.estimatedCost != null ? formatRupiah(doc.estimatedCost) : "") : <Restricted />}</Cell>
            </div>
          </div>
        </div>
      </Sheet>

      {/* ---------------- halaman 2 ---------------- */}
      <Sheet company={company} page={2} total={total}>
        <div className="border-t border-l border-black">
          <div className="flex">
            <SideLabel>INCIDENT DESCRIPTION</SideLabel>
            <div className="min-h-[300px] flex-1 border-r border-b border-black p-[8px] text-[10.5px] leading-relaxed">
              <p className="mb-[6px] text-[10px] font-bold">KRONOLOGIS KEJADIAN:</p>
              {timeline.length ? (
                timeline.map((t, i) => <p key={i} className="mb-[4px] text-justify whitespace-pre-wrap">{t.time ? `${t.time} · ` : ""}{t.event}</p>)
              ) : (
                <p className="text-justify whitespace-pre-wrap">{doc.description}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-[2fr_1.6fr_1fr]">
            <Cell label="Nama Pelapor"><b className="text-[11px]">{doc.reporter?.name ?? ""}</b></Cell>
            <Cell label="Tanda Tangan">{sig(doc.reporter?.name, doc.reportedAt)}</Cell>
            <Cell label="Tanggal">{formatDate(doc.reportedAt)}</Cell>
          </div>
          <div className="flex">
            <SideLabel>Rekonstruksi Kejadian</SideLabel>
            <div className="min-h-[330px] flex-1 border-r border-b border-black p-[8px] text-[10.5px] leading-relaxed whitespace-pre-wrap">{blank(doc.investigation.reconstruction)}</div>
          </div>
        </div>
      </Sheet>

      {/* ---------------- halaman 3 ---------------- */}
      <Sheet company={company} page={3} total={total} last={!hasPhotos} printedBy={printedBy}>
        <div className="border-t border-l border-black text-[9px]">
          <div className="flex">
            <SideLabel>ANALISA FAKTA</SideLabel>
            <div className="min-h-[64px] flex-1 border-r border-b border-black p-[6px] text-[9.5px] whitespace-pre-wrap">{blank(doc.investigation.facts)}</div>
          </div>
          <div className="flex">
            <SideLabel>CAUSE ANALYSIS</SideLabel>
            <div className="grid min-w-0 flex-1 grid-cols-2">
              <div className="border-r border-b border-black p-[5px]">
                <p className="mb-[3px] text-[8px]">PENYEBAB LANGSUNG KECELAKAAN:</p>
                <div className="grid grid-cols-2 gap-x-[6px]">
                  <CauseCol title="UNSAFE ACTS" k="unsafe_act" doc={doc} />
                  <CauseCol title="UNSAFE CONDITIONS" k="unsafe_condition" doc={doc} />
                </div>
              </div>
              <div className="border-r border-b border-black p-[5px]">
                <p className="mb-[3px] text-[8px]">PENYEBAB DASAR KECELAKAAN:</p>
                <div className="grid grid-cols-2 gap-x-[6px]">
                  <CauseCol title="JOB FACTOR" k="job_factor" doc={doc} />
                  <CauseCol title="PERSONAL FACTORS" k="personal_factor" doc={doc} />
                </div>
                <div className="mt-[6px] border-t border-black pt-[4px]">
                  <p className="text-[9.5px] font-bold">URAIAN PENYEBAB DASAR:</p>
                  <p className="text-[8.5px] whitespace-pre-wrap">{blank(doc.investigation.basicCauseSummary)}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex">
            <SideLabel>CORRECTIVE AND PREVENTIVE ACTION</SideLabel>
            <div className="min-w-0 flex-1">
              <p className="border-r border-b border-black px-[5px] py-[2px] text-[8px]">DESKRIPSI RENCANA TINDAKAN (Untuk mencegah terulangnya kejadian yang sama termasuk waktu penyelesaian)</p>
              <table className="w-full border-collapse text-[9.5px]">
                <thead>
                  <tr className="text-[11px] font-bold">
                    <th className="border-r border-b border-black py-[2px]">ACTION PLAN</th>
                    <th className="w-[110px] border-r border-b border-black">PIC</th>
                    <th className="w-[100px] border-r border-b border-black">DUE DATE</th>
                  </tr>
                </thead>
                <tbody>
                  {(doc.actions.length ? doc.actions.map((a) => [a.title, a.pic?.name ?? "", formatDate(a.dueDate)]) : doc.investigation.recommendations.map((x) => [x.text, "", ""])).map(([t, p, d], i) => (
                    <tr key={i}>
                      <td className="border-r border-b border-black px-[5px] py-[3px] align-top">{t}</td>
                      <td className="border-r border-b border-black px-[5px] py-[3px] align-top">{p}</td>
                      <td className="border-r border-b border-black px-[5px] py-[3px] align-top">{d}</td>
                    </tr>
                  ))}
                  {doc.actions.length === 0 && doc.investigation.recommendations.length === 0 && (
                    <tr><td className="h-[50px] border-r border-b border-black" /><td className="border-r border-b border-black" /><td className="border-r border-b border-black" /></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="grid grid-cols-[2fr_1.6fr_1fr]">
            <Cell label="Investigator Team Leader/Supervisor/HSE Representative">{lead?.name ?? ""}</Cell>
            <Cell label="Tanda Tangan">{sig(lead?.name, invSubmit?.at)}</Cell>
            <Cell label="Tanggal">{invSubmit ? formatDate(invSubmit.at) : ""}</Cell>
          </div>
          <Review title="EHS REVIEW" entry={ehs} nameLabel="Nama HSE Coordinator" sig={sig} />
          <Review title="MANAGEMENT REVIEW" entry={mgmt} nameLabel="Nama Manajemen" sig={sig} />
        </div>
      </Sheet>

      {/* ---------------- halaman 4: lampiran ---------------- */}
      {hasPhotos && (
        <Sheet company={company} page={4} total={total} last printedBy={printedBy}>
          <p className="mb-[8px] text-[12px] font-bold">LAMPIRAN</p>
          <div className="grid grid-cols-2 gap-[10px]">
            {photos.slice(0, 6).map((p) => (
              <figure key={p.url} className="break-inside-avoid">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.name} className="max-h-[300px] w-full object-contain" />
                <figcaption className="mt-[2px] text-center text-[8px]">{p.name}</figcaption>
              </figure>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  );
}

function Col({ title, items, other }: { title: string; items: readonly (readonly [string, boolean])[]; other: string }) {
  return (
    <div className="border-r border-b border-black px-[4px] py-[3px]">
      <p className="text-center font-semibold">{title}</p>
      <ul className="space-y-[1px]">
        {items.map(([x, on]) => <li key={x}><Box on={on}>{x.toUpperCase()}</Box></li>)}
        <li><Box on={!!other}>LAIN2**{other ? `: ${other}` : ""}</Box></li>
      </ul>
    </div>
  );
}

function CauseCol({ title, k, doc }: { title: string; k: CauseKey; doc: KejadianDetail }) {
  const rows = doc.investigation.causes[k] ?? [];
  const on = (o: string) => rows.some((r) => r.text.trim().toLowerCase() === o.toLowerCase());
  const other = rows.filter((r) => !isStandardCause(k, r.text));
  return (
    <div>
      <p className="mb-[2px] text-[8.5px] font-bold underline">{title}</p>
      <ul className="space-y-[1px] text-[8px]">
        {CAUSE_OPTIONS[k].map((o) => <li key={o}><Box on={on(o)}>{o}</Box></li>)}
        <li><Box on={other.length > 0}>Lain-Lain{other.length ? `: ${other.map((r) => r.text).join("; ")}` : ""}</Box></li>
      </ul>
    </div>
  );
}

function Review({ title, entry, nameLabel, sig }: { title: string; entry: KejadianDetail["reviews"][number] | undefined; nameLabel: string; sig: (n: string | null | undefined, at: string | null | undefined) => string }) {
  const yes = entry?.decision === "approve";
  const no = entry?.decision === "return";
  return (
    <>
      <div className="flex">
        <SideLabel>{title}</SideLabel>
        <div className="min-h-[72px] flex-1 border-r border-b border-black p-[5px]">
          <p className="text-[8px]">
            APAKAH PENYEBAB DAN TINDAKAN PERBAIKAN DIATAS MENCUKUPI UNTUK MENCEGAH TERULANGNYA KEJADIAN YANG SAMA ?
            <Box on={yes} className="ml-[10px]">YA</Box>
            <Box on={no} className="ml-[10px]">TIDAK</Box>
          </p>
          <p className="text-[8px]">JIKA TIDAK BERIKAN SARAN ANDA.</p>
          <p className="mt-[6px] text-[10px] whitespace-pre-wrap">{entry?.note ?? ""}</p>
        </div>
      </div>
      <div className="grid grid-cols-[2fr_1.6fr_1fr]">
        <Cell label={nameLabel}><b className="text-[11px]">{entry?.actor?.name ?? ""}</b></Cell>
        <Cell label="Tanda Tangan">{sig(entry?.actor?.name, entry?.at)}</Cell>
        <Cell label="Tanggal">{entry ? formatDate(entry.at) : ""}</Cell>
      </div>
    </>
  );
}

/** "kanan, kiri" dari daftar bagian tubuh bersisi. */
function sides(parts: string[]) {
  const s = new Set(parts.map((p) => (/kanan$/i.test(p) ? "kanan" : /kiri$/i.test(p) ? "kiri" : "")).filter(Boolean));
  return [...s].join("/") || "-";
}

/** Lama bekerja dari tanggal masuk sampai tanggal kejadian ("2 tahun 3 bulan"). */
function tenureText(join: string, at: string) {
  const a = new Date(join);
  const b = new Date(at);
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) months -= 1;
  if (months < 0) return "";
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y && `${y} tahun`, m && `${m} bulan`].filter(Boolean).join(" ") || "< 1 bulan";
}
