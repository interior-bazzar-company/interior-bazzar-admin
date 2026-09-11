/* =============================================================================
   Attendance — #/attendance
   -----------------------------------------------------------------------------
     #/attendance                    today, one row per member in scope
     #/attendance?face=history       the month, member × day, as a heat grid
     #/attendance?face=requests      the leave queue
     #/attendance?face=analytics     the shape of a window
     #/attendance?date=YYYY-MM-DD    any other business day (or month)

   THE CLOCK IS NOT THE LOGIN. `UserSession` already records every sign-in with
   its device, IP and user agent, and it is the wrong record: somebody checking
   one number at 23:40 has logged in and has not started a shift, and a token
   refresh advances "last active" whether or not anybody is at the keyboard. The
   day here is opened by a deliberate act and closed by another one.

   NOTHING AUTO-CLOSES A FORGOTTEN DAY. A day still open past its own auto-close
   renders as Unclosed and contributes nothing to any total until a person
   resolves it. An auto-closed day is a number the system invented; an unclosed
   one is a question, and a question is honest.

   THIS SCREEN READS THE DAY; IT DOES NOT KEEP IT. The clock — the reader's own
   state, worked total, Break and End day — belongs to the member dashboard, so
   it is not drawn here. The write API it needs (openDay · startBreak ·
   resumeDay · endDay) stays in store.ts, unchanged and still covered by
   check:team.

   THE DAY AND THE MONTH ARE ONE QUESTION AT TWO ZOOMS, so they are a Segmented
   in the date bar rather than two tabs: "who is in" and "what did this month
   look like" are read with the same eyes and moved between constantly. The
   queue and the window ARE different questions and keep their tabs.

   NO API YET — everything comes from src/content/team/attendance.json through
   store.ts, which is the only file that knows that.
   ============================================================================= */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { usePageChrome } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import {
  Alert, Button, ChartFrame, DateInput, EmptyState, FilterBar, FilterChips, IconButton,
  ListTable, PageHeader, Pill, Rail, SearchField, SectionHead, Segmented, Select, StatStrip,
  Tabs, TbTitle, Tiles, qs,
} from "../../ui";
import type { StatCell } from "../../ui";
import { ColumnChart } from "../charts";
import { go } from "../../ui/nav";
import {
  LEAVE_KIND, TODAY, addDays, attendanceTotals, clampDay, datesIn, dayFor, fmtDate, fmtDayName,
  fmtMonth, isWeekend, labelOf, leaveOverlap, leaveQueue, fmtHM, fmtTime, meId, monthStep,
  readMember, arrivalSpread, earliestAttendance, scopeLabel, scopeOf, spanDays, spanRows,
  spanTotals, stateOf, useDayRows, useLeave, useMe, useMembers, workedOf,
  now as clockNow,
} from "./store";
import type { DayRow, LeaveRequest, Member, Scope, SpanRow } from "./store";
import { LeaveDecideModal } from "./member/modals";
import { BarScale, DayBar, Meter, StatePill, Who } from "./bits";
import { HeatGrid, HeatLegend, SortHead, StackBars } from "./workBits";
import type { HeatCell, HeatRow, StackDay } from "./workBits";
import { ensureAdopted } from "./adopt";

const ROUTE = "#/attendance";

/* ORDER IS URGENCY, NOT CHRONOLOGY. The record is the live day, Requests is the
   only tab that can be waiting on the reader, and the window comes last.
   Requests used to be third, behind two views nobody opens twice a day, which
   is how a queue with a count on it still gets missed. */
const TABS = [
  { k: "record", label: "Record", icon: "clock" },
  { k: "requests", label: "Requests", icon: "inbox" },
  { k: "analytics", label: "Analytics", icon: "chart" },
];
/** The `?face=` values, unchanged — `today` and `history` are the two zooms of
 *  the record tab, so a link somebody sent last week still lands where it
 *  meant. */
const FACES = ["today", "history", "requests", "analytics"];

