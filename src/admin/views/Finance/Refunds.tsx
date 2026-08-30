/* =============================================================================
   Refunds — money going back out. Two doors in: against a recorded
   installment payment, or raised by hand with no ledger row behind it. Three
   bands rather than one flat table, because "waiting on a decision", "decided
   but not paid" and "finished" are three different jobs for whoever is
   looking at this screen — a table sorted by state would still make someone
   read every row to find the one that owes money.

   APPROVAL MOVES NO MONEY. The gap between `approved` and `paid` is real cash
   the company owes and has not sent, which is why it gets its own tile and
   its own band, not just a state on a shared list.
   ============================================================================= */
import type { ReactNode } from "react";
import { useShell } from "../../shell/ShellContext";
import { can } from "../../shell/AdminShell";
import { EmptyState, FilterChips, Icon, SearchField, Select, qs } from "../../ui";
import { go } from "../../ui/nav";
import { MetricTip } from "./InfoTip";
import { Block, Frame } from "./Frame";
import type { FaceProps } from "./Frame";
import { Money, OriginTag, RefundPill } from "./bits";
import {
  FILTER_LABELS, PERIOD, REFUND_ORIGINS, REFUND_STATES,
  ago, filterValueLabel, groundMeta, inr, useOverview, useRefundQueue,
} from "./store";
import type { Params, RefundRow } from "./store";
import { ManualRefundModal, RecordTransferModal, RequestRefundModal } from "./RefundModals";

export default function Refunds({ p, onFilter, onSearch, onUnfilter }: FaceProps) {
  const { toast, modal, closeLayer } = useShell();
  const q = useRefundQueue();
  const ov = useOverview();
  const writable = can("finance-refunds", "edit");

  const filtered = filterRows(q.all, p);
  const awaiting = filtered.filter((x) => x.r.state === "requested" || x.r.state === "sent_back");
  const approved = filtered.filter((x) => x.r.state === "approved");
  const settled = filtered.filter((x) => x.r.state === "paid" || x.r.state === "declined");
  const declinedN = q.settled.filter((x) => x.r.state === "declined").length;
  const narrowed = !!(p.q || p.origin || p.state);

  const done = (msg: string, tone?: string) => { closeLayer(); toast(msg, tone); };
  const openRequest = () => modal(<RequestRefundModal onClose={closeLayer} onDone={done} />, "wide");
  const openManual = () => modal(<ManualRefundModal onClose={closeLayer} onDone={done} />);
  const openRecord = (x: RefundRow) => modal(<RecordTransferModal r={x.r} onClose={closeLayer} onDone={done} />);

  const emptyFor = (icon: string, title: string, body: ReactNode) => narrowed
    ? <EmptyState icon="search" title="Nothing matches those filters"
        body="The tile strip above counts the whole queue before any filter is applied."
        action={<button className="btn" onClick={() => onUnfilter("*")}>Clear all filters</button>} />
    : <EmptyState icon={icon} title={title} body={body} />;

  return (
    <Frame toast={toast}
      cmd={<>
        <SearchField key={"q" + (p.q || "")} ph="Refund id, payee, payment, subscription…" val={p.q} onFilter={onSearch} />
        <Select key={"origin" + (p.origin || "")} name="origin" label="Origin" value={p.origin} onFilter={onFilter}
          options={REFUND_ORIGINS.map((o) => ({ v: o.key, l: o.label }))} />
        <Select key={"state" + (p.state || "")} name="state" label="State" value={p.state} onFilter={onFilter}
          options={REFUND_STATES.map((s) => ({ v: s.key, l: s.label }))} />
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
        <div className="fin-money-strip">
          <Tile k="Awaiting a decision" v={String(q.open.length)}
            s={q.open.length ? "requested, or sent back for more" : "nothing waiting"}
            tone={q.open.length ? "info" : "mute"} />
          <Tile k="Approved, not sent" v={inr(ov.refundsOwedPaise)}
            s={ov.refundsOwedN + " refund" + (ov.refundsOwedN === 1 ? "" : "s") + " authorised, not transferred"}
            tone={ov.refundsOwedN ? "warn" : "mute"} info={<MetricTip k="refunds_owed" />} />
          <Tile k="Paid this period" v={inr(ov.refundsPaidPaise)}
            s={ov.refundsPaidN + " transfer" + (ov.refundsPaidN === 1 ? "" : "s") + " · " + PERIOD.label}
            tone="ok" info={<MetricTip k="refunds_out" />} />
          <Tile k="Declined" v={String(declinedN)}
            s={declinedN ? "no transfer will be made" : "nothing declined"} tone="mute" />
        </div>
        <div className="dls-chips">
          <FilterChips
            params={(["q", "origin", "state"] as const)
              .filter((k) => p[k])
              .reduce((o, k) => { o[k] = chipLabel(k, p[k] as string); return o; }, {} as Record<string, string>)}
            labels={FILTER_LABELS}
            onUnfilter={onUnfilter} />
        </div>
      </>}>

      <div className="fin-bands">
        <Block title="Awaiting a decision"
          desc="Requested by Finance, or sent back by Super Admin for more information. Nothing here has moved money.">
          {awaiting.length
            ? <div className="fin-queue">{awaiting.map((x) => <QueueRow key={x.r.refundId} x={x} p={p} />)}</div>
            : emptyFor("clock", "Nothing is waiting on a decision",
                "A refund lands here the moment Finance requests one, or Super Admin sends one back for more information.")}
        </Block>

        <Block title="Approved, not yet sent"
          desc="Money the company has agreed to return and has not sent. It is still in the account, and it is not the company's.">
          {approved.length
            ? <div className="fin-queue">{approved.map((x) => <QueueRow key={x.r.refundId} x={x} p={p} onRecord={writable ? () => openRecord(x) : undefined} />)}</div>
            : emptyFor("cash", "Nothing approved is waiting on a transfer",
                "A refund appears here the instant it is approved, and leaves the instant somebody records the transfer that pays it.")}
        </Block>

        <Block title="Settled" desc="Paid, or declined — either way, decided and finished.">
          {settled.length
            ? <div className="fin-queue">{settled.map((x) => <QueueRow key={x.r.refundId} x={x} p={p} />)}</div>
            : emptyFor("inbox", "Nothing settled yet", "A refund settles here once it is paid or declined.")}
        </Block>
      </div>
    </Frame>
  );
}

