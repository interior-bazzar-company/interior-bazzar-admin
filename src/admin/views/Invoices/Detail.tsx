/* =====================================================================
   INVOICE — the detail PAGE. The prototype's detail() (views-invoice.js), and
   the same shape as the quotation's page next door, because a reader moving
   between the two should not have to relearn the screen.

   What is different is what an invoice is: a demand with money already against
   it. So the figure at the top is the BALANCE, not the total — on a part-paid
   invoice that is the only number anybody is looking for — and the payment
   block is a first-class fact, not a footnote.
   ===================================================================== */
import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import AdminOpsService from "../../../api/modules/adminOps";
import type { InvoiceRow } from "../../../api/modules/adminOps";
import { EmptyState, Icon, KvList, Notice, PaneLoading, Pill, SectionHead, Table, Tabs, qs } from "../../ui";
import { inr, fmtDate } from "../../ui/format";
import { can, useNav, usePageChrome } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import { errMessage } from "../../../api/apiService";
import { STATUS_LABEL, STATUS_TONE, call, useInvoice } from "./api";
import { addonsOf, planItemOf } from "./helpers";
import { EventLog, ProofsBlock } from "./Form";
import ReasonModal from "./ReasonModal";

const TABS = ["lines", "payment", "document", "history"];

export default function InvoiceDetail({ id, tab, params }: {
  id: number; tab: string; params: Record<string, string>;
}) {
  const [tick, setTick] = useState(0);
  const bump = useCallback(() => setTick((t) => t + 1), []);
  const { loading, invoice, notFound } = useInvoice(id, tick);
  const { modal, closeLayer, toast } = useShell();
  const { go } = useNav();
  const cur = TABS.indexOf(tab) >= 0 ? tab : "lines";

  usePageChrome({ crumbs: <span className="tb-title">Invoices</span>, right: null,
                  parent: "#/invoices" });

  if (loading && !invoice) return <div className="page wide"><PaneLoading /></div>;
  if (notFound || !invoice) return (
    <div className="page wide">
      <EmptyState icon="invoice" title="Invoice not found"
        body={"Invoice " + id + " is not in the API's set."}
        action={<button className="btn" onClick={() => go("#/invoices")}>Back to invoices</button>} />
    </div>
  );

  const inv = invoice;
  const isDraft = inv.status === "draft";
  const to = (extra: Record<string, string>) => "#/invoices/" + inv.id + qs({ ...params, ...extra });

  const doAction = (label: string, run: () => Promise<unknown>) => {
    toast(label + "…");
    run().then(() => { toast(label + " done."); bump(); })
      .catch((e: unknown) => toast(errMessage(e), "bad"));
  };

  const openCancel = () => modal(<ReasonModal
    heading="Cancel invoice" sub={inv.invoiceNumber || "Draft"} label="Reason"
    required={inv.status === "issued"} confirmLabel="Cancel invoice" confirmCls="btn dgr"
    onClose={closeLayer}
    run={(reason) => call(AdminOpsService.cancelInvoice(inv.id, reason))
      .then(() => { closeLayer(); bump(); toast("Invoice cancelled."); })} />);

  return (
    <div className="page wide">
      <div className="ph">
        <div className="ph-t">
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <h1 className="mono">{inv.invoiceNumber || "Draft"}</h1>
            <Pill text={STATUS_LABEL[inv.status]} tone={STATUS_TONE[inv.status]} />
          </div>
          <div className="scope">
            {inv.billing.name || "—"}{" · "}
            <a className="lnk mono" onClick={() => go("#/deals/" + inv.dealRef)}>{inv.dealRef} ↗</a>
            {inv.quotationId
              ? <> · against <a className="lnk mono" onClick={() => go("#/quotations/" + inv.quotationId)}>
                  {inv.quotationNumber || "quotation"} ↗</a></>
              : null}
          </div>
        </div>
        <div className="acts">
          {isDraft
            ? <>
                {can("invoices", "edit")
                  ? <button className="btn" onClick={() => go(to({ mode: "edit" }))}>
                      <Icon name="doc" />Edit</button>
                  : null}
                <button className="btn pri" onClick={() => go(to({ mode: "preview" }))}>
                  Preview &amp; issue</button>
              </>
            : <button className="btn pri" onClick={() => go(to({ mode: "preview" }))}>
                <Icon name="invoice" />View document</button>}
        </div>
      </div>

      {inv.status === "cancelled" ? (
        <Notice tone="" text={<>This invoice is cancelled{inv.cancellationReason ? " — " + inv.cancellationReason : ""}.</>} />
      ) : null}

      {/* The balance, not the total: what is still owed is the question this
          page is opened to answer. */}
      <div style={{ marginBottom: "16px" }}>
        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-2)" }}>
          {inv.status === "issued" ? "Settled" : "Grand total"}
        </div>
        <div className="tnum" style={{ fontSize: "var(--text-2xl)", fontWeight: 600,
                                       marginTop: "2px", color: "var(--brand)" }}>
          {inr(inv.grandTotalPaise)}
        </div>
      </div>

      <SectionHead title="Facts" />
      <div className="card"><div className="card-b">
        <KvList cls="wide" pairs={facts(inv, go)} />
      </div></div>

      <div style={{ marginTop: "22px" }}>
        <Tabs cur={cur} onPick={(k) => go(to({ tab: k }))} items={[
          { k: "lines", label: "Lines" },
          { k: "payment", label: "Payment" },
          { k: "document", label: "Document" },
          { k: "history", label: "History", n: inv.events ? inv.events.length : 0 },
        ]} />
      </div>

      {cur === "lines" ? <LinesTab inv={inv} />
        : cur === "payment" ? <PaymentTab inv={inv} onChanged={bump} />
        : cur === "document" ? <DocumentTab inv={inv} onView={() => go(to({ mode: "preview" }))} onRegenerated={bump} />
        : inv.events && inv.events.length ? <EventLog events={inv.events} />
        : <div className="faint">Nothing logged yet.</div>}

      {inv.notes || inv.terms ? (
        <>
          <SectionHead title="Notes &amp; terms" />
          <div className="card"><div className="card-b" style={{ whiteSpace: "pre-wrap",
            fontSize: "var(--text-base)", color: "var(--text-2)" }}>
            {inv.notes ? <p style={{ marginBottom: "8px" }}>{inv.notes}</p> : null}
            {inv.terms}
          </div></div>
        </>
      ) : null}

      <div className="card-f" style={{ marginTop: "18px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {isDraft && can("invoices", "issue")
          ? <button className="btn pri" onClick={() => doAction("Issuing",
              () => call(AdminOpsService.issueInvoice(inv.id)))}><Icon name="check" />Issue</button>
          : null}
        {inv.status !== "cancelled" && can("invoices", "cancel")
          ? <button className="btn dgr" onClick={openCancel}>Cancel invoice</button>
          : null}
      </div>
    </div>
  );
}

