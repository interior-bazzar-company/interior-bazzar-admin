/* =============================================================================
   Overview — the small parts. Nothing here computes; it renders what
   derive.ts already decided, through the panel's own shared components and
   the utility vocabulary. No stylesheet, no class of its own: a drawing this
   module needs and the shared layer does not have is a COMPONENT in this file.
   ============================================================================= */
import type { KeyboardEvent, ReactNode } from "react";
import { cx } from "@/utils/cx";
import { Alert, Button, EmptyState, Icon, InfoDot, Pill, SectionHead, Skeleton, Tile, iconOf } from "../../ui";
import type { TileProps } from "../../ui";
import { inr } from "../../ui/format";
import { go } from "../../ui/nav";
import { metric, pctChange, ptsChange } from "./derive";
import type { AttentionItem, HealthCell, Tone } from "./derive";
import type { Clock } from "./store";

/* --------------------------------------------------------------- the ⓘ --- */
/** Every complex figure carries one, and the text comes from
 *  content/overview/metrics.json so a definition is written once. A PRESS,
 *  not a hover: it explains rather than labels, and it stays open to be read. */
export function Tip({ k }: { k: string }) {
  const m = metric(k);
  if (!m) return null;
  const rows: [string, string][] = [["How", m.how], ["Includes", m.includes], ["Period", m.period]];
  return (
    <InfoDot label={"About " + m.label}>
      <b>{m.label}</b>
      <p>{m.what}</p>
      {rows.map(([t, v]) => (
        <span key={t} className="mt-2 block border-t border-secondary pt-2">
          <span className="label-mono block">{t}</span>
          {v}
        </span>
      ))}
    </InfoDot>
  );
}

/* ------------------------------------------------------------ the clock --- */
/** Which clock a section ran on. Live sources say so; seeds say as-of. The
 *  dot's hue is the KIND of source (sky = live, indigo = the system's own
 *  seed) and never a judgement, so it cannot be read as a status. */
export function Stamp({ clock, period }: { clock: Clock; period?: string }) {
  return (
    <span className="label-mono inline-flex items-center gap-1.5 whitespace-nowrap">
      <i aria-hidden="true" className={cx("size-1.5 shrink-0 rounded-full", clock.kind === "live" ? "bg-utility-sky-500" : "bg-utility-indigo-500")} />
      {clock.label}
      {period ? " · " + period : ""}
    </span>
  );
}

/* ---------------------------------------------------------- the section --- */
/** A section: the reading-order head, then whatever it holds. The id is the
 *  scroll target the header's "needs attention" jump uses, so it carries the
 *  scroll margin that keeps it clear of the sticky topbar. */
