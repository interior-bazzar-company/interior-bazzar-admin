/* =============================================================================
   InfoTip — the i button that holds a field's option meanings.
   -----------------------------------------------------------------------------
   Where hints GO when a control is made simple. Business type used to explain
   Dealer vs Retailer vs Wholesaler on every dropdown row and again under the
   field; that is the right information at the wrong volume — always on screen,
   mostly already known. Behind an i button it costs one press exactly when
   somebody is unsure, and the control itself stays a plain dropdown.

   A BUTTON with a dropdown panel, not a hover tooltip, on purpose: this is a
   paragraph of reference text, and hover tooltips vanish while being read,
   never open on touch, and never open on keyboard focus half the time. The
   panel closes on Escape and on any outside press.
   ============================================================================= */
import { useEffect, useRef, useState } from "react";
import { groupsFor, optionsFor } from "./store";
import type { ProfileField } from "./store";

export default function InfoTip({ f }: { f: ProfileField }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const opts = optionsFor(f);
  const groups = groupsFor(f);

  const row = (o: { key: string; label: string; hint?: string }) => (
    <div className="um-info-row" key={o.key}>
      <b>{o.label}</b>
      {o.hint ? <span>{o.hint}</span> : null}
    </div>
  );

  return (
    <span className="um-info" ref={box}>
      <button type="button" className="um-info-b" aria-expanded={open}
        aria-label={"What the " + f.label + " options mean"}
        onClick={() => setOpen(!open)}>i</button>
      {open ? (
        <div className="um-info-pop" role="note">
          {groups.length
            ? groups.map((g) => (
                <div key={g.key}>
                  <div className="um-info-g">{g.label}</div>
                  {opts.filter((o) => o.group === g.key).map(row)}
                </div>
              ))
            : opts.map(row)}
        </div>
      ) : null}
    </span>
  );
}