function facts(inv: InvoiceRow, go: (h: string) => void): [ReactNode, ReactNode][] {
  const rows: ([ReactNode, ReactNode] | null)[] = [
    ["Deal", <a className="lnk mono" onClick={() => go("#/deals/" + inv.dealRef)}>{inv.dealRef}</a>],
    ["Billed to", <>{inv.billing.name} <span className="faint">{inv.billing.address}</span></>],
    ["Phone", <span className="mono">{inv.billing.phone}</span>],
    ["GSTIN", inv.billing.gstin || <span className="faint">—</span>],
    ["Invoice date", fmtDate(inv.invoiceDate)],
    ["Payment due", fmtDate(inv.dueDate)],
    ["Owner", inv.owner ? inv.owner.name : <span className="faint">—</span>],
    inv.issuedAt ? ["Issued", fmtDate(inv.issuedAt) + (inv.issuedBy ? " by " + inv.issuedBy.name : "")] : null,
    inv.cancelledAt ? ["Cancelled", fmtDate(inv.cancelledAt)] : null,
    ["Place of supply", <>{inv.placeOfSupply} <span className="faint">
      {inv.igstPaise ? "inter-state · IGST" : "intra-state · CGST + SGST"}</span></>],
    ["Tax", <Pill text={inv.taxMode === "not_applicable" ? "Not applicable" : "Applicable"}
                  tone={inv.taxMode === "not_applicable" ? "warn" : ""} />],
  ];
  return rows.filter(Boolean) as [ReactNode, ReactNode][];
}

