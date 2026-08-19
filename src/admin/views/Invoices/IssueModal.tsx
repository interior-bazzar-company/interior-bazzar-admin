/* =====================================================================
   ISSUE — the last guard, the prototype's `in-issue` dialog, and the same
   dialog the quotation gets before ITS irreversible step.

   Issuing an invoice does more than freeze it: it allocates a number out of
   the statutory sequence AND writes the payment to the deal ledger, both in
   one transaction (InvoicesController.Issue). That is not something a button
   should just do, so it gets a dialog that states what is about to be true.

   The blocker list is the same check the server runs (see helpers.blockersOf).
   The server re-checks all of them — this only says, before you commit,
   whether it is going to say yes.
   ===================================================================== */
import { useState } from "react";
import { Icon, KvList, Notice } from "../../ui";
import { inr, fmtDate } from "../../ui/format";
import { errMessage } from "../../../api/apiService";
import { blockersOf, planItemOf } from "./helpers";
import type { InvoiceRow } from "./api";

export default function IssueModal({ inv, onClose, run }: {
  inv: InvoiceRow; onClose: () => void; run: () => Promise<unknown>;
}) {
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const blockers = blockersOf(inv);
  const plan = planItemOf(inv);
  const proofs = (inv.proofs || []).filter((p) => !p.removed);

  /* Left enabled even with blockers listed. The server is the authority on
     whether this can be issued, and its refusal — in its own words — is a
     better answer than a dead button that never says why. */
  const submit = () => {
    setErr(null); setBusy(true);
    run().catch((e: unknown) => { setErr(errMessage(e)); setBusy(false); });
  };

  return (
    <>
      <div className="md-h">
        <h3>Issue invoice</h3>
        <p>{inr(inv.grandTotalPaise)} · due {fmtDate(inv.dueDate)}</p>
        <button className="md-x" data-close="1" aria-label="Close" onClick={onClose}><Icon name="x" /></button>
      </div>

      <div className="md-b">
        {err ? <Notice tone="bad" text={<b>{err}</b>} /> : null}

        {blockers.length
          ? <Notice tone="bad" ico="alert" text={<>
              <b>These must be fixed first</b>
              <ul style={{ margin: "6px 0 0 16px" }}>
                {blockers.map((b) => <li key={b}>{b}</li>)}
              </ul>
            </>} />
          : <Notice tone="ok" ico="check" text={<>
              <b>Validation passed.</b> The line, the reference and the proof are all in place. That
              this total still fits what is uninvoiced on the deal is the server's own last check.
            </>} />}

        <div style={{ height: "12px" }}></div>
        <KvList cls="wide" pairs={[
          ["Number", <span className="faint">allocated by this transaction, under a sequence lock</span>],
          ["Billing", plan
            ? <>{plan.description} <span className="faint">
                {plan.remark
                  || (plan.installmentCount
                    ? "installment " + plan.installmentSeq + " of " + plan.installmentCount
                    : "full amount")}</span></>
            : <span className="faint">no plan line</span>],
          ["Grand total", <b>{inr(inv.grandTotalPaise)}</b>],
          ["Reference / UTR", inv.paymentReference
            ? <span className="mono">{inv.paymentReference}</span>
            : <span className="faint">— required</span>],
          ["Proof", proofs.length
            ? proofs.length + " file" + (proofs.length === 1 ? "" : "s") + " attached"
            : <span className="faint">— required</span>],
          ["Due date", fmtDate(inv.dueDate)],
        ]} />
        <div style={{ height: "12px" }}></div>

        <Notice tone="warn" ico="lock" text={<>
          <b>Once issued, this invoice cannot be edited.</b> A correction is a cancellation and a new
          invoice. The number it takes stays spent either way — the sequence is statutory, so it never
          has unexplained gaps.
        </>} />

        <Notice tone="ok" ico="check" text={<>
          <b>This invoice is raised because the client has already paid.</b> Issuing writes{" "}
          {inr(inv.grandTotalPaise)} to the deal ledger as the same action, in one transaction — the
          reference and the proof above are what that ledger entry is built from.
        </>} />
      </div>

      <div className="md-f">
        <span className="spacer"></span>
        <button className="btn" data-close="1" onClick={onClose}>Cancel</button>
        <button className="btn pri" data-act="in-issue-go" disabled={busy} onClick={submit}>
          {busy ? "Issuing…" : "Issue invoice"}</button>
      </div>
    </>
  );
}
