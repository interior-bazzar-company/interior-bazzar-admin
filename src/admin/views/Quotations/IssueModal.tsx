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
import { Alert, Button, KvList, ModalShell } from "../../ui";
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
    <ModalShell
      title="Issue quotation"
      sub={"v" + q.version + " · " + inr(q.grandTotalPaise)}
      mono
      ico="check"
      tone={blockers.length ? "warning" : "brand"}
      onClose={onClose}
      actions={<>
        <Button color="secondary" onClick={onClose} isDisabled={busy}>Cancel</Button>
        <Button color="primary" data-act="qt-issue-go" isLoading={busy} onClick={submit}>Issue quotation</Button>
      </>}>

      <div className="flex flex-col gap-3">
        {err ? <Alert tone="bad" title={err} /> : null}

        {blockers.length
          ? <Alert tone="bad" ico="alert" title="These must be fixed first">
              <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-4">
                {blockers.map((b) => (
                  <li key={b.code + b.text}>
                    {b.text} <span className="font-mono text-xs tnum">422 {b.code}</span>
                  </li>
                ))}
              </ul>
            </Alert>
          : <Alert tone="ok" ico="check" title="Validation passed.">
              A plan with a term of {plan && plan.termMonths ? plan.termMonths : 0} months, totals
              that reconcile, and a validity date in the future.
            </Alert>}

        <KvList pairs={[
          ["Number", <span className="text-quaternary">assigned by this transaction</span>],
          ["Version", "v" + q.version],
          ["Grand total", <b className="font-mono tnum">{inr(q.grandTotalPaise)}</b>],
          ["Valid until", fmtDate(q.validUntil)],
        ]} />

        <Alert tone="warn" ico="lock" title="Once issued, this quotation cannot be edited.">
          Changes after this create a revision. Five steps commit as one — recalculate, assign the
          number and version, freeze the content and the customer snapshot, write the document,
          append the event — or none of them do, and the number is returned so the sequence has no
          unexplained gaps.
        </Alert>

        {q.parentQuotationId
          ? <Alert ico="history" title="This is a revision.">
              <b>The previous version becomes Superseded only after this issue succeeds</b> — never
              before.
            </Alert>
          : null}
      </div>
    </ModalShell>
  );
}