/* -------------------------------------------------------------------------- */

/** `filterValueLabel` already knows `state`; it has no case for `origin`
 *  because no other face filters by it, so that one is resolved here. */
function chipLabel(key: string, value: string): string {
  if (key === "origin") return REFUND_ORIGINS.filter((o) => o.key === value)[0]?.label || value;
  return filterValueLabel(key, value);
}

/** No store filter helper exists for refunds — this is the whole of it. */
function filterRows(rows: RefundRow[], p: Params): RefundRow[] {
  let out = rows;
  if (p.origin) out = out.filter((x) => x.r.origin === p.origin);
  if (p.state) out = out.filter((x) => x.r.state === p.state);
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

/** A read-out, not a filter — `.fin-mt` drills through its own links
 *  elsewhere in the module; here it only states the four numbers a reader
 *  needs before opening a single row. */
function Tile({ k, v, s, tone, info }: { k: string; v: string; s: string; tone?: string; info?: ReactNode }) {
  return (
    <div className={"fin-mt" + (tone ? " " + tone : "")}>
      <span className="k">{k}{info}</span>
      <span className="v">{v}</span>
      <span className="s">{s}</span>
    </div>
  );
}

/** One row in one of the three bands. Clickable and keyboard-operable, the
 *  same way a table row is elsewhere in the panel — `.fin-q` already carries
 *  the pointer and the hover state. */
function QueueRow({ x, p, onRecord }: { x: RefundRow; p: Params; onRecord?: () => void }) {
  const r = x.r;
  const href = "#/finance-refunds/" + encodeURIComponent(r.refundId) + qs(p as Record<string, string>);
  const open = () => go(href);
  return (
    <div className="fin-q" tabIndex={0} role="link" aria-label={"Open " + r.refundId}
      onClick={open}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}>
      <div className="who">
        <div className="cell-1 mono">{r.refundId}</div>
        <div className="cell-2">{r.payee.name}</div>
      </div>
      <div className="mid2">
        <OriginTag k={r.origin} />
        <span className="faint">{groundMeta(r.ground)?.label || r.ground}</span>
      </div>
      <Money paise={r.amountPaise} strong />
      <div className="mid2">
        {r.origin === "subscription"
          ? <span className="faint">Payment <span className="mono">{r.paymentId}</span></span>
          : <span className="faint">No ledger row behind this one</span>}
      </div>
      <span className="when">Requested by {r.requestedBy} · {ago(r.requestedAt)}</span>
      {r.decidedAt ? <span className="when">Decided by {r.decidedBy} · {ago(r.decidedAt)}</span> : null}
      <RefundPill k={r.state} />
      {onRecord ? (
        <span className="act" onClick={(e) => e.stopPropagation()}>
          <button className="btn sm pri" onClick={onRecord}>Record the transfer</button>
        </span>
      ) : null}
    </div>
  );
}
