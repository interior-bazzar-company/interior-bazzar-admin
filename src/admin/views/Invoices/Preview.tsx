/* =====================================================================
   INVOICE — the document PAGE (`?mode=preview`), the prototype's preview().

   The same screen the quotation has, and the same sheet source: the server
   renders it from the template the customer's link serves, so what an agent
   checks before issuing is what the customer will receive.
   ===================================================================== */
import { useState } from "react";
import AdminOpsService from "../../../api/modules/adminOps";
import { Button, EmptyState, PaneLoading, TbTitle, copyToClipboard, publicDocUrl, qs, ShareLine, shareOrCopy } from "../../ui";
import type { MenuItem } from "../../ui";
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

  usePageChrome({ crumbs: <TbTitle label="Invoices" to="#/invoices" />, right: null,
                  parent: "#/invoices/" + id });

  if (loading && !invoice) return <PaneLoading label="Opening the invoice…" />;
  if (notFound || !invoice) return (
    <EmptyState icon="invoice" title="Invoice not found"
      body={"Invoice " + id + " could not be opened. It may have been deleted, or it "
        + "belongs to a deal outside your access."}
      action={<Button color="primary" onClick={() => go("#/invoices")}>Back to invoices</Button>} />
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

  /* The same three actions the quotation's preview offers, in the same order
     and on the same `MoreMenu` contract — `title` says the consequence, which
     for issuing is the one that cannot be taken back. */
  const menu: MenuItem[] = [];
  if (isDraft && can("invoices", "issue"))
    menu.push({ icon: "check", label: "Issue invoice", title: "Spends the number and writes the payment", act: issue });
  if (!isDraft)
    menu.push({ icon: "link", label: share ? "New share link" : "Create share link", title: "An expiring link, logged as SHARED", act: getLink });
  if (share)
    menu.push({
      icon: "copy",
      label: "Copy link",
      title: "The link minted above",
      act: () => { void copyToClipboard(share.link).then((said) => toast(said)); },
    });

  return (
    <DocPage
      kind="Tax invoice"
      label={inv.invoiceNumber || "Draft invoice"}
      scope={isDraft
        ? "This is the artefact the customer receives. Issuing allocates the number and writes the payment."
        : "The document exactly as the customer has it. " + (inv.billing.name || "") + " · " + STATUS_LABEL[inv.status]}
      fetchHtml={() => call(AdminOpsService.invoiceDocHtml(inv.id))}
      banner={share ? <ShareLine link={share.link} expires={share.expires} /> : null}
      back={() => go(detail)}
      backLabel="Back to the invoice"
      menu={menu} />
  );
}
