/* =====================================================================
   INVOICE — the document PAGE (`?mode=preview`), the prototype's preview().

   The same screen the quotation has, and the same sheet source: the server
   renders it from the template the customer's link serves, so what an agent
   checks before issuing is what the customer will receive.
   ===================================================================== */
import { useState } from "react";
import AdminOpsService from "../../../api/modules/adminOps";
import { EmptyState, Icon, PaneLoading, publicDocUrl, qs, ShareLine, shareOrCopy } from "../../ui";
import { can, useNav, usePageChrome } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import { errMessage } from "../../../api/apiService";
import { inr } from "../../ui/format";
import { STATUS_LABEL, call, useInvoice } from "./api";
import DocPage from "../Quotations/DocPage";
import IssueModal from "./IssueModal";

export default function InvoicePreview({ id, params }: {
  id: number; params: Record<string, string>;
}) {
  const [tick, setTick] = useState(0);
  const { loading, invoice, notFound } = useInvoice(id, tick);
  const { modal, closeLayer, toast } = useShell();
  const { go } = useNav();
  const [share, setShare] = useState<{ link: string; expires: string } | null>(null);

  usePageChrome({ crumbs: <span className="tb-title">Invoices</span>, right: null,
                  parent: "#/invoices/" + id });

  if (loading && !invoice) return <div className="page qpage"><PaneLoading /></div>;
  if (notFound || !invoice) return (
    <div className="page qpage">
      <EmptyState icon="invoice" title="Invoice not found"
        body={"Invoice " + id + " is not in the API's set."}
        action={<button className="btn" onClick={() => go("#/invoices")}>Back to invoices</button>} />
    </div>
  );

  const inv = invoice;
  const isDraft = inv.status === "draft";
  const detail = "#/invoices/" + inv.id + qs({ ...params, mode: "" });
  const title = "Invoice " + (inv.invoiceNumber || inv.id);

  const getLink = () =>
    call(AdminOpsService.invoiceDocShare(inv.id))
      .then(async (d) => {
        const link = publicDocUrl(d.link);
        setShare({ link, expires: d.expires });
        const said = await shareOrCopy(link, title);
        if (said) toast(said);
      })
      .catch((e: unknown) => toast(errMessage(e), "bad"));

  /* Issuing is the irreversible one -- it spends a number AND writes the deal
     ledger row in the same transaction -- so it is confirmed first, exactly as
     the quotation's is. */
  const issue = () => modal(<IssueModal inv={inv} onClose={closeLayer}
    run={() => call(AdminOpsService.issueInvoice(inv.id))
      .then((row) => {
        closeLayer();
        toast("Issued as " + (row.invoiceNumber || "a numbered invoice")
          + " and " + inr(row.grandTotalPaise) + " logged to " + row.dealRef + ".");
        setTick((t) => t + 1);
      })} />);

  return (
    <DocPage
        label={inv.invoiceNumber || "Draft invoice"}
        scope={isDraft
          ? "This is the artefact the customer receives. Issuing allocates the number and writes the payment."
          : "The document exactly as the customer has it. " + (inv.billing.name || "") + " · " + STATUS_LABEL[inv.status]}
        fetchHtml={() => call(AdminOpsService.invoiceDocHtml(inv.id))}
        banner={share ? <ShareLine link={share.link} expires={share.expires} /> : null}
        acts={<>
          <button className="btn" onClick={() => go(detail)}><Icon name="chevl" />Back</button>
          {isDraft && can("invoices", "issue")
            ? <button className="btn pri" onClick={issue}><Icon name="check" />Issue invoice</button>
            : null}
          {!isDraft
            ? <button className="btn" onClick={getLink}>
                <Icon name="link" />{share ? "New share link" : "Get share link"}</button>
            : null}
        </>} />
  );
}
