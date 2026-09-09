/* =============================================================================
   Team ops — the module's own drawings.
   -----------------------------------------------------------------------------
   Everything here is a component built from the shared parts (`../../ui`) and
   Tailwind utilities on the semantic tokens. There is no stylesheet: a kanban
   column, a calendar day, a heat cell and a lane bar are shapes only this
   module needs, so they are React components here rather than classes in a
   sheet — and none of them invents a colour, a radius or a size.

   TWO FAMILIES LIVE IN THIS FILE.

     · The pieces THREE SURFACES share — `#/work`'s rail, `#/reports`'s roll-up
       and `#/team/:id`'s work page all render `TasksBlock`, `MarksBlock`,
       `TaskRow`, `MarkRow`, `ProgressWindow`, `StagePill`, `RichText`. Three
       surfaces each computing progress their own way is how a roll-up ends up
       printing a number its own children disagree with.
     · The FACE drawings — the board column and its card, the calendar cell and
       its chip, the timeline lane, the attendance heat grid, the stacked day
       bars. One per shape, used once each, kept out of the page files so a
       face reads as layout rather than as geometry.

   Order is tasks ▸ milestones ▸ targets — the order somebody works in, smallest
   thing first. A milestone and a target are drawn DIFFERENTLY on purpose: a
   milestone is a window with children under it, so its bar carries a marker for
   where today sits inside that window; a target counts units, so the number
   leads and the bar sits behind it.
   ============================================================================= */
import type { ReactNode } from "react";
import { cx } from "@/utils/cx";
import { Avatar, Card, Icon, Pill, Priority, Tag, Tags } from "../../ui";
import {
  KIND, TODAY, WORK_STATUS, blockerOf, checkCount, childrenOf, fmtDate, isDelayed, isTerminal,
  labelOf, membersInScope, normaliseUrl, progressOf, readMember, readItems, stageOf, tagsOf,
  timePct, toneOf,
} from "./store";
import type { Priority as PriorityKey, WorkItem, WorkKind, WorkStage } from "./store";

/* ----------------------------------------------------------- rich text --- */

/** THE MARKS, PARSED — NEVER INJECTED.
 *
 *  `innerHTML` is banned in this panel (see ui/index.tsx), and a description box
 *  is exactly where that rule earns its keep: it is the one field where a
 *  person's own typing would be handed back to the browser as markup. So the
 *  editor writes plain text with marks in it and this turns those marks, and
 *  only those marks, into real elements. An angle bracket stays an angle
 *  bracket.
 *
 *  SIX MARKS, AND THE TOOLBAR WRITES EXACTLY THESE SIX. `**bold**`, `_italic_`,
 *  `[label](url)`, `- bullets`, `1. numbers` and `- [ ] boxes`. A button in
 *  Work.tsx with no branch here would write characters that render as
 *  themselves, which is worse than no button.
 *
 *  Deals reached the same answer for the same reason (views/Deals/bits.tsx). */

/* ONE ALTERNATION, so the marks cannot overlap: a `**bold**` inside a link's
   label is part of the label, not a second parse of the same characters. A
   run that does not close is not a mark and comes back as what was typed. */
const INLINE = /(\*\*[^*\n]+?\*\*|_[^_\n]+?_|\[[^\]\n]+?\]\([^)\s]+?\))/g;

const inline = (s: string): ReactNode[] =>
  s.split(INLINE).map((part, i) => {
    if (part.length > 4 && part.slice(0, 2) === "**" && part.slice(-2) === "**") {
      return <b key={i} className="font-semibold text-primary">{part.slice(2, -2)}</b>;
    }
    if (part.length > 2 && part[0] === "_" && part.slice(-1) === "_") {
      return <i key={i}>{part.slice(1, -1)}</i>;
    }
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
    if (link) {
      /* THE ONE PLACE A PERSON'S TYPING BECOMES AN href, so it is the one
         place the scheme has to be checked. `normaliseUrl` allows http and
         https and nothing else — `javascript:…` comes back null and the mark
         renders as the literal text somebody typed rather than as a link that
         runs it. noreferrer as well as noopener: the target must not be handed
         this panel's URL. */
      const href = normaliseUrl(link[2]);
      return href ? (
        <a key={i} href={href} target="_blank" rel="noopener noreferrer"
          className="rounded text-brand-secondary underline underline-offset-2 outline-focus-ring hover:text-brand-secondary_hover focus-visible:outline-2">
          {link[1]}
        </a>
      ) : <span key={i}>{part}</span>;
    }
    return part;
  });

type Run = { kind: "ul" | "ol" | "ck"; lines: string[] };

