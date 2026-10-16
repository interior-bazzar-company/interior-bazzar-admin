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

   ON THE BACKEND — attendance days, settings and leave through store.ts
   (bootTeam), which is the only file that knows that.
   ============================================================================= */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { can, usePageChrome } from "../../shell/AdminShell";
import { getSession } from "../../auth/session";
import { useShell } from "../../shell/ShellContext";
import {
  Alert, Button, ChartFrame, DateInput, EmptyState, FieldRow, FilterBar, FilterChips, FormField, FormSection, IconButton, Input,
  ListTable, ModalShell, PageHeader, Pill, Rail, SearchField, SectionHead, Segmented, Select, SelectInput, StatStrip,
  Tabs, TbTitle, Tiles, qs,
} from "../../ui";
import type { StatCell } from "../../ui";
import { ColumnChart } from "../charts";
import { go } from "../../ui/nav";
import {
  ATTENDANCE_STATE, LEAVE_KIND, TODAY, addDays, canDecideLeave, attendanceTotals, clampDay, correctDay, datesIn, dayFor, dayRows, decidedLeave, fmtDate, fmtDayName,
  fmtMonth, isHumanEmployee, isWeekend, labelOf, leaveOverlap, leaveQueue, fmtHM, fmtTime, meId, monthStep,
  readMember, arrivalSpread, earliestAttendance, scopeLabel, scopeOf, spanDays, spanRows,
  spanTotals, stateOf, openDayAt, startBreak, resumeDay, unclosedRows, useDayRows, useLeave, useMe, useMembers,
  useMyDay, workedOf, now as clockNow,
} from "./store";
import type { DayRow, LeaveRequest, Member, Scope, SpanRow } from "./store";
import { LeaveDecideModal, LeaveEscalateModal, LeaveRequestModal } from "./member/modals";
import { EodModal } from "./member/reportForms";
import { BarScale, DayBar, Meter, StatePill, Who } from "./bits";
import { HeatGrid, HeatLegend, SortHead, StackBars } from "./workBits";
import type { HeatCell, HeatRow, StackDay } from "./workBits";
import { ensureAdopted } from "./adopt";

const ROUTE = "#/attendance";

function csvCell(v: string | number | null | undefined): string {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(filename: string, rows: {
  memberName: string;
  date: string;
  checkIn: string;
  checkOut: string;
  breakDuration: string;
  totalHours: string;
  status: string;
}[]) {
  const header = ["Member Name", "Date", "Check-In", "Check-Out", "Break Duration", "Total Hours", "Status"];
  const lines = [
    header.join(","),
    ...rows.map((r) => [
      csvCell(r.memberName),
      csvCell(r.date),
      csvCell(r.checkIn),
      csvCell(r.checkOut),
      csvCell(r.breakDuration),
      csvCell(r.totalHours),
      csvCell(r.status),
    ].join(",")),
  ];
  const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const isoToHHMM = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
};

/* ORDER IS URGENCY, NOT CHRONOLOGY. The record is the live day, Requests is the
   only tab that can be waiting on the reader, and the window comes last. */
const TABS = [
  { k: "record", label: "Record", icon: "clock" },
  { k: "requests", label: "Requests", icon: "inbox" },
  { k: "analytics", label: "Analytics", icon: "chart" },
];
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
  const shell = useShell();
  const isAdmin = !!getSession()?.isFullAccess || can("attendance", "approve") || can("attendance", "all");

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

  const onFilter = (name: string, value: string) => {
    if (name === "*") { goto({ q: undefined, state: undefined, late: undefined, member: undefined }); return; }
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
            <span>{scopeLabel(scope, members.filter(isHumanEmployee).filter((m) => m.status === "active").length)}</span>
            {date === TODAY ? <Pill xs dot tone="live" text="live" /> : null}
          </>
        }
        actions={
          face === "requests" ? (
            <Button
              color="primary"
              ico="plus"
              onClick={() => shell.modal(<LeaveRequestModal memberId={p.member || (me ? me.memberId : meId())} />)}
            >
              Request leave
            </Button>
          ) : isAdmin ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                color="secondary"
                ico="clock"
                onClick={() => shell.modal(
                  <AdminAttendanceModal
                    mode="log"
                    defaultMemberId={p.member || (rows[0]?.member.memberId ?? "")}
                    defaultDate={date}
                  />
                )}
              >
                Log check-in / out
              </Button>
            </div>
          ) : undefined
        }
        tabs={
          <Tabs cur={tab}
            items={TABS.map((t) => ({ k: t.k, label: t.label, icon: t.icon,
              n: t.k === "requests" ? waiting : undefined }))}
            onPick={(k) => goto({ face: k === "record" ? undefined : k })} />
        }
      />

      {face === "today"
        ? <Today rows={rows} date={date} p={p} bar={bar} isAdmin={isAdmin} onFilter={onFilter} />
        : face === "history"
          ? <Month members={members} me={me ? me.memberId : meId()} scope={scope} date={date}
              memberFilter={p.member} bar={bar} onPick={onDate} onFilter={onFilter} />
          : face === "analytics"
            ? <Analytics scope={scope} span={p.span || "7"} memberFilter={p.member}
                onSpan={(v) => goto({ span: v === "7" ? undefined : v })} />
            : <Requests />}
    </div>
  );
}

