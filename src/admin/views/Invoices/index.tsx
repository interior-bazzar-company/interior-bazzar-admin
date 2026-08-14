/* =============================================================================
   Invoice — Module 3 · interface
   -----------------------------------------------------------------------------
   Every screen in INVOICE_IA.md.

   The list is the one place Invoice deliberately differs from Quotation. A
   quotation list answers *what have we offered?* An invoice list answers
   **who owes us money, and how late are they?** — so it opens with four money
   tiles and sorts by due date, overdue first.

   Two principles carried from Modules 1 and 2, plus two of its own:
     1. Locked actions are ABSENT, not greyed.
     2. Every modal states the rule BEFORE you commit.
     3. THE TWO AXES ARE NEVER MERGED — two strips, two chips, two filters.
     4. THERE IS NO `Record payment` BUTTON ANYWHERE IN THIS MODULE. Money is
        logged on the deal, and the absence is the boundary made visible.

   Routes
     #/invoices                      list
     #/invoices?new=1[&deal=DL-…]    step 1 · deal AND quotation, both required
     #/invoices/<id>                 detail — Plan / Document / Payment / History
     #/invoices/<id>?mode=edit       step 2 · the builder
     #/invoices/<id>?mode=preview    the Invoice render, then Issue
   ============================================================================= */
import { useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { EmptyState } from "../../ui";
import { usePageChrome } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import { IBDeals, IBInvoice } from "../../engines";
import { actor, quoteNumberOf } from "./helpers";
import { useInvoices } from "./useInvoices";
import { InvoiceList } from "./InvoiceList";
import { InvoicePick } from "./InvoicePick";
import { InvoiceBuilder } from "./InvoiceBuilder";
import { InvoiceDetail, InvoicePreview } from "./InvoiceDetail";

const N = IBInvoice, E = IBDeals;

export default function Invoices() {
  const routeParams = useParams();
  const id = routeParams.id ? decodeURIComponent(routeParams.id) : null;
  const { p, setFilter, unfilter, go, act } = useInvoices(id);
  const shell = useShell();

  const inv = id ? N.invoiceOf(id) : null;
  const dl = inv ? E.dealOf(inv.deal_id) : null;
  const outOfScope = !!(inv && dl && !E.inScope(actor(), dl));

  /* ---------------------------------------------------------- the topbar */
  /* The same nav bar Deals and Quotations have: the module's name where the
     crumb "Sales › Invoices" used to sit above a heading that already said
     Invoice. Claimed for the LIST only — on a record, a create flow or a
     sub-mode this returns nothing so the shell's flat label and Back button own
     the bar, rather than a module title competing with them. */
  const isList = !id && !p["new"] && !p.mode;
  const crumbs = useMemo(
    () => (isList ? <span className="tb-title">Invoices</span> : undefined),
    [isList]
  );

  /* --------------------------------------------------- where "up" is --- */
  /* The fallback the shell's Back uses when there is no in-session history —
     a pasted URL, or a refresh. An invoice has TWO NOT NULL parents, and the
     nearer one wins: the quotation is the document this invoice was written
     from, and the deal is one further step up from there. Walking one link at
     a time is what makes repeated Back retrace the chain
     invoice → quotation → deal instead of teleporting to its far end. */
  const parent = useMemo(() => {
    if (id) {
      if (p.mode) return "#/invoices/" + encodeURIComponent(id);       // sub-mode → the record
      const rec = N.invoiceOf(id);
      if (rec) {
        const qn = quoteNumberOf(rec);
        if (qn) return "#/quotations/" + encodeURIComponent(qn);
        if (rec.deal_id) return "#/deals/" + encodeURIComponent(rec.deal_id);
      }
      return "#/invoices";
    }
    if (p["new"] === "1") return p.deal ? "#/deals/" + encodeURIComponent(p.deal) : "#/invoices";
    return null;
  }, [id, p]);

  usePageChrome({ crumbs, parent });

  /* Issued content is frozen. The prototype toasted from inside its render
     pass and fell through to the detail screen; a React render may not do
     that, so the refusal fires as an effect and the fall-through stays. */
  const frozen = !!(inv && p.mode === "edit" && inv.invoice_status !== N.DOC.DRAFT);
  useEffect(() => {
    if (frozen) shell.toast("422 invoice_not_editable — issued content is frozen.", "bad");
  }, [frozen, shell]);

  if (p["new"] === "1")
    return <InvoicePick p={p} setFilter={setFilter} go={go} onCreate={act.create} />;

  if (id) {
    if (!inv) return <NotFound id={id} go={go} />;
    if (outOfScope) return <Denied go={go} />;
    if (p.mode === "edit" && !frozen)
      return <InvoiceBuilder key={inv.row_version} inv={inv} go={go} act={act} />;
    if (p.mode === "preview") return <InvoicePreview inv={inv} go={go} act={act} />;
    return <InvoiceDetail inv={inv} p={p} go={go} act={act} />;
  }

  return <InvoiceList p={p} setFilter={setFilter} unfilter={unfilter} go={go} onExport={act.exportCsv} />;
}

function NotFound({ id, go }: { id: string; go: (h: string) => void }) {
  return (
    <div className="page">
      <EmptyState icon="invoice" title="404 invoice_not_found"
        body={<>No invoice with the reference <b>{id}</b>.</>}
        action={<button className="btn" data-go="#/invoices" onClick={() => go("#/invoices")}>Back to Invoice</button>} />
    </div>
  );
}

function Denied({ go }: { go: (h: string) => void }) {
  return (
    <div className="page">
      <EmptyState icon="lock" title="403 out_of_scope"
        body={"That invoice belongs to a deal that is not yours. Scope resolves through the parent deal " +
          "on every call — an invoice identifier grants nothing on its own, and the attempt was logged."}
        action={<button className="btn" data-go="#/invoices" onClick={() => go("#/invoices")}>Back to Invoice</button>} />
    </div>
  );
}
