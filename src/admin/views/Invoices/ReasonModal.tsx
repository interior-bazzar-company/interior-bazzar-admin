/* A one-field guard modal — "why" — before cancelling an issued invoice or
   removing a payment proof. Own copy per module, same shape as Quotations'. */
import { useState } from "react";
import { Icon, Notice } from "../../ui";
import { errMessage } from "../../../api/apiService";

export default function ReasonModal({
  heading, sub, label, required, confirmLabel, confirmCls, onClose, run,
}: {
  heading: string; sub: string; label: string; required?: boolean;
  confirmLabel: string; confirmCls: string;
  onClose: () => void; run: (reason: string) => Promise<unknown>;
}) {
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = () => {
    const reason = text.trim();
    if (required && !reason) { setErr("A reason is required."); return; }
    setErr(null); setBusy(true);
    run(reason).catch((e: unknown) => { setErr(errMessage(e)); setBusy(false); });
  };

  return (
    <>
      <div className="md-h">
        <h3>{heading}</h3>
        <p>{sub}</p>
        <button className="md-x" data-close="1" onClick={onClose}><Icon name="x" /></button>
      </div>
      <div className="md-b">
        {err ? <Notice tone="bad" text={<b>{err}</b>} /> : null}
        <div className="fg">
          <label>{label}{required ? <> <span className="req">*</span></> : null}</label>
          <textarea className="inp" rows={3} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
        </div>
      </div>
      <div className="md-f">
        <span className="spacer"></span>
        <button className="btn" data-close="1" onClick={onClose}>Cancel</button>
        <button className={confirmCls} disabled={busy} onClick={submit}>{busy ? "Working…" : confirmLabel}</button>
      </div>
    </>
  );
}
