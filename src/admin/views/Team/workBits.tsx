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
import { Icon, Pill } from "../../ui";
import {
  TODAY, WORK_STATUS, addDays, blockerOf, childrenOf, fmtDate, isDelayed, isTerminal,
  labelOf, membersInScope, progressOf, readMember, readItems, stageOf, tagsOf, timePct, toneOf,
} from "./store";
import type { WorkItem, WorkKind, WorkStage } from "./store";

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
        <span key={t.tagId} className={"pill xs tag-" + (t.colourToken || "slate")}>{t.label}</span>
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
  return (
    <button className="tm-tk" onClick={() => onOpen(item.itemId)}>
      <i className="tm-tk-box" />
      <span className="tm-tk-t">
        <b>{item.title}</b>
        <span className="tm-tk-m">
          {m ? <span>{m.name.split(" ").slice(-1)[0]}</span> : null}
          <span className={late ? "u-warn-t" : ""}>
            {late ? "⚠ " + daysOver(item) + "d over" : item.dueDate === TODAY ? "due today" : "due " + fmtDate(item.dueDate)}
          </span>
          <WaitFlag item={item} />
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

/** Overdue first, then due today, then the next three days. Overdue above
 *  today, because a day list that hides what is already late loses it. */
export function TasksBlock({ who, withTeam, onOpen }: {
  who: string; withTeam?: boolean; onOpen: (id: string) => void;
}) {
  const ids = withTeam ? membersInScope("team", who).map((m) => m.memberId) : [who];
  const open = readItems().filter((i) =>
    i.kind === "task" && ids.indexOf(i.assigneeId) >= 0 && !isTerminal(i.status));
  const over = open.filter((i) => isDelayed(i));
  const now = open.filter((i) => !isDelayed(i) && i.dueDate === TODAY);
  const soon = open.filter((i) => !!i.dueDate && (i.dueDate as string) > TODAY
    && (i.dueDate as string) <= addDays(TODAY, 3));

  const sec = (label: string, list: WorkItem[]) => (list.length ? (
    <div key={label}>
      <p className="tm-blk-s">{label} · {list.length}</p>
      {list.map((i) => <TaskRow key={i.itemId} item={i} onOpen={onOpen} who={withTeam} />)}
    </div>
  ) : null);

  return (
    <Block title="Tasks" chip={withTeam ? "me and my reports" : fmtDate(TODAY)}>
      {over.length || now.length || soon.length ? (
        <>{sec("Overdue", over)}{sec("Due today", now)}{sec("Next 3 days", soon)}</>
      ) : empty("Nothing open in the next three days.")}
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
      <Block title={title} chip="derived">
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
    <Block title={title} chip="derived">
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
