/* =====================================================================
   THE CHAIN — Deal → Quotation → Invoice → Payment.

   One record's place in the sequence, and WHY the next link is not there
   yet: a cell with no record is not blank, it says "Quote is Draft, not
   Accepted". Everything is read from the API, in parallel, only on a detail
   page.
   ===================================================================== */
import { Fragment, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { cx } from "@/utils/cx";
import AdminOpsService from "../../api/modules/adminOps";
import type { DealRow, DealPaymentRow, InvoiceRow, QuotationRow } from "../../api/modules/adminOps";
import { Icon, Pill, cap } from "../ui";
import { inr } from "../ui/format";
import { go } from "../ui/nav";

type Cell = { k: string; v: string | number; route?: string; state: "done" | "here" | "locked"; meta?: ReactNode; why?: string };
type ChainData = { deal: DealRow | null; invoices: InvoiceRow[]; payments: DealPaymentRow[]; loading: boolean };

function useChain(dealRef: string): ChainData {
  const [d, setD] = useState<ChainData>({ deal: null, invoices: [], payments: [], loading: true });
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      AdminOpsService.deal(dealRef)
        .then((r) => (r.response === false ? null : r.data.deal))
        .catch(() => null),
      AdminOpsService.invoices({ deal: dealRef, pageSize: 50 })
        .then((r) => (r.response === false ? [] : r.data.invoices || []))
        .catch(() => []),
      AdminOpsService.dealPayments({ deal: dealRef, pageSize: 50 })
        .then((r) => (r.response === false ? [] : r.data.payments || []))
        .catch(() => []),
    ]).then(([deal, invoices, payments]) => {
      if (!cancelled) setD({ deal, invoices, payments, loading: false });
    });
    return () => {
      cancelled = true;
    };
  }, [dealRef]);
  return d;
}

export function ChainStrip({ dealRef, here, quotation }: { dealRef: string; here: "deal" | "quotation" | "invoice" | "payment"; quotation?: QuotationRow | null }) {
  const { deal, invoices, payments, loading } = useChain(dealRef);
  const cells: Cell[] = [];

  cells.push(
    loading
      ? { k: "Deal", v: dealRef, state: "locked" }
      : deal
        ? { k: "Deal", v: dealRef, route: "#/deals/" + dealRef, state: "done", meta: <Pill xs text={deal.stageLabel} tone={deal.stageTone} /> }
        : { k: "Deal", v: dealRef, state: "locked", why: "This deal is not one you can open — it belongs to another owner." },
  );

  const qStatus = quotation ? quotation.status : "";
  if (!quotation) {
    cells.push({ k: "Quotation", v: "—", state: "locked", why: "No quotation yet. Create one from this deal." });
  } else {
    cells.push({
      k: "Quotation",
      v: quotation.quotationNumber || "(draft)",
      route: "#/quotations/" + quotation.id,
      state: qStatus === "accepted" ? "done" : "here",
      meta: (
        <>
          <Pill xs text={cap(qStatus)} tone={qStatus === "accepted" ? "ok" : qStatus === "draft" ? "warn" : "dead"} /> <span className="text-xs text-quaternary">v{quotation.version}</span>
        </>
      ),
    });
  }

  const live = invoices.filter((i) => i.status !== "cancelled");
  if (qStatus !== "accepted") {
    cells.push({ k: "Invoice", v: "—", state: "locked", why: quotation ? "Quote is " + cap(qStatus) + ", not Accepted." : "Needs an accepted quotation." });
  } else if (!live.length) {
    cells.push({ k: "Invoice", v: "—", state: "locked", why: "Quote accepted — raise the first invoice." });
  } else {
    const last = live[live.length - 1];
    const issued = last.status === "issued";
    cells.push({
      k: "Invoice",
      v: last.invoiceNumber || "(draft)",
      route: "#/invoices/" + last.id,
      state: issued ? "done" : "here",
      meta: (
        <>
          <Pill xs text={cap(last.status)} tone={issued ? "ok" : "warn"} />
          {live.length > 1 ? <span className="text-xs text-quaternary"> +{live.length - 1} more</span> : null}
        </>
      ),
    });
  }

  const received = payments.reduce((a, p) => a + p.amountPaise, 0);
  if (!payments.length) {
    cells.push({ k: "Payment", v: "—", state: "locked", why: live.length ? "Awaiting a receipt against the open invoice." : "Money is received against an invoice." });
  } else {
    cells.push({
      k: "Payment",
      v: payments.length + (payments.length === 1 ? " receipt" : " receipts"),
      state: deal && deal.paid ? "done" : "here",
      meta: <Pill xs text={inr(received) + " received"} tone="ok" />,
    });
  }

  return (
    <div className="flex items-stretch gap-1 overflow-x-auto rounded-xl bg-primary p-1.5 ring-1 ring-secondary scrollbar-hide" aria-busy={loading}>
      {cells.map((c, i) => {
        const isHere = c.k.toLowerCase() === here;
        const state = isHere ? "here" : c.state;
        const cls = cx(
          "flex min-w-40 flex-1 flex-col gap-1 rounded-lg px-3 py-2 text-left transition duration-100",
          state === "here" && "bg-selected ring-1 ring-selected ring-inset",
          state === "locked" && "opacity-70",
          c.route && "cursor-pointer outline-focus-ring hover:bg-primary_hover focus-visible:outline-2 focus-visible:outline-offset-2",
        );
        const body = (
          <>
            <div className="label-mono flex items-center gap-1.5">
              {state === "done" ? <Icon name="check" size="xs" className="text-fg-success-primary" /> : state === "locked" ? <Icon name="lock" size="xs" /> : <span className="size-1.5 rounded-full bg-brand-solid" />}
              {c.k}
            </div>
            <div className="flex items-center gap-1.5 text-sm font-medium text-primary">
              <span className="truncate font-mono tnum">{c.v}</span>
              {c.route ? <Icon name="ext" size="xs" className="text-fg-quaternary" /> : null}
            </div>
            {c.meta ? <div className="flex flex-wrap items-center gap-1">{c.meta}</div> : null}
            {c.why ? <div className="text-xs leading-snug text-tertiary">{c.why}</div> : null}
          </>
        );
        return (
          <Fragment key={c.k}>
            {i ? (
              <span className="flex shrink-0 items-center text-fg-quaternary" aria-hidden="true">
                <Icon name="chevr" size="sm" />
              </span>
            ) : null}
            {c.route ? (
              <a className={cls} href={c.route} data-go={c.route} onClick={(e) => { e.preventDefault(); go(c.route as string); }}>
                {body}
              </a>
            ) : (
              <div className={cls}>{body}</div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
