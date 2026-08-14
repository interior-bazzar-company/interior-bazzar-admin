/* =============================================================================
   DETAIL — Plan / Document / Payment / History — and the PREVIEW
   ============================================================================= */
import type { ReactNode } from "react";
import { ChainStrip, CommercialSummary, EmptyState, Icon, KvList, NotesTerms, Pill,
         SectionHead, Table } from "../../ui";
import { IBData, IBInvoice } from "../../engines";
import { fileSize, head, inr, overdueDays, quoteNumberOf } from "./helpers";
import { InvoiceDoc } from "./InvoiceDoc";
import { MenuBtn } from "./InvoiceBuilder";
import type { Actions, Params } from "./useInvoices";

const D = IBData, N = IBInvoice;

export function InvoiceDetail({ inv, p, go, act }: { inv: any; p: Params; go: (h: string) => void; act: Actions }) {
  const tab = p.tab || "plan";
  const b = N.billedTo(inv);
  const t = N.price(inv, N.itemsOf(inv.invoice_id));
  const qn = quoteNumberOf(inv);
  const over = overdueDays(inv);
  const cancelled = inv.invoice_status === N.DOC.CANCELLED;

  const facts: [ReactNode, ReactNode][] = [
    ["Deal", <a className="lnk mono" data-go={"#/deals/" + inv.deal_id} onClick={() => go("#/deals/" + inv.deal_id)}>{inv.deal_id}</a>],
    ["Quotation", qn
      ? <a className="lnk mono" data-go={"#/quotations/" + qn} onClick={() => go("#/quotations/" + qn)}>{qn}</a>
      : <span className="pill bad xs">missing</span>],
    ["Customer", b.name || "—"],
    ["Owner", inv.owner || "—"],
    ["Created", D.fmtDate(inv.created_at) + " by " + (inv.created_by || "—")]
  ];
  if (inv.issued_at) facts.push(["Issued", D.fmtDate(inv.issued_at) + " by " + (inv.issued_by || "—")]);
  facts.push(["Due", <>{D.fmtDate(inv.due_date)}{over ? <span style={{ color: "var(--bad)" }}> · +{over}d</span> : null}</>]);
  facts.push(["Place of supply", <>{inv.place_of_supply} <span className="faint">
    {t.intra ? "intra-state · CGST + SGST" : "inter-state · IGST"}</span></>]);
  facts.push(["Tax", <Pill text={N.TAX_LABEL[inv.tax_mode] || N.TAX_LABEL.applicable}
    tone={N.taxApplicable(inv) ? "" : "warn"} />]);
  facts.push(["Payment", inv.payment_id
    ? <><span className="mono">{inv.payment_id}</span> <span className="faint">· from the deal ledger</span></>
    : <span className="faint">none yet</span>]);
  if (cancelled) facts.push(["Cancelled", D.fmtDate(inv.cancelled_at) + " by " + (inv.cancelled_by || "—") +
    " · " + (inv.cancellation_reason || "")]);

  return (
    <div className="page wide">
      <div className="ph"><div className="ph-t">
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <h1 className="mono">{inv.invoice_number || "Draft"}</h1>
          <Pill text={N.DOC_LABEL[inv.invoice_status]} tone={N.DOC_TONE[inv.invoice_status]}
            title={cancelled
              ? "Cancelled — " + (inv.cancellation_reason || "no reason recorded") +
                ". The number " + (inv.invoice_number || "—") + " stays permanently consumed; a correction " +
                "is a new invoice."
              : undefined} />
          {!cancelled && inv.invoice_status === N.DOC.ISSUED && !inv.payment_id
            ? <Pill text="Awaiting ledger sync" tone="bad" /> : null}
          {/* No "Locked" pill — same call Quotation already made: the status
              pill already says Issued, and a second badge naming what you
              cannot do is a label for a wall that is already obvious. */}
        </div>
        <div className="scope">{b.name || "—"} ·{" "}
          <a className="lnk mono" data-go={"#/deals/" + inv.deal_id}
            onClick={() => go("#/deals/" + inv.deal_id)}>{inv.deal_id} ↗</a>
          {qn ? <> · <a className="lnk mono" data-go={"#/quotations/" + qn}
            onClick={() => go("#/quotations/" + qn)}>{qn} ↗</a></> : null}
        </div>
      </div>
        <div className="acts"><ActionBar inv={inv} go={go} act={act} /></div>
      </div>

      <div style={{ display: "flex", gap: "28px", flexWrap: "wrap", marginBottom: "16px" }}>
        <Fig k="Amount" v={inr(inv.grand_total_paise)} />
        <Fig k="Received" v={inr(N.received(inv))} color={N.received(inv) ? "var(--ok)" : undefined} />
        <Fig k="Balance" v={inr(N.balance(inv))} color={N.balance(inv) ? undefined : "var(--ok)"} />
        <Fig k={cancelled ? "Cancelled" : over ? "Overdue by" : "Due"}
          v={cancelled ? D.fmtDate(inv.cancelled_at)
            : over ? over + " day" + (over === 1 ? "" : "s")
            : D.fmtDate(inv.due_date)}
          color={over && !cancelled ? "var(--bad)" : undefined} />
      </div>

      {inv.payment_id
        ? <div className="faint" style={{ marginBottom: "12px" }}>Settled by <span className="mono">{inv.payment_id}</span>.</div>
        : null}

      <SectionHead title="Facts" />
      <div className="card"><div className="card-b"><KvList pairs={facts} cls="wide" /></div></div>

      <div className="tabs" style={{ marginTop: "22px" }}>
        <Tb k="plan" label="Plan" n={null} cur={tab} inv={inv} go={go} />
        <Tb k="document" label="Document" n={N.docsOf(inv.invoice_id).length} cur={tab} inv={inv} go={go} />
        <Tb k="payment" label="Payment" n={N.proofsOf(inv.invoice_id).length || null} cur={tab} inv={inv} go={go} />
        <Tb k="history" label="History" n={N.eventsOf(inv.invoice_id).length} cur={tab} inv={inv} go={go} />
      </div>
      {tab === "plan" ? <PlanTab inv={inv} t={t} />
        : tab === "document" ? <DocumentTab inv={inv} go={go} act={act} />
        : tab === "payment" ? <PaymentTab inv={inv} go={go} act={act} />
        : <HistoryTab inv={inv} />}
      <NotesTerms notes={inv.notes} terms={inv.terms} />
      <SectionHead title="Related" />
      <ChainStrip dealRef={inv.deal_id} here="invoice" />
    </div>
  );
}

