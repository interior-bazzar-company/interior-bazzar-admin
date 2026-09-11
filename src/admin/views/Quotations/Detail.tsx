/* =====================================================================
   QUOTATION — the detail PAGE, and the version rail that rides on every
   quotation screen.

   This replaces the drawer. The prototype has no drawer anywhere in this
   module (views-quotation.js: list / detail / builder / preview are four
   pages), and a 720px panel is why the document sheet had nowhere to render
   for so long.

   The page is the record pattern the whole panel takes: identity and verdict
   in the header, the money as figures, where this document sits in the chain,
   the negotiation as a rail of versions, then the tabs — Items, Document,
   Versions, History — with the record's facts and the paper itself in the
   column beside them.

   Actions follow the prototype's rule: ONE primary, everything else behind the
   record menu. On a draft the primary is "Preview & issue"; on anything else it
   is "View document".
   ===================================================================== */
import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import AdminOpsService from "../../../api/modules/adminOps";
import type { QuotationRow } from "../../../api/modules/adminOps";
import {
  Alert, Button, Card, EmptyState, KvList, MoreMenu, PageHeader, PaneLoading, Pill, 
  Table, Tabs, Tag, TbTitle, printHtml, publicDocUrl, qs, shareOrCopy,
} from "../../ui";
import type { MenuItem } from "../../ui";
import { inr, fmtDate } from "../../ui/format";
import { can, useNav, usePageChrome } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import { errMessage } from "../../../api/apiService";
import { STATUS_LABEL, STATUS_TONE, call, useQuotation, useQuotationVersions } from "./api";
import { addonsOf, daysUntil, partyLine, planItemOf } from "./helpers";
import { DocTimeline, Figures, PaperStage, QuotationSheet, VersionChip, VersionRailFrame } from "./bits";
import ReasonModal from "./ReasonModal";
import ReviseModal from "./ReviseModal";
import { ChainStrip } from "../chainStrip";

const TABS = ["items", "document", "versions", "history"];

