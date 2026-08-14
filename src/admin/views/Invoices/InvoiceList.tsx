/* =============================================================================
   LIST — a receivables view
   -----------------------------------------------------------------------------
   A quotation list answers *what have we offered?* An invoice list answers
   **who owes us money, and how late are they?**
   ============================================================================= */
import { EmptyState, FilterChips, Icon, Pill, SearchField, Select, StatStrip, qs } from "../../ui";
import type { StatCell } from "../../ui";
import { IBData, IBInvoice } from "../../engines";
import { actor, billingCell, head, inr, isOverdue, merge, overdueDays, quoteNumberOf, sorter, uniq, urgency } from "./helpers";
import type { Params } from "./useInvoices";

const D = IBData, N = IBInvoice;

export function InvoiceList({ p, setFilter, unfilter, go, onExport }: {
  p: Params;
  setFilter: (name: string, value: string) => void;
  unfilter: (key: string) => void;
  go: (hash: string) => void;
  onExport: () => void;
}) {
  const me = actor();
  const a = N.Analytics.summary(me);
  const all = a.all.slice();
  let rows = all.slice();

  /* `overdue` is an attention filter rather than a document state, but it
     behaves exactly like one — pick it, the list narrows — so it rides in the
     same control instead of holding a tile of its own. Same move Quotations
     made with expiring / stale / accepted-this-month. */
  if (p.doc === "overdue") rows = rows.filter(isOverdue);
  else if (p.doc) rows = rows.filter(function (i: any) { return i.invoice_status === p.doc; });
  if (p.deal) rows = rows.filter(function (i: any) { return i.deal_id === p.deal; });
  if (p.owner) rows = rows.filter(function (i: any) { return i.owner === p.owner; });
  if (p.q) {
    const s = p.q.toLowerCase();
    rows = rows.filter(function (i: any) {
      const qn = quoteNumberOf(i);
      return ((i.invoice_number || "draft") + " " + i.deal_id + " " + (qn || "") + " " +
              (N.billedTo(i).name || "")).toLowerCase().indexOf(s) >= 0; });
  }
  // Latest-created-first is the default — true insertion order (DB.invoices
  // is append-only), not updated_at, so an old invoice edited today does not
  // jump to the top.
  const order = new Map<any, number>(); all.forEach(function (i: any, ix: number) { order.set(i, ix); });
  rows.sort(sorter(p.sort, order));

  const filtered = !!(p.q || p.doc || p.deal || p.owner);
  const overdue = all.filter(isOverdue).length;

  /* Clicking the cell you are already on clears it, so the strip is never a
     trap you have to leave through the chip row. Same rule as Deals. */
  function docRoute(v: string) {
    return "#/invoices" + qs(merge(p, { doc: p.doc === v ? "" : v }));
  }

  const cells: (StatCell | "sep")[] = [
    { k: "total", v: all.length, to: docRoute(""), on: !p.doc },
    "sep",
    { k: "draft", v: a.byDoc.draft || 0, dot: "", to: docRoute("draft"), on: p.doc === "draft" },
    { k: "paid", v: a.byDoc.issued || 0, dot: "ok", to: docRoute("issued"), on: p.doc === "issued" },
    "sep",
    { k: "overdue", v: overdue, dot: overdue ? "bad" : "", tone: overdue ? "bad" : "",
      to: docRoute("overdue"), on: p.doc === "overdue",
      /* Drafts count. An invoice nobody issued, whose own due date has
         already passed, is the most overdue thing on this page — it is
         money that was never even asked for. Saying "issued and unpaid"
         here would have been a label that excluded the worst case while
         the count included it. */
      title: "Past its due date with the money still not logged — issued or not" },
    "sep",
    { k: "invoiced", v: inr(a.invoiced, { compact: true }),
      title: "Issued and not cancelled" },
    "sep",
    { k: "received", v: inr(a.received, { compact: true }), tone: "ok",
      title: "From the deal ledger — Finance's figure, not one recomputed here" },
    "sep",
    { k: "outstanding", v: inr(a.outstanding, { compact: true }),
      tone: a.outstanding ? "bad" : "",
      title: "Stuck after Issue — needs Log payment on the deal" }
  ];

  return (
    <div className="dls">
      {/* No page header. The title moved up into the topbar, and the scope line
          it carried — "All 9 team invoices" — is the strip's first cell, where
          it is also the control that clears every filter. */}
      <div className="dls-cmd">
        <SearchField ph="Search invoice no, deal, quote or customer…" val={p.q} onFilter={setFilter} />
        <Select name="doc" label="Status" value={p.doc} onFilter={setFilter}
          options={["draft", "issued", "cancelled"].map(function (st) {
            return { v: st, l: N.DOC_LABEL[st] + " (" + (a.byDoc[st] || 0) + ")" }; }).concat([
            { v: "overdue", l: "Overdue (" + overdue + ")" }])} />
        {head() ? <Select name="owner" label="Owner" value={p.owner} onFilter={setFilter}
          options={uniq(all.map(function (i: any) { return i.owner; }))} /> : null}
        <Select name="sort" label="Sort" value={p.sort} onFilter={setFilter}
          options={[{ v: "", l: "Sort: Newest first" }, { v: "due", l: "Due date" },
            { v: "amount", l: "Amount" }, { v: "date", l: "Invoice date" }]} />
        <span className="spacer"></span>
        <button className="btn" data-act="in-export" onClick={onExport}>
          <Icon name="download" />Export
          {head() ? null : <span className="pill warn xs" style={{ marginLeft: "4px" }}>Head</span>}
        </button>
        <button className="btn pri" data-go="#/invoices?new=1" onClick={() => go("#/invoices?new=1")}>
          <Icon name="plus" />Create invoice</button>
      </div>

      {/* Six tiles became one strip: three money cards and three status cards,
          stacked in two bands above the first row of actual work.

          Cancelled is not a cell. It is where an invoice leaves the run, not a
          position in it — the same reason Lost is not a cell on Deals and
          Superseded is not one on Quotations — and it is one pick away in the
          Status control. Overdue takes its place, because that is the number
          that gets worse while nobody looks at it.

          "Outstanding" is the rare case, not the normal one: an invoice is
          never issued unpaid, so it is only non-zero when the ledger write
          right after Issue failed and nobody logged the payment by hand. It
          stays a read-out, tinted only when it is actually non-zero. */}
      <StatStrip cells={cells} />

      <FilterChipRow p={p} unfilter={unfilter} />

      <div className="dls-body"><InvoiceTable rows={rows} filtered={filtered} go={go} unfilter={unfilter} /></div>
    </div>
  );
}

