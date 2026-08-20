/* =============================================================================
   Business Enquiries — taking an enquiry OUT of the panel.
   -----------------------------------------------------------------------------
   Two shapes, one source. Somebody forwarding an enquiry on WhatsApp and
   somebody printing it for a meeting are the same act — "here is what we know
   about this customer" — so both are built from one description of what that
   means, and neither can quietly start including a field the other does not.

   WHAT NEVER LEAVES, in either shape:

     · the contact log, and the remarks. Those are OUR notes about a customer,
       written by an operator for an operator. "Sounds genuine, just busy" is a
       fair thing to write down and an indefensible thing to forward; "her
       architect is the one who decides" more so. Only the requirement summary —
       the line a person wrote deliberately for a business to read — crosses
       over. That is BE-OD-16, and this file is one of the four places it is
       enforced (here, exportCsv.ts, imageSheet.ts, and the print sheet below).
     · the score, the rank, and who else was eligible. Exposing rank turns
       routing into a negotiation and the weight table into something to game.
     · any money. There is none in the module to leak, and there never will be.

   The customer's phone number DOES leave, and that is the one line worth being
   deliberate about rather than comfortable with: a copied enquiry is personal
   data that has left the audited surface for a chat app nobody can revoke it
   from. The panel cannot enforce anything once it is on the clipboard, so it
   does the only honest thing available — it says so, on the button, before the
   press. BE-OD-11 (when contact is released) governs the delivered payload;
   this is the operator's own copy and is not the same decision.
   ============================================================================= */
import {
  activeAssignment, dateTimeLabel, lastResponse, place, sourceOf, statusOf, urgencyOf, viaLabel,
} from "./store";
import type { Enquiry } from "./store";

const dash = (v: string | null | undefined) => (v && String(v).trim()) || "—";

/* ==================================================== THE SHARE MESSAGE === */
/* Plain text, because it is going into a chat box. No markdown: WhatsApp
   renders *bold* with asterisks and every other app shows the asterisks, so the
   only formatting that travels intact is line breaks and spacing — and a
   message that arrives full of stray punctuation reads as machine spam rather
   than a colleague passing something on. */
export function shareText(e: Enquiry): string {
  const src = sourceOf(e.source.kind);
  const u = urgencyOf(e.qualification.urgency);
  const a = activeAssignment(e);
  const last = lastResponse(e);

  const lines: string[] = [
    "Interior bazzar — enquiry " + e.enquiryId,
    "",
    "Customer   " + dash(e.customer.name),
    "Phone      " + dash(e.customer.phone),
  ];
  if (e.customer.email) lines.push("Email      " + e.customer.email);
  lines.push(
    "",
    "Category   " + dash(e.requirement.category),
    "Service    " + dash(e.requirement.service),
    "Location   " + place(e) +
      (e.requirement.state ? ", " + e.requirement.state : "") +
      (e.requirement.pincode ? " · " + e.requirement.pincode : ""),
  );
  if (e.requirement.projectType) lines.push("Project    " + e.requirement.projectType);
  lines.push("Urgency    " + dash(u ? u.label : null));

  /* The requirement summary if there is one — it was written for exactly this
     purpose. The raw submission only when there is no summary yet, clearly
     labelled as unconfirmed so nobody quotes it back to the customer as though
     we had checked it. */
  lines.push("");
  if (e.qualification.requirementSummary) {
    lines.push("What they need");
    lines.push(e.qualification.requirementSummary);
  } else {
    lines.push("What they submitted (not yet confirmed with the customer)");
    lines.push(e.requirement.text || "—");
  }

  /* The customer's own words, and only ever theirs. */
  if (last?.response) {
    lines.push("");
    lines.push("In their words");
    lines.push("“" + last.response + "”");
  }

  lines.push("");
  lines.push("Status     " + statusOf(e.status).label);
  if (a) lines.push("Assigned   " + a.businessName + " · " + dateTimeLabel(a.assignedAt));
  lines.push("Source     " + src.label + (e.source.via ? " · " + viaLabel(e.source.via) : ""));
  lines.push("Received   " + dateTimeLabel(e.createdAt));

  return lines.join("\n");
}

/** A one-line version, for pasting into a subject or a row of a chat. */
export function shareLine(e: Enquiry): string {
  return [
    e.enquiryId,
    e.customer.name,
    e.customer.phone,
    e.requirement.category,
    place(e),
    urgencyOf(e.qualification.urgency)?.label,
  ].filter(Boolean).join(" · ");
}

/* ======================================================== THE DOCUMENT === */
/* A standalone HTML page handed to `printHtml`, which prints it from a hidden
   frame so the panel's own chrome stays out of the output. It carries its own
   styles and its own @page rules for the same reason: nothing of the app's
   stylesheet reaches it.

   Print, not download-a-file, and that is a deliberate difference from what was
   asked for. The browser's print dialog offers "Save as PDF" on every desktop
   platform, so the file is one press further away — but it is a REAL pdf with
   selectable text, correct page breaks and the user's own margins, rather than
   a screenshot or a .doc that opens differently on every machine. It is also
   how Quotations and Invoices already produce their documents in this panel, so
   there is one way documents come out of the admin rather than two.

   Colours are literal here on purpose: this file is not styled by
   enquiries.css and must render the same on a printer as on a screen, in a
   frame that never sees the theme tokens. */
