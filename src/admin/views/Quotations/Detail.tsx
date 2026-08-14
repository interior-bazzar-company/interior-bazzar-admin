/* =============================================================================
   Quotation — the record, its four tabs, the version rail and the preview
   ============================================================================= */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReactNode } from "react";
import { ChainStrip, CommercialSummary, EmptyState, Icon, KvList, NotesTerms, Pill, SectionHead, Table } from "../../ui";
import { useNav } from "../../shell/AdminShell";
import { D, Q, expiringSoon, inr, validityChip } from "./core";
import { MenuBtn, useQtActions } from "./useQuotations";
import type { QtActions } from "./useQuotations";
import { Qdoc } from "./doc";

/* ==========================================================================
   THE VERSION RAIL
   --------------------------------------------------------------------------
   Every version of this quotation, on every screen that shows one — the
   detail, the editor and the document. It used to be a tab, which meant the
   answer to "what did we quote them last time" was three clicks away and
   invisible until you thought to ask. Negotiation IS the version history;
   hiding it behind a tab hid the thing the screen is about.

   Each chip carries its own status colour and its money, so the shape of the
   negotiation — 4.8L, then 4.2L, then 4.4L accepted — is readable in one
   glance without opening anything.
   ====================================================================== */
function VersionRail({ q, mode, act }: { q: any; mode?: string; act: QtActions }) {
  const { go } = useNav();
  const vs: any[] = Q.versionsOf(q.quotation_id);
  if (vs.length < 1) return null;
  return (
    <div className="qvrail">
      <span className="qvrail-k">Versions</span>
      {vs.map((v) => {
        const here = v.quotation_id === q.quotation_id;
        const to = "#/quotations/" + (v.quotation_number || v.quotation_id) + (mode ? "?mode=" + mode : "");
        return (
          <a key={v.quotation_id} className={"qvchip " + (Q.TONE[v.status] || "") + (here ? " on" : "")}
            data-go={to} onClick={() => go(to)}
            title={"v" + v.version + " · " + Q.LABEL[v.status] +
              (v.issued_at ? " · issued " + D.fmtDate(v.issued_at) : " · not issued") +
              " · " + inr(v.grand_total_paise)}>
            <b>v{v.version}</b>
            <span className="qvchip-m tnum">{inr(v.grand_total_paise, { compact: true })}</span>
          </a>
        );
      })}
      {/* Revise only appears here in preview mode. On the detail page it is
          already the action bar's primary button — showing it a second time
          a few hundred pixels away is the same control fighting itself. On
          preview there is no action bar at all (see Preview's own comment),
          so "make another one" belongs beside "look at the other ones". */}
      {mode === "preview"
        ? <button className="qvchip qvchip-new" data-act="qt-revise" data-ref={q.quotation_id}
            title="Clone this version into a new editable draft"
            onClick={() => act.revise(q.quotation_id)}><Icon name="plus" size="sm" />Revise</button>
        : null}
    </div>
  );
}

/* ==========================================================================
   PREVIEW — the last point at which anything can change
   ====================================================================== */
export function Preview({ q }: { q: any }) {
  const act = useQtActions();
  const { go } = useNav();
  const draft = q.status === Q.ST.DRAFT;
  return (
    <div className="page qpage">
      <div className="ph">
        <div className="ph-t"><h1>{q.quotation_number || "Draft quotation"}</h1>
          <div className="scope">{draft
            ? "This is the artefact the customer receives. It is the last point at which anything can change."
            : "The document exactly as the customer has it."}</div>
        </div>
        {/* TWO buttons. This page is the document — the whole point of it is to
            be read, and every control on it was competing with the thing it was
            supposed to be showing. Revise, Share, Print and the overflow all
            live one click away on the detail page, which is where you go to act
            on a quotation rather than to look at one.

            What is left is the way out and the way to keep a copy. On a draft
            there is no copy to keep — the document is produced BY issuing, so
            `Document.of` returns null until then — and the one action the page
            exists for takes that slot instead. */}
        <div className="acts">
          <button className="btn" data-go={"#/quotations/" + q.quotation_id}
            onClick={() => go("#/quotations/" + q.quotation_id)}><Icon name="chevl" />Back</button>
          {draft
            ? <button className="btn pri" data-act="qt-issue" data-ref={q.quotation_id}
                onClick={() => act.issue(q.quotation_id)}>Issue quotation</button>
            : <button className="btn pri" data-act="qt-download" data-ref={q.quotation_id}
                onClick={() => act.download(q.quotation_id)}><Icon name="download" />Download PDF</button>}
        </div>
      </div>
      <VersionRail q={q} mode="preview" act={act} />
      <div className="qdoc-stage"><Qdoc q={q} /></div>
    </div>
  );
}

