/* =============================================================================
   Refunds — money going back out. Two doors in: against a recorded installment
   payment, or raised by hand with no ledger row behind it.

   ONE TABLE, WHERE THERE WERE THREE BANDS. The face used to stack three
   sections — awaiting a decision, approved but not sent, settled — each with
   its own heading, its own empty state and its own list of bespoke `.fin-q`
   rows. The reasoning was that those are three different jobs, and that is
   true; what was wrong was answering it with three lists. It meant three
   headings and three empty states on a screen that often holds four refunds,
   no way to see the whole book at once, and a row shape that existed nowhere
   else in the panel — so a refund did not read like a slip or a transaction
   even though it is the same kind of thing.

   THE STRIP ANSWERS IT INSTEAD. Each cell is a filter, so "approved, not sent"
   is one press rather than a section that is always on screen whether or not
   anything is in it. The table is sorted by that same job order, so the rows
   needing action are at the top even with no filter on — which is what the
   bands were really buying.

   APPROVAL MOVES NO MONEY. The gap between `approved` and `paid` is real cash
   the company owes and has not sent. It keeps its own cell, its own tone and
   its own place in the sort; only its band is gone.
   ============================================================================= */
import { useShell } from "../../shell/ShellContext";
import { can } from "../../shell/AdminShell";
import { EmptyState, FilterChips, Icon, SearchField, Select, StatStrip, qs } from "../../ui";
import type { StatCell } from "../../ui";
import { go } from "../../ui/nav";
import { Frame } from "./Frame";
import type { FaceProps } from "./Frame";
import { ActionMenu, Money, OriginTag, RefundPill } from "./bits";
import {
  FILTER_LABELS, PERIOD, REFUND_ORIGINS, REFUND_STATES,
  ago, filterValueLabel, fmtDate, groundMeta, inr, useOverview, useRefundQueue,
} from "./store";
import type { Params, RefundRow } from "./store";
import { ManualRefundModal, RecordTransferModal, RequestRefundModal } from "./RefundModals";

/* THE THREE JOBS, AS A SORT RATHER THAN AS THREE LISTS. A refund waiting on a
   decision is somebody else's move; one approved and not sent is money the
   company owes right now; one paid or declined is finished. Rows come out in
   that order with no filter applied, which is what the bands were for. */
const RANK: Record<string, number> = {
  requested: 0, approved: 1, paid: 2, declined: 2,
};
const jobOf = (state: string) => (RANK[state] ?? 3);

