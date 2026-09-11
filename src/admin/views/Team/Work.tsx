/* =============================================================================
   Tasks — #/work
   -----------------------------------------------------------------------------
     #/work                     the calendar face, which is what the row opens on
     #/work?face=list           the same rows as a table
     #/work?face=board          the board, columns are the five stages
     #/work?face=board&group=…  the column axis is a choice: stage · kind ·
                                assignee · priority · tag
     #/work?face=timeline       target ▸ milestone lanes, tasks as bars
     #/work?face=analysis       how the work is going, and where it is stuck
     #/work?item=W-K04          one item, in a drawer over whichever face is open

   FIVE FACES IN ONE TAB ROW. They were three faces and a hidden view switcher
   in the topbar, so getting from the board to the timeline meant two different
   controls in two different places to answer one question. Every old link still
   resolves: `?face=list|board|calendar` and `?face=tasks&view=…` both land on
   the face they meant (see `readTab`).

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
import { ChevronDown } from "@untitledui/icons";
import { Dropdown } from "@/components/base/dropdown/dropdown";
import { TextAreaBase } from "@/components/base/textarea/textarea";
import { cx } from "@/utils/cx";
import { usePageChrome } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import {
  Alert, Button, Card, ChartFrame, DateInput, EmptyState, FieldRow, FilterBar, FilterChips,
  FormField, Icon, IconButton, Input, ListTable, ModalShell, PageHeader, Pill, Rail,
  SearchField, Segmented, Select, SelectInput, StatStrip, Tabs, TbTitle, Tiles,
  cap, qs, tagClasses,
} from "../../ui";
import type { StatCell } from "../../ui";
import { BarRows, ColumnChart } from "../charts";
import { go } from "../../ui/nav";
import {
  KIND, PRIORITY, PRIORITY_SCALE, TODAY, WORK_STATUS, addDays,
  blockerOf, checkCount, createItem, createTag, eventsOn, fmtDate, fmtMonth, gridDays,
  isDelayed, isTerminal, isWeekend, labelOf, lanesOf, leaveOn, meId, membersInScope, monthStep,
  normaliseUrl, parentOf, progressOf, readMember, scopeLabel, stageOf, tagsOf, tagsOwnedBy,
  toneOf, useItem, useMembers, useTags, useWork, workTotals,
} from "./store";
import type {
  Attachment, CalEvent, Member, Priority, Tag, WorkItem, WorkStage,
} from "./store";
import { ensureAdopted } from "./adopt";
import { MarkBar } from "./marks";
import { ItemDrawer } from "./Detail";
import { StatusPicker } from "./status";
import { TodayPlanMenu } from "./TodayPlan";
import { KindMark, TagTypePicker, Who } from "./bits";
import {
  CalCell, CalChip, CalHead, KindTag, LaneBar, MarksBlock, PriorityCell, ProgressWindow,
  StageColumn, TagChips, TaskCard, TasksBlock, WaitFlag, ago, noteOf,
} from "./workBits";

const ROUTE = "#/work";

/* THE OLD FACE FAMILY, kept because `FaceSwitch`/`FaceMenu` are exported and
   still take `{face, view}`: `tasks` holds the three shapes of "what work is
   there", the other two are different questions. The tab row below flattens
   them into the five destinations, which is what a reader is actually
   choosing between. */
const FACES = [
  { k: "tasks", l: "Tasks", i: "check", d: "Everything there is, as a list, a board or a month" },
  { k: "timeline", l: "Timeline", i: "timeline", d: "Target and milestone lanes, tasks as bars" },
  { k: "analysis", l: "Analysis", i: "chart", d: "How the work is going, and where it is stuck" },
];
const VIEWS = [
  { k: "list", l: "List", i: "list", d: "Every item as a row, with its progress" },
  { k: "board", l: "Board", i: "kanban", d: "Columns by stage, or by whatever you group on" },
  { k: "calendar", l: "Calendar", i: "calendar", d: "The month, and what falls on each day" },
];

/** CALENDAR IS WHAT `#/work` OPENS ON. The month is the shape most of this
 *  module's questions are actually asked in — what is due, what is late, what
 *  is coming — and it is the only face that answers them without being read row
 *  by row. Named once, because the default is two facts that must agree: which
 *  face a bare URL resolves to, and which face writes a bare URL. */
const DEFAULT_VIEW = "calendar";

/** The five destinations, in the order somebody reads them: the three shapes of
 *  the same set first, then the two other questions. */
const TABS = [
  { k: "list", l: "List", i: "list" },
  { k: "board", l: "Board", i: "kanban" },
  { k: "calendar", l: "Calendar", i: "calendar" },
  { k: "timeline", l: "Timeline", i: "timeline" },
  { k: "analysis", l: "Analysis", i: "chart" },
];

/** WHICH OF THE FIVE, from a URL written in any of the three spellings this
 *  page has used. `?face=board`, `?face=tasks&view=board` and `?view=board` all
 *  land on the board; a bare URL lands on the calendar. */
function readTab(p: Record<string, string>): string {
  const raw = p.face || "";
  if (raw === "timeline" || raw === "analysis") return raw;
  if (VIEWS.some((v) => v.k === raw)) return raw;
  return VIEWS.some((v) => v.k === p.view) ? p.view : DEFAULT_VIEW;
}
/** What a tab writes. The default face writes a bare URL so the row's own link
 *  and the tab agree about what "no parameters" means. */
const tabPatch = (k: string): Record<string, string | undefined> =>
  k === DEFAULT_VIEW ? { face: undefined, view: undefined } : { face: k, view: undefined };

/** Lifecycle order, not the order the five were listed in: Delay is work that
 *  is not finished, so it sits before the two terminal columns. */