export default function Attendance() {
  const [sp] = useSearchParams();
  const p = useMemo(() => {
    const o: Record<string, string> = {};
    sp.forEach((v, k) => { if (v) o[k] = v; });
    return o;
  }, [sp]);

  const face = FACES.indexOf(p.face || "") >= 0 ? (p.face as string) : "today";
  const zoom = face === "history" ? "month" : "day";
  const tab = face === "requests" || face === "analytics" ? face : "record";
  const date = clampDay(p.date);
  const scope = scopeOf("attendance");
  const rows = useDayRows(date, scope);
  const members = useMembers();
  const me = useMe();

  usePageChrome({ crumbs: <TbTitle label="Attendance" to="#/attendance" /> }, face + date);

  useEffect(() => { ensureAdopted(); }, []);

  const goto = useCallback((patch: Record<string, string | undefined>) => {
    const next: Record<string, string> = { ...p };
    Object.keys(patch).forEach((k) => {
      const v = patch[k];
      if (v) next[k] = v; else delete next[k];
    });
    go(ROUTE + qs(next));
  }, [p]);

  /* `*` IS THE CLEAR-ALL THE CHIP ROW WRITES. Without this branch the row's
     own "Clear all" set a parameter literally named `*` to nothing and left
     every filter standing — the one control on the band that promised to undo
     the others did nothing at all. */
  const onFilter = (name: string, value: string) => {
    if (name === "*") { goto({ q: undefined, state: undefined, late: undefined }); return; }
    goto({ [name]: value || undefined });
  };
  const onDate = (d: string) => goto({ date: d === TODAY ? undefined : d });

  const waiting = leaveQueue(scope).total;

  const bar = (
    <DateBar zoom={zoom} date={date} onPick={onDate}
      onZoom={(z) => goto({ face: z === "month" ? "history" : undefined })} />
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Attendance"
        meta={
          <>
            <span className="font-medium text-secondary">
              {zoom === "month" ? fmtMonth(date, true) : fmtDayName(date) + " · " + fmtDate(date)}
            </span>
            <span>{scopeLabel(scope, members.filter((m) => m.status === "active").length)}</span>
            {date === TODAY ? <Pill xs dot tone="live" text="live" /> : null}
          </>
        }
        tabs={
          <Tabs cur={tab}
            items={TABS.map((t) => ({ k: t.k, label: t.label, icon: t.icon,
              n: t.k === "requests" ? waiting : undefined }))}
            onPick={(k) => goto({ face: k === "record" ? undefined : k })} />
        }
      />

      {face === "today"
        ? <Today rows={rows} p={p} bar={bar} onFilter={onFilter} />
        : face === "history"
          ? <Month members={members} me={me ? me.memberId : meId()} scope={scope} date={date}
              bar={bar} onPick={onDate} />
          : face === "analytics"
            ? <Analytics scope={scope} span={p.span || "7"}
                onSpan={(v) => goto({ span: v === "7" ? undefined : v })} />
            : <Requests />}
    </div>
  );
}

/* ------------------------------------------------------------- date bar --- */

/** THE DATE IS A FILTER, not two chevrons and a label.
 *
 *  Stepping one at a time is the right control for "yesterday" and a terrible
 *  one for "the Tuesday before last" — twelve presses to reach a date somebody
 *  already knows. The chevrons stay because the common move IS one step; the
 *  field is there for every other move, and `max` is what actually refuses a
 *  future date rather than a disabled button somebody routes around by typing
 *  the URL. */
