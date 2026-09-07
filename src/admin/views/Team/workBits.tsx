/* =============================================================================
   Work — the pieces the rail, the roll-up and the member dashboard all render.
   -----------------------------------------------------------------------------
   ONE SET OF COMPONENTS, THREE SURFACES. `#/work` (the rail), `#/reports` (the
   roll-up) and `#/team/:id` (the member page) call exactly these, and the only
   argument that differs is the scope. Three surfaces each computing progress
   their own way is how a roll-up ends up printing a number its own children
   disagree with.

   Order is tasks ▸ milestones ▸ targets — the order somebody works in, smallest
   thing first. A milestone and a target are drawn DIFFERENTLY on purpose: a
   milestone is a window with children under it, so its bar carries a marker for
   where today sits inside that window; a target counts units, so the number
   leads and the bar sits behind it.
   ============================================================================= */
import type { ReactNode } from "react";
import { Icon, Pill } from "../../ui";
import {
  TODAY, WORK_STATUS, blockerOf, checkCount, childrenOf, fmtDate, isDelayed, isTerminal,
  labelOf, membersInScope, normaliseUrl, progressOf, readMember, readItems, stageOf, tagsOf,
  timePct, toneOf,
} from "./store";
import type { WorkItem, WorkKind, WorkStage } from "./store";

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
      return <b key={i}>{part.slice(2, -2)}</b>;
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
      return href
        ? <a key={i} href={href} target="_blank" rel="noopener noreferrer">{link[1]}</a>
        : <span key={i}>{part}</span>;
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

  const flush = (key: string) => {
    if (!run) return;
    const { kind, lines } = run;
    run = null;
    if (kind === "ck") {
      out.push(
        <ul key={key} className="tm-rt-ck">
          {lines.map((l, i) => {
            const done = /^\[[xX]\]/.test(l);
            return (
              <li key={i} className={done ? "done" : ""}>
                {/* DRAWN, NOT TICKED. A box here is prose describing the work;
                    the boxes that MOVE are the item's own Steps, which are a
                    stored fact with a control of their own in the drawer. Two
                    tickable lists on one panel disagreeing about progress is
                    the thing this module exists to avoid. */}
                <i className={done ? "on" : ""} aria-hidden="true" />
                <span>{inline(l.replace(/^\[[ xX]\]\s*/, ""))}</span>
              </li>
            );
          })}
        </ul>,
      );
      return;
    }
    const rows = lines.map((l, i) => <li key={i}>{inline(l)}</li>);
    out.push(kind === "ol" ? <ol key={key}>{rows}</ol> : <ul key={key}>{rows}</ul>);
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
  return <div className="tm-rt">{out}</div>;
}

/* ---------------------------------------------------------------- atoms --- */

export function StagePill({ item }: { item: WorkItem }) {
  const st: WorkStage = stageOf(item);
  return <Pill text={labelOf(WORK_STATUS, st)} tone={toneOf(WORK_STATUS, st)} />;
}

export function TagChips({ item }: { item: WorkItem }) {
  const tags = tagsOf(item);
  if (!tags.length) return null;
  return (
    <>
      {tags.map((t) => (
        <span key={t.tagId} className={"pill xs tm-tag tag-" + (t.colourToken || "slate")}>{t.label}</span>
      ))}
    </>
  );
}

