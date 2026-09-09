/* =============================================================================
   Deals — THE LIST WORKSPACE. Two faces over one fetch: the table (the densest
   read of the pipeline) and the pipeline board (the same deals, arranged by
   where they are stuck).

   The page reads top to bottom the way every list page in the panel does:
   PageHeader → FilterBar → StatStrip → the data → Pagination. The stat cells
   are the filters, so the number that tells you where the pipeline is stuck is
   also the thing you press to go and look at it.
   ============================================================================= */
import { useMemo } from "react";
import {
  Alert, Button, EmptyState, FilterBar, FilterChips, ListSkeleton, ListTable,
  MoreMenu, Notice, PageHeader, Pagination, Pill, Rail, SearchField, Select, StatStrip, qs
} from "../../ui";
import type { StatCell } from "../../ui";
import { go } from "../../ui/nav";
import { can } from "../../shell/AdminShell";
import {
  ALL_STAGES, D, STAGE, STRIP_STAGES, daysFrom, dealHash, fullAccess, hasFilters, head, inr,
  localSort, merge, omit, place, useDealCounts, useFilters
} from "./useDeals";
import type { Counts, DealsApiState, Params } from "./useDeals";
import { legacyPriorityInt, legacyStageInt } from "./adapter";
import { ChainDots, DealCard, MoneyCell, NextCell, OwnerCell, StageChip, StageColumn, TagChips, railTone, railWhy } from "./bits";
import { useActs } from "./Modals";

/** The table shows 50 rows at a time. The fetch is one page of 500 (see
 *  useDealsApi) — this is the reading window over it, and it lives in the URL
 *  like every other thing that changes what you are looking at. */
const PAGE_SIZE = 50;

/* ========================================================== THE STRIP ======
   One row of cells of equal build, ruled off from each other, on one baseline.
   Total first, then the funnel one stage per cell, then the two money
   read-outs.

   Every count is also the filter for itself — pressing Followup IS the stage
   filter, and Total is how you clear it. That is why the stage split lives
   here rather than only in the Stage dropdown.

   Money is deliberately not pressable. A cell that highlights on hover and
   does nothing on click is worse than one that never invited the press, so the
   two read-outs render as plain cells and are visibly quieter. */
export function AttnStrip({ p, m }: { p: Params; m: Counts }) {
  /* Toggling: pressing the stage you are already on clears it back to Total,
     so the strip never becomes a trap you have to leave via the chip row. */
  const stageRoute = (s: number) =>
    "#/deals" + qs(merge(omit(p, ["page"]), { stage: String(p.stage) === String(s) ? "" : s }));

  const cells: (StatCell | "sep")[] = [
    { k: "total", v: m.total,
      to: "#/deals" + qs(omit(p, ["stage", "stalled", "next", "priority", "page"])),
      on: !p.stage && !p.stalled && !p.next && !p.priority },
    "sep",
    /* The four working stages only. Lost is not a step of the funnel, it is
       where deals leave it — a cell for it counted an outcome alongside four
       positions and made the row read as five things of one kind when it is
       four plus an exit. Lost is still one pick away in the Stage dropdown. */
    ...STRIP_STAGES.map((s) => ({
      k: D.STAGES[s].label.toLowerCase(), v: m.byStage[s] || 0,
      to: stageRoute(s), on: String(p.stage) === String(s),
      dot: D.STAGES[s].tone || "neutral"
    })),
    /* The money sits beside the funnel it came out of, divided by the same
       hairline as every other pair. Neither cell is a link: every other cell
       filters the list, and there is no "show me the outstanding ones" filter
       for these to route to. */
    "sep",
    { k: "outstanding", v: inr(m.outstanding, { compact: true }), tone: "warn" },
    "sep",
    { k: "collected", v: inr(m.collected, { compact: true }), tone: "ok" },
  ];
  return <StatStrip cells={cells} />;
}

/* ======================================================= THE TOPBAR ========
   The same scope, sized for the breadcrumb slot. Chat's body is three panes
   wide with nothing left over, so its counts go beside the title — same cells,
   same order, same filtering, and the routes keep `view` so pressing one
   narrows the chat list rather than throwing you back to the table.

   Figures in mono, names as the tracked micro-label: the run-on
   "0total0new0followup" the old row produced was three numbers and three words
   with nothing between them. */