function DateBar({ zoom, date, onPick, onZoom }: {
  zoom: string; date: string; onPick: (d: string) => void; onZoom: (z: string) => void;
}) {
  const step = (n: number) => onPick(clampDay(zoom === "month" ? monthStep(date, n) : addDays(date, n)));
  const atEnd = zoom === "month" ? date.slice(0, 7) >= TODAY.slice(0, 7) : date >= TODAY;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        <IconButton ico="chevl" color="secondary" label={zoom === "month" ? "Previous month" : "Previous day"} onClick={() => step(-1)} />
        <DateInput value={date} max={TODAY} ariaLabel="Show this day"
          onChange={(v) => { if (v && v <= TODAY) onPick(v); }} />
        <IconButton ico="chevr" color="secondary" label={zoom === "month" ? "Next month" : "Next day"}
          isDisabled={atEnd} onClick={() => step(1)} />
      </div>
      <Button color="secondary" isDisabled={date === TODAY} onClick={() => onPick(TODAY)}>Today</Button>
      <Segmented sm label="Zoom" value={zoom} onPick={onZoom}
        options={[{ v: "day", l: "Day", ico: "clock" }, { v: "month", l: "Month", ico: "calendar" }]} />
    </div>
  );
}

/* ---------------------------------------------------------------- today --- */

