/* =============================================================================
   Deals — LIST. The command row, the attention strip, the table and the board.
   ============================================================================= */
import {
  EmptyState, FilterChips, Icon, Notice, Pill, SearchField, Select, StatStrip, qs
} from "../../ui";
import type { StatCell } from "../../ui";
import { go } from "../../ui/nav";
import { can } from "../../shell/AdminShell";
import {
  ALL_STAGES, D, STAGE, STRIP_STAGES, daysFrom, dealHash, head, inr, localSort, merge, omit,
  place, urgency, useDealCounts, useFilters
} from "./useDeals";
import type { Counts, DealsApiState, Params } from "./useDeals";
import { legacyPriorityInt, legacyStageInt } from "./adapter";
import { ChainDots, MoneyCell, NextCell, OwnerCell, TagChips } from "./bits";
import { useActs } from "./Modals";
import { ListSkeleton } from "../../ui";

/* The strip reads as one table row: cells of equal build, ruled off from each
   other, sitting on the same baseline. Total first, then the funnel one stage
   per cell, then the two money read-outs.

   Every count is also the filter for itself — clicking Followup IS the stage
   filter, and Total is how you clear it. That is why the stage split lives
   here rather than only in the Stage dropdown: the number that tells you where
   the pipeline is stuck should be the thing you press to go look.

   Money is deliberately not clickable. A cell that highlights on hover and
   does nothing on click is worse than one that never invited the press, so the
   two read-outs render as plain cells and are visibly quieter. */
export function AttnStrip({ p, m }: { p: Params; m: Counts }) {
  /* Toggling: clicking the stage you are already on clears it back to Total,
     so the strip never becomes a trap you have to leave via the chip row. */
  const stageRoute = (s: number) =>
    "#/deals" + qs(merge(p, { stage: String(p.stage) === String(s) ? "" : s }));

  const cells: (StatCell | "sep")[] = [
    { k: "total", v: m.total,
      to: "#/deals" + qs(omit(p, ["stage", "stalled", "next", "priority"])),
      on: !p.stage && !p.stalled && !p.next && !p.priority },
    "sep",
    /* The four working stages only. Lost is not a step of the funnel, it is
       where deals leave it — a cell for it counted an outcome alongside four
       positions and made the row read as five things of one kind when it is
       four plus an exit. Lost is still one pick away in the Stage dropdown. */
    ...STRIP_STAGES.map((s) => ({
      k: D.STAGES[s].label.toLowerCase(), v: m.byStage[s] || 0,
      to: stageRoute(s), on: String(p.stage) === String(s),
      dot: D.STAGES[s].tone || ""
    })),
    /* The money used to be pushed to the far right by a spacer, which put a
       hand's width of nothing between Won and the figure Won produces. They are
       the same thought — the funnel, and what came out of it — so they sit
       together, divided by the same hairline as every other pair.

       Neither cell is a link: every other cell filters the list, and there is
       no "show me the outstanding ones" filter for these to route to. A cell
       that looks clickable and is not is worse than one that plainly reads. */
    "sep",
    { k: "outstanding", v: inr(m.outstanding, { compact: true }), tone: "warn" },
    "sep",
    { k: "collected", v: inr(m.collected, { compact: true }), tone: "ok" },
  ];
  return <StatStrip cells={cells} />;
}

/* The strip again, sized for the topbar. Chat's body is three panes wide with
   nothing left over, so its counts go beside the title — same cells, same
   order, same filtering, and the routes keep `view` so pressing one narrows
   the chat list rather than throwing you back to the table. */
export function TbStats({ p }: { p: Params }) {
  /* Reads the counts itself rather than taking them as a prop: the topbar
     chrome is captured once per route change, so a prop would freeze at
     whatever the numbers were before the fetch landed. */
  const m = useDealCounts();
  const cell = (k: string, v: number, route: string, on: boolean, dot?: string) => (
    <button key={k} className={"tb-stat" + (on ? " on" : "")} data-go={route} title={v + " " + k}
      onClick={() => go(route)}>
      {dot !== undefined ? <span className={"dls-cdot " + dot}></span> : null}
      <span className="v tnum">{v}</span><span className="k">{k}</span>
    </button>
  );
  const money = (k: string, v: string, tone: string) => (
    <span key={k} className={"tb-stat ro " + tone} title={v + " " + k}>
      <span className="v tnum">{v}</span><span className="k">{k}</span>
    </span>
  );
  return (
    <span className="tb-stats">
      {cell("total", m.total,
        "#/deals" + qs(omit(p, ["stage", "stalled", "next", "priority"])),
        !p.stage && !p.stalled && !p.next && !p.priority)}
      {STRIP_STAGES.map((s) => cell(D.STAGES[s].label.toLowerCase(), m.byStage[s] || 0,
        "#/deals" + qs(merge(p, { stage: String(p.stage) === String(s) ? "" : s })),
        String(p.stage) === String(s), D.STAGES[s].tone || ""))}
      {/* The same two figures the table strip ends on, in the same order —
          Chat has no room for the strip in its body, so the topbar carries the
          whole row or the two views disagree about what the pipeline is worth.
          Read-outs, not buttons: there is nothing for them to filter to. */}
      <span className="tb-sep"></span>
      {money("outstanding", inr(m.outstanding, { compact: true }), "warn")}
      <span className="tb-sep"></span>
      {money("collected", inr(m.collected, { compact: true }), "ok")}
    </span>
  );
}

