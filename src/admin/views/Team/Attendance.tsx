/* =============================================================================
   Attendance — #/attendance
   -----------------------------------------------------------------------------
     #/attendance                    today, one row per member in scope
     #/attendance?face=history       the working week, member × day
     #/attendance?date=YYYY-MM-DD    any other business day

   THE CLOCK IS NOT THE LOGIN. `UserSession` already records every sign-in with
   its device, IP and user agent, and it is the wrong record: somebody checking
   one number at 23:40 has logged in and has not started a shift, and a token
   refresh advances "last active" whether or not anybody is at the keyboard. The
   day here is opened by a deliberate act and closed by another one.

   NOTHING AUTO-CLOSES A FORGOTTEN DAY. A day still open past its own auto-close
   renders as Unclosed and contributes nothing to any total until a person
   resolves it. An auto-closed day is a number the system invented; an unclosed
   one is a question, and a question is honest.

   NO API YET — everything comes from src/content/team/attendance.json through
   store.ts, which is the only file that knows that.
   ============================================================================= */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { usePageChrome } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import {
  EmptyState, FilterChips, Icon, Notice, SearchField, SectionHead, Select, StatStrip, Table,
  TbTitle, Tiles, qs,
} from "../../ui";
import type { StatCell } from "../../ui";
import { go } from "../../ui/nav";
import {
  LEAVE_KIND, TODAY, addDays, attendanceTotals, datesIn, dayFor, endDay, fmtDate, fmtDayName,
  labelOf, leaveOverlap, leaveQueue, fmtHM, fmtTime, meId, openDay, readMember, resumeDay,
  arrivalSpread, earliestAttendance, scopeLabel, scopeOf, spanDays, spanRows, spanTotals,
  startBreak, stateOf,
  useDayRows, useLeave, useMe, useMembers, useMyDay, weekOf, workedOf,
  now as clockNow,
} from "./store";
import type { DayRow, LeaveRequest, Result, SpanRow } from "./store";
import { LeaveDecideModal } from "./member/modals";
import { BarScale, DayBar, Meter, ScopeNote, StatePill, Who } from "./bits";
import { ensureAdopted } from "./adopt";
import "./team.css";

const ROUTE = "#/attendance";

