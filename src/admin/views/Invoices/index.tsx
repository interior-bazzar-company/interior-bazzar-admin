/* =====================================================================
   INVOICES — the list. Same five bands as Quotations/Deals/Plans.
   ===================================================================== */
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { inr, fmtDate } from "../../ui/format";
import { EmptyState, FilterChips, Notice, Pill, SearchField, Select, StatStrip, TbTitle, qs, Icon } from "../../ui";
import type { StatCell } from "../../ui";
import { can, useNav, usePageChrome } from "../../shell/AdminShell";
import { getSession } from "../../auth/session";
import { useShell } from "../../shell/ShellContext";
import { ListSkeleton } from "../../ui";
import { STATUS_LABEL, STATUS_TONE, useInvoicesList } from "./api";
import type { InvoiceRow } from "./api";
import { addonsOf, planItemOf } from "./helpers";
import { daysFrom, relativeDate } from "../Deals/useDeals";
import InvoiceDetail from "./Detail";
import InvoiceBuilder from "./Builder";
import InvoicePreview from "./Preview";
import PickInvoice from "./PickDeal";

const STATUSES = ["draft", "issued", "cancelled"];
const NEW_HASH = "#/invoices?new=1";

/* THE MODULE ROUTER — list / detail / builder / preview, the four screens the
   prototype has (views-invoice.js). No drawer: see Quotations/index.tsx. */
export default function Invoices() {
  const raw = useParams().id;
  const id = raw ? Number(raw) : null;
  const [sp] = useSearchParams();
  const mode = sp.get("mode") || "";
  const tab = sp.get("tab") || "plan";
  /* `?new=1` is step 1 of creating one -- a page, not a dialog over the list,
     exactly as Quotations does it. `&deal=` is its second half. See
     PickDeal.tsx. */
  if (!id && sp.get("new") === "1") return <PickInvoice dealRef={sp.get("deal") || ""} />;
  const routeParams: Record<string, string> = {};
  sp.forEach((v, k) => { if (k !== "mode") routeParams[k] = v; });
  if (id && mode === "preview") return <InvoicePreview id={id} params={routeParams} />;
  if (id && mode === "edit") return <InvoiceBuilder id={id} params={routeParams} />;
  if (id) return <InvoiceDetail id={id} tab={tab} params={routeParams} />;
  return <InvoicesList />;
}

