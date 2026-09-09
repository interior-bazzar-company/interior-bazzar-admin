/* =============================================================================
   /team/:id/reports — the daily plan and the end-of-day report.
   -----------------------------------------------------------------------------
   TWO RECORDS A DAY, and the whole value of the pair is the gap between them:
   the plan says what somebody meant to do this morning, the report says what
   happened. Either one alone is a status update. Both, side by side, is the
   only place in the module where an intention can be checked against an outcome
   without anybody scoring anybody.

   SO THE DAY IS A CARD WITH TWO COLUMNS, not two lists. Meant-to-do on the
   left, actually-happened on the right, on one baseline — the comparison is
   the record, and a layout that made you scroll between the halves would have
   thrown away the only thing this page is for.

   MISSING IS NOT LATE UNTIL THE DAY IS OVER. `eodDue` decides that against the
   member's own auto-close time, so a report absent at 14:20 reads as "the day
   is not over" and not as a failure. A band that shouts at half the company
   every afternoon is a band people stop reading.

   Acknowledging is a senior's act and it is the reason the report exists: one
   nobody read is worse than one nobody wrote.
   ============================================================================= */
import { Alert, Button, Card, Icon, Pill, Tiles } from "../../../ui";
import { cx } from "@/utils/cx";
import { useShell } from "../../../shell/ShellContext";
import { EodModal, PlanModal } from "./reportForms";
import {
  TODAY, acknowledgeReport, addDays, eodDue, fmtDate, fmtDayName, isWeekend, planFor,
  planFor as planOn, readMember, reportFor, useReports,
} from "../store";
import type { DailyPlan, DailyReport, Member } from "../store";
import type { Viewer } from "./ops";
import { OpHead } from "./frame";

const WINDOW = 7;

const PRI_DOT: Record<string, string> = {
  urgent: "bg-utility-red-500",
  high: "bg-utility-yellow-500",
  medium: "bg-utility-blue-500",
  low: "bg-utility-neutral-400",
};

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

  /* What the two buttons above say depends on what is already in. A primary
     button for something already submitted is a button that lies about being
     needed. */
  const tp = planOn(m.memberId, TODAY);
  const todayPlan = !!(tp && tp.submittedAt);
  const tr = reportFor(m.memberId, TODAY);
  const todayReport = !!(tr && tr.submittedAt);
  const todayEodDue = eodDue(TODAY, m);

  const ack = (r: DailyReport) => {
    const x = acknowledgeReport(r.reportId);
    shell.toast(x.ok ? "Marked as read." : (x as { message: string }).message, x.ok ? "" : "bad");
  };

  return (
    <div className="flex flex-col gap-5">
      <OpHead
        title="Reports"
        desc={"The last " + WINDOW + " days. Weekends are listed and never counted against anybody."}
        right={viewer === "self" ? (
          <>
            {/* WRITING YOUR OWN DAY BELONGS ON YOUR OWN PAGE. These two were a
                segmented control on `#/reports`, which is a senior's review
                surface — one screen answering to two different people, with a
                write control on a page that is otherwise entirely a read. */}
            <Button color={todayPlan ? "secondary" : "primary"} ico="check"
              onClick={() => shell.modal(<PlanModal m={m} />, "lg")}>
              {todayPlan ? "Today's plan" : "Write today's plan"}
            </Button>
            <Button color={todayReport || !todayEodDue ? "secondary" : "primary"} ico="doc"
              onClick={() => shell.modal(<EodModal m={m} />, "lg")}>
              {todayReport ? "Today's report" : "Submit EOD report"}
            </Button>
          </>
        ) : null} />

      <Tiles list={[
        { k: "Plans in", v: plans + " / " + working.length, s: "submitted in the morning" },
        { k: "Reports in", v: reports + " / " + working.length, s: "submitted at close" },
        { k: "Not written", v: String(missed), s: "days already over", tone: missed ? "warn" : "" },
        { k: "Unread", v: String(unread), s: canAck ? "waiting on you" : "waiting on your senior", tone: unread ? "warn" : "" },
      ]} />

      {unread && canAck ? (
        <Alert tone="warn" ico="inbox"
          title={unread + " report" + (unread > 1 ? "s" : "") + " nobody has read"}>
          A report that is written and never opened teaches the person writing it that the exercise
          is paperwork.
        </Alert>
      ) : null}

      <div className="flex flex-col gap-4">
        {days.map((d) => (
          <DayCard key={d} date={d} m={m} canAck={canAck} onAck={ack} />
        ))}
      </div>
    </div>
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

  const stamp = (
    <span className="flex flex-wrap items-baseline gap-2">
      <b className="text-sm font-semibold text-primary">{fmtDayName(date)}</b>
      <span className="text-xs text-tertiary tnum">{fmtDate(date)}</span>
      {date === TODAY ? <Pill xs tone="brand" text="today" /> : null}
    </span>
  );
  const state = weekend ? <Pill xs tone="neutral" text="Not a working day" />
    : nothing && due ? <Pill xs dot tone="warn" text="Nothing written" />
      : nothing ? <Pill xs tone="neutral" text="The day is not over" />
        : null;

  /* A DAY WITH NOTHING ON IT IS ONE LINE. Seven cards each holding a heading
     and the sentence "nothing on the record" is a page that shouts about the
     absence and buries the two days somebody actually wrote — so an empty day
     states itself in a row and the week keeps its shape. */
  if (weekend || nothing) {
    return (
      <div className={cx(
        "flex flex-wrap items-center justify-between gap-3 rounded-xl bg-primary px-4 py-2.5 ring-1 ring-secondary",
        weekend && "opacity-70",
        date === TODAY && "ring-2 ring-brand",
      )}>
        {stamp}
        <span className="flex items-center gap-3">
          <span className="text-xs text-quaternary">
            {weekend ? "listed so a gap is never mistaken for a missed day" : "nothing on the record"}
          </span>
          {state}
        </span>
      </div>
    );
  }

  return (
    <Card
      tight
      cls={cx(date === TODAY && "ring-2 ring-brand")}
      title={stamp}
      right={state}
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
        <PlanHalf plan={plan} />
        <ReportHalf report={report} due={due} m={m} canAck={canAck} onAck={onAck} />
      </div>
    </Card>
  );
}

