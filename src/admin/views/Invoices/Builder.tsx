/* =====================================================================
   INVOICE — the builder PAGE (`?mode=edit`), the prototype's builder().

   Draft-only, for the same reason the quotation's is: issued content is frozen
   server-side, so an issued invoice is bounced back with the reason rather than
   shown a form that cannot save.

   The proof block lives here beside the form, not on a separate screen — the
   reference and the evidence are the two things the issue transaction refuses
   without, and they are entered in the same sitting.

   The four guards are drawn exactly as Quotations/Builder draws them, and the
   header belongs to `BuilderBody` in Form.tsx exactly as the quotation's does:
   this is the second half of one workflow, and the two builders must not look
   like two products.
   ===================================================================== */
import { useCallback, useState } from "react";
import { Alert, Button, EmptyState, PageHeader, PaneLoading, Pill, TbTitle, qs } from "../../ui";
import { can, useNav, usePageChrome } from "../../shell/AdminShell";
import { STATUS_LABEL, STATUS_TONE, useInvoice } from "./api";
import { BuilderBody } from "./Form";

export default function InvoiceBuilder({ id, params }: {
  id: number; params: Record<string, string>;
}) {
  const [tick, setTick] = useState(0);
  const bump = useCallback(() => setTick((t) => t + 1), []);
  const { loading, invoice, notFound } = useInvoice(id, tick);
  const { go } = useNav();

  usePageChrome({ crumbs: <TbTitle label="Invoices" to="#/invoices" />, right: null,
                  parent: "#/invoices/" + id });

  if (loading && !invoice) return <PaneLoading label="Opening the draft…" />;
  if (notFound || !invoice) return (
    <EmptyState icon="invoice" title="Invoice not found"
      body={"Invoice " + id + " could not be opened. It may have been deleted, or it "
        + "belongs to a deal outside your access."}
      action={<Button color="primary" onClick={() => go("#/invoices")}>Back to invoices</Button>} />
  );

  const inv = invoice;
  const detail = "#/invoices/" + inv.id + qs({ ...params, mode: "" });

  if (inv.status !== "draft") return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader eyebrow="Invoice" title={<span className="font-mono tnum">{inv.invoiceNumber || "Draft"}</span>}
        back={{ label: "Back to the invoice", to: detail }}
        meta={<><Pill dot text={STATUS_LABEL[inv.status]} tone={STATUS_TONE[inv.status]} /> Issued content is frozen.</>}
        actions={<Button color="primary" ico="chevl" onClick={() => go(detail)}>Back to the invoice</Button>} />
      <Alert tone="bad" ico="lock" title={"This invoice is " + STATUS_LABEL[inv.status].toLowerCase() + "."}>
        A settled document cannot be edited — cancel it and raise another if it is wrong.
      </Alert>
    </div>
  );

  if (!can("invoices", "edit")) return (
    <EmptyState icon="lock" title="No editing access"
      body="Your role can read invoices but not change them."
      action={<Button color="primary" onClick={() => go(detail)}>Back to the invoice</Button>} />
  );

  return <BuilderBody inv={inv} onSaved={bump} detail={detail} />;
}