export default function Attendance() {
  const [sp] = useSearchParams();
  const p = useMemo(() => {
    const o: Record<string, string> = {};
    sp.forEach((v, k) => { if (v) o[k] = v; });
    return o;
  }, [sp]);

  const face = FACES.some((f) => f.k === p.face) ? (p.face as string) : "today";
  const date = p.date || TODAY;
  const scope = scopeOf("attendance");
  const rows = useDayRows(date, scope);
  const members = useMembers();
  const me = useMe();

  /* THE CLOCK IS A COMPONENT IN THE SLOT, not a node handed to it. Chrome is
     published once per location, so a node built here would close over the
     worked-minutes it had at publish time and sit there frozen while the day
     ran on. Reading the store inside the component reads it at render time,
     which is the only time that answer is worth anything. */
  usePageChrome({
    crumbs: <TbTitle label="Attendance" to="#/attendance" />,
    right: <TopClock />,
  }, face + date);

  useEffect(() => { ensureAdopted(); }, []);

  const goto = useCallback((patch: Record<string, string | undefined>) => {
    const next: Record<string, string> = { ...p };
    Object.keys(patch).forEach((k) => {
      const v = patch[k];
      if (v) next[k] = v; else delete next[k];
    });
    go(ROUTE + qs(next));
  }, [p]);

  const onFilter = (name: string, value: string) => goto({ [name]: value || undefined });

  /* FOUR FACES, AND EACH ONE ANSWERS A DIFFERENT QUESTION. Today is "who is in
     right now", History is "what did this week look like", Analytics is "what
     is the shape of the last fortnight", and Requests is "what is waiting on
     me". They were one screen with the analytics implied and the requests
     buried in the middle of the day table, which is how a queue gets missed. */
  const waiting = leaveQueue(scope).total;

  return (
    <div className="dls">
      <div className="dls-chips">
        <div className="tabs">
          {FACES.map((f) => (
            <button key={f.k} className={face === f.k ? "on" : ""}
              onClick={() => goto({ face: f.k === "today" ? undefined : f.k })}>
              <Icon name={f.icon} size="sm" />{f.label}
              {f.k === "requests" && waiting ? <span className="n">{waiting}</span> : null}
            </button>
          ))}
        </div>
        <span className="spacer" />
        <ScopeNote text={scopeLabel(scope, rows.length)} />
      </div>

      {face === "today" || face === "history" ? (
        <div className="dls-cmd">
          {face === "today" ? (
            <>
              <SearchField ph="Search member" name="q" val={p.q} onFilter={onFilter} />
              <Select name="state" label="State" value={p.state} onFilter={onFilter}
                options={[{ v: "working", l: "Working" }, { v: "on_break", l: "On break" },
                  { v: "ended", l: "Day ended" }, { v: "unclosed", l: "Unclosed" },
                  { v: "not_started", l: "Not started" }, { v: "absent", l: "Absent" },
                  { v: "on_leave", l: "On leave" }]} />
              <Select name="late" label="Late" value={p.late} onFilter={onFilter}
                options={[{ v: "1", l: "Late only" }]} />
            </>
          ) : null}
          <span className="spacer" />
          <DateNav date={date} onPick={(d) => goto({ date: d === TODAY ? undefined : d })} />
        </div>
      ) : null}

      {face === "today" ? <Today rows={rows} p={p} date={date} onFilter={onFilter} />
        : face === "history" ? <History members={members} me={me ? me.memberId : meId()} scope={scope} date={date} />
          : face === "analytics" ? <Analytics scope={scope} span={p.span || "7"} onSpan={(v) => goto({ span: v === "7" ? undefined : v })} />
            : <Requests />}
    </div>
  );
}

const FACES = [
  { k: "today", label: "Today", icon: "clock" },
  { k: "history", label: "History", icon: "history" },
  { k: "analytics", label: "Analytics", icon: "chart" },
  { k: "requests", label: "Requests", icon: "inbox" },
];

/* ----------------------------------------------------------- the clock --- */

/** THE MEMBER'S OWN DAY, IN THE TOPBAR — and it earned the slot.
 *
 *  It used to be a card at the top of the body, which cost a whole band of
 *  vertical space on a screen that is otherwise a table, and put the one
 *  control anybody presses twice a day below the fold on a laptop. The topbar
 *  slot belongs to whichever module claims it, this module claims it on this
 *  route only, and the four buttons are the only place on the screen anybody
 *  writes.
 *
 *  IT IS A COMPONENT, NOT A NODE. Published chrome is captured once per
 *  location; a node built at publish time would freeze the worked-minutes it
 *  had then. This reads the store on every render of its own.
 *
 *  THE ACTIONS LIVE HERE AND NOWHERE ELSE. The member page states the day and
 *  never changes it — three "End the day" buttons over one open day is two
 *  chances for the panel to disagree with itself mid-request. */
