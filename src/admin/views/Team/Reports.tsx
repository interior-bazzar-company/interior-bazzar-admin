/* =============================================================================
   Reports — #/reports
   -----------------------------------------------------------------------------
     #/reports                 the senior's day: needs attention, then everyone
     #/reports?face=plan       my plan for today — what am I doing
     #/reports?face=eod        my end-of-day report — what got done

   TWO FORMS AND ONE REVIEW, over the same records. A plan line CREATES OR LINKS
   a work item, and ticking that line in the EOD COMPLETES it — so "what they
   said they would do" and "what they did" is a diff rather than two paragraphs
   somebody has to compare by eye.

   THE HOURS ARE READ, NEVER TYPED. The EOD shows the attendance row and offers
   no field for it. A report that lets a person type their own hours is not a
   record of anything.

   MISSING AT 14:20 IS NOT MISSING, IT IS EARLY. An EOD only counts as
   outstanding once the member's own day is over, which is why `eodDue` takes
   the member and the clock rather than testing for a row.

   NO API YET — src/content/team/{plans,reports}.json through store.ts.
   ============================================================================= */
import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { usePageChrome } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import { Icon, Notice, SectionHead, StatStrip, Table, TbTitle, Toolbar, qs } from "../../ui";
import type { StatCell } from "../../ui";
import {
  TODAY, acknowledgeReport, attentionOf, fmtDate, fmtDayName, fmtHM, fmtTime,
  meId, scopeLabel, scopeOf, submitPlan, submitReport, useMe, usePlan,
  useReport, useReview, useWork,
} from "./store";
import type { Priority, ReviewRow, WorkItem } from "./store";
import { PriorityChip, ProtoBar, ScopeNote, StatePill, Who } from "./bits";
import "./team.css";

const ROUTE = "#/reports";

export default function Reports() {
  const [sp] = useSearchParams();
  const p = useMemo(() => {
    const o: Record<string, string> = {};
    sp.forEach((v, k) => { if (v) o[k] = v; });
    return o;
  }, [sp]);

  const face = p.face === "plan" ? "plan" : p.face === "eod" ? "eod" : "today";
  const scope = scopeOf("reports");
  const rows = useReview(TODAY, scope);

  usePageChrome({
    crumbs: <TbTitle label="Reports" to="#/reports" />,
    right: <ScopeNote text={scopeLabel(scope, rows.length)} />,
  }, face);

  const goto = useCallback((patch: Record<string, string | undefined>) => {
    const next: Record<string, string> = { ...p };
    Object.keys(patch).forEach((k) => {
      const v = patch[k];
      if (v) next[k] = v; else delete next[k];
    });
    window.location.hash = ROUTE.slice(1) + qs(next);
  }, [p]);

  return (
    <div className="dls">
      <ProtoBar what="Reports" endpoint="GET /admin/team/reports" />

      <div className="dls-cmd">
        <Toolbar>
          <div className="tm-faces">
            <button className={"tm-face" + (face === "today" ? " on" : "")} onClick={() => goto({ face: undefined })}>
              <Icon name="users" size="sm" />The day
            </button>
            <button className={"tm-face" + (face === "plan" ? " on" : "")} onClick={() => goto({ face: "plan" })}>
              <Icon name="check" size="sm" />My plan
            </button>
            <button className={"tm-face" + (face === "eod" ? " on" : "")} onClick={() => goto({ face: "eod" })}>
              <Icon name="doc" size="sm" />My EOD
            </button>
          </div>
          <span className="spacer" />
          <span className="dim tnum">{fmtDayName(TODAY)} {fmtDate(TODAY)}</span>
        </Toolbar>
      </div>

      {face === "today" ? <TheDay rows={rows} /> : null}
      {face === "plan" ? <div className="dls-body"><PlanForm /></div> : null}
      {face === "eod" ? <div className="dls-body"><EodForm /></div> : null}
    </div>
  );
}

/* -------------------------------------------------------------- the day --- */

