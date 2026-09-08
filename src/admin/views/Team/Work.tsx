/* =============================================================================
   Calendar — #/work
   -----------------------------------------------------------------------------
     #/work                     the calendar face, which is what the row opens on
     #/work?face=board          the board, columns are the five stages
     #/work?face=board&group=…  the column axis is a choice: stage · kind ·
                                assignee · priority · tag
     #/work?face=list           the same rows as a table
     #/work?face=timeline       target ▸ milestone lanes, tasks as bars
     #/work?item=W-K04          one item, in a drawer over whichever face is open

   THE SIDEBAR ROW READS CALENDAR AND THE ROUTE STAYS /work. Label and default
   only: the entity is still WorkItem, the grant is still team.work.*, and
   ?face=board opens exactly the board that shipped, so no link moves.

   FIVE STAGES, the same five for everybody: Planning · In progress · Delay ·
   Complete · Cancel. Four are stored. DELAY IS DERIVED — dueDate < today on a
   non-terminal item — and it takes precedence in the grouping, so an item is in
   exactly one column and the strip and the board cannot disagree. Nothing
   writes it and no sweep sets it. Blocked is not a stage: waiting on someone is
   a relationship and lives on `blockedByItemId` with a reason.

   THE RAIL IS THE CALENDAR FACE'S OWN. The board is five columns and the
   timeline is a date grid behind a lane column — both need their width, and on
   both the same information is already on screen in a better shape.

   NO API YET — src/content/team/*.json through store.ts.
   ============================================================================= */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { usePageChrome } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import {
  EmptyState, FilterChips, Icon, Notice, SearchField, SectionHead, Select, StatStrip,
  Table, Tabs, TbTitle, cap, qs,
} from "../../ui";
import type { StatCell } from "../../ui";
import { BarRows } from "../charts";
import { go } from "../../ui/nav";
import { useMenuPlacement } from "../../ui/menu";
import {
  KIND, PRIORITY, PRIORITY_SCALE, TODAY, WORK_STATUS, addDays,
  blockerOf, checkCount, createItem, createTag, eventsOn, fmtDate, fmtMonth, gridDays,
  isDelayed, isTerminal, labelOf, lanesOf, leaveOn, meId, membersInScope, monthStep, normaliseUrl,
  parentOf, progressOf, readMember, stageOf, tagsOf, tagsOwnedBy, toneOf,
  useItem, useMembers, useTags, useWork, workTotals,
} from "./store";
import type {
  Attachment, CalEvent, Member, Priority, Tag, WorkItem, WorkStage,
} from "./store";
import { ensureAdopted } from "./adopt";
import { MarkBar } from "./marks";
import { ItemDrawer } from "./Detail";
import { StatusPicker } from "./status";
import { TodayPlanMenu } from "./TodayPlan";
import { KindMark, Meter, PriorityChip, TagTypePicker, Who, ago } from "./bits";
import {
  MarksBlock, ProgressWindow, TagChips, TasksBlock, WaitFlag, noteOf,
} from "./workBits";
import "./team.css";

const ROUTE = "#/work";
/* THREE FACES, AND THEY ARE THREE QUESTIONS: what is there, when is it, and
   how is it going. List, Board and Calendar were three of the four tabs and
   they are not three questions — they are three ways of looking at the same
   set, which is what a view switcher is for. They moved inside Tasks.

   THE OLD `?face=` VALUES STILL RESOLVE. `?face=board` and `?face=calendar`
   are links people have; they land on Tasks with that view selected rather
   than 404-ing or silently showing something else. See `readFace` below. */
const FACES = [
  { k: "tasks", l: "Tasks", i: "check", d: "Everything there is, as a list, a board or a month" },
  { k: "timeline", l: "Timeline", i: "chart", d: "Target and milestone lanes, tasks as bars" },
  { k: "analysis", l: "Analysis", i: "chart", d: "How the work is going, and where it is stuck" },
];

/** The three ways of looking at one set. A view, not a face — the question is
 *  the same in all three. */
const VIEWS = [
  { k: "list", l: "List", i: "doc", d: "Every item as a row, with its progress" },
  { k: "board", l: "Board", i: "menu", d: "Columns by stage, or by whatever you group on" },
  { k: "calendar", l: "Calendar", i: "calendar", d: "The month, and what falls on each day" },
];

/** CALENDAR IS WHAT `#/work` OPENS ON. The month is the shape most of this
 *  module's questions are actually asked in — what is due, what is late, what
 *  is coming — and it is the only view that answers them without being read
 *  row by row. List and Board are a click away in the switcher.
 *
 *  NAMED ONCE, because the default is two facts that must agree: which view a
 *  bare URL resolves to, and which view the menu writes as a bare URL. Split
 *  across two literals they drift, and the symptom is a menu row that never
 *  looks selected. */
const DEFAULT_VIEW = "calendar";

/** A face from the URL, with the three old tab values folded into the view
 *  they became. A link somebody sent last week still lands where it meant —
 *  including `?view=list`, which is now a real destination rather than the
 *  value you got by leaving the parameter off. */
function readFace(p: Record<string, string>): { face: string; view: string } {
  const raw = p.face || "";
  if (VIEWS.some((v) => v.k === raw)) return { face: "tasks", view: raw };
  const face = FACES.some((x) => x.k === raw) ? raw : "tasks";
  const view = VIEWS.some((v) => v.k === p.view) ? p.view : DEFAULT_VIEW;
  return { face, view };
}
/** Lifecycle order, not the order the five were listed in: Delay is work that
 *  is not finished, so it sits before the two terminal columns. */
const STAGES: WorkStage[] = ["planned", "in_progress", "delayed", "completed", "cancelled"];
/** The params that put a chip in the band — listed so the band can be absent
 *  when none of them is set. On a face bounded to the viewport an empty row
 *  still costs its padding, and this one was costing it on every load. */
const FILTERS = ["q", "kind", "priority", "due", "tag", "member", "status", "parent", "wait"];
const GROUPS = [
  { v: "", l: "Stage" }, { v: "kind", l: "Kind" }, { v: "assignee", l: "Assignee" },
  { v: "priority", l: "Priority" }, { v: "tag", l: "Tag" },
];

