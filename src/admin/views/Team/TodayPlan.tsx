/* =============================================================================
   Today's plan — the note you write before the day starts.
   -----------------------------------------------------------------------------
   IT IS THE SAME PLAN `#/team/:id/reports` ALREADY WRITES. `submitPlan` is the
   one entry point and it has always done the interesting part: a line becomes a
   task due today, and a line whose title matches something already open and
   assigned to you LINKS to that item rather than minting a second copy — which
   is why the EOD can tick it off later and the board agrees with the report.

   So this adds no model. What it adds is the half that was missing: a plan could
   only be written from your own member page, having first navigated to it, and
   the tasks you were planning around were on a different screen. Here the note
   opens over the board, and the work it is asking about is IN it.

   A NOTE, NOT A DIALOG. A plan is three ticks; a modal takes the whole screen
   for that and turns it into a form you complete. The note hangs off its
   button, the list stays readable behind it, and it closes the way a popover
   closes.

   THE POPOVER IS THE LIBRARY'S NOW. It used to be `.ib-menu-pop` — a fixed
   element that measured its own button through `useMenuPlacement` and listened
   for scroll, resize, Escape and an outside press by hand. React Aria's
   Popover does all five, portals out of any scrolling ancestor, traps focus and
   announces itself as a dialog. The only handler left here is the one that is
   genuinely ours: Escape backs out of the row being typed BEFORE it closes the
   note.

   IT IS PICKED, NOT TYPED. Nothing here creates work out of nowhere: everything
   the note offers is already assigned to you, and the plan says which of it you
   are doing today. A typed line is matched against your open work and links to
   it if it finds a match — Create is where a genuinely new piece of work with
   an owner, a kind and dates gets made.
   ============================================================================= */
import { useMemo, useState } from "react";
import { Dialog as AriaDialog, DialogTrigger as AriaDialogTrigger, Popover as AriaPopover } from "react-aria-components";
import { cx } from "@/utils/cx";
import { Button, Card, Checkbox, Icon, IconButton, Input, Pill } from "../../ui";
import { useShell } from "../../shell/ShellContext";
import {
  TODAY, addPlanLine, fmtDate, isDelayed, isTerminal, meId, readMember, submitPlan,
  usePlan, useWork,
} from "./store";
import type { Priority, WorkItem } from "./store";
import { EodModal } from "./member/reportForms";

/** Overdue first, then due today, then the rest — the order you would pick in.
 *  A plan is written against what is already late, not against the backlog. */
function rank(i: WorkItem): number {
  if (isDelayed(i)) return 0;
  if (i.dueDate === TODAY) return 1;
  return 2;
}

const dueNote = (i: WorkItem): string => {
  if (isDelayed(i)) return "overdue";
  if (i.dueDate === TODAY) return "due today";
  return i.dueDate ? "due " + fmtDate(i.dueDate) : "no date";
};

/** `who` defaults to the signed-in member and no screen passes it. It exists so
 *  the browser check can open the note BEFORE a plan is in — the seeded viewer
 *  already has one submitted, so without it the only branch ever driven is the
 *  read-back, and continuous entry (type, Enter, next row) is exactly the kind
 *  of thing a rendered string cannot check.
 *
 *  The scope is "all", which is not a concession: the filter is already
 *  `member: me`, and `membersInScope("self")` intersected with that is the same
 *  set for the real caller. */