export function Section({ id, title, desc, tip, right, children }: {
  id: string; title: ReactNode; desc?: ReactNode; tip?: string; right?: ReactNode; children: ReactNode;
}) {
  return (
    <section className="scroll-mt-24" id={id} aria-labelledby={id + "-h"}>
      <SectionHead
        title={<span id={id + "-h"} className="inline-flex items-center gap-2">{title}{tip ? <Tip k={tip} /> : null}</span>}
        desc={desc}
        right={right}
      />
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------- the gaps --- */
/** A source that is not in this session's access. Absent is the rule for a
 *  nav row; a section is different, because the page's reading order would
 *  have a hole in it that looks like a bug. So it says what is missing. */
export function Gone({ what, needs }: { what: string; needs: string }) {
  return (
    <Alert tone="info" ico="shield" title={"No access to " + what}>
      This section needs {needs}.
    </Alert>
  );
}

/** A figure that cannot be drawn, and why. Never a zero, never an empty axis.
 *  Flat, because every one of these sits inside a frame that already has an
 *  edge — a chart frame, a card, a table. */
export function Empty({ title, why, tone }: { title: ReactNode; why?: ReactNode; tone?: "ok" | "mute" }) {
  return <EmptyState flat className="py-8" icon={tone === "ok" ? "checkcircle" : "inbox"} title={title} body={why} />;
}

/** A tile while its source is answering: the label stays, the figure is a bar. */
export function Loading({ k, tip }: { k: ReactNode; tip?: string }) {
  return (
    <Tile
      k={<>{k}{tip ? <Tip k={tip} /> : null}</>}
      v={<Skeleton className="my-1 h-6 rounded-md" w="62%" />}
      s={<Skeleton className="h-2.5" w="40%" />}
    />
  );
}

/** A plot while its source is answering. Matches the plot's own height so the
 *  section does not jump when the data lands. */
export function PlotSkeleton({ tall }: { tall?: boolean }) {
  return <Skeleton className={cx("w-full rounded-lg", tall ? "h-70" : "h-50")} />;
}

/* ---------------------------------------------------------------- a KPI --- */
/** One KPI, drawn by the shared `Tile`. The delta is judged per metric by
 *  `good` — a rising figure is not always good news — and the period it is
 *  measured against is always printed, because "▲ 11%" on its own is
 *  unreadable.
 *
 *  THE LINK IS AN OVERLAY, NOT THE TILE. `Tile` with `to` renders the whole
 *  tile as a <button>, and this tile carries a second button — the ⓘ — and
 *  sometimes a third (Retry). A button inside a button is invalid HTML and
 *  React says so in the console. So the tile stays a <div> and a full-size
 *  transparent button sits UNDER it: the whole surface still opens the
 *  module, the ⓘ stacks above it, and every control is its own tab stop. */
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
      /* The ARROW follows the number and the COLOUR follows the news, so a
         fall in something that should fall reads green with a down arrow. */
      delta = { dir, text, of, good: dir === "flat" ? undefined : (dir === "up") === ((good || "up") === "up") };
    }
  }
  const label = tip ? (
    <span className="inline-flex items-center gap-1.5">
      {k}
      <span className="relative z-20">
        <Tip k={tip} />
      </span>
    </span>
  ) : (
    k
  );
  const tile = <Tile className="h-full" k={label} v={v} s={s} delta={delta} foot={foot} tone={tone} />;
  if (!to) return tile;
  return (
    <div className="group/kpi relative h-full min-w-0">
      <button
        type="button"
        className="absolute inset-0 z-10 cursor-pointer rounded-xl outline-focus-ring focus-visible:outline-2 focus-visible:outline-offset-2"
        aria-label={"Open " + k}
        data-go={to}
        onClick={() => go(to)}
      />
      <div className="pointer-events-none h-full transition duration-100 group-hover/kpi:[&>*]:ring-primary">{tile}</div>
    </div>
  );
}

/* ------------------------------------------------------------- the bits --- */
/** Paise, compact on the face and exact on hover. */
export function Money({ paise, compact = true }: { paise: number | null | undefined; compact?: boolean }) {
  return (
    <span className="font-mono tnum" title={paise === null || paise === undefined ? undefined : inr(paise)}>
      {inr(paise, { compact })}
    </span>
  );
}

const DOT: Record<string, string> = {
  ok: "bg-utility-green-500",
  warn: "bg-utility-yellow-500",
  bad: "bg-utility-red-500",
  info: "bg-utility-blue-500",
  mute: "bg-utility-neutral-400",
};
/** Status dot for the health strip. Never the only carrier of the meaning —
 *  the words beside it say the same thing. */
export function Dot({ tone }: { tone: Tone | "info" }) {
  return <i aria-hidden="true" className={cx("inline-block size-2 shrink-0 rounded-full", DOT[tone] || DOT.mute)} />;
}

/** A link out of a section, into the module that owns the record. */
export function Go({ to, children, cls }: { to: string; children: ReactNode; cls?: string }) {
  return (
    <Button
      size="sm"
      color={cls === "warn" ? "link-gray" : "link-color"}
      iconTrailing={iconOf("chevr")}
      className={cls === "warn" ? "text-warning-primary hover:text-warning-primary" : undefined}
      data-go={to}
      onClick={() => go(to)}
    >
      {children}
    </Button>
  );
}

/** Props for a table row that opens a record: pointer AND keyboard. A row
 *  that only answers to a click is unreachable from the keyboard, and the
 *  shared row styling says nothing about focus. */
export function rowLink(to: string) {
  return {
    className: "clickable outline-focus-ring focus-visible:outline-2 focus-visible:-outline-offset-2",
    tabIndex: 0,
    "data-go": to,
    onClick: () => go(to),
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        go(to);
      }
    },
  };
}