export default function QuotationDetail({ id, tab, params }: {
  id: number; tab: string; params: Record<string, string>;
}) {
  const [tick, setTick] = useState(0);
  const bump = useCallback(() => setTick((t) => t + 1), []);
  const { loading, quotation, notFound } = useQuotation(id, tick);
  const { modal, closeLayer, toast } = useShell();
  const { go } = useNav();
  const cur = TABS.indexOf(tab) >= 0 ? tab : "items";

  usePageChrome({ crumbs: <TbTitle label="Quotations" to="#/quotations" />, right: null,
                  parent: "#/quotations" });

  if (loading && !quotation) return <PaneLoading label="Opening the quotation…" />;
  if (notFound || !quotation) return (
    <EmptyState icon="quote" title="Quotation not found"
      body={"Quotation " + id + " could not be opened. It may have been deleted, or it "
        + "belongs to a deal outside your access."}
      action={<Button color="primary" onClick={() => go("#/quotations")}>Back to quotations</Button>} />
  );

  const q = quotation;
  const isDraft = q.status === "draft";
  const to = (extra: Record<string, string>) => "#/quotations/" + q.id + qs({ ...params, ...extra });

  const doAction = (label: string, run: () => Promise<unknown>) => {
    toast(label + "…");
    run().then(() => { toast(label + " done."); bump(); })
      .catch((e: unknown) => toast(errMessage(e), "bad"));
  };

  const openReject = () => modal(<ReasonModal
    heading="Reject quotation" sub={q.quotationNumber || "Draft"} label="Reason (optional)"
    confirmLabel="Reject" tone="bad" onClose={closeLayer}
    run={(reason) => call(AdminOpsService.rejectQuotation(q.id, reason))
      .then(() => { closeLayer(); bump(); toast("Quotation rejected."); })} />);

  const docTitle = (q.quotationNumber || "Quotation") + " · Interior bazzar";
  const openSheet = () => call(AdminOpsService.quotationDocHtml(q.id))
    .then((d) => printHtml(d.html, docTitle))
    .catch((e: unknown) => toast(errMessage(e), "bad"));
  /* Print and Download open the same sheet — there is no stored PDF to stream,
     the document IS this HTML and the browser makes the file. What Download
     adds is the DOWNLOADED event on the record, which is the half that
     actually has to be logged. */
  const print = () => openSheet();
  const download = () => call(AdminOpsService.quotationDocDownload(q.id))
    .then(() => { toast("Opening " + (q.quotationNumber || "the document") + " — choose “Save as PDF”."); return openSheet(); })
    .catch((e: unknown) => toast(errMessage(e), "bad"));
  const share = () => call(AdminOpsService.quotationDocShare(q.id))
    .then(async (d) => {
      const link = publicDocUrl(d.link);
      const said = await shareOrCopy(link, docTitle);
      toast((said ? said + " " : "Share link issued. ") + "Expires " + fmtDate(d.expires) + ", logged as SHARED.");
    })
    .catch((e: unknown) => toast(errMessage(e), "bad"));

  /* Confirmed first — Revise sits next to the button you press most, and one
     stray click would otherwise clone a document. Already a draft? Then there
     is nothing to clone and nothing to explain: open the editor. */
  const revise = () => {
    if (isDraft) return go(to({ mode: "edit" }));
    modal(<ReviseModal q={q} onClose={closeLayer}
      run={() => call(AdminOpsService.reviseQuotation(q.id))
        .then((row) => { closeLayer(); toast("Revision opened as v" + row.version + "."); go("#/quotations/" + row.id + "?mode=edit"); })} />, "lg");
  };

  /* Everything occasional lives behind one record menu — the working actions
     lead, the document three follow, the two verdicts and the draft's cancel
     close it. There used to be a second bar of the same buttons at the bottom
     of the page, which meant the actions were in two places and neither was
     where you looked. */
  const items: MenuItem[] = [];
  if (isDraft && can("quotations", "edit"))
    items.push({ icon: "edit", label: "Edit", title: "Open the draft in the builder", act: () => go(to({ mode: "edit" })) });
  if (!isDraft && can("quotations", "edit"))
    items.push({ icon: "plus", label: "Revise", title: "Clones this version into a new draft", act: revise });
  if (!isDraft && q.hasDocument)
    items.push({ icon: "download", label: "Download as PDF", title: "The issued document, as the customer has it", act: download });
  if (!isDraft)
    items.push({ icon: "print", label: "Print", title: "Opens the document and prints it", act: print });
  if (!isDraft && q.hasDocument)
    items.push({ icon: "link", label: "Share link", title: "An expiring link, logged as SHARED", act: share });
  const canAccept = can("quotations", "accept");
  if (canAccept && (q.status === "issued" || q.status === "rejected" || q.status === "expired"))
    items.push({ icon: "check", label: "Mark accepted",
      title: "Writes " + inr(q.grandTotalPaise) + " to " + q.dealRef,
      act: () => doAction("Accepting", () => call(AdminOpsService.acceptQuotation(q.id))) });
  if (canAccept && q.status === "issued")
    items.push({ icon: "x", label: "Mark rejected", title: "Records the customer's no", tone: "bad", act: openReject });
  if (isDraft && can("quotations", "cancel"))
    items.push({ icon: "trash", label: "Cancel draft", title: "Consumes no number, so nothing dangles", tone: "bad",
      act: () => doAction("Cancelling", () => call(AdminOpsService.cancelQuotation(q.id))) });

  const taxed = q.taxMode !== "not_applicable";

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <PageHeader
        eyebrow="Quotation"
        title={<span className="font-mono tnum">{q.quotationNumber || "Draft"}</span>}
        back={{ label: "Quotations", to: "#/quotations" }}
        /* The customer and the deal ref moved down to the chain line, which is
           the row about where this document sits and who it is for. */
        meta={<>
          <Pill dot text={STATUS_LABEL[q.status]} tone={STATUS_TONE[q.status]} />
          <Tag label={"v" + q.version} />
          {q.status === "issued" && q.validUntil ? <span>{validity(q.validUntil)}</span> : null}
        </>}
        actions={<>
          {items.length
            ? <MoreMenu items={items} label="Actions" data-act="qt-more"
                aria-label="Everything this quotation can do" />
            : null}
          <Button color="primary" ico="quote" onClick={() => go(to({ mode: "preview" }))}>
            {isDraft ? "Preview & issue" : "View document"}
          </Button>
        </>} />

      {q.status === "superseded" && q.supersededById ? (
        <Alert tone="warn" title="Replaced by a newer version"
          action={<Button color="secondary" size="xs"
            onClick={() => go("#/quotations/" + q.supersededById)}>Open it</Button>}>
          This version stays fully readable — it is what the customer was sent.
        </Alert>
      ) : null}

      <Figures items={[
        { k: "Grand total", v: inr(q.grandTotalPaise), sub: taxed ? "incl. GST @ " + q.gstRate + "%" : "GST not applicable" },
        { k: "Taxable value", v: inr(q.taxablePaise), sub: q.discountAmountPaise ? "after −" + inr(q.discountAmountPaise) : "no discount" },
        { k: "Valid until", v: fmtDate(q.validUntil),
          tone: q.status === "issued" && daysUntil(q.validUntil) < 0 ? "bad" : undefined,
          sub: q.status === "issued" ? validity(q.validUntil) : STATUS_LABEL[q.status] },
        /* No Owner tile. A person's name is not a figure, and it sat in a row
           of money reading as one; it is a fact, and it is in Facts — with the
           made/issued date beside it, where the rest of the dates live. */
      ]} />

      <ChainStrip dealRef={q.dealRef} here="quotation" quotation={q} lead={partyLine(q)} />

      <VersionRail q={q} onRevise={!isDraft && can("quotations", "edit") ? revise : undefined} />

      <Tabs cur={cur} onPick={(k) => go(to({ tab: k }))} items={[
        { k: "items", label: "Items" },
        { k: "document", label: "Document" },
        { k: "versions", label: "Versions" },
        { k: "history", label: "History", n: q.events ? q.events.length : 0, quiet: true },
      ]} />

      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <div className="flex min-w-0 flex-col gap-5">
          {cur === "items" ? <ItemsTab q={q} onRevise={revise} />
            : cur === "document" ? <DocumentTab q={q} onView={() => go(to({ mode: "preview" }))} />
              : cur === "versions" ? <VersionsTab q={q} />
                : <HistoryTab q={q} />}

          {q.notes || q.terms ? (
            <Card title="Notes & terms">
              <div className="flex flex-col gap-2 text-sm whitespace-pre-wrap text-secondary">
                {q.notes ? <p>{q.notes}</p> : null}
                {q.terms ? <p>{q.terms}</p> : null}
              </div>
            </Card>
          ) : null}
        </div>

        {/* No sheet in the rail. A 210mm document squeezed into a 20rem column
            was never readable, and the Document tab beside it draws the same
            sheet at full width — this was the second renderer of a thing the
            page already had a place for. */}
        <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-0">
          <Card title="Facts" tight><KvList pairs={facts(q, go)} /></Card>
        </aside>
      </div>
    </div>
  );
}

