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
import { Alert, Button, Card, EmptyState, KvList, MoreMenu, PageHeader, PaneLoading, Pill, Table, Tabs, TbTitle, qs } from "../../ui";
import type { MenuItem } from "../../ui";
import { Figures } from "../Quotations/bits";
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
  const { modal, closeLayer, toast } = useShell();
  const { go } = useNav();
  const cur = TABS.indexOf(tab) >= 0 ? tab : "plan";

  usePageChrome({ crumbs: <TbTitle label="Invoices" to="#/invoices" />, right: null,
                  parent: "#/invoices" });

  if (loading && !invoice) return <PaneLoading label="Opening the invoice…" />;
  if (notFound || !invoice) return (
    <EmptyState icon="invoice" title="Invoice not found"
      body={"Invoice " + id + " could not be opened. It may have been deleted, or it "
        + "belongs to a deal outside your access."}
      action={<Button color="primary" onClick={() => go("#/invoices")}>Back to invoices</Button>} />
  );

  const inv = invoice;
  const isDraft = inv.status === "draft";
  const to = (extra: Record<string, string>) => "#/invoices/" + inv.id + qs({ ...params, ...extra });

  const openCancel = () => modal(<ReasonModal
    heading="Cancel invoice" sub={inv.invoiceNumber || "Draft"} label="Reason"
    required={inv.status === "issued"} confirmLabel="Cancel invoice" tone="bad"
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
  /* Everything occasional behind one trailing menu, on the shared `MoreMenu`
     — `title` is the consequence, which is the whole reason these entries are
     words rather than icons. Issue has no entry here at all: it happens on the
     preview, because nobody should freeze a document they have not just
     looked at. */
  const items: MenuItem[] = [];
  if (isDraft) {
    if (can("invoices", "edit"))
      items.push({ icon: "doc", label: "Edit", title: "Open the draft in the builder", act: () => go(to({ mode: "edit" })) });
    items.push({ icon: "invoice", label: "Preview & issue", title: "The document, ready to issue", act: () => go(to({ mode: "preview" })) });
  } else {
    items.push({ icon: "invoice", label: "View document", title: "The issued document, as the customer has it", act: () => go(to({ mode: "preview" })) });
  }
  if (isDraft && can("invoices", "edit"))
    items.push({ icon: "check", label: "Save as draft", title: "Keeps everything applied so far. No number is assigned.", act: saveDraft });
  if (inv.status !== "cancelled" && can("invoices", "cancel"))
    items.push(isDraft
      ? { icon: "x", label: "Cancel draft", title: "Consumes no number, so nothing dangles", tone: "bad", act: openCancel }
      : { icon: "x", label: "Cancel invoice", title: "The number stays spent — a correction is a new invoice", tone: "bad", act: openCancel });

  /* Issued means the ledger row is already written, in the same transaction
     (InvoicesController.Issue) -- so received is the whole grand total or it is
     nothing, and the balance is the rest. No figure here is estimated. */
  const received = inv.status === "issued" ? inv.grandTotalPaise : 0;
  const balance = inv.grandTotalPaise - received;
  const over = inv.status === "draft" ? Math.max(0, -daysFrom(inv.dueDate)) : 0;

  const dealTo = "#/deals/" + inv.dealRef;

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <PageHeader
        eyebrow="Tax invoice"
        title={<span className="font-mono tnum">{inv.invoiceNumber || "Draft"}</span>}
        back={{ label: "Invoices", to: "#/invoices" }}
        meta={<>
          <Pill dot text={STATUS_LABEL[inv.status]} tone={STATUS_TONE[inv.status]} />
          <span className="truncate">{inv.billing.name || "—"}</span>
          <a href={dealTo} data-go={dealTo} className="font-mono text-brand-secondary tnum"
            onClick={(e) => { e.preventDefault(); go(dealTo); }}>{inv.dealRef}</a>
          {inv.quotationId
            ? <span>against <a href={"#/quotations/" + inv.quotationId} className="font-mono text-brand-secondary tnum"
                onClick={(e) => { e.preventDefault(); go("#/quotations/" + inv.quotationId); }}>
                {inv.quotationNumber || "quotation"}</a></span>
            : null}
        </>}
        actions={<>
          {items.length
            ? <MoreMenu items={items} label="Actions" data-act="in-more"
                aria-label="Everything this invoice can do" />
            : null}
          <Button color="primary" ico="invoice" onClick={() => go(to({ mode: "preview" }))}>
            {isDraft ? "Preview & issue" : "View document"}
          </Button>
        </>} />

      {inv.status === "cancelled" ? (
        <Alert tone="warn" ico="x" title="This invoice is cancelled.">
          {inv.cancellationReason || "The number it took stays spent — a correction is a new invoice."}
        </Alert>
      ) : null}

      {/* What it is worth, what came in, what is still owed, and by when --
          the prototype's four figures. One grand total answered none of the
          three questions an invoice is opened with. */}
      <Figures items={[
        { k: "Amount", v: inr(inv.grandTotalPaise),
          sub: inv.taxMode === "not_applicable" ? "GST not applicable" : "incl. GST @ " + inv.gstRate + "%" },
        { k: "Received", v: inr(received), tone: received ? "ok" : undefined,
          sub: received ? "written to the deal ledger by Issue" : "nothing on the ledger yet" },
        { k: "Balance", v: inr(balance), tone: balance ? undefined : "ok",
          sub: balance ? "still owed" : "settled" },
        { k: inv.status === "cancelled" ? "Cancelled" : over ? "Overdue by" : "Due",
          v: inv.status === "cancelled" ? fmtDate(inv.cancelledAt)
            : over ? over + " day" + (over === 1 ? "" : "s")
              : fmtDate(inv.dueDate),
          tone: over ? "bad" : undefined,
          sub: inv.status === "cancelled" ? "" : over ? "past its due date, never issued" : "due date" },
      ]} />

      <ChainStrip dealRef={inv.dealRef} here="invoice" quotation={quotation} />

      <Tabs cur={cur} onPick={(k) => go(to({ tab: k }))} items={[
        { k: "plan", label: "Plan" },
        { k: "document", label: "Document" },
        { k: "payment", label: "Payment" },
        { k: "history", label: "History", n: inv.events ? inv.events.length : 0, quiet: true },
      ]} />

      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <div className="flex min-w-0 flex-col gap-5">
          {cur === "plan" ? <PlanTab inv={inv} />
            : cur === "payment" ? <PaymentTab inv={inv} onChanged={bump} />
            : cur === "document" ? <DocumentTab inv={inv} onView={() => go(to({ mode: "preview" }))} onRegenerated={bump} />
            : inv.events && inv.events.length ? <EventLog events={inv.events} />
            : <EmptyState flat icon="history" title="Nothing logged yet" body="" />}

          {inv.notes || inv.terms ? (
            <Card title="Notes & terms">
              <div className="text-sm whitespace-pre-wrap text-secondary">
                {inv.notes ? <p className="mb-2">{inv.notes}</p> : null}
                {inv.terms}
              </div>
            </Card>
          ) : null}
        </div>

        <Card title="Facts" tight className="lg:sticky lg:top-4">
          <KvList pairs={facts(inv, go)} />
        </Card>
      </div>
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
    ["Deal", <a href={"#/deals/" + inv.dealRef} className="font-mono text-brand-secondary tnum outline-focus-ring focus-visible:outline-2"
      onClick={(e) => { e.preventDefault(); go("#/deals/" + inv.dealRef); }}>{inv.dealRef}</a>],
    ["Quotation", inv.quotationId
      ? <a href={"#/quotations/" + inv.quotationId} className="font-mono text-brand-secondary tnum outline-focus-ring focus-visible:outline-2"
          onClick={(e) => { e.preventDefault(); go("#/quotations/" + inv.quotationId); }}>
          {inv.quotationNumber || "#" + inv.quotationId}</a>
      : <Pill xs text="missing" tone="bad" />],
    ["Customer", <>{inv.billing.name || "—"} <span className="text-quaternary">{inv.billing.address}</span></>],
    ["Owner", inv.owner ? inv.owner.name : <span className="text-quaternary">—</span>],
    ["Created", fmtDate(inv.createdAt) + (inv.createdBy ? " by " + inv.createdBy.name : "")],
    inv.issuedAt ? ["Issued", fmtDate(inv.issuedAt) + (inv.issuedBy ? " by " + inv.issuedBy.name : "")] : null,
    ["Invoice date", fmtDate(inv.invoiceDate)],
    ["Due", <>{fmtDate(inv.dueDate)}
      {over ? <span className="text-error-primary">{" · +" + over + "d"}</span> : null}</>],
    ["Place of supply", <>{inv.placeOfSupply} <span className="text-quaternary">
      {inv.igstPaise ? "inter-state · IGST" : "intra-state · CGST + SGST"}</span></>],
    ["Tax", <Pill xs text={inv.taxMode === "not_applicable" ? "Not applicable" : "Applicable"}
                  tone={inv.taxMode === "not_applicable" ? "warn" : "neutral"} />],
    /* The money is the deal ledger's, written by the issue transaction itself
       -- so an unissued invoice has none, whatever reference was typed on it. */
    ["Payment", inv.status === "issued"
      ? <><span className="font-mono tnum">{inv.paymentReference || "—"}</span>{" "}
          <span className="text-quaternary">· from the deal ledger</span></>
      : <span className="text-quaternary">none yet</span>],
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
    <div className="flex min-w-0 flex-col gap-4">
      {plan ? (
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <b className="text-md font-semibold text-primary">{plan.description}</b>
              <div className="mt-0.5 text-sm text-tertiary">
                {plan.remark
                  || (plan.installmentCount
                    ? "Installment " + plan.installmentSeq + " of " + plan.installmentCount
                    : "Full amount")}
              </div>
            </div>
            <div className="shrink-0 font-mono text-lg font-semibold text-primary tnum">
              {inr(plan.amountPaise)}</div>
          </div>
          {feats.length
            ? <div className="mt-2.5 flex flex-wrap gap-1">
                {feats.map((f, i) => <Pill key={i} xs text={f} tone="neutral" title={f} />)}
              </div>
            : null}
        </Card>
      ) : null}
      <Table
        cols={[{ label: "Description" }, { label: "Taxable", cls: "n" },
               { label: "GST", cls: "n" }, { label: "Line total", cls: "n" }]}
        rows={items.map((it) => (
          <tr key={it.id}>
            <td className="cell-1">
              {it.description}
              {it.hsn ? <div className="cell-2 font-mono tnum">HSN {it.hsn}</div> : null}
            </td>
            <td className="n">{inr(it.taxableAmountPaise)}</td>
            <td className="n">{inr(it.taxAmountPaise)}<div className="cell-2">{it.taxRate}%</div></td>
            <td className="n"><b>{inr(it.lineTotalPaise)}</b></td>
          </tr>
        ))} />
      <Card title="Commercial summary" tight>
        <KvList pairs={[
          ["Subtotal", inr(inv.subtotalPaise)],
          [taxed ? "Taxable value" : "Subtotal", inr(inv.taxableTotalPaise)],
          ...(taxed
            ? inv.igstPaise
              ? [["IGST @ " + inv.gstRate + "%", inr(inv.igstPaise)] as [ReactNode, ReactNode]]
              : [["CGST @ " + inv.gstRate / 2 + "%", inr(inv.cgstPaise)] as [ReactNode, ReactNode],
                 ["SGST @ " + inv.gstRate / 2 + "%", inr(inv.sgstPaise)] as [ReactNode, ReactNode]]
            : [["Tax", <span className="text-quaternary">Not applicable</span>] as [ReactNode, ReactNode]]),
          ["Grand total", <b className="font-mono tnum">{inr(inv.grandTotalPaise)}</b>],
        ]} />
      </Card>
    </div>
  );
}