/* ============================================================== DETAIL === */
export default function Detail({ q, p }: { q: any; p: Record<string, string> }) {
  const act = useQtActions();
  const { go } = useNav();
  const tab = p.tab || "items";
  const cs = Q.partyOf(q);
  const t = Q.price(q, Q.itemsOf(q.quotation_id));
  const d = q.status === Q.ST.ISSUED ? Q.daysUntil(q.valid_until) : null;

  const tb = (k: string, label: string, n: number | null) => (
    <button key={k} className={tab === k ? "on" : ""}
      data-go={"#/quotations/" + (q.quotation_number || q.quotation_id) + "?tab=" + k}
      onClick={() => go("#/quotations/" + (q.quotation_number || q.quotation_id) + "?tab=" + k)}>
      {label}{n ? <span className="n">{n}</span> : null}
    </button>
  );

  const facts: ([ReactNode, ReactNode] | null)[] = [
    ["Deal", <a className="lnk mono" data-go={"#/deals/" + q.deal_id} onClick={() => go("#/deals/" + q.deal_id)}>{q.deal_id}</a>],
    ["Customer", <>{cs.name || "—"} <span className="faint">{cs.city || ""}</span></>],
    ["Owner", q.owner || "—"],
    ["Created", D.fmtDate(q.created_at) + " by " + (q.created_by || "—")],
    q.issued_at ? ["Issued", D.fmtDate(q.issued_at) + " by " + (q.issued_by || "—")] : null,
    q.accepted_at ? ["Accepted", D.fmtDate(q.accepted_at)] : null,
    q.rejected_at ? ["Rejected", D.fmtDate(q.rejected_at) + (q.reject_reason ? " · " + q.reject_reason : "")] : null,
    q.expired_at ? ["Expired", D.fmtDate(q.expired_at)] : null,
    ["Valid until", validityChip(q)],
    ["Place of supply", <>{q.place_of_supply} <span className="faint">
      {t.intra ? "intra-state · CGST + SGST" : "inter-state · IGST"}</span></>],
    ["Tax", <Pill text={Q.TAX_LABEL[q.tax_mode] || Q.TAX_LABEL.applicable} tone={Q.taxApplicable(q) ? "" : "warn"} />],
    ["Discount", (q.discount_pct || 0) + "%"],
    q.parent_quotation_id
      ? ["Revised from", <span className="mono">{(Q.quoteOf(q.parent_quotation_id) || {}).quotation_number || "a draft"}</span>]
      : null
  ];

  return (
    <div className="page wide">
      <div className="ph">
        <div className="ph-t">
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <h1 className="mono">{q.quotation_number || "Draft"}</h1>
            <Pill text={"v" + q.version} />
            <Pill text={Q.LABEL[q.status]} tone={Q.TONE[q.status]}
              title={q.status === Q.ST.ACCEPTED
                ? "Accepted — " + inr(q.grand_total_paise) + " was written to " + q.deal_id +
                  " as the agreed deal value. That is not closure: Closed-Won still requires the " +
                  "balance collected in Module 1."
                : undefined} />
            {/* No "Locked" pill. The status pill beside it already says Issued or
                Accepted, and a second badge announcing what you cannot do is a
                label for a wall that no longer exists — Revise goes through it. */}
            {expiringSoon(q) ? <Pill text="Expiring" tone="bad" dot /> : null}
          </div>
          <div className="scope">{cs.name || "—"} ·{" "}
            <a className="lnk mono" data-go={"#/deals/" + q.deal_id} onClick={() => go("#/deals/" + q.deal_id)}>
              {q.deal_id} ↗</a>
            {d !== null ? " · " + (d < 0 ? "expired" : "valid for " + d + " more day" + (d === 1 ? "" : "s")) : ""}
          </div>
        </div>
        <div className="acts"><ActionBar q={q} act={act} /></div>
      </div>

      {/* One figure, not three — what this document is worth, at a glance.
          The full Taxable/Tax/Grand breakdown lives once, in Commercial
          summary below the items, instead of being shown here AND there. */}
      <div style={{ marginBottom: "16px" }}>
        <div>
          <div style={{ fontSize: "var(--text-sm)", color: "var(--text-2)" }}>Grand total</div>
          <div className="tnum" style={{
            fontSize: "var(--text-2xl)", fontWeight: 600, marginTop: "2px", color: "var(--brand)"
          }}>{inr(t.grand_total)}</div>
        </div>
      </div>

      {q.status === Q.ST.SUPERSEDED && q.superseded_by_id
        ? <div className="faint" style={{ marginBottom: "12px" }}>
            Replaced by <a className="lnk mono" data-go={"#/quotations/" + q.superseded_by_id}
              onClick={() => go("#/quotations/" + q.superseded_by_id)}>
              {(Q.quoteOf(q.superseded_by_id) || {}).quotation_number || "a newer version"}
            </a> — this version stays fully readable.
          </div>
        : null}

      <SectionHead title="Facts" />
      <div className="card"><div className="card-b">
        <KvList cls="wide" pairs={facts.filter(Boolean) as [ReactNode, ReactNode][]} />
      </div></div>

      <VersionRail q={q} act={act} />
      <div className="tabs" style={{ marginTop: "22px" }}>
        {tb("items", "Items", null)}
        {tb("document", "Document", null)}
        {tb("versions", "Versions", Q.versionsOf(q.quotation_id).length)}
        {tb("history", "History", Q.eventsOf(q.quotation_id).length)}
      </div>
      {tab === "items" ? <ItemsTab q={q} t={t} act={act} />
        : tab === "document" ? <DocumentTab q={q} act={act} />
          : tab === "versions" ? <VersionsTab q={q} />
            : <HistoryTab q={q} />}
      <NotesTerms notes={q.notes} terms={q.terms} />
      <SectionHead title="Related" />
      <ChainStrip dealRef={q.deal_id} here="quotation" />
    </div>
  );
}