export function RichText({ text }: { text: string }) {
  const out: ReactNode[] = [];
  /* ONE RUN OF SAME-KIND LINES AT A TIME. A bulleted line under a numbered one
     is two lists, not one list with a stray row in it — which is what a single
     `bullets` array gave you the moment there was more than one kind of line. */
  let run: Run | null = null;
  const listCls = "flex list-outside flex-col gap-1 pl-5 marker:text-quaternary";

  const flush = (key: string) => {
    if (!run) return;
    const { kind, lines } = run;
    run = null;
    if (kind === "ck") {
      out.push(
        <ul key={key} className="flex flex-col gap-1.5">
          {lines.map((l, i) => {
            const done = /^\[[xX]\]/.test(l);
            return (
              <li key={i} className="flex items-start gap-2">
                {/* DRAWN, NOT TICKED. A box here is prose describing the work;
                    the boxes that MOVE are the item's own Steps, which are a
                    stored fact with a control of their own in the drawer. Two
                    tickable lists on one panel disagreeing about progress is
                    the thing this module exists to avoid. */}
                <span aria-hidden="true"
                  className={cx("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded ring-1 ring-inset",
                    done ? "bg-brand-solid ring-brand-solid" : "bg-primary ring-primary")}>
                  {done ? <Icon name="check" size="xs" className="text-white" /> : null}
                </span>
                <span className={cx("min-w-0", done && "text-quaternary line-through")}>
                  {inline(l.replace(/^\[[ xX]\]\s*/, ""))}
                </span>
              </li>
            );
          })}
        </ul>,
      );
      return;
    }
    const rows = lines.map((l, i) => <li key={i}>{inline(l)}</li>);
    out.push(kind === "ol"
      ? <ol key={key} className={cx(listCls, "list-decimal")}>{rows}</ol>
      : <ul key={key} className={cx(listCls, "list-disc")}>{rows}</ul>);
  };

  const push = (kind: Run["kind"], line: string, i: number) => {
    if (run && run.kind !== kind) flush("f" + i);
    if (!run) run = { kind, lines: [] };
    run.lines.push(line);
  };

  text.split("\n").forEach((line, i) => {
    /* Checklist before bullet: `- [ ] x` matches both, and it is the more
       specific of the two. */
    const ck = /^\s*[-*]\s+(\[[ xX]\]\s.*)$/.exec(line);
    if (ck) { push("ck", ck[1], i); return; }
    const ul = /^\s*[-*]\s+(.*)$/.exec(line);
    if (ul) { push("ul", ul[1], i); return; }
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (ol) { push("ol", ol[1], i); return; }
    flush("u" + i);
    if (line.trim()) out.push(<p key={"p" + i}>{inline(line)}</p>);
  });
  flush("uz");
  return <div className="flex flex-col gap-2 text-sm break-words text-secondary">{out}</div>;
}

/* ---------------------------------------------------------------- atoms --- */

/** A kind, as the square label it is: task, milestone, target. A kind is not a
 *  state the system assigned, so it is a Tag rather than a rounded Pill — and
 *  its hue is fixed per kind so the three read apart at a glance. */
export function KindTag({ kind }: { kind: string }) {
  return <Tag label={labelOf(KIND, kind)} tone={kind === "target" ? "violet" : kind === "milestone" ? "cyan" : "slate"} />;
}

/** The small glyph that says WHAT KIND of thing a row is, where a full tag
 *  would cost more width than the fact is worth. */
export function KindIcon({ kind, className }: { kind: string; className?: string }) {
  const ico = kind === "target" ? "star" : kind === "milestone" ? "flag" : "check";
  return (
    <Icon name={ico} size="sm"
      className={cx("shrink-0",
        kind === "target" ? "text-utility-purple-500" : kind === "milestone" ? "text-utility-sky-500" : "text-fg-quaternary",
        className)} />
  );
}

export function StagePill({ item }: { item: WorkItem }) {
  const st: WorkStage = stageOf(item);
  return <Pill dot text={labelOf(WORK_STATUS, st)} tone={toneOf(WORK_STATUS, st) || "neutral"} />;
}

/** LOUD ONLY WHEN IT IS LOUD. Low says nothing — "not urgent" is the default
 *  rather than a claim worth making — and Normal, which is also the default,
 *  is a quiet word rather than a filled badge. On a list where most rows are
 *  Normal a column of identical badges says nothing and drowns out the two
 *  priorities that SHOULD stop a reader. */
export function PriorityCell({ level }: { level: PriorityKey }) {
  if (level === "low") return null;
  if (level === "medium") return <span className="text-xs text-quaternary">Normal</span>;
  return <Priority level={level} />;
}

export function TagChips({ item, max }: { item: WorkItem; max?: number }) {
  const tags = tagsOf(item);
  if (!tags.length) return null;
  return <Tags items={tags.map((t) => ({ label: t.label, tone: t.colourToken || "slate" }))} max={max} />;
}

/** Waiting on another item. A relationship, never a stage. */
export function WaitFlag({ item }: { item: WorkItem }) {
  const b = blockerOf(item);
  if (!b) return null;
  return <Pill xs ico="lock" tone="bad" text="waiting" title={item.blockedReason || ("Waiting on " + b.title)} />;
}

