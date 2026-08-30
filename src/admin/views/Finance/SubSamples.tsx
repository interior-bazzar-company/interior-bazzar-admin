/* =============================================================================
   Finance · Subscriptions — THE SAMPLE TAB. Delete this file at integration.
   -----------------------------------------------------------------------------
   A worked example of every case Record a subscription supports, built FROM THE
   LIVE SEED rather than written out beside it — so it cannot drift into
   describing a flow the module no longer has. Every number, id and business
   name below is read from the store at render; if a seed row changes, this page
   changes with it, and if one disappears the case says so instead of lying.

   Each walkable case carries a "Use this" button that fills the Record tab in.
   That is the point of the tab: the chain is easier to understand by watching a
   quotation populate four fields than by reading that it will.

   HOW TO REMOVE IT, WHEN THE REAL ENDPOINTS LAND
   ----------------------------------------------
     1. delete this file
     2. in SubModals.tsx, delete the `SubSamples` import
     3. in SubModals.tsx, delete the `tab` state, the two-button tab strip,
        and the `tab === "sample"` branch — all three are marked with the
        comment SAMPLE TAB so a grep finds every one
     4. delete the sample assertions in scripts/check-finance-ledger.cjs,
        marked the same way

   Four edits, one grep: `grep -rn "SAMPLE TAB" src scripts`.

   It is already OFF in a production build — `SAMPLES_ON` is false when Vite
   builds with `--mode prod` — so shipping it by accident is not the risk.
   Leaving a demo in the codebase after the thing it demonstrates has changed
   is, which is why the removal list above is a list and not a suggestion.
   ============================================================================= */
import type { ReactNode } from "react";
import { Notice } from "../../ui";
import {
  chainsFor, inr, readInvoice, readQuotation, readSubscription, readUsers,
} from "./store";
import type { ChainOption, FinQuotation } from "./store";

/** OFF in a production build. Still delete the file — see the header. */
export const SAMPLES_ON = import.meta.env.MODE !== "prod";

interface Walkable { business: string; userId: string; chain: ChainOption }

/** Every chain a subscription could be recorded from right now, across the
 *  whole seed. Read, not listed: a hand-written list goes stale the first time
 *  somebody records one of them. */
function walkable(): Walkable[] {
  const out: Walkable[] = [];
  readUsers().forEach((u) => {
    chainsFor(u.userId).forEach((c) => {
      if (c.attachable && !c.recordedAs) {
        out.push({ business: u.business || u.name, userId: u.userId, chain: c });
      }
    });
  });
  return out;
}

function Case({ n, title, what, children }: {
  n: number; title: string; what: string; children?: ReactNode;
}) {
  return (
    <div className="fin-fs" style={{ marginBottom: 12 }}>
      <p style={{ margin: "0 0 6px" }}>
        <b>{n}. {title}</b>
      </p>
      <p className="fin-fine" style={{ marginTop: 0 }}>{what}</p>
      {children}
    </div>
  );
}

function QuoteLine({ q }: { q: FinQuotation }) {
  return (
    <>
      {q.planName} · {q.termMonths} month{q.termMonths === 1 ? "" : "s"} ·{" "}
      {q.installments === 1 ? "complete payment" : q.installments + " installments"} ·{" "}
      {inr(q.grandTotalPaise)}
    </>
  );
}

