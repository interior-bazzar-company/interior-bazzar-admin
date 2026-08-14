/* =============================================================================
   THE QUOTATION ITSELF
   -----------------------------------------------------------------------------
   What the customer receives, and the only screen in this product that is not
   an admin screen. It stopped looking like a document some time ago: brand
   tokens for colour, panel type sizes, a card with the app's own borders, and
   a logo drawn in whatever serif the reader happened to have. It read as a
   screenshot of a CRM, which is exactly what a quotation must not read as.

   So this is built on paper rules instead of interface rules:

     · a fixed 210mm measure, so the thing on screen is the thing that prints
     · the real brand mark, inline, identical in the panel and on paper
     · black on white, one accent, hairlines — no app surfaces, no --bg
     · tabular numerals in every money column, right-aligned, aligned decimals
     · the parts a B2B quotation is commercially expected to carry: place of
       supply, the tax split named correctly for intra vs inter-state, the
       total in words, payment terms, bank details, and a signature block.
       What it does NOT carry is anything that belongs to a tax document —
       HSN/SAC codes and the company PAN live on the invoice, because this is
       an offer and neither of them helps a customer decide
     · @media print rules that make Ctrl-P produce the PDF, with the app
       chrome gone and the table headers repeating across pages

   A watermark states anything that would mislead a reader — DRAFT, EXPIRED,
   SUPERSEDED — because a document that does not say what it is is the one
   kind of document worth being afraid of.
   ============================================================================= */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment } from "react";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { D, Q, inr } from "./core";
import { BrandLogo } from "./brand";

/* Where the money goes. Verbatim from the account, and shared by the
   quotation and the invoice so a customer paying against either transfers to
   the same place — two documents disagreeing about an account number is the
   one inconsistency in this product that would actually cost somebody money.
   Every row is conditional: an account with no SWIFT prints no SWIFT line
   rather than an empty one. */
export function BankBlock({ s }: { s: any }) {
  const r = (k: string, v: string, mono?: boolean) =>
    v ? <tr key={k}><th>{k}</th><td className={mono ? "mono" : undefined}>{v}</td></tr> : null;
  return (
    <table className="qd-bank"><tbody>
      {r("Receiver", s.bank_receiver || s.name)}
      {r("Account type", s.bank_type)}
      {r("Account no.", s.bank_account, true)}
      {r("IFSC", s.bank_ifsc, true)}
      {r("Branch", s.bank_branch)}
      {r("UPI ID", s.upi, true)}
      {r("SWIFT", s.swift, true)}
      {r("Accepts", s.methods)}
    </tbody></table>
  );
}

