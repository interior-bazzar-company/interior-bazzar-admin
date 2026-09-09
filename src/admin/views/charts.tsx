/* =============================================================================
   The chart kit.
   -----------------------------------------------------------------------------
   Seven forms, each picked from the data's job rather than from what looks good:

     ColumnChart    trend over time, several distinct series  → categorical
     Waterfall      how a period reached its closing figure   → in / out / total
     SignedColumns  one series against zero, sign is the news → status
     Spark          a metric's shape, inline on a card        → categorical
     FunnelChart    ordered stages                            → ordinal ramp
     BarRows        compare magnitude across classes          → ordinal / status
     CohortHeat     a grid of magnitudes                      → sequential

   The four that plot against an axis are recharts, on Untitled UI's chart
   furniture; the three that are really lists (a funnel, ranked bars, a cohort
   grid) are laid out as lists, because their labels are words and words want
   the document's own layout. Every colour is a `--color-chart-*` token read
   through a utility class, so a chart is correct in both themes without
   knowing a theme exists — slot order is fixed and never cycled, and status
   colours are never a series.
   ========================================================================== */
import { useId, type ReactNode } from "react";
import { Bar, BarChart, Cell, LabelList, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { ChartTooltipContent } from "@/components/application/charts/charts-base";
import { cx } from "@/utils/cx";
import { Tooltip as UITooltip, TooltipTrigger } from "@/components/base/tooltip/tooltip";

/* ------------------------------------------------------------- scaling --- */
/** A round axis maximum and its ticks — 200, not 187. */
export function niceScale(max: number, ticks = 4): { max: number; steps: number[] } {
  if (max <= 0) return { max: 1, steps: [0, 1] };
  const raw = max / ticks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const top = Math.ceil(max / step) * step;
  const steps: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) steps.push(Math.round(v * 100) / 100);
  return { max: top, steps };
}

const pctOf = (n: number, max: number) => (max > 0 ? Math.max(n > 0 ? 1.5 : 0, (n / max) * 100) : 0);
const fmt = (n: number) => n.toLocaleString("en-IN");

/* the slots, as fill/stroke utilities — never a literal */
const SLOT_FILL = ["", "fill-chart-1", "fill-chart-2", "fill-chart-3", "fill-chart-4", "fill-chart-5", "fill-chart-6", "fill-chart-7", "fill-chart-8"];
const SLOT_BG = ["", "bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5", "bg-chart-6", "bg-chart-7", "bg-chart-8"];
/* The value axis's width, and the same number as `--chart-gutter` in
   brand.css — recharts wants an integer, a label row under the plot wants the
   token. They must not drift apart: a label row that starts anywhere else
   points at the wrong column. */
const AXIS_W = 44;

const AXIS_TICK = { className: "fill-text-quaternary font-mono", fontSize: 11 } as const;
const GRID = "stroke-chart-grid";

/* --------------------------------------------------------- column chart --- */
export interface Series {
  key: string;
  label: string;
  slot: 1 | 2 | 3;
}
export interface ColumnPoint {
  key: string;
  label: string;
  values: Record<string, number>;
}

/** Grouped columns: several distinct series over time — side by side off a
 *  shared baseline, so the reader compares rather than sums. */