/** Work done, with a marker for where today sits in the window. Marker ahead of
 *  the fill means behind schedule — two numbers, and no score computed from
 *  them. */
export function ProgressWindow({ item, showNote, bare }: {
  item: WorkItem; showNote?: boolean; bare?: boolean;
}) {
  const pct = progressOf(item) ?? 0;
  const t = timePct(item);
  const behind = t !== null && t > pct + 5;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex min-w-0 items-center gap-2">
        <span className="relative h-1.5 min-w-12 flex-1 rounded-full bg-quaternary" role="img"
          aria-label={pct + "% done" + (t === null ? "" : ", " + t + "% of the window gone")}>
          <i className={cx("absolute inset-y-0 left-0 rounded-full", behind ? "bg-fg-warning-primary" : "bg-fg-brand-primary")}
            style={{ width: Math.max(0, Math.min(100, pct)) + "%" }} />
          {t !== null ? (
            <b className={cx("absolute -inset-y-0.5 w-0.5 rounded-full", behind ? "bg-fg-error-primary" : "bg-fg-quaternary")}
              style={{ left: Math.max(0, Math.min(100, t)) + "%" }} />
          ) : null}
        </span>
        {bare ? null : <span className="shrink-0 text-xs font-medium text-secondary tnum">{pct}%</span>}
      </div>
      {showNote && behind ? (
        <span className="text-xs text-warning-primary">{t}% of the window gone, {pct}% done</span>
      ) : null}
    </div>
  );
}

export const noteOf = (i: WorkItem): string => {
  if (i.kind === "target") return (i.currentValue || 0) + " of " + (i.targetValue || 0) + " " + (i.targetUnit || "");
  const kids = childrenOf(i.itemId);
  if (!kids.length) return "no tasks under it";
  return kids.filter((k) => k.status === "completed").length + " of " + kids.length + " tasks";
};

export const daysOver = (i: WorkItem, today = TODAY) =>
  Math.round((new Date(today).getTime() - new Date(i.dueDate as string).getTime()) / 86400000);

/** How far a due date is from today, in words. */
export function ago(dateIso: string | null | undefined, todayIso: string = TODAY): string {
  if (!dateIso) return "—";
  const a = new Date(dateIso.slice(0, 10) + "T00:00:00");
  const b = new Date(todayIso + "T00:00:00");
  const n = Math.round((a.getTime() - b.getTime()) / 86400000);
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  return n > 0 ? "in " + n + " days" : n * -1 + " days ago";
}

/* ------------------------------------------------------------ sort head --- */

/* The sort head moved into the shared table vocabulary — two modules ranked
   the same way, so it is `ui/data`'s now. Re-exported here so this module's
   call sites keep one import. */
export { SortHead } from "../../ui";

/* ---------------------------------------------------------------- rows --- */

const ROW = "group flex w-full cursor-pointer items-start gap-2.5 rounded-lg px-2 py-2 text-left outline-focus-ring transition duration-100 hover:bg-primary_hover focus-visible:outline-2 focus-visible:-outline-offset-2";

export function TaskRow({ item, onOpen, who }: { item: WorkItem; onOpen: (id: string) => void; who?: boolean }) {
  const m = who ? readMember(item.assigneeId) : null;
  const late = isDelayed(item);
  const ck = checkCount(item);
  return (
    <button type="button" className={ROW} onClick={() => onOpen(item.itemId)}>
      <span aria-hidden="true" className="mt-0.5 size-4 shrink-0 rounded bg-primary ring-1 ring-primary ring-inset" />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-sm font-medium text-primary">{item.title}</span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-tertiary">
          {m ? <span>{m.name.split(" ").slice(-1)[0]}</span> : null}
          {/* THE PANEL'S OWN ICON, not an emoji. An emoji renders as a different
              glyph on every platform, ignores currentColor so it cannot follow
              the warn tone beside it, and is read out as "warning sign" in the
              middle of a sentence. */}
          <span className={cx("inline-flex items-center gap-1", late && "font-medium text-warning-primary")}>
            {late
              ? <><Icon name="alert" size="xs" />{daysOver(item)}d over</>
              : item.dueDate === TODAY ? "due today"
                /* `fmtDate(null)` is an em dash, so an undated task used to
                   read "due —". It could not reach this row before. */
                : item.dueDate ? "due " + fmtDate(item.dueDate) : "no date"}
          </span>
          <WaitFlag item={item} />
          {/* The steps, when there are steps. A task closed with lines still
              open is not this block's problem — it is not an open task. */}
          {ck.total ? (
            <span className="inline-flex items-center gap-1.5" title={ck.done + " of " + ck.total + " steps ticked"}>
              <span className="block h-1 w-10 rounded-full bg-quaternary">
                <i className="block h-full rounded-full bg-fg-brand-primary" style={{ width: Math.round((ck.done / ck.total) * 100) + "%" }} />
              </span>
              <span className="tnum">{ck.done}/{ck.total}</span>
            </span>
          ) : null}
          <TagChips item={item} max={2} />
        </span>
      </span>
    </button>
  );
}

