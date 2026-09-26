/* =====================================================================
   INVOICES — the list. Same five bands as Quotations/Deals/Plans.
   ===================================================================== */
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { inr, fmtDate } from "../../ui/format";
import {
  Alert, Button, EmptyState, FilterBar, FilterChips, ListTable, Meter, MoreMenu, PageHeader,
  Pill, qs, Rail, SearchField, Select, StatStrip, TbTitle,
} from "../../ui";
import type { MenuItem, StatCell } from "../../ui";
import { can, useNav, usePageChrome } from "../../shell/AdminShell";
import { scopeLabel, scopeOf, scopeOnly, wideScope } from "../../auth/session";
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
const LABELS: Record<string, string> = { q: "Search", status: "Status", owner: "Owner", sort: "Sort" };

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
  /* WIDER THAN THIS PERSON — the test that decides both the Owner filter and
     the wording below. It used to be `isFullAccess`, which pinned every other
     role to its own rows whatever the roles grid said: accounts own no deals
     at all, so they read 0 everywhere and could not bill anybody. */
  const head = wideScope("invoices");
  const owners = useMemo(() => {
    const m = new Map<number, string>();
    all.forEach((x) => { if (x.owner) m.set(x.owner.id, x.owner.name); });
    return Array.from(m, ([v, l]) => ({ v: String(v), l }));
  }, [all]);

  /* Received is neither estimated nor inferred: `receivedPaise` is the
     server's own sum over the payment ledger, on every row. It used to be
     read off `status`, because Issue wrote the ledger row itself — so the
     ponytail note that used to sit here, asking for exactly this field, has
     been taken up. */
  /* And EVERY figure here is counted over what the API actually returned, which
     for anything short of full access is only the deals this session owns or
     co-owns. A sales session's strip therefore states ITS OWN invoicing, not
     the company's, and two people would otherwise read different money off
     identically-worded cells. The labels carry the scope: `mine` marks the
     money cells, `only` ends the tooltips, and both are empty for a full-access
     viewer — whose wording is unchanged. Same pattern as Quotations. */
  /* THE LABELS CARRY THE SCOPE, and there are three of it, not two. "yours"
     over a list that is not yours is the wording that had a manager reporting
     the company pipeline as empty; `all` gets no qualifier because the
     unqualified reading is then the true one. */
  const mine = scopeLabel("invoices");
  const only = scopeOnly("invoices");
  const yrs = scopeOf("invoices") === "all" ? "" : mine.replace(" · ", " ");

  const byStatus: Record<string, number> = {};
  let invoiced = 0, received = 0, overdue = 0, outstanding = 0, unbilled = 0;
  all.forEach((inv) => {
    byStatus[inv.status] = (byStatus[inv.status] || 0) + 1;
    /* ISSUED IS WHAT WAS ASKED FOR; RECEIVED IS WHAT ARRIVED; THE GAP BETWEEN
       THEM IS OUTSTANDING. All three used to be something else. `received`
       was a copy of `invoiced` because issuing wrote the ledger row itself, so
       the two could never differ and the page showed three invoices fully
       received while Subscriptions showed ₹0 collected. `outstanding` was the
       sum of DRAFTS — money nobody has been asked for, including ₹14,56,119
       on a deal still at stage New — which is a real number but not this one.
       `receivedPaise` is the server's own sum over the payment ledger. */
    if (inv.status === "issued") {
      invoiced += inv.grandTotalPaise;
      received += inv.receivedPaise;
      outstanding += Math.max(0, inv.grandTotalPaise - inv.receivedPaise);
    }
    /* Drafts keep their own cell rather than being folded into outstanding or
       dropped: an invoice that names money and was never issued is worth
       seeing, it just is not owed by anybody yet. */
    if (inv.status === "draft") unbilled += inv.grandTotalPaise;
    if (isOverdue(inv)) overdue += 1;
  });
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
    { k: "issued", v: byStatus.issued || 0, dot: "info", to: route("status", "issued"), on: p.status === "issued",
      title: "Raised and sent — paid or not" + only },
    "sep",
    { k: "overdue", v: overdue, dot: overdue ? "bad" : "", tone: overdue ? "bad" : "",
      to: route("status", "overdue"), on: p.status === "overdue",
      title: "Issued, past its due date, and not paid in full" + only },
    "sep",
    { k: "invoiced" + mine, v: inr(invoiced, { compact: true }), title: "Issued and not cancelled" + only },
    "sep",
    { k: "received" + mine, v: inr(received, { compact: true }), tone: "ok",
      title: "Summed from the payment ledger — a recorded payment, not an issued document" + only },
    "sep",
    /* An ALARM, and a scoped one: it can only ever ring about invoices this
       session can see, so an invoice stuck outside that scope is invisible
       here. The label says whose books it covers rather than implying nothing
       is stuck anywhere. */
    { k: "outstanding" + mine, v: inr(outstanding, { compact: true }), tone: outstanding ? "bad" : "",
      title: "Issued and not yet paid — what customers actually owe"
        + (head ? "" : " — covers " + only.replace(" — ", "") + "; an invoice on a deal outside that is not counted here") },
    "sep",
    /* DRAFTED AND NEVER SENT. Its own cell, plainly labelled, because it used
       to BE the outstanding figure — ₹17.86L of money nobody had asked for,
       printed where customers' debt belongs. */
    { k: "unbilled" + mine, v: inr(unbilled, { compact: true }),
      title: "Named on a draft nobody has issued — not owed by anyone yet" + only },
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
    <div className="flex flex-col gap-4">
      {/* The same five bands, in the same order, as Quotations — this module
          is the other half of one workflow and must not read as another
          product. */}
      <PageHeader
        title="Invoices"
        meta={<>
          <span className="tnum">{all.length.toLocaleString()} {all.length === 1 ? "invoice" : "invoices"}</span>
          {overdue ? <span className="tnum text-error-primary">{overdue} overdue</span> : null}
        </>}
        actions={<>
          <Button color="secondary" ico="download" data-act="in-export" onClick={exportCsv}>Export</Button>
          {can("invoices", "create")
            ? <Button color="primary" ico="plus" data-act="inv-new" data-go={NEW_HASH} onClick={openPick}>Create invoice</Button>
            : null}
        </>}
      />

      <FilterBar
        search={<SearchField ph="Search invoice no, deal, quote or customer…" val={p.q} onFilter={onSearch} />}
        filters={
          <>
            <Select key={"status" + p.status} name="status" label="Status" value={p.status} onFilter={onFilter}
              options={STATUSES.map((s) => ({ v: s, l: STATUS_LABEL[s] + " (" + (byStatus[s] || 0) + yrs + ")", dot: STATUS_TONE[s] || "neutral" }))
                .concat([{ v: "overdue", l: "Overdue (" + overdue + yrs + ")", dot: "bad" }])} />
            {head
              ? <Select key={"owner" + p.owner} name="owner" label="Owner" value={p.owner}
                  onFilter={onFilter} options={owners} />
              : null}
            <Select key={"sort" + p.sort} name="sort" label="Sort" value={p.sort} onFilter={onFilter}
              options={[{ v: "newest", l: "Newest first" }, { v: "oldest", l: "Oldest first" }]} />
          </>
        }
        chips={chips ? <FilterChips params={params} onUnfilter={onUnfilter} labels={LABELS} /> : null}
      />

      <StatStrip cells={cells} />

      {error ? <Alert tone="bad" title="Could not load invoices." action={<Button color="secondary" size="xs" ico="refresh" onClick={() => go("#/invoices" + qs(params))}>Retry</Button>}>{error}</Alert> : null}

      <InvoicesTable rows={rows} p={p} go={go} onUnfilter={onUnfilter} openPick={openPick} />
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
        ? <Button color="secondary" data-unfilter="*" onClick={() => onUnfilter("*")}>Clear all filters</Button>
        : can("invoices", "create")
          ? <Button color="primary" ico="plus" data-act="inv-new" data-go={NEW_HASH} onClick={openPick}>Create invoice</Button>
          : null} />;

  return (
    <ListTable min="62rem" head={<tr>
      <th className="rail" />
      <th scope="col">Invoice</th>
      <th scope="col">Status</th>
      <th scope="col">Chain</th>
      <th scope="col" className="n">Amount · received</th>
      <th scope="col">Due</th>
      <th scope="col">Owner</th>
      <th scope="col" className="acts"><span className="sr-only">Actions</span></th>
    </tr>}>
      {rows.map((inv) => {
        const to = "#/invoices/" + inv.id;
        const over = isOverdue(inv);
        const items: MenuItem[] = [
          { icon: "invoice", label: inv.status === "draft" ? "Preview & issue" : "View document", act: () => go(to + "?mode=preview") },
          ...(inv.status === "draft" && can("invoices", "edit")
            ? [{ icon: "edit", label: "Edit draft", act: () => go(to + "?mode=edit") }]
            : []),
          { icon: "deal", label: "Open the deal", act: () => go("#/deals/" + inv.dealRef) },
        ];
        return (
          <tr key={inv.id} className="clickable" data-go={to} onClick={() => go(to)}>
            <Rail tone={over ? "bad" : inv.status === "issued" ? "ok" : undefined}
              title={over ? "Issued, past its due date, and not paid in full" : undefined} />
            <td className="cell-1">
              <span className="font-mono tnum">
                {inv.invoiceNumber || <span className="font-sans font-normal text-quaternary">Draft</span>}
              </span>
              <div className="cell-2">{inv.billing.name || "—"}
                {lineOf(inv) ? <span className="text-quaternary"> · {lineOf(inv)}</span> : null}</div>
            </td>
            <td>
              <Pill dot text={STATUS_LABEL[inv.status]} tone={STATUS_TONE[inv.status] || "neutral"} />
              <div className="cell-2">{inv.issuedAt
                ? "issued " + fmtDate(inv.issuedAt)
                : "made " + fmtDate(inv.invoiceDate || inv.createdAt)}</div>
            </td>
            {/* Deal and quote were two reference columns; one chain cell, the
                nearer link under the further one. Plain text, not links --
                both records are one press away from the invoice itself. */}
            <td className="mono">
              {inv.dealRef}
              <div className="cell-2 font-mono">{inv.quotationNumber || "—"}</div>
            </td>
            <td className="n"><MoneyCell inv={inv} /></td>
            <td><DueCell inv={inv} /></td>
            <td>{inv.owner ? inv.owner.name : <span className="text-quaternary">—</span>}</td>
            <td className="acts" onClick={(e) => e.stopPropagation()}>
              <MoreMenu items={items} small align="right" />
            </td>
          </tr>
        );
      })}
    </ListTable>
  );
}

