/* =============================================================================
   Quotation — the list
   ============================================================================= */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { EmptyState, FilterChips, Icon, Pill, SearchField, Select, StatStrip, qs } from "../../ui";
import { useNav } from "../../shell/AdminShell";
import type { StatCell } from "../../ui";
import { D, Q, actor, expiringSoon, head, inr, merge, omit, sorter, staleDraft, uniq, urgency, validityChip } from "./core";
import { useFilters, useQtActions } from "./useQuotations";

const STATUSES = ["draft", "issued", "accepted", "rejected", "expired", "superseded", "cancelled"];

export default function List({ p }: { p: Record<string, string> }) {
  const { go } = useNav();
  const act = useQtActions();
  const { onFilter, onSearch, onUnfilter } = useFilters(p, "#/quotations");
  const me = actor();

  // No background jobs in this prototype — the expiry sweep runs here instead,
  // once per list render. Idempotent: only genuinely-expired ISSUED rows flip.
  Q.Automation.runExpiry();
  const a = Q.Analytics.summary(me);
  const all: any[] = a.all.slice();
  let rows: any[] = all.slice();

  /* ONE filter param instead of three. `expiring`, `stale` and
     `accepted-month` are attention filters rather than document states, but
     they behave exactly like one — pick it, the list narrows — so they ride
     in the Status control instead of holding three tiles of their own. The
     legacy `?stale=1` and `?accepted=month` links the dashboard still emits
     are normalised into it here, so no existing link breaks. */
  const st = p.status || (p.stale === "1" ? "stale"
    : p.accepted === "month" ? "accepted-month" : "");

  if (st === "expiring") rows = rows.filter(expiringSoon);
  else if (st === "stale") rows = rows.filter(staleDraft);
  else if (st === "accepted-month") rows = rows.filter((q: any) =>
    q.status === Q.ST.ACCEPTED && q.accepted_at &&
    q.accepted_at.slice(0, 7) === Q.todayISO().slice(0, 7));
  else if (st) rows = rows.filter((q: any) => q.status === st);
  if (p.deal) rows = rows.filter((q: any) => q.deal_id === p.deal);
  if (p.owner) rows = rows.filter((q: any) => q.owner === p.owner);
  if (p.q) {
    const s = p.q.toLowerCase();
    rows = rows.filter((q: any) =>
      ((q.quotation_number || "draft") + " " + q.deal_id + " " +
        (Q.partyOf(q).name || "")).toLowerCase().indexOf(s) >= 0);
  }
  // Latest-created-first is the default — true insertion order (DB.quotations
  // is append-only), not updated_at, so an old draft edited today does not
  // jump to the top.
  const order = new Map<any, number>(); all.forEach((q, i) => order.set(q, i));
  rows.sort(sorter(p.sort, order));

  const filtered = !!(p.q || st || p.deal || p.owner);

  /* Clicking the cell you are already on clears it, so the strip is never a
     trap you have to leave through the chip row. Same rule as Deals. */
  const statusRoute = (v: string) =>
    "#/quotations" + qs(merge(omit(p, ["stale", "accepted"]), { status: st === v ? "" : v }));

  const chipParams = merge(omit(p, ["stale", "accepted"]), { status: st });
  const anyChip = Object.keys(chipParams).some((k) => chipParams[k] && k !== "tab");

  const cells: (StatCell | "sep")[] = [
    { k: "total", v: all.length, to: statusRoute(""), on: !st },
    "sep",
    { k: "draft", v: a.byStatus.draft || 0, dot: "", to: statusRoute("draft"), on: st === "draft" },
    { k: "issued", v: a.byStatus.issued || 0, dot: "info", to: statusRoute("issued"), on: st === "issued" },
    { k: "accepted", v: a.byStatus.accepted || 0, dot: "ok", to: statusRoute("accepted"), on: st === "accepted" },
    "sep",
    /* Expiring is the one attention count that earns a cell: it is revenue
       about to need re-working, and it is the only number here that gets
       worse while nobody looks at it. */
    {
      k: "expiring", v: a.expiring, dot: a.expiring ? "bad" : "", tone: a.expiring ? "bad" : "",
      to: statusRoute("expiring"), on: st === "expiring",
      title: "Issued quotations within 3 days of lapsing"
    },
    "sep",
    {
      k: "awaiting", v: inr(a.valueByStatus.issued || 0, { compact: true }), tone: "warn",
      title: "Value of quotations issued and not yet answered"
    },
    "sep",
    {
      k: "agreed", v: inr(a.valueByStatus.accepted || 0, { compact: true }), tone: "ok",
      title: "Value of accepted quotations — the agreed value written back to the deals"
    }
  ];

  return (
    <div className="dls">
      {/* No page header. The title moved up beside the Back slot in the topbar,
          and the scope line it used to carry — "All 14 team quotations · 3
          awaiting a response" — was a third rendering of counts the strip below
          already gives per status, sitting where you cannot click it. A number
          you can only read is worth less than the same number you can filter by.
          Same reasoning, same result, as the Deals page. */}
      <div className="dls-cmd">
        <SearchField ph="Search quotation no, deal ref or customer…" val={p.q} onFilter={onSearch} />
        <Select name="status" label="Status" value={st} onFilter={onFilter}
          options={STATUSES.map((s2) => ({ v: s2, l: Q.LABEL[s2] + " (" + (a.byStatus[s2] || 0) + ")" })).concat([
            { v: "expiring", l: "Expiring ≤3 days (" + a.expiring + ")" },
            { v: "stale", l: "Drafts older than 7d (" + a.staleDrafts + ")" },
            { v: "accepted-month", l: "Accepted this month (" + a.acceptedThisMonth + ")" }
          ])} />
        {head()
          ? <Select name="owner" label="Owner" value={p.owner} onFilter={onFilter}
              options={uniq(all.map((q: any) => q.owner))} />
          : null}
        <Select name="sort" label="Sort" value={p.sort} onFilter={onFilter} options={[
          { v: "", l: "Sort: Newest first" }, { v: "valid", l: "Valid until" },
          { v: "value", l: "Value" }, { v: "issued", l: "Issued date" }]} />
        <span className="spacer"></span>
        {/* Locked actions are ABSENT, not disabled — Export CSV is a Sales Head
            action, so it simply is not part of the bar for anyone else. */}
        {head()
          ? <button className="btn" data-act="qt-export" onClick={() => act.export()}>
              <Icon name="download" />Export</button>
          : null}
        <button className="btn pri" data-go="#/quotations?new=1" onClick={() => go("#/quotations?new=1")}>
          <Icon name="plus" />Create quotation</button>
      </div>

      {/* Ten tiles became one strip. Seven status tiles and three attention
          tiles stacked two bands of chrome above the first row of actual work,
          and every one of them was a filter wearing a card. The strip carries
          the same filters in one line: the three states a quotation is WORKED
          through, then the money those states hold.

          Rejected, Expired, Superseded and Cancelled are not cells. They are
          where a quotation leaves the funnel, not a position in it — the same
          reason Lost is not a cell on the Deals strip — and each is one pick
          away in the Status control above. */}
      <StatStrip cells={cells} />

      {anyChip
        ? <div className="dls-chips">
            <FilterChips params={chipParams} onUnfilter={onUnfilter}
              labels={{ q: "Search", status: "Status", owner: "Owner", deal: "Deal", sort: "Sort" }} />
          </div>
        : null}

      <div className="dls-body"><QuotationTable rows={rows} filtered={filtered} /></div>
    </div>
  );
}

