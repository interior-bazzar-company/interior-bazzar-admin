/* =====================================================================
   INVOICE — the detail PAGE. The prototype's detail() (views-invoice.js), and
   the same shape as the quotation's page next door, because a reader moving
   between the two should not have to relearn the screen.

   What is different is what an invoice is: a demand with money already against
   it. So the figure at the top is the BALANCE, not the total — on a part-paid
   invoice that is the only number anybody is looking for — and the payment
   block is a first-class fact, not a footnote.
   ===================================================================== */
import { Fragment, useCallback, useState } from "react";
import type { ReactNode } from "react";
import AdminOpsService from "../../../api/modules/adminOps";
import type { InvoiceRow } from "../../../api/modules/adminOps";
import { EmptyState, Icon, KvList, Notice, PaneLoading, Pill, SectionHead, Table, Tabs, TbTitle, qs } from "../../ui";
import { inr, fmtDate } from "../../ui/format";
import { can, useNav, usePageChrome } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import { errMessage } from "../../../api/apiService";
import { STATUS_LABEL, STATUS_TONE, call, useInvoice } from "./api";
import { addonsOf, planItemOf } from "./helpers";
import { ChainStrip } from "../chainStrip";
import { usePlanCatalogue, useQuotation } from "../Quotations/api";
import { planLabel } from "../Quotations/helpers";
import { daysFrom } from "../Deals/useDeals";
import { EventLog, ProofsBlock } from "./Form";
import ReasonModal from "./ReasonModal";

/* The prototype's order (views-invoice.js detail): what was bought, then
   the paper, then the money, then the log. */
const TABS = ["plan", "document", "payment", "history"];