function Tb({ k, label, n, cur, inv, go }: {
  k: string; label: string; n: number | null; cur: string; inv: any; go: (h: string) => void;
}) {
  const to = "#/invoices/" + (inv.invoice_number || inv.invoice_id) + "?tab=" + k;
  return (
    <button className={cur === k ? "on" : ""} data-go={to} onClick={() => go(to)}>
      {label}{n ? <span className="n">{n}</span> : null}
    </button>
  );
}

function Fig({ k, v, color }: { k: string; v: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: "var(--text-sm)", color: "var(--text-2)" }}>{k}</div>
      <div className="tnum" style={{ fontSize: "var(--text-2xl)", fontWeight: 600, marginTop: "2px", color }}>{v}</div>
    </div>
  );
}

/* Gated on BOTH axes. There is no `Record payment` anywhere. */
/* Mirrors Quotation's own actionBar rule: a few controls in front, and
   everything occasional — the file, the link, and (on a draft) the two
   verdicts on the draft itself — behind one trailing menu. M["in-more"]
   already carried this menu's content; it just was never attached here,
   only in the builder header. */
function ActionBar({ inv, go, act }: { inv: any; go: (h: string) => void; act: Actions }) {
  const r = inv.invoice_id;
  if (inv.invoice_status === N.DOC.DRAFT) {
    return <>
      <button className="btn" data-go={"#/invoices/" + r + "?mode=edit"}
        onClick={() => go("#/invoices/" + r + "?mode=edit")}>Edit</button>
      <button className="btn pri" data-go={"#/invoices/" + r + "?mode=preview"}
        onClick={() => go("#/invoices/" + r + "?mode=preview")}>Preview &amp; issue</button>
      <MenuBtn r={r} act={act} />
    </>;
  }
  return <>
    {inv.invoice_status !== N.DOC.CANCELLED ? <>
      <button className="btn" data-act="in-proof" data-ref={r}
        onClick={() => act.proof(r)}>Attach payment proof</button>
      {/* Absent once Paid: cancelling then requires reversing the payment first,
          and the ledger moves before the document — always. */}
      {!inv.payment_id && head()
        ? <button className="btn dgr" data-act="in-cancel" data-ref={r}
            onClick={() => act.cancel(r)}>Cancel invoice</button>
        : null}
    </> : null}
    <MenuBtn r={r} act={act} />
  </>;
}

