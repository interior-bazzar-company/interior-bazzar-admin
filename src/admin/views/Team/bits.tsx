/* =============================================================================
   Team — the small shared pieces the three operational faces all render.
   -----------------------------------------------------------------------------
   Nothing here holds state or reads the store. They take what they draw, so the
   same `DayBar` renders today's half-finished row and a closed row from three
   weeks ago without knowing which it is looking at.

   EVERY TONE HERE COMES OUT OF THE VOCABULARY, not out of a switch in this
   file. `attendanceStates[].tone` and `workStatuses[].tone` are the source, so
   a status relabelled or re-toned server-side lands without a code edit — and,
   more to the point, there is one place a status colour is decided rather than
   one per component that eventually disagree.
   ============================================================================= */
import type { ReactNode } from "react";
import { Icon, Pill, initials, avatarTone } from "../../ui";
import type {
  AttendanceState, DayRow, Member, Priority, WorkItem, WorkStatus,
} from "./store";
import {
  ATT_STATE, PRIORITY, WORK_STATUS, fmtHM, fmtTime, isDelayed, labelOf, progressOf, toneOf,
} from "./store";

/* ---------------------------------------------------------------- who --- */

export function Who({ m, sub }: { m: Member; sub?: ReactNode }) {
  return (
    <div className="tm-who">
      <span className={"av " + avatarTone(m.name)}>{initials(m.name)}</span>
      <span className="tm-who-t">
        <b>{m.name}</b>
        <span className="cell-2">{sub ?? m.designation}</span>
      </span>
    </div>
  );
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
  /* Low prints nothing. Three chips on every row is three chips nobody reads,
     and "not urgent" is the default rather than a claim worth making. */
  if (p === "low") return null;
  return <Pill text={labelOf(PRIORITY, p)} tone={toneOf(PRIORITY, p)} />;
}

export function KindMark({ kind }: { kind: string }) {
  const ico = kind === "target" ? "star" : kind === "milestone" ? "flag" : "check";
  return <Icon name={ico} size="sm" className={"tm-kind tm-kind-" + kind} />;
}

/* ---------------------------------------------------------- day bar --- */

const DAY_FROM = 8;   /* 08:00 */
const DAY_TO = 20;    /* 20:00 — the same hour the auto-close threshold uses */

const hourOf = (iso: string) => {
  const d = new Date(iso);
  return d.getHours() + d.getMinutes() / 60;
};
const pct = (h: number) => Math.max(0, Math.min(100, ((h - DAY_FROM) / (DAY_TO - DAY_FROM)) * 100));

/** The day as a bar: worked in the accent, breaks cut out of it, everything
 *  outside the window left as ground. It is here because "in at 9:04, out at
 *  18:14, 32m of break" is four numbers a person has to assemble, and the shape
 *  of a day is the thing they were actually looking for. */
export function DayBar({ row, nowH }: { row: DayRow; nowH: number }) {
  const d = row.day;
  if (!d) {
    return (
      <div className="tm-bar" aria-label={row.state === "absent" ? "Absent" : "Not started"}>
        <span className="tm-bar-none">{row.state === "absent" ? "absent" : "—"}</span>
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
    <div className={"tm-bar" + (row.state === "unclosed" ? " unclosed" : "")} title={label} aria-label={label}>
      <span className="tm-bar-work" style={{ left: pct(start) + "%", width: Math.max(0.6, pct(end) - pct(start)) + "%" }} />
      {segs.map((s) => (
        <span key={s.k} className="tm-bar-break" style={{ left: s.a + "%", width: Math.max(0.6, s.b - s.a) + "%" }} />
      ))}
      {row.state === "working" || row.state === "on_break"
        ? <span className="tm-bar-now" style={{ left: pct(nowH) + "%" }} />
        : null}
    </div>
  );
}

export function BarScale() {
  return (
    <div className="tm-scale" aria-hidden="true">
      {[8, 10, 12, 14, 16, 18, 20].map((h) => (
        <span key={h} style={{ left: pct(h) + "%" }}>{h > 12 ? h - 12 : h}</span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ meters --- */

/** A proportion, with the number beside it rather than inside it. `over` marks
 *  a bar that has passed what it was measured against — a member who worked
 *  more than their expected hours is not an error and must not clip. */
export function Meter({ value, of, tone, label }: { value: number; of: number; tone?: string; label?: ReactNode }) {
  const p = of > 0 ? (value / of) * 100 : 0;
  return (
    <div className="tm-meter">
      <span className={"tm-meter-t" + (p > 100 ? " over" : "")}>
        <i className={tone || ""} style={{ width: Math.max(0, Math.min(100, p)) + "%" }} />
      </span>
      {label != null ? <span className="tm-meter-l tnum">{label}</span> : null}
    </div>
  );
}

export function Progress({ item, items }: { item: WorkItem; items: WorkItem[] }) {
  const p = progressOf(item, items);
  if (p == null) return <span className="dim">—</span>;
  const tone = p >= 100 ? "ok" : isDelayed(item) ? "warn" : "";
  return (
    <div className="tm-prog">
      <Meter value={p} of={100} tone={tone} />
      <span className="tnum">{p}%</span>
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
    <div className="tm-week">
      {cells.map((c) => {
        const p = c.worked != null && expected > 0 ? Math.min(140, (c.worked / (expected * 60)) * 100) : 0;
        const tone = c.state === "unclosed" ? "warn" : c.late ? "warn" : c.worked ? "ok" : "";
        return (
          <span key={c.date} className="tm-week-d" title={c.date + " · " + (c.worked != null ? fmtHM(c.worked) : labelOf(ATT_STATE, c.state))}>
            <span className="tm-week-t"><i className={tone} style={{ height: Math.max(2, p) + "%" }} /></span>
            <span className="tm-week-l">{dayName(c.date).charAt(0)}</span>
          </span>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------- chrome --- */

/** The same words on every face of this module, and the same words the Users
 *  and Finance modules use. It names the endpoint that does not exist, because
 *  "this is a prototype" answers nothing a person can act on. */
export function ProtoBar({ what, endpoint }: { what: string; endpoint: string }) {
  return (
    <div className="tm-proto">
      <Icon name="alert" size="sm" />
      <span>
        <b>{what} renders from bundled sample data.</b> Nothing here is saved —
        a reload restores the seed. It stands in for <code>{endpoint}</code>,
        which does not exist yet.
      </span>
    </div>
  );
}

/** Every face says whose records it is showing. The scope is a permission
 *  answer, and a screen that silently widens from "your reports" to "everyone"
 *  when somebody's grant changes is a screen nobody can reason about. */
export function ScopeNote({ text }: { text: string }) {
  return <span className="tm-scope"><Icon name="users" size="sm" />{text}</span>;
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