/** COMPACT IS THE RAIL'S ROW. One heading — the name and the one number that
 *  answers it — and the bar under it. The calendar beside it already carries
 *  the dates, the assignee and the due day; a second copy of them in a narrow
 *  column is detail nobody reads twice. */
export function MarkRow({ item, onOpen, who, compact }: {
  item: WorkItem; onOpen: (id: string) => void; who?: boolean; compact?: boolean;
}) {
  const m = who ? readMember(item.assigneeId) : null;
  const target = item.kind === "target";
  const late = isDelayed(item);

  if (compact) {
    return (
      <button type="button" className={cx(ROW, "flex-col gap-1.5")} onClick={() => onOpen(item.itemId)}>
        <span className="flex w-full min-w-0 items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-primary">{item.title}</span>
          <span className="shrink-0 text-xs font-medium text-secondary tnum">
            {target ? (item.currentValue || 0) + " / " + (item.targetValue || 0) : (progressOf(item) ?? 0) + "%"}
          </span>
        </span>
        <span className="w-full"><ProgressWindow item={item} bare /></span>
      </button>
    );
  }

  return (
    <button type="button" className={cx(ROW, "flex-col gap-2")} onClick={() => onOpen(item.itemId)}>
      <span className="flex w-full min-w-0 items-center gap-2">
        <KindIcon kind={item.kind} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-primary">{item.title}</span>
      </span>
      {target ? (
        <span className="flex w-full items-baseline gap-1.5 text-xs text-tertiary">
          <b className="text-md font-semibold text-primary tnum">{item.currentValue || 0}</b>
          <span>of {item.targetValue} {item.targetUnit}</span>
          <span className="flex-1" />
          <span className="font-medium text-secondary tnum">{progressOf(item) ?? 0}%</span>
        </span>
      ) : null}
      <span className="w-full"><ProgressWindow item={item} showNote={!target} /></span>
      <span className="flex w-full flex-wrap items-baseline gap-x-2 text-xs text-tertiary">
        <span className="min-w-0 truncate">{(m ? m.name.split(" ").slice(-1)[0] + " · " : "") + (target ? windowNote(item) : noteOf(item))}</span>
        <span className="flex-1" />
        <span className={cx(late && "font-medium text-warning-primary")}>{item.dueDate ? "due " + fmtDate(item.dueDate) : "no date"}</span>
      </span>
    </button>
  );
}

const windowNote = (i: WorkItem) => {
  const t = timePct(i);
  return t === null ? "no window" : t + "% of the window gone";
};

/* -------------------------------------------------------------- blocks --- */

const empty = (t: string) => <p className="px-2 py-3 text-sm text-quaternary">{t}</p>;
const groupHead = (t: string) => <p className="label-mono px-2 pt-3 pb-1 first:pt-0">{t}</p>;

/** WHAT IS ASSIGNED TO YOU — all of it, urgent end first.
 *
 *  IT WAS CALLED "TASKS" AND SHOWED A THREE-DAY WINDOW. Anything due later, and
 *  anything with no date at all, was dropped without a word — so a member
 *  carrying twelve tasks read a panel headed "Tasks · 3", and the count was a
 *  count of the window rather than of the work. The window is still how the
 *  list is ORDERED, because overdue above today above later is the order you
 *  would work in; it is no longer what the list contains.
 *
 *  UNDATED WORK LANDS IN "Later" RATHER THAN NOWHERE. A task nobody dated is
 *  the easiest kind to lose, which is the opposite of what a block like this is
 *  for.
 *
 *  `limit` is the rail's, not the page's: a sidebar that also has to hold
 *  milestones and targets cannot be a full backlog, and what it cuts is named
 *  rather than silently dropped — the same bargain `MarksBlock` makes. */
