/* =====================================================================
   QUOTATION — the detail PAGE, and the version rail that rides on every
   quotation screen.

   This replaces the drawer. The prototype has no drawer anywhere in this
   module (views-quotation.js: list / detail / builder / preview are four
   pages), and a 720px panel is why the document sheet had nowhere to render
   for so long.

   The page is the prototype's detail(): identity and verdict at the top, the
   one figure that matters, the facts, the version rail, then four tabs —
   Items, Document, Versions, History — and the notes/terms underneath.

   Actions follow the prototype's rule: THREE controls, not seven. On a draft
   that is edit it and send it; on anything else it is read it or supersede it.
   Everything occasional sits behind the trailing menu.
   ===================================================================== */
import { Fragment, useCallback, useState } from "react";
import type { ReactNode } from "react";
import AdminOpsService from "../../../api/modules/adminOps";
import type { QuotationRow } from "../../../api/modules/adminOps";
import {
  EmptyState, Icon, KvList, PaneLoading, Pill, SectionHead, Table, Tabs, printHtml, publicDocUrl, qs, shareOrCopy,
} from "../../ui";
import { inr, fmtDate } from "../../ui/format";
import { can, useNav, usePageChrome } from "../../shell/AdminShell";
import { useShell } from "../../shell/ShellContext";
import { errMessage } from "../../../api/apiService";
import { STATUS_LABEL, STATUS_TONE, call, useQuotation, useQuotationVersions } from "./api";
import { addonsOf, partyLine, planItemOf } from "./helpers";
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
  const { modal, closeLayer, toast, openPop, closePop, popAnchor } = useShell();
  const { go } = useNav();
  const cur = TABS.indexOf(tab) >= 0 ? tab : "items";

  usePageChrome({ crumbs: <span className="tb-title">Quotations</span>, right: null,
                  parent: "#/quotations" });

  if (loading && !quotation) return <div className="page wide"><PaneLoading /></div>;
  if (notFound || !quotation) return (
    <div className="page wide">
      <EmptyState icon="quote" title="Quotation not found"
        body={"Quotation " + id + " could not be opened. It may have been deleted, or it "
          + "belongs to a deal outside your access."}
        action={<button className="btn" onClick={() => go("#/quotations")}>Back to quotations</button>} />
    </div>
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
    confirmLabel="Reject" confirmCls="btn dgr" onClose={closeLayer}
    run={(reason) => call(AdminOpsService.rejectQuotation(q.id, reason))
      .then(() => { closeLayer(); bump(); toast("Quotation rejected."); })} />);

  /* Everything occasional lives behind one trailing menu — the two verdicts
     and the draft's cancel. There used to be a second bar of the same buttons
     at the very bottom of the page, which meant the actions were in two places
     and neither was where you looked. */
  const moreMenu = (e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget as HTMLElement;
    if (popAnchor === el) return closePop();
    const mi = (ico: string, label: string, hint: string, run: () => void, cls?: string) => (
      <button className={"mi" + (cls ? " " + cls : "")} onClick={() => { closePop(); run(); }}>
        <Icon name={ico} /><span><b>{label}</b><span className="d">{hint}</span></span>
      </button>
    );
    const items: ReactNode[] = [];
    /* The document three, first — they are what somebody on an issued
       quotation reaches for most, and none of them changes anything. */
    if (!isDraft && q.hasDocument)
      items.push(mi("download", "Download as PDF", "The issued document, as the customer has it", download));
    if (!isDraft)
      items.push(mi("doc", "Print", "Opens the document and prints it", print));
    if (!isDraft && q.hasDocument)
      items.push(mi("link", "Share link", "An expiring link, logged as SHARED", share));
    const canAccept = can("quotations", "accept");
    if (canAccept && (q.status === "issued" || q.status === "rejected" || q.status === "expired"))
      items.push(mi("check", "Mark accepted", "Writes " + inr(q.grandTotalPaise) + " to " + q.dealRef,
        () => doAction("Accepting", () => call(AdminOpsService.acceptQuotation(q.id)))));
    if (canAccept && q.status === "issued")
      items.push(mi("x", "Mark rejected", "Records the customer's no", openReject, "dgr"));
    if (isDraft && can("quotations", "cancel"))
      items.push(mi("x", "Cancel draft", "Consumes no number, so nothing dangles",
        () => doAction("Cancelling", () => call(AdminOpsService.cancelQuotation(q.id))), "dgr"));
    if (!items.length)
      items.push(<div key="none" className="pop-b" style={{ padding: "10px 12px" }}>
        <span className="faint">Nothing else to do on this one.</span></div>);
    openPop(el, <div className="pop-b">{items.map((n, i) => <Fragment key={i}>{n}</Fragment>)}</div>,
      { width: 268, cls: "pop-views" });
  };

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
        .then((row) => { closeLayer(); toast("Revision opened as v" + row.version + "."); go("#/quotations/" + row.id + "?mode=edit"); })} />);
  };

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
            {partyLine(q)}{" · "}
            <a className="lnk mono" onClick={() => go("#/deals/" + q.dealRef)}>{q.dealRef} ↗</a>
            {q.status === "issued" && q.validUntil ? " · " + validity(q.validUntil) : ""}
          </div>
        </div>
        <div className="acts">
          {isDraft
            ? <>
                {can("quotations", "edit")
                  ? <button className="btn" onClick={() => go(to({ mode: "edit" }))}>
                      <Icon name="doc" />Edit</button>
                  : null}
                <button className="btn pri" onClick={() => go(to({ mode: "preview" }))}>
                  Preview &amp; issue</button>
                <MoreBtn onClick={moreMenu} />
              </>
            : <>
                <button className="btn" onClick={() => go(to({ mode: "preview" }))}>
                  <Icon name="quote" />View document</button>
                {can("quotations", "edit")
                  ? <button className="btn pri" onClick={revise}><Icon name="plus" />Revise</button>
                  : null}
                <MoreBtn onClick={moreMenu} />
              </>}
        </div>
      </div>

      {/* One figure, not three — what this document is worth, at a glance. The
          full breakdown lives once, in the Items tab. */}
      <div style={{ marginBottom: "16px" }}>
        <div style={{ fontSize: "var(--text-sm)", color: "var(--text-2)" }}>Grand total</div>
        <div className="tnum" style={{ fontSize: "var(--text-2xl)", fontWeight: 600,
                                       marginTop: "2px", color: "var(--brand)" }}>
          {inr(q.grandTotalPaise)}
        </div>
      </div>

      {q.status === "superseded" && q.supersededById ? (
        <div className="faint" style={{ marginBottom: "12px" }}>
          Replaced by <a className="lnk mono" onClick={() => go("#/quotations/" + q.supersededById)}>
            a newer version</a> — this one stays fully readable.
        </div>
      ) : null}

      <SectionHead title="Facts" />
      <div className="card"><div className="card-b">
        <KvList cls="wide" pairs={facts(q, go)} />
      </div></div>

      <VersionRail q={q} />

      <div style={{ marginTop: "22px" }}>
        <Tabs cur={cur} onPick={(k) => go(to({ tab: k }))} items={[
          { k: "items", label: "Items" },
          { k: "document", label: "Document" },
          { k: "versions", label: "Versions" },
          { k: "history", label: "History", n: q.events ? q.events.length : 0 },
        ]} />
      </div>

      {cur === "items" ? <ItemsTab q={q} onRevise={revise} />
        : cur === "document" ? <DocumentTab q={q} onView={() => go(to({ mode: "preview" }))} />
        : cur === "versions" ? <VersionsTab q={q} />
        : <HistoryTab q={q} />}

      {q.notes || q.terms ? (
        <>
          <SectionHead title="Notes &amp; terms" />
          <div className="card"><div className="card-b" style={{ whiteSpace: "pre-wrap",
            fontSize: "var(--text-base)", color: "var(--text-2)" }}>
            {q.notes ? <p style={{ marginBottom: "8px" }}>{q.notes}</p> : null}
            {q.terms}
          </div></div>
        </>
      ) : null}

      {/* Where this document sits in the sequence, and why the next link is
          not there yet. Same strip the invoice page carries. */}
      <SectionHead title="Related" />
      <ChainStrip dealRef={q.dealRef} here="quotation" quotation={q} />

    </div>
  );
}