/** Waiting on another item. A relationship, never a stage. */
export function WaitFlag({ item }: { item: WorkItem }) {
  const b = blockerOf(item);
  if (!b) return null;
  return (
    <span className="tm-wait" title={item.blockedReason || undefined}>
      <Icon name="lock" size="sm" />waiting
    </span>
  );
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
    <div className="tm-pw">
      <span className="tm-pw-bar">
        <i style={{ width: pct + "%" }} />
        {t !== null ? <b className={"tm-pw-tick" + (behind ? " late" : "")} style={{ left: t + "%" }} /> : null}
      </span>
      {bare ? null : <span className="tm-pw-n tnum">{pct}%</span>}
      {showNote && behind ? (
        <span className="tm-pw-note">{t}% of the window gone, {pct}% done</span>
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

/* ---------------------------------------------------------------- rows --- */

export function TaskRow({ item, onOpen, who }: { item: WorkItem; onOpen: (id: string) => void; who?: boolean }) {
  const m = who ? readMember(item.assigneeId) : null;
  const late = isDelayed(item);
  const ck = checkCount(item);
  return (
    <button className={"tm-tk" + (late ? " late" : "")} onClick={() => onOpen(item.itemId)}>
      <i className="tm-tk-box" />
      <span className="tm-tk-t">
        <b>{item.title}</b>
        <span className="tm-tk-m">
          {m ? <span>{m.name.split(" ").slice(-1)[0]}</span> : null}
          {/* THE PANEL'S OWN ICON, not an emoji. An emoji renders as a different
              glyph on every platform, ignores currentColor so it cannot follow
              the warn tone beside it, and is read out as "warning sign" in the
              middle of a sentence. */}
          <span className={late ? "u-warn-t tm-over" : ""}>
            {late
              ? <><Icon name="alert" size="sm" />{daysOver(item)}d over</>
              : item.dueDate === TODAY ? "due today"
                /* `fmtDate(null)` is an em dash, so an undated task used to
                   read "due —". It could not reach this row before. */
                : item.dueDate ? "due " + fmtDate(item.dueDate) : "no date"}
          </span>
          <WaitFlag item={item} />
          {/* The steps, when there are steps. A task closed with lines still
              open is not this block's problem — it is not an open task. */}
          {ck.total ? (
            <span className="tm-tk-ck" title={ck.done + " of " + ck.total + " steps ticked"}>
              <span className="tm-tk-ck-bar">
                <i style={{ width: Math.round((ck.done / ck.total) * 100) + "%" }} />
              </span>
              <span className="tnum">{ck.done}/{ck.total}</span>
            </span>
          ) : null}
          <TagChips item={item} />
        </span>
      </span>
    </button>
  );
}

/** COMPACT IS THE RAIL'S ROW. One heading — the name and the one number that
 *  answers it — and the bar under it. The calendar beside it already carries
 *  the dates, the assignee and the due day; a second copy of them in a 248px
 *  column is detail nobody reads twice. */
export function MarkRow({ item, onOpen, who, compact }: {
  item: WorkItem; onOpen: (id: string) => void; who?: boolean; compact?: boolean;
}) {
  const m = who ? readMember(item.assigneeId) : null;
  const target = item.kind === "target";
  const late = isDelayed(item);

  if (compact) {
    return (
      <button className={"tm-mk compact" + (target ? " target" : "")} onClick={() => onOpen(item.itemId)}>
        <span className="tm-mk-h">
          <b>{item.title}</b>
          <span className="tnum">{target
            ? (item.currentValue || 0) + " / " + (item.targetValue || 0)
            : (progressOf(item) ?? 0) + "%"}</span>
        </span>
        <ProgressWindow item={item} bare />
      </button>
    );
  }

  return (
    <button className={"tm-mk" + (target ? " target" : "")} onClick={() => onOpen(item.itemId)}>
      <span className="tm-mk-t">
        <Icon name={target ? "star" : "flag"} size="sm" className={"tm-kind tm-kind-" + item.kind} />
        <b>{item.title}</b>
      </span>
      {target ? (
        <span className="tm-mk-v">
          <b className="tnum">{item.currentValue || 0}</b>
          <span>of {item.targetValue} {item.targetUnit}</span>
          <span className="spacer" />
          <span className="tnum">{progressOf(item) ?? 0}%</span>
        </span>
      ) : null}
      <ProgressWindow item={item} showNote={!target} />
      <span className="tm-mk-m">
        <span>{(m ? m.name.split(" ").slice(-1)[0] + " · " : "") + (target ? windowNote(item) : noteOf(item))}</span>
        <span className="spacer" />
        <span className={late ? "u-warn-t" : ""}>{item.dueDate ? "due " + fmtDate(item.dueDate) : "no date"}</span>
      </span>
    </button>
  );
}

const windowNote = (i: WorkItem) => {
  const t = timePct(i);
  return t === null ? "no window" : t + "% of the window gone";
};

export const daysOver = (i: WorkItem, today = TODAY) =>
  Math.round((new Date(today).getTime() - new Date(i.dueDate as string).getTime()) / 86400000);

/* -------------------------------------------------------------- blocks --- */

function Block({ title, chip, children }: { title: string; chip?: string; children: React.ReactNode }) {
  return (
    <section className="tm-blk">
      <header><b>{title}</b>{chip ? <span className="tm-blk-c">{chip}</span> : null}</header>
      {children}
    </section>
  );
}

const empty = (t: string) => <p className="tm-blk-e">{t}</p>;

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
 *  `limit` is the rail's, not the page's: 248px of sidebar that also has to
 *  hold milestones and targets cannot be a full backlog, and what it cuts is
 *  named rather than silently dropped — the same bargain `MarksBlock` makes. */
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

  const sec = (label: string, list: WorkItem[]) => (list.length ? (
    <div key={label}>
      <p className="tm-blk-s">{label} · {list.length}</p>
      {list.map((i) => <TaskRow key={i.itemId} item={i} onOpen={onOpen} who={withTeam} />)}
    </div>
  ) : null);

  return (
    /* The chip counts everything assigned, not everything drawn — a heading
       that agrees with the list but not with the workload is the bug this
       block had. */
    <Block title="Assigned" chip={String(open.length)}>
      {open.length ? (
        <>
          {groups.map(([label, list]) => sec(label, list))}
          {rest > 0 ? <p className="tm-blk-e">{rest} more on the board.</p> : null}
        </>
      ) : empty(withTeam ? "Nothing open across the team." : "Nothing assigned to you.")}
    </Block>
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
    const shown = limit ? rows.slice(0, limit) : rows;
    const rest = rows.length - shown.length;
    return (
      <Block title={title} chip={String(rows.length)}>
        {shown.length ? (
          <>
            {shown.map((i) => <MarkRow key={i.itemId} item={i} onOpen={onOpen} compact />)}
            {rest > 0 ? <p className="tm-blk-e">{rest} more on the board.</p> : null}
          </>
        ) : empty("None open.")}
      </Block>
    );
  }

  return (
    <Block title={title} chip={String(mine.length + theirs.length)}>
      {mine.length || theirs.length ? (
        <>
          {mine.length ? (
            <>
              <p className="tm-blk-s">Mine · {mine.length}</p>
              {mine.map((i) => <MarkRow key={i.itemId} item={i} onOpen={onOpen} />)}
            </>
          ) : null}
          {theirs.length ? (
            <>
              <p className="tm-blk-s">My team · {theirs.length}</p>
              {theirs.map((i) => <MarkRow key={i.itemId} item={i} onOpen={onOpen} who />)}
            </>
          ) : null}
        </>
      ) : empty("None open.")}
    </Block>
  );
}