export default function Work() {
  const [sp] = useSearchParams();
  const p = useMemo(() => {
    const o: Record<string, string> = {};
    sp.forEach((v, k) => { if (v) o[k] = v; });
    return o;
  }, [sp]);

  const { face, view } = readFace(p);
  const scope = "all" as const;
  const rows = useWork({
    member: p.member, kind: p.kind, status: p.status, priority: p.priority,
    due: p.due, q: p.q, parent: p.parent, tag: p.tag, wait: p.wait,
  }, scope);
  const members = useMembers();
  const all = useWork({}, scope);
  const tags = useTags();
  const shell = useShell();
  /* The layer callbacks are the stable half of the shell — both are
     `useCallback(…, [])` — while the context value itself is rebuilt whenever
     the layer changes. The drawer effect below depends on these two and never
     on `shell`. */
  const { drawer: openDrawer, closeLayer, layerKind } = shell;
  const open = useItem(p.item || null);
  const me = meId();


  useEffect(() => { ensureAdopted(); }, []);

  const goto = useCallback((patch: Record<string, string | undefined>) => {
    const next: Record<string, string> = { ...p };
    Object.keys(patch).forEach((k) => {
      const v = patch[k];
      if (v) next[k] = v; else delete next[k];
    });
    go(ROUTE + qs(next));
  }, [p]);

  const onFilter = (name: string, value: string) => goto({ [name]: value || undefined });
  const openItem = useCallback((id: string) => goto({ item: id }), [goto]);

  /* THE HEADER IS THE TOPBAR, the way Deals settled it: the title on the left,
     and on the right the one control that changes what this page IS. A
     dropdown rather than four tabs — it names the face you are in, which a row
     of icons cannot do without spending the width of the filter row on it.

     No scope line beside the title any more: "47 items" was a second rendering
     of the strip's own first cell, sitting where you cannot click it. */
  usePageChrome({
    crumbs: <><TbTitle label="Tasks" to="#/work" /><WorkStats p={p} /></>,
    right: <FaceSwitch face={face} view={view} goto={goto} />,
    /* The button now names the VIEW as well as the face, so the key that
       republishes the chrome has to know about both. `here` happens to carry
       `?view=` and would have covered it; a control's own inputs should not
       depend on that. */
  }, face + ":" + view);

  /* THE DRAWER IS THE RECORD AND THE URL SAYS WHICH ONE, so this effect has to
     run in BOTH directions. Opening was never the broken half: `if (!open)
     return` meant Back dropped `?item=` and left the drawer sitting over a
     list that had already moved on, because nothing else in this app closes a
     layer on navigation.

     THE DEPENDENCIES WERE THE OTHER HALF, and they are why the drawer misbehaved
     while it was open rather than only on the way out. `all` is a fresh array
     from `workRows()` on every render, and `shell` is rebuilt every time the
     layer changes — so an effect that pushed a layer and then listed both re-ran
     because of what it had just done, pushed again, and looped until React gave
     up with "Maximum update depth exceeded". Deals has the same shape and dodges
     it with an eslint-disable over a hand-written dep list; that hides the loop
     rather than removing it.

     So the drawer takes an ID and subscribes to the store itself. What this
     effect watches is WHICH RECORD IS OPEN and nothing else: `openId` is a
     string, and `openDrawer`/`closeLayer` are the shell's two dependency-free
     callbacks. Data changes reach the drawer through its own hooks, which is
     also why ticking a checklist no longer re-pushes the whole layer and throws
     away focus. */
  const gotoRef = useRef(goto);
  useEffect(() => { gotoRef.current = goto; }, [goto]);

  /* Ours, so a modal somebody else opened is never closed from here. */
  const ownsDrawer = useRef(false);
  const shownId = useRef<string | null>(null);
  const openId = open ? open.itemId : null;
  /* THE SHELL HOLDS ONE LAYER. A modal the drawer opens — a reason, a link, an
     edit — REPLACES the drawer, and when that modal closes the slot is empty
     while the URL still names the record. So this watches the slot as well as
     the id: an empty slot with an item in the URL gets its drawer back, and a
     drawer already showing this item is left alone. */
  useEffect(() => {
    if (openId) {
      const stale = layerKind === "drawer" && shownId.current !== openId;
      if (layerKind === null || stale) {
        shownId.current = openId;
        ownsDrawer.current = true;
        const close = () => gotoRef.current({ item: undefined });
        openDrawer(
          <ItemDrawer itemId={openId} onClose={close}
            onOpen={(id) => gotoRef.current({ item: id })} />,
          /* The scrim and Escape drop the param too, not just the layer. */
          close,
        );
      }
      return;
    }
    shownId.current = null;
    if (ownsDrawer.current) { ownsDrawer.current = false; closeLayer(); }
  }, [openId, layerKind, openDrawer, closeLayer]);

  return (
    <div className="dls">
      {/* NO FILTER BAND ON THE CALENDAR. A month is read, not queried: the
          rail already answers "what is mine", the grid answers "what is when",
          and the row cost 56px of the one face that is bounded to the viewport.
          The three faces that ARE lists keep every filter — and a filter set on
          one of them survives the switch, because the chips band below stays
          and can still clear it.

          ONE BAND, NOT A TOOLBAR INSIDE A BAND: `.dls-cmd` is already the flex
          row every list screen uses. */}
      {face === "tasks" && view === "calendar" ? null : (
        <div className="dls-cmd">
          <SearchField ph="Search work" name="q" val={p.q} onFilter={onFilter} />
          <Select name="member" label="Member" value={p.member} onFilter={onFilter}
            options={members.filter((m) => m.status === "active").map((m) => ({ v: m.memberId, l: m.name }))} />
          <Select name="kind" label="Kind" value={p.kind} onFilter={onFilter}
            options={[{ v: "task", l: "Tasks" }, { v: "milestone", l: "Milestones" }, { v: "target", l: "Targets" }]} />
          <Select name="tag" label="Tag" value={p.tag} onFilter={onFilter}
            options={slugOptions(tags)} />
          <Select name="priority" label="Priority" value={p.priority} onFilter={onFilter}
            options={PRIORITY_SCALE.map((k) => ({ v: k, l: labelOf(PRIORITY, k) }))} />
          <span className="spacer" />
          {/* THE DAY BEFORE THE WORK. It sits left of Create because it is the
              thing you do first, and because Create is the primary and keeps
              the end of the row. */}
          <TodayPlanMenu />
          {/* Create rides this row on the three faces with no rail; the
              calendar carries it at the top of its own. */}
          <CreateMenu onPick={(k) => shell.modal(<NewItemModal kind={k} members={members} />)} />
        </div>
      )}

      {FILTERS.some((k) => p[k]) ? (
        <div className="dls-chips">
          <FilterChips
            params={{
              q: p.q, kind: p.kind, priority: p.priority, due: p.due, tag: p.tag,
              member: p.member ? (readMember(p.member)?.name || p.member) : undefined,
              status: p.status ? labelOf(WORK_STATUS, p.status) : undefined,
              parent: p.parent ? "within " + p.parent : undefined,
              wait: p.wait ? "waiting" : undefined,
            }}
            onUnfilter={(n) => onFilter(n, "")} />
        </div>
      ) : null}


      <div className={"dls-body tm-pane"
        + (face === "tasks" && view === "calendar" ? " tm-body" : "")}>
        {face === "timeline" ? <Timeline rows={rows} onOpen={openItem} />
          : face === "analysis" ? <Analysis rows={rows} all={all} members={members} />
            : view === "calendar" ? <CalendarFace rows={rows} me={me} p={p} goto={goto} onOpen={openItem} members={members} />
              : view === "board" ? <Board rows={rows} all={all} group={p.group || ""} goto={goto} onOpen={openItem} />
                : <List rows={rows} all={all} onOpen={openItem} />}
      </div>
    </div>
  );
}

const slugOptions = (tags: Tag[]) => {
  const seen: Record<string, string> = {};
  tags.filter((t) => !t.archivedAt).forEach((t) => { seen[t.slug] = t.label; });
  return Object.keys(seen).sort().map((s) => ({ v: s, l: seen[s] }));
};

/* STEPS ARE WRITTEN ON THE RECORD, NOT BEFORE IT. The create dialog used to
   carry its own draft checklist — plain strings, no ids, minted by the store on
   save. It is gone: creating a task is naming it and handing it to somebody,
   and a second list to fill in before the thing exists is a form standing
   between that and Create. The steps themselves are untouched — `checklist` is
   still the one stored fact the module derives progress from, and the drawer's
   CheckList is now the single place it is written. */

/** A LINK IS ONE THING, SO IT IS ONE ROW.
 *
 *  This was six elements for one idea: a label over an address, a refusal under
 *  it, a label over a name, the name, and a button of its own — a form inside a
 *  field, on a dialog whose whole job is a title and a date. It is the row the
 *  drawer already uses: paste, name it or don't, Add. Same control, same order,
 *  same fallback on both screens, so a link is attached the same way wherever
 *  you are.
 *
 *  The address is normalised before it can be added, so what lands on the item
 *  is a real http(s) URL and never a `javascript:` one. */