function PlanTab({ inv, t }: { inv: any; t: any }) {
  const plan = N.planOf(inv.invoice_id);
  return <>
    <div style={{ height: "12px" }}></div>
    {plan
      ? <div className="card"><div className="card-b">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div><b style={{ fontSize: "var(--text-lg)" }}>{plan.description}</b>
              <div className="faint" style={{ fontSize: "var(--text-md)" }}>{plan.remark
                ? plan.remark
                : plan.installment_count
                  ? "Installment " + plan.installment_seq + " of " + plan.installment_count
                  : "Full amount"}</div></div>
            <div className="tnum" style={{ fontSize: "var(--text-xl)", fontWeight: 600 }}>{inr(plan.amount_paise)}</div>
          </div>
          {(plan.features || []).length
            ? <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginTop: "10px" }}>
                {plan.features.map((f: any, i: number) => <span key={i} className="pill xs">{f.label}</span>)}
              </div>
            : null}
        </div></div>
      : null}
    <div style={{ height: "12px" }}></div>
    <Table
      cols={[{ label: "Description" }, { label: "Taxable", cls: "n" }, { label: "GST", cls: "n" },
             { label: "Line total", cls: "n" }]}
      rows={N.itemsOf(inv.invoice_id).map(function (it: any) {
        return (
          <tr key={it.item_id}>
            <td><b>{it.description}</b>
              {it.hsn ? <div className="cell-2 mono">HSN {it.hsn}</div> : null}</td>
            <td className="n">{inr(it.taxable_amount_paise)}</td>
            <td className="n">{inr(it.tax_amount_paise)}<div className="cell-2">{it.tax_rate}%</div></td>
            <td className="n"><b>{inr(it.line_total_paise)}</b></td>
          </tr>
        );
      })} />
    <CommercialSummary
      taxableLabel={N.taxApplicable(inv) ? "Taxable value" : "Subtotal"} taxable={t.taxable}
      taxApplicable={N.taxApplicable(inv)} intra={t.intra} gstRate={t.gst_rate}
      cgst={t.cgst} sgst={t.sgst} igst={t.igst} grand={t.grand_total} />
    {N.taxApplicable(inv) ? null
      : <div className="help">Tax not applicable — an explicit Sales Team choice for this invoice.</div>}
  </>;
}