function validity(validUntil: string) {
  const days = daysUntil(validUntil);
  if (days < 0) return "expired";
  return "valid for " + days + " more day" + (days === 1 ? "" : "s");
}

function facts(q: QuotationRow, go: (h: string) => void): [ReactNode, ReactNode][] {
  const link = (to: string, label: ReactNode) => (
    <a href={to} data-go={to} className="font-mono text-brand-secondary tnum"
      onClick={(e) => { e.preventDefault(); go(to); }}>{label}</a>
  );
  const rows: ([ReactNode, ReactNode] | null)[] = [
    ["Deal", link("#/deals/" + q.dealRef, q.dealRef)],
    ["Customer", <>{q.party.name} <span className="text-tertiary">{q.party.city || ""}</span></>],
    ["Owner", q.owner ? q.owner.name : null],
    ["Created", fmtDate(q.createdAt) + (q.createdBy ? " by " + q.createdBy.name : "")],
    q.issuedAt ? ["Issued", fmtDate(q.issuedAt) + (q.issuedBy ? " by " + q.issuedBy.name : "")] : null,
    q.acceptedAt ? ["Accepted", fmtDate(q.acceptedAt)] : null,
    q.rejectedAt ? ["Rejected", fmtDate(q.rejectedAt) + (q.rejectReason ? " · " + q.rejectReason : "")] : null,
    q.expiredAt ? ["Expired", fmtDate(q.expiredAt)] : null,
    ["Valid until", fmtDate(q.validUntil)],
    ["Place of supply", <>{q.placeOfSupply} <span className="text-tertiary">
      {q.igstPaise ? "inter-state · IGST" : "intra-state · CGST + SGST"}</span></>],
    ["Tax", <Pill dot text={q.taxMode === "not_applicable" ? "Not applicable" : "Applicable"}
                  tone={q.taxMode === "not_applicable" ? "warn" : "neutral"} />],
    ["Discount", (q.discountPct || 0) + "%"],
    q.parentQuotationId
      ? ["Revised from", link("#/quotations/" + q.parentQuotationId, "#" + q.parentQuotationId)]
      : null,
  ];
  return rows.filter(Boolean) as [ReactNode, ReactNode][];
}

