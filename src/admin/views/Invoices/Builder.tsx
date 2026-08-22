/* =====================================================================
   INVOICE — the builder PAGE (`?mode=edit`), the prototype's builder().

   Draft-only, for the same reason the quotation's is: issued content is frozen
   server-side, so an issued invoice is bounced back with the reason rather than
   shown a form that cannot save.

   The proof block lives here beside the form, not on a separate screen — the
   reference and the evidence are the two things the issue transaction refuses
   without, and they are entered in the same sitting.
   ===================================================================== */
import { useCallback, useState } from "react";
import { EmptyState, Icon, Notice, PaneLoading, Pill, qs } from "../../ui";
import { inr } from "../../ui/format";
import { can, useNav, usePageChrome } from "../../shell/AdminShell";
import { STATUS_LABEL, useInvoice } from "./api";
import type { InvoiceRow } from "./api";
import { BuilderBody } from "./Form";
import { planItemOf } from "./helpers";

export default function InvoiceBuilder({ id, params }: {
  id: number; params: Record<string, string>;
}) {
  const [tick, setTick] = useState(0);
  const bump = useCallback(() => setTick((t) => t + 1), []);
  const { loading, invoice, notFound } = useInvoice(id, tick);
  const { go } = useNav();

  usePageChrome({ crumbs: <span className="tb-title">Invoices</span>, right: null,
                  parent: "#/invoices/" + id });

  if (loading && !invoice) return <div className="page wide"><PaneLoading /></div>;
  if (notFound || !invoice) return (
    <div className="page wide">
      <EmptyState icon="invoice" title="Invoice not found"
        body={"Invoice " + id + " could not be opened. It may have been deleted, or it "
          + "belongs to a deal outside your access."}
        action={<button className="btn" onClick={() => go("#/invoices")}>Back to invoices</button>} />
    </div>
  );

  const inv = invoice;
  const detail = "#/invoices/" + inv.id + qs({ ...params, mode: "" });

  if (inv.status !== "draft") return (
    <div className="page wide">
      <div className="ph"><div className="ph-t">
        <h1 className="mono">{inv.invoiceNumber || "Draft"}</h1>
        <div className="scope">Issued content is frozen.</div>
      </div></div>
      <Notice tone="bad" ico="lock" text={<>
        <b>This invoice is {STATUS_LABEL[inv.status].toLowerCase()}.</b> A settled document cannot be
        edited — cancel it and raise another if it is wrong.
      </>} />
      <button className="btn" style={{ marginTop: "12px" }} onClick={() => go(detail)}>
        <Icon name="chevl" />Back to the invoice</button>
    </div>
  );

  if (!can("invoices", "edit")) return (
    <div className="page wide">
      <EmptyState icon="lock" title="No editing access"
        body="Your role can read invoices but not change them."
        action={<button className="btn" onClick={() => go(detail)}>Back to the invoice</button>} />
    </div>
  );

  return (
    <div className="page wide">
      <div className="ph">
        <div className="ph-t">
          <div className="faint" style={{ fontSize: "var(--text-sm)" }}>
            Step 2 of 2 ·{" "}
            <a className="lnk" data-go={"#/deals/" + inv.dealRef} onClick={() => go("#/deals/" + inv.dealRef)}>
              {inv.dealRef}</a>
          </div>
          <h1>New invoice</h1>
          <div className="scope">
            <Pill text="Draft" />{" "}
            <span className="mono">Number assigned on issue</span>
          </div>
        </div>
        <div className="acts">
          <button className="btn" onClick={() => go(detail)}><Icon name="chevl" />Back</button>
          <button className="btn pri" onClick={() => go("#/invoices/" + inv.id + "?mode=preview")}>
            Preview &amp; issue</button>
        </div>
      </div>

      {/* The source strip -- both links and what this draft is billing, always
          visible. An invoice that loses sight of its quotation is the one thing
          the issue guards refuse outright. */}
      <div className="card" style={{ marginBottom: "14px" }}><div className="card-b"
        style={{ display: "flex", gap: "22px", flexWrap: "wrap", alignItems: "center" }}>
        <a className="lnk mono" data-go={"#/deals/" + inv.dealRef}
          onClick={() => go("#/deals/" + inv.dealRef)}>{inv.dealRef} ↗</a>
        {inv.quotationId
          ? <a className="lnk mono" data-go={"#/quotations/" + inv.quotationId}
              onClick={() => go("#/quotations/" + inv.quotationId)}>
              {inv.quotationNumber || "quotation"} ↗</a>
          : <span className="pill bad xs">quotation_required</span>}
        <span style={{ marginLeft: "auto" }} className="tnum">
          <b>{inr(inv.grandTotalPaise)}</b>
          <span className="faint">{" · " + installmentLine(inv)}</span>
        </span>
      </div></div>

      <BuilderBody inv={inv} onSaved={bump} />
    </div>
  );
}

/* What this draft is billing, in the words the quotation's schedule used. */
function installmentLine(inv: InvoiceRow): string {
  const plan = planItemOf(inv);
  if (plan && plan.installmentCount)
    return "installment " + plan.installmentSeq + " of " + plan.installmentCount;
  return "this invoice";
}