function DocumentTab({ inv, go, act }: { inv: any; go: (h: string) => void; act: Actions }) {
  const vs = N.docsOf(inv.invoice_id);
  if (!vs.length) return <EmptyState icon="invoice" title="No document"
    body="A document is produced by the issue transaction. This invoice has not been issued." />;
  return <>
    <Table
      cols={[{ label: "Version" }, { label: "Storage key" }, { label: "Checksum" },
             { label: "Size", cls: "n" }, { label: "Generated" }]}
      rows={vs.map(function (d: any, ix: number) {
        return (
          <tr key={d.document_id} className={ix === 0 ? "on" : undefined}>
            <td><b>v{d.version}</b>{ix === 0 ? <> <span className="faint">· current</span></> : null}</td>
            <td className="mono" style={{ fontSize: "var(--text-xs)" }}>{d.storage_key}</td>
            <td className="mono" style={{ fontSize: "var(--text-xs)" }}>{d.checksum_sha256.slice(0, 20)}…</td>
            <td className="n">{Math.round(d.byte_size / 1024)} KB</td>
            <td>{D.fmtDate(d.generated_at)}</td>
          </tr>
        );
      })} />
    <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
      <button className="btn" data-act="in-download" data-ref={inv.invoice_id}
        onClick={() => act.download(inv.invoice_id)}><Icon name="download" />Download</button>
      {inv.invoice_status !== N.DOC.CANCELLED
        ? <button className="btn" data-act="in-share" data-ref={inv.invoice_id}
            onClick={() => act.share(inv.invoice_id)}><Icon name="link" />Share</button>
        : null}
      <button className="btn" data-go={"#/invoices/" + inv.invoice_id + "?mode=preview"}
        onClick={() => go("#/invoices/" + inv.invoice_id + "?mode=preview")}>View</button>
      {head()
        ? <button className="btn" data-act="in-regen" data-ref={inv.invoice_id}
            onClick={() => act.regen(inv.invoice_id)}>Regenerate</button>
        : null}
    </div>
  </>;
}

/* The Payment tab — read-only, sourced from Module 1. */
function PaymentTab({ inv, go, act }: { inv: any; go: (h: string) => void; act: Actions }) {
  const proofs = N.proofsOf(inv.invoice_id);
  const boundary: [ReactNode, string][] = [
    ["This Payment tab", "yes"], ["The deal timeline", "yes"], ["Internal search", "yes"],
    [<b>The invoice PDF</b>, "never"], [<b>A customer signed link</b>, "never"],
    [<b>Anything the customer sees</b>, "never"]
  ];
  return <>
    {inv.payment_id
      ? <div className="card"><div className="card-b"><KvList cls="wide" pairs={[
          ["Payment", <span className="mono">{inv.payment_id}</span>],
          ["Amount", <b>{inr(N.received(inv))}</b>],
          ["Status", <Pill text="Paid" tone="ok" />],
          ["Source", <><a className="lnk" data-go={"#/deals/" + inv.deal_id}
            onClick={() => go("#/deals/" + inv.deal_id)}>the deal ledger ↗</a>{" "}
            <span className="faint">· Module 1 owns this row</span></>]
        ]} /></div></div>
      : <EmptyState icon="cash" title="No payment yet"
          body={<>Payments are logged on the deal. There is no <b>Record payment</b> button in this
            module, and the absence is the boundary made visible.</>}
          action={<button className="btn" data-go={"#/deals/" + inv.deal_id}
            onClick={() => go("#/deals/" + inv.deal_id)}>Open the deal</button>} />}

    {/* Payment proof — visually distinct, so it can never be mistaken for part
        of the document. */}
    <div style={{ height: "18px" }}></div>
    <div className="card" style={{ borderStyle: "dashed", borderColor: "var(--warn)" }}>
      <div className="card-h">
        <h3><Icon name="shield" /> Payment proof</h3>
        <span className="d">INTERNAL — never leaves this panel</span>
      </div>
      <div className="card-b">
        {proofs.length
          ? <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
              {proofs.map(function (pf: any) {
                return (
                  <div key={pf.proof_id} style={{ border: "1px solid var(--line-2)",
                    borderRadius: "var(--radius-md)", padding: "10px", minWidth: "220px" }}>
                    {pf.thumb
                      ? <img src={pf.thumb} alt="Payment proof preview" style={{
                          width: "100%", height: "110px", objectFit: "cover",
                          borderRadius: "var(--radius-sm)", marginBottom: "8px",
                          border: "1px solid var(--line)" }} />
                      : null}
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <span className="pill warn xs">Internal</span>
                      <b style={{ fontSize: "var(--text-md)" }}>{pf.filename}</b>
                    </div>
                    <div className="faint" style={{ fontSize: "var(--text-sm)", marginTop: "5px" }}>
                      {fileSize(pf.bytes)} · {pf.uploaded_by} · {D.fmtDate(pf.uploaded_at)}
                      {pf.payment_id ? <><br />evidences <span className="mono">{pf.payment_id}</span></> : null}
                    </div>
                    <div style={{ display: "flex", gap: "5px", marginTop: "8px" }}>
                      <button className="btn sm" data-act="in-proof-view" data-ref={inv.invoice_id}
                        data-proof={pf.proof_id} onClick={() => act.proofView(inv.invoice_id, pf.proof_id)}>View</button>
                      {head()
                        ? <button className="btn sm dgr" data-act="in-proof-rm" data-ref={inv.invoice_id}
                            data-proof={pf.proof_id} onClick={() => act.proofRemove(inv.invoice_id, pf.proof_id)}>Remove</button>
                        : null}
                    </div>
                  </div>
                );
              })}
            </div>
          : <div className="faint" style={{ fontSize: "var(--text-md)" }}>No proof attached.</div>}
        <div style={{ marginTop: "12px" }}>
          <button className="btn" data-act="in-proof" data-ref={inv.invoice_id}
            onClick={() => act.proof(inv.invoice_id)}><Icon name="plus" />Attach payment proof</button>
        </div>
      </div>
      {/* The boundary, stated as a table rather than a sentence. */}
      <div className="card-f">
        <Table
          cols={[{ label: "Where a proof may appear" }, { label: "", cls: "c", w: "90px" }]}
          rows={boundary.map(function (r, i) {
            const yes = r[1] === "yes";
            return (
              <tr key={i}><td>{r[0]}</td><td className="c">
                <Pill text={yes ? "Yes" : "Never"} tone={yes ? "ok" : "bad"} /></td></tr>
            );
          })} />
      </div>
    </div>
    <div className="help">A proof files evidence — it does not record money. A payment is only reflected
      here once a Module 1 ledger entry exists.</div>
  </>;
}

