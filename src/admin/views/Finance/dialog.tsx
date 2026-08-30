/* =============================================================================
   Finance — the dialog primitives every modal file shares. One shape, so a
   refusal always appears in the same place and a dialog never closes on a
   failed write: the sentence the refusal contradicts is still on screen.

   Each face owns its own modals (SubModals, SalaryModals, TxnModals,
   RefundModals) and they all build from here.
   ============================================================================= */
import type { ReactNode } from "react";
import { Icon, Notice } from "../../ui";

export type Done = (msg: string, tone?: string) => void;

/** The three slots every dialog has. Body is a form; the footer starts with a
 *  spacer; every dismiss carries data-close. */
export function Dlg({ title, sub, onClose, footer, err, children }: {
  title: ReactNode; sub?: ReactNode; onClose: () => void; footer: ReactNode; err?: string | null; children: ReactNode;
}) {
  return (
    <>
      <div className="md-h">
        <h3>{title}</h3>
        {sub ? <p>{sub}</p> : null}
        <button className="md-x" data-close="1" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
      </div>
      <div className="md-b fin-form">
        {err ? <Notice tone="bad" text={<b>{err}</b>} /> : null}
        {children}
      </div>
      <div className="md-f"><span className="spacer" />{footer}</div>
    </>
  );
}

export const Cancel = ({ onClose, label }: { onClose: () => void; label?: string }) =>
  <button className="btn" data-close="1" onClick={onClose}>{label || "Cancel"}</button>;

/** A labelled group. `hint` is the sentence under the legend that says what
 *  the field is FOR, not what to type in it. */
export function Fs({ legend, hint, req, children }: {
  legend: ReactNode; hint?: ReactNode; req?: boolean; children: ReactNode;
}) {
  return (
    <fieldset className="fin-fs">
      <legend>{legend}{req ? <span className="req"> *</span> : null}{hint ? <i>{hint}</i> : null}</legend>
      {children}
    </fieldset>
  );
}

export function Field({ label, help, children }: { label: ReactNode; help?: ReactNode; children: ReactNode }) {
  return (
    <label className="fin-fl">
      <span className="l">{label}</span>
      {children}
      {help ? <span className="help">{help}</span> : null}
    </label>
  );
}

/** Money in, money out — always typed in rupees and stored in paise, so the
 *  conversion happens in exactly one place. */
export function RupeeInput({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <span className="fin-rupee">
      <i>₹</i>
      <input className="inp tnum" inputMode="decimal" value={value} placeholder={placeholder || "0"}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))} />
    </span>
  );
}
/** Rupees typed by a person → integer paise. Returns null when it is not a
 *  clean amount, so the caller refuses rather than storing a rounded number. */
export function toPaise(v: string): number | null {
  const s = v.trim();
  if (!s || !/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(parseFloat(s) * 100);
}

export function Pick<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void; options: { key: T; label: string; help?: string }[];
}) {
  return (
    <div className="fin-seg" role="radiogroup">
      {options.map((o) => (
        <button key={o.key} type="button" role="radio" aria-checked={o.key === value} title={o.help}
          className={o.key === value ? "on" : ""} onClick={() => onChange(o.key)}>{o.label}</button>
      ))}
    </div>
  );
}