function TheDay({ rows }: { rows: ReviewRow[] }) {
  const shell = useShell();
  const a = attentionOf(rows);

  const cells: (StatCell | "sep")[] = [
    { k: "in scope", v: rows.length },
    "sep",
    { k: "no plan", v: a.noPlan.length, dot: a.noPlan.length ? "warn" : "" },
    { k: "EOD due", v: a.noEod.length, dot: a.noEod.length ? "warn" : "" },
    "sep",
    { k: "overdue", v: a.delayed.length, dot: a.delayed.length ? "warn" : "" },
    { k: "waiting", v: a.waiting.length, dot: a.waiting.length ? "bad" : "" },
    "sep",
    { k: "late or absent", v: a.lateOrAbsent.length, dot: a.lateOrAbsent.length ? "warn" : "" },
    { k: "unread reports", v: a.unacknowledged.length, dot: a.unacknowledged.length ? "info" : "" },
  ];

  const anything = a.noPlan.length || a.noEod.length || a.delayed.length
    || a.waiting.length || a.lateOrAbsent.length || a.unacknowledged.length;

  return (
    <>
      <StatStrip cells={cells} />
      <div className="dls-body">

        <SectionHead title="Needs attention"
          desc="Everything here is a filter over the same rows below — a count and the list it opens cannot disagree." />
        {anything ? (
          <div className="tm-attn">
            <AttnCard title="No plan submitted" tone="warn"
              names={a.noPlan.map((r) => r.member.name)}
              note="Anybody with no reporting line is excluded — a number that always shows the founder delinquent is one people learn to ignore." />
            <AttnCard title="EOD outstanding" tone="warn"
              names={a.noEod.map((r) => r.member.name)}
              note="Counted only once that member's own day is over." />
            <AttnCard title="Overdue work" tone="warn"
              names={a.delayed.map((i) => i.title)} to="#/work?status=delayed" />
            <AttnCard title="Waiting on another item" tone="bad"
              names={a.waiting.map((i: WorkItem) => i.title)} to="#/work?wait=1" />
            <AttnCard title="Late or absent" tone="warn"
              names={a.lateOrAbsent.map((r) => r.member.name)} to="#/attendance" />
            <AttnCard title="Reports nobody has read" tone="info"
              names={a.unacknowledged.map((r) => r.member.name)}
              note="A report nobody read is worse than one nobody wrote — the person who wrote it believes it was read." />
          </div>
        ) : (
          <Notice tone="ok" text="Nothing needs you. Every plan is in, no work is overdue or blocked, and every report has been read." />
        )}

        <SectionHead title="Today, by member" desc="Click any row to open that member's work." />
        <Table
          scroll min="1040px"
          cols={[
            { label: "", w: "3px" },
            { label: "Member" },
            { label: "In", w: "92px" },
            { label: "Worked", cls: "n", w: "92px" },
            { label: "Plan", cls: "c", w: "80px" },
            { label: "Doing now", w: "220px" },
            { label: "Done", cls: "c", w: "80px" },
            { label: "EOD", w: "150px" },
          ]}
          empty={{ icon: "users", title: "Nobody in scope", body: "You see yourself and the members whose reporting line points at you." }}
          rows={rows.map((r) => {
            const rail = r.state === "absent" ? "u-bad"
              : (r.day && r.day.isLate) || r.delayed || r.waiting ? "u-warn" : "";
            return (
              <tr key={r.member.memberId} className={rail}>
                <td className="rail"><i className={rail} /></td>
                <td>
                  <Who m={r.member} />
                  {r.delayed || r.waiting ? (
                    <span className="cell-2">
                      {r.delayed ? r.delayed + " overdue" : null}
                      {r.delayed && r.waiting ? " · " : null}
                      {r.waiting ? r.waiting + " waiting" : null}
                    </span>
                  ) : null}
                </td>
                <td className="tnum">
                  {r.day ? fmtTime(r.day.startedAt) : <StatePill state={r.state} />}
                  {r.day && r.day.isLate ? <b className="tm-late">late</b> : null}
                </td>
                <td className="n tnum">{r.worked != null ? fmtHM(r.worked) : "—"}</td>
                <td className="c">
                  {r.plan && r.plan.submittedAt
                    ? <span className="pill ok xs" title={"Submitted " + fmtTime(r.plan.submittedAt)}>{r.plan.lines.length}</span>
                    : r.plan
                      ? <span className="pill xs" title="Started and not submitted">draft</span>
                      : <span className="pill warn xs">—</span>}
                </td>
                <td>{r.doing
                  ? <a href={"#/work?item=" + r.doing.itemId} className="tm-doing">{r.doing.title}</a>
                  : <span className="dim">—</span>}</td>
                <td className="c tnum">{r.planned ? r.done + "/" + r.planned : "—"}</td>
                <td>
                  {r.report && r.report.submittedAt ? (
                    r.report.acknowledgedById
                      ? <span className="pill ok xs">read</span>
                      : <button className="btn sm" onClick={() => {
                        const res = acknowledgeReport((r.report as { reportId: string }).reportId);
                        shell.toast(res.ok ? "Marked read" : res.message, res.ok ? undefined : "bad");
                      }}>Mark read</button>
                  ) : r.eodDue
                    ? <span className="pill warn xs">outstanding</span>
                    : <span className="dim">not due yet</span>}
                </td>
              </tr>
            );
          })}
        />
        <Notice text={
          "“Done” counts items due today that are complete. An EOD is only outstanding once that member's own "
          + "day is over — missing at four in the afternoon is early, not missing."} />
      </div>
    </>
  );
}