const STAGES: WorkStage[] = ["planned", "in_progress", "delayed", "completed", "cancelled"];
/** The params that put a chip in the band. */
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

  const tab = readTab(p);
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

  const onFilter = (name: string, value: string) => {
    if (name === "*") {
      const cleared: Record<string, string | undefined> = {};
      FILTERS.forEach((k) => { cleared[k] = undefined; });
      goto(cleared);
      return;
    }
    goto({ [name]: value || undefined });
  };
  const openItem = useCallback((id: string) => goto({ item: id }), [goto]);

  usePageChrome({ crumbs: <TbTitle label="Tasks" to="#/work" /> }, tab);

  /* THE DRAWER IS THE RECORD AND THE URL SAYS WHICH ONE, so this effect has to
     run in BOTH directions. Opening was never the broken half: `if (!open)
     return` meant Back dropped `?item=` and left the drawer sitting over a list
     that had already moved on, because nothing else in this app closes a layer
     on navigation.

     THE DEPENDENCIES WERE THE OTHER HALF. `all` is a fresh array from
     `workRows()` on every render and `shell` is rebuilt every time the layer
     changes — so an effect that pushed a layer and then listed both re-ran
     because of what it had just done, pushed again, and looped until React gave
     up. What this effect watches is WHICH RECORD IS OPEN and nothing else:
     `openId` is a string, and `openDrawer`/`closeLayer` are the shell's two
     dependency-free callbacks. */
  const gotoRef = useRef(goto);
  useEffect(() => { gotoRef.current = goto; }, [goto]);

  /* Ours, so a modal somebody else opened is never closed from here. */
  const ownsDrawer = useRef(false);
  const shownId = useRef<string | null>(null);
  const openId = open ? open.itemId : null;
  /* THE SHELL HOLDS ONE LAYER. A modal the drawer opens — a reason, a link, an
     edit — REPLACES the drawer, and when that modal closes the slot is empty
     while the URL still names the record. So this watches the slot as well as
     the id. */
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

  const t = workTotals(rows);
  const narrowed = FILTERS.some((k) => p[k]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Tasks"
        meta={
          <>
            <span className="font-medium text-secondary tnum">{rows.length} in view</span>
            {t.delayed ? <span className="text-warning-primary tnum">{t.delayed} in delay</span> : null}
            <span>{scopeLabel("all", all.length)}</span>
          </>
        }
        actions={
          <>
            {/* THE DAY BEFORE THE WORK. It sits left of the primary because it
                is the thing you do first, and because one primary per view
                keeps the end of the row. */}
            <TodayPlanMenu />
            <CreateMenu onPick={(k) => shell.modal(<NewItemModal kind={k} members={members} />, "lg")} />
          </>
        }
        tabs={
          <Tabs cur={tab} items={TABS.map((x) => ({ k: x.k, label: x.l, icon: x.i }))}
            onPick={(k) => goto(tabPatch(k))} />
        }
      />

      <WorkStats p={p} />

      <FilterBar
        search={<SearchField ph="Search work" name="q" val={p.q} onFilter={onFilter} />}
        filters={
          <>
            <Select name="member" label="Member" value={p.member} onFilter={onFilter}
              options={members.filter((m) => m.status === "active").map((m) => ({ v: m.memberId, l: m.name }))} />
            <Select name="kind" label="Kind" value={p.kind} onFilter={onFilter}
              options={[{ v: "task", l: "Tasks" }, { v: "milestone", l: "Milestones" }, { v: "target", l: "Targets" }]} />
            <Select name="tag" label="Tag" value={p.tag} onFilter={onFilter} options={slugOptions(tags)} />
            <Select name="priority" label="Priority" value={p.priority} onFilter={onFilter}
              options={PRIORITY_SCALE.map((k) => ({ v: k, l: labelOf(PRIORITY, k) }))} />
          </>
        }
        right={
          tab === "board" ? (
            <Select name="group" label="Group by" value={p.group} allLabel="Stage"
              onFilter={(n, v) => goto({ [n]: v || undefined })}
              options={GROUPS.filter((g) => g.v).map((g) => ({ v: g.v, l: g.l }))} />
          ) : null
        }
        chips={
          narrowed ? (
            <FilterChips
              params={{
                q: p.q, kind: p.kind, priority: p.priority, due: p.due, tag: p.tag,
                member: p.member ? (readMember(p.member)?.name || p.member) : undefined,
                status: p.status ? labelOf(WORK_STATUS, p.status) : undefined,
                parent: p.parent ? "within " + p.parent : undefined,
                wait: p.wait ? "waiting" : undefined,
              }}
              onUnfilter={(n) => onFilter(n, "")} />
          ) : null
        }
      />

      {tab === "timeline" ? <TimelineFace rows={rows} onOpen={openItem} />
        : tab === "analysis" ? <Analysis rows={rows} all={all} members={members} />
          : tab === "calendar" ? <CalendarFace rows={rows} me={me} p={p} goto={goto} onOpen={openItem} members={members} />
            : tab === "board" ? <Board rows={rows} all={all} group={p.group || ""} onOpen={openItem} />
              : <List rows={rows} all={all} onOpen={openItem} narrowed={narrowed} onClear={() => onFilter("*", "")} />}
    </div>
  );
}

const slugOptions = (tags: Tag[]) => {
  const seen: Record<string, string> = {};
  tags.filter((t) => !t.archivedAt).forEach((t) => { seen[t.slug] = t.label; });
  return Object.keys(seen).sort().map((s) => ({ v: s, l: seen[s] }));
};

/** EVERY COUNT IS THE FILTER FOR ITSELF, and pressing the one you are already
 *  on clears it — so the strip is never a trap you have to leave by the chip
 *  row. Stage and waiting are one axis here: they are two answers to "what
 *  state is this in", and a strip that could hold both at once would show two
 *  cells lit for one list.
 *
 *  It reads the store ITSELF rather than taking totals as a prop, minus the one
 *  dimension it filters on: scoping the counts by `status` would zero every
 *  other cell the moment one was pressed. */
