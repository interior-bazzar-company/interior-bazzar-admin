/* =====================================================================
   QUOTATION — the builder PAGE (`?mode=edit`), the prototype's builder().

   Step 2 of 2: step 1 picked the deal (PickDeal.tsx), this prices it. The page
   itself is only the four guards — loading, missing, frozen, forbidden — and
   then `BuilderBody`, which owns the header, the form and the live sheet.

   Draft-only, and the guard is the same one the server enforces: there is no
   PUT on an issued quotation, so an issued one is bounced back to its detail
   page with the reason rather than shown a form that could not save.
   ===================================================================== */
import { useCallback, useState } from "react";
import { Alert, Button, EmptyState, PageHeader, PaneLoading, Pill, TbTitle, qs } from "../../ui";
import { can, useNav, usePageChrome } from "../../shell/AdminShell";
import { STATUS_LABEL, STATUS_TONE, useQuotation } from "./api";
import { BuilderBody } from "./Form";

export default function QuotationBuilder({ id, params }: {
  id: number; params: Record<string, string>;
}) {
  const [tick, setTick] = useState(0);
  const bump = useCallback(() => setTick((t) => t + 1), []);
  const { loading, quotation, notFound } = useQuotation(id, tick);
  const { go } = useNav();

  usePageChrome({ crumbs: <TbTitle label="Quotations" to="#/quotations" />, right: null,
                  parent: "#/quotations/" + id });

  if (loading && !quotation) return <PaneLoading label="Opening the draft…" />;
  if (notFound || !quotation) return (
    <EmptyState icon="quote" title="Quotation not found"
      body={"Quotation " + id + " could not be opened. It may have been deleted, or it "
        + "belongs to a deal outside your access."}
      action={<Button color="primary" onClick={() => go("#/quotations")}>Back to quotations</Button>} />
  );

  const q = quotation;
  const detail = "#/quotations/" + q.id + qs({ ...params, mode: "" });

  if (q.status !== "draft") return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader eyebrow="Quotation" title={<span className="font-mono tnum">{q.quotationNumber || "Draft"}</span>}
        back={{ label: "Back to the quotation", to: detail }}
        meta={<><Pill dot text={STATUS_LABEL[q.status]} tone={STATUS_TONE[q.status]} /> Issued content is frozen.</>}
        actions={<Button color="primary" ico="chevl" onClick={() => go(detail)}>Back to the quotation</Button>} />
      <Alert tone="bad" ico="lock" title={"This quotation is " + STATUS_LABEL[q.status].toLowerCase() + "."}>
        It cannot be edited in place — revise it into a new draft instead.
      </Alert>
    </div>
  );

  if (!can("quotations", "edit")) return (
    <EmptyState icon="lock" title="No editing access"
      body="Your role can read quotations but not change them."
      action={<Button color="primary" onClick={() => go(detail)}>Back to the quotation</Button>} />
  );

  return <BuilderBody q={q} onSaved={bump} detail={detail} />;
}