export function TasksBlock({ who, withTeam, onOpen, limit }: {
  who: string; withTeam?: boolean; onOpen: (id: string) => void; limit?: number;
}) {
  const ids = withTeam ? membersInScope("team", who).map((m) => m.memberId) : [who];
  const open = readItems().filter((i) =>
    i.kind === "task" && ids.indexOf(i.assigneeId) >= 0 && !isTerminal(i.status));

  const over = open.filter((i) => isDelayed(i));
  const now = open.filter((i) => !isDelayed(i) && i.dueDate === TODAY);
  /* Everything else, dated or not — soonest first, and the undated last
     because there is no date to sort them by, not because they matter least. */
  const later = open
    .filter((i) => !isDelayed(i) && i.dueDate !== TODAY)
    .sort((x, y) => (x.dueDate || "9999").localeCompare(y.dueDate || "9999"));

  /* The cap is spent from the top, so it can never hide something overdue in
     order to show something undated. */
  let left = limit ?? Infinity;
  const take = (list: WorkItem[]) => {
    const n = Math.max(0, Math.min(list.length, left));
    left -= n;
    return list.slice(0, n);
  };
  const groups: [string, WorkItem[]][] = [
    ["Overdue", take(over)], ["Due today", take(now)], ["Later", take(later)],
  ];
  const shown = groups.reduce((n, g) => n + g[1].length, 0);
  const rest = open.length - shown;

  return (
    /* The count is everything assigned, not everything drawn — a heading that
       agrees with the list but not with the workload is the bug this block
       had. */
    <Card tight title="Assigned" right={<Pill xs tone="neutral" text={String(open.length)} />}>
      {open.length ? (
        <div className="-mx-2 flex flex-col">
          {groups.map(([label, list]) => (list.length ? (
            <div key={label}>
              {groupHead(label + " · " + list.length)}
              {list.map((i) => <TaskRow key={i.itemId} item={i} onOpen={onOpen} who={withTeam} />)}
            </div>
          ) : null))}
          {rest > 0 ? <p className="px-2 pt-2 text-xs text-quaternary">{rest} more on the board.</p> : null}
        </div>
      ) : empty(withTeam ? "Nothing open across the team." : "Nothing assigned to you.")}
    </Card>
  );
}

/** Mine, then my team — `reportsTo`, one level. A member with no reports never
 *  sees the second heading, and there is no bar against a person anywhere. */
export function MarksBlock({ kind, who, onOpen, compact, limit }: {
  kind: Exclude<WorkKind, "task">; who: string; onOpen: (id: string) => void;
  compact?: boolean; limit?: number;
}) {
  const all = readItems().filter((i) => i.kind === kind && !isTerminal(i.status));
  const team = membersInScope("team", who).map((m) => m.memberId).filter((id) => id !== who);
  const mine = all.filter((i) => i.assigneeId === who);
  const theirs = all.filter((i) => team.indexOf(i.assigneeId) >= 0);
  const title = kind === "target" ? "Targets" : "Milestones";

  /* ONE HEADER, THEN BARS. No "Mine"/"My team" split and no meta line: at rail
     width those headings cost more rows than the rows they introduce. `limit`
     says how many belong on a panel that is meant to be read at a glance —
     what it cuts is named rather than silently dropped. */
  if (compact) {
    const rows = mine.concat(theirs);
    const shownRows = limit ? rows.slice(0, limit) : rows;
    const rest = rows.length - shownRows.length;
    return (
      <Card tight title={title} right={<Pill xs tone="neutral" text={String(rows.length)} />}>
        {shownRows.length ? (
          <div className="-mx-2 flex flex-col">
            {shownRows.map((i) => <MarkRow key={i.itemId} item={i} onOpen={onOpen} compact />)}
            {rest > 0 ? <p className="px-2 pt-2 text-xs text-quaternary">{rest} more on the board.</p> : null}
          </div>
        ) : empty("None open.")}
      </Card>
    );
  }

  return (
    <Card tight title={title} right={<Pill xs tone="neutral" text={String(mine.length + theirs.length)} />}>
      {mine.length || theirs.length ? (
        <div className="-mx-2 flex flex-col">
          {mine.length ? (
            <>
              {groupHead("Mine · " + mine.length)}
              {mine.map((i) => <MarkRow key={i.itemId} item={i} onOpen={onOpen} />)}
            </>
          ) : null}
          {theirs.length ? (
            <>
              {groupHead("My team · " + theirs.length)}
              {theirs.map((i) => <MarkRow key={i.itemId} item={i} onOpen={onOpen} who />)}
            </>
          ) : null}
        </div>
      ) : empty("None open.")}
    </Card>
  );
}

/* ========================================================== the board === */

/** A KANBAN COLUMN. `label-mono` head, the count as a small pill, the cards
 *  under it — and the column keeps its width so five of them scroll sideways
 *  rather than squeezing each other into unreadable slivers. */
export function StageColumn({ label, n, children, note }: {
  label: ReactNode; n: number; children: ReactNode; note?: ReactNode;
}) {
  return (
    <section className="flex w-72 shrink-0 flex-col rounded-xl bg-secondary ring-1 ring-secondary">
      <header className="flex items-center gap-2 border-b border-secondary px-3 py-2.5">
        <h3 className="label-mono min-w-0 flex-1 truncate">{label}</h3>
        <Pill xs tone="neutral" text={String(n)} />
      </header>
      <div className="flex min-h-24 flex-col gap-2 p-2">
        {n ? children : <p className="px-1 py-4 text-center text-xs text-quaternary">{note || "Nothing here."}</p>}
      </div>
    </section>
  );
}

/** THE CARD. Title first, then the three facts you sort a column by — who has
 *  it, how urgent it is, when it is due — and the tags last because they are
 *  the reader's own vocabulary rather than the system's. */