export function Qdoc({ q, embedded }: { q: any; embedded?: boolean }) {
  const plan = Q.planOf(q.quotation_id), addons = Q.addonsOf(q.quotation_id);
  const items = [plan].concat(addons).filter(Boolean);
  const t = Q.price(q, Q.itemsOf(q.quotation_id));
  const schedule = Q.installmentSchedule(q.quotation_id);
  const cs = Q.partyOf(q);
  const S_ = Q.SELLER;
  const taxed = Q.taxApplicable(q);
  const expired = q.status === Q.ST.ISSUED && Q.daysUntil(q.valid_until) < 0;

  /* The one thing a reader must not get wrong is what they are holding. */
  const mark = q.status === Q.ST.DRAFT ? "DRAFT"
    : q.status === Q.ST.SUPERSEDED ? "SUPERSEDED"
      : q.status === Q.ST.CANCELLED ? "CANCELLED"
        : q.status === Q.ST.REJECTED ? "NOT ACCEPTED"
          : expired || q.status === Q.ST.EXPIRED ? "EXPIRED" : null;

  const tot = (k: ReactNode, v: ReactNode, cls?: string) => (
    <tr className={cls || ""}><th>{k}</th><td className="qd-n">{v}</td></tr>
  );

  const terms = String(q.terms || Q.TERMS_TEMPLATE || "").split(/\n+/)
    .map((l) => l.replace(/^[\s·•\-\d.]+/, "").trim()).filter(Boolean);

  return (
    <article className={"qdoc" + (embedded ? " qdoc-embed" : "")} id="qdoc">
      {mark ? <div className="qd-mark" aria-hidden="true"><span>{mark}</span></div> : null}

      {/* ---- letterhead ----
          The mark, the brand beside it, and the legal entity under that. A
          customer bought Interior bazzar and will be paying FEELSAFE TECHNOLOGY
          INDIA PRIVATE LIMITED; a document that names only one of the two is a
          document their accounts desk has to ring up about.

          GSTIN is printed only when there IS one. Registration is processing,
          and "GSTIN: processing" on a letterhead is worse than silence — it
          tells the reader the number they need does not exist, in the place they
          went looking for it. */}
      <header className="qd-head">
        <div className="qd-brand">
          <BrandLogo size={52} radius={8} />
          <div>
            <h1>{S_.brand || S_.name}</h1>
            {S_.tagline ? <div className="qd-legal-nm">{S_.tagline}</div> : null}
            <p>{S_.addr}<br />
              {S_.phone} &nbsp;·&nbsp; {S_.email}
              {S_.domain ? <> &nbsp;·&nbsp; {S_.domain}</> : null}<br />
              <span className="mono">
                {S_.gstin ? <>GSTIN {S_.gstin} &nbsp;·&nbsp; </> : null}
                CIN {S_.cin}
                {/* No PAN on a quotation. It is an offer, not a payment document —
                    nothing about it needs the company's tax account number, and a
                    number that serves no purpose on a page is a number handed to
                    everyone who is ever sent one. It stays in SELLER, and the
                    invoice still carries it, because a tax document is where a
                    payer legitimately looks for it. */}
                {S_.udyam ? <><br />{S_.udyam}</> : null}
              </span>
            </p>
          </div>
        </div>
        <div className="qd-title">
          <h2>Quotation</h2>
          <table className="qd-meta"><tbody>
            <tr><th>No.</th><td className="mono">
              {q.quotation_number || <span className="qd-tbd">assigned on issue</span>}</td></tr>
            {/* "Revision", not "Version". A customer reading v3 does not care
                that a database counts rows — they care that this is the third
                time we have quoted them, which is what the word says. */}
            <tr><th>Revision</th><td>v{q.version}
              {q.parent_quotation_id ? <> <span className="qd-tbd">· revised</span></> : null}</td></tr>
            <tr><th>Date</th><td>{D.fmtDate(q.quotation_date)}</td></tr>
            <tr><th>Valid until</th><td className={expired ? "qd-bad" : undefined}>
              {D.fmtDate(q.valid_until)}</td></tr>
          </tbody></table>
        </div>
      </header>

      {/* ---- parties ---- */}
      <section className="qd-parties">
        <div><h3>Quotation for</h3>
          <p><b>{cs.name || "—"}</b><br />
            {cs.business ? <>{cs.business}<br /></> : null}
            {cs.address || "—"}<br />
            {cs.phone ? cs.phone : null}{cs.email ? <> &nbsp;·&nbsp; {cs.email}</> : null}
            {cs.gstin ? <><br /><span className="mono">GSTIN {cs.gstin}</span></> : null}
          </p>
        </div>
        <div><h3>Place of supply</h3>
          <p><b>{q.place_of_supply || "—"}</b><br />
            <span className="qd-tbd">{t.intra ? "Intra-state · CGST + SGST" : "Inter-state · IGST"}</span>
          </p>
          <h3 style={{ marginTop: "10px" }}>Reference</h3>
          <p className="mono">{q.deal_id}</p>
        </div>
      </section>

      {/* ---- the goods ---- */}
      <table className="qd-items">
        <thead><tr>
          <th className="qd-i">#</th><th>Description</th>
          <th className="qd-c">Term</th><th className="qd-n">Discount</th>
          <th className="qd-n">Taxable</th>{taxed ? <th className="qd-n">GST</th> : null}
          <th className="qd-n">Amount</th>
        </tr></thead>
        <tbody>
          {items.map((it: any, i: number) => {
            const n = Q.lineNet(it);
            return (
              <tr key={it.item_id || i}>
                <td className="qd-i">{i + 1}</td>
                {/* EVERY feature, never "+4 more". This is the page on which somebody
                    decides whether to spend ₹2,19,000, and the four we were hiding were
                    chosen by nothing better than array order — which meant the reason a
                    customer would have said yes could be the one we cut. A quotation is
                    not a listing card; it can afford the lines.

                    They render as a list rather than a middot run because ten labels in
                    one paragraph is a wall, and each one is a thing being bought. */}
                <td className="">
                  <b>{it.name}</b>
                  {it.description ? <span className="qd-sub">{it.description}</span> : null}
                  {it.features && it.features.length
                    ? <ul className="qd-feat">{it.features.map((f: any, j: number) => <li key={j}>{f.label}</li>)}</ul>
                    : null}
                </td>
                {/* No HSN/SAC column. A quotation is an offer, not a tax document — the
                    classification belongs on the invoice, which still carries it, and
                    here it was a column of identical codes taking width from the one
                    thing on the row a customer actually reads. */}
                <td className="qd-c">{it.term_months ? it.term_months + " months" : "—"}</td>
                {/* No Rate column. It was the negotiated total divided by the term — a
                    figure nobody agreed to, derived from two that are both already on
                    the row, and the one column customers asked about. Term and Taxable
                    say the same thing without inviting the arithmetic. */}
                <td className="qd-n">{n.disc ? "−" + inr(n.disc) : "—"}</td>
                <td className="qd-n">{inr(it.taxable_amount_paise)}</td>
                {taxed ? <td className="qd-n">{inr(it.tax_amount_paise)}<span className="qd-sub">{it.tax_rate}%</span></td> : null}
                <td className="qd-n"><b>{inr(it.line_total_paise)}</b></td>
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
          {schedule && schedule.length ? (
            <>
              <h3 style={{ marginTop: "14px" }}>
                {"Payment schedule · " + schedule.length + " payments, every " +
                  Q.installmentPlan(plan).gap + " month" + (Q.installmentPlan(plan).gap > 1 ? "s" : "")}
              </h3>
              <table className="qd-sched"><tbody>
                {schedule.map((r: any, i: number) => (
                  /* "Registration" was only ever true when the first payment was a
                     booking amount. It is the first installment of N, and saying
                     so is both accurate and what the ledger will call it. */
                  <tr key={r.seq}>
                    <th>Payment {r.seq} of {schedule.length}
                      {i === 0 ? <> <span className="qd-tbd">· on acceptance</span></> : null}</th>
                    <td>{D.fmtDate(r.due_date)}</td><td className="qd-n">{inr(r.amount_paise)}</td>
                  </tr>
                ))}
              </tbody></table>
            </>
          ) : null}
        </div>
        <table className="qd-totals"><tbody>
          {tot("Gross amount", inr(t.gross))}
          {t.discount ? tot("Discount" + (q.discount_pct ? " (" + q.discount_pct + "%)" : ""), "−" + inr(t.discount)) : null}
          {tot(taxed ? "Taxable value" : "Subtotal", inr(t.taxable), "qd-rule")}
          {!taxed
            ? tot("Tax", <span className="qd-tbd">Not applicable</span>)
            : t.intra
              ? <Fragment key="split">
                  {tot("CGST @ " + (t.gst_rate / 2) + "%", inr(t.cgst))}
                  {tot("SGST @ " + (t.gst_rate / 2) + "%", inr(t.sgst))}
                </Fragment>
              : tot("IGST @ " + t.gst_rate + "%", inr(t.igst))}
          {tot("Grand total", inr(t.grand_total), "qd-grand")}
        </tbody></table>
      </section>

      {/* ---- the small print ---- */}
      <section className="qd-terms">
        <div><h3>Terms &amp; conditions</h3>
          <ol>{terms.map((l, i) => <li key={i}>{l}</li>)}</ol>
          {q.notes ? <><h3 style={{ marginTop: "12px" }}>Notes</h3><p>{q.notes}</p></> : null}
        </div>
        {/* No signature block. A quotation is an offer — nothing about it
            is signed, and the ruled line plus its clearance was the tallest
            thing on the page carrying no information. Removing it is what
            lets this fit on one sheet, which is what a quotation should be.
            The invoice keeps its own — a demand needs a signatory. */}
        <div><h3>Payment to</h3><BankBlock s={S_} /></div>
      </section>

      <footer className="qd-legal">
        This is a computer-generated quotation and is valid without a physical signature.
        Prices are quoted in Indian Rupees and hold until {D.fmtDate(q.valid_until)}.{" "}
        {taxed ? "GST is charged at the rate in force on the date of invoice. " : ""}
        Subject to {S_.jurisdiction} jurisdiction.
        <span>{S_.name} &nbsp;·&nbsp; {S_.email} &nbsp;·&nbsp; {q.quotation_number || "draft"}</span>
      </footer>
    </article>
  );
}

/* ================================================================== PDF ===
   THE FILE IS THE PAGE.

   Download prints THE DOCUMENT ITSELF. The markup handed to the print frame is
   the identical component the preview renders, under the identical stylesheet,
   laid out by the identical engine. It cannot drift, because there is no second
   implementation left to drift from — and the browser's own PDF writer produces
   a better file than a canvas re-draw ever did: selectable text, real
   hyphenation, repeating table headers, and the A4 page breaks the print rules
   already describe.

   It renders in an off-screen iframe rather than the live page, so Download
   works from anywhere — the list, the detail, the document — without first
   navigating somewhere the print rules happen to suit. The app behind it is
   untouched and nothing flashes.

   PORT NOTE: the prototype read `link[rel=stylesheet]` off the host page. Under
   Vite the dev server injects the theme as an inline <style> instead, so both
   are collected — otherwise the printed sheet is unstyled in development and
   styled in production, which is the one difference you would never notice
   until a customer had the file.                                             */
function themeCss() {
  const links: string[] = [];
  document.querySelectorAll('link[rel="stylesheet"]').forEach((l) => {
    const href = (l as HTMLLinkElement).href;          // already absolute — the frame has no base
    if (href) links.push(href);
  });
  const inline: string[] = [];
  document.querySelectorAll("style").forEach((s) => inline.push(s.textContent || ""));
  return { links, inline };
}

export function printQdoc(q: any, title: string, toast: (m: string, tone?: string) => void) {
  const html = renderToStaticMarkup(<Qdoc q={q} />);
  const css = themeCss();

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.setAttribute("title", title || "Document");
  /* Off-screen rather than display:none — a frame that is not laid out has no
     page box, and a browser will happily print a blank sheet from one. */
  frame.style.cssText = "position:fixed;left:-10000px;top:0;width:230mm;height:320mm;border:0;opacity:0";
  document.body.appendChild(frame);

  const d = frame.contentDocument as Document;
  d.open();
  d.write('<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8">' +
    "<title>" + String(title || "Document").replace(/[<>&]/g, "") + "</title>" +
    css.links.map((h) => '<link rel="stylesheet" href="' + h.replace(/"/g, "&quot;") + '">').join("") +
    css.inline.map((t) => "<style>" + t + "</style>").join("") +
    /* The document is already millimetre-sized and already carries its own
       print rules; this only strips the frame's own chrome and margin. */
    "<style>@page{size:A4;margin:0}html,body{margin:0;padding:0;background:#fff}" +
    ".qdoc-stage{padding:0;background:#fff}" +
    ".qdoc{box-shadow:none;margin:0 auto}</style></head>" +
    '<body class="qdoc-stage">' + html + "</body></html>");
  d.close();

  let fired = false;
  const run = () => {
    if (fired) return;
    fired = true;
    try {
      (frame.contentWindow as Window).focus();
      (frame.contentWindow as Window).print();
    } catch (e) {
      toast("Could not open the print dialog — " + (e as Error).message, "bad");
    }
    /* Kept until the dialog has certainly been handed the document. Removing
       it synchronously after print() cancels the job in some browsers. */
    setTimeout(() => { if (frame.parentNode) frame.parentNode.removeChild(frame); }, 60000);
  };

  /* Wait for the stylesheet AND the webfonts, or the first page comes out in
     the system stack and the second one does not — which is worse than
     waiting. The timeout is the floor, not the plan. */
  frame.addEventListener("load", () => {
    const f = (frame.contentDocument as any) && (frame.contentDocument as any).fonts;
    if (f && f.ready && f.ready.then) f.ready.then(run, run); else run();
  });
  setTimeout(run, 2500);
}