export function enquirySheetHtml(e: Enquiry): string {
  const src = sourceOf(e.source.kind);
  const u = urgencyOf(e.qualification.urgency);
  const a = activeAssignment(e);
  const q = e.qualification;
  const last = lastResponse(e);

  const esc = (v: unknown) =>
    String(v === null || v === undefined || v === "" ? "—" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const row = (k: string, v: unknown) =>
    `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>${esc(e.enquiryId)} — Interior bazzar enquiry</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0; color: #14201d; background: #fff;
    font: 12px/1.55 "Segoe UI", -apple-system, Helvetica, Arial, sans-serif;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .sheet { max-width: 190mm; margin: 0 auto; }
  header { display: flex; align-items: flex-start; gap: 16px;
           padding-bottom: 12px; border-bottom: 2px solid #0c6b57; }
  .brand { font-size: 17px; font-weight: 700; color: #0c6b57; letter-spacing: -.01em; }
  .brand span { display: block; font-size: 10px; font-weight: 600; letter-spacing: .14em;
                text-transform: uppercase; color: #6d8580; margin-top: 2px; }
  .ref { margin-left: auto; text-align: right; }
  .ref b { display: block; font-family: "Consolas", ui-monospace, monospace; font-size: 15px; }
  .ref span { font-size: 10px; color: #6d8580 }
  .chips { margin: 12px 0 0; display: flex; gap: 6px; flex-wrap: wrap }
  .chip { border: 1px solid #bfcecb; border-radius: 20px; padding: 2px 9px; font-size: 10px;
          color: #3f5451 }
  .chip.hot { border-color: #eeb4a1; color: #b3401f; background: #fdf0eb }
  .chip.src { border-color: #c8d5ec; color: #264b83; background: #eef2fa }
  h2 { font-size: 10px; letter-spacing: .13em; text-transform: uppercase; color: #6d8580;
       margin: 22px 0 7px; font-weight: 700 }
  table { width: 100%; border-collapse: collapse }
  th, td { text-align: left; vertical-align: top; padding: 5px 0; border-bottom: 1px solid #eef3f2 }
  th { width: 34%; font-weight: 500; color: #556c68 }
  td { font-weight: 500 }
  blockquote { margin: 0; padding: 9px 12px; border-left: 3px solid #bfcecb;
               background: #f6f9f8; font-style: italic; page-break-inside: avoid }
  .note { margin-top: 6px; font-size: 10px; color: #6d8580 }
  footer { margin-top: 26px; padding-top: 10px; border-top: 1px solid #d3dedb;
           font-size: 9.5px; color: #6d8580; display: flex; gap: 12px }
  footer .r { margin-left: auto; text-align: right }
  section { page-break-inside: avoid }
</style></head>
<body><div class="sheet">

  <header>
    <div class="brand">Interior bazzar<span>Business enquiry</span></div>
    <div class="ref"><b>${esc(e.enquiryId)}</b><span>${esc(dateTimeLabel(e.createdAt))}</span></div>
  </header>

  <div class="chips">
    <span class="chip">${esc(statusOf(e.status).label)}</span>
    ${u ? `<span class="chip${u.hot ? " hot" : ""}">${esc(u.label)}</span>` : ""}
    <span class="chip src">${esc(src.label)}${e.source.via ? " · " + esc(viaLabel(e.source.via)) : ""}</span>
  </div>

  <section>
    <h2>Customer</h2>
    <table>
      ${row("Name", e.customer.name)}
      ${row("Phone", e.customer.phone)}
      ${row("Email", e.customer.email)}
      ${row("Location", place(e) + (e.requirement.state ? ", " + e.requirement.state : "") + (e.requirement.pincode ? " · " + e.requirement.pincode : ""))}
    </table>
  </section>

  <section>
    <h2>Requirement</h2>
    <table>
      ${row("Category", e.requirement.category)}
      ${row("Service", e.requirement.service)}
      ${row("Project type", e.requirement.projectType)}
      ${row("Intent", e.requirement.intent)}
      ${row("Urgency", u ? u.label : null)}
    </table>
    <div style="margin-top:10px">
      <blockquote>${esc(q.requirementSummary || e.requirement.text)}</blockquote>
      ${q.requirementSummary
        ? `<div class="note">Confirmed with the customer${q.qualifiedBy ? " by " + esc(q.qualifiedBy) : ""}${q.frozenAt ? " on " + esc(dateTimeLabel(q.frozenAt)) : ""}.</div>`
        : `<div class="note">As submitted. <b>Not yet confirmed with the customer</b> — this enquiry has not been qualified.</div>`}
    </div>
  </section>

  ${last?.response ? `<section>
    <h2>In the customer's words</h2>
    <blockquote>${esc(last.response)}</blockquote>
    <div class="note">Recorded ${esc(dateTimeLabel(last.at))}.</div>
  </section>` : ""}

  <section>
    <h2>Handling</h2>
    <table>
      ${row("Status", statusOf(e.status).label)}
      ${row("Owner", e.owner ? e.owner.name : "Unclaimed")}
      ${row("Source", src.label + (e.source.createdBy ? " · added by " + e.source.createdBy : ""))}
      ${row("Submission", e.submissionId)}
      ${a ? row("Assigned to", a.businessName + " · " + dateTimeLabel(a.assignedAt)) : ""}
    </table>
  </section>

  <footer>
    <div>
      Feelsafe Technology India Private Limited · help@interiorbazzar.com<br>
      Operational record. Not a quotation and not an offer.
    </div>
    <div class="r">
      ${esc(e.enquiryId)}<br>Printed ${esc(dateTimeLabel(new Date().toISOString()))}
    </div>
  </footer>

</div></body></html>`;
}
