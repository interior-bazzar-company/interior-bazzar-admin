/* =============================================================================
   THE INVOICE ITSELF
   -----------------------------------------------------------------------------
   The same document Module 2 prints, in the same hand. It shares `.qdoc` —
   one stylesheet, two documents — because a customer receives both and two
   papers from one company that do not look related is the fastest way to look
   like neither is real.

   What it does NOT share is the content. An invoice is a demand for payment
   and a tax document; a quotation is an offer. So this one leads with what is
   owed and when, states the tax split as an invoice legally must, names the
   installment it is billing, and carries the payment instructions at full
   weight rather than as a footnote.

   Payment proofs are never handed to this function. Same boundary the old
   preview enforced, kept deliberately: there is no template field a bank
   screenshot could render into.
   ============================================================================= */
import { Fragment } from "react";
import type { ReactNode } from "react";
import { IBData, IBInvoice, IBQuote } from "../../engines";
import { inr, quoteNumberOf } from "./helpers";
import { BRAND_MARK } from "../../ui";

const D = IBData, N = IBInvoice, Q = IBQuote;

/* Module 2's block, called across. Two documents disagreeing about an account
   number is the one inconsistency here that costs money — but `bankBlock` lives
   in views-quotation.js, not in the engine, so the port cannot import it. It is
   the same eight rows, in the same order. */
export function BankBlock({ s }: { s: any }) {
  const rows: [string, string | undefined, boolean?][] = [
    ["Receiver", s.bank_receiver || s.name],
    ["Account type", s.bank_type],
    ["Account no.", s.bank_account, true],
    ["IFSC", s.bank_ifsc, true],
    ["Branch", s.bank_branch],
    ["UPI ID", s.upi, true],
    ["SWIFT", s.swift, true],
    ["Accepts", s.methods]
  ];
  return (
    <table className="qd-bank"><tbody>
      {rows.filter((r) => r[1]).map((r, i) => (
        <tr key={i}><th>{r[0]}</th><td className={r[2] ? "mono" : undefined}>{r[1]}</td></tr>
      ))}
    </tbody></table>
  );
}