/* Revise is on EVERY status now, including accepted — that was the whole
   complaint and it was a fair one. A customer who has accepted and then wants
   a room added is the most ordinary thing that happens to a quotation, and
   the answer used to be that the button was not there.

   Nothing else is hidden by status either. The one thing that genuinely
   cannot happen is editing an ISSUED document in place, and Revise IS the way
   you do it — which is why there is no separate Edit button out here to mean
   the same thing in a second word.

   THREE controls. There were seven, and seven equally-weighted buttons is
   not a choice, it is a search.

   What stayed in front is what you came to the page to do. On a draft that
   is edit it and send it; on anything else it is read it or supersede it.
   Everything that is occasional — the file, the link, and the two
   verdicts — moved behind one menu, and the menu sits at the very end.
   Trailing is where an overflow belongs: the row then reads left to right
   as ordinary, then primary, then "everything else", and the reject inside
   it ends up the furthest thing in the bar from the button you press most.

   Edit is gone from this bar entirely. It forked into a revision, which is
   what Revise already says, and two buttons that do one thing is the same
   problem as seven. */
function ActionBar({ q, act }: { q: any; act: QtActions }) {
  const { go } = useNav();
  const r = q.quotation_id, draft = q.status === Q.ST.DRAFT;
  if (draft)
    return (
      <>
        <button className="btn" data-go={"#/quotations/" + r + "?mode=edit"}
          onClick={() => go("#/quotations/" + r + "?mode=edit")}><Icon name="doc" />Edit</button>
        <button className="btn pri" data-go={"#/quotations/" + r + "?mode=preview"}
          onClick={() => go("#/quotations/" + r + "?mode=preview")}>Preview &amp; issue</button>
        <MenuBtn r={r} act={act} />
      </>
    );
  return (
    <>
      <button className="btn" data-go={"#/quotations/" + r + "?mode=preview"}
        onClick={() => go("#/quotations/" + r + "?mode=preview")}><Icon name="quote" />View document</button>
      <button className="btn pri" data-act="qt-revise" data-ref={r}
        onClick={() => act.revise(r)}><Icon name="plus" />Revise</button>
      <MenuBtn r={r} act={act} />
    </>
  );
}

function ItemsTab({ q, t, act }: { q: any; t: any; act: QtActions }) {
  const plan = Q.planOf(q.quotation_id), addons = Q.addonsOf(q.quotation_id);
  const rows = ([plan] as any[]).concat(addons).filter(Boolean).map((it: any, i: number) => <ItemRow it={it} key={it.item_id || i} />);
  return (
    <>
      {q.status !== Q.ST.DRAFT
        ? <div className="help" style={{ marginBottom: "12px" }}>
            Already with the customer, so these figures stay as they are. Changing them means a new version —
            <button className="btn sm" data-act="qt-revise" data-ref={q.quotation_id} style={{ marginLeft: "4px" }}
              onClick={() => act.revise(q.quotation_id)}>Revise into a draft</button>
          </div>
        : null}
      <div style={{ height: "12px" }}></div>
      <Table
        cols={[{ label: "Description" }, { label: "Term" }, { label: "Rate", cls: "n" },
          { label: "Discount", cls: "n" }, { label: "Taxable", cls: "n" },
          { label: "GST", cls: "n" }, { label: "Line total", cls: "n" }]}
        rows={rows} />
      <CommercialSummary
        gross={t.gross} discount={t.discount} taxable={t.taxable}
        taxApplicable={Q.taxApplicable(q)} intra={t.intra} gstRate={t.gst_rate}
        cgst={t.cgst} sgst={t.sgst} igst={t.igst} grand={t.grand_total} />
      {Q.taxApplicable(q) ? null
        : <div className="help">Tax not applicable — an explicit Sales Team choice for this quotation.</div>}
    </>
  );
}