function HistoryTab({ inv }: { inv: any }) {
  const evs = N.eventsOf(inv.invoice_id);
  return (
    <div className="tl">
      {evs.map(function (e: any, i: number) {
        const tone = ["ISSUED", "PAYMENT_SYNCED"].indexOf(e.event_type) >= 0 ? "ok"
          : ["CANCELLED", "MARKED_OVERDUE", "ACCESS_DENIED", "PROOF_REMOVED"].indexOf(e.event_type) >= 0 ? "bad" : "";
        return (
          <div key={i} className={"ti " + tone}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
              <span className="pill xs">{e.event_type}</span>
              <span className="faint" style={{ fontSize: "var(--text-sm)", marginLeft: "auto" }}>
                {D.fmtDate(e.created_at)}</span>
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

/* ==========================================================================
   PREVIEW — an Invoice
   ====================================================================== */
export function InvoicePreview({ inv, go, act }: { inv: any; go: (h: string) => void; act: Actions }) {
  const draft = inv.invoice_status === N.DOC.DRAFT;
  return (
    <div className="page qpage">
      <div className="ph"><div className="ph-t">
        <h1>{inv.invoice_number || "Draft invoice"}</h1>
        <div className="scope">{draft
          ? "This is the artefact the customer receives. It is the last point at which anything can change."
          : "The document exactly as the customer has it."}</div>
      </div>
        {/* Two controls, the same pair the quotation's document page carries.
            Everything else lives on the detail page, which is where you act on
            an invoice rather than read one. A draft has no PDF — the document is
            produced BY issuing — so the one action the page exists for takes
            that slot instead. */}
        <div className="acts">
          <button className="btn" data-go={"#/invoices/" + inv.invoice_id}
            onClick={() => go("#/invoices/" + inv.invoice_id)}><Icon name="chevl" />Back</button>
          {draft
            ? <button className="btn pri" data-act="in-issue" data-ref={inv.invoice_id}
                onClick={() => act.issue(inv.invoice_id)}>Issue invoice</button>
            : <button className="btn pri" data-act="in-download" data-ref={inv.invoice_id}
                onClick={() => act.download(inv.invoice_id)}><Icon name="download" />Download PDF</button>}
        </div>
      </div>
      <div className="qdoc-stage"><InvoiceDoc inv={inv} /></div>
    </div>
  );
}
