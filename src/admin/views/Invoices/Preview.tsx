/* =====================================================================
   INVOICE — the document PAGE (`?mode=preview`), the prototype's preview().

   The same screen the quotation has, and the same sheet source: the server
   renders it from the template the customer's link serves, so what an agent
   checks before issuing is what the customer will receive.
   ===================================================================== */
import { useState } from "react";
import AdminOpsService from "../../../api/modules/adminOps";
import { EmptyState, PaneLoading, copyToClipboard, publicDocUrl, qs, ShareLine, shareOrCopy } from "../../ui";
import { can, useNav, usePageChrome } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import { errMessage } from "../../../api/apiService";
import { inr } from "../../ui/format";
import { STATUS_LABEL, call, useInvoice } from "./api";
import { Mi } from "../Deals/bits";
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
        body={"Invoice " + id + " could not be opened. It may have been deleted, or it "
          + "belongs to a deal outside your access."}
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
        back={() => go(detail)}
        menu={<>
          {isDraft && can("invoices", "issue")
            ? <Mi ico="check" label="Issue invoice"
                hint="Spends the number and writes the payment" onClick={issue} />
            : null}
          {!isDraft
            ? <Mi ico="link" label={share ? "New share link" : "Create share link"}
                hint="An expiring link, logged as SHARED" onClick={getLink} />
            : null}
          {share
            ? <Mi ico="doc" label="Copy link" hint="The link minted above"
                onClick={() => { void copyToClipboard(share.link).then((said) => toast(said)); }} />
            : null}
        </>} />
  );
}