export function TopClock() {
  const shell = useShell();
  const me = useMe();
  const { day, state, worked, breakMins } = useMyDay();
  if (!me) return null;

  const act = (fn: () => Result<unknown>) => {
    const r = fn();
    if (!r.ok) shell.toast(r.message, "bad");
  };
  const expected = me.expectedHoursPerDay;
  const pct = Math.min(100, Math.round(((worked || 0) / (expected * 60)) * 100));

  return (
    <div className={"tm-tclock " + state}>
      <StatePill state={state} />

      <span className="tm-tclock-n">
        <b className="tnum">{worked != null ? fmtHM(worked) : "—"}</b>
        {/* The bar is decoration over a number that is already stated, so it is
            hidden from the reader who is being read to rather than repeated. */}
        <span className="tm-tclock-bar" aria-hidden="true">
          <i style={{ width: pct + "%" }} />
        </span>
      </span>

      <span className="tm-tclock-k">
        of {expected}h expected
        {day ? <> · in at {fmtTime(day.startedAt)}</> : null}
        {day && day.isLate ? <b className="u-warn"> · {day.lateByMinutes}m late</b> : null}
        {breakMins ? <> · {fmtHM(breakMins)} break</> : null}
      </span>

      <span className="tm-tclock-a">
        {/* On leave still offers Start day: an approved day off does not stop
            somebody coming in, and the row they open is the truth. */}
        {state === "not_started" || state === "absent" || state === "on_leave"
          ? <button className="btn pri sm" onClick={() => act(() => openDay(me.memberId))}>Start day</button>
          : null}
        {state === "working" ? (
          <>
            <button className="btn sm" onClick={() => act(() => startBreak(me.memberId))}>Break</button>
            <button className="btn pri sm" onClick={() => act(() => endDay(me.memberId))}>End day</button>
          </>
        ) : null}
        {state === "on_break"
          ? <button className="btn pri sm" onClick={() => act(() => resumeDay(me.memberId))}>Resume</button>
          : null}
        {state === "ended" ? <span className="tm-tclock-x">Day closed.</span> : null}
        {state === "unclosed" ? <span className="tm-tclock-x u-warn">Never closed.</span> : null}
      </span>
    </div>
  );
}

/* ---------------------------------------------------------------- today --- */