/* The Deals table, wearing quotation facts. Same 3px urgency rail, same
   two-line first cell, same `dim` for records that are history rather than
   work — because a sales agent moving between the two pages should not have
   to learn a second way of reading a row.                                   */
function QuotationTable({ rows, filtered }: { rows: any[]; filtered: boolean }) {
  const { go } = useNav();
  if (!rows.length)
    return (
      <EmptyState icon="quote"
        title={filtered ? "No quotations match these filters" : "No quotations yet"}
        body={filtered
          ? "Nothing matches. Clear a filter to widen the search."
          : "A quotation is always created inside a deal — that is the whole of QT-BR-02. Start from a deal, or use Create quotation and pick one."}
        action={filtered
          ? <button className="btn" data-unfilter="*" onClick={() => go("#/quotations")}>Clear all filters</button>
          : <button className="btn pri" data-go="#/quotations?new=1" onClick={() => go("#/quotations?new=1")}>Create quotation</button>} />
    );

  return (
    <table className="tbl dls-tbl">
      <thead><tr>
        <th style={{ width: "3px" }}></th><th>Quotation</th><th>Status</th><th>Deal</th>
        <th className="n">Value</th><th>Valid until</th>{head() ? <th>Owner</th> : null}
      </tr></thead>
      <tbody>
        {rows.map((q: any) => {
          const u = urgency(q);
          const chain = Q.forDeal(q.deal_id).length;
          const dead = ["superseded", "cancelled", "rejected", "expired"].indexOf(q.status) >= 0;
          const to = "#/quotations/" + (q.quotation_number || q.quotation_id);
          return (
            <tr key={q.quotation_id} className={"clickable" + (u ? " " + u.cls : "") + (dead ? " dim" : "")}
              data-go={to} onClick={() => go(to)}>
              <td className="rail"><i title={u ? u.why : undefined}></i></td>
              {/* Number leads, customer underneath — the same shape as the Deals
                  table's name-then-reference cell, read the other way round because
                  here the reference IS the record's name. */}
              <td>
                <div className="cell-1 mono">
                  {q.quotation_number
                    ? <>{q.quotation_number} <span className="pill xs">v{q.version}</span></>
                    : <><span className="faint">Assigned on issue</span> <span className="pill xs">v{q.version}</span></>}
                </div>
                <div className="cell-2">
                  {Q.partyOf(q).name || "—"}
                  {chain > 1 ? <> <span className="faint">· +{chain - 1} older</span></> : null}
                </div>
              </td>
              <td>
                <Pill text={Q.LABEL[q.status]} tone={Q.TONE[q.status]} />
                <div className="cell-2">
                  {q.issued_at ? "issued " + D.fmtDate(q.issued_at) : "made " + D.fmtDate(q.created_at)}
                </div>
              </td>
              {/* Plain text, not a link. A row with a link inside it has two click
                  targets and no way to tell them apart until after the jump — press
                  the middle of this row and you could land on the deal instead of
                  the quotation you were aiming at. Every cell in the Deals table is
                  inert for the same reason: the row is the target, and the deal is
                  one press away from the quotation itself. */}
              <td className="mono cell-2">{q.deal_id}</td>
              <td className="n tnum">{q.grand_total_paise ? inr(q.grand_total_paise) : <span className="faint">—</span>}</td>
              <td>{validityChip(q)}</td>
              {head() ? <td>{q.owner || "—"}</td> : null}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* The old layout is gone rather than kept behind a flag: a page header, ten
   tiles across two bands and a count line, all of which the command row and
   the strip above now carry in two. The one thing worth keeping out of it is
   the reason there is still no board view here — a quotation is a document,
   not a pipeline stage, and a kanban of documents would be the Deals view
   wearing the wrong hat. That is a design decision, not a screen element, so
   it lives in this comment instead of in a notice under every table. */
