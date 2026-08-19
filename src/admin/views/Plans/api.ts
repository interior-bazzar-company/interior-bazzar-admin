/* =====================================================================
   PLANS — the real catalogue, from `v1/admin/plans/`.
   ---------------------------------------------------------------------
   Replaces IBPlans, the localStorage engine whose prices were typed into
   a seed file. Every figure on this module now comes from the same
   Subscription / PlanBillingCycle rows the public plans page renders, so
   the panel and the buyer cannot show different money.

   WHAT THE SERVER HAS, and what it does not
   ---------------------------------------------------------------------
   Has  · plan (title, family, tier, badge, features, isActive)
        · billing cycles — duration · price · oldPrice · badge · isActive.
          These are THE money: GapsController._plan_cycles() calls them
          "money source of truth" and the checkout charges from them.

   Has too · created/updated stamps, the archive flag (the soft delete), and
        the usage counts the list computes — memberships that point at the plan
        and quotation lines that name it.

   Does NOT have, so this module still does not show it: draft as a separate
   state (a plan is on sale, off sale, or archived), per-row discounts,
   installment plans, and a revision counter. Those were engine inventions.
   A figure with no row behind it is worse than no figure.

   Failure envelope: this endpoint family answers HTTP 200 ALWAYS and puts
   the refusal in `response:false` — `call()` below is the one place that
   knows it, so every caller can just try/catch.
   ===================================================================== */
import { useEffect, useState } from "react";
import AdminOpsService, { call } from "../../../api/modules/adminOps";
import type { PlanCycle, PlanRow } from "../../../api/modules/adminOps";
import { AppExceptions } from "../../../api/apiService";

export { call };

export type Cycle = {
  id: number;
  months: number;
  /** Rupees. What a buyer pays for this duration. */
  price: number;
  /** Rupees, or 0. Only a saving when it is ABOVE `price` — the public page
   *  ignores it otherwise, and so does this module. */
  oldPrice: number;
  badge: string;
  active: boolean;
};

/** One bullet on the public plan card. `detail` is the smaller line under it
 *  ("Interest · Intent · Urgency") — most features have none. */
export type Feature = { text: string; detail: string };

/** What POINTS AT a plan. Quotation lines carry no plan FK — they snapshot the
 *  title as free text — so the count is of lines that NAME this plan. */
export type Usage = { members: number; membersActive: number; quotationLines: number };

export type Plan = {
  id: number;
  family: string;
  entityType: string;
  title: string;
  subtitle: string;
  tier: number;
  displayIndex: number;
  /** Rupees. NOT what the buyer pays — the cycles are. This ranks upgrades:
   *  BusinessPlan.save() retires whichever of two active plans has the lower
   *  amount, so it has to stay truthful even though nothing displays it. */
  amount: number;
  payable: number;
  discountPct: string;
  duration: string;
  tag: string;
  badge: string;
  badgeIcon: string;
  features: Feature[];
  active: boolean;
  /** Archived: out of the catalogue for good, still readable and restorable. */
  archived: boolean;
  updatedAt: string;
  usage: Usage;
  cycles: Cycle[];
};

/** "₹53,099" / "53099" / 53099 → 53099. Blank or garbage → 0. */
export function rupees(v: unknown): number {
  const n = parseFloat(String(v ?? "").replace(/[^\d.]/g, ""));
  return isNaN(n) ? 0 : n;
}

function adaptCycle(c: PlanCycle): Cycle {
  return {
    id: c.id,
    months: c.durationMonths,
    price: rupees(c.price),
    oldPrice: rupees(c.oldPrice),
    badge: c.badgeLabel || "",
    active: !!c.isActive,
  };
}

export function adaptPlan(p: PlanRow): Plan {
  return {
    id: p.id,
    family: p.planFamily || "business",
    entityType: p.entityType || "",
    title: p.title || "",
    subtitle: p.subtitle || "",
    tier: Number(p.tier) || 0,
    displayIndex: Number(p.displayIndex) || 0,
    amount: rupees(p.amount),
    payable: rupees(p.payableAmount),
    discountPct: p.discountPercentage || "",
    duration: p.duration || "",
    tag: p.tag || "",
    badge: p.badge || "",
    badgeIcon: p.badgeIcon || "",
    /* The server stores [{text, subItem}] but accepts [str] too. Normalised to
       one shape here so the drawer and the editor cannot disagree. */
    features: (p.features || [])
      .map((f) => (typeof f === "string" ? { text: f, detail: "" } : { text: f.text, detail: f.subItem || "" }))
      .filter((f) => f.text),
    active: !!p.isActive,
    archived: !!p.isArchived,
    updatedAt: p.updatedAt || "",
    usage: p.usage || { members: 0, membersActive: 0, quotationLines: 0 },
    cycles: (p.billingCycles || []).map(adaptCycle).sort((a, b) => a.months - b.months),
  };
}

/* ============================================================= CALLS === */
/* `call()` — the always-200 envelope unwrapper — lives with the service that
   defines the convention (api/modules/adminOps) and is re-exported above so
   this module's files keep importing everything from one place. */

export type PlansState = { loading: boolean; plans: Plan[]; error: string | null };

/** The catalogue, re-fetched whenever `tick` changes — the module's stand-in
 *  for the engine's render() pump, and the only reader of the list endpoint. */
export function usePlans(tick: number): PlansState {
  const [state, setState] = useState<PlansState>({ loading: true, plans: [], error: null });
  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    call(AdminOpsService.plans())
      .then((data) => {
        if (cancelled) return;
        setState({ loading: false, plans: (data.plans || []).map(adaptPlan), error: null });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const msg = e instanceof AppExceptions ? e.message : "Could not reach the server.";
        setState({ loading: false, plans: [], error: msg });
      });
    return () => { cancelled = true; };
  }, [tick]);
  return state;
}

/* ============================================================ DERIVED === */
/** Cheapest and dearest ACTIVE cycle. Null when nothing is sellable — which
 *  is exactly the state the list rail flags, so it must not fall back to the
 *  plan's `amount` and quietly hide it. */
export function rangeOf(pl: Plan): { lo: number; hi: number } | null {
  const on = pl.cycles.filter((c) => c.active);
  if (!on.length) return null;
  const prices = on.map((c) => c.price);
  return { lo: Math.min(...prices), hi: Math.max(...prices) };
}

/** A cycle's saving, or 0. `oldPrice` below `price` is stale data, not a
 *  markup — the public page ignores it, and so does this. */
export const savingOf = (c: Cycle) => (c.oldPrice > c.price ? c.oldPrice - c.price : 0);

/** Every family the catalogue actually contains, in the order the server
 *  returns them. Not a hardcoded list: a family added server-side appears in
 *  the filter and the strip with no edit here. */
export function familiesOf(plans: Plan[]): string[] {
  const out: string[] = [];
  plans.forEach((p) => { if (out.indexOf(p.family) < 0) out.push(p.family); });
  return out;
}
