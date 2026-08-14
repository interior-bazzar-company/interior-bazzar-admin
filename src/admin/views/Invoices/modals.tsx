/* =============================================================================
   THE GUARD MODALS
   -----------------------------------------------------------------------------
   Every modal states the rule BEFORE you commit. In the prototype each was an
   HTML string with an `#inErr` slot the handler wrote a notice into; here each
   is a component that owns that slot as state, which is the same thing said in
   the language the port speaks.

   `data-close="1"` is kept on every dismiss control — the prototype's shell
   delegated on it, and the class/attribute pair is what the CSS selects.
   ============================================================================= */
import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { Field, Icon, KvList, Notice } from "../../ui";
import { IBData, IBDeals, IBInvoice } from "../../engines";
import { actor, billingCell, fileSize, inr, val } from "./helpers";
import type { Refusal } from "./helpers";

const D = IBData, N = IBInvoice, E = IBDeals;

export type Ctx = {
  toast: (m: ReactNode, tone?: string) => void;
  banner: (m: ReactNode, tone?: string) => void;
  closeLayer: () => void;
  go: (h: string) => void;
  render: () => void;
  /** closeLayer + toast + optional navigate + re-read the engines */
  done: (msg: ReactNode, route?: string) => void;
};

function ErrSlot({ err }: { err: Refusal | null }) {
  if (!err) return <div id="inErr"></div>;
  return (
    <div id="inErr">
      <Notice tone="bad" text={<>
        <b>{err.http} <span className="mono">{err.code}</span></b>
        <div style={{ marginTop: "3px" }}>{err.detail}</div>
      </>} />
    </div>
  );
}

function BlockerList({ items }: { items: any[] }) {
  return (
    <ul style={{ margin: "6px 0 0 16px" }}>
      {items.map((b: any, i: number) => <li key={i}>{b.text} <span className="mono">{b.code}</span></li>)}
    </ul>
  );
}

