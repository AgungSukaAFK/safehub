"use client";

// Kartu grafik Beranda (frontend-guide §17.3): Recharts dimuat dynamic (ssr:false), toggle
// "Grafik / Tabel" (pilihan diingat per perangkat), klik titik/batang → list terfilter.
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BarChart3, Table2 } from "lucide-react";
import { Content } from "@/components/list/content";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatNumber, formatRupiah } from "@/lib/format";
import { useStoredState } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { pengajuanListHref, type DashboardPeriod } from "@/lib/dashboard-types";
import { TREND_SERIES, type DeptPoint, type TrendPoint } from "./chart-defs";

type Scope = Pick<DashboardPeriod, "from" | "to" | "company">;

const Charts = dynamic(() => import("./charts-inner"), { ssr: false, loading: () => <Skeleton className="h-[260px] w-full" /> });

function ViewToggle({ id, view, onChange }: { id: string; view: "chart" | "table"; onChange: (v: "chart" | "table") => void }) {
  const btn = (v: "chart" | "table", Icon: typeof Table2, label: string) => (
    <button
      type="button"
      onClick={() => onChange(v)}
      aria-pressed={view === v}
      aria-controls={id}
      className={cn("inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium", view === v ? "bg-background shadow-xs" : "text-muted-foreground hover:text-foreground")}
    >
      <Icon className="size-3.5" /> {label}
    </button>
  );
  return (
    <div className="inline-flex rounded-lg bg-muted p-0.5">
      {btn("chart", BarChart3, "Grafik")}
      {btn("table", Table2, "Tabel")}
    </div>
  );
}

function Empty({ prevHref }: { prevHref: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center text-sm text-muted-foreground">
      Belum ada data di periode ini.
      <Link href={prevHref} scroll={false} className={buttonVariants({ variant: "outline", size: "sm" })}>
        <ArrowLeft /> Periode sebelumnya
      </Link>
    </div>
  );
}

export function TrendCard({ data, period, prevHref }: { data: TrendPoint[]; period: Scope; prevHref: string }) {
  const listHref = (day: string) => pengajuanListHref({ from: day, to: day, company: period.company });
  const router = useRouter();
  const [view, setView] = useStoredState<"chart" | "table">("dashboard-view-trend", "chart");
  const empty = data.every((d) => d.created === 0 && d.approved === 0);
  return (
    <Content size="md" title="Tren harian" description="Pengajuan dibuat & disetujui per hari (WIB)." cardAction={!empty && <ViewToggle id="trend" view={view} onChange={setView} />}>
      <div id="trend">
        {empty ? (
          <Empty prevHref={prevHref} />
        ) : view === "chart" ? (
          <>
            <ul className="mb-2 flex gap-4 text-xs text-muted-foreground" aria-label="Legenda">
              {TREND_SERIES.map((s) => (
                <li key={s.key} className="flex items-center gap-1.5">
                  <span className="h-0.5 w-4 rounded-full" style={{ background: s.color }} aria-hidden /> {s.label}
                </li>
              ))}
            </ul>
            <Charts kind="trend" data={data} onPick={(day) => router.push(listHref(day))} />
          </>
        ) : (
          <div className="max-h-[300px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead className="text-right">Dibuat</TableHead>
                  <TableHead className="text-right">Disetujui</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data
                  .filter((d) => d.created || d.approved)
                  .map((d) => (
                    <TableRow key={d.day}>
                      <TableCell>
                        <Link href={listHref(d.day)} className="text-primary hover:underline">
                          {formatDate(d.day)}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(d.created)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(d.approved)}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </Content>
  );
}

export function DepartmentCard({ data, period, prevHref }: { data: DeptPoint[]; period: Scope; prevHref: string }) {
  const listHref = (key: string) => pengajuanListHref(period, { departemen: key });
  const router = useRouter();
  const [view, setView] = useStoredState<"chart" | "table">("dashboard-view-dept", "chart");
  return (
    <Content size="md" title="Per departemen" description="Jumlah pengajuan dibuat di periode ini." cardAction={data.length > 0 && <ViewToggle id="dept" view={view} onChange={setView} />}>
      <div id="dept">
        {data.length === 0 ? (
          <Empty prevHref={prevHref} />
        ) : view === "chart" ? (
          <Charts kind="department" data={data} onPick={(key) => router.push(listHref(key))} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Departemen</TableHead>
                <TableHead className="text-right">Pengajuan</TableHead>
                <TableHead className="text-right">Total nilai</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((d) => (
                <TableRow key={d.key}>
                  <TableCell>
                    {d.clickable ? (
                      <Link href={listHref(d.key)} className="text-primary hover:underline">
                        {d.name}
                      </Link>
                    ) : (
                      d.name
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(d.total)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatRupiah(d.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </Content>
  );
}