function WorkStats({ p }: { p: Record<string, string> }) {
  const sansStatus = { ...p };
  delete sansStatus.status;
  const t = workTotals(useWork(sansStatus, "all"));

  const route = (key?: string, val?: string) => {
    const next: Record<string, string> = { ...p };
    delete next.status; delete next.wait;
    if (key && val) next[key] = val;
    return ROUTE + qs(next);
  };
  const stage = (k: string, v: number, st: string, dot: string): StatCell => ({
    k, v, dot, on: p.status === st,
    to: p.status === st ? route() : route("status", st),
  });

  const cells: (StatCell | "sep")[] = [
    { k: "items", v: t.total, on: !p.status && !p.wait, to: route() },
    "sep",
    stage("in progress", t.inProgress, "in_progress", "info"),
    stage("planning", t.planned, "planned", "neutral"),
    stage("in delay", t.delayed, "delayed", t.delayed ? "warn" : "neutral"),
    {
      k: "waiting", v: t.waiting, dot: t.waiting ? "bad" : "neutral",
      on: !!p.wait, to: p.wait ? route() : route("wait", "1"),
    },
    stage("complete", t.completed, "completed", "ok"),
  ];
  return <StatStrip cells={cells} />;
}

/* ------------------------------------------------------------- switcher --- */

/** KEPT FOR ITS CALLERS. The five faces are a tab row on the page now, so this
 *  page does not render it; the export and its props are unchanged so anything
 *  that puts a face switcher in a topbar still compiles and still works. It is
 *  the library Dropdown rather than a hand-positioned popup — portalled,
 *  keyboard-complete, dismissed by the library. */
export function FaceSwitch({ face, view, goto }: {
  face: string; view: string; goto: (q: Record<string, string | undefined>) => void;
}) {
  const cur = face === "tasks"
    ? (VIEWS.filter((v) => v.k === view)[0] || VIEWS[0])
    : (FACES.filter((f) => f.k === face)[0] || FACES[0]);
  return (
    <Dropdown.Root>
      <Button color="secondary" ico={cur.i} iconTrailing={ChevronDown} aria-haspopup="menu">
        {cur.l}
      </Button>
      <Dropdown.Popover placement="bottom right" className="w-max min-w-64">
        <FaceMenu face={face} view={view} goto={goto} />
      </Dropdown.Popover>
    </Dropdown.Root>
  );
}

/** EVERY DESTINATION, IN ONE MENU, IN TWO GROUPS — the first three are three
 *  SHAPES of the same question, the last two are different questions. */
export function FaceMenu({ face, view, goto }: {
  face: string; view: string; goto: (q: Record<string, string | undefined>) => void;
}) {
  const row = (o: { k: string; l: string; i: string; d: string }, on: boolean, patch: Record<string, string | undefined>) => (
    <Dropdown.Item key={o.k} id={o.k} icon={() => <Icon name={o.i} size="sm" data-icon className="mr-2 text-fg-quaternary" />}
      onAction={() => goto(patch)} textValue={o.l}>
      <span className="flex min-w-0 flex-col">
        <span className="flex items-center gap-1.5 truncate font-semibold text-secondary">
          {o.l}
          {on ? <Icon name="check" size="xs" className="text-fg-brand-primary" /> : null}
        </span>
        <span className="truncate text-xs font-normal text-tertiary">{o.d}</span>
      </span>
    </Dropdown.Item>
  );
  return (
    <Dropdown.Menu aria-label="Change the face">
      <Dropdown.Section>
        <Dropdown.SectionHeader className="label-mono px-4 pt-2 pb-1">The work, three ways</Dropdown.SectionHeader>
        {VIEWS.map((v) => row(v, face === "tasks" && v.k === view, tabPatch(v.k)))}
      </Dropdown.Section>
      <Dropdown.Separator />
      <Dropdown.Section>
        <Dropdown.SectionHeader className="label-mono px-4 pt-2 pb-1">Other questions</Dropdown.SectionHeader>
        {FACES.filter((f) => f.k !== "tasks").map((f) => row(f, f.k === face, tabPatch(f.k)))}
      </Dropdown.Section>
    </Dropdown.Menu>
  );
}

/* ------------------------------------------------------------ analysis --- */

