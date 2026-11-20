"use client";

// Isi grafik Recharts (dimuat lewat dynamic(), ssr:false). Aturan dataviz: satu sumbu Y, garis 2px,
// marker aktif ≥ 8px, crosshair + satu tooltip berisi semua seri di garis; bar: ujung 4px membulat,
// hit target = baris penuh, tanpa crosshair. Warna dari token --viz-* (divalidasi per mode tema).
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDate, formatNumber, formatRupiah } from "@/lib/format";
import { TREND_SERIES, type DeptPoint, type TrendPoint } from "./chart-defs";

const AXIS = { stroke: "var(--color-viz-axis)", fontSize: 11, tickLine: false, axisLine: false } as const;

type TipRow = { label: string; value: string; color?: string };

function TipBox({ title, rows }: { title: string; rows: TipRow[] }) {
  return (
    <div className="min-w-36 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <p className="mb-1 text-muted-foreground">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center gap-2">
          {r.color && <span className="h-0.5 w-3 rounded-full" style={{ background: r.color }} aria-hidden />}
          <strong className="font-semibold tabular-nums">{r.value}</strong>
          <span className="text-muted-foreground">{r.label}</span>
        </p>
      ))}
    </div>
  );
}

const dayNum = (d: string) => String(Number(d.slice(8, 10)));

export default function Charts(
  props:
    | { kind: "trend"; data: TrendPoint[]; onPick: (day: string) => void }
    | { kind: "department"; data: DeptPoint[]; onPick: (key: string) => void },
) {
  if (props.kind === "trend") {
    const { data, onPick } = props;
    const last = data.length - 1;
    return (
      <ResponsiveContainer width="100%" height={260}>
        <LineChart
          data={data}
          margin={{ top: 8, right: 64, bottom: 0, left: -16 }}
          onClick={(s) => {
            const i = Number(s?.activeIndex);
            if (Number.isInteger(i) && data[i]) onPick(data[i].day);
          }}
          className="cursor-pointer"
          accessibilityLayer
        >
          <CartesianGrid vertical={false} stroke="var(--color-viz-grid)" />
          <XAxis dataKey="day" tickFormatter={dayNum} {...AXIS} interval="preserveStartEnd" minTickGap={12} />
          <YAxis allowDecimals={false} width={40} {...AXIS} />
          <Tooltip
            cursor={{ stroke: "var(--color-viz-axis)", strokeWidth: 1 }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <TipBox
                  title={`${formatDate(String(label))} · klik untuk membuka daftar`}
                  rows={TREND_SERIES.map((s) => ({ label: s.label, color: s.color, value: formatNumber(Number(payload.find((p) => p.dataKey === s.key)?.value ?? 0)) }))}
                />
              ) : null
            }
          />
          {TREND_SERIES.map((s) => (
            <Line
              key={s.key}
              dataKey={s.key}
              name={s.label}
              type="monotone"
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--color-card)" }}
              isAnimationActive={false}
              // label langsung di ujung garis (≤ 4 seri), selain legend
              label={({ x, y, index }: { x?: number | string; y?: number | string; index?: number }) =>
                index === last ? (
                  <text x={Number(x) + 8} y={Number(y)} dy={4} fontSize={11} fill="var(--color-foreground)" key={s.key}>
                    {s.label}
                  </text>
                ) : (
                  <g key={`${s.key}-${index}`} />
                )
              }
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  const { data, onPick } = props;
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 36 + 24)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }} barCategoryGap={8} accessibilityLayer>
        <CartesianGrid horizontal={false} stroke="var(--color-viz-grid)" />
        <XAxis type="number" allowDecimals={false} {...AXIS} />
        <YAxis type="category" dataKey="name" width={112} {...AXIS} tick={{ fill: "var(--color-foreground)", fontSize: 12 }} />
        <Tooltip
          cursor={{ fill: "var(--color-muted)", opacity: 0.5 }}
          content={({ active, payload }) => {
            const d = active && payload?.[0] ? (payload[0].payload as DeptPoint) : null;
            return d ? (
              <TipBox
                title={d.clickable ? `${d.name} · klik untuk membuka daftar` : d.name}
                rows={[
                  { label: "pengajuan", value: formatNumber(d.total) },
                  { label: "total nilai", value: formatRupiah(d.amount) },
                ]}
              />
            ) : null;
          }}
        />
        <Bar
          dataKey="total"
          name="Pengajuan"
          fill="var(--color-viz-1)"
          radius={[0, 4, 4, 0]}
          maxBarSize={20}
          isAnimationActive={false}
          className="cursor-pointer"
          onClick={(d: { payload?: DeptPoint }) => d.payload?.clickable && onPick(d.payload.key)}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
