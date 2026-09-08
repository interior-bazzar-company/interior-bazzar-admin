/* =============================================================================
   Overview — the small parts. Nothing here computes; it renders what
   derive.ts already decided, through the panel's own primitives.
   ============================================================================= */
import type { ReactNode } from "react";
import { Icon, InfoDot, Tile } from "../../ui";
import type { TileProps } from "../../ui";
import { inr } from "../../ui/format";
import { go } from "../../ui/nav";
import { metric, pctChange, ptsChange } from "./derive";
import type { Tone } from "./derive";
import type { Clock } from "./store";

/** The ⓘ. Every complex figure carries one, and the text comes from
 *  content/overview/metrics.json so a definition is written once. */
export function Tip({ k }: { k: string }) {
  const m = metric(k);
  if (!m) return null;
  return (
    <InfoDot label={"About " + m.label}>
      <b>{m.label}</b>
      {m.what}
      <span className="ov-tip-row"><em>How</em>{m.how}</span>
      <span className="ov-tip-row"><em>Includes</em>{m.includes}</span>
      <span className="ov-tip-row"><em>Period</em>{m.period}</span>
    </InfoDot>
  );
}

/** Which clock a section ran on. Live sources say so; seeds say as-of. */
export function Stamp({ clock, period }: { clock: Clock; period?: string }) {
  return (
    <span className={"ov-stamp " + clock.kind} title={clock.kind === "seed" ? "Frontend-first records on their own clock" : "Read from the server"}>
      <i />{clock.label}{period ? " · " + period : ""}
    </span>
  );
}

/** A section: the reading-order head, then whatever it holds. */
export function Section({ id, title, desc, tip, right, children }: {
  id: string; title: ReactNode; desc?: ReactNode; tip?: string; right?: ReactNode; children: ReactNode;
}) {
  return (
    <section className="ov-sec" id={id} aria-labelledby={id + "-h"}>
      <div className="sh">
        <h2 id={id + "-h"}>{title}{tip ? <Tip k={tip} /> : null}</h2>
        {desc ? <span className="d">{desc}</span> : null}
        {right ? <span className="r">{right}</span> : null}
      </div>
      {children}
    </section>
  );
}

/** A source that is not in this session's access. Absent is the rule for a
 *  nav row; a section is different, because the page's reading order would
 *  have a hole in it that looks like a bug. So it says what is missing. */
export function Gone({ what, needs }: { what: string; needs: string }) {
  return (
    <div className="ov-gone">
      <Icon name="shield" size="sm" />
      <span><b>{what}</b> is not in your access — it needs {needs}.</span>
    </div>
  );
}

/** A figure that cannot be drawn, and why. Never a zero, never an empty axis. */
export function Empty({ title, why, tone }: { title: ReactNode; why?: ReactNode; tone?: "ok" | "mute" }) {
  return (
    <div className={"ov-empty" + (tone ? " " + tone : "")}>
      <b>{title}</b>
      {why ? <span>{why}</span> : null}
    </div>
  );
}

/** A tile while its source is answering: the label stays, the figure is a bar. */
export function Loading({ k, tip }: { k: ReactNode; tip?: string }) {
  return <Tile k={<>{k}{tip ? <Tip k={tip} /> : null}</>} v={<span className="sk ov-sk" aria-hidden="true" />} tone="mute" />;
}

/** One KPI. The delta is judged per metric by `good` — a rising figure is not
 *  always good news — and the period it is measured against is always
 *  printed, because "▲ 11%" on its own is unreadable.
 *
 *  THE LINK IS AN OVERLAY, NOT THE TILE. `Tile` with `to` renders the whole
 *  tile as a <button>, and this tile carries a second button — the ⓘ — and
 *  sometimes a third (Retry). A button inside a button is invalid HTML and
 *  React says so in the console. So the tile stays a <div>, and a full-size
 *  transparent button sits UNDER it as its first sibling: the whole surface
 *  still opens the module, the ⓘ and Retry stack above it, and every control
 *  is its own element in the tab order. */
export function Kpi({ k, tip, v, s, now, before, kind, good, of, to, foot, tone }: {
  k: string; tip?: string; v: ReactNode; s?: ReactNode;
  now?: number | null; before?: number | null; kind?: "pct" | "pts" | "n"; good?: "up" | "down";
  of?: ReactNode; to?: string; foot?: ReactNode; tone?: string;
}) {
  let delta: TileProps["delta"];
  if (now !== undefined && before !== undefined && now !== null && before !== null) {
    const ch = kind === "pts" ? ptsChange(now, before) : kind === "n" ? now - before : pctChange(now, before);
    if (ch === null) delta = { dir: "flat", text: "no prior", of };
    else {
      const dir = ch > 0 ? "up" : ch < 0 ? "down" : "flat";
      const text = kind === "pts" ? Math.abs(ch).toFixed(1) + " pts" : kind === "n" ? String(Math.abs(ch)) : Math.abs(ch).toFixed(1) + "%";
      /* `.delta.up` is green and `.delta.down` red in the theme; when down is
         the good direction the classes swap so the colour follows the news. */
      const cls = dir === "flat" ? "flat" : (dir === "up") === ((good || "up") === "up") ? "up" : "down";
      delta = { dir: cls, text: <span className={"ov-arrow " + dir}>{text}</span>, of };
    }
  }
  const tile = <Tile k={<>{k}{tip ? <Tip k={tip} /> : null}</>} v={v} s={s} delta={delta} foot={foot} tone={tone} />;
  if (!to) return tile;
  return (
    <div className="ov-kpi">
      <button type="button" className="ov-kpi-link" aria-label={"Open " + k} data-go={to} onClick={() => go(to)} />
      {tile}
    </div>
  );
}

/** Props for a table row that opens a record: pointer AND keyboard. A row
 *  that only answers to a click is unreachable from the keyboard, and the
 *  shared `.tbl tr.clickable` styling says nothing about focus. */
export function rowLink(to: string) {
  return {
    className: "clickable", tabIndex: 0, "data-go": to,
    onClick: () => go(to),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(to); }
    },
  };
}

/** Paise, compact on the face and exact on hover. */
export function Money({ paise, compact = true }: { paise: number | null | undefined; compact?: boolean }) {
  return <span className="tnum" title={paise === null || paise === undefined ? undefined : inr(paise)}>{inr(paise, { compact })}</span>;
}

/** Status dot for the health strip and the attention rail. */
export function Dot({ tone }: { tone: Tone | "info" }) {
  return <i className={"ov-dot " + tone} aria-hidden="true" />;
}

/** A row that goes somewhere. A button so it is keyboard-reachable; the hash
 *  is on `data-go` like every other link in the panel. */
export function Go({ to, children, cls }: { to: string; children: ReactNode; cls?: string }) {
  return (
    <button type="button" className={"ov-go" + (cls ? " " + cls : "")} data-go={to} onClick={() => go(to)}>
      {children}<Icon name="chevr" size="xs" />
    </button>
  );
}
