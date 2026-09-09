/* =============================================================================
   InfoTip — the i button that holds a field's option meanings.
   -----------------------------------------------------------------------------
   Where hints GO when a control is made simple. Business type used to explain
   Dealer vs Retailer vs Wholesaler on every dropdown row and again under the
   field; that is the right information at the wrong volume — always on screen,
   mostly already known. Behind an i button it costs one press exactly when
   somebody is unsure, and the control itself stays a plain dropdown.

   It is the panel's `InfoDot` — a PRESS, not a hover, on purpose: this is a
   paragraph of reference text, and hover tooltips vanish while being read,
   never open on touch and only half the time on keyboard focus. The shared
   part owns the popover, its dismissal and its focus behaviour; this file owns
   only what goes inside one, which is the field's own vocabulary.
   ============================================================================= */
import { InfoDot } from "../../ui";
import { groupsFor, optionsFor } from "./store";
import type { ProfileField } from "./store";

function Row({ o }: { o: { key: string; label: string; hint?: string } }) {
  return (
    <div className="mt-1.5 first:mt-0">
      <b className="text-sm font-semibold text-primary">{o.label}</b>
      {o.hint ? <span className="text-sm text-tertiary"> — {o.hint}</span> : null}
    </div>
  );
}

export default function InfoTip({ f }: { f: ProfileField }) {
  const opts = optionsFor(f);
  const groups = groupsFor(f);

  return (
    <InfoDot label={"What the " + f.label + " options mean"}>
      {/* The field's own sentence first, when the schema gives one — what the
          question IS, before what each answer means. */}
      {typeof f.info === "string" ? <p className="mb-2 text-sm text-secondary">{f.info}</p> : null}
      {groups.length
        ? groups.map((g) => (
            <div key={g.key} className="mt-3 first:mt-0">
              <div className="label-mono mb-1">{g.label}</div>
              {opts.filter((o) => o.group === g.key).map((o) => <Row key={o.key} o={o} />)}
            </div>
          ))
        : opts.map((o) => <Row key={o.key} o={o} />)}
    </InfoDot>
  );
}
