/* =====================================================================
   REVISE — the confirm before a clone, the prototype's `qt-revise` dialog.

   Revising is not destructive, and the dialog exists to say exactly that: the
   issued document stays as the customer received it, the clone starts as a
   Draft, and nothing is superseded or un-accepted until the revision is
   itself issued. It is one click away from the Revise button, so it has to
   distinguish "I meant this" from a mis-click — and the way to do that is to
   state what will and will not change, not to ask "are you sure?".
   ===================================================================== */
import { useState } from "react";
import { Icon, Notice } from "../../ui";
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
    <>
      <div className="md-h">
        <h3>Revise {accepted ? "an accepted quotation" : "quotation"}</h3>
        <p>from {q.quotationNumber || "draft"} v{q.version}</p>
        <button className="md-x" data-close="1" aria-label="Close" onClick={onClose}><Icon name="x" /></button>
      </div>

      <div className="md-b">
        {err ? <Notice tone="bad" text={<b>{err}</b>} /> : null}

        <Notice ico="history" text={<>
          <b>{ref} stays exactly as the customer received it.</b> This creates <b>v{q.version + 1} as a
          new Draft</b>, cloned from it — header and line items — and linked by{" "}
          <span className="mono">parent_quotation_id</span>.
        </>} />

        {q.status === "issued"
          ? <Notice tone="warn" ico="clock" text={<>
              While the revision sits in Draft, <b>{ref} is still the current proposal and is still
              acceptable</b>. It becomes Superseded only after the revision has successfully issued.
            </>} />
          : null}

        {/* The case that used to be impossible, said plainly. */}
        {accepted
          ? <Notice ico="shield" text={<>
              <b>The acceptance on {ref} stands until the revision is issued and accepted in its
              turn.</b> Nothing is undone by starting this: the deal keeps the value it already agreed,
              and if the customer does not take the new terms you simply cancel the draft and
              everything is where it was.
            </>} />
          : null}

        <Notice ico="shield" text={<>
          An abandoned revision can be cancelled. It consumes no quotation number, so nothing dangles.
        </>} />
      </div>

      <div className="md-f">
        <span className="spacer"></span>
        <button className="btn" data-close="1" onClick={onClose}>Cancel</button>
        <button className="btn pri" data-act="qt-revise-go" disabled={busy} onClick={submit}>
          {busy ? "Creating…" : "Create revision"}</button>
      </div>
    </>
  );
}
