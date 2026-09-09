/* =============================================================================
   Finance — the dialog primitives every modal file shares. One shape, so a
   refusal always appears in the same place and a dialog never closes on a
   failed write: the sentence the refusal contradicts is still on screen.

   All four names below are now thin wrappers over the shared layer —
   `ModalShell`, `FormSection`, `FormField`, `InputGroup`, `Segmented` and
   `Radio` — because a dialog in Finance should be indistinguishable from a
   dialog in Deals. What survives is the module's own prop shapes, so the four
   modal files that call them did not move a line.

   Each face owns its own modals (SubModals, SalaryModals, TxnModals,
   RefundModals) and they all build from here.
   ============================================================================= */
import type { ReactNode } from "react";
import { Alert, Button, FormField, FormSection, InputGroup, Input, Radio, Segmented } from "../../ui";
import { ModalShell } from "../../ui";

export type Done = (msg: string, tone?: string) => void;

/** The three slots every dialog has. Body is a form; the footer's primary is
 *  last; every dismiss carries data-close. The error is an `Alert` at the top
 *  of the body — above the fields it contradicts, never in place of them. */
export function Dlg({ title, sub, onClose, footer, err, children }: {
  title: ReactNode; sub?: ReactNode; onClose: () => void; footer: ReactNode; err?: string | null; children: ReactNode;
}) {
  return (
    <ModalShell title={title} sub={sub} onClose={onClose} actions={footer}>
      <div className="flex flex-col gap-5">
        {err ? <Alert tone="bad" title={err} /> : null}
        {children}
      </div>
    </ModalShell>
  );
}

export const Cancel = ({ onClose, label }: { onClose: () => void; label?: string }) => (
  <Button color="secondary" data-close="1" onClick={onClose}>{label || "Cancel"}</Button>
);

/** A labelled group. `hint` is the sentence under the legend that says what
 *  the field is FOR, not what to type in it. */
export function Fs({ legend, hint, req, children }: {
  legend: ReactNode; hint?: ReactNode; req?: boolean; children: ReactNode;
}) {
  return (
    <FormSection
      title={<>{legend}{req ? <span className="text-brand-tertiary" title="Required"> *</span> : null}</>}
      desc={hint}
    >
      {children}
    </FormSection>
  );
}

export function Field({ label, help, children }: { label: ReactNode; help?: ReactNode; children: ReactNode }) {
  return <FormField label={label} hint={help}>{children}</FormField>;
}

/** Money in, money out — always typed in rupees and stored in paise, so the
 *  conversion happens in exactly one place. The ₹ is welded to the field
 *  rather than floating beside it: one control, one border. */
export function RupeeInput({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <InputGroup pre="₹">
      <Input
        mono
        value={value}
        ph={placeholder || "0"}
        ariaLabel="Amount in rupees"
        onChange={(v) => onChange(v.replace(/[^0-9.]/g, ""))}
      />
    </InputGroup>
  );
}

/** Rupees typed by a person → integer paise. Returns null when it is not a
 *  clean amount, so the caller refuses rather than storing a rounded number. */
export function toPaise(v: string): number | null {
  const s = v.trim();
  if (!s || !/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(parseFloat(s) * 100);
}

/** ONE OF A SET. Two drawings, chosen by what the set is:
 *
 *    · an option that needs EXPLAINING is a radio with its help under it —
 *      a refund ground and a tag kind are decisions, and a segmented control
 *      has nowhere to put the sentence that makes the decision possible;
 *    · a short set of plain words is a `Segmented` control, switched in one
 *      press;
 *    · a long set of plain words wraps as radios rather than overflowing a
 *      segmented strip nobody can reach the end of.
 *
 *  All three are one radiogroup to a screen reader, which is what this always
 *  was. */
export function Pick<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void; options: { key: T; label: string; help?: string }[];
}) {
  const explained = options.some((o) => !!o.help);
  if (!explained && options.length <= 4) {
    return (
      <Segmented
        value={value}
        options={options.map((o) => ({ v: o.key, l: o.label }))}
        onPick={(v) => onChange(v as T)}
        label="Choose one"
      />
    );
  }
  const name = "pick-" + options.map((o) => o.key).join("-");
  return (
    <div
      role="radiogroup"
      className={explained ? "flex flex-col gap-2" : "flex flex-wrap gap-x-5 gap-y-2"}
    >
      {options.map((o) => (
        <Radio
          key={o.key}
          id={name + "-" + o.key}
          name={name}
          value={o.key}
          checked={o.key === value}
          label={o.label}
          hint={o.help}
          onChange={(v) => onChange(v as T)}
        />
      ))}
    </div>
  );
}
