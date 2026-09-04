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
import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { usePageChrome } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import {
  EmptyState, FilterChips, Icon, Notice, SearchField, Select, StatStrip, Table, TbTitle, Toolbar, qs,
} from "../../ui";
import type { StatCell } from "../../ui";
import {
  LEAVE_KIND, TODAY, addDays, attendanceTotals, dayFor, decideLeave, endDay, fmtDate, fmtDayName, labelOf,
  fmtHM, fmtTime, meId, openDay, pendingLeave, readMember, resumeDay, scopeLabel, scopeOf,
  startBreak, stateOf, useDayRows, useLeave, useMe, useMembers, useMyDay, weekOf, workedOf,
  now as clockNow,
} from "./store";
import type { DayRow, Result } from "./store";
import { BarScale, DayBar, Meter, ScopeNote, StatePill, Who, ProtoBar } from "./bits";
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

  const goto = useCallback((patch: Record<string, string | undefined>) => {
    const next: Record<string, string> = { ...p };
    Object.keys(patch).forEach((k) => {
      const v = patch[k];
      if (v) next[k] = v; else delete next[k];
    });
    window.location.hash = ROUTE.slice(1) + qs(next);
  }, [p]);

  const onFilter = (name: string, value: string) => goto({ [name]: value || undefined });

  return (
    <div className="dls">
      <ProtoBar what="Attendance" endpoint="GET /admin/team/attendance" />

      <MyClock onAct={(r) => { if (!r.ok) shell.toast(r.message, "bad"); }} />

      <div className="dls-cmd">
        <Toolbar>
          <div className="tm-faces">
            <button className={"tm-face" + (face === "today" ? " on" : "")} onClick={() => goto({ face: undefined })}>
              <Icon name="clock" size="sm" />Today
            </button>
            <button className={"tm-face" + (face === "history" ? " on" : "")} onClick={() => goto({ face: "history" })}>
              <Icon name="history" size="sm" />History
            </button>
          </div>
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
        </Toolbar>
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

/** THE SENIOR SIDE. One block, only when there is something in it: a queue that
 *  renders an empty state every day is a queue people stop looking at.
 *  Approving writes NO attendance row — it suppresses the derived absence, and
 *  the day reads On leave instead. */
function LeaveInbox() {
  const shell = useShell();
  useLeave();
  const me = meId();
  const rows = pendingLeave(scopeOf("attendance"));
  if (!rows.length) return null;

  const decide = (id: string, state: "approved" | "rejected", note?: string) => {
    const r = decideLeave(id, state, me, note);
    shell.toast(r.ok ? "Leave " + state + "." : r.message, r.ok ? "" : "bad");
  };

  return (
    <div className="tm-inbox">
      <header>
        <b>Leave requests</b>
        <span className="pill warn xs">{rows.length}</span>
      </header>
      {rows.map((l) => {
        const m = readMember(l.memberId);
        const days = Math.round((new Date(l.toDate).getTime() - new Date(l.fromDate).getTime()) / 86400000) + 1;
        return (
          <div key={l.leaveId} className="tm-inbox-r">
            <span className="tm-inbox-t">
              <b>{m ? m.name : l.memberId}</b>
              <span className="cell-2">
                {fmtDate(l.fromDate)}{l.toDate !== l.fromDate ? " – " + fmtDate(l.toDate) : ""}
                {" · " + days + (days > 1 ? " days" : " day") + " · " + labelOf(LEAVE_KIND, l.kind)}
              </span>
            </span>
            <span className="tm-inbox-w">{l.reason}</span>
            <span className="spacer" />
            <button className="btn sm" onClick={() => shell.modal(
              <RefuseModal onSubmit={(n) => { shell.closeLayer(); decide(l.leaveId, "rejected", n); }} />, "sm")}>
              Refuse…
            </button>
            <button className="btn pri sm" onClick={() => decide(l.leaveId, "approved")}>Approve</button>
          </div>
        );
      })}
    </div>
  );
}

function RefuseModal({ onSubmit }: { onSubmit: (note: string) => void }) {
  const shell = useShell();
  const [v, setV] = useState("");
  return (
    <>
      <div className="md-h">
        <h3>Refuse this request</h3>
        <button className="btn icon sm md-x" aria-label="Close" onClick={() => shell.closeLayer()}>
          <Icon name="x" size="sm" />
        </button>
      </div>
      <div className="md-b">
        <div className="fg">
          <label htmlFor="lvRefuse">Reason <b className="req">*</b></label>
          <input id="lvRefuse" className="inp" autoFocus value={v} onChange={(e) => setV(e.target.value)} />
          <span className="help">The member sees it on their row.</span>
        </div>
      </div>
      <div className="md-f">
        <span className="spacer" />
        <button className="btn" onClick={() => shell.closeLayer()}>Cancel</button>
        <button className="btn dgr" disabled={!v.trim()} onClick={() => onSubmit(v)}>Refuse</button>
      </div>
    </>
  );
}