export function TodayPlanMenu({ who }: { who?: string } = {}) {
  const shell = useShell();
  const me = who || meId();
  const plan = usePlan(me);
  const mine = useWork({ member: me }, "all");

  const [open, setOpen] = useState(false);

  const openTasks = useMemo(
    () => mine.filter((i) => i.kind === "task" && !isTerminal(i.status))
      .slice().sort((a, b) => rank(a) - rank(b)),
    [mine],
  );

  /* WHAT IS ALREADY LATE OR DUE IS TICKED FOR YOU. It is what the day is about,
     and a note that opens with every box empty asks you to re-decide something
     the dates have already decided. Everything else starts off. */
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  /* What you typed, and the row you are typing it in. Two pieces of state
     rather than one because the row exists before it holds anything — that is
     what makes the entry continuous. */
  const [extra, setExtra] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);

  const done = !!(plan && plan.submittedAt);

  const show = () => {
    /* Only the pre-submit picker has anything to seed; after the plan is in the
       rows come from the record and there is no local draft to reset. */
    if (!done) {
      const seed: Record<string, boolean> = {};
      openTasks.forEach((i) => { if (rank(i) < 2) seed[i.itemId] = true; });
      setPicked(seed);
      setExtra([]); setDraft(""); setAdding(false);
    }
    setOpen(true);
  };

  /* CONTINUOUS ENTRY, which is the whole of the pattern. Enter commits the line
     and leaves a fresh empty row open under it, so a plan is typed in one go
     rather than a click per item. Escape closes the row; blur commits whatever
     is in it, because losing what somebody just typed is worse than an extra
     line they can remove. */
  const commit = (keepGoing: boolean) => {
    const t = draft.trim();
    if (t) {
      /* Before the plan is in the line is a draft and goes in with the rest;
         after, there is a record to append to and it goes straight on. */
      if (done) {
        const r = addPlanLine(me, t);
        if (!r.ok) shell.toast(r.message, "bad");
      } else {
        setExtra((v) => v.concat([t]));
      }
    }
    setDraft("");
    setAdding(keepGoing);
  };

  const chosen = openTasks.filter((i) => picked[i.itemId]);
  const total = chosen.length + extra.length;

  /* Adding after the plan is in appends to it — same minting rule, same
     linking — rather than being refused with "change the work items instead",
     which is true of the record and useless as an answer. */
  const put = () => {
    /* A typed line is not a loose note: `submitPlan` matches it against what is
       already open and assigned to you and LINKS if it finds one, and otherwise
       mints a task due today in your name. Either way it is a real record the
       board and the EOD both see. */
    const lines = chosen.map((i) => ({ title: i.title, priority: i.priority }))
      .concat(extra.map((t) => ({ title: t, priority: "medium" as Priority })));
    const r = submitPlan(me, { lines });
    if (!r.ok) { shell.toast(r.message, "bad"); return; }
    setOpen(false);
    shell.toast("Today's plan is in — " + lines.length + " to do.");
  };

  const endDay = () => {
    const m = readMember(me);
    if (!m) { shell.toast("No member record for you.", "bad"); return; }
    setOpen(false);
    shell.modal(<EodModal m={m} />);
  };

  /* Each planned line read against the item it made or linked, so the note
     reports the board rather than its own copy of it. */
  const planned = (plan ? plan.lines : []).map((l) => {
    const it = mine.filter((i) => i.itemId === l.workItemId)[0];
    return { key: l.lineId, title: l.title, done: !!it && it.status === "completed" };
  });
  const ticked = planned.filter((l) => l.done).length;

  /* ONE ROW SHAPE FOR BOTH STATES, so the list is written once. Before the plan
     is in, a row is a choice: your open work, ticked or not, plus whatever you
     have typed. After, it is the plan itself, ticked according to what the
     board says — which is a fact, not a control, so those boxes do not take a
     press. Same list either way; only what a tick MEANS changes, and it changes
     with the day rather than with the design. */
  type Row = {
    key: string; title: string; note?: string; on: boolean;
    fixed?: boolean; toggle?: () => void; drop?: () => void;
  };
  const rows: Row[] = done
    ? planned.map((l) => ({ key: l.key, title: l.title, on: l.done, fixed: true }))
    : (openTasks.map((i) => ({
      key: i.itemId, title: i.title, note: dueNote(i), on: !!picked[i.itemId],
      toggle: () => setPicked((pk) => ({ ...pk, [i.itemId]: !pk[i.itemId] })),
    })) as Row[]).concat(extra.map((t, n) => ({
      key: "x" + n, title: t, note: "new task", on: true, fixed: true,
      drop: () => setExtra((v) => v.filter((_, j) => j !== n)),
    })));

  /* A count, not a sentence. What was here — "In, and 0 of 1 ticked off" over
     the list, and a paragraph under it explaining where to tick things — was
     three lines of prose on a note with one item in it. */
  const footNote = done
    ? ticked + " of " + planned.length + " done"
    : (total ? total + " to do" : "Nothing picked");

  return (
    <AriaDialogTrigger isOpen={open} onOpenChange={(v) => (v ? show() : setOpen(false))}>
      <Button color="secondary" ico="check" aria-haspopup="dialog">
        {/* ONE LINE. The Button wraps its children in an inline span, and a
            Badge is a flex box — dropped straight in it took a line of its
            own and made this button half again as tall as the primary beside
            it. An inline-flex wrapper puts them back on one row. */}
        <span className="inline-flex items-center gap-1.5">
          Today&rsquo;s plan
          {done ? <Pill xs tone={ticked === planned.length ? "ok" : "neutral"} text={ticked + "/" + planned.length} /> : null}
        </span>
      </Button>

      <AriaPopover
        placement="bottom end"
        offset={6}
        className={({ isEntering, isExiting }) =>
          cx(
            "z-50 w-88 max-w-[calc(100vw-2rem)] origin-(--trigger-anchor-point) will-change-transform",
            isEntering && "duration-150 ease-out animate-in fade-in slide-in-from-top-0.5",
            isExiting && "duration-100 ease-in animate-out fade-out slide-out-to-top-0.5",
          )
        }
      >
        <AriaDialog aria-label="Today's plan" className="outline-hidden">
          <Card
            tight
            className="shadow-lg"
            title="Today&rsquo;s plan"
            right={<span className="text-xs text-tertiary tnum">{fmtDate(TODAY)}</span>}
            foot={
              <div className="flex items-center gap-3">
                <span className="text-xs text-tertiary tnum">{footNote}</span>
                <span className="flex-1" />
                {done
                  ? <Button color="primary" size="xs" onClick={endDay}>End the day…</Button>
                  : <Button color="primary" size="xs" isDisabled={!total} onClick={put}>Put the plan in</Button>}
              </div>
            }
          >
            {/* ONE BODY, BOTH STATES. The note used to fork into a picker and a
                read-back, and the read-back had no way to add anything — so the
                moment a plan went in, the place you stand when you think of the
                next thing went read-only. A day is not sealed at 9am. */}
            <div className="-mx-1 flex max-h-80 flex-col gap-0.5 overflow-y-auto">
              {rows.length ? rows.map((r) => (
                <div key={r.key}
                  className="group/row flex items-start gap-2 rounded-md px-1 py-1.5 transition duration-100 hover:bg-primary_hover">
                  {r.fixed ? (
                    /* A FACT, NOT A CONTROL: after the plan is in, a tick is
                       what the board says about that item. */
                    <span aria-hidden="true"
                      className={cx("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded ring-1 ring-inset",
                        r.on ? "bg-brand-solid ring-brand-solid" : "bg-primary ring-primary")}>
                      {r.on ? <Icon name="check" size="xs" className="text-white" /> : null}
                    </span>
                  ) : (
                    <span className="mt-0.5">
                      <Checkbox checked={r.on} ariaLabel={r.title} onChange={r.toggle} />
                    </span>
                  )}
                  <span className={cx("flex min-w-0 flex-1 flex-col leading-tight",
                    r.fixed && r.on && "text-quaternary line-through")}>
                    <span className="truncate text-sm text-secondary">{r.title}</span>
                    {r.note ? <span className="truncate text-xs text-quaternary">{r.note}</span> : null}
                  </span>
                  {r.drop ? (
                    <IconButton ico="x" size="xs" label={"Remove " + r.title} onClick={r.drop} />
                  ) : null}
                </div>
              )) : (
                <p className="px-1 py-3 text-sm text-quaternary">
                  Nothing open is assigned to you. Type a line below, or create the work first.
                </p>
              )}

              {adding ? (
                <div className="flex items-center gap-2 px-1 py-1.5">
                  <span aria-hidden="true" className="size-4 shrink-0 rounded bg-primary ring-1 ring-primary ring-inset" />
                  <Input className="min-w-0 flex-1" value={draft} autoFocus ph="Task" ariaLabel="Add a task"
                    onChange={setDraft}
                    onBlur={() => commit(false)}
                    onEnter={() => commit(true)} />
                </div>
              ) : (
                <button type="button"
                  className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-2 text-left text-sm font-medium text-tertiary outline-focus-ring transition duration-100 hover:bg-primary_hover hover:text-secondary focus-visible:outline-2 focus-visible:-outline-offset-2"
                  onClick={() => setAdding(true)}>
                  <Icon name="plus" size="sm" className="text-fg-quaternary" />
                  Add a task
                </button>
              )}
            </div>
          </Card>
        </AriaDialog>
      </AriaPopover>
    </AriaDialogTrigger>
  );
}
