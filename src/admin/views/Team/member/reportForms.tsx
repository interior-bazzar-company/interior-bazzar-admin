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
import {
  Alert, Button, FormField, FormSection, IconButton, Icon, Input, ModalShell, Notice, SelectInput,
} from "../../../ui";
import { cx } from "@/utils/cx";
import { go } from "../../../ui/nav";
import { useShell } from "../../../shell/ShellContext";
import {
  TODAY, fmtHM, fmtTime, meId, submitPlan, submitReport, usePlan, useReport, useReview, useWork,
} from "../store";
import type { Member, Priority, WorkItem } from "../store";

const openWork = (id: string) => go("#/work?item=" + id);

interface Line { title: string; priority: Priority }

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
    <ModalShell
      title="Today's plan"
      sub="Each line becomes a work item due today"
      ico="check"
      onClose={() => shell.closeLayer()}
      actions={
        <>
          <Button color="secondary" onClick={() => shell.closeLayer()}>Cancel</Button>
          <Button color="primary" isDisabled={!usable} onClick={save}>Submit plan</Button>
        </>
      }
    >
      <FormSection>
        <FormField label="What you are doing today" req>
          <ol className="flex flex-col gap-2">
            {lines.map((l, i) => (
              <li key={i} className="flex items-center gap-2">
                <span aria-hidden="true" className="w-4 shrink-0 text-right font-mono text-xs text-quaternary tnum">
                  {i + 1}
                </span>
                <Input value={l.title} autoFocus={i === 0}
                  ariaLabel={"Line " + (i + 1)}
                  ph="One thing you are doing today"
                  className="flex-1"
                  onChange={(v) => set(i, { title: v })} />
                <SelectInput value={l.priority} ariaLabel={"Priority for line " + (i + 1)}
                  className="w-28 shrink-0"
                  options={[{ v: "high", l: "High" }, { v: "medium", l: "Medium" }, { v: "low", l: "Low" }]}
                  onChange={(v) => set(i, { priority: v as Priority })} />
                <IconButton ico="x" size="sm" label={"Remove line " + (i + 1)}
                  isDisabled={lines.length === 1}
                  onClick={() => setLines(lines.filter((_, n) => n !== i))} />
              </li>
            ))}
          </ol>
        </FormField>

        <div>
          <Button color="secondary" size="xs" ico="plus"
            onClick={() => setLines(lines.concat([{ title: "", priority: "medium" }]))}>
            Add a line
          </Button>
        </div>

        <FormField id="tmOutcome" label="Expected outcome" tip="optional">
          <Input id="tmOutcome" value={outcome} ph="What good looks like by this evening" onChange={setOutcome} />
        </FormField>
        <FormField id="tmBlockers" label="Anything blocking you?" tip="optional">
          <Input id="tmBlockers" value={blockers} ph="Say it now rather than at six o'clock" onChange={setBlockers} />
        </FormField>

        <p className="text-xs text-quaternary">
          Two fields and a list. If this takes more than a minute it is the wrong form.
        </p>
      </FormSection>
    </ModalShell>
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

  /* THE LINES ARE READ, NOT TICKED. This was editable state seeded from the
     board — a checkbox list you completed work from, plus a button for anything
     that was not on the plan. Both are gone, and what is left is the record the
     day already wrote: the plan's lines, plus anything else finished today,
     each shown against what the BOARD says about it.

     Ticking happens on the work itself, which is the only place it ever really
     happened: `submitReport` completes a ticked line's item, so a line that is
     done here is done because the item is already terminal, and that loop is
     now a no-op. One writer, and it is the board. */
  const lines = seedLines;
  const [pending, setPending] = useState("");
  const [win, setWin] = useState("");
  const [help, setHelp] = useState("");
  const [tomorrow, setTomorrow] = useState("");
  const { day, worked, breakMins } = useMyDayLocal(m.memberId);

  const undone = lines.filter((l) => !l.done).length;
  const named = lines.filter((l) => l.title.trim());
  /* A REPORT WITH NO LINES IS STILL A REPORT. Submit used to require at least
     one, which was reachable only because you could add one by hand; with the
     lines derived, a member who planned nothing and closed nothing could never
     file. The store has never demanded lines — only a reason for unticked
     ones — so this asks exactly that and nothing more. */
  const blocked = !!undone && !pending.trim();

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
      <ModalShell
        title="Today's report"
        sub={"Submitted " + fmtTime(report.submittedAt)}
        ico="checkcircle"
        tone="success"
        onClose={() => shell.closeLayer()}
        actions={<Button color="primary" onClick={() => shell.closeLayer()}>Close</Button>}
      >
        <Alert tone="ok" ico="check" title="Submitted">
          {report.acknowledgedById
            ? "Somebody has read it."
            : "Nobody has opened it yet — the Reports page says who owes you that."}
        </Alert>
      </ModalShell>
    );
  }

  return (
    <ModalShell
      title="End of day"
      sub="What moved today, read from the board"
      ico="doc"
      onClose={() => shell.closeLayer()}
      actions={
        <>
          <Button color="secondary" onClick={() => shell.closeLayer()}>Cancel</Button>
          <Button color="primary" isDisabled={blocked} onClick={save}>Submit report</Button>
        </>
      }
    >
      <FormSection>
        {!plan || !plan.submittedAt ? (
          <Alert tone="warn" title="No plan went in this morning">
            So this lists only what was closed today.
          </Alert>
        ) : null}

        {/* WHAT THE DAY ACTUALLY DID, read off the board. Ticks are not
            controls here — they are the item's own status, drawn. */}
        <ul className="flex flex-col divide-y divide-border-secondary rounded-xl bg-primary px-3 ring-1 ring-secondary">
          {lines.map((l, i) => (
            <li key={i} className="flex items-center gap-2.5 py-2.5">
              <Icon name={l.done ? "checkcircle" : "clock"} size="sm"
                className={cx("shrink-0", l.done ? "text-fg-success-primary" : "text-fg-quaternary")} />
              <b className={cx("min-w-0 flex-1 truncate text-sm font-medium",
                l.done ? "text-quaternary line-through" : "text-primary")}>
                {l.title || "Untitled"}
              </b>
              {l.workItemId ? (
                <Button color="link-color" size="xs" onClick={() => openWork(l.workItemId as string)}>open</Button>
              ) : null}
            </li>
          ))}
          {lines.length ? null : (
            <li className="py-4 text-center text-sm text-quaternary">Nothing planned, and nothing closed today.</li>
          )}
        </ul>

        {undone ? (
          <FormField id="tmPending" label="Why did the unticked lines not get done?" req
            hint={undone + " line" + (undone > 1 ? "s" : "") + " unticked."}>
            <Input id="tmPending" value={pending}
              ph="The reason, not an apology. It is what a senior reads first."
              onChange={setPending} />
          </FormField>
        ) : null}

        <FormField id="tmWin" label="Biggest win today" tip="optional">
          <Input id="tmWin" value={win} onChange={setWin} />
        </FormField>
        <FormField id="tmHelp" label="Blocked on, or need help with" tip="optional">
          <Input id="tmHelp" value={help} onChange={setHelp} />
        </FormField>
        <FormField id="tmTomorrow" label="Tomorrow's first priority" tip="optional">
          <Input id="tmTomorrow" value={tomorrow} onChange={setTomorrow} />
        </FormField>

        {/* READ FROM THE CLOCK, and there is no field for it on purpose. */}
        <Notice ico="clock" text={day
          ? "Worked " + fmtHM(worked) + (breakMins ? " · " + fmtHM(breakMins) + " break" : "")
          + " · started " + fmtTime(day.startedAt) + ". Read from your clock, not typed here."
          : "You have not clocked in today, so there are no hours to attach to this."} />
      </FormSection>
    </ModalShell>
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
