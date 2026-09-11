/* =====================================================================
   QUOTATION — the document PAGE (`?mode=preview`), the prototype's preview().

   "This is the artefact the customer receives. It is the last point at which
   anything can change." So the page is the document and almost nothing else:
   the way out, the way to keep a copy, and — on a draft — the one action the
   page exists for, which is to issue it.

   The share link is minted HERE rather than on the detail page, because this is
   the screen where you can see what you are about to hand out.
   ===================================================================== */
import { useState } from "react";
import AdminOpsService from "../../../api/modules/adminOps";
import { Button, EmptyState, PaneLoading, ShareLine, TbTitle, copyToClipboard, publicDocUrl, shareOrCopy, qs } from "../../ui";
import type { MenuItem } from "../../ui";
import { can, useNav, usePageChrome } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import { errMessage } from "../../../api/apiService";
import { STATUS_LABEL, call, useQuotation } from "./api";
import { partyLine } from "./helpers";
import { VersionRail } from "./Detail";
import DocPage from "./DocPage";
import IssueModal from "./IssueModal";

export default function QuotationPreview({ id, params }: {
  id: number; params: Record<string, string>;
}) {
  const [tick, setTick] = useState(0);
  const { loading, quotation, notFound } = useQuotation(id, tick);
  const { modal, closeLayer, toast } = useShell();
  const { go } = useNav();
  const [share, setShare] = useState<{ link: string; expires: string } | null>(null);

  usePageChrome({ crumbs: <TbTitle label="Quotations" to="#/quotations" />, right: null,
                  parent: "#/quotations/" + id });

  if (loading && !quotation) return <PaneLoading label="Opening the quotation…" />;
  if (notFound || !quotation) return (
    <EmptyState icon="quote" title="Quotation not found"
      body={"Quotation " + id + " could not be opened. It may have been deleted, or it "
        + "belongs to a deal outside your access."}
      action={<Button color="primary" onClick={() => go("#/quotations")}>Back to quotations</Button>} />
  );

  const q = quotation;
  const isDraft = q.status === "draft";
  const detail = "#/quotations/" + q.id + qs({ ...params, mode: "" });
  const title = "Quotation " + (q.quotationNumber || q.id);

  const getLink = () =>
    call(AdminOpsService.quotationDocShare(q.id))
      .then(async (d) => {
        const link = publicDocUrl(d.link);
        setShare({ link, expires: d.expires });
        const said = await shareOrCopy(link, title);
        if (said) toast(said);
      })
      .catch((e: unknown) => toast(errMessage(e), "bad"));

  /* Issuing is the irreversible one, so it is confirmed first — the dialog
     states the number is about to be spent, what the customer will hold, and
     whether the four server-side checks currently pass. */
  const issue = () => modal(<IssueModal q={q} onClose={closeLayer}
    run={() => call(AdminOpsService.issueQuotation(q.id))
      .then((row) => { closeLayer(); toast("Issued as " + (row.quotationNumber || "a numbered quotation") + "."); setTick((t) => t + 1); })} />, "lg");

  const menu: MenuItem[] = [];
  if (isDraft && can("quotations", "issue"))
    menu.push({ icon: "check", label: "Issue quotation", title: "Spends the number — irreversible", act: issue });
  if (!isDraft && q.hasDocument)
    menu.push({ icon: "link", label: share ? "New share link" : "Create share link",
      title: "An expiring link, logged as SHARED", act: getLink });
  /* Only once there is a link to copy — the minting row already offers it to
     the share sheet; this is the second time you want it and the toast is
     gone. */
  if (share)
    menu.push({ icon: "copy", label: "Copy link", title: "The link minted above",
      act: () => { void copyToClipboard(share.link).then((said) => toast(said)); } });

  return (
    <DocPage
      kind="Quotation"
      label={q.quotationNumber || "Draft quotation"}
      scope={isDraft
        ? "This is the artefact the customer receives. It is the last point at which anything can change."
        : "The document exactly as the customer has it. " + partyLine(q) + " · " + STATUS_LABEL[q.status]}
      fetchHtml={() => call(AdminOpsService.quotationDocHtml(q.id))}
      rail={<div className="mt-4"><VersionRail q={q} /></div>}
      banner={share ? <ShareLine link={share.link} expires={share.expires} /> : null}
      back={() => go(detail)}
      backLabel="Back to the quotation"
      menu={menu} />
  );
}