export function TaskCard({ item, parent, onOpen }: {
  item: WorkItem; parent?: WorkItem | null; onOpen: (id: string) => void;
}) {
  const m = readMember(item.assigneeId);
  const late = isDelayed(item);
  const dead = item.status === "cancelled";
  return (
    <button type="button"
      className={cx(
        "flex w-full cursor-pointer flex-col gap-2 rounded-lg bg-primary p-3 text-left shadow-xs ring-1 ring-secondary outline-focus-ring transition duration-100 hover:ring-primary focus-visible:outline-2 focus-visible:outline-offset-2",
        late && "rail-warning",
        dead && "opacity-60",
      )}
      onClick={() => onOpen(item.itemId)}>
      <span className="flex min-w-0 items-start gap-2">
        <KindIcon kind={item.kind} className="mt-0.5" />
        <span className={cx("min-w-0 flex-1 text-sm font-medium text-primary", dead && "line-through")}>{item.title}</span>
      </span>
      {parent ? (
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-tertiary" title={"Rolls up to " + parent.title}>
          <Icon name="chevu" size="xs" className="text-fg-quaternary" />
          <span className="truncate">{parent.title}</span>
        </span>
      ) : null}
      {item.kind !== "task" ? <ProgressWindow item={item} /> : null}
      <span className="flex flex-wrap items-center gap-1.5">
        {m ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-tertiary">
            <Avatar name={m.name} xs />
            {m.name.split(" ").slice(-1)[0]}
          </span>
        ) : null}
        <span className="flex-1" />
        <span className={cx("text-xs tnum", late ? "font-medium text-warning-primary" : "text-quaternary")}>
          {item.dueDate ? ago(item.dueDate) : "no date"}
        </span>
      </span>
      <span className="flex flex-wrap items-center gap-1.5">
        <PriorityCell level={item.priority} />
        <WaitFlag item={item} />
        <TagChips item={item} max={2} />
      </span>
    </button>
  );
}

/* ======================================================= the calendar === */

const CHIP_TONE: Record<string, string> = {
  ok: "bg-utility-green-50 text-utility-green-700 ring-utility-green-200 hover:bg-utility-green-100",
  warn: "bg-utility-yellow-50 text-utility-yellow-700 ring-utility-yellow-200 hover:bg-utility-yellow-100",
  bad: "bg-utility-red-50 text-utility-red-700 ring-utility-red-200 hover:bg-utility-red-100",
  info: "bg-utility-blue-50 text-utility-blue-700 ring-utility-blue-200 hover:bg-utility-blue-100",
  dead: "bg-utility-neutral-50 text-utility-neutral-500 ring-utility-neutral-200 line-through",
  neutral: "bg-utility-neutral-50 text-utility-neutral-700 ring-utility-neutral-200 hover:bg-utility-neutral-100",
};

/** ONE EVENT ON ONE DAY. A chip, not a row: a month cell holds three of these
 *  and the title has to survive being clipped, so the kind glyph and the edge
 *  word come first and the title takes whatever is left. */
export function CalChip({ title, kind, edge, tone, onOpen }: {
  title: string; kind?: string; edge?: string; tone?: string; onOpen?: () => void;
}) {
  const cls = cx(
    "flex w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-left text-xs ring-1 ring-inset transition duration-100",
    CHIP_TONE[tone || "neutral"] || CHIP_TONE.neutral,
    onOpen && "cursor-pointer outline-focus-ring focus-visible:outline-2 focus-visible:-outline-offset-2",
  );
  const body = (
    <>
      {kind ? <KindIcon kind={kind} className="size-3 stroke-[2.5px] text-current opacity-70" /> : null}
      {edge ? <em className="shrink-0 not-italic opacity-70">{edge}</em> : null}
      <span className="min-w-0 flex-1 truncate">{title}</span>
    </>
  );
  return onOpen
    ? <button type="button" className={cls} title={title} onClick={onOpen}>{body}</button>
    : <span className={cls} title={title}>{body}</span>;
}

/** ONE DAY IN THE MONTH GRID. Today is marked on the ring and the number —
 *  never as a wash over the whole square, which reads as a warning in a panel
 *  where a tinted cell means something is wrong. */
