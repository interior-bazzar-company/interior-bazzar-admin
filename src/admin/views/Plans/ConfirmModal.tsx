/* =====================================================================
   The three guard modals — take off sale, archive, delete. Same shape in
   the prototype (header · error slot · one notice · cancel/confirm), so
   one component with the copy passed in, rather than three copies of the
   same markup that can drift.
   ===================================================================== */
import { useState } from "react";
import type { ReactNode } from "react";
import { Icon, Notice } from "../../ui";
import { isRefusal } from "./helpers";
import type { Refusal } from "./helpers";

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
  /** Runs the engine call. Returns the engine's own result; a refusal is rendered, not swallowed. */
  run: () => unknown;
  onClose: () => void;
}) {
  const [err, setErr] = useState<Refusal | null>(null);
  return (
    <>
      <div className="md-h">
        <h3>{heading}</h3>
        <p>{sub}</p>
        <button className="md-x" data-close="1" onClick={onClose}><Icon name="x" /></button>
      </div>
      <div className="md-b">
        <div id="plErr">
          {err ? <Notice tone="bad" text={<>
            <b>{err.http} <span className="mono">{err.code}</span></b>
            <div style={{ marginTop: "3px" }}>{err.detail}</div>
          </>} /> : null}
        </div>
        <Notice tone={tone} ico={ico} text={notice} />
      </div>
      <div className="md-f">
        <span className="spacer"></span>
        <button className="btn" data-close="1" onClick={onClose}>Cancel</button>
        <button className={confirmCls} data-act={act} onClick={() => {
          const r = run();
          if (isRefusal(r)) setErr(r);
        }}>{confirmLabel}</button>
      </div>
    </>
  );
}
