/* Stands in for views/Plans/api during the render smoke test.
   The real `usePlans()` fetches `v1/admin/plans/`; there is no backend here, and
   the point of the test is that the assignment form renders correctly against
   whatever the catalogue answers — including when it answers badly. So the mode
   is switchable and every state gets rendered. */

export type Cycle = {
  id: number; months: number; price: number; oldPrice: number; badge: string; active: boolean;
};
export type Feature = { text: string; detail: string };
export type Usage = { members: number; membersActive: number; quotationLines: number };
export type Plan = {
  id: number; family: string; entityType: string; title: string; subtitle: string;
  tier: number; displayIndex: number; amount: number; payable: number; discountPct: string;
  duration: string; tag: string; badge: string; badgeIcon: string; features: Feature[];
  active: boolean; archived: boolean; updatedAt: string; usage: Usage; cycles: Cycle[];
};

const cycle = (id: number, months: number, price: number, badge = "", active = true): Cycle =>
  ({ id, months, price, oldPrice: 0, badge, active });

const plan = (id: number, family: string, title: string, subtitle: string,
  cycles: Cycle[], features: string[], extra: Partial<Plan> = {}): Plan => ({
  id, family, entityType: "business", title, subtitle,
  tier: id, displayIndex: id, amount: cycles[0]?.price || 0, payable: cycles[0]?.price || 0,
  discountPct: "", duration: "", tag: "", badge: "", badgeIcon: "",
  features: features.map((t) => ({ text: t, detail: "" })),
  active: true, archived: false, updatedAt: "2026-08-01T00:00:00Z",
  usage: { members: 0, membersActive: 0, quotationLines: 0 },
  cycles, ...extra,
});

const CATALOGUE: Plan[] = [
  plan(7, "starter", "Starter", "One city, a listed profile",
    [cycle(70, 12, 11800), cycle(71, 24, 21000, "Save 11%")],
    ["Up to 20 catalogue listings", "1 service city", "8 enquiries a month"]),
  plan(8, "growth", "Growth", "Two cities, featured rotation",
    [cycle(80, 12, 29500), cycle(81, 6, 16500), cycle(82, 24, 53000, "Best value")],
    ["Up to 60 catalogue listings", "2 service cities", "30 enquiries a month",
      "2 featured rotation slots"]),
  plan(9, "pro", "Pro", "Statewide reach, named contact",
    [cycle(90, 12, 64000)],
    ["Unlimited listings", "Up to 6 service cities", "First refusal on matched enquiries"]),
  /* Present in the catalogue and NOT offerable — off sale, archived, and one
     that is on sale but has no active cycle, so no duration and no price. The
     form must filter all three out. */
  plan(10, "legacy", "Legacy Bronze", "Withdrawn", [cycle(100, 12, 4000)], ["Old"],
    { active: false }),
  plan(11, "archived", "Archived Silver", "Gone", [cycle(110, 12, 5000)], ["Old"],
    { archived: true }),
  plan(12, "nocycle", "No Cycle", "On sale with nothing to sell",
    [cycle(120, 12, 9000, "", false)], ["Something"]),
];

type Mode = "ok" | "loading" | "error" | "empty";
let mode: Mode = "ok";
export const __setPlansMode = (m: Mode) => { mode = m; };

export function usePlans(): { loading: boolean; plans: Plan[]; error: string | null } {
  if (mode === "loading") return { loading: true, plans: [], error: null };
  if (mode === "error") return { loading: false, plans: [], error: "Could not reach the server." };
  if (mode === "empty") return { loading: false, plans: [], error: null };
  return { loading: false, plans: CATALOGUE, error: null };
}

export function rangeOf(pl: Plan): { lo: number; hi: number } | null {
  const on = pl.cycles.filter((c) => c.active);
  if (!on.length) return null;
  const prices = on.map((c) => c.price);
  return { lo: Math.min(...prices), hi: Math.max(...prices) };
}

export const savingOf = (c: Cycle) => (c.oldPrice > c.price ? c.oldPrice - c.price : 0);
export const rupees = (v: unknown) => {
  const n = parseFloat(String(v ?? "").replace(/[^\d.]/g, ""));
  return isNaN(n) ? 0 : n;
};
export const call = <T,>(p: Promise<T>) => p;
export function familiesOf(plans: Plan[]): string[] {
  const out: string[] = [];
  plans.forEach((p) => { if (out.indexOf(p.family) < 0) out.push(p.family); });
  return out;
}