/* Stage/Priority Select options, sourced from the API's own vocabulary once
   it has loaded — so a stage or priority row added server-side shows up here
   with no code edit. Falls back to the local D.STAGES/D.PRIORITY vocab (the
   pre-load state, and the pre-API baseline) while the first fetch is still
   in flight. Values stay legacy ints either way — see the comment above
   apiStageKey() in useDeals.ts for why the URL param can't just be the raw
   API key. */
function stageOptions(apiStages: { key: string; label: string; tone: string }[]) {
  return (apiStages.length ? apiStages.map((s) => ({ v: String(legacyStageInt(s)), l: s.label }))
    : ALL_STAGES.map((s) => ({ v: String(s), l: D.STAGES[s].label })));
}
function priorityOptions(apiPriorities: { key: string; label: string }[]) {
  return (apiPriorities.length ? apiPriorities.map((pr) => ({ v: String(legacyPriorityInt(pr)), l: pr.label }))
    : [{ v: "3", l: "Urgent" }, { v: "2", l: "High" }, { v: "1", l: "Normal" }]);
}

/* The panel's existing "no access" copy (registry.tsx's Denied, for the
   whole-module gate) — repeated here rather than imported, since that one is
   for a module you can't see at all and this is a 403 arriving mid-session
   from a live fetch. Same words, so the two never read as different rules. */
function DealsDenied() {
  return (
    <EmptyState icon="shield" title="You do not have access to this module"
      body="Deals is not in your effective access for this session. Access is granted by role, not requested per page — ask an Admin to review your role in Settings → Team." />
  );
}

/* ==========================================================================
   THE LIST WORKSPACE — Table and Pipeline. Reads the API directly (Chat and
   Tags, elsewhere in this module, still read the local engine).
   ====================================================================== */
export function DealsList({ id, p, api }: {
  id: string | null; p: Params; api: DealsApiState;
}) {
  const acts = useActs(p);
  const { onFilter, onSearch, onUnfilter } = useFilters(p, id);
  const view = p.view === "board" ? "board" : "table";
  /* `value` and the default order come back already sorted; stage age, close
     date and last activity are ordered here, over the page that arrived. */
  const rows = localSort(api.list, p.sort);

  const tagsHash = "#/deals" + qs(merge(p, { view: "tags" }));

  if (api.loading && !api.list.length) return <ListSkeleton />;
  if (api.forbidden) return <DealsDenied />;

  return (
    <div className="dls">
      {/* Neither a title nor a scope line here: both moved up beside the
          breadcrumb, so this page opens straight onto the controls. The two
          actions ride at the end of the command row rather than holding a
          header row of their own. */}
      <div className="dls-cmd">
        <SearchField ph="Search name, business, email, phone, city or deal ref…" val={p.q} onFilter={onSearch} />
        <Select name="stage" label="Stage" value={p.stage} onFilter={onFilter}
          options={stageOptions(api.stages)} />
        {head()
          ? <Select name="owner" label="Owner" value={p.owner} onFilter={onFilter}
              options={api.owners.map((o) => ({ v: String(o.id), l: o.name }))} />
          : null}
        <Select name="priority" label="Priority" value={p.priority} onFilter={onFilter}
          options={priorityOptions(api.priorities)} />
        <Select name="sort" label="Sort" value={p.sort} onFilter={onFilter}
          options={[{ v: "", l: "Sort: Newest first" }, { v: "age", l: "Stage age" },
            { v: "close", l: "Expected close" }, { v: "value", l: "Deal value" },
            { v: "act", l: "Last activity" }]} />
        <Select name="tag" label="List" value={p.tag} onFilter={onFilter}
          options={api.tags.map((t) => ({ v: t.slug, l: t.label }))} />
        {/* Managing tags belongs next to filtering by them, not in a list of
            ways to look at deals. */}
        <button className="btn icon" title="Manage lists" aria-label="Manage lists" data-go={tagsHash}
          onClick={() => go(tagsHash)}><Icon name="tag" /></button>
        <span className="spacer"></span>
        {/* The stall sweep also runs nightly on cron (sweep_stalled_deals).
            The button is for when you want the flags right now — after a
            weekend of catching up, say — and it is the same one call. */}
        {head()
          ? <button className="btn icon" data-act="dl-stall" title="Run the stall sweep now"
              aria-label="Run the stall sweep now" onClick={() => acts.stallJob()}>
              <Icon name="clock" /></button>
          : null}
        <button className="btn" data-act="dl-export" onClick={() => acts.exportCsv(rows)}>
          <Icon name="download" />Export
          {head() ? null : <span className="pill warn xs" style={{ marginLeft: "4px" }}>Head</span>}
        </button>
        {can("deals", "create")
          ? <button className="btn pri" data-act="dl-create" onClick={() => acts.create()}>
              <Icon name="plus" />Create deal</button>
          : null}
      </div>

      <AttnStrip p={p} m={api.counts} />

      <FilterChips params={omit(p, ["view"])} onUnfilter={onUnfilter}
        labels={{ q: "Search", stage: "Stage", owner: "Owner", priority: "Priority",
          next: "Next action", stalled: "Stalled", sort: "Sort", tag: "List" }} />

      <div className={"dls-body" + (view === "board" ? " is-board" : "")}>
        {view === "board"
          ? <Board list={rows} sel={id} p={p} />
          : <DealsTable list={rows} sel={id} p={p} onCreate={() => acts.create()} onClearFilters={() => onUnfilter("*")} />}
      </div>
    </div>
  );
}