/* ISSUED, PAST ITS DUE DATE, AND NOT PAID IN FULL.
   This was the exact inverse: drafts counted and issued invoices never could,
   on the reasoning that "issued means the ledger row is already written". It
   was, because issuing wrote it — so the one state that can genuinely be
   overdue was the one state excluded, and five drafts nobody had sent were
   flagged instead. A draft has never been sent to anybody; it cannot be late.
   Used by both the strip and the row rail, so the two cannot disagree. */
function isOverdue(inv: InvoiceRow): boolean {
  return inv.status === "issued" && inv.receivedPaise < inv.grandTotalPaise
    && daysFrom(inv.dueDate) < 0;
}

/* What this invoice is FOR, under the customer's name -- the plan line's own
   remark if it has one, otherwise which installment it is. */
function lineOf(inv: InvoiceRow): string {
  const plan = planItemOf(inv);
  if (!plan) return "";
  const setup = addonsOf(inv).length ? " + setup" : "";
  if (plan.remark) return plan.remark + setup;
  if (plan.installmentCount) return "Installment " + plan.installmentSeq + " of " + plan.installmentCount + setup;
  /* SAY WHICH FIGURE THIS IS. The plan line is the amount BEFORE tax and the
     AMOUNT column beside it is the grand total AFTER it, so the row read
     "Sneha Pillai · ₹1,20,000" next to ₹1,41,600 with nothing to explain the
     gap — two different numbers for one invoice, both unlabelled. */
  return inr(plan.amountPaise) + " + GST" + setup;
}

