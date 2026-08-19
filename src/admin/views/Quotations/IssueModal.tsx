/* =====================================================================
   ISSUE — the last guard, the prototype's `qt-issue` dialog.

   Issuing is the one irreversible step in this module: it locks a number out
   of the sequence, freezes the content and the customer snapshot, and closes
   the draft to editing for good. So it gets a dialog that states what is
   about to be true rather than a button that just does it.

   The validation line is the same four checks QuotationsController.Issue
   runs (see helpers.blockersOf). The server re-checks all of them — this only
   says, before you commit, whether it is going to say yes.
   ===================================================================== */
import { useState } from "react";
import { Icon, KvList, Notice } from "../../ui";
import { inr, fmtDate } from "../../ui/format";
import { errMessage } from "../../../api/apiService";
import { blockersOf, planItemOf } from "./helpers";
import type { QuotationRow } from "./api";

export default function IssueModal({ q, onClose, run }: {
  q: QuotationRow; onClose: () => void; run: () => Promise<unknown>;
}) {
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const blockers = blockersOf(q);
  const plan = planItemOf(q);

  /* Left enabled even with blockers listed. The server is the authority on
     whether this can be issued, and its refusal — with the real code — is a
     better answer than a dead button that never says why. */
  const submit = () => {
    setErr(null); setBusy(true);
    run().catch((e: unknown) => { setErr(errMessage(e)); setBusy(false); });
  };

  return (
    <>
      <div className="md-h">
        <h3>Issue quotation</h3>
        <p>v{q.version} · {inr(q.grandTotalPaise)}</p>
        <button className="md-x" data-close="1" aria-label="Close" onClick={onClose}><Icon name="x" /></button>
      </div>

      <div className="md-b">
        {err ? <Notice tone="bad" text={<b>{err}</b>} /> : null}

        {blockers.length
          ? <Notice tone="bad" ico="alert" text={<>
              <b>These must be fixed first</b>
              <ul style={{ margin: "6px 0 0 16px" }}>
                {blockers.map((b) => <li key={b.code + b.text}>{b.text}{" "}
                  <span className="mono">422 {b.code}</span></li>)}
              </ul>
            </>} />
          : <Notice tone="ok" ico="check" text={<>
              <b>Validation passed.</b> A plan with a term of {plan && plan.termMonths ? plan.termMonths : 0} months,
              totals that reconcile, and a validity date in the future.
            </>} />}

        <div style={{ height: "12px" }}></div>
        <KvList cls="wide" pairs={[
          ["Number", <span className="faint">assigned by this transaction</span>],
          ["Version", "v" + q.version],
          ["Grand total", <b>{inr(q.grandTotalPaise)}</b>],
          ["Valid until", fmtDate(q.validUntil)],
        ]} />
        <div style={{ height: "12px" }}></div>

        <Notice tone="warn" ico="lock" text={<>
          <b>Once issued, this quotation cannot be edited.</b> Changes after this create a revision.
          Five steps commit as one — recalculate, assign the number and version, freeze the content and
          the customer snapshot, write the document, append the event — or none of them do, and the
          number is returned so the sequence has no unexplained gaps.
        </>} />

        {q.parentQuotationId
          ? <Notice ico="history" text={<>
              This is a revision. <b>The previous version becomes Superseded only after this issue
              succeeds</b> — never before.
            </>} />
          : null}
      </div>

      <div className="md-f">
        <span className="spacer"></span>
        <button className="btn" data-close="1" onClick={onClose}>Cancel</button>
        <button className="btn pri" data-act="qt-issue-go" disabled={busy} onClick={submit}>
          {busy ? "Issuing…" : "Issue quotation"}</button>
      </div>
    </>
  );
}
