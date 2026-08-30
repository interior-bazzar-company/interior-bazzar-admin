/* =============================================================================
   Users Management — the chart kit.
   -----------------------------------------------------------------------------
   Four forms, each picked from the data's job rather than from what looks good:

     ColumnChart   trend over time, several distinct series   → categorical
     FunnelChart   ordered stages                             → ordinal ramp
     BarRows       compare magnitude across classes           → ordinal / status
     CohortHeat    a grid of magnitudes                       → sequential

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
