/* =============================================================================
   Writing your own plan and your own end-of-day report.
   -----------------------------------------------------------------------------
   THESE LEFT `#/reports` AND CAME HERE, and the reason is whose screen each one
   is. `#/reports` is a senior's review surface — who was in, what they said they
   would do, what came back, and what is waiting on a decision. Two forms for
   writing your OWN day sat on it as a segmented control, which made the page
   answer to two different people at once and put a write control on a screen
   that is otherwise entirely a read.

   A member's own records live on the member's own page. `/team/:id/reports` is
   where your plan and your report already ARE, so it is where they are now
   written, and only ever by the person they belong to.

   THEY ARE DIALOGS, NOT FACES. Writing a plan is a thing you finish and leave,
   not a place you navigate to — and as a dialog the page behind it still shows
   the week you are writing into.

   THE HOURS ARE READ AND NEVER TYPED. The EOD states what the clock says and
   offers no field for it. A report that lets somebody type their own hours is
   not a record of anything.
   ============================================================================= */
import { useMemo, useState } from "react";
import { Icon, Notice } from "../../../ui";
import { go } from "../../../ui/nav";
import { useShell } from "../../../shell/ShellContext";
import {
  TODAY, fmtHM, fmtTime, meId, submitPlan, submitReport, usePlan, useReport, useReview, useWork,
} from "../store";
import type { Member, Priority, WorkItem } from "../store";

const openWork = (id: string) => go("#/work?item=" + id);

interface Line { title: string; priority: Priority }

/* -------------------------------------------------------------- chrome --- */

