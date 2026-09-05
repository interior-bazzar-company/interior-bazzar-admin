/* =============================================================================
   /team/:id/reports — the daily plan and the end-of-day report.
   -----------------------------------------------------------------------------
   TWO RECORDS A DAY, and the whole value of the pair is the gap between them:
   the plan says what somebody meant to do this morning, the report says what
   happened. Either one alone is a status update. Both, side by side, is the
   only place in the module where an intention can be checked against an outcome
   without anybody scoring anybody.

   MISSING IS NOT LATE UNTIL THE DAY IS OVER. `eodDue` decides that against the
   member's own auto-close time, so a report absent at 14:20 reads as "the day
   is not over" and not as a failure. A band that shouts at half the company
   every afternoon is a band people stop reading.

   Acknowledging is a senior's act and it is the reason the report exists: one
   nobody read is worse than one nobody wrote.
   ============================================================================= */
import { Icon, Notice, Pill, Tiles } from "../../../ui";
import { useShell } from "../../../shell/ShellContext";
import {
  TODAY, acknowledgeReport, addDays, eodDue, fmtDate, fmtDayName, isWeekend, planFor,
  readMember, reportFor, useReports,
} from "../store";
import type { DailyPlan, DailyReport, Member } from "../store";
import type { Viewer } from "./ops";
import { OpHead } from "./frame";

const WINDOW = 7;

export default function ReportsPage({ m, viewer }: { m: Member; viewer: Viewer }) {
  const shell = useShell();
  useReports();

  const days: string[] = [];
  for (let i = 0; i < WINDOW; i++) days.push(addDays(TODAY, -i));
  const working = days.filter((d) => !isWeekend(d));

  const plans = working.filter((d) => {
    const p = planFor(m.memberId, d);
    return !!(p && p.submittedAt);
  }).length;
  const reports = working.filter((d) => {
    const r = reportFor(m.memberId, d);
    return !!(r && r.submittedAt);
  }).length;
  const unread = working.filter((d) => {
    const r = reportFor(m.memberId, d);
    return !!(r && r.submittedAt && !r.acknowledgedById);
  }).length;
  const missed = working.filter((d) => {
    const r = reportFor(m.memberId, d);
    return eodDue(d, m) && !(r && r.submittedAt);
  }).length;

  /* Acknowledging is the reporting line's act. An admin may do it too, because
     somebody has to when the senior is away — but nobody acknowledges their
     own, which would make the whole record circular. */
  const canAck = viewer !== "self";

  const ack = (r: DailyReport) => {
    const x = acknowledgeReport(r.reportId);
    shell.toast(x.ok ? "Marked as read." : (x as { message: string }).message, x.ok ? "" : "bad");
  };

  return (
    <>
      <OpHead
        title="Reports"
        desc={"The last " + WINDOW + " days. Weekends are listed and never counted against anybody."} />

      <Tiles list={[
        { k: "Plans in", v: plans + " / " + working.length, s: "submitted in the morning" },
        { k: "Reports in", v: reports + " / " + working.length, s: "submitted at close" },
        { k: "Not written", v: String(missed), s: "days already over", tone: missed ? "warn" : "" },
        { k: "Unread", v: String(unread), s: canAck ? "waiting on you" : "waiting on your senior", tone: unread ? "warn" : "" },
      ]} />

      {unread && canAck ? (
        <Notice tone="warn" ico="inbox" text={
          <><b>{unread} report{unread > 1 ? "s" : ""} nobody has read.</b> A report that is written and
            never opened teaches the person writing it that the exercise is paperwork.</>
        } />
      ) : null}

      <div className="tm-days">
        {days.map((d) => (
          <DayCard key={d} date={d} m={m} canAck={canAck} onAck={ack} />
        ))}
      </div>
    </>
  );
}

/* --------------------------------------------------------------- a day --- */