/* ------------------------------------------------------------- the rail ---
   Every version of this quotation, on every quotation screen. The prototype
   makes the point well: the version history IS the negotiation — 4.8L, then
   4.2L, then 4.4L accepted — and a tab was hiding the plot. */
export function VersionRail({ q, onRevise }: { q: QuotationRow; onRevise?: () => void }) {
  const { versions } = useQuotationVersions(q.dealRef);
  const { go } = useNav();
  /* Cancelled drafts are not versions of the negotiation — nobody ever saw
     them. Three identical "v3" chips is what a failed Revise click leaves
     behind, and the rail is meant to show the SHAPE of the negotiation. They
     stay listed in the Versions tab, which has a status column to explain
     itself with. */
  const live = versions.filter((v) => v.status !== "cancelled" || v.id === q.id);
  if (!live.length) return null;
  return (
    <VersionRailFrame right={onRevise
      ? <Button color="secondary" size="xs" ico="plus" onClick={onRevise}
          title="Clone this version into a new editable draft">Revise</Button>
      : undefined}>
      {live.map((v) => (
        <VersionChip key={v.id} n={v.version} tone={STATUS_TONE[v.status]} on={v.id === q.id}
          money={inr(v.grandTotalPaise, { compact: true })}
          title={"v" + v.version + " · " + STATUS_LABEL[v.status] + " · " + inr(v.grandTotalPaise)}
          onClick={() => go("#/quotations/" + v.id)} />
      ))}
    </VersionRailFrame>
  );
}

/* ------------------------------------------------------------------ tabs --- */
function ItemsTab({ q, onRevise }: { q: QuotationRow; onRevise: () => void }) {
  const plan = planItemOf(q);
  const addons = addonsOf(q);
  const items = [plan, ...addons].filter(Boolean) as NonNullable<typeof plan>[];
  const taxed = q.taxMode !== "not_applicable";
  return (
    <>
      {q.status !== "draft" ? (
        <Alert tone="info" title="Already with the customer"
          action={<Button color="secondary" size="xs" onClick={onRevise}>Revise into a draft</Button>}>
          These figures stay as they are. Changing them means a new version.
        </Alert>
      ) : null}

      <Table
        min="52rem"
        cols={[{ label: "Description" }, { label: "Term" }, { label: "Rate", cls: "n" },
          { label: "Discount", cls: "n" }, { label: "Taxable", cls: "n" },
          { label: "GST", cls: "n" }, { label: "Line total", cls: "n" }]}
        empty={{ icon: "quote", title: "No lines yet", body: "Open the builder and choose a plan." }}
        rows={items.map((it) => (
          <tr key={it.id}>
            <td className="cell-1">
              {it.name}
              {it.description ? <div className="cell-2">{it.description}</div> : null}
              {it.hsn ? <div className="cell-2 font-mono tnum">HSN {it.hsn}</div> : null}
            </td>
            <td className="tnum">{it.termMonths ? it.termMonths + " mo" : <span className="text-quaternary">—</span>}</td>
            <td className="n">{it.ratePerMonthPaise ? inr(it.ratePerMonthPaise) + "/mo" : inr(it.amountPaise)}</td>
            <td className="n">{it.discountValue
              ? it.discountType === "pct" ? it.discountValue + "%" : "−" + inr(it.discountValue * 100)
              : "—"}</td>
            <td className="n">{inr(it.taxableAmountPaise)}</td>
            <td className="n">{inr(it.taxAmountPaise)}<div className="cell-2">{it.taxRate}%</div></td>
            <td className="n t">{inr(it.lineTotalPaise)}</td>
          </tr>
        ))} />

      <Card title="Commercial summary" sub="what the server computed, and what the document prints">
        <KvList pairs={[
          ["Gross amount", inr(q.subtotalPaise)],
          ["Discount", q.discountAmountPaise ? "−" + inr(q.discountAmountPaise) : null],
          [taxed ? "Taxable value" : "Subtotal", inr(q.taxablePaise)],
          ...(taxed
            ? q.igstPaise
              ? [["IGST @ " + q.gstRate + "%", inr(q.igstPaise)] as [ReactNode, ReactNode]]
              : [["CGST @ " + q.gstRate / 2 + "%", inr(q.cgstPaise)] as [ReactNode, ReactNode],
                 ["SGST @ " + q.gstRate / 2 + "%", inr(q.sgstPaise)] as [ReactNode, ReactNode]]
            : [["Tax", <span className="text-warning-primary">Not applicable</span>] as [ReactNode, ReactNode]]),
          ["Grand total", <span className="font-mono text-md font-semibold text-primary tnum">{inr(q.grandTotalPaise)}</span>],
        ]} />
      </Card>
    </>
  );
}