export default function InvoiceDetail({ id, tab, params }: {
  id: number; tab: string; params: Record<string, string>;
}) {
  const [tick, setTick] = useState(0);
  const bump = useCallback(() => setTick((t) => t + 1), []);
  const { loading, invoice, notFound } = useInvoice(id, tick);
  /* The chain strip draws the quotation cell from the document itself, not
     from whatever the deal's latest quotation happens to be -- so fetch the one
     THIS invoice was raised against. Before the early returns below: the hook
     order has to be the same on every render, and `null` is a no-op fetch. */
  const { quotation } = useQuotation(invoice ? invoice.quotationId : null, 0);
  const { modal, closeLayer, toast, openPop, closePop, popAnchor } = useShell();
  const { go } = useNav();
  const cur = TABS.indexOf(tab) >= 0 ? tab : "plan";

  usePageChrome({ crumbs: <TbTitle label="Invoices" to="#/invoices" />, right: null,
                  parent: "#/invoices" });

  if (loading && !invoice) return <div className="page wide"><PaneLoading /></div>;
  if (notFound || !invoice) return (
    <div className="page wide">
      <EmptyState icon="invoice" title="Invoice not found"
        body={"Invoice " + id + " could not be opened. It may have been deleted, or it "
          + "belongs to a deal outside your access."}
        action={<button className="btn" onClick={() => go("#/invoices")}>Back to invoices</button>} />
    </div>
  );

  const inv = invoice;
  const isDraft = inv.status === "draft";
  const to = (extra: Record<string, string>) => "#/invoices/" + inv.id + qs({ ...params, ...extra });

  const openCancel = () => modal(<ReasonModal
    heading="Cancel invoice" sub={inv.invoiceNumber || "Draft"} label="Reason"
    required={inv.status === "issued"} confirmLabel="Cancel invoice" confirmCls="btn dgr"
    onClose={closeLayer}
    run={(reason) => call(AdminOpsService.cancelInvoice(inv.id, reason))
      .then(() => { closeLayer(); bump(); toast("Invoice cancelled."); })} />);

  /* Everything occasional behind one trailing menu -- the same move Quotations
     made, and the prototype's actionBar + M["in-more"]. */

  /* "Save as draft", the prototype's in-save-draft: it commits the draft as it
     stands and assigns no number. Nothing is typed on THIS page, so the patch
     carries only the rowVersion -- which is not a no-op write: the server
     re-checks that the draft is still a draft, refuses a stale rowVersion
     ("Someone else saved this draft while you were editing"), recalculates the
     totals and bumps the version. Same write the builder's Save makes, minus
     the fields. */
  const saveDraft = () => call(AdminOpsService.saveInvoice(inv.id, { rowVersion: inv.rowVersion }))
    .then(() => { bump(); toast("Draft saved. No number is assigned until it is issued."); })
    .catch((e: unknown) => toast(errMessage(e), "bad"));
  const moreMenu = (e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget as HTMLElement;
    if (popAnchor === el) return closePop();
    const mi = (ico: string, label: string, hint: string, run: () => void, cls?: string) => (
      <button className={"mi" + (cls ? " " + cls : "")} onClick={() => { closePop(); run(); }}>
        <Icon name={ico} /><span><b>{label}</b><span className="d">{hint}</span></span>
      </button>
    );
    const items: ReactNode[] = [];
    /* The working actions lead — the record header holds only More and Back
       now, so what used to sit as buttons beside the menu lives at the top
       of it. Issue still has no entry anywhere here: it happens on the
       preview, because nobody should freeze a document they have not just
       looked at. */
    if (isDraft) {
      if (can("invoices", "edit"))
        items.push(mi("doc", "Edit", "Open the draft in the builder", () => go(to({ mode: "edit" }))));
      items.push(mi("invoice", "Preview & issue", "The document, ready to issue", () => go(to({ mode: "preview" }))));
    } else {
      items.push(mi("invoice", "View document", "The issued document, as the customer has it", () => go(to({ mode: "preview" }))));
    }
    if (isDraft && can("invoices", "edit"))
      items.push(mi("check", "Save as draft", "Keeps everything applied so far. No number is assigned.",
        saveDraft));
    if (inv.status !== "cancelled" && can("invoices", "cancel"))
      items.push(isDraft
        ? mi("x", "Cancel draft", "Consumes no number, so nothing dangles", openCancel, "dgr")
        : mi("x", "Cancel invoice", "The number stays spent -- a correction is a new invoice",
             openCancel, "dgr"));
    if (!items.length)
      items.push(<div key="none" className="pop-b" style={{ padding: "10px 12px" }}>
        <span className="faint">Nothing else to do on this one.</span></div>);
    openPop(el, <div className="pop-b">{items.map((n, i) => <Fragment key={i}>{n}</Fragment>)}</div>,
      { width: 268, cls: "pop-views" });
  };

  /* Issued means the ledger row is already written, in the same transaction
     (InvoicesController.Issue) -- so received is the whole grand total or it is
     nothing, and the balance is the rest. No figure here is estimated. */
  const received = inv.status === "issued" ? inv.grandTotalPaise : 0;
  const balance = inv.grandTotalPaise - received;
  const over = inv.status === "draft" ? Math.max(0, -daysFrom(inv.dueDate)) : 0;

  return (
    <div className="page wide">
      <div className="ph">
        <div className="ph-t">
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <h1 className="mono">{inv.invoiceNumber || "Draft"}</h1>
            <span className="vsep" aria-hidden="true" />
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
        {/* The record-header pattern the whole panel takes: everything the
            record can do sits behind More, and the primary Back closes the
            row. `data-act` on the trigger is load-bearing — see the shell's
            popover close listener. */}
        <div className="acts">
          <button className="btn" data-act="in-more" aria-haspopup="menu"
            title="Everything this invoice can do" onClick={moreMenu}>More</button>
          <button className="btn pri" onClick={() => go("#/invoices")}>
            <Icon name="chevl" />Back</button>
        </div>
      </div>

      {inv.status === "cancelled" ? (
        <Notice tone="" text={<>This invoice is cancelled{inv.cancellationReason ? " — " + inv.cancellationReason : ""}.</>} />
      ) : null}

      {/* What it is worth, what came in, what is still owed, and by when --
          the prototype's four figures. One grand total answered none of the
          three questions an invoice is opened with. */}
      <div style={{ display: "flex", gap: "28px", flexWrap: "wrap", marginBottom: "16px" }}>
        <Fig k="Amount" v={inr(inv.grandTotalPaise)} />
        <Fig k="Received" v={inr(received)} color={received ? "var(--ok)" : undefined} />
        <Fig k="Balance" v={inr(balance)} color={balance ? undefined : "var(--ok)"} />
        <Fig k={inv.status === "cancelled" ? "Cancelled" : over ? "Overdue by" : "Due"}
          v={inv.status === "cancelled" ? fmtDate(inv.cancelledAt)
            : over ? over + " day" + (over === 1 ? "" : "s")
              : fmtDate(inv.dueDate)}
          color={over ? "var(--bad)" : undefined} />
      </div>

      <SectionHead title="Facts" />
      <div className="card"><div className="card-b">
        <KvList cls="wide" pairs={facts(inv, go)} />
      </div></div>

      <div style={{ marginTop: "22px" }}>
        <Tabs cur={cur} onPick={(k) => go(to({ tab: k }))} items={[
          { k: "plan", label: "Plan" },
          { k: "document", label: "Document" },
          { k: "payment", label: "Payment" },
          { k: "history", label: "History", n: inv.events ? inv.events.length : 0 },
        ]} />
      </div>

      {cur === "plan" ? <PlanTab inv={inv} />
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

      {/* Where this document sits in the sequence, and why the next link is not
          there yet. The same strip the quotation page carries. */}
      <SectionHead title="Related" />
      <ChainStrip dealRef={inv.dealRef} here="invoice" quotation={quotation} />
    </div>
  );
}

function Fig({ k, v, color }: { k: string; v: ReactNode; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: "var(--text-sm)", color: "var(--text-2)" }}>{k}</div>
      <div className="tnum" style={{ fontSize: "var(--text-2xl)", fontWeight: 600,
                                     marginTop: "2px", color }}>{v}</div>
    </div>
  );
}

