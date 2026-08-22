/* =====================================================================
   THE CHAIN — Deal → Quotation → Invoice → Payment, the prototype's
   `S.chainStrip()`.

   One record's place in the sequence, and — this is the part worth keeping —
   WHY the next link is not there yet. A cell with no record is not blank: it
   says "Quote is Draft, not Accepted", which is the answer to the question
   somebody would otherwise open two more pages to ask.

   Everything below is read from the API. The three fetches run in parallel and
   only on a detail page, which is the one screen where the surrounding chain
   is what you came to check.
   ===================================================================== */
import { Fragment, useEffect, useState } from "react";
import type { ReactNode } from "react";
import AdminOpsService from "../../api/modules/adminOps";
import type { DealRow, DealPaymentRow, InvoiceRow, QuotationRow } from "../../api/modules/adminOps";
import { Icon, Pill, cap } from "../ui";
import { inr } from "../ui/format";
import { go } from "../ui/nav";

type Cell = {
  k: string; v: string | number; route?: string; state: "done" | "here" | "locked";
  meta?: ReactNode; why?: string;
};

type ChainData = { deal: DealRow | null; invoices: InvoiceRow[]; payments: DealPaymentRow[]; loading: boolean };

/** Deal + every invoice and ledger row on it. Failures fall back to empty
 *  rather than an error: the chain is context, and a page must not break over
 *  a strip that only ever tells you where to go next. */
function useChain(dealRef: string): ChainData {
  const [d, setD] = useState<ChainData>({ deal: null, invoices: [], payments: [], loading: true });
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      AdminOpsService.deal(dealRef).then((r) => (r.response === false ? null : r.data.deal)).catch(() => null),
      AdminOpsService.invoices({ deal: dealRef, pageSize: 50 })
        .then((r) => (r.response === false ? [] : r.data.invoices || [])).catch(() => []),
      AdminOpsService.dealPayments({ deal: dealRef, pageSize: 50 })
        .then((r) => (r.response === false ? [] : r.data.payments || [])).catch(() => []),
    ]).then(([deal, invoices, payments]) => {
      if (!cancelled) setD({ deal, invoices, payments, loading: false });
    });
    return () => { cancelled = true; };
  }, [dealRef]);
  return d;
}

/** `quotation` is the document this strip is drawn FOR — its own cell reads
 *  from it rather than from whatever the deal's latest quotation happens to
 *  be, so a superseded version shows its own status and its own reason the
 *  invoice never followed. */
export function ChainStrip({ dealRef, here, quotation }: {
  dealRef: string; here: "deal" | "quotation" | "invoice" | "payment"; quotation?: QuotationRow | null;
}) {
  const { deal, invoices, payments, loading } = useChain(dealRef);
  const cells: Cell[] = [];

  /* A DEAL THAT DID NOT COME BACK IS NOT A FINISHED STEP. The fetch above
     falls back to null on any failure, and since the pipeline became per-user
     the commonest cause is no longer a network blip — it is a deal on somebody
     else's desk, reached from a quotation or invoice that IS on yours. Drawing
     that as "done" with a live link gave a green tick and a dead end; `locked`
     with the reason is the same information the Quotation and Invoice cells
     below already give when their record is missing. Still loading is neither
     — it has no route and no claim until the answer arrives. */
  cells.push(
    loading
      ? { k: "Deal", v: dealRef, state: "locked" }
      : deal
        ? { k: "Deal", v: dealRef, route: "#/deals/" + dealRef, state: "done",
            meta: <Pill text={deal.stageLabel} tone={deal.stageTone} /> }
        : { k: "Deal", v: dealRef, state: "locked",
            why: "This deal is not one you can open — it belongs to another owner." });

  const qStatus = quotation ? quotation.status : "";
  if (!quotation) {
    cells.push({ k: "Quotation", v: "—", state: "locked",
      why: "No quotation yet. Create one from this deal." });
  } else {
    cells.push({
      k: "Quotation", v: quotation.quotationNumber || "(draft)",
      route: "#/quotations/" + quotation.id,
      state: qStatus === "accepted" ? "done" : "here",
      meta: <>
        <Pill text={cap(qStatus)} tone={qStatus === "accepted" ? "ok" : qStatus === "draft" ? "warn" : "dead"} />
        {" "}<span className="faint">v{quotation.version}</span>
      </>,
    });
  }

  /* An invoice cannot exist before the quotation is accepted, and saying so is
     more use than an empty cell. */
  const live = invoices.filter((i) => i.status !== "cancelled");
  if (qStatus !== "accepted") {
    cells.push({ k: "Invoice", v: "—", state: "locked",
      why: quotation ? "Quote is " + cap(qStatus) + ", not Accepted." : "Needs an accepted quotation." });
  } else if (!live.length) {
    cells.push({ k: "Invoice", v: "—", state: "locked", why: "Quote accepted — raise the first invoice." });
  } else {
    /* An invoice here is a log of money that already came in — issuing one
       writes its ledger row in the same transaction (see InvoicesController) —
       so ISSUED is the settled state and there is no unpaid-but-issued cell
       to draw. */
    const last = live[live.length - 1];
    const issued = last.status === "issued";
    cells.push({
      k: "Invoice", v: last.invoiceNumber || "(draft)", route: "#/invoices/" + last.id,
      state: issued ? "done" : "here",
      meta: <>
        <Pill text={cap(last.status)} tone={issued ? "ok" : "warn"} />
        {live.length > 1 ? <> <span className="faint">+{live.length - 1} more</span></> : null}
      </>,
    });
  }

  /* Reversals are negative rows referencing the original, never edits to it —
     so the received figure is the sum of the ledger, not of the payments. */
  const received = payments.reduce((a, p) => a + p.amountPaise, 0);
  if (!payments.length) {
    cells.push({ k: "Payment", v: "—", state: "locked",
      why: live.length ? "Awaiting a receipt against the open invoice."
        : "Money is received against an invoice." });
  } else {
    /* No route: the ledger has no page of its own in this panel — the receipts
       are read on the invoice they were recorded against. */
    cells.push({
      k: "Payment", v: payments.length + (payments.length === 1 ? " receipt" : " receipts"),
      state: deal && deal.paid ? "done" : "here",
      meta: <Pill text={inr(received) + " received"} tone="ok" />,
    });
  }

  return (
    <div className="chain" aria-busy={loading}>
      {cells.map((c, i) => {
        const cls = "lk " + (c.k.toLowerCase() === here ? "here" : c.state);
        const body = (
          <>
            <div className="k">{c.k}</div>
            <div className="v"><span className="mono trunc">{c.v}</span>
              {c.route ? <Icon name="ext" size="sm" /> : null}</div>
            {c.meta ? <div className="m">{c.meta}</div> : null}
            {c.why ? <div className="why">{c.why}</div> : null}
          </>
        );
        return (
          <Fragment key={c.k}>
            {i ? <span className="sep"><Icon name="chevr" size="sm" /></span> : null}
            {c.route
              ? <a className={cls} data-go={c.route} onClick={() => go(c.route as string)}>{body}</a>
              : <div className={cls}>{body}</div>}
          </Fragment>
        );
      })}
    </div>
  );
}
