/* =====================================================================
   QUOTATION — the builder PAGE (`?mode=edit`), the prototype's builder().

   Draft-only, and the guard is the same one the server enforces: there is no
   PUT on an issued quotation, so an issued one is bounced back to its detail
   page with the reason rather than shown a form that could not save.

   The form itself is the one the drawer carried — same fields, same single
   Save, now with a page's width to lay them out in and the customer/party
   block beside them instead of scrolled past.
   ===================================================================== */
import { useCallback, useState } from "react";
import { EmptyState, Icon, KvList, Notice, PaneLoading, Pill, SectionHead, qs } from "../../ui";
import { inr } from "../../ui/format";
import { can, useNav, usePageChrome } from "../../shell/AdminShell";
import { STATUS_LABEL, STATUS_TONE, useQuotation } from "./api";
import { partyLine } from "./helpers";
import { EditForm } from "./Form";
import { VersionRail } from "./Detail";

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
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <h1 className="mono">{q.quotationNumber || "Draft"}</h1>
            <Pill text={"v" + q.version} />
            <Pill text={STATUS_LABEL[q.status]} tone={STATUS_TONE[q.status]} />
          </div>
          <div className="scope">
            Editing — nothing here is with the customer until you issue it.
          </div>
        </div>
        <div className="acts">
          <button className="btn" onClick={() => go(detail)}><Icon name="chevl" />Back</button>
          <button className="btn pri" onClick={() => go("#/quotations/" + q.id + "?mode=preview")}>
            Preview &amp; issue</button>
        </div>
      </div>

      <VersionRail q={q} />

      <SectionHead title="Customer" desc="Tracked live from the deal until this quotation is issued." />
      <div className="card"><div className="card-b">
        <KvList cls="wide" pairs={[
          ["Party", partyLine(q)],
          ["Email", q.party.email || <span className="faint">—</span>],
          ["Phone", <span className="mono">{q.party.phone}</span>],
          ["Location", [q.party.city, q.party.state].filter(Boolean).join(", ") || "—"],
          ["GSTIN", q.party.gstin || <span className="faint">—</span>],
          ["Grand total", <b>{inr(q.grandTotalPaise)}</b>],
        ]} />
      </div></div>

      <div style={{ marginTop: "18px" }}>
        <EditForm q={q} onSaved={bump} />
      </div>
    </div>
  );
}
