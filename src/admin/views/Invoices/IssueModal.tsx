/* =====================================================================
   ISSUE — the last guard, the prototype's `in-issue` dialog, and the same
   dialog the quotation gets before ITS irreversible step.

   Issuing allocates a number out of the statutory sequence and freezes the
   document (InvoicesController.Issue). It records NO payment -- the money is
   logged later with "Record payment", which writes the deal ledger. A spent
   number cannot be taken back, so it gets a dialog that states what is about
   to be true.

   The blocker list is the same check the server runs (see helpers.blockersOf).
   The server re-checks all of them — this only says, before you commit,
   whether it is going to say yes.
   ===================================================================== */
import { useState } from "react";
import { Alert, Button, KvList, ModalShell } from "../../ui";
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

  /* Left enabled even with blockers listed. The server is the authority on
     whether this can be issued, and its refusal — in its own words — is a
     better answer than a dead button that never says why. */
  const submit = () => {
    setErr(null); setBusy(true);
    run().catch((e: unknown) => { setErr(errMessage(e)); setBusy(false); });
  };

  return (
    <ModalShell
      title="Issue invoice"
      sub={inr(inv.grandTotalPaise) + " · due " + fmtDate(inv.dueDate)}
      mono
      ico="check"
      tone={blockers.length ? "warning" : "brand"}
      onClose={onClose}
      actions={<>
        <Button color="secondary" onClick={onClose} isDisabled={busy}>Cancel</Button>
        <Button color="primary" data-act="in-issue-go" isLoading={busy} onClick={submit}>Issue invoice</Button>
      </>}>

      <div className="flex flex-col gap-3">
        {err ? <Alert tone="bad" title={err} /> : null}

        {blockers.length
          ? <Alert tone="bad" ico="alert" title="These must be fixed first">
              <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-4">
                {blockers.map((b) => <li key={b}>{b}</li>)}
              </ul>
            </Alert>
          : <Alert tone="ok" ico="check" title="Validation passed.">
              The line, the billing block and the due date are in place. That this total matches the
              accepted quotation and still fits what is uninvoiced on the deal is the server's own last check.
            </Alert>}

        <KvList pairs={[
          ["Number", <span className="text-quaternary">allocated by this transaction, under a sequence lock</span>],
          ["Billing", plan
            ? <>{plan.description} <span className="text-quaternary">
                {plan.remark
                  || (plan.installmentCount
                    ? "installment " + plan.installmentSeq + " of " + plan.installmentCount
                    : "full amount")}</span></>
            : <span className="text-quaternary">no plan line</span>],
          ["Grand total", <b className="font-mono tnum">{inr(inv.grandTotalPaise)}</b>],
          ["Due date", fmtDate(inv.dueDate)],
        ]} />

        <Alert tone="warn" ico="lock" title="Once issued, this invoice cannot be edited.">
          A correction is a cancellation and a new invoice. The number it takes stays spent either
          way — the sequence is statutory, so it never has unexplained gaps.
        </Alert>

        <Alert tone="info" title="Issuing records no payment.">
          It numbers and freezes this invoice as a demand for {inr(inv.grandTotalPaise)}. When the
          money arrives, record the payment against it — that is what writes the deal ledger.
        </Alert>
      </div>
    </ModalShell>
  );
}