function LinesTab({ inv }: { inv: InvoiceRow }) {
  const plan = planItemOf(inv);
  const addons = addonsOf(inv);
  const items = [plan, ...addons].filter(Boolean) as NonNullable<typeof plan>[];
  const taxed = inv.taxMode !== "not_applicable";
  return (
    <>
      <Table
        cols={[{ label: "Description" }, { label: "HSN/SAC" }, { label: "Taxable", cls: "n" },
               { label: "GST", cls: "n" }, { label: "Line total", cls: "n" }]}
        rows={items.map((it) => (
          <tr key={it.id}>
            <td>
              <b>{it.description}</b>
              {it.remark ? <div className="cell-2">{it.remark}</div> : null}
              {it.installmentCount
                ? <div className="cell-2">installment {it.installmentSeq} of {it.installmentCount}</div>
                : null}
            </td>
            <td className="mono">{it.hsn || <span className="faint">—</span>}</td>
            <td className="n">{inr(it.taxableAmountPaise)}</td>
            <td className="n">{inr(it.taxAmountPaise)}<div className="cell-2">{it.taxRate}%</div></td>
            <td className="n"><b>{inr(it.lineTotalPaise)}</b></td>
          </tr>
        ))} />
      <SectionHead title="Commercial summary" />
      <div className="card"><div className="card-b">
        <KvList cls="wide" pairs={[
          ["Subtotal", inr(inv.subtotalPaise)],
          [taxed ? "Taxable value" : "Subtotal", inr(inv.taxableTotalPaise)],
          ...(taxed
            ? inv.igstPaise
              ? [["IGST @ " + inv.gstRate + "%", inr(inv.igstPaise)] as [ReactNode, ReactNode]]
              : [["CGST @ " + inv.gstRate / 2 + "%", inr(inv.cgstPaise)] as [ReactNode, ReactNode],
                 ["SGST @ " + inv.gstRate / 2 + "%", inr(inv.sgstPaise)] as [ReactNode, ReactNode]]
            : [["Tax", <span className="faint">Not applicable</span>] as [ReactNode, ReactNode]]),
          ["Grand total", <b>{inr(inv.grandTotalPaise)}</b>],
        ]} />
      </div></div>
    </>
  );
}

/* The payment this invoice raises -- reference, mode, date and the proof. On a
   draft these are the fields the issue transaction will refuse without, so the
   tab doubles as the checklist. */
function PaymentTab({ inv, onChanged }: { inv: InvoiceRow; onChanged: () => void }) {
  const liveProofs = (inv.proofs || []).filter((p) => !p.removed);
  return (
    <>
      <div className="card"><div className="card-b">
        <KvList cls="wide" pairs={[
          ["Reference / UTR", inv.paymentReference || <span className="faint">— required to issue</span>],
          ["Mode", inv.paymentMode || <span className="faint">—</span>],
          ["Payment date", inv.paymentDate ? fmtDate(inv.paymentDate) : <span className="faint">—</span>],
          ["Proof", liveProofs.length
            ? liveProofs.length + " file" + (liveProofs.length > 1 ? "s" : "") + " attached"
            : <span className="faint">— required to issue</span>],
        ]} />
      </div></div>
      {inv.status === "draft" ? <ProofsBlock inv={inv} onChanged={onChanged} /> : null}
    </>
  );
}

function DocumentTab({ inv, onView, onRegenerated }: {
  inv: InvoiceRow; onView: () => void; onRegenerated: () => void;
}) {
  const { toast } = useShell();
  const [info, setInfo] = useState<{ storageKey: string; version: number } | null>(null);
  if (inv.status !== "issued") return (
    <EmptyState icon="invoice" title="No document"
      body="A document is produced by the issue transaction. This invoice has not been issued." />
  );
  return (
    <div className="card"><div className="card-b">
      <KvList cls="wide" pairs={[
        ["Storage key", <span className="mono">{info ? info.storageKey : "—"}</span>],
        ["Version", info ? "v" + info.version : "—"],
      ]} />
      <div style={{ display: "flex", gap: "8px", marginTop: "14px", flexWrap: "wrap" }}>
        <button className="btn" onClick={() =>
          call(AdminOpsService.invoiceDocDownload(inv.id)).then((d) => setInfo(d))
            .catch((e: unknown) => toast(errMessage(e), "bad"))
        }><Icon name="download" />Document info</button>
        <button className="btn" onClick={onView}>View</button>
        {can("invoices", "issue")
          ? <button className="btn" onClick={() =>
              call(AdminOpsService.regenerateInvoiceDoc(inv.id))
                .then(() => { onRegenerated(); toast("New document version generated."); })
                .catch((e: unknown) => toast(errMessage(e), "bad"))
            }>Regenerate</button>
          : null}
      </div>
      <div className="help" style={{ marginTop: "10px" }}>
        The customer's share link lives on the document page — it is a public URL, so it is minted
        where you can see what you are handing out.
      </div>
    </div></div>
  );
}
