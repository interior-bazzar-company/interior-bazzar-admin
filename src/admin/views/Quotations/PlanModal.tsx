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

   THE DRAWING. Two nested radio groups is an unusual shape, so it is made
   legible rather than clever: the tier is a selectable PLANE (the brand on its
   edge when chosen), and the lengths are chips inside that plane, so "which
   tier" and "which length" are read in that order and never confused. Both are
   real `<input type="radio">`s under the surface — the arrow keys, the
   grouping and the announcement come from the platform, not from us.
   ===================================================================== */
import { useState } from "react";
import type { PlanRow } from "../../../api/modules/adminOps";
import { Alert, Button, ModalShell, PaneLoading } from "../../ui";
import { cx } from "@/utils/cx";
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
    <ModalShell
      title="Change plan"
      sub="Single select — choosing another tier swaps it"
      ico="tag"
      tone="brand"
      onClose={onClose}
      actions={<>
        <Button color="secondary" onClick={onClose}>Cancel</Button>
        <Button color="primary" isDisabled={!name} onClick={confirm}>Change plan</Button>
      </>}>

      <div className="flex flex-col gap-3">
        {loading && !plans.length ? <PaneLoading label="Loading the catalogue…" /> : null}
        {!loading && !plans.length
          ? <Alert tone="warn" ico="alert" title="No plans to pick from.">
              Either the catalogue is empty or this session has no plan access — type the plan name
              on the form instead.
            </Alert>
          : null}

        {plans.map((p) => {
          const label = planLabel(p);
          const on = label === name;
          const durs = dursOf(p);
          const pick = pickedMonths(p, durs);
          const feats = (p.features || []).map((f) => (typeof f === "string" ? f : f.text)).filter(Boolean);
          return (
            <label
              key={p.id}
              className={cx(
                "flex cursor-pointer flex-col gap-2.5 rounded-xl p-3.5 ring-1 transition duration-100",
                on ? "bg-brand-primary ring-2 ring-brand" : "bg-primary ring-secondary hover:ring-primary",
              )}
            >
              <span className="flex items-center gap-2.5">
                <input
                  type="radio" name="planPick" value={label} checked={on}
                  className="size-4 shrink-0 accent-brand-solid"
                  onChange={() => setName(label)} />
                <span className="min-w-0 flex-1 text-sm font-semibold text-primary">{label}</span>
                {p.subtitle ? <span className="truncate text-xs text-tertiary">{p.subtitle}</span> : null}
              </span>

              {/* THE LENGTHS. Indented under the tier they belong to, so the
                  nesting is visible rather than inferred. */}
              <span className="flex flex-wrap gap-2 pl-6.5" role="radiogroup" aria-label={label + " duration"}>
                {durs.map((d) => {
                  const chosen = d.months === pick;
                  return (
                    <label
                      key={d.months}
                      className={cx(
                        "flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs ring-1 transition duration-100",
                        chosen && on ? "bg-primary ring-2 ring-brand" : "bg-primary ring-secondary hover:ring-primary",
                      )}
                    >
                      <input
                        type="radio" name={"planDur-" + p.id} value={d.months} checked={chosen}
                        className="sr-only"
                        onChange={() => { setName(label); setMonths((m) => ({ ...m, [label]: d.months })); }} />
                      <b className="font-semibold text-primary tnum">{d.months}m</b>
                      {/* A free tier says "Free". "₹0" reads as a price nobody
                          filled in, and the catalogue renders it the same way. */}
                      <span className="font-mono text-secondary tnum">{d.rupees ? inr(d.rupees * 100) : "Free"}</span>
                      {d.wasRupees > d.rupees
                        ? <span className="font-medium text-success-primary tnum">
                            −{Math.round(((d.wasRupees - d.rupees) / d.wasRupees) * 100)}%</span>
                        : null}
                      {d.rupees
                        ? <span className="text-quaternary tnum">
                            {inr(Math.round((d.rupees * 100) / (d.months || 1)))}/mo</span>
                        : null}
                    </label>
                  );
                })}
              </span>

              {feats.length
                ? <span className="pl-6.5 text-xs text-tertiary">
                    {feats.slice(0, 5).join(" · ")}
                    {feats.length > 5 ? " · +" + (feats.length - 5) + " more" : ""}
                  </span>
                : null}
            </label>
          );
        })}

        {plans.length
          ? <Alert ico="check" title="Picking a tier and a length fills the term and the amount">
              From the catalogue, at the price that tier is set to today. Both stay editable
              underneath: this is where a negotiation starts, not what it has to end at.{" "}
              <b>The numbers are copied, not linked</b> — a later change to the plan cannot move this
              quotation.
            </Alert>
          : null}
      </div>
    </ModalShell>
  );
}