/** HOW THE WORK IS GOING, AND WHERE IT IS STUCK — in that order, because the
 *  second is the reason anybody opens this.
 *
 *  IT READS THE ROWS ON SCREEN, not the whole table. Every filter above it
 *  applies, so "Analysis" of one member's marketing tasks is the same questions
 *  asked of a smaller set rather than a different screen. A chart that ignored
 *  the filter band would be a chart nobody could trust against the list beside
 *  it. */
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
    /* The chart kit's own reserved status tones, not the pill vocabulary — they
       are different scales and mixing them is how a chart ends up colouring a
       stage with a hue that means something else. */
    tone: st === "delayed" ? "st-bad" : st === "completed" ? "st-ok" : "st-mute",
  })).filter((r) => r.value > 0);

  /* AN ORDINAL SCALE, DRAWN AS ONE. Priority is ranked, so it takes the kit's
     ordinal steps rather than four unrelated hues — the reader should be able
     to see the order without reading the labels. */
  const byPriority = PRIORITY_SCALE.map((k, n) => ({
    key: k,
    label: labelOf(PRIORITY, k),
    value: open.filter((i) => i.priority === k).length,
    tone: n === 0 ? "st-bad" : n === 1 ? "o1" : n === 2 ? "o2" : "o3",
  })).filter((r) => r.value > 0);

  /* WHO IS CARRYING WHAT — open items only, because a person's finished work is
     not load. Sorted by what is late rather than by volume: eight on time is a
     working week and two overdue is a conversation. */
  const byMember = members
    .map((m) => {
      const mine = open.filter((i) => i.assigneeId === m.memberId);
      return { m, open: mine.length, late: mine.filter((i) => isDelayed(i)).length };
    })
    .filter((r) => r.open > 0)
    .sort((a, b) => (b.late - a.late) || (b.open - a.open));

  /* A checklist is the only place a task says how far in it is, so the tasks
     that HAVE one are worth reading apart from the ones that do not. */
  const withList = tasks.filter((i) => (i.checklist || []).length);
  const lineTotal = withList.reduce((a, i) => a + checkCount(i).total, 0);
  const lineDone = withList.reduce((a, i) => a + checkCount(i).done, 0);

  if (!rows.length) {
    return (
      <EmptyState icon="chart" title="Nothing to analyse"
        body="No item matches the filters above. Clear one and the numbers come back." />
    );
  }

  return (
    <>
      <Tiles list={[
        { k: "Open", v: open.length, s: rows.length + " in view" },
        { k: "In delay", v: late.length, tone: late.length ? "bad" : "", s: "past their own due date" },
        { k: "Waiting", v: blocked.length, tone: blocked.length ? "warn" : "", s: "blocked on another item" },
        { k: "Finished", v: rate === null ? "—" : rate + "%", s: "of everything not cancelled" },
      ]} />

      {late.length ? (
        <Alert tone="bad" title={late.length + (late.length === 1 ? " item is" : " items are") + " past due."}>
          Delay is derived from the date, not stored — nothing swept overnight to decide this, and
          it stops being true the moment the date or the status moves.
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartFrame title="Where the work is" note="Every item in view, by the stage it is actually in.">
          <BarRows rows={byStage} unit="" />
        </ChartFrame>

        <ChartFrame title="What is open, by priority" note="Finished work carries no urgency, so it is not counted here.">
          {byPriority.length
            ? <BarRows rows={byPriority} unit="" />
            : <EmptyState flat icon="check" title="Nothing is open" body="" />}
        </ChartFrame>
      </div>

      <ChartFrame title="Who is carrying what"
        note="Open items only, ordered by what is late — eight on time is a working week, two overdue is a conversation.">
        {byMember.length ? (
          <ColumnChart unit="open items" height={220}
            series={[{ key: "ok", label: "On time", slot: 1 }, { key: "late", label: "In delay", slot: 3 }]}
            points={byMember.map((r) => ({
              key: r.m.memberId,
              label: r.m.name.split(" ").slice(-1)[0],
              values: { ok: r.open - r.late, late: r.late },
            }))} />
        ) : (
          <EmptyState flat icon="users" title="Nobody has anything open in this view" body="" />
        )}
      </ChartFrame>

      <Card title="Steps ticked off" tight flush
        sub="Only the tasks that carry a checklist — the rest have no way to say how far in they are."
        right={withList.length
          ? <Pill tone={lineDone === lineTotal ? "ok" : "neutral"} text={lineDone + " of " + lineTotal + " steps"} />
          : undefined}>
        {withList.length ? (
          <ListTable className="rounded-t-none ring-0" min="620px"
            head={<tr><th>Task</th><th className="n">Steps</th><th>Progress</th></tr>}>
            {withList
              .slice()
              .sort((a, b) => (progressOf(a) || 0) - (progressOf(b) || 0))
              .map((i) => {
                const c = checkCount(i);
                return (
                  <tr key={i.itemId}>
                    <td className="cell-1">
                      {i.title}
                      <span className="cell-2 block">{labelOf(WORK_STATUS, i.status)}</span>
                    </td>
                    <td className="n">{c.done} of {c.total}</td>
                    <td className="w-52"><ProgressWindow item={i} /></td>
                  </tr>
                );
              })}
          </ListTable>
        ) : (
          <p className="p-5 text-sm text-tertiary">
            No task in view has a checklist. Add steps to one and its progress stops being a choice
            between nothing and everything.
          </p>
        )}
      </Card>
    </>
  );
}

/* -------------------------------------------------------------- create --- */

/** One control, three kinds. All three open the same form with `kind`
 *  prefilled — they are one WorkItem with a kind, and a target only adds two
 *  fields to it. Three buttons become three forms, then three lists.
 *
 *  IT USED TO OPEN IN THE CORNER OF THE WINDOW: a fixed popup that measured its
 *  own button, listened for scroll, resize, Escape and an outside press by
 *  hand, and got the arithmetic wrong. The library's Dropdown does all of it,
 *  portals out of any scrolling container and is keyboard-complete. */
function CreateMenu({ onPick }: { onPick: (k: string) => void }) {
  return (
    <Dropdown.Root>
      <Button color="primary" ico="plus" iconTrailing={ChevronDown} aria-haspopup="menu">
        New task
      </Button>
      <Dropdown.Popover placement="bottom right" className="w-max min-w-44">
        <Dropdown.Menu aria-label="Create">
          {["task", "milestone", "target"].map((k) => (
            <Dropdown.Item key={k} id={k} label={labelOf(KIND, k)} onAction={() => onPick(k)}
              icon={() => <span data-icon className="mr-2 flex"><KindMark kind={k} /></span>} />
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
}

/** A LINK IS ONE THING, SO IT IS ONE ROW: paste, name it or don't, Add — the
 *  same control the drawer uses, so a link is attached the same way wherever
 *  you are. The address is normalised before it can be added, so what lands on
 *  the item is a real http(s) URL and never a `javascript:` one. */
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
    <div className="flex flex-col gap-2">
      {links.length ? (
        <ul className="flex flex-col divide-y divide-border-secondary rounded-lg ring-1 ring-secondary ring-inset">
          {links.map((l, i) => (
            <li key={l.url + i} className="flex items-center gap-2 px-3 py-2">
              <Icon name="ext" size="sm" className="text-fg-quaternary" />
              <span className="flex min-w-0 flex-1 flex-col">
                <b className="truncate text-sm font-medium text-primary">{l.label}</b>
                <span className="truncate text-xs text-tertiary">{l.url}</span>
              </span>
              <IconButton ico="x" label={"Remove the link to " + l.label} size="xs"
                onClick={() => onChange(links.filter((_, n) => n !== i))} />
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-start gap-2">
        <Input id="niUrl" className="min-w-0 flex-1 basis-56" value={url} ph="Paste a link"
          ariaLabel="Link address" err={bad} onChange={setUrl} onEnter={add} />
        <Input className="min-w-0 flex-1 basis-40" value={label} ph="Name — optional"
          ariaLabel="Link name" onChange={setLabel} onEnter={add} />
        <Button color="secondary" isDisabled={!ok} onClick={add}>Add</Button>
      </div>
      {/* Tied to the field it is about, and only once there is something to
          refuse — an empty box is not an error. */}
      {bad ? (
        <p id="niUrlErr" className="flex items-center gap-1 text-sm text-error-primary" role="alert">
          <Icon name="alert" size="xs" />
          That is not a web address — links have to be http or https.
        </p>
      ) : null}
    </div>
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
    <div className="flex flex-col gap-2 rounded-lg bg-secondary p-3">
      <FormField id="niTag" label="New tag">
        <div className="flex flex-wrap items-center gap-2">
          <Input id="niTag" className="min-w-0 flex-1 basis-48" value={draft} ph="Name a new tag"
            onChange={setDraft} onEnter={add} />
          <Button color="secondary" isDisabled={!draft.trim()} onClick={add}>Create</Button>
        </div>
      </FormField>
      {/* The type is shown as what it will look like, next to the swatches that
          set it — so the choice is read rather than remembered. */}
      <div className="flex flex-wrap items-center gap-3">
        <span className={cx("inline-flex size-max items-center rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset", tagClasses(tone))}>
          {draft.trim() || "Preview"}
        </span>
        <TagTypePicker tone={tone} onPick={setTone} />
      </div>
    </div>
  );
}

/** ONE FORM, THREE KINDS, AND THE TITLE IS THE FORM.
 *
 *  The kind switcher sits directly under the title: they are one record with a
 *  `kind`, and a target only adds two fields to the same five. Enter in the
 *  title creates, because for most of these the title IS the whole entry.
 *
 *  ROLLS UP TO IS NOT A CREATE-TIME QUESTION. Naming a task, handing it to
 *  somebody and saying when it is due is the whole of making one; which
 *  milestone it belongs under is a decision about the SHAPE of the work, and it
 *  is one you usually make after the task exists. It lives on Edit, where
 *  `parentOptions` still enforces target ▸ milestone ▸ task. */
export function NewItemModal({ kind: initial, members, date }: {
  kind: string; members: Member[]; date?: string;
}) {
  const shell = useShell();
  const [kind, setKind] = useState(initial);
  const [title, setTitle] = useState("");
  const [who, setWho] = useState(meId());
  const [pri, setPri] = useState("medium");
  /* A day was clicked: it is both the start and the due date, so the item lands
     on the day somebody pointed at rather than near it. */
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

  const save = () => {
    if (!title.trim()) return;
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
    <ModalShell
      title={"New " + labelOf(KIND, kind).toLowerCase()}
      sub="It opens in Planning. Nothing sets Delay — the due date does."
      ico="plus"
      tone="brand"
      onClose={() => shell.closeLayer()}
      actions={
        <>
          <Button color="secondary" onClick={() => shell.closeLayer()}>Cancel</Button>
          <Button color="primary" isDisabled={!title.trim()} onClick={save}>Create</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Segmented label="Kind" value={kind} onPick={setKind}
          options={["task", "milestone", "target"].map((k) => ({ v: k, l: labelOf(KIND, k) }))} />

        <FormField id="niTitle" label="Title" req>
          <Input id="niTitle" autoFocus value={title} ph={"Add a " + labelOf(KIND, kind).toLowerCase()}
            onChange={setTitle} onEnter={save} />
        </FormField>

        <FieldRow cols={2}>
          <FormField id="niStart" label="Starts">
            <DateInput id="niStart" className="w-full" value={start} onChange={setStart} />
          </FormField>
          <FormField id="niDue" label="Due">
            <DateInput id="niDue" className="w-full" value={due} onChange={setDue} />
          </FormField>
        </FieldRow>

        <FieldRow cols={2}>
          <FormField id="niWho" label="Assigned to">
            <SelectInput id="niWho" value={who} onChange={assign}
              options={members.filter((m) => m.status === "active").map((m) => ({ v: m.memberId, l: m.name }))} />
          </FormField>
          <FormField id="niPri" label="Priority">
            <SelectInput id="niPri" value={pri} onChange={setPri}
              options={PRIORITY_SCALE.map((k) => ({ v: k, l: labelOf(PRIORITY, k) }))} />
          </FormField>
        </FieldRow>

        {kind === "target" ? (
          <FieldRow cols={2}>
            <FormField id="niTv" label="Target">
              <Input id="niTv" type="number" value={tv} ph="60" onChange={setTv} />
            </FormField>
            <FormField id="niTu" label="Unit">
              <Input id="niTu" value={tu} ph="businesses" onChange={setTu} />
            </FormField>
          </FieldRow>
        ) : null}

        {/* DESCRIPTION — plain text with marks in it. The buttons write the
            marks so nobody has to know them; see RichText for why this is not a
            contentEditable. The toolbar sits beside the label rather than
            inside it: a <label> full of buttons steals every press. */}
        <div className="flex w-full min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="niDesc" className="text-sm font-medium text-secondary">Details</label>
            <MarkBar ta={ta} value={desc} set={setDesc} />
          </div>
          <TextAreaBase id="niDesc" ref={ta} rows={3} size="sm" value={desc}
            placeholder="What does done look like?" onChange={(e) => setDesc(e.target.value)} />
        </div>

        <div className="flex w-full min-w-0 flex-col gap-1.5">
          <span className="text-sm font-medium text-secondary">Links</span>
          <LinkField links={links} onChange={setLinks} />
        </div>

        <div className="flex w-full min-w-0 flex-col gap-2">
          <span className="text-sm font-medium text-secondary">Tags</span>
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Tags">
            {mine.map((t) => {
              const on = tags.indexOf(t.tagId) >= 0;
              return (
                <button key={t.tagId} type="button" aria-pressed={on}
                  className={cx(
                    "inline-flex size-max cursor-pointer items-center rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 outline-focus-ring transition duration-100 ring-inset focus-visible:outline-2 focus-visible:outline-offset-2",
                    tagClasses(t.colourToken || "slate"),
                    on ? "ring-2 ring-brand" : "opacity-70 hover:opacity-100",
                  )}
                  onClick={() => setTags(on ? tags.filter((x) => x !== t.tagId) : tags.concat([t.tagId]))}>
                  {t.label}
                </button>
              );
            })}
            {mine.length ? null : <span className="text-sm text-quaternary">None yet — the first one is a word away.</span>}
          </div>
          <NewTagField ownerId={who} onMade={(id) => setTags((v) => v.concat([id]))} />
        </div>
      </div>
    </ModalShell>
  );
}

/* ------------------------------------------------------------ calendar --- */

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** THE MONTH, AND WHAT FALLS ON EACH DAY. A flat seven-column grid whose cells
 *  are equal and whose TODAY is marked on the number and the ring — never as a
 *  wash over the whole square, which reads as a warning in a panel where a
 *  tinted cell means something is wrong.
 *
 *  The rail beside it is this face's own: the month's roll-up, then what is
 *  assigned to you. Under `lg` it drops below the grid rather than squeezing
 *  it. */
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
    shell.modal(<NewItemModal kind={kind} members={members} date={date} />, "lg");

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold tracking-tight text-primary">
            {/* THE HEADING READS THE GRID, not the anchor. `gridDays` starts a
                week on its Monday, so a Friday anchor printed "4 Sep – 10 Sep"
                over a row that began on the 31st. */}
            {mode === "week" ? fmtDate(days[0]) + " – " + fmtDate(days[days.length - 1]) : fmtMonth(anchor, true)}
          </h2>
          <span className="flex-1" />
          <Button color="secondary" isDisabled={!p.on} onClick={() => goto({ on: undefined })}>Today</Button>
          <div className="flex items-center gap-1">
            <IconButton ico="chevl" color="secondary" label="Previous" onClick={() => move(-1)} />
            <IconButton ico="chevr" color="secondary" label="Next" onClick={() => move(1)} />
          </div>
          <Segmented sm label="Span" value={mode} onPick={(v) => goto({ cal: v === "week" ? "week" : undefined })}
            options={[{ v: "month", l: "Month" }, { v: "week", l: "Week" }]} />
        </div>

        <div className="w-full overflow-hidden rounded-xl bg-primary ring-1 ring-secondary">
          <div className="grid grid-cols-7 [&>*:nth-child(7n)]:border-r-0">
            <CalHead days={DOW} />
            {days.map((d) => {
              const evs = eventsOn(d, rows);
              const away = leaveOn(d, teamIds);
              /* THE CAP IS A HEIGHT, NOT A TASTE. A month cell holds three chips
                 with the overflow link still visible; the leave banner is a row
                 like any other and counts against it. */
              const room = Math.max(1, (mode === "week" ? 12 : 3) - (away.length ? 1 : 0));
              return (
                <CalCell key={d} date={d} day={Number(d.slice(8))}
                  today={d === TODAY}
                  outside={mode === "month" && d.slice(0, 7) !== month}
                  weekend={isWeekend(d)}
                  selected={d === anchor && d !== TODAY}
                  onAdd={() => create("task", d)}>
                  {away.length ? (
                    <CalChip tone="info" title={away.map((l) => nameOf(l.memberId)).join(", ") + " on leave"} />
                  ) : null}
                  {evs.slice(0, room).map((e) => <Chip key={e.item.itemId + e.edge} ev={e} onOpen={onOpen} />)}
                  {evs.length > room ? (
                    <button type="button"
                      className="cursor-pointer rounded px-1.5 text-left text-xs font-medium text-tertiary outline-focus-ring hover:text-brand-secondary focus-visible:outline-2 focus-visible:-outline-offset-2"
                      aria-label={evs.length - room + " more on " + fmtDate(d) + " — open the week"}
                      onClick={() => goto({ cal: "week", on: d })}>
                      +{evs.length - room} more
                    </button>
                  ) : null}
                </CalCell>
              );
            })}
          </div>
        </div>

        <p className="text-xs text-quaternary">
          A task of a week or less spans every day it covers; anything longer, and every milestone
          and target, is drawn twice — where it starts and where it is due.
        </p>
      </div>

      <aside className="flex min-w-0 flex-col gap-3">
        <MonthRail anchor={anchor} rows={rows} me={me} onOpen={onOpen} />
      </aside>
    </div>
  );
}

const nameOf = (id: string) => (readMember(id)?.name || id).split(" ").slice(-1)[0];

function Chip({ ev, onOpen }: { ev: CalEvent; onOpen: (id: string) => void }) {
  const i = ev.item;
  const st = stageOf(i);
  const wait = !!blockerOf(i);
  return (
    <CalChip title={i.title} kind={i.kind}
      edge={ev.edge || undefined}
      tone={wait && st === "delayed" ? "bad" : toneOf(WORK_STATUS, st) || "neutral"}
      onOpen={() => onOpen(i.itemId)} />
  );
}

/* ---------------------------------------------------------------- rail --- */

/** This month's roll-up, then tasks ▸ milestones ▸ targets. It belongs to the
 *  calendar face and no other.
 *
 *  NO MINI MONTH: it sat a second month grid immediately beside the first one,
 *  and the two answered the same question at two sizes. */
function MonthRail({ anchor, rows, me, onOpen }: {
  anchor: string; rows: WorkItem[]; me: string; onOpen: (id: string) => void;
}) {
  const month = anchor.slice(0, 7);
  const inMonth = rows.filter((i) => {
    const a = i.startDate || i.dueDate, b = i.dueDate || i.startDate;
    return !!a && !!b && a.slice(0, 7) <= month && (b as string).slice(0, 7) >= month;
  });
  const t = workTotals(inMonth);
  const seg = (n: number) => (inMonth.length ? (n / inMonth.length) * 100 + "%" : "0%");

  return (
    <>
      <Card tight title={fmtMonth(anchor)}
        right={<Pill xs tone="neutral" text={inMonth.length + " dated"} />}>
        <div className="flex flex-col gap-2">
          <span className="flex h-2 w-full overflow-hidden rounded-full bg-quaternary" role="img"
            aria-label={t.completed + " done, " + (t.inProgress + t.planned) + " open, " + t.delayed + " in delay"}>
            <i className="block bg-utility-green-500" style={{ width: seg(t.completed) }} />
            <i className="block bg-utility-blue-500" style={{ width: seg(t.inProgress + t.planned) }} />
            <i className="block bg-utility-yellow-500" style={{ width: seg(t.delayed) }} />
          </span>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="text-success-primary tnum">{t.completed} done</span>
            <span className="text-tertiary tnum">{t.inProgress + t.planned} open</span>
            <span className="text-warning-primary tnum">{t.delayed} in delay</span>
          </div>
        </div>
      </Card>

      {/* Capped here and nowhere else: the rail also has to hold milestones and
          targets, while the member page and Reports have a column to themselves
          and show the lot. */}
      <TasksBlock who={me} onOpen={onOpen} limit={6} />
      <MarksBlock kind="milestone" who={me} onOpen={onOpen} compact />
      {/* ONE target. It is the number the quarter is judged on, and a column of
          four of them is a list, not an indicator. */}
      <MarksBlock kind="target" who={me} onOpen={onOpen} compact limit={1} />
    </>
  );
}

/* --------------------------------------------------------------- board --- */

function Board({ rows, all, group, onOpen }: {
  rows: WorkItem[]; all: WorkItem[]; group: string; onOpen: (id: string) => void;
}) {
  const cols = columnsFor(rows, group);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-tertiary">
        {group
          ? "A grouping, not a workflow — a drag here would mean a reassignment, which needs a reason."
          : "Open an item to move it between stages. Delay is never set by hand — the due date sets it."}
      </p>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {cols.map((c) => (
          <StageColumn key={c.key} label={c.label} n={c.list.length}>
            {c.list.map((i) => (
              <TaskCard key={i.itemId} item={i} parent={parentOf(i, all)} onOpen={onOpen} />
            ))}
          </StageColumn>
        ))}
      </div>
    </div>
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

/* ------------------------------------------------------------ timeline --- */

const WEEKS = [2, 4, 13];

/** Lanes are the work, never the worker. A lane per person is a productivity
 *  chart this module has no estimate field to justify. */
function TimelineFace({ rows, onOpen }: { rows: WorkItem[]; onOpen: (id: string) => void }) {
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
  const cols = { gridTemplateColumns: "repeat(" + days.length + ",minmax(0,1fr))" };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <IconButton ico="chevl" color="secondary" label="Previous" onClick={() => setFrom(addDays(from, -7 * weeks))} />
          <IconButton ico="chevr" color="secondary" label="Next" onClick={() => setFrom(addDays(from, 7 * weeks))} />
        </div>
        <h2 className="text-md font-semibold text-primary tnum">
          {fmtDate(days[0])} – {fmtDate(days[days.length - 1])}
        </h2>
        <span className="flex-1" />
        <span className="inline-flex items-center gap-1.5 text-xs text-tertiary">
          <i aria-hidden="true" className="block h-3 w-6 rounded-md border border-dashed border-brand" />
          the lane&rsquo;s own window
        </span>
        <Segmented sm label="Span" value={String(weeks)} onPick={(v) => setWeeks(Number(v))}
          options={WEEKS.map((w) => ({ v: String(w), l: w === 13 ? "Quarter" : w + "w" }))} />
      </div>

      <div className="w-full overflow-x-auto rounded-xl bg-primary ring-1 ring-secondary">
        <div className="min-w-[64rem]">
          <div className="grid grid-cols-[minmax(12rem,18rem)_minmax(0,1fr)] border-b border-secondary bg-secondary">
            <span className="label-mono border-r border-secondary px-3 py-2">Target · milestone</span>
            <span className="grid" style={cols}>
              {days.map((d) => (
                <i key={d} className={cx("label-mono border-r border-secondary py-2 text-center not-italic last:border-r-0",
                  isWeekend(d) && "bg-tertiary")}>
                  {Number(d.slice(8))}
                </i>
              ))}
            </span>
          </div>

          {lanes.map((ln, n) => {
            const host = ln.item;
            const bars: { i: WorkItem; win: boolean }[] = [];
            if (host && host.startDate) bars.push({ i: host, win: true });
            ln.tasks.filter((i) => i.startDate).forEach((i) => bars.push({ i, win: false }));
            const height = Math.max(1, bars.length) * 22 + 14;
            return (
              <div key={host ? host.itemId : "none" + n}
                className="grid grid-cols-[minmax(12rem,18rem)_minmax(0,1fr)] border-b border-secondary last:border-0">
                <span className={cx("flex min-w-0 flex-col justify-center border-r border-secondary px-3 py-2", ln.sub && "pl-7")}>
                  {host ? (
                    <>
                      <b className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-primary">
                        <KindMark kind={host.kind} />
                        <span className="truncate">{host.title}</span>
                      </b>
                      <span className="truncate text-xs text-tertiary">
                        {labelOf(KIND, host.kind)} · {noteOf(host)}{host.dueDate ? " · due " + fmtDate(host.dueDate) : ""}
                      </span>
                    </>
                  ) : (
                    <>
                      <b className="text-sm font-medium text-primary">No milestone</b>
                      <span className="text-xs text-tertiary">{ln.tasks.length} tasks hang off nothing</span>
                    </>
                  )}
                </span>
                <span className="relative grid" style={{ ...cols, height }}>
                  {days.map((d) => (
                    <i key={d} className={cx("border-r border-secondary last:border-r-0", isWeekend(d) && "bg-tertiary")} />
                  ))}
                  {bars.map((b, k) => {
                    const s = span(b.i.startDate as string, (b.i.dueDate || b.i.startDate) as string);
                    if (!s) return null;
                    return (
                      <LaneBar key={b.i.itemId + k} title={b.i.title}
                        sub={b.win ? undefined : nameOf(b.i.assigneeId)}
                        left={s.left} width={s.width} top={7 + k * 22}
                        tone={toneOf(WORK_STATUS, stageOf(b.i)) || "neutral"}
                        window={b.win} onOpen={() => onOpen(b.i.itemId)} />
                    );
                  })}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-quaternary">
        {undated.length
          ? undated.length + " open items have no start date and cannot be drawn: "
            + undated.map((i) => i.title).join(" · ")
          : "Every open item has a start date."}
      </p>
    </div>
  );
}

/* ----------------------------------------------------------------- list --- */

function List({ rows, all, onOpen, narrowed, onClear }: {
  rows: WorkItem[]; all: WorkItem[]; onOpen: (id: string) => void;
  narrowed: boolean; onClear: () => void;
}) {
  if (!rows.length) {
    return (
      <EmptyState icon="check" title="No work matches"
        body={narrowed
          ? "Every item is filtered out. Clear one and the rows come back."
          : "Nothing has been created yet — the first task is a title away."}
        action={narrowed ? <Button color="secondary" ico="x" onClick={onClear}>Clear the filters</Button> : undefined} />
    );
  }
  return (
    <ListTable min="1040px"
      head={
        <tr>
          <th className="rail" />
          <th>Item</th>
          {/* PROGRESS SITS BESIDE THE THING IT IS ABOUT. Last in the row it was
              the far end of a 1000px scan from the title; the two facts
              everybody opens this list for — what it is and how far along it
              is — are read together now. */}
          <th>Progress</th>
          <th>Stage</th>
          <th>Priority</th>
          <th>Due</th>
          <th>Member</th>
        </tr>
      }>
      {rows.map((i) => {
        const m = readMember(i.assigneeId);
        const parent = parentOf(i, all);
        const late = isDelayed(i);
        const tone = late && blockerOf(i) ? "bad" : late ? "warn" : undefined;
        /* A TASK HAS A REAL PERCENTAGE. The dash is kept for the one case that
           still has nothing to say: an open task with no steps on it. */
        const bare = i.kind === "task" && !checkCount(i).total && i.status !== "completed";
        return (
          <tr key={i.itemId} className={cx("clickable", i.status === "cancelled" && "opacity-60")}
            tabIndex={0} role="link"
            onClick={() => onOpen(i.itemId)}
            onKeyDown={(e) => { if (e.key === "Enter") onOpen(i.itemId); }}>
            <Rail tone={tone} />
            <td className="cell-1">
              <span className="flex min-w-0 items-center gap-2">
                <KindTag kind={i.kind} />
                <span className="min-w-0 truncate">{i.title}</span>
              </span>
              <span className="cell-2 flex flex-wrap items-center gap-1.5">
                {parent ? (
                  <span className="inline-flex items-center gap-1" title={"Rolls up to " + parent.title}>
                    <Icon name="chevu" size="xs" className="text-fg-quaternary" />
                    {parent.title}
                  </span>
                ) : null}
                <TagChips item={i} max={2} />
                <WaitFlag item={i} />
              </span>
            </td>
            <td className="w-44">
              {bare ? <span className="text-quaternary">—</span> : <ProgressWindow item={i} />}
            </td>
            {/* THE STATUS IS CHANGED WHERE IT IS READ, with the same control the
                drawer uses — it stops the click reaching the row, so changing a
                status does not also open the drawer behind the menu. */}
            <td><StatusPicker item={i} sm /></td>
            <td><PriorityCell level={i.priority} /></td>
            {/* `block` on the sub-line: `.cell-2` is only a type ramp, so an
                inline span welded the two together — "27 Aug 20268 days ago". */}
            <td className="font-mono tnum whitespace-nowrap">
              {i.dueDate ? fmtDate(i.dueDate) : "—"}
              {i.dueDate ? (
                <span className={cx("cell-2 block", late && "text-warning-primary!")}>{ago(i.dueDate, TODAY)}</span>
              ) : null}
            </td>
            <td>{m ? <Who m={m} /> : <span className="text-quaternary">—</span>}</td>
          </tr>
        );
      })}
    </ListTable>
  );
}
