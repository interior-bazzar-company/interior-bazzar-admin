/* =====================================================================
   INVOICES — the list. Same five bands as Quotations/Deals/Plans.
   ===================================================================== */
import { useCallback, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { inr, fmtDate } from "../../ui/format";
import { EmptyState, FilterChips, Notice, Pill, Select, StatStrip, qs, Icon } from "../../ui";
import type { StatCell } from "../../ui";
import { can, useNav, usePageChrome } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import { ListSkeleton } from "../../ui";
import { STATUS_LABEL, STATUS_TONE, useInvoicesList } from "./api";
import type { InvoiceRow } from "./api";
import { addonsOf, planItemOf } from "./helpers";
import { daysFrom, relativeDate } from "../Deals/useDeals";
import InvoiceDetail from "./Detail";
import InvoiceBuilder from "./Builder";
import InvoicePreview from "./Preview";
import PickInvoiceModal from "./PickModal";

const STATUSES = ["draft", "issued", "cancelled"];

/* THE MODULE ROUTER — list / detail / builder / preview, the four screens the
   prototype has (views-invoice.js). No drawer: see Quotations/index.tsx. */
export default function Invoices() {
  const raw = useParams().id;
  const id = raw ? Number(raw) : null;
  const [sp] = useSearchParams();
  const mode = sp.get("mode") || "";
  const tab = sp.get("tab") || "lines";
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
  const { modal, closeLayer, toast } = useShell();
  const [tick, setTick] = useState(0);
  const bump = useCallback(() => setTick((t) => t + 1), []);

  const params: Record<string, string> = {};
  sp.forEach((v, k) => { params[k] = v; });
  const p = { status: params.status || "", sort: params.sort || "" };

  const { loading, rows, error } = useInvoicesList(tick, { status: p.status || undefined });

  const crumbs = useMemo(() => <span className="tb-title">Invoices</span>, []);
  usePageChrome({ crumbs, right: null, parent: null });

  /* A new draft opens on its own editor page -- the reference and the proof it
     needs before issuing are entered there, not in a panel over the list. */
  const done = useCallback((msg: string, ref: number | null) => {
    closeLayer(); toast(msg);
    go(ref ? "#/invoices/" + ref + "?mode=edit" : "#/invoices");
    bump();
  }, [closeLayer, toast, go, bump]);

  const onFilter = (name: string, value: string) => {
    go("#/invoices" + qs({ ...params, [name]: value }));
  };
  const onUnfilter = (k: string) => {
    const q2: Record<string, string> = {};
    if (k !== "*") for (const x in params) if (x !== k) q2[x] = params[x];
    go("#/invoices" + qs(q2));
  };

  const byStatus: Record<string, number> = {};
  rows.forEach((inv) => { byStatus[inv.status] = (byStatus[inv.status] || 0) + 1; });
  function route(k: string, v: string) {
    const q2: Record<string, string> = { ...params };
    q2[k] = String(params[k] || "") === String(v) ? "" : v;
    return "#/invoices" + qs(q2);
  }
  const paidTotal = rows.filter((r) => r.status === "issued").reduce((a, r) => a + r.grandTotalPaise, 0);
  const cells: (StatCell | "sep")[] = [
    { k: "invoices", v: rows.length, to: route("status", ""), on: !p.status },
    "sep",
    ...STATUSES.filter((s) => byStatus[s]).map((s) => ({
      k: STATUS_LABEL[s].toLowerCase(), v: byStatus[s] || 0,
      to: route("status", s), on: p.status === s, tone: STATUS_TONE[s],
    })),
    "sep",
    { k: "collected", v: inr(paidTotal), title: "Sum of every issued invoice's grand total" },
  ];

  const chips = Object.keys(params).filter((k) => params[k]).length > 0;

  const openPick = () => {
    if (!can("invoices", "create")) return toast("403 — you do not have invoice-creation access.", "bad");
    modal(<PickInvoiceModal onClose={closeLayer} onDone={(iid: number) => done("Invoice drafted.", iid)} />, "wide");
  };

  if (loading && !rows.length) return <ListSkeleton />;

  return (
    <div className="dls">
      <div className="dls-cmd">
        <Select key={"status" + p.status} name="status" label="Status" value={p.status} onFilter={onFilter}
          options={STATUSES.map((s) => ({ v: s, l: STATUS_LABEL[s] }))} />
        <Select key={"sort" + p.sort} name="sort" label="Sort" value={p.sort} onFilter={onFilter}
          options={[{ v: "newest", l: "Newest first" }, { v: "oldest", l: "Oldest first" }]} />
        <span className="spacer"></span>
        {can("invoices", "create")
          ? <button className="btn pri" data-act="inv-new" onClick={openPick}><Icon name="plus" />Create invoice</button>
          : null}
      </div>

      <StatStrip cells={cells} />

      {error ? <Notice tone="bad" ico="alert" text={<><b>Could not load invoices.</b> {error}</>} /> : null}

      {chips ? <div className="dls-chips">
        <FilterChips params={params} onUnfilter={onUnfilter} labels={{ status: "Status", sort: "Sort" }} />
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
  const filtered = !!p.status;
  if (!rows.length)
    return <EmptyState
      icon="invoice" title={filtered ? "No invoices match this filter" : "No invoices yet"}
      body={filtered ? "Nothing matches. Clear the filter to widen the search."
        : "An invoice is raised against an accepted quotation, once payment has already come in."}
      action={filtered
        ? <button className="btn" data-unfilter="*" onClick={() => onUnfilter("*")}>Clear filter</button>
        : can("invoices", "create")
          ? <button className="btn pri" data-act="inv-new" onClick={openPick}>Create invoice</button>
          : null} />;

  return (
    <table className="tbl dls-tbl"><thead><tr>
      <th style={{ width: "3px" }}></th><th>Invoice</th><th>Status</th><th>Chain</th>
      <th className="n">Amount · received</th><th>Due</th><th>Owner</th>
    </tr></thead><tbody>
      {rows.map((inv) => {
        const to = "#/invoices/" + inv.id;
        const over = inv.status === "draft" && daysFrom(inv.dueDate) < 0;
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
