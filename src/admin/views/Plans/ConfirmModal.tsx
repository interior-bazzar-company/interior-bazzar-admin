/* =====================================================================
   The guard modals — take off sale, delete. Same shape (header · error
   slot · one notice · cancel/confirm), so one component with the copy
   passed in, rather than copies of the same markup that can drift.

   `run` is the API call. A refusal is RENDERED here, in the dialog that
   tried it, never swallowed — and the dialog stays open so the notice it
   just contradicted is still on screen.
   ===================================================================== */
import { useState } from "react";
import type { ReactNode } from "react";
import { Icon, Notice } from "../../ui";
import { errMessage } from "../../../api/apiService";

export default function ConfirmModal({
  heading, sub, notice, tone, ico, confirmLabel, confirmCls, act, run, onClose
}: {
  heading: string;
  sub: string;
  notice: ReactNode;
  tone?: string;
  ico?: string;
  confirmLabel: string;
  confirmCls: string;
  act: string;
  run: () => Promise<unknown>;
  onClose: () => void;
}) {
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <div className="md-h">
        <h3>{heading}</h3>
        <p>{sub}</p>
        <button className="md-x" data-close="1" onClick={onClose}><Icon name="x" /></button>
      </div>
      <div className="md-b">
        <div id="plErr">
          {err ? <Notice tone="bad" text={<b>{err}</b>} /> : null}
        </div>
        <Notice tone={tone} ico={ico} text={notice} />
      </div>
      <div className="md-f">
        <span className="spacer"></span>
        <button className="btn" data-close="1" onClick={onClose}>Cancel</button>
        <button className={confirmCls} data-act={act} disabled={busy} onClick={() => {
          setErr(null); setBusy(true);
          run().catch((e: unknown) => { setErr(errMessage(e)); setBusy(false); });
        }}>{busy ? "Working…" : confirmLabel}</button>
      </div>
    </>
  );
}