function MoreBtn({ onClick }: { onClick: (e: React.MouseEvent<HTMLElement>) => void }) {
  return (
    <button className="btn icon" data-act="qt-more" aria-haspopup="menu"
      aria-label="More actions" title="More actions" onClick={onClick}><Icon name="dots" /></button>
  );
}

function validity(validUntil: string) {
  const days = Math.round((new Date(validUntil + "T00:00:00").getTime() - Date.now()) / 86400000);
  if (days < 0) return "expired";
  return "valid for " + days + " more day" + (days === 1 ? "" : "s");
}

function facts(q: QuotationRow, go: (h: string) => void): [ReactNode, ReactNode][] {
  const rows: ([ReactNode, ReactNode] | null)[] = [
    ["Deal", <a className="lnk mono" onClick={() => go("#/deals/" + q.dealRef)}>{q.dealRef}</a>],
    ["Customer", <>{q.party.name} <span className="faint">{q.party.city || ""}</span></>],
    ["Owner", q.owner ? q.owner.name : <span className="faint">—</span>],
    ["Created", fmtDate(q.createdAt) + (q.createdBy ? " by " + q.createdBy.name : "")],
    q.issuedAt ? ["Issued", fmtDate(q.issuedAt) + (q.issuedBy ? " by " + q.issuedBy.name : "")] : null,
    q.acceptedAt ? ["Accepted", fmtDate(q.acceptedAt)] : null,
    q.rejectedAt ? ["Rejected", fmtDate(q.rejectedAt) + (q.rejectReason ? " · " + q.rejectReason : "")] : null,
    q.expiredAt ? ["Expired", fmtDate(q.expiredAt)] : null,
    ["Valid until", fmtDate(q.validUntil)],
    ["Place of supply", <>{q.placeOfSupply} <span className="faint">
      {q.igstPaise ? "inter-state · IGST" : "intra-state · CGST + SGST"}</span></>],
    ["Tax", <Pill text={q.taxMode === "not_applicable" ? "Not applicable" : "Applicable"}
                  tone={q.taxMode === "not_applicable" ? "warn" : ""} />],
    ["Discount", (q.discountPct || 0) + "%"],
    q.parentQuotationId
      ? ["Revised from", <a className="lnk mono" onClick={() => go("#/quotations/" + q.parentQuotationId)}>
          #{q.parentQuotationId}</a>]
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
    <div className="qvrail">
      <span className="qvrail-k">Versions</span>
      {live.map((v) => (
        <a key={v.id} className={"qvchip " + (STATUS_TONE[v.status] || "") + (v.id === q.id ? " on" : "")}
          title={"v" + v.version + " · " + STATUS_LABEL[v.status] + " · " + inr(v.grandTotalPaise)}
          onClick={() => go("#/quotations/" + v.id)}>
          <b>v{v.version}</b>
          <span className="qvchip-m tnum">{inr(v.grandTotalPaise, { compact: true })}</span>
        </a>
      ))}
      {onRevise
        ? <button className="qvchip qvchip-new" onClick={onRevise}
            title="Clone this version into a new editable draft">
            <Icon name="plus" size="sm" />Revise</button>
        : null}
    </div>
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
        <div className="help" style={{ marginBottom: "12px" }}>
          Already with the customer, so these figures stay as they are. Changing them means a new
          version — <button className="btn sm" style={{ marginLeft: "4px" }} onClick={onRevise}>
            Revise into a draft</button>
        </div>
      ) : null}
      <Table
        cols={[{ label: "Description" }, { label: "Term" }, { label: "Rate", cls: "n" },
               { label: "Discount", cls: "n" }, { label: "Taxable", cls: "n" },
               { label: "GST", cls: "n" }, { label: "Line total", cls: "n" }]}
        rows={items.map((it) => (
          <tr key={it.id}>
            <td>
              <b>{it.name}</b>
              {it.description ? <div className="cell-2">{it.description}</div> : null}
              {it.hsn ? <div className="cell-2 mono">HSN {it.hsn}</div> : null}
            </td>
            <td>{it.termMonths ? it.termMonths + " mo" : <span className="faint">—</span>}</td>
            <td className="n">{it.ratePerMonthPaise ? inr(it.ratePerMonthPaise) + "/mo" : inr(it.amountPaise)}</td>
            <td className="n">{it.discountValue ? it.discountType === "pct"
              ? it.discountValue + "%" : "−" + inr(it.discountValue * 100) : "—"}</td>
            <td className="n">{inr(it.taxableAmountPaise)}</td>
            <td className="n">{inr(it.taxAmountPaise)}<div className="cell-2">{it.taxRate}%</div></td>
            <td className="n"><b>{inr(it.lineTotalPaise)}</b></td>
          </tr>
        ))} />
      <SectionHead title="Commercial summary" />
      <div className="card"><div className="card-b">
        <KvList cls="wide" pairs={[
          ["Gross amount", inr(q.subtotalPaise)],
          ["Discount", q.discountAmountPaise ? "−" + inr(q.discountAmountPaise) : <span className="faint">—</span>],
          [taxed ? "Taxable value" : "Subtotal", inr(q.taxablePaise)],
          ...(taxed
            ? q.igstPaise
              ? [["IGST @ " + q.gstRate + "%", inr(q.igstPaise)] as [ReactNode, ReactNode]]
              : [["CGST @ " + q.gstRate / 2 + "%", inr(q.cgstPaise)] as [ReactNode, ReactNode],
                 ["SGST @ " + q.gstRate / 2 + "%", inr(q.sgstPaise)] as [ReactNode, ReactNode]]
            : [["Tax", <span className="faint">Not applicable</span>] as [ReactNode, ReactNode]]),
          ["Grand total", <b>{inr(q.grandTotalPaise)}</b>],
        ]} />
      </div></div>
    </>
  );
}