export function TbStats({ p }: { p: Params }) {
  /* Reads the counts itself rather than taking them as a prop: the topbar
     chrome is captured once per route change, so a prop would freeze at
     whatever the numbers were before the fetch landed. */
  const m = useDealCounts();

  /* One cell: the figure in mono over nothing, its name as the tracked
     micro-label beside it. `whitespace-nowrap` on the name is load-bearing —
     "Slot Booked" wrapped to two lines and took the whole row's baseline with
     it, which is exactly the run-on this replaced. */
  const figure = (v: string | number, k: string, tone?: string) => (
    <>
      <span className={"font-mono text-sm font-semibold tnum " + (tone || "text-primary")}>{v}</span>
      <span className="label-mono whitespace-nowrap">{k}</span>
    </>
  );
  const cell = (k: string, v: number, route: string, on: boolean) => (
    <button
      key={k}
      type="button"
      data-go={route}
      aria-pressed={on}
      className={
        "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-0.5 outline-focus-ring transition duration-100 hover:bg-primary_hover focus-visible:outline-2 focus-visible:outline-offset-1 " +
        (on ? "bg-brand-primary ring-1 ring-brand ring-inset" : "")
      }
      onClick={() => go(route)}
    >
      {figure(v, k)}
    </button>
  );
  const rule = <span aria-hidden="true" className="mx-1 h-4 w-px shrink-0 bg-border-secondary" />;

  return (
    <span className="hidden min-w-0 items-center gap-1 overflow-x-auto xl:flex scrollbar-hide" role="group" aria-label="Pipeline summary">
      {rule}
      {cell("total", m.total,
        "#/deals" + qs(omit(p, ["stage", "stalled", "next", "priority", "page"])),
        !p.stage && !p.stalled && !p.next && !p.priority)}
      {STRIP_STAGES.map((s) => cell(D.STAGES[s].label.toLowerCase(), m.byStage[s] || 0,
        "#/deals" + qs(merge(omit(p, ["page"]), { stage: String(p.stage) === String(s) ? "" : s })),
        String(p.stage) === String(s)))}
      {/* The same two figures the table strip ends on, in the same order —
          read-outs, not buttons: there is nothing for them to filter to. They
          need a wider window than the funnel does, so they arrive a breakpoint
          later rather than squeezing the seven cells beside them. */}
      <span className="hidden items-center gap-1 2xl:flex">
        {rule}
        <span className="flex shrink-0 items-center gap-1.5 px-1.5 py-0.5">{figure(inr(m.outstanding, { compact: true }), "outstanding", "text-warning-primary")}</span>
        <span className="flex shrink-0 items-center gap-1.5 px-1.5 py-0.5">{figure(inr(m.collected, { compact: true }), "collected", "text-success-primary")}</span>
      </span>
    </span>
  );
}

/* Stage/Priority Select options, sourced from the API's own vocabulary once it
   has loaded — so a stage or priority row added server-side shows up here with
   no code edit. Falls back to the local D.STAGES/D.PRIORITY vocabulary while
   the first fetch is still in flight. Values stay legacy ints either way — see
   the comment above apiStageKey() in useDeals.ts for why the URL param cannot
   just be the raw API key. */
function stageOptions(apiStages: { key: string; label: string; tone: string }[]) {
  return (apiStages.length
    ? apiStages.map((s) => ({ v: String(legacyStageInt(s)), l: s.label, dot: s.tone || "neutral" }))
    : ALL_STAGES.map((s) => ({ v: String(s), l: D.STAGES[s].label, dot: D.STAGES[s].tone || "neutral" })));
}
function priorityOptions(apiPriorities: { key: string; label: string }[]) {
  const dots: Record<string, string> = { "3": "bad", "2": "warn", "1": "neutral" };
  return (apiPriorities.length
    ? apiPriorities.map((pr) => ({ v: String(legacyPriorityInt(pr)), l: pr.label, dot: dots[String(legacyPriorityInt(pr))] }))
    : [{ v: "3", l: "Urgent", dot: "bad" }, { v: "2", l: "High", dot: "warn" }, { v: "1", l: "Normal", dot: "neutral" }]);
}