function Head({ title, sub }: { title: string; sub?: string }) {
  const shell = useShell();
  return (
    <div className="md-h">
      <h3>{title}{sub ? <span className="md-sub">{sub}</span> : null}</h3>
      <button className="btn icon sm md-x" aria-label="Close" onClick={() => shell.closeLayer()}>
        <Icon name="x" size="sm" />
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------- plan --- */

/** WHAT AM I DOING TODAY. Each line becomes a work item due today; a line
 *  matching something already open links to it rather than making a second
 *  copy, which is why the EOD can tick it later and the board agrees. */
export function PlanModal({ m }: { m: Member }) {
  const shell = useShell();
  const plan = usePlan(m.memberId);
  const [lines, setLines] = useState<Line[]>(
    plan && plan.lines.length
      ? plan.lines.map((l) => ({ title: l.title, priority: l.priority }))
      : [{ title: "", priority: "medium" }]);
  const [outcome, setOutcome] = useState(plan?.expectedOutcome || "");
  const [blockers, setBlockers] = useState(plan?.blockers || "");

  const set = (n: number, patch: Partial<Line>) =>
    setLines(lines.map((l, i) => (i === n ? { ...l, ...patch } : l)));

  const usable = lines.filter((l) => l.title.trim()).length;

  const save = () => {
    const r = submitPlan(m.memberId, { lines, expectedOutcome: outcome, blockers });
    if (!r.ok) { shell.toast(r.message, "bad"); return; }
    shell.closeLayer();
    shell.toast("Plan submitted.");
  };

  return (
    <>
      <Head title="Today's plan" sub="Each line becomes a work item due today" />
      <div className="md-b">
        <ol className="tm-plan">
          {lines.map((l, i) => (
            <li key={i}>
              <input className="inp" value={l.title} autoFocus={i === 0}
                aria-label={"Line " + (i + 1)}
                placeholder="One thing you are doing today"
                onChange={(e) => set(i, { title: e.target.value })} />
              <select className="inp" value={l.priority} aria-label={"Priority for line " + (i + 1)}
                onChange={(e) => set(i, { priority: e.target.value as Priority })}>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <button className="btn icon sm" aria-label={"Remove line " + (i + 1)}
                disabled={lines.length === 1}
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
          <label htmlFor="tmOutcome">Expected outcome <span className="tm-opt">optional</span></label>
          <input id="tmOutcome" className="inp" value={outcome}
            placeholder="What good looks like by this evening"
            onChange={(e) => setOutcome(e.target.value)} />
        </div>
        <div className="fg">
          <label htmlFor="tmBlockers">Anything blocking you? <span className="tm-opt">optional</span></label>
          <input id="tmBlockers" className="inp" value={blockers}
            placeholder="Say it now rather than at six o'clock"
            onChange={(e) => setBlockers(e.target.value)} />
        </div>
        <p className="tm-foot">
          Two fields and a list. If this takes more than a minute it is the wrong form.
        </p>
      </div>
      <div className="md-f">
        <span className="spacer" />
        <button className="btn" onClick={() => shell.closeLayer()}>Cancel</button>
        <button className="btn pri" disabled={!usable} onClick={save}>Submit plan</button>
      </div>
    </>
  );
}

/* ----------------------------------------------------------------- EOD --- */

/** WHAT ACTUALLY HAPPENED, pre-filled from this morning's plan and from
 *  anything completed today — so the form opens already knowing what the day
 *  was about. Ticking a line COMPLETES that work item, which is why the board
 *  and this report cannot disagree afterwards. */
export function EodModal({ m }: { m: Member }) {
  const shell = useShell();
  const plan = usePlan(m.memberId);
  const report = useReport(m.memberId);
  const mine = useWork({ member: m.memberId }, "self");

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
  const [pending, setPending] = useState("");
  const [win, setWin] = useState("");
  const [help, setHelp] = useState("");
  const [tomorrow, setTomorrow] = useState("");
  const { day, worked, breakMins } = useMyDayLocal(m.memberId);

  const undone = lines.filter((l) => !l.done).length;
  const named = lines.filter((l) => l.title.trim());
  const blocked = (!!undone && !pending.trim()) || !named.length;

  const save = () => {
    const r = submitReport(m.memberId, {
      lines: named.map((l) => ({ ...l, targetDelta: null })),
      pendingReason: pending,
      achievement: win,
      supportNeeded: help,
      tomorrowPriority: tomorrow,
    });
    if (!r.ok) { shell.toast(r.message, "bad"); return; }
    shell.closeLayer();
    shell.toast("Report submitted.");
  };

  if (report && report.submittedAt) {
    return (
      <>
        <Head title="Today's report" sub={"Submitted " + fmtTime(report.submittedAt)} />
        <div className="md-b">
          <Notice tone="ok" ico="check" text={report.acknowledgedById
            ? "Submitted, and somebody has read it."
            : "Submitted. Nobody has opened it yet — the tab on this page says who owes you that."} />
        </div>
        <div className="md-f">
          <span className="spacer" />
          <button className="btn pri" onClick={() => shell.closeLayer()}>Close</button>
        </div>
      </>
    );
  }

  return (
    <>
      <Head title="End of day" sub="Ticking a line completes that work item" />
      <div className="md-b">
        {!plan || !plan.submittedAt ? (
          <Notice tone="warn" text="No plan went in this morning, so there is nothing pre-filled. Add what you did below." />
        ) : null}

        <ul className="tm-eod">
          {lines.map((l, i) => (
            <li key={i}>
              <label className="check">
                <input type="checkbox" checked={l.done}
                  onChange={(e) => setLines(lines.map((x, n) => (n === i ? { ...x, done: e.target.checked } : x)))} />
                <span></span>
                <b>{l.title || "Untitled"}</b>
              </label>
              {l.workItemId ? (
                <button className="lnk" onClick={() => openWork(l.workItemId as string)}>open</button>
              ) : null}
            </li>
          ))}
          {!lines.length ? <li className="dim">Nothing on today's plan.</li> : null}
        </ul>
        <button className="btn sm"
          onClick={() => setLines(lines.concat([{ workItemId: null, title: "", done: true }]))}>
          <Icon name="plus" size="sm" />Something not on the plan
        </button>

        {lines.some((l) => !l.title.trim()) ? (
          <div className="fg">
            <label htmlFor="tmExtra">What was it? <b className="req">*</b></label>
            <input id="tmExtra" className="inp" autoFocus
              placeholder="The unplanned thing that took the afternoon"
              onChange={(e) => setLines(lines.map((l) =>
                (l.title.trim() ? l : { ...l, title: e.target.value })))} />
          </div>
        ) : null}

        {undone ? (
          <div className="fg">
            <label htmlFor="tmPending">Why did the unticked lines not get done? <b className="req">*</b></label>
            <textarea id="tmPending" className="inp" rows={2} value={pending}
              placeholder="The reason, not an apology. It is what a senior reads first."
              onChange={(e) => setPending(e.target.value)} />
            <span className="help">{undone} line{undone > 1 ? "s" : ""} unticked.</span>
          </div>
        ) : null}

        <div className="fg">
          <label htmlFor="tmWin">Biggest win today <span className="tm-opt">optional</span></label>
          <input id="tmWin" className="inp" value={win} onChange={(e) => setWin(e.target.value)} />
        </div>
        <div className="fg">
          <label htmlFor="tmHelp">Blocked on, or need help with <span className="tm-opt">optional</span></label>
          <input id="tmHelp" className="inp" value={help} onChange={(e) => setHelp(e.target.value)} />
        </div>
        <div className="fg">
          <label htmlFor="tmTomorrow">Tomorrow's first priority <span className="tm-opt">optional</span></label>
          <input id="tmTomorrow" className="inp" value={tomorrow}
            onChange={(e) => setTomorrow(e.target.value)} />
        </div>

        {/* READ FROM THE CLOCK, and there is no field for it on purpose. */}
        <Notice ico="clock" text={day
          ? "Worked " + fmtHM(worked) + (breakMins ? " · " + fmtHM(breakMins) + " break" : "")
          + " · started " + fmtTime(day.startedAt) + ". Read from your clock, not typed here."
          : "You have not clocked in today, so there are no hours to attach to this."} />
      </div>
      <div className="md-f">
        <span className="spacer" />
        <button className="btn" onClick={() => shell.closeLayer()}>Cancel</button>
        <button className="btn pri" disabled={blocked} onClick={save}>Submit report</button>
      </div>
    </>
  );
}

/** The clock, through the same derivation the attendance face uses, rather than
 *  re-deriving hours this form must never own. */
function useMyDayLocal(memberId: string) {
  const rows = useReview(TODAY, memberId === meId() ? "self" : "all");
  const r = rows.filter((x) => x.member.memberId === memberId)[0];
  return {
    day: r ? r.day : null,
    worked: r ? r.worked : null,
    breakMins: r && r.day ? r.day.breakMinutes : 0,
  };
}