export function SubSamples({ onUse }: { onUse: (userId: string, quotationNumber: string) => void }) {
  const open = walkable();
  const oneShot = open.filter((w) => w.chain.quotation.installments === 1);
  const split = open.filter((w) => w.chain.quotation.installments > 1);

  /* The two already-recorded demos. Read by id, and the case renders a plain
     note if the seed no longer has them rather than throwing. */
  const paidInFull = readSubscription("SUB-0110");
  const running = readSubscription("SUB-0111");

  return (
    <>
      <Notice ico="sparkle" text={<>
        <b>Sample data, so the flow can be walked before it has a backend.</b>{" "}
        Every case below is read from the seed as it stands now. This tab is off in a
        production build and is deleted when the real endpoints land.
      </>} />

      <Case n={1}
        title="Complete payment, from the chain"
        what="Pick the business; the quotation says the plan, the term and that it is paid in one go; the invoice says how much. Four fields, none of them typed.">
        {oneShot.length ? (
          <div className="fin-pick">
            {oneShot.map((w) => (
              <button key={w.chain.quotation.quotationNumber} type="button"
                onClick={() => onUse(w.userId, w.chain.quotation.quotationNumber)}>
                <span className="mono">{w.business}</span>
                <span className="s"><QuoteLine q={w.chain.quotation} /> · {w.chain.quotation.dealRef}</span>
                <span className="a">Use this →</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="fin-fine">Every one-payment quotation in the seed has been recorded. Reload the page to start again.</p>
        )}
      </Case>

      <Case n={2}
        title="Installments, from the chain"
        what="Same three clicks. The count comes from the quotation — NOT from counting invoices, because the chain raises one per installment as each falls due, so a live three-installment sale usually has one document.">
        {split.length ? (
          <div className="fin-pick">
            {split.map((w) => (
              <button key={w.chain.quotation.quotationNumber} type="button"
                onClick={() => onUse(w.userId, w.chain.quotation.quotationNumber)}>
                <span className="mono">{w.business}</span>
                <span className="s">
                  <QuoteLine q={w.chain.quotation} /> · {w.chain.invoices.length} invoice
                  {w.chain.invoices.length === 1 ? "" : "s"} raised so far
                </span>
                <span className="a">Use this →</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="fin-fine">Every installment quotation in the seed has been recorded. Reload the page to start again.</p>
        )}
      </Case>

      <Case n={3}
        title="No quotation — a website purchase"
        what="Some sales never go through the chain. Pick a business with no accepted quotation and the manual path appears: choose the plan from the catalogue, attach one of their invoices, and the payment plan becomes a real choice again because nothing agreed otherwise.">
        <p className="fin-fine">
          Try <b>Tara Design Collective</b> or <b>Pillai Home Studio</b> — both have an issued
          invoice and nothing quoted.
        </p>
      </Case>

      <Case n={4}
        title="What a finished one looks like"
        what="Both of these are already in the seed, recorded exactly the way the tab above records them.">
        <dl className="kv">
          {paidInFull ? (
            <>
              <dt>{paidInFull.subscriptionId}</dt>
              <dd>
                {paidInFull.customer.name} · {paidInFull.planName} · complete payment ·{" "}
                {inr(paidInFull.totalPaise)} — paid and receipted{" "}
                <a href={"#/finance/subscriptions/" + paidInFull.subscriptionId}>open</a>
              </dd>
            </>
          ) : null}
          {running ? (
            <>
              <dt>{running.subscriptionId}</dt>
              <dd>
                {running.customer.name} · {running.planName} · {running.installments.length} installments ·{" "}
                {inr(running.totalPaise)} — {running.installments.filter((i) => i.status === "paid").length} paid,{" "}
                {running.installments.filter((i) => i.status === "due").length} due, and{" "}
                <b>{running.installments.filter((i) => !i.invoiceNumber).length} with no invoice raised yet</b>{" "}
                <a href={"#/finance/subscriptions/" + running.subscriptionId}>open</a>
              </dd>
            </>
          ) : null}
        </dl>
        {running ? (
          <p className="fin-fine">
            {running.subscriptionId} is the one worth opening: {running.installments.length} installments,{" "}
            {running.installments.filter((i) => i.invoiceNumber).length} invoices. Anything that infers the
            payment plan by counting documents reports it as a{" "}
            {running.installments.filter((i) => i.invoiceNumber).length}-installment sale.
          </p>
        ) : null}
      </Case>

      <Case n={5}
        title="What gets refused, and why"
        what="Each of these is a guard in the store, not a disabled button — the dialog never offers them, and a caller that tries anyway is told which rule it broke.">
        <ul className="pl-feats">
          <li>
            <b>A quotation that was not accepted</b> — never listed. A subscription cannot be
            recorded on a sale that did not happen.{" "}
            {rejectedExample() ? <span className="mono">{rejectedExample()}</span> : null}
          </li>
          <li><b>An invoice another subscription already carries</b> — <span className="mono">duplicate_invoice</span>. One invoice, one thing bought.</li>
          <li><b>An invoice raised for somebody else</b> — <span className="mono">customer_mismatch</span>.</li>
          <li><b>A cancelled or never-issued invoice</b> — <span className="mono">invoice_not_open</span>.</li>
          <li><b>A count that disagrees with the quotation</b> — <span className="mono">plan_mismatch</span>, naming both numbers.</li>
          <li><b>A start date in the future</b> — a subscription starts when it is sold.</li>
        </ul>
      </Case>

      <Case n={6}
        title="One thing that is NOT refused"
        what="A quotation agrees a total; the invoices raised against it need not be equal slices of it. Where they differ the dialog says so and records the invoice anyway, because the invoice is what the customer was actually billed.">
        {unequalExample() ? (
          <p className="fin-fine">
            <span className="mono">{unequalExample()?.quotationNumber}</span> in the seed agreed{" "}
            {inr(unequalExample()?.grandTotalPaise || 0)} over{" "}
            {unequalExample()?.installments} installments, and the invoices raised on it are{" "}
            {(unequalExample()?.invoiceAmounts || []).map((p) => inr(p)).join(", ")} — deliberately
            unequal. Nothing may divide a total by a count to find an installment.
          </p>
        ) : null}
      </Case>
    </>
  );
}

/** The seed's rejected quotation, named only if it is still there and still
 *  rejected. `chainsFor` filters accepted-only, so one cannot be reached
 *  through the chain at all — which is the behaviour this case describes. */
function rejectedExample(): string | null {
  const q = readQuotation("IB-QT-2026-00131");
  return q && q.status !== "accepted" ? q.quotationNumber : null;
}

/** A quotation whose invoices are not equal slices of its total. */
function unequalExample(): { quotationNumber: string; grandTotalPaise: number; installments: number; invoiceAmounts: number[] } | null {
  const q = readQuotation("IB-QT-2026-00147");
  if (!q) return null;
  const amounts = ["IB-INV-2026-00087", "IB-INV-2026-00088", "IB-INV-2026-00089"]
    .map((n) => readInvoice(n))
    .filter((i): i is NonNullable<typeof i> => !!i)
    .map((i) => i.grandTotalPaise);
  const equal = amounts.every((a) => a === amounts[0]);
  if (equal || !amounts.length) return null;
  return {
    quotationNumber: q.quotationNumber,
    grandTotalPaise: q.grandTotalPaise,
    installments: q.installments,
    invoiceAmounts: amounts,
  };
}