function Today({ rows, p, date, onFilter }: {
  rows: DayRow[]; p: Record<string, string>; date: string;
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

  const cells: (StatCell | "sep")[] = [
    { k: "present", v: t.present, title: "Members with a day opened" },
    "sep",
    { k: "working", v: t.working, dot: "ok" },
    { k: "on break", v: t.onBreak, dot: "info" },
    { k: "ended", v: t.ended, dot: "" },
    "sep",
    { k: "late", v: t.late, dot: t.late ? "warn" : "", to: ROUTE + qs({ ...p, late: "1" }), on: !!p.late },
    { k: "absent", v: t.absent, dot: t.absent ? "bad" : "", to: ROUTE + qs({ ...p, state: "absent" }), on: p.state === "absent" },
    { k: "on leave", v: t.onLeave, dot: t.onLeave ? "info" : "", to: ROUTE + qs({ ...p, state: "on_leave" }), on: p.state === "on_leave" },
    { k: "unclosed", v: t.unclosed, dot: t.unclosed ? "warn" : "", to: ROUTE + qs({ ...p, state: "unclosed" }), on: p.state === "unclosed" },
  ];

  return (
    <>
      <StatStrip cells={cells} />
      <div className="dls-chips">
        <FilterChips params={{ q: p.q, state: p.state, late: p.late }}
          labels={{ late: "late only" }}
          onUnfilter={(n) => onFilter(n, "")} />
      </div>
      <div className="dls-body">
        <div className="tm-daterow">
          <b>{fmtDayName(date)} {fmtDate(date)}</b>
          {date === TODAY ? <span className="pill xs">today</span> : null}
        </div>
        <Table
          scroll min="980px"
          cols={[
            { label: "", w: "3px" },
            { label: "Member" },
            { label: "State", w: "120px" },
            { label: "In", w: "82px" },
            { label: "Out", w: "82px" },
            { label: "Break", cls: "n", w: "80px" },
            { label: "Worked", cls: "n", w: "92px" },
            /* AGAINST EXPECTED, on the row. "6h 10m" is a fact; whether it is a
               short day depends on what that member was expected to do, and
               that number lives on the member. Without this column the reader
               has to know eight people's contracted hours by heart. */
            { label: "Of expected", w: "180px" },
            { label: <>The day <BarScale /></>, w: "280px" },
          ]}
          empty={{
            icon: "clock",
            title: p.q || p.state || p.late ? "No member matches" : "Nobody has clocked in",
            body: p.q || p.state || p.late
              ? "Clear the filters to see the whole day."
              : "The first Start day of the morning opens a row here.",
          }}
          rows={list.map((r) => {
            const rail = r.state === "absent" ? "u-bad"
              : r.state === "unclosed" || (r.day && r.day.isLate) ? "u-warn" : "";
            return (
              <tr key={r.member.memberId} className={rail + (r.day ? "" : " dim")}>
                <td className="rail"><i className={rail} /></td>
                <td><Who m={r.member} /></td>
                <td><StatePill state={r.state} /></td>
                <td className="tnum">
                  {r.day ? fmtTime(r.day.startedAt) : "—"}
                  {r.day && r.day.isLate
                    ? <b className="tm-late" title={"Late by " + r.day.lateByMinutes + " minutes against a " + r.member.dayStartsAt + " start"}>late</b>
                    : null}
                </td>
                <td className="tnum">{r.day && r.day.endedAt ? fmtTime(r.day.endedAt) : "—"}</td>
                <td className="n tnum">{r.breakMins ? fmtHM(r.breakMins) : "—"}</td>
                <td className="n tnum">{r.worked != null ? fmtHM(r.worked) : "—"}</td>
                <td>
                  {r.worked != null ? (
                    <Meter value={r.worked} of={r.member.expectedHoursPerDay * 60}
                      tone={r.state === "on_break" ? "info"
                        : r.worked >= r.member.expectedHoursPerDay * 60 ? "ok" : "warn"}
                      label={<>{fmtHM(r.worked)} of {r.member.expectedHoursPerDay}h</>} />
                  ) : <span className="dim">no row</span>}
                </td>
                <td><DayBar row={r} nowH={nowH} /></td>
              </tr>
            );
          })}
        />
        {t.unclosed ? (
          <Notice tone="warn" text={
            t.unclosed + " day" + (t.unclosed > 1 ? "s" : "") + " left open past the member's auto-close. "
            + "Nothing is written automatically — the member is asked to confirm or correct on their next visit, "
            + "and until then those days count towards no total."} />
        ) : null}
      </div>
    </>
  );
}

/* -------------------------------------------------------------- history --- */

function History({ members, me, scope, date }: {
  members: ReturnType<typeof useMembers>; me: string; scope: ReturnType<typeof scopeOf>; date: string;
}) {
  const week = weekOf(date);
  const inScope = members.filter((m) =>
    m.status === "active" && (scope === "all" || m.memberId === me || m.reportsTo === me));

  return (
    <div className="dls-body">
      <div className="tm-daterow">
        <b>Week of {fmtDate(week[0])}</b>
        <span className="dim">{week.length} working days · weekends are not counted (leave and holidays are out of v1)</span>
      </div>
      {inScope.length ? (
        <Table
          scroll min="840px"
          cols={[{ label: "Member" } as { label: string; cls?: string; w?: string }]
            .concat(week.map((d) => ({ label: fmtDayName(d) + " " + d.slice(8), cls: "n", w: "96px" })))
            .concat([{ label: "Total", cls: "n", w: "96px" }])}
          rows={inScope.map((m) => {
            let total = 0;
            const tds = week.map((d) => {
              const day = dayFor(m.memberId, d);
              const st = stateOf(day, m, clockNow());
              const w = workedOf(day, m, clockNow());
              if (w != null) total += w;
              const cls = st === "unclosed" ? "warn" : day && day.isLate ? "warn" : !day ? "dim" : "";
              return (
                <td key={d} className={"n tnum " + cls}
                  title={day
                    ? fmtTime(day.startedAt) + " → " + (day.endedAt ? fmtTime(day.endedAt) : "still open")
                    : "No record — absent"}>
                  {w != null ? fmtHM(w) : st === "unclosed" ? "open" : "—"}
                </td>
              );
            });
            return (
              <tr key={m.memberId}>
                <td><Who m={m} /></td>
                {tds}
                <td className="n tnum"><b>{fmtHM(total)}</b></td>
              </tr>
            );
          })}
        />
      ) : (
        <EmptyState icon="users" title="Nobody reports to you"
          body="This week's grid shows you and the members whose reporting line points at you." />
      )}
      <Notice text={
        "An unclosed day shows as “open” and adds nothing to the total. A blank cell is no record at all — "
        + "absence is the lack of a row, never a row saying absent."} />
    </div>
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
 *  anywhere on the face. "Meera: 78" would be a number the panel invented and
 *  a conversation nobody could have honestly.
 */
function Analytics({ scope, span, onSpan }: {
  scope: ReturnType<typeof scopeOf>; span: string; onSpan: (v: string) => void;
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
     whole rule is "an absence is the lack of a row" those two are identical.
     So the screen says which one it is looking at. */
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

  const col = (k: string, label: string, w?: string) => ({
    label: (
      <button className={"tm-sort" + (sort === k ? " on" : "")} onClick={() => setSort(k)}
        aria-pressed={sort === k}>
        {label}{sort === k ? <Icon name="chev" size="sm" /> : null}
      </button>
    ),
    cls: k === "name" ? "" : "n",
    w,
  });

  const peak = Math.max(1, ...spread.map((x) => x.n));

  return (
    <>
      <div className="dls-cmd">
        <span className="btn-group">
          {SPANS.map((o) => (
            <button key={o.v} className={span === o.v ? "on" : ""} onClick={() => onSpan(o.v)}>{o.l}</button>
          ))}
        </span>
        <span className="dim">{fmtDate(from)} to {fmtDate(TODAY)} · weekends excluded</span>
        <span className="spacer" />
      </div>

      <div className="dls-body">
        <Tiles list={[
          {
            k: "On time", v: t.onTimePct === null ? "\u2014" : t.onTimePct + "%",
            s: t.present ? t.late + " late of " + t.present + " days worked" : "nothing worked yet",
            tone: t.onTimePct !== null && t.onTimePct < 80 ? "warn" : "",
          },
          {
            k: "Average day", v: t.avgDay === null ? "\u2014" : fmtHM(t.avgDay),
            s: t.days ? "against " + fmtHM(Math.round(t.expected / t.days)) + " expected" : "\u2014",
          },
          {
            k: "Absent", v: String(t.absent),
            s: t.days ? Math.round((t.absent / t.days) * 100) + "% of expected days" : "\u2014",
            tone: t.absent ? "bad" : "",
          },
          {
            k: "Unclosed", v: String(t.unclosed),
            s: "counted towards no total", tone: t.unclosed ? "warn" : "",
          },
        ]} />

        {first && from < first ? (
          <Notice tone="warn" ico="alert" text={
            <>
              <b>Nothing is recorded before {fmtDate(first)}.</b> Every earlier day in this window
              counts as absent, because an absence IS the lack of a row and nothing here can tell
              "nobody came in" apart from "nothing was written". Narrow the window, or read those
              days as the edge of the record rather than as a week nobody worked.
            </>
          } />
        ) : null}

        <SectionHead title="Day by day"
          desc="One bar per working day, across everybody in scope. Absence is the lack of a row, so it is drawn as the part of the bar nobody filled." />
        <div className="tm-an-days">
          <div className="tm-an-plot">
            {daily.map((d) => {
              const total = Math.max(1, d.present + d.absent + d.onLeave + d.unclosed);
              const seg = (n: number, cls: string, what: string) => (n
                ? <i key={cls} className={cls} style={{ height: (n / total) * 100 + "%" }} title={n + " " + what} />
                : null);
              return (
                <span key={d.date} className={"tm-an-day" + (d.date === TODAY ? " today" : "")}>
                  <span className="tm-an-stack" role="img"
                    aria-label={fmtDate(d.date) + ": " + (d.present - d.late) + " on time, " + d.late
                      + " late, " + d.onLeave + " on leave, " + d.absent + " absent, "
                      + d.unclosed + " unclosed"}>
                    {seg(d.unclosed, "u", "unclosed")}
                    {seg(d.absent, "a", "absent")}
                    {seg(d.onLeave, "l", "on leave")}
                    {seg(d.late, "t", "late")}
                    {seg(d.present - d.late, "p", "in on time")}
                  </span>
                  <b>{d.date.slice(8)}</b>
                  <i>{fmtDayName(d.date).slice(0, 1)}</i>
                </span>
              );
            })}
          </div>
          <span className="tm-an-key">
            <span><i className="p" />on time</span>
            <span><i className="t" />late</span>
            <span><i className="l" />leave</span>
            <span><i className="a" />absent</span>
            <span><i className="u" />unclosed</span>
          </span>
        </div>

        <SectionHead title="When people arrive"
          desc="A spread, not an average. One person at 11:00 moves a mean and tells you nothing about everybody else." />
        {spread.length ? (
          <div className="tm-an-spread">
            {spread.map((b) => (
              <span key={b.at} className="tm-an-col" title={b.n + " arrivals in the half-hour from " + b.label}>
                <b>{b.n}</b>
                <i style={{ height: (b.n / peak) * 100 + "%" }} />
                <em>{b.label}</em>
              </span>
            ))}
          </div>
        ) : (
          <Notice text="Nobody has clocked in over this window, so there is nothing to spread." />
        )}

        <SectionHead title="Per member"
          desc="Counts and totals. Every column sorts and none of them add up to a score — that is the point." />
        <Table
          scroll min="960px"
          cols={[col("name", "Member"), col("present", "In", "100px"), col("late", "Late", "110px"),
            col("absent", "Absent", "100px"), col("unclosed", "Unclosed", "110px"),
            col("worked", "Worked", "110px"), col("avg", "Average day", "130px"),
            { label: "Against expected", w: "220px" }]}
          empty={{ icon: "users", title: "Nobody in scope", body: "No active member reports into this view." }}
          rows={sorted.map((r) => (
            <tr key={r.member.memberId}>
              <td><Who m={r.member} /></td>
              <td className="n tnum">{r.present}<span className="cell-2">of {r.days}</span></td>
              <td className={"n tnum" + (r.late ? " u-warn" : "")}>
                {r.late || "\u2014"}
                {r.late ? <span className="cell-2">{fmtHM(r.lateMinutes)} over</span> : null}
              </td>
              <td className={"n tnum" + (r.absent ? " u-bad" : "")}>{r.absent || "\u2014"}</td>
              <td className={"n tnum" + (r.unclosed ? " u-warn" : "")}>{r.unclosed || "\u2014"}</td>
              <td className="n tnum">{fmtHM(r.worked)}</td>
              <td className="n tnum">{r.present ? fmtHM(Math.round(r.worked / r.present)) : "\u2014"}</td>
              <td>
                <Meter value={r.worked} of={Math.max(1, r.expected)}
                  tone={r.worked >= r.expected * 0.95 ? "ok" : r.worked >= r.expected * 0.8 ? "info" : "warn"}
                  label={<>{fmtHM(r.worked)} of {fmtHM(r.expected)}</>} />
              </td>
            </tr>
          ))} />

        <Notice text={
          "An unclosed day adds no hours and is not an absence — it is its own column, exactly as it is on "
          + "the day view. Nobody is counted before the day they joined, so a new member does not open on a "
          + "fortnight of absences they could not have attended."} />
      </div>
    </>
  );
}

/* ------------------------------------------------------------- requests --- */

/** THE QUEUE, ON ITS OWN. It used to sit in the middle of the day table, above
 *  the rows and below the stats — a fine place for something nobody is looking
 *  for, and a poor one for the only block on this screen waiting on a person.
 *  It has a tab and a count now. */
function Requests() {
  useLeave();
  const q = leaveQueue(scopeOf("attendance"));
  return (
    <div className="dls-body">
      {q.total ? <LeaveInbox /> : (
        <EmptyState icon="inbox" title="Nothing waiting on you"
          body={"No leave request needs a decision. A request appears here only while it is undecided — "
            + "once it is approved or refused it lives on that member's own leave page."} />
      )}
      <Notice text={
        "Approving writes no attendance row. It suppresses the derived absence and those days read as "
        + "On leave instead — which is why a request left sitting here quietly counts as absence until "
        + "somebody decides it."} />
    </div>
  );
}

/* ------------------------------------------------------------- date nav --- */

function DateNav({ date, onPick }: { date: string; onPick: (d: string) => void }) {
  return (
    <div className="tm-datenav">
      <button className="btn icon sm" aria-label="Previous day" onClick={() => onPick(addDays(date, -1))}>
        <Icon name="chevl" size="sm" />
      </button>
      <span className="tnum">{fmtDate(date)}</span>
      <button className="btn icon sm" aria-label="Next day"
        disabled={date >= TODAY}
        onClick={() => onPick(addDays(date, 1))}>
        <Icon name="chevr" size="sm" />
      </button>
      {date !== TODAY ? <button className="btn sm" onClick={() => onPick(TODAY)}>Today</button> : null}
    </div>
  );
}

/* ------------------------------------------------------------- leave --- */

/** THE SENIOR SIDE, and the two things a queue like this usually gets wrong.
 *
 *  · **An empty queue renders nothing.** A block that draws "no requests" every
 *    single day is a block people stop looking at, and then miss the day it has
 *    something in it.
 *  · **A request with no approver is never silent.** Somebody at the top of the
 *    tree points at nobody with `reportsTo`, so their request has no reporting
 *    line to route down. It falls to any holder of the deciding verb and it
 *    says so out loud — a request that simply sat there is the exact failure
 *    this second block exists to prevent.
 *
 *  Approving writes NO attendance row. It suppresses the derived absence, and
 *  the day reads On leave instead.
 */
function LeaveInbox() {
  useLeave();
  const { mine, unrouted } = leaveQueue(scopeOf("attendance"));
  if (!mine.length && !unrouted.length) return null;

  return (
    <>
      {mine.length ? (
        <div className="tm-inbox">
          <header>
            <b>Leave requests</b>
            <span className="pill warn xs">{mine.length}</span>
            <span className="spacer" />
            <span className="tm-inbox-w">Until you decide, those days still read as absent.</span>
          </header>
          {mine.map((l) => <InboxRow key={l.leaveId} l={l} />)}
        </div>
      ) : null}

      {unrouted.length ? (
        <div className="tm-inbox">
          <header>
            <b>Nobody to route these to</b>
            <span className="pill warn xs">{unrouted.length}</span>
            <span className="spacer" />
            <span className="tm-inbox-w">
              These members report to nobody, so they fall to any admin who can decide leave.
            </span>
          </header>
          {unrouted.map((l) => <InboxRow key={l.leaveId} l={l} unrouted />)}
        </div>
      ) : null}
    </>
  );
}

function InboxRow({ l, unrouted }: { l: LeaveRequest; unrouted?: boolean }) {
  const shell = useShell();
  const m = readMember(l.memberId);
  const days = datesIn(l.fromDate, l.toDate).length;
  /* The clash is shown ON THE ROW as well as in the dialog, because the whole
     point of it is to be seen before somebody clicks Approve out of habit. */
  const clash = leaveOverlap(l)[0] || null;

  return (
    <div className="tm-inbox-r">
      <span className="tm-inbox-t">
        <b>{m ? m.name : l.memberId}</b>
        <span className="cell-2">
          {fmtDate(l.fromDate)}{l.toDate !== l.fromDate ? " – " + fmtDate(l.toDate) : ""}
          {" · " + days + (days > 1 ? " days" : " day") + " · " + labelOf(LEAVE_KIND, l.kind)}
        </span>
      </span>
      <span className="tm-inbox-w">
        {l.reason}
        {clash ? (
          <b className="u-warn">
            {" "}{clash.members.map((x) => x.name).join(", ")}
            {clash.members.length > 1 ? " are" : " is"} also away on {fmtDate(clash.date)}.
          </b>
        ) : null}
        {unrouted ? <b className="u-warn"> Waiting on an admin.</b> : null}
      </span>
      <span className="spacer" />
      {m ? (
        <button className="btn sm" onClick={() => go("#/team/" + m.memberId + "/leave")}>Open</button>
      ) : null}
      <button className="btn sm" onClick={() => shell.modal(<LeaveDecideModal l={l} state="rejected" />)}>
        Refuse…
      </button>
      <button className="btn pri sm" onClick={() => shell.modal(<LeaveDecideModal l={l} state="approved" />)}>
        Approve…
      </button>
    </div>
  );
}