export default function Refunds({ p, onFilter, onSearch, onUnfilter }: FaceProps) {
  const { toast, modal, closeLayer } = useShell();
  const q = useRefundQueue();
  const ov = useOverview();
  const writable = can("finance-refunds", "edit");

  const rows = filterRows(q.all, p);
  const shown = rows.slice().sort((a, b) =>
    jobOf(a.r.state) - jobOf(b.r.state)
    || b.r.requestedAt.localeCompare(a.r.requestedAt));
  const declinedN = q.settled.filter((x) => x.r.state === "declined").length;
  const narrowed = Object.keys(p).some((k) => p[k] && ["page", "tab"].indexOf(k) < 0);

  const done = (msg: string, tone?: string) => { closeLayer(); toast(msg, tone); };
  const openRequest = () => modal(<RequestRefundModal onClose={closeLayer} onDone={done} />, "wide");
  const openManual = () => modal(<ManualRefundModal onClose={closeLayer} onDone={done} />);
  const openRecord = (x: RefundRow) => modal(<RecordTransferModal r={x.r} onClose={closeLayer} onDone={done} />);

  /* A CELL TOGGLES: pressing the filter it already applied clears it, because
     the only other way back is to hunt for the chip. It navigates rather than
     calling back, so the address bar always says what is on screen. */
  const cellHash = (patch: Record<string, string | undefined>) => {
    const o: Record<string, string> = {};
    Object.keys(p).forEach((k) => { if (p[k] && k !== "page") o[k] = p[k] as string; });
    Object.keys(patch).forEach((k) => {
      if (patch[k] && p[k] !== patch[k]) o[k] = patch[k] as string; else delete o[k];
    });
    return "#/finance-refunds" + qs(o);
  };

  /* THE STRIP EVERY LIST IN THIS PANEL CARRIES: a stated Total, then its
     parts, each cell a filter. It replaced four `.fin-mt` tiles that were
     read-outs — they stated the four numbers and then made somebody scroll to
     the band that held them. The definitions ride `tip`, because a cell is a
     button and an `i` inside one would swallow half its own click target. */
  const cells: (StatCell | "sep")[] = [
    { k: <>Total</>, v: q.all.length, on: !narrowed, to: "#/finance-refunds",
      tip: <>Every refund ever raised, both doors in, before any filter. The figures beside it
        are the parts of it worth acting on.</> },
    "sep",
    { k: <>Awaiting a decision</>, v: q.open.length,
      dot: q.open.length ? "info" : undefined,
      on: p.flag === "awaiting", to: cellHash({ flag: "awaiting" }),
      tip: <>Raised and not yet decided. <b>Nothing here has moved money.</b> Only a Super Admin
        decides, and never the requester.</> },
    { k: <>Approved, not sent <b className="tnum">{inr(ov.refundsOwedPaise)}</b></>,
      v: ov.refundsOwedN, dot: ov.refundsOwedN ? "warn" : undefined,
      on: p.flag === "owed", to: cellHash({ flag: "owed" }),
      tip: <><b>Approval moves no money.</b> This is cash the company has agreed to return and
        has not sent — it is still in the account and it is not the company's. It leaves the
        moment somebody records the transfer that pays it.</> },
    "sep",
    { k: <>Paid · {PERIOD.label} <b className="tnum">{inr(ov.refundsPaidPaise)}</b></>,
      v: ov.refundsPaidN, dot: "ok",
      on: p.state === "paid", to: cellHash({ state: "paid" }),
      tip: <>Transfers actually made in {PERIOD.label}. A refund counts here when the money left,
        not when it was approved.</> },
    { k: <>Declined</>, v: declinedN, tone: "mute",
      on: p.state === "declined", to: cellHash({ state: "declined" }),
      tip: <>Decided against, with the reason on the record. No transfer will be made, and the
        request is kept — a refund somebody said no to is more interesting than one nobody
        asked for.</> },
  ];

  return (
    <Frame toast={toast}
      cmd={<>
        {/* KEYED ON THEIR VALUE. SearchField and Select are uncontrolled, so
            clearing a chip otherwise leaves the old text in the box. */}
        <SearchField key={"q" + (p.q || "")} ph="Refund id, payee, payment, subscription…"
          val={p.q} onFilter={onSearch} />
        <Select key={"origin" + (p.origin || "")} name="origin" label="Origin" value={p.origin}
          onFilter={onFilter} options={REFUND_ORIGINS.map((o) => ({ v: o.key, l: o.label }))} />
        <Select key={"state" + (p.state || "")} name="state" label="State" value={p.state}
          onFilter={onFilter} options={REFUND_STATES.map((s) => ({ v: s.key, l: s.label }))} />
        <span className="spacer" />
        {writable ? (
          <>
            <button className="btn sm" onClick={openRequest}>
              <Icon name="cash" size="sm" />Request a refund
            </button>
            <button className="btn sm pri" onClick={openManual}>
              <Icon name="plus" size="sm" />Raise a manual refund
            </button>
          </>
        ) : null}
      </>}
      bands={<>
        <StatStrip cells={cells} />
        <div className="dls-chips">
          <FilterChips
            params={(["q", "origin", "state", "flag"] as const)
              .filter((k) => p[k])
              .reduce((o, k) => { o[k] = chipLabel(k, p[k] as string); return o; }, {} as Record<string, string>)}
            labels={FILTER_LABELS}
            onUnfilter={onUnfilter} />
        </div>
      </>}>

      {shown.length ? (
        <table className="tbl dls-tbl fin-tbl">
          <thead>
            <tr>
              <th className="rail" />
              <th>Refund</th>
              <th>Payee</th>
              <th>Why</th>
              <th className="num">Amount</th>
              <th>State</th>
              <th>Raised</th>
              <th className="tight" />
            </tr>
          </thead>
          <tbody>
            {shown.map((x) => (
              <RefundLine key={x.r.refundId} x={x} p={p}
                onRecord={writable && x.r.state === "approved" ? () => openRecord(x) : null} />
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyState icon={narrowed ? "search" : "refund"}
          title={narrowed ? "Nothing matches those filters" : "No refund has been raised"}
          body={narrowed
            ? "The strip above counts the whole book before any filter is applied."
            : "A refund is raised against a recorded installment payment, or by hand when there is no ledger row behind it — a duplicate transfer, an order taken off-platform."}
          action={narrowed
            ? <button className="btn" onClick={() => onUnfilter("*")}>Clear the filters</button>
            : (writable ? <button className="btn pri" onClick={openManual}>Raise a manual refund</button> : null)} />
      )}
    </Frame>
  );
}

/* -------------------------------------------------------------- the row --- */

function RefundLine({ x, p, onRecord }: {
  x: RefundRow; p: Params; onRecord: (() => void) | null;
}) {
  const r = x.r;
  const to = "#/finance-refunds/" + encodeURIComponent(r.refundId) + qs(p as Record<string, string>);
  const open = () => go(to);
  /* The rail says the job at a glance, the way it does on every other list
     here: money owed is the one that needs somebody, a pending decision is
     somebody else's move, and a settled row is quiet. */
  const rail = r.state === "approved" ? "warn"
    : r.state === "declined" ? "bad"
      : r.state === "paid" ? "ok" : "";
  return (
    <tr className="clickable" tabIndex={0} role="link" aria-label={"Open " + r.refundId}
      onClick={open}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}>
      <td className="rail"><i className={rail} /></td>
      <td className="fin-c-slip">
        <div className="cell-1 mono">{r.refundId}</div>
        <div className="cell-2"><OriginTag k={r.origin} /></div>
      </td>
      <td>
        <div className="cell-1">{r.payee.name}</div>
        <div className="cell-2">
          {r.origin === "subscription"
            ? <>Payment <span className="mono">{r.paymentId}</span></>
            : "No ledger row behind this one"}
        </div>
      </td>
      <td>
        <div className="cell-1">{groundMeta(r.ground)?.label || r.ground}</div>
        {r.decisionNote ? <div className="cell-2 fin-heldnote" title={r.decisionNote}>{r.decisionNote}</div> : null}
      </td>
      <td className="num"><Money paise={r.amountPaise} strong /></td>
      <td><RefundPill k={r.state} /></td>
      <td className="fin-c-when">
        <div className="cell-1">{fmtDate(r.requestedAt)}</div>
        <div className="cell-2">{r.decidedAt ? "decided " + ago(r.decidedAt) : ago(r.requestedAt)}</div>
      </td>
      <td className="tight" onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}>
        <RefundMenu r={x} to={to} onRecord={onRecord} />
      </td>
    </tr>
  );
}

/* ----------------------------------------------------------- the menu ---- */
/** The row's actions. Same shell as every other menu in the module, so there
 *  is one outside-click handler and one set of item styles rather than four. */
function RefundMenu({ r, to, onRecord }: {
  r: RefundRow; to: string; onRecord?: (() => void) | null;
}) {
  return (
    <ActionMenu forWhat={r.r.refundId} items={[
      onRecord
        ? { icon: "cash", label: "Record the transfer", act: onRecord, tone: "pri" }
        : { icon: "cash", label: "Record the transfer", act: () => {}, disabled: true,
          title: r.r.state === "paid"
            ? "It is already paid."
            : r.r.state === "declined"
              ? "It was declined — no transfer will be made."
              : "Only an approved refund has a transfer to record." },
      { icon: "doc", label: "Open the refund", act: () => go(to) },
    ]} />
  );
}

/* -------------------------------------------------------------------------- */

/** `filterValueLabel` already knows `state`; it has no case for `origin` or for
 *  this face's own `flag`, because no other face filters by either. */
function chipLabel(key: string, value: string): string {
  if (key === "origin") return REFUND_ORIGINS.filter((o) => o.key === value)[0]?.label || value;
  if (key === "flag") return value === "awaiting" ? "Awaiting a decision" : "Approved, not sent";
  return filterValueLabel(key, value);
}

/** No store filter helper exists for refunds — this is the whole of it.
 *
 *  `flag` is this face's own, and it exists because two of the strip's cells
 *  stand for a JOB rather than a state — "approved, not sent" is money owed
 *  right now, which the `state` filter has no way to say on its own. */
function filterRows(rows: RefundRow[], p: Params): RefundRow[] {
  let out = rows;
  if (p.origin) out = out.filter((x) => x.r.origin === p.origin);
  if (p.state) out = out.filter((x) => x.r.state === p.state);
  if (p.flag === "awaiting") out = out.filter((x) => x.r.state === "requested");
  if (p.flag === "owed") out = out.filter((x) => x.r.state === "approved");
  if (p.q) {
    const term = p.q.toLowerCase().trim();
    out = out.filter((x) =>
      x.r.refundId.toLowerCase().includes(term)
      || x.r.payee.name.toLowerCase().includes(term)
      || (x.r.paymentId || "").toLowerCase().includes(term)
      || (x.r.subscriptionId || "").toLowerCase().includes(term)
      || (groundMeta(x.r.ground)?.label || x.r.ground).toLowerCase().includes(term));
  }
  return out;
}
