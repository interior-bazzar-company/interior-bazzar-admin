/* =============================================================================
   Users Management — the chart kit.
   -----------------------------------------------------------------------------
   Seven forms, each picked from the data's job rather than from what looks good:

     ColumnChart    trend over time, several distinct series  → categorical
     Waterfall      how a period reached its closing figure   → in / out / total
     SignedColumns  one series against zero, sign is the news → status
     Spark          a metric's shape, inline on a card        → categorical
     FunnelChart    ordered stages                            → ordinal ramp
     BarRows        compare magnitude across classes          → ordinal / status
     CohortHeat     a grid of magnitudes                      → sequential

   NO CHART LIBRARY. `recharts` is a declared dependency that nothing imports
   and that is not in the bundle — pulling it in for four simple forms would add
   about a hundred kilobytes gzipped to a bundle already over the size warning,
   and it would theme awkwardly: this panel's colours are CSS custom properties
   that flip with the viewer's theme, and a library that wants hex props fights
   that. These are CSS, so they are responsive without viewBox arithmetic and
   dark mode is a token swap rather than a second palette.

   THE COLOURS ARE NOT EYEBALLED. Every value comes from a token in
   admin-theme.css and every set was run through the palette validator, in both
   modes, before any of this was written — see the block at the top of the chart
   section in users.css for the results. Categorical slots are assigned in fixed
   order and never cycled; ordered things (funnel stages, plan tiers, retention)
   take a one-hue ramp so the reader sees the order in the colour; membership
   states wear the reserved status tokens and always carry their label.

   Every chart ships a legend when it has two or more series, selective direct
   labels rather than a number on every mark, and a hover/focus tooltip. Bars
   are capped thin, rounded at the data end and square at the baseline, and
   separated by a 2px gap in the surface colour rather than by a stroke.
   ============================================================================= */
import { useId } from "react";
import type { ReactNode } from "react";

/* ------------------------------------------------------------- scaling --- */

/** A round axis maximum and its ticks. Axis ticks carry the values that are not
 *  directly labelled, so they have to land on numbers a reader can hold — 200,
 *  not 187. */
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

/* --------------------------------------------------------- column chart --- */

export interface Series { key: string; label: string; slot: 1 | 2 | 3 }
export interface ColumnPoint { key: string; label: string; values: Record<string, number> }

/**
 * Grouped columns: several distinct series over time.
 *
 * Grouped rather than stacked on purpose. Stacking would imply the three
 * quantities sum to something meaningful, and the one thing this module has to
 * keep straight is that renewals are NOT part of first-time members. Side by
 * side off a shared baseline says "compare these", which is the actual job.
 */