/* ---------------------------------------------------------------- ISSUE --- */
export function IssueModal({ inv, ctx }: { inv: any; ctx: Ctx }) {
  const [err, setErr] = useState<Refusal | null>(null);
  const ref = inv.invoice_id;
  const blockers = N.Issuance.blockers(ref);
  const plan = N.planOf(ref);
  const cap = N.outstandingFor(inv.deal_id, ref);

  function issue() {
    const draft = N.invoiceOf(ref);
    const r = N.Issuance.issue(ref, actor());
    if (r.ok === false) return setErr(r);
    N.drain();
    const out = r.data;
    // The invoice is raised only because the client already paid — log that
    // payment on the deal ledger in the same action, from the fields collected
    // in the builder. E.Ledger.pay re-validates everything itself; the invoice
    // is not left unpaid because the UI already checked before Issue.
    const pay = E.Ledger.pay({
      dealId: out.deal_id, invoiceId: out.invoice_id, amountPaise: out.grand_total_paise,
      date: draft.payment_date, mode: draft.payment_mode, reference: draft.payment_reference,
      idempotency_key: "issue-" + out.invoice_id
    }, actor());
    if (pay.ok === false) {
      // A real failure, not a routine confirmation — banner() is called AFTER
      // go()/render() (whose own cleanup clears any live banner) so this one
      // survives the navigation instead of being wiped by it.
      ctx.closeLayer(); ctx.go("#/invoices/" + out.invoice_id); ctx.render();
      ctx.banner("Issued as " + out.invoice_number + ", but the ledger entry failed: " + pay.detail +
        " — log the payment manually from the deal.", "warn");
      return;
    }
    ctx.done("Issued as " + out.invoice_number + " and payment logged. " +
      (pay.data.closedWon
        ? "Outstanding is ₹0 — this deal closed as Won automatically."
        : inr(pay.data.outstanding) + " outstanding."),
      "#/invoices/" + out.invoice_id);
  }

  return <>
    <div className="md-h"><h3>Issue invoice</h3>
      <p>{inr(inv.grand_total_paise)} · due {D.fmtDate(inv.due_date)}</p>
      <button className="md-x" data-close="1" onClick={ctx.closeLayer}><Icon name="x" /></button>
    </div>
    <div className="md-b">
      <ErrSlot err={err} />
      {blockers.length
        ? <Notice tone="bad" text={<><b>These must be fixed first</b><BlockerList items={blockers} /></>} />
        : <Notice tone="ok" ico="check" text={<><b>Validation passed.</b> Totals reconcile, and{" "}
            {inr(inv.grand_total_paise)} is within the deal's remaining {inr(cap)}.</>} />}
      <div style={{ height: "12px" }}></div>
      <KvList cls="wide" pairs={[
        ["Number", <span className="faint">allocated by this transaction, under a sequence lock</span>],
        ["Billing", billingCell(plan)],
        ["Grand total", <b>{inr(inv.grand_total_paise)}</b>],
        ["Due date", D.fmtDate(inv.due_date)]
      ]} />
      <div style={{ height: "12px" }}></div>
      <Notice tone="warn" ico="lock" text={<>
        <b>Once issued, this invoice cannot be edited.</b> A correction is a cancellation and
        a new invoice. Nine steps commit as one — revalidate, recompute, lock the sequence, allocate
        the number, freeze the snapshot, write the document, append the event, enqueue the write-back
        — or none of them do, and the number returns to the sequence.</>} />
      <Notice tone="ok" ico="check" text={<>
        <b>This invoice is raised because the client has already paid.</b> Issuing writes{" "}
        {inr(inv.grand_total_paise)} to the deal ledger as the same action — the payment reference
        and proof above are what that ledger entry is built from.</>} />
    </div>
    <div className="md-f"><span className="spacer"></span>
      <button className="btn" data-close="1" onClick={ctx.closeLayer}>Cancel</button>
      <button className="btn pri" data-act="in-issue-go" data-ref={ref} onClick={issue}>Issue invoice</button>
    </div>
  </>;
}

/* -------------------------------------------------------- CANCEL INVOICE --- */
export function CancelModal({ inv, ctx }: { inv: any; ctx: Ctx }) {
  const [err, setErr] = useState<Refusal | null>(null);
  const ref = inv.invoice_id;
  const blockers = N.Cancellation.blockers(ref, actor());

  function cancel() {
    const r = N.Cancellation.cancel(ref, val("cxReason"), actor());
    if (r.ok === false) return setErr(r);
    N.drain();
    ctx.done("Cancelled. The number stays consumed and the document is retained.", "#/invoices/" + ref);
  }

  return <>
    <div className="md-h"><h3>Cancel invoice</h3><p>{inv.invoice_number}</p>
      <button className="md-x" data-close="1" onClick={ctx.closeLayer}><Icon name="x" /></button>
    </div>
    <div className="md-b">
      <ErrSlot err={err} />
      {blockers.length ? <>
        <Notice tone="bad" text={<><b>Blocked</b><BlockerList items={blockers} /></>} />
        <div style={{ height: "12px" }}></div>
      </> : null}
      <Field id="cxReason" label="Reason" type="textarea" req
        ph="Why this invoice is being invalidated."
        help="Mandatory. A cancellation with no recorded reason is indistinguishable from a mistake six months later." />
      <Notice ico="lock" text={<>
        <b>The number {inv.invoice_number} stays permanently consumed and the document is retained.</b>{" "}
        Cancellation deletes nothing — the row, its number, its document versions and its full event
        history all survive. That is the entire point of the operation.</>} />
      <Notice tone="warn" ico="alert" text={<>
        <b>This does not reverse a payment.</b> Money is reversed on the deal, and the ledger moves
        before the document — never the other way round. {inr(inv.grand_total_paise)} returns to
        uninvoiced and can be raised again.</>} />
    </div>
    <div className="md-f"><span className="spacer"></span>
      <button className="btn" data-close="1" onClick={ctx.closeLayer}>Keep it</button>
      <button className="btn dgr" data-act="in-cancel-go" data-ref={ref} onClick={cancel}>Cancel invoice</button>
    </div>
  </>;
}

/* ---------------------------------------------------------- CANCEL DRAFT --- */
export function CancelDraftModal({ ref_, ctx }: { ref_: string; ctx: Ctx }) {
  const [err, setErr] = useState<Refusal | null>(null);
  function go() {
    const r = N.Draft.cancel(ref_, actor());
    if (r.ok === false) return setErr(r);
    ctx.done("Draft cancelled. No number was consumed.", "#/invoices");
  }
  return <>
    <div className="md-h"><h3>Cancel draft</h3>
      <button className="md-x" data-close="1" onClick={ctx.closeLayer}><Icon name="x" /></button>
    </div>
    <div className="md-b">
      <ErrSlot err={err} />
      <Notice ico="shield" text={<>
        <b>This consumes no invoice number</b> — the statutory series is unaffected. The row is not
        deleted; an abandoned draft is still part of the record.</>} />
    </div>
    <div className="md-f"><span className="spacer"></span>
      <button className="btn" data-close="1" onClick={ctx.closeLayer}>Keep it</button>
      <button className="btn dgr" data-act="in-cancel-draft-go" data-ref={ref_} onClick={go}>Cancel draft</button>
    </div>
  </>;
}

/* --------------------------------------------------------- ATTACH PROOF --- */
type Picked = { filename: string; mime: string; bytes: number; thumb: string | null; bad: string | null };

export function ProofModal({ ref_, ctx }: { ref_: string; ctx: Ctx }) {
  const [err, setErr] = useState<Refusal | null>(null);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  /* Reads the files the user actually picked. Only a downscaled preview is
     kept — a 5 MB screenshot in localStorage would blow the quota on the second
     upload. The original goes to object storage through the API later. */
  function take(fileList: FileList | null) {
    const files = Array.prototype.slice.call(fileList || []) as File[];
    if (!files.length) return;
    let pending = files.length;
    const out: Picked[] = [];
    const flush = () => { if (!--pending) setPicked((prev) => prev.concat(out)); };
    files.forEach(function (file) {
      const rec: Picked = { filename: file.name, mime: file.type, bytes: file.size, thumb: null,
        bad: N.PROOF_TYPES.indexOf(file.type) < 0 ? "proof_type_unsupported"
          : file.size > N.PROOF_MAX_BYTES ? "proof_too_large" : null };
      const done1 = function () { out.push(rec); flush(); };
      if (rec.bad || file.type.indexOf("image/") !== 0) return done1();
      const fr = new FileReader();
      fr.onload = function () {
        const img = new Image();
        img.onload = function () {
          const max = 240, sc = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement("canvas");
          c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
          const cx = c.getContext("2d");
          if (cx) cx.drawImage(img, 0, 0, c.width, c.height);
          try { rec.thumb = c.toDataURL("image/jpeg", 0.6); } catch { /* tainted canvas */ }
          done1();
        };
        img.onerror = done1;
        img.src = String(fr.result);
      };
      fr.onerror = done1;
      fr.readAsDataURL(file);
    });
  }

  function attach() {
    if (!picked.length)
      return setErr({ ok: false, http: 400, code: "validation_failed", detail: "Choose at least one file." });
    let n = 0;
    for (let i = 0; i < picked.length; i++) {
      const last = N.Proofs.attach(ref_, picked[i], actor());
      if (last.ok === false) return setErr(last);
      n++;
    }
    setPicked([]);
    // Stay on the builder for a still-draft invoice — attaching proof there is
    // the whole point, not a detour away from it.
    const inv = N.invoiceOf(ref_);
    const dest = inv && inv.invoice_status === N.DOC.DRAFT
      ? "#/invoices/" + ref_ + "?mode=edit" : "#/invoices/" + ref_ + "?tab=payment";
    ctx.done(n + " proof" + (n === 1 ? "" : "s") + " attached. Internal only — never reaches the document.", dest);
  }

  return <>
    <div className="md-h"><h3>Attach payment proof</h3><p>Internal evidence</p>
      <button className="md-x" data-close="1" onClick={ctx.closeLayer}><Icon name="x" /></button>
    </div>
    <div className="md-b">
      <ErrSlot err={err} />
      <label htmlFor="pfFile" id="pfDrop"
        style={{ display: "block", position: "relative",
          border: "1.5px dashed " + (over ? "var(--brand)" : "var(--line-control)"),
          borderRadius: "var(--radius-lg)", padding: "26px 18px", textAlign: "center",
          cursor: "pointer", background: over ? "var(--bg-hover)" : undefined }}
        onDragEnter={(e) => { e.preventDefault(); setOver(true); }}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={(e) => { e.preventDefault(); setOver(false); }}
        onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer && e.dataTransfer.files); }}>
        <div style={{ fontWeight: 600 }}>Choose files or drop them here</div>
        <div className="faint" style={{ fontSize: "var(--text-sm)", marginTop: "3px" }}>
          PNG, JPG or PDF, up to 5 MB each. Several at once.</div>
        <input ref={input} type="file" id="pfFile" multiple accept="image/png,image/jpeg,application/pdf"
          style={{ position: "absolute", width: "1px", height: "1px", opacity: 0, left: 0, top: 0 }}
          onChange={() => take(input.current && input.current.files)} />
      </label>
      <div id="pfList" style={{ marginTop: "12px" }}>
        {picked.length
          ? picked.map(function (f, ix) {
              return (
                <div key={ix} style={{ display: "flex", gap: "10px", alignItems: "center",
                  border: "1px solid " + (f.bad ? "var(--bad-line)" : "var(--line)"),
                  borderRadius: "var(--radius-md)", padding: "8px", marginBottom: "6px" }}>
                  {f.thumb
                    ? <img src={f.thumb} alt="" style={{ width: "44px", height: "44px",
                        objectFit: "cover", borderRadius: "var(--radius-sm)" }} />
                    : <span style={{ width: "44px", height: "44px", display: "grid",
                        placeItems: "center", background: "var(--bg-inset)",
                        borderRadius: "var(--radius-sm)", fontSize: "10px" }}>PDF</span>}
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <b style={{ fontSize: "var(--text-md)" }}>{f.filename}</b>
                    <div className="cell-2">{fileSize(f.bytes)}
                      {f.bad ? <> · <span style={{ color: "var(--bad)" }}>{f.bad}</span></> : null}</div>
                  </span>
                  <button className="btn sm icon dgr" data-act="in-proof-drop" data-ix={ix}
                    onClick={() => setPicked((prev) => prev.filter((_, j) => j !== ix))}><Icon name="x" /></button>
                </div>
              );
            })
          : <div className="faint" style={{ fontSize: "var(--text-md)" }}>No file chosen yet.</div>}
      </div>
      <Notice tone="warn" ico="alert" text={<>
        <b>This files evidence. It does not record money.</b> The invoice stays exactly as it is until
        a ledger entry exists in Module 1 — a screenshot is not a payment.</>} />
      <Notice ico="shield" text={<>
        <b>Internal only, and structurally so.</b> The document generator is never handed a reference
        to proofs, so there is no template field a bank screenshot could render into.</>} />
    </div>
    <div className="md-f"><span className="spacer"></span>
      <button className="btn" data-close="1" onClick={ctx.closeLayer}>Cancel</button>
      <button className="btn pri" data-act="in-proof-go" data-ref={ref_} onClick={attach}>Attach</button>
    </div>
  </>;
}