/* The panel's existing "no access" copy (registry.tsx's Denied, for the whole-
   module gate) — repeated here rather than imported, since that one is for a
   module you cannot see at all and this is a 403 arriving mid-session from a
   live fetch. Same words, so the two never read as different rules. */
function DealsDenied() {
  return (
    <EmptyState icon="shield" title="You do not have access to this module"
      body="Deals is not in your effective access for this session. Access is granted by role, not requested per page — ask an Admin to review your role in Settings → Team." />
  );
}

/* ==========================================================================
   THE PAGE
   ====================================================================== */
export function DealsList({ id, p, api }: {
  id: string | null; p: Params; api: DealsApiState;
}) {
  const acts = useActs(p);
  /* Filters are applied WITHOUT the page number, so narrowing the list always
     lands you on its first page rather than on page 3 of something shorter. */
  const fp = useMemo(() => omit(p, ["page"]), [p]);
  const { onFilter, onSearch, onUnfilter } = useFilters(fp, id);
  const view = p.view === "board" ? "board" : "table";
  const canCreate = can("deals", "create");

  /* `value` and the default order come back already sorted; stage age, close
     date and last activity are ordered here, over the page that arrived. */
  const rows = localSort(api.list, p.sort);
  const page = Math.max(1, parseInt(p.page || "1", 10) || 1);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const shown = view === "board" ? rows : rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const tagsHash = "#/deals" + qs(merge(fp, { view: "tags" }));
  const pageHash = (n: number) => "#/deals" + qs(merge(p, { page: n <= 1 ? "" : n }));

  if (api.loading && !api.list.length) return <ListSkeleton />;
  if (api.forbidden) return <DealsDenied />;

  /* Everything head-only lives behind one menu rather than a row of icons the
     rest of the team can see and not press. Export stays offered to everybody
     — the server answers it, and its refusal is the honest one. */
  const menu = [
    { icon: "download", label: "Export CSV", act: () => acts.exportCsv(rows), title: "The rows currently filtered" },
    ...(head()
      ? [{ icon: "clock", label: "Run the stall sweep now", act: () => acts.stallJob(), title: "The same sweep cron runs nightly" }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Deals"
        meta={
          <>
            <span className="tnum">{api.counts.total} in the pipeline</span>
            {rows.length !== api.counts.total ? <span className="tnum">{rows.length} match these filters</span> : null}
            {fullAccess() ? null : <Pill xs tone="neutral" text="your deals only" />}
          </>
        }
        actions={
          <>
            <MoreMenu label="Actions" items={menu} />
            {canCreate
              ? <Button color="primary" ico="plus" data-act="dl-create" onClick={() => acts.create()}>New deal</Button>
              : null}
          </>
        }
      />

      <FilterBar
        search={<SearchField ph="Search name, business, email, phone, city or deal ref…" val={p.q} onFilter={onSearch} />}
        filters={
          <>
            <Select name="stage" label="Stage" value={p.stage} onFilter={onFilter} options={stageOptions(api.stages)} />
            {/* FULL ACCESS, not head(): `deals.close` still authorises reassign
                and export, but it no longer means you receive other people's
                deals — so for a scoped session this picker would collapse to
                their own name and filter nothing. Absent, not greyed, like
                every other locked control here. */}
            {fullAccess()
              ? <Select name="owner" label="Owner" value={p.owner} onFilter={onFilter} options={api.owners.map((o) => ({ v: String(o.id), l: o.name }))} />
              : null}
            <Select name="priority" label="Priority" value={p.priority} onFilter={onFilter} options={priorityOptions(api.priorities)} />
            <Select name="tag" label="List" value={p.tag} onFilter={onFilter} options={api.tags.map((t) => ({ v: t.slug, l: t.label, dot: t.tone || "neutral" }))} />
            <Select name="sort" label="Sort" value={p.sort} onFilter={onFilter} allLabel="Sort: newest first"
              options={[{ v: "age", l: "Stage age" }, { v: "close", l: "Expected close" },
                { v: "value", l: "Deal value" }, { v: "act", l: "Last activity" }]} />
          </>
        }
        right={
          /* Managing lists belongs next to filtering by them, not in a list of
             ways to look at deals. Named rather than icon-only: it leaves the
             page, and a bare glyph on the end of a filter row reads as one more
             filter. */
          <Button color="secondary" ico="tag" data-act="dl-tags" onClick={() => go(tagsHash)}>Lists</Button>
        }
        chips={
          <FilterChips params={omit(p, ["view", "page"])} onUnfilter={onUnfilter}
            labels={{ q: "Search", stage: "Stage", owner: "Owner", priority: "Priority",
              next: "Next action", stalled: "Stalled", sort: "Sort", tag: "List" }} />
        }
      />

      <AttnStrip p={p} m={api.counts} />

      {api.error ? <Alert tone="bad" title="Could not load deals">{api.error} The list below is whatever was already in hand.</Alert> : null}

      {view === "board"
        ? <Board list={rows} sel={id} p={p} />
        : <>
            <DealsTable list={shown} sel={id} p={p} onCreate={() => acts.create()} onClearFilters={() => onUnfilter("*")} acts={acts} />
            {/* The count line is worth reading whenever there is anything to
                count; over an empty list it said "1–0 of 0 deals", which is a
                sentence about nothing sitting under a state that already
                explains itself. */}
            {rows.length
              ? <Pagination page={page} pages={pages} total={rows.length} unit="deals" pageSize={PAGE_SIZE}
                  shown={shown.length} alwaysCount onPage={(n) => go(pageHash(n))} />
              : null}
          </>}
    </div>
  );
}

/* ========================================================== THE TABLE ======
   The rail is the exception stripe: stalled, overdue, urgent. The primary cell
   is the person, the secondary line under it the business and the reference —
   most deals have both and it is how the office actually refers to them.
   ------------------------------------------------------------------------- */
function DealsTable({ list, sel, p, onCreate, onClearFilters, acts }: {
  list: any[]; sel: string | null; p: Params; onCreate: () => void; onClearFilters: () => void;
  acts: ReturnType<typeof useActs>;
}) {
  const filtered = hasFilters(p);
  const canCreate = can("deals", "create");
  /* A scoped session is only ever sent the deals it owns or co-owns, so "No
     deals yet" would be a claim about a pipeline this viewer cannot see — and
     the usual reason the list is empty for them is that nothing is theirs, not
     that nothing exists. Full access keeps the literal reading. */
  const mine = !fullAccess();

  if (!list.length) return (
    <EmptyState icon="deal"
      title={filtered ? "No deals match these filters" : mine ? "No deals assigned to you" : "No deals yet"}
      body={filtered
        ? "Nothing in the pipeline matches. Clear a filter to widen the search."
        : (mine ? "Deals you own or co-own appear here." : "Nothing in the pipeline yet.") +
          (canCreate ? " Create one for an inbound call, a walk-in or a referral." : "")}
      action={filtered
        ? <Button color="secondary" data-unfilter="*" onClick={onClearFilters}>Clear all filters</Button>
        : (canCreate ? <Button color="primary" ico="plus" data-act="dl-create" onClick={onCreate}>New deal</Button> : null)} />
  );

  return (
    /* FIXED LAYOUT, DELIBERATELY. In auto layout a cell's `truncate` is a lie:
       the column simply grows to the longest business name in the page, and the
       row-actions column walks off the right edge. Fixed layout makes the
       declared widths real, so every cell truncates inside its own column and
       the table stays the width the page has. */
    <ListTable min="66rem" cls="table-fixed" head={
      <tr>
        <th className="rail" />
        <th className="w-64">Deal</th>
        <th className="w-32">Stage</th>
        <th className="w-24">Chain</th>
        <th className="n w-28">Deal value</th>
        <th className="n w-28">Collected</th>
        <th className="w-36">Owner</th>
        <th className="w-40">Next action</th>
        <th className="acts w-28"><span className="sr-only">Actions</span></th>
      </tr>
    }>
      {list.map((d: any) => {
        const to = dealHash(d.deal_id, p);
        return (
          <tr key={d.deal_id}
            className={"clickable" + (sel === d.deal_id ? " on" : "")}
            data-go={to} onClick={() => go(to)}>
            <Rail tone={railTone(d)} title={railWhy(d)} />
            <td className="cell-1">
              {/* THE PERSON, WHAT IS WRONG WITH THEM, AND WHAT THEY ARE ON —
                  one line. The lists ride here rather than under the facts: a
                  third row per deal doubled the height of the table for a chip
                  that is two words long. */}
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="truncate">{d.customer_name}</span>
                {d.is_stalled ? <Pill xs tone="bad" dot text="Stalled" /> : null}
                {d.tags && d.tags.length ? <TagChips max={2} tags={d.tags} /> : null}
              </div>
              {/* The reference and the facts that identify it, on ONE truncated
                  line — the office says "the KitchenCraft one", so the business
                  comes before the geography. */}
              <div className="cell-2 truncate">
                <span className="font-mono tnum">{d.deal_id}</span>
                {d.business_name ? " · " + d.business_name : ""}
                {" · " + place(d)}
                {d.interested_in ? " · " + d.interested_in : ""}
              </div>
            </td>
            <td>
              <StageChip stage={d.stage} />
              <div className="cell-2 tnum">{Math.abs(daysFrom(d.stage_since))}d in stage</div>
            </td>
            <td><ChainDots d={d} /></td>
            <td className="n"><MoneyCell d={d} /></td>
            <td className="n">{d.revenue_collected ? inr(d.revenue_collected) : <span className="text-quaternary">—</span>}</td>
            <td><OwnerCell d={d} /></td>
            <td><NextCell d={d} /></td>
            <td className="acts">
              {/* The menu lives inside a clickable row, so its own presses must
                  not also open the drawer behind it. */}
              <span className="inline-flex" onClick={(e) => e.stopPropagation()}>
                <RowMenu d={d} acts={acts} />
              </span>
            </td>
          </tr>
        );
      })}
    </ListTable>
  );
}

/* Every action a row can take without opening the record. Destructive last and
   apart — the shared menu draws the separator and the tone. */
function RowMenu({ d, acts }: { d: any; acts: ReturnType<typeof useActs> }) {
  const ref = d.deal_id;
  const items = [
    { icon: "eye", label: "Open deal", act: () => go("#/deals/" + encodeURIComponent(ref)) },
    { icon: "note", label: "Add remark", act: () => acts.remark(ref) },
    { icon: "route", label: "Change stage", act: () => acts.stage(ref, d.stage) },
    { icon: "rupee", label: d.deal_value ? "Change deal value" : "Set deal value", act: () => acts.value(ref) },
    { icon: "edit", label: "Edit deal", act: () => acts.edit(ref) },
    { icon: "tag", label: "Lists", act: () => acts.tags(ref) },
    ...(head() ? [{ icon: "recon", label: "Reassign", act: () => acts.reassign(ref) }] : []),
    ...(head() ? [{ icon: "x", label: "Close deal", act: () => acts.closeDeal(ref), tone: "bad" }] : []),
  ];
  return <MoreMenu small label="" items={items} />;
}

/* ======================================================= THE PIPELINE ======
   One column per stage, scrolling sideways. Won and Lost are columns like the
   rest — they are where the pipeline ends, and a board that hides its own
   outcomes cannot answer "what did this week actually produce".

   Drag is deliberately NOT wired: a board move must route through the same
   dialog as the drawer so the change is logged with an actor, and a silent
   drop is a stage change nobody can attribute later.
   ------------------------------------------------------------------------- */
function Board({ list, sel, p }: { list: any[]; sel: string | null; p: Params }) {
  if (!list.length) return (
    <EmptyState icon="columns" title={hasFilters(p) ? "No deals match these filters" : "Nothing on the board"}
      body={hasFilters(p) ? "Clear a filter to widen the search." : "Deals appear here the moment one exists."} />
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-3 overflow-x-auto pb-2" role="list" aria-label="Deals by stage">
        {ALL_STAGES.map((st: number) => (
          <StageColumn key={st} stage={st} sel={sel} p={p} items={list.filter((d: any) => d.stage === st)} />
        ))}
      </div>
      <Notice ico="alert" text={<><b>Drag-to-move is deliberately absent.</b> A board move must route through the same guard modal as the drawer — a silent drop the server then refuses is worse than no drag at all. Open a card and change its stage there.</>} />
    </div>
  );
}

/* Re-exported so the pipeline card and the table row are provably the same
   drawing wherever they are read. */
export { DealCard, StageColumn };
export const SETTLED = [STAGE.WON, STAGE.LOST];