/* ============================================ the module's own drawings == */

/** THE HEALTH STRIP — four one-line verdicts, each a way into the list that
 *  produced it. Not a stat strip: there is no number to press, the reading IS
 *  the sentence, and the dot only repeats what the words already say. */
export function HealthStrip({ cells }: { cells: HealthCell[] }) {
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {cells.map((h) => (
        <li key={h.key} className="min-w-0">
          <button
            type="button"
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg bg-primary px-3 py-2.5 text-left ring-1 ring-secondary outline-focus-ring transition duration-100 hover:ring-primary focus-visible:outline-2 focus-visible:outline-offset-2"
            data-go={h.to}
            onClick={() => go(h.to)}
          >
            <Dot tone={h.tone} />
            <span className="shrink-0 text-sm font-medium text-primary">{h.label}</span>
            <span className="truncate text-xs text-tertiary">{h.why}</span>
            <Icon name="chevr" size="xs" className="ml-auto shrink-0 text-fg-quaternary" />
          </button>
        </li>
      ))}
    </ul>
  );
}

const LINE_TONE: Record<string, string> = {
  ok: "text-success-primary",
  warn: "text-warning-primary",
  bad: "text-error-primary",
};
/** ONE OPERATIONS LINE — a count and the queue it counts. A zero is drawn
 *  quiet rather than dropped: "nothing overdue" is the news. */
export function StatLine({ label, n, to, tone }: { label: ReactNode; n: number; to: string; tone?: "ok" | "warn" | "bad" }) {
  return (
    <button
      type="button"
      className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left outline-focus-ring transition duration-100 hover:bg-primary_hover focus-visible:outline-2 focus-visible:-outline-offset-2"
      data-go={to}
      onClick={() => go(to)}
    >
      <span className={cx("truncate text-sm", n ? "text-secondary" : "text-tertiary")}>{label}</span>
      <b className={cx("shrink-0 text-sm font-semibold tnum", n ? LINE_TONE[tone || ""] || "text-primary" : "font-medium text-quaternary")}>{n}</b>
    </button>
  );
}

const RAIL: Record<string, string> = { bad: "rail-error", warn: "rail-warning", info: "rail-info" };
const SEVERITY: Record<string, string> = { bad: "Urgent", warn: "Watch", info: "Note" };
const AREA: Record<string, string> = { deals: "Deals", finance: "Finance", team: "Team" };

/** ONE ATTENTION ROW — the severity as a stripe you can find without reading,
 *  what it is, what it is worth, and exactly ONE thing to do about it.
 *
 *  THE EDGE IS A BORDER, NOT A RING. The exception rail is an INSET BOX-SHADOW,
 *  and so is a ring; on one element the later declaration simply wins and the
 *  row loses its edge. A border is a different property, so both draw.
 *
 *  The three trailing columns are fixed widths so a list of ten rows scans
 *  DOWN as well as across: every figure ends on the same line, every pill
 *  starts on the same line, every action button shares one left edge. */
export function AttnRow({ item }: { item: AttentionItem }) {
  return (
    <div className={cx("flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-secondary bg-primary py-3 pr-3 pl-4", RAIL[item.severity])}>
      <div className="min-w-0 flex-1 basis-64">
        <div className="truncate text-sm font-medium text-primary">{item.title}</div>
        <div className="truncate text-xs text-tertiary">
          {AREA[item.area]} · {item.sub}
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-end gap-3">
        {/* The figure takes the width its own words need and never wraps; the
            two columns after it are fixed, so every pill and every action
            still lands on the same vertical line down the list. */}
        <span className="whitespace-nowrap text-right font-mono text-xs text-secondary tnum">{item.metric}</span>
        <span className="flex w-20 shrink-0">
          <Pill xs dot tone={item.severity} text={SEVERITY[item.severity]} />
        </span>
        <Button className="min-w-36" size="xs" color="secondary" iconTrailing={iconOf("chevr")} data-go={item.to} onClick={() => go(item.to)}>
          {item.toLabel}
        </Button>
      </div>
    </div>
  );
}
