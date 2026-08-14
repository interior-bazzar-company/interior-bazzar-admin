/* =====================================================================
   PLANS — the small pure helpers the catalogue, the drawer and the
   pricing editor all share. Lifted verbatim from views-plans.js so the
   three surfaces cannot disagree with each other.
   ===================================================================== */
import { IBData, IBPlans } from "../../engines";

/* engines/index.d.ts declares every namespace `any` on purpose, so a plan, a
   pricing row, a feature and an event all arrive untyped. One alias for that,
   rather than the escape hatch written out again at twenty call sites. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FromEngine = any;

/* "1 months" reads as a typo. One helper, used by the drawer table and the
   pricing editor alike, so the two cannot disagree. */
export function monthsLabel(n: number) { return n + (n === 1 ? " month" : " months"); }

/* ₹0 is a real price — Business · Free Forever — and "₹0" reads as a
   number somebody forgot to fill in. One formatter, used everywhere a plan
   price is shown, so the free tier says the same thing on every surface. */
export function money(paise: number) { return paise ? IBData.inr(paise) : "Free"; }

export function catIndex(k: string) {
  for (let i = 0; i < IBPlans.CATEGORIES.length; i++) if (IBPlans.CATEGORIES[i].key === k) return i;
  return 99;
}

export function sorter(k?: string) {
  return function (a: FromEngine, b: FromEngine) {
    if (k === "title") return a.title < b.title ? -1 : 1;
    if (k === "updated") return (b.updated_at || "") < (a.updated_at || "") ? -1 : 1;
    if (k === "members") return IBPlans.membersOf(b).length - IBPlans.membersOf(a).length;
    if (k === "price") {
      const ra = IBPlans.rangeOf(a), rb = IBPlans.rangeOf(b);
      return (rb ? rb.hi : 0) - (ra ? ra.hi : 0);
    }
    /* Default: grouped by category in the order the categories are
       declared, then CHEAPEST FIRST inside each one — so the list reads as
       the ladder both plan sheets present, Free → Signature → Premium →
       Elite and Starter → Growth → Scale.

       It was alphabetical, which put Elite — the top tier — above Free
       Forever and turned a price ladder into a word list. Sorting by entry
       price recovers the shape without anyone having to maintain a rank
       field. Unpriced plans sink: a tier with no price has no place on a
       ladder, and it is the one thing on this page that needs attention. */
    const ia = catIndex(a.category), ib = catIndex(b.category);
    if (ia !== ib) return ia - ib;
    const ra = IBPlans.rangeOf(a), rb = IBPlans.rangeOf(b);
    if (!ra && !rb) return a.title < b.title ? -1 : 1;
    if (!ra) return 1;
    if (!rb) return -1;
    if (ra.lo !== rb.lo) return ra.lo - rb.lo;
    return a.title < b.title ? -1 : 1;
  };
}

/* The one failure state a catalogue can have: on sale, and unpriceable.
   The engine refuses to create it, so this rail is here for records that
   predate the guard or arrive from a store written by an older build. */
export function urgency(pl: FromEngine): { cls: string; why: string } | null {
  if (pl.status === "active" && !IBPlans.activeRows(pl).length)
    return { cls: "u-bad", why: "On sale with no active price — it cannot be quoted" };
  if (pl.status === "draft" && !pl.pricing.length)
    return { cls: "u-warn", why: "Draft with no pricing yet" };
  return null;
}

/* The prototype read `S.state.user`, which the shell never set — so it always
   fell through to this literal. Here the signed-in member is really available,
   which is what that expression was reaching for. */
export function actor() {
  return IBData.TeamStore.current() || { name: "Admin", role: "super_admin" };
}

/* A refusal from an engine: { ok:false, http:403, code:"forbidden", detail } */
export type Refusal = { ok: false; http: number; code: string; detail: string };
export const isRefusal = (r: unknown): r is Refusal =>
  !!r && (r as { ok?: unknown }).ok === false;
