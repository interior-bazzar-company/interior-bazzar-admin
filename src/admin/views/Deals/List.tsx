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
  ALL_STAGES, D, E, STAGE, STRIP_STAGES, dealHash, head, inr, merge, omit, place, urgency, useFilters
} from "./useDeals";
import type { Params } from "./useDeals";
import { ChainDots, MoneyCell, NextCell, OwnerCell, TagChips } from "./bits";
import { useActs } from "./Modals";

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
export function AttnStrip({ p, m }: {
  p: Params;
  m: { byStage: Record<number, number>; outstanding: number; collected: number; total: number };
}) {
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
       hand's width of nothing between Won and the figure Won produces. They
       are the same thought — the funnel, and what came out of it. */
    "sep",
    { k: "outstanding", v: inr(m.outstanding, { compact: true }), tone: "warn" },
    "sep",
    { k: "collected", v: inr(m.collected, { compact: true }), tone: "ok" }
  ];
  return <StatStrip cells={cells} />;
}

/* The strip again, sized for the topbar. Chat's body is three panes wide with
   nothing left over, so its counts go beside the title — same cells, same
   order, same filtering, and the routes keep `view` so pressing one narrows
   the chat list rather than throwing you back to the table. */
export function TbStats({ p, scope }: { p: Params; scope: any[] }) {
  const byStage: Record<number, number> = {};
  scope.forEach((d: any) => { byStage[d.stage] = (byStage[d.stage] || 0) + 1; });
  const cell = (k: string, v: number, route: string, on: boolean, dot?: string) => (
    <button key={k} className={"tb-stat" + (on ? " on" : "")} data-go={route} title={v + " " + k}
      onClick={() => go(route)}>
      {dot !== undefined ? <span className={"dls-cdot " + dot}></span> : null}
      <span className="v tnum">{v}</span><span className="k">{k}</span>
    </button>
  );
  return (
    <span className="tb-stats">
      {cell("total", scope.length,
        "#/deals" + qs(omit(p, ["stage", "stalled", "next", "priority"])),
        !p.stage && !p.stalled && !p.next && !p.priority)}
      {STRIP_STAGES.map((s) => cell(D.STAGES[s].label.toLowerCase(), byStage[s] || 0,
        "#/deals" + qs(merge(p, { stage: String(p.stage) === String(s) ? "" : s })),
        String(p.stage) === String(s), D.STAGES[s].tone || ""))}
    </span>
  );
}

/* The strip's other half — the two money read-outs — sitting immediately
   after Won, because that is the cell that produces them. Not buttons, and
   styled a shade quieter, because neither one filters anything. */
export function TbMoney({ outstanding, collected }: { outstanding: number; collected: number }) {
  const ro = (k: string, v: string, tone: string) => (
    <span className={"tb-stat ro " + tone} title={v + " " + k}>
      <span className="v tnum">{v}</span><span className="k">{k}</span>
    </span>
  );
  return (
    <span className="tb-money">
      {ro("outstanding", inr(outstanding, { compact: true }), "warn")}
      {ro("collected", inr(collected, { compact: true }), "ok")}
    </span>
  );
}

/* ==========================================================================
   THE LIST WORKSPACE
   ====================================================================== */