export function CalCell({ date, day, today, outside, weekend, selected, children, onAdd, addLabel }: {
  date: string; day: number; today?: boolean; outside?: boolean; weekend?: boolean;
  selected?: boolean; children?: ReactNode; onAdd?: () => void; addLabel?: string;
}) {
  return (
    <div
      className={cx(
        "group/day relative flex min-h-24 flex-col gap-1 border-b border-r border-secondary p-1.5 transition duration-100",
        weekend ? "bg-secondary" : "bg-primary",
        outside && "opacity-55",
        selected && "bg-selected",
        today && "ring-1 ring-brand ring-inset",
      )}
      data-date={date}
      onClick={(e) => { if (onAdd && e.target === e.currentTarget) onAdd(); }}
    >
      <span className="flex items-center gap-1">
        <span className={cx("flex size-5 items-center justify-center rounded-full text-xs font-medium tnum",
          today ? "bg-brand-solid text-white" : "text-tertiary")}>{day}</span>
        <span className="flex-1" />
        {/* THE CELL'S CLICK IS A POINTER SHORTCUT, AND A SHORTCUT IS ALL IT CAN
            BE: a div that only answers a mouse announces nothing to a screen
            reader and cannot be reached by tab. The real control is this
            button — named, focusable, and revealed by focus as well as by
            hover, so the keyboard finds it exactly where the pointer does. */}
        {onAdd ? (
          <button type="button" aria-label={addLabel || "Add on " + fmtDate(date)}
            className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded text-fg-quaternary opacity-0 outline-focus-ring transition duration-100 hover:bg-primary_hover hover:text-fg-quaternary_hover focus-visible:opacity-100 focus-visible:outline-2 group-hover/day:opacity-100"
            onClick={onAdd}>
            <Icon name="plus" size="xs" />
          </button>
        ) : null}
      </span>
      {children}
    </div>
  );
}

/** The seven column heads over the grid. */
export function CalHead({ days }: { days: string[] }) {
  return (
    <>
      {days.map((d) => (
        <div key={d} className="label-mono border-b border-r border-secondary bg-secondary px-2 py-1.5 text-center">{d}</div>
      ))}
    </>
  );
}

/* ======================================================== the timeline === */

/** ONE BAR ON THE DATE GRID. `left`/`width` are a computed geometry — the only
 *  thing a style attribute is allowed to carry. */
export function LaneBar({ title, sub, left, width, top, tone, window: isWindow, onOpen }: {
  title: string; sub?: string; left: string; width: string; top: number;
  tone?: string; window?: boolean; onOpen?: () => void;
}) {
  return (
    <button type="button" title={title}
      className={cx(
        "absolute flex h-5 cursor-pointer items-center gap-1 overflow-hidden rounded-md px-1.5 text-left text-xs ring-1 ring-inset outline-focus-ring transition duration-100 focus-visible:outline-2 focus-visible:-outline-offset-2",
        isWindow ? "border border-dashed border-brand bg-transparent text-brand-secondary ring-transparent" : CHIP_TONE[tone || "neutral"] || CHIP_TONE.neutral,
      )}
      style={{ left, width, top }}
      onClick={onOpen}>
      {sub ? <span className="shrink-0 opacity-70">{sub}</span> : null}
      <span className="min-w-0 flex-1 truncate">{title}</span>
    </button>
  );
}

/* ==================================================== the attendance heat */

export type HeatKind = "none" | "leave" | "open" | "work" | "off";
export interface HeatCell {
  date: string;
  kind: HeatKind;
  /** 1…5 on the sequential ramp, for a worked day only. */
  step: number;
  title: string;
}
export interface HeatRow { key: string; head: ReactNode; cells: HeatCell[]; total: ReactNode }

const STEP: string[] = ["bg-chart-seq-1", "bg-chart-seq-1", "bg-chart-seq-2", "bg-chart-seq-3", "bg-chart-seq-4", "bg-chart-seq-5"];
const KIND_CLS: Record<HeatKind, string> = {
  none: "bg-error-primary ring-1 ring-utility-red-200 ring-inset",
  leave: "bg-info-primary ring-1 ring-utility-blue-200 ring-inset",
  open: "bg-warning-primary ring-1 ring-utility-yellow-200 ring-inset",
  off: "bg-tertiary",
  work: "",
};

/** THE MONTH, MEMBER BY DAY. Magnitude is the message — who worked a full day,
 *  who worked half of one — so it is a sequential ramp rather than five
 *  unrelated hues, and the three states that are NOT a quantity (no record, on
 *  leave, still open) are given status colours instead of a step on the ramp,
 *  because they are not more or less of anything.
 *
 *  Each cell is a link to that day's own row on the day view: a heat map you
 *  cannot drill into is a picture rather than a screen. */