/* The prototype's Facts list (views-invoice.js detail), in its order: where
   this invoice came from, who owns it, when it happened, and what it is taxed
   as. Phone and GSTIN are not here -- they are billing fields that print on
   the document, one click away, rather than facts about the invoice. Invoice
   date stays because it is NOT the created date: it is the date the document
   carries, and an agent can set it. */
function facts(inv: InvoiceRow, go: (h: string) => void): [ReactNode, ReactNode][] {
  /* Only a draft can be overdue -- issuing writes the ledger row in the same
     transaction, so an issued invoice is paid. Same rule as the list. */
  const over = inv.status === "draft" ? Math.max(0, -daysFrom(inv.dueDate)) : 0;
  const rows: ([ReactNode, ReactNode] | null)[] = [
    ["Deal", <a className="lnk mono" onClick={() => go("#/deals/" + inv.dealRef)}>{inv.dealRef}</a>],
    ["Quotation", inv.quotationId
      ? <a className="lnk mono" onClick={() => go("#/quotations/" + inv.quotationId)}>
          {inv.quotationNumber || "#" + inv.quotationId}</a>
      : <Pill text="missing" tone="bad" />],
    ["Customer", <>{inv.billing.name || "—"} <span className="faint">{inv.billing.address}</span></>],
    ["Owner", inv.owner ? inv.owner.name : <span className="faint">—</span>],
    ["Created", fmtDate(inv.createdAt) + (inv.createdBy ? " by " + inv.createdBy.name : "")],
    inv.issuedAt ? ["Issued", fmtDate(inv.issuedAt) + (inv.issuedBy ? " by " + inv.issuedBy.name : "")] : null,
    ["Invoice date", fmtDate(inv.invoiceDate)],
    ["Due", <>{fmtDate(inv.dueDate)}
      {over ? <span style={{ color: "var(--bad)" }}>{" · +" + over + "d"}</span> : null}</>],
    ["Place of supply", <>{inv.placeOfSupply} <span className="faint">
      {inv.igstPaise ? "inter-state · IGST" : "intra-state · CGST + SGST"}</span></>],
    ["Tax", <Pill text={inv.taxMode === "not_applicable" ? "Not applicable" : "Applicable"}
                  tone={inv.taxMode === "not_applicable" ? "warn" : ""} />],
    /* The money is the deal ledger's, written by the issue transaction itself
       -- so an unissued invoice has none, whatever reference was typed on it. */
    ["Payment", inv.status === "issued"
      ? <><span className="mono">{inv.paymentReference || "—"}</span>{" "}
          <span className="faint">· from the deal ledger</span></>
      : <span className="faint">none yet</span>],
    inv.cancelledAt
      ? ["Cancelled", fmtDate(inv.cancelledAt) + (inv.cancelledBy ? " by " + inv.cancelledBy.name : "")
          + (inv.cancellationReason ? " · " + inv.cancellationReason : "")]
      : null,
  ];
  return rows.filter(Boolean) as [ReactNode, ReactNode][];
}