function Today({ rows, p, bar, onFilter }: {
  rows: DayRow[]; p: Record<string, string>; bar: ReactNode;
  onFilter: (n: string, v: string) => void;
}) {
  const nowH = useMemo(() => {
    const d = new Date(clockNow());
    return d.getHours() + d.getMinutes() / 60;
  }, []);

  const t = attendanceTotals(rows);
  let list = rows;
  if (p.q) {
    const q = p.q.toLowerCase();
    list = list.filter((r) => r.member.name.toLowerCase().indexOf(q) >= 0
      || r.member.designation.toLowerCase().indexOf(q) >= 0);
  }
  if (p.state) list = list.filter((r) => r.state === p.state);
  if (p.late) list = list.filter((r) => !!r.day && r.day.isLate);

  /* EVERY COUNT IS THE FILTER FOR ITSELF, and pressing the one you are on
     clears it — so the strip is never a trap you have to leave by the chips. */
  const at = (patch: Record<string, string | undefined>) => {
    const next: Record<string, string> = { ...p };
    delete next.state; delete next.late;
    Object.keys(patch).forEach((k) => { const v = patch[k]; if (v) next[k] = v; });
    return ROUTE + qs(next);
  };
  const cells: (StatCell | "sep")[] = [
    { k: "present", v: t.present, title: "Members with a day opened" },
    "sep",
    { k: "working", v: t.working, dot: "ok", to: p.state === "working" ? at({}) : at({ state: "working" }), on: p.state === "working" },
    { k: "on break", v: t.onBreak, dot: "info", to: p.state === "on_break" ? at({}) : at({ state: "on_break" }), on: p.state === "on_break" },
    { k: "ended", v: t.ended, dot: "neutral", to: p.state === "ended" ? at({}) : at({ state: "ended" }), on: p.state === "ended" },
    "sep",
    { k: "late", v: t.late, dot: t.late ? "warn" : "neutral", to: p.late ? at({}) : at({ late: "1" }), on: !!p.late },
    { k: "absent", v: t.absent, dot: t.absent ? "bad" : "neutral", to: p.state === "absent" ? at({}) : at({ state: "absent" }), on: p.state === "absent" },
    { k: "on leave", v: t.onLeave, dot: t.onLeave ? "info" : "neutral", to: p.state === "on_leave" ? at({}) : at({ state: "on_leave" }), on: p.state === "on_leave" },
    { k: "unclosed", v: t.unclosed, dot: t.unclosed ? "warn" : "neutral", to: p.state === "unclosed" ? at({}) : at({ state: "unclosed" }), on: p.state === "unclosed" },
  ];

  const narrowed = !!(p.q || p.state || p.late);

  return (
    <>
      <StatStrip cells={cells} />

      <FilterBar
        search={<SearchField ph="Search member" name="q" val={p.q} onFilter={onFilter} />}
        filters={
          <>
            <Select name="state" label="State" value={p.state} onFilter={onFilter}
              options={[{ v: "working", l: "Working", dot: "ok" }, { v: "on_break", l: "On break", dot: "info" },
                { v: "ended", l: "Day ended", dot: "neutral" }, { v: "unclosed", l: "Unclosed", dot: "warn" },
                { v: "not_started", l: "Not started", dot: "neutral" }, { v: "absent", l: "Absent", dot: "bad" },
                { v: "on_leave", l: "On leave", dot: "info" }]} />
            <Select name="late" label="Late" value={p.late} onFilter={onFilter}
              options={[{ v: "1", l: "Late only", dot: "warn" }]} />
          </>
        }
        right={bar}
        chips={
          <FilterChips params={{ q: p.q, state: p.state, late: p.late }}
            labels={{ late: "late only" }} onUnfilter={(n) => onFilter(n, "")} />
        }
      />

      {list.length ? (
        <ListTable min="1080px"
          head={
            <tr>
              <th className="rail" />
              <th>Member</th>
              <th>State</th>
              <th>In</th>
              <th>Out</th>
              <th className="n">Break</th>
              <th className="n">Worked</th>
              {/* AGAINST EXPECTED, on the row. "6h 10m" is a fact; whether it is
                  a short day depends on what that member was expected to do,
                  and that number lives on the member. Without this column the
                  reader has to know eight people's contracted hours by heart. */}
              <th>Of expected</th>
              {/* The scale is stacked under the label rather than beside it:
                  beside it the numbers ran into the word and, worse, sat over
                  its own 160px rather than over the column the bars are drawn
                  in, so the ticks lined up with nothing. */}
              <th>
                <span className="flex flex-col gap-1">
                  <span>The day</span>
                  <BarScale />
                </span>
              </th>
            </tr>
          }>
          {list.map((r) => {
            const tone = r.state === "absent" ? "bad"
              : r.state === "unclosed" || (r.day && r.day.isLate) ? "warn" : undefined;
            return (
              <tr key={r.member.memberId}>
                <Rail tone={tone} />
                <td className="cell-1"><Who m={r.member} /></td>
                <td><StatePill state={r.state} /></td>
                <td className="font-mono tnum">
                  <span className="flex items-center gap-1.5">
                    {r.day ? fmtTime(r.day.startedAt) : <span className="text-quaternary">—</span>}
                    {r.day && r.day.isLate ? (
                      <Pill xs tone="warn" text="late"
                        title={"Late by " + r.day.lateByMinutes + " minutes against a " + r.member.dayStartsAt + " start"} />
                    ) : null}
                  </span>
                </td>
                <td className="font-mono tnum">
                  {r.day && r.day.endedAt ? fmtTime(r.day.endedAt) : <span className="text-quaternary">—</span>}
                </td>
                <td className="n">{r.breakMins ? fmtHM(r.breakMins) : "—"}</td>
                <td className="n">{r.worked != null ? fmtHM(r.worked) : "—"}</td>
                <td>
                  {r.worked != null ? (
                    <Meter value={r.worked} of={r.member.expectedHoursPerDay * 60}
                      tone={r.state === "on_break" ? "info"
                        : r.worked >= r.member.expectedHoursPerDay * 60 ? "ok" : "warn"}
                      label={<>{fmtHM(r.worked)} of {r.member.expectedHoursPerDay}h</>} />
                  ) : <span className="text-quaternary">no row</span>}
                </td>
                <td><DayBar row={r} nowH={nowH} /></td>
              </tr>
            );
          })}
        </ListTable>
      ) : (
        <EmptyState icon="clock"
          title={narrowed ? "No member matches" : "Nobody has clocked in"}
          body={narrowed
            ? "Clear the filters to see the whole day."
            : "The first Start day of the morning opens a row here."}
          action={narrowed
            ? <Button color="secondary" ico="x" onClick={() => onFilter("*", "")}>Clear the filters</Button>
            : undefined} />
      )}

      {t.unclosed ? (
        <Alert tone="warn" title={t.unclosed + " day" + (t.unclosed > 1 ? "s" : "") + " left open past the member's auto-close"}>
          Nothing is written automatically — the member is asked to confirm or correct on their
          next visit, and until then those days count towards no total.
        </Alert>
      ) : null}
    </>
  );
}

/* ---------------------------------------------------------------- month --- */

