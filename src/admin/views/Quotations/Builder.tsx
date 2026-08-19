/* =====================================================================
   QUOTATION — the builder PAGE (`?mode=edit`), the prototype's builder().

   Step 2 of 2: step 1 picked the deal (PickDeal.tsx), this prices it. The
   page is a header plus BuilderBody's two columns — three numbered steps on
   the left, the live summary and the one Save in the sticky rail.

   Draft-only, and the guard is the same one the server enforces: there is no
   PUT on an issued quotation, so an issued one is bounced back to its detail
   page with the reason rather than shown a form that could not save.
   ===================================================================== */
import { useCallback, useState } from "react";
import { EmptyState, Icon, Notice, PaneLoading, Pill, qs } from "../../ui";
import { can, useNav, usePageChrome } from "../../shell/AdminShell";
import { STATUS_LABEL, useQuotation } from "./api";
import { BuilderBody } from "./Form";

export default function QuotationBuilder({ id, params }: {
  id: number; params: Record<string, string>;
}) {
  const [tick, setTick] = useState(0);
  const bump = useCallback(() => setTick((t) => t + 1), []);
  const { loading, quotation, notFound } = useQuotation(id, tick);
  const { go } = useNav();

  usePageChrome({ crumbs: <span className="tb-title">Quotations</span>, right: null,
                  parent: "#/quotations/" + id });

  if (loading && !quotation) return <div className="page wide"><PaneLoading /></div>;
  if (notFound || !quotation) return (
    <div className="page wide">
      <EmptyState icon="quote" title="Quotation not found"
        body={"Quotation " + id + " is not in the API's set."}
        action={<button className="btn" onClick={() => go("#/quotations")}>Back to quotations</button>} />
    </div>
  );

  const q = quotation;
  const detail = "#/quotations/" + q.id + qs({ ...params, mode: "" });

  if (q.status !== "draft") return (
    <div className="page wide">
      <div className="ph"><div className="ph-t">
        <h1 className="mono">{q.quotationNumber || "Draft"}</h1>
        <div className="scope">Issued content is frozen.</div>
      </div></div>
      <Notice tone="bad" ico="lock" text={<>
        <b>This quotation is {STATUS_LABEL[q.status].toLowerCase()}.</b> It cannot be edited in place —
        revise it into a new draft instead.
      </>} />
      <button className="btn" style={{ marginTop: "12px" }} onClick={() => go(detail)}>
        <Icon name="chevl" />Back to the quotation</button>
    </div>
  );

  if (!can("quotations", "edit")) return (
    <div className="page wide">
      <EmptyState icon="lock" title="No editing access"
        body="Your role can read quotations but not change them."
        action={<button className="btn" onClick={() => go(detail)}>Back to the quotation</button>} />
    </div>
  );

  return (
    <div className="page wide">
      <div className="ph">
        <div className="ph-t">
          <div className="faint" style={{ fontSize: "var(--text-sm)" }}>
            Step 2 of 2 ·{" "}
            <a className="lnk" data-go={"#/deals/" + q.dealRef} onClick={() => go("#/deals/" + q.dealRef)}>
              {q.dealRef}</a> · v{q.version}
          </div>
          <h1>{q.parentQuotationId ? "Revision" : "New quotation"}</h1>
          <div className="scope">
            <Pill text="Draft" />{" "}
            <span className="mono">Number assigned on issue</span>
          </div>
        </div>
        <div className="acts">
          <button className="btn" onClick={() => go(detail)}><Icon name="chevl" />Back</button>
          <button className="btn pri" onClick={() => go("#/quotations/" + q.id + "?mode=preview")}>
            Preview &amp; issue</button>
        </div>
      </div>

      <BuilderBody q={q} onSaved={bump} />
    </div>
  );
}