function AttnCard({ title, tone, names, note, to }: {
  title: string; tone: string; names: string[]; note?: string; to?: string;
}) {
  if (!names.length) return null;
  return (
    <div className={"tm-attn-c " + tone}>
      <b>{names.length} {title.toLowerCase()}</b>
      <ul>{names.slice(0, 4).map((n, i) => <li key={i}>{n}</li>)}</ul>
      {names.length > 4 ? <span className="dim">+{names.length - 4} more</span> : null}
      {to ? <a href={to}>Open →</a> : null}
      {note ? <span className="tm-attn-n">{note}</span> : null}
    </div>
  );
}

/* ------------------------------------------------------------ my plan --- */

interface Line { title: string; priority: Priority }

function PlanForm() {
  const shell = useShell();
  const me = useMe();
  const plan = usePlan(meId());
  const [lines, setLines] = useState<Line[]>(
    plan && plan.lines.length
      ? plan.lines.map((l) => ({ title: l.title, priority: l.priority }))
      : [{ title: "", priority: "medium" }]);

  if (!me) return null;

  if (plan && plan.submittedAt) {
    return (
      <div className="tm-form">
        <SectionHead title="Today's plan" desc={"Submitted " + fmtTime(plan.submittedAt)} />
        <Notice tone="ok" text="Your plan is in. The day is changed by changing the work items, not by editing this — which is what actually happened." />
        <ol className="tm-plan-r">
          {plan.lines.map((l) => (
            <li key={l.lineId}>
              <span>{l.title}</span>
              <PriorityChip p={l.priority} />
              {l.workItemId ? <a href={"#/work?item=" + l.workItemId}>open →</a> : null}
            </li>
          ))}
        </ol>
        {plan.expectedOutcome ? <p><b>Expected outcome.</b> {plan.expectedOutcome}</p> : null}
        {plan.blockers ? <Notice tone="warn" text={plan.blockers} /> : null}
      </div>
    );
  }

  const set = (n: number, patch: Partial<Line>) =>
    setLines(lines.map((l, i) => (i === n ? { ...l, ...patch } : l)));

  return (
    <div className="tm-form">
      <SectionHead title="What am I doing today?"
        desc="Each line becomes a work item due today. A line matching something already open links to it instead of making a second copy." />
      <ol className="tm-plan">
        {lines.map((l, i) => (
          <li key={i}>
            <input className="inp" value={l.title} autoFocus={i === 0}
              placeholder="One thing you are doing today"
              onChange={(e) => set(i, { title: e.target.value })} />
            <select className="inp" value={l.priority}
              onChange={(e) => set(i, { priority: e.target.value as Priority })}>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <button className="btn icon sm" aria-label="Remove line"
              onClick={() => setLines(lines.filter((_, n) => n !== i))}>
              <Icon name="x" size="sm" />
            </button>
          </li>
        ))}
      </ol>
      <button className="btn sm" onClick={() => setLines(lines.concat([{ title: "", priority: "medium" }]))}>
        <Icon name="plus" size="sm" />Add a line
      </button>

      <div className="fg">
        <label htmlFor="tmOutcome">Expected outcome <span className="help-i">optional</span></label>
        <input id="tmOutcome" className="inp" placeholder="What good looks like by this evening" />
      </div>
      <div className="fg">
        <label htmlFor="tmBlockers">Anything blocking you? <span className="help-i">optional</span></label>
        <input id="tmBlockers" className="inp" placeholder="Say it now rather than at six o'clock" />
      </div>

      <div className="tm-form-f">
        <span className="help">Three fields and a list. If this takes more than a minute it is the wrong form.</span>
        <span className="spacer" />
        <button className="btn pri" onClick={() => {
          const outcome = (document.getElementById("tmOutcome") as HTMLInputElement | null)?.value;
          const blockers = (document.getElementById("tmBlockers") as HTMLInputElement | null)?.value;
          const r = submitPlan(me.memberId, { lines, expectedOutcome: outcome, blockers });
          shell.toast(r.ok ? "Plan submitted" : r.message, r.ok ? undefined : "bad");
        }}>Submit plan</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- my EOD --- */

function EodForm() {
  const shell = useShell();
  const me = useMe();
  const plan = usePlan(meId());
  const report = useReport(meId());
  const mine = useWork({ member: meId() }, "self");

  /* Pre-filled from this morning's plan and anything completed today, so the
     form opens already knowing what the day was about. */
  const seedLines = useMemo(() => {
    const fromPlan: { workItemId: string | null; title: string; done: boolean }[] =
      plan ? plan.lines.map((l) => {
        const it = mine.filter((i) => i.itemId === l.workItemId)[0];
        return { workItemId: l.workItemId, title: l.title, done: !!it && it.status === "completed" };
      }) : [];
    const seen: Record<string, boolean> = {};
    fromPlan.forEach((l) => { if (l.workItemId) seen[l.workItemId] = true; });
    const alsoDone = mine
      .filter((i: WorkItem) => i.status === "completed" && !seen[i.itemId]
        && (i.completedAt || "").slice(0, 10) === TODAY)
      .map((i) => ({ workItemId: i.itemId, title: i.title, done: true }));
    return fromPlan.concat(alsoDone);
  }, [plan, mine]);

  const [lines, setLines] = useState(seedLines);
  const { day, worked, breakMins } = useMyDayLocal();

  if (!me) return null;

  if (report && report.submittedAt) {
    return (
      <div className="tm-form">
        <SectionHead title="Today's report" desc={"Submitted " + fmtTime(report.submittedAt)} />
        <Notice tone="ok" text={report.acknowledgedById
          ? "Submitted and read."
          : "Submitted. Nobody has marked it read yet."} />
      </div>
    );
  }

  const undone = lines.filter((l) => !l.done).length;

  return (
    <div className="tm-form">
      <SectionHead title="End of day"
        desc="Pre-filled from this morning's plan. Ticking a line completes that work item, so the board and this report cannot disagree." />

      {!plan || !plan.submittedAt
        ? <Notice tone="warn" text="You did not submit a plan this morning, so there is nothing pre-filled. Add what you did below." />
        : null}

      <ul className="tm-eod">
        {lines.map((l, i) => (
          <li key={i}>
            <label className="check">
              <input type="checkbox" checked={l.done}
                onChange={(e) => setLines(lines.map((x, n) => (n === i ? { ...x, done: e.target.checked } : x)))} />
              <span></span>
              <b>{l.title}</b>
            </label>
            {l.workItemId ? <a href={"#/work?item=" + l.workItemId}>open →</a> : null}
          </li>
        ))}
        {!lines.length ? <li className="dim">Nothing on today's plan.</li> : null}
      </ul>
      <button className="btn sm" onClick={() => setLines(lines.concat([{ workItemId: null, title: "", done: true }]))}>
        <Icon name="plus" size="sm" />Something not on the plan
      </button>
      {lines.some((l) => !l.title) ? (
        <div className="fg">
          <label htmlFor="tmExtra">What was it?</label>
          <input id="tmExtra" className="inp" placeholder="The unplanned thing that took the afternoon"
            onChange={(e) => setLines(lines.map((l) => (l.title ? l : { ...l, title: e.target.value })))} />
        </div>
      ) : null}

      {undone ? (
        <div className="fg">
          <label htmlFor="tmPending">Why did the unticked lines not get done? <b className="req">*</b></label>
          <textarea id="tmPending" className="inp" rows={2}
            placeholder="The reason, not an apology. It is what a senior reads first." />
          <span className="help">{undone} line{undone > 1 ? "s" : ""} unticked.</span>
        </div>
      ) : null}

      <div className="fg">
        <label htmlFor="tmWin">Biggest win today <span className="help-i">optional</span></label>
        <input id="tmWin" className="inp" />
      </div>
      <div className="fg">
        <label htmlFor="tmHelp">Blocked on, or need help with <span className="help-i">optional</span></label>
        <input id="tmHelp" className="inp" />
      </div>
      <div className="fg">
        <label htmlFor="tmTomorrow">Tomorrow's first priority <span className="help-i">optional</span></label>
        <input id="tmTomorrow" className="inp" />
      </div>

      <Notice text={day
        ? "Worked " + fmtHM(worked) + (breakMins ? " · " + fmtHM(breakMins) + " break" : "")
        + " · started " + fmtTime(day.startedAt) + ". Read from your clock — there is no field for it here on purpose."
        : "You have not clocked in today, so there are no hours to attach to this."} />

      <div className="tm-form-f">
        <span className="spacer" />
        <button className="btn pri" onClick={() => {
          const g = (id: string) => (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null)?.value;
          const r = submitReport(me.memberId, {
            lines: lines.filter((l) => l.title).map((l) => ({ ...l, targetDelta: null })),
            pendingReason: g("tmPending"),
            achievement: g("tmWin"),
            supportNeeded: g("tmHelp"),
            tomorrowPriority: g("tmTomorrow"),
          });
          shell.toast(r.ok ? "Report submitted" : r.message, r.ok ? undefined : "bad");
        }}>Submit report</button>
      </div>
    </div>
  );
}

/* Local wrapper so the EOD form reads the clock through the same derivation the
   Attendance face does, rather than re-deriving hours it must never own. */
function useMyDayLocal() {
  const rows = useReview(TODAY, "self");
  const r = rows.filter((x) => x.member.memberId === meId())[0];
  return { day: r ? r.day : null, worked: r ? r.worked : null, breakMins: r && r.day ? r.day.breakMinutes : 0 };
}