export function ColumnChart({ series, points, unit, labelSeries }: {
  series: Series[];
  points: ColumnPoint[];
  unit: string;
  /** Direct-label ONE series, in the final group only.
   *
   *  Not all three. Three labels over a three-column group are ~20px of text
   *  each in a group that can be 70px wide at container widths this panel
   *  actually hits, and a label that will not fit must not be placed — the
   *  skill's rule and the obvious one. Labelling the tallest series anchors the
   *  scale without any chance of collision; the tiles under the chart carry the
   *  current period for all three at a size that cannot collide, and the
   *  tooltip carries every group. */
  labelSeries?: string;
}) {
  const id = useId();
  const peak = Math.max(1, ...points.flatMap((p) => series.map((s) => p.values[s.key] || 0)));
  const scale = niceScale(peak);
  /* Max at the top. Both the ticks and the rules are positioned from this one
     reversed list, at the same percentages, so they cannot drift apart. */
  const ticks = scale.steps.slice().reverse();
  const at = (i: number) => (ticks.length > 1 ? (i / (ticks.length - 1)) * 100 : 0);

  return (
    <figure className="ch-chart" aria-labelledby={id + "-cap"}>
      <Legend series={series} />
      <div className="ch-chartbody">
        {/* Ticks and gridlines are absolutely positioned on the SAME
            percentages and both centred on their own line. Distributing them
            with two independent `space-between` flex columns looked right and
            was not: the label boxes have height and the rules do not, so only
            the middle label ever landed on its rule. */}
        <div className="ch-yaxis" aria-hidden="true">
          {ticks.map((v, i) => (
            <span key={v} className="tnum" style={{ top: at(i) + "%" }}>
              {v.toLocaleString("en-IN")}
            </span>
          ))}
        </div>
        <div className="ch-plotarea">
          {ticks.map((v, i) => <i key={v} className="ch-rule" style={{ top: at(i) + "%" }} />)}
          <div className="ch-groups">
            {points.map((p, gi) => (
              <div className="ch-group" key={p.key} tabIndex={0}
                aria-label={p.label + ": " + series.map((s) =>
                  s.label + " " + (p.values[s.key] || 0)).join(", ")}>
                <div className="ch-cols">
                  {series.map((s) => {
                    const v = p.values[s.key] || 0;
                    const label = labelSeries === s.key && gi === points.length - 1;
                    return (
                      <span key={s.key} className={"ch-col s" + s.slot}
                        style={{ height: pctOf(v, scale.max) + "%" }}>
                        {label ? <em className="tnum">{v.toLocaleString("en-IN")}</em> : null}
                      </span>
                    );
                  })}
                </div>
                <span className="ch-tip" role="tooltip">
                  <b>{p.label}</b>
                  {series.map((s) => (
                    <span key={s.key}>
                      <i className={"sw s" + s.slot} />
                      {s.label}
                      <em className="tnum">{(p.values[s.key] || 0).toLocaleString("en-IN")}</em>
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="ch-xband" aria-hidden="true">
        {points.map((p) => <span key={p.key}>{p.label}</span>)}
      </div>
      <figcaption id={id + "-cap"} className="ch-unit">{unit}</figcaption>
    </figure>
  );
}

function Legend({ series }: { series: Series[] }) {
  /* A legend is the dependable identity channel and is always present for two
     or more series. One series needs none — the section head names it. */
  if (series.length < 2) return null;
  return (
    <div className="ch-legend2">
      {series.map((s) => (
        <span key={s.key}><i className={"sw s" + s.slot} />{s.label}</span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ waterfall --- */

export interface WaterStep {
  key: string;
  label: string;
  /** Under the label — a count, a caveat, whatever the row is worth saying. */
  sub?: string;
  /** SIGNED, in the chart's own unit. `total` steps ignore the sign and are
   *  drawn from the baseline to the running total instead. */
  value: number;
  /** What to PRINT, when the plotted number is a scaled one.
   *
   *  Geometry and legibility want different units here: an axis gutter is 38px
   *  and cannot hold `6,77,320`, while a bar's own label has the whole column
   *  and should carry the exact figure rather than a rounded one. So the
   *  caller scales `value` for the axis and passes the real amount here. */
  display?: string;
  kind: "in" | "out" | "total";
}

/**
 * A waterfall: how a period got from nothing to its closing figure.
 *
 * WHY THIS AND NOT A ROW OF TILES. Seven tiles side by side are seven facts
 * with no relationship drawn between them, and the closing figure's own caption
 * has to spell the arithmetic out in words — "collected + other in − salary −
 * spend − refunds". A waterfall IS that sentence, so the sentence comes off.
 *
 * A ZERO STEP IS DRAWN, not skipped. A month whose salary run has not been paid
 * yet is the most important thing on this chart and a tile reading ₹0 buries
 * it: here it is a visible flat span with the connector running straight
 * through, which reads as "nothing happened here" rather than as "nothing is
 * owed".
 *
 * The connectors are what make it legible — without them a floating bar is just
 * a bar at a strange height — so they are drawn from each step's closing level
 * to the next step's opening one, never inferred by the eye.
 */
export function Waterfall({ steps, unit }: { steps: WaterStep[]; unit: string }) {
  const id = useId();

  /* Running totals first: every geometry below is read off these, so the bar,
     the connector and the tooltip cannot disagree about where a step sits. */
  let run = 0;
  const laid = steps.map((s) => {
    const from = s.kind === "total" ? 0 : run;
    const to = s.kind === "total" ? run : run + (s.kind === "out" ? -Math.abs(s.value) : Math.abs(s.value));
    if (s.kind !== "total") run = to;
    return { s, from, to, lo: Math.min(from, to), hi: Math.max(from, to) };
  });

  const peak = Math.max(1, ...laid.map((l) => l.hi));
  const scale = niceScale(peak);
  const y = (v: number) => (v / scale.max) * 100;
  const ticks = scale.steps.slice().reverse();
  const at = (i: number) => (ticks.length > 1 ? (i / (ticks.length - 1)) * 100 : 0);

  return (
    <figure className="ch-chart" aria-labelledby={id + "-cap"}>
      <div className="ch-chartbody">
        <div className="ch-yaxis" aria-hidden="true">
          {ticks.map((v, i) => (
            <span key={v} className="tnum" style={{ top: at(i) + "%" }}>{v.toLocaleString("en-IN")}</span>
          ))}
        </div>
        <div className="ch-plotarea">
          {ticks.map((v, i) => <i key={v} className="ch-rule" style={{ top: at(i) + "%" }} />)}
          <div className="ch-groups ch-wf">
            {laid.map((l, i) => {
              const next = laid[i + 1];
              return (
                <div className="ch-group" key={l.s.key} tabIndex={0}
                  aria-label={l.s.label + ": " + (l.s.display ?? l.s.value.toLocaleString("en-IN"))}>
                  <div className="ch-wfcol">
                    {/* The connector leaves at THIS step's closing level and is
                        the next step's opening level by construction. */}
                    {next && next.s.kind !== "total"
                      ? <i className="ch-wfjoin" style={{ bottom: y(l.to) + "%" }} />
                      : null}
                    <span className={"ch-wfbar k-" + l.s.kind}
                      style={{
                        bottom: y(l.lo) + "%",
                        height: Math.max(l.hi === l.lo ? 0 : 1.2, y(l.hi) - y(l.lo)) + "%",
                      }}>
                      <em className="tnum">{l.s.display ?? l.s.value.toLocaleString("en-IN")}</em>
                    </span>
                  </div>
                  <span className="ch-tip" role="tooltip">
                    <b>{l.s.label}</b>
                    <span>
                      <i className={"sw k-" + l.s.kind} />
                      {l.s.kind === "total" ? "closing" : l.s.kind === "in" ? "in" : "out"}
                      <em className="tnum">{l.s.display ?? l.s.value.toLocaleString("en-IN")}</em>
                    </span>
                    {/* NO RUNNING TOTAL IN THE TOOLTIP. It was there, and it
                        printed the SCALED number — `728` where the bar beside
                        it said ₹7,27,882 — because the running total is
                        computed from the plotted values and the exact figures
                        only exist per step. A number with no unit beside one
                        with a unit is the kind of thing this page removed
                        elsewhere; the connector already shows where the total
                        stands, which is what the line was for. */}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="ch-xband ch-wfband" aria-hidden="true">
        {laid.map((l) => (
          <span key={l.s.key}>
            {l.s.label}
            {l.s.sub ? <em>{l.s.sub}</em> : null}
          </span>
        ))}
      </div>
      <figcaption id={id + "-cap"} className="ch-unit">{unit}</figcaption>
    </figure>
  );
}

/* ------------------------------------------------------ signed columns --- */

export interface SignedPoint {
  key: string; label: string; value: number;
  /** As on a waterfall step: what to print when `value` is scaled for the axis. */
  display?: string;
}

/**
 * One series over time, drawn against a ZERO RULE with negatives below it.
 *
 * THE ONE PLACE COLOUR ENCODES SIGN rather than identity. Everywhere else in
 * the kit a hue means "which series"; here there is only one series and the
 * whole question is which side of nothing it is on, so ok/bad carry it — and
 * the rule itself, the only axis line the kit draws, is what they are read
 * against.
 *
 * A line chart was the obvious alternative and hides the crossing: a polyline
 * passing through zero looks like any other segment, while a column that flips
 * from below the rule to above it is the event the reader came for.
 *
 * DIRECT LABELS ARE SELECTIVE — the extreme in each direction and the last
 * point, never a number on every column, which at twenty months is twenty
 * collisions.
 */
export function SignedColumns({ points, unit, groups }: {
  points: SignedPoint[];
  unit: string;
  /** Optional spans under the axis: `{label, n}` in order, n = how many points. */
  groups?: { label: string; n: number }[];
}) {
  const id = useId();
  const hi = Math.max(0, ...points.map((p) => p.value));
  const lo = Math.min(0, ...points.map((p) => p.value));
  const span = Math.max(1, hi - lo);
  /* The zero rule sits where zero actually falls in the range, so a month is
     never drawn taller than another month of the same size. */
  const zero = (hi / span) * 100;
  const idxHi = points.reduce((b, p, i) => (p.value > points[b].value ? i : b), 0);
  const idxLo = points.reduce((b, p, i) => (p.value < points[b].value ? i : b), 0);

  return (
    <figure className="ch-chart" aria-labelledby={id + "-cap"}>
      <div className="ch-sgn">
        <i className="ch-sgnzero" style={{ top: zero + "%" }} />
        {points.map((p, i) => {
          const up = p.value >= 0;
          const h = (Math.abs(p.value) / span) * 100;
          const label = i === idxHi || i === idxLo || i === points.length - 1;
          return (
            <div className="ch-sgncol" key={p.key} tabIndex={0}
              aria-label={p.label + ": " + (p.display ?? p.value.toLocaleString("en-IN"))}>
              <span className={"ch-sgnbar " + (up ? "up" : "dn")}
                style={up
                  ? { bottom: 100 - zero + "%", height: Math.max(1, h) + "%" }
                  : { top: zero + "%", height: Math.max(1, h) + "%" }}>
                {label ? <em className={"tnum " + (up ? "up" : "dn")}>{p.display ?? p.value.toLocaleString("en-IN")}</em> : null}
              </span>
              <span className="ch-tip" role="tooltip">
                <b>{p.label}</b>
                <span><i className={"sw " + (up ? "st-ok" : "st-bad")} />net<em className="tnum">{p.display ?? p.value.toLocaleString("en-IN")}</em></span>
              </span>
            </div>
          );
        })}
      </div>
      <div className="ch-xband" aria-hidden="true">
        {points.map((p) => <span key={p.key}>{p.label}</span>)}
      </div>
      {groups ? (
        <div className="ch-sgnbands" aria-hidden="true">
          {groups.map((g) => <span key={g.label} style={{ flexGrow: g.n }}>{g.label}</span>)}
        </div>
      ) : null}
      <figcaption id={id + "-cap"} className="ch-unit">{unit}</figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------- sparkline --- */

/**
 * A metric's shape, at 96×24 with no axis and one end dot.
 *
 * IT IS OMITTED WHERE THERE IS NO HISTORY rather than drawn flat. A single
 * reading rendered as a horizontal line is a claim about stability that the
 * records do not make — the caller passes `null` and the card says "first
 * reading" instead.
 *
 * A delta alone cannot say this: a fall from a one-off spike and a steady
 * decline both print −90.6%, and only the shape tells them apart.
 */
export function Spark({ values, tone, label }: {
  values: number[];
  /** `s1` revenue-ish, `s2` cost-ish — identity, not status. */
  tone: "s1" | "s2";
  label: string;
}) {
  if (values.length < 2) return null;
  const hi = Math.max(...values, 0);
  const lo = Math.min(...values, 0);
  const span = Math.max(1, hi - lo);
  const step = 96 / (values.length - 1);
  const y = (v: number) => 23 - ((v - lo) / span) * 22;
  const pts = values.map((v, i) => (i * step).toFixed(1) + "," + y(v).toFixed(1)).join(" ");
  const last = values[values.length - 1];
  return (
    <svg className={"ch-spark " + tone} width="96" height="24" viewBox="0 0 96 24"
      fill="none" role="img" aria-label={label}>
      <polyline points={pts} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="96" cy={y(last).toFixed(1)} r="2.5" />
    </svg>
  );
}

/* --------------------------------------------------------------- funnel --- */

export interface Stage { key: string; label: string; value: number; note?: string }

/**
 * Ordered stages, as horizontal bars on an ordinal ramp.
 *
 * Not a tapering funnel graphic: those encode the value in a trapezoid's area,
 * which nobody can read, and the width already carries it. The drop between
 * stages is the number people actually want, so it is stated rather than left
 * to be inferred from two bar lengths.
 */
export function FunnelChart({ stages, unit }: { stages: Stage[]; unit: string }) {
  const top = Math.max(1, ...stages.map((s) => s.value));
  return (
    <figure className="ch-chart">
      <div className="ch-rows funnel">
        {stages.map((s, i) => (
          <div className="ch-row" key={s.key} tabIndex={0}
            aria-label={s.label + ": " + s.value + (i ? ", " + Math.round((s.value / stages[i - 1].value) * 100) + "% of the stage before" : "")}>
            <span className="lab">{s.label}</span>
            <span className="track">
              <i className={"fill o" + (i + 1)} style={{ width: pctOf(s.value, top) + "%" }} />
            </span>
            <span className="val tnum">{s.value.toLocaleString("en-IN")}</span>
            <span className="delta">
              {i ? Math.round((s.value / stages[i - 1].value) * 100) + "% of previous" : "—"}
            </span>
            {s.note ? <span className="ch-tip" role="tooltip">{s.note}</span> : null}
          </div>
        ))}
      </div>
      <figcaption className="ch-unit">{unit}</figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------- bar rows --- */

export interface BarRow {
  key: string;
  /** Rendered label. A pill, a plan chip or plain text — identity comes from
   *  the mark beside it, never from colouring the text. */
  label: ReactNode;
  value: number;
  /** `o1..o3` an ordinal step, `st-ok|warn|bad|mute` a reserved status, or
   *  omitted for the single-series hue. */
  tone?: string;
  hint?: ReactNode;
  title?: string;
}

/**
 * Horizontal bars for comparing magnitude across classes.
 *
 * Horizontal because the category names are words, not dates — a column chart
 * would rotate them or truncate them. The value rides the tip of each bar; the
 * hint carries the secondary figure, which is a label and not a second axis.
 */
export function BarRows({ rows, unit, max }: { rows: BarRow[]; unit?: string; max?: number }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <figure className="ch-chart">
      <div className="ch-rows">
        {rows.map((r) => (
          <div className="ch-row" key={r.key} tabIndex={r.title ? 0 : undefined}>
            <span className="lab">{r.label}</span>
            <span className="track">
              <i className={"fill " + (r.tone || "s1")} style={{ width: pctOf(r.value, top) + "%" }} />
            </span>
            <span className="val tnum">{r.value.toLocaleString("en-IN")}</span>
            {r.hint ? <span className="delta">{r.hint}</span> : null}
            {r.title ? <span className="ch-tip" role="tooltip">{r.title}</span> : null}
          </div>
        ))}
      </div>
      {unit ? <figcaption className="ch-unit">{unit}</figcaption> : null}
    </figure>
  );
}

/* ------------------------------------------------------------- heatmap --- */

export interface CohortRow { cohort: string; label: string; size: number; retained: (number | null)[] }

/** Three buckets, not a continuous gradient. A reader cannot decode a
 *  hundred-step ramp to two decimal places, and pretending otherwise is how a
 *  heatmap becomes decoration. `null` is a month that has not happened yet for
 *  that cohort — rendered as an explicit gap, never as a zero. */
const bucket = (v: number) => (v >= 0.95 ? 3 : v >= 0.88 ? 2 : 1);

export function CohortHeat({ rows }: { rows: CohortRow[] }) {
  const months = rows[0]?.retained.length || 0;
  return (
    <figure className="ch-chart">
      <div className="ch-heatwrap">
        <table className="ch-heat">
          <thead>
            <tr>
              <th scope="col">Cohort</th>
              <th scope="col" className="n">Size</th>
              {Array.from({ length: months }, (_, i) => (
                <th scope="col" key={i} className="n">M{i}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.cohort}>
                <th scope="row">{r.label}</th>
                <td className="n tnum">{r.size}</td>
                {r.retained.map((v, i) => (
                  <td key={i} className="n">
                    {v === null
                      ? <span className="ch-cell none" title="Not reached yet for this cohort">·</span>
                      : <span className={"ch-cell h" + bucket(v)}
                          title={r.label + " · month " + i + " · " + Math.round(v * 100) + "% still entitled"}>
                          <span className="tnum">{Math.round(v * 100)}</span>
                        </span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* A sequential fill needs its scale stated; without it the reader is
          guessing what dark means. */}
      <figcaption className="ch-heatkey">
        <span>share still entitled</span>
        <span><i className="sw h1" />under 88%</span>
        <span><i className="sw h2" />88–94%</span>
        <span><i className="sw h3" />95% and up</span>
        <span><i className="sw none" />not reached yet</span>
      </figcaption>
    </figure>
  );
}