function ItemRow({ it }: { it: any }) {
  const n = Q.lineNet(it);
  return (
    <tr>
      <td><b>{it.name}</b>
        {it.description ? <div className="cell-2">{it.description}</div> : null}
        {it.hsn ? <div className="cell-2 mono">HSN {it.hsn}</div> : null}
      </td>
      <td>{it.term_months ? it.term_months + " mo" : <span className="faint">—</span>}</td>
      <td className="n">{it.rate_per_month_paise ? inr(it.rate_per_month_paise) + "/mo" : inr(n.base)}</td>
      <td className="n">{n.disc ? "−" + inr(n.disc) : "—"}</td>
      <td className="n">{inr(it.taxable_amount_paise)}</td>
      <td className="n">{inr(it.tax_amount_paise)}<div className="cell-2">{it.tax_rate}%</div></td>
      <td className="n"><b>{inr(it.line_total_paise)}</b></td>
    </tr>
  );
}

function DocumentTab({ q, act }: { q: any; act: QtActions }) {
  const { go } = useNav();
  const doc = Q.Document.of(q.quotation_id);
  if (!doc)
    return <EmptyState icon="quote" title="No document"
      body="A document is produced by the issue transaction. This quotation has not been issued." />;
  return (
    <div className="card"><div className="card-b">
      <KvList cls="wide" pairs={[
        ["Storage key", <span className="mono">{doc.storage_key}</span>],
        ["Checksum", <span className="mono" style={{ fontSize: "var(--text-xs)" }}>
          sha256:{doc.checksum_sha256.slice(0, 32)}…</span>],
        ["Size", Math.round(doc.byte_size / 1024) + " KB"],
        ["Created", D.fmtDate(doc.created_at)]
      ]} />
      <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
        <button className="btn" data-act="qt-download" data-ref={q.quotation_id}
          onClick={() => act.download(q.quotation_id)}><Icon name="download" />Download</button>
        <button className="btn" data-act="qt-share" data-ref={q.quotation_id}
          onClick={() => act.share(q.quotation_id)}><Icon name="link" />Share</button>
        <button className="btn" data-go={"#/quotations/" + q.quotation_id + "?mode=preview"}
          onClick={() => go("#/quotations/" + q.quotation_id + "?mode=preview")}>View</button>
      </div>
    </div></div>
  );
}

function VersionsTab({ q }: { q: any }) {
  const { go } = useNav();
  const vs: any[] = Q.versionsOf(q.quotation_id);
  return (
    <Table
      cols={[{ label: "Version" }, { label: "Quotation" }, { label: "Value", cls: "n" },
        { label: "Issued" }, { label: "Status" }, { label: "", cls: "c" }]}
      rows={vs.map((v) => {
        const here = v.quotation_id === q.quotation_id;
        const to = "#/quotations/" + (v.quotation_number || v.quotation_id);
        return (
          <tr key={v.quotation_id} className={here ? "on" : undefined}>
            <td><b>v{v.version}</b>{here ? <> <span className="faint">· this one</span></> : null}</td>
            <td className="mono">{v.quotation_number || <span className="faint">draft</span>}</td>
            <td className="n">{inr(v.grand_total_paise)}</td>
            <td>{v.issued_at ? D.fmtDate(v.issued_at) : <span className="faint">—</span>}</td>
            <td><Pill text={Q.LABEL[v.status]} tone={Q.TONE[v.status]} /></td>
            <td className="c">{here ? null
              : <button className="btn sm rowact" data-go={to} onClick={() => go(to)}>Open</button>}</td>
          </tr>
        );
      })} />
  );
}

function HistoryTab({ q }: { q: any }) {
  const evs: any[] = Q.eventsOf(q.quotation_id);
  return (
    <div className="tl">
      {evs.map((e, i) => {
        const tone = e.event_type === "ACCEPTED" ? "ok"
          : ["REJECTED", "EXPIRED", "CANCELLED"].indexOf(e.event_type) >= 0 ? "bad" : "";
        return (
          <div className={"ti " + tone} key={i}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
              <span className="pill xs">{e.event_type}</span>
              <span className="faint" style={{ fontSize: "var(--text-sm)", marginLeft: "auto" }}>
                {D.fmtDate(e.at)}</span>
            </div>
            <div className="faint" style={{ fontSize: "var(--text-md)", marginTop: "4px" }}>
              {e.actor_id} · {e.actor_role}
              {e.metadata ? " · " + JSON.stringify(e.metadata) : ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}
