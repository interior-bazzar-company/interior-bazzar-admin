/* =====================================================================
   THE CHAIN — Deal → Quotation → Invoice → Payment.

   One record's place in the sequence, and WHY the next link is not there
   yet: a cell with no record is not blank, it says "Quote is Draft, not
   Accepted". Everything is read from the API, in parallel, only on a detail
   page.

   IT IS ONE LINE OF TEXT, not four cards. It used to be a full-width panel
   of bordered tiles carrying pills and a sentence each — roughly 90px of
   chrome above every document, restating a status the page header already
   showed, to say a thing that is really a breadcrumb. The reasons a link is
   locked did not have to be printed to be available: they are on `title`,
   where an explanation belongs when the answer is usually "it just isn't
   there yet".
   ===================================================================== */
import { Fragment, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { cx } from "@/utils/cx";
import AdminOpsService from "../../api/modules/adminOps";
import type { DealRow, DealPaymentRow, InvoiceRow, QuotationRow } from "../../api/modules/adminOps";
import { Icon, cap } from "../ui";
import { inr } from "../ui/format";
import { go } from "../ui/nav";

/** `note` is the pill's text, flattened: on one line a coloured pill for a
 *  status the header already carries is decoration, but the word is not. */
type Cell = { k: string; v: string | number; route?: string; state: "done" | "here" | "locked"; note?: string; why?: string };
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

export function ChainStrip({ dealRef, here, quotation, lead }: {
  dealRef: string; here: "deal" | "quotation" | "invoice" | "payment"; quotation?: QuotationRow | null;
  /** who this is for, printed before the steps — the one fact the chain is
   *  about that no step in it carries */
  lead?: ReactNode;
}) {
  const { deal, invoices, payments, loading } = useChain(dealRef);
  const cells: Cell[] = [];

  cells.push(
    loading
      ? { k: "Deal", v: dealRef, state: "locked" }
      : deal
        ? { k: "Deal", v: dealRef, route: "#/deals/" + dealRef, state: "done", note: deal.stageLabel }
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
      note: cap(qStatus) + " · v" + quotation.version,
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
      note: cap(last.status) + (live.length > 1 ? " · +" + (live.length - 1) + " more" : ""),
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
      note: inr(received) + " received",
    });
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-tertiary" aria-busy={loading}>
      {lead ? (
        <>
          <span className="min-w-0 truncate font-medium text-secondary">{lead}</span>
          <span className="text-fg-quaternary" aria-hidden="true">·</span>
        </>
      ) : null}
      {cells.map((c, i) => {
        const state = c.k.toLowerCase() === here ? "here" : c.state;
        /* The step's whole label is the title, so the locked reason is
           readable without printing a sentence per step. */
        const title = c.k + (c.note ? " · " + c.note : "") + (c.why ? " — " + c.why : "");
        const body = (
          <>
            <span className="text-quaternary">{c.k}</span>{" "}
            <span className={cx("font-mono tnum", state === "locked" ? "text-quaternary" : state === "here" ? "font-semibold text-primary" : "text-secondary")}>{c.v}</span>
            {c.note ? <span className="text-quaternary"> · {c.note}</span> : null}
          </>
        );
        return (
          <Fragment key={c.k}>
            {i ? (
              <span className="text-fg-quaternary" aria-hidden="true">
                <Icon name="chevr" size="xs" />
              </span>
            ) : null}
            {c.route ? (
              <a className="rounded outline-focus-ring hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                href={c.route} data-go={c.route} title={title}
                onClick={(e) => { e.preventDefault(); go(c.route as string); }}>
                {body}
              </a>
            ) : (
              <span title={title}>{body}</span>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
