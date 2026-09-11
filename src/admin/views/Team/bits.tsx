/* =============================================================================
   Team — the small drawings this module owns, on the shared tokens.
   -----------------------------------------------------------------------------
   Nothing here holds state or reads the store. They take what they draw, so the
   same `DayBar` renders today's half-finished row and a closed row from three
   weeks ago without knowing which it is looking at.

   EVERY TONE HERE COMES OUT OF THE VOCABULARY, not out of a switch in this
   file. `attendanceStates[].tone` and `workStatuses[].tone` are the source, so
   a status relabelled or re-toned server-side lands without a code edit — and,
   more to the point, there is one place a status colour is decided rather than
   one per component that eventually disagree.

   WHAT IS DRAWN HERE AND WHY IT IS NOT A SHARED PART: a day as a bar, a week as
   five columns, an operation as a launcher tile. Each is a shape only this
   module has, so each is a component on the utilities rather than a class in a
   stylesheet or a new primitive in `ui/`.
   ============================================================================= */
import type { ReactNode } from "react";
import { cx } from "@/utils/cx";
import { Icon, Person, Pill, cap, tagClasses } from "../../ui";
import { go } from "../../ui/nav";
import type {
  AttendanceState, DayRow, Member, Priority, WorkItem, WorkStatus,
} from "./store";
import {
  ATT_STATE, PRIORITY, WORK_STATUS, fmtHM, fmtTime, isDelayed, labelOf, progressOf, toneOf,
} from "./store";

/* ---------------------------------------------------------------- who --- */

export function Who({ m, sub }: { m: Member; sub?: ReactNode }) {
  return <Person name={m.name} sub={sub ?? m.designation} sm />;
}

/* ------------------------------------------------------------- status --- */

export function StatePill({ state }: { state: AttendanceState }) {
  const row = ATT_STATE[state];
  return <Pill text={labelOf(ATT_STATE, state)} tone={row ? row.tone : ""} dot />;
}

export function StatusPill({ status }: { status: WorkStatus }) {
  return <Pill text={labelOf(WORK_STATUS, status)} tone={toneOf(WORK_STATUS, status)} />;
}

export function PriorityChip({ p }: { p: Priority }) {
  /* LOUD ONLY WHEN IT IS LOUD. Low printed nothing already — "not urgent" is
     the default rather than a claim worth making — but Normal, which is also
     the default, printed a filled chip. On a list where most rows are Normal
     that is a column of identical badges saying nothing, sitting beside a stage
     pill and an avatar, and it is what turned the row into confetti: the two
     priorities that SHOULD stop a reader could not out-shout the one that
     shouldn't. Normal is a quiet word now; High and Urgent keep the chip. */
  if (p === "low") return null;
  if (p === "medium") return <span className="text-xs text-quaternary">{labelOf(PRIORITY, p)}</span>;
  return <Pill text={labelOf(PRIORITY, p)} tone={toneOf(PRIORITY, p)} />;
}

const KIND_TONE: Record<string, string> = {
  target: "text-fg-brand-primary",
  milestone: "text-fg-warning-primary",
  task: "text-fg-quaternary",
};

export function KindMark({ kind }: { kind: string }) {
  const ico = kind === "target" ? "star" : kind === "milestone" ? "flag" : "check";
  return <Icon name={ico} size="sm" className={cx("shrink-0", KIND_TONE[kind] || KIND_TONE.task)} />;
}

/* ---------------------------------------------------------- day bar --- */

const DAY_FROM = 8;   /* 08:00 */
const DAY_TO = 20;    /* 20:00 — the same hour the auto-close threshold uses */

const hourOf = (iso: string) => {
  const d = new Date(iso);
  return d.getHours() + d.getMinutes() / 60;
};
const pct = (h: number) => Math.max(0, Math.min(100, ((h - DAY_FROM) / (DAY_TO - DAY_FROM)) * 100));