/* --------------------------------------------------------- REMOVE PROOF --- */
export function ProofRemoveModal({ ref_, proofId, ctx }: { ref_: string; proofId: string; ctx: Ctx }) {
  const [err, setErr] = useState<Refusal | null>(null);
  function remove() {
    const r = N.Proofs.remove(ref_, proofId, val("rmReason"), actor());
    if (r.ok === false) return setErr(r);
    ctx.done("Removed. The original filename is on the record.", "#/invoices/" + ref_ + "?tab=payment");
  }
  return <>
    <div className="md-h"><h3>Remove payment proof</h3>
      <button className="md-x" data-close="1" onClick={ctx.closeLayer}><Icon name="x" /></button>
    </div>
    <div className="md-b">
      <ErrSlot err={err} />
      <Field id="rmReason" label="Reason" type="textarea" req />
      <Notice tone="warn" ico="lock" text={<>
        <b>Sales Head only, and the removal is logged with the original filename.</b> Deleting the
        file cannot delete the fact that it was there.</>} />
    </div>
    <div className="md-f"><span className="spacer"></span>
      <button className="btn" data-close="1" onClick={ctx.closeLayer}>Keep it</button>
      <button className="btn dgr" data-act="in-proof-rm-go" data-ref={ref_} data-proof={proofId}
        onClick={remove}>Remove</button>
    </div>
  </>;
}