export function ColumnChart({ series, points, unit, labelSeries, height = 220 }: { series: Series[]; points: ColumnPoint[]; unit: string; labelSeries?: string; height?: number }) {
  const id = useId();
  const data = points.map((p) => ({ name: p.label, key: p.key, ...p.values }));
  const peak = Math.max(1, ...points.flatMap((p) => series.map((s) => p.values[s.key] || 0)));
  const scale = niceScale(peak);
  const last = points.length - 1;
  return (
    <figure aria-labelledby={id + "-cap"} className="flex min-w-0 flex-col gap-2">
      {series.length > 1 ? <ChartLegend items={series.map((s) => ({ label: s.label, cls: SLOT_BG[s.slot] }))} /> : null}
      <div style={{ height }} className="min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: 0 }} barCategoryGap="28%" barGap={3}>
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={AXIS_TICK} interval="preserveStartEnd" />
            <YAxis axisLine={false} tickLine={false} tick={AXIS_TICK} width={AXIS_W} ticks={scale.steps} domain={[0, scale.max]} tickFormatter={fmt} />
            <RTooltip cursor={{ className: "fill-bg-secondary" }} content={<ChartTooltipContent />} formatter={(v) => fmt(Number(v))} />
            {scale.steps.map((s) => (
              <ReferenceLine key={s} y={s} className={GRID} strokeWidth={1} />
            ))}
            {series.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} className={SLOT_FILL[s.slot]} radius={[3, 3, 0, 0]} maxBarSize={40} isAnimationActive={false}>
                {labelSeries === s.key ? (
                  <LabelList
                    dataKey={s.key}
                    position="top"
                    className="fill-text-secondary font-mono"
                    fontSize={11}
                    formatter={(v: ReactNode) => fmt(Number(v))}
                    content={(props) => {
                      const { x, y, width, value, index } = props as { x?: number; y?: number; width?: number; value?: number; index?: number };
                      if (index !== last || x === undefined || y === undefined) return null;
                      return (
                        <text x={(x || 0) + (width || 0) / 2} y={(y || 0) - 6} textAnchor="middle" className="fill-text-secondary font-mono" fontSize={11}>
                          {fmt(Number(value || 0))}
                        </text>
                      );
                    }}
                  />
                ) : null}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption id={id + "-cap"} className="label-mono">
        {unit}
      </figcaption>
    </figure>
  );
}