function LinkField({ links, onChange }: {
  links: Attachment[]; onChange: (v: Attachment[]) => void;
}) {
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const ok = normaliseUrl(url);
  const add = () => {
    if (!ok) return;
    onChange(links.concat([{ url: ok, label: label.trim() || hostOf(ok) }]));
    setUrl(""); setLabel("");
  };
  const bad = !!url.trim() && !ok;
  return (
    <>
      {links.length ? (
        <ul className="tm-lk">
          {links.map((l, i) => (
            <li key={l.url + i}>
              <Icon name="ext" size="sm" />
              <span className="tm-lk-t"><b>{l.label}</b><span className="cell-2">{l.url}</span></span>
              <button className="btn icon sm" aria-label={"Remove the link to " + l.label}
                onClick={() => onChange(links.filter((_, n) => n !== i))}>
                <Icon name="x" size="sm" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="tm-lk-new">
        <input id="niUrl" className={"inp" + (bad ? " bad" : "")} value={url}
          placeholder="Paste a link" aria-label="Link address"
          aria-describedby={bad ? "niUrlErr" : undefined}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <input className="inp" value={label} placeholder="Name — optional" aria-label="Link name"
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button className="btn sm" disabled={!ok} onClick={add}>Add</button>
      </div>
      {/* Tied to the field it is about, and only once there is something to
          refuse — an empty box is not an error. */}
      {bad ? (
        <p id="niUrlErr" className="help bad">That is not a web address — links have to be http or https.</p>
      ) : null}
    </>
  );
}

const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };

/** A tag is born here as it is in the drawer — a name, a type, one keystroke.
 *  It is a record of its own, so it survives this dialog being cancelled. */
function NewTagField({ ownerId, onMade }: { ownerId: string; onMade: (id: string) => void }) {
  const shell = useShell();
  const [draft, setDraft] = useState("");
  const [tone, setTone] = useState("slate");
  const add = () => {
    const r = createTag(ownerId, draft, tone);
    if (!r.ok) { shell.toast(r.message, "bad"); return; }
    onMade(r.data.tagId);
    setDraft(""); setTone("slate");
  };
  return (
    <>
      {/* The group's own label is a `.fg-lb` span — it names the chips, which
          are buttons and cannot carry a `for`. This input therefore needs its
          own, or it is the one control in the dialog with nothing naming it. */}
      <label className="tm-ni-sub" htmlFor="niTag">New tag</label>
      <div className="tm-tagnew">
        <input id="niTag" className="inp" value={draft} placeholder="Name a new tag"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button className="btn" disabled={!draft.trim()} onClick={add}>Create</button>
      </div>
      {/* The type is shown as what it will look like, next to the swatches that
          set it — so the choice is read rather than remembered. */}
      <div className="tm-tagtype-row">
        <span className={"pill xs tm-tag tag-" + tone}>{draft.trim() || "Preview"}</span>
        <TagTypePicker tone={tone} onPick={setTone} />
      </div>
    </>
  );
}

/** THE COUNTS LIVE IN THE HEADER, beside the title — the arrangement Deals
 *  settled on. They were a band of their own under the command row, which on a
 *  face bounded to the viewport is a row of six numbers charging full height
 *  for a line of text.
 *
 *  It reads the store ITSELF rather than taking the totals as a prop: the
 *  chrome node is captured once per location, so a prop would freeze at
 *  whatever the numbers were before the last write landed.
 *
 *  Every count is still the filter for itself, and pressing the one you are
 *  already on clears it — so the header is never a trap you have to leave by
 *  the chip row. Stage and waiting are one axis here: they are two answers to
 *  "what state is this in", and a strip that could hold both at once would
 *  show two cells lit for one list. */
function WorkStats({ p }: { p: Record<string, string> }) {
  /* THE SAME SET AS THE PAGE BELOW, minus the one dimension this strip filters
     on. It read the whole company while the list under it was filtered, so
     the crumb said 47 over a table of six. `status` is left out because every
     cell here IS a status filter: scoping the counts by it would zero every
     other cell the moment one was clicked. */
  const sansStatus = { ...p };
  delete sansStatus.status;
  const t = workTotals(useWork(sansStatus, "all"));

  const route = (key?: string, val?: string) => {
    const next: Record<string, string> = { ...p };
    delete next.status; delete next.wait;
    if (key && val) next[key] = val;
    return ROUTE + qs(next);
  };
  const cell = (k: string, v: number, on: boolean, to: string, dot?: string) => (
    <button key={k} className={"tb-stat" + (on ? " on" : "")} data-go={to}
      title={v + " " + k} onClick={() => go(to)}>
      {dot !== undefined ? <span className={"dls-cdot " + dot}></span> : null}
      <span className="v tnum">{v}</span><span className="k">{k}</span>
    </button>
  );
  const stage = (k: string, v: number, st: string, dot?: string) =>
    cell(k, v, p.status === st, p.status === st ? route() : route("status", st), dot);

  return (
    <span className="tb-stats">
      {cell("items", t.total, !p.status && !p.wait, route())}
      {stage("in progress", t.inProgress, "in_progress", "info")}
      {stage("planning", t.planned, "planned", "")}
      {stage("in delay", t.delayed, "delayed", t.delayed ? "warn" : "")}
      {cell("waiting", t.waiting, !!p.wait, p.wait ? route() : route("wait", "1"), t.waiting ? "bad" : "")}
      {stage("complete", t.completed, "completed", "ok")}
    </span>
  );
}

/** THE SWITCHER IS A COMPONENT, NOT A NODE, and that is not a style choice.
 *  Published chrome is captured once per location, so a `shell` closed over at
 *  publish time keeps the `popAnchor` it had then — forever null. The
 *  toggle-to-close branch could never fire, and pressing the button a second
 *  time re-opened the menu instead of shutting it. Reading the shell inside the
 *  component reads it at click time, which is when the answer matters. */
export function FaceSwitch({ face, view, goto }: {
  face: string; view: string; goto: (q: Record<string, string | undefined>) => void;
}) {
  const shell = useShell();
  /* THE BUTTON NAMES WHERE YOU ARE, not which family it belongs to. It said
     "Tasks" on all three of List, Board and Calendar — so the one control that
     is supposed to answer "where am I" answered it for two of the five
     destinations and shrugged at the other three. */
  const cur = face === "tasks"
    ? (VIEWS.filter((v) => v.k === view)[0] || VIEWS[0])
    : (FACES.filter((f) => f.k === face)[0] || FACES[0]);
  return (
    /* `data-act` IS LOAD-BEARING AND THIS BUTTON NEVER HAD IT. The shell's
       popover dismisses on any document click that is not inside `.pop` and not
       on a `[data-act]` element — and React 18 flushes a discrete click
       synchronously, so `openPop` mounts the popover and registers that
       listener BEFORE the very click that opened it has finished bubbling to
       `document`. Without the attribute the menu opened and closed in one tick,
       which looks exactly like a button that does nothing.

       It was broken from the day it shipped and did not matter, because List,
       Board and Calendar had a segmented row of their own; the menu only held
       Timeline and Analysis. Folding the views into it made the one control
       that could not open the only way to change view.

       Every other trigger in the panel carries this — `dl-view`, `in-more`,
       `qt-more` — and Invoices and Quotations both say so in a comment. */
    <button className="btn tb-view-btn" data-act="tm-view" aria-haspopup="menu"
      onClick={(e) => {
        const el = e.currentTarget;
        if (shell.popAnchor === el) { shell.closePop(); return; }
        shell.openPop(el, <FaceMenu face={face} view={view} goto={goto} />,
          { width: 268, align: "right", cls: "pop-views" });
      }}>
      <Icon name={cur.i} />{cur.l}<Icon name="chev" size="sm" />
    </button>
  );
}

/** EVERY DESTINATION, IN ONE MENU, IN TWO GROUPS.
 *
 *  List, Board and Calendar were a segmented row in the body and Timeline and
 *  Analysis were in this dropdown, so getting from the board to the timeline
 *  meant using two different controls in two different places to answer one
 *  question. They are one list now.
 *
 *  STILL TWO GROUPS, THOUGH, because the distinction is real and flattening it
 *  would lose it: the first three are three SHAPES of the same question — what
 *  work is there — and the last two are different questions. The heading says
 *  which is which; the rows are the same rows either way. */
export function FaceMenu({ face, view, goto }: {
  face: string; view: string; goto: (q: Record<string, string | undefined>) => void;
}) {
  const shell = useShell();
  const pick = (q: Record<string, string | undefined>) => { shell.closePop(); goto(q); };
  return (
    <div className="pop-b">
      <p className="pop-grp">The work, three ways</p>
      {VIEWS.map((v) => (
        <button key={v.k} className={"mi" + (face === "tasks" && v.k === view ? " on" : "")}
          onClick={() => pick({ face: undefined, view: v.k === DEFAULT_VIEW ? undefined : v.k })}>
          <Icon name={v.i} />
          <span><b>{v.l}</b><span className="d">{v.d}</span></span>
          {face === "tasks" && v.k === view
            ? <span className="r"><Icon name="check" size="sm" /></span> : null}
        </button>
      ))}
      <p className="pop-grp">Other questions</p>
      {FACES.filter((f) => f.k !== "tasks").map((f) => (
        <button key={f.k} className={"mi" + (f.k === face ? " on" : "")}
          onClick={() => pick({ face: f.k, view: undefined })}>
          <Icon name={f.i} />
          <span><b>{f.l}</b><span className="d">{f.d}</span></span>
          {f.k === face ? <span className="r"><Icon name="check" size="sm" /></span> : null}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------ analysis --- */

/** HOW THE WORK IS GOING, AND WHERE IT IS STUCK — in that order, because the
 *  second is the reason anybody opens this.
 *
 *  IT READS THE ROWS ON SCREEN, not the whole table. Every filter above it
 *  applies, so "Analysis" of one member's marketing tasks is the same three
 *  questions asked of a smaller set rather than a different screen. A chart
 *  that ignored the filter band would be a chart nobody could trust against
 *  the list beside it.
 *
 *  NO NEW CHART LIBRARY. `BarRows` is the panel's own, and the two things this
 *  face has to say — how much of each stage there is, and who is carrying what
 *  — are both magnitudes across classes, which is what a bar row is for. A
 *  donut of five stages would have been the template answer and would read
 *  worse at every size.
 */
function Analysis({ rows, all, members }: {
  rows: WorkItem[]; all: WorkItem[]; members: Member[];
}) {
  const tasks = rows.filter((i) => i.kind === "task");
  const open = rows.filter((i) => !isTerminal(i.status));
  const late = rows.filter((i) => isDelayed(i));
  const blocked = rows.filter((i) => !!blockerOf(i, all));

  /* Completed over everything that is not cancelled. A cancelled task is not a
     failure to finish, it is a decision not to — counting it against the rate
     would make cancelling look like slipping. */
  const counted = rows.filter((i) => i.status !== "cancelled");
  const done = counted.filter((i) => i.status === "completed").length;
  const rate = counted.length ? Math.round((done / counted.length) * 100) : null;

  const byStage = STAGES.map((st) => ({
    key: st,
    label: labelOf(WORK_STATUS, st) || cap(st),
    value: rows.filter((i) => stageOf(i) === st).length,
    /* The chart kit's own reserved status tones, not the pill vocabulary —
       they are different scales and mixing them is how a chart ends up
       colouring a stage with a hue that means something else. */
    tone: st === "delayed" ? "st-bad" : st === "completed" ? "st-ok" : "st-mute",
  })).filter((r) => r.value > 0);

  /* AN ORDINAL SCALE, DRAWN AS ONE. Priority is ranked, so it takes the kit's
     ordinal steps rather than four unrelated hues — the reader should be able
     to see the order without reading the labels. */
  const byPriority = PRIORITY_SCALE.map((p, n) => ({
    key: p,
    label: labelOf(PRIORITY, p),
    value: open.filter((i) => i.priority === p).length,
    tone: n === 0 ? "st-bad" : n === 1 ? "o1" : n === 2 ? "o2" : "o3",
  })).filter((r) => r.value > 0);

  /* WHO IS CARRYING WHAT — open items only, because a person's finished work is
     not load. Sorted by what is late rather than by volume: eight on time is a
     working week and two overdue is a conversation. */
  const byMember = members
    .map((m) => {
      const mine = open.filter((i) => i.assigneeId === m.memberId);
      return {
        m,
        open: mine.length,
        late: mine.filter((i) => isDelayed(i)).length,
      };
    })
    .filter((r) => r.open > 0)
    .sort((a, b) => (b.late - a.late) || (b.open - a.open));

  /* A checklist is the only place a task says how far in it is, so the tasks
     that HAVE one are worth reading apart from the ones that do not. */
  const withList = tasks.filter((i) => (i.checklist || []).length);
  const lineTotal = withList.reduce((a, i) => a + checkCount(i).total, 0);
  const lineDone = withList.reduce((a, i) => a + checkCount(i).done, 0);

  const cells: (StatCell | "sep")[] = [
    { k: "in view", v: rows.length, title: "Every filter above applies to this page" },
    "sep",
    { k: "open", v: open.length },
    { k: "delayed", v: late.length, dot: late.length ? "bad" : "" },
    { k: "blocked", v: blocked.length, dot: blocked.length ? "warn" : "" },
    "sep",
    { k: "finished", v: rate === null ? "—" : rate + "%", title: "Completed, of everything not cancelled" },
  ];

  if (!rows.length) {
    return (
      <EmptyState icon="chart" title="Nothing to analyse"
        body="No item matches the filters above. Clear one and the numbers come back." />
    );
  }

  return (
    <div className="tm-an">
      <StatStrip cells={cells} />

      {late.length ? (
        <Notice tone="bad">
          <b>{late.length} {late.length === 1 ? "item is" : "items are"} past due.</b>{" "}
          Delay is derived from the date, not stored — nothing swept overnight to decide this, and
          it stops being true the moment the date or the status moves.
        </Notice>
      ) : null}

      <div className="tm-an-two">
        <section className="tm-card">
          <SectionHead title="Where the work is"
            desc="Every item in view, by the stage it is actually in." />
          <BarRows rows={byStage} unit="" />
        </section>

        <section className="tm-card">
          <SectionHead title="What is open, by priority"
            desc="Finished work carries no urgency, so it is not counted here." />
          {byPriority.length
            ? <BarRows rows={byPriority} unit="" />
            : <span className="cell-2">Nothing is open.</span>}
        </section>
      </div>

      <section className="tm-card">
        <SectionHead title="Who is carrying what"
          desc="Open items only. Ordered by what is late, not by how much — eight on time is a working week, two overdue is a conversation." />
        {byMember.length ? (
          <Table
            cols={[
              { label: "Member" },
              { label: "Open", cls: "n", w: "90px" },
              { label: "Delayed", cls: "n", w: "100px" },
              { label: "Load", w: "220px" },
            ]}
            rows={byMember.map((r) => (
              <tr key={r.m.memberId}>
                <td><Who m={r.m} /></td>
                <td className="n tnum">{r.open}</td>
                <td className={"n tnum" + (r.late ? " u-bad" : "")}>{r.late || "—"}</td>
                <td>
                  <Meter value={r.open - r.late} of={Math.max(1, r.open)}
                    tone={r.late ? "warn" : "ok"}
                    label={<>{r.open - r.late} on time{r.late ? " · " + r.late + " late" : ""}</>} />
                </td>
              </tr>
            ))}
          />
        ) : <span className="cell-2">Nobody has anything open in this view.</span>}
      </section>

      <section className="tm-card">
        <SectionHead title="Steps ticked off"
          desc="Only the tasks that carry a checklist — the rest have no way to say how far in they are." />
        {withList.length ? (
          <>
            <div className="tm-an-steps">
              <Meter value={lineDone} of={Math.max(1, lineTotal)}
                tone={lineDone === lineTotal ? "ok" : "warn"}
                label={<>{lineDone} of {lineTotal} steps</>} />
            </div>
            <Table
              cols={[
                { label: "Task" },
                { label: "Steps", cls: "n", w: "110px" },
                { label: "Progress", w: "200px" },
              ]}
              rows={withList
                .slice()
                .sort((a, b) => (progressOf(a) || 0) - (progressOf(b) || 0))
                .map((i) => {
                  const c = checkCount(i);
                  return (
                    <tr key={i.itemId}>
                      <td>
                        <div className="tm-who-t">
                          <b>{i.title}</b>
                          <span className="cell-2">{labelOf(WORK_STATUS, i.status)}</span>
                        </div>
                      </td>
                      <td className="n tnum">{c.done} of {c.total}</td>
                      <td>
                        <Meter value={c.done} of={Math.max(1, c.total)}
                          tone={c.done === c.total ? "ok" : ""}
                          label={<>{progressOf(i)}%</>} />
                      </td>
                    </tr>
                  );
                })}
            />
          </>
        ) : (
          <span className="cell-2">
            No task in view has a checklist. Add steps to one and its progress stops being a
            choice between nothing and everything.
          </span>
        )}
      </section>
    </div>
  );
}

/* -------------------------------------------------------------- create --- */

/** One control, three kinds. All three open the same form with `kind`
 *  prefilled — they are one WorkItem with a kind, and a target only adds two
 *  fields to it. Three buttons become three forms, then three lists. */
/* IT OPENED IN THE CORNER OF THE WINDOW. `.ib-menu-pop` is `position: fixed`
   with `top: 0; left: 0` — fixed so it can escape a scrolling ancestor, which
   means the stylesheet cannot place it and the component has to measure its own
   button. This one rendered the class and measured nothing, so the menu sat at
   the viewport's top-left corner however far down the page the button was.
   `useMenuPlacement` is the maths MoreMenu was already doing, exported so this
   is the last menu that has to know about it.

   Left-aligned, not right: Create is a wide primary button and a menu that
   hangs off its right edge reads as belonging to whatever is beside it. */
function CreateMenu({ onPick, big }: { onPick: (k: string) => void; big?: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement | null>(null);
  const pop = useRef<HTMLSpanElement | null>(null);
  const { style: popStyle, width } = useMenuPlacement(open, box, pop, "left");
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
    };
    /* Fixed coordinates cannot follow the button, so anything that moves it
       closes the menu rather than leaving it stranded beside nothing. `true`
       catches scrolls on inner containers, which is where this happens — the
       rail and the list body, not the window. */
    const shut = () => setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc, true);
    window.addEventListener("scroll", shut, true);
    window.addEventListener("resize", shut);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc, true);
      window.removeEventListener("scroll", shut, true);
      window.removeEventListener("resize", shut);
    };
  }, [open]);
  return (
    <span className={"ib-menu" + (big ? " tm-create-b" : "")} ref={box}>
      <button className="btn pri" aria-haspopup="menu" aria-expanded={open}
        onClick={() => setOpen((o) => !o)}>
        <Icon name="plus" size={big ? undefined : "sm"} />Create
      </button>
      {open ? (
        <span ref={pop} className="ib-menu-pop" role="menu" aria-label="Create"
          /* The full-width rail button hands its own width to its menu. A
             stylesheet cannot: `min-width: 100%` on a FIXED element resolves
             against the viewport, so the rule that used to be here made the
             menu as wide as the window. */
          style={big && width ? { ...popStyle, minWidth: width } : popStyle}>
          {["task", "milestone", "target"].map((k) => (
            <button key={k} role="menuitem" className="mi"
              onClick={() => { setOpen(false); onPick(k); }}>
              <KindMark kind={k} />{labelOf(KIND, k)}
            </button>
          ))}
        </span>
      ) : null}
    </span>
  );
}

/** ONE FORM, THREE KINDS, AND THE TITLE IS THE FORM.
 *
 *  It was six labelled fields in a two-column grid, which asks somebody to read
 *  the form before they can write the one thing they came to write. Google's
 *  create dialog opens on a single empty title and lets every other fact be a
 *  quiet row under the icon that names it — no labels, no boxes until you reach
 *  for one — and that is the shape borrowed here.
 *
 *  The kind switcher is the panel's own tab row directly under the title: they
 *  are one record with a `kind`, and a target only adds two fields to the same
 *  five. Enter in the title creates, because for most of these the title IS the
 *  whole entry. */
export function NewItemModal({ kind: initial, members, date }: {
  kind: string; members: Member[]; date?: string;
}) {
  const shell = useShell();
  const [kind, setKind] = useState(initial);
  const [title, setTitle] = useState("");
  const [who, setWho] = useState(meId());
  const [pri, setPri] = useState("medium");
  /* A day was clicked: it is both the start and the due date, so the item
     lands on the day somebody pointed at rather than near it. */
  const [start, setStart] = useState(date || "");
  const [due, setDue] = useState(date || addDays(TODAY, 3));
  const [tv, setTv] = useState("");
  const [tu, setTu] = useState("");
  const [desc, setDesc] = useState("");
  const [links, setLinks] = useState<Attachment[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const ta = useRef<HTMLTextAreaElement | null>(null);
  useTags();
  const mine = tagsOwnedBy(who);

  /* A tag belongs to a member, so handing the item to somebody else cannot
     carry the last person's tags with it. */
  const assign = (id: string) => { setWho(id); setTags([]); };

  /* ROLLS UP TO IS NOT A CREATE-TIME QUESTION. Naming a task, handing it to
     somebody and saying when it is due is the whole of making one; which
     milestone it belongs under is a decision about the SHAPE of the work, and
     it is one you usually make after the task exists. It lives on Edit, where
     `parentOptions` still enforces target ▸ milestone ▸ task, so rollup, the
     timeline lanes and milestone progress are untouched — an item simply
     starts top level and is filed afterwards. */

  const save = () => {
    const r = createItem({
      title, assigneeId: who, kind: kind as "task" | "milestone" | "target",
      priority: pri as Priority,
      startDate: start || null, dueDate: due || null,
      description: desc.trim() || null,
      attachments: links, tagIds: tags,
      targetValue: kind === "target" && tv ? Number(tv) : undefined,
      targetUnit: kind === "target" ? tu || undefined : undefined,
    });
    if (!r.ok) { shell.toast(r.message, "bad"); return; }
    shell.closeLayer();
    shell.toast(r.data.title + " created");
    go(ROUTE + qs({ item: r.data.itemId }));
  };

  return (
    <>
      {/* The title lives in the header slot: it is the heading, so a second one
          above it would be the dialog naming itself twice. */}
      <div className="md-h tm-ni-h">
        <input className="tm-ni-t" autoFocus value={title} aria-label="Title"
          placeholder={"Add a " + labelOf(KIND, kind).toLowerCase()}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && title.trim()) save(); }} />
        <button className="btn icon sm md-x" aria-label="Close" onClick={() => shell.closeLayer()}>
          <Icon name="x" size="sm" />
        </button>
      </div>

      <div className="md-b tm-ni">
        <Tabs items={["task", "milestone", "target"].map((k) => ({ k, label: labelOf(KIND, k) }))}
          cur={kind} onPick={setKind} />

        {/* THE PANEL'S OWN FIELD, NOT A SECOND ONE. `.fg` puts a bold label over
            a full-width `.inp` with a real border, and it is what every other
            dialog here already looks like — Edit member, Send credentials, the
            leave form. Borderless controls under an icon column read as a
            settings list, not as a form: there was nothing to say where a field
            began, and nothing tying this dialog to the rest of the panel. */}
        <div className="fg">
          <label htmlFor="niStart">Starts</label>
          <input id="niStart" type="date" className="inp" value={start}
            onChange={(e) => setStart(e.target.value)} />
        </div>

        <div className="fg">
          <label htmlFor="niDue">Due</label>
          <input id="niDue" type="date" className="inp" value={due}
            onChange={(e) => setDue(e.target.value)} />
        </div>

        <div className="fg">
          <label htmlFor="niWho">Assigned to</label>
          <select id="niWho" className="inp" value={who} onChange={(e) => assign(e.target.value)}>
            {members.filter((m) => m.status === "active")
              .map((m) => <option key={m.memberId} value={m.memberId}>{m.name}</option>)}
          </select>
        </div>

        <div className="fg">
          <label htmlFor="niPri">Priority</label>
          <select id="niPri" className="inp" value={pri} onChange={(e) => setPri(e.target.value)}>
            {PRIORITY_SCALE.map((k) =>
              <option key={k} value={k}>{labelOf(PRIORITY, k)}</option>)}
          </select>
        </div>

        {kind === "target" ? (
          <>
            <div className="fg">
              <label htmlFor="niTv">Target</label>
              <input id="niTv" type="number" className="inp" value={tv} placeholder="60"
                onChange={(e) => setTv(e.target.value)} />
            </div>
            <div className="fg">
              <label htmlFor="niTu">Unit</label>
              <input id="niTu" className="inp" value={tu} placeholder="businesses"
                onChange={(e) => setTu(e.target.value)} />
            </div>
          </>
        ) : null}

        <div className="tm-ni-sep" />

        {/* DESCRIPTION — plain text with marks in it. The buttons write the
            marks so nobody has to know them; see RichText for why this is not
            a contentEditable. */}
        <div className="fg">
          <div className="tm-fgh">
            <label htmlFor="niDesc">Details</label>
            <MarkBar ta={ta} value={desc} set={setDesc} />
          </div>
          <textarea id="niDesc" ref={ta} className="inp tm-ni-ta" rows={3} value={desc}
            placeholder="What does done look like?"
            onChange={(e) => setDesc(e.target.value)} />
        </div>

        <div className="fg">
          <span className="fg-lb">Links</span>
          <LinkField links={links} onChange={setLinks} />
        </div>

        <div className="fg">
          <span className="fg-lb">Tags</span>
          <div className="tm-tagrow">
            {mine.map((t) => (
              <button key={t.tagId}
                className={"pill xs tm-tag tm-pick" + (tags.indexOf(t.tagId) >= 0 ? " on" : "")
                  + " tag-" + (t.colourToken || "slate")}
                aria-pressed={tags.indexOf(t.tagId) >= 0}
                onClick={() => setTags(tags.indexOf(t.tagId) >= 0
                  ? tags.filter((x) => x !== t.tagId) : tags.concat([t.tagId]))}>
                {t.label}
              </button>
            ))}
            {mine.length ? null : <span className="dim">None yet — the first one is a word away.</span>}
          </div>
          <NewTagField ownerId={who} onMade={(id) => setTags((v) => v.concat([id]))} />
        </div>

        <p className="tm-ni-note">It opens in Planning. Nothing sets Delay — the due date does.</p>
      </div>

      <div className="md-f">
        <span className="spacer" />
        <button className="btn" onClick={() => shell.closeLayer()}>Cancel</button>
        <button className="btn pri" disabled={!title.trim()} onClick={save}>Create</button>
      </div>
    </>
  );
}

/* ------------------------------------------------------------ calendar --- */

/** GOOGLE'S SHAPE, this module's data. A sidebar that opens with Create and a
 *  mini month, a date bar reading Today ‹ › over a large month name, and a flat
 *  seven-column grid whose cells are equal and whose TODAY is marked on the
 *  number — never as a wash over the whole square, which reads as a warning in
 *  a panel where a tinted row means something is wrong. */
function CalendarFace({ rows, me, p, goto, onOpen, members }: {
  rows: WorkItem[]; me: string; p: Record<string, string>;
  goto: (q: Record<string, string | undefined>) => void; onOpen: (id: string) => void;
  members: Member[];
}) {
  const shell = useShell();
  const mode = p.cal === "week" ? "week" : "month";
  const anchor = p.on || TODAY;
  const days = gridDays(anchor, mode);
  const month = anchor.slice(0, 7);
  const teamIds = membersInScope("team", me).map((m) => m.memberId);

  const move = (n: number) => goto({
    on: mode === "week" ? addDays(anchor, n * 7) : monthStep(anchor, n),
  });
  const create = (kind: string, date?: string) =>
    shell.modal(<NewItemModal kind={kind} members={members} date={date} />);

  return (
    <div className="tm-shell">
      <aside className="tm-rail">
        <Rail me={me} anchor={anchor} rows={rows} onCreate={(k) => create(k)} onOpen={onOpen} />
      </aside>
      <div className="tm-shell-b">
        {/* Everything that MOVES the calendar sits together at the right edge,
            over the grid it moves; the legend holds the left rather than
            leaving the row half empty. */}
        <div className="tm-calbar">
          <span className="spacer" />
          <button className="btn sm" onClick={() => goto({ on: undefined })}>Today</button>
          <button className="btn icon sm" aria-label="Previous" onClick={() => move(-1)}><Icon name="chevl" size="sm" /></button>
          <button className="btn icon sm" aria-label="Next" onClick={() => move(1)}><Icon name="chevr" size="sm" /></button>
          <h2 className="tm-calh">{monthLabel(anchor, mode)}</h2>
          <span className="btn-group">
            <button className={mode === "month" ? "on" : ""} onClick={() => goto({ cal: undefined })}>Month</button>
            <button className={mode === "week" ? "on" : ""} onClick={() => goto({ cal: "week" })}>Week</button>
          </span>
        </div>
        <div className={"tm-cal" + (mode === "week" ? " week" : "")}>
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="tm-cal-h">{d}</div>
          ))}
          {days.map((d) => {
            const evs = eventsOn(d, rows);
            const away = leaveOn(d, teamIds);
            /* THE CAP IS A HEIGHT, NOT A TASTE. A month row is 128px: the date
               takes 26, each chip 21, the "+n more" 18. Three chips fit with
               the overflow link still visible — four did not, which is why the
               last one was being sliced in half by the cell's own clip. The
               leave banner is a row like any other and counts against it. */
            const cap = Math.max(1, (mode === "week" ? 12 : 3) - (away.length ? 1 : 0));
            return (
              /* Clicking the EMPTY part of a day starts something on it — the
                 one Google gesture worth keeping. The test is the event target
                 being the cell itself, so a chip inside it still opens. */
              <div key={d} className={"tm-day"
                + (d.slice(0, 7) !== month && mode === "month" ? " out" : "")
                + (isWeekendDay(d) ? " we" : "")
                + (d === anchor && d !== TODAY ? " sel" : "")
                + (d === TODAY ? " today" : "")}
                onClick={(e) => { if (e.target === e.currentTarget) create("task", d); }}>
                <span className="tm-day-n">{Number(d.slice(8))}</span>
                {/* THE CELL'S CLICK IS A POINTER SHORTCUT, AND A SHORTCUT IS ALL
                    IT CAN BE: a div that only answers a mouse announces nothing
                    to a screen reader and cannot be reached by tab. The real
                    control is this button — named, focusable, and revealed by
                    focus as well as by hover, so the keyboard finds it exactly
                    where the pointer does. */}
                <button className="tm-day-add" aria-label={"Add on " + fmtDate(d)}
                  onClick={() => create("task", d)}>
                  <Icon name="plus" size="sm" />
                </button>
                {away.length ? (
                  <span className="tm-ev leave">{away.map((l) => nameOf(l.memberId)).join(", ")} on leave</span>
                ) : null}
                {evs.slice(0, cap).map((e) => <CalChip key={e.item.itemId + e.edge} ev={e} onOpen={onOpen} />)}
                {evs.length > cap ? (
                  <button className="tm-more" onClick={() => goto({ cal: "week", on: d })}
                    aria-label={evs.length - cap + " more on " + fmtDate(d) + " — open the week"}>
                    +{evs.length - cap} more
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="tm-calfoot">
          <span className="tm-legend">
            <i className="k-info" />stage
            <i className="k-warn" />delay
            <i className="k-bad" />waiting
          </span>
          <p className="tm-foot">
            A task of a week or less spans every day it covers; anything longer, and every milestone
            and target, is drawn twice — where it starts and where it is due.
          </p>
        </div>
      </div>
    </div>
  );
}

const nameOf = (id: string) => (readMember(id)?.name || id).split(" ").slice(-1)[0];

function monthLabel(d: string, mode: string) {
  if (mode === "week") return fmtDate(d) + " – " + fmtDate(addDays(d, 6));
  return fmtMonth(d, true);
}

function CalChip({ ev, onOpen }: { ev: CalEvent; onOpen: (id: string) => void }) {
  const i = ev.item;
  const st = stageOf(i);
  const wait = !!blockerOf(i);
  return (
    <button className={"tm-ev s-" + (wait && st === "delayed" ? "bad" : toneOf(WORK_STATUS, st) || "none")}
      onClick={() => onOpen(i.itemId)} title={i.title}>
      <KindMark kind={i.kind} />
      {ev.edge ? <em>{ev.edge === "starts" ? "starts" : "due"}</em> : null}
      {i.title}
    </button>
  );
}

/* ---------------------------------------------------------------- rail --- */

/** Create, this month's counts, then tasks ▸ milestones ▸ targets. It belongs
 *  to this face and no other.
 *
 *  NO MINI MONTH. It sat a second month grid immediately beside the first one,
 *  and the two answered the same question at two sizes — the big grid is
 *  already the date picker, and ‹ › on the bar is already the month step. */
function Rail({ me, anchor, rows, onCreate, onOpen }: {
  me: string; anchor: string; rows: WorkItem[];
  onCreate: (kind: string) => void; onOpen: (id: string) => void;
}) {
  const month = anchor.slice(0, 7);
  const inMonth = rows.filter((i) => {
    const a = i.startDate || i.dueDate, b = i.dueDate || i.startDate;
    return !!a && !!b && a.slice(0, 7) <= month && (b as string).slice(0, 7) >= month;
  });
  const t = workTotals(inMonth);

  return (
    <>
      {/* Create PINS; the blocks scroll under it. It is the control somebody
          reaches for at any scroll position, and a sidebar that scrolls its own
          Create button away has lost the plot. */}
      {/* Create PINS; the blocks scroll under it. It is the control somebody
          reaches for at any scroll position, and a sidebar that scrolls its own
          Create button away has lost the plot.

          TODAY'S PLAN PINS BESIDE IT, because the calendar is the default view
          now and the calendar hides the filter toolbar — which is where the
          note's button lives on the other two. Making the month the landing
          screen would otherwise have stranded the one control you are meant to
          reach before the day starts. */}
      <div className="tm-rail-t">
        <CreateMenu big onPick={onCreate} />
        <TodayPlanMenu />
      </div>

      <div className="tm-rail-b">
        <section className="tm-blk">
          <header><b>{fmtMonth(anchor)}</b><span className="tm-blk-c">{inMonth.length} dated</span></header>
          <span className="tm-stack">
            <i className="k-ok" style={{ width: pct(t.completed, inMonth.length) }} />
            <i className="k-info" style={{ width: pct(t.inProgress + t.planned, inMonth.length) }} />
            <i className="k-warn" style={{ width: pct(t.delayed, inMonth.length) }} />
          </span>
          <p className="tm-blk-m">
            <span className="u-ok-t">{t.completed} done</span>
            <span>{t.inProgress + t.planned} open</span>
            <span className="u-warn-t">{t.delayed} in delay</span>
          </p>
        </section>

        {/* Capped here and nowhere else: the rail is 248px that also has to
            hold milestones and targets, while the member page and Reports have
            a column to themselves and show the lot. */}
        <TasksBlock who={me} onOpen={onOpen} limit={6} />
        <MarksBlock kind="milestone" who={me} onOpen={onOpen} compact />
        {/* ONE target. It is the number the quarter is judged on, and a column
            of four of them is a list, not an indicator. */}
        <MarksBlock kind="target" who={me} onOpen={onOpen} compact limit={1} />
      </div>
    </>
  );
}

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) + "%" : "0%");

/* --------------------------------------------------------------- board --- */

function Board({ rows, all, group, goto, onOpen }: {
  rows: WorkItem[]; all: WorkItem[]; group: string;
  goto: (q: Record<string, string | undefined>) => void; onOpen: (id: string) => void;
}) {
  const cols = columnsFor(rows, group);
  return (
    <>
      <div className="tm-groupbar">
        <label htmlFor="tmGroup">Group by</label>
        <select id="tmGroup" className="inp sm" value={group}
          onChange={(e) => goto({ group: e.target.value || undefined })}>
          {GROUPS.map((g) => <option key={g.v} value={g.v}>{g.l}</option>)}
        </select>
        <span className="spacer" />
        <span className="tm-groupnote">
          {group
            ? "A grouping, not a workflow — a drag here would mean a reassignment, which needs a reason."
            : "Open an item to move it between stages. Delay is never set by hand — the due date sets it."}
        </span>
      </div>
      <div className="tm-boardwrap">
        <div className="tm-board">
          {cols.map((c) => (
            <section key={c.key} className={"tm-col tm-col-" + c.key}>
              <header><b>{c.label}</b><span className="tnum">{c.list.length}</span></header>
              <div className="tm-col-b">
                {c.list.length
                  ? c.list.map((i) => <Card key={i.itemId} item={i} all={all} onOpen={onOpen} />)
                  : <p className="tm-col-e">Nothing here.</p>}
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}

/** The last column is never hidden. A grouping that silently drops its
 *  ungrouped rows is a board that lies about its own count. */
function columnsFor(rows: WorkItem[], group: string) {
  const cols: { key: string; label: string; list: WorkItem[] }[] = [];
  const rest: WorkItem[] = [];
  if (!group) {
    STAGES.forEach((s) => cols.push({ key: s, label: labelOf(WORK_STATUS, s), list: rows.filter((i) => stageOf(i) === s) }));
    return cols;
  }
  const seen: Record<string, { key: string; label: string; list: WorkItem[] }> = {};
  const put = (key: string, label: string, i: WorkItem) => {
    if (!seen[key]) { seen[key] = { key, label, list: [] }; cols.push(seen[key]); }
    seen[key].list.push(i);
  };
  rows.forEach((i) => {
    if (group === "kind") put(i.kind, labelOf(KIND, i.kind), i);
    else if (group === "assignee") put(i.assigneeId, readMember(i.assigneeId)?.name || i.assigneeId, i);
    else if (group === "priority") put(i.priority, labelOf(PRIORITY, i.priority), i);
    else {
      const ts = tagsOf(i);
      if (!ts.length) rest.push(i);
      else ts.forEach((t) => put(t.slug, t.label, i));
    }
  });
  cols.sort((a, b) => a.label.localeCompare(b.label));
  cols.push({ key: "_rest", label: group === "tag" ? "Untagged" : "Ungrouped", list: rest });
  return cols;
}

function Card({ item, all, onOpen }: { item: WorkItem; all: WorkItem[]; onOpen: (id: string) => void }) {
  const m = readMember(item.assigneeId);
  const parent = parentOf(item, all);
  const late = isDelayed(item);
  return (
    <button className={"tm-card" + (late ? " late" : "") + (item.status === "cancelled" ? " dead" : "")}
      onClick={() => onOpen(item.itemId)}>
      <span className="tm-card-t"><KindMark kind={item.kind} /><b>{item.title}</b></span>
      <span className="tm-card-m">
        {m ? <span className="tm-card-who">{m.name}</span> : null}
        <PriorityChip p={item.priority} />
        {late ? <span className="pill warn xs">{ago(item.dueDate, TODAY)}</span> : null}
        <WaitFlag item={item} />
        <TagChips item={item} />
      </span>
      {parent ? (
        <span className="tm-card-p" title={"Rolls up to " + parent.title}>
          <KindMark kind={parent.kind} />{parent.title}
        </span>
      ) : null}
      {item.kind !== "task" ? <ProgressWindow item={item} /> : null}
    </button>
  );
}

/* ------------------------------------------------------------ timeline --- */

/** Lanes are the work, never the worker. A lane per person is a productivity
 *  chart this module has no estimate field to justify. */
function Timeline({ rows, onOpen }: { rows: WorkItem[]; onOpen: (id: string) => void }) {
  const [weeks, setWeeks] = useState(2);
  const [from, setFrom] = useState(() => addDays(TODAY, -((new Date(TODAY).getDay() + 6) % 7) - 7));
  const days: string[] = [];
  for (let i = 0; i < weeks * 7; i++) days.push(addDays(from, i));
  const lanes = lanesOf(rows);
  const undated = rows.filter((i) => !i.startDate && !isTerminal(i.status));
  const span = (a: string, b: string) => {
    const s = days.indexOf(a) >= 0 ? days.indexOf(a) : (a < days[0] ? 0 : -1);
    const e = days.indexOf(b) >= 0 ? days.indexOf(b) : (b > days[days.length - 1] ? days.length - 1 : -1);
    if (s < 0 || e < 0 || e < s) return null;
    return { left: (s / days.length) * 100 + "%", width: ((e - s + 1) / days.length) * 100 + "%" };
  };

  return (
    <div className="tm-tl">
      <div className="tm-calbar">
        <button className="btn icon sm" aria-label="Previous" onClick={() => setFrom(addDays(from, -7 * weeks))}><Icon name="chevl" size="sm" /></button>
        <b>{fmtDate(days[0])} – {fmtDate(days[days.length - 1])}</b>
        <button className="btn icon sm" aria-label="Next" onClick={() => setFrom(addDays(from, 7 * weeks))}><Icon name="chevr" size="sm" /></button>
        <span className="btn-group">
          {[2, 4, 13].map((w) => (
            <button key={w} className={weeks === w ? "on" : ""} onClick={() => setWeeks(w)}>
              {w === 13 ? "Quarter" : w + "w"}
            </button>
          ))}
        </span>
        <span className="spacer" />
        <span className="tm-legend"><i className="k-none" />dashed = the lane's own window</span>
      </div>

      <div className="tm-tl-head">
        <span className="tm-tl-lane">Target · milestone</span>
        <span className="tm-tl-grid">
          {days.map((d) => (
            <i key={d} className={isWeekendDay(d) ? "we" : ""}>{Number(d.slice(8))}</i>
          ))}
        </span>
      </div>

      {lanes.map((ln, n) => {
        const host = ln.item;
        const bars: { i: WorkItem; win: boolean }[] = [];
        if (host && host.startDate) bars.push({ i: host, win: true });
        ln.tasks.filter((i) => i.startDate).forEach((i) => bars.push({ i, win: false }));
        return (
          <div key={host ? host.itemId : "none" + n} className="tm-tl-row">
            <span className={"tm-tl-lane" + (ln.sub ? " sub" : "")}>
              {host ? (
                <>
                  <b><KindMark kind={host.kind} />{host.title}</b>
                  <span className="cell-2">{labelOf(KIND, host.kind)} · {noteOf(host)}{host.dueDate ? " · due " + fmtDate(host.dueDate) : ""}</span>
                </>
              ) : (
                <>
                  <b>No milestone</b>
                  <span className="cell-2">{ln.tasks.length} tasks hang off nothing</span>
                </>
              )}
            </span>
            <span className="tm-tl-grid">
              {days.map((d) => <i key={d} className={isWeekendDay(d) ? "we" : ""} />)}
              {bars.map((b, k) => {
                const s = span(b.i.startDate as string, (b.i.dueDate || b.i.startDate) as string);
                if (!s) return null;
                const st = stageOf(b.i);
                return (
                  <button key={b.i.itemId + k} title={b.i.title}
                    className={"tm-tlbar t-" + (toneOf(WORK_STATUS, st) || "none") + (b.win ? " win" : "")}
                    style={{ left: s.left, width: s.width, top: 6 + k * 22 }}
                    onClick={() => onOpen(b.i.itemId)}>
                    {b.win ? null : <span className="tm-tlbar-w">{nameOf(b.i.assigneeId)} · </span>}
                    {b.i.title}
                  </button>
                );
              })}
            </span>
          </div>
        );
      })}

      <p className="tm-foot">
        {undated.length
          ? undated.length + " open items have no start date and cannot be drawn: "
            + undated.map((i) => i.title).join(" · ")
          : "Every open item has a start date."}
      </p>
    </div>
  );
}

const isWeekendDay = (d: string) => {
  const n = new Date(d + "T00:00:00").getDay();
  return n === 0 || n === 6;
};

/* ----------------------------------------------------------------- list --- */

function List({ rows, all, onOpen }: { rows: WorkItem[]; all: WorkItem[]; onOpen: (id: string) => void }) {
  return (
    /* 920, NOT 1100. Content width is the viewport less the nav and the
       gutters — about 990px on a 1280px laptop — so a 1100px floor put this
       one list into permanent sideways scrolling and squeezed the title, the
       only column anybody reads, into the narrowest thing on the row. Two
       columns paid for it: "Rolls up to" moved under the title, where the
       board card already keeps it, and it was 190px of a fact ABOUT a row
       rather than a value worth scanning a column of. */
    <div className="tm-list">
    <Table list
      scroll min="920px"
      cols={[
        { label: "", w: "3px" },
        /* PERCENTAGES, NOT PIXELS, FOR EVERY COLUMN BUT THE RAIL. Item was the
           only one without a width, so it absorbed the whole surplus: at 1900px
           the title ended around 340 and Progress began around 1200, with a
           long empty track between. Capping the table fixed the track and left
           a blank slab down the right instead — the same problem moved. Shares
           spread the surplus across all six, so the table fills the glass and
           no single column collects the slack. */
        { label: "Item", w: "32%" },
        /* PROGRESS SITS BESIDE THE THING IT IS ABOUT. Last in the row it was
           the far end of a 920px scan from the title, and 120px is a track
           barely wider than the "100%" beside it — the bar had ~50px to draw a
           fill AND the today marker in, which is not a reading. It is second
           now, at 180px, so the two facts everybody opens this list for — what
           it is and how far along it is — are read together.

           MEMBER MOVED TO THE END for the same reason, from the other side: it
           is who to ask, not what to scan, and it was standing between the
           title and every fact about the work. */
        { label: "Progress", w: "14%" },
        { label: "Stage", w: "12%" },
        { label: "Priority", w: "10%" },
        { label: "Due", w: "13%" },
        { label: "Member", w: "18%" },
      ]}
      empty={{ icon: "check", title: "No work matches", body: "Clear the filters, or create the first item." }}
      rows={rows.map((i) => {
        const m = readMember(i.assigneeId);
        const parent = parentOf(i, all);
        const late = isDelayed(i);
        const rail = late && blockerOf(i) ? "u-bad" : late ? "u-warn" : "";
        /* A TASK HAS A REAL PERCENTAGE NOW. This column printed a dash for
           every `task`, which is most rows — the rule predates the checklist,
           and `progressOf` has read ticked lines over total ever since. The
           dash is kept for the one case that still has nothing to say: an open
           task with no steps on it. */
        const bare = i.kind === "task" && !checkCount(i).total && i.status !== "completed";
        return (
          <tr key={i.itemId} className={"clickable " + rail + (i.status === "cancelled" ? " dim" : "")}
            tabIndex={0} role="link"
            onClick={() => onOpen(i.itemId)}
            onKeyDown={(e) => { if (e.key === "Enter") onOpen(i.itemId); }}>
            <td className="rail"><i className={rail} /></td>
            <td>
              <span className="tm-title"><KindMark kind={i.kind} /><b>{i.title}</b></span>
              <span className="cell-2">
                {parent ? (
                  <span className="tm-parent"><KindMark kind={parent.kind} />{parent.title}</span>
                ) : null}
                <TagChips item={i} /><WaitFlag item={i} />
              </span>
            </td>
            {/* THE NUMBER LEADS AND THE BAR SITS UNDER IT. A column of bars
                is a column of shapes you have to compare against each other
                to read; a column of tabular percentages is one you read
                straight down, and the bar is then the shape confirming it. */}
            <td>{bare ? <span className="dim">—</span> : (
              <span className="tml-prog">
                <b className="tnum">{progressOf(i) ?? 0}%</b>
                <ProgressWindow item={i} bare />
              </span>
            )}</td>
            {/* THE STATUS IS CHANGED WHERE IT IS READ. It was a read-only
                pill, and moving a task meant opening the panel to reach five
                buttons in its footer — for the one field people touch most,
                on the screen that already lists it. Same control as the
                panel's, and it stops the click reaching the row so changing a
                status does not also open the drawer behind the menu. */}
            <td><StatusPicker item={i} sm /></td>
            {/* STAGE IS FILLED, PRIORITY IS OUTLINED. Delay and High are both
                warn-toned, so as two filled pills side by side they were the
                same amber object twice, a column apart, meaning two unrelated
                things. Same palette, different weight: the stage is what the
                row IS, the priority only modifies it. */}
            <td className="tml-pri"><PriorityChip p={i.priority} /></td>
            {/* `tm-due`, because `.cell-2` is an inline span: the date and the
                "8 days ago" under it ran together into "27 Aug 20268 days ago"
                here for the same reason they did in the drawer. */}
            <td className="tnum tm-due">
              {i.dueDate ? fmtDate(i.dueDate) : "—"}
              {i.dueDate ? <span className="cell-2">{ago(i.dueDate, TODAY)}</span> : null}
            </td>
            <td>{m ? <Who m={m} /> : <span className="dim">—</span>}</td>
          </tr>
        );
      })}
    />
    </div>
  );
}