/* The prototype wrapped filterChips in `.dls-chips` and rendered nothing at
   all when there were none; FilterChips already returns null when empty, so
   the wrapper has to disappear with it. */
function FilterChipRow({ p, unfilter }: { p: Params; unfilter: (k: string) => void }) {
  const labels = { q: "Search", doc: "Status", owner: "Owner", deal: "Deal", sort: "Sort" };
  const any = Object.keys(labels).some((k) => (p as Record<string, string | undefined>)[k]);
  if (!any) return null;
  return <div className="dls-chips"><FilterChips params={p as Record<string, string | undefined>} labels={labels} onUnfilter={unfilter} /></div>;
}

/* The Deals table, wearing invoice facts — same 3px urgency rail, same
   two-line cells, same one-money-cell-with-a-bar, same `dim` for records
   that are history rather than work.

   Ten columns became seven. Amount / Received / Balance were three columns
   asking the reader to do the subtraction; they are one cell with a bar now,
   exactly as Deals shows value against collected. Deal and Quote were two
   reference columns; they are one chain cell, the nearer link under the
   further one. Billing moved under the invoice number, where the customer
   already was — it is a fact ABOUT this invoice, not a column to scan. */
function InvoiceTable({ rows, filtered, go, unfilter }: {
  rows: any[]; filtered: boolean; go: (h: string) => void; unfilter: (k: string) => void;
}) {
  if (!rows.length) return (
    <EmptyState
      icon="invoice"
      title={filtered ? "No invoices match these filters" : "No invoices yet"}
      body={filtered ? "Nothing matches. Clear a filter to widen the search."
        : <>An invoice is raised against an <b>accepted quotation</b>, for a receipt — not for the
          deal total. Start from a deal that has one.</>}
      action={filtered
        ? <button className="btn" data-unfilter="*" onClick={() => unfilter("*")}>Clear all filters</button>
        : <button className="btn pri" data-go="#/invoices?new=1" onClick={() => go("#/invoices?new=1")}>Create invoice</button>} />
  );

  return (
    <table className="tbl dls-tbl">
      <thead><tr>
        <th style={{ width: "3px" }}></th><th>Invoice</th><th>Status</th><th>Chain</th>
        <th className="n">Amount · received</th><th>Due</th>{head() ? <th>Owner</th> : null}
      </tr></thead>
      <tbody>
        {rows.map(function (i: any) {
          const u = urgency(i);
          const plan = N.planOf(i.invoice_id);
          const qn = quoteNumberOf(i);
          const billing = billingCell(plan) + (N.addonsOf(i.invoice_id).length ? " + setup" : "");
          const to = "#/invoices/" + (i.invoice_number || i.invoice_id);
          return (
            <tr key={i.invoice_id}
              className={"clickable" + (u ? " " + u.cls : "") + (i.invoice_status === "cancelled" ? " dim" : "")}
              data-go={to} onClick={() => go(to)}>
              <td className="rail"><i title={u ? u.why : undefined}></i></td>
              <td>
                <div className="cell-1 mono">{i.invoice_number
                  ? i.invoice_number : <span className="faint">Assigned on issue</span>}</div>
                <div className="cell-2">{N.billedTo(i).name || "—"}
                  {billing && billing !== "—" ? <> <span className="faint">· {billing}</span></> : null}
                </div>
              </td>
              <td><Pill text={N.DOC_LABEL[i.invoice_status]} tone={N.DOC_TONE[i.invoice_status]} />
                <div className="cell-2">{i.issued_at ? "issued " + D.fmtDate(i.issued_at)
                  : "made " + D.fmtDate(i.invoice_date || i.created_at)}</div></td>
              {/* Plain text, not links. A row with links inside it has three click
                  targets and no way to tell them apart until after the jump — and
                  both records are one press away from the invoice itself. */}
              <td><div className="cell-1 mono">{i.deal_id}</div>
                <div className="cell-2 mono">{qn ? qn : "—"}</div></td>
              <td className="n dls-money"><MoneyCell i={i} /></td>
              <td><DueCell inv={i} /></td>
              {head() ? <td>{i.owner || "—"}</td> : null}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* Amount, and how much of it has landed — one cell, one bar, one sentence.
   Three number columns made the reader subtract; this says the same thing at
   a glance and matches the Deals table cell for cell. The payment-proof count
   rides here because proofs are evidence FOR the money, and it is the only
   place on this page that says the evidence exists — they are structurally
   internal and never touch the document. */
function MoneyCell({ i }: { i: any }) {
  const amt = i.grand_total_paise, got = N.received(i), bal = N.balance(i);
  if (i.invoice_status === N.DOC.CANCELLED)
    return <>
      <div className="amt tnum faint">{inr(amt)}</div>
      <div className="sub">cancelled</div>
    </>;
  const proofs = N.proofsOf(i.invoice_id).length;
  const shots = proofs
    ? <> <span title="Internal evidence, never on the document"><Icon name="shield" size="sm" />{proofs}</span></>
    : null;
  if (!got) return <>
    <div className="amt tnum">{inr(amt)}</div>
    <div className="sub"><b>nothing received</b>{shots}</div>
  </>;
  const pct = Math.max(0, Math.min(100, Math.round(got / amt * 100)));
  return <>
    <div className="amt tnum">{inr(amt)}</div>
    <div className="bar"><i style={{ width: pct + "%" }}></i></div>
    <div className="sub">{bal ? <>{pct}% · {inr(bal)} <b>balance</b></> : "fully received"}{shots}</div>
  </>;
}

export function DueCell({ inv }: { inv: any }) {
  if (inv.invoice_status === N.DOC.CANCELLED) return <span className="faint">—</span>;
  const over = overdueDays(inv);
  if (inv.payment_id) return <span className="faint">{D.fmtDate(inv.due_date)}</span>;
  return <>{D.fmtDate(inv.due_date)}
    {over
      ? <div className="cell-2" style={{ color: "var(--bad)", fontWeight: 500 }}>+{over}d</div>
      : <div className="cell-2">in {N.daysUntil(inv.due_date)}d</div>}
  </>;
}