function InvoicesList() {
  const [sp] = useSearchParams();
  const { go } = useNav();
  const { toast } = useShell();

  const params: Record<string, string> = {};
  sp.forEach((v, k) => { params[k] = v; });
  const p = { q: params.q || "", status: params.status || "", owner: params.owner || "", sort: params.sort || "" };

  /* The WHOLE page, then narrowed below -- same reason Quotations fetches
     unfiltered: the strip has to keep counting the states you are NOT looking
     at, and a server-side `?status=` makes every other cell read 0 the moment
     you pick one.
     ponytail: 200-row ceiling (PAGE_SIZE_MAX). Move q/owner to the API and add
     a counts endpoint when invoices outgrow one page. */
  const { loading, rows: all, error } = useInvoicesList(0, { sort: p.sort || undefined });

  const crumbs = useMemo(() => <TbTitle label="Invoices" to="#/invoices" />, []);
  usePageChrome({ crumbs, right: null, parent: null });

  const onFilter = (name: string, value: string) => {
    go("#/invoices" + qs({ ...params, [name]: value }));
  };
  /* Typing would otherwise push one history entry per keystroke -- the same
     220ms Deals and Quotations debounce on. */
  const timer = useRef(0);
  const search = sp.toString();
  const onSearch = useCallback((name: string, value: string) => {
    const next: Record<string, string> = {};
    new URLSearchParams(search).forEach((v, k) => { next[k] = v; });
    next[name] = value;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => go("#/invoices" + qs(next)), 220);
  }, [search, go]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const onUnfilter = (k: string) => {
    const q2: Record<string, string> = {};
    if (k !== "*") for (const x in params) if (x !== k) q2[x] = params[x];
    go("#/invoices" + qs(q2));
  };

  const rows = useMemo(() => {
    let r = all;
    /* `overdue` is an attention filter rather than a document state, but it
       behaves exactly like one -- pick it, the list narrows -- so it rides in
       the Status control instead of holding a cell of its own. */
    if (p.status === "overdue") r = r.filter(isOverdue);
    else if (p.status) r = r.filter((x) => x.status === p.status);
    if (p.owner) r = r.filter((x) => String(x.owner ? x.owner.id : "") === p.owner);
    if (p.q) {
      const s = p.q.toLowerCase();
      r = r.filter((x) => ((x.invoiceNumber || "draft") + " " + x.dealRef + " " +
        (x.quotationNumber || "") + " " + (x.billing.name || "")).toLowerCase().includes(s));
    }
    return r;
  }, [all, p.status, p.owner, p.q]);

  /* Owner is a full-access control only: every other session is already scoped
     to its own rows, so the picker would be a one-option list filtering
     nothing. Locked controls are ABSENT here, not greyed -- same as
     Quotations. */
  const session = getSession();
  const head = !!(session && session.isFullAccess);
  const owners = useMemo(() => {
    const m = new Map<number, string>();
    all.forEach((x) => { if (x.owner) m.set(x.owner.id, x.owner.name); });
    return Array.from(m, ([v, l]) => ({ v: String(v), l }));
  }, [all]);

  /* Received is neither estimated nor recomputed here: Issue writes ONE ledger
     row for the whole grand total in the same transaction that freezes the
     invoice (InvoicesController.Issue), so an issued invoice is fully received
     and anything else is nothing -- the same rule MoneyCell states on every
     row. Outstanding is what that leaves over, and it is zero unless the
     ledger write right after Issue failed.
     ponytail: reads zero even in that repair case, because the list row
     carries no ledger figure. Add `receivedPaise` to _invoice_dict and sum it
     here if the stuck case ever has to be visible from the list. */
  /* And EVERY figure here is counted over what the API actually returned, which
     for anything short of full access is only the deals this session owns or
     co-owns. A sales session's strip therefore states ITS OWN invoicing, not
     the company's, and two people would otherwise read different money off
     identically-worded cells. The labels carry the scope: `mine` marks the
     money cells, `only` ends the tooltips, and both are empty for a full-access
     viewer — whose wording is unchanged. Same pattern as Quotations. */
  const mine = head ? "" : " · yours";
  const only = head ? "" : " — yours only";
  const yrs = head ? "" : " yours";

  const byStatus: Record<string, number> = {};
  let invoiced = 0, received = 0, overdue = 0;
  all.forEach((inv) => {
    byStatus[inv.status] = (byStatus[inv.status] || 0) + 1;
    if (inv.status === "issued") { invoiced += inv.grandTotalPaise; received += inv.grandTotalPaise; }
    if (isOverdue(inv)) overdue += 1;
  });
  const outstanding = invoiced - received;
  function route(k: string, v: string) {
    const q2: Record<string, string> = { ...params };
    q2[k] = String(params[k] || "") === String(v) ? "" : v;
    return "#/invoices" + qs(q2);
  }
  /* Cancelled is not a cell: it is where an invoice LEAVES the run, not a
     position in it -- one pick away in the Status control instead. Overdue
     takes its place, because that is the number that gets worse while nobody
     looks at it. */
  const cells: (StatCell | "sep")[] = [
    { k: "total" + mine, v: all.length, to: route("status", ""), on: !p.status,
      title: "Invoices" + only },
    "sep",
    { k: "draft", v: byStatus.draft || 0, dot: "", to: route("status", "draft"), on: p.status === "draft",
      title: "Draft invoices" + only },
    { k: "paid", v: byStatus.issued || 0, dot: "ok", to: route("status", "issued"), on: p.status === "issued",
      title: "Issued invoices, their payment already on the ledger" + only },
    "sep",
    { k: "overdue", v: overdue, dot: overdue ? "bad" : "", tone: overdue ? "bad" : "",
      to: route("status", "overdue"), on: p.status === "overdue",
      title: "Past its due date with the money still not logged" + only },
    "sep",
    { k: "invoiced" + mine, v: inr(invoiced, { compact: true }), title: "Issued and not cancelled" + only },
    "sep",
    { k: "received" + mine, v: inr(received, { compact: true }), tone: "ok",
      title: "Written to the deal ledger by Issue itself, in the same transaction -- not recomputed here" + only },
    "sep",
    /* An ALARM, and a scoped one: it can only ever ring about invoices this
       session can see, so an invoice stuck on somebody else's deal is invisible
       to everyone but its owner and a full-access admin. The label says whose
       books it covers rather than implying nothing is stuck anywhere. */
    { k: "outstanding" + mine, v: inr(outstanding, { compact: true }), tone: outstanding ? "bad" : "",
      title: "Stuck after Issue -- needs Log payment on the deal"
        + (head ? "" : " — covers YOUR invoices only; one stuck on a deal that is not yours is not counted here") },
  ];

  const chips = Object.keys(params).filter((k) => params[k]).length > 0;

  const openPick = () => go(NEW_HASH);

  /* What the list endpoint actually returns, and nothing more -- the rows on
     screen, filters and all. Amounts stay in paise, unrounded. */
  const exportCsv = () => {
    const out: (string | number)[][] = [["invoice_number", "status", "deal_ref", "quotation_number",
      "customer", "amount_paise", "invoice_date", "due_date", "issued_at", "owner"]];
    rows.forEach((x) => out.push([x.invoiceNumber || "", x.status, x.dealRef, x.quotationNumber || "",
      x.billing.name || "", x.grandTotalPaise, x.invoiceDate || "", x.dueDate || "",
      x.issuedAt || "", x.owner ? x.owner.name : ""]));
    const csv = out.map((r) => r.map((c) => JSON.stringify(String(c))).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = "invoices.csv"; a.click();
    toast("Exported " + rows.length + " invoices -- the rows currently filtered. Amounts are in paise, unrounded.");
  };

  if (loading && !all.length) return <ListSkeleton />;

  return (
    <div className="dls">
      <div className="dls-cmd">
        <SearchField ph="Search invoice no, deal, quote or customer…" val={p.q} onFilter={onSearch} />
        <Select key={"status" + p.status} name="status" label="Status" value={p.status} onFilter={onFilter}
          options={STATUSES.map((s) => ({ v: s, l: STATUS_LABEL[s] + " (" + (byStatus[s] || 0) + yrs + ")" }))
            .concat([{ v: "overdue", l: "Overdue (" + overdue + yrs + ")" }])} />
        {head
          ? <Select key={"owner" + p.owner} name="owner" label="Owner" value={p.owner}
              onFilter={onFilter} options={owners} />
          : null}
        <Select key={"sort" + p.sort} name="sort" label="Sort" value={p.sort} onFilter={onFilter}
          options={[{ v: "newest", l: "Newest first" }, { v: "oldest", l: "Oldest first" }]} />
        <span className="spacer"></span>
        <button className="btn" data-act="in-export" onClick={exportCsv}><Icon name="download" />Export</button>
        {can("invoices", "create")
          ? <button className="btn pri" data-act="inv-new" data-go={NEW_HASH} onClick={openPick}>
              <Icon name="plus" />Create invoice</button>
          : null}
      </div>

      <StatStrip cells={cells} />

      {error ? <Notice tone="bad" ico="alert" text={<><b>Could not load invoices.</b> {error}</>} /> : null}

      {chips ? <div className="dls-chips">
        <FilterChips params={params} onUnfilter={onUnfilter}
          labels={{ q: "Search", status: "Status", owner: "Owner", sort: "Sort" }} />
      </div> : null}

      <div className="dls-body">
        <InvoicesTable rows={rows} p={p} go={go} onUnfilter={onUnfilter} openPick={openPick} />
      </div>
    </div>
  );
}

function InvoicesTable({ rows, p, go, onUnfilter, openPick }: {
  rows: ReturnType<typeof useInvoicesList>["rows"]; p: Record<string, string>;
  go: (h: string) => void; onUnfilter: (k: string) => void; openPick: () => void;
}) {
  const filtered = !!(p.q || p.status || p.owner);
  if (!rows.length)
    return <EmptyState
      icon="invoice" title={filtered ? "No invoices match these filters" : "No invoices yet"}
      body={filtered ? "Nothing matches. Clear a filter to widen the search."
        : "An invoice is raised against an accepted quotation, once payment has already come in."}
      action={filtered
        ? <button className="btn" data-unfilter="*" onClick={() => onUnfilter("*")}>Clear all filters</button>
        : can("invoices", "create")
          ? <button className="btn pri" data-act="inv-new" data-go={NEW_HASH} onClick={openPick}>Create invoice</button>
          : null} />;

  return (
    <table className="tbl dls-tbl"><thead><tr>
      <th style={{ width: "3px" }}></th><th>Invoice</th><th>Status</th><th>Chain</th>
      <th className="n">Amount · received</th><th>Due</th><th>Owner</th>
    </tr></thead><tbody>
      {rows.map((inv) => {
        const to = "#/invoices/" + inv.id;
        const over = isOverdue(inv);
        return (
          <tr key={inv.id} className={"clickable" + (over ? " u-bad" : "") + (inv.status === "cancelled" ? " dim" : "")}
            data-go={to} onClick={() => go(to)}>
            <td className="rail"><i title={over ? "Past its due date and still a draft — never issued" : undefined}></i></td>
            <td>
              <div className="cell-1 mono">
                {inv.invoiceNumber || <span className="faint">Assigned on issue</span>}
              </div>
              <div className="cell-2">{inv.billing.name || "—"}
                {lineOf(inv) ? <span className="faint"> · {lineOf(inv)}</span> : null}</div>
            </td>
            <td>
              <Pill text={STATUS_LABEL[inv.status]} tone={STATUS_TONE[inv.status]} />
              <div className="cell-2">{inv.issuedAt
                ? "issued " + fmtDate(inv.issuedAt)
                : "made " + fmtDate(inv.invoiceDate || inv.createdAt)}</div>
            </td>
            {/* Deal and quote were two reference columns; one chain cell, the
                nearer link under the further one. Plain text, not links --
                both records are one press away from the invoice itself. */}
            <td>
              <div className="cell-1 mono">{inv.dealRef}</div>
              <div className="cell-2 mono faint">{inv.quotationNumber || "—"}</div>
            </td>
            <td className="n dls-money"><MoneyCell inv={inv} /></td>
            <td><DueCell inv={inv} /></td>
            <td>{inv.owner ? inv.owner.name : <span className="faint">—</span>}</td>
          </tr>
        );
      })}
    </tbody></table>
  );
}

/* Past its due date with the money still not logged. Drafts count -- an
   invoice nobody issued, whose own due date has already passed, is the most
   overdue thing on this page: money that was never even asked for. Issued
   means the ledger row is already written, so it can never be overdue. Used by
   both the strip and the row rail, so the two can never disagree. */
function isOverdue(inv: InvoiceRow): boolean {
  return inv.status === "draft" && daysFrom(inv.dueDate) < 0;
}

/* What this invoice is FOR, under the customer's name -- the plan line's own
   remark if it has one, otherwise which installment it is. */
function lineOf(inv: InvoiceRow): string {
  const plan = planItemOf(inv);
  if (!plan) return "";
  const setup = addonsOf(inv).length ? " + setup" : "";
  if (plan.remark) return plan.remark + setup;
  if (plan.installmentCount) return "Installment " + plan.installmentSeq + " of " + plan.installmentCount + setup;
  return inr(plan.amountPaise) + setup;
}

/* Amount and how much of it has landed, one cell. Received is all-or-nothing
   by construction: Issue writes ONE ledger row for the whole grand total in
   the same transaction that freezes the invoice (InvoicesController.Issue),
   so an issued invoice is fully received and anything else is nothing. No
   figure here is estimated. */
function MoneyCell({ inv }: { inv: InvoiceRow }) {
  const amt = inr(inv.grandTotalPaise);
  if (inv.status === "cancelled")
    return <><div className="amt tnum faint">{amt}</div><div className="sub">cancelled</div></>;
  if (inv.status !== "issued")
    return <><div className="amt tnum">{amt}</div><div className="sub"><b>nothing received</b></div></>;
  return <>
    <div className="amt tnum">{amt}</div>
    <div className="bar"><i style={{ width: "100%" }}></i></div>
    <div className="sub">fully received</div>
  </>;
}

/* The date, and how far off it is from today. Once the money is in, the due
   date is history -- it stays for the record, without the countdown. */
function DueCell({ inv }: { inv: InvoiceRow }) {
  if (inv.status === "cancelled") return <span className="faint">—</span>;
  if (inv.status === "issued") return <span className="faint">{fmtDate(inv.dueDate)}</span>;
  const n = daysFrom(inv.dueDate);
  return <>
    {fmtDate(inv.dueDate)}
    {n < 0
      ? <div className="cell-2" style={{ color: "var(--bad)", fontWeight: 500 }}>+{Math.abs(n)}d</div>
      : <div className="cell-2">{relativeDate(inv.dueDate)}</div>}
  </>;
}