function DocumentTab({ q, onView }: { q: QuotationRow; onView: () => void }) {
  const { toast } = useShell();
  const [info, setInfo] = useState<{ storageKey: string; generatedAt: string } | null>(null);
  if (!q.hasDocument) return (
    <EmptyState icon="quote" title="No document"
      body="A document is produced by the issue transaction. This quotation has not been issued." />
  );
  return (
    <div className="card"><div className="card-b">
      <KvList cls="wide" pairs={[
        ["Storage key", <span className="mono">{info ? info.storageKey : "—"}</span>],
        ["Generated", info ? fmtDate(info.generatedAt) : "—"],
      ]} />
      <div style={{ display: "flex", gap: "8px", marginTop: "14px", flexWrap: "wrap" }}>
        <button className="btn" onClick={() =>
          call(AdminOpsService.quotationDocDownload(q.id)).then((d) => setInfo(d))
            .catch((e: unknown) => toast(errMessage(e), "bad"))
        }><Icon name="download" />Document info</button>
        <button className="btn" onClick={onView}>View</button>
      </div>
      <div className="help" style={{ marginTop: "10px" }}>
        The customer's share link lives on the document page — it is a public URL, so it is
        minted where you can see what you are handing out.
      </div>
    </div></div>
  );
}

function VersionsTab({ q }: { q: QuotationRow }) {
  const { versions } = useQuotationVersions(q.dealRef);
  const { go } = useNav();
  return (
    <Table
      cols={[{ label: "Version" }, { label: "Quotation" }, { label: "Status" },
             { label: "Value", cls: "n" }, { label: "Issued" }]}
      rows={versions.map((v) => (
        <tr key={v.id} className="clickable" onClick={() => go("#/quotations/" + v.id)}>
          <td>v{v.version}</td>
          <td className="mono">{v.quotationNumber || <span className="faint">Draft</span>}</td>
          <td><Pill text={STATUS_LABEL[v.status]} tone={STATUS_TONE[v.status]} /></td>
          <td className="n tnum">{inr(v.grandTotalPaise)}</td>
          <td>{v.issuedAt ? fmtDate(v.issuedAt) : <span className="faint">—</span>}</td>
        </tr>
      ))} />
  );
}

function HistoryTab({ q }: { q: QuotationRow }) {
  if (!q.events || !q.events.length) return <div className="faint">Nothing logged yet.</div>;
  return (
    <div className="tl">
      {q.events.map((e) => (
        <div key={e.id} className="ti">
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
            <span className="pill xs">{e.eventType}</span>
            <span className="faint" style={{ fontSize: "var(--text-sm)", marginLeft: "auto" }}>
              {fmtDate(e.createdAt)}</span>
          </div>
          {e.detail ? <div style={{ fontSize: "var(--text-base)", marginTop: "4px" }}>{e.detail}</div> : null}
          <div className="faint" style={{ fontSize: "var(--text-sm)", marginTop: "2px" }}>
            {e.actor ? e.actor.name : e.actorRole || "System"}
          </div>
        </div>
      ))}
    </div>
  );
}
