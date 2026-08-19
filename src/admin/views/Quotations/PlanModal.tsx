/* =====================================================================
   CHANGE PLAN — the prototype's `qt-plan` dialog, over the real catalogue
   (`v1/admin/plans/`, app_ib.Subscription — the same rows the Plans module
   edits and the pricing page reads).

   Two things it insists on:

     · DURATION IS A CHOICE, not a property of the tier. One plan sells at
       three lengths at three prices, so the length and the amount are picked
       together — showing only the headline term and letting the agent retype
       the rest is exactly the manual re-entry a catalogue exists to remove.
     · CHANGE plan, not ADD plan. One subscription per quotation, enforced by
       the interaction rather than by a validation message.

   The numbers are COPIED, not linked: what lands on the quotation is a name,
   a term and an amount, so a later edit to the plan sheet can never move a
   proposal that has already gone out.
   ===================================================================== */
import { useState } from "react";
import type { PlanRow } from "../../../api/modules/adminOps";
import { Icon, Notice, PaneLoading } from "../../ui";
import { inr } from "../../ui/format";
import { planLabel } from "./helpers";

/** One buyable length of one tier, in the units this dialog renders. */
type Dur = { months: number; rupees: number; wasRupees: number };

export type PlanPick = { name: string; months: number; rupees: number };

export default function PlanModal({ plans, loading, current, currentMonths, onClose, onPick }: {
  plans: PlanRow[]; loading: boolean; current: string; currentMonths: number;
  onClose: () => void; onPick: (p: PlanPick) => void;
}) {
  const [name, setName] = useState(current);
  /* Per-tier duration, so switching tiers and back does not lose the length
     you had already chosen on the first one. */
  const [months, setMonths] = useState<Record<string, number>>({});

  const dursOf = (p: PlanRow): Dur[] => {
    const cycles = (p.billingCycles || []).filter((c) => c.isActive);
    if (cycles.length) {
      return cycles.map((c) => ({
        months: c.durationMonths,
        rupees: Math.round(Number(c.price) || 0),
        wasRupees: Math.round(Number(c.oldPrice) || 0),
      })).sort((a, b) => a.months - b.months);
    }
    /* No cycle rows — the plan still has its headline term and price. */
    return [{ months: Number(p.duration) || 12, wasRupees: Math.round(Number(p.amount) || 0),
      rupees: Math.round(Number(p.payableAmount || p.amount) || 0) }];
  };

  /* Pre-selected length: the one already on the quotation if this is the plan
     it already carries, otherwise the tier's longest — its headline term. */
  const pickedMonths = (p: PlanRow, durs: Dur[]) => {
    const label = planLabel(p);
    if (months[label]) return months[label];
    if (label === current && currentMonths) return currentMonths;
    return durs[durs.length - 1].months;
  };

  const confirm = () => {
    const hit = plans.find((p) => planLabel(p) === name);
    if (!hit) return onClose();
    const durs = dursOf(hit);
    const m = pickedMonths(hit, durs);
    const d = durs.find((x) => x.months === m) || durs[durs.length - 1];
    onPick({ name, months: d.months, rupees: d.rupees });
  };

  return (
    <>
      <div className="md-h">
        <h3>Change plan</h3>
        <p>Single select — choosing another tier swaps it</p>
        <button className="md-x" data-close="1" aria-label="Close" onClick={onClose}><Icon name="x" /></button>
      </div>

      <div className="md-b">
        {loading && !plans.length ? <PaneLoading label="Loading the catalogue…" /> : null}
        {!loading && !plans.length
          ? <Notice tone="warn" ico="alert" text={<>
              <b>No plans to pick from.</b> Either the catalogue is empty or this session has no
              plan access — type the plan name on the form instead.
            </>} />
          : null}

        {plans.map((p) => {
          const label = planLabel(p);
          const on = label === name;
          const durs = dursOf(p);
          const pick = pickedMonths(p, durs);
          const feats = (p.features || []).map((f) => (typeof f === "string" ? f : f.text)).filter(Boolean);
          return (
            <label key={p.id} className={"check planpick" + (on ? " on" : "")}>
              <input type="radio" name="planPick" value={label} checked={on}
                onChange={() => setName(label)} />
              <span>
                <b>{label}</b>
                {p.subtitle ? <span className="faint"> · {p.subtitle}</span> : null}

                <div className="planpick-durs" role="radiogroup" aria-label="Duration">
                  {durs.map((d) => (
                    <label key={d.months} className={"planpick-dur" + (d.months === pick ? " on" : "")}>
                      <input type="radio" name={"planDur-" + p.id} value={d.months}
                        checked={d.months === pick}
                        onChange={() => { setName(label); setMonths((m) => ({ ...m, [label]: d.months })); }} />
                      <b>{d.months}m</b>
                      {/* A free tier says "Free". "₹0" reads as a price nobody
                          filled in, and the catalogue renders it the same way. */}
                      <span className="tnum">{d.rupees ? inr(d.rupees * 100) : "Free"}</span>
                      {d.wasRupees > d.rupees
                        ? <span className="planpick-off">
                            −{Math.round(((d.wasRupees - d.rupees) / d.wasRupees) * 100)}%</span>
                        : null}
                      {d.rupees
                        ? <span className="planpick-pm tnum">
                            {inr(Math.round((d.rupees * 100) / (d.months || 1)))}/mo</span>
                        : null}
                    </label>
                  ))}
                </div>

                {feats.length
                  ? <div className="help" style={{ marginTop: "5px" }}>
                      {feats.slice(0, 5).join(" · ")}
                      {feats.length > 5 ? " · +" + (feats.length - 5) + " more" : ""}
                    </div>
                  : null}
              </span>
            </label>
          );
        })}

        {plans.length
          ? <Notice ico="check" text={<>
              <b>Picking a tier and a length fills the term and the amount</b> — from the catalogue, at
              the price that tier is set to today. Both stay editable underneath: this is where a
              negotiation starts, not what it has to end at. <b>The numbers are copied, not linked</b> —
              a later change to the plan cannot move this quotation.
            </>} />
          : null}
      </div>

      <div className="md-f">
        <span className="spacer"></span>
        <button className="btn" data-close="1" onClick={onClose}>Cancel</button>
        <button className="btn pri" disabled={!name} onClick={confirm}>Change plan</button>
      </div>
    </>
  );
}