function DealsTable({ list, sel, p, onCreate, onClearFilters }: {
  list: any[]; sel: string | null; p: Params; onCreate: () => void; onClearFilters: () => void;
}) {
  const filtered = !!(p.q || p.stage || p.owner || p.priority || p.next || p.stalled);
  const canCreate = can("deals", "create");
  if (!list.length) return (
    <EmptyState icon="deal"
      title={filtered ? "No deals match these filters" : "No deals yet"}
      body={filtered
        ? "Nothing in the pipeline matches. Clear a filter to widen the search."
        : "Nothing in the pipeline yet." +
          (canCreate ? " Create one for an inbound call, a walk-in or a referral." : "")}
      action={filtered
        ? <button className="btn" data-unfilter="*" onClick={onClearFilters}>Clear all filters</button>
        : (canCreate ? <button className="btn pri" data-act="dl-create" onClick={onCreate}>Create deal</button> : null)} />
  );

  return (
    <table className="tbl dls-tbl">
      <thead><tr>
        <th style={{ width: "3px" }}></th><th>Deal</th><th>Stage</th><th>Chain</th>
        <th className="n">Deal value</th><th>Owner</th><th>Next action</th>
      </tr></thead>
      <tbody>
        {list.map((d: any) => {
          const u = urgency(d);
          const to = dealHash(d.deal_id, p);
          return (
            <tr key={d.deal_id}
              className={"clickable" + (u ? " " + u.cls : "") + (d.stage >= STAGE.WON ? " dim" : "") +
                (sel === d.deal_id ? " on" : "")}
              data-go={to} onClick={() => go(to)}>
              <td className="rail"><i title={u ? u.why : undefined}></i></td>
              <td>
                <div className="cell-1">{d.customer_name}
                  {/* Business name rides beside the person, not on its own line
                      — most deals have one and it is how the office actually
                      refers to them. */}
                  {d.business_name ? <> <span className="faint">· {d.business_name}</span></> : null}
                  {d.is_stalled ? <> <span className="pill bad xs">Stalled</span></> : null}
                </div>
                <div className="cell-2 mono">
                  {d.deal_id} · {place(d)}{d.interested_in ? " · " + d.interested_in : ""}
                </div>
                <TagChips max={3} tags={d.tags} />
              </td>
              <td>
                <Pill text={D.STAGES[d.stage].label} tone={D.STAGES[d.stage].tone} />
                <div className="cell-2">{Math.abs(daysFrom(d.stage_since))}d in stage</div>
              </td>
              <td><ChainDots d={d} /></td>
              <td className="n dls-money"><MoneyCell d={d} /></td>
              <td><OwnerCell d={d} /></td>
              <td className="dls-na"><NextCell d={d} /></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* Pipeline board. Won and Lost are NOT columns: a closed deal is a record,
   not a work queue, and holding a third of the board for two settled stages
   squeezed the ones that still need working. They collapse into a settled
   rail instead. Installment IS a column — it is the stage where the most
   valuable deals sit for the longest, and a board that hides it hides the
   money still coming in.
   Drag is deliberately NOT wired: a board move must route through the same
   dialog as the drawer so the change is logged with an actor, and a silent
   drop is a stage change nobody can attribute later. */
function Board({ list, sel, p }: { list: any[]; sel: string | null; p: Params }) {
  const live = [STAGE.DEAL, STAGE.FOLLOWUP, STAGE.SLOT, STAGE.INSTALLMENT];
  const total = list.reduce((a: number, d: any) => a + (d.deal_value || 0), 0) || 1;
  const settled = list.filter((d: any) => d.stage >= STAGE.WON);

  return (
    <>
      <div className="dls-board">
        {live.map((st: number) => {
          const items = list.filter((d: any) => d.stage === st);
          const value = items.reduce((a: number, d: any) => a + (d.deal_value || 0), 0);
          return (
            <div className="dls-col" key={st}>
              <div className="dls-col-h">
                <div className="r1"><b>{D.STAGES[st].label}</b>
                  <span className="ct">{items.length}</span>
                  <span className="val tnum">{value ? inr(value, { compact: true }) : "—"}</span>
                </div>
                <div className="cap"><i style={{ width: Math.round(value / total * 100) + "%" }}></i></div>
              </div>
              <div className="dls-col-b">
                {items.length
                  ? items.map((d: any) => <BoardCard key={d.deal_id} d={d} sel={sel} p={p} />)
                  : <div className="faint" style={{ fontSize: "var(--text-sm)", padding: "6px 4px" }}>—</div>}
              </div>
            </div>
          );
        })}
        <SettledRail settled={settled} p={p} />
      </div>
      <Notice ico="alert" text={<><b>Drag-to-move is deliberately absent.</b> A board move must route through the same guard modal as the drawer — a silent drop the server then refuses is worse than no drag at all.</>} />
    </>
  );
}

function BoardCard({ d, sel, p }: { d: any; sel: string | null; p: Params }) {
  const u = urgency(d);
  const days = d.next_action ? daysFrom(d.next_action.date) : null;
  /* The board's job is spotting what is rotting, so the card leads with the
     reason it is flagged and falls back to the next action only when calm. */
  const tail = d.is_stalled ? <span className="flag">stalled</span>
    : days !== null && days < 0 ? <span className="flag">{Math.abs(days)}d overdue</span>
    : d.next_action ? d.next_action.note : "";
  const to = dealHash(d.deal_id, p);
  return (
    <button className={"dls-card" + (u ? " " + u.cls : "") + (sel === d.deal_id ? " on" : "")}
      data-go={to} onClick={() => go(to)}>
      <div className="n1"><span className="nm">{d.customer_name}</span><span className="rf">{d.deal_id}</span></div>
      <div className="n2">
        <ChainDots d={d} />
        {/* The deal's own value. null means nothing has been quoted yet, which
            is not the same as zero and must not render as one. */}
        <span className="amt tnum">{d.deal_value ? inr(d.deal_value, { compact: true }) : "—"}</span>
      </div>
      <div className="age">{Math.abs(daysFrom(d.stage_since))}d in stage{tail ? <> · {tail}</> : null}</div>
    </button>
  );
}

function SettledRail({ settled, p }: { settled: any[]; p: Params }) {
  const won = settled.filter((d: any) => d.stage === STAGE.WON);
  const lost = settled.filter((d: any) => d.stage === STAGE.LOST);
  const sum = (a: any[]) => a.reduce((x: number, d: any) => x + (d.deal_value || 0), 0);
  return (
    <div className="dls-settled">
      <h4>Settled · {settled.length}</h4>
      {settled.length
        ? settled.map((d: any) => {
            const to = dealHash(d.deal_id, p);
            return (
              <button key={d.deal_id} className="dls-srow" data-go={to} onClick={() => go(to)}>
                <span className={"dot " + (d.stage === STAGE.WON ? "ok" : "bad")} title={D.STAGES[d.stage].label}></span>
                <span className="t">{d.customer_name}</span>
                <span className="a tnum">{d.deal_value ? inr(d.deal_value, { compact: true }) : "—"}</span>
              </button>
            );
          })
        : <div className="faint" style={{ fontSize: "var(--text-sm)" }}>Nothing closed yet.</div>}
      <div className="faint" style={{ fontSize: "var(--text-xs)", lineHeight: 1.5 }}>
        {won.length} won · {inr(sum(won), { compact: true })} · {lost.length} lost · {inr(sum(lost), { compact: true })}
      </div>
    </div>
  );
}
