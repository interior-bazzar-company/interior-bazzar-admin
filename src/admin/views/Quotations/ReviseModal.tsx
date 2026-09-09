/* =====================================================================
   REVISE — the confirm before a clone, the prototype's `qt-revise` dialog.

   Revising is not destructive, and the dialog exists to say exactly that: the
   issued document stays as the customer received it, the clone starts as a
   Draft, and nothing is superseded or un-accepted until the revision is
   itself issued. It is one click away from the Revise button, so it has to
   distinguish "I meant this" from a mis-click — and the way to do that is to
   state what will and will not change, not to ask "are you sure?".

   So the dialog is a LIST OF FACTS, not a warning. Each one is an `Alert`
   carrying its own tone: neutral for what happens, warning for the window in
   which two documents are live at once, and — for the case operators used to
   believe was impossible — the plain statement that an acceptance survives.
   ===================================================================== */
import { useState } from "react";
import { Alert, ModalShell, Button } from "../../ui";
import { errMessage } from "../../../api/apiService";
import type { QuotationRow } from "./api";

export default function ReviseModal({ q, onClose, run }: {
  q: QuotationRow; onClose: () => void; run: () => Promise<unknown>;
}) {
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const accepted = q.status === "accepted";
  const ref = q.quotationNumber || "This version";

  const submit = () => {
    setErr(null); setBusy(true);
    run().catch((e: unknown) => { setErr(errMessage(e)); setBusy(false); });
  };

  return (
    <ModalShell
      title={"Revise " + (accepted ? "an accepted quotation" : "quotation")}
      sub={"from " + (q.quotationNumber || "draft") + " v" + q.version}
      ico="history"
      tone="brand"
      mono
      onClose={onClose}
      actions={<>
        <Button color="secondary" onClick={onClose} isDisabled={busy}>Cancel</Button>
        <Button color="primary" data-act="qt-revise-go" isLoading={busy} onClick={submit}>Create revision</Button>
      </>}>

      <div className="flex flex-col gap-3">
        {err ? <Alert tone="bad" title={err} /> : null}

        <Alert ico="history" title={ref + " stays exactly as the customer received it."}>
          This creates <b>v{q.version + 1} as a new Draft</b>, cloned from it — header and line
          items — and linked by <span className="font-mono tnum">parent_quotation_id</span>.
        </Alert>

        {q.status === "issued"
          ? <Alert tone="warn" ico="clock" title={ref + " is still the current proposal"}>
              While the revision sits in Draft it is still acceptable. It becomes Superseded only
              after the revision has successfully issued.
            </Alert>
          : null}

        {/* The case that used to be impossible, said plainly. */}
        {accepted
          ? <Alert ico="shield" title={"The acceptance on " + ref + " stands until the revision is issued and accepted in its turn."}>
              Nothing is undone by starting this: the deal keeps the value it already agreed, and if
              the customer does not take the new terms you simply cancel the draft and everything is
              where it was.
            </Alert>
          : null}

        <Alert ico="shield" title="An abandoned revision can be cancelled.">
          It consumes no quotation number, so nothing dangles.
        </Alert>
      </div>
    </ModalShell>
  );
}