function Half({ ico, title, children }: { ico: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <h4 className="label-mono flex items-center gap-1.5">
        <Icon name={ico} size="xs" />
        {title}
      </h4>
      {children}
    </div>
  );
}

function Note({ label, body, bad }: { label: string; body: string; bad?: boolean }) {
  return (
    <p className={cx("text-sm", bad ? "text-error-primary" : "text-tertiary")}>
      <b className="font-semibold text-secondary">{label}:</b> {body}
    </p>
  );
}

function PlanHalf({ plan }: { plan: DailyPlan | null }) {
  return (
    <Half ico="check" title="What they meant to do">
      {plan && plan.submittedAt ? (
        <>
          <ul className="flex flex-col gap-1.5">
            {plan.lines.map((l) => (
              <li key={l.lineId} className="flex items-start gap-2 text-sm text-secondary">
                <i aria-hidden="true"
                  className={cx("mt-1.5 size-1.5 shrink-0 rounded-full", PRI_DOT[l.priority] || PRI_DOT.low)} />
                <span className="min-w-0">{l.title}</span>
              </li>
            ))}
            {plan.lines.length ? null : <li className="text-sm text-quaternary">No lines.</li>}
          </ul>
          {plan.expectedOutcome ? <Note label="Outcome" body={plan.expectedOutcome} /> : null}
          {plan.blockers ? <Note label="Blocked" body={plan.blockers} bad /> : null}
        </>
      ) : (
        <p className="text-sm text-quaternary">No plan submitted.</p>
      )}
    </Half>
  );
}

function ReportHalf({ report, due, m, canAck, onAck }: {
  report: DailyReport | null; due: boolean; m: Member;
  canAck: boolean; onAck: (r: DailyReport) => void;
}) {
  const reader = report && report.acknowledgedById ? readMember(report.acknowledgedById) : null;
  return (
    <Half ico="doc" title="What actually happened">
      {report && report.submittedAt ? (
        <>
          <ul className="flex flex-col gap-1.5">
            {report.lines.map((l) => (
              <li key={l.lineId} className="flex items-start gap-2 text-sm">
                <Icon name={l.done ? "check" : "clock"} size="sm"
                  className={cx("mt-0.5 shrink-0", l.done ? "text-fg-success-primary" : "text-fg-quaternary")} />
                <span className={cx("min-w-0", l.done ? "text-quaternary line-through" : "text-secondary")}>
                  {l.title}
                </span>
                {l.targetDelta
                  ? <b className="ml-auto shrink-0 font-semibold text-success-primary tnum">+{l.targetDelta}</b>
                  : null}
              </li>
            ))}
            {report.lines.length ? null : <li className="text-sm text-quaternary">No lines.</li>}
          </ul>
          {report.achievement ? <Note label="Achieved" body={report.achievement} /> : null}
          {report.pendingWork
            ? <Note label="Left over"
              body={report.pendingWork + (report.pendingReason ? " — " + report.pendingReason : "")} />
            : null}
          {report.blockers ? <Note label="Blocked" body={report.blockers} bad /> : null}
          {report.supportNeeded ? <Note label="Needs" body={report.supportNeeded} /> : null}

          <div className="mt-1 flex items-center">
            {reader ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-tertiary">
                <Icon name="eye" size="xs" className="text-fg-quaternary" />
                Read by {reader.name === m.name ? "themselves" : reader.name}
              </span>
            ) : canAck ? (
              <Button color="primary" size="xs" ico="check" onClick={() => onAck(report)}>Mark as read</Button>
            ) : (
              <Pill xs dot tone="info" text="Nobody has read it" />
            )}
          </div>
        </>
      ) : due ? (
        <p className="text-sm text-error-primary">Not written, and the day is over.</p>
      ) : (
        <p className="text-sm text-quaternary">The day is not over.</p>
      )}
    </Half>
  );
}