/* The payment this invoice raises -- reference, mode, date and the proof. On a
   draft these are the fields the issue transaction will refuse without, so the
   tab doubles as the checklist. */
function PaymentTab({ inv, onChanged }: { inv: InvoiceRow; onChanged: () => void }) {
  const liveProofs = (inv.proofs || []).filter((p) => !p.removed);
  /* A REQUIRED FIELD LEFT EMPTY IS THE REASON ISSUE WILL REFUSE, so it says so
     where the value would have been rather than showing a neutral dash. */
  const missing = <span className="text-error-primary">— required to issue</span>;
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Card tight>
        <KvList pairs={[
          ["Reference / UTR", inv.paymentReference
            ? <span className="font-mono tnum">{inv.paymentReference}</span> : missing],
          ["Mode", inv.paymentMode || <span className="text-quaternary">—</span>],
          ["Payment date", inv.paymentDate ? fmtDate(inv.paymentDate) : <span className="text-quaternary">—</span>],
          ["Proof", liveProofs.length
            ? liveProofs.length + " file" + (liveProofs.length > 1 ? "s" : "") + " attached"
            : missing],
        ]} />
      </Card>
      {/* Always listed -- on an issued invoice this is what it was issued ON,
          which is the question the tab exists to answer. The block itself
          drops the attach button when the server would refuse it. */}
      <ProofsBlock inv={inv} onChanged={onChanged} />
    </div>
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
    <Card tight>
      <KvList pairs={[
        ["Storage key", <span className="font-mono tnum">{info ? info.storageKey : "—"}</span>],
        ["Version", info ? "v" + info.version : "—"],
      ]} />
      <div className="mt-3.5 flex flex-wrap gap-2">
        <Button color="secondary" ico="download" onClick={() =>
          call(AdminOpsService.invoiceDocDownload(inv.id)).then((d) => setInfo(d))
            .catch((e: unknown) => toast(errMessage(e), "bad"))
        }>Document info</Button>
        <Button color="secondary" onClick={onView}>View</Button>
        {can("invoices", "issue")
          ? <Button color="secondary" onClick={() =>
              call(AdminOpsService.regenerateInvoiceDoc(inv.id))
                .then(() => { onRegenerated(); toast("New document version generated."); })
                .catch((e: unknown) => toast(errMessage(e), "bad"))
            }>Regenerate</Button>
          : null}
      </div>
      <p className="mt-2.5 text-xs text-tertiary">
        The customer’s share link lives on the document page — it is a public URL, so it is minted
        where you can see what you are handing out.
      </p>
    </Card>
  );
}