export function InvoiceDoc({ inv }: { inv: any }) {
  const plan = N.planOf(inv.invoice_id), addons = N.addonsOf(inv.invoice_id);
  /* A line worth nothing does not go on a customer's invoice. The engine
     keeps zero and balancing rows for its own arithmetic — the "Balance of
     term" filler is one — and they were printing as "−₹0", which is both
     noise and, on a tax document, the kind of noise that gets queried. */
  const items = [plan].concat(addons).filter(function (it: any) {
    if (!it) return false;
    const v = it.line_total_paise === undefined ? it.amount_paise : it.line_total_paise;
    return Math.round(Math.abs(v || 0) / 100) !== 0;      // anything that prints as ₹0
  });
  const t = N.price(inv, N.itemsOf(inv.invoice_id));
  const b = N.billedTo(inv);
  const S_ = N.seller();
  const taxed = N.taxApplicable(inv);
  const qn = quoteNumberOf(inv);
  const mark = inv.invoice_status === N.DOC.DRAFT ? "DRAFT"
             : inv.invoice_status === N.DOC.CANCELLED ? "CANCELLED" : null;

  const tot = (k: ReactNode, v: ReactNode, cls?: string) => (
    <tr className={cls || ""}><th>{k}</th><td className="qd-n">{v}</td></tr>
  );

  return (
    <article className="qdoc" id="qdoc">
      {mark ? <div className="qd-mark" aria-hidden="true"><span>{mark}</span></div> : null}

      {/* ---- letterhead ---- */}
      <header className="qd-head">
        {/* The same head the quotation prints — one letterhead, two documents.
            GSTIN appears only when there is one; registration is processing. */}
        <div className="qd-brand">
          <img src={BRAND_MARK} width={52} height={52} alt="Interior bazzar"
               style={{ flex: "0 0 52px", display: "block", borderRadius: "8px" }} />
          <div>
            <h1>{S_.brand || S_.name}</h1>
            {S_.tagline ? <div className="qd-legal-nm">{S_.tagline}</div> : null}
            <p>{S_.addr || ""}<br />
              {S_.phone || ""}{"  ·  "}{S_.email || ""}
              {S_.domain ? <>{"  ·  "}{S_.domain}</> : null}<br />
              <span className="mono">
                {S_.gstin ? <>{"GSTIN " + S_.gstin}{"  ·  "}</> : null}
                {S_.cin ? "CIN " + S_.cin : null}
                {S_.pan ? <>{"  ·  PAN " + S_.pan}</> : null}
                {S_.udyam ? <><br />{S_.udyam}</> : null}
              </span>
            </p>
          </div>
        </div>
        <div className="qd-title">
          <h2>{taxed ? "Tax Invoice" : "Invoice"}</h2>
          <table className="qd-meta"><tbody>
            <tr><th>No.</th><td className="mono">
              {inv.invoice_number || <span className="qd-tbd">assigned on issue</span>}</td></tr>
            <tr><th>Date</th><td>{D.fmtDate(inv.invoice_date)}</td></tr>
            {/* The due date is the whole point of the document, so it is the one
                line in the block that carries weight. */}
            <tr className="qd-due"><th>Payment due</th><td>{D.fmtDate(inv.due_date)}</td></tr>
            {qn ? <tr><th>Against</th><td className="mono">{qn}</td></tr> : null}
          </tbody></table>
        </div>
      </header>

      {/* ---- parties ---- */}
      <section className="qd-parties">
        <div><h3>Bill to</h3>
          <p><b>{b.name || "—"}</b><br />
            {b.business ? <>{b.business}<br /></> : null}
            {b.address || "—"}<br />
            {b.phone ? b.phone : null}{b.email ? <>{"  ·  "}{b.email}</> : null}
            {b.gstin ? <><br /><span className="mono">GSTIN {b.gstin}</span></> : null}
          </p>
        </div>
        <div><h3>Place of supply</h3>
          <p><b>{inv.place_of_supply || "—"}</b><br />
            <span className="qd-tbd">{t.intra ? "Intra-state · CGST + SGST" : "Inter-state · IGST"}</span>
          </p>
          <h3 style={{ marginTop: "10px" }}>Reference</h3>
          <p className="mono">{inv.deal_id}</p>
        </div>
      </section>

      {/* ---- the goods ---- */}
      <table className="qd-items">
        <thead><tr>
          <th className="qd-i">#</th><th>Description</th><th className="qd-c">HSN/SAC</th>
          <th className="qd-n">Taxable</th>{taxed ? <th className="qd-n">GST</th> : null}
          <th className="qd-n">Amount</th>
        </tr></thead>
        <tbody>
          {items.map((it: any, i: number) => {
            const sub = it === plan
              ? (it.remark ? it.remark
                  : "Subscription" + (it.installment_count
                      ? " · installment " + it.installment_seq + " of " + it.installment_count : ""))
              : "";
            return (
              <tr key={i}>
                <td className="qd-i">{i + 1}</td>
                <td><b>{it.description}</b>{sub ? <span className="qd-sub">{sub}</span> : null}</td>
                <td className="qd-c mono">{it.hsn ? it.hsn : "—"}</td>
                <td className="qd-n">{inr(it.taxable_amount_paise === undefined ? it.amount_paise : it.taxable_amount_paise)}</td>
                {taxed ? <td className="qd-n">{inr(it.tax_amount_paise)}<span className="qd-sub">{it.tax_rate}%</span></td> : null}
                <td className="qd-n"><b>{inr(it.line_total_paise === undefined ? it.amount_paise : it.line_total_paise)}</b></td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* ---- money ---- */}
      <section className="qd-foot">
        <div className="qd-words">
          <h3>Amount in words</h3>
          <p>{D.inrWords ? D.inrWords(t.grand_total) : ""}</p>
          <h3 style={{ marginTop: "14px" }}>Payment to</h3>
          <BankBlock s={S_} />
        </div>
        <table className="qd-totals"><tbody>
          {tot(taxed ? "Taxable value" : "Subtotal", inr(t.taxable))}
          {!taxed
            ? tot("Tax", <span className="qd-tbd">Not applicable</span>)
            : t.intra
              ? <Fragment>
                  {tot("CGST @ " + (t.gst_rate / 2) + "%", inr(t.cgst))}
                  {tot("SGST @ " + (t.gst_rate / 2) + "%", inr(t.sgst))}
                </Fragment>
              : tot("IGST @ " + t.gst_rate + "%", inr(t.igst))}
          {tot("Grand total", inr(t.grand_total), "qd-grand")}
          {/* What is actually left to pay. On a part-paid invoice this is the
              only number the customer is looking for, and computing it in their
              head from two others is how the wrong amount gets transferred. */}
          {N.received(inv)
            ? <Fragment>
                {tot("Received", "−" + inr(N.received(inv)))}
                {tot("Balance due", inr(Math.max(0, t.grand_total - N.received(inv))), "qd-rule")}
              </Fragment>
            : null}
        </tbody></table>
      </section>

      {/* ---- the small print ---- */}
      <section className="qd-terms">
        <div><h3>Terms</h3>
          <div className="qd-plain">{inv.terms || ""}</div>
          {inv.notes ? <><h3 style={{ marginTop: "12px" }}>Notes</h3>
            <div className="qd-plain">{inv.notes}</div></> : null}
        </div>
        <div><h3 style={{ visibility: "hidden" }}>.</h3>
          <div className="qd-sign"><span></span>Authorised signatory<br />
            <b>{S_.name}</b></div>
        </div>
      </section>

      <footer className="qd-legal">
        This is a computer-generated invoice and is valid without a physical signature.{" "}
        {taxed ? "GST is charged at the rate in force on the date of this invoice. " : ""}
        Please quote {inv.invoice_number || "the invoice number"} on every transfer. Subject to{" "}
        {S_.jurisdiction || S_.state || "Delhi"} jurisdiction.
        <span>{S_.name}{"  ·  "}{S_.email || ""}{"  ·  "}{inv.invoice_number || "draft"}</span>
      </footer>
    </article>
  );
}

/* Referenced so the import is not dead: the engine handoff the prototype made
   through `Q.bankBlock` is now BankBlock above, and Q is still what tells this
   file whether a quotation module is loaded at all. */
export const hasQuoteModule = !!Q;