/** The day as a bar: worked in the brand, breaks cut out of it, everything
 *  outside the window left as ground. It is here because "in at 9:04, out at
 *  18:14, 32m of break" is four numbers a person has to assemble, and the shape
 *  of a day is the thing they were actually looking for. */
export function DayBar({ row, nowH }: { row: DayRow; nowH: number }) {
  const d = row.day;
  if (!d) {
    return (
      <div
        className="flex h-6 min-w-40 items-center rounded-md bg-secondary px-2 ring-1 ring-secondary ring-inset"
        aria-label={row.state === "absent" ? "Absent" : "Not started"}
      >
        <span className="text-xs text-quaternary">{row.state === "absent" ? "absent" : "—"}</span>
      </div>
    );
  }
  const start = hourOf(d.startedAt);
  const end = d.endedAt ? hourOf(d.endedAt) : row.state === "unclosed" ? start : nowH;
  const segs = d.breaks
    .filter((b) => b.endedAt)
    .map((b, i) => ({ k: i, a: pct(hourOf(b.startedAt)), b: pct(hourOf(b.endedAt as string)) }));
  const open = d.breaks.filter((b) => !b.endedAt)[0];
  if (open) segs.push({ k: 999, a: pct(hourOf(open.startedAt)), b: pct(nowH) });

  const label = fmtTime(d.startedAt) + " to " + (d.endedAt ? fmtTime(d.endedAt) : "now")
    + (d.breakMinutes ? ", " + fmtHM(row.breakMins) + " of break" : "");

  return (
    <div
      className="relative h-6 min-w-40 overflow-hidden rounded-md bg-secondary ring-1 ring-secondary ring-inset"
      title={label}
      aria-label={label}
    >
      <span
        className={cx("absolute inset-y-1 rounded-[3px]", row.state === "unclosed" ? "bg-utility-yellow-500" : "bg-brand-solid")}
        style={{ left: pct(start) + "%", width: Math.max(0.6, pct(end) - pct(start)) + "%" }}
      />
      {segs.map((s) => (
        <span
          key={s.k}
          className="absolute inset-y-1 rounded-[3px] bg-quaternary"
          style={{ left: s.a + "%", width: Math.max(0.6, s.b - s.a) + "%" }}
        />
      ))}
      {row.state === "working" || row.state === "on_break" ? (
        <span className="absolute inset-y-0 w-px bg-fg-error-primary" style={{ left: pct(nowH) + "%" }} />
      ) : null}
    </div>
  );
}