/** THE MONTH, MEMBER BY DAY. It was a five-column week, which is a table with
 *  the shape of a week and none of the shape of a month: nobody could see a
 *  pattern in it, and the pattern is the only thing a grid of hours is for.
 *
 *  Magnitude is the message — who worked a full day, who worked half of one —
 *  so it is a sequential ramp rather than five unrelated hues. The three states
 *  that are NOT a quantity (no record, on leave, still open) take status
 *  colours instead of a step, because they are not more or less of anything.
 *
 *  Every cell is a link to that day's own row on the day view: a heat map you
 *  cannot drill into is a picture rather than a screen. */
function Month({ members, me, scope, date, bar, onPick }: {
  members: Member[]; me: string; scope: Scope; date: string;
  bar: ReactNode; onPick: (d: string) => void;
}) {
  const first = date.slice(0, 8) + "01";
  const last = addDays(monthStep(date, 1), -1);
  const days = datesIn(first, last).filter((d) => !isWeekend(d) && d <= TODAY);
  const inScope = members.filter((m) =>
    m.status === "active" && (scope === "all" || m.memberId === me || m.reportsTo === me));

  const rows: HeatRow[] = inScope.map((m) => {
    let total = 0;
    const cells: HeatCell[] = days.map((d) => {
      const day = dayFor(m.memberId, d);
      /* `d` is passed: without it `stateOf` cannot see approved leave, and this
         grid drew a leave day exactly like an absence — the one thing the note
         under it promises never happens. */
      const st = stateOf(day, m, clockNow(), d);
      const w = workedOf(day, m, clockNow());
      if (w != null) total += w;
      const expected = Math.max(1, m.expectedHoursPerDay * 60);
      const head = fmtDayName(d) + " " + fmtDate(d) + " — ";
      if (d < m.joiningDate) return { date: d, kind: "off", step: 0, title: head + "before " + m.name.split(" ")[0] + " joined" };
      if (st === "on_leave") return { date: d, kind: "leave", step: 0, title: head + "on approved leave" };
      if (st === "unclosed") return { date: d, kind: "open", step: 0, title: head + "still open, counted towards no total" };
      if (!day) return { date: d, kind: "none", step: 0, title: head + "no record — absent" };
      return {
        date: d, kind: "work",
        step: Math.max(1, Math.min(5, Math.ceil(((w || 0) / expected) * 5))),
        title: head + fmtHM(w) + " of " + m.expectedHoursPerDay + "h, in at " + fmtTime(day.startedAt),
      };
    });
    return { key: m.memberId, head: <Who m={m} />, cells, total: fmtHM(total) };
  });

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHead className="mb-0" title={fmtMonth(date, true)}
          desc={days.length + " working days · weekends are not counted (leave and holidays are out of v1)"} />
        {bar}
      </div>

      {inScope.length && days.length ? (
        <>
          <HeatGrid days={days} rows={rows} onPick={onPick} />
          <HeatLegend />
        </>
      ) : (
        <EmptyState icon="users"
          title={inScope.length ? "No working day in this month yet" : "Nobody reports to you"}
          body={inScope.length
            ? "Step back a month — a grid of days nobody has lived yet would be a wall of absences."
            : "This grid shows you and the members whose reporting line points at you."} />
      )}

      <Alert tone="info">
        An unclosed day adds nothing to the total and is not an absence. A cell with no record at
        all is absence — which IS the lack of a row, never a row saying absent.
      </Alert>
    </>
  );
}

/* ------------------------------------------------------------ analytics --- */

const SPANS = [{ v: "7", l: "7 days" }, { v: "14", l: "14 days" }, { v: "30", l: "30 days" }];

/** THE SHAPE OF A FORTNIGHT, which no single day can show.
 *
 *  Everything here comes from `spanRows` — the same `dayRows` the table draws,
 *  summed. Two counting rules would be one too many, and the one nobody is
 *  looking at is always the one that drifts.
 *
 *  WHAT IT DELIBERATELY DOES NOT DO: reduce a person to a score. Every column
 *  is a raw count or a total, every column sorts, and there is no composite
 *  anywhere on the face. "Meera: 78" would be a number the panel invented and a
 *  conversation nobody could have honestly. */