export function DealsList({ id, p, scope, list, outstanding, collected }: {
  id: string | null; p: Params; scope: any[]; list: any[]; outstanding: number; collected: number;
}) {
  const acts = useActs(p);
  const { onFilter, onSearch, onUnfilter } = useFilters(p, id);
  const view = p.view === "board" ? "board" : "table";

  /* Counted over `scope`, not `list` — the strip has to keep showing what a
     stage holds while you are standing inside another one, or the cell you
     need to click next reads 0. */
  const byStage: Record<number, number> = {};
  scope.forEach((d: any) => { byStage[d.stage] = (byStage[d.stage] || 0) + 1; });

  const tagsHash = "#/deals" + qs(merge(p, { view: "tags" }));

  return (
    <div className="dls">
      {/* Neither a title nor a scope line here: both moved up beside the
          breadcrumb, so this page opens straight onto the controls. The two
          actions ride at the end of the command row rather than holding a
          header row of their own. */}
      <div className="dls-cmd">
        <SearchField ph="Search name, business, email, phone, city or deal ref…" val={p.q} onFilter={onSearch} />
        <Select name="stage" label="Stage" value={p.stage} onFilter={onFilter}
          options={ALL_STAGES.map((s) => ({ v: String(s), l: D.STAGES[s].label }))} />
        {head()
          ? <Select name="owner" label="Owner" value={p.owner} onFilter={onFilter}
              options={E.Assignment.roster().members.map((m: any) => String(m.id))} />
          : null}
        <Select name="priority" label="Priority" value={p.priority} onFilter={onFilter}
          options={[{ v: "3", l: "Urgent" }, { v: "2", l: "High" }, { v: "1", l: "Normal" }]} />
        <Select name="sort" label="Sort" value={p.sort} onFilter={onFilter}
          options={[{ v: "", l: "Sort: Newest first" }, { v: "age", l: "Stage age" },
            { v: "close", l: "Expected close" }, { v: "value", l: "Deal value" },
            { v: "out", l: "Outstanding" }, { v: "act", l: "Last activity" }]} />
        <Select name="tag" label="List" value={p.tag} onFilter={onFilter}
          options={E.Tags.all().map((t: any) => ({ v: String(t.slug), l: t.label + " (" + t.count + ")" }))} />
        {/* Managing tags belongs next to filtering by them, not in a list of
            ways to look at deals. */}
        <button className="btn icon" title="Manage lists" aria-label="Manage lists" data-go={tagsHash}
          onClick={() => go(tagsHash)}><Icon name="tag" /></button>
        <span className="spacer"></span>
        <button className="btn" data-act="dl-export" onClick={() => acts.exportCsv()}>
          <Icon name="download" />Export
          {head() ? null : <span className="pill warn xs" style={{ marginLeft: "4px" }}>Head</span>}
        </button>
        {can("deals", "create")
          ? <button className="btn pri" data-act="dl-create" onClick={() => acts.create()}>
              <Icon name="plus" />Create deal</button>
          : null}
      </div>

      <AttnStrip p={p} m={{ byStage, outstanding, collected, total: scope.length }} />

      <FilterChips params={omit(p, ["view"])} onUnfilter={onUnfilter}
        labels={{ q: "Search", stage: "Stage", owner: "Owner", priority: "Priority",
          next: "Next action", stalled: "Stalled", sort: "Sort", tag: "List" }} />

      <div className={"dls-body" + (view === "board" ? " is-board" : "")}>
        {view === "board"
          ? <Board list={list} sel={id} p={p} />
          : <DealsTable list={list} sel={id} p={p} onCreate={() => acts.create()} onClearFilters={() => onUnfilter("*")} />}
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
        : "Deals arrive from the funnel and are assigned by round-robin." +
          (canCreate ? " You can also create one for off-funnel business." : "")}
      action={filtered
        ? <button className="btn" data-unfilter="*" onClick={onClearFilters}>Clear all filters</button>
        : (canCreate ? <button className="btn pri" data-act="dl-create" onClick={onCreate}>Create deal</button> : null)} />
  );

  return (
    <table className="tbl dls-tbl">
      <thead><tr>
        <th style={{ width: "3px" }}></th><th>Deal</th><th>Stage</th><th>Chain</th>
        <th className="n">Value · collected</th><th>Owner</th><th>Next action</th>
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
                  {d.deal_id} · {place(d)} · {d.interested_in}
                  {d.duplicate_count ? <> <span title="repeat submissions">·{d.duplicate_count}</span></> : null}
                </div>
                <TagChips dealId={d.deal_id} max={3} />
              </td>
              <td>
                <Pill text={D.STAGES[d.stage].label} tone={D.STAGES[d.stage].tone} />
                <div className="cell-2">{Math.abs(D.days(D.d(d.stage_since)))}d in stage</div>
              </td>
              <td><ChainDots dl={d} /></td>
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
  const days = d.next_action ? D.days(D.d(d.next_action.date)) : null;
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
      <div className="n2"><ChainDots dl={d} />
        <span className="amt tnum">{d.outstanding ? inr(d.outstanding, { compact: true })
          : d.deal_value ? "₹0" : "—"}</span>
      </div>
      <div className="age">{Math.abs(D.days(D.d(d.stage_since)))}d in stage{tail ? <> · {tail}</> : null}</div>
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