function ChartLegend({ items }: { items: { label: ReactNode; cls: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-tertiary">
      {items.map((s, i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          <i className={cx("block size-2 rounded-[2px]", s.cls)} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ waterfall --- */
export interface WaterStep {
  key: string;
  label: string;
  sub?: string;
  value: number;
  display?: string;
  kind: "in" | "out" | "total";
}

/** How a period got from nothing to its closing figure. A zero step is drawn,
 *  not skipped; the connectors run from each step's closing level to the next
 *  one's opening level, so the arithmetic is a picture. */
export function Waterfall({ steps, unit, height = 240 }: { steps: WaterStep[]; unit: string; height?: number }) {
  const id = useId();
  let run = 0;
  const laid = steps.map((s) => {
    const from = s.kind === "total" ? 0 : run;
    const to = s.kind === "total" ? run : run + (s.kind === "out" ? -Math.abs(s.value) : Math.abs(s.value));
    if (s.kind !== "total") run = to;
    return { s, from, to, lo: Math.min(from, to), hi: Math.max(from, to) };
  });
  const peak = Math.max(1, ...laid.map((l) => l.hi));
  const scale = niceScale(peak);
  const data = laid.map((l) => ({ name: l.s.label, base: l.lo, delta: Math.max(l.hi - l.lo, 0), kind: l.s.kind, display: l.s.display ?? fmt(l.s.value), sub: l.s.sub }));
  const fillOf = (k: WaterStep["kind"]) => (k === "in" ? "fill-chart-pos" : k === "out" ? "fill-chart-neg" : "fill-chart-1");
  return (
    <figure aria-labelledby={id + "-cap"} className="flex min-w-0 flex-col gap-2">
      <div style={{ height }} className="min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 18, right: 8, bottom: 0, left: 0 }} barCategoryGap="30%">
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={AXIS_TICK} interval={0} />
            <YAxis axisLine={false} tickLine={false} tick={AXIS_TICK} width={AXIS_W} ticks={scale.steps} domain={[0, scale.max]} tickFormatter={fmt} />
            {scale.steps.map((s) => (
              <ReferenceLine key={s} y={s} className={GRID} strokeWidth={1} />
            ))}
            {/* the connectors: from this step's closing level to the next step's opening */}
            {laid.map((l, i) => {
              const next = laid[i + 1];
              if (!next || next.s.kind === "total") return null;
              return <ReferenceLine key={"c" + i} segment={[{ x: l.s.label, y: l.to }, { x: next.s.label, y: l.to }]} className="stroke-chart-axis" strokeDasharray="3 3" strokeWidth={1} />;
            })}
            <RTooltip
              cursor={{ className: "fill-bg-secondary" }}
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const d = payload[0].payload as (typeof data)[number];
                return (
                  <div className="rounded-lg bg-primary-solid px-3 py-2 shadow-lg">
                    <p className="text-xs font-semibold text-white">{d.name}</p>
                    <p className="text-xs text-tooltip-supporting-text">
                      {d.kind === "total" ? "closing" : d.kind}: {d.display}
                    </p>
                  </div>
                );
              }}
            />
            <Bar dataKey="base" stackId="w" className="fill-transparent" isAnimationActive={false} />
            <Bar dataKey="delta" stackId="w" radius={[3, 3, 0, 0]} maxBarSize={44} isAnimationActive={false}>
              {data.map((d, i) => (
                <Cell key={i} className={fillOf(d.kind as WaterStep["kind"])} />
              ))}
              <LabelList
                dataKey="display"
                position="top"
                content={(props) => {
                  const { x, y, width, value } = props as { x?: number; y?: number; width?: number; value?: string };
                  return (
                    <text x={(x || 0) + (width || 0) / 2} y={(y || 0) - 6} textAnchor="middle" className="fill-text-secondary font-mono" fontSize={11}>
                      {value}
                    </text>
                  );
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {steps.some((s) => s.sub) ? (
        <div className="grid pl-[var(--chart-gutter)] text-center text-2xs text-quaternary" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
          {steps.map((s) => (
            <span key={s.key} className="truncate px-1">
              {s.sub}
            </span>
          ))}
        </div>
      ) : null}
      <figcaption id={id + "-cap"} className="label-mono">
        {unit}
      </figcaption>
    </figure>
  );
}

/* ------------------------------------------------------ signed columns --- */
export interface SignedPoint {
  key: string;
  label: string;
  value: number;
  display?: string;
}

/** One series over time against a ZERO RULE — the one place colour encodes
 *  sign rather than identity. Labels are selective: the extreme each way and
 *  the last point. */
export function SignedColumns({ points, unit, groups, height = 200 }: { points: SignedPoint[]; unit: string; groups?: { label: string; n: number }[]; height?: number }) {
  const id = useId();
  const data = points.map((p) => ({ name: p.label, value: p.value, display: p.display ?? fmt(p.value) }));
  const idxHi = points.reduce((b, p, i) => (p.value > points[b].value ? i : b), 0);
  const idxLo = points.reduce((b, p, i) => (p.value < points[b].value ? i : b), 0);
  const labelled = new Set([idxHi, idxLo, points.length - 1]);
  return (
    <figure aria-labelledby={id + "-cap"} className="flex min-w-0 flex-col gap-2">
      <div style={{ height }} className="min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: 0 }} barCategoryGap="30%">
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={AXIS_TICK} interval="preserveStartEnd" />
            <YAxis axisLine={false} tickLine={false} tick={AXIS_TICK} width={AXIS_W} tickFormatter={fmt} />
            <ReferenceLine y={0} className="stroke-chart-axis" strokeWidth={1} />
            <RTooltip
              cursor={{ className: "fill-bg-secondary" }}
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const d = payload[0].payload as (typeof data)[number];
                return (
                  <div className="rounded-lg bg-primary-solid px-3 py-2 shadow-lg">
                    <p className="text-xs font-semibold text-white">{d.name}</p>
                    <p className="text-xs text-tooltip-supporting-text">net: {d.display}</p>
                  </div>
                );
              }}
            />
            <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={36} isAnimationActive={false}>
              {data.map((d, i) => (
                <Cell key={i} className={d.value >= 0 ? "fill-chart-pos" : "fill-chart-neg"} />
              ))}
              <LabelList
                dataKey="display"
                content={(props) => {
                  const { x, y, width, height: h, value, index } = props as { x?: number; y?: number; width?: number; height?: number; value?: string; index?: number };
                  if (index === undefined || !labelled.has(index)) return null;
                  const up = (data[index]?.value ?? 0) >= 0;
                  /* recharts hands a bar below the axis either as (y at the
                     axis, negative height) or (y at the bar's bottom, positive
                     height) depending on the version — so the label sits off
                     whichever edge is the far one, never on the bar itself */
                  const y0 = y || 0, y1 = (y || 0) + (h || 0);
                  const ty = up ? Math.min(y0, y1) - 5 : Math.max(y0, y1) + 12;
                  return (
                    <text x={(x || 0) + (width || 0) / 2} y={ty} textAnchor="middle" className={cx("font-mono", up ? "fill-text-success-primary" : "fill-text-error-primary")} fontSize={11}>
                      {value}
                    </text>
                  );
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {groups ? (
        <div className="flex pl-[var(--chart-gutter)] text-center text-2xs text-quaternary" aria-hidden="true">
          {groups.map((g) => (
            <span key={g.label} className="border-t border-secondary pt-1" style={{ flexGrow: g.n, flexBasis: 0 }}>
              {g.label}
            </span>
          ))}
        </div>
      ) : null}
      <figcaption id={id + "-cap"} className="label-mono">
        {unit}
      </figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------- sparkline --- */
/** A metric's shape at 96×24, no axis, one end dot. Omitted where there is
 *  no history rather than drawn flat. */
export function Spark({ values, tone, label, width = 96, height = 24 }: { values: number[]; tone: "s1" | "s2"; label: string; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const data = values.map((v, i) => ({ i, v }));
  const stroke = tone === "s1" ? "[&_path]:stroke-chart-1" : "[&_path]:stroke-chart-2";
  const dot = tone === "s1" ? "fill-chart-1" : "fill-chart-2";
  return (
    <div style={{ width, height }} role="img" aria-label={label} className="shrink-0">
      <LineChart width={width} height={height} data={data} margin={{ top: 3, right: 3, bottom: 3, left: 3 }}>
        <Line type="monotone" dataKey="v" dot={false} strokeWidth={2} isAnimationActive={false} className={stroke} activeDot={false} />
        <Line
          dataKey="v"
          stroke="none"
          isAnimationActive={false}
          dot={(p) => {
            const { cx: x, cy, index } = p as { cx?: number; cy?: number; index?: number };
            if (index !== data.length - 1) return <g key={index} />;
            return <circle key={index} cx={x} cy={cy} r={2.5} className={dot} />;
          }}
        />
      </LineChart>
    </div>
  );
}

/* --------------------------------------------------------------- funnel --- */
export interface Stage {
  key: string;
  label: string;
  value: number;
  note?: string;
}
const ORDINAL = ["bg-chart-seq-5", "bg-chart-seq-4", "bg-chart-seq-3", "bg-chart-seq-2", "bg-chart-seq-1"];

/** Ordered stages as horizontal bars on an ordinal ramp; the drop between
 *  stages is stated rather than inferred. */
export function FunnelChart({ stages, unit }: { stages: Stage[]; unit: string }) {
  const top = Math.max(1, ...stages.map((s) => s.value));
  return (
    <figure className="flex min-w-0 flex-col gap-2">
      <ol className="flex flex-col gap-2">
        {stages.map((s, i) => {
          const prev = i ? stages[i - 1].value : 0;
          const delta = i ? (prev ? Math.round((s.value / prev) * 100) + "% of previous" : "previous stage empty") : "—";
          const row = (
            <li
              key={s.key}
              className="grid grid-cols-[minmax(6rem,10rem)_1fr_auto] items-center gap-3 rounded-md outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2"
              tabIndex={0}
              aria-label={s.label + ": " + s.value + (i && prev ? ", " + delta : "")}
            >
              <span className="truncate text-sm text-secondary">{s.label}</span>
              <span className="h-5 overflow-hidden rounded-[3px] bg-secondary">
                <i className={cx("block h-full rounded-r-[3px]", ORDINAL[Math.min(i, ORDINAL.length - 1)])} style={{ width: pctOf(s.value, top) + "%" }} />
              </span>
              <span className="flex flex-col items-end leading-tight">
                <span className="text-sm font-medium text-primary tnum">{fmt(s.value)}</span>
                <span className="text-2xs text-quaternary">{delta}</span>
              </span>
            </li>
          );
          return s.note ? (
            <UITooltip key={s.key} title={s.note} placement="top">
              <TooltipTrigger className="w-full text-left">{row}</TooltipTrigger>
            </UITooltip>
          ) : (
            row
          );
        })}
      </ol>
      <figcaption className="label-mono">{unit}</figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------- bar rows --- */
export interface BarRow {
  key: string;
  label: ReactNode;
  value: number;
  /** `o1..o5` an ordinal step, `s1..s8` a slot, `st-ok|warn|bad|mute` a status */
  tone?: string;
  hint?: ReactNode;
  title?: string;
}
const ROW_TONE: Record<string, string> = {
  s1: "bg-chart-1",
  s2: "bg-chart-2",
  s3: "bg-chart-3",
  s4: "bg-chart-4",
  s5: "bg-chart-5",
  s6: "bg-chart-6",
  s7: "bg-chart-7",
  s8: "bg-chart-8",
  o1: "bg-chart-seq-5",
  o2: "bg-chart-seq-4",
  o3: "bg-chart-seq-3",
  o4: "bg-chart-seq-2",
  o5: "bg-chart-seq-1",
  "st-ok": "bg-utility-green-500",
  "st-warn": "bg-utility-yellow-500",
  "st-bad": "bg-utility-red-500",
  "st-mute": "bg-utility-neutral-400",
};

/** Horizontal bars comparing magnitude across classes — horizontal because the
 *  category names are words. */
export function BarRows({ rows, unit, max }: { rows: BarRow[]; unit?: string; max?: number }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <figure className="flex min-w-0 flex-col gap-2">
      <ol className="flex flex-col gap-2">
        {rows.map((r) => {
          const row = (
            <li key={r.key} className="grid grid-cols-[minmax(6rem,11rem)_1fr_auto] items-center gap-3 rounded-md outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2" tabIndex={r.title ? 0 : undefined}>
              <span className="min-w-0 truncate text-sm text-secondary">{r.label}</span>
              <span className="h-4 overflow-hidden rounded-[3px] bg-secondary">
                <i className={cx("block h-full rounded-r-[3px]", ROW_TONE[r.tone || "s1"] || ROW_TONE.s1)} style={{ width: pctOf(r.value, top) + "%" }} />
              </span>
              <span className="flex flex-col items-end leading-tight">
                <span className="text-sm font-medium text-primary tnum">{fmt(r.value)}</span>
                {r.hint ? <span className="text-2xs text-quaternary">{r.hint}</span> : null}
              </span>
            </li>
          );
          return r.title ? (
            <UITooltip key={r.key} title={r.title} placement="top">
              <TooltipTrigger className="w-full text-left">{row}</TooltipTrigger>
            </UITooltip>
          ) : (
            row
          );
        })}
      </ol>
      {unit ? <figcaption className="label-mono">{unit}</figcaption> : null}
    </figure>
  );
}

/* ------------------------------------------------------------- heatmap --- */
export interface CohortRow {
  cohort: string;
  label: string;
  size: number;
  retained: (number | null)[];
}
/** Three buckets, not a continuous gradient; `null` is a month that has not
 *  happened yet — an explicit gap, never a zero. */
const bucket = (v: number) => (v >= 0.95 ? 3 : v >= 0.88 ? 2 : 1);
const HEAT = ["", "bg-chart-seq-1 text-secondary", "bg-chart-seq-3 text-white", "bg-chart-seq-5 text-white"];

export function CohortHeat({ rows }: { rows: CohortRow[] }) {
  const months = rows[0]?.retained.length || 0;
  return (
    <figure className="flex min-w-0 flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-1 text-xs">
          <thead>
            <tr className="label-mono">
              <th scope="col" className="px-1 pb-1 text-left font-medium">
                Cohort
              </th>
              <th scope="col" className="px-1 pb-1 text-right font-medium">
                Size
              </th>
              {Array.from({ length: months }, (_, i) => (
                <th scope="col" key={i} className="px-1 pb-1 text-center font-medium">
                  M{i}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.cohort}>
                <th scope="row" className="px-1 text-left text-sm font-medium whitespace-nowrap text-secondary">
                  {r.label}
                </th>
                <td className="px-1 text-right text-sm text-tertiary tnum">{r.size}</td>
                {r.retained.map((v, i) => (
                  <td key={i} className="p-0">
                    {v === null ? (
                      <span className="flex h-7 w-full items-center justify-center rounded-[3px] bg-secondary text-quaternary" title="Not reached yet for this cohort">
                        ·
                      </span>
                    ) : (
                      <span className={cx("flex h-7 w-full items-center justify-center rounded-[3px] font-mono tnum", HEAT[bucket(v)])} title={r.label + " · month " + i + " · " + Math.round(v * 100) + "% still entitled"}>
                        {Math.round(v * 100)}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-tertiary">
        <span className="label-mono">share still entitled</span>
        <span className="inline-flex items-center gap-1.5">
          <i className="block size-2.5 rounded-[2px] bg-chart-seq-1" />
          under 88%
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="block size-2.5 rounded-[2px] bg-chart-seq-3" />
          88–94%
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="block size-2.5 rounded-[2px] bg-chart-seq-5" />
          95% and up
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="block size-2.5 rounded-[2px] bg-secondary" />
          not reached yet
        </span>
      </figcaption>
    </figure>
  );
}
