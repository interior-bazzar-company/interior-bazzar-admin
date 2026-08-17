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
import { EmptyState, Icon, KvList, Notice, PaneLoading, Pill, SectionHead, qs } from "../../ui";
import { inr, fmtDate } from "../../ui/format";
import { can, useNav, usePageChrome } from "../../shell/AdminShell";
import { STATUS_LABEL, STATUS_TONE, useInvoice } from "./api";
import { EditForm, ProofsBlock } from "./Form";

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
        body={"Invoice " + id + " is not in the API's set."}
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
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <h1 className="mono">{inv.invoiceNumber || "Draft"}</h1>
            <Pill text={STATUS_LABEL[inv.status]} tone={STATUS_TONE[inv.status]} />
          </div>
          <div className="scope">
            Editing — the number is allocated by issuing, not by saving.
          </div>
        </div>
        <div className="acts">
          <button className="btn" onClick={() => go(detail)}><Icon name="chevl" />Back</button>
          <button className="btn pri" onClick={() => go("#/invoices/" + inv.id + "?mode=preview")}>
            Preview &amp; issue</button>
        </div>
      </div>

      <SectionHead title="Billed to" desc="Frozen onto the document when it is issued." />
      <div className="card"><div className="card-b">
        <KvList cls="wide" pairs={[
          ["Name", inv.billing.name],
          ["Address", inv.billing.address],
          ["Phone", <span className="mono">{inv.billing.phone}</span>],
          ["Payment due", fmtDate(inv.dueDate)],
          ["Grand total", <b>{inr(inv.grandTotalPaise)}</b>],
        ]} />
      </div></div>

      <div style={{ marginTop: "18px" }}>
        <EditForm inv={inv} onSaved={bump} />
      </div>
      <ProofsBlock inv={inv} onChanged={bump} />
    </div>
  );
}