/* ------------------------------------------------------------- date bar --- */

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

function Today({ rows, date, p, bar, isAdmin, onFilter }: {
  rows: DayRow[]; date: string; p: Record<string, string>; bar: ReactNode;
  isAdmin: boolean; onFilter: (n: string, v: string) => void;
}) {
  const shell = useShell();
  const nowH = useMemo(() => {
    const d = new Date(clockNow());
    return d.getHours() + d.getMinutes() / 60;
  }, []);

  const t = attendanceTotals(rows);
  const histUnclosed = unclosedRows(scopeOf("attendance"));
  const unclosedCount = t.unclosed || histUnclosed.length;
  const showingPastUnclosed = p.state === "unclosed" && t.unclosed === 0 && histUnclosed.length > 0;

  let list = showingPastUnclosed ? histUnclosed : rows;
  if (p.member) {
    list = list.filter((r) => r.member.memberId === p.member);
  }
  if (p.q) {
    const q = p.q.toLowerCase();
    list = list.filter((r) => r.member.name.toLowerCase().indexOf(q) >= 0
      || r.member.designation.toLowerCase().indexOf(q) >= 0);
  }
  if (p.state && !showingPastUnclosed) {
    list = p.state === "present" ? list.filter((r) => !!r.day) : list.filter((r) => r.state === p.state);
  }
  if (p.late) list = list.filter((r) => !!r.day && r.day.isLate);

  const exportTodayCsv = () => {
    downloadCsv(
      `attendance-${date}.csv`,
      list.map((r) => ({
        memberName: r.member.name,
        date: r.day?.businessDate || date,
        checkIn: r.day && r.day.startedAt ? fmtTime(r.day.startedAt) : "—",
        checkOut: r.day && r.day.endedAt ? fmtTime(r.day.endedAt) : "—",
        breakDuration: r.breakMins ? fmtHM(r.breakMins) : "0m",
        totalHours: r.worked != null ? fmtHM(r.worked) : "—",
        status: labelOf(ATTENDANCE_STATE, r.state) + (r.day && r.day.isLate ? " (Late)" : ""),
      }))
    );
  };

  const at = (patch: Record<string, string | undefined>) => {
    const next: Record<string, string> = { ...p };
    delete next.state; delete next.late;
    Object.keys(patch).forEach((k) => { const v = patch[k]; if (v) next[k] = v; });
    return ROUTE + qs(next);
  };
  const cells: (StatCell | "sep")[] = [
    {
      k: t.late ? `present (${t.late} late)` : "present",
      v: t.present,
      dot: "ok",
      title: "Members with a day opened (includes on-time and late arrivals)",
      to: p.state === "present" ? at({}) : at({ state: "present" }),
      on: p.state === "present",
    },
    "sep",
    { k: "working", v: t.working, dot: "ok", to: p.state === "working" ? at({}) : at({ state: "working" }), on: p.state === "working" },
    { k: "on break", v: t.onBreak, dot: "info", to: p.state === "on_break" ? at({}) : at({ state: "on_break" }), on: p.state === "on_break" },
    { k: "ended", v: t.ended, dot: "neutral", to: p.state === "ended" ? at({}) : at({ state: "ended" }), on: p.state === "ended" },
    "sep",
    { k: "late (in present)", v: t.late, dot: t.late ? "warn" : "neutral", title: "Subset of present members who checked in late", to: p.late ? at({}) : at({ late: "1" }), on: !!p.late },
    { k: "not started", v: t.notStarted, dot: "neutral", to: p.state === "not_started" ? at({}) : at({ state: "not_started" }), on: p.state === "not_started" },
    { k: "absent", v: t.absent, dot: t.absent ? "bad" : "neutral", to: p.state === "absent" ? at({}) : at({ state: "absent" }), on: p.state === "absent" },
    { k: "on leave", v: t.onLeave, dot: t.onLeave ? "info" : "neutral", to: p.state === "on_leave" ? at({}) : at({ state: "on_leave" }), on: p.state === "on_leave" },
    {
      k: !t.unclosed && histUnclosed.length ? "unclosed (past)" : "unclosed",
      v: unclosedCount,
      dot: unclosedCount ? "warn" : "neutral",
      to: p.state === "unclosed" ? at({}) : at({ state: "unclosed" }),
      on: p.state === "unclosed",
    },
  ];

  const narrowed = !!(p.q || p.state || p.late || p.member);
  const selectedMember = p.member ? rows.find((r) => r.member.memberId === p.member)?.member || readMember(p.member) : null;

  return (
    <>
      {p.date === undefined && rows.some((r) => r.member.memberId === meId()) ? <CheckIn /> : null}
      <StatStrip cells={cells} />

      <FilterBar
        search={<SearchField ph="Search member" name="q" val={p.q} onFilter={onFilter} />}
        filters={
          <>
            <Select
              name="member"
              label="Member"
              value={p.member}
              onFilter={onFilter}
              options={rows.map((r) => ({ v: r.member.memberId, l: r.member.name }))}
            />
            <Select name="state" label="State" value={p.state} onFilter={onFilter}
              options={[
                { v: "present", l: "Present (all)", dot: "ok" },
                { v: "working", l: "Working", dot: "ok" },
                { v: "on_break", l: "On break", dot: "info" },
                { v: "ended", l: "Day ended", dot: "neutral" },
                { v: "unclosed", l: "Unclosed", dot: "warn" },
                { v: "not_started", l: "Not started", dot: "neutral" },
                { v: "absent", l: "Absent", dot: "bad" },
                { v: "on_leave", l: "On leave", dot: "info" },
              ]} />
            <Select name="late" label="Late" value={p.late} onFilter={onFilter}
              options={[{ v: "1", l: "Late only", dot: "warn" }]} />
          </>
        }
        right={
          <div className="flex flex-wrap items-center gap-2">
            {bar}
            <Button color="secondary" size="sm" ico="download" onClick={exportTodayCsv}>
              Export CSV
            </Button>
          </div>
        }
        chips={
          <FilterChips
            params={{
              q: p.q,
              member: selectedMember ? selectedMember.name : p.member,
              state: p.state,
              late: p.late,
            }}
            labels={{ late: "late only", member: "member" }}
            onUnfilter={(n) => onFilter(n, "")}
          />
        }
      />

      {showingPastUnclosed ? (
        <Alert tone="warn" title={`${list.length} historical unclosed attendance record${list.length === 1 ? "" : "s"} awaiting resolution`}>
          Today has 0 unclosed records because the shift is still active. Showing past days left open past auto-close so you can correct or force-close them directly.
        </Alert>
      ) : null}

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
              <th>Of expected</th>
              <th>
                <span className="flex flex-col gap-1">
                  <span>The day</span>
                  <BarScale />
                </span>
              </th>
              {isAdmin ? <th className="acts"><span className="sr-only">Manage</span></th> : null}
            </tr>
          }>
          {list.map((r) => {
            const tone = r.state === "absent" ? "bad"
              : r.state === "unclosed" || (r.day && r.day.isLate) ? "warn" : undefined;
            const isOpenDay = !!r.day && !r.day.endedAt;
            const rowDate = r.day?.businessDate || date;
            return (
              <tr key={r.member.memberId + "-" + rowDate}>
                <Rail tone={tone} />
                <td className="cell-1">
                  <Who m={r.member} />
                  {showingPastUnclosed && r.day ? (
                    <span className="cell-2 block font-mono">{fmtDate(r.day.businessDate)}</span>
                  ) : null}
                </td>
                <td>
                  <span className="inline-flex flex-wrap items-center gap-1">
                    <StatePill state={r.state} />
                    {r.day && r.day.isLate ? (
                      <Pill xs tone="warn" text="Late"
                        title={"Late by " + r.day.lateByMinutes + " minutes against a " + r.member.dayStartsAt + " start"} />
                    ) : null}
                  </span>
                </td>
                <td className="font-mono tnum">
                  <span className="flex items-center gap-1.5">
                    {r.day ? fmtTime(r.day.startedAt) : <span className="text-quaternary">—</span>}
                    {r.day && r.day.isLate ? (
                      <Pill xs tone="warn" text={r.day.lateByMinutes ? `+${r.day.lateByMinutes}m` : "late"}
                        title={"Late by " + r.day.lateByMinutes + " minutes against a " + r.member.dayStartsAt + " start"} />
                    ) : null}
                  </span>
                </td>
                <td className="font-mono tnum">
                  {r.day && r.day.endedAt ? fmtTime(r.day.endedAt) : <span className="text-quaternary">—</span>}
                </td>
                <td className="n">{r.breakMins ? fmtHM(r.breakMins) : "—"}</td>
                <td className="n">
                  {r.worked != null
                    ? (isOpenDay && rowDate === TODAY ? fmtHM(r.worked) + " so far" : fmtHM(r.worked))
                    : "—"}
                </td>
                <td>
                  {r.worked != null ? (
                    <Meter value={r.worked} of={r.member.expectedHoursPerDay * 60}
                      tone={r.state === "on_break" ? "info"
                        : r.worked >= r.member.expectedHoursPerDay * 60 ? "ok" : "warn"}
                      label={<>{fmtHM(r.worked)} of {r.member.expectedHoursPerDay}h</>} />
                  ) : <span className="text-quaternary">—</span>}
                </td>
                <td><DayBar row={r} nowH={nowH} /></td>
                {isAdmin ? (
                  <td className="acts">
                    <span className="inline-flex items-center gap-1.5">
                      <Button
                        size="xs"
                        color="secondary"
                        onClick={() => shell.modal(
                          <AdminAttendanceModal
                            mode={r.day ? "correct" : "log"}
                            defaultMemberId={r.member.memberId}
                            defaultDate={rowDate}
                            existingDay={r.day}
                          />
                        )}
                      >
                        {r.day ? "Correct" : "Log check-in"}
                      </Button>
                      {isOpenDay ? (
                        <Button
                          size="xs"
                          color="secondary"
                          onClick={() => shell.modal(
                            <AdminAttendanceModal
                              mode="force_close"
                              defaultMemberId={r.member.memberId}
                              defaultDate={rowDate}
                              existingDay={r.day}
                            />
                          )}
                        >
                          Force close
                        </Button>
                      ) : null}
                    </span>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </ListTable>
      ) : (
        <EmptyState icon="clock"
          title={narrowed ? "No member matches" : "Nobody has clocked in"}
          body={narrowed
            ? "Clear the filters to see the whole day."
            : "A row appears when somebody opens the panel for the first time today."}
          action={narrowed
            ? <Button color="secondary" ico="x" onClick={() => onFilter("*", "")}>Clear the filters</Button>
            : undefined} />
      )}

      {unclosedCount && !showingPastUnclosed ? (
        <Alert tone="warn" title={unclosedCount + " day" + (unclosedCount > 1 ? "s" : "") + " left open past the member's auto-close"}>
          Nothing is written automatically — click the Unclosed filter above to review, correct, or force-close open past attendance records.
        </Alert>
      ) : null}
    </>
  );
}

/** CHECK IN AT THE TIME YOU REALLY STARTED. Signing in already opens the day
 *  (shell), so this is the correction: a stated time, and a reason when it is
 *  not now. The server refuses a future time and a missing note. */
const hhmm = (at: number) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }).format(at);
function CheckIn() {
  const shell = useShell();
  const me = meId();
  const myDay = useMyDay();
  const state = myDay.state;
  const isPunchedIn = !!myDay.day;
  const [at, setAt] = useState(() => hhmm(clockNow()));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const changed = at !== hhmm(clockNow());

  const submit = async () => {
    setBusy(true);
    const r = await openDayAt(me, at, note.trim());
    setBusy(false);
    if (!r.ok) { shell.toast(r.message, "bad"); return; }
    setNote("");
    shell.toast("Attendance time adjusted successfully.");
  };

  const onEndDay = () => {
    const m = readMember(me);
    if (!m) { shell.toast("No member record for you.", "bad"); return; }
    shell.modal(<EodModal m={m} />);
  };

  const handleBreak = async () => {
    setBusy(true);
    const r = await startBreak(me);
    setBusy(false);
    if (!r.ok) { shell.toast(r.message, "bad"); return; }
    shell.toast("Break started.");
  };

  const handleResume = async () => {
    setBusy(true);
    const r = await resumeDay(me);
    setBusy(false);
    if (!r.ok) { shell.toast(r.message, "bad"); return; }
    shell.toast("Resumed work.");
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg p-3 ring-1 ring-secondary bg-primary">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-secondary pb-3">
        <div className="flex items-center gap-2">
          <StatePill state={state} />
          {state === "ended" && myDay.day?.endedAt ? (
            <span className="text-sm font-medium text-secondary">
              Day completed at {fmtTime(myDay.day.endedAt)}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {state === "working" && (
            <>
              <Button color="secondary" size="sm" isDisabled={busy} onClick={handleBreak}>
                Take Break
              </Button>
              <Button color="primary" size="sm" isDisabled={busy} onClick={onEndDay}>
                End Day / Clock Out
              </Button>
            </>
          )}
          {state === "on_break" && (
            <Button color="primary" size="sm" isDisabled={busy} onClick={handleResume}>
              Resume Work
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <FormField id="ciAt" label="Start time">
          <Input id="ciAt" type="time" value={at} mono onChange={setAt} />
        </FormField>
        <FormField id="ciNote" label="Reason" req cls="min-w-56 flex-1">
          <Input id="ciNote" value={note} ph={changed ? "Why the time differs from now" : "Why you are stating it"} onChange={setNote} />
        </FormField>
        <Button color="secondary" isDisabled={busy || !at || !note.trim()} onClick={submit}>
          {isPunchedIn ? "Update Start Time" : "Check in"}
        </Button>
        <p className="basis-full text-xs text-tertiary">
          Signing in starts your day automatically. If that time is wrong, state when you really started and why.
        </p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- month --- */

function Month({ members, me, scope, date, memberFilter, bar, onPick }: {
  members: Member[]; me: string; scope: Scope; date: string;
  memberFilter?: string; bar: ReactNode; onPick: (d: string) => void;
  onFilter?: (n: string, v: string) => void;
}) {
  const first = date.slice(0, 8) + "01";
  const last = addDays(monthStep(date, 1), -1);
  const days = datesIn(first, last).filter((d) => !isWeekend(d) && d <= TODAY);
  let inScope = members.filter(isHumanEmployee).filter((m) =>
    m.status === "active" && (scope === "all" || m.memberId === me || m.reportsTo === me));
  if (memberFilter) {
    inScope = inScope.filter((m) => m.memberId === memberFilter);
  }
  const monthSummaryRows = spanRows(first, last, scope).filter(
    (r) => !memberFilter || r.member.memberId === memberFilter
  );

  const exportMonthCsv = () => {
    const out: {
      memberName: string;
      date: string;
      checkIn: string;
      checkOut: string;
      breakDuration: string;
      totalHours: string;
      status: string;
    }[] = [];
    days.forEach((d) => {
      dayRows(d, scope).forEach((r) => {
        if (memberFilter && r.member.memberId !== memberFilter) return;
        if (d < r.member.joiningDate) return;
        out.push({
          memberName: r.member.name,
          date: d,
          checkIn: r.day && r.day.startedAt ? fmtTime(r.day.startedAt) : "—",
          checkOut: r.day && r.day.endedAt ? fmtTime(r.day.endedAt) : "—",
          breakDuration: r.breakMins ? fmtHM(r.breakMins) : "0m",
          totalHours: r.worked != null ? fmtHM(r.worked) : "—",
          status: labelOf(ATTENDANCE_STATE, r.state) + (r.day && r.day.isLate ? " (Late)" : ""),
        });
      });
    });
    downloadCsv(`attendance-${date.slice(0, 7)}.csv`, out);
  };

  const rows: HeatRow[] = inScope.map((m) => {
    let total = 0;
    const cells: HeatCell[] = days.map((d) => {
      const day = dayFor(m.memberId, d);
      const st = stateOf(day, m, clockNow(), d);
      const w = workedOf(day, m, clockNow());
      if (w != null) total += w;
      const expected = Math.max(1, m.expectedHoursPerDay * 60);
      const head = fmtDayName(d) + " " + fmtDate(d) + " — ";
      if (d < m.joiningDate) return { date: d, kind: "off", step: 0, title: head + "before " + m.name.split(" ")[0] + " joined" };
      if (st === "on_leave") return { date: d, kind: "leave", step: 0, title: head + "on approved leave" };
      if (st === "unclosed") return { date: d, kind: "open", step: 0, title: head + "still open, counted towards no total" };
      if (st === "not_started") return { date: d, kind: "off", step: 0, title: head + "not started yet" };
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
          desc={days.length + " working days · 6-day workweek · Sundays excluded (approved leave is shown as On leave)"} />
        <div className="flex flex-wrap items-center gap-2">
          {bar}
          <Button color="secondary" size="sm" ico="download" onClick={exportMonthCsv}>
            Export CSV
          </Button>
        </div>
      </div>

      {inScope.length && days.length ? (
        <>
          <HeatGrid days={days} rows={rows} onPick={onPick} />
          <HeatLegend />

          <SectionHead title="Month summary"
            desc="Derived per-member totals for the month across working days after each member's joining date." />
          <ListTable min="920px"
            head={
              <tr>
                <th>Member</th>
                <th className="n">Present</th>
                <th className="n">Late</th>
                <th className="n">Leave</th>
                <th className="n">Absent</th>
                <th className="n">Unclosed</th>
                <th className="n">Worked</th>
              </tr>
            }>
            {monthSummaryRows.map((r) => (
              <tr key={r.member.memberId}>
                <td className="cell-1"><Who m={r.member} /></td>
                <td className="n">{r.present} <span className="text-quaternary">/ {r.days}</span></td>
                <td className="n">
                  <span className={r.late ? "font-medium text-warning-primary" : undefined}>{r.late || "—"}</span>
                </td>
                <td className="n">{r.onLeave || "—"}</td>
                <td className="n">
                  <span className={r.absent ? "font-medium text-error-primary" : undefined}>{r.absent || "0"}</span>
                </td>
                <td className="n">
                  <span className={r.unclosed ? "font-medium text-warning-primary" : undefined}>{r.unclosed || "—"}</span>
                </td>
                <td className="n">{fmtHM(r.worked)}</td>
              </tr>
            ))}
          </ListTable>
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

const SPANS = [{ v: "7", l: "6d (week)" }, { v: "14", l: "14 days" }, { v: "30", l: "30 days" }];

function Analytics({ scope, span, memberFilter, onSpan }: {
  scope: Scope; span: string; memberFilter?: string; onSpan: (v: string) => void;
}) {
  useMembers();
  const [sort, setSort] = useState("late");

  const days = Math.max(1, Number(span) || 7);
  const from = addDays(TODAY, -(days - 1));
  const allRows = spanRows(from, TODAY, scope);
  const rows = memberFilter ? allRows.filter((r) => r.member.memberId === memberFilter) : allRows;
  const t = spanTotals(rows);
  const daily = spanDays(from, TODAY, scope);
  const spread = arrivalSpread(rows);
  const first = earliestAttendance();

  const exportAnalyticsCsv = () => {
    const out: {
      memberName: string;
      date: string;
      checkIn: string;
      checkOut: string;
      breakDuration: string;
      totalHours: string;
      status: string;
    }[] = [];
    datesIn(from, TODAY).filter((d) => !isWeekend(d) && d <= TODAY).forEach((d) => {
      dayRows(d, scope).forEach((r) => {
        if (memberFilter && r.member.memberId !== memberFilter) return;
        if (d < r.member.joiningDate) return;
        out.push({
          memberName: r.member.name,
          date: d,
          checkIn: r.day && r.day.startedAt ? fmtTime(r.day.startedAt) : "—",
          checkOut: r.day && r.day.endedAt ? fmtTime(r.day.endedAt) : "—",
          breakDuration: r.breakMins ? fmtHM(r.breakMins) : "0m",
          totalHours: r.worked != null ? fmtHM(r.worked) : "—",
          status: labelOf(ATTENDANCE_STATE, r.state) + (r.day && r.day.isLate ? " (Late)" : ""),
        });
      });
    });
    downloadCsv(`attendance-analytics-${from}-to-${TODAY}.csv`, out);
  };

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
      { k: "u", n: d.unclosed + (d.notStarted || 0), tone: "mute", what: d.notStarted ? "not started" : "unclosed" },
    ],
  }));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented sm label="Window" value={span} onPick={onSpan}
            options={SPANS.map((o) => ({ v: o.v, l: o.l }))} />
          <span className="text-sm text-tertiary">
            {fmtDate(from)} to {fmtDate(TODAY)} · 6-day workweek · Sundays excluded
          </span>
        </div>
        <Button color="secondary" size="sm" ico="download" onClick={exportAnalyticsCsv}>
          Export CSV
        </Button>
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
          note="One column per working day, across everybody in scope. Today's open unstarted shifts are shown in grey rather than counted as absent.">
          {stack.length ? (
            <StackBars days={stack} legend={[
              { tone: "ok", label: "on time" }, { tone: "warn", label: "late" },
              { tone: "info", label: "leave" }, { tone: "bad", label: "absent" },
              { tone: "mute", label: "unclosed / not started" },
            ]} />
          ) : (
            <EmptyState flat icon="calendar" title="No working day in this window" body="" />
          )}
        </ChartFrame>

        <ChartFrame title="When people arrive"
          note="Continuous 30-minute arrival windows. Each arrival is on time (green) or late (amber) against that member's own start time — the same rule as the On time tile.">
          {spread.length ? (
            <div className="[&_.bg-chart-1]:!bg-utility-green-500 [&_.fill-chart-1]:!fill-utility-green-500 [&_.bg-chart-3]:!bg-utility-yellow-500 [&_.fill-chart-3]:!fill-utility-yellow-500">
              <ColumnChart unit="arrivals" height={200}
                series={[
                  { key: "onTime", label: "On time", slot: 1 },
                  { key: "late", label: "Late", slot: 3 },
                ]}
                points={spread.map((b) => ({
                  key: String(b.at),
                  label: b.label,
                  values: {
                    onTime: b.onTime,
                    late: b.late,
                  },
                }))} />
            </div>
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

function Requests() {
  useLeave();
  const scope = scopeOf("attendance");
  const { mine, unrouted } = leaveQueue(scope);
  const decided = decidedLeave(scope);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">(
    mine.length + unrouted.length > 0 ? "pending" : "all"
  );

  const pendingList = mine.concat(unrouted);
  const approvedList = decided.filter((l) => l.state === "approved");
  const rejectedList = decided.filter((l) => l.state === "rejected");
  const shownDecided = filter === "approved" ? approvedList : filter === "rejected" ? rejectedList : decided;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented sm label="Status" value={filter} onPick={(v) => setFilter(v as typeof filter)}
          options={[
            { v: "all", l: `All (${pendingList.length + decided.length})` },
            { v: "pending", l: `Pending (${pendingList.length})` },
            { v: "approved", l: `Approved (${approvedList.length})` },
            { v: "rejected", l: `Rejected (${rejectedList.length})` },
          ]} />
      </div>

      {(filter === "pending" || filter === "all") && (mine.length > 0 || unrouted.length > 0) ? (
        <>
          {mine.length ? (
            <section className="flex flex-col gap-3">
              <SectionHead className="mb-0" title="Pending leave requests"
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
        </>
      ) : filter === "pending" ? (
        <EmptyState icon="inbox" title="Nothing waiting on you"
          body="No leave request needs a decision right now. Switch to All or Approved above to inspect historical decided leave." />
      ) : null}

      {filter !== "pending" && shownDecided.length > 0 ? (
        <section className="flex flex-col gap-3">
          <SectionHead className="mb-0" title="Decided leave history"
            desc="Historical leave requests that have already been approved or refused."
            right={<Pill tone="neutral" text={shownDecided.length + " decided"} />} />
          <LeaveTable list={shownDecided} />
        </section>
      ) : filter !== "pending" && !shownDecided.length ? (
        <EmptyState icon="inbox" title="No matching leave records"
          body="No leave requests match this status filter." />
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
          <th>Status</th>
          <th>Reason</th>
          <th className="acts" />
        </tr>
      }>
      {list.map((l) => {
        const m = readMember(l.memberId);
        const days = datesIn(l.fromDate, l.toDate).length;
        const clash = leaveOverlap(l)[0] || null;
        const stateTone = l.state === "approved" ? "ok" : l.state === "rejected" ? "bad" : "warn";
        return (
          <tr key={l.leaveId}>
            <Rail tone={unrouted || clash ? "warn" : l.state === "approved" ? "ok" : l.state === "rejected" ? "bad" : undefined} />
            <td className="cell-1">{m ? <Who m={m} /> : l.memberId}</td>
            <td className="font-mono tnum">
              {fmtDate(l.fromDate)}{l.toDate !== l.fromDate ? " – " + fmtDate(l.toDate) : ""}
              <span className="cell-2 block">{days + (days > 1 ? " days" : " day")}</span>
            </td>
            <td><Pill xs tone="neutral" text={labelOf(LEAVE_KIND, l.kind)} /></td>
            <td><Pill xs tone={stateTone} text={l.state} /></td>
            <td>
              <span className="block max-w-md">{l.reason}</span>
              {clash && (l.state === "requested" || l.state === "escalated") ? (
                <span className="cell-2 block text-warning-primary!">
                  {clash.members.map((x) => x.name).join(", ")}
                  {clash.members.length > 1 ? " are" : " is"} also away on {fmtDate(clash.date)}.
                </span>
              ) : null}
              {unrouted ? <span className="cell-2 block text-warning-primary!">Waiting on an admin.</span> : null}
              {l.state === "escalated" ? (
                <span className="cell-2 block text-warning-primary!">
                  Escalated{l.decidedById ? " by " + (readMember(l.decidedById)?.name || "a manager") : ""}
                  {l.decisionNote ? " — " + l.decisionNote : ""}
                </span>
              ) : null}
              {l.decidedById && l.state !== "escalated" ? (
                <span className="cell-2 block text-tertiary">
                  Decided by {readMember(l.decidedById)?.name || "Admin"}{l.decisionNote ? " — " + l.decisionNote : ""}
                </span>
              ) : null}
            </td>
            <td className="acts">
              <span className="inline-flex items-center gap-2">
                {m ? (
                  <Button color="tertiary" size="xs" onClick={() => go("#/team/" + m.memberId + "/leave")}>Open</Button>
                ) : null}
                {l.state === "requested" ? (
                  <Button color="tertiary" size="xs"
                    onClick={() => shell.modal(<LeaveEscalateModal l={l} />)}>Escalate…</Button>
                ) : null}
                {(l.state === "requested" || l.state === "escalated") && canDecideLeave(l) ? (
                  <>
                    <Button color="secondary" size="xs"
                      onClick={() => shell.modal(<LeaveDecideModal l={l} state="rejected" />)}>Refuse…</Button>
                    <Button color="primary" size="xs"
                      onClick={() => shell.modal(<LeaveDecideModal l={l} state="approved" />)}>Approve…</Button>
                  </>
                ) : (l.state === "requested" || l.state === "escalated") ? <span className="text-quaternary">with the Admin</span> : null}
              </span>
            </td>
          </tr>
        );
      })}
    </ListTable>
  );
}

/* ------------------------------------------- admin attendance management --- */

function AdminAttendanceModal({
  mode,
  defaultMemberId,
  defaultDate,
  existingDay,
}: {
  mode: "log" | "correct" | "force_close";
  defaultMemberId: string;
  defaultDate: string;
  existingDay?: DayRow["day"] | null;
}) {
  const shell = useShell();
  const members = useMembers();
  const activeMembers = members.filter(isHumanEmployee).filter((m) => m.status === "active");
  const [memberId, setMemberId] = useState(
    activeMembers.some((m) => m.memberId === defaultMemberId)
      ? defaultMemberId
      : (activeMembers[0]?.memberId || defaultMemberId)
  );
  const [businessDate, setBusinessDate] = useState(defaultDate || TODAY);

  const memberObj = readMember(memberId);
  const currentDay = existingDay !== undefined ? existingDay : dayFor(memberId, businessDate);
  const [startedAt, setStartedAt] = useState(
    currentDay?.startedAt ? isoToHHMM(currentDay.startedAt) : (memberObj?.dayStartsAt || "10:00")
  );
  const [endedAt, setEndedAt] = useState(
    mode === "force_close"
      ? (currentDay?.endedAt ? isoToHHMM(currentDay.endedAt) : (memberObj?.autoCloseAt || "20:00"))
      : (currentDay?.endedAt ? isoToHHMM(currentDay.endedAt) : "")
  );
  const [breakMins, setBreakMins] = useState(
    currentDay ? String(dayRows(businessDate, "all").find((r) => r.member.memberId === memberId)?.breakMins ?? 0) : "0"
  );
  const [reason, setReason] = useState(
    mode === "force_close" ? "Force-closed open attendance record" : ""
  );
  const [busy, setBusy] = useState(false);

  const onChangeMemberOrDate = (nextMemberId: string, nextDate: string) => {
    setMemberId(nextMemberId);
    setBusinessDate(nextDate);
    const m = readMember(nextMemberId);
    const d = dayFor(nextMemberId, nextDate);
    setStartedAt(d?.startedAt ? isoToHHMM(d.startedAt) : (m?.dayStartsAt || "10:00"));
    setEndedAt(
      mode === "force_close"
        ? (d?.endedAt ? isoToHHMM(d.endedAt) : (m?.autoCloseAt || "20:00"))
        : (d?.endedAt ? isoToHHMM(d.endedAt) : "")
    );
  };

  const submit = async () => {
    if (busy || !memberId || !businessDate || !reason.trim()) return;
    setBusy(true);
    const r = await correctDay({
      memberId,
      businessDate,
      startedAt: startedAt || undefined,
      endedAt: endedAt ? endedAt : null,
      breakMinutes: breakMins.trim() !== "" ? Math.max(0, Number(breakMins) || 0) : undefined,
      reason: reason.trim(),
    });
    setBusy(false);
    if (!r.ok) {
      shell.toast(r.message, "bad");
      return;
    }
    shell.closeLayer();
    shell.toast(
      mode === "force_close"
        ? "Attendance record force-closed."
        : mode === "correct"
          ? "Attendance record corrected."
          : "Attendance logged."
    );
  };

  const title =
    mode === "force_close"
      ? "Force-close attendance day"
      : mode === "correct"
        ? "Correct attendance time"
        : "Log check-in / check-out";

  return (
    <ModalShell
      title={title}
      sub={memberObj ? memberObj.name + " · " + fmtDate(businessDate) : fmtDate(businessDate)}
      ico="clock"
      onClose={() => shell.closeLayer()}
      actions={
        <>
          <Button color="secondary" onClick={() => shell.closeLayer()}>Cancel</Button>
          <Button
            color="primary"
            isLoading={busy}
            isDisabled={!memberId || !businessDate || (!startedAt && !endedAt) || !reason.trim()}
            onClick={submit}
          >
            {mode === "force_close" ? "Force close day" : "Save attendance"}
          </Button>
        </>
      }
    >
      <FormSection>
        <FieldRow>
          <FormField id="admAttMember" label="Team member" req>
            <SelectInput
              id="admAttMember"
              value={memberId}
              onChange={(v) => onChangeMemberOrDate(v, businessDate)}
              options={activeMembers.map((m) => ({
                v: m.memberId,
                l: m.name + (m.designation ? " — " + m.designation : ""),
              }))}
            />
          </FormField>
          <FormField id="admAttDate" label="Date" req>
            <DateInput
              id="admAttDate"
              value={businessDate}
              max={TODAY}
              onChange={(v) => v && onChangeMemberOrDate(memberId, v)}
              className="w-full"
            />
          </FormField>
        </FieldRow>

        <FieldRow>
          <FormField id="admAttIn" label="Check-in time" req>
            <Input id="admAttIn" type="time" mono value={startedAt} onChange={setStartedAt} />
          </FormField>
          <FormField id="admAttOut" label="Check-out time" req={mode === "force_close"}
            hint={mode === "force_close" ? "Required to close the open day." : "Leave blank if the member is still working."}>
            <Input id="admAttOut" type="time" mono value={endedAt} onChange={setEndedAt} />
          </FormField>
        </FieldRow>

        <FormField id="admAttBreak" label="Break duration (minutes)">
          <Input id="admAttBreak" type="number" mono value={breakMins} onChange={setBreakMins} />
        </FormField>

        <FormField id="admAttReason" label="Reason (audit trail)" req
          hint="Recorded on the attendance row with your name and timestamp.">
          <Input
            id="admAttReason"
            value={reason}
            ph="Forgot to clock out / field site visit / manual correction"
            onChange={setReason}
          />
        </FormField>
      </FormSection>
    </ModalShell>
  );
}