/* Amount and how much of it has landed, one cell — both read off the invoice,
   neither estimated. `receivedPaise` is the server's sum over the payment
   ledger. It used to be inferred from `status`, because issuing wrote the
   ledger row itself, so every issued invoice printed "fully received" whether
   or not a rupee had arrived. Partial payment is now representable, so the
   meter is a real proportion rather than a bar that is only ever empty or
   full. */
function MoneyCell({ inv }: { inv: InvoiceRow }) {
  const amt = inr(inv.grandTotalPaise);
  if (inv.status === "cancelled")
    return <>
      <div className="text-quaternary line-through">{amt}</div>
      <div className="cell-2 text-right">cancelled</div>
    </>;
  if (inv.status !== "issued")
    return <>
      <div>{amt} <span className="text-quaternary">inc. GST</span></div>
      <div className="cell-2 text-right font-medium">not issued</div>
    </>;
  const got = inv.receivedPaise;
  const pct = inv.grandTotalPaise > 0
    ? Math.min(100, Math.round((got / inv.grandTotalPaise) * 100)) : 0;
  return <>
    <div>{amt} <span className="text-quaternary">inc. GST</span></div>
    {got > 0 ? <Meter value={pct} tone={pct >= 100 ? "ok" : "warn"} className="mt-1" /> : null}
    <div className="cell-2 text-right">
      {got <= 0 ? "awaiting payment"
        : pct >= 100 ? "fully received"
        : inr(got) + " received"}
    </div>
  </>;
}

/* The date, and how far off it is from today. Once the money is in, the due
   date is history -- it stays for the record, without the countdown. */
function DueCell({ inv }: { inv: InvoiceRow }) {
  if (inv.status === "cancelled") return <span className="text-quaternary">—</span>;
  if (inv.status === "issued") return <span className="text-quaternary tnum">{fmtDate(inv.dueDate)}</span>;
  const n = daysFrom(inv.dueDate);
  return <>
    <span className={n < 0 ? "font-medium text-error-primary tnum" : "tnum"}>{fmtDate(inv.dueDate)}</span>
    {n < 0
      ? <div className="cell-2 font-medium text-error-primary">+{Math.abs(n)}d</div>
      : <div className="cell-2">{relativeDate(inv.dueDate)}</div>}
  </>;
}