/* WHAT WAS BOUGHT, then what it costs -- the prototype's planTab. The plan
   card first, because "AutoGrowth · Scale, installment 2 of 4" is the answer to
   "what is this invoice for"; the priced lines under it are the arithmetic.

   The feature chips are the tier itself, read back off the plan catalogue by
   the name stored on the line -- the same match Quotations' builder makes
   (Form.tsx PlanBlock). A hand-typed name, or a tier since retired, simply
   renders without them. HSN moves under the description, where the prototype
   keeps it: it is a tax code, not a column anyone scans. */
function PlanTab({ inv }: { inv: InvoiceRow }) {
  const { plans } = usePlanCatalogue();
  const plan = planItemOf(inv);
  const addons = addonsOf(inv);
  const items = [plan, ...addons].filter(Boolean) as NonNullable<typeof plan>[];
  const taxed = inv.taxMode !== "not_applicable";
  const cat = plan ? plans.find((c) => planLabel(c) === plan.description) : null;
  const feats = cat ? (cat.features || []).map((f) => (typeof f === "string" ? f : f.text)).filter(Boolean) : [];
  return (
    <>
      <div style={{ height: "12px" }}></div>
      {plan ? (
        <div className="card"><div className="card-b">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
            <div>
              <b style={{ fontSize: "var(--text-lg)" }}>{plan.description}</b>
              <div className="faint" style={{ fontSize: "var(--text-md)" }}>
                {plan.remark
                  || (plan.installmentCount
                    ? "Installment " + plan.installmentSeq + " of " + plan.installmentCount
                    : "Full amount")}
              </div>
            </div>
            <div className="tnum" style={{ fontSize: "var(--text-xl)", fontWeight: 600 }}>
              {inr(plan.amountPaise)}</div>
          </div>
          {feats.length
            ? <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginTop: "10px" }}>
                {feats.map((f, i) => <span key={i} className="pill xs" title={f}>{f}</span>)}
              </div>
            : null}
        </div></div>
      ) : null}
      <div style={{ height: "12px" }}></div>
      <Table
        cols={[{ label: "Description" }, { label: "Taxable", cls: "n" },
               { label: "GST", cls: "n" }, { label: "Line total", cls: "n" }]}
        rows={items.map((it) => (
          <tr key={it.id}>
            <td>
              <b>{it.description}</b>
              {it.hsn ? <div className="cell-2 mono">HSN {it.hsn}</div> : null}
            </td>
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
      {/* Always listed -- on an issued invoice this is what it was issued ON,
          which is the question the tab exists to answer. The block itself
          drops the attach button when the server would refuse it. */}
      <ProofsBlock inv={inv} onChanged={onChanged} />
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