export function HeatGrid({ days, rows, onPick }: {
  days: string[]; rows: HeatRow[]; onPick?: (date: string) => void;
}) {
  /* THE NAME COLUMN TAKES THE SURPLUS, NOT THE CELLS. With the days on `1fr` a
     month-to-date of four days drew four slabs the width of a hand, which reads
     as a bar chart of nothing; capped, a cell stays a cell whether the month has
     four working days in it or twenty-three. */
  /* THE SURPLUS SITS AFTER THE DAYS, in a spacer column, so a four-day
     month-to-date packs its cells against the names instead of drawing four
     slabs the width of a hand — and a twenty-three-day month fills the frame
     without either the names or the cells having to stretch. */
  const cols = "minmax(9rem,14rem) repeat(" + days.length + ",minmax(1.25rem,2rem)) minmax(0,1fr) 4.5rem";
  return (
    <div className="w-full overflow-x-auto rounded-xl bg-primary ring-1 ring-secondary">
      <div className="min-w-[34rem]">
        <div className="grid items-center gap-px border-b border-secondary bg-secondary px-3 py-1.5" style={{ gridTemplateColumns: cols }}>
          <span className="label-mono">Member</span>
          {days.map((d) => (
            <span key={d} className="label-mono text-center" title={fmtDate(d)}>{Number(d.slice(8))}</span>
          ))}
          <span aria-hidden="true" />
          <span className="label-mono text-right">Total</span>
        </div>
        {rows.map((r) => (
          <div key={r.key} className="grid items-center gap-px border-b border-secondary px-3 py-1.5 last:border-0 hover:bg-primary_hover"
            style={{ gridTemplateColumns: cols }}>
            <span className="min-w-0 pr-3">{r.head}</span>
            {r.cells.map((c) => {
              const cls = cx("mx-auto block h-6 w-full rounded-[3px] transition duration-100",
                c.kind === "work" ? STEP[Math.max(1, Math.min(5, c.step))] : KIND_CLS[c.kind],
                onPick && "cursor-pointer hover:ring-2 hover:ring-brand focus-visible:outline-2 focus-visible:outline-offset-1 outline-focus-ring");
              return onPick ? (
                <button key={c.date} type="button" className={cls} title={c.title} aria-label={c.title} onClick={() => onPick(c.date)} />
              ) : (
                <span key={c.date} className={cls} title={c.title} aria-label={c.title} role="img" />
              );
            })}
            <span aria-hidden="true" />
            <span className="text-right text-sm font-medium text-primary tnum">{r.total}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The ramp and the three states beside it, spelled out. A heat map with no
 *  key is a decoration. */
export function HeatLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-tertiary">
      <span className="inline-flex items-center gap-1.5">
        <span className="label-mono">Hours worked</span>
        <span className="inline-flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((s) => <i key={s} className={cx("block size-3 rounded-[2px]", STEP[s])} />)}
        </span>
        <span className="text-quaternary">short → full</span>
      </span>
      <span className="inline-flex items-center gap-1.5"><i className={cx("block size-3 rounded-[2px]", KIND_CLS.open)} />still open</span>
      <span className="inline-flex items-center gap-1.5"><i className={cx("block size-3 rounded-[2px]", KIND_CLS.leave)} />on leave</span>
      <span className="inline-flex items-center gap-1.5"><i className={cx("block size-3 rounded-[2px]", KIND_CLS.none)} />no record</span>
    </div>
  );
}

/* ================================================== the stacked day bars */

const SEG: Record<string, string> = {
  ok: "bg-utility-green-500",
  warn: "bg-utility-yellow-500",
  info: "bg-utility-blue-500",
  bad: "bg-utility-red-500",
  mute: "bg-utility-neutral-400",
};
export interface StackDay {
  date: string; label: string; sub: string; today?: boolean;
  segs: { k: string; n: number; tone: string; what: string }[];
}

/** ONE COLUMN PER DAY, EACH SEGMENT A STATE. Every day lands in exactly one
 *  segment, so the column height is the team and a stack that is taller than
 *  the team is a counting bug you can see. */
export function StackBars({ days, legend }: {
  days: StackDay[]; legend: { tone: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-40 items-end gap-1 overflow-x-auto pb-1 scrollbar-hide">
        {days.map((d) => {
          const total = Math.max(1, d.segs.reduce((a, s) => a + s.n, 0));
          return (
            /* CAPPED, NOT STRETCHED. On `flex-1` alone a five-day window drew
               five slabs the width of a hand — a stacked day is a bar, and a
               bar that fills a third of the frame reads as an area. */
            <span key={d.date} className="flex min-w-6 max-w-10 flex-1 flex-col items-center gap-1">
              <span className="flex h-32 w-full flex-col-reverse overflow-hidden rounded-[3px] bg-secondary" role="img"
                aria-label={d.label + ": " + d.segs.filter((s) => s.n).map((s) => s.n + " " + s.what).join(", ")}>
                {d.segs.map((s) => (s.n ? (
                  <i key={s.k} className={cx("block w-full", SEG[s.tone] || SEG.mute)}
                    style={{ height: (s.n / total) * 100 + "%" }} title={s.n + " " + s.what} />
                ) : null))}
              </span>
              <b className={cx("text-2xs font-medium tnum", d.today ? "text-brand-secondary" : "text-tertiary")}>{d.label}</b>
              <i className="text-2xs text-quaternary not-italic">{d.sub}</i>
            </span>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-tertiary">
        {legend.map((l) => (
          <span key={l.label} className="inline-flex items-center gap-1.5">
            <i className={cx("block size-2 rounded-[2px]", SEG[l.tone] || SEG.mute)} />{l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