function DocumentTab({ q, onView }: { q: QuotationRow; onView: () => void }) {
  const { toast } = useShell();
  const [info, setInfo] = useState<{ storageKey: string; generatedAt: string } | null>(null);
  if (!q.hasDocument) return (
    <EmptyState icon="quote" title="No document"
      body="A document is produced by the issue transaction. This quotation has not been issued."
      action={<Button color="secondary" onClick={onView}>Preview it anyway</Button>} />
  );
  return (
    <>
      <Card title="The document" sub="the sheet the customer receives"
        right={<>
          <Button color="secondary" size="xs" ico="info" onClick={() =>
            call(AdminOpsService.quotationDocDownload(q.id)).then((d) => setInfo(d))
              .catch((e: unknown) => toast(errMessage(e), "bad"))}>Document info</Button>
          <Button color="secondary" size="xs" ico="eye" onClick={onView}>Open full size</Button>
        </>}
        foot="The customer's share link lives on the document page — it is a public URL, so it is minted where you can see what you are handing out.">
        <KvList pairs={[
          ["Storage key", info ? <span className="font-mono text-xs tnum">{info.storageKey}</span> : null],
          ["Generated", info ? fmtDate(info.generatedAt) : null],
        ]} />
      </Card>
      <PaperStage><QuotationSheet q={q} /></PaperStage>
    </>
  );
}

function VersionsTab({ q }: { q: QuotationRow }) {
  const { versions } = useQuotationVersions(q.dealRef);
  const { go } = useNav();
  return (
    <Table
      min="40rem"
      cols={[{ label: "Version" }, { label: "Quotation" }, { label: "Status" },
        { label: "Value", cls: "n" }, { label: "Issued" }]}
      empty={{ icon: "history", title: "No other versions", body: "This is the only version on the deal." }}
      rows={versions.map((v) => (
        <tr key={v.id} className="clickable" data-go={"#/quotations/" + v.id}
          onClick={() => go("#/quotations/" + v.id)}>
          <td className="t tnum">v{v.version}</td>
          <td className="mono">{v.quotationNumber || <span className="text-quaternary">Draft</span>}</td>
          <td><Pill dot text={STATUS_LABEL[v.status]} tone={STATUS_TONE[v.status]} /></td>
          <td className="n">{inr(v.grandTotalPaise)}</td>
          <td>{v.issuedAt ? fmtDate(v.issuedAt) : <span className="text-quaternary">—</span>}</td>
        </tr>
      ))} />
  );
}

function HistoryTab({ q }: { q: QuotationRow }) {
  if (!q.events || !q.events.length) return (
    <EmptyState icon="history" title="Nothing logged yet"
      body="Every issue, share, download and verdict is appended here as it happens." />
  );
  return <Card title="History" sub={q.events.length + " events"}><DocTimeline events={q.events} /></Card>;
}