export function BarScale() {
  return (
    <div className="relative h-4 min-w-40" aria-hidden="true">
      {[8, 10, 12, 14, 16, 18, 20].map((h) => (
        <span key={h} className="label-mono absolute -translate-x-1/2" style={{ left: pct(h) + "%" }}>
          {h > 12 ? h - 12 : h}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ meters --- */

const FILL: Record<string, string> = {
  ok: "bg-fg-success-primary",
  warn: "bg-fg-warning-primary",
  bad: "bg-fg-error-primary",
  info: "bg-fg-info-primary",
};

/** A proportion, with the number beside it rather than inside it. A bar that
 *  has passed what it was measured against is not an error and must not clip —
 *  it fills and the figure beside it carries the overshoot. */
export function Meter({ value, of, tone, label }: { value: number; of: number; tone?: string; label?: ReactNode }) {
  const p = of > 0 ? (value / of) * 100 : 0;
  return (
    <div className="flex min-w-24 items-center gap-2">
      <span className="h-1.5 min-w-12 flex-1 overflow-hidden rounded-full bg-quaternary">
        <i
          className={cx("block h-full rounded-full", tone ? FILL[tone] || "bg-fg-brand-primary" : "bg-fg-brand-primary")}
          style={{ width: Math.max(0, Math.min(100, p)) + "%" }}
        />
      </span>
      {label != null ? <span className="shrink-0 text-xs text-tertiary tnum">{label}</span> : null}
    </div>
  );
}

export function Progress({ item, items }: { item: WorkItem; items: WorkItem[] }) {
  const p = progressOf(item, items);
  if (p == null) return <span className="text-quaternary">—</span>;
  const tone = p >= 100 ? "ok" : isDelayed(item) ? "warn" : "";
  return (
    <div className="flex items-center gap-2">
      <Meter value={p} of={100} tone={tone} />
      <span className="text-xs text-secondary tnum">{p}%</span>
    </div>
  );
}

/* -------------------------------------------------------------- week --- */

export interface WeekCell { date: string; worked: number | null; late: boolean; state: AttendanceState }

/** Five bars, one per working day. The height is worked against expected, so a
 *  short Friday is visibly short without anybody computing a percentage. */
export function WeekBars({ cells, expected, dayName }: {
  cells: WeekCell[]; expected: number; dayName: (d: string) => string;
}) {
  return (
    <div className="flex items-end gap-1">
      {cells.map((c) => {
        const p = c.worked != null && expected > 0 ? Math.min(140, (c.worked / (expected * 60)) * 100) : 0;
        const tone = c.state === "unclosed" ? "warn" : c.late ? "warn" : c.worked ? "ok" : "";
        return (
          <span
            key={c.date}
            className="flex w-5 flex-col items-center gap-1"
            title={c.date + " · " + (c.worked != null ? fmtHM(c.worked) : labelOf(ATT_STATE, c.state))}
          >
            <span className="flex h-8 w-full items-end overflow-hidden rounded-[3px] bg-quaternary">
              <i
                className={cx("block w-full rounded-[3px]", tone ? FILL[tone] : "bg-utility-neutral-400")}
                style={{ height: Math.max(2, Math.min(100, p)) + "%" }}
              />
            </span>
            <span className="text-2xs text-quaternary">{dayName(c.date).charAt(0)}</span>
          </span>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------- month grid --- */

const CELL_TONE: Record<string, string> = {
  ok: "bg-utility-green-500",
  warn: "bg-utility-yellow-500",
  bad: "bg-utility-red-500",
  info: "bg-utility-blue-500",
};

export interface MonthCell {
  date: string;
  /** null on a day outside the window this page can answer for. */
  state: AttendanceState | null;
  worked: number | null;
  late: boolean;
  weekend: boolean;
  today: boolean;
  /** a day that belongs to a neighbouring month — drawn, never counted */
  outside: boolean;
}

/** THE MONTH, AS A MONTH. A fortnight of rows answers "what happened on the
 *  eleventh"; only a calendar answers "how has this month gone" — a run of
 *  amber down one column is a Monday problem, and no table shows that.
 *
 *  A day with no answer is GROUND, not a state: the window this page reads is
 *  finite, and a blank cell that looked like "absent" would be the screen
 *  inventing a fact. The dot carries the state, the figure carries the hours,
 *  and neither is colour alone — the title says the state in words. */
export function MonthGrid({ cells, weekStart = 0 }: { cells: MonthCell[]; weekStart?: number }) {
  const names = ["S", "M", "T", "W", "T", "F", "S"];
  const heads = Array.from({ length: 7 }, (_, i) => names[(i + weekStart) % 7]);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-7 gap-1.5" aria-hidden="true">
        {heads.map((h, i) => (
          <div key={i} className="label-mono text-center">{h}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5" role="list">
        {cells.map((c) => {
          const row = c.state ? ATT_STATE[c.state] : null;
          /* `ended` carries no tone in the vocabulary — on a LIST that is
             right, because a finished day is not news. On the grid it is the
             whole signal: a month of green with two red gaps is the reading,
             so a day with hours on it takes the finished tone here. */
          const tone = c.late && c.state !== "absent" ? "warn"
            : row && row.tone ? row.tone
              : c.worked != null ? "ok" : "";
          const label = c.state ? labelOf(ATT_STATE, c.state) : "no record";
          return (
            <div
              key={c.date}
              role="listitem"
              title={c.date + " · " + label + (c.worked != null ? " · " + fmtHM(c.worked) : "")}
              className={cx(
                "flex min-h-14 flex-col justify-between rounded-lg p-1.5 ring-1 ring-inset",
                c.outside ? "bg-secondary ring-transparent" : "bg-primary ring-secondary",
                c.weekend && !c.outside && "bg-secondary",
                c.today && "ring-2 ring-brand",
              )}
            >
              <span className={cx("text-2xs font-medium tnum", c.outside ? "text-quaternary" : "text-tertiary")}>
                {Number(c.date.slice(8))}
              </span>
              <span className="flex items-center gap-1">
                {tone ? (
                  <i aria-hidden="true" className={cx("size-1.5 shrink-0 rounded-full", CELL_TONE[tone] || "bg-utility-neutral-400")} />
                ) : null}
                <span className="truncate text-2xs text-secondary tnum">
                  {c.worked != null ? fmtHM(c.worked) : ""}
                </span>
              </span>
              <span className="sr-only">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** The key under the grid. A colour without its word is a colour. */
export function MonthKey({ items }: { items: { tone: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-tertiary">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <i aria-hidden="true" className={cx("size-1.5 rounded-full", CELL_TONE[i.tone] || "bg-utility-neutral-400")} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------- chrome --- */

/* THE PROTO BANNER IS GONE from every face of this module. It said the same
   sentence on every screen on every load, and a warning nobody can act on is
   one people stop reading — which costs the warnings that matter. The fact it
   carried is not lost: store.ts states it at the top of the only file that
   knows where these records come from, and BACKEND-INTEGRATION.md lists the
   endpoints that have to land. */

/** Every face says whose records it is showing. The scope is a permission
 *  answer, and a screen that silently widens from "your reports" to "everyone"
 *  when somebody's grant changes is a screen nobody can reason about. */
export function ScopeNote({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-tertiary">
      <Icon name="users" size="xs" className="text-fg-quaternary" />
      {text}
    </span>
  );
}

export function DelayFlag({ item }: { item: WorkItem }) {
  if (!isDelayed(item)) return null;
  return <Pill text="Overdue" tone="warn" />;
}

export function ago(dateIso: string | null | undefined, todayIso: string): string {
  if (!dateIso) return "—";
  const a = new Date(dateIso.slice(0, 10) + "T00:00:00");
  const b = new Date(todayIso + "T00:00:00");
  const n = Math.round((a.getTime() - b.getTime()) / 86400000);
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  return n > 0 ? "in " + n + " days" : n * -1 + " days ago";
}

/* --------------------------------------------------------- op launcher --- */

const OP_TONE: Record<string, string> = {
  ok: "text-success-primary",
  warn: "text-warning-primary",
  bad: "text-error-primary",
  info: "text-info-primary",
};

/** ONE OPERATION, AS A DOOR WITH A READING ON IT. The member page's launcher is
 *  a grid of these: a card that only repeated its own title would be a link
 *  with extra padding, so each carries the one live figure that says whether it
 *  is worth opening before anybody clicks it. It is a Tile in spirit — the same
 *  micro-label, figure, sub-line rhythm — but a Tile is a measurement and this
 *  is a destination, so it is drawn here and not taken from `ui/`. */
export function OpTile({ ico, label, v, s, blurb, tone, to, on }: {
  ico: string; label: ReactNode; v?: ReactNode; s?: ReactNode; blurb?: ReactNode;
  tone?: string; to: string; on?: boolean;
}) {
  return (
    <button
      type="button"
      data-go={to}
      aria-current={on ? "page" : undefined}
      onClick={() => go(to)}
      className={cx(
        "group flex min-w-0 cursor-pointer flex-col rounded-xl bg-primary p-4 text-left shadow-xs ring-1 ring-secondary outline-focus-ring transition duration-100 sheen hover:ring-primary focus-visible:outline-2 focus-visible:outline-offset-2",
        on && "bg-brand-primary ring-2 ring-brand",
      )}
    >
      <span className="label-mono flex items-center gap-1.5">
        <Icon name={ico} size="xs" />
        <span className="truncate">{label}</span>
        <Icon name="chevr" size="xs" className="ml-auto text-fg-quaternary transition duration-100 group-hover:text-fg-brand-primary" />
      </span>
      <span className={cx("mt-2 truncate text-lg font-semibold tracking-tight tnum", tone ? OP_TONE[tone] || "text-primary" : "text-primary")}>
        {v ?? "—"}
      </span>
      {s ? <span className="truncate text-xs text-tertiary">{s}</span> : null}
      {blurb ? <span className="mt-2 text-xs leading-snug text-quaternary">{blurb}</span> : null}
    </button>
  );
}

/** THE SAME DOORS, ONE LINE HIGH. The tile grid is the member page's own
 *  content — nine cards of "what is true about this person". On an OPERATION
 *  page it would be three rows of chrome standing between the topbar and the
 *  thing you came to read, every time, so the launcher shrinks to a rail: the
 *  same operations in the same order, still carrying their figure, still
 *  saying which one you are in. */
export function OpChip({ ico, label, v, tone, to, on }: {
  ico: string; label: ReactNode; v?: ReactNode; tone?: string; to: string; on?: boolean;
}) {
  return (
    <button
      type="button"
      data-go={to}
      aria-current={on ? "page" : undefined}
      onClick={() => go(to)}
      className={cx(
        "inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 ring-1 outline-focus-ring transition duration-100 ring-inset focus-visible:outline-2 focus-visible:outline-offset-2",
        on
          ? "bg-brand-primary ring-brand"
          : "bg-primary ring-secondary hover:bg-primary_hover hover:ring-primary",
      )}
    >
      <Icon name={ico} size="sm" className={on ? "text-fg-brand-primary" : "text-fg-quaternary"} />
      <span className={cx("text-sm font-medium", on ? "text-brand-secondary" : "text-secondary")}>{label}</span>
      {v != null && v !== "" ? (
        <span className={cx("text-xs tnum", tone ? OP_TONE[tone] || "text-tertiary" : "text-tertiary")}>{v}</span>
      ) : null}
    </button>
  );
}

/* ------------------------------------------------------------ tag type --- */

/** THE ELEVEN TYPES A TAG CAN BE.
 *
 *  A tag is a label the team chose, never a state — so its palette is the tag
 *  palette (`tagClasses`), which is deliberately not the status palette. The
 *  store has taken a tone since the day it shipped and no screen in Tasks ever
 *  passed one, so every tag born here came out `slate` and a wall of grey pills
 *  carried no information at all, which is the whole point of a tag.
 *
 *  SWATCHES, NOT A `<select>`. A colour named in a dropdown is a word you have
 *  to imagine; eleven 20px chips are the thing itself, and they cost one row. */
export const TAG_TYPES = [
  "slate", "red", "orange", "amber", "lime", "green",
  "teal", "cyan", "blue", "violet", "pink",
];

export function TagTypePicker({ tone, onPick }: { tone: string; onPick: (t: string) => void }) {
  return (
    /* `group` with pressed buttons, NOT `radiogroup` with `radio`. A radiogroup
       promises arrow-key navigation and a roving tabindex to anybody driving
       this from a keyboard or a screen reader; these are eleven ordinary
       buttons you reach with Tab. Claiming the stronger role and not honouring
       it is worse than claiming the weaker one. */
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Tag type">
      {TAG_TYPES.map((t) => (
        <button
          key={t}
          type="button"
          aria-pressed={t === tone}
          title={cap(t)}
          aria-label={cap(t)}
          onClick={() => onPick(t)}
          className={cx(
            "size-5 cursor-pointer rounded-md ring-1 outline-focus-ring transition duration-100 ring-inset hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2",
            tagClasses(t),
            t === tone && "ring-2 ring-brand",
          )}
        />
      ))}
    </div>
  );
}
