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
import { useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { usePageChrome } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import {
  EmptyState, FilterChips, Icon, Notice, SearchField, Select, StatStrip, Table, TbTitle, qs,
} from "../../ui";
import type { StatCell } from "../../ui";
import { go } from "../../ui/nav";
import {
  LEAVE_KIND, TODAY, addDays, attendanceTotals, datesIn, dayFor, endDay, fmtDate, fmtDayName,
  labelOf, leaveOverlap, fmtHM, fmtTime, meId, openDay, pendingLeave, readMember, resumeDay,
  scopeLabel, scopeOf, startBreak, stateOf, unroutedLeave, useDayRows, useLeave, useMe, useMembers,
  useMyDay, weekOf, workedOf, now as clockNow,
} from "./store";
import type { DayRow, LeaveRequest, Result } from "./store";
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

  const face = p.face === "history" ? "history" : "today";
  const date = p.date || TODAY;
  const scope = scopeOf("attendance");
  const rows = useDayRows(date, scope);
  const members = useMembers();
  const me = useMe();
  const shell = useShell();

  usePageChrome({
    crumbs: <TbTitle label="Attendance" to="#/attendance" />,
    right: <ScopeNote text={scopeLabel(scope, rows.length)} />,
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

  return (
    <div className="dls">
      <MyClock onAct={(r) => { if (!r.ok) shell.toast(r.message, "bad"); }} />

      <div className="dls-cmd">
        <span className="btn-group">
          <button className={face === "today" ? "on" : ""} onClick={() => goto({ face: undefined })}>
            <Icon name="clock" size="sm" />Today
          </button>
          <button className={face === "history" ? "on" : ""} onClick={() => goto({ face: "history" })}>
            <Icon name="history" size="sm" />History
          </button>
        </span>
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

      {face === "today"
        ? <Today rows={rows} p={p} date={date} onFilter={onFilter} />
        : <History members={members} me={me ? me.memberId : meId()} scope={scope} date={date} />}
    </div>
  );
}

/* ------------------------------------------------------------- my clock --- */

/** The member's own day, and the only place on this screen anybody writes.
 *
 *  It is a card here rather than a strip in the topbar because the topbar is
 *  shared chrome for every module in the panel and this module has not earned a
 *  permanent slot in it yet. When it has, the same four buttons move up there
 *  and nothing else about this file changes. */
function MyClock({ onAct }: { onAct: (r: Result<unknown>) => void }) {
  const me = useMe();
  const { day, state, worked, breakMins } = useMyDay();
  if (!me) return null;

  const act = (fn: () => Result<unknown>) => onAct(fn());
  const expected = me.expectedHoursPerDay;

  return (
    <div className={"tm-clock " + state}>
      <div className="tm-clock-l">
        <span className="tm-clock-s"><StatePill state={state} /></span>
        <span className="tm-clock-v tnum">{worked != null ? fmtHM(worked) : "—"}</span>
        <span className="tm-clock-k">
          {day ? "in at " + fmtTime(day.startedAt) : "not started"}
          {day && day.isLate ? <b className="warn"> · {day.lateByMinutes}m late</b> : null}
          {breakMins ? " · " + fmtHM(breakMins) + " break" : null}
        </span>
        <Meter value={worked || 0} of={expected * 60} tone={state === "on_break" ? "info" : "ok"} />
        <span className="tm-clock-x">of {expected}h expected</span>
      </div>
      <div className="tm-clock-a">
        {/* On leave still offers Start day: an approved day off does not stop
            somebody coming in, and the row they open is the truth. */}
        {state === "not_started" || state === "absent" || state === "on_leave"
          ? <button className="btn pri" onClick={() => act(() => openDay(me.memberId))}>Start day</button>
          : null}
        {state === "working"
          ? <>
            <button className="btn" onClick={() => act(() => startBreak(me.memberId))}>Break</button>
            <button className="btn pri" onClick={() => act(() => endDay(me.memberId))}>End day</button>
          </>
          : null}
        {state === "on_break"
          ? <button className="btn pri" onClick={() => act(() => resumeDay(me.memberId))}>Resume</button>
          : null}
        {state === "ended" ? <span className="dim">Day closed.</span> : null}
        {state === "unclosed"
          ? <Notice tone="warn" text="This day was never closed. Ask an admin to correct it — nothing is written automatically." />
          : null}
      </div>
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
        <LeaveInbox />
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
            { label: <>The day <BarScale /></>, w: "300px" },
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
  const mine = pendingLeave(scopeOf("attendance"));
  const unrouted = unroutedLeave().filter((l) => mine.every((x) => x.leaveId !== l.leaveId));
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