function Analytics({ scope, span, onSpan }: {
  scope: Scope; span: string; onSpan: (v: string) => void;
}) {
  useMembers();
  const [sort, setSort] = useState("late");

  const days = Math.max(1, Number(span) || 7);
  const from = addDays(TODAY, -(days - 1));
  const rows = spanRows(from, TODAY, scope);
  const t = spanTotals(rows);
  const daily = spanDays(from, TODAY, scope);
  const spread = arrivalSpread(rows);
  /* A window that reaches back past the first row ever written is not showing
     absence, it is showing the edge of the record — and to a derivation whose
     whole rule is "an absence is the lack of a row" those two are identical. So
     the screen says which one it is looking at. */
  const first = earliestAttendance();

  const rank = (r: SpanRow): number => {
    if (sort === "present") return r.present;
    if (sort === "late") return r.late;
    if (sort === "absent") return r.absent;
    if (sort === "unclosed") return r.unclosed;
    if (sort === "worked") return r.worked;
    if (sort === "avg") return r.present ? r.worked / r.present : 0;
    return 0;
  };
  const sorted = rows.slice().sort((a, b) =>
    (sort === "name" ? 0 : rank(b) - rank(a)) || a.member.name.localeCompare(b.member.name));

  const stack: StackDay[] = daily.map((d) => ({
    date: d.date,
    label: d.date.slice(8),
    sub: fmtDayName(d.date).slice(0, 1),
    today: d.date === TODAY,
    segs: [
      { k: "p", n: d.present - d.late, tone: "ok", what: "in on time" },
      { k: "t", n: d.late, tone: "warn", what: "late" },
      { k: "l", n: d.onLeave, tone: "info", what: "on leave" },
      { k: "a", n: d.absent, tone: "bad", what: "absent" },
      { k: "u", n: d.unclosed, tone: "mute", what: "unclosed" },
    ],
  }));

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Segmented sm label="Window" value={span} onPick={onSpan}
          options={SPANS.map((o) => ({ v: o.v, l: o.l }))} />
        <span className="text-sm text-tertiary">
          {fmtDate(from)} to {fmtDate(TODAY)} · weekends excluded
        </span>
      </div>

      <Tiles list={[
        {
          k: "On time", v: t.onTimePct === null ? "—" : t.onTimePct + "%",
          s: t.present ? t.late + " late of " + t.present + " days worked" : "nothing worked yet",
          tone: t.onTimePct !== null && t.onTimePct < 80 ? "warn" : "",
        },
        {
          k: "Average day", v: t.avgDay === null ? "—" : fmtHM(t.avgDay),
          s: t.days ? "against " + fmtHM(Math.round(t.expected / t.days)) + " expected" : "—",
        },
        {
          k: "Absent", v: String(t.absent),
          s: t.days ? Math.round((t.absent / t.days) * 100) + "% of expected days" : "—",
          tone: t.absent ? "bad" : "",
        },
        {
          k: "Unclosed", v: String(t.unclosed),
          s: "counted towards no total", tone: t.unclosed ? "warn" : "",
        },
      ]} />

      {first && from < first ? (
        <Alert tone="warn" title={"Nothing is recorded before " + fmtDate(first) + "."}>
          Every earlier day in this window counts as absent, because an absence IS the lack of a
          row and nothing here can tell "nobody came in" apart from "nothing was written". Narrow
          the window, or read those days as the edge of the record rather than as a week nobody
          worked.
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartFrame title="Day by day"
          note="One column per working day, across everybody in scope. Absence is the lack of a row, so it is drawn as the part of the column nobody filled.">
          {stack.length ? (
            <StackBars days={stack} legend={[
              { tone: "ok", label: "on time" }, { tone: "warn", label: "late" },
              { tone: "info", label: "leave" }, { tone: "bad", label: "absent" },
              { tone: "mute", label: "unclosed" },
            ]} />
          ) : (
            <EmptyState flat icon="calendar" title="No working day in this window" body="" />
          )}
        </ChartFrame>

        <ChartFrame title="When people arrive"
          note="A spread, not an average. One person at 11:00 moves a mean and tells you nothing about everybody else.">
          {spread.length ? (
            <ColumnChart unit="arrivals" height={200}
              series={[{ key: "n", label: "Arrivals", slot: 1 }]}
              points={spread.map((b) => ({ key: String(b.at), label: b.label, values: { n: b.n } }))} />
          ) : (
            <EmptyState flat icon="clock" title="Nobody has clocked in"
              body="There is nothing to spread over this window." />
          )}
        </ChartFrame>
      </div>

      <SectionHead title="Per member"
        desc="Counts and totals. Every column sorts and none of them add up to a score — that is the point." />
      {sorted.length ? (
        <ListTable min="1020px"
          head={
            <tr>
              <th><SortHead k="name" label="Member" cur={sort} onPick={setSort} /></th>
              <th className="n"><SortHead k="present" label="In" cur={sort} onPick={setSort} /></th>
              <th className="n"><SortHead k="late" label="Late" cur={sort} onPick={setSort} /></th>
              <th className="n"><SortHead k="absent" label="Absent" cur={sort} onPick={setSort} /></th>
              <th className="n"><SortHead k="unclosed" label="Unclosed" cur={sort} onPick={setSort} /></th>
              <th className="n"><SortHead k="worked" label="Worked" cur={sort} onPick={setSort} /></th>
              <th className="n"><SortHead k="avg" label="Average day" cur={sort} onPick={setSort} /></th>
              <th>Against expected</th>
            </tr>
          }>
          {sorted.map((r) => (
            <tr key={r.member.memberId}>
              <td className="cell-1"><Who m={r.member} /></td>
              <td className="n">
                {r.present}
                <span className="cell-2 block">of {r.days}</span>
              </td>
              <td className="n">
                <span className={r.late ? "font-medium text-warning-primary" : undefined}>{r.late || "—"}</span>
                {r.late ? <span className="cell-2 block">{fmtHM(r.lateMinutes)} over</span> : null}
              </td>
              <td className="n">
                <span className={r.absent ? "font-medium text-error-primary" : undefined}>{r.absent || "—"}</span>
              </td>
              <td className="n">
                <span className={r.unclosed ? "font-medium text-warning-primary" : undefined}>{r.unclosed || "—"}</span>
              </td>
              <td className="n">{fmtHM(r.worked)}</td>
              <td className="n">{r.present ? fmtHM(Math.round(r.worked / r.present)) : "—"}</td>
              <td>
                <Meter value={r.worked} of={Math.max(1, r.expected)}
                  tone={r.worked >= r.expected * 0.95 ? "ok" : r.worked >= r.expected * 0.8 ? "info" : "warn"}
                  label={<>{fmtHM(r.worked)} of {fmtHM(r.expected)}</>} />
              </td>
            </tr>
          ))}
        </ListTable>
      ) : (
        <EmptyState icon="users" title="Nobody in scope"
          body="No active member reports into this view." />
      )}

      <Alert tone="info">
        An unclosed day adds no hours and is not an absence — it is its own column, exactly as it
        is on the day view. Nobody is counted before the day they joined, so a new member does not
        open on a fortnight of absences they could not have attended.
      </Alert>
    </>
  );
}

/* ------------------------------------------------------------- requests --- */

/** THE QUEUE, ON ITS OWN. It used to sit in the middle of the day table, above
 *  the rows and below the stats — a fine place for something nobody is looking
 *  for, and a poor one for the only block on this screen waiting on a person.
 *
 *  Approving writes NO attendance row. It suppresses the derived absence, and
 *  the day reads On leave instead — which is why a request left sitting here
 *  quietly counts as absence until somebody decides it.
 *
 *  A request with no approver is never silent: somebody at the top of the tree
 *  points at nobody with `reportsTo`, so their request has no reporting line to
 *  route down. It falls to any holder of the deciding verb and it says so out
 *  loud — a request that simply sat there is the exact failure the second table
 *  exists to prevent. */
function Requests() {
  useLeave();
  const { mine, unrouted } = leaveQueue(scopeOf("attendance"));

  if (!mine.length && !unrouted.length) {
    return (
      <>
        <EmptyState icon="inbox" title="Nothing waiting on you"
          body="No leave request needs a decision. A request appears here only while it is undecided — once it is approved or refused it lives on that member's own leave page." />
        <Alert tone="info">
          Approving writes no attendance row. It suppresses the derived absence and those days
          read as On leave instead.
        </Alert>
      </>
    );
  }

  return (
    <>
      {mine.length ? (
        <section className="flex flex-col gap-3">
          <SectionHead className="mb-0" title="Leave requests"
            desc="Until you decide, those days still read as absent."
            right={<Pill tone="warn" text={mine.length + " waiting"} />} />
          <LeaveTable list={mine} />
        </section>
      ) : null}

      {unrouted.length ? (
        <section className="mt-2 flex flex-col gap-3">
          <SectionHead className="mb-0" title="Nobody to route these to"
            desc="These members report to nobody, so they fall to any admin who can decide leave."
            right={<Pill tone="warn" text={String(unrouted.length)} />} />
          <LeaveTable list={unrouted} unrouted />
        </section>
      ) : null}

      <Alert tone="info">
        Approving writes no attendance row. It suppresses the derived absence and those days read
        as On leave instead.
      </Alert>
    </>
  );
}

function LeaveTable({ list, unrouted }: { list: LeaveRequest[]; unrouted?: boolean }) {
  const shell = useShell();
  return (
    <ListTable min="900px"
      head={
        <tr>
          <th className="rail" />
          <th>Member</th>
          <th>Dates</th>
          <th>Kind</th>
          <th>Reason</th>
          <th className="acts" />
        </tr>
      }>
      {list.map((l) => {
        const m = readMember(l.memberId);
        const days = datesIn(l.fromDate, l.toDate).length;
        /* The clash is shown ON THE ROW as well as in the dialog, because the
           whole point of it is to be seen before somebody presses Approve out
           of habit. */
        const clash = leaveOverlap(l)[0] || null;
        return (
          <tr key={l.leaveId}>
            <Rail tone={unrouted || clash ? "warn" : undefined} />
            <td className="cell-1">{m ? <Who m={m} /> : l.memberId}</td>
            <td className="font-mono tnum">
              {fmtDate(l.fromDate)}{l.toDate !== l.fromDate ? " – " + fmtDate(l.toDate) : ""}
              <span className="cell-2 block">{days + (days > 1 ? " days" : " day")}</span>
            </td>
            <td><Pill xs tone="neutral" text={labelOf(LEAVE_KIND, l.kind)} /></td>
            <td>
              <span className="block max-w-md">{l.reason}</span>
              {clash ? (
                <span className="cell-2 block text-warning-primary!">
                  {clash.members.map((x) => x.name).join(", ")}
                  {clash.members.length > 1 ? " are" : " is"} also away on {fmtDate(clash.date)}.
                </span>
              ) : null}
              {unrouted ? <span className="cell-2 block text-warning-primary!">Waiting on an admin.</span> : null}
            </td>
            <td className="acts">
              <span className="inline-flex items-center gap-2">
                {m ? (
                  <Button color="tertiary" size="xs" onClick={() => go("#/team/" + m.memberId + "/leave")}>Open</Button>
                ) : null}
                <Button color="secondary" size="xs"
                  onClick={() => shell.modal(<LeaveDecideModal l={l} state="rejected" />)}>Refuse…</Button>
                <Button color="primary" size="xs"
                  onClick={() => shell.modal(<LeaveDecideModal l={l} state="approved" />)}>Approve…</Button>
              </span>
            </td>
          </tr>
        );
      })}
    </ListTable>
  );
}