function DayCard({ date, m, canAck, onAck }: {
  date: string; m: Member; canAck: boolean; onAck: (r: DailyReport) => void;
}) {
  const plan = planFor(m.memberId, date);
  const report = reportFor(m.memberId, date);
  const weekend = isWeekend(date);
  const due = eodDue(date, m);
  const nothing = !plan && !report;

  return (
    <section className={"tm-day-c" + (weekend ? " we" : "") + (date === TODAY ? " today" : "")}>
      <header className="tm-day-h">
        <b>{fmtDayName(date)}</b>
        <span className="cell-2">{fmtDate(date)}</span>
        <span className="spacer" />
        {weekend ? <Pill text="Not a working day" tone="" />
          : nothing && due ? <Pill text="Nothing written" tone="warn" />
            : nothing ? <Pill text="The day is not over" tone="" />
              : null}
      </header>

      {weekend || nothing ? null : (
        <div className="tm-day-b">
          <PlanHalf plan={plan} />
          <ReportHalf report={report} due={due} m={m} canAck={canAck} onAck={onAck} />
        </div>
      )}
    </section>
  );
}

function PlanHalf({ plan }: { plan: DailyPlan | null }) {
  return (
    <div className="tm-half">
      <h4><Icon name="check" size="sm" />What they meant to do</h4>
      {plan && plan.submittedAt ? (
        <>
          <ul className="tm-lines">
            {plan.lines.map((l) => (
              <li key={l.lineId}>
                <span className={"tm-pri p-" + l.priority} aria-hidden="true" />
                {l.title}
              </li>
            ))}
            {plan.lines.length ? null : <li className="dim">No lines.</li>}
          </ul>
          {plan.expectedOutcome ? <p className="tm-note"><b>Outcome:</b> {plan.expectedOutcome}</p> : null}
          {plan.blockers ? <p className="tm-note bad"><b>Blocked:</b> {plan.blockers}</p> : null}
        </>
      ) : (
        <p className="dim">No plan submitted.</p>
      )}
    </div>
  );
}

function ReportHalf({ report, due, m, canAck, onAck }: {
  report: DailyReport | null; due: boolean; m: Member;
  canAck: boolean; onAck: (r: DailyReport) => void;
}) {
  const reader = report && report.acknowledgedById ? readMember(report.acknowledgedById) : null;
  return (
    <div className="tm-half">
      <h4><Icon name="doc" size="sm" />What actually happened</h4>
      {report && report.submittedAt ? (
        <>
          <ul className="tm-lines">
            {report.lines.map((l) => (
              <li key={l.lineId} className={l.done ? "done" : ""}>
                <Icon name={l.done ? "check" : "clock"} size="sm" />
                {l.title}
                {l.targetDelta ? <b className="tm-delta">+{l.targetDelta}</b> : null}
              </li>
            ))}
            {report.lines.length ? null : <li className="dim">No lines.</li>}
          </ul>
          {report.achievement ? <p className="tm-note"><b>Achieved:</b> {report.achievement}</p> : null}
          {report.pendingWork
            ? <p className="tm-note"><b>Left over:</b> {report.pendingWork}
              {report.pendingReason ? " — " + report.pendingReason : ""}</p>
            : null}
          {report.blockers ? <p className="tm-note bad"><b>Blocked:</b> {report.blockers}</p> : null}
          {report.supportNeeded ? <p className="tm-note"><b>Needs:</b> {report.supportNeeded}</p> : null}

          <div className="tm-ack">
            {reader ? (
              <span className="dim">Read by {reader.name === m.name ? "themselves" : reader.name}</span>
            ) : canAck ? (
              <button className="btn sm pri" onClick={() => onAck(report)}>
                <Icon name="check" size="sm" />Mark as read
              </button>
            ) : (
              <Pill text="Nobody has read it" tone="info" />
            )}
          </div>
        </>
      ) : due ? (
        <p className="tm-note bad">Not written, and the day is over.</p>
      ) : (
        <p className="dim">The day is not over.</p>
      )}
    </div>
  );
}
